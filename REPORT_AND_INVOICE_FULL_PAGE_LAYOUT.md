# Reports & Invoices — full-page layout (no empty space)

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


Every generated document — Birth Jathagam, Marriage Matching, Baby Naming,
Muhurtham and the tax invoice (single and family) — must cover its A4 sheets
from the header down to the footer band. A page may never end halfway down the
paper, and no page may contain a blank area larger than the normal spacing
between two blocks.

The Marriage Matching report is documented separately in
[`WEDDING_REPORT_FULL_PAGE_LAYOUT.md`](WEDDING_REPORT_FULL_PAGE_LAYOUT.md); this
file is the contract that every other report follows as well.

## Shared centered header contract

Birth Jathagam, Wedding Compatibility, Muhurtham, single-order invoices and
consolidated family invoices use the Baby Naming-style vertical lockup: emblem
above the centered brand title, localized/document subtitle, contact details,
optional page/order/invoice metadata, then the divider. Do not restore the former
side-by-side logo/title offsets or the invoice red outline. PHP report headers
retain their localized page/order references; invoice headers retain invoice
type, number and business registration; family-invoice continuation pages repeat
the group and page reference. Node/jsPDF copy remains on the `latin()` safety
path for its built-in core fonts.

Muhurtham page-2 date continuation is limited to a 96 mm budget so the centered
header and lower-half selection guide stay within the two-page A4 contract; page 1
keeps its 160 mm budget. Browser, mPDF and jsPDF use the same budget constants.

## The contract (browser HTML builders)

```
.page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
        └── .inner (flex column, justify-content: space-between)
              ├── header / divider          (natural height, flex-shrink: 0)
              ├── … blocks …
              ├── ONE growing block         (flex: N 0 auto; min-height: 0)
              │     e.g. the calendar panel, the remedies column,
              │     the itemised table, the disclaimer panel
              └── footer                    (flex-shrink: 0 — no margin-top: auto)
```

* **`min-height`, never `height` + `overflow: hidden`.** A sheet is always at
  least one full A4, so the growing block has something to absorb; and when a
  report genuinely has more to say than one sheet it grows instead of having
  text clipped. (The old `height: 297mm; overflow: hidden` pair was the reason
  content could disappear silently.)
* **One growing block per page** (`flex: N 0 auto`), with `height: 100%` on the
  table inside it so the leftover is shared out as row height. Blocks with a
  *cap* (`max-height`) are used where one row would otherwise become absurdly
  tall — the invoice caps its item table at 42 mm and its summary at 64 mm, so
  the remaining slack becomes even spacing between blocks instead of a giant
  empty box.
* **No `margin-top: auto` on footers.** The footer follows the content and
  `.inner`'s `space-between` distributes what is left evenly; an auto margin
  parked the whole remainder directly above the footer, which is exactly the
  "half-empty page" look.
* Nothing is added to fill space: no new panels, notes or content. Only the
  existing blocks breathe.

| Builder | Growing block |
| ------- | ------------- |
| `src/services/jathagamHtmlBuilder.ts` | p1 chart + dosha block, p2 life-card grid, p3 Short Summary (font fitter enlarges type from the 10.5px floor; care card is the growing block) |
| `src/services/weddingHtmlBuilder.ts` | p1 Poruthams table, p2 disclaimer panel |
| `src/services/babyNamingHtmlBuilder.ts` | p1 particulars / pada table / virtues / blessing strip, p2 suggestion columns |
| `src/services/muhurthamHtmlBuilder.ts` | p1 calendar panel (rows centred so a stretched row stays legible), p2 notes aside |
| `src/services/invoiceHtmlBuilder.ts` | itemised table, summary, declaration (all capped, remainder spread between blocks) |

The same CSS is used by the live preview, the html2canvas download and the
family bundle, because all three render the same HTML string — html2canvas
photographs the browser's real layout, so the downloaded PDF is the preview.

## The contract (mPDF, `api/astrology/`)

mPDF has no flexbox and ignores `min-height` on divs, so the same rule is
purchased with padding and cell heights instead:

* `pdf_mpdf_reports.php::birthSummaryCss()` — the Birth Jathagam's last sheet is
  the Short Summary now. It is laid out in tables only (mPDF has no flexbox)
  and keeps the proven 3-page type budget: mPDF cannot measure leftover space,
  and enlarging here spills a fourth physical page. The browser HTML fitter is
  what fills the customer preview/download.
* `pdf_mpdf_invoice.php::invoiceFillCss()` — shares the sheet between the detail
  boxes, payment strip, item rows, summary, declaration, signature rule and
  seal band, with the total growth capped at 96 mm and an 18 mm reserve, so the
  invoice cannot spill onto a second page because of it.
* Muhurtham already budgeted fixed millimetres (`height: 135mm` page-2 cell);
  the Baby Naming suggestion page reserves a full sheet through
  `$nameRowHeight`; the wedding report sizes its panels per language.

## The contract (backend jsPDF, `server/astrology/pdfGenerator.ts`)

The Node fallback paints directly onto the canvas, so it computes the leftover
space and distributes it by hand:

| Renderer | How the sheet is filled |
| -------- | ---------------------- |
| `generateHoroscopePdf` | p1 dosha cards gain padding + heading gap from the measured slack; p2 life-card row pitch derived from the space above the footer; p3 Short Summary uses larger type and puts leftover millimetres into the care card |
| `generateWeddingMatchPdf` | p1 slack shared by the guidance box, the verdict banner and the gaps; p2 disclaimer panel fills down to the attestation block |
| `generateBabyNamingPdf` | the virtue table's rows absorb the space up to the certification band (heights measured on a scratch document via `measureAutoTableHeight`) |
| `generateMuhurthamPdf` | the calendar row pitch grows to reach the certification line; the page-2 notes panel is drawn as a frame that ends above the footer |
| `generateInvoicePdf`, `generateFamilyInvoicePdf` | info boxes, payment strip, item row, totals card, terms list, declaration and seal share the space; the signature block is anchored to the band above the footer |

## How to verify

Because "filled" is a measurement, not an eyeball, the contract is asserted by
`tests/browser/full-page-layout.spec.ts`:

```bash
npm run test:pdf        # playwright; the spec covers every report in en/ta/hi
```

For each document it renders the real HTML in a headless browser with the
shipped Noto faces and measures every `.page`: the sheet must be exactly one
A4 (`≥ 297 − 0.5 mm` tall and no `scrollHeight` overflow, so nothing is clipped
and nothing spills), the band under the last block must be ≤ 2 mm, and the
widest gap between two blocks must be ≤ 10 mm. It includes the deliberately
sparse Muhurtham month (two auspicious dates), which is the case that used to
leave most of the paper empty.

Run `npm test` for the non-browser half: the regression suite keeps asserting
the page ids, the growing-block CSS (`flex: 1 0 auto`, no `overflow: hidden`)
and the localized copy of every report.
