# Multi-Person Checkout — One Order, Up To 6 People

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


A single order can now contain **up to 6 people**, each with **one or more
reports** (Janma Jathagam, Marriage Compatibility, Baby Naming, Subha
Muhurtham). The customer sees one running total and pays **once**; the admin
previews and sends **per report**, and the customer receives **one email per
order** with every report PDF plus **one** tax invoice.

This work is committed on the session branch `arena/01a100ff-astrosivam`
(it could not be renamed here); section 8 has the three commands to put it on
your requested `feature/multi-person-checkout` branch.

---

## 1. How an order is stored

```
orders              1 row per order   service_type = 'MULTI_PERSON',
                                      amount       = server-computed grand total
order_persons       N rows (<= 6)     name, gender, dob, tob, place, lat, lon, tz
order_items         M rows (<= 24)    person_id, service_code, unit_price,
                                      report_status, language,
                                      input_payload, calculated_result
```

* Both child tables cascade from `orders` (`ON DELETE CASCADE`).
* `order_items.calculated_result` is the **one** cache that admin Preview and
  Send both read, so the emailed PDF is exactly the previewed report.
* Legacy orders (one row = one chart) are backfilled with one person + one item
  each, and the legacy `items[]` family tray still works unchanged.

## 2. Create-order endpoint

`POST /api/services/order` (and `/multi-order`) accepts either:

* `items[]` — the existing family tray (unchanged), or
* `people[]` — the new multi-person payload:

```jsonc
{
  "people": [
    {
      "name": "Meena Sundar", "gender": "F",
      "dob": "1990-08-15", "tob": "09:30",
      "place": "Suva, Fiji", "country": "Fiji",
      "latitude": -18.14, "longitude": 178.44, "timezoneOffsetHours": 12,
      "services": ["BIRTH_JATHAGAM", "BABY_NAMING"],
      "language": "ta",
      "partner":   { /* required for MARRIAGE_COMPATIBILITY */ },
      "muhurtham": { /* place + selectedMonth + six-month scan for MUHURTHAM */ }
    }
  ],
  "paymentMethod": "MPAISA", "currency": "FJD", "paymentReference": "..."
}
```

Server-side rules (never trusted from the client): 1–6 people, at most 24
reports, only the four known service codes, marriage needs both charts,
Muhurtham needs its event place + scan, prices come from
`system_settings.pricing`, and the free-beta report is the **first report of the
order** (still one per IP). Everything is written in **one transaction**.

## 3. Emails

* One email per order.
* One PDF per report:
  `ASTRO_SIVAM_<SERVICE>_<orderNumber>[_<itemId>].pdf`
* One invoice per order (multi-line when the order has several reports).
* Sending fails closed if the preview-quality PDFs are missing.

## 4. Admin portal

Each order is still **one row**, which now expands to its **people** and their
**reports**, each with status badges (`PENDING / CALCULATED / SENT / FAILED`),
a **Preview** and a **Send/Resend** button, plus **Send All Reports + Invoice**
and an **Order Invoice** download. Approving a multi-person order emails every
report + the single invoice in one message.

## 5. Files changed / created

Created:

| File | Purpose |
| --- | --- |
| `api/migrations/003_multi_person_orders.sql` | `order_persons` + `order_items` tables (FKs cascade) and the legacy backfill |
| `api/services/multi_person_order.php` | `people[]` validation, server-side pricing, one-transaction order creation, runtime table guard |
| `api/admin/order_items.php` | per-report cached result, per-report + send-all email fulfilment, invoice generation |
| `server/services/multiPersonOrders.ts` | the same validation/payload rules for the Node backend |
| `src/services/multiPersonOrder.ts` | checkout model: limits, drafts, validation, pricing, `people[]` payload |
| `src/services/orderItems.ts` | shared `getOrCalculateResult` + preview-exact per-report PDF/email helpers |
| `src/components/cart/MultiPersonCheckout.tsx` | person cards, add/remove, service checklist, totals (TA/EN/HI) |
| `scripts/sync_public_html_api.sh` | mirrors the `api/` deploy locally |
| `tests/multi-person-orders.test.ts` | end-to-end coverage of all of the above |

Modified: `api/services/index.php`, `api/admin/index.php`, `server/db/store.ts`,
`server/routes/services.ts`, `server/routes/admin.ts`,
`src/types/index.ts`, `src/services/api.ts`, `src/services/jathagamPdfExporter.ts`,
`src/components/cart/UnifiedCheckoutModal.tsx`,
`src/components/common/OrderReportModal.tsx`, `src/pages/AdminPortal.tsx`,
`src/pages/CustomerDashboard.tsx`, `scripts/run-tests.mjs`, `tests/full-suite.test.ts`,
`tests/security-delivery.test.ts`, `package-lock.json` (refreshed by `npm install`).

No secrets, passwords or API keys were added anywhere.

## 6. Manual steps (required, in order)

1. **Import the migration** — phpMyAdmin → your database → *Import* →
   `api/migrations/003_multi_person_orders.sql` → Go. It creates the two tables
   and backfills every existing order with one person + one item. Re-running is
   safe.
2. **Upload the PHP backend** — upload `api/` as usual, or copy these files to `public_html/api/`:
   * `services/index.php`, `services/multi_person_order.php` (new)
   * `admin/index.php`, `admin/order_items.php` (new)
   * `migrations/003_multi_person_orders.sql` (keep for reference)
   Remember `public_html/api/admin/index.php` is a synced copy — it must be
   updated too. Locally you can run `scripts/sync_public_html_api.sh <dir>` to
   produce the exact tree (it never overwrites a live `config.php` or the
   signing key).
3. **Build & deploy the front end** — `npm run build`, then upload `dist/*`
   (same as every previous release).
4. **Smoke test** on production:
   * place a 2-person order (one free report in Free Beta + one paid) and check
     `orders` has **one** row with `service_type = MULTI_PERSON`, plus the
     person/item rows;
   * open the order in the admin portal, expand it, **Preview** one report,
     then **Send** it and confirm the customer email contains that report
     **and** the single invoice;
   * **Send All Reports + Invoice** and confirm one email with every report.

## 7. Verification performed here

* `npm run lint` (`tsc --noEmit`) — clean.
* `npm run build` — succeeds.
* `npm run test` — **967 assertions, 0 failures**, including the new
  `tests/multi-person-orders.test.ts` (endpoint shape, server-computed total,
  free-first-report, validation, per-item cache, fail-closed send, PHP schema
  and transaction guarantees).
* All modified/new PHP files were parsed with a PHP 8 parser (php-parser) — no
  syntax errors. PHP itself cannot be executed in this environment, so the PHP
  runtime behaviour is covered by the mirrored Node implementation + tests.

## 8. Branch commands

This session is bound to `arena/01a100ff-astrosivam`, so create/move your
branch from it:

```bash
git fetch origin arena/01a100ff-astrosivam
git checkout -b feature/multi-person-checkout origin/arena/01a100ff-astrosivam
git push -u origin feature/multi-person-checkout
```

`main` was never touched; the commit sits on top of the original `main` commit
`e123b2a`.
