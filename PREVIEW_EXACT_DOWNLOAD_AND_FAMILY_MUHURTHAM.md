# The download IS the preview — and Subha Muhurtham joined the Family Order

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


> **30 September 2026 update:** font loading alone did not prevent downloaded
> rows being cut in half. A website image reset affected html2canvas's hidden
> parent-document baseline probes. Those probes are now scoped/reset during
> capture, HTML/email rendering is isolated in its own iframe, and Muhurtham
> page 2 includes a localized explanation of the selected ceremony's exclusions
> and actual recommendation counts. See `MUHURTHAM_TEXT_OVERLAP_FIX.md`.
> The scanner and family-order behaviour are unchanged by this follow-up.

Two earlier field reports, both fixed:

1. *"In muhurtham report preview and download quality is different. I want the same
   quality in preview to download."* — still true after the earlier
   `html2canvas`/jsPDF change (`PDF_QUALITY_AND_MOBILE_INPUT_FIX.md`), because that
   change fixed the **engine** but not the **fonts**.
2. *"Join muhurtham also in family order."* — Subha Muhurtham can now be added to
   the Family Tray from its own page and travels through the exact same family
   pipeline (1 payment → 1 approval → 1 email → N reports + 1 consolidated
   invoice) as Birth Jathagam / Marriage Matching / Baby Naming.

---

## Part 1 — Why the download still looked different (and what makes it identical now)

### The real root cause: the capture ran before the webfonts arrived

| | Fonts |
|---|---|
| **Live preview** (an `<iframe srcDoc=…>`) | a real document; it loads the Google Fonts stylesheet, paints, reflows when fonts land, and keeps the correct typefaces on screen |
| **Download** (html2canvas) | clones the report into a brand-new hidden iframe → **empty font cache**; the report stylesheet is re-fetched, the font files are re-fetched, and the capture used to happen ~100 ms later — i.e. while the browser was still painting **fallback Georgia / Times / system sans** |

Different glyphs mean different text metrics, different line breaks and a
visibly thinner page: exactly the "preview is good, download is not" report.
`document.fonts.ready` could not help — it resolved **immediately**, because the
report's `@import`ed families had not even been requested yet at that moment.

### Fix 1 — fonts are now a hard precondition of every capture

New module `src/services/reportFonts.ts` is the single source of truth:

* `REPORT_FONTS_HREF` — one Google Fonts URL with **every** family the four report
  builders use (Cinzel, Baloo Thambi 2, Yatra One, Plus Jakarta Sans, Noto Sans,
  Noto Sans Tamil, Noto Sans Devanagari);
* `ensureReportFonts(doc)` — injects the stylesheet into the document being
  captured, waits for it, then **explicitly loads and verifies each face**
  (`document.fonts.load('700 21px "Baloo Thambi 2"', sample)` →
  `document.fonts.check(...)`), all with bounded timeouts so a blocked CDN can
  never hang a download (and if the CDN is blocked, the preview falls back to the
  same glyphs — preview and PDF still match);
* `warmReportFonts()` — called when the preview modal opens, so the first
  download starts with a warm font cache;
* `REPORT_FONT_LINK_TAG` — the same stylesheet as a `<link>` in every report
  `<head>` (all five builders), so the preview iframe fetches the fonts in
  parallel with the `@import` instead of behind it.

It is now applied in **all three** documents of the pipeline:

```
calling app    ──► ensureReportFonts(document)      (canvas / font-baseline probes)
report iframe  ──► ensureReportFonts(reportDoc)     (the source page's layout)
html2canvas    ──► onclone: async (cloneDoc) => …   (html2canvas AWAITS async onclone,
                    await ensureReportFonts(cloneDoc) so the photo cannot race the fonts)
```

### Fix 2 — the download now photographs the live preview itself

`LivePdfPreviewModal` keeps a ref to the iframe it is showing and renders **those
DOM nodes** — already painted, fonts loaded, gradients applied, charts drawn —
through the shared capture loop (`renderPageElementsToPdfDoc` /
`downloadPreviewPagesPdf` in `jathagamPdfExporter.ts`), at print density
(3× desktop / 2.5× phone ≈ 300 dpi) with the same page-by-page memory discipline
as family bundles.

Nothing is re-parsed, nothing is re-fitted (the preview pages are already A4), so
the PDF cannot differ from the preview *by construction*:

```
Download ─► 1. live preview DOM  ──► html2canvas ──► jsPDF A4 ──► save()
            2. (same HTML string, same font-safe pipeline)     ← if the frame is not readable
            3. (server mPDF render)                            ← only if the device cannot capture canvas
```

Both remaining paths inherit the font fix, so even the fallbacks are now
font-correct; only step 3 (explicitly announced in the amber banner) still uses
the thinner mPDF renderer.

A device that runs out of canvas memory at 3× retries at 2.5× and finally at
1.8× (`downloadAttemptOptions()` — same renderer, same HTML, smaller raster,
~180 dpi) **before** the server renderer is considered. Dropping density never
changes how a page looks; changing engines does.

**Button label changed** to *"Download PDF (exactly this preview)"* so the
guarantee is visible to the customer and the admin.

Every other download entry point (`OrderReportModal`, dashboard, admin order
list, per-service exporters) goes through the same `downloadHtmlPdf` and
therefore gets the font guarantee as well.

---

## Part 2 — Subha Muhurtham is now a Family Order member

### What a customer does

1. Subha Muhurtham page → birth details + ceremony + report month.
2. **"Add to Family Tray (bundle with other reports)"** → the tray opens with the
   Muhurtham line next to the other family members.
3. Add more members (each from their own service page), then **Pay Once**.

The tray badge, the floating bar, the unified checkout and the consolidated
family invoice all render the Muhurtham line ("📅 Subha Muhurtham Dates",
`Subha Muhurtham (Six-Month Auspicious Dates)`) with no special casing.

### What travels with the order

The tray line carries exactly what the single-order flow submits, so a family
member is calculated by the *same* code path:

```jsonc
{
  "serviceType": "MUHURTHAM",
  "language": "ta",
  "devoteeName": "Meena",
  "inputPayload": {
    "name": "Meena", "dob": "1990-08-15", "tob": "09:30",
    "birthPlace": "Suva", "latitude": -18.1416, "longitude": 178.4419,
    "timezoneOffsetHours": 12,
    "eventKey": "wedding", "selectedMonth": "2026-12",
    "muhurthamScan": { "muhurthamAlgorithmVersion": 3, "months": [/* 6 months */], "persons": [/* tara bala */] }
  }
}
```

### Where it was wired

| Layer | Change |
|---|---|
| `src/pages/MuhurthamPage.tsx` | new `handleAddToFamilyTray()` (validates birth details + month, builds the six-month scan, prices the line in **all three currencies**, adds it, opens the tray) + tray banner + "Add to Family Tray" button + "or order this report on its own" divider |
| `src/components/cart/FamilyCartDrawer.tsx` | "+ Add Subha Muhurtham Dates" quick-add in the empty tray (badge already existed) |
| `server/astrology/muhurthamScan.ts` **(new)** | one shared server module: the scan normaliser (moved out of `routes/services.ts`), the three event-label maps, `computeMuhurthamResult()` (rescans from birth details) and `computeMuhurthamResultFromPayload()` (scan if present, rescan if not) |
| `server/db/store.ts` | `computeOrderCalculatedResult()` now calculates Muhurtham (single **and** multi-order) — previously it returned `undefined` for it |
| `server/routes/services.ts` | uses the shared module; `/order` and `/multi-order` validate a Muhurtham line (scan **or** birth date/time/place) with an actionable message instead of failing later at approval |
| PHP API | no change needed — `AstroEngine::calculateMuhurtham()` was already called by `/services/multi-order`, and `admin/family_approval.php` already rebuilds stale Muhurtham results and labels the member |
| Rendering | `buildOrderReportHtml()` (already Muhurtham-aware) renders a family member through the identical `buildMuhurthamHtml` used by single orders — in the member's own language |

### Also true now

* The admin family card shows the Muhurtham member, its ceremony/month, and the
  *Approve (N)* button renders it with the preview-exact pipeline (2 pages,
  ~300 dpi) like every other member.
* A legacy Muhurtham order (or a hand-made one) **without** a stored scan is
  rescanned server-side, so no customer can ever receive an empty calendar.
* `/api/services/calculate-preview` for Muhurtham no longer 500s on a payload
  without a scan — it recalculates (this also fixes admin/legacy previews).

---

## Tests

```bash
npm test        # remedies + full suite + mobile inputs
npm run lint    # tsc --noEmit
npm run build   # vite build + esbuild server bundle
```

Two new suites were added to `tests/full-suite.test.ts`:

* **TEST 19: Preview-Exact Downloads** — the font module (per-face load + check +
  bounded waits), the page-document and clone-document font gates, the live
  iframe capture (`renderPageElementsToPdfDoc` / `downloadPreviewPagesPdf`, never
  re-fitted), the download order (live DOM → same HTML → server), the font
  `<link>` in all five builders, and a runtime check that a document without the
  Font Loading API degrades gracefully instead of throwing.
* **TEST 20: Subha Muhurtham Is A Family Order Member** — the tray action and its
  payload (scan, ceremony, month, per-currency pricing), the tray quick-add, the
  Node store branch, the shared server module, both order endpoints' validation,
  the PHP multi-order/family-approval paths, the shared report builder — plus a
  **runtime round-trip** that scans a real six-month window with the client
  scanner, normalises it, and rescan-backs a payload that has no scan.

## Deploying (cPanel / BigRock)

For the current PDF-clipping / selection-guide follow-up, deploy the client and
PHP changes together (or the rebuilt Node server if that is your backend):

1. `npm ci` and `npm run build:zip`.
2. Upload/extract the package to `public_html/`. It includes the new shared notes
   assets under `api/astrology/` and `src/lib/muhurtham/rules.json` for PHP's
   ceremony-specific explanations; do not upload only the JavaScript bundle.
3. Keep your existing database/email configuration and runtime uploads.

Additional regression commands: `npm run test:pdf` (Playwright Chromium) and
`npm run test:php` (PHP CLI). See `MUHURTHAM_TEXT_OVERLAP_FIX.md` for details.

### Verify in 2 minutes

1. **Subha Muhurtham page** → fill the form → *Add to Family Tray* → the tray
   opens with the Muhurtham line; add a Birth Jathagam member too → *Pay Once*.
2. **Admin panel** → the family order shows both members → *Approve (2)* →
   the customer receives one email with the Muhurtham report (2 pages, same
   quality as every other member) + the consolidated invoice.
3. **Any preview** → *Download PDF (exactly this preview)* and compare side by
   side with the on-screen report: same fonts, same line breaks, same pages.
