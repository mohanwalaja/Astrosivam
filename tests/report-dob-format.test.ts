import assert from 'node:assert/strict';
import { formatBirthDate } from '../src/services/formatUtils.js';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder.js';
import { buildWeddingMatchHtml } from '../src/services/weddingHtmlBuilder.js';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder.js';
import { buildMuhurthamHtml } from '../src/services/muhurthamHtmlBuilder.js';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../src/lib/astrology/matchmaking.js';
import { calculateBabyNamingDetails } from '../src/lib/astrology/babynames.js';

// Every report PDF prints the date of birth as DD/MM/YYYY (e.g. 27/07/1990).

// ── 1. The shared formatter ────────────────────────────────────────────────
assert.equal(formatBirthDate('1990-07-27'), '27/07/1990', 'ISO date becomes DD/MM/YYYY');
assert.equal(formatBirthDate('1990-7-5'), '05/07/1990', 'single-digit parts are zero-padded');
assert.equal(formatBirthDate('1990-07-27T00:00:00'), '27/07/1990', 'a time suffix is ignored');
assert.equal(formatBirthDate('1990-07-27 00:00:00'), '27/07/1990', 'a SQL datetime is accepted');
assert.equal(formatBirthDate('1990/07/27'), '27/07/1990', 'YYYY/MM/DD is accepted');
assert.equal(formatBirthDate('27-07-1990'), '27/07/1990', 'day-first hyphen form is normalised');
assert.equal(formatBirthDate('27/07/1990'), '27/07/1990', 'already-correct value is unchanged');
assert.equal(formatBirthDate(''), '', 'empty stays empty');
assert.equal(formatBirthDate(undefined), '', 'missing stays empty');
assert.equal(formatBirthDate('unknown'), 'unknown', 'unrecognised text is passed through');
console.log('[PASS] formatBirthDate renders DD/MM/YYYY');

const BIRTH = {
  tob: '06:30', birthPlace: 'Chennai, Tamil Nadu, India', country: 'India',
  latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5
};

const expectDob = (label: string, html: string, expected: string, legacy: string[]) => {
  assert(html.includes(expected), `${label}: shows DOB as ${expected}`);
  for (const old of legacy) {
    assert(!html.includes(`>${old}<`) && !html.includes(`>${old} (`), `${label}: no legacy DOB "${old}"`);
  }
  console.log(`[PASS] ${label} prints DOB as ${expected}`);
};

// ── 2. Birth Jathagam ──────────────────────────────────────────────────────
const chart = calculatePrecisionHoroscope(
  'Priya Devi', '1990-07-27', BIRTH.tob, BIRTH.birthPlace,
  BIRTH.latitude, BIRTH.longitude, BIRTH.timezoneOffsetHours, BIRTH.country, 'F'
);
for (const lang of ['en', 'ta', 'hi'] as const) {
  expectDob(`Jathagam (${lang})`, buildJathagamHtml(chart, lang), '27/07/1990', ['27-07-1990', '1990-07-27']);
}

// ── 3. Marriage compatibility ──────────────────────────────────────────────
const match = calculateWeddingCompatibility(
  { name: 'Priya Devi', ...BIRTH, dob: '1990-07-27', gender: 'F' },
  { name: 'Karthik Raman', ...BIRTH, dob: '1988-01-03', tob: '02:00', gender: 'M' }
);
for (const lang of ['en', 'ta', 'hi'] as const) {
  const html = buildWeddingMatchHtml(match, lang);
  expectDob(`Marriage bride (${lang})`, html, '27/07/1990', ['27-07-1990']);
  expectDob(`Marriage groom (${lang})`, html, '03/01/1988', ['03-01-1988']);
}

// ── 4. Baby naming ─────────────────────────────────────────────────────────
const baby = calculateBabyNamingDetails('Aarav', '2024-03-09', '02:00', 'Chennai', 'M', 13.0827, 80.2707, 5.5, 'India');
for (const lang of ['en', 'ta', 'hi'] as const) {
  expectDob(`Baby naming (${lang})`, buildBabyNamingHtml(baby, lang), '09/03/2024', ['09-03-2024']);
}

// ── 5. Muhurtham ───────────────────────────────────────────────────────────
for (const lang of ['en', 'ta', 'hi'] as const) {
  const html = buildMuhurthamHtml({
    devoteeName: 'Priya Devi', dob: '1990-07-27', tob: '06:30', birthPlace: 'Chennai',
    eventKey: 'wedding', months: [],
    persons: [
      { role: 'bride', name: 'Priya Devi', dob: '1990-07-27', tob: '06:30', nakshatraIndex: 22, rasiNumber: 10 },
      { role: 'groom', name: 'Karthik Raman', dob: '1988-01-03', tob: '02:00', nakshatraIndex: 14, rasiNumber: 7 }
    ],
    personalCheckMode: 'both'
  }, lang);
  expectDob(`Muhurtham bride (${lang})`, html, '27/07/1990', ['27 Jul 1990']);
  expectDob(`Muhurtham groom (${lang})`, html, '03/01/1988', ['03 Jan 1988']);
}

console.log('\nAll report DOB format checks passed.');
