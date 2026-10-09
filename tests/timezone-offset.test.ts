import assert from 'node:assert/strict';
import {
  getTimeZoneIdForCoordinates,
  getTimezoneOffsetAtInstant,
  resolveLocalDateTimeInTimeZone
} from '../src/lib/timezone.js';
import { calculatePrecisionHoroscope, calculatePrecisionPanchangam } from '../src/lib/astrology/astronomy.js';
import { findNakshatraFromBirthDetails } from '../src/lib/muhurtham/scanner.js';

const newYork = getTimeZoneIdForCoordinates(40.7128, -74.006);
assert.equal(newYork, 'America/New_York');
assert.equal(getTimeZoneIdForCoordinates(-18.1416, 178.4419), 'Pacific/Fiji');
assert.equal(getTimeZoneIdForCoordinates(27.7172, 85.324), 'Asia/Kathmandu');

const winterBirth = resolveLocalDateTimeInTimeZone('2000-01-01', '12:00', newYork!);
const summerBirth = resolveLocalDateTimeInTimeZone('2000-07-01', '12:00', newYork!);
assert.equal(winterBirth?.offsetHours, -5);
assert.equal(winterBirth?.utcDate.toISOString(), '2000-01-01T17:00:00.000Z');
assert.equal(summerBirth?.offsetHours, -4);
assert.equal(summerBirth?.utcDate.toISOString(), '2000-07-01T16:00:00.000Z');
assert.equal(getTimezoneOffsetAtInstant('Pacific/Fiji', new Date('2000-01-01T00:00:00Z')), 13);

const repeatedClock = resolveLocalDateTimeInTimeZone('2021-11-07', '01:30', newYork!);
assert.equal(repeatedClock?.ambiguous, true);
assert.equal(repeatedClock?.utcDate.toISOString(), '2021-11-07T05:30:00.000Z');
const skippedClock = resolveLocalDateTimeInTimeZone('2021-03-14', '02:30', newYork!);
assert.equal(skippedClock?.nonexistent, true);
assert.equal(skippedClock?.utcDate.toISOString(), '2021-03-14T07:30:00.000Z');

const winterChart = calculatePrecisionHoroscope(
  'Timezone Test', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M'
);
const sameChartWithDifferentFallback = calculatePrecisionHoroscope(
  'Timezone Test', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 13, 'Fiji', 'M'
);
assert.equal(winterChart.timezoneOffsetHours, 13, 'Historical Fiji DST should override a present-day offset');
assert.equal(winterChart.timeZoneId, 'Pacific/Fiji');
assert.equal(winterChart.lagnaDegrees, sameChartWithDifferentFallback.lagnaDegrees);
assert.equal(winterChart.chandraRasi, sameChartWithDifferentFallback.chandraRasi);
assert.equal(winterChart.dashaPeriods[0].startDate, '2000-01-01', 'Dasha dates should remain local calendar dates');
assert.match(winterChart.summary.wealthEn, /House 2 lord/);
assert.match(winterChart.summary.wealthEn, /not a guaranteed prediction/);
assert.doesNotMatch(winterChart.summary.wealthEn, /steady capital accumulation|investment growth/i);

const nyNakshatraA = findNakshatraFromBirthDetails('2000-01-01', '12:00', false, -4, 40.7128, -74.006);
const nyNakshatraB = findNakshatraFromBirthDetails('2000-01-01', '12:00', false, -5, 40.7128, -74.006);
assert.deepEqual(nyNakshatraA, nyNakshatraB, 'Coordinate timezone must override a stale fixed offset in Muhurtham birth-star lookup');

const tokyoPanchangam = calculatePrecisionPanchangam(
  new Date('2024-01-01T23:30:00Z'), 35.6762, 139.6503, 'Tokyo', 'Japan'
);
assert.equal(tokyoPanchangam.date, '2024-01-02');
assert.equal(tokyoPanchangam.time, '08:30:00');
assert.equal(tokyoPanchangam.varaIndex, 2);
assert.match(tokyoPanchangam.sunriseTime, /AM|PM/);

const suvaPanchangam = calculatePrecisionPanchangam(
  new Date('2026-01-15T00:00:00Z'), -17.7134, 178.065, 'Suva', 'Fiji'
);
assert.equal(suvaPanchangam.date, '2026-01-15');
assert.equal(suvaPanchangam.varaIndex, 4, 'Suva date is Thursday');
assert.notEqual(suvaPanchangam.sunriseTime, '06:00 AM');
assert.notEqual(suvaPanchangam.sunsetTime, '06:00 PM');
const clockMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
  assert.ok(match, `Expected a local 12-hour clock value, got ${value}`);
  const hour12 = Number(match![1]) % 12;
  return hour12 * 60 + Number(match![2]) + (match![3] === 'PM' ? 12 * 60 : 0);
};
const sunriseMinutes = clockMinutes(suvaPanchangam.sunriseTime);
const sunsetMinutes = clockMinutes(suvaPanchangam.sunsetTime);
const rahuStartMinutes = clockMinutes(suvaPanchangam.rahuKalam.start);
const expectedRahuStart = sunriseMinutes + (sunsetMinutes - sunriseMinutes) * 5 / 8;
assert.ok(Math.abs(rahuStartMinutes - expectedRahuStart) <= 2, 'Thursday Rahu Kalam should use segment 6 of the actual daylight interval');
assert.equal(suvaPanchangam.yamaGandam.start, suvaPanchangam.sunriseTime, 'Thursday Yamagandam starts at sunrise (segment 1)');
assert.notEqual(suvaPanchangam.abhijitMuhurtham.start, '11:45');

console.log('Timezone offset regression tests passed.');
