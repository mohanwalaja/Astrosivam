import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Graha, HoroscopeResult } from '../src/lib/astrology/types.js';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy.js';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder.js';
import {
  GRAHA_LUCKY_PROFILES,
  LUCKY_INDICATOR_TEXT,
  NAKSHATRA_LORD_CYCLE,
  nakshatraLordForIndex,
  rasiLordForNumber,
  resolveLuckyIndicators
} from '../src/services/jathagamLuckyData.js';

/**
 * Birth Jathagam page 3 — birth stone / lucky colour / lucky numbers.
 *
 *   1. the nakshatra lord cycle is the Vimshottari order (Ketu … Budha ×3);
 *   2. the stone / colour / numbers per lord match the Tamil sources frozen in
 *      jathagamLuckyData.ts (Samayam Tamil 27-nakshatra table etc.);
 *   3. unreadable inputs print N/A, never a fabricated stone;
 *   4. the page-3 HTML prints the card in all three languages;
 *   5. the PHP mirror carries the same lord→stone/colour/number table.
 */

// 1. Lord cycle
assert.deepEqual(NAKSHATRA_LORD_CYCLE, [
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI,
  Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
]);
assert.equal(nakshatraLordForIndex(0), Graha.KETU, 'Aswini → Ketu');
assert.equal(nakshatraLordForIndex(2), Graha.SURYA, 'Karthigai → Surya');
assert.equal(nakshatraLordForIndex(9), Graha.KETU, 'Magam → Ketu');
assert.equal(nakshatraLordForIndex(16), Graha.SANI, 'Anusham → Sani');
assert.equal(nakshatraLordForIndex(26), Graha.BUDHA, 'Revathi → Budha');
assert.equal(nakshatraLordForIndex(27), null);
assert.equal(nakshatraLordForIndex(-1), null);
assert.equal(nakshatraLordForIndex('x'), null);
assert.equal(rasiLordForNumber(1), Graha.CHEVVAI);
assert.equal(rasiLordForNumber(12), Graha.GURU);
assert.equal(rasiLordForNumber(13), null);
assert.equal(rasiLordForNumber(0), null);

// 2. Tamil source table (Samayam Tamil, 27 நட்சத்திரங்கள் by lord)
const expectedTa: Record<string, { stone: string; colour: string; numbers: number[]; n: number }> = {
  [Graha.SURYA]: { stone: 'மாணிக்கம்', colour: 'சிவப்பு', numbers: [1, 5, 7], n: 1 },
  [Graha.CHANDRA]: { stone: 'முத்து', colour: 'வெள்ளை', numbers: [2, 3, 9], n: 2 },
  [Graha.CHEVVAI]: { stone: 'பவளம்', colour: 'இளஞ்சிவப்பு', numbers: [3, 6, 9], n: 9 },
  [Graha.BUDHA]: { stone: 'மரகதம்', colour: 'பச்சை', numbers: [1, 5, 8], n: 5 },
  [Graha.GURU]: { stone: 'புஷ்பராகம்', colour: 'மஞ்சள்', numbers: [2, 3, 9], n: 3 },
  [Graha.SUKRA]: { stone: 'வைரம்', colour: 'வெள்ளை', numbers: [3, 6, 8], n: 6 },
  [Graha.SANI]: { stone: 'நீலம்', colour: 'கருநீலம் / கருப்பு', numbers: [5, 6, 8], n: 8 },
  [Graha.RAHU]: { stone: 'கோமேதகம்', colour: 'கருப்பு', numbers: [1, 4, 7], n: 4 },
  [Graha.KETU]: { stone: 'வைடூரியம்', colour: 'சிவப்பு கலந்த பல நிறங்கள்', numbers: [5, 7, 9], n: 7 }
};
for (const [key, exp] of Object.entries(expectedTa)) {
  const p = GRAHA_LUCKY_PROFILES[key];
  assert.ok(p, `${key} profile exists`);
  assert.equal(p.stone.ta, exp.stone, `${key} Tamil stone`);
  assert.equal(p.colour.ta, exp.colour, `${key} Tamil colour`);
  assert.deepEqual(p.luckyNumbers, exp.numbers, `${key} lucky numbers`);
  assert.equal(p.number, exp.n, `${key} graha number`);
  for (const lang of ['en', 'ta', 'hi'] as const) {
    assert.ok(p.stone[lang] && p.colour[lang], `${key} has ${lang} stone and colour`);
  }
}
const numbers = Object.values(GRAHA_LUCKY_PROFILES).map(p => p.number).sort((a, b) => a - b);
assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'the nine graha numbers are 1..9 exactly once');

// 3. Resolution
const ta = resolveLuckyIndicators(2, 'ta'); // Karthigai → Surya
assert.equal(ta.birthStone, 'மாணிக்கம்');
assert.equal(ta.luckyColour, 'சிவப்பு');
assert.equal(ta.luckyNumbers, '1, 5, 7');
assert.equal(ta.nakshatraLordName, 'சூரியன்');
const en = resolveLuckyIndicators(7, 'en'); // Poosam → Sani
assert.equal(en.birthStone, 'Blue Sapphire (Neelam)');
assert.equal(en.luckyColour, 'Dark blue / Black');
assert.equal(en.luckyNumbers, '5, 6, 8');
const bad = resolveLuckyIndicators(undefined, 'en');
assert.equal(bad.birthStone, 'N/A');
assert.equal(bad.nakshatraLord, null);
const badTa = resolveLuckyIndicators(null, 'ta');
assert.equal(badTa.luckyNumbers, LUCKY_INDICATOR_TEXT.ta.unavailable);
console.log('[PASS] lucky-indicator table and resolution');

// 4. Page-3 HTML
const chart: HoroscopeResult = calculatePrecisionHoroscope(
  'Lucky Test', '1990-01-05', '12:00', 'Chennai, Tamil Nadu, India', 13.0827, 80.2707, 5.5, 'India', 'M'
);
for (const lang of ['en', 'ta', 'hi'] as const) {
  const html = buildJathagamHtml(chart, lang);
  const page3Start = html.indexOf('id="jathagam-page-3"');
  const luckyPos = html.indexOf('id="summary-lucky"');
  assert.ok(page3Start > 0 && luckyPos > page3Start, `${lang}: lucky card sits on page 3`);
  const resolved = resolveLuckyIndicators(chart.janmaNakshatraIndex, lang);
  const t = LUCKY_INDICATOR_TEXT[lang];
  for (const needle of [t.title, t.birthStone, t.luckyColour, t.luckyNumbers,
    resolved.birthStone, resolved.luckyColour, resolved.luckyNumbers]) {
    const escaped = needle.replace(/&/g, '&amp;').replace(/'/g, '&#039;');
    assert.ok(html.includes(escaped) || html.includes(needle), `${lang}: page prints "${needle}"`);
  }
  assert.ok(!html.includes('>N/A<') || resolved.nakshatraLord === null, `${lang}: real chart never prints N/A for lucky data`);
  assert.ok(!html.includes('id="lucky-rasi-row"') && !html.includes(t.rasiStone + '</span>'), `${lang}: no rasi-based row is printed`);
}
console.log('[PASS] page 3 prints the lucky-indicator card in en / ta / hi');

// 5. PHP mirror carries the same table
const php = readFileSync(new URL('../api/astrology/pdf_mpdf_reports.php', import.meta.url), 'utf8');
assert.ok(php.includes('function resolveJathagamLuckyIndicators'), 'PHP resolver exists');
assert.ok(php.includes('class="summary-card lucky"'), 'PHP page 3 prints the lucky card');
for (const [, exp] of Object.entries(expectedTa)) {
  assert.ok(php.includes(`'ta' => '${exp.stone}'`), `PHP has Tamil stone ${exp.stone}`);
  assert.ok(php.includes(`'luckyNumbers' => [${exp.numbers.join(', ')}]`), `PHP has numbers ${exp.numbers}`);
}
assert.ok(php.includes("['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury']"), 'PHP lord cycle');
console.log('[PASS] PHP mirror matches the Node lucky-indicator table');
