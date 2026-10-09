# TypeScript ↔ PHP parity testing (Node.js test harness)

The production application is a static React frontend plus the PHP/MySQL API in `api/`; it does not run a Node.js application server. The TypeScript astrology engine in `src/lib/astrology/` is used by browser-side features and is also exercised under Node.js in the parity tests. Those tests compare it with `api/astrology/engine.php`.

A customer is entitled to the same verdict whichever calculation path produced the report. Two audit findings broke that, and both are covered by the committed parity contract:

| Finding | Fix |
|---|---|
| **F1** — the TypeScript and PHP calculations used different Kuja / Sevvay Dosha rule sets and disagreed on 20.8% of charts | `src/lib/astrology/kujaDosha.ts` mirrors `AstroEngine::evaluateKujaDosha()` in PHP; both calculations use the same rule table |
| **F2** — the TypeScript calculation used MEAN Lahiri ayanamsa while PHP used TRUE (mean + Δψ), a gap peaking at 18.44″ | Both use TRUE (`src/lib/astrology/ayanamsa.ts`) and the same IAU 1980 nutation table |

---

## 1. What the parity test covers

A fixed, committed corpus of charts in `tests/fixtures/node-php-parity-corpus.json`:

| Section | Size | What it pins down |
|---|---:|---|
| `kujaCharts` — doctrine | 23 | Hand-written Sevvay/Kuja cases with expected verdicts and rule codes. Expectations come from the PHP rule table (`tests/wedding-matching-report.test.php`), checking the TypeScript calculation against the published rule rather than against itself. |
| `kujaCharts` — sweep | 432 | Every (Mars sign × Lagna sign) pair crossed with three deterministic Moon/Venus/Jupiter/Saturn/Rahu/Ketu layouts. Together with the doctrine cases it reaches all four verdicts (`DOSHA_NONE`, `DOSHA_PRESENT`, `DOSHA_MILD`, `DOSHA_CANCELLED`) and every exception and mitigation code. |
| `birthCharts` | 48 | Real birth data (1970 onward, six cities) for ayanamsa, Lagna, Chandra Rasi, Mars Rasi, janma nakshatra and pada. Each time was nudged deterministically until every compared value clears its sign / nakshatra / pada boundary by a recorded margin. |
| `ayanamsaDays` | 1004 | The ayanamsa at 12:00 UT four times a year from 1850 to 2100 — pure astronomy, no timezone, covering the full ±18″ amplitude of Δψ. |

`tests/fixtures/node-php-parity-expected.json` is the contract: the verdict each chart must produce. The TypeScript and PHP test suites are both checked against it.

---

## 2. Running it

```bash
# The TypeScript half runs under Node.js; this does not start a web server.
npm test                      # includes tests/node-php-parity.test.ts
npm run test:php              # includes tests/node-php-parity.test.php

# Direct TypeScript-engine vs PHP-engine diff (requires PHP CLI for the PHP half)
npm run parity:node           # writes tests/fixtures/parity-node.json
npm run parity:php            # writes tests/fixtures/parity-php.json
npm run parity:compare        # exits non-zero on ANY disagreement
```

`npm run parity:compare` prints each disagreeing field, for example:

```
TypeScript and PHP disagree on 4 of 1506 parity values:

  - kuja doctrine-02: status DOSHA_PRESENT vs DOSHA_NONE
  - kuja doctrine-02: isPresent true vs false
  - birth birth-0101: chandraRasi 7 vs 9
  - ayanamsa ayanamsa-1900-0101: 22.4654 vs 22.5
```

The TypeScript suite also compares the two calculations directly whenever
`tests/fixtures/parity-php.json` exists, so PHP output needs to be generated once
to enable a live cross-engine check. The two emitted files are git-ignored; only
the corpus and contract are committed.

### Tolerances

* Kuja verdicts: **exact** (status, `isPresent`, `raw`, `cancelled`, `mild`, the
  three house counts, and the exception/mitigation code lists).
* Ayanamsa: **0.0005°** (1.8″). Both calculations sit within about 0.04″ of
  Swiss Ephemeris, separating rounding noise from a convention switch.
* Sign-level integers (Lagna, Chandra Rasi, Mars Rasi, nakshatra, pada):
  **exact**, with every compared body in the corpus kept at least 0.1″–1.7°
  away from a boundary.

---

## 3. Regenerating the corpus and contract

```bash
npm run parity:corpus         # rebuild tests/fixtures/node-php-parity-corpus.json
npm run parity:seed           # rebuild the corpus, then seed expectations from TypeScript
```

`scripts/build-parity-corpus.ts` is deterministic and refuses to emit a birth
chart it cannot nudge clear of a boundary. Re-seeding the contract is a reviewed
operation: it records the TypeScript engine's current answers, so the diff is
the behaviour change under review. After re-seeding, run `npm run test:php` to
confirm the PHP engine still agrees.

---

## 4. Files

| Path | Role |
|---|---|
| `tests/fixtures/node-php-parity-corpus.json` | Committed chart corpus |
| `tests/fixtures/node-php-parity-expected.json` | Committed expected verdicts |
| `tests/node-php-parity.test.ts` | TypeScript half, in `npm test` |
| `tests/node-php-parity.test.php` | PHP half, in `npm run test:php` |
| `scripts/build-parity-corpus.ts` | Corpus generator (`npm run parity:corpus`) |
| `scripts/parity-emit-node.ts` | TypeScript engine output via Node.js tooling (`npm run parity:node`) |
| `tests/emit-php-parity.php` | PHP engine output (`npm run parity:php`) |
| `scripts/compare-parity.ts` | Engine-to-engine diff (`npm run parity:compare`) |
| `src/lib/astrology/kujaDosha.ts` | Shared TypeScript Kuja/Sevvay rule set |
| `src/lib/astrology/ayanamsa.ts` | Lahiri ayanamsa, TRUE by default |
| `src/lib/astrology/nutationSeries.ts` | Generated IAU 1980 table; rebuild with `node scripts/build-nutation-series.mjs` when `api/astrology/ephemeris_tables.php` changes |

The `.github/workflows/tests.yml` workflow runs only the PHP test suite and PHP
syntax checks. TypeScript/Node parity commands remain available for local
development, but are intentionally not part of the GitHub test workflow. The
separate `build.yml` workflow uses Node.js only to compile the static frontend;
no workflow launches or deploys a Node application server.

---

## 5. Current status

* The TypeScript and PHP calculations default to the South Indian five-house
  Kuja rule (Mars in houses 2, 4, 7, 8, 12 from the Lagna, Moon and Venus; the
  1st house is not screened). `ASTRO_KUJA_HOUSES=1,2,4,7,8,12` can override the
  PHP runtime or Node-based test process; browser code uses the documented
  default because it does not receive private server environment variables.
* The parity corpus previously recorded agreement on all 400 sampled worldwide
  charts for Kuja/Sevvay Dosha, after 83 disagreements (20.8%) in the earlier
  implementation. It also records TRUE ayanamsa agreement between TypeScript
  and PHP.
* In this checkout, the TypeScript type-check, regression suite and production
  frontend build pass. The PHP CLI is not installed in the local sandbox, so
  `npm run test:php` could not execute here; CI is configured to run the PHP
  suites and parity checks under PHP 8.1.
