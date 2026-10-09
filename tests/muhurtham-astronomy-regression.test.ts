import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import {
  computeDayMuhurtham,
  GURU_ASTA_ORB_DEG,
  isAdhikaMasa,
  isEventTithiAvoided,
  isGoodTithiForEvent,
  isInsideAstaWindow,
  SUKRA_ASTA_ORB_DEG,
  scanMonthMuhurtham
} from '../src/lib/muhurtham/scanner.js';

const CHENNAI = {
  placeName: 'Chennai, India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5,
  timeZoneId: 'Asia/Kolkata'
};

function day(year: number, month: number, date: number) {
  return computeDayMuhurtham(new Date(year, month - 1, date, 12), CHENNAI, 'wedding');
}

// Regression: the old 29-entry name table shifted the final Krishna tithis and
// displayed the actual Amavasya as Shukla Prathama.
const trayodashi = day(2026, 1, 16);
const chaturdashi = day(2026, 1, 17);
const amavasya = day(2026, 1, 18);
const shuklaPrathama = day(2026, 1, 19);

assert.equal(trayodashi.tithiIndex, 27);
assert.equal(trayodashi.tithiNameEn, 'Krishna Trayodashi (13)');
assert.equal(trayodashi.tithiNameTa, 'கிருஷ்ண திரயோதசி (13)');
assert.equal(trayodashi.tithiNameHi, 'कृष्ण त्रयोदशी (13)');
assert.equal(chaturdashi.tithiIndex, 28);
assert.equal(chaturdashi.tithiNameEn, 'Krishna Chaturdashi (14)');
assert.equal(amavasya.tithiIndex, 29);
assert.equal(amavasya.tithiNameEn, 'Amavasya (New Moon)');
assert.equal(amavasya.grade, 'AVOID', 'Actual Amavasya remains hard-vetoed');
assert.ok(amavasya.doshasEn.some(reason => reason.includes('Amavasya')));
assert.equal(shuklaPrathama.tithiIndex, 0);
assert.equal(shuklaPrathama.tithiNameEn, 'Shukla Prathama (1)');

// Tithi allowlists and vetoes must not mix zero-based lunation indices with
// one-based numbers within each paksha.
assert.equal(isGoodTithiForEvent('wedding', 0), false,
  'Wedding Shukla Prathama is not accidentally accepted as Tithi number 1');
assert.equal(isGoodTithiForEvent('wedding', 1), true,
  'Wedding Shukla Dwitiya is read from its zero-based lunation index');
assert.equal(isGoodTithiForEvent('business_start', 5), false,
  'Business-start Tithi number 6 is not accidentally accepted as index 5');
assert.equal(isGoodTithiForEvent('business_start', 6), true,
  'Business-start Tithi number 7 is correctly expanded to its Shukla index');
assert.equal(isEventTithiAvoided('business_start', 6), false,
  'Business-start avoids Shukla Ashtami, not the preceding Saptami');
assert.equal(isEventTithiAvoided('business_start', 7), true,
  'Business-start Ashtami is checked by its zero-based index');
assert.equal(isEventTithiAvoided('vehicle_purchase', 2), false,
  'Vehicle-purchase avoids Tithi index 3, not every Tithi number 3');
assert.equal(isEventTithiAvoided('vehicle_purchase', 3), true,
  'Vehicle-purchase Chaturthi is explicitly avoided');
assert.equal(isGoodTithiForEvent('vehicle_purchase', 8), false,
  'Vehicle-purchase Shukla Navami is not an accidental false positive');

// Regression: July 2023 contains Adhika Shravan. A backward phase search must
// identify the new moon even during the first day of the lunation; searching
// forward from date - 31 days incorrectly picked June's new moon until July 19.
const adhikaMonthNewMoon = Astronomy.SearchMoonPhase(
  0,
  new Astronomy.AstroTime(new Date(Date.UTC(2023, 6, 1))),
  45
);
assert.ok(adhikaMonthNewMoon, 'Astronomy engine must find the July 2023 new moon');
const conjunctionMs = adhikaMonthNewMoon.date.getTime();
const sixHoursBefore = new Date(conjunctionMs - 6 * 60 * 60 * 1000);
const sixHoursAfter = new Date(conjunctionMs + 6 * 60 * 60 * 1000);
const twoDaysAfter = new Date(conjunctionMs + 2 * 24 * 60 * 60 * 1000);
assert.equal(isAdhikaMasa(sixHoursBefore), false, 'The lunation before Adhika Masa is not Adhika');
assert.equal(isAdhikaMasa(sixHoursAfter), true, 'Adhika Masa begins at the July new moon');
assert.equal(isAdhikaMasa(twoDaysAfter), true, 'The opening lunar month stays Adhika after the boundary');

const previousLocalDay = day(2023, 7, 17);
const adhikaLocalDay = day(2023, 7, 18);
assert.equal(previousLocalDay.isAdhikaMasa, false);
assert.equal(adhikaLocalDay.isAdhikaMasa, true,
  'Closed lunar-month status is evaluated at the event location’s sunrise, not host-local noon');

console.log('[PASS] Muhurtham tithi labels and Adhika Masa new-moon boundary regressions');

/* ------------------------------------------------------------------ *
 * Sukra (Venus) asta — the orb and its boundary days
 * ------------------------------------------------------------------ */

// The report must use the same classical orb the rest of the engine uses
// (10° for Sukra, 11° for Guru) and drop the boundary days as well, because the
// elongation moves by more than a degree a day around the inferior conjunction.
assert.equal(SUKRA_ASTA_ORB_DEG, 10, 'Sukra asta orb is the shared classical 10°');
assert.equal(GURU_ASTA_ORB_DEG, 11, 'Guru asta orb is the shared classical 11°');
assert.equal(isInsideAstaWindow(9.9, SUKRA_ASTA_ORB_DEG), true, 'A planet 9.9° from the Sun is in asta');
assert.equal(isInsideAstaWindow(10.5, SUKRA_ASTA_ORB_DEG), true,
  'The boundary margin keeps a just-outside day out of the recommended list');
assert.equal(isInsideAstaWindow(11.6, SUKRA_ASTA_ORB_DEG), false,
  'A day beyond the 10° orb + 1.5° boundary margin is usable');

// Venus inferior conjunction: 24 Oct 2026. With the classical orb + boundary
// margin the entire 17–31 Oct window is asta, so the edge dates the field
// report named (19 Oct and 30 Oct) can never be recommended.
// The measured window is 17–31 Oct 2026 (Venus 12.7° on 16 Oct, 10.9° on
// 31 Oct); 16 Oct and 1 Nov fall outside the 10° orb plus the boundary margin.
const astaDays = [17, 19, 24, 30, 31];
for (const astaDate of astaDays) {
  const combustDay = computeDayMuhurtham(new Date(2026, 9, astaDate, 12), CHENNAI, 'wedding');
  assert.equal(combustDay.planetaryHighlights.sukraCombust, true,
    `${combustDay.date} sits inside the Sukra asta window`);
  assert.notEqual(combustDay.grade, 'BEST', `${combustDay.date} is never rated Uttamam during Sukra asta`);
  assert.notEqual(combustDay.grade, 'GOOD', `${combustDay.date} is not recommended during Sukra asta`);
}
// 16 Oct is just outside the orb: the boundary margin is what keeps it out of
// the window, and it may not be recommended either unless it clears the orb.
assert.equal(
  computeDayMuhurtham(new Date(2026, 9, 16, 12), CHENNAI, 'wedding').planetaryHighlights.sukraCombust,
  false,
  '16 Oct 2026 is still outside the 10° orb itself'
);

// ... and a scan of the whole asta window recommends nothing inside it.
{
  const astaMonths = [new Date(2026, 9, 1), new Date(2026, 10, 1)];
  const insideAsta: string[] = [];
  for (const monthDate of astaMonths) {
    const scan = scanMonthMuhurtham(
      monthDate.getFullYear(), monthDate.getMonth() + 1, CHENNAI, 'wedding', { skipPastDates: false }
    );
    for (const scannedDay of scan.days) {
      if (scannedDay.planetaryHighlights.sukraCombust &&
          (scannedDay.grade === 'BEST' || scannedDay.grade === 'GOOD')) {
        insideAsta.push(scannedDay.date);
      }
    }
  }
  assert.deepEqual(insideAsta, [], 'No recommended date falls inside the Sukra asta window');
}

/* ------------------------------------------------------------------ *
 * Bride + groom: Chandrashtama, Tara Bala and Janma Nakshatra
 * ------------------------------------------------------------------ */

const SAMPLE_GROOM = { nakshatraIndex: 14, rasiNumber: 7 };   // Swati / Thulam
const SAMPLE_BRIDE = { nakshatraIndex: 22, rasiNumber: 10 };  // Dhanishta / Magaram
const couple = [
  { role: 'groom' as const, nakshatraIndex: SAMPLE_GROOM.nakshatraIndex, rasiNumber: SAMPLE_GROOM.rasiNumber },
  { role: 'bride' as const, nakshatraIndex: SAMPLE_BRIDE.nakshatraIndex, rasiNumber: SAMPLE_BRIDE.rasiNumber }
];
const coupleOptions = { persons: couple, birthDate: '2000-01-01', skipPastDates: false };
const coupleDay = (year: number, month: number, date: number) =>
  computeDayMuhurtham(new Date(year, month - 1, date, 12), CHENNAI, 'wedding', coupleOptions);

// The groom's own birth star day (Swati, 26 Feb 2027) is dropped from the list.
const groomJanmaDay = coupleDay(2027, 2, 26);
assert.equal(groomJanmaDay.nakshatraIndex, SAMPLE_GROOM.nakshatraIndex);
assert.equal(
  groomJanmaDay.personalChecks.find(check => check.role === 'groom')?.isJanmaNakshatra,
  true,
  'A day in the groom’s own Janma Nakshatra is flagged from the computed star'
);
assert.notEqual(groomJanmaDay.grade, 'GOOD', 'The groom’s Janma Nakshatra day is never recommended');
assert.notEqual(groomJanmaDay.grade, 'BEST', 'The groom’s Janma Nakshatra day is never Uttamam');
assert.ok(
  groomJanmaDay.doshasEn.some(text => text.includes('Janma Nakshatra')),
  'The Janma Nakshatra exclusion is explained on the date'
);

// Chandrashtama is the Moon in the 8th sign from a person's Rasi: 26 Nov 2026
// has the Moon in Rishabam, which is the 8th from the groom's Thulam.
const groomChandrashtamaDay = coupleDay(2026, 11, 26);
const groomCheck = groomChandrashtamaDay.personalChecks.find(check => check.role === 'groom');
assert.equal(groomCheck?.isChandrashtama, true, 'The groom’s Chandrashtama is derived from the day Moon sign');
assert.notEqual(groomChandrashtamaDay.grade, 'GOOD', 'A Chandrashtama day is never recommended for that person');

// The bride's Janma Tara (Mrigashira is 10th from Dhanishta) blocks a BEST
// grade on the Mrigashira dates, and the per-date note names her.
const mrighashiraDay = coupleDay(2027, 1, 20);
const brideCheck = mrighashiraDay.personalChecks.find(check => check.role === 'bride');
assert.equal(brideCheck?.isTaraAuspicious, false, 'The bride’s Janma Tara is not treated as auspicious');
assert.notEqual(mrighashiraDay.grade, 'BEST', 'An Uttamam date needs a good Tara Bala for BOTH people');
assert.ok(mrighashiraDay.personalNoteEn.length > 0, 'Every checked date carries a short Chandrashtama / Tara Bala note');
assert.ok(mrighashiraDay.personalNoteTa.length > 0, 'The per-date note is localized for the Tamil report');

// A scan with both charts recommends no date that fails either person.
{
  const failureDays: string[] = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const monthDate = new Date(2026, 9 + offset, 1);
    const scan = scanMonthMuhurtham(
      monthDate.getFullYear(), monthDate.getMonth() + 1, CHENNAI, 'wedding', coupleOptions
    );
    for (const scannedDay of scan.days) {
      const failed = scannedDay.personalChecks.some(check => check.isChandrashtama || check.isJanmaNakshatra);
      if (failed && (scannedDay.grade === 'BEST' || scannedDay.grade === 'GOOD')) {
        failureDays.push(scannedDay.date);
      }
    }
  }
  assert.deepEqual(failureDays, [],
    'No recommended date is a Chandrashtama or Janma Nakshatra day for either the bride or the groom');
}

// One chart only: the checks stay honest about what was verified.
const singlePersonDay = computeDayMuhurtham(
  new Date(2027, 1, 26, 12), CHENNAI, 'wedding',
  { persons: [couple[0]], birthDate: '2000-01-01', skipPastDates: false }
);
assert.equal(singlePersonDay.personalChecks.length, 1, 'A single-person scan checks exactly one chart');

console.log('[PASS] Muhurtham bride + groom, Janma Nakshatra, Chandrashtama and Sukra asta rules');
