/**
 * Regression test: a family member whose chart is recalculated through the
 * LIVE astrology API was skipped with
 *
 *   "Family package is not complete (3/4 high-quality reports, invoice ready).
 *    Nothing was emailed; retry the render. #ORD-5A3E13 (Mohan Ji) was skipped:
 *    no calculated astrology result available for this member: the recalculated
 *    chart was rejected as inconsistent with the saved birth inputs - verify
 *    this member's saved birth date, time, place, coordinates and time zone on
 *    the order"
 *
 * Two engine facts made that rejection permanent:
 *
 *  1. The staleness check required `result.bhavas`, but only the Node engine
 *     emits that table. Production runs the PHP API
 *     (`AstroEngine::calculateHoroscope()`), which records the twelve houses on
 *     every `planetPositions` entry instead — so EVERY rescued member was
 *     "inconsistent" with the very inputs the chart had just been computed
 *     from, and no retry could ever succeed.
 *  2. Birth date/time were compared as raw strings. The PHP API accepts and
 *     stores `6:30`, `06:30:00` and `6:30 PM`, while both engines store the
 *     canonical `06:30` (`AstroEngine::normalizeBirthTime()` / the Node
 *     engine), so those orders recalculated to a chart that failed the same
 *     string check again.
 *
 * The engine-agnostic chart check and the canonical birth-input comparison are
 * verified below, together with the guards that must still force a genuine
 * recalculation.
 */
import assert from 'node:assert/strict';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';
import { calculateBabyNamingDetails } from '../server/astrology/babynames.js';
import {
  buildOrderReportHtml,
  canonicalCalculationPayload,
  mergeOrderPayloadIntoResult,
  resultNeedsRecalculation,
  resolveCalculatedResult
} from '../src/services/jathagamPdfExporter.js';

const makeOrder = (payload: any, calculatedResult: any, serviceType = 'BIRTH_JATHAGAM', userName = 'Mohan Ji') => ({
  id: 'ord-5a3e13',
  orderNumber: 'ord-5a3e13',
  serviceType,
  language: 'en',
  userName,
  inputPayload: payload,
  calculatedResult
}) as any;

const payload: any = {
  name: 'Mohan Ji',
  dob: '2000-07-01',
  tob: '12:00',
  birthPlace: 'New York',
  country: 'USA',
  latitude: 40.7128,
  longitude: -74.006,
  timezoneOffsetHours: -5,
  timeZoneId: 'America/New_York',
  gender: 'M'
};

const nodeChart: any = calculatePrecisionHoroscope(
  'Mohan Ji', payload.dob, payload.tob, payload.birthPlace,
  payload.latitude, payload.longitude, payload.timezoneOffsetHours, payload.country, 'M'
);
assert.equal(resultNeedsRecalculation(makeOrder(payload, nodeChart), nodeChart), false);

// --- 1. The PHP engine's chart shape must be accepted ----------------------
// The PHP result carries every field the report renders, but no `bhavas`
// table (the houses live on each planetPosition). Deleting exactly those
// Node-only keys reproduces a production PHP chart.
const phpShapedChart: any = { ...nodeChart };
for (const nodeOnly of ['bhavas', 'navamsaPositions', 'currentDasha', 'saniStatus', 'lagnaRasiNameHi', 'janmaNakshatraHi']) {
  delete phpShapedChart[nodeOnly];
}
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, phpShapedChart), phpShapedChart),
  false,
  'a chart that differs from the Node chart only by the Node-only bhavas table must be current'
);
assert.ok(
  buildOrderReportHtml(makeOrder(payload, phpShapedChart), mergeOrderPayloadIntoResult(makeOrder(payload, phpShapedChart), phpShapedChart), 'en').length > 1000,
  'the PHP-shaped chart renders a full member report instead of being skipped'
);

// A PHP chart with the nested birthDetails wrapper (what the PHP API stores)
// and the DST-aware offset matches the same saved inputs.
const phpStored = {
  ...phpShapedChart,
  birthDetails: {
    dob: payload.dob,
    tob: payload.tob,
    birthPlace: payload.birthPlace,
    country: payload.country,
    latitude: payload.latitude,
    longitude: payload.longitude,
    timezoneOffsetHours: -4,
    timeZoneId: 'America/New_York'
  }
};
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, phpStored), phpStored),
  false,
  'the PHP birthDetails wrapper is accepted when every saved birth input matches'
);

// A chart recalculated from these inputs and then re-checked must never be
// rejected — the loop the operator saw. resolveCalculatedResult() is the exact
// function that decides "skip this member".
const phpChartOrder = makeOrder(payload, phpShapedChart);
const resolvedPhpChart = await resolveCalculatedResult(phpChartOrder);
assert.equal(resolvedPhpChart.result, phpShapedChart, 'a current PHP chart is used without an API round trip');
assert.equal(resolvedPhpChart.error, '');

// --- 2. Incomplete charts are still recalculated ---------------------------
// The bhavas marker existed to refresh thin legacy results; real thin results
// are still rejected and refreshed from the saved inputs.
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, { lagnaRasi: 5 }), { lagnaRasi: 5 }),
  true,
  'a legacy thin result (no planets/nakshatra/dasha) still forces recalculation'
);
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, { ...phpShapedChart, planetPositions: [] }), { ...phpShapedChart, planetPositions: [] }),
  true,
  'a chart without the nine planet positions is incomplete'
);
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, { ...phpShapedChart, janmaPada: 0 }), { ...phpShapedChart, janmaPada: 0 }),
  true,
  'a chart without a valid janma pada is incomplete'
);
assert.equal(
  resultNeedsRecalculation(makeOrder(payload, { ...phpShapedChart, dashaPeriods: [], dasha: undefined }), { ...phpShapedChart, dashaPeriods: [], dasha: undefined }),
  true,
  'a chart without a Vimshottari timeline is incomplete'
);

// --- 3. Legacy saved birth times: '6:30 PM' vs the engine's '18:30' --------
// The PHP API accepts these forms, and the engines store the canonical 24-hour
// time; both must describe the SAME birth instant.
const legacyTimeCases: Array<[string, string]> = [
  ['6:30', '06:30'],
  ['06:30:00', '06:30'],
  ['6:30 PM', '18:30'],
  ['12:30 AM', '00:30']
];
for (const [saved, canonical] of legacyTimeCases) {
  const legacyPayload = { ...payload, tob: saved };
  const chart: any = calculatePrecisionHoroscope(
    'Mohan Ji', legacyPayload.dob, canonical, legacyPayload.birthPlace,
    legacyPayload.latitude, legacyPayload.longitude, legacyPayload.timezoneOffsetHours, legacyPayload.country, 'M'
  );
  assert.equal(chart.tob, canonical, `both engines store the canonical time for ${saved}`);
  assert.equal(
    resultNeedsRecalculation(makeOrder(legacyPayload, chart), chart),
    false,
    `a chart recalculated from a saved '${saved}' birth time is current`
  );
  const merged = mergeOrderPayloadIntoResult(makeOrder(legacyPayload, chart), chart);
  const html = buildOrderReportHtml(makeOrder(legacyPayload, chart), merged, 'en');
  assert.ok(html.includes(canonical.replace(/^(\d{2}):(\d{2})$/, (_m, h, mi) => {
    const hour = Number(h);
    return `${String(hour % 12 || 12).padStart(2, '0')}:${mi} ${hour >= 12 ? 'PM' : 'AM'}`;
  })), `the report shows the saved ${saved} time correctly`);
}

// The recalculation request itself carries the canonical wall clock — the flat
// legacy wedding keys included — while the stored order keeps the typed value.
const flatWedding = canonicalCalculationPayload({
  brideTob: '6:30 PM', groomTob: '12:00', brideDob: '1990-5-4',
  bride: { tob: '6:30 PM', dob: '1990-5-4' }, unrelated: '6:30 PM'
});
assert.equal(flatWedding.brideTob, '18:30', 'flat bride time sent to the engines is canonical');
assert.equal(flatWedding.groomTob, '12:00');
assert.equal(flatWedding.brideDob, '1990-05-04', 'flat bride date sent to the engines is canonical');
assert.equal(flatWedding.bride.tob, '18:30', 'nested bride time sent to the engines is canonical');
assert.equal(flatWedding.unrelated, '6:30 PM', 'unrelated saved fields are never rewritten');

// A genuinely different saved time still forces a recalculation.
const resavedTime = { ...payload, tob: '06:45' };
assert.equal(
  resultNeedsRecalculation(makeOrder(resavedTime, phpShapedChart), phpShapedChart),
  true,
  'a changed birth TIME still forces recalculation'
);
// ...and the recalculation from that saved input is accepted.
const resavedChart: any = calculatePrecisionHoroscope(
  'Mohan Ji', resavedTime.dob, resavedTime.tob, resavedTime.birthPlace,
  resavedTime.latitude, resavedTime.longitude, resavedTime.timezoneOffsetHours, resavedTime.country, 'M'
);
assert.equal(resultNeedsRecalculation(makeOrder(resavedTime, resavedChart), resavedChart), false);

// --- 4. The other saved particulars keep their strict equality checks ------
const withPayload = (overrides: any) => makeOrder({ ...payload, ...overrides }, phpShapedChart);
assert.ok(resultNeedsRecalculation(withPayload({ dob: '2001-07-01' }), phpShapedChart), 'changed birth DATE forces recalculation');
assert.ok(resultNeedsRecalculation(withPayload({ birthPlace: 'Boston' }), phpShapedChart), 'changed birth PLACE forces recalculation');
assert.ok(resultNeedsRecalculation(withPayload({ country: 'Canada' }), phpShapedChart), 'changed birth COUNTRY forces recalculation');
assert.ok(resultNeedsRecalculation(withPayload({ latitude: 40.7 }), phpShapedChart), 'changed LATITUDE forces recalculation');
assert.ok(resultNeedsRecalculation(withPayload({ longitude: -74.01 }), phpShapedChart), 'changed LONGITUDE forces recalculation');
assert.ok(
  resultNeedsRecalculation(makeOrder(payload, { ...phpShapedChart, timezoneOffsetHours: 10 }), { ...phpShapedChart, timezoneOffsetHours: 10 }),
  'an implausible stored offset is still treated as stale'
);

// --- 5. Baby naming: the checkout's "Other" gender cannot dead-lock --------
// The PHP engine stores 'M' for anything that is not 'F', so a saved 'O' must
// not be treated as a contradiction (the report is rendered from the letters
// the engine returned).
const babyPayload: any = {
  ...payload,
  name: 'Baby Mohan',
  babyName: 'Baby Mohan',
  gender: 'O'
};
const babyChart: any = calculateBabyNamingDetails({
  ...babyPayload,
  gender: 'O'
});
assert.ok(babyChart.nakshatraLetters && babyChart.primaryPadaInfo);
// The PHP engine's canonicalised gender for an 'O' input is 'M'.
const phpBabyChart = { ...babyChart, gender: 'M' };
assert.equal(
  resultNeedsRecalculation(makeOrder(babyPayload, phpBabyChart, 'BABY_NAMING'), phpBabyChart),
  false,
  "a PHP-canonicalised gender does not stall a saved 'Other' baby-naming chart"
);
// A real gender change still refreshes the naming letters.
assert.equal(
  resultNeedsRecalculation(makeOrder({ ...babyPayload, gender: 'F' }, phpBabyChart, 'BABY_NAMING'), phpBabyChart),
  true,
  'a genuine M/F change still forces recalculation'
);
// Word forms from older rows resolve to the same letter.
assert.equal(
  resultNeedsRecalculation(makeOrder({ ...babyPayload, gender: 'male' }, { ...phpBabyChart, gender: 'M' }, 'BABY_NAMING'), { ...phpBabyChart, gender: 'M' }),
  false,
  "'male' and 'M' are the same saved gender"
);

// --- 6. The whole family calculation phase resolves 4/4 -------------------
// One member renders from the Node-era cache, one from a PHP chart, one from a
// legacy saved birth time and one has no cache at all (recalculated from the
// saved payload through the same dispatcher the API uses).
const { computeOrderReportResult } = await import('../server/astrology/orderReportResult.js');
const members = [
  makeOrder(payload, nodeChart, 'BIRTH_JATHAGAM', 'Family Member 1'),
  makeOrder(payload, phpShapedChart, 'BIRTH_JATHAGAM', 'Family Member 2'),
  makeOrder({ ...payload, tob: '6:30 PM' }, null, 'BIRTH_JATHAGAM', 'Family Member 3'),
  makeOrder(payload, null, 'BIRTH_JATHAGAM', 'Mohan Ji')
];
for (const member of members) {
  const needsRecalculation = !member.calculatedResult || resultNeedsRecalculation(member, member.calculatedResult);
  const recalculated = needsRecalculation
    ? computeOrderReportResult({
        serviceType: member.serviceType,
        // Mirrors resolveCalculatedResult(): the API receives the canonical
        // wall clock, never a legacy '6:30 PM' string the engines reject.
        inputPayload: canonicalCalculationPayload(member.inputPayload),
        userName: member.userName
      } as any)
    : member.calculatedResult;
  assert.ok(recalculated, `${member.userName} must resolve a chart (no skip)`);
  assert.equal(
    resultNeedsRecalculation(member, recalculated),
    false,
    `${member.userName}'s chart must be accepted (no infinite recalculation loop)`
  );
  assert.ok(
    buildOrderReportHtml(member, mergeOrderPayloadIntoResult(member, recalculated), 'en').length > 1000,
    `${member.userName}'s report HTML must render`
  );
}

// resolveCalculatedResult reports WHY when a chart truly cannot be resolved.
const noPayload = { ...makeOrder(undefined, { lagnaRasi: 5 }), inputPayload: undefined };
const unresolved = await resolveCalculatedResult(noPayload as any);
assert.equal(unresolved.result, null);
assert.match(unresolved.error, /missing/i);

console.log('Family report engine-parity regression tests passed.');
