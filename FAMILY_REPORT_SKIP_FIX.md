# Family Report Skip Fix — "the recalculated chart was rejected as inconsistent"

Reported again after the DST-offset fix:

> Family package is not complete (3/4 high-quality reports, invoice ready).
> Nothing was emailed; retry the render. **#ORD-5A3E13 (Mohan Ji) was skipped:
> no calculated astrology result available for this member: the recalculated
> chart was rejected as inconsistent with the saved birth inputs** - verify this
> member's saved birth date, time, place, coordinates and time zone on the order.

Retrying could never succeed: the release path rejected charts the production
engine had just computed **from those very saved inputs**. Two engine facts caused it.

---

## Root cause 1 — the "is this chart current?" check demanded a Node-only field

`resultNeedsRecalculation()` (BIRTH_JATHAGAM) required `result.bhavas`:

```ts
return !result.bhavas || !birthDetailsMatch(result, p, p.gender || 'M');
```

Only the **Node** engine (`server/astrology/astronomy.ts`) emits a `bhavas`
table. Production runs the **PHP** engine
(`AstroEngine::calculateHoroscope()`), which records the twelve houses on every
`planetPositions` entry (`rasi`, `house`, `bhavaNumber`) instead — see
`tests/astrology-accuracy-regression.test.php` and the report builder, which
never reads `bhavas` at all.

So for every member whose saved chart had to be refreshed:

1. the saved chart was judged stale (no `bhavas`),
2. `resolveCalculatedResult()` recalculated it through `/api/services/calculate-preview`,
3. the PHP engine returned a complete chart — still without `bhavas`,
4. the same check rejected it as *"inconsistent with the saved birth inputs"*,
5. the member was skipped, the package was incomplete and (by design) nothing
   was emailed.

The 3 members whose cached charts already satisfied the check rendered fine —
hence **3/4**.

## Root cause 2 — birth date/time were compared as raw strings

Saved rows can hold what the customer typed. The PHP API accepts `6:30`,
`06:30:00` and `6:30 PM` and stores them verbatim, while both engines store the
canonical 24-hour `HH:MM` (`AstroEngine::normalizeBirthTime()`). The
byte-comparison therefore made those charts permanently stale too — the
recalculation produced the canonical time and failed the same check again.
Two smaller variants of the same class: the timezone candidate list resolved the
IANA zone from the raw string (so `6:30 PM` produced **no** offset candidate),
and a saved "Other" gender (`O`) could never equal the PHP engine's canonical
`M` for Baby Naming.

---

## Fix

`src/services/jathagamPdfExporter.ts`

* **Engine-agnostic chart completeness.** `hasCompleteJathagamChart()` replaces
  `!result.bhavas`. A chart is current when it carries what the report actually
  renders — valid `lagnaRasi`/`chandraRasi`, nine `planetPositions` with a rasi
  and a bhava (`bhavaNumber` or `house`), the janma nakshatra, `janmaPada` 1–4
  and a Vimshottari timeline — whichever engine produced it. Genuinely thin
  legacy results (`{ lagnaRasi: 5 }`, missing planets/pada/timeline) are still
  recalculated.
* **Birth particulars are compared as the wall clock the engines consume.**
  `canonicalBirthTime()` / `canonicalBirthDate()` normalise `6:30`, `06:30:00`
  and `6:30 PM` to `06:30`/`18:30` for the date/time comparison **and** for the
  IANA offset resolution, so a chart recalculated from the saved payload always
  validates. Changed date/time/place/country/coordinates/offset still force a
  recalculation.
* **Gender compared by letter.** `male`/`M`, `female`/`F` agree; a saved value
  that pins no binary gender (the checkout's `O`, which the PHP engine stores as
  `M`) no longer dead-locks. A real M↔F change still refreshes the report.
* **The recalculation request carries the canonical wall clock.**
  `canonicalCalculationPayload()` rewrites only the calculation-driving
  `dob`/`tob` fields (flat and nested bride/groom/partner shapes) before the
  calculate-preview call, so legacy rows can be rescued on the Node backend as
  well. The stored order is untouched.
* **The printed report shows the saved time correctly.** `mergeOrderPayloadIntoResult()`
  canonicalises the merged time, so a legacy `6:30 PM` row can no longer print
  as `06:30 AM`.

`src/components/common/LivePdfPreviewModal.tsx` — the single-order live preview
sends the same canonical payload when it refreshes a stale chart.

## Tests

`tests/family-report-engine-parity.test.ts` (registered in `scripts/run-tests.mjs`):

* a PHP-shaped chart (no `bhavas`) is accepted and renders a full report — the
  exact production failure, proven to fail on the previous code;
* a chart recalculated from a legacy `6:30` / `06:30:00` / `6:30 PM` saved time
  is accepted, and the report prints the right meridian;
* a genuine change of date/time/place/country/coordinates/offset, an
  implausible offset, a thin legacy result, a missing planet table, an invalid
  pada and a missing dasha timeline all still force recalculation;
* Baby Naming: an `O` saved gender no longer stalls, an M↔F change still does;
* the full family calculation phase resolves **4/4** members (Node-era cache,
  PHP chart, legacy saved time, no cache at all), and `resolveCalculatedResult()`
  still reports *why* when a chart truly cannot be resolved.

`npm test` (30 suites), `npm run test:php`, `tsc --noEmit` and `npm run build`
all pass.

## After deploy

Nothing to migrate and nothing to re-place: open the family order and press
**Approve / Resend Email** again. Members whose charts were previously skipped
now render from the stored chart, and any member that still needs a refresh is
recalculated from the saved birth particulars and accepted.
