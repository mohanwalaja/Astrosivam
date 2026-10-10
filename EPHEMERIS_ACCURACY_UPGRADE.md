# PHP Ephemeris Accuracy Upgrade (Lahiri + nutation, VSOP87D, ELP2000-82)

> **Historical note (October 2026):** This file records work from before the Node.js application server was removed. Production is now a static React frontend plus the PHP API in `api/`; Node.js remains build/test tooling only. Any `server/` paths and Node-server behaviors below describe the retired implementation, not the current deployment.


`api/astrology/engine.php` previously used low-order Meeus formulas (13 lunar
terms, unperturbed Keplerian elements for the planets) with UT treated as TT.
Against Swiss Ephemeris that drifted up to **4.5′ for the Moon**, ~1′ for
Mercury/Venus and **8–20′ for Jupiter/Saturn** — enough to flip a Janma
Nakshatra / Vimshottari balance near a Nakshatra Sandhi.

The planetary core has been rewritten as a pure-PHP (8.1+) ephemeris with no
binary dependencies. The coefficient tables live in the generated file
`api/astrology/ephemeris_tables.php` (shipped with the rest of `api/`).

## Models

| Component | Model |
|---|---|
| Time scale | UT → TT with observed annual ΔT (1900–2026) + projection (≈0.5 s of Swiss Ephemeris through 2100) |
| Sun, Mercury … Saturn | VSOP87D heliocentric series truncated to ~1″ (1 769 terms), light-time iteration + aberration, FK5 reduction |
| Moon | ELP2000-82 periodic terms (Meeus 47.A/47.B, 60 + 60 terms, E-factor, A1/A2/A3 terms), light-time retarded |
| Nutation | IAU 1980, full 63-term Δψ / Δε series |
| Obliquity | Laskar 1986 (mean) + Δε (true) |
| Ayanamsa | Chitra Paksha (Lahiri): `23.857092334° + p_A(T)` (IAU 2006 general precession) = **mean**; `mean + Δψ` = **true** |
| Rahu / Ketu | Osculating ("true") node from the lunar state vector `r × v` — the `SE_TRUE_NODE` convention |
| Lagna | Apparent sidereal time (GMST + equation of equinoxes), true obliquity, true ayanamsa |

### Ayanamsa convention (matches Drik Panchang / Swiss Ephemeris)

* `swe_get_ayanamsa_ut()` returns the **mean** Lahiri ayanamsa (23°51′25.53″ at J2000).
* `swe_get_ayanamsa_ex_ut()` — and Drik Panchang — show the **true** ayanamsa
  = mean + Δψ (23°51′11.6″ at J2000, Δψ = −13.93″).
* Sidereal longitude = apparent (nutated) tropical longitude − true ayanamsa,
  which is identical to mean-of-date longitude − mean ayanamsa. The engine
  computes both and exposes them in `computeGeocentricPositions()`.

## Verified accuracy vs Swiss Ephemeris 2.10.03 (Lahiri)

108-sample sweep 1900–2100 (`tests/fixtures/swiss-ephemeris-lahiri-reference.json`)
and 398 random worldwide birth charts 1950–2026:

| Body | Before (max) | After (max) | After (RMS) |
|---|---|---|---|
| Lahiri ayanamsa (true) | 0.3″ (mean only) | **0.02″** | 0.01″ |
| Sun | 51″ | **0.6″** | 0.2″ |
| Moon | **270″ (4.5′)** | **10.8″ (0.003°)** | 2.3″ |
| Mercury | 70″ | **0.9″** | 0.3″ |
| Venus | 83″ | 1.6″ | 0.3″ |
| Mars | 143″ | 1.1″ | 0.2″ |
| Jupiter | 474″ (7.9′) | 1.7″ | 0.6″ |
| Saturn | 1199″ (20′) | 2.1″ | 0.6″ |
| Rahu (true node) | 816″ (13.6′) | 66″ (≈1′) | 18″ |
| Sidereal Lagna | — | 0.5″ | — |

Across the 398 random charts there were **0** Rasi, Lagna-Rasi or retrograde
mismatches against Swiss Ephemeris. The single Janma-Nakshatra difference was a
Moon **1.2″** from the boundary (below the Swiss-vs-JPL noise floor itself).

Rahu's ≈1′ ceiling comes from the 60-term lunar latitude series that feeds the
osculating-plane calculation; it is still a 12× improvement. Upgrading to the
full ELP2000-82B series would push it to a few arcseconds if ever required.

## Rahu / Ketu node convention (`ASTRO_RAHU_NODE_TYPE`)

`api/config.php` defines `ASTRO_RAHU_NODE_TYPE` (`'TRUE'` or `'MEAN'`, env var
of the same name overrides it). `AstroEngine::nodeType()` resolves it as
runtime override → constant → environment → `'TRUE'`; anything else falls back
to `'TRUE'` with an `error_log` warning. The engine never loads `config.php`
itself (that file emits headers / starts sessions), so it only consults the
constant when it is already defined by the API router.

* `TRUE` — osculating node from the lunar state vector (Swiss Ephemeris
  `SE_TRUE_NODE`, Drik Panchang default). ≈1′ of Swiss Ephemeris.
* `MEAN` — mean node (Meeus 47.7). 0.11″ of `SE_MEAN_NODE`.

The two differ by up to ≈1°49′, so every result declares which one was used:
`computeGeocentricPositions()` returns `nodeType` plus both `trueNode` and
`meanNode`; `calculateHoroscope()`, `calculateMatchmaking()` and
`calculateBabyNaming()` return `nodeType`, and the horoscope `ephemeris` block
records `rahuNodeType`, `rahuTrueNode`, `rahuMeanNode`. The
`/api/services/calculate-preview` JSON carries a top-level `nodeType` (the
Node server does the same with `RAHU_NODE_TYPE = 'TRUE'`). Ketu is always
exactly Rahu + 180° under either convention.

> Deployment note: `deploy_cpanel.sh` keeps the live
> `config.php`, so add the `define('ASTRO_RAHU_NODE_TYPE', 'TRUE');` line to
> the server copy by hand (or set the environment variable).

## Public API added to `AstroEngine`

```php
AstroEngine::computeGeocentricPositions(float $jdUt, bool $withSpeed = true, ?string $nodeType = null): array
//   ['jdTt','deltaT','T','nodeType','nutation'=>['dpsi','deps'],'obliquity'=>['mean','true'],
//    'ayanamsa' (true), 'ayanamsaMean', 'tropicalMean'[], 'tropical'[] (apparent),
//    'sidereal'[], 'latitude'[], 'distance'[], 'speed'[] (deg/day, <0 = retrograde)]
AstroEngine::computeAscendant(float $jdUt, float $lat, float $lng, array $positions): array
AstroEngine::nodeType(): string                                  // 'TRUE' | 'MEAN'
AstroEngine::setNodeType(?string $type): void                    // runtime override, null = config
AstroEngine::lahiriAyanamsa(float $T, ?float $dpsi = null): float   // true
AstroEngine::lahiriAyanamsaMean(float $T): float
AstroEngine::lahiriAyanamsaForJulianDayUT(float $jdUt): float
AstroEngine::nutation(float $T): array
AstroEngine::meanObliquity(float $T): float
AstroEngine::deltaT(float $jdUt): float
AstroEngine::julianDayTT(float $jdUt): float
```

The legacy private helpers (`sunTropicalLongitude`, `moonTropicalLongitude`,
`trueLunarNode`, `planetGeocentricLongitude`) remain as thin wrappers; `$T` is
now Julian centuries **TT** and they return apparent tropical longitudes.

`calculateHoroscope()` additionally returns `ayanamsa` (true, 4 dp, like the
Node engine) and an `ephemeris` block (ΔT, Δψ, both ayanamsas and the exact
sidereal longitudes) so a Nakshatra-Sandhi margin can be audited. Planet
`isRetrograde` / `isCombust` flags — previously hard-coded `false` although the
PDF report reads them — are now computed (±0.5 day sidereal motion; combustion
orbs mirrored from the Node engine). Per-planet Nakshatra/Pada now use the exact
longitude instead of the 0.01°-rounded display value.

## Regenerating and verifying

```bash
pip install pymeeus pyswisseph            # dev only; never a runtime dependency
python3 scripts/build-ephemeris-tables.py # → api/astrology/ephemeris_tables.php
python3 scripts/swe_reference.py          # → tests/fixtures/swiss-ephemeris-lahiri-reference.json
php scripts/php-ephemeris-accuracy.php    # per-body max / RMS error table
php tests/astrology-accuracy-regression.test.php
```

Truncation thresholds per planet are set in `VSOP_THRESHOLDS` inside the
build script (tighter for Mars/Venus, which approach the Earth closely).

A single `calculateHoroscope()` call (with daily-motion evaluation) takes
≈4 ms on PHP 8.3; the table file loads in ≈2 ms (cached by OPcache).
