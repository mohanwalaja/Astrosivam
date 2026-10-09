/**
 * Builds tests/fixtures/node-php-parity-corpus.json — the fixed corpus the
 * Node↔PHP parity test runs on.
 *
 * The corpus is deterministic (no randomness, no clock) so a re-run reproduces
 * byte-identical JSON and every failure is reproducible:
 *
 *   doctrine   hand-written Sevvay/Kuja cases with their expected verdict.
 *              These expectations come from the PHP-side rule table
 *              (tests/wedding-matching-report.test.php), so they are an
 *              independent check on the Node port rather than a recording of it.
 *   sweep      every (Mars sign × Lagna sign) pair crossed with three
 *              deterministic Moon/Venus/Jupiter/Saturn/Rahu/Ketu layouts, so
 *              every house count from all three references and every exception
 *              and mitigation branch is exercised.
 *   births     real birth data (date, time, place) for ayanamsa / Lagna /
 *              nakshatra / pada parity. Each time is nudged (deterministically,
 *              over a fixed list of minute offsets) until every compared body
 *              sits comfortably away from a sign, nakshatra or pada boundary, so
 *              that the arcsecond-level difference between the two ephemerides
 *              can never flip an integer result. The margins that were achieved
 *              are recorded next to each chart.
 *
 * Usage: npx tsx scripts/build-parity-corpus.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const wrap12 = value => ((((value - 1) % 12) + 12) % 12) + 1;
const opposite = rasi => wrap12(rasi + 6);

// ---------------------------------------------------------------------------
// 1. Doctrine cases — expectations written from the PHP rule table.
//    `expect.codes` lists the exception/mitigation codes that must appear.
// ---------------------------------------------------------------------------
const doctrine = [
  ['Mars outside the Kuja houses from all three references is clean',
    { mars: 3, lagna: 1, moon: 1, venus: 1, jupiter: 6 }, 'DOSHA_NONE', []],
  ['Mars in Mithunam in the 7th from Lagna and Moon without any exception is an active dosha',
    { mars: 3, lagna: 9, moon: 9, venus: 12, jupiter: 6 }, 'DOSHA_PRESENT', []],
  ['Mars in its own sign Mesham cancels the dosha',
    { mars: 1, lagna: 7, moon: 7, venus: 7, jupiter: 6 }, 'DOSHA_CANCELLED', ['OWN_SIGN']],
  ['Mars in its own sign Viruchigam cancels the dosha',
    { mars: 8, lagna: 2, moon: 2, venus: 2, jupiter: 6 }, 'DOSHA_CANCELLED', ['OWN_SIGN']],
  ['Exalted Mars in Magaram cancels the dosha',
    { mars: 10, lagna: 3, moon: 3, venus: 3, jupiter: 2 }, 'DOSHA_CANCELLED', ['EXALTED']],
  ['Mars in Simham is exempt in every dosha house',
    { mars: 5, lagna: 2, moon: 2, venus: 2, jupiter: 12 }, 'DOSHA_CANCELLED', ['LEO_AQUARIUS']],
  ['Mars in Kumbham is exempt in every dosha house',
    { mars: 11, lagna: 4, moon: 4, venus: 4, jupiter: 9 }, 'DOSHA_CANCELLED', ['LEO_AQUARIUS']],
  ['Mars in Mithunam in the 2nd house is a classical house-sign exception (Tamil list)',
    { mars: 3, lagna: 2, moon: 2, venus: 2, jupiter: 8 }, 'DOSHA_CANCELLED', ['HOUSE_SIGN']],
  ['Mars in Kadagam in the 2nd house is NOT a house-sign exception (Tamil lists name Mithunam/Kanni only)',
    { mars: 4, lagna: 3, moon: 3, venus: 3, jupiter: 2 }, 'DOSHA_PRESENT', []],
  ['Mars in Dhanusu in the 8th house is a classical house-sign exception',
    { mars: 9, lagna: 2, moon: 2, venus: 2, jupiter: 4 }, 'DOSHA_CANCELLED', ['HOUSE_SIGN']],
  ['Jupiter conjunct Mars (Guru-Mangala Yoga) cancels the dosha',
    { mars: 3, lagna: 9, moon: 9, venus: 9, jupiter: 3 }, 'DOSHA_CANCELLED', ['GURU_MANGALA']],
  ['Moon conjunct Mars (Chandra-Mangala Yoga) cancels the dosha',
    { mars: 3, lagna: 9, moon: 3, venus: 9, jupiter: 6 }, 'DOSHA_CANCELLED', ['CHANDRA_MANGALA']],
  ['Jupiter aspecting Mars (9th aspect) cancels the dosha',
    { mars: 3, lagna: 9, moon: 9, venus: 9, jupiter: 7 }, 'DOSHA_CANCELLED', ['GURU_DRISHTI']],
  ['Mars as Yogakaraka for a Simha Lagna does not create the dosha',
    { mars: 12, lagna: 5, moon: 1, venus: 1, jupiter: 2 }, 'DOSHA_CANCELLED', ['YOGAKARAKA_LAGNA']],
  ['Mars as Yogakaraka for a Kadagam Lagna does not create the dosha',
    { mars: 7, lagna: 4, moon: 1, venus: 2, jupiter: 12 }, 'DOSHA_CANCELLED', ['YOGAKARAKA_LAGNA']],
  ['Dosha only from Venus is reported as mild',
    { mars: 3, lagna: 1, moon: 1, venus: 9, jupiter: 6 }, 'DOSHA_MILD', ['NOT_FROM_LAGNA']],
  ['Saturn in a Kuja house reduces the dosha to mild',
    { mars: 3, lagna: 9, moon: 9, venus: 12, jupiter: 6, saturn: 10 }, 'DOSHA_MILD', ['SATURN_NODE_BALANCE']],
  ['A house-sign exception from the Lagna leaves only the Moon count, which is mild',
    { mars: 4, lagna: 10, moon: 9, venus: 8, jupiter: 1 }, 'DOSHA_MILD', ['NOT_FROM_LAGNA']],
  ['Mars in the 1st house (with the Lagna) is NOT a Kuja house under the South Indian five-house rule',
    { mars: 3, lagna: 3, moon: 1, venus: 1, jupiter: 2 }, 'DOSHA_NONE', []],
  ['Mars in the 12th from the Moon only is a dosha the old Lagna-only rule missed',
    { mars: 3, lagna: 1, moon: 4, venus: 7, jupiter: 2 }, 'DOSHA_MILD', ['NOT_FROM_LAGNA']],
  ['Mars in the 8th from Venus only is a dosha the old Lagna-only rule missed',
    { mars: 7, lagna: 5, moon: 2, venus: 12, jupiter: 5 }, 'DOSHA_MILD', ['NOT_FROM_LAGNA']],
  ['Missing Venus keeps the Kuja assessment N/A instead of a false clean result',
    { mars: 3, lagna: 9, moon: 9, jupiter: 6 }, 'NOT_ASSESSED', []],
  ['Missing Mars keeps the Kuja assessment N/A instead of a false clean result',
    { lagna: 9, moon: 9, venus: 9, jupiter: 6 }, 'NOT_ASSESSED', []]
];

const kujaCharts = doctrine.map(([note, placements, status, codes], index) => ({
  id: `doctrine-${String(index + 1).padStart(2, '0')}`,
  kind: 'doctrine',
  note,
  placements: {
    mars: placements.mars ?? null,
    lagna: placements.lagna ?? null,
    moon: placements.moon ?? null,
    venus: placements.venus ?? null,
    jupiter: placements.jupiter ?? null,
    saturn: placements.saturn ?? null,
    rahu: placements.rahu ?? null,
    ketu: placements.ketu ?? null
  },
  expect: { status, codes }
}));

// ---------------------------------------------------------------------------
// 2. Sweep: every (Mars sign × Lagna sign) pair, three reference layouts.
// ---------------------------------------------------------------------------
// Every layout keeps Jupiter off Mars (no Guru-Mangala, no 5th/7th/9th aspect)
// so the sweep isolates the house-count and mitigation branches.
const layouts = [
  // 0. Moon and Venus both in non-dosha houses, Saturn and the nodes outside
  //    the Lagna's Kuja houses: the verdict is decided by the Lagna count
  //    alone -> DOSHA_PRESENT or DOSHA_NONE.
  (mars, lagna) => ({
    moon: wrap12(mars + 2),   // house 11 from the Moon
    venus: wrap12(mars + 8),  // house 5 from Venus
    jupiter: wrap12(mars + 3),
    saturn: wrap12(lagna + 2),
    rahu: wrap12(lagna + 2),
    ketu: wrap12(lagna + 8)
  }),
  // 1. Saturn in the 12th and Rahu in the 4th from the Lagna, both Kuja houses
  //    -> the SATURN_NODE_BALANCE mitigation on an otherwise Lagna-only dosha.
  (mars, lagna) => ({
    moon: wrap12(mars + 8),   // house 5
    venus: wrap12(mars + 10), // house 3
    jupiter: wrap12(mars + 3),
    saturn: wrap12(lagna + 11),
    rahu: wrap12(lagna + 3),
    ketu: wrap12(lagna + 9)
  }),
  // 2. Moon in the 2nd and Venus in the 8th from Mars, so both are always
  //    afflicted: DOSHA_PRESENT when the Lagna count is also a Kuja house and
  //    a mild NOT_FROM_LAGNA otherwise. Mars in Kadagam / Dhanusu / Meenam
  //    neutralises one of those two counts, which exercises HOUSE_SIGN_PARTIAL
  //    and, when the Lagna count is covered too, the full HOUSE_SIGN exception.
  (mars, lagna) => ({
    moon: wrap12(mars + 11),  // house 2
    venus: wrap12(mars + 5),  // house 8
    jupiter: wrap12(mars + 1),
    saturn: wrap12(lagna + 5),
    rahu: wrap12(lagna + 2),
    ketu: wrap12(lagna + 8)
  })
];

for (let mars = 1; mars <= 12; mars += 1) {
  for (let lagna = 1; lagna <= 12; lagna += 1) {
    layouts.forEach((layout, index) => {
      kujaCharts.push({
        id: `sweep-${String(mars).padStart(2, '0')}${String(lagna).padStart(2, '0')}-${index}`,
        kind: 'sweep',
        note: `Mars in sign ${mars}, Lagna in sign ${lagna}, reference layout ${index + 1}`,
        placements: { mars, lagna, ...layout(mars, lagna) }
      });
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Birth charts for ayanamsa / Lagna / nakshatra parity.
// ---------------------------------------------------------------------------
const births = [
  { place: 'Chennai, Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707, offset: 5.5 },
  { place: 'Suva, Fiji', latitude: -18.1248, longitude: 178.4501, offset: 12 },
  { place: 'London, United Kingdom', latitude: 51.5074, longitude: -0.1278, offset: 0 },
  { place: 'New York, United States', latitude: 40.7128, longitude: -74.006, offset: -5 },
  { place: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, offset: 10 },
  { place: 'Nairobi, Kenya', latitude: -1.2921, longitude: 36.8219, offset: 3 }
];
// Every moment is in the past (the engines reject future births). Chart-level
// parity is deliberately limited to 1970 onward: both engines resolve the birth
// instant through the IANA zone for the coordinates, and pre-1970 historical
// offsets (LMT, colonial standard times) are where their tzdata is most likely
// to disagree. The full historical range is covered by `ayanamsaDays` below,
// which needs no timezone at all.
const birthMoments = [
  '1975-09-09 21:10', '1985-02-28 16:40', '1992-08-14 06:30', '2000-01-01 12:00',
  '2007-09-09 21:10', '2015-02-28 16:40', '2020-07-19 10:05', '2026-01-12 14:25'
];

/**
 * Distance in degrees from `longitude` to the nearest multiple of `step`
 * (30 for a sign, 13°20′ for a nakshatra, 3°20′ for a pada).
 */
const marginTo = (longitude: number, step: number): number => {
  const offset = ((longitude % step) + step) % step;
  return Math.min(offset, step - offset);
};

const MIN_MARGINS = {
  lagna: 0.5,      // sign boundary (the Lagna moves ~15°/hour)
  moonRasi: 0.5,   // sign boundary
  moonNakshatra: 0.2,
  moonPada: 0.1,
  marsRasi: 0.2
};

/**
 * Boundary margins of every value the parity test compares as an integer.
 * The Moon is the least accurate body in both engines (tens of arcseconds), so
 * its nakshatra and pada margins are what the nudging below has to protect.
 */
function marginsOf(chart: { dob: string; tob: string; birthPlace: string; latitude: number; longitude: number; timezoneOffsetHours: number }) {
  const horoscope = calculatePrecisionHoroscope(
    'Parity Sample', chart.dob, chart.tob, chart.birthPlace,
    chart.latitude, chart.longitude, chart.timezoneOffsetHours, '', 'M'
  );
  const body = (graha: string) => {
    const position = horoscope.planetPositions.find(entry => entry.graha === graha);
    if (!position) throw new Error(`${graha} missing from the parity horoscope`);
    return position.totalDegrees;
  };
  const moon = body('moon');
  return {
    lagna: marginTo(horoscope.lagnaDegrees + (horoscope.lagnaRasi - 1) * 30, 30),
    moonRasi: marginTo(moon, 30),
    moonNakshatra: marginTo(moon, 40 / 3),
    moonPada: marginTo(moon, 10 / 3),
    marsRasi: marginTo(body('mars'), 30)
  };
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;
const minutesOf = (tob: string) => {
  const [hours, minutes] = tob.split(':').map(Number);
  return hours * 60 + minutes;
};
const timeOf = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};
// Offsets spanning a little over one pada cycle of lunar motion (3°20′ ≈ 6h).
const NUDGE_MINUTES = [0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 204, 221, 238, 255, 272, 289, 306, 323, 340, 357];

const birthCharts = births.flatMap((place, placeIndex) =>
  birthMoments.map((moment, momentIndex) => {
    const [dob, tob] = moment.split(' ');
    const base = {
      id: `birth-${String(placeIndex + 1).padStart(2, '0')}${String(momentIndex + 1).padStart(2, '0')}`,
      devoteeName: 'Parity Sample',
      dob,
      tob,
      birthPlace: place.place,
      country: '',
      latitude: place.latitude,
      longitude: place.longitude,
      timezoneOffsetHours: place.offset
    };

    // Nudge the clock until every compared value clears its boundary margin.
    let chosen = base;
    let margins = marginsOf(base);
    const shortfall = () =>
      Object.entries(MIN_MARGINS).filter(([key, minimum]) => margins[key as keyof typeof MIN_MARGINS] < minimum);
    for (const nudge of NUDGE_MINUTES) {
      if (shortfall().length === 0) break;
      const candidate = { ...base, tob: timeOf(minutesOf(base.tob) + nudge) };
      const candidateMargins = marginsOf(candidate);
      if (
        Object.entries(MIN_MARGINS).every(
          ([key, minimum]) => candidateMargins[key as keyof typeof MIN_MARGINS] >= minimum
        )
      ) {
        chosen = candidate;
        margins = candidateMargins;
      }
    }
    const remaining = shortfall();
    if (remaining.length > 0) {
      throw new Error(
        `Could not nudge ${base.id} (${base.dob} ${base.tob} ${base.birthPlace}) clear of a boundary: ` +
          remaining.map(([key, minimum]) => `${key} needs ${minimum}°`).join(', ')
      );
    }

    return { ...chosen, margins: Object.fromEntries(Object.entries(margins).map(([key, value]) => [key, round4(value)])) };
  })
);

/**
 * Julian Day number for a Gregorian calendar date at 12:00 UT (the JDN *is* the
 * Julian Day at 12:00 UT), computed with the standard formula so the corpus
 * carries plain numbers and needs no date library.
 */
const julianDayNoon = (year: number, month: number, day: number): number => {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
};

// Ayanamsa parity: a pure astronomy comparison (no timezone, no house system)
// over the widest historical range the service supports, so the Δψ term is
// exercised across all of its ~18 arcsecond amplitude.
const ayanamsaDays = [];
for (let year = 1850; year <= 2100; year += 1) {
  for (const [month, day] of [[1, 1], [4, 15], [7, 15], [10, 15]] as Array<[number, number]>) {
    ayanamsaDays.push({
      id: `ayanamsa-${year}-${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`,
      label: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 12:00 UT`,
      jd: julianDayNoon(year, month, day)
    });
  }
}

const corpus = {
  // v2: the Kuja house set is now the South Indian rule (2,4,7,8,12 — the 1st
  // house removed) in both engines, so every verdict had to be re-derived.
  version: 2,
  generatedBy: 'scripts/build-parity-corpus.ts',
  note:
    'Fixed Node↔PHP parity corpus. Deterministic: re-running the generator ' +
    'reproduces this file byte for byte. Doctrine cases carry hand-written ' +
    'expectations taken from the PHP rule table (Kuja houses 2,4,7,8,12 from ' +
    'the Lagna, Moon and Venus); the sweep and birth charts are ' +
    'compared against tests/fixtures/node-php-parity-expected.json, which both ' +
    'stacks must reproduce. Each birth chart records the boundary margins its ' +
    'chosen time was nudged to achieve.',
  kujaCharts,
  birthCharts,
  ayanamsaDays
};

writeFileSync(
  path.join(root, 'tests', 'fixtures', 'node-php-parity-corpus.json'),
  `${JSON.stringify(corpus, null, 2)}\n`,
  'utf8'
);

console.log(
  `Wrote ${kujaCharts.length} Kuja charts (${doctrine.length} doctrine + ${kujaCharts.length - doctrine.length} sweep), ` +
    `${birthCharts.length} birth charts and ${ayanamsaDays.length} ayanamsa instants ` +
    'to tests/fixtures/node-php-parity-corpus.json'
);
