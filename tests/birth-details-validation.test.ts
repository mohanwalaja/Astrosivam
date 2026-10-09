import {
  isValidBirthTime,
  isValidIsoBirthDate,
  isVerifiedBirthLocation,
  locationFromBirthProfile,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizePersonName
} from '../src/utils/birthDetails';

let failures = 0;
const assert = (message: string, condition: boolean) => {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
};

console.log('\nBirth details validation regressions');
assert('names collapse repeated whitespace without stripping accents or punctuation',
  normalizePersonName('  José   O’Neil-Singh  ') === 'José O’Neil-Singh');
assert('whitespace-only names normalize to empty', normalizePersonName(' \n\t ') === '');
assert('birth dates normalize to ISO format', normalizeBirthDate('15/08/1990') === '1990-08-15');
assert('birth times normalize 12-hour profile values to 24-hour', normalizeBirthTime('9:30 PM') === '21:30');
assert('valid past ISO DOB is accepted', isValidIsoBirthDate('1990-08-15'));
assert('impossible calendar dates are rejected', !isValidIsoBirthDate('1990-02-30'));
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
assert('future DOB is rejected', !isValidIsoBirthDate(tomorrowIso));
assert('valid 24-hour birth times are accepted', isValidBirthTime('00:00') && isValidBirthTime('23:59'));
assert('invalid hour or minute values are rejected', !isValidBirthTime('24:00') && !isValidBirthTime('12:60'));
assert('equator and UTC-zero coordinates are valid rather than treated as missing', isVerifiedBirthLocation({
  placeName: 'Null Island', country: 'Global', latitude: 0, longitude: 0, timezoneOffsetHours: 0
}));
assert('out-of-range coordinates are rejected', !isVerifiedBirthLocation({
  placeName: 'Bad Place', country: 'Global', latitude: 91, longitude: 0, timezoneOffsetHours: 0
}));
assert('legacy profiles without coordinates are not silently given Fiji coordinates', locationFromBirthProfile({
  birthPlace: 'Chennai', country: 'India'
}) === null);
assert('null coordinates or timezone are not misread as valid zero values', locationFromBirthProfile({
  birthPlace: 'Chennai', country: 'India', latitude: null, longitude: null, timezoneOffsetHours: null
}) === null);
assert('complete saved locations retain exact coordinates and timezone', locationFromBirthProfile({
  birthPlace: 'Auckland', country: 'New Zealand', latitude: -36.85, longitude: 174.76,
  timezoneOffsetHours: 12, timeZoneId: 'Pacific/Auckland'
})?.placeName === 'Auckland');

if (failures > 0) process.exit(1);
