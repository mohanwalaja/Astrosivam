/**
 * Regression test: family members whose Birth Jathagam chart stores the IANA
 * historical (DST-aware) timezone offset were permanently judged "stale" by
 * resultNeedsRecalculation(). Both engines (Node calculatePrecisionHoroscope
 * and the PHP engine) intentionally replace the submitted fixed offset with
 * the offset in force at the moment of birth, so the stored offset
 * legitimately differs from what the customer typed for any DST birth
 * (New York in July: submitted -5, stored -4; Fiji in January: submitted 12,
 * stored 13).
 *
 * The old staleness check required the stored offset to equal the submitted
 * one byte-for-byte, so:
 *   1. the saved chart was rejected,
 *   2. the recalculated chart was rejected AGAIN (same stored offset),
 *   3. resolveCalculatedResult() returned null,
 *   4. the family renderer skipped the member:
 *
 *      "Family package is not complete (3/4 high-quality reports, invoice
 *       ready). Nothing was emailed; retry the render. #ord-5a3e13 (Mohan Ji)
 *       was skipped: no calculated astrology result available for this member"
 *
 * Retrying was useless — the failure was deterministic.
 */
import assert from 'node:assert/strict';
import {
  getTimeZoneIdForCoordinates,
  resolveLocalDateTimeInTimeZone
} from '../src/lib/timezone.js';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';
import {
  buildOrderReportHtml,
  resultNeedsRecalculation,
  resolveCalculatedResult
} from '../src/services/jathagamPdfExporter.js';

const orderBase = {
  id: 'ord-5a3e13',
  orderNumber: 'ord-5a3e13',
  serviceType: 'BIRTH_JATHAGAM',
  language: 'en'
};

const makeOrder = (name, payload, calculatedResult) => ({
  ...orderBase,
  userName: name,
  inputPayload: payload,
  calculatedResult
});

// --- 1. The production failure: a member born during DST -------------------
// The customer selected the standard offset (-5); the July birth is daylight
// time (-4). The engine stores -4 — the correct, DST-aware offset.
const nyPayload = {
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
assert.equal(getTimeZoneIdForCoordinates(nyPayload.latitude, nyPayload.longitude), 'America/New_York');
const nyStored = calculatePrecisionHoroscope(
  'Mohan Ji', nyPayload.dob, nyPayload.tob, nyPayload.birthPlace,
  nyPayload.latitude, nyPayload.longitude, -5, 'USA', 'M'
);
assert.equal(nyStored.timezoneOffsetHours, -4, 'engine stores the DST-aware offset');
const nyOrder = makeOrder('Mohan Ji', nyPayload, nyStored);
assert.equal(
  resultNeedsRecalculation(nyOrder, nyStored),
  false,
  'a chart computed from the saved birth particulars is current even when the stored DST offset differs from the submitted one'
);
assert.ok(
  buildOrderReportHtml(nyOrder, nyStored, 'en').length > 1000,
  'the member report renders instead of the member being skipped'
);

// A fresh recalculation (what resolveCalculatedResult does when the cache is
// missing) must be accepted too — this rejection was the infinite loop.
const nyRecalc = calculatePrecisionHoroscope(
  'Mohan Ji', nyPayload.dob, nyPayload.tob, nyPayload.birthPlace,
  nyPayload.latitude, nyPayload.longitude, -5, 'USA', 'M'
);
assert.equal(
  resultNeedsRecalculation({ ...nyOrder, calculatedResult: null }, nyRecalc),
  false,
  'a freshly recalculated chart must not be rejected as stale again'
);

// --- 2. Same failure class without an IANA zone in the payload -------------
// Fiji in January: submitted 12 (present-day standard), the zone was +13 then.
const fjPayload = {
  name: 'Fiji Member',
  dob: '2000-01-01',
  tob: '12:00',
  birthPlace: 'Suva',
  country: 'Fiji',
  latitude: -18.1416,
  longitude: 178.4419,
  timezoneOffsetHours: 12,
  gender: 'M'
};
const fjStored = calculatePrecisionHoroscope(
  'Fiji Member', fjPayload.dob, fjPayload.tob, fjPayload.birthPlace,
  fjPayload.latitude, fjPayload.longitude, 12, 'Fiji', 'M'
);
assert.equal(fjStored.timezoneOffsetHours, 13, 'historical Fiji DST offset');
assert.equal(
  resultNeedsRecalculation(makeOrder('Fiji Member', fjPayload, fjStored), fjStored),
  false,
  'without a timeZoneId in the payload the coordinate-mapped zone offset still matches'
);

// --- 3. PHP-engine shaped result (birthDetails wrapper + canonical zone) ----
const phpStored = {
  ...nyStored,
  birthDetails: {
    dob: nyPayload.dob,
    tob: nyPayload.tob,
    birthPlace: nyPayload.birthPlace,
    country: nyPayload.country,
    latitude: nyPayload.latitude,
    longitude: nyPayload.longitude,
    timezoneOffsetHours: -4,
    timeZoneId: 'America/New_York'
  }
};
assert.equal(
  resultNeedsRecalculation(makeOrder('Mohan Ji', nyPayload, phpStored), phpStored),
  false,
  'a PHP-engine stored chart (birthDetails wrapper) is current for the same inputs'
);

// --- 4. Staleness detection must still catch REAL input changes ------------
const withPayload = (payload) => ({ ...nyOrder, inputPayload: payload });
assert.ok(
  resultNeedsRecalculation(withPayload({ ...nyPayload, dob: '2001-07-01' }), nyStored),
  'a changed birth DATE still forces recalculation'
);
assert.ok(
  resultNeedsRecalculation(withPayload({ ...nyPayload, tob: '13:00' }), nyStored),
  'a changed birth TIME still forces recalculation'
);
assert.ok(
  resultNeedsRecalculation(withPayload({ ...nyPayload, latitude: 40.7 }), nyStored),
  'a changed latitude still forces recalculation'
);
assert.ok(
  resultNeedsRecalculation(withPayload({ ...nyPayload, birthPlace: 'Boston' }), nyStored),
  'a changed birth place still forces recalculation'
);
// A chart that stores an offset no engine would produce for these inputs is
// stale even though it only differs from the DST offset by one hour.
assert.ok(
  resultNeedsRecalculation(nyOrder, { ...nyStored, timezoneOffsetHours: 10 }),
  'an implausible stored offset is still treated as stale'
);
// Non-DST members (the other 3 in the failing package) keep their fast path.
const inPayload = {
  name: 'Chennai Member', dob: '1990-05-14', tob: '06:30', birthPlace: 'Chennai', country: 'India',
  latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5, gender: 'M'
};
const inStored = calculatePrecisionHoroscope(
  'Chennai Member', inPayload.dob, inPayload.tob, inPayload.birthPlace,
  inPayload.latitude, inPayload.longitude, 5.5, 'India', 'M'
);
assert.equal(inStored.timezoneOffsetHours, 5.5, 'India has no DST; offset is unchanged');
assert.equal(
  resultNeedsRecalculation(makeOrder('Chennai Member', inPayload, inStored), inStored),
  false,
  'non-DST members render from the stored chart'
);

// --- 5. The full family calculation phase: 4/4 members resolve -------------
const members = [
  makeOrder('Chennai Member', inPayload, inStored),
  makeOrder('Fiji Member', fjPayload, fjStored),
  makeOrder('Mohan Ji', nyPayload, nyStored),
  makeOrder('Mohan Ji', nyPayload, null) // stale-or-missing cache: must recalculate
];
for (const member of members) {
  const needsRecalc = !member.calculatedResult || resultNeedsRecalculation(member, member.calculatedResult);
  // Mirrors resolveCalculatedResult(): the recalculation path goes through the
  // same calculate-preview dispatcher the browser API calls.
  const { computeOrderReportResult } = await import('../server/astrology/orderReportResult.js');
  const recalc = needsRecalc
    ? computeOrderReportResult({ serviceType: member.serviceType, inputPayload: member.inputPayload, userName: member.userName })
    : null;
  const result = needsRecalc ? recalc : member.calculatedResult;
  assert.ok(result, `member ${member.userName} must resolve a chart (no skip)`);
  assert.equal(
    resultNeedsRecalculation(member, result),
    false,
    `member ${member.userName}'s result must be accepted (no infinite recalculation loop)`
  );
  assert.ok(
    buildOrderReportHtml(member, result, 'en').length > 1000,
    `member ${member.userName}'s report HTML must render`
  );
}

// --- 6. resolveCalculatedResult: cache hit and actionable error reporting ---
const cached = await resolveCalculatedResult(nyOrder);
assert.equal(cached.result, nyStored, 'a current stored chart is used without recalculation');
assert.equal(cached.error, '');

const noPayloadOrder = {
  ...nyOrder,
  inputPayload: undefined,
  calculatedResult: { lagnaRasi: 5 } // no bhavas -> outdated, cannot recompute
};
const unresolved = await resolveCalculatedResult(noPayloadOrder);
assert.equal(unresolved.result, null);
assert.match(
  unresolved.error,
  /missing/i,
  'when recalculation is impossible the reason must say the birth particulars are missing'
);

// --- 7. DST fold (ambiguous) wall time: resolver picks the first occurrence --
// The engine rejects ambiguous times outright, so a saved chart can only come
// from the PHP engine; the check must accept the first-occurrence offset.
const foldDob = '2021-11-07';
const foldTob = '01:30';
const foldResolution = resolveLocalDateTimeInTimeZone(foldDob, foldTob, 'America/New_York');
assert.equal(foldResolution?.ambiguous, true);
assert.equal(foldResolution?.offsetHours, -4, 'first (EDT) occurrence');
const foldChart = { ...nyStored, dob: foldDob, tob: foldTob, timezoneOffsetHours: -4 };
const foldPayload = { ...nyPayload, dob: foldDob, tob: foldTob };
assert.equal(
  resultNeedsRecalculation(makeOrder('Mohan Ji', foldPayload, foldChart), foldChart),
  false,
  'a chart stored for the first occurrence of a repeated wall-clock time is current'
);

console.log('Family report timezone-staleness regression tests passed.');
