import assert from 'node:assert/strict';
import {
  hasValidBirthDetails,
  hasValidCoordinates,
  isValidBirthDate,
  isValidBirthTime
} from '../server/services/birthDetails.js';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { calculateBabyNamingDetails } from '../server/astrology/babynames.js';
import { computeOrderReportResult } from '../server/astrology/orderReportResult.js';

const now = new Date('2026-10-03T12:00:00.000Z');
assert.equal(isValidBirthDate('2000-02-29', now), true, 'valid leap-day DOB is accepted');
assert.equal(isValidBirthDate('1900-02-29', now), false, 'impossible leap-day DOB is rejected');
assert.equal(isValidBirthDate('2026-10-04', now), true,
  'the next UTC date remains a candidate for users whose local zone is ahead of UTC');
assert.equal(isValidBirthDate('2026-10-03', now), true, 'today is accepted');
assert.equal(isValidBirthDate('1990-02-30', now), false, 'overflow dates are rejected');
assert.equal(isValidBirthDate('1899-12-31', now), false, 'unsupported historical dates are rejected');

assert.equal(isValidBirthTime('00:00'), true);
assert.equal(isValidBirthTime('23:59'), true);
assert.equal(isValidBirthTime('24:00'), false);
assert.equal(isValidBirthTime('12:60'), false);
assert.equal(isValidBirthTime('9:30 PM'), false, 'the server requires normalized 24-hour HH:MM');
assert.equal(isValidBirthTime('09:30:00'), false, 'seconds are not part of the supported form value');

assert.equal(hasValidCoordinates(0, 0, 0), true, 'Null Island is a valid location');
assert.equal(hasValidCoordinates(null, null, null), false);
assert.equal(hasValidCoordinates(91, 0, 0), false);

const completeBirth = {
  name: 'Test Native',
  dob: '1990-08-15',
  tob: '09:30',
  birthPlace: 'Suva, Fiji',
  latitude: -18.1416,
  longitude: 178.4419,
  timezoneOffsetHours: 12
};
assert.equal(hasValidBirthDetails(completeBirth), true);
assert.equal(hasValidBirthDetails({ ...completeBirth, dob: '' }), false);
assert.equal(hasValidBirthDetails({ ...completeBirth, tob: '25:70' }), false);
assert.equal(hasValidBirthDetails({ ...completeBirth, birthPlace: ' ' }), false);
assert.equal(hasValidBirthDetails({ ...completeBirth, latitude: null }), false);
assert.equal(hasValidBirthDetails({ ...completeBirth, dob: '2099-10-04' }), false,
  'a future birth date is rejected independently of the day this regression suite runs');
const nonexistentDstBirth = {
  ...completeBirth, dob: '2024-03-10', tob: '02:30', birthPlace: 'New York, United States',
  latitude: 40.7128, longitude: -74.006, timezoneOffsetHours: -5, timeZoneId: 'America/New_York'
};
assert.equal(hasValidBirthDetails(nonexistentDstBirth), false,
  'a wall-clock time skipped by a daylight-saving transition is not silently accepted');
assert.throws(
  () => calculatePrecisionHoroscope(
    'DST Gap', nonexistentDstBirth.dob, nonexistentDstBirth.tob, nonexistentDstBirth.birthPlace,
    nonexistentDstBirth.latitude, nonexistentDstBirth.longitude, nonexistentDstBirth.timezoneOffsetHours,
    'United States', 'M'
  ),
  /ambiguous or does not exist in the selected time zone/i,
  'The chart engine also refuses nonexistent DST-gap times when called directly'
);
const ambiguousDstBirth = { ...nonexistentDstBirth, dob: '2024-11-03', tob: '01:30' };
assert.equal(hasValidBirthDetails(ambiguousDstBirth), false,
  'a wall-clock time repeated by a daylight-saving transition needs clarification');
assert.throws(
  () => calculatePrecisionHoroscope(
    'DST Fold', ambiguousDstBirth.dob, ambiguousDstBirth.tob, ambiguousDstBirth.birthPlace,
    ambiguousDstBirth.latitude, ambiguousDstBirth.longitude, ambiguousDstBirth.timezoneOffsetHours,
    'United States', 'M'
  ),
  /ambiguous/i,
  'the chart engine does not choose an unverified occurrence of a repeated local time'
);
assert.equal(hasValidBirthDetails(null), false);
assert.throws(
  () => calculatePrecisionHoroscope('Future Chart', '2099-01-01', '09:30', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M'),
  /valid past local instant/i,
  'the chart engine refuses a future instant even when called outside an HTTP route'
);

assert.throws(
  () => calculateBabyNamingDetails({
    babyName: 'Incomplete', dob: '', tob: '09:30', birthPlace: 'Suva', country: 'Fiji',
    latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12
  }),
  /invalid birth date\/time/i,
  'The Baby Naming engine no longer substitutes a default DOB'
);
const incompleteMarriagePerson = {
  name: 'Incomplete', dob: '', tob: '09:30', birthPlace: 'Suva', country: 'Fiji',
  latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12
};
assert.throws(
  () => calculateWeddingCompatibility(incompleteMarriagePerson, { ...incompleteMarriagePerson, dob: '1990-01-01' }),
  /invalid birth date\/time/i,
  'The Marriage engine no longer substitutes default DOBs or birthplace coordinates'
);

const legacyFlatWedding = computeOrderReportResult({
  serviceType: 'MARRIAGE_COMPATIBILITY',
  userName: 'Preview User',
  inputPayload: {
    brideName: 'Bride', brideDob: '1990-08-15', brideTob: '09:30', bridePlace: 'Suva',
    brideCountry: '', brideLatitude: -18.1416, brideLongitude: 178.4419,
    brideTimezoneOffsetHours: 12, brideTimeZoneId: 'Pacific/Fiji',
    groomName: 'Groom', groomDob: '1991-04-02', groomTob: '10:15', groomPlace: 'Nadi',
    groomCountry: '', groomLatitude: -17.7765, groomLongitude: 177.4356,
    groomTimezoneOffsetHours: 12, groomTimeZoneId: 'Pacific/Fiji',
    country: 'Account Billing Country'
  }
} as any);
assert.equal(legacyFlatWedding?.bridePlace, 'Suva',
  'Legacy flat marriage previews are normalized from the two saved birth profiles');
assert.equal(legacyFlatWedding?.groomPlace, 'Nadi');
assert.equal(legacyFlatWedding?.bride?.country, '',
  'The legacy account country is not substituted for a missing bride birth country');
assert.equal(legacyFlatWedding?.groom?.country, '',
  'The legacy account country is not substituted for a missing groom birth country');

console.log('[PASS] Server birth-data validation rejects incomplete or impossible report inputs');
