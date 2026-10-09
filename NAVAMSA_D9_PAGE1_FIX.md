# Navamsa (D9) chart on Birth Jathagam page 1

## Symptom

On page 1 of the Birth Jathagam, the Navamsa (D9) chart showed
"Navamsa positions unavailable; N/A" in English, Tamil and Hindi, for charts built
by the PHP engine (the browser preview and every stored order). The Hindi Rasi
chart also showed only the Lagna, with no planets.

## Root causes

1. **The PHP engine emitted no D9 data.** `api/astrology/engine.php` did not return
   `navamsaRasi`, `totalDegrees` or `isVargottama` for each graha, nor
   `lagnaNavamsaRasi`. The Node engine (`server/astrology/astronomy.ts`) does, and
   the page-1 builders read those fields.
2. **The PHP report never matched a planet to its tag.** `api/astrology/pdf_mpdf_reports.php`
   keyed its tag table by capitalised names (`'Sun'`). The engine emits the lowercase
   Graha enum (`'sun'`), so no planet matched. Hindi planets then fell back to a
   `nameHi` field the engine does not emit, which left the chart empty.

## Fix

- `api/astrology/engine.php` emits `totalDegrees`, `navamsaRasi` and `isVargottama`
  for each graha, and `lagnaNavamsaRasi` and `isLagnaVargottama` for the Lagna. The
  rule is `floor(longitude / 3°20′) % 12 + 1`, the same rule the Node engine uses.
- `api/astrology/pdf_mpdf_reports.php` looks up tags by the engine's lowercase
  graha key, so the Rasi and Navamsa charts resolve the same way in every language.
- `src/services/navamsa.ts` (new) provides `withDerivedNavamsa`. A result saved
  before this fix has no D9 fields, so the helper fills only the missing values from
  the longitudes the result already holds. Engine-supplied values are never
  overwritten, and the input is never mutated. It is used by:
  - `src/services/jathagamHtmlBuilder.ts` (the page-1 builder, all languages);
  - `src/components/common/OrderReportModal.tsx` (the order view's chart tab);
  - `server/astrology/pdfGenerator.ts` (the Node direct-download PDF fallback).

## Verification

- The PHP and Node engines agree on the D9 sign of all nine grahas and the Lagna in
  all 48 parity charts (432 graha placements), checked against
  `tests/fixtures/navamsa-d9-parity.json`.
- `tests/jathagam-navamsa-page1.test.ts` (in `npm test`) covers the Node engine, the
  stored-result fill-in, the page-1 Navamsa card in en/ta/hi, the invalid-Ascendant
  case and the PDF fallback text.
- `tests/jathagam-navamsa-page1.test.php` (in `npm run test:php`) covers the live PHP
  engine against the fixture and the page-1 report tags in en/ta/hi.
- Both new tests fail against the code before this fix.

## Known limits

- A result saved before this fix gets its D9 values from its 2-decimal longitudes.
  This matched the engine for every corpus placement, but a graha within about
  0.005° of a 3°20′ boundary could land in the neighbouring sign. Recalculating the
  order gives the exact engine values.
- English abbreviations differ by renderer and are unchanged: the PHP report uses
  Mo/Me/Ju/Ve, while the browser page-1 builder uses Ch/Bu/Gu/Sk.
- The Node parity contract (`tests/fixtures/node-php-parity-expected.json`) does not
  yet include Navamsa. It is seeded from the Node engine, so adding it means
  regenerating the corpus. The D9 fixture above covers the same ground.
