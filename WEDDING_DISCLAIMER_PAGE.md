# Marriage Matching Report — Page 2 Disclaimer

The **Marriage Compatibility (10-Porutham) report is now a 2-page document**.
Page 1 carries the profiles, score, 10 Poruthams, Kuja Dosha and final verdict.
Page 2 is the **Marriage Matching disclaimer**, printed in the language the
order was placed in, followed by the certified attestation block:

> Both pages now fill the whole A4 sheet — see
> [`WEDDING_REPORT_FULL_PAGE_LAYOUT.md`](WEDDING_REPORT_FULL_PAGE_LAYOUT.md).

| Order language | Page 2 language |
| -------------- | --------------- |
| English (`en`) | English         |
| Tamil (`ta`)   | Tamil           |
| Hindi (`hi`)   | Hindi           |

## One copy, every renderer

The wording lives in a single asset so the browser preview, the downloaded PDF
and the emailed report can never drift apart:

```
api/astrology/wedding_disclaimer_notes.json   ← the copy (en / ta / hi)
api/astrology/wedding_disclaimer_notes.php    ← PHP reader (+ English fallback)
src/services/weddingDisclaimerNotes.ts        ← TS reader (browser + Node)
```

Consumers:

| Renderer                                   | What changed                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `src/services/weddingHtmlBuilder.ts`       | New `<div class="page" id="wedding-page-2">` (live preview + html2canvas download + admin bundle) |
| `server/astrology/pdfGenerator.ts`         | `generateWeddingMatchPdf()` adds a second jsPDF page (direct-download renderer) |
| `api/astrology/pdf_mpdf_reports.php`       | Second `<div class="sheet">` after `<pagebreak />`; headers are now "Page 1 of 2" / "Page 2 of 2" |

The browser export needs no extra plumbing: the exporter already captures every
`.page` element, so the second page is picked up automatically everywhere
(customer download, admin preview, family bundles, "send to email").

## Emphasis markup

Paragraphs use `**bold**` markers. Each renderer converts them:

* HTML → `<strong>` (`weddingDisclaimerRichHtml`)
* Node jsPDF → per-word bold runs (`weddingDisclaimerRuns` + `wrapRichWords`)
* mPDF HTML → `<strong>` (`WeddingDisclaimerNotes::rich`)
* Node jsPDF → markers stripped (`WeddingDisclaimerNotes::plain`)

No raw `**` ever reaches a rendered report — asserted by the test suite.

## Tamil / Hindi on the Node download renderer

`server/astrology/pdfGenerator.ts` uses jsPDF's built-in WinAnsi fonts, which
cannot shape Tamil or Devanagari. Like every other field in that file, the
disclaimer goes through `latin()` so it prints as a readable romanisation
instead of mojibake. Native-script customer email PDFs are browser-rendered;
server-side PHP exports use mPDF and fail closed if mPDF is unavailable.

## Tests

```bash
npm test        # full-suite + comprehensive audit: page 2 exists in en / ta / hi
npm run test:php  # mPDF + fail-closed PDF checks
```
