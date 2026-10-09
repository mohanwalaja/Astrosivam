/**
 * TypeScript↔PHP parity for the Birth Jathagam page 3 (Short Summary).
 *
 * tests/fixtures/jathagam-summary-parity.json freezes, per chart and language,
 * the input the rule reads and the supportive / needs-care lists the page must
 * print. This suite checks the TypeScript engine against that contract; the PHP suite
 * tests/jathagam-summary-parity.test.php checks the mPDF engine against the
 * same file, so the two stacks can never disagree about which grahas a chart
 * flags ("Node and PHP agree on the planet lists for the same chart").
 *
 * Regenerate the fixture with `npx tsx scripts/emit-jathagam-summary-parity.ts`
 * only when the rule changes on purpose.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyJathagamPlanetsForSummary, SummaryChartInput } from '../src/services/jathagamPlanetSummary';
import {
  NAVAGRAHA_DOSHA_DATA,
  NAVAGRAHA_ORDER,
  SHORT_SUMMARY_LAMP_OIL,
  SHORT_SUMMARY_MANTRA,
  SHORT_SUMMARY_REMEDY_LABELS,
  SHORT_SUMMARY_TEXT,
  DoshaLanguage
} from '../src/services/jathagamDoshaData';

interface ParityCase {
  id: string;
  chart: string;
  lang: DoshaLanguage;
  input: SummaryChartInput;
  expected: ReturnType<typeof classifyJathagamPlanetsForSummary>;
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/jathagam-summary-parity.json', import.meta.url), 'utf8')
) as { cases: ParityCase[] };
const LANGUAGES: DoshaLanguage[] = ['en', 'ta', 'hi'];

assert.ok(fixture.cases.length >= 15, 'the parity fixture covers every chart in three languages');

// ---------------------------------------------------------------------------
// 1. The TypeScript engine reproduces the frozen lists exactly.
// ---------------------------------------------------------------------------
for (const testCase of fixture.cases) {
  const actual = classifyJathagamPlanetsForSummary(testCase.input, testCase.lang);
  assert.deepEqual(
    actual.supportive.map(planet => planet.key),
    testCase.expected.supportive.map(planet => planet.key),
    `${testCase.id}: supportive list`
  );
  assert.deepEqual(
    actual.needsCare.map(planet => planet.key),
    testCase.expected.needsCare.map(planet => planet.key),
    `${testCase.id}: needs-care list`
  );
  assert.equal(actual.compact, testCase.expected.compact, `${testCase.id}: compact flag`);
  assert.equal(actual.assessedCount, testCase.expected.assessedCount, `${testCase.id}: assessed count`);
  assert.equal(actual.assessmentComplete, testCase.expected.assessmentComplete, `${testCase.id}: assessment completeness`);
}

// The remedy lines are part of the contract too: the page prints them.
for (const testCase of fixture.cases) {
  const actual = classifyJathagamPlanetsForSummary(testCase.input, testCase.lang);
  for (const [index, planet] of actual.needsCare.entries()) {
    const expected = testCase.expected.needsCare[index];
    for (const field of ['difficulties', 'worship', 'lamp', 'donation', 'mantra', 'compactLine'] as const) {
      assert.equal(
        (planet as unknown as Record<string, string>)[field],
        (expected as unknown as Record<string, string>)[field],
        `${testCase.id}: ${planet.key} ${field}`
      );
    }
  }
  for (const [index, planet] of actual.supportive.entries()) {
    const reference = NAVAGRAHA_DOSHA_DATA[planet.key];
    assert.ok(reference, `${testCase.id}: supportive ${planet.key} exists in the reference data`);
  }
}
console.log('[PASS] Node reproduces the frozen page-3 lists and remedy lines for every fixture case');

// ---------------------------------------------------------------------------
// 2. The lists are language-independent; only the wording changes.
// ---------------------------------------------------------------------------
for (const chart of new Set(fixture.cases.map(testCase => testCase.chart))) {
  const keysOf = (lang: DoshaLanguage) => {
    const testCase = fixture.cases.find(candidate => candidate.chart === chart && candidate.lang === lang);
    assert.ok(testCase, `${chart} has a ${lang} case`);
    return [
      testCase.expected.supportive.map(planet => planet.key).join(','),
      testCase.expected.needsCare.map(planet => planet.key).join(','),
      String(testCase.expected.compact),
      String(testCase.expected.assessmentComplete)
    ].join('|');
  };
  assert.equal(keysOf('ta'), keysOf('en'), `${chart}: Tamil lists match English`);
  assert.equal(keysOf('hi'), keysOf('en'), `${chart}: Hindi lists match English`);
}
console.log('[PASS] Page-3 planet lists are language-independent in every fixture chart');

// ---------------------------------------------------------------------------
// 3. The worst case is complete: all nine grahas, compact, nothing hidden.
// ---------------------------------------------------------------------------
for (const lang of LANGUAGES) {
  const allNine = fixture.cases.find(testCase => testCase.id === `all-nine-needing-care|${lang}`);
  assert.ok(allNine, `all-nine case exists for ${lang}`);
  assert.equal(allNine.expected.compact, true, `${lang}: nine flagged grahas switch to the compact table`);
  assert.equal(allNine.expected.needsCare.length, NAVAGRAHA_ORDER.length, `${lang}: every graha is shown`);
  assert.equal(allNine.expected.supportive.length, 0, `${lang}: a graha needing care is never also counted supportive`);
  for (const planet of allNine.expected.needsCare) {
    assert.ok(planet.compactLine.trim(), `${lang}: ${planet.key} keeps its one-line remedy`);
    assert.ok(planet.difficulties.trim(), `${lang}: ${planet.key} keeps its difficulty line`);
  }
}
const normalCase = fixture.cases.find(testCase => testCase.id === 'normal-priya|en');
assert.ok(normalCase && normalCase.expected.compact === false, 'four flagged grahas stay in the full table');
console.log('[PASS] Compact mode keeps all nine grahas and the normal case stays full-height');

// ---------------------------------------------------------------------------
// 4. Every remedy line still comes from the Navagraha reference data, in all
//    three languages, and every page-3 string exists in all three languages.
// ---------------------------------------------------------------------------
for (const lang of LANGUAGES) {
  const labels = SHORT_SUMMARY_REMEDY_LABELS[lang];
  for (const label of ['worship', 'lamp', 'donation', 'mantra'] as const) {
    assert.ok(labels[label] && labels[label].trim(), `${lang}: remedy label "${label}" exists`);
  }
  for (const key of NAVAGRAHA_ORDER) {
    const reference = NAVAGRAHA_DOSHA_DATA[key];
    assert.ok(reference, `${key}: still in the Navagraha reference data`);
    for (const field of ['deity', 'day', 'charity'] as const) {
      assert.ok(reference[field][lang] && reference[field][lang].trim(), `${key} (${lang}): ${field} intact`);
    }
    assert.ok(SHORT_SUMMARY_LAMP_OIL[key][lang], `${key} (${lang}): lamp oil`);
    assert.ok(SHORT_SUMMARY_MANTRA[key][lang], `${key} (${lang}): mantra`);
  }
}
for (const testCase of fixture.cases) {
  for (const planet of testCase.expected.needsCare) {
    const reference = NAVAGRAHA_DOSHA_DATA[planet.key];
    assert.ok(
      planet.worship.includes(reference.deity[testCase.lang]),
      `${testCase.id}: ${planet.key} worship line quotes the reference deity`
    );
    // The donation line is one or two items picked from that graha's reference
    // charity list (naming may differ slightly: "Toor dal" for the reference's
    // "Red lentils"), so require a shared meaningful token instead of equality.
    const charity = reference.charity[testCase.lang].toLowerCase();
    const sharesToken = planet.donation
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(token => token.length >= 3)
      .some(token => charity.includes(token));
    assert.ok(
      sharesToken,
      `${testCase.id}: ${planet.key} donation line comes from the reference charity list`
    );
  }
}
const textKeys = Object.keys(SHORT_SUMMARY_TEXT.en);
assert.ok(textKeys.length >= 15, 'the page-3 string table is complete');
for (const lang of LANGUAGES) {
  for (const key of textKeys) {
    const value = (SHORT_SUMMARY_TEXT[lang] as unknown as Record<string, string>)[key];
    assert.equal(typeof value, 'string', `${lang}.${key} is a string`);
    const english = (SHORT_SUMMARY_TEXT.en as unknown as Record<string, string>)[key];
    // `summaryFaith` is a reserved, intentionally empty slot in every language,
    // and `compactModeNote` is only printed in compact mode (empty in English by
    // design). Every other key must carry text in every language.
    const optionalInEnglish = english === '';
    if (!optionalInEnglish) {
      assert.ok(value.trim(), `${lang}.${key} is not empty`);
      if (lang !== 'en' && !english.includes('{')) {
        assert.notEqual(value, english, `${lang}.${key} is translated, not copied from English`);
      }
    }
  }
}
console.log('[PASS] Remedy lines come from the Navagraha reference data and every page-3 string is translated');

// ---------------------------------------------------------------------------
// 5. An unreadable placement never reads as a clean chart.
// ---------------------------------------------------------------------------
const partial: SummaryChartInput = {
  lagnaRasi: 5,
  planetPositions: [{ graha: 'sun', rasi: 5, degrees: 10, bhavaNumber: 1, isCombust: false }]
};
const partialResult = classifyJathagamPlanetsForSummary(partial, 'en');
assert.equal(partialResult.assessmentComplete, false, 'a partial chart is not reported as complete');
assert.equal(partialResult.assessedCount, 1, 'only the readable placement is counted');
assert.ok(partialResult.incompleteNote.trim(), 'the incomplete note has text to print');
for (const lang of LANGUAGES) {
  const localized = classifyJathagamPlanetsForSummary(partial, lang);
  assert.ok(localized.incompleteNote.trim(), `${lang}: the incomplete note is translated`);
  assert.notEqual(localized.incompleteNote, '', `${lang}: the note is not empty`);
}
console.log('[PASS] A chart with an unreadable placement is marked incomplete instead of clean');

console.log('\nAll Birth Jathagam page-3 parity checks passed (Node side).');
