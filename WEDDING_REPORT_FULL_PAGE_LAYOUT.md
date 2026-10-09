# Marriage Matching Report — Full-Page Layout (no empty space)

> The same contract now covers **every** report and the invoice — see
> [`REPORT_AND_INVOICE_FULL_PAGE_LAYOUT.md`](REPORT_AND_INVOICE_FULL_PAGE_LAYOUT.md)
> for the general rule, the mPDF/jsPDF equivalents and how it is verified.

**Problem:** the 2-page Marriage Compatibility (10-Porutham) report did not fill
its sheets. Page 1 ended roughly three quarters down the sheet with a wide blank
band above the footer, and page 2 — the disclaimer — floated as a short panel in
the middle of an otherwise empty page.

**Fix:** every page is now an A4 canvas whose content is *stretched to the
sheet*, and the empty space is removed by adding the content that was missing
(Lagna, Mars placement, the Kuja Dosha guidance line) plus an attestation block
on page 2.

## The layout contract

```
.page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
        └── .inner (flex column)
              ├── header                 (natural height, flex-shrink: 0)
              ├── profile cards          (natural height)
              ├── score panel            (natural height)
              ├── .poruthams-wrap        ← flex: 1 0 auto  (page 1 growing block)
              ├── guidance + verdict     (natural height)
              └── footer                 (natural height, flex-shrink: 0)
```

* `min-height` (not `height`) is deliberate: a page is **always at least** one
  full sheet, and the growing block absorbs whatever is left over, so the sheet
  is filled edge to edge.
* Because it is `min-height`, a report that genuinely has more content than one
  sheet **grows instead of clipping** — the old `height: 297mm; overflow: hidden`
  pair could silently cut text off, and no longer exists.
* Page 2 uses the same contract: `.disclaimer-body` / `.disclaimer-panel` are
  `flex: 1 0 auto`, and the panel spreads any leftover space evenly between the
  paragraphs (`justify-content: space-evenly`).

## Page 1 — what was added / enlarged

| Block | Before | After |
| ----- | ------ | ----- |
| Header emblem | 68 px | 72 px |
| Profile cards | 6 fields, Mars house only | 6 fields incl. **Lagna (Ascendant)**; larger type and padding |
| Guidance panel | Dosha balance + recommendation | **Mars placement for both charts** + Dosha balance + recommendation + **Kuja Dosha guidance** (the engine's `sevvayDosham.recommendation*`, previously never printed by the browser renderer) |
| 10 Poruthams table | fixed row height, name column 130 px (names wrapped to 3 lines) | name column 168 px + `<colgroup>`, compact 1.2 mm body-cell padding, rows **grow** to fill the sheet |
| Score / verdict / footer | compact | proportionally larger type and padding |

The table keeps its row heights tied to the localized content, then absorbs
remaining vertical room as the page's growing block. The browser A4 layout test
checks every language variant for overflow, bottom-band size and large internal
gaps.

## Page 2 — disclaimer + attestation

* The disclaimer keeps the shared copy from
  `api/astrology/wedding_disclaimer_notes.json` (en / ta / hi) and is now set in
  a larger, comfortable reading size with a centred reading column. Tamil and
  Devanagari set wider than Latin, so each language gets its own column width
  and type size:

  | Language | Reading column | Paragraph type |
  | -------- | -------------- | -------------- |
  | English  | 152 mm         | 13 px / 1.6    |
  | Tamil    | full width     | 12 px / 1.6    |
  | Hindi    | 150 mm         | 13.5 px / 1.6  |

  All three use 3 mm paragraph gaps; the tighter line spacing keeps the
  localized disclaimer and attestation within one A4 sheet.

* New **CERTIFIED & ATTESTED** block closes the sheet: report reference (order
  number when the caller supplies one, otherwise a timestamp reference), issue
  date, "prepared for" bride & groom, and the authorised-signature line.

## All three renderers

| Renderer | File | Change |
| -------- | ---- | ------ |
| Browser preview / html2canvas download / family bundles | `src/services/weddingHtmlBuilder.ts` | full-page contract, Lagna, Mars placement, Kuja guidance, attestation |
| mPDF (server-side email + admin fallback) | `api/astrology/pdf_mpdf_reports.php` | enlarged panels/table (`table.wedding-poruthams`), Lagna + Mars rows, per-language disclaimer sizing, same attestation block |
| Backend jsPDF (admin/export fallback) | `server/astrology/pdfGenerator.ts` | page 1 shares the leftover space between the guidance box, the verdict banner and the gaps; page 2 disclaimer panel now fills down to a new **CERTIFIED & ATTESTED** block instead of floating in the middle of the sheet |

`buildWeddingMatchHtml(result, lang, options?)` gained an optional third
argument `{ orderNumber }`; the live preview and the order renderer pass it so
the attestation prints the real order number.

## Why the rows can stretch safely

The table is `height: 100%` inside a flex item with a resolved (definite)
height, which is the standard, well-supported way to distribute leftover space
across table rows. `html2canvas` photographs the browser's real layout, so the
downloaded PDF shows exactly the stretched rows the preview shows — the capture
never re-flows the document.

## Tests

```bash
npm test          # full-suite + comprehensive audit (page ids, disclaimer copy, verdicts)
npm run test:php  # wedding-matching-report.test.php (verdict classes + disclaimer copy)
```

Both suites keep asserting `wedding-page-1` / `wedding-page-2`, the
`poruthams-table`, the green/red `final-verdict-*` classes and the localized
disclaimer copy, so the new layout cannot silently drop a section.
