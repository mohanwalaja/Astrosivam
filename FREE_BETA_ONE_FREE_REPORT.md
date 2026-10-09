# Free Beta — Exactly 1 Free Report Per IP Address

## The rule

During the **Free Beta**, every customer gets **exactly ONE free astrology report**,
tracked **per IP address** (the `beta_ip_orders` table that already exists):

| Scenario | Result |
|---|---|
| First order is a **single** order (1 chart) | That report is **FREE**. No payment needed. |
| First order is a **family** order (N charts) | **Member 1 is FREE.** Members 2…N pay the normal price — one payment method + one transaction reference covers them all. |
| Any **later** order from the same IP (single or family) | **Fully paid** — the order is *accepted*, not rejected. The customer simply pays like in PAID mode. |
| Admin switches the site to `PAID` | Unchanged behaviour — everything is paid. |

The free slot is consumed **only by the genuinely free chart**: a family order
records exactly **one** `beta_ip_orders` row (the first chart), and paid charts
never consume the slot.

## What changed

### Before
* FREE_BETA made **every chart of a family bundle free** (a 5-member family
  consumed 5 free reports for one IP).
* The **second** order from the same IP was hard-**rejected** with HTTP 429
  (`FREE BETA LIMIT REACHED`), so a customer could not order again at all
  during the beta.

### After
* FREE_BETA prices **only the first chart** of an order at $0.
* Every additional chart is charged at the normal price, in the currency of
  the chosen payment method (unchanged currency rules).
* Once the free chart is used, later orders become **normal paid orders**
  (payment method + genuine transaction reference required) — no rejection.

## Where it is enforced

| Layer | File | Change |
|---|---|---|
| PHP API (live cPanel) | `api/services/index.php` | `multi-order`: `$freeChartAvailable = $isFreeBetaMode && $ipOrderCount < 1`, `$isThisItemFree = $freeChartAvailable && $idx === 0`, payment required when `$paidChartCount > 0`. `order`: `$isFreeOrder` / `$effectiveServiceMode` — a used free chart produces a **PAID** order, not a 429. |
| PHP settings | `api/services/index.php`, `api/admin/index.php` | `GET /api/services/settings` (and the admin settings GET) now return **`betaFreeChartAvailable`** for the *requesting IP*, so the UI can price chart 1 free before submit. |
| Node backend | `server/routes/services.ts`, `server/db/store.ts`, `server/routes/admin.ts` | Identical rule: only chart 1 of a multi-order is free (`isThisItemFree = freeChartAvailable && index === 0`), single orders flip to PAID once the slot is used, settings endpoints expose `betaFreeChartAvailable`, 429 beta rejection removed. |
| Pricing module | `src/services/pricing.ts` | `computeCartTotals()` zeroes **only the first cart line** while the free chart is available; new `isBetaFreeChartAvailable()` helper; `CartTotals.freeChartAvailable` flag. |
| Cart | `src/context/CartContext.tsx` | `itemPrice(item, index)` / `itemPrices(item, index)` are now position-aware (index 0 = free while available); context exposes `betaFreeChartAvailable`. |
| Checkout | `src/components/cart/UnifiedCheckoutModal.tsx` | Sends a **real payment method + reference whenever there is something to pay** (`paymentMethod: requiresPayment ? paymentMethod : 'NONE'`); shows "Chart 1 is FREE — you are paying for the remaining N−1 charts"; success message reflects the actual free/paid split of the created orders. |
| Family tray | `FamilyCartDrawer.tsx`, `FamilyCartFloatingBar.tsx` | "Chart 1 is FREE (Free Beta)" banner; "free report already used" notice; per-item FREE badge only on the first chart. |
| Service pages | `BirthJathagamPage`, `MarriageCompatibilityPage`, `BabyNamingPage` | `orderWillBeFree = isBeta && betaFreeChartAvailable` decides whether payment info is collected; button reads "Submit Free Beta Order (1st Report Free)"; once the slot is used the payment section appears with a clear notice. |
| Public copy | `HomePage`, `ServicesPage`, `HowItWorksPage`, `CustomerDashboard`, admin panels | Messaging updated to "1 free report per customer — additional reports at standard price". |

**No database migration is needed** — the existing `beta_ip_orders` table is
used as-is (one row per free chart). Already-placed orders are untouched.

## Deploying to cPanel (BigRock)

1. `npm run build:zip` (or `npm run build`)
2. Upload `dist/*` → `public_html/`
3. Upload `api/*` → `public_html/api/` (keep your existing `config.php`)
4. No schema change — `beta_ip_orders` already exists.

## Verify in 2 minutes

1. **Fresh connection** → place a single order → it is free (`serviceMode = FREE_BETA`, amount 0).
2. **Same connection** → place a 3-member family order → checkout shows
   `Chart 1: FREE`, members 2–3 priced, total = 2 charts; submitting requires a
   payment method + transaction reference; the admin panel shows 1 FREE_BETA
   row + 2 PAID rows in one family group.
3. **Same connection** → place another single order → the payment section
   appears immediately (free report already used) and the order is stored as
   a normal paid order.
4. From a **different network/IP** → the first report is free again.

## Tests

`npm test` → **TEST 16** now asserts first-chart-only pricing (0 / 35 / 35 FJD),
that the next family order from the same IP is fully paid, and that a new IP
gets exactly one free single order. New **TEST 18: Free Beta Grants Exactly
1 Free Report Per IP Address** guards the rule across PHP, Node, the pricing
module, the cart, the checkout and the schema.
