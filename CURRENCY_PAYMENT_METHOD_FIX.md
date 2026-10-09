# Currency Fix — the customer picks the payment method, the currency follows

## The reported problem

> *"Myself and my wife were born in India, so the site shows Indian rupees. My son
> was born in Nadi, so it shows Fiji dollars. If any user is born in the United
> States it asks for USD. This is not good. After filling the birth details of all
> family members, the user should decide how to pay — Indian payment method GPay,
> international payment method PayPal, Fiji payment method Vodafone M-PAiSA — and
> then pay."*

## What was actually wrong

| Where | Problem |
|---|---|
| `src/pages/*.tsx` (`handleAddToFamilyTray`) | Each chart got `currency`/`unitPrice` from **its own birth place** (`isIndia ? 'INR' : isFiji ? 'FJD' : 'USD'`). |
| `src/context/CartContext.tsx` | `totalAmount` **summed those mixed numbers** (`499 + 499 + 35`) and the displayed currency was just `items[0].currency` → a meaningless "₹1033". |
| `src/components/cart/UnifiedCheckoutModal.tsx` | The tray showed one currency per line but one total in another; the "Pay Total" box reused that mixed number for whichever method was picked. |
| `api/services/index.php`, `server/db/store.ts` | The server derived the order currency from `country` (= the **birth** country of the first item) and only let the payment method override it in one direction — so an India-born family paying by PayPal was still stored/charged in INR. |

## The rule now (one place, used everywhere)

**The payment method the customer chooses at checkout decides the currency of the
whole family order. A birth place never does.**

| Payment method | Currency |
|---|---|
| Vodafone M-PAiSA / Digicel MyCash | FJD (Fiji) |
| Google Pay / UPI | INR (India) |
| PayPal / Card | USD (International) |

A country is only consulted as a fallback when there is **no** real payment method
(FREE_BETA / `NONE`), and then it is the **billing country of the account**, never
a birth place.

The rule lives in `src/services/pricing.ts` and is shared by:

* the React UI (`CartContext`, family tray, floating bar, checkout modal, the three
  service pages),
* the Node backend (`server/db/store.ts` → `createOrder`, `createMultiOrder`),
* the test suite (`npm test` → TEST 16),
* and mirrored in PHP by `astro_currency_for_payment()` in `api/config.php`.

## What changed

### 1. New shared money module — `src/services/pricing.ts`
`PAYMENT_METHOD_CURRENCY`, `getCurrencyForPaymentMethod`, `resolveOrderCurrency`,
`getServicePrices` (admin overrides from both settings shapes: Node
`servicePricing` and PHP `pricing`), `cartItemPrices`, `computeCartTotals`,
`cartTotalForPaymentMethod`, `formatMoney`.

### 2. Every chart is priced in **all three** currencies
`CartItem.prices = { FJD, INR, USD }` is captured when a chart is added to the
Family Tray, so switching payment method later re-prices the whole tray instantly
and nothing has to be re-derived from a birth place. Old carts saved in
`localStorage` without `prices` are rebuilt from the current admin pricing.

### 3. Family Tray + floating bar
* `Total Amount Once (INR)`, `Total in FJD`, etc. — always one currency.
* A compact **"Pay with"** picker in the tray footer: each button shows what the
  whole family costs in that method's currency (M-PAiSA `FJ$105.00`,
  GPay `₹1,497.00`, PayPal `US$54.00`), so the decision can be made before
  checkout. The choice is remembered in `localStorage`.
* The choice is pre-selected from the **account** country only (a convenience
  default the customer can always change).

### 4. Unified Checkout
Step 1 lists every chart priced in the chosen currency; step 2 is the payment
method picker; the instruction box, the submit button (`Pay ₹1,497.00 INR — 3
Charts`) and the success screen all use that single currency. The request now
carries `paymentMethod`, `currency`, `totalAmount` and `billingCountry`
(account country) — `country` per item stays the birth country for display and
astrology only.

### 5. Backends
* `api/config.php` → new `astro_currency_for_payment()` + `astro_currency_symbol()`.
* `api/services/index.php` → both order handlers (single + `multi-order`) use it;
  the multi-order response now returns the authoritative `currency`,
  `totalAmount` and `paymentMethod`, and the audit log records
  `"charged 1,497.00 INR via GPAY"`.
* `server/db/store.ts` → `createOrder` / `createMultiOrder` resolve the currency
  through the shared rule and price each chart with `getServicePrices()`, so the
  whole family group shares one currency and one payment method.
* `server/routes/services.ts` → forwards `billingCountry` / `currency`.

## Example — the exact reported family

Husband (Chennai, India) + Wife (Madurai, India) + Son (Nadi, Fiji), 3 × Birth Jathagam:

| Customer chooses | Currency | Per chart | Total |
|---|---|---|---|
| Google Pay / UPI | INR | ₹499 | **₹1,497.00** |
| Vodafone M-PAiSA | FJD | FJ$35 | **FJ$105.00** |
| PayPal / Card | USD | US$18 | **US$54.00** |

Before this fix the tray showed `₹1033` (499 + 499 + 35).

## Deploying to cPanel (BigRock)

1. `npm run build`
2. Copy `dist/*` → `public_html/`
3. Copy `api/*` → `public_html/api/` — **required**: this ships the new
   `astro_currency_for_payment()` helper in `api/config.php` and the updated
   `api/services/index.php`.
4. Keep the existing `public_html/api/config.php` **database credentials** — merge,
   do not overwrite blindly (the new helper functions must be present).

No data migration is needed. Existing orders keep the currency they were stored
with; only newly placed orders use the payment-method rule.

## Tests

`npm test` → **TEST 16: Family Order Currency Is Decided By The Payment Method,
Never By Birth Place** covers:

* every payment-method → currency mapping, including "born in India but paying by
  PayPal ⇒ USD";
* the reported family (India + India + Fiji) totals in all three currencies, and
  the assertion that the old mixed `1033` total is gone;
* admin pricing overrides in both the PHP (`pricing`) and Node (`servicePricing`)
  shapes, FREE_BETA zeroing, and rebuilding legacy carts;
* the **real** `PaymentMethodSelector` and the **real** family-tray bar rendered
  with `react-dom/server` (asserting `₹1497.00` / `Total in INR`);
* the **real** Node backend (`db.createMultiOrder`) storing one currency across a
  3-chart family for GPay, M-PAiSA and PayPal;
* source-level guards so the birth-place rule cannot creep back into the PHP API,
  the Node store, the service pages or the checkout modal.
