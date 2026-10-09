import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DOSHA_DATA,
  GENERIC_DEVOTIONAL_REMEDY,
  NAVAGRAHA_DOSHA_DATA,
  NAVAGRAHA_ORDER,
  NO_DOSHA_REMEDY_NOTE,
  PRAYER_GUIDANCE,
  SHORT_SUMMARY_REMEDY_LABELS,
  SHORT_SUMMARY_TEXT
} from '../src/services/jathagamDoshaData';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy';
import {
  buildJathagamHtml,
  buildNavagrahaReferenceTableHtml,
  navagrahaReferenceNote
} from '../src/services/jathagamHtmlBuilder';
import { classifyJathagamPlanetsForSummary } from '../src/services/jathagamPlanetSummary';

// Chart-specific prayer suggestions stay short: no ritual directions, no
// pilgrimage, no fasting rules. (Page 3's Short Summary is the one surface that
// names a lamp, a donation and a mantra, because the change request for that
// page asks for exactly those four labelled lines; every other surface keeps
// the original restriction, which is still asserted below.)
const restrictedInstructions = /mantra|manthra|chanting|chalisa|namah|japa|fasting|donat|lamp|abhishek|tarpanam|மந்திர|தீபம்|தானம்|தர்ப்பணம்|मंत्र|जाप|दीपक|दान|तर्पण/i;
const languages = ['en', 'ta', 'hi'] as const;
const chart = calculatePrecisionHoroscope('Remedy Test', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M');
const phpEngine = readFileSync(new URL('../api/astrology/engine.php', import.meta.url), 'utf8');
const phpReports = readFileSync(new URL('../api/astrology/pdf_mpdf_reports.php', import.meta.url), 'utf8');
const builderSource = readFileSync(new URL('../src/services/jathagamHtmlBuilder.ts', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// 1. The dosha remedy data is untouched, and so is its PHP mapping.
// ---------------------------------------------------------------------------
for (const [index, dosha] of Object.values(DOSHA_DATA).entries()) {
  for (const lang of languages) {
    const suffix = { en: 'En', ta: 'Ta', hi: 'Hi' }[lang] as 'En' | 'Ta' | 'Hi';
    const remedy = dosha.remedies[lang];
    assert.equal(remedy.length, 1, `${dosha.name.en}: one simple prayer`);
    assert.ok(remedy[0].trim(), `${dosha.name.en} (${lang}) remedy is not empty`);
    assert.doesNotMatch(remedy[0], restrictedInstructions);
    assert.equal(chart.doshas[index][`traditionalRemedy${suffix}`], remedy[0], 'Node and browser remedies agree');
    assert.ok(phpEngine.includes(`'traditionalRemedy${suffix}' => '${remedy[0]}'`), 'PHP and browser remedies agree');
  }
}

// ---------------------------------------------------------------------------
// 2. The Navagraha reference data is untouched (it is page 3's remedy source).
// ---------------------------------------------------------------------------
for (const [graha, info] of Object.entries(NAVAGRAHA_DOSHA_DATA)) {
  for (const lang of languages) {
    const remedy = info.remedies[lang];
    assert.ok(remedy.trim(), `${graha} (${lang}) remedy is not empty`);
    assert.doesNotMatch(remedy, restrictedInstructions, `${graha} (${lang}) stays a simple prayer`);
  }
  for (const lang of languages) {
    const phpField = { en: 'remEn', ta: 'remTa', hi: 'remHi' }[lang];
    assert.ok(phpEngine.includes(`'${phpField}' => '${info.remedies[lang]}'`), `${graha} PHP mapping matches (${lang})`);
  }
}

for (const dosha of chart.doshas.filter(d => d.isPresent)) {
  assert.ok(dosha.traditionalRemedyEn.trim(), `${dosha.nameEn} English remedy is not empty`);
  assert.ok(dosha.traditionalRemedyTa.trim(), `${dosha.nameEn} Tamil remedy is not empty`);
  assert.ok(dosha.traditionalRemedyHi.trim(), `${dosha.nameEn} Hindi remedy is not empty`);
}

// The generic prayer blocks stay out of the report (unchanged policy).
for (const lang of languages) {
  const html = buildJathagamHtml(chart, lang);
  assert.doesNotMatch(html, /General Guidelines|Ways to Overcome Planetary Afflictions/);
  for (const prayer of PRAYER_GUIDANCE[lang]) {
    assert.doesNotMatch(prayer, restrictedInstructions);
    assert.ok(!html.includes(prayer), `${lang} birth report no longer repeats general prayer guidance`);
  }
}

// ---------------------------------------------------------------------------
// 3. The Navagraha reference table data still renders (retained surface), and
//    the Tamil weekday short form (ஞாயிறு, திங்கள் ...) is preserved.
// ---------------------------------------------------------------------------
{
  const table = buildNavagrahaReferenceTableHtml('ta');
  assert.ok(table.includes('<td class="col-day">ஞாயிறு</td>'), 'Tamil Navagraha table shows ஞாயிறு');
  assert.doesNotMatch(table, /கிழமை/, 'Tamil Navagraha table has no கிழமை');
  assert.ok(navagrahaReferenceNote('ta').includes('ஒன்பது கிரகங்களுக்குமான'), 'Tamil reference note is retained');
  for (const info of Object.values(NAVAGRAHA_DOSHA_DATA)) {
    assert.doesNotMatch(info.day.ta, /கிழமை/, `${info.name.en} Tamil day is the short form`);
    assert.ok(table.includes(info.day.ta), `Tamil table keeps the ${info.name.ta} weekday`);
  }
  assert.ok(phpReports.includes("['Sunday', 'ஞாயிறு', 'रविवार']"), 'mPDF Tamil weekday matches');
  assert.ok(phpEngine.includes('நாள்: ஞாயிறு.'), 'PHP Tamil remedy weekday matches');
}

// ---------------------------------------------------------------------------
// 4. The removed chart-specific remedies section is gone from the browser and
//    PHP renderers, while its data keys and the Navagraha material remain.
// ---------------------------------------------------------------------------
const removedMarkers = [
  'activeRemediesHtml',
  'remedyForDosha',
  'Remedies for Indicators in This Chart',
  'இந்த ஜாதகத்தில் உள்ள குறியீடுகளுக்கான பரிகாரங்கள்',
  'remedy-block',
  'remedy-intro',
  '#birth-remedies-sheet',
  'birthRemediesFillCss'
];
const rendererSources: Array<[string, string]> = [
  ['src/services/jathagamHtmlBuilder.ts', builderSource],
  ['api/astrology/pdf_mpdf_reports.php', phpReports]
];
for (const [path, source] of rendererSources) {
  for (const marker of removedMarkers) {
    assert.ok(!source.includes(marker), `${path} no longer contains ${marker}`);
  }
  assert.ok(source.includes('classifyJathagamPlanetsForSummary'), `${path} builds page 3 from the shared rule`);
}
for (const lang of languages) {
  assert.ok(NO_DOSHA_REMEDY_NOTE[lang].trim(), `The no-dosha note data is retained (${lang})`);
  assert.ok(buildJathagamHtml(chart, lang).length > 0, `${lang} report still renders`);
}

// ---------------------------------------------------------------------------
// 5. Page 3 (Short Summary) draws its remedies from the Navagraha reference
//    data, in the language ordered, with the four labelled lines.
// ---------------------------------------------------------------------------
for (const lang of languages) {
  const html = buildJathagamHtml(chart, lang);
  const page3Start = html.indexOf('id="jathagam-page-3"');
  const scriptStart = html.indexOf('<script>', page3Start);
  const rawPage3 = html.slice(page3Start, scriptStart > page3Start ? scriptStart : undefined);
  // The builder escapes text for HTML, so compare against the unescaped copy.
  const page3 = rawPage3
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  assert.ok(page3Start > 0, `${lang}: page 3 exists`);
  assert.equal(html.match(/id="jathagam-page-3"/g)?.length, 1, `${lang}: exactly one page-3 sheet`);
  assert.ok(page3.includes(SHORT_SUMMARY_TEXT[lang].subtitle), `${lang}: page-3 subtitle`);
  assert.ok(page3.includes(SHORT_SUMMARY_TEXT[lang].reassurance), `${lang}: reassurance note`);

  // Pages 1 and 2 keep the original rule: no ritual directions there either.
  // (Their decorative "Om / Namah Shivaya" caption is not a remedy instruction,
  // and CSS clamp() must not be mistaken for a lamp line, so neither is
  // matched here.)
  const pages12 = html.slice(0, page3Start).replace(/<style>[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(
    pages12,
    /mantra|manthra|chanting|chalisa|japa|fasting|donat|abhishek|tarpanam|மந்திர|தீபம்|தானம்|தர்ப்பணம்|मंत्र|जाप|दीपक|दान|तर्पण/i,
    `${lang}: pages 1-2 keep the simple-prayer rule`
  );

  // Every planet the shared rule flags on this chart is shown with remedies
  // taken from the reference data, never from a second remedy system.
  const classified = classifyJathagamPlanetsForSummary(chart, lang);
  for (const planet of classified.needsCare) {
    const reference = NAVAGRAHA_DOSHA_DATA[planet.key];
    assert.ok(page3.includes(reference.deity[lang]), `${lang}: ${planet.key} worship comes from the reference data`);
    assert.ok(page3.includes(reference.day[lang]), `${lang}: ${planet.key} weekday comes from the reference data`);
    assert.ok(page3.includes(planet.mantra), `${lang}: ${planet.key} mantra is shown`);
    assert.ok(page3.includes(planet.lamp), `${lang}: ${planet.key} lamp line is shown`);
    assert.ok(page3.includes(planet.donation), `${lang}: ${planet.key} donation line is shown`);
  }
  if (classified.needsCare.length > 0 && !classified.compact) {
    for (const label of ['worship', 'lamp', 'donation', 'mantra'] as const) {
      assert.ok(
        page3.includes(SHORT_SUMMARY_REMEDY_LABELS[lang][label]),
        `${lang}: the ${label} label is printed in normal mode`
      );
    }
  }
  // The chart-specific remedies section's own title must not come back.
  assert.ok(!page3.includes('Remedies for Indicators'), `${lang}: no chart-specific remedies heading`);
}

assert.ok(Object.values(GENERIC_DEVOTIONAL_REMEDY).every(text => text.trim()));
assert.doesNotMatch(chart.saniStatus.remedyEn, restrictedInstructions);
assert.ok(NAVAGRAHA_ORDER.length === 9, 'the Navagraha order is intact');

const legacyComponent = readFileSync(new URL('../src/components/common/NavagrahaRemedies.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(legacyComponent, /General Guidelines|Ways to Overcome Planetary Afflictions|PRAYER_GUIDANCE/);

console.log('Navagraha remedy regression tests passed: reference data intact, page 3 sources it, removed section gone (en, ta, hi).');
