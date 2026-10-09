# Preview-Exact PDF Downloads + Mobile-Proof Birth Date & Time Entry

> **Superseded for the download/quality half of this document** — the
> `html2canvas` engine swap below was necessary but not sufficient: the capture
> also raced the report **webfonts**, so PDFs were still printed with fallback
> glyphs. See **`PREVIEW_EXACT_DOWNLOAD_AND_FAMILY_MUHURTHAM.md`** for the
> font-parity fix and for the live-preview capture that now makes the download
> literally the preview. The later downloaded-row clipping fix and localized
> date-selection explanations are documented in `MUHURTHAM_TEXT_OVERLAP_FIX.md`.
> The mobile date/time entry half of this document is unaffected.

Two field reports drove this change:

1. *"In the Muhurtham page the preview PDF quality is good — when I download, the
   quality is not good."*
2. *"In all services, date of birth and time can't be entered — same as Muhurtham —
   on the mobile version."*

---

## 1. Downloaded PDFs are now the preview, pixel for pixel

### Why they looked different

| | Renderer | Result |
|---|---|---|
| **Live preview** | The report's real HTML in an `<iframe>` (browser fonts, gradients, SVG charts) | Perfect — it *is* the design |
| **Download (before)** | A **different** engine: Node `jsPDF` (`/api/services/export-preview-pdf`) or PHP **mPDF** (`/api/admin/orders/:id/pdf`) | Thinner text, no gradients, different pagination |

Two engines can never agree. The fix is to stop asking the second engine.

### What happens now

Every download captures **the exact HTML string the preview iframe is showing**,
in the browser, with the `html2canvas` + `jsPDF` pipeline the family bundles
already proved:

```
previewHtml ──► html2canvas (scale 3 desktop / 2.5 phone) ──► JPEG 0.95 ──► jsPDF A4 ──► save()
                     │  (retry once at scale 2.5 / 0.92 if the device runs out of canvas memory)
                     └─ (only if both fail) server PDF via location.href — never window.open,
                        so a popup blocker cannot swallow the fallback
```

Capture density is chosen per device in `recommendedDownloadOptions()`:
`navigator.deviceMemory ≤ 3 GB` or a phone-sized viewport → 2.5× / 0.95,
otherwise 3× / 0.95 (~300 dpi on A4). **Compression changes, resolution never
does** — the old 0.92 stays the default for *emailed* documents so a ten-report
family bundle cannot exceed SMTP size limits.

### Where it is wired

| Entry point | File | Behaviour |
|---|---|---|
| Preview modal → **Download PDF** | `src/components/common/LivePdfPreviewModal.tsx` | Renders `previewHtml` (reports *and* invoices, single *and* family). Button reads "Download PDF (exactly this preview)" and a banner explains the fallback if it is ever used. |
| Customer order modal → **Download / Invoice** | `src/components/common/OrderReportModal.tsx` | `exportOrderReportPdf(order, lang, result)` uses the freshly recalculated result the modal is showing. |
| Admin order list → **PDF / Invoice / Family invoice** | `src/services/jathagamPdfExporter.ts` (`exportOrderPdf`, `exportOrderInvoicePdf`, `exportFamilyInvoiceHtmlToPdf`) | Same preview-exact render, same server fallback. |
| Per-service exporters | `exportJathagamHtmlToPdf`, `exportWeddingHtmlToPdf`, `exportBabyNamingHtmlToPdf`, `exportMuhurthamHtmlToPdf` | Build the preview HTML, render it, and only then call `downloadServerMpdf`. |

### Emailed documents follow the same rule

The backend already accepted browser-rendered PDFs (`reportPdfBase64`,
`invoicePdfBase64`, staged uploads) — but nobody sent them for single orders, and
the PHP family loop **validated** the client PDFs and then attached its own mPDF
render anyway. Now:

* `LivePdfPreviewModal` / `OrderReportModal` / `AdminPortal` render the documents
  and pass them to `approveOrder`, `resendEmail`, `approveFamilyOrder`,
  `resendFamilyEmail` (family bundles still upload **one document per request**,
  because N reports in one JSON body exceed `post_max_size` and get silently
  discarded).
* `api/admin/index.php` (approve **and** resend) resolves them through the new
  `astroSingleOrderClientDocs()` in `api/admin/family_docs.php` — inline body
  wins, staged documents cover the rest, mPDF is the fallback per document.
* `api/admin/family_approval.php` attaches the client report it picked
  (`$pickClientReport($o)`) and the client invoice, and now counts/names
  server-rendered reports honestly (`$serverReports`, `$serverReportNumbers[]`,
  `$invoiceFromPreview` → `renderQuality: PREVIEW_EXACT | MIXED | SERVER_RENDER`).
  The admin UI surfaces that via `describeFamilyRenderQuality(res)`.
* If a browser render fails, the payload is simply omitted and the customer still
  receives the official mPDF package — an approval can never fail for want of a PDF.

### Bonus bug fixed on the way

`api/admin/index.php`'s approve route calculated **Muhurtham orders as birth
horoscopes**: it lacked both the stored-result reuse and the `MUHURTHAM` branch
the resend route has, so `AstroEngine::calculateHoroscope()` ran on a Muhurtham
payload and mPDF rendered a Muhurtham template from horoscope data. It now
mirrors the resend route (`isCurrentMuhurthamResult` → `calculateMuhurtham`).

### Tradeoff to be aware of

A preview-exact PDF is a **high-resolution image** PDF: it looks identical to the
preview on every device, but its text is not selectable/searchable. The mPDF
server render keeps selectable text (with embedded Tamil/Devanagari fonts) but
looks thinner. Downloads and emails now prefer the preview-exact render and fall
back to mPDF; if selectable text ever matters more than fidelity for a given
channel, that channel's call to `downloadHtmlPdf` / `generateOrderPdfsBase64` is
the single place to change.

---

## 2. Birth date & time can now be entered on any phone

### Why they could not

* Service forms used native `<input type="date">` / `<input type="time">`. On
  several Android browsers the popup will not open or shows a wheel that cannot
  be scrolled back to a 1990 birth year; on iOS no keyboard is offered at all.
* The Muhurtham **report month** used `<input type="month">`, which **iOS Safari
  does not implement** — it degrades to a bare text box demanding an exact
  `YYYY-MM` string with no keyboard help.
* Inside modals (order view, dashboard profile) native popups can also be clipped
  by `overflow-hidden` or positioned against a transformed ancestor.

### The shared replacement

`src/components/common/BirthDateTimeFields.tsx` (+ pure helpers in
`src/utils/dateTimeInput.ts`) exports `BirthDateField`, `BirthTimeField` and
`MonthField`, each offering **three independent ways in**, so at least one always
works on the device in front of the customer:

| # | Method | Detail |
|---|---|---|
| 1 | **Type it** | Plain text input, `inputMode="numeric"` (numeric keyboard opens on tap), 16px on mobile so iOS never zooms, `touch-manipulation`, auto-formats while typing. Single-digit segments advance immediately: `581990` → `5/8/1990`, `930` → `9:30`; typed separators are always respected (`5/8/1990`, `1990-08-15`, `19900815` all parse). |
| 2 | **Tap the icon** | Our own calendar / clock sheet — 44px targets, month + year jumps, hour grid, minute grid, exact-minute box, AM/PM, "Unknown → 12:00 PM". Rendered with `createPortal(document.body)` at `z-[9990]`, so no modal can clip it and no transformed ancestor can misplace it. |
| 3 | **Quick select** | Day / Month / Year and Hour / Minute `<select>` elements — the one control that has never failed on a phone. |

Every field confirms what it stored (`✓ 15 Aug 1990 (1990-08-15)`,
`✓ 09:30 PM (24-hr: 21:30)`, `✓ November 2026 (2026-11)`) and, when a value is
rejected, says why in plain language (`February 1990 has only 28 days.`,
`Minutes must be between 00 and 59.`) via `describeDobProblem` /
`describeTobProblem`.

`MonthField` replaces `type="month"` with two selects and honours `min` / `max`
(past months stay unselectable for Muhurtham).

### Value contract — unchanged

`dob = 'YYYY-MM-DD'`, `tob = 'HH:MM'` (24-hour), month = `'YYYY-MM'`. No API,
schema, calculation-engine or order-payload change was needed.

### Forms converted

| Form | File | Theme / size |
|---|---|---|
| Birth Jathagam | `src/pages/BirthJathagamPage.tsx` | light, `md` |
| Baby Naming | `src/pages/BabyNamingPage.tsx` | light, `md` |
| Marriage Compatibility (Person 1 **and** Person 2) | `src/pages/MarriageCompatibilityPage.tsx` | light, `sm`; the pair now stacks on small screens instead of squeezing into a 2-column grid |
| Subha Muhurtham (DOB, birth time, report month) | `src/pages/MuhurthamPage.tsx` | dark, `md`; ~450 lines of page-local parsing/formatting/handlers replaced by the shared module |
| Customer dashboard birth profile | `src/pages/CustomerDashboard.tsx` | light, `sm` |

`src/components/common/BirthDateTimePicker.tsx` (an earlier, unused three-mode
picker) was deleted — `BirthDateTimeFields` supersedes it.

---

## Tests

```bash
npm test        # remedies + full suite + mobile inputs
npm run lint    # tsc --noEmit
npm run build   # vite build + esbuild server bundle
```

* **New** `tests/mobile-inputs.test.tsx` renders all three fields to static
  markup and fails the build if a native `type="date"` / `type="time"` /
  `type="month"` ever comes back, if the numeric keyboard hint disappears, or if
  the calendar / clock / quick-select routes are removed.
* `tests/full-suite.test.ts` gained typing cases (`15081990` → `15/08/1990` →
  `1990-08-15`, `581990` → `5/8/1990`, impossible dates rejected, `0930` →
  `09:30` with AM/PM, 24-hour `22:30` normalised) plus preview-exact download
  assertions for the exporter, both modals and the PHP routes.
* The **five family-PDF assertions that were already failing** on `main`
  (admin family payload wiring, PHP staged-document support, honest render-quality
  reporting, per-member progress) now pass, because the code they describe
  finally exists.
