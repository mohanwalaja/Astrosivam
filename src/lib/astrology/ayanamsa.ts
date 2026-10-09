/**
 * ASTRO SIVAM — Chitra Paksha (Lahiri) ayanamsa, shared by every engine.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The site renders the same report from two stacks: the TypeScript calculation code and
 * `api/astrology/engine.php` on cPanel. They used different ayanamsa
 * conventions:
 *
 *   TypeScript: MEAN  Lahiri ayanamsa  = 23.857092334° + p_A(T)
 *   PHP   : TRUE Lahiri ayanamsa   = mean + Δψ   (the Drik Panchang /
 *                                    swe_get_ayanamsa_ex_ut() convention)
 *
 * Two conventions meant every sidereal longitude — and the Lagna — differed
 * between the stacks by Δψ, which peaks at 18.44″ (10.73″ RMS) over
 * 1900–2100. A preview and the PDF delivered from it could disagree.
 *
 * Both stacks now default to the TRUE ayanamsa, computed from the same IAU 1980
 * nutation series (src/lib/astrology/nutationSeries.ts is generated from the PHP
 * engine's table). The MEAN convention remains selectable for cross-checking
 * against `swe_get_ayanamsa_ut()` via ASTRO_AYANAMSA_MODE=MEAN, and every chart
 * reports which one produced it.
 *
 * The IAU 1980 / Laskar 1986 formulas below are line-for-line ports of
 * AstroEngine::nutation(), ::lahiriAyanamsaMean() and ::lahiriAyanamsa().
 */
import * as Astronomy from 'astronomy-engine';
import { NUTATION_1980_SERIES } from './nutationSeries.js';

/** Read optional Node environment settings without requiring Node in the browser. */
function runtimeSetting(name: string): string {
  if (typeof process === 'undefined' || !process.env) return '';
  return String(process.env[name] ?? '').trim();
}

export const J2000 = 2451545.0;

/**
 * Lahiri (Chitra Paksha) MEAN ayanamsa at J2000.0 TT = 23°51′25.53″.
 * Same constant as AstroEngine::LAHIRI_AYANAMSA_J2000.
 */
export const LAHIRI_AYANAMSA_J2000 = 23.857092334;

export type AyanamsaMode = 'TRUE' | 'MEAN';

const norm360 = (deg: number): number => {
  const d = deg % 360.0;
  return d < 0 ? d + 360.0 : d;
};
const degToRad = (deg: number) => (deg * Math.PI) / 180.0;

/** Julian centuries of TT from J2000.0 for a UT Julian Day. */
export function julianCenturiesTT(jdUt: number): number {
  return (julianDayTT(jdUt) - J2000) / 36525.0;
}

/**
 * UT Julian Day → TT Julian Day. Astronomy Engine carries its own ΔT model;
 * the residual difference against the PHP engine's observed ΔT table is far
 * below 1 arcsecond of ayanamsa.
 */
export function julianDayTT(jdUt: number): number {
  if (!Number.isFinite(jdUt)) {
    throw new RangeError('julianDayTT requires a finite Julian Day.');
  }
  return Astronomy.MakeTime(jdUt - J2000).tt + J2000;
}

/**
 * IAU 1980 nutation, full 63-term series.
 * @param T Julian centuries TT from J2000.0
 * @returns Δψ and Δε in degrees
 */
export function nutation1980(T: number): { dpsi: number; deps: number } {
  const T2 = T * T;
  const T3 = T2 * T;
  const D = degToRad(norm360(297.85036 + 445267.11148 * T - 0.0019142 * T2 + T3 / 189474.0));
  const M = degToRad(norm360(357.52772 + 35999.05034 * T - 0.0001603 * T2 - T3 / 300000.0));
  const Mp = degToRad(norm360(134.96298 + 477198.867398 * T + 0.0086972 * T2 + T3 / 56250.0));
  const F = degToRad(norm360(93.27191 + 483202.017538 * T - 0.0036825 * T2 + T3 / 327270.0));
  const Om = degToRad(norm360(125.04452 - 1934.136261 * T + 0.0020708 * T2 + T3 / 450000.0));

  let dpsi = 0.0;
  let deps = 0.0;
  for (const row of NUTATION_1980_SERIES) {
    const arg = row[0] * D + row[1] * M + row[2] * Mp + row[3] * F + row[4] * Om;
    dpsi += (row[5] + row[6] * T) * Math.sin(arg);
    deps += (row[7] + row[8] * T) * Math.cos(arg);
  }
  // Coefficients are in units of 0.0001 arcsecond.
  return { dpsi: (dpsi * 0.0001) / 3600.0, deps: (deps * 0.0001) / 3600.0 };
}

/**
 * Mean obliquity of the ecliptic (Laskar 1986, Meeus 22.3), degrees.
 * Laskar's polynomial, evaluated with Horner's scheme over the U^0 … U^10
 * coefficients (identical to AstroEngine::meanObliquity()).
 */
const LASKAR_OBLIQUITY_COEFFICIENTS = [
  84381.448, -4680.93, -1.55, 1999.25, -51.38, -249.67, -39.05, 7.12, 27.87, 5.79, 2.45
];

export function meanObliquity(T: number): number {
  const U = T / 100.0;
  let seconds = 0.0;
  for (let i = LASKAR_OBLIQUITY_COEFFICIENTS.length - 1; i >= 0; i -= 1) {
    seconds = seconds * U + LASKAR_OBLIQUITY_COEFFICIENTS[i];
  }
  return seconds / 3600.0;
}

/** True obliquity of the ecliptic, degrees (mean + Δε). */
export function trueObliquity(T: number, deps?: number): number {
  return meanObliquity(T) + (deps ?? nutation1980(T).deps);
}

/**
 * MEAN Lahiri ayanamsa (Swiss Ephemeris `swe_get_ayanamsa_ut()`).
 * @param T Julian centuries TT from J2000.0
 */
export function lahiriAyanamsaMean(T: number): number {
  const pA =
    (((((-0.0000000383 * T - 0.000023857) * T + 0.00007964) * T + 1.1054348) * T + 5028.796195) * T);
  return LAHIRI_AYANAMSA_J2000 + pA / 3600.0;
}

/**
 * TRUE Lahiri ayanamsa = mean + Δψ.
 * This is what Drik Panchang displays, what `swe_get_ayanamsa_ex_ut()` returns
 * and what the PHP engine subtracts from apparent tropical longitudes.
 */
export function lahiriAyanamsaTrue(T: number, dpsi?: number): number {
  return lahiriAyanamsaMean(T) + (dpsi ?? nutation1980(T).dpsi);
}

/**
 * Ayanamsa convention used to convert tropical to sidereal longitudes.
 *
 * `ASTRO_AYANAMSA_MODE` overrides the default (`TRUE`), matching the way
 * `ASTRO_RAHU_NODE_TYPE` selects the Rahu/Ketu convention. Anything other than
 * TRUE/MEAN falls back to TRUE with a warning — silently guessing an ayanamsa
 * would move every chart.
 */

/**
 * Optional correction, in arc-seconds, added to the Lahiri value.
 *
 * Default 0: the value below IS the Lahiri (Chitra Paksha) ayanamsa, verified
 * against Swiss Ephemeris / Drik Panchang. For the ASTRO SIVAM test chart
 * (18-06-1991, 06:30 IST, Walajapet) it returns 23.7422°, which puts the Sun at
 * Mithunam 2.59° — the Swiss Ephemeris answer is 23.742257° / 2.5867°.
 *
 * Set ASTRO_AYANAMSA_OFFSET_ARCSEC only to match a second opinion whose
 * convention differs (an older panchangam, a KP/Raman table, ...). Example:
 * forcing the Sun to Mithunam 3.3° needs an ayanamsa of 23.03°, i.e.
 * ASTRO_AYANAMSA_OFFSET_ARCSEC=-2566 (-0.7128°). That is NOT Lahiri.
 */
export function ayanamsaOffsetArcs(): number {
  const raw = runtimeSetting('ASTRO_AYANAMSA_OFFSET_ARCSEC');
  if (raw === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(
      `ASTRO SIVAM: ASTRO_AYANAMSA_OFFSET_ARCSEC="${raw}" is not a number. Ignoring it (offset 0).`
    );
    return 0;
  }
  console.warn(
    `ASTRO SIVAM: ASTRO_AYANAMSA_OFFSET_ARCSEC=${value} is applied to the Lahiri ayanamsa. ` +
    'The chart no longer matches Swiss Ephemeris Lahiri.'
  );
  return value;
}

/** The single place the offset is applied — every sidereal longitude goes through here. */
export function applyAyanamsaOffset(degrees: number): number {
  return degrees + ayanamsaOffsetArcs() / 3600.0;
}

/** One-line debug string: which ayanamsa (and which convention) a chart used. */
export function ayanamsaDebugLine(jdUt: number, value: number, mode: AyanamsaMode = ayanamsaMode()): string {
  const mean = lahiriAyanamsaMean(julianCenturiesTT(jdUt));
  const offset = ayanamsaOffsetArcs();
  const t = julianCenturiesTT(jdUt);
  return (
    `[ASTRO SIVAM] Ayanamsa: Lahiri (Chitra Paksha) ${mode}` +
    ` = ${value.toFixed(6)}° (${Math.floor(value)}° ` +
    `${String(Math.floor((value % 1) * 60)).padStart(2, '0')}′ ` +
    `${((((value % 1) * 60) % 1) * 60).toFixed(1)}″)` +
    ` | mean ${mean.toFixed(6)}° | ΔT-centuries ${t.toFixed(6)}` +
    (offset !== 0 ? ` | OFFSET ${offset}″ applied` : '') +
    ` | JD(UT) ${jdUt.toFixed(6)}`
  );
}

/**
 * Prints the ayanamsa a chart actually used. Called by calculatePrecisionHoroscope
 * and by every report renderer that needs to prove which value produced its longitudes.
 * Silence it with ASTRO_AYANAMSA_SILENT=1.
 */
export function logAyanamsa(jdUt: number, value: number, mode: AyanamsaMode = ayanamsaMode()): number {
  if (runtimeSetting('ASTRO_AYANAMSA_SILENT') !== '1') {
    console.log(ayanamsaDebugLine(jdUt, value, mode));
  }
  return value;
}

export function ayanamsaMode(): AyanamsaMode {
  const raw = runtimeSetting('ASTRO_AYANAMSA_MODE').toUpperCase();
  if (raw === '') return 'TRUE';
  if (raw === 'TRUE' || raw === 'MEAN') return raw;
  console.error(
    `ASTRO SIVAM: ASTRO_AYANAMSA_MODE="${raw}" is not valid (expected TRUE or MEAN). Falling back to TRUE.`
  );
  return 'TRUE';
}

/**
 * Ayanamsa for a UT Julian Day in the requested convention.
 * Sidereal longitude = apparent (nutated) tropical longitude − TRUE ayanamsa,
 * which is identical to mean-of-date longitude − MEAN ayanamsa.
 */
export function lahiriAyanamsaForJulianDayUT(jdUt: number, mode: AyanamsaMode = ayanamsaMode()): number {
  // THE single ayanamsa function. Every sidereal longitude in every stack
  // (horoscope, panchangam, muhurtham scanner, baby naming, PDF previews) comes
  // through here, so one value is applied everywhere.
  const T = julianCenturiesTT(jdUt);
  const value = mode === 'MEAN' ? lahiriAyanamsaMean(T) : lahiriAyanamsaTrue(T);
  return applyAyanamsaOffset(value);
}

/**
 * The ayanamsa the engines subtract. Kept under its historical name so every
 * caller (horoscope, panchangam, muhurtham scanner, baby naming) switches
 * convention together.
 */
export function calculateLahiriAyanamsa(jdUt: number): number {
  return lahiriAyanamsaForJulianDayUT(jdUt);
}
