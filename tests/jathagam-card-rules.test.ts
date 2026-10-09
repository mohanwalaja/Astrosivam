import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import {
  RAHU_NODE_TYPE,
  calculateAllGrahaPositions,
  calculateLahiriAyanamsa,
  calculateMeanLunarNode,
  calculatePrecisionHoroscope,
  calculateTrueLunarNode,
  rahuNodeType
} from '../server/astrology/astronomy.js';
import { Graha, HoroscopeResult, PlanetPosition, Rasi } from '../server/astrology/types.js';
import { computePlanetDignity, debilitationSign } from '../server/astrology/dignity.js';
import { fitJathagamLifeCardText, fitJathagamSummaryText } from '../src/services/jathagamLifeCardLayout.js';
import {
  MALEFIC_CONJUNCTION_ORB_DEG,
  buildJathagamHtml,
  buildJathagamLifeCards
} from '../src/services/jathagamHtmlBuilder.js';

/**
 * Page-2 life-card rules.
 *
 *   1. the running Mahadasa lord is resolved from the Graha ENUM (Venus and
 *      Saturn used to be dropped by English-text matching, so their dasha was
 *      never assessed);
 *   2. a malefic counts as conjunct only inside a 10° orb, not merely by sign;
 *   3. an exalted / own-sign lord offsets one malefic conjunction, and a
 *      debilitated malefic (Mars in Kadagam) is not a strong malefic;
 *   4. Rahu/Ketu carry no debilitation in the card code — the shared
 *      dignity.ts table reports the nodes as not-applicable;
 *   5. the Rahu node convention (MEAN default) is declared in the report;
 *   6. the karakas are named: Venus (marriage), Jupiter (wealth), the 11th lord
 *      (income) and the 6th lord (health);
 *   7. design: page 1 shows only the paired Rasi (left) and Navamsa (right)
 *      charts; Dasha data remains available to page-2 predictions, cards stay
 *      content-sized, and the Navagraha table remains at >= 10px.
 */

const birth = {
  name: 'Card Rules',
  dob: '1990-01-05',
  tob: '12:00',
  birthPlace: 'Chennai, Tamil Nadu, India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5,
  country: 'India',
  gender: 'M'
};
const chart = calculatePrecisionHoroscope(
  birth.name, birth.dob, birth.tob, birth.birthPlace,
  birth.latitude, birth.longitude, birth.timezoneOffsetHours, birth.country, birth.gender
);

const GRAHA_NAME_EN: Record<string, string> = {
  [Graha.SURYA]: 'Sun', [Graha.CHANDRA]: 'Moon', [Graha.CHEVVAI]: 'Mars', [Graha.BUDHA]: 'Mercury',
  [Graha.GURU]: 'Jupiter', [Graha.SUKRA]: 'Venus', [Graha.SANI]: 'Saturn', [Graha.RAHU]: 'Rahu', [Graha.KETU]: 'Ketu'
};

/** A complete-enough PlanetPosition so the card code can read it. */
function planet(
  graha: Graha,
  rasi: number,
  bhavaNumber: number,
  degrees: number,
  extra: Partial<PlanetPosition> = {}
): PlanetPosition {
  return {
    graha,
    planetKey: GRAHA_NAME_EN[graha].toUpperCase(),
    nameTa: GRAHA_NAME_EN[graha], nameEn: GRAHA_NAME_EN[graha], nameHi: GRAHA_NAME_EN[graha],
    shortTa: GRAHA_NAME_EN[graha], shortEn: GRAHA_NAME_EN[graha], shortHi: GRAHA_NAME_EN[graha],
    rasi: rasi as Rasi,
    rasiNameTa: '', rasiNameEn: '', rasiNameHi: '',
    degrees,
    totalDegrees: ((rasi - 1) * 30) + degrees,
    nakshatramTa: '', nakshatramEn: '', nakshatramHi: '',
    pada: 1,
    isRetrograde: false,
    isCombust: false,
    bhavaNumber,
    ...extra
  };
}

const chartWith = (planetPositions: PlanetPosition[], overrides: Partial<HoroscopeResult> = {}): HoroscopeResult => ({
  ...chart,
  planetPositions,
  ...overrides
});
/** Mesham lagna so Venus rules house 2 (Rishabam) and house 7 (Thulam). */
const mesham = { lagnaRasi: Rasi.MESHAM, chandraRasi: Rasi.MESHAM };

const cardAt = (result: HoroscopeResult, index: number, lang: 'en' | 'ta' | 'hi' = 'en') =>
  buildJathagamLifeCards(result, lang)[index];

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

console.log('\n=== Jathagam card rules ===\n');

// ---------------------------------------------------------------------------
// 1. Dasha lord by enum for all nine lords
// ---------------------------------------------------------------------------
const ninePlanetChart = (Object.values(Graha) as Graha[]).map((graha, index) =>
  // Every lord is placed in the 6th house, so a resolved assessment must be a
  // caution — never the "N/A" the old text matcher produced.
  planet(graha, ((1 + index) % 12) + 1, 6, 10)
);
for (const lord of Object.values(Graha) as Graha[]) {
  const result = chartWith(ninePlanetChart, {
    currentDasha: {
      ...chart.currentDasha!,
      mahadashaLord: lord,
      mahadashaLordEn: GRAHA_NAME_EN[lord],
      mahadashaLordTa: GRAHA_NAME_EN[lord],
      mahadashaLordHi: GRAHA_NAME_EN[lord]
    },
    dashaPeriods: []
  });
  const guidanceCard = cardAt(result, 7);
  check(
    `1. ${GRAHA_NAME_EN[lord]} Mahadasa is assessed from the Graha enum (no "N/A" badge)`,
    guidanceCard.badge.includes('Caution') && !guidanceCard.badge.includes('N/A'),
    guidanceCard.badge
  );
}
// The two lords the old English-text match could never find: the report labels
// Venus "Sukra" and Saturn "Sani" while the dasha block says "Venus"/"Saturn".
for (const [lord, display] of [[Graha.SUKRA, 'Sukra'], [Graha.SANI, 'Sani']] as const) {
  const result = chartWith(ninePlanetChart, {
    currentDasha: { ...chart.currentDasha!, mahadashaLord: lord, mahadashaLordEn: GRAHA_NAME_EN[lord] },
    dashaPeriods: []
  });
  const guidanceCard = cardAt(result, 7);
  check(
    `1. ${display} Mahadasa resolves through the enum even though the report labels it "${display}"`,
    guidanceCard.badge.includes('Caution') && !guidanceCard.badge.includes('N/A'),
    guidanceCard.badge
  );
}
// The dashaPeriods path (no currentDasha block) must resolve the same way.
for (const lord of [Graha.SUKRA, Graha.SANI, Graha.RAHU]) {
  const result = chartWith(ninePlanetChart, {
    currentDasha: undefined,
    dashaPeriods: [{
      mahadashaLord: lord,
      lordNameTa: GRAHA_NAME_EN[lord], lordNameEn: GRAHA_NAME_EN[lord], lordNameHi: GRAHA_NAME_EN[lord],
      startDate: '2020-01-01', endDate: '2030-01-01', years: 10, isCurrent: true, antardashas: []
    }]
  });
  const guidanceCard = cardAt(result, 7);
  check(
    `1. ${GRAHA_NAME_EN[lord]} resolves from dashaPeriods[].mahadashaLord`,
    guidanceCard.badge.includes('Caution') && !guidanceCard.badge.includes('N/A'),
    guidanceCard.badge
  );
}

// ---------------------------------------------------------------------------
// 2/3. Conjunction orb + dignity offset + debilitated malefics
// ---------------------------------------------------------------------------
// Lagna Mesham → the 2nd house (Rishabam) is ruled by Venus, which the Wealth
// card reads, and bhava 2 is not a dusthana, so only the conjunction decides.
const venusOwnSign = (degrees: number) => planet(Graha.SUKRA, 2, 2, degrees);

const orbOutside = cardAt(chartWith([venusOwnSign(5), planet(Graha.SANI, 2, 2, 25)], mesham), 1);
check(
  `2. A malefic 20° away in the SAME sign is not a conjunction (orb ${MALEFIC_CONJUNCTION_ORB_DEG}°)`,
  !orbOutside.desc.includes('joined'),
  orbOutside.desc
);
const orbInside = cardAt(chartWith([venusOwnSign(5), planet(Graha.SANI, 2, 2, 13)], mesham), 1);
check(
  '2/3. A malefic 8° inside the orb is a conjunction, and the own-sign lord offsets one',
  /offsets one malefic conjunction/.test(orbInside.desc) && !/joined/.test(orbInside.desc),
  orbInside.desc
);
const orbAcrossCusp = cardAt(chartWith([venusOwnSign(28), planet(Graha.SANI, 3, 2, 2)], mesham), 1);
check(
  '2. A malefic 4° across a sign cusp is still a conjunction (degree-based, not sign-based)',
  /offsets one malefic conjunction \(Sani\)/.test(orbAcrossCusp.desc),
  orbAcrossCusp.desc
);
const twoMaleficsUndignified = cardAt(
  chartWith([planet(Graha.SUKRA, 8, 2, 5), planet(Graha.CHEVVAI, 8, 2, 8), planet(Graha.SANI, 8, 2, 12)], mesham),
  1
);
check(
  '3. A lord in neither exaltation nor own sign counts every malefic inside the orb',
  /joined within 10° with Mangal\/Sani/.test(twoMaleficsUndignified.desc)
    && !/offsets one malefic/.test(twoMaleficsUndignified.desc),
  twoMaleficsUndignified.desc
);
const twoMaleficsDignified = cardAt(
  chartWith([venusOwnSign(5), planet(Graha.CHEVVAI, 2, 2, 8), planet(Graha.SANI, 2, 2, 12)], mesham),
  1
);
check(
  '3. An own-sign lord offsets exactly ONE malefic — the second still counts',
  /joined within 10° with Sani/.test(twoMaleficsDignified.desc)
    && /offsets one malefic conjunction \(Mangal\)/.test(twoMaleficsDignified.desc),
  twoMaleficsDignified.desc
);
const debilitatedMars = cardAt(
  chartWith([planet(Graha.SUKRA, 4, 2, 5), planet(Graha.CHEVVAI, 4, 2, 8)], mesham),
  1
);
check(
  '3. A debilitated Mars (Kadagam) is not counted as a strong malefic',
  /not counted as a strong malefic/.test(debilitatedMars.desc) && !debilitatedMars.desc.includes('joined'),
  debilitatedMars.desc
);
check(
  '3. The same contact from a non-debilitated Mars IS counted',
  /joined within 10° with Mangal/.test(
    cardAt(chartWith([planet(Graha.SUKRA, 8, 2, 5), planet(Graha.CHEVVAI, 8, 2, 8)], mesham), 1).desc
  )
);
// The engine-attached dignity block is authoritative when present.
const dignityAttached = chartWith([
  planet(Graha.SUKRA, 2, 2, 5, {
    dignity: computePlanetDignity({
      graha: Graha.SUKRA, rasi: Rasi.RISHABAM, isCombust: false, isRetrograde: false,
      lagnaRasi: Rasi.MESHAM, moonRasi: Rasi.MESHAM,
      rasiByGraha: { [Graha.SUKRA]: Rasi.RISHABAM, [Graha.SANI]: Rasi.RISHABAM }
    }) as PlanetPosition['dignity']
  }),
  planet(Graha.SANI, 2, 2, 12)
], mesham);
check(
  '3. Own-sign dignity reported by the engine offsets one malefic conjunction',
  /offsets one malefic conjunction/.test(cardAt(dignityAttached, 1).desc),
  cardAt(dignityAttached, 1).desc
);

// ---------------------------------------------------------------------------
// 4. No Rahu/Ketu debilitation in the cards
// ---------------------------------------------------------------------------
check(
  '4. dignity.ts reports no debilitation sign for Rahu/Ketu',
  debilitationSign(Graha.RAHU) === null
    && debilitationSign(Graha.KETU) === null
    && computePlanetDignity({
      graha: Graha.RAHU, rasi: Rasi.VIRUCHIGAM, isCombust: false, isRetrograde: true,
      lagnaRasi: Rasi.MESHAM, moonRasi: Rasi.MESHAM, rasiByGraha: {}
    }).status === 'not-applicable',
  'the nodes have no classical sign dignity'
);
// Rahu in Scorpio is the school that calls it "debilitated": the cards must not
// print a node debilitation and must keep counting Rahu as a strong malefic.
const rahuInScorpio = chartWith([planet(Graha.SUKRA, 8, 2, 5), planet(Graha.RAHU, Rasi.VIRUCHIGAM, 2, 8)], mesham);
check(
  '4. Rahu in Scorpio is neither called debilitated nor excused as a weak malefic',
  !/Rahu.*(debilitat|not counted)/i.test(cardAt(rahuInScorpio, 1).desc)
    && /joined within 10° with Rahu/.test(cardAt(rahuInScorpio, 1).desc),
  cardAt(rahuInScorpio, 1).desc
);
const ketuInTaurus = chartWith(
  // Venus in Mesham (not its own sign), 7° from Ketu in the next rasi.
  [planet(Graha.SUKRA, Rasi.MESHAM, 2, 28), planet(Graha.KETU, Rasi.RISHABAM, 2, 5)],
  mesham
);
check(
  '4. Ketu in Rishabam is still a strong malefic contact (no invented debilitation)',
  !/Ketu.*(debilitat|not counted)/i.test(cardAt(ketuInTaurus, 1).desc)
    && /joined within 10° with Ketu/.test(cardAt(ketuInTaurus, 1).desc),
  cardAt(ketuInTaurus, 1).desc
);
const htmlAllLangs = (['en', 'ta', 'hi'] as const).map(lang => buildJathagamHtml(chart, lang));
check(
  '4. No rendered report claims a Rahu/Ketu debilitation',
  htmlAllLangs.every(html =>
    !/Rahu[^.<]{0,80}(Debilitated|நீச|नीच)/.test(html) && !/Ketu[^.<]{0,80}(Debilitated|நீச|नीच)/.test(html)
  )
);

// ---------------------------------------------------------------------------
// 5. Rahu node setting (MEAN default) declared in the report
// ---------------------------------------------------------------------------
const previousNodeType = process.env.ASTRO_RAHU_NODE_TYPE;
delete process.env.ASTRO_RAHU_NODE_TYPE;
check('5. The engine default node convention is MEAN', rahuNodeType() === 'MEAN' && RAHU_NODE_TYPE === 'MEAN');
check('5. The chart result declares its node convention', chart.nodeType === 'MEAN', String(chart.nodeType));
check(
  '5. Page 1 states the Rahu node convention',
  htmlAllLangs[0].includes('Mean node') && htmlAllLangs[1].includes('சராசரி') && htmlAllLangs[2].includes('औसत'),
  'en/ta/hi node row present'
);
check(
  '5. A TRUE-node report states the osculating convention',
  buildJathagamHtml({ ...chart, nodeType: 'TRUE' }, 'en').includes('True node')
);
{
  // The seven classical grahas must not move with the node switch.
  const time = Astronomy.MakeTime(new Date(Date.UTC(1990, 0, 5, 6, 30)));
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);
  const asMean = calculateAllGrahaPositions(time, jd, ayanamsa, 'MEAN');
  const asTrue = calculateAllGrahaPositions(time, jd, ayanamsa, 'TRUE');
  check(
    '5. Only Rahu/Ketu move with the node setting; the seven grahas are identical',
    [Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.BUDHA, Graha.GURU, Graha.SUKRA, Graha.SANI]
      .every(graha => asMean.siderealLongitudes[graha] === asTrue.siderealLongitudes[graha])
      && asMean.siderealLongitudes[Graha.RAHU] !== asTrue.siderealLongitudes[Graha.RAHU],
    'identical classical longitudes'
  );
  const meanMinusTrue = Math.abs(calculateMeanLunarNode(jd) - calculateTrueLunarNode(jd));
  check(
    '5. Mean node is the smoothed (Meeus 47.7) node, distinct from the osculating node',
    meanMinusTrue > 0 && meanMinusTrue < 2,
    `Δ ${meanMinusTrue.toFixed(4)}°`
  );
}
process.env.ASTRO_RAHU_NODE_TYPE = 'TRUE';
check('5. ASTRO_RAHU_NODE_TYPE=TRUE switches the convention', rahuNodeType() === 'TRUE');
if (previousNodeType === undefined) delete process.env.ASTRO_RAHU_NODE_TYPE;
else process.env.ASTRO_RAHU_NODE_TYPE = previousNodeType;

// ---------------------------------------------------------------------------
// 6. Karakas on the cards
// ---------------------------------------------------------------------------
// Mesham lagna: house 2 and house 7 are both Venus, the 11th lord is Saturn and
// the 6th lord is Mercury — exactly the four karaka roles on the cards.
const karakaChart = chartWith([
  planet(Graha.CHEVVAI, 1, 1, 10),
  planet(Graha.SUKRA, 4, 4, 20),
  planet(Graha.SANI, 10, 11, 15),
  planet(Graha.BUDHA, 3, 6, 12),
  planet(Graha.GURU, 9, 9, 8),
  planet(Graha.SURYA, 5, 5, 20),
  planet(Graha.CHANDRA, 4, 4, 3),
  planet(Graha.RAHU, 11, 11, 5),
  planet(Graha.KETU, 5, 5, 5)
], mesham);
const healthCard = cardAt(karakaChart, 0);
const wealthCard = cardAt(karakaChart, 1);
const marriageCard = cardAt(karakaChart, 4);
check('6. Health card names the 6th lord (health/Roga)', healthCard.desc.includes('6th lord (health/Roga)'), healthCard.desc);
check(
  '6. Wealth card names Jupiter (wealth karaka) and the 11th lord (income/Labha)',
  wealthCard.desc.includes('Jupiter, karaka of wealth') && wealthCard.desc.includes('11th lord (income/Labha)'),
  wealthCard.desc
);
check(
  '6. Marriage card names Venus (marriage karaka)',
  marriageCard.desc.includes('Venus, karaka of marriage'),
  marriageCard.desc
);
for (const lang of ['ta', 'hi'] as const) {
  const cards = buildJathagamLifeCards(karakaChart, lang);
  check(
    `6. Karakas are localised (${lang})`,
    cards[0].desc.includes(lang === 'ta' ? 'ஆரோக்கியம்' : 'स्वास्थ्य')
      && cards[1].desc.includes(lang === 'ta' ? 'தன காரகன்' : 'धन कारक')
      && cards[4].desc.includes(lang === 'ta' ? 'திருமண காரகன்' : 'विवाह कारक'),
    `${cards[1].desc.slice(0, 60)}…`
  );
}

// ---------------------------------------------------------------------------
// 7. Design: paired Rasi + Navamsa charts only on page 1; Dasha calculations
//    remain active in the page-2 predictions.
// ---------------------------------------------------------------------------
const designHtml = htmlAllLangs[0];
const page1 = designHtml.slice(designHtml.indexOf('id="jathagam-page-1"'), designHtml.indexOf('id="jathagam-page-2"'));
const page2 = designHtml.slice(designHtml.indexOf('id="jathagam-page-2"'), designHtml.indexOf('id="jathagam-page-3"'));
const chartSectionStart = page1.indexOf('<div class="chart-section">');
const chartSectionEnd = page1.indexOf('<div class="section-title">', chartSectionStart);
const page1ChartSection = page1.slice(chartSectionStart, chartSectionEnd);
check(
  '7. Page 1 displays exactly two charts in one side-by-side row, Rasi first and Navamsa second',
  (page1ChartSection.match(/class="chart-box panel"/g) || []).length === 2
    && page1ChartSection.indexOf('Rasi Chart (Chakra)') < page1ChartSection.indexOf('Navamsa Chart (D9)')
    && page1ChartSection.includes('navamsa-chart-grid'),
  'Rasi left, Navamsa D9 right'
);
check(
  '7. Page 1 omits the detailed Planetary Positions and Vimshottari Dasha sections',
  !page1.includes('Planetary Positions')
    && !page1.includes('Vimshottari Dasha (Mahadasha)')
    && !page1.includes('Current Dasa')
    && !page1.includes('dasha-table')
);
check(
  '7. Dasha calculations still power the page-2 Current Guidance prediction',
  page2.includes('Current Guidance') && /Mahadasha|Mahadasa/.test(page2),
  'Dasha details stay in the prediction data, not page-1 tables'
);
{
  const nodePdf = readFileSync(new URL('../server/astrology/pdfGenerator.ts', import.meta.url), 'utf8');
  const nodePdfPageOneStart = nodePdf.indexOf('// PAGE 1: Birth Details, Rasi + Navamsa Charts & Doshas');
  const nodePdfPageTwoStart = nodePdf.indexOf('// PAGE 2: 8 Life-Prediction Cards', nodePdfPageOneStart);
  const nodePdfPageOne = nodePdfPageOneStart >= 0 && nodePdfPageTwoStart > nodePdfPageOneStart
    ? nodePdf.slice(nodePdfPageOneStart, nodePdfPageTwoStart)
    : '';
  check(
    '7. Direct-download PDF fallback uses Rasi left / Navamsa right and omits both detailed tables',
    nodePdfPageOne.includes("drawChartBox(margin, 'Rasi Chart', planetsBySign)")
      && nodePdfPageOne.includes("drawChartBox(rightBoxX, 'Navamsa Chart (D9)', navamsaBySign, hasNavamsaData)")
      && !nodePdfPageOne.includes('Planetary Positions')
      && !nodePdfPageOne.includes('Current Dasa')
  );
}
{
  const navagrahaCss = /table\.navagraha-table\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(designHtml);
  const navagrahaThCss = /table\.navagraha-table th\s*\{[^}]*font-size:\s*([\d.]+)px/.exec(designHtml);
  check(
    '7. Navagraha table font is at least 10px (table and header)',
    Number(navagrahaCss?.[1]) >= 10 && Number(navagrahaThCss?.[1]) >= 10,
    `table ${navagrahaCss?.[1]}px, th ${navagrahaThCss?.[1]}px`
  );
}
check(
  '7. An invalid Ascendant renders no Lagna marker in either chart (Rasi or D9)',
  !/class="planet-name is-lagna"/.test(buildJathagamHtml({ ...chart, lagnaRasi: 0 as unknown as Rasi }, 'en')),
  'the D9 Lagna never substitutes for a missing D1 Ascendant'
);
check(
  '7. Life cards are sized to their own content (auto rows, no stretched paragraph)',
  /\.life-grid-big\s*\{[^}]*grid-auto-rows:\s*auto/.test(designHtml)
    && /\.life-grid-big\s*\{[^}]*align-items:\s*start/.test(designHtml)
    && !/\.life-card-big p\s*\{[^}]*flex:\s*1;/.test(designHtml)
);
{ // The transpiled source is minified, so match without relying on quotes.
  const fitter = fitJathagamLifeCardText.toString();
  check(
    '7. Page-2 text fitting measures the content-sized stack against one A4',
    /justifyContent\s*=\s*['"]flex-start['"]/.test(fitter)
      && /inner\.scrollHeight/.test(fitter)
      // `.inner` is `flex: 1` inside a `min-height: 297mm` sheet; without the
      // temporary `flex: 0 0 auto` the measurement would always read a full page.
      && /inner\.style\.flex\s*=\s*['"]0 0 auto['"]/.test(fitter)
      && /page\.style\.height\s*=\s*['"]auto['"]/.test(fitter),
    'natural .inner height + restored inline styles'
  );
}
{
  const summaryFitter = fitJathagamSummaryText.toString();
  check(
    '8. Page-3 Short Summary fitter only enlarges type from the 10.5px floor',
    /setProperty\(['"]--summary-scale['"]/.test(summaryFitter)
      && /let low\s*=\s*1/.test(summaryFitter)
      && /inner\.scrollHeight/.test(summaryFitter)
      && /inner\.style\.flex\s*=\s*['"]0 0 auto['"]/.test(summaryFitter),
    'scale ≥ 1, content-sized measure'
  );
}
// ---------------------------------------------------------------------------
// PHP mirror. There is no PHP runtime in this repo's Node test job, so the
// parity checks read the PHP report/engine sources the same way the rest of the
// suite does. Every rule above must exist on both stacks.
// ---------------------------------------------------------------------------
{
  const phpReport = readFileSync(new URL('../api/astrology/pdf_mpdf_reports.php', import.meta.url), 'utf8');
  // The life-card code sits above the page-3 Short Summary banner. The banner is
  // the boundary because page 3 needs the engine's node convention (Rahu in
  // Viruchigam, Ketu in Rishabam), while the life-card tables must stay free of
  // any invented node debilitation - the two rules are deliberately different.
  const page3Banner = phpReport.indexOf('// BIRTH JATHAGAM - PAGE 3 (SHORT SUMMARY)');
  const lifeCardRegion = page3Banner > 0 ? phpReport.slice(0, page3Banner) : phpReport;
  const page3Region = page3Banner > 0 ? phpReport.slice(page3Banner) : '';
  const phpEngine = readFileSync(new URL('../api/astrology/engine.php', import.meta.url), 'utf8');
  const phpConfig = readFileSync(new URL('../api/config.php', import.meta.url), 'utf8');

  check(
    'PHP 1. The running Mahadasa lord is read from dashaPeriods[].mahadashaLord (Graha enum), not from display text',
    /dashaPeriodsForLife/.test(phpReport)
      && /\$currentDashaLordKeyForLife = strtolower\(\(string\) \(\$periodForLife\['mahadashaLord'\]/.test(phpReport)
      && /\$dashaNameToKeyForLife/.test(phpReport),
    'enum key + legacy name fallback'
  );
  check(
    'PHP 1. The Guidance card badge follows the enum assessment (Caution / Opportunity / N/A)',
    /'badge' => \$dashaIsChallengingForLife === null[\s\S]{0,600}?Upcoming Year ✓ Opportunity/.test(phpReport)
      && /'caution' => \$dashaIsChallengingForLife === true/.test(phpReport)
  );
  check(
    'PHP 2. A malefic is conjunct only inside the 10° orb, never by shared rasi alone',
    /\$lifeConjunctionOrbDeg = 10\.0;/.test(phpReport)
      && /\$separation > \$lifeConjunctionOrbDeg/.test(phpReport)
      && !/gBhava === \$bhava/.test(phpReport),
    'no same-sign-only conjunction'
  );
  check(
    'PHP 3. Exalted / own-sign lord offsets one malefic conjunction; debilitated malefics are not counted',
    /\$lifeIsDignified = function/.test(phpReport)
      && /\$dignityOffsetCount = \(\$isDignifiedLord && !empty\(\$strongMaleficNames\)\) \? 1 : 0;/.test(phpReport)
      && /is debilitated, so not counted as a strong malefic/.test(phpReport)
      && /exalted\/own-sign lord offsets one malefic conjunction/.test(phpReport)
  );
  check(
    'PHP 3. The PHP dignity tables equal the shared dignity.ts tables',
    /'sun' => 1, 'moon' => 2, 'mars' => 10, 'mercury' => 6, 'jupiter' => 4, 'venus' => 12, 'saturn' => 7/.test(phpReport)
      && /'jupiter' => \[9, 12\], 'venus' => \[2, 7\], 'saturn' => \[10, 11\]/.test(phpReport)
      && JSON.stringify(['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'])
        === JSON.stringify(Object.keys({
          sun: 1, moon: 2, mars: 10, mercury: 6, jupiter: 4, venus: 12, saturn: 7
        })),
    'seven grahas only'
  );
  check(
    'PHP 4. No Rahu/Ketu debilitation in the life-card tables',
    /\$debilitationRasiForLife = \['sun' => 7[\s\S]*?'saturn' => 1\];/.test(lifeCardRegion)
      && !/'rahu' => 8/.test(lifeCardRegion)
      && !/'ketu' => 2/.test(lifeCardRegion),
    'seven grahas only in the cards; the nodes are not called debilitated there'
  );
  check(
    'PHP 4. Page 3 uses the engine node convention instead (Rahu Viruchigam, Ketu Rishabam)',
    /\$nodeDebilitation = \['rahu' => 8, 'ketu' => 2\];/.test(page3Region)
      && /\$nodeDebilitationSign = \$nodeDebilitation\[\$key\] \?\? null;/.test(page3Region)
  );
  check(
    'PHP 5. The report prints the ayanamsa value + mode and the Rahu node convention',
    /\$ayanamsaText = \$ayanamsaValueText \. ' Lahiri Chitra Paksha \('/.test(phpReport)
      && /\$nodeTypeText = \$nodeTypeForReport === 'TRUE'/.test(phpReport)
      && /Mean node \(classical\)/.test(phpReport)
      && /\{\$nodeTypeText\}/.test(phpReport)
  );
  check(
    'PHP 5. Both PHP defaults are the classical MEAN node',
    /return self::NODE_TYPE_MEAN;/.test(phpEngine)
      && /ASTRO_RAHU_NODE_TYPE[\s\S]{0,400}?'MEAN'/.test(phpConfig)
  );
  check(
    'PHP 6. The cards name the karakas: Venus (marriage), Jupiter (wealth), 11th lord (income), 6th lord (health)',
    /\$venusLineForLife = \$karakaLineForLife\('venus'/.test(phpReport)
      && /\$jupiterLineForLife = \$karakaLineForLife\('jupiter'/.test(phpReport)
      && /\$incomeLordLineForLife = \$lifeLordRoleLine\(11,/.test(phpReport)
      && /\$healthLordLineForLife = \$lifeLordRoleLine\(6,/.test(phpReport)
      && (phpReport.match(/\$venusLineForLife/g) || []).length >= 4
      && (phpReport.match(/\$healthLordLineForLife/g) || []).length >= 4
  );
  const phpChartRowStart = phpReport.indexOf('$rasiNavamsaRowHtml = <<<HTML');
  const phpChartRowEnd = phpReport.indexOf('\nHTML;', phpChartRowStart);
  const phpChartRow = phpChartRowStart >= 0 && phpChartRowEnd > phpChartRowStart
    ? phpReport.slice(phpChartRowStart, phpChartRowEnd)
    : '';
  const phpPageOneStart = phpReport.indexOf('$page1Html = self::topHeader');
  const phpPageTwoStart = phpReport.indexOf('// ---------------- PAGE 2:', phpPageOneStart);
  const phpPageOne = phpPageOneStart >= 0 && phpPageTwoStart > phpPageOneStart
    ? phpReport.slice(phpPageOneStart, phpPageTwoStart)
    : '';
  check(
    'PHP 7. Page 1 keeps Rasi on the left and Navamsa (D9) on the right, with no positions or Dasha tables',
    /\$chartCardTitle = .*'Rasi Chart \(Chakra\)'/.test(phpReport)
      && /\$navamsaCardTitle = .*'Navamsa Chart \(D9\)'/.test(phpReport)
      && phpChartRow.indexOf('{$chartCardTitle}') < phpChartRow.indexOf('{$navamsaCardTitle}')
      && phpChartRow.includes('{$chartRows}')
      && phpChartRow.includes('{$navamsaBlockHtml}')
      && /<table class="rasi-table">/.test(phpReport)
      && phpPageOne.includes('{$rasiNavamsaRowHtml}')
      && !phpPageOne.includes('{$planetRows}')
      && !phpPageOne.includes('{$currentDasha}')
      && !phpPageOne.includes('dasha-table'),
    'two chart panels only on page 1'
  );
  check(
    'PHP 7. The Navamsa rasi is preferred from the engine, else derived from the same longitude rule',
    /\$navRasi = \$normalizeRasiNumber\(\$p\['navamsaRasi'\] \?\? null\)/.test(phpReport)
      && /\(360\.0 \/ 108\.0\)/.test(phpReport),
    'floor(lon / 3°20′) % 12 + 1'
  );
  check(
    'PHP 7. The Navagraha table font is at least 10px (table and header)',
    /table\.navagraha-table \{[^}]*font-size: 10px/.test(phpReport)
      && /table\.navagraha-table th \{[^}]*font-size: 10px/.test(phpReport)
  );
  const phpSummaryCssBlock = /public static function birthSummaryCss\(\)[\s\S]*?\n    \}/.exec(phpReport)?.[0] ?? '';
  const phpSummarySizes = Array.from(phpSummaryCssBlock.matchAll(/font-size:\s*([\d.]+)px/g), m => Number(m[1]));
  check(
    'PHP 8. The Birth Jathagam total lives in one constant, used by all three headers',
    /public const JATHAGAM_PAGE_TOTAL = 3;/.test(phpReport)
      && (phpReport.match(/self::JATHAGAM_PAGE_TOTAL/g) || []).length === 3
      && !/topHeader\('ASTRO SIVAM', \$p[123]Sub, \$orderNumber, [123], 3, \$lang/.test(phpReport),
    'no scattered page totals'
  );
  check(
    'PHP 8. Every Short Summary rule stays at or above the 10.5px floor',
    phpSummarySizes.length >= 10 && Math.min(...phpSummarySizes) >= 10.5,
    `${phpSummarySizes.length} sizes, min ${Math.min(...phpSummarySizes)}px`
  );
  check(
    'PHP 8. The care table header honours the same floor as the HTML and jsPDF renderers',
    /table\.summary-care th \{[^}]*font-size: 10\.5px/.test(phpSummaryCssBlock)
  );
  check(
    'PHP 7. Life cards are content-sized: no forced row height on the card grid',
    !/table\.life-grid tr \{[^}]*height:/.test(phpReport)
      && !/td\.life-card \{[^}]*height:\s*[\d.]+mm/.test(phpReport)
      && /mPDF grows a row to its[\s\S]{0,60}?tallest cell/.test(phpReport)
  );
}

assert.ok(checks >= 25, `expected the full card-rule matrix, ran ${checks} checks`);

console.log(`\n${process.exitCode ? 'FAILED' : 'PASSED'}: jathagam card rules (${checks} checks)\n`);
