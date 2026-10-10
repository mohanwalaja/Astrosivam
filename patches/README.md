# Marriage Matching (10 Porutham) — fixes, per issue

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


All patches are unified diffs generated against `main` (commit `c3ae486`). Apply from the
repository root, **in file-name order**:

```sh
for p in patches/*.patch; do patch -p1 < "$p"; done
```

`patch` reports an offset (the line numbers shift as earlier patches land) — that is
expected and harmless. Running the same patch twice prints
"Reversed (or previously applied) patch detected" and skips; nothing is corrupted.

Every patch was verified by applying the whole set to a clean `main` checkout and diffing
the result against the fixed tree (identical).

| # | File(s) | Original line(s) | Problem | Patch |
|---|---------|------------------|---------|-------|
| 1 | `api/astrology/engine.php` | 1169 (`$RAJJU_GROUP`) | The five Rajju groups were written as a `4,3,2,1,0` rotation every **five** Nakshatras. The classical groups repeat every **nine**, so Ardra..Ashlesha, Swati..Jyeshtha and Shatabhisha..Uttara Bhadrapada sat one group off. Bride Avittam (Siro) + groom Swati (Kanda) were both treated as group 0 → crucial Rajju gate failed → 19/35 with 6/10 instead of 24/35 with 7/10. | `01-rajju-five-group-table.patch` |
| 1 | `server/astrology/matchmaking.ts` | 25 (`NAKSHATRA_RAJJU`) | Same table, same bug in the Node engine. | `01-rajju-five-group-table.patch` |
| 2 | `api/astrology/engine.php` | 2908 (`$pd['enum']`), 2921 (`$totalPoruthamsMatched`) | The row label followed the pass/fail flag, so every score ≥ half marks was labelled **Uttamam** — Yoni 2/4 printed as an excellent row. "Matched" also counted only Uttamam, which is why the count was 6/10. Now full marks → Uttamam, a genuine partial score → **Mathimam**, zero → Porundhadhu; matched counts Mathimam (as the Node engine already did). | `02-partial-score-mathimam-label.patch` |
| 3 | `api/astrology/engine.php` | 2870–2879 (`$poruthamDefs`), 2935 (`explanationEn`) | The explanation column repeated the **benefit** even on a failed row. Each Porutham now carries `lackEn/lackTa/lackHi` (what is missing) and the row prints that when it did not earn full marks. | `03-failed-porutham-explanations.patch` |
| 3 | `server/astrology/matchmaking.ts` | 208, 247, 306–309, 340–343, 383–386, 420–423, 451–457 | Same wording problem in the Node engine's explanation branches (Dina, Gana, Stree Deergha, Yoni, Rasi, Rasiyadhipathi, Vasiya). | `03-failed-porutham-explanations.patch` |
| 4 | `src/services/weddingHtmlBuilder.ts` | 278–279 | The preview/HTML report read only `p.pointsEarned`, so a row carrying the legacy `points` key fell back to "N/A / N/A", and a falsy-zero fallback can leave a bare "/ 4". Now `pointsEarned ?? points` with explicit null/empty checks — a true 0 prints **0 / 4**. (The mPDF, jsPDF and modal renderers were already `??`-safe; verified by running the report HTML: `0 / 4`.) | `04-zero-score-rendering.patch` |
| 5 | `api/astrology/pdf_mpdf_reports.php` | 2141 | The red final verdict was correct-looking but followed the (broken) Rajju result, and its flat "the matching is not good" contradicted the page-2 "astrological guidance only" disclaimer. The text is still derived from `$isMatchingGood` (= `verdictStatus`) and now carries the guidance-only qualification. | `05-final-verdict-derived-and-disclaimer.patch` |
| 5 | `src/services/weddingHtmlBuilder.ts`, `src/components/common/OrderReportModal.tsx`, `server/astrology/pdfGenerator.ts` | 177 / 936 / 1332 | Same negative verdict wording in the browser preview, the customer dashboard modal and the jsPDF fallback. | `05-final-verdict-derived-and-disclaimer.patch` |
| 6 | `api/astrology/engine.php` | 3090–3094 (Kuja guidance append) | The Kuja box appended "…the Rajju/Vedha mismatch remains; … not recommended …" on top of the score-banner verdict and the final-verdict banner, so one Rajju failure was printed three times. The sentence is removed; the verdict states it once. | `06-kuja-box-no-repeated-rajju.patch` |
| 6 | `server/astrology/matchmaking.ts` | 606–616, 643–667 | Same triple repetition in the Node engine; the verdict now also names **both** failed hard stops (a classical Vedha pair also shares a Rajju group). | `06-kuja-box-no-repeated-rajju.patch` |
| 7 | `tests/wedding-matching-report.test.php` (new CASE 1/2/3), `tests/porutham-reference.test.ts`, `tests/sample-engine-meaning.test.php`, `tests/sample-engine-meaning.test.ts` | — | Three new cases and the reference tables/cases that encoded the old rotation. See below. | `07-tests-three-cases.patch` |
| 8 | `ASTRO_SERVICES_ACCURACY_AND_SECURITY_AUDIT.md` | 33, 184 | The audit claimed the Rajju table was "independently verified" and "matches the classical listing". Corrected. | `08-audit-doc-rajju-claim.patch` |

## The three test cases

1. **CASE 1 — the reported failure.** Bride Avittam/Dhanishta (index 22, Siro) + groom Swati
   (index 14, Kanda) earn **Rajju Uttamam 5/5**. End-to-end on the fixed public sample couple
   (groom 01 Jan 2000, 02:00, Chennai; bride 15 Jun 1998, 06:30, Chennai — that couple *is*
   Avittam + Swati): **24 / 35 points, 7 / 10 Poruthams, verdict Madhyamam**, and the Tamil
   final verdict is the green "இந்தப் பொருத்தம் நல்லது…". A control case checks that two stars
   of the *same* group (Swati + Rohini, both Kanda) still fail Rajju.
2. **CASE 2 — the Yoni label.** A 2/4 Yoni row must be **Mathimam (MADHYAMAM)**, never Uttamam,
   both in the report HTML and in the engine's live row for the sample couple.
3. **CASE 3 — the zero score.** A genuine 0-point row must render **`0 / 4`**, and the report
   must never contain a bare `"/ 4"`.
4. **Rajju table invariant (PHP).** The same suite now reflects `$RAJJU_GROUP` and walks all 27
   Nakshatras against the five classical membership lists, asserting that each group owns exactly
   its six stars and its own index (0 = Siro … 4 = Pada). The old hand-rotated table fails this
   on the first assertion. Verified both ways: the new checks fail against `c3ae486` and pass on
   the fixed tree.

## Notes

* `api/admin/index.php` and its deployed `public_html/api/admin/index.php` copy contain no
  matching logic (only the service label), so nothing had to be synced by hand; the deploy
  path is `deploy_cpanel.sh` / `scripts/sync_public_html_api.sh`.
* The PHP report scores on its traditional weighted 35-point denominator; the Node preview
  scores the ten Poruthams equally out of 10. That divergence is intentional (see the comment
  in `engine.php`). A separate, pre-existing Node/PHP difference in the **Vasiya** table
  (audit finding F3: the sample preview shows 8/10 while the PDF shows 7/10) is **not** part of
  this change set.
