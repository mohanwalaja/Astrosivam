# Muhurtham layout, report logo and English-only invoice updates

Five customer-facing fixes, applied to the browser preview, Node/jsPDF download
renderer and PHP/mPDF export so the preview and downloaded PDF stay consistent.

---

## 1. Centered report and invoice lockup across all renderers

The Baby Naming certificate is the visual reference: one emblem above a centered
brand title, localized/document subtitle, contact details, optional report or
invoice metadata, and the segmented divider. Birth Jathagam, Wedding Compatibility,
Muhurtham, single-order invoices and consolidated family invoices now use that
stacked lockup in browser HTML, PHP/mPDF and Node/jsPDF. Browser Baby Naming keeps
its existing centered certificate header.

| Renderer | Centered header implementation |
| --- | --- |
| Browser reports and invoices | Shared `src/services/reportHeader.ts`; 72 px emblem, title, localized subtitle, contact line, optional page/order/invoice metadata and divider |
| PHP/mPDF reports | `AstroReportViews::topHeader()`; 58 px emblem, localized subtitle, contact line, optional ceremony/count metadata, localized page tag and order reference |
| PHP/mPDF single and family invoices | Centered invoice title, invoice type/number, business registration metadata, contact line and divider; no left/right header columns |
| Node/jsPDF reports and invoices | `drawCenteredBrandHeader()`; Latin-safe title/subtitle/contact/metadata, centered emblem and segmented divider; family table continuations and totals pages repeat the invoice/group/page reference |

**No ring or horizontal logo offset is used.** The emblem's navy disc is part of
the artwork: the old red-border rule is gone from browser/PHP invoice styles,
and all affected builders place the emblem at the horizontal center above the
brand copy. Invoice type, number, business registration, localized report
subtitles, and existing page/order references remain in the metadata/body.

The Node fallback continues to run header copy through `latin()` because jsPDF's
built-in core fonts cannot shape Tamil or Devanagari; it names the requested
language or transliterates the existing localized copy rather than emitting
unrenderable glyphs. Browser HTML and mPDF retain native localized subtitles.

## 2. Muhurtham report: the "personally favourable days" panel is gone

The pink panel — title `♥ SPECIALLY GOOD DAYS FOR YOU — AS PER YOUR NAKSHATRA & RASI`, its
explanation paragraph and the chip list of personally favourable dates — has been removed
from the report. On a single-person wedding scan it expanded to a full 12-chip grid that
duplicated the recommendation table and buried the explanation below it.

* `src/services/muhurthamHtmlBuilder.ts` — panel markup and CSS deleted.
* `api/astrology/pdf_mpdf_reports.php` — the matching mPDF panel, its chip feed and its CSS deleted.
* `server/astrology/pdfGenerator.ts` — the direct-download renderer never rendered the panel.

**Kept:** the per-date highlighting itself. A recommended date that is also personally
favourable still carries the maroon inset edge, the soft pink row tint and the ♥ marker in
the Nakshatra column, so nothing is lost from the date table.

## 3. Muhurtham page 2: the lower-half explanation is printed much larger

The selection guide — "Which weekdays were left out and why / Which dates are recommended
and why" — now owns the whole lower half of page 2 and is set in real reading type:

| Block | Original | Previous pass | Now |
| --- | --- | --- | --- |
| Heading | 10 px | 13.6 px | **16.5 px** |
| Sub-headings | 10 px | 11.8 px | **15 px** |
| Body copy | 8.6 px | 11.4 px | **14.4 px** |
| Node jsPDF body | 7.1 pt | 8.7 pt | **10.4 pt** |

That is roughly **1.7×** the date-table row size, instead of being the smallest text on the
sheet. The guide still starts in the lower half and ends above the certified footer —
measured in Chromium at A4 (page height 1123 px, footer top 1048 px), Tamil (tallest script):

| Case | Guide bottom |
| --- | --- |
| 4 dates/month, no continuation | 901 px |
| 4 dates/month, page-2 continuation | 956 px |
| 10 dates/month (60 dates, maximum density) | 1037 px |

The Node jsPDF download renderer was verified the same way with text metrics for all 18 ceremonies.

## 4. Invoices are English-only

Tax invoices are legal / accounting documents, so the whole invoice document is now
issued in English regardless of the ordered report language:

* **Browser** (`invoiceHtmlBuilder.ts`): new exported `invoiceLanguageLabel()` writes
  `Tamil` / `Hindi` / `English` in English; the per-member `mLang` column no longer
  prints `TA` / `HI` codes.
* **PHP/mPDF** (`pdf_mpdf_invoice.php`): the invoice body always renders the English
  label set (`$lang = 'en'`), while the line-item Language column still shows which
  language the customer ordered — as an English word (`Tamil`, `Hindi`, `English`).
* The Node server-side invoice renderer was already English-only.

Customer names may of course still be written in any script — only the invoice's own
wording is English.

---

## Verification

```bash
npm test          # 17 module suites incl. the new logo / English-only assertions
npm run lint      # tsc --noEmit
npm run build     # vite + esbuild production bundle
npm run test:pdf  # Playwright A4 browser checks (needs a Chromium install)
npm run test:php  # PHP mPDF checks (needs PHP 8.1 + mpdf)
```

`muhurtham_preview_p1_cover.png` and `muhurtham_preview_p2_month.png` are regenerated by
the Playwright preview specs (`npm run test:pdf`) and show the final page 1 / page 2.
