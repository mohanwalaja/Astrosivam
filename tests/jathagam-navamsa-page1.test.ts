/**
 * Regression test: the Navamsa (D9) chart on page 1 of the Birth Jathagam showed
 * "Navamsa positions unavailable" in English, Tamil and Hindi for every chart the
 * PHP engine built (the browser preview and every stored order). The PHP engine
 * emitted no D9 data at all. The fix has three parts, all verified below:
 *
 *  1. engine.php now emits each graha's `navamsaRasi` (with `totalDegrees` and
 *     `isVargottama`) and the Lagna's `lagnaNavamsaRasi`, using the same rule as
 *     the Node engine, so a fresh PHP chart draws the full D9 chart;
 *  2. a result saved before that fix has no D9 fields, so src/services/navamsa.ts
 *     fills them from the longitudes it already holds (engine values are never
 *     overwritten, and the input is never mutated);
 *  3. the two engines agree on the D9 sign of every graha and of the Lagna across
 *     the parity corpus (tests/fixtures/navamsa-d9-parity.json, PHP-generated and
 *     checked live by tests/jathagam-navamsa-page1.test.php);
 *  4. the Node direct-download PDF fallback groups the same placements, so it gets
 *     the same fill-in for saved results.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';
import { AppLanguage } from '../server/astrology/types.js';
import { generateHoroscopePdf } from '../server/astrology/pdfGenerator.js';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder.js';
import { navamsaRasiForLongitude, withDerivedNavamsa } from '../src/services/navamsa.js';

let checks = 0;
const check = (label: string, condition: boolean, detail = '') => {
  checks++;
  if (!condition) {
    console.error(`  [FAIL]  ${label}${detail ? `\n          ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  [PASS]  ${label}${detail ? `   ${detail}` : ''}`);
};

console.log('\n=== Jathagam page 1: Navamsa (D9) chart ===\n');

type ParityBirth = {
  id: string;
  devoteeName: string;
  dob: string;
  tob: string;
  birthPlace: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
};
const corpus: { birthCharts: ParityBirth[] } = JSON.parse(
  readFileSync(new URL('./fixtures/node-php-parity-corpus.json', import.meta.url), 'utf8')
);
const fixture: { charts: Record<string, { lagnaNavamsaRasi: number; planets: Record<string, { navamsaRasi: number }> }> } =
  JSON.parse(readFileSync(new URL('./fixtures/navamsa-d9-parity.json', import.meta.url), 'utf8'));

const GRAHAS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const LANGUAGES: AppLanguage[] = ['en', 'ta', 'hi'];

/** Node-only keys that a PHP-built chart does not carry (see family-report-engine-parity). */
const NODE_ONLY_KEYS = ['bhavas', 'navamsaPositions', 'currentDasha', 'saniStatus', 'lagnaRasiNameHi', 'janmaNakshatraHi'];
/** D9 keys that a result saved before the engine fix does not carry. */
const D9_PLANET_KEYS = ['navamsaRasi', 'totalDegrees', 'isVargottama'];
const D9_TOP_KEYS = ['lagnaNavamsaRasi', 'isLagnaVargottama', 'navamsaPositions'];

const chartFor = (birth: ParityBirth): any => calculatePrecisionHoroscope(
  birth.devoteeName, birth.dob, birth.tob, birth.birthPlace,
  birth.latitude, birth.longitude, birth.timezoneOffsetHours, birth.country ?? '', 'M'
);

/** The chart the fixed PHP engine returns: the Node chart minus the Node-only keys. */
const phpShaped = (chart: any): any => {
  const copy = { ...chart };
  for (const key of NODE_ONLY_KEYS) delete copy[key];
  return copy;
};

/** The chart a result saved before the engine fix holds: no D9 fields at all. */
const savedBeforeFix = (chart: any): any => {
  const copy = phpShaped(chart);
  copy.planetPositions = chart.planetPositions.map((position: any) => {
    const planet = { ...position };
    for (const key of D9_PLANET_KEYS) delete planet[key];
    return planet;
  });
  for (const key of D9_TOP_KEYS) delete copy[key];
  return copy;
};

const NAVAMSA_TITLE: Record<AppLanguage, string> = {
  en: 'Navamsa Chart (D9)',
  ta: 'நவாம்ச கட்டம் (Navamsa D9)',
  hi: 'नवांश चक्र (Navamsa D9)'
};

/** The page-1 Navamsa card: from its heading to the dosha section that follows the charts. */
const navamsaCard = (html: string, lang: AppLanguage): string => {
  const start = html.indexOf(`<h2>${NAVAMSA_TITLE[lang]}</h2>`);
  if (start < 0) return '';
  const end = html.indexOf('<div class="section-title">', start);
  return html.slice(start, end > start ? end : undefined);
};

const cardTags = (card: string): string[] =>
  [...card.matchAll(/<span class="planet-name[^"]*">([^<]*)<\/span>/g)].map(match => match[1]);

// The nine grahas plus the Lagna, in each report language (the tags page 1 prints).
const EXPECTED_TAGS: Record<AppLanguage, string[]> = {
  en: ['Su', 'Ch', 'Ma', 'Bu', 'Gu', 'Sk', 'Sa', 'Ra', 'Ke', 'Lagna'],
  ta: ['சூ', 'சந்', 'செவ்', 'பு', 'குரு', 'சுக்', 'சனி', 'ரா', 'கே', 'லக்'],
  hi: ['सू', 'चं', 'मं', 'बु', 'गु', 'शु', 'श', 'रा', 'के', 'लग्न']
};
const sorted = (values: string[]) => [...values].sort();

// --- 1. Navamsa rule -----------------------------------------------------------
// Each sign holds nine 3°20′ parts, so the D9 sign advances once per part.
check(
  'D9 sign: 0° is Mesha (1), 3.34° is 2, 30.01° is Makara (10), 359.99° is Meena (12)',
  navamsaRasiForLongitude(0) === 1
    && navamsaRasiForLongitude(3.34) === 2
    && navamsaRasiForLongitude(30.01) === 10
    && navamsaRasiForLongitude(359.99) === 12,
  `got ${[0, 3.34, 30.01, 359.99].map(navamsaRasiForLongitude).join(', ')}`
);
check(
  'D9 sign is null for a missing or non-finite longitude',
  navamsaRasiForLongitude(Number.NaN) === null && navamsaRasiForLongitude(undefined) === null
);

// --- 2. The two engines agree on D9 across the parity corpus -------------------
let compared = 0;
const disagreements: string[] = [];
for (const birth of corpus.birthCharts) {
  const node = chartFor(birth);
  const expected = fixture.charts[birth.id];
  assert.ok(expected, `navamsa-d9-parity.json has no entry for ${birth.id}`);
  compared++;
  if (node.lagnaNavamsaRasi !== expected.lagnaNavamsaRasi) disagreements.push(`${birth.id} Lagna`);
  for (const graha of GRAHAS) {
    const position = node.planetPositions.find((entry: any) => entry.graha === graha);
    compared++;
    if (!position || position.navamsaRasi !== expected.planets[graha]?.navamsaRasi) {
      disagreements.push(`${birth.id} ${graha}`);
    } else if (node.navamsaPositions?.[graha]?.rasi !== position.navamsaRasi) {
      disagreements.push(`${birth.id} ${graha} (navamsaPositions disagrees with navamsaRasi)`);
    }
  }
}
check(
  `Node and PHP engines agree on the D9 sign of all 9 grahas and the Lagna in ${corpus.birthCharts.length} parity charts`,
  disagreements.length === 0 && compared === corpus.birthCharts.length * 10,
  disagreements.slice(0, 5).join(', ')
);

// --- 3. Derivation for results saved before the fix ----------------------------
const derivationMismatches: string[] = [];
let derivationPlacements = 0;
for (const birth of corpus.birthCharts) {
  const node = chartFor(birth);
  const derived: any = withDerivedNavamsa(savedBeforeFix(node));
  for (const position of derived.planetPositions) {
    derivationPlacements++;
    const engine = node.planetPositions.find((entry: any) => entry.graha === position.graha);
    if (position.navamsaRasi !== engine?.navamsaRasi) derivationMismatches.push(`${birth.id} ${position.graha}`);
  }
  if (derived.lagnaNavamsaRasi !== node.lagnaNavamsaRasi) derivationMismatches.push(`${birth.id} Lagna`);
}
check(
  `a result saved before the fix gets the engine's D9 for all ${derivationPlacements} placements and every Lagna`,
  derivationMismatches.length === 0,
  derivationMismatches.slice(0, 5).join(', ')
);

const savedInput: any = savedBeforeFix(chartFor(corpus.birthCharts[0]));
const savedSnapshot = JSON.stringify(savedInput);
withDerivedNavamsa(savedInput);
check('withDerivedNavamsa never mutates the stored result it is given', JSON.stringify(savedInput) === savedSnapshot);

const engineValues: any = {
  planetPositions: [{ graha: 'sun', rasi: 9, degrees: 20.94, totalDegrees: 260.94, navamsaRasi: 5 }],
  lagnaRasi: 12,
  lagnaDegrees: 21.2,
  lagnaNavamsaRasi: 3
};
const keptEngineValues: any = withDerivedNavamsa(engineValues);
check(
  'engine-supplied D9 values are kept as they are, never overwritten by the fallback',
  keptEngineValues.planetPositions[0].navamsaRasi === 5 && keptEngineValues.lagnaNavamsaRasi === 3
);

// --- 4. Page 1 in every language ------------------------------------------------
for (const lang of LANGUAGES) {
  const birth = corpus.birthCharts[0];
  const full = chartFor(birth);

  // A fresh PHP chart (the fixed engine's shape) draws all nine grahas and the Lagna.
  const freshCard = navamsaCard(buildJathagamHtml(phpShaped(full), lang), lang);
  check(
    `[${lang}] fresh PHP-shaped chart: page-1 Navamsa shows the 9 grahas and the Lagna`,
    freshCard.includes('navamsa-chart-grid')
      && JSON.stringify(sorted(cardTags(freshCard))) === JSON.stringify(sorted(EXPECTED_TAGS[lang])),
    `tags: ${cardTags(freshCard).join(' ')}`
  );

  // A saved pre-fix chart draws exactly the same card as the engine's own chart.
  const savedCard = navamsaCard(buildJathagamHtml(savedBeforeFix(full), lang), lang);
  const engineCard = navamsaCard(buildJathagamHtml(full, lang), lang);
  check(
    `[${lang}] result saved before the fix: page-1 Navamsa card is identical to the engine's`,
    savedCard.length > 0 && savedCard === engineCard
  );
  check(
    `[${lang}] no "unavailable" note replaces the Navamsa chart for either chart`,
    !savedCard.includes('mini-note') && !freshCard.includes('mini-note')
  );

  // An invalid Ascendant must never get a Lagna marker, even on the Navamsa card.
  const invalidLagnaCard = navamsaCard(buildJathagamHtml({ ...savedBeforeFix(full), lagnaRasi: 0 }, lang), lang);
  check(
    `[${lang}] invalid Ascendant: the Navamsa card has no Lagna marker`,
    !invalidLagnaCard.includes('is-lagna') && cardTags(invalidLagnaCard).length === 9,
    `tags: ${cardTags(invalidLagnaCard).join(' ')}`
  );
}

// --- 5. The Node direct-download PDF fallback (Latin text only) -----------------
// It groups the same placements, so a saved pre-fix chart must print the same text
// as a fresh chart, Navamsa labels included. Its text is stored uncompressed.
const pdfText = (chart: any): string[] =>
  [...generateHoroscopePdf(chart, 'en').toString('latin1').matchAll(/\(([^()]{1,14})\)\s*Tj/g)].map(match => match[1]);
const pdfFresh = pdfText(phpShaped(chartFor(corpus.birthCharts[0])));
const pdfSaved = pdfText(savedBeforeFix(chartFor(corpus.birthCharts[0])));
check(
  'Node PDF fallback: a saved pre-fix chart prints the same text as a fresh chart, Navamsa included',
  pdfFresh.length > 0 && JSON.stringify(pdfFresh) === JSON.stringify(pdfSaved),
  `${pdfFresh.length} vs ${pdfSaved.length} text operators`
);

assert.ok(checks >= 14, `expected the full Navamsa matrix, ran ${checks} checks`);
console.log(`\n${process.exitCode ? 'FAILED' : 'PASSED'}: Jathagam page-1 Navamsa (${checks} checks)\n`);
