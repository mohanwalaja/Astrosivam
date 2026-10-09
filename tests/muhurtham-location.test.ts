import assert from 'node:assert/strict';
import { findNakshatraFromBirthDetails, MUHURTHAM_ALGORITHM_VERSION, scanMonthMuhurtham } from '../src/lib/muhurtham/scanner.js';
import { computeMuhurthamResult, computeMuhurthamResultFromPayload, normalizeMuhurthamScan } from '../server/astrology/muhurthamScan.js';
import { buildMuhurthamHtml } from '../src/services/muhurthamHtmlBuilder.js';
import { buildSamplePayload } from '../src/services/sampleReports.js';

const birth = {
  dob: '1990-08-15',
  tob: '09:30',
  birthPlace: 'Suva',
  country: 'Fiji',
  latitude: -18.1416,
  longitude: 178.4419,
  timezoneOffsetHours: 12,
  timeZoneId: 'Pacific/Fiji'
};
const muhurtham = {
  muhurthamPlace: 'New York, New York, United States',
  muhurthamCountry: 'United States',
  muhurthamLatitude: 40.7128,
  muhurthamLongitude: -74.006,
  muhurthamTimezoneOffsetHours: -5,
  muhurthamTimeZoneId: 'America/New_York'
};
const monthDate = new Date();
monthDate.setMonth(monthDate.getMonth() + 4, 1);
const selectedMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

const payload = {
  name: 'Location Regression',
  ...birth,
  ...muhurtham,
  eventKey: 'wedding',
  selectedMonth
};
const birthStar = findNakshatraFromBirthDetails(
  birth.dob, birth.tob, false, birth.timezoneOffsetHours, birth.latitude, birth.longitude
)!;
const syntheticMonths = Array.from({ length: 6 }, (_, offset) => {
  const month = new Date(monthDate.getFullYear(), monthDate.getMonth() + offset - 2, 1);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  return {
    monthKey,
    month: month.getMonth() + 1,
    year: month.getFullYear(),
    monthNameEn: month.toLocaleString('en', { month: 'long', year: 'numeric' }),
    days: [{ date: `${monthKey}-05`, grade: 'GOOD' }]
  };
});
const result = {
  ...payload,
  muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
  months: syntheticMonths,
  persons: [{ role: 'You', nakshatraIndex: birthStar.primary.nakshatraIndex }]
};
const staleVersionPayload = {
  ...payload,
  muhurthamScan: {
    muhurthamAlgorithmVersion: 4,
    selectedMonth,
    eventKey: 'wedding',
    months: [{ monthKey: selectedMonth, month: monthDate.getMonth() + 1, year: monthDate.getFullYear(), days: [{ date: `${selectedMonth}-01`, grade: 'BEST' }] }],
    persons: []
  }
};
let staleScanRecalculationReceived: any = null;
const regeneratedFromStaleScan = computeMuhurthamResultFromPayload({ inputPayload: staleVersionPayload }, input => {
  staleScanRecalculationReceived = input.inputPayload;
  return { muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION, recalculated: true };
});
assert.equal(regeneratedFromStaleScan.muhurthamAlgorithmVersion, MUHURTHAM_ALGORITHM_VERSION,
  'A version-4 client scan is recalculated under the corrected Tithi rules');
assert.equal(staleScanRecalculationReceived, staleVersionPayload,
  'A stale partial browser scan is sent to the fresh scanner, never relabeled as current');
const scanContextKeys = [
  'dob', 'tob', 'birthPlace', 'country', 'latitude', 'longitude', 'timezoneOffsetHours', 'timeZoneId',
  'muhurthamPlace', 'muhurthamCountry', 'muhurthamLatitude', 'muhurthamLongitude',
  'muhurthamTimezoneOffsetHours', 'muhurthamTimeZoneId', 'eventKey', 'selectedMonth'
] as const;
const scanInputContext = Object.fromEntries(scanContextKeys.map(key => [key, (payload as any)[key] ?? '']));
const stampedCurrentScan = {
  ...payload,
  muhurthamScan: {
    muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION, selectedMonth, eventKey: 'wedding',
    inputContext: scanInputContext, months: result.months, persons: result.persons
  }
};
const currentScanResult = computeMuhurthamResultFromPayload({ inputPayload: stampedCurrentScan });
assert.deepEqual(
  currentScanResult.months.map(month => ({ monthKey: month.monthKey, dates: month.days.map((day: any) => day.date) })),
  result.months.map(month => ({ monthKey: month.monthKey, dates: month.days.map((day: any) => day.date) })),
  'A v5 scan is reusable only when its saved input context matches the payload'
);
const changedEventLocation = {
  ...stampedCurrentScan,
  muhurthamPlace: 'Auckland, New Zealand',
  muhurthamCountry: 'New Zealand',
  muhurthamLatitude: -36.8509,
  muhurthamLongitude: 174.7645,
  muhurthamTimezoneOffsetHours: 13,
  muhurthamTimeZoneId: 'Pacific/Auckland'
};
let changedLocationRecalculationReceived: any = null;
const regeneratedForChangedLocation = computeMuhurthamResultFromPayload({ inputPayload: changedEventLocation }, input => {
  changedLocationRecalculationReceived = input.inputPayload;
  return { muhurthamPlace: input.inputPayload.muhurthamPlace, muhurthamLatitude: input.inputPayload.muhurthamLatitude };
});
assert.equal(changedLocationRecalculationReceived, changedEventLocation,
  'A current-version scan stamped for another location is sent to the fresh scanner');
assert.deepEqual(regeneratedForChangedLocation, {
  muhurthamPlace: 'Auckland, New Zealand', muhurthamLatitude: -36.8509
}, 'The fresh scan uses the changed event location instead of relabeling cached dates');
assert.equal(result.muhurthamAlgorithmVersion, MUHURTHAM_ALGORITHM_VERSION);
assert.equal(result.birthPlace, birth.birthPlace);
assert.equal(result.muhurthamPlace, muhurtham.muhurthamPlace);
assert.equal(result.persons[0].nakshatraIndex, birthStar.primary.nakshatraIndex,
  'Janma Nakshatra is derived using the original birthplace coordinates and birth time');

const scanOptions = {
  persons: [{ role: 'self' as const, nakshatraIndex: birthStar.primary.nakshatraIndex, rasiNumber: birthStar.primary.rasiNumber }],
  birthDate: birth.dob,
  skipPastDates: true
};
const selectedResultMonth = result.months[2];
const expectedLocalScan = scanMonthMuhurtham(
  selectedResultMonth.year,
  selectedResultMonth.month,
  {
    placeName: muhurtham.muhurthamPlace,
    latitude: muhurtham.muhurthamLatitude,
    longitude: muhurtham.muhurthamLongitude,
    timezoneOffsetHours: muhurtham.muhurthamTimezoneOffsetHours,
    timeZoneId: muhurtham.muhurthamTimeZoneId
  },
  'wedding',
  scanOptions
);
const wrongBirthplaceScan = scanMonthMuhurtham(
  selectedResultMonth.year,
  selectedResultMonth.month,
  {
    placeName: birth.birthPlace,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezoneOffsetHours: birth.timezoneOffsetHours,
    timeZoneId: birth.timeZoneId
  },
  'wedding',
  scanOptions
);
assert.ok(expectedLocalScan.days.length > 0,
  'Muhurtham date rows are calculated for the selected residence / ceremony location');
assert.notDeepEqual(
  expectedLocalScan.days.map((day: any) => [day.sunrise, day.sunset, day.tithiNameEn, day.nakshatraNameEn]),
  wrongBirthplaceScan.days.map((day: any) => [day.sunrise, day.sunset, day.tithiNameEn, day.nakshatraNameEn]),
  'Local Panchangam values are not calculated at the birthplace when the event location differs'
);

const normalized = normalizeMuhurthamScan({
  ...payload,
  muhurthamScan: {
    muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
    selectedMonth,
    eventKey: 'wedding',
    months: result.months,
    persons: result.persons
  }
});
assert.equal(normalized.muhurthamPlace, muhurtham.muhurthamPlace,
  'Order normalization keeps the event location for the delivered report');
assert.equal(normalized.birthPlace, birth.birthPlace,
  'Order normalization keeps the birthplace separately');

const legacyPayloadWithoutEventLocation = {
  ...birth,
  eventKey: 'wedding',
  selectedMonth,
  muhurthamScan: { months: result.months, persons: result.persons }
};
assert.throws(() => normalizeMuhurthamScan(legacyPayloadWithoutEventLocation), /separate Muhurtham location/,
  'A legacy scan without a separate event location is rejected instead of relabeling birthplace-based times');
assert.throws(() => computeMuhurthamResult({ inputPayload: legacyPayloadWithoutEventLocation }), /separate Muhurtham location/,
  'A missing event location is never silently replaced with the birthplace during rescan');

const html = buildMuhurthamHtml(normalized, 'en');
assert.match(html, /MUHURTHAM LOCATION \(LOCAL TIMES\)/,
  'The report labels the date/time location as the Muhurtham location');
assert.match(html, /New York, New York, United States/,
  'The report shows the location used for local date and time calculations');
assert.match(html, /Birth place for Janma Nakshatra: Suva, Fiji/,
  'The report separately identifies the birthplace used for Janma Nakshatra');

console.log('[PASS] Muhurtham birth-place and local-event-place calculations remain separate');

/* ------------------------------------------------------------------ *
 * Wedding-only two-chart rule
 * ------------------------------------------------------------------ */
{
  // Bride + groom are checked together for the ceremonies that join two people
  // (wedding, engagement). A second chart that arrives with any other ceremony -
  // a re-submitted couple order, a family edit or a hand-built API call - must
  // not change that person's dates.
  const buildEventPayload = (eventKey: string) => {
    const sample: any = buildSamplePayload('MUHURTHAM');
    const scan = sample.muhurthamScan;
    return {
      ...sample,
      eventKey,
      muhurthamScan: {
        ...scan,
        eventKey,
        inputContext: { ...scan.inputContext, eventKey },
        months: scan.months.map((month: any) => ({
          ...month,
          days: month.days.map((day: any) => ({
            ...day,
            personalChecks: [
              { role: 'groom', nakshatraIndex: 14, isTaraAuspicious: true, isChandrashtama: false, isJanmaNakshatra: false },
              { role: 'bride', nakshatraIndex: 22, isTaraAuspicious: false, isChandrashtama: false, isJanmaNakshatra: true }
            ],
            personalNoteEn: 'Bride: Janma Tara',
            personalNoteTa: 'மணமகள்: ஜன்ம தாரா',
            personalNoteHi: 'वधू: जन्म तारा'
          }))
        }))
      }
    };
  };

  for (const eventKey of ['wedding', 'engagement']) {
    const coupleResult: any = computeMuhurthamResultFromPayload({ inputPayload: buildEventPayload(eventKey) });
    assert.deepEqual(
      coupleResult.persons.map((person: any) => person.role).sort(),
      ['bride', 'groom'],
      `A ${eventKey} keeps BOTH charts`
    );
    const coupleDay = coupleResult.months[0].days[0];
    assert.ok(
      coupleDay.personalChecks.some((check: any) => check.role === 'bride' || check.role === 'groom'),
      `A ${eventKey} keeps the bride/groom per-date checks`
    );
  }

  for (const eventKey of ['namakaranam', 'seemantham', 'griha_pravesam', 'business_start', 'vehicle_purchase', 'new_job']) {
    const result: any = computeMuhurthamResultFromPayload({ inputPayload: buildEventPayload(eventKey) });
    assert.ok(
      !result.persons.some((person: any) => person.role === 'bride' || person.role === 'groom'),
      `${eventKey} must not be judged against a second chart (persons: ${JSON.stringify(result.persons.map((p: any) => p.role))})`
    );
    assert.equal(result.persons.length, 1, `${eventKey} keeps exactly one primary chart`);
    const day = result.months[0].days[0];
    assert.ok(
      !day.personalChecks.some((check: any) => check.role === 'bride' || check.role === 'groom'),
      `${eventKey} must not carry bride/groom per-date checks`
    );
    assert.equal(day.personalNoteEn, '', `${eventKey} must drop a note that names the removed chart`);
    assert.equal(day.personalNoteTa, '', `${eventKey} must drop the localized stale note`);
  }

  // The rebuild path (no stored scan) applies the same rule.
  for (const eventKey of ['wedding', 'engagement', 'namakaranam']) {
    const built = buildEventPayload(eventKey);
    const rebuilt: any = computeMuhurthamResultFromPayload({
      inputPayload: { ...built, muhurthamScan: undefined }
    });
    const roles = rebuilt.persons.map((person: any) => person.role).sort();
    const expectsCouple = eventKey === 'wedding' || eventKey === 'engagement';
    assert.deepEqual(
      roles,
      expectsCouple ? ['bride', 'groom'] : ['self'],
      `Rebuilt ${eventKey} report uses ${expectsCouple ? 'both charts' : 'one chart'}`
    );
  }

  console.log('[PASS] Only the two-person ceremonies (wedding, engagement) are checked against both charts');
}
