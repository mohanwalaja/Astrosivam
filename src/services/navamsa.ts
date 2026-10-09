/**
 * Navamsa (D9) helpers shared by the Birth Jathagam page-1 builder and the order
 * chart view.
 *
 * Both engines place a graha in the D9 sign of its sidereal longitude: each sign
 * holds nine 3°20′ parts, so navamsa rasi = floor(longitude / 3°20′) % 12 + 1.
 * The engines emit those placements themselves. Results saved before they did
 * carry no D9 fields, so `withDerivedNavamsa` fills only the gaps, from the
 * longitudes the result already holds. Engine-supplied values are never
 * overwritten, and the input object is never mutated (results can be React state).
 */

const NAVAMSA_PART_DEG = 360 / 108; // 3°20′

const isRasiNumber = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeLongitude = (longitude: number): number => ((longitude % 360) + 360) % 360;

/** D9 sign (1–12) of a sidereal longitude in degrees, or null when it is not a finite number. */
export function navamsaRasiForLongitude(longitude: unknown): number | null {
  if (!isFiniteNumber(longitude)) return null;
  return (Math.floor(normalizeLongitude(longitude) / NAVAMSA_PART_DEG) % 12) + 1;
}

/** Sidereal longitude of a placement: `totalDegrees` when present, else sign + degrees. */
function placementLongitude(position: { rasi?: unknown; degrees?: unknown; totalDegrees?: unknown }): number | null {
  if (isFiniteNumber(position.totalDegrees)) return normalizeLongitude(position.totalDegrees);
  if (isRasiNumber(position.rasi) && isFiniteNumber(position.degrees)) {
    return normalizeLongitude((Number(position.rasi) - 1) * 30 + position.degrees);
  }
  return null;
}

/**
 * Returns the chart with any missing D9 placement filled in. A graha or the Lagna
 * that cannot be placed from valid longitudes is left unfilled, never guessed.
 */
export function withDerivedNavamsa<T>(result: T): T {
  if (!result || typeof result !== 'object') return result;
  const chart = result as unknown as {
    planetPositions?: unknown;
    navamsaPositions?: Record<string, { rasi?: unknown } | undefined>;
    lagnaNavamsaRasi?: unknown;
    lagnaRasi?: unknown;
    lagnaDegrees?: unknown;
  };
  let next: Record<string, unknown> = { ...(result as unknown as Record<string, unknown>) };

  const mappedNavamsa = chart.navamsaPositions || {};
  if (Array.isArray(chart.planetPositions)) {
    next.planetPositions = chart.planetPositions.map((entry: any) => {
      if (!entry || typeof entry !== 'object') return entry;
      if (isRasiNumber(entry.navamsaRasi) || isRasiNumber(mappedNavamsa[entry.graha]?.rasi)) return entry;
      const derived = navamsaRasiForLongitude(placementLongitude(entry));
      return derived === null ? entry : { ...entry, navamsaRasi: derived };
    });
  }

  if (!isRasiNumber(chart.lagnaNavamsaRasi)) {
    if (isRasiNumber(mappedNavamsa.lagna?.rasi)) {
      next.lagnaNavamsaRasi = Number(mappedNavamsa.lagna?.rasi);
    } else if (
      isRasiNumber(chart.lagnaRasi) &&
      isFiniteNumber(chart.lagnaDegrees) && chart.lagnaDegrees >= 0 && chart.lagnaDegrees < 30
    ) {
      const derived = navamsaRasiForLongitude((Number(chart.lagnaRasi) - 1) * 30 + chart.lagnaDegrees);
      if (derived !== null) next.lagnaNavamsaRasi = derived;
    }
  }

  return next as T;
}
