# Subha Muhurtham Report — PDF Text Clipping and Selection Explanations

## 30 September 2026: downloaded rows cut halfway through the text

This was **not** another narrow-column problem. The live preview was readable,
but the PDF lost the lower half of dates, times, stars and grade labels.

`html2canvas` measures font baselines in the **calling (parent) document**, even
when it captures an iframe. Its hidden measurement uses a span beside a 1px
image. Tailwind's `img { display: block }` moved that image onto the next line,
so the measured baseline was too low. Text then painted below its line box and
was cut by the report's legitimate cell-level clipping.

The fix:

- `reportCapture.ts` resets **only the hidden baseline probes** to inline images,
  for the duration of a capture. The reset is removed in `finally`, including
  on blank-canvas retries and encoding failures. Visible website/report images
  and the time-column clipping safeguards are unchanged.
- Fonts are awaited in all three documents: the calling document, report iframe
  and capture clone. Loading only the iframe's fonts is insufficient because
  the canvas and baseline probes use the calling document's fonts.
- HTML/email exports now use an isolated A4 iframe, just like the preview,
  instead of putting an entire HTML document into a div in the app. Report CSS
  cannot leak into the website, and Tailwind cannot change the report's layout.
  Already-laid-out Muhurtham pages are not re-fitted or scaled on export.
- Pagination reserves room for wrapped devotee details, the centered cover
  header and the page-2 explanation (160mm / 96mm date budgets, with spare
  split/continuation rows shared by browser, PHP/mPDF and Node/jsPDF). Recommended dates are
  retained; page-2 continuation rows stay above the selection guide, which begins
  in the lower half of the A4 sheet. A longer continuation pushes the guide down
  rather than overlapping it.

## Why Tuesday/Saturday and why so few dates?

A short selection guide is now included on page 2 in English, Tamil and Hindi
in browser-captured and official mPDF reports. The Latin-only Node download
renderer uses English so the explanation remains readable. All active renderers
use the same translation asset, `api/astrology/muhurtham_report_notes.json`.

- For weddings, the current ceremony rules exclude **Tuesday (Mars)** and
  **Saturday (Saturn)**. The guide identifies this as a ceremony-specific
  traditional convention, not a universal ban on those days. Business reports,
  for example, exclude Tuesday but do not automatically exclude Saturday.
- Only **BEST / GOOD** grades appear in the calendar. The guide shows the actual
  assessed, recommended, FAIR and AVOID counts from the supplied scan.
- An acceptable weekday alone is insufficient: nakshatra, tithi, yoga/karana,
  eclipse and ceremony rules are also checked. Wedding notes identify Aadi,
  Purattasi, Margazhi and Jupiter/Venus combustion restrictions. Chandrashtama
  may lower a date's grade when birth details are supplied.
- This change explains the existing scan; it does **not** change its rules,
  grades or introduce a cap on recommended dates. Tara Balam is not falsely
  described as a compulsory extra filter.

Deployment packages include the shared ceremony catalogue so PHP/mPDF reports
can explain the same restrictions as the browser. The retired plain-PHP PDF
writer was removed; PHP exports now require mPDF and fail closed without it.

### Verification

```bash
npm ci
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium # once, for browser tests
npm run test:pdf
npm run test:php # requires a PHP CLI
```

The browser tests inspect **the JPEG embedded in the generated PDF**, comparing
its date/star/time/grade strokes with native preview screenshots. They cover
English/Tamil/Hindi, mobile/desktop, live-preview and HTML/email capture,
60-date pagination, lower-half guide placement with/without continuation, error cleanup, and the other report/invoice exporters.
Restoring the old block-image baseline makes the Tamil mobile regression fail.
PHP tests cover localized templates, ceremony-specific notes, counts, unchanged
scan data, mPDF output when available, high-resolution email PDF validation and
fail-closed behavior when mPDF is unavailable.

---

## Earlier fix: three-window Nalla Neram column overlap

### What was wrong

A day can carry **up to three Nalla Neram windows on one line**, e.g.

```
⏰ 6:58 – 8:37 AM · 10:15 AM – 1:31 PM · 3:10 – 6:26 PM
```

That string is wider than the Nalla Neram column at the row font sizes the
report uses. Because the cell could not wrap (`white-space: nowrap`) it painted
straight over the neighbouring GRADE column:

* the `· 3:10 – 6:26 PM` tail was hidden **behind the grade pill** (`★ உத்தமம்` /
  `★ BEST`), and
* in the web preview — which is captured with `html2canvas` for the customer
  download — the tail was cut mid-window (jsPDF clips the canvas at the page
  edge, so the third window simply vanished from the downloaded PDF).

Measured on the live builder (A4, δ table = 188 mm): a 52-character
three-window line needed **289 px** while the cell content box was **279 px**,
and the cell's right edge sat 19 px *inside* the grade column.

The same geometry was duplicated across the browser preview/download, the
Node jsPDF download renderer and the official PHP mPDF report.

## What changed

1. **Shared column geometry.** `MUHURTHAM_DATE_COLUMN_RATIOS` (date / nakshatra /
   Nalla Neram / grade = `19% / 21% / 46% / 14%`) is now exported from
   `src/services/muhurthamHtmlBuilder.ts` and used by every renderer. The Nalla
   Neram column is now the widest, because it is the column that carries up to
   three time windows.
2. **Fit-to-column time text.** `muhurthamTimeFontScale()` steps a time line down
   (never below **80 %** of the row font) when it is wider than the column, so
   every window stays on one line and inside its cell. Short lines are untouched.
   The browser builder and both PHP builders apply it per row; the Node jsPDF
   generator applies it through the new `fitTimeCell()` helper before drawing.
3. **Cell-level clipping safety.** `.time-text` (and `.cal-time` in mPDF) now own
   `overflow: hidden; text-overflow: ellipsis`, so even a pathological label can
   never paint into the grade column again.
4. **PHP/mPDF column geometry** uses the shared ratios and clips only within
   each time cell, preserving Tamil and Hindi labels without drawing over grades.

Verified with a headless Chromium pass over the generated HTML (English, Tamil,
Hindi) plus a 30-rows-of-max-length-labels stress case: **0 clipped text runs,
0 text overlaps, 0 elements off-page**, and the report is still exactly two
pages. `npm test` and `tsc --noEmit` pass; the new regression tests in
`tests/full-suite.test.ts` fail on the previous revision.
