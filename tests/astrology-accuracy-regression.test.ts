import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import {
  calculateAllGrahaPositions,
  calculateLahiriAyanamsa,
  calculatePrecisionHoroscope,
  calculateSiderealAscendant,
  calculateVimshottariDashaTimeline,
  julianCenturiesTT,
  lahiriAyanamsaMean,
  normalizeDelta,
  RASI_INFO
} from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { Graha, PoruthamStatus, Rasi } from '../server/astrology/types.js';

/**
 * Sidereal geocentric reference longitudes generated with Swiss Ephemeris
 * 2.10.03: set_sid_mode(SIDM_LAHIRI), then calc_ut(JD, body,
 * FLG_SWIEPH | FLG_SIDEREAL | FLG_SPEED). The test intentionally keeps the
 * independent reference values in source; Swiss Ephemeris is not a runtime
 * dependency of this application.
 */
const EPHEMERIS_REFERENCES: Array<{
  utc: string;
  siderealDegrees: Record<Graha, number>;
  retrograde: Graha[];
}> = [
  {
    utc: '2000-01-01T12:00:00Z',
    siderealDegrees: {
      [Graha.SURYA]: 256.515697189,
      [Graha.CHANDRA]: 199.470552952,
      [Graha.CHEVVAI]: 304.110090832,
      [Graha.BUDHA]: 248.036052521,
      [Graha.GURU]: 1.399807823,
      [Graha.SUKRA]: 217.712575840,
      [Graha.SANI]: 16.542416470,
      [Graha.RAHU]: 100.099672927,
      [Graha.KETU]: 280.099672927
    },
    retrograde: [Graha.SANI]
  },
  {
    utc: '2024-04-08T18:00:00Z',
    siderealDegrees: {
      [Graha.SURYA]: 355.191568554,
      [Graha.CHANDRA]: 354.988034509,
      [Graha.CHEVVAI]: 318.845531891,
      [Graha.BUDHA]: 0.612454147,
      [Graha.GURU]: 24.847957913,
      [Graha.SUKRA]: 340.232576228,
      [Graha.SANI]: 320.259081606,
      [Graha.RAHU]: 351.431376048,
      [Graha.KETU]: 171.431376048
    },
    retrograde: [Graha.BUDHA]
  },
  {
    utc: '2050-01-01T00:00:00Z',
    siderealDegrees: {
      [Graha.SURYA]: 256.188620871,
      [Graha.CHANDRA]: 354.116699116,
      [Graha.CHEVVAI]: 203.154912978,
      [Graha.BUDHA]: 245.499600036,
      [Graha.GURU]: 97.131676156,
      [Graha.SUKRA]: 256.688301656,
      [Graha.SANI]: 273.014477421,
      [Graha.RAHU]: 214.939271678,
      [Graha.KETU]: 34.939271678
    },
    retrograde: [Graha.BUDHA, Graha.GURU]
  }
];

const angularDifference = (actual: number, expected: number) => Math.abs(normalizeDelta(actual - expected));

for (const reference of EPHEMERIS_REFERENCES) {
  const time = Astronomy.MakeTime(new Date(reference.utc));
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);
  // The committed Swiss Ephemeris table above was generated with
  // SE_TRUE_NODE, so the TRUE convention is requested explicitly: the chart
  // default is MEAN (ASTRO_RAHU_NODE_TYPE), and the MEAN node is verified
  // separately below against a SE_MEAN_NODE reference. Both conventions are
  // still checked against the independent ephemeris.
  const calculated = calculateAllGrahaPositions(time, jd, ayanamsa, 'TRUE');

  for (const graha of Object.values(Graha)) {
    assert.ok(
      angularDifference(calculated.siderealLongitudes[graha], reference.siderealDegrees[graha]) <= 0.02,
      `${reference.utc} ${graha} should agree with Swiss Ephemeris within 0.02°; got ` +
        `${calculated.siderealLongitudes[graha]}° vs ${reference.siderealDegrees[graha]}°`
    );
  }

  const retrogradeSet = Object.values(Graha).filter(graha =>
    ![Graha.SURYA, Graha.CHANDRA, Graha.RAHU, Graha.KETU].includes(graha) && calculated.retrogrades[graha]
  );
  assert.deepEqual(
    retrogradeSet.sort(),
    [...reference.retrograde].sort(),
    `${reference.utc} retrograde flags should agree with the reference ephemeris`
  );
  assert.ok(
    angularDifference(
      normalizeDelta(calculated.siderealLongitudes[Graha.KETU] - calculated.siderealLongitudes[Graha.RAHU]),
      180
    ) < 1e-10,
    `${reference.utc} Ketu must remain exactly opposite Rahu`
  );
}

/**
 * Rahu/Ketu convention (item 5). The engine default is the MEAN node, the
 * classical convention (B. V. Raman, "Hindu Predictive Astrology": "for all
 * practical purposes of horoscopy, the Mean Node should be used"), and the
 * report states which node produced the chart. The seven classical grahas must
 * be byte-identical whichever node convention is selected — only Rahu/Ketu may
 * move, and only within the known ±1.5° true-minus-mean oscillation.
 */
const meanNodeSample = Astronomy.MakeTime(new Date('2024-04-08T18:00:00Z'));
const meanNodeJd = meanNodeSample.ut + 2451545.0;
const meanNodeAyanamsa = calculateLahiriAyanamsa(meanNodeJd);
const trueNodeChart = calculateAllGrahaPositions(meanNodeSample, meanNodeJd, meanNodeAyanamsa, 'TRUE');
const meanNodeChart = calculateAllGrahaPositions(meanNodeSample, meanNodeJd, meanNodeAyanamsa, 'MEAN');
// Swiss Ephemeris 2.10.03, set_sid_mode(SIDM_LAHIRI): SE_MEAN_NODE 351.453090361.
assert.ok(
  angularDifference(meanNodeChart.siderealLongitudes[Graha.RAHU], 351.453090361) <= 0.001,
  'MEAN Rahu should match the Swiss Ephemeris SE_MEAN_NODE reference within 0.001°; got ' +
    `${meanNodeChart.siderealLongitudes[Graha.RAHU]}°`
);
for (const graha of [Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.BUDHA, Graha.GURU, Graha.SUKRA, Graha.SANI]) {
  assert.equal(
    meanNodeChart.siderealLongitudes[graha],
    trueNodeChart.siderealLongitudes[graha],
    `${graha} longitude must not depend on the Rahu/Ketu node convention`
  );
}
const trueMinusMeanRahu = Math.abs(normalizeDelta(trueNodeChart.siderealLongitudes[Graha.RAHU] - meanNodeChart.siderealLongitudes[Graha.RAHU]));
assert.ok(
  trueMinusMeanRahu > 0 && trueMinusMeanRahu <= 1.55,
  `TRUE and MEAN Rahu should differ by the known oscillation (0, 1.55°]; got ${trueMinusMeanRahu}°`
);
assert.ok(
  angularDifference(
    normalizeDelta(meanNodeChart.siderealLongitudes[Graha.KETU] - meanNodeChart.siderealLongitudes[Graha.RAHU]),
    180
  ) < 1e-10,
  'Ketu must remain exactly opposite the selected Rahu'
);

const j2000 = Astronomy.MakeTime(new Date('2000-01-01T12:00:00Z'));
const j2000Jd = j2000.ut + 2451545.0;
// TRUE Lahiri ayanamsa = mean + Δψ, the convention the PHP engine and Drik
// Panchang use. The MEAN value is asserted separately below so a future change
// cannot quietly swap conventions: the two differ by up to 18.44 arcsec, which
// moves every sidereal longitude and the Lagna.
assert.ok(Math.abs(calculateLahiriAyanamsa(j2000Jd) - 23.8532225) < 0.0001,
  'J2000 Chitra Paksha/Lahiri TRUE ayanamsa should match the Swiss Ephemeris reference');
assert.ok(Math.abs(lahiriAyanamsaMean(julianCenturiesTT(j2000Jd)) - 23.8570923537) < 0.00001,
  'J2000 Chitra Paksha/Lahiri MEAN ayanamsa should match the Swiss Ephemeris reference');
const greenwichAscendant = calculateSiderealAscendant(
  j2000,
  51.4779,
  -0.0015,
  calculateLahiriAyanamsa(j2000Jd)
);
assert.ok(angularDifference(greenwichAscendant.lagnaSidereal, 0.409689230) < 0.01,
  'J2000 Greenwich sidereal Ascendant should match the Swiss Ephemeris Lahiri reference');
assert.throws(() => calculateAllGrahaPositions(j2000, Number.NaN, calculateLahiriAyanamsa(j2000Jd)),
  /finite Julian Date/i, 'A bad Julian Date must not silently become an invented node position');

// Vimshottari interval boundaries are half-open: the next lord owns the exact
// instant at the previous period's end.
const birth = new Date('2000-01-01T00:00:00Z');
const nakshatraSpan = 360 / 27;
const dashaAtBirth = calculateVimshottariDashaTimeline(0, 0, nakshatraSpan, birth, birth, 'UTC');
assert.equal(dashaAtBirth.periods.length, 9, 'The birth-start timeline contains the nine sequential Mahadashas');
assert.ok(dashaAtBirth.periods.every(period => period.antardashas?.length === 9),
  'Each displayed Mahadasha contains its nine Antardashas');
assert.equal(dashaAtBirth.periods[0].mahadashaLord, Graha.KETU);
assert.equal(dashaAtBirth.periods[0].startDate, '2000-01-01');
assert.equal(dashaAtBirth.currentDasha.mahadashaLord, Graha.KETU);
assert.equal(dashaAtBirth.currentDasha.antardashaLord, Graha.KETU);

const firstAntardashaDays = Math.round((7 * 7 / 120) * 365.25);
const firstAntardashaBoundary = new Date(birth.getTime() + firstAntardashaDays * 86400000);
const dashaAtAntardashaBoundary = calculateVimshottariDashaTimeline(
  0, 0, nakshatraSpan, birth, firstAntardashaBoundary, 'UTC'
);
assert.equal(dashaAtAntardashaBoundary.currentDasha.mahadashaLord, Graha.KETU);
assert.equal(dashaAtAntardashaBoundary.currentDasha.antardashaLord, Graha.SUKRA,
  'At the exact Ketu/Ketu end, the next Antardasha is active');

const firstMahadashaDays = Math.round(7 * 365.25);
const firstMahadashaBoundary = new Date(birth.getTime() + firstMahadashaDays * 86400000);
const dashaAtMahadashaBoundary = calculateVimshottariDashaTimeline(
  0, 0, nakshatraSpan, birth, firstMahadashaBoundary, 'UTC'
);
assert.equal(dashaAtMahadashaBoundary.currentDasha.mahadashaLord, Graha.SUKRA,
  'At the exact end of the birth balance, the next Mahadasha is active');
assert.equal(dashaAtMahadashaBoundary.currentDasha.antardashaLord, Graha.SUKRA);

// These dates produce Ashwini/Jyeshtha, a symmetric Vedha pair with a score
// above the ordinary pass threshold. A critical Vedha mismatch must still
// block a positive overall verdict.
const chennaiBirth = (name: string, dob: string) => ({
  name,
  dob,
  tob: '12:00',
  birthPlace: 'Chennai, Tamil Nadu, India',
  country: 'India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5
});
const vedhaMatch = calculateWeddingCompatibility(
  chennaiBirth('Bride', '1990-01-05'),
  chennaiBirth('Groom', '1990-01-23')
);
assert.equal(vedhaMatch.brideNakshatraNameEn, 'Ashwini');
assert.equal(vedhaMatch.groomNakshatraNameEn, 'Jyeshtha');
assert.ok(vedhaMatch.totalScore >= 5, 'The Vedha fixture should exceed the numeric moderate-score threshold');
assert.equal(vedhaMatch.maxScore, 10);
assert.equal(vedhaMatch.poruthams.reduce((sum, p) => sum + p.maxPoints, 0), vedhaMatch.maxScore,
  'TypeScript score denominator must equal the ten displayed unit-weight Poruthams');
assert.equal(vedhaMatch.poruthams.reduce((sum, p) => sum + p.pointsEarned, 0), vedhaMatch.totalScore,
  'TypeScript total score must equal the points displayed in the Porutham rows');
assert.equal(vedhaMatch.poruthams.find(p => p.id === 'vedhai')?.status, PoruthamStatus.PORUNDHADHU);
assert.equal(vedhaMatch.vedhaMatch, false);
assert.equal(vedhaMatch.verdictStatus, PoruthamStatus.PORUNDHADHU,
  'A crucial Vedha failure must not be overridden by an otherwise passing score');
assert.match(vedhaMatch.overallVerdictEn, /Vedha/i);

assert.equal(RASI_INFO[Rasi.SIMHAM].nameEn, 'Simham (Leo)');
assert.equal(RASI_INFO[Rasi.MAGARAM].nameEn, 'Magaram (Capricorn)');

console.log('Astrology accuracy, dasha-boundary, Porutham, and Rasi-name regressions passed.');
