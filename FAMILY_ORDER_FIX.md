# Family Order Fix — 1 order, 1 email, logo everywhere

Two reported problems are fixed in this branch:

1. A family order (3 charts, 1 payment) showed in the admin panel as **3 separate
   orders**, and approving them sent **3 separate emails**, each with 1 report +
   1 invoice.
2. The ASTRO SIVAM logo was **not showing** in emails, report PDFs and invoice
   PDFs.

---

## Problem 1 — Family order split into individual orders

### What was wrong

| Where | Problem |
|---|---|
| `api/admin/index.php` → `GET /api/admin/orders` | Did **not** return `groupId`. The React admin portal groups orders purely on `order.groupId`, so every chart looked like a standalone order. |
| `api/admin/index.php` → `POST /api/admin/orders/:id/approve` | Approved only the single row it was given — no idea the order belonged to a family bundle. 3 clicks = 3 emails. |
| `api/admin/approve_order.php`, `api/admin/orders.php` | Called `sendResponse()` / `sendJson()` — **functions that were never defined anywhere in the project**. Every call ended in a PHP fatal error (HTTP 500). |
| `api/services/index.php` | Never stored `group_order_index`, so bundle order was not stable. |

### What it does now

* `GET /api/admin/orders` returns `groupId`, `groupOrderIndex`, `ipAddress`,
  `updatedAt`, and **auto-adds** the `group_id` / `group_order_index` columns if
  the live database is missing them.
* The admin panel now renders a **“Family Order (3 People)”** card with one
  *Approve* button for the whole bundle.
* **Any** approval entry point (`/admin/orders/:id/approve`,
  `/admin/family-orders/:groupId/approve`, `/admin/approve_order.php`,
  `/admin/orders.php?action=approve`) that touches a grouped order is routed
  into one shared routine: `api/admin/family_approval.php`.
* That routine produces **N report PDFs + 1 consolidated family tax invoice →
  1 email**, updates the whole group at once, and only marks the group
  `COMPLETED` after the single email has actually been sent.
* `sendResponse()` / `sendJson()` are now defined in `api/config.php`.

**Result: 1 payment → 1 approval → 1 email → 3 reports + 1 invoice.**

---

## Problem 2 — Logo missing in email, reports and invoice

### What was wrong

| Where | Problem |
|---|---|
| Email templates | Used a hard-coded `https://astrosivam.com/astrosivam_logo.png`. Gmail/Outlook/Apple Mail **block remote images by default**, so the logo stayed blank. |
| Report PDFs (`pdf_mpdf_reports.php`) | Only checked `api/../../public/astrosivam_logo.png` — a path that exists in the repo but **not on cPanel** (`public_html/api/...`). It then fell back to mPDF downloading the logo over HTTP, which usually fails → no logo. |
| Invoice PDFs (`pdf_mpdf_invoice.php`) | Only checked repo-relative paths; no fallback at all. |
| Admin “preview HTML” | Emitted a raw server filesystem path (`/home/.../logo.png`) inside an `<img src>` — a browser can never load that. |
| Node backend | Emails had **no logo at all**; `logoBase64.ts` threw `__dirname is not defined` under ESM. |

### What it does now

* New **`api/branding.php`** resolves the logo once, checking every deployment
  layout in order: `api/assets/` → site root (`public_html`) → `public/` →
  `dist/` → `src/assets/` → `DOCUMENT_ROOT`.
* New **`api/assets/astrosivam_logo.png`** — a 256 px, 40 KB copy bundled inside
  the API folder, so it is **always** deployed together with `api/`.
* Emails now embed the logo as an **inline `cid:astrosivamlogo` image**;
  `api/mailer.php` builds proper `multipart/mixed` + `multipart/related` MIME
  for both the SMTP-socket and PHP `mail()` paths. It cannot be blocked.
* Report and invoice PDFs resolve the logo to a real local file, so mPDF never
  has to fetch it over the network.
* Node emails embed the same logo inline; `logoBase64.ts` is ESM-safe.

---

## Deploying to cPanel (BigRock)

This fix is in the PHP API, so the files must be re-published:

1. Build: `npm run build`
2. Copy `dist/*` → `public_html/`
3. Copy `api/*` → `public_html/api/`  ← **required**, it ships `api/branding.php`,
   `api/admin/family_approval.php` and `api/assets/astrosivam_logo.png`
4. Keep your existing `public_html/api/config.php` (database credentials).

Already-placed family orders need no data migration — the admin endpoint adds
the `group_id` / `group_order_index` columns automatically on first load.

## Verify in 1 minute

1. Place a family order with 3 charts.
2. Admin panel → the order appears as **one “Family Order (3 People)”** row with
   its Group ID.
3. Click *Approve* once → the customer receives **one email** containing
   **3 report PDFs + 1 consolidated family invoice**, with the logo visible in
   the email header and inside every PDF.

## Tests

`npm test` → all suites pass, including the new
**TEST 15: Family Order Grouping & Branding Regression Guards**.

---

## High-quality family reports & consolidated invoice (live-preview pipeline)

Family bundles previously used the server-side PDF renderers for the customer
email and the admin invoice download, so they looked noticeably worse than the
single-order "View" / Live PDF Preview in the admin panel. Now:

* **View Chart** on any family member opens the same high-quality report as
  single orders — the report auto-calculates on the fly (no more
  "Report Pending Calculation") and the *Preview PDF* live viewer renders it
  from the identical HTML builders.
* **View Invoice** on a family card opens the live preview of a **consolidated
  family tax invoice** built with the exact same premium design as the
  single-order tax invoice (one line item per member, combined totals, group
  reference). *Invoice PDF* downloads that same render at 2.5x canvas quality.
* **Approve (N)** / **Resend Email** render all N member reports + the
  consolidated family invoice **client-side from the live preview** and send
  those preview-exact PDFs to the backend (`reportPdfs` + `invoicePdfBase64`),
  which attaches them to the single customer email. Server-side rendering is
  only a fallback.

Backend (`api/admin/family_approval.php`, Node `server/routes/admin.ts`) accepts
the optional client PDF payload on approve/resend and validates every PDF
before attaching. See **TEST 16** in `tests/full-suite.test.ts` for the guards.

---

## Group (family) orders now render EXACTLY like single orders

### The symptom

Single order → *Live Preview* → **Send Email**: the customer received a crisp
~2 MB report rendered in the browser (~8 s per report).

Group (family) order → the same button: the customer received the **server-side
PDF** — visibly lower quality — even though the admin panel had rendered the
high-quality version.

### The root cause

The family flow put **all N reports + the invoice into ONE JSON request body**.

| Bundle | Body size (base64) | Result on cPanel |
|---|---|---|
| 1 report + invoice (single order) | ≈ 3 MB | under PHP `post_max_size` (8M) → works |
| 3 reports + invoice (family) | ≈ 8–9 MB | **over the limit** |
| 5 reports + invoice (family) | ≈ 14 MB | **over the limit** |

When a PHP request body exceeds `post_max_size`, PHP does **not** raise an
error — `php://input` simply comes back **empty**. The approval handler
therefore saw no `reportPdfs`, quietly fell back to
`AstroEngine::generateReportPdf()` / mPDF, and emailed the low-quality render.
ModSecurity/LiteSpeed body limits reject the same POST even earlier
(403/413). The bigger the family, the worse it got — which is exactly why
single orders were fine and group orders were not.

### The fix — one render + one upload per member, then ONE email

The group flow now works like the single-order flow, member by member:

```
for each devotee in the family order:
    calculate / refresh the chart        (same calculate-preview API)
    render the report in the browser     (same HTML builders, html2canvas scale 2.5)
    upload that ONE ~2 MB PDF            POST /api/admin/family-orders/:groupId/stage-doc
render the consolidated family invoice   (same premium invoice builder)
upload it                                POST .../stage-doc  (kind=invoice)
send ONE email                           POST /api/admin/family-orders/:groupId/approve
                                         → tiny body, server attaches the staged PDFs
```

Each request is ≈2.7 MB, so no host limit is ever hit.

**New / changed pieces**

| File | Role |
|---|---|
| `api/admin/family_docs.php` | Staging area: validate (`%PDF-`), store one document per request, TTL-prune (6 h), deny web access, fall back to the system temp dir when `public_html` is read-only |
| `api/admin/index.php` | New `POST/DELETE /api/admin/family-orders/:groupId/stage-doc` and `/api/admin/orders/:id/stage-doc`; single-order approve/resend also accept staged documents; a discarded body is now reported explicitly (`bodyTooLarge`, HTTP 413) instead of silently downgrading quality |
| `api/admin/family_approval.php` | Merges staged documents with any inline payload, clears them once the email is sent, and reports `renderQuality` (`PREVIEW_EXACT` / `MIXED` / `SERVER_RENDER`), per-member fallbacks and the total attachment size |
| `api/.user.ini`, `api/.htaccess` | Raise `post_max_size` (128M), `upload_max_filesize`, `memory_limit` (512M) and the execution limits — `.user.ini` for PHP-FPM/CGI/LSPHP, the `mod_php` blocks for Apache-module PHP |
| `api/storage/.htaccess` | `Require all denied` — staged customer PDFs are never reachable over HTTP |
| `server/services/stagedDocs.ts`, `server/routes/admin.ts`, `server.ts` | The Node backend does exactly the same (staging endpoints, merge, cleanup, quality telemetry, 64 MB body limit) |
| `src/services/jathagamPdfExporter.ts` | `stageFamilyOrderPdfs()` renders + uploads member by member with progress callbacks; `prepareFamilyFulfilPayload()` is the single entry point every button uses; `buildOrderReportHtml()`, `mergeOrderPayloadIntoResult()` and `resultNeedsRecalculation()` are now shared with the single-order path, so a family member report is built by the *same* code as a single order |
| `src/services/api.ts` | `stageFamilyDoc()`, `stageOrderDoc()`, `clearFamilyStagedDocs()`; family approve/resend accept `useStagedDocs` and return render-quality telemetry |
| `src/pages/AdminPortal.tsx`, `LivePdfPreviewModal.tsx`, `OrderReportModal.tsx` | *Approve (N)*, *Resend Email*, *Send All Pending* and the live-preview **Send to Customer Email** button all use the staged pipeline and show per-member progress |

**Content parity fixes that came with it**

* A family member's report now inherits the customer's typed name / DOB / place
  from the order payload (legacy rows stored placeholders such as `Native`,
  `Bride`, `Groom`) — the single-order preview already did this.
* Stale stored results (Baby Naming v1 without the 108-pada mapping, horoscopes
  saved without `bhavas`) are **recalculated** before rendering, so no member
  gets a thinner report.
* Family members default to `ta` (like single orders) and each member is
  rendered in **the language they ordered in**.

### What the admin sees now

* A purple progress banner + an in-card progress bar:
  `Family Order GRP-2026-XXXXX — rendering report 2 of 3 (Priya Devi) … 2.1 MB … 33%`
* The success message states the delivered quality, e.g.
  `🎉 Family Order group (3 devotees) successfully approved! … Every report was
  delivered in live-preview (high-resolution) quality.`
* If a document could not be delivered to the server, the message names it:
  `⚠️ 2 report(s) (AF-2026-1014, AF-2026-1013) were rendered server-side at
  lower quality … Send the email again to retry.`
* The combined attachment size is reported (e.g. `Attachments: 6.4 MB`), with a
  warning above 20 MB because some mail servers reject larger messages.
* The audit log records the same verdict, e.g.
  `Render quality: PREVIEW_EXACT (3 preview-exact / 0 server-rendered, invoice
  PREVIEW_EXACT, staged uploads used: 3), attachments 6.4 MB`.

### Deploying (cPanel / BigRock)

1. `npm run build:zip` (or `npm run build`) — the zip now ships
   `api/.user.ini`, `api/admin/family_docs.php`, `api/storage/.htaccess` and
   `api/storage/family_docs/.htaccess`, and never ships staged PDFs.
2. Upload `dist/*` → `public_html/` and `api/*` → `public_html/api/`.
3. Keep your existing `public_html/api/config.php` (DB credentials).
4. `.user.ini` is re-read every `user_ini.cache_ttl` seconds (300 by default) —
   allow up to 5 minutes before testing.
5. If `public_html/api/storage` is not writable on your host, nothing breaks:
   staging automatically moves to the system temp directory.

### Verify in 2 minutes

1. Place a family order with 3 charts.
2. Admin panel → **Approve (3)**: watch the per-member progress
   (`rendering report 1 of 3 … 2 of 3 … 3 of 3`, ≈8 s and ≈2 MB each), then the
   invoice, then one email.
3. The banner must say **live-preview (high-resolution) quality** — if it warns
   about server-side rendering, the `/api` folder on the host is older than this
   change (upload it again).
4. The customer receives **one email** with 3 crisp ~2 MB reports + 1
   consolidated family tax invoice.

### Tests

`npm test` → **TEST 17: Group Order Render Quality Parity With Single Orders**
covers the shared render helpers, the per-member staging pipeline, both
backends, the request limits, the staging guards and every UI entry point.
