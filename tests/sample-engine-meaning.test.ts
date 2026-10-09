import { nameMatchesPada } from '../server/astrology/namakaranSound';
import assert from 'node:assert/strict';
import { calculatePrecisionHoroscope, calculateVimshottariDashaTimeline } from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { ALL_NAKSHATRA_LETTERS, calculateBabyNamingDetails } from '../server/astrology/babynames.js';
import { NAMAKARAN_BANK } from '../server/astrology/namakaranNameBank.js';
import {
  buildNamakaranNameProvenance,
  buildNamakaranPadaNames,
  buildNamakaranPadaNamesFromResult,
  fallbackAksharas
} from '../server/astrology/namakaranNames.js';
import { Graha, PoruthamStatus } from '../server/astrology/types.js';

// Fixed public sample inputs, deliberately independent of the report renderer.
const BIRTH = {
  dob: '2000-01-01', tob: '02:00', birthPlace: 'Chennai, Tamil Nadu, India',
  country: 'India', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5
};
const chart = calculatePrecisionHoroscope(
  'Karthik Raman', BIRTH.dob, BIRTH.tob, BIRTH.birthPlace,
  BIRTH.latitude, BIRTH.longitude, BIRTH.timezoneOffsetHours, BIRTH.country, 'M'
);
const birthPeriod = chart.dashaPeriods[0] as ReturnType<typeof calculateVimshottariDashaTimeline>['periods'][number];
assert.equal(birthPeriod.mahadashaLord, Graha.RAHU);
assert.equal(birthPeriod.startDate, '2000-01-01', 'The displayed first span remains the balance FROM birth');
assert.equal(birthPeriod.endDate, '2011-03-30', 'Do not restart or stretch the classical balance');
assert.equal(birthPeriod.years, 11.2);
assert.equal(birthPeriod.periodKind, 'BIRTH_BALANCE');
assert.equal(birthPeriod.fullYears, 18, 'The full Rahu Mahadasha is eighteen years, not its birth balance');
assert.equal(birthPeriod.fullStartDate, '1993-03-29');
assert.equal(birthPeriod.antardashas?.[0].startDate, birthPeriod.fullStartDate,
  'Reference Antardashas retain the classical pre-birth start');
assert.equal(birthPeriod.antardashas?.length, 9);
assert.equal(birthPeriod.antardashas?.[0].months, 32.4, 'Rahu/Rahu retains (18 × 18) / 120 years');
for (const text of [birthPeriod.descriptionEn, birthPeriod.descriptionTa, birthPeriod.descriptionHi]) {
  assert(text.includes(birthPeriod.fullStartDate), 'All languages identify the full period start separately');
}
for (const period of chart.dashaPeriods.slice(1) as typeof birthPeriod[]) {
  assert.equal(period.periodKind, 'FULL_MAHADASHA');
  assert.equal(period.fullStartDate, period.startDate);
  assert.equal(period.fullYears, period.years);
}
console.log('[PASS] Public Rahu sample distinguishes birth balance from full pre-birth Mahadasha');

const marriage = calculateWeddingCompatibility(
  { name: 'Priya Devi', ...BIRTH, dob: '1998-06-15', tob: '06:30', gender: 'F' },
  { name: 'Karthik Raman', ...BIRTH, gender: 'M' }
);
// The sample couple is groom Swati (Kanda Rajju) + bride Avittam/Dhanishta
// (Siro Rajju): DIFFERENT Rajju groups, so Rajju passes 5/5 and the verdict is
// recalculated from the corrected score. The old table put both stars in the
// Siro group, which failed the crucial gate and forced "not good".
assert.equal(marriage.rajjuMatch, true);
assert.equal(marriage.vedhaMatch, true);
assert.equal(marriage.poruthams.find(row => row.id === 'rajju')?.status, PoruthamStatus.UTTHAMAM);
assert.equal(marriage.poruthams.find(row => row.id === 'rajju')?.pointsEarned, 1.0);
assert.equal(marriage.poruthams.find(row => row.id === 'rajju')?.maxPoints, 1.0);
// Partial Yoni (2/4 in the PHP weighting) is Mathimam, never Uttamam.
assert.equal(marriage.poruthams.find(row => row.id === 'yoni')?.status, PoruthamStatus.MADHYAMAM);
assert.equal(marriage.poruthams.find(row => row.id === 'vedhai')?.status, PoruthamStatus.UTTHAMAM);
assert.equal(marriage.verdictStatus, PoruthamStatus.MADHYAMAM);
assert.match(marriage.overallVerdictEn, /Moderate match:/i);
assert.doesNotMatch(marriage.overallVerdictEn, /Critical/);
assert.equal(marriage.totalScore, 7.5);
assert.equal(marriage.totalPoruthamsMatched, 8);
const yoni = marriage.poruthams.find(row => row.id === 'yoni');
assert.equal(yoni?.yoniBrideAnimalEn, 'Lion');
assert.equal(yoni?.yoniGroomAnimalEn, 'Buffalo');
assert.equal(yoni?.yoniRelationship, 'neutral');
assert.equal(marriage.sevvayDosham.brideDoshamSeverityEn, 'Mild Sevvay Dosha');
assert.equal(marriage.sevvayDosham.groomDoshamSeverityEn, 'No Kuja Dosha');
assert.equal(marriage.sevvayDosham.groomMarsHouses?.lagna, 5);
assert.equal(marriage.sevvayDosham.isGroomHasDosham, false);
assert.ok(marriage.sevvayDosham.brideAfflictedFrom?.includes('venus'));
// Kuja guidance is scoped to Kuja alone and no longer repeats the crucial
// mismatch sentence a third time (the verdict already states it once).
assert.match(marriage.sevvayDosham.recommendationEn, /Kuja Dosha alone/);
for (const language of ['En', 'Ta', 'Hi'] as const) {
  const recommendation = marriage.sevvayDosham[`recommendation${language}`];
  assert.doesNotMatch(recommendation, /mismatch remains|பொருத்தமின்மை நீங்கவில்லை/,
    `${language} Kuja guidance must not repeat the Rajju/Vedha mismatch`);
}

// A balanced Kuja result is still not marriage approval when Rajju fails:
// both people here share the same Swati star, which is the SAME Rajju group.
const balancedButBlocked = calculateWeddingCompatibility(
  { name: 'Bride', ...BIRTH, gender: 'F' }, { name: 'Groom', ...BIRTH, gender: 'M' }
);
assert.equal(balancedButBlocked.sevvayDosham.isBrideHasDosham, balancedButBlocked.sevvayDosham.isGroomHasDosham);
assert.equal(balancedButBlocked.rajjuMatch, false);
assert.equal(balancedButBlocked.verdictStatus, PoruthamStatus.PORUNDHADHU);
assert.match(balancedButBlocked.overallVerdictEn, /Critical Rajju mismatch/);
assert.match(balancedButBlocked.sevvayDosham.recommendationEn, /not an overall marriage recommendation/);
assert.doesNotMatch(balancedButBlocked.sevvayDosham.recommendationEn, /mismatch remains/);
console.log('[PASS] Public marriage sample passes Avittam/Swati Rajju and scopes Kuja guidance');

const baby = calculateBabyNamingDetails({ babyName: 'Aarav', ...BIRTH, gender: 'M' });
assert.equal(baby.primaryPadaInfo.letterEn, 'Re / Ray');
assert.equal(baby.babyName, 'Aarav', 'Preserve the caller-supplied name, even when its initial differs');
assert.equal(baby.nameProvenance.suppliedName, 'Aarav');
assert.equal(baby.nameProvenance.status, 'SUPPLIED_NOT_CERTIFIED');
assert.match(baby.nameProvenance.noteEn, /not been certified/);
assert(!/[A-Za-z]/.test(baby.nameProvenance.noteTa));
assert(!/[A-Za-z]/.test(baby.nameProvenance.noteHi));
assert.equal(buildNamakaranNameProvenance('  ').status, 'NOT_SUPPLIED');
assert.equal(buildNamakaranNameProvenance('  Reyansh  ').suppliedName, 'Reyansh');
assert.equal(buildNamakaranNameProvenance('Reyansh').status, 'SUPPLIED_NOT_CERTIFIED',
  'Do not invent a compatibility certificate from a Roman-script prefix');
const primaryColumn = baby.nameSuggestions!.find(column => column.padaNumber === baby.janmaPada)!;
const reyansh = primaryColumn.north.find(entry => entry.name === 'Reyansh')!;
assert.equal(reyansh.sourceAksharaTa, 'ரே');
assert.equal(reyansh.isRelatedSound, false);
const rahul = primaryColumn.north.find(entry => entry.name === 'Rahul')!;
assert.equal(rahul.sourceAksharaTa, 'ரா');
assert.equal(rahul.isRelatedSound, true, 'Rahul is an alternative Ra sound, not an exact Re sound');
assert.equal(primaryColumn.usesRelatedSounds, true);

// Every generated name retains its real bank source. Tradition fallbacks and
// the existing all-pada/gender coverage stay intact, without pretending all
// names underneath a heading begin with that heading's exact akshara.
let checkedNames = 0;
for (const star of ALL_NAKSHATRA_LETTERS) {
  for (const gender of ['M', 'F'] as const) {
    for (const column of buildNamakaranPadaNames(star.padas, gender)) {
      const options = [...column.south, ...column.north];
      assert(options.length > 0);
      for (const option of options) {
        checkedNames++;
        assert(option.sourceAksharaTa);
        const source = NAMAKARAN_BANK[option.sourceAksharaTa][gender];
        assert([...source.south, ...source.north].some(entry => entry.n === option.name));
        assert.equal(option.isRelatedSound, !nameMatchesPada(option.name, column.soundTa));
        if (option.sourceAksharaTa !== column.soundTa) {
          assert(fallbackAksharas(column.soundTa).includes(option.sourceAksharaTa),
            'Only the existing documented varga/same-letter alternatives are used');
        }
      }
      assert.equal(column.usesRelatedSounds, options.some(option => option.isRelatedSound));
    }
  }
}

const legacy = structuredClone(baby);
for (const column of legacy.nameSuggestions!) {
  for (const option of [...column.south, ...column.north]) {
    delete option.sourceAksharaTa;
    delete option.isRelatedSound;
  }
}
assert.deepEqual(buildNamakaranPadaNamesFromResult(legacy), baby.nameSuggestions,
  'Cached name lists recover exact-versus-related sound provenance from the bank');
console.log(`[PASS] Supplied names are not certified; ${checkedNames} suggestions retain source/related sound identity`);
