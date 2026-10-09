import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_NAKSHATRA_LETTERS } from '../src/lib/astrology/babynames.js';
import { NAMAKARAN_MEANING_GLOSSARY } from '../src/lib/astrology/namakaranMeaningData.js';
import { localizeNamakaranMeaning } from '../src/lib/astrology/namakaranMeaning.js';
import { buildNamakaranPadaNames, buildNamakaranPadaNamesFromResult } from '../src/lib/astrology/namakaranNames.js';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder.js';

/**
 * Page 2 of the Vedic Namakaran report — the Tamil and Hindi text printed under
 * every suggested name — must come from the curated glossary in
 * data/namakaran_meaning_glossary.tsv, never from word-by-word output.
 *
 * The earlier report shipped a phrase table plus an automatic word fallback,
 * and any meaning the table did not hold came out as broken Tamil ("A blessed
 * child" -> "ஒரு அருள் child"). These checks make that impossible to release
 * again: the bank is fully covered by hand-written translations, the two report
 * engines share one glossary hash, and no localized line can carry Latin text.
 */

const TAMIL = /^[\u0B80-\u0BFF\s,.;:!?()\-'"\u2018\u2019\u201c\u201d]+$/u;
const DEVANAGARI = /^[\u0900-\u097F\s,.;:!?()\-'"\u2018\u2019\u201c\u201d]+$/u;

// ── 1. The glossary itself ──────────────────────────────────────────────────
const glossaryCount = Object.keys(NAMAKARAN_MEANING_GLOSSARY).length;
assert(glossaryCount > 1000, `The curated meaning glossary holds a full bank of translations (${glossaryCount})`);

for (const [english, entry] of Object.entries(NAMAKARAN_MEANING_GLOSSARY)) {
  assert(english === english.toLowerCase(), `Glossary key "${english}" is stored lower-case for a case-insensitive lookup`);
  assert(entry.ta.trim().length > 0, `"${english}" has Tamil text`);
  assert(entry.hi.trim().length > 0, `"${english}" has Hindi text`);
  assert(!/[A-Za-z]/.test(entry.ta), `"${english}" Tamil text carries no Latin letters (${entry.ta})`);
  assert(!/[A-Za-z]/.test(entry.hi), `"${english}" Hindi text carries no Latin letters (${entry.hi})`);
  assert(TAMIL.test(entry.ta), `"${english}" Tamil text stays in Tamil script (${entry.ta})`);
  assert(DEVANAGARI.test(entry.hi), `"${english}" Hindi text stays in Devanagari (${entry.hi})`);
}

// Every meaning the shipped name bank prints is covered, so no page-2 name can
// reach the word-by-word safety net.
const bankMeanings = new Set(
  readFileSync(resolve('data/namakaran_name_bank.tsv'), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('\t')[4]?.trim())
    .filter((value): value is string => Boolean(value))
);
for (const meaning of bankMeanings) {
  assert(NAMAKARAN_MEANING_GLOSSARY[meaning.toLowerCase()],
    `The name bank meaning "${meaning}" has a curated Tamil/Hindi translation`);
}

// ── 2. Every printed name of every pada of every Nakshatra ─────────────────
let printedNames = 0;
let unanswered = 0;
for (const star of ALL_NAKSHATRA_LETTERS) {
  for (const gender of ['M', 'F'] as const) {
    for (const column of buildNamakaranPadaNames(star.padas as any, gender)) {
      for (const entry of [...column.south, ...column.north]) {
        printedNames += 1;
        const curated = NAMAKARAN_MEANING_GLOSSARY[entry.meaningEn.toLowerCase()];
        if (!curated) { unanswered += 1; continue; }
        assert.equal(entry.meaningTa, curated.ta,
          `${star.nakshatraNameEn} ${gender} ${entry.name}: Tamil meaning comes from the glossary`);
        assert.equal(entry.meaningHi, curated.hi,
          `${star.nakshatraNameEn} ${gender} ${entry.name}: Hindi meaning comes from the glossary`);
      }
    }
  }
}
assert(printedNames > 3000, `Every Nakshatra, pada and gender was checked (${printedNames} printed names)`);
assert.equal(unanswered, 0, 'No printed name falls back to word-by-word output');

// ── 3. A legacy order keeps the corrected text ──────────────────────────────
// Older orders cached the broken localized meanings. The English meaning is the
// source value, so the report must re-localize instead of reusing that cache.
const star = ALL_NAKSHATRA_LETTERS.find(entry => entry.nakshatraNameEn === 'Shatabhisha')!;
const staleColumn = {
  padaNumber: 1,
  soundTa: star.padas[0].letterTa,
  soundEn: star.padas[0].letterEn,
  soundHi: star.padas[0].letterHi,
  rasiTa: '', rasiEn: '', rasiHi: '', usesRelatedSounds: false,
  south: [{ name: 'Sudhan', meaning: 'Wealth and virtue', meaningTa: 'செல்வம் and virtue', meaningHi: 'धन and virtue' }],
  north: []
};
const relocalized = buildNamakaranPadaNamesFromResult({
  janmaNakshatraEn: star.nakshatraNameEn,
  janmaPada: 1,
  gender: 'M',
  nakshatraLetters: star,
  nameSuggestions: [staleColumn]
} as any);
assert.deepEqual(relocalized, buildNamakaranPadaNames(star.padas, 'M'),
  'Legacy reports rebuild names and meanings from corrected source data, not stale cached lists');

// ── 4. The rendered report prints the glossary text ─────────────────────────
const result = {
  babyName: 'Kanika',
  gender: 'F',
  dob: '2024-03-10', tob: '08:45', birthPlace: 'Suva', country: 'Fiji',
  janmaNakshatraEn: star.nakshatraNameEn,
  janmaNakshatraTa: star.nakshatraNameTa,
  janmaNakshatraHi: star.nakshatraNameHi,
  janmaNakshatraIndex: star.nakshatraIndex,
  janmaPada: 1,
  nakshatraLetters: star,
  primaryPadaInfo: star.padas[0],
  chandraRasiNameEn: 'Kumbham (Aquarius)', chandraRasiNameTa: 'கும்பம்', chandraRasiNameHi: 'कुंभ',
  lagnaRasiNameEn: 'Mesham (Aries)', lagnaRasiNameTa: 'மேஷம்', lagnaRasiNameHi: 'मेष'
} as any;

for (const language of ['ta', 'hi'] as const) {
  const html = buildBabyNamingHtml(result, language);
  const pageTwo = html.slice(html.indexOf('id="namakaran-page-2"'));
  const expected = buildNamakaranPadaNamesFromResult(result).flatMap(column => [...column.south, ...column.north]);
  for (const entry of expected) {
    const meaning = language === 'ta' ? entry.meaningTa : entry.meaningHi;
    assert(pageTwo.includes(meaning.replace(/&/g, '&amp;')), `${language} page 2 prints "${meaning}" for ${entry.name}`);
  }
  assert(!/>\s*[A-Za-z][A-Za-z ,'-]{6,}</.test(pageTwo.replace(/class="[^"]*"/g, '').replace(/<[^>]*>/g, '>')),
    `${language} page 2 carries no leftover English sentence in a meaning line`);
}

// ── 5. Word-by-word output stays a documented safety net, never the norm ────
assert.notEqual(localizeNamakaranMeaning('A meaning outside the bank', 'ta'), 'A meaning outside the bank',
  'A meaning outside the bank is still localized, never printed as English');

// The page 1 example-name table of the report uses meanings outside the name
// bank; they are curated here too so no sheet falls back to machine output.
for (const phrase of [
  'Ray of light',
  'Consciousness; living spirit',
  'A flourishing grove',
  'Karthikeyan (Murugan); one born in Karthikai'
]) {
  const curated = NAMAKARAN_MEANING_GLOSSARY[phrase.toLowerCase()];
  assert(curated, `"${phrase}" is curated for the page 1 example names`);
  assert.equal(localizeNamakaranMeaning(phrase, 'ta'), curated.ta, `"${phrase}" prints the curated Tamil text`);
  assert.equal(localizeNamakaranMeaning(phrase, 'hi'), curated.hi, `"${phrase}" prints the curated Hindi text`);
}

// ── 6. Both report engines share one glossary ───────────────────────────────
const tsData = readFileSync(resolve('src/lib/astrology/namakaranMeaningData.ts'), 'utf8');
const phpData = readFileSync(resolve('api/astrology/namakaran_meanings.php'), 'utf8');
const tsHash = /NAMAKARAN_MEANING_GLOSSARY_HASH = '([0-9a-f]+)'/.exec(tsData)?.[1];
const phpHash = /\* Content hash    : ([0-9a-f]+)/.exec(phpData)?.[1];
assert(tsHash, 'The generated TypeScript glossary carries its content hash');
assert.equal(phpHash, tsHash, 'The generated PHP glossary shares the TypeScript content hash');

const check = spawnSync(process.execPath, ['scripts/build_namakaran_glossary.mjs', '--check'], { encoding: 'utf8' });
assert.equal(check.status, 0, `node scripts/build_namakaran_glossary.mjs --check passes\n${check.stdout}${check.stderr}`);

console.log(`\nALL NAMAKARAN MEANING CHECKS PASSED! (${glossaryCount} curated meanings, ${printedNames} printed names)`);

// Source-level regressions for the corrected naming report.
const rajju = JSON.parse(readFileSync(resolve('api/astrology/rajju.json'), 'utf8'));
const expectedGroups = [
  [5, 14, 23], // Siro
  [4, 6, 13, 15, 22, 24], // Kantha
  [3, 7, 12, 16, 21, 25], // Nabhi
  [2, 8, 11, 17, 20, 26], // Kati
  [1, 9, 10, 18, 19, 27] // Pada
];
assert.equal(rajju.groups.length, 27);
assert.equal(new Set(expectedGroups.flat()).size, 27);
expectedGroups.forEach((stars, group) => stars.forEach(index => {
  assert.equal(rajju.groups[index - 1], group);
  assert.equal(ALL_NAKSHATRA_LETTERS[index - 1].rajjuEn, rajju.en[group]);
}));
assert.match(ALL_NAKSHATRA_LETTERS[14].rajjuEn, /Kantha/);
assert.match(ALL_NAKSHATRA_LETTERS[13].rajjuEn, /Siro/);

const { firstTamilSound, nameMatchesPada, nameFingerprint } = await import('../src/lib/astrology/namakaranSound');
const { transliterateToTamil } = await import('../src/services/indicTransliteration');
const { calculateBabyNamingDetails } = await import('../src/lib/astrology/babynames');
const { NAMAKARAN_BANK } = await import('../src/lib/astrology/namakaranNameBank');
for (const star of ALL_NAKSHATRA_LETTERS) for (const gender of ['M', 'F'] as const) {
  const seen = new Set<string>();
  for (const column of buildNamakaranPadaNames(star.padas, gender)) {
    for (const entry of [...column.south, ...column.north]) {
      const first = firstTamilSound(transliterateToTamil(entry.name));
      const exact = column.soundTa.split('/').some(sound => first === firstTamilSound(sound));
      assert.equal(entry.isRelatedSound, !exact, `${entry.name}: derive † from the displayed syllable`);
      assert(!seen.has(nameFingerprint(entry.name)), `${entry.name}: no Tamil-display duplicates`);
      seen.add(nameFingerprint(entry.name));
    }
  }
}
for (const sound of ['ரே', 'ரோ']) for (const gender of ['M', 'F'] as const) {
  for (const entry of [...NAMAKARAN_BANK[sound][gender].south, ...NAMAKARAN_BANK[sound][gender].north]) {
    const first = firstTamilSound(transliterateToTamil(entry.n));
    assert(!['ரெ', 'ரொ'].includes(first), `${entry.n}: use long Re/Ro, not short vowels`);
  }
}
assert(nameMatchesPada('Revanth', 'ரே'));
assert(nameMatchesPada('ரேவந்த்', 'ரே'));
assert(!nameMatchesPada('Aarav', 'ரே'));
assert(!nameMatchesPada('Rethinavel', 'ரே'));
assert(!nameMatchesPada('Rajan', 'ரே'));

const sample = calculateBabyNamingDetails('Aarav', '2000-01-01', '02:00', 'Chennai', 'M', 13.0827, 80.2707, 5.5, 'India');
sample.generatedAt = '2026-10-07T02:30:00.000Z';
assert.equal(sample.janmaPada, 2);
for (const col of sample.nameSuggestions!) {
  assert.equal(col.south.length, 8);
  assert.equal(col.north.length, 8);
}
assert(!sample.nameSuggestions![3].north.some(e => e.name === 'Danish'));
assert([...sample.nameSuggestions![3].south, ...sample.nameSuggestions![3].north].every(e => !transliterateToTamil(e.name).startsWith('ட')));
const sampleHtml = buildBabyNamingHtml(sample, 'ta');
for (const text of ['கண்ட ரஜ்ஜு', 'கணிப்பு சரிபார்க்கப்பட்டது', 'பெயரின் முதல் ஒலி (A)', 'பொருந்தவில்லை',
  'ரூபேஷ்', 'ரமேஷ்', 'ரகேஷ்', 'ராஜேஷ்', 'ரோனக்', 'ரோனித்', 'உண்மையின் இறைவன்',
  'புனித ரேவா நதியின் பகுதி', 'ஒளிமிக்க, சூரியனின் மகன்', 'birth-pada-section',
  '★ பாதம் 2', '07 Oct 2026, 08:00 IST', 'ASTRO-NAME-20261007', 'அங்கீகரிக்கப்பட்டவர்',
  'நவாம்சம்: தனுசு', 'நவாம்சம்: மகரம்', 'நவாம்சம்: கும்பம்', 'நவாம்சம்: மீனம்']) {
  assert(sampleHtml.includes(text), `Sample contains ${text}`);
}
const markerCount = sample.nameSuggestions!.flatMap(c => [...c.south, ...c.north]).filter(e => e.isRelatedSound).length;
assert.equal((sampleHtml.match(/data-related-sound="true"/g) || []).length, markerCount);
assert(buildBabyNamingHtml({ ...sample, babyName: 'Revanth' }, 'ta').includes('பொருந்துகிறது'));
console.log('Naming report: all 27 rajjus, displayed-syllable markers, spellings, counts, sample metadata and navamsas passed.');
