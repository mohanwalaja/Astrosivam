import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RasiChartSvg } from '../src/components/common/RasiChartSvg.js';
import { buildJathagamHtml, buildJathagamLifeCards, RASI_NAMES_REPORT } from '../src/services/jathagamHtmlBuilder.js';
import { buildWeddingMatchHtml } from '../src/services/weddingHtmlBuilder.js';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder.js';
import { VedicNamingCertificate } from '../src/components/common/VedicNamingCertificate.js';
import { getGunam } from '../src/services/gunamData.js';
import { calculatePrecisionHoroscope, RASI_INFO } from '../src/lib/astrology/astronomy.js';
import { ALL_NAKSHATRA_LETTERS, calculateBabyNamingDetails } from '../src/lib/astrology/babynames.js';
import { calculateWeddingCompatibility } from '../src/lib/astrology/matchmaking.js';
import { Graha, HoroscopeResult, Rasi, WeddingMatchResult } from '../src/lib/astrology/types.js';

const validBirth = {
  name: 'Integrity Test',
  dob: '1990-01-05',
  tob: '12:00',
  birthPlace: 'Chennai, Tamil Nadu, India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5,
  country: 'India',
  gender: 'F'
};
const completeChart = calculatePrecisionHoroscope(
  validBirth.name,
  validBirth.dob,
  validBirth.tob,
  validBirth.birthPlace,
  validBirth.latitude,
  validBirth.longitude,
  validBirth.timezoneOffsetHours,
  validBirth.country,
  validBirth.gender
);

// Each 3°20′ Pada exactly occupies one Navamsa-sized segment of a 30° Rasi.
// This verifies that deriving the Moon sign from a verified birth Pada is an
// actual mapping, not a default-sign fallback.
for (const nakshatra of ALL_NAKSHATRA_LETTERS) {
  for (const pada of nakshatra.padas) {
    const expectedRasi = Math.floor(((nakshatra.nakshatraIndex - 1) * 800 + (pada.padaNumber - 1) * 200) / 1800) + 1;
    assert.equal(pada.rasi, expectedRasi,
      `${nakshatra.nakshatraNameEn} Pada ${pada.padaNumber} must map to its actual sidereal Rasi segment`);
    assert.equal(pada.rasiEn, RASI_INFO[pada.rasi].nameEn,
      `${nakshatra.nakshatraNameEn} Pada ${pada.padaNumber} sign label must match its numeric Rasi`);
  }
}
assert.deepEqual(getGunam('', 'N/A', 'en'), [], 'Unknown Gunam inputs must not fall back to Meenam traits');
assert.deepEqual(getGunam('', '', 'en'), [], 'Completely absent Gunam inputs must return no fabricated sign traits');

const babyNamingResult = calculateBabyNamingDetails(
  validBirth.name, validBirth.dob, validBirth.tob, validBirth.birthPlace, 'F',
  validBirth.latitude, validBirth.longitude, validBirth.timezoneOffsetHours, validBirth.country
);
const ashvini = ALL_NAKSHATRA_LETTERS.find(nakshatra => nakshatra.nakshatraIndex === 1)!;
const staleBabySigns = buildBabyNamingHtml({
  ...babyNamingResult,
  janmaPada: 1,
  nakshatraLetters: ashvini,
  primaryPadaInfo: ashvini.padas[0],
  chandraRasi: 13 as any,
  chandraRasiNameEn: 'Magaram (Capricorn)',
  lagnaRasi: 0 as any,
  lagnaRasiNameEn: 'Meenam (Pisces)'
} as any, 'en');
assert.match(staleBabySigns, /Mesham \(Aries\)/,
  'A valid Ashwini Pada sign may be derived from its verified Nakshatra-Pada mapping');
assert.match(staleBabySigns, /Lagna \(Ascendant\)<\/span>\s*<span class="value">N\/A<\/span>/,
  'An invalid Ascendant number must not be replaced by a stale localized label');
assert.doesNotMatch(staleBabySigns, /Magaram|Meenam/,
  'Invalid numeric Moon/Lagna signs must not let stale sign labels create chart data');

const missingCertificateMarkup = renderToStaticMarkup(React.createElement(VedicNamingCertificate, {
  data: { babyName: 'Baby', gender: 'M', janmaPada: 0, chandraRasiNameEn: '', lagnaRasiNameEn: '' },
  initialLang: 'en'
}));
assert.match(missingCertificateMarkup, />N\/A</,
  'An explicitly incomplete naming certificate displays unavailable chart data as N/A');
assert.doesNotMatch(missingCertificateMarkup, /Meenam|Uthirattathi|>4<|>Mars</,
  'The certificate component does not borrow its demo Moon sign, Nakshatra, Pada, or lord for an incomplete result');

const missingPlacements = {
  ...completeChart,
  lagnaRasi: 0,
  lagnaRasiNumber: 0,
  lagnaRasiNameEn: 'Mesham', // stale labels must not override an invalid sign number
  lagnaDegrees: Number.NaN,
  chandraRasi: 13,
  chandraRasiNameEn: 'Magaram', // stale labels must not create a Moon sign
  janmaPada: 0,
  currentDasha: undefined,
  dashaPeriods: [],
  doshas: [],
  planetPositions: completeChart.planetPositions.map(position => ({
    ...position,
    rasi: 0,
    rasiNumber: 0,
    bhavaNumber: position.graha === Graha.CHEVVAI ? 0 : position.bhavaNumber,
    degrees: Number.NaN
  }))
} as unknown as HoroscopeResult;

const lifeCards = buildJathagamLifeCards(missingPlacements, 'en');
assert.equal(lifeCards.length, 8);
for (const card of lifeCards.slice(0, 7)) {
  assert.match(card.badge, /N\/A/, `${card.title} must not infer a Lagna/house lord from an invalid sign`);
  assert.match(card.desc, /unavailable|N\/A/i, `${card.title} must suppress placement-derived copy when inputs are missing`);
  assert.doesNotMatch(card.desc, /House 1|House 10|in the 1st house/i,
    `${card.title} must not substitute a default house`);
}
assert.match(lifeCards[7].desc, /unavailable|N\/A/i, 'Current guidance must not invent a Dasha when no active Dasha is supplied');
assert.match(lifeCards[7].badge, /N\/A/, 'Unknown current-period assessment is not an optimistic default');

const htmlReport = buildJathagamHtml(missingPlacements, 'en');
assert.match(htmlReport, /Lagna<\/span><span class="value">N\/A \(N\/A\)<\/span>/);
assert.match(htmlReport, /Janma Rasi<\/span><span class="value">N\/A<\/span>/);
assert.doesNotMatch(htmlReport, /Current Dasa/, 'The current Dasha summary is omitted from page 1 even when unavailable');
assert.doesNotMatch(htmlReport, /class="planet-name is-lagna"/, 'No Lagna marker is rendered from an invalid Ascendant');
assert.doesNotMatch(htmlReport, /Rahu Mahadasa|House 1 \(.*Kuja/i,
  'Missing Dasha/Mars-house data must not become Rahu or House 1');
assert.match(htmlReport, /Required planetary placement is unavailable; N\/A\./);

const badPosition = {
  graha: Graha.SURYA,
  planetKey: 'sun',
  nameTa: 'சூரியன்', nameEn: 'Surya', nameHi: 'सूर्य',
  shortTa: 'சூ', shortEn: 'Su', shortHi: 'सू',
  rasi: 0, rasiNumber: 0,
  rasiNameTa: 'மேஷம்', rasiNameEn: 'Mesham', rasiNameHi: 'मेष',
  degrees: 0,
  totalDegrees: 0,
  nakshatramTa: '', nakshatramEn: '', nakshatramHi: '',
  pada: 1, isRetrograde: false, isCombust: false, bhavaNumber: 0
} as any;
const southChartMissing = renderToStaticMarkup(React.createElement(RasiChartSvg, {
  planets: [badPosition],
  lagnaRasiNumber: 0,
  defaultStyle: 'south',
  defaultDivision: 'rasi',
  allowToggleDivision: false,
  allowToggleStyle: false
}));
assert.match(southChartMissing, /Ascendant unavailable; no Lagna marker is shown\./);
assert.doesNotMatch(southChartMissing, />LAG<|>Su<|>0°/, 'Invalid sign/house fields do not place a planet or invent zero degrees');

const validPosition = { ...badPosition, rasi: Rasi.SIMHAM, rasiNumber: Rasi.SIMHAM, degrees: 12, bhavaNumber: 4 };
const southChartValid = renderToStaticMarkup(React.createElement(RasiChartSvg, {
  planets: [validPosition],
  lagnaRasiNumber: Rasi.SIMHAM,
  defaultStyle: 'south',
  defaultDivision: 'rasi',
  allowToggleDivision: false,
  allowToggleStyle: false
}));
assert.match(southChartValid, />Simham</);
assert.match(southChartValid, />LAG</);
assert.match(southChartValid, />Su</);

const navamsaWithoutAscendant = renderToStaticMarkup(React.createElement(RasiChartSvg, {
  planets: [{ ...validPosition, navamsaRasi: undefined }],
  lagnaRasiNumber: Rasi.SIMHAM,
  defaultStyle: 'north',
  defaultDivision: 'navamsa',
  allowToggleDivision: false,
  allowToggleStyle: false
}));
assert.match(navamsaWithoutAscendant, /valid Navamsa Ascendant is required/);
assert.match(navamsaWithoutAscendant, /Houses were not inferred/);
assert.doesNotMatch(navamsaWithoutAscendant, />LAG</, 'D1 Lagna must never be substituted into a missing D9 chart');

// Sign-number/name mappings stay aligned at the requested Simham and Magaram
// indices, including Tamil/Hindi glyphs and the official romanized names.
assert.equal(RASI_NAMES_REPORT[Rasi.SIMHAM].en, 'Simham');
assert.equal(RASI_NAMES_REPORT[Rasi.SIMHAM].ta, 'சிம்மம்');
assert.equal(RASI_NAMES_REPORT[Rasi.SIMHAM].hi, 'सिंह');
assert.equal(RASI_NAMES_REPORT[Rasi.MAGARAM].en, 'Magaram');
assert.equal(RASI_NAMES_REPORT[Rasi.MAGARAM].ta, 'மகரம்');
assert.equal(RASI_NAMES_REPORT[Rasi.MAGARAM].hi, 'मकर');
assert.equal(completeChart.lagnaRasiNumber, completeChart.lagnaRasi);
assert.equal(completeChart.planetPositions.find(p => p.graha === Graha.SURYA)?.rasiNumber,
  completeChart.planetPositions.find(p => p.graha === Graha.SURYA)?.rasi);

const compatibility = calculateWeddingCompatibility(
  { ...validBirth, dob: '1990-01-05', name: 'Bride' },
  { ...validBirth, dob: '1990-01-23', name: 'Groom' }
);
const incompleteWedding = {
  ...compatibility,
  brideRasi: Rasi.SIMHAM,
  brideRasiNameEn: 'Magaram', // renderer uses the numeric sign mapping, not stale text
  groomRasi: Rasi.MAGARAM,
  groomRasiNameEn: 'Simham',
  brideMarsHouse: null,
  groomMarsHouse: null,
  totalScore: undefined,
  maxScore: undefined,
  score: undefined,
  maxPossiblePoints: undefined,
  totalPoruthamsMatched: undefined,
  poruthams: [],
  sevvayDosham: {
    ...compatibility.sevvayDosham,
    brideDoshamSeverityEn: 'N/A',
    groomDoshamSeverityEn: 'N/A',
    brideMarsHouses: { lagna: null, moon: null, venus: null },
    groomMarsHouses: { lagna: null, moon: null, venus: null },
    brideAfflictedFrom: [],
    groomAfflictedFrom: [],
    doshaSamyamStatusEn: 'N/A'
  }
} as unknown as WeddingMatchResult;
const weddingHtml = buildWeddingMatchHtml(incompleteWedding, 'en');
assert.match(weddingHtml, /Simham/);
assert.match(weddingHtml, /Magaram/);
assert.match(weddingHtml, /class="compatibility-overview-grid"/);
assert.match(weddingHtml, /aria-label="Visual Compatibility Meter"/);
assert.match(weddingHtml, /role="meter"/);
assert.match(weddingHtml, /class="dosha-summary-grid"/);
assert.equal((weddingHtml.match(/class="dosha-summary-card"/g) || []).length, 2);
assert.match(weddingHtml, /class="dosha-balance-summary"/);
assert.equal((weddingHtml.match(/class="dosha-summary-value">N\/A<\/strong>/g) || []).length, 2,
  'Missing Mars placements keep each partner status explicitly unavailable in the compact summary');
assert.match(weddingHtml, /FINAL RECOMMENDATION/);
assert.match(weddingHtml, /N\/A \/ N\/A/,
  'The report must not manufacture a score of zero or a 10-point denominator when those values are missing');
assert.doesNotMatch(weddingHtml, /House 1 \(N\/A\)/);

const unavailableMatch = {
  ...incompleteWedding,
  verdictStatus: undefined,
  overallVerdictEn: undefined,
  totalPoruthamsMatched: undefined,
  rajjuMatch: undefined,
  poruthams: []
} as unknown as WeddingMatchResult;
const unavailableMatchHtml = buildWeddingMatchHtml(unavailableMatch, 'en');
assert.match(unavailableMatchHtml, /class="final-verdict final-verdict-unavailable"/);
assert.match(unavailableMatchHtml, /final-verdict-message">N\/A</);
assert.match(unavailableMatchHtml, /N\/A \/ 10/,
  'An empty Porutham table cannot be summarized as zero matches');
assert.doesNotMatch(unavailableMatchHtml, /Not Recommended|The matching is not good/,
  'An unknown verdict must remain unavailable, not become an incompatibility verdict');
assert.match(unavailableMatchHtml, /Rajju Status: <strong style="color: var\(--ink-muted\)">N\/A<\/strong>/);

const incompletePorutham = {
  ...unavailableMatch,
  poruthams: [{
    ...compatibility.poruthams[0],
    status: undefined,
    pointsEarned: undefined,
    maxPoints: undefined
  }]
} as unknown as WeddingMatchResult;
const incompletePoruthamHtml = buildWeddingMatchHtml(incompletePorutham, 'en');
assert.match(incompletePoruthamHtml, /class="status-pill status-na">N\/A/);
assert.match(incompletePoruthamHtml, /class="porutham-points">N\/A \/ N\/A<\/td>/);

console.log('Astrology missing-data integrity and sign-mapping regressions passed.');
