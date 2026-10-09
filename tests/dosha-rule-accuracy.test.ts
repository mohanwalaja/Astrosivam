import assert from 'node:assert/strict';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy.js';
import { Graha, Rasi } from '../src/lib/astrology/types.js';
import { NAVAGRAHA_DOSHA_DATA } from '../src/services/jathagamDoshaData.js';
import { activeKujaHouses, KUJA_DEFAULT_HOUSES } from '../src/lib/astrology/kujaDosha.js';

type Chart = ReturnType<typeof calculatePrecisionHoroscope>;
type PlanetPosition = Chart['planetPositions'][number];

/**
 * Dosha rule validation.
 *
 * Every rule below is re-derived in the test from the chart the engine returns
 * (signs, houses and longitudes), using the classical rule set this engine
 * documents:
 *   - Kuja/Manglik (Sevvay Dosham): Mars in houses 2, 4, 7, 8 or 12 (the South
 *     Indian rule — the 1st house is not a Kuja house; ASTRO_KUJA_HOUSES is the
 *     documented override) counted
 *     whole-sign from the Lagna, the Moon AND Venus, cancelled when Mars is in
 *     its own sign (Mesham/Viruchigam) or exalted (Magaram), or in Simham or
 *     Kumbham, or by the house-and-sign exceptions, or when Jupiter or the Moon
 *     shares its sign, or when Jupiter aspects it by the 5th/7th/9th, or for a
 *     Kadagam/Simham Lagna (Yogakaraka). The same rule set is implemented in
 *     src/lib/astrology/kujaDosha.ts (a port of AstroEngine::evaluateKujaDosha()
 *     in api/astrology/engine.php) so both stacks agree; it is restated here
 *     independently so a transcription error in either copy fails the suite.
 *   - Kala Sarpa: all seven classical planets on one side of the Rahu-Ketu axis.
 *   - Pitru (simplified): Sun sharing a sign with a node, or Saturn in the 9th.
 *   - Guru Chandala: Jupiter sharing a sign with a node.
 *   - Navagraha screening: debilitation, conjunction with a natural malefic in
 *     the same house, or placement in houses 6, 8 or 12 (Mars is skipped when
 *     the Kuja indicator already covers it).
 */

const KUJA_HOUSES = [2, 4, 7, 8, 12];
const OWN_MARS: Rasi[] = [Rasi.MESHAM, Rasi.VIRUCHIGAM];
const EXALTED_MARS: Rasi = Rasi.MAGARAM;
const UNIVERSAL_SIGN_EXCEPTIONS: Rasi[] = [Rasi.SIMHAM, Rasi.KUMBAM];
const YOGAKARAKA_LAGNAS: Rasi[] = [Rasi.KADAGAM, Rasi.SIMHAM];
const HOUSE_SIGN_EXCEPTIONS: Record<number, Rasi[]> = {
  2: [Rasi.MITHUNAM, Rasi.KANNI],
  7: [Rasi.KADAGAM, Rasi.MAGARAM],
  8: [Rasi.DHANUSU, Rasi.MEENAM],
  12: [Rasi.RISHABAM, Rasi.THULAM]
};
const DEBILITATION_SIGN: Partial<Record<Graha, Rasi>> = {
  [Graha.SURYA]: Rasi.THULAM,
  [Graha.CHANDRA]: Rasi.VIRUCHIGAM,
  [Graha.CHEVVAI]: Rasi.KADAGAM,
  [Graha.BUDHA]: Rasi.MEENAM,
  [Graha.GURU]: Rasi.MAGARAM,
  [Graha.SUKRA]: Rasi.KANNI,
  [Graha.SANI]: Rasi.MESHAM,
  [Graha.RAHU]: Rasi.VIRUCHIGAM,
  [Graha.KETU]: Rasi.RISHABAM
};
const NATURAL_MALEFICS = new Set<Graha>([Graha.CHEVVAI, Graha.SANI, Graha.RAHU, Graha.KETU]);
const CLASSICAL_GRAHAS: Graha[] = [
  Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.BUDHA, Graha.GURU, Graha.SUKRA, Graha.SANI
];

const normalize = (value: number) => ((value % 360) + 360) % 360;
const find = (chart: Chart, graha: Graha) => {
  const position = chart.planetPositions.find(entry => entry.graha === graha);
  assert.ok(position, `${graha} must be present in every chart`);
  return position as PlanetPosition;
};

/** Whole-sign house of `target` counted from `reference` (both 1-based rasis). */
const houseFrom = (target: number, reference: number) => (((target - reference + 12) % 12) + 1);

/**
 * The classical rule, restated independently of the engine implementation:
 * Mars in a Kuja house from ANY of the three references, cancelled by any of
 * the classical exceptions.
 */
function expectedKuja(chart: Chart): { present: boolean; raw: boolean; cancelled: boolean; houses: number[] } {
  const mars = find(chart, Graha.CHEVVAI);
  const moon = find(chart, Graha.CHANDRA);
  const venus = find(chart, Graha.SUKRA);
  const guru = find(chart, Graha.GURU);
  const lagna = chart.lagnaRasi as number;

  const houses = [houseFrom(mars.rasi, lagna), houseFrom(mars.rasi, moon.rasi), houseFrom(mars.rasi, venus.rasi)];
  const afflicted = houses.filter(house => KUJA_HOUSES.includes(house));
  const raw = afflicted.length > 0;
  if (!raw) return { present: false, raw: false, cancelled: false, houses };

  const signExceptionsCover = (house: number) => (HOUSE_SIGN_EXCEPTIONS[house] ?? []).includes(mars.rasi);
  const neutralised = houses.filter(house => KUJA_HOUSES.includes(house) && signExceptionsCover(house));
  const guruAspect = houseFrom(mars.rasi, guru.rasi);

  const cancelled =
    OWN_MARS.includes(mars.rasi) ||
    mars.rasi === EXALTED_MARS ||
    UNIVERSAL_SIGN_EXCEPTIONS.includes(mars.rasi) ||
    (neutralised.length > 0 && neutralised.length === afflicted.length) ||
    (YOGAKARAKA_LAGNAS.includes(lagna as Rasi) && KUJA_HOUSES.includes(houses[0])) ||
    guru.rasi === mars.rasi ||
    moon.rasi === mars.rasi ||
    (guru.rasi !== mars.rasi && [5, 7, 9].includes(guruAspect));

  return { present: raw && !cancelled, raw, cancelled, houses };
}

function expectedKalaSarpa(chart: Chart): boolean {
  const rahu = find(chart, Graha.RAHU).totalDegrees;
  const sides = CLASSICAL_GRAHAS.map(graha => normalize(find(chart, graha).totalDegrees - rahu) < 180);
  return sides.every(side => side === sides[0]);
}

function expectedPitru(chart: Chart): boolean {
  const sun = find(chart, Graha.SURYA);
  const saturn = find(chart, Graha.SANI);
  const rahu = find(chart, Graha.RAHU);
  const ketu = find(chart, Graha.KETU);
  const ninthRasi = chart.bhavas[8].rasi;
  return sun.rasi === rahu.rasi || sun.rasi === ketu.rasi || saturn.rasi === ninthRasi;
}

function expectedGuruChandala(chart: Chart): boolean {
  const guru = find(chart, Graha.GURU);
  return guru.rasi === find(chart, Graha.RAHU).rasi || guru.rasi === find(chart, Graha.KETU).rasi;
}

function expectedNavagrahaIndicators(chart: Chart): Graha[] {
  const kuja = expectedKuja(chart);
  const flagged: Graha[] = [];
  for (const graha of Object.values(Graha) as Graha[]) {
    const position = find(chart, graha);
    const debilitated = position.rasi === DEBILITATION_SIGN[graha];
    const conjunctMalefic = chart.planetPositions.find(other =>
      other.graha !== graha &&
      NATURAL_MALEFICS.has(other.graha) &&
      other.bhavaNumber === position.bhavaNumber
    );
    const dusthana = [6, 8, 12].includes(position.bhavaNumber);
    if (!(debilitated || conjunctMalefic || dusthana)) continue;
    if (graha === Graha.CHEVVAI && kuja.present) continue;
    flagged.push(graha);
  }
  return flagged;
}

// ---------------------------------------------------------------------------
// Sample charts: three latitudes (tropics, southern hemisphere, high northern
// latitude) x two dates x every hour, so Lagna - and therefore the house a
// Graha occupies - sweeps the whole zodiac.
// ---------------------------------------------------------------------------
const PLACES = [
  { name: 'Chennai, Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707, offset: 5.5 },
  { name: 'Suva, Fiji', latitude: -18.1248, longitude: 178.4501, offset: 12 },
  { name: 'Reykjavik, Iceland', latitude: 64.1466, longitude: -21.9426, offset: 0 }
];
const DATES = [
  '1992-06-15', '1995-03-21', '1997-09-09', '2001-12-03', '2004-05-05',
  '2008-01-20', '2012-08-12', '2016-11-30', '2020-02-02'
];

const charts: Array<{ label: string; chart: Chart }> = [];
for (const place of PLACES) {
  for (const dob of DATES) {
    for (let hour = 0; hour < 24; hour++) {
      const tob = `${String(hour).padStart(2, '0')}:00`;
      const chart = calculatePrecisionHoroscope(
        'Dosha Sample', dob, tob, place.name, place.latitude, place.longitude, place.offset, '', 'M'
      );
      charts.push({ label: `${place.name} ${dob} ${tob}`, chart });
    }
  }
}
assert.equal(charts.length, 648, 'Sample size guard');

const counts = { kuja: 0, kalaSarpa: 0, pitru: 0, guruChandala: 0, navagraha: 0 };
const kujaHousesSeen = new Set<number>();

for (const { label, chart } of charts) {
  const named = chart.doshas.filter(dosha => !dosha.isNavagrahaAfflictionIndicator);
  assert.equal(named.length, 4, `${label}: four named Dosha checks must be reported`);
  assert.match(named[0].nameEn, /Kuja|Manglik/);
  assert.match(named[1].nameEn, /Kala Sarpa/);
  assert.match(named[2].nameEn, /Pitru/);
  assert.match(named[3].nameEn, /Guru Chandala/);

  // 1. Kuja / Manglik
  const kuja = expectedKuja(chart);
  assert.equal(named[0].isPresent, kuja.present,
    `${label}: Kuja indicator must follow Mars in houses ${kuja.houses.join('/')} (Lagna/Moon/Venus) ` +
    `(raw: ${kuja.raw}, cancelled: ${kuja.cancelled})`);
  assert.equal(/nivrutti|relieved/i.test(named[0].severityEn), kuja.cancelled,
    `${label}: the severity text must state when a Dosha Nivrutti rule relieves the Kuja indicator`);
  assert.match(named[0].descriptionEn, new RegExp(`House ${kuja.houses[0]}`),
    `${label}: the Kuja description must name the house Mars occupies`);
  assert.match(named[0].descriptionEn, new RegExp(`House ${kuja.houses[1]}`),
    `${label}: the Kuja description must name the house Mars holds from the Moon`);
  assert.match(named[0].descriptionEn, new RegExp(`House ${kuja.houses[2]}`),
    `${label}: the Kuja description must name the house Mars holds from Venus`);
  kujaHousesSeen.add(find(chart, Graha.CHEVVAI).bhavaNumber);
  if (kuja.present) counts.kuja++;

  // 2. Kala Sarpa
  assert.equal(named[1].isPresent, expectedKalaSarpa(chart), `${label}: Kala Sarpa indicator`);
  if (named[1].isPresent) counts.kalaSarpa++;

  // 3. Pitru
  assert.equal(named[2].isPresent, expectedPitru(chart), `${label}: Pitru indicator`);
  if (named[2].isPresent) counts.pitru++;

  // 4. Guru Chandala
  assert.equal(named[3].isPresent, expectedGuruChandala(chart), `${label}: Guru Chandala indicator`);
  if (named[3].isPresent) counts.guruChandala++;

  // 5. Navagraha screening indicators
  const expectedIndicators = expectedNavagrahaIndicators(chart);
  const reportedIndicators = chart.doshas.filter(dosha => dosha.isNavagrahaAfflictionIndicator);
  assert.deepEqual(
    reportedIndicators.map(dosha => dosha.nameEn),
    expectedIndicators.map(graha => NAVAGRAHA_DOSHA_DATA[graha].name.en),
    `${label}: Navagraha screening indicators must match the documented placement rules`
  );
  assert.ok(reportedIndicators.every(dosha => dosha.isPresent),
    `${label}: a listed Navagraha indicator is always present`);
  assert.ok(!expectedIndicators.includes(Graha.CHEVVAI) || !kuja.present,
    `${label}: Mars is not listed twice when the Kuja indicator already covers it`);
  counts.navagraha += reportedIndicators.length;

  // 6. Every flagged Dosha carries a remedy and an explanation in all languages
  for (const dosha of chart.doshas.filter(entry => entry.isPresent)) {
    for (const [field, value] of Object.entries({
      severityEn: dosha.severityEn, descriptionEn: dosha.descriptionEn, remedyEn: dosha.traditionalRemedyEn,
      severityTa: dosha.severityTa, descriptionTa: dosha.descriptionTa, remedyTa: dosha.traditionalRemedyTa,
      severityHi: dosha.severityHi, descriptionHi: dosha.descriptionHi, remedyHi: dosha.traditionalRemedyHi
    })) {
      assert.ok(value && value.trim().length > 0, `${label}: ${dosha.nameEn} must fill ${field}`);
    }
  }
}

console.log(`  [PASS] ${charts.length} charts: every named Dosha and Navagraha indicator matches the documented rules`);
console.log(`         Mars appeared in ${kujaHousesSeen.size} distinct houses; ` +
  `flagged -> Kuja: ${counts.kuja}, Kala Sarpa: ${counts.kalaSarpa}, ` +
  `Pitru: ${counts.pitru}, Guru Chandala: ${counts.guruChandala}, Navagraha: ${counts.navagraha}`);

// ---------------------------------------------------------------------------
// Coverage: both sides of every rule have to be exercised by the sample.
// ---------------------------------------------------------------------------
assert.equal(kujaHousesSeen.size, 12, 'The sample must place Mars in every house at least once');
assert.ok(counts.kuja > 0 && counts.kuja < charts.length,
  'Kuja must be both present and absent across the sample');
assert.ok(counts.kalaSarpa > 0 && counts.kalaSarpa < charts.length,
  'Kala Sarpa must be both present and absent across the sample');
assert.ok(counts.pitru > 0 && counts.pitru < charts.length,
  'Pitru must be both present and absent across the sample');
assert.ok(counts.guruChandala > 0 && counts.guruChandala < charts.length,
  'Guru Chandala must be both present and absent across the sample');
console.log('  [PASS] Every Dosha rule is exercised on both the positive and negative side');

// ---------------------------------------------------------------------------
// Targeted edge cases
// ---------------------------------------------------------------------------
// Mars in the Lagna is NOT a Kuja house under the South Indian five-house rule
// (2,4,7,8,12): it only counts when Mars is also in a dosha house from the Moon
// or Venus. The engine must agree with the rule and still print the placement.
assert.ok(!KUJA_HOUSES.includes(1), 'The 1st house must not be part of the South Indian Kuja rule');
const marsInLagna = charts.find(({ chart }) => find(chart, Graha.CHEVVAI).bhavaNumber === 1);
assert.ok(marsInLagna, 'The sample must contain a chart with Mars in the 1st house');
assert.equal(marsInLagna.chart.doshas[0].isPresent, expectedKuja(marsInLagna.chart).present,
  'Mars in the Lagna follows the Kuja rule, exceptions included');
assert.match(marsInLagna.chart.doshas[0].descriptionEn, /House 1/);
const marsInLagnaOnly = charts.find(({ chart }) => {
  const mars = find(chart, Graha.CHEVVAI);
  const houses = [houseFrom(mars.rasi, chart.lagnaRasi as number), houseFrom(mars.rasi, find(chart, Graha.CHANDRA).rasi), houseFrom(mars.rasi, find(chart, Graha.SUKRA).rasi)];
  return houses[0] === 1 && !KUJA_HOUSES.includes(houses[1]) && !KUJA_HOUSES.includes(houses[2]);
});
assert.ok(marsInLagnaOnly,
  'The sample must contain a chart whose Mars is in the 1st house from the Lagna and in no dosha house from the Moon or Venus');
assert.equal(marsInLagnaOnly.chart.doshas[0].isPresent, false,
  'Mars in the 1st house alone must not be reported as a Kuja Dosha under the South Indian rule');
assert.equal(marsInLagnaOnly.chart.doshas[0].verdict, 'none',
  'That chart must carry the "none" verdict, not an unassessed or cancelled one');

// A dosha that exists only from the Moon or Venus - invisible to the old
// Lagna-only rule - must now be reported.
const moonOrVenusOnly = charts.find(({ chart }) => {
  const kuja = expectedKuja(chart);
  return kuja.raw && !kuja.cancelled && !KUJA_HOUSES.includes(kuja.houses[0]) &&
    (KUJA_HOUSES.includes(kuja.houses[1]) || KUJA_HOUSES.includes(kuja.houses[2]));
});
assert.ok(moonOrVenusOnly, 'The sample must contain a dosha found only from the Moon or Venus');
assert.equal(moonOrVenusOnly.chart.doshas[0].isPresent, true,
  'A Kuja Dosha counted from the Moon or Venus must be reported even when the Lagna is clear');
assert.match(moonOrVenusOnly.chart.doshas[0].descriptionEn, /Moon|Venus/);

const cancelledKuja = charts.find(({ chart }) => {
  const mars = find(chart, Graha.CHEVVAI);
  return expectedKuja(chart).raw && !expectedKuja(chart).present;
});
assert.ok(cancelledKuja, 'The sample must contain a Kuja Dosha Nivrutti case');
assert.match(cancelledKuja.chart.doshas[0].severityEn, /nivrutti|relieved/i);
assert.ok(cancelledKuja.chart.doshas[0].traditionalRemedyEn.trim().length > 0,
  'A Kuja indicator relieved by Dosha Nivrutti still documents the traditional remedy');

const kalaSarpaCase = charts.find(({ chart }) => chart.doshas[1].isPresent);
assert.ok(kalaSarpaCase, 'The sample must contain a Kala Sarpa chart');
assert.match(kalaSarpaCase.chart.doshas[1].descriptionEn, /semicircle/);

const guruChandalaCase = charts.find(({ chart }) => chart.doshas[3].isPresent);
assert.ok(guruChandalaCase, 'The sample must contain a Guru Chandala chart');
assert.equal(find(guruChandalaCase.chart, Graha.GURU).rasi,
  find(guruChandalaCase.chart, Graha.RAHU).rasi === find(guruChandalaCase.chart, Graha.GURU).rasi
    ? find(guruChandalaCase.chart, Graha.RAHU).rasi
    : find(guruChandalaCase.chart, Graha.KETU).rasi,
  'Guru Chandala requires Jupiter to share a sign with a node');
console.log('  [PASS] Targeted edge cases: Mars in Lagna (not a Kuja house), Dosha Nivrutti relief, Kala Sarpa, Guru Chandala');

// The Kuja house set is a documented policy, not an implementation detail: the
// South Indian rule is the default and ASTRO_KUJA_HOUSES is the only override.
assert.deepEqual([...KUJA_DEFAULT_HOUSES], [2, 4, 7, 8, 12],
  'KUJA_DEFAULT_HOUSES must be the South Indian rule');
delete process.env.ASTRO_KUJA_HOUSES;
assert.deepEqual([...activeKujaHouses()], [2, 4, 7, 8, 12],
  'Without ASTRO_KUJA_HOUSES the engine must use the South Indian five-house rule');
process.env.ASTRO_KUJA_HOUSES = '1,2,4,7,8,12';
assert.deepEqual([...activeKujaHouses()], [1, 2, 4, 7, 8, 12],
  'ASTRO_KUJA_HOUSES=1,2,4,7,8,12 must restore the North Indian / BPHS reading');
process.env.ASTRO_KUJA_HOUSES = 'not-a-list';
assert.deepEqual([...activeKujaHouses()], [2, 4, 7, 8, 12],
  'An unparseable ASTRO_KUJA_HOUSES must fall back to the documented default');
process.env.ASTRO_KUJA_HOUSES = '2,2,4,7,8,12';
assert.deepEqual([...activeKujaHouses()], [2, 4, 7, 8, 12],
  'ASTRO_KUJA_HOUSES must be de-duplicated and sorted');
delete process.env.ASTRO_KUJA_HOUSES;
console.log('  [PASS] Kuja house policy: South Indian default (2,4,7,8,12) with ASTRO_KUJA_HOUSES override');

console.log('Dosha rule accuracy (Kuja, Kala Sarpa, Pitru, Guru Chandala, Navagraha screening) passed.');
