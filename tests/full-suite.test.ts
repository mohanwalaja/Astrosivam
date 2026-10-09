import {
  calculatePrecisionHoroscope,
  calculateLahiriAyanamsa,
  calculateSiderealAscendant
} from '../server/astrology/astronomy';
import {
  calculateWeddingCompatibility,
  calculateMarriageMatch
} from '../server/astrology/matchmaking';
import { PoruthamStatus, AppLanguage, Graha } from '../server/astrology/types';
import {
  calculateBabyNamingDetails,
  calculateBabyNaming,
  ALL_NAKSHATRA_LETTERS
} from '../server/astrology/babynames';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder';
import { transliterateToTamil, transliterateToHindi } from '../src/services/indicTransliteration';
import { buildNamakaranPadaNamesFromResult, buildNamakaranPadaNames } from '../server/astrology/namakaranNames';
import { NAMAKARAN_MEANING_GLOSSARY } from '../server/astrology/namakaranMeaningData';
import { buildWeddingMatchHtml } from '../src/services/weddingHtmlBuilder';
import { weddingDisclaimerPlainText } from '../src/services/weddingDisclaimerNotes';
import { buildInvoiceHtml, buildFamilyInvoiceHtml, memberDisplayName, invoiceLanguageLabel } from '../src/services/invoiceHtmlBuilder';
import { normalizeReportLanguage } from '../src/services/reportLanguage';
import { MAX_FAMILY_ORDER_ITEMS, hasFamilyOrderCapacity } from '../src/services/familyOrderLimits';
import {
  generateHoroscopePdf,
  generateWeddingMatchPdf,
  generateBabyNamingPdf,
  generateMuhurthamPdf,
  generateInvoicePdf,
  generateFamilyInvoicePdf
} from '../server/astrology/pdfGenerator';
import * as Astronomy from 'astronomy-engine';
import {
  createSignedToken,
  verifySignedToken,
  verifyGoogleLogin,
  verifyFacebookLogin
} from '../server/security/tokens';
import { formatBirthPlace, describeFamilyRenderQuality } from '../src/services/formatUtils';
import {
  describeDobProblem,
  describeTobProblem,
  formatDobInputWhileTyping,
  formatTobInputWhileTyping,
  parseFlexibleDob,
  parseFlexibleTob
} from '../src/utils/dateTimeInput';
import {
  mergeOrderPayloadIntoResult,
  resultNeedsRecalculation,
  familyMemberDisplayName,
  buildOrderReportHtml,
  assertPreviewQualityPdfBase64,
  EMAIL_RENDER_OPTIONS,
  DOWNLOAD_RENDER_OPTIONS,
  DOWNLOAD_RENDER_OPTIONS_MOBILE
} from '../src/services/jathagamPdfExporter';
import { buildJathagamHtml, buildJathagamLifeCards } from '../src/services/jathagamHtmlBuilder';
import { buildMuhurthamReportNotes } from '../src/services/muhurthamReportNotes';
import { installCanvasFontMetricsReset } from '../src/services/reportCapture';
import {
  buildMuhurthamHtml,
  muhurthamTimeFontScale,
  MUHURTHAM_DATE_COLUMN_RATIOS,
  MUHURTHAM_TIME_TEXT_WIDTH_MM
} from '../src/services/muhurthamHtmlBuilder';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { EMBEDDED_LOGO_BASE64, getLogoEmailAttachment, getLogoFilePath } from '../server/astrology/logoBase64';
import { ASTRO_LOGO_BASE64 } from '../src/services/logoData';

console.log('=====================================================');
console.log('       ASTRO SIVAM FULL TEST SUITE VERIFICATION       ');
console.log('=====================================================\n');

let failedTests = 0;
function assert(desc: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log('  [PASS]', desc);
  } else {
    console.error('  [FAIL]', desc, extra ? JSON.stringify(extra) : '');
    failedTests++;
  }
}

// 1. AYANAMSA TEST
console.log('TEST 1: Lahiri Ayanamsa Model');
const jd2000 = 2451545.0;
const ayanamsa2000 = calculateLahiriAyanamsa(jd2000);
// TRUE Lahiri ayanamsa (mean + Δψ), the convention Drik Panchang displays and
// the PHP engine subtracts: 23.8532° at J2000.0, not the MEAN 23.8571°.
assert('Lahiri Ayanamsa on J2000.0 is ~23.853° (true, mean + Δψ)', Math.abs(ayanamsa2000 - 23.8532) < 0.001, { ayanamsa2000 });
const jd2024 = 2460390.5; // ~March 2024
const ayanamsa2024 = calculateLahiriAyanamsa(jd2024);
assert('Lahiri Ayanamsa in 2024 is ~24.19°', Math.abs(ayanamsa2024 - 24.19) < 0.05, { ayanamsa2024 });

// 2. LAGNA (ASCENDANT) TEST - SUNRISE EQUALITY
console.log('\nTEST 2: Lagna (Ascendant) Calculation vs Sunrise');
const observer = new Astronomy.Observer(13.0827, 80.2707, 0); // Chennai
const vernalEquinox = new Date(Date.UTC(2024, 2, 20, 0, 0, 0));
const rise = Astronomy.SearchRiseSet('Sun', observer, +1, vernalEquinox, 1);
assert('Sunrise found successfully', rise !== null);
if (rise) {
  const sunPos = Astronomy.SunPosition(rise.date);
  const { ascTropical, lagnaSidereal } = calculateSiderealAscendant(rise, 13.0827, 80.2707, ayanamsa2024);
  const diff = Math.abs(ascTropical - sunPos.elon);
  assert('Ascendant at sunrise matches Sun longitude within ~1° refraction limit', diff < 1.5, { ascTropical, sunElon: sunPos.elon, diff });
  assert('Sidereal Lagna equals tropical ascendant minus ayanamsa', Math.abs((ascTropical - ayanamsa2024 + 360) % 360 - lagnaSidereal) < 0.001);
}

// 3. SOUTHERN HEMISPHERE LAGNA (SUVA, FIJI)
console.log('\nTEST 3: Southern Hemisphere Coordinates (Suva, Fiji)');
const suvaHoro = calculatePrecisionHoroscope('Fiji Native', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M');
assert('Suva horoscope computed with valid Lagna Rasi (1-12)', suvaHoro.lagnaRasi >= 1 && suvaHoro.lagnaRasi <= 12, { lagna: suvaHoro.lagnaRasiNameEn });
assert('Suva horoscope computed with valid Chandra Rasi (1-12)', suvaHoro.chandraRasi >= 1 && suvaHoro.chandraRasi <= 12, { chandra: suvaHoro.chandraRasiNameEn });
assert('Janma Nakshatra index is valid (0-26)', suvaHoro.janmaNakshatraIndex >= 0 && suvaHoro.janmaNakshatraIndex < 27, { nak: suvaHoro.janmaNakshatraEn });
assert('Janma Pada is valid (1-4)', suvaHoro.janmaPada >= 1 && suvaHoro.janmaPada <= 4, { pada: suvaHoro.janmaPada });

// 4. PLANETARY POSITIONS & BHAVAS
console.log('\nTEST 4: 9 Navagrahas & 12 Bhavas');
assert('Exactly 9 Grahas calculated', suvaHoro.planetPositions.length === 9);
assert('Exactly 12 Bhavas calculated', suvaHoro.bhavas.length === 12);
assert('Bhava 1 Rasi equals Lagna Rasi', suvaHoro.bhavas[0].rasi === suvaHoro.lagnaRasi);
const rahu = suvaHoro.planetPositions.find(p => p.graha === 'rahu');
const ketu = suvaHoro.planetPositions.find(p => p.graha === 'ketu');
assert('Rahu and Ketu are 180° apart', Math.abs(Math.abs(rahu!.totalDegrees - ketu!.totalDegrees) - 180.0) < 0.1);

// 5. VIMSHOTTARI DASHA 120-YEAR CYCLE & CURRENT AGE
console.log('\nTEST 5: Vimshottari Dasha System');
assert('Total 9 Mahadashas in timeline', suvaHoro.dashaPeriods.length === 9);
assert('Every Mahadasha contains 9 Antardashas (Bhuktis)', suvaHoro.dashaPeriods.every(p => p.antardashas && p.antardashas.length === 9));
assert('Current active Dasha identified for 2026', suvaHoro.currentDasha !== undefined);
console.log('  Current Mahadasha in 2026:', suvaHoro.currentDasha?.mahadashaLordEn, '| Antardasha:', suvaHoro.currentDasha?.antardashaLordEn);

// 5b. Classical Vimshottari order, 120-year cycle and Antardasha formula.
// (tests/vimshottari-dasha-timeline.test.ts sweeps all 27 Nakshatras; this is
// the in-suite guard that the same rules hold for a real chart.)
const CLASSICAL_DASHA_ORDER: Graha[] = [
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA,
  Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
];
const CLASSICAL_DASHA_YEARS: Record<Graha, number> = {
  [Graha.KETU]: 7, [Graha.SUKRA]: 20, [Graha.SURYA]: 6, [Graha.CHANDRA]: 10,
  [Graha.CHEVVAI]: 7, [Graha.RAHU]: 18, [Graha.GURU]: 16, [Graha.SANI]: 19, [Graha.BUDHA]: 17
};
const dashaLords = suvaHoro.dashaPeriods.map(p => p.mahadashaLord);
const birthLord = dashaLords[0];
const rotatedOrder = CLASSICAL_DASHA_ORDER.map(
  (_, offset) => CLASSICAL_DASHA_ORDER[(CLASSICAL_DASHA_ORDER.indexOf(birthLord) + offset) % 9]
);
assert('Mahadashas follow the classical Ketu to Mercury order from the birth Nakshatra lord',
  JSON.stringify(dashaLords) === JSON.stringify(rotatedOrder), { dashaLords, rotatedOrder });
assert('The nine classical periods total exactly 120 years',
  Object.values(CLASSICAL_DASHA_YEARS).reduce((sum, years) => sum + years, 0) === 120);
assert('Every Mahadasha after the birth balance carries its classical year count',
  suvaHoro.dashaPeriods.slice(1).every(p => p.years === CLASSICAL_DASHA_YEARS[p.mahadashaLord]),
  suvaHoro.dashaPeriods.map(p => `${p.mahadashaLord}:${p.years}`));
assert('Consecutive Mahadashas are contiguous',
  suvaHoro.dashaPeriods.slice(1).every((p, i) => p.startDate === suvaHoro.dashaPeriods[i].endDate));
assert('Every Antardasha follows the (mahaYears x antarYears) / 120 formula',
  suvaHoro.dashaPeriods.every(period => (period.antardashas || []).every(entry =>
    entry.months === Number(((CLASSICAL_DASHA_YEARS[period.mahadashaLord] * CLASSICAL_DASHA_YEARS[entry.lord]) / 120 * 12).toFixed(1))
  )));
assert('The ninth Antardasha of each Mahadasha ends with its Mahadasha',
  suvaHoro.dashaPeriods.every(period => {
    const antardashas = period.antardashas || [];
    return antardashas.length === 0 || antardashas[antardashas.length - 1].endDate === period.endDate;
  }));
assert('The reported current period lies inside the reported Mahadasha window',
  Boolean(suvaHoro.currentDasha) &&
  suvaHoro.currentDasha!.mahadashaStart <= suvaHoro.currentDasha!.antardashaStart &&
  suvaHoro.currentDasha!.antardashaEnd <= suvaHoro.currentDasha!.mahadashaEnd,
  suvaHoro.currentDasha);
// 6. ALL DOSHAS ACCURACY
console.log('\nTEST 6: All Dosha Calculations (Kuja, Kala Sarpa, Pitru, Guru Chandala)');
const coreDoshas = suvaHoro.doshas.filter(d => !d.isNavagrahaAfflictionIndicator);
assert('4 named Dosha checks performed', coreDoshas.length === 4);
assert('Every active Navagraha indicator has a remedy', suvaHoro.doshas.filter(d => d.isPresent).every(d => Boolean(d.traditionalRemedyEn.trim())));
const doshaNames = coreDoshas.map(d => d.nameEn);
assert('Contains Kuja Dosha check', doshaNames.some(n => n.includes('Kuja')));
assert('Contains Kala Sarpa check', doshaNames.some(n => n.includes('Kala Sarpa')));
assert('Contains Pitru check', doshaNames.some(n => n.includes('Pitru')));
assert('Contains Guru Chandala check', doshaNames.some(n => n.includes('Guru Chandala')));

// 7. MARRIAGE MATCHMAKING (10 PORUTHAMS)
console.log('\nTEST 7: 10 Poruthams Wedding Matchmaking');
const match = calculateWeddingCompatibility(
  { name: 'Bride', dob: '1995-05-15', tob: '10:30', birthPlace: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5 },
  { name: 'Groom', dob: '1993-08-20', tob: '14:15', birthPlace: 'Coimbatore', latitude: 11.0168, longitude: 76.9558, timezoneOffsetHours: 5.5 }
);
assert('Exactly 10 Poruthams evaluated', match.poruthams.length === 10);
assert('Total score is within 0 to 10', match.totalScore >= 0 && match.totalScore <= 10, { score: match.totalScore });
assert('Kuja Dosha analysis evaluated for bride and groom', match.sevvayDosham !== undefined);
assert('Rajju status evaluated', typeof match.rajjuMatch === 'boolean');
assert('calculateMarriageMatch alias is identical', typeof calculateMarriageMatch === 'function');

// 8. BABY NAMING (NAMAKARAN)
console.log('\nTEST 8: Baby Naming 108 Padas Syllables');
assert('All 27 Nakshatras registered', ALL_NAKSHATRA_LETTERS.length === 27);
const totalPadas = ALL_NAKSHATRA_LETTERS.reduce((sum, n) => sum + n.padas.length, 0);
assert('Exactly 108 Padas registered (27 stars * 4 padas)', totalPadas === 108);
assert('Every Nakshatra supplies exactly four distinct Pada sounds',
  ALL_NAKSHATRA_LETTERS.every(n => n.padas.length === 4 && new Set(n.padas.map(p => p.letterEn)).size === 4)
);

// Regression for the reported production defect: Mrigashirsha's first
// pada must be Ve / Way, never the Ashwini default (Chu / Che / Cho / La).
const mrigashirsha = ALL_NAKSHATRA_LETTERS.find(n => n.nakshatraIndex === 5)!;
assert('Mrigashirsha Pada 1 resolves to Ve / Way',
  mrigashirsha.padas[0].letterEn === 'Ve / Way' && mrigashirsha.padas[0].letterTa === 'வே'
);
assert('Mrigashirsha exposes its own four sounds',
  mrigashirsha.padas.map(p => p.letterEn).join(', ') === 'Ve / Way, Vo / Woh, Kaa, Kee / Ki'
);

// The cPanel/PHP delivery path reads the same complete 27-star table.
const phpBabyLetters = JSON.parse(readFileSync(resolve(process.cwd(), 'api/astrology/baby_nakshatra_letters.json'), 'utf8'));
assert('PHP delivery table contains all 27 Nakshatras and 108 Padas',
  phpBabyLetters.length === 27 && phpBabyLetters.every((n: any) => n.padas?.length === 4)
);
assert('PHP delivery table preserves Mrigashirsha Pada 1 as Ve / Way',
  phpBabyLetters.find((n: any) => n.nakshatraIndex === 5)?.padas?.[0]?.letterEn === 'Ve / Way'
);
assert('PHP and TypeScript delivery tables agree for all 108 Pada sounds',
  phpBabyLetters.every((n: any) =>
    n.padas.every((p: any, index: number) =>
      p.letterEn === ALL_NAKSHATRA_LETTERS[n.nakshatraIndex - 1]?.padas[index]?.letterEn
    )
  )
);

const baby = calculateBabyNamingDetails('Aarav', '2024-03-10', '08:45', 'Suva', 'M', -18.1416, 178.4419, 12, 'Fiji');
assert('Baby Naming result is marked with the 108-pada algorithm version', baby.babyNamingAlgorithmVersion === 2);
assert('Baby primary letter resolved in English, Tamil, and Hindi',
  Boolean(baby.primaryPadaInfo.letterEn && baby.primaryPadaInfo.letterTa && baby.primaryPadaInfo.letterHi),
  { en: baby.primaryPadaInfo.letterEn, ta: baby.primaryPadaInfo.letterTa, hi: baby.primaryPadaInfo.letterHi }
);
assert('calculateBabyNaming alias works with single object payload',
  typeof calculateBabyNaming({
    babyName: 'Aarav', dob: '2024-03-10', tob: '08:45', birthPlace: 'Suva', country: 'Fiji',
    latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12
  }) === 'object'
);

// 9. HTML BUILDERS & PDF GENERATION (NO OVERLAP / CLIPPING)
console.log('\nTEST 9: HTML Builders & PDF Generation');
const babyHtml = buildBabyNamingHtml(baby, 'en');
assert('Baby Naming HTML generated', babyHtml.includes('namakaran-certificate-page'));
let missingBabyStarRejected = false;
try {
  buildBabyNamingHtml({
    ...baby,
    janmaNakshatraEn: '',
    janmaNakshatraTa: '',
    janmaNakshatraHi: '',
    janmaNakshatraIndex: undefined,
    nakshatraIndex: undefined,
    janmaPada: undefined,
    primaryPadaInfo: undefined as any,
    nakshatraLetters: { padas: [] } as any
  }, 'en');
} catch (error) {
  missingBabyStarRejected = /verified birth Nakshatra/i.test(String(error));
}
assert('Baby Naming report refuses to invent Ashwini when the saved birth star is missing', missingBabyStarRejected);
assert('Baby Naming HTML contains .inner class', babyHtml.includes('royal-frame inner'));
assert('Baby Naming keeps the main letter without the extra circular syllable badge',
  !babyHtml.includes('sound-medallion') && babyHtml.includes('class="sound-big-char"'));
assert('Baby Naming page 2 uses large name type and separate meaning lines',
  /\.sug-name-text\s*\{\s*font-size:\s*14px/.test(babyHtml) &&
  /\.sug-name-meaning\s*\{\s*font-size:\s*10px/.test(babyHtml));
assert('Baby Naming HTML has no duplicate broken CSS', !babyHtml.includes('}\n    font-size: 11px;\n    line-height: 1.2;\n    flex-shrink: 0;\n  }\n  .virtue-text {'));
const legacyAshwiniPadas = ALL_NAKSHATRA_LETTERS.find(n => n.nakshatraIndex === 1)!;
const mrigashirshaPreview = buildBabyNamingHtml({
  ...baby,
  // Simulates an old PHP order: the star name is Mrigashirsha but its saved
  // padas and primary letter were incorrectly borrowed from Ashwini.
  janmaNakshatraEn: 'Mrigashirsha',
  nakshatraLetters: {
    ...legacyAshwiniPadas,
    nakshatraNameEn: 'Mrigashirsha',
    nakshatraNameTa: 'மிருகசீரிடம்'
  },
  janmaPada: 1,
  primaryPadaInfo: legacyAshwiniPadas.padas[0]
}, 'en');
assert('Baby Naming certificate repairs legacy Mrigashirsha orders to Ve / Way',
  mrigashirshaPreview.includes('Ve / Way') && !mrigashirshaPreview.includes('Chu / Su')
);

// ── PAGE 2: South & North Indian name suggestions ──────────────────────────
const escapeForTest = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const babyGirl = calculateBabyNamingDetails('Diya', '2025-01-15', '11:20', 'Madurai', 'F', 9.9252, 78.1198, 5.5, 'India');
const countOccurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

for (const [label, result] of [['boy', baby], ['girl', babyGirl]] as Array<[string, typeof baby]>) {
  const html = buildBabyNamingHtml(result, 'en');
  const pageTwo = html.slice(html.indexOf('id="namakaran-page-2"'));
  assert(`Baby Naming ${label} report has a second page`, pageTwo.length > 0);
  assert(`Baby Naming ${label} report has exactly two report pages`,
    countOccurrences(html, 'id="namakaran-page-') === 2);
  assert(`Baby Naming ${label} page 2 prints both style headings`,
    pageTwo.includes('South Indian Style Names') && pageTwo.includes('North Indian Style Names'));
  assert(`Baby Naming ${label} page 2 shows all four pada sounds of the birth star`,
    result.nakshatraLetters.padas.every((pada: any) => pageTwo.includes(pada.letterEn.split('/')[0].trim())));
  assert(`Baby Naming ${label} page 2 shows the baby's own gender names`,
    pageTwo.includes('Baby Boy') === (result.gender !== 'F'));

  // The rendered page must match the shared resolver one-to-one.
  const columns = buildNamakaranPadaNamesFromResult(result as any);
  assert(`Baby Naming ${label} page 2 carries all four padas of the birth star`, columns.length === 4);
  assert(`Baby Naming ${label} page 2 prints every suggested name`,
    columns.flatMap(c => [...c.south, ...c.north]).every(n => pageTwo.includes(escapeForTest(n.name))));
  const allNames = columns.flatMap(c => [...c.south, ...c.north]).map(n => n.name.toLowerCase());
  assert(`Baby Naming ${label} page 2 never repeats a name`, new Set(allNames).size === allNames.length);
  // The bank shows whatever each akshara holds (up to 15) and completes a
  // short list with related sounds of the same letter, so every pada of the
  // birth star still prints a usable list instead of an empty column.
  assert(`Baby Naming ${label} page 2 gives every pada a usable list on both sides`,
    columns.every(c => c.south.length >= 3 && c.north.length >= 3));
  assert(`Baby Naming ${label} page 2 prints a healthy page of names`,
    columns.reduce((sum, c) => sum + c.south.length, 0) >= 24 &&
    columns.reduce((sum, c) => sum + c.north.length, 0) >= 24);
  assert(`Baby Naming ${label} page 2 keeps every list within the 15-name cap`,
    columns.every(c => c.south.length <= 15 && c.north.length <= 15));
  assert(`Baby Naming ${label} page 2 prints a short meaning for every name`,
    columns.every(c => [...c.south, ...c.north].every(n => n.meaning.length > 0 && n.meaning.length <= 30)));
}

// Page 2 shows names according to the ordered report language.
for (const lang of ['en', 'ta', 'hi'] as const) {
  const html = buildBabyNamingHtml(baby, lang as any);
  assert(`Baby Naming page 2 renders in ${lang}`,
    html.includes('id="namakaran-page-2"') && html.includes('namakaran-suggestions-page'));
}
const firstSuggestedName = buildNamakaranPadaNamesFromResult(baby as any)[0].south[0].name;
const expectedTaName = transliterateToTamil(firstSuggestedName);
const expectedHiName = transliterateToHindi(firstSuggestedName);

const taBabyHtml = buildBabyNamingHtml(baby, 'ta');
const hiBabyHtml = buildBabyNamingHtml(baby, 'hi');
const enBabyHtml = buildBabyNamingHtml(baby, 'en');

// The meaning under every name is a curated translation from
// data/namakaran_meaning_glossary.tsv — never word-by-word machine output.
const meaningGlossary = NAMAKARAN_MEANING_GLOSSARY;
for (const [label, result] of [['boy', baby], ['girl', babyGirl]] as Array<[string, typeof baby]>) {
  for (const column of buildNamakaranPadaNamesFromResult(result as any)) {
    for (const entry of [...column.south, ...column.north]) {
      const curated = meaningGlossary[entry.meaningEn.toLowerCase()];
      assert(`Baby Naming ${label} page 2 holds a curated Tamil translation for "${entry.meaningEn}"`,
        Boolean(curated) && entry.meaningTa === curated.ta);
      assert(`Baby Naming ${label} page 2 holds a curated Hindi translation for "${entry.meaningEn}"`,
        Boolean(curated) && entry.meaningHi === curated.hi);
      assert(`Baby Naming ${label} page 2 never leaks English into the Tamil meaning of ${entry.name}`,
        !/[A-Za-z]/.test(entry.meaningTa));
    }
  }
}
const taMeaningHtml = buildBabyNamingHtml(baby, 'ta');
assert('Baby Naming page 2 prints the curated Tamil meaning of the first suggested name',
  taMeaningHtml.includes(meaningGlossary[buildNamakaranPadaNamesFromResult(baby as any)[0].south[0].meaningEn.toLowerCase()].ta));
assert('Baby Naming page 2 prints no placeholder text in a Tamil meaning line',
  !taMeaningHtml.includes('பொருள் குறிப்பிடப்படவில்லை'));

assert('Baby Naming page 2 shows Tamil names in Tamil without English secondary brackets',
  taBabyHtml.includes(expectedTaName) && !taBabyHtml.includes(`(${firstSuggestedName})`));
assert('Baby Naming page 2 shows Hindi names in Devanagari in Hindi report',
  hiBabyHtml.includes(expectedHiName) && !hiBabyHtml.includes(`(${firstSuggestedName})`));
assert('Baby Naming page 2 shows English names in English report',
  enBabyHtml.includes(firstSuggestedName));

// Every pada of every star must print a usable list on both sides: the report
// is generated for any birth time, so no pada may render an empty column.
let thinnestPada = { count: Number.MAX_SAFE_INTEGER, label: '' };
for (const star of ALL_NAKSHATRA_LETTERS) {
  for (const gender of ['M', 'F'] as const) {
    const columns = buildNamakaranPadaNames(star.padas as any, gender);
    const pageNames = columns.flatMap(c => [...c.south, ...c.north]).map(n => n.name.toLowerCase());
    assert(`Baby Naming ${star.nakshatraNameEn} ${gender} never repeats a name on page 2`,
      new Set(pageNames).size === pageNames.length);
    for (const column of columns) {
      const lowest = Math.min(column.south.length, column.north.length);
      if (lowest < thinnestPada.count) {
        thinnestPada = { count: lowest, label: `${star.nakshatraNameEn} ${gender} ${column.soundTa}` };
      }
      assert(`Baby Naming ${star.nakshatraNameEn} ${gender} pada ${column.padaNumber} stays within the cap`,
        column.south.length <= 15 && column.north.length <= 15);
    }
  }
}
assert(`Baby Naming gives all 108 padas a name list (thinnest: ${thinnestPada.label})`,
  thinnestPada.count >= 1);

// Legacy orders without the cached suggestion lists still get page 2.
const legacyBaby = { ...baby } as any;
delete legacyBaby.nameSuggestions;
const legacyHtml = buildBabyNamingHtml(legacyBaby, 'en');
assert('Baby Naming page 2 is rebuilt for legacy orders without cached suggestions',
  legacyHtml.includes('id="namakaran-page-2"') && legacyHtml.includes('namakaran-suggestions-page'));
const babyWithoutRecordedPlace = buildBabyNamingHtml({ ...baby, birthPlace: '', country: '' }, 'en');
assert('Baby Naming never invents Nadi, Fiji when a legacy result has no recorded birthplace',
  babyWithoutRecordedPlace.includes('Not provided') && !babyWithoutRecordedPlace.includes('Nadi, Fiji'));


const matchHtml = buildWeddingMatchHtml(match, 'ta');
const weddingWithoutRecordedPlaces = buildWeddingMatchHtml({
  ...match,
  bridePlace: '',
  groomPlace: '',
  bride: {} as any,
  groom: {} as any,
  inputPayload: { bride: {}, groom: {} }
}, 'en');
assert('Marriage report never invents a Nadi birthplace when an old order lacks one',
  weddingWithoutRecordedPlaces.includes('Not provided') && !weddingWithoutRecordedPlaces.includes('Nadi, Fiji'));
assert('Wedding HTML generated in Tamil', matchHtml.includes('wedding-page-1') && matchHtml.includes('பொருத்தம்'));
assert('Wedding HTML contains 10 poruthams table', matchHtml.includes('poruthams-table'));
const goodWeddingHtml = buildWeddingMatchHtml({ ...match, verdictStatus: PoruthamStatus.MADHYAMAM }, 'en');
assert('A Madhyamam match ends with a clearly labeled amber, remedies-based verdict',
  goodWeddingHtml.includes('final-verdict-moderate') &&
  goodWeddingHtml.includes('FINAL VERDICT') &&
  goodWeddingHtml.includes('Acceptable match; suitable with remedies.')
);
const uttamamWeddingHtml = buildWeddingMatchHtml({ ...match, verdictStatus: PoruthamStatus.UTTHAMAM }, 'en');
assert('An Uttamam wedding match ends with the matching-good verdict in the summary and final box',
  uttamamWeddingHtml.includes('final-verdict-good') &&
  uttamamWeddingHtml.includes('This is a good match.')
);
const notGoodWeddingHtml = buildWeddingMatchHtml({ ...match, verdictStatus: PoruthamStatus.PORUNDHADHU }, 'en');
assert('An incompatible wedding match ends with a clearly labeled cautious red verdict',
  notGoodWeddingHtml.includes('final-verdict-not-good') &&
  notGoodWeddingHtml.includes('FINAL VERDICT') &&
  notGoodWeddingHtml.includes('not recommended on the current assessment')
);

// Page 2: the Marriage Matching disclaimer follows the ORDER language
// (English order -> English, Tamil -> Tamil, Hindi -> Hindi).
const weddingDisclaimerExpectations: Array<[AppLanguage, string]> = [
  ['en', 'Marriage Matching - Important Note'],
  ['ta', 'திருமணப் பொருத்தம் - முக்கியக் குறிப்பு'],
  ['hi', 'विवाह मिलान - महत्वपूर्ण सूचना']
];
for (const [lang, heading] of weddingDisclaimerExpectations) {
  const html = buildWeddingMatchHtml(match, lang);
  const page2 = html.substring(html.indexOf('id="wedding-page-2"'));
  assert(`Wedding report adds a page-2 disclaimer in ${lang}`,
    html.includes('id="wedding-page-1"') &&
    html.includes('id="wedding-page-2"') &&
    page2.includes(heading)
  );
  assert(`Wedding page-2 disclaimer in ${lang} never prints raw ** emphasis markers`,
    page2.includes('disclaimer-para') && !weddingDisclaimerPlainText(page2).includes('**')
  );
}
const weddingDisclaimerEn = buildWeddingMatchHtml(match, 'en');
assert('The English disclaimer explains arranged vs love marriage and warns it is guidance only',
  weddingDisclaimerEn.includes('<strong>Arranged Marriage</strong>') &&
  weddingDisclaimerEn.includes('<strong>Love Marriage</strong>') &&
  weddingDisclaimerEn.includes('<strong>Ten Poruthams (Dasa Porutham)</strong>') &&
  weddingDisclaimerEn.includes('<strong>Kuja Dosha (Sevvai Dosham)</strong>') &&
  weddingDisclaimerEn.includes('free and informed consent of both individuals') &&
  weddingDisclaimerEn.includes('not be based solely on horoscope matching')
);
assert('The same disclaimer copy is shared by the browser, Node and PHP renderers',
  readFileSync(resolve(process.cwd(), 'src', 'services', 'weddingDisclaimerNotes.ts'), 'utf8')
    .includes('wedding_disclaimer_notes.json') &&
  readFileSync(resolve(process.cwd(), 'server', 'astrology', 'pdfGenerator.ts'), 'utf8')
    .includes('buildWeddingDisclaimerNotes') &&
  readFileSync(resolve(process.cwd(), 'api', 'astrology', 'pdf_mpdf_reports.php'), 'utf8')
    .includes('WeddingDisclaimerNotes::build')
);

const invoiceHtml = buildInvoiceHtml({
  id: 'ord-1',
  orderNumber: 'INV-1001',
  createdAt: new Date().toISOString(),
  serviceType: 'MARRIAGE_COMPATIBILITY',
  amount: 45.0,
  currency: 'FJD',
  language: 'hi',
  userName: 'Client Name',
  userEmail: 'client@example.com'
});
assert('Invoice HTML generated for a Hindi order', invoiceHtml.includes('invoice-page'));
assert('Invoice HTML contains unconstrained inner', invoiceHtml.includes('class="inner"'));

// Full-page layout contract (REPORT_AND_INVOICE_FULL_PAGE_LAYOUT.md): every
// report sheet is at least one A4 and owns a growing block, and the old
// height + overflow:hidden pair that could silently cut text is gone. The
// measured half of the contract lives in tests/browser/full-page-layout.spec.ts.
const fullPageBuilders = {
  'Birth Jathagam': readFileSync(resolve(process.cwd(), 'src', 'services', 'jathagamHtmlBuilder.ts'), 'utf8'),
  'Marriage Matching': readFileSync(resolve(process.cwd(), 'src', 'services', 'weddingHtmlBuilder.ts'), 'utf8'),
  'Baby Naming': readFileSync(resolve(process.cwd(), 'src', 'services', 'babyNamingHtmlBuilder.ts'), 'utf8'),
  'Muhurtham': readFileSync(resolve(process.cwd(), 'src', 'services', 'muhurthamHtmlBuilder.ts'), 'utf8'),
  'Invoice': readFileSync(resolve(process.cwd(), 'src', 'services', 'invoiceHtmlBuilder.ts'), 'utf8')
};
const pageRuleOf = (source: string) => (source.match(/\.page\s*\{[^}]*\}/s) || [''])[0];
assert('Every report page is a min-height A4 canvas with a growing block',
  Object.entries(fullPageBuilders).every(([name, source]) => {
    const rule = pageRuleOf(source);
    const fills = /min-height:\s*297mm/.test(rule)
      && !/[^-]height:\s*297mm/.test(rule)
      && !/overflow:\s*hidden/.test(rule)
      && /flex:\s*1\s+0 auto|flex:\s*\d+\s+0 auto/.test(source)
      && !/\.footer\s*\{[^}]*margin-top:\s*auto/.test(source);
    if (!fills) console.warn('  layout contract broken in', name);
    return fills;
  })
);
assert('mPDF buys the same fill with sized blocks (no flexbox there)',
  // The invoice still fills its sheet with sized blocks. The Birth Jathagam
  // page 3 is the Short Summary now: the HTML fitter enlarges type to fill
  // the A4 and the care card is the growing block; mPDF keeps the proven
  // 3-page type budget in birthSummaryCss() because it cannot measure leftover
  // space without spilling a fourth page.
  readFileSync(resolve(process.cwd(), 'api', 'astrology', 'pdf_mpdf_invoice.php'), 'utf8').includes('invoiceFillCss(') &&
  readFileSync(resolve(process.cwd(), 'api', 'astrology', 'pdf_mpdf_reports.php'), 'utf8').includes('birthSummaryCss(') &&
  readFileSync(resolve(process.cwd(), 'api', 'astrology', 'pdf_mpdf_reports.php'), 'utf8').includes('id="birth-summary-sheet"')
);
assert('Backend jsPDF fallback measures its slack before painting',
  /measureAutoTableHeight/.test(readFileSync(resolve(process.cwd(), 'server', 'astrology', 'pdfGenerator.ts'), 'utf8'))
);
// Tax invoices are English-only: a Hindi (or Tamil) order still prints an
// English document, and the ordered report language is written in English.
assert('Invoice HTML stays in English even for Hindi orders',
  invoiceHtml.includes('OFFICIAL TAX INVOICE') &&
  invoiceHtml.includes('<td class="center">Hindi</td>') &&
  !/[\u0B80-\u0BFF\u0900-\u097F]/.test(invoiceHtml.replace(/&#0?39;|&amp;|&bull;|&mdash;|&nbsp;|&quot;/g, ''))
);

const muhurthamSample = {
  devoteeName: 'Muhurtham Test',
  dob: '1990-01-01',
  tob: '08:00',
  birthPlace: 'Suva',
  country: 'Fiji',
  eventKey: 'wedding',
  eventTitleEn: 'Wedding (Vivaha Muhurtham)',
  months: [{
    monthKey: '2026-11',
    month: 11,
    year: 2026,
    monthNameEn: 'November 2026',
    monthNameTa: 'நவம்பர் 2026',
    monthNameHi: 'नवंबर 2026',
    days: [
      { date: '2026-11-05', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Dwitiya', nakshatraNameEn: 'Rohini', grade: 'BEST', nallaNeram: [{ start: '09:00 AM', end: '10:00 AM' }] },
      { date: '2026-11-12', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Navami', nakshatraNameEn: 'Hasta', grade: 'GOOD', nallaNeram: [{ start: '10:00 AM', end: '11:00 AM' }] },
      { date: '2026-11-18', dayOfWeekNameEn: 'Wednesday', tithiNameEn: 'Krishna Chaturthi', nakshatraNameEn: 'Moola', grade: 'FAIR' },
      { date: '2026-11-24', dayOfWeekNameEn: 'Tuesday', tithiNameEn: 'Krishna Dashami', nakshatraNameEn: 'Swati', grade: 'AVOID', doshasEn: ['Tuesday is traditionally avoided for this event.'], doshasTa: ['செவ்வாய்க்கிழமை இந்த நிகழ்விற்கு தவிர்க்கப்படுகிறது.'], doshasHi: ['मंगलवार इस संस्कार के लिए टाला जाता है।'] }
    ],
    bestCount: 1,
    goodCount: 1,
    fairCount: 1,
    avoidCount: 1
  }]
};
const muhurthamHtml = buildMuhurthamHtml(muhurthamSample, 'en');
const jathagamLogoHtml = buildJathagamHtml(suvaHoro, 'en');
const jathagamWithoutRecordedPlace = buildJathagamHtml({ ...suvaHoro, birthPlace: '', country: '' }, 'en');
assert('Birth Jathagam never invents Chennai, India when an old result has no recorded birthplace',
  jathagamWithoutRecordedPlace.includes('Not provided') && !jathagamWithoutRecordedPlace.includes('Chennai, India'));
const familyInvoiceLogoHtml = buildFamilyInvoiceHtml([{
  id: 'logo-test',
  orderNumber: 'LOGO-TEST',
  createdAt: new Date().toISOString(),
  serviceType: 'BIRTH_JATHAGAM',
  amount: 0,
  currency: 'FJD',
  language: 'en',
  userName: 'Logo Test',
  userEmail: 'logo@example.com'
} as any], 'LOGO-TEST');
const sharedHeaderLogoRules = [jathagamLogoHtml, matchHtml, muhurthamHtml, invoiceHtml, familyInvoiceLogoHtml]
  .map(html => /header \.header-logo \{[^}]*\}/.exec(html)?.[0] || '');
assert('Browser report and invoice emblems are centered above the brand with no added outline',
  sharedHeaderLogoRules.every(rule => rule !== '' && !/border(-top|-right|-bottom|-left)?\s*:/.test(rule) &&
    /margin: 0;/.test(rule)) &&
  [jathagamLogoHtml, matchHtml, muhurthamHtml, invoiceHtml, familyInvoiceLogoHtml]
    .every(html => html.includes('flex-direction: column') && html.includes('modern-divider')) &&
  babyHtml.includes('.header {\n    display: flex;\n    flex-direction: column;') &&
  babyHtml.includes('.header .header-logo {\n    width: 72px;') &&
  !babyHtml.includes('margin: 0 0 0 8mm')
);
assert('Browser single-order and family invoices retain their type and number in centered header metadata',
  invoiceHtml.includes('TAX INVOICE') && invoiceHtml.includes('INV-') &&
  familyInvoiceLogoHtml.includes('FAMILY TAX INVOICE') && familyInvoiceLogoHtml.includes('INV-FAM-') &&
  !invoiceHtml.includes('border: 1.5px solid #dc2626') && !familyInvoiceLogoHtml.includes('border: 1.5px solid #dc2626'));
const pdfGeneratorLogoSource = readFileSync(resolve(process.cwd(), 'server/astrology/pdfGenerator.ts'), 'utf8');
const plainLogoHelper = pdfGeneratorLogoSource.split('function addLogo(doc: jsPDF')[1]?.split('interface CenteredBrandHeaderOptions')[0] || '';
const centeredPdfHeader = pdfGeneratorLogoSource.split('function drawCenteredBrandHeader')[1]?.split('function drawPillarFluting')[0] || '';
assert('Server PDF headers use one centered logo above the text lockup without drawing an outline',
  plainLogoHelper.includes('doc.addImage') && !plainLogoHelper.includes('doc.circle') &&
  centeredPdfHeader.includes('pageWidth / 2 - logoSize / 2') &&
  centeredPdfHeader.includes('doc.rect(margin + index * segmentWidth') &&
  !pdfGeneratorLogoSource.includes('function addInvoiceLogo'));
assert('Server invoice headers retain invoice type, number and family reference without the former red outline',
  pdfGeneratorLogoSource.includes('title: \'ASTRO SIVAM - OFFICIAL TAX INVOICE\'') &&
  pdfGeneratorLogoSource.includes('meta: `TAX INVOICE • ${invNo} • Business Reg. ASV-FJ-2026`') &&
  pdfGeneratorLogoSource.includes('FAMILY BUNDLE • TAX INVOICE • INV-${groupId}') &&
  !pdfGeneratorLogoSource.includes('doc.setDrawColor(220, 38, 38)'));
const phpReportLogoSource = readFileSync(resolve(process.cwd(), 'api/astrology/pdf_mpdf_reports.php'), 'utf8');
const phpInvoiceLogoSource = readFileSync(resolve(process.cwd(), 'api/astrology/pdf_mpdf_invoice.php'), 'utf8');
assert('PHP report headers center the logo above localized subtitles, page tags and order references',
  phpReportLogoSource.includes('.header-lockup { width: 100%; text-align: center;') &&
  phpReportLogoSource.includes('margin: 0 auto 1mm;') &&
  phpReportLogoSource.includes('<div class="header-reference">') &&
  phpReportLogoSource.includes('class="header-page-tag"') &&
  !phpReportLogoSource.includes('margin-left: 8mm'));
assert('PHP invoice headers center the logo, retain invoice identifiers and remove the red border',
  phpInvoiceLogoSource.includes('.invoice-brand-lockup { width: 100%; text-align: center;') &&
  phpInvoiceLogoSource.includes('margin: 0 auto 1mm;') &&
  phpInvoiceLogoSource.includes('INV-{$orderNumber}') &&
  phpInvoiceLogoSource.includes('INV-{$groupIdSafe}') &&
  !phpInvoiceLogoSource.includes('border: 1.5px solid #dc2626') &&
  !phpInvoiceLogoSource.includes('margin-left: 8mm'));
assert('PHP muhurtham page-2 explanation uses the same enlarged type as the browser report',
  /muhurtham-selection-notes \{[^}]*font-size: 14\.4px/.test(phpReportLogoSource) &&
  /muhurtham-selection-notes h2 \{[^}]*font-size: 16\.5px/.test(phpReportLogoSource) &&
  /muhurtham-selection-notes \{[^}]*font-size: 14\.4px/.test(readFileSync(resolve(process.cwd(), 'src/services/muhurthamHtmlBuilder.ts'), 'utf8')) &&
  /muhurtham-selection-notes h2 \{[^}]*font-size: 16\.5px/.test(readFileSync(resolve(process.cwd(), 'src/services/muhurthamHtmlBuilder.ts'), 'utf8'))
);
assert('Neither report renderer ships the removed personally-favourable-days panel',
  !muhurthamHtml.includes('personal-days') && !muhurthamHtml.includes('personal-chip') &&
  !phpReportLogoSource.includes('personal-days') && !phpReportLogoSource.includes('personal-chip')
);
assert('PHP invoice PDFs always render the English invoice copy',
  /public static function buildHtml\(\$order\): string \{[\s\S]{0,400}?\$lang = 'en';/.test(phpInvoiceLogoSource) &&
  /public static function buildFamilyHtml\(array \$orders, string \$groupId\): string \{[\s\S]{0,300}?\$lang = 'en';/.test(phpInvoiceLogoSource)
);
assert('Muhurtham browser report is exactly two pages with a lower-half selection guide',
  (muhurthamHtml.match(/class="page(?:\s|")/g) || []).length === 2 &&
  (muhurthamHtml.match(/class="page muhurtham-dates-page(?:\s[^"]*)?"/g) || []).length === 2 &&
  muhurthamHtml.includes('PAGE 1 / 2') && muhurthamHtml.includes('PAGE 2 / 2') &&
  !muhurthamHtml.includes('methodology-page') && !muhurthamHtml.includes('system-explainer')
);
assert('Muhurtham page 1 holds the devotee details and every recommended date with its nalla neram',
  muhurthamHtml.includes('USER PARTICULARS') && muhurthamHtml.includes('six-month-table') &&
  muhurthamHtml.includes('★ BEST') && muhurthamHtml.includes('✓ GOOD') &&
  muhurthamHtml.includes('Rohini') && muhurthamHtml.includes('9:00 – 10:00 AM')
);
// The ♥ mark highlights dates that are personally favourable (good Tara Balam,
// no Chandrashtama). Page 1 carries a plain-text legend explaining how those
// heart-marked dates differ from the generally good dates.
const personalMuhurthamSample = {
  ...muhurthamSample,
  months: muhurthamSample.months.map((month) => ({
    ...month,
    days: month.days.map((day, dayIndex) => dayIndex === 0
      ? { ...day, personalChecks: [{ role: 'devotee', nakshatraNameEn: 'Rohini', taraNameEn: 'Sampath', isTaraAuspicious: true, isChandrashtama: false }] }
      : day)
  }))
} as any;
const personalMuhurthamHtml = buildMuhurthamHtml(personalMuhurthamSample, 'en');
assert('Muhurtham page 1 explains the ♥ heart mark in text when personally favourable dates exist',
  personalMuhurthamHtml.includes('<div class="personal-dates-note">Dates marked with ♥') &&
  personalMuhurthamHtml.indexOf('<div class="personal-dates-note">') < personalMuhurthamHtml.indexOf('muhurtham-continuation-page') &&
  (personalMuhurthamHtml.match(/class="page(?:\s|")/g) || []).length === 2 &&
  !muhurthamHtml.includes('<div class="personal-dates-note">')
);
for (const personalLang of ['ta', 'hi'] as const) {
  const localizedPersonal = buildMuhurthamHtml(personalMuhurthamSample, personalLang);
  assert(`The heart-mark legend is localized on page 1 (${personalLang})`,
    localizedPersonal.indexOf('<div class="personal-dates-note">') !== -1 &&
    localizedPersonal.indexOf('<div class="personal-dates-note">') < localizedPersonal.indexOf('muhurtham-continuation-page') &&
    !localizedPersonal.includes('undefined')
  );
}
assert('Muhurtham report no longer spends a page per month',
  !muhurthamHtml.includes('month-calendar-page') && !muhurthamHtml.includes('PAGE 3 /')
);
// The explanation block that occupies the lower half of page 2 is printed in
// noticeably larger type than the date tables above it.
const muhurthamGuideBodyPx = Number(
  /muhurtham-selection-notes \{[^}]*font-size: ([\d.]+)px/.exec(muhurthamHtml)?.[1] || 0
);
const muhurthamGuideHeadingPx = Number(
  /muhurtham-selection-notes h2 \{[^}]*font-size: ([\d.]+)px/.exec(muhurthamHtml)?.[1] || 0
);
const muhurthamTablePx = Number(
  /\.six-month-table \{ font-size: var\(--row-font, ([\d.]+)px\)/.exec(muhurthamHtml)?.[1] || 0
);
assert('Muhurtham page-2 explanation is set in much larger letters than the date tables',
  muhurthamGuideBodyPx >= 14 && muhurthamGuideHeadingPx >= 16 &&
  muhurthamTablePx > 0 && muhurthamGuideBodyPx > muhurthamTablePx * 1.6
);
const crowdedMonth = (monthIndex: number) => ({
  ...muhurthamSample.months[0],
  monthKey: `2027-0${monthIndex + 1}`,
  month: monthIndex + 1,
  year: 2027,
  monthNameEn: `Month ${monthIndex + 1} 2027`,
  monthNameTa: `மாதம் ${monthIndex + 1} 2027`,
  monthNameHi: `माह ${monthIndex + 1} 2027`,
  days: Array.from({ length: 10 }, (_, dayIndex) => ({
    date: `2027-0${monthIndex + 1}-${String(dayIndex * 2 + 1).padStart(2, '0')}`,
    dayOfWeekNameEn: 'Thursday',
    tithiNameEn: 'Shukla Dwitiya',
    nakshatraNameEn: dayIndex % 2 ? 'Hasta' : 'Rohini',
    grade: dayIndex === 0 ? 'BEST' : 'GOOD',
    nallaNeram: [{ start: '09:00 AM', end: '10:00 AM' }, { start: '02:30 PM', end: '04:00 PM' }]
  }))
});
const crowdedMuhurthamHtml = buildMuhurthamHtml({ ...muhurthamSample, months: Array.from({ length: 6 }, (_, index) => crowdedMonth(index)) }, 'en');
assert('A crowded six-month scan spills onto the upper half of page 2 without dropping a single date',
  (crowdedMuhurthamHtml.match(/class="page(?:\s|")/g) || []).length === 2 &&
  crowdedMuhurthamHtml.includes('Continued from page 1') &&
  (crowdedMuhurthamHtml.match(/class="date-row row-(?:best|good)"/g) || []).length === 60
);
// Same crowded scan, but every date now carries the per-date Chandrashtama /
// Tara Bala line and the report carries both charts: the taller rows must still
// fit the same two pages, with no row dropped.
const crowdedWithNotesMonth = (monthIndex: number) => ({
  ...crowdedMonth(monthIndex),
  days: crowdedMonth(monthIndex).days.map((day: any) => ({
    ...day,
    personalChecks: [
      { role: 'groom', isTaraAuspicious: true, isChandrashtama: false, isJanmaNakshatra: false },
      { role: 'bride', isTaraAuspicious: true, isChandrashtama: false, isJanmaNakshatra: false }
    ],
    personalNoteEn: 'No Chandrashtama · good Tara Bala'
  }))
});
const crowdedWithNotesHtml = buildMuhurthamHtml(
  {
    ...muhurthamSample,
    persons: [
      { role: 'groom', name: 'Karthik Raman', nakshatraIndex: 14, nakshatraNameEn: 'Swati', rasiNumber: 7, rasiNameEn: 'Thulam (Libra)', lagnaNameEn: 'Thulam (Libra)' },
      { role: 'bride', name: 'Priya Devi', nakshatraIndex: 22, nakshatraNameEn: 'Dhanishta', rasiNumber: 10, rasiNameEn: 'Magaram (Capricorn)', lagnaNameEn: 'Mithunam (Gemini)' }
    ],
    months: Array.from({ length: 6 }, (_, index) => crowdedWithNotesMonth(index))
  },
  'en'
);
assert('Two-person, note-bearing crowded scans still fit exactly two pages with every date listed',
  (crowdedWithNotesHtml.match(/class="page(?:\s|")/g) || []).length === 2 &&
  (crowdedWithNotesHtml.match(/class="date-row row-(?:best|good)/g) || []).length === 60 &&
  (crowdedWithNotesHtml.match(/class="personal-note"/g) || []).length === 60 &&
  (crowdedWithNotesHtml.match(/class="person-card"/g) || []).length === 2 &&
  (crowdedWithNotesHtml.match(/class="muhurtham-attestation"/g) || []).length === 1
);
const sixMonthSample = {
  ...muhurthamSample,
  selectedMonth: '2026-11',
  months: Array.from({ length: 6 }, (_, index) => {
    const date = new Date(2026, 8 + index, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthNameEn = `${date.toLocaleString('en', { month: 'long' })} ${date.getFullYear()}`;
    return {
      ...muhurthamSample.months[0],
      monthKey,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      monthNameEn,
      monthNameTa: monthNameEn,
      monthNameHi: monthNameEn,
      days: index === 2 ? muhurthamSample.months[0].days : []
    };
  })
};
const sixMonthMuhurthamHtml = buildMuhurthamHtml(sixMonthSample, 'en');
assert('Six-month browser Muhurtham report keeps all six months and its selection guide inside two pages',
  (sixMonthMuhurthamHtml.match(/class="page(?:\s|")/g) || []).length === 2 &&
  sixMonthMuhurthamHtml.includes('PAGE 2 / 2') &&
  !sixMonthMuhurthamHtml.includes('system-explainer') &&
  !sixMonthMuhurthamHtml.includes('methodology-page') &&
  sixMonthMuhurthamHtml.includes('<aside class="muhurtham-selection-notes">')
);
assert('Muhurtham months without a recommended date are still listed instead of vanishing',
  sixMonthMuhurthamHtml.includes('month-empty-line') && sixMonthMuhurthamHtml.includes('September 2026')
);
// Keep the dates-only calendar, but explain its restrictions in normal flow
// on page 2, rather than restoring the old overlapping methodology panel.
assert('Muhurtham has one compact selection guide on page 2, not a separate methodology page',
  !muhurthamHtml.includes('system-explainer') &&
  !muhurthamHtml.includes('methodology-page') &&
  (muhurthamHtml.match(/<aside class="muhurtham-selection-notes">/g) || []).length === 1 &&
  muhurthamHtml.indexOf('<aside class="muhurtham-selection-notes">') > muhurthamHtml.lastIndexOf('<div class="page muhurtham-dates-page muhurtham-continuation-page">')
);
assert('Muhurtham explains the wedding weekday restrictions while keeping certification',
  muhurthamHtml.includes('Certified by') &&
  muhurthamHtml.includes('Tuesday (Mars), Saturday (Saturn)') &&
  muhurthamHtml.includes('family traditions may differ') &&
  muhurthamHtml.includes('muhurtham-page2-upper') &&
  muhurthamHtml.includes('min-height: calc(114mm - 7mm - 1.8mm)')
);
assert('Clean report does not include old grade summary counts section',
  !muhurthamHtml.includes('methodology-count') &&
  muhurthamHtml.includes('six-month-table')
);
assert('Clean report has no AVOID reasons section - dates only',
  !muhurthamHtml.includes('MOST COMMON REASONS FOR AVOID DATES') &&
  muhurthamHtml.includes('RECOMMENDED MUHURTHAM DATES')
);
const businessMuhurthamHtml = buildMuhurthamHtml({ ...muhurthamSample, eventKey: 'business_start' }, 'en');
assert('Business Muhurtham explains only its own weekday exclusions (Saturday is not automatically excluded)',
  !businessMuhurthamHtml.includes('system-explainer') &&
  businessMuhurthamHtml.includes('exclude Tuesday (Mars).') &&
  !businessMuhurthamHtml.includes('Saturday (Saturn)') &&
  businessMuhurthamHtml.includes('<aside class="muhurtham-selection-notes">')
);
const muhurthamTa = buildMuhurthamHtml(muhurthamSample, 'ta');
assert('Tamil Muhurtham dates and guide stay localized on two pages',
  muhurthamTa.includes('பரிந்துரைக்கப்பட்ட தேதிகள்') && muhurthamTa.includes('பக்கம் 2 / 2') &&
  !muhurthamTa.includes('system-explainer')
);
const muhurthamHi = buildMuhurthamHtml(muhurthamSample, 'hi');
assert('Hindi Muhurtham dates and guide stay localized on two pages',
  muhurthamHi.includes('अनुशंसित तिथियाँ') && muhurthamHi.includes('पृष्ठ 2 / 2') &&
  !muhurthamHi.includes('system-explainer')
);
const phpMuhurthamSource = readFileSync(resolve(process.cwd(), 'api/astrology/pdf_mpdf_reports.php'), 'utf8');
assert('Official mPDF Muhurtham report reserves space for the same selection guide before splitting its two pages',
  phpMuhurthamSource.includes('$cover . $secondPage') &&
  phpMuhurthamSource.includes('six-month-cal') &&
  phpMuhurthamSource.includes('$page1BudgetMm = 160;') &&
  phpMuhurthamSource.includes('$page2BudgetMm = 78;') &&
  phpMuhurthamSource.includes("muhurthamNallaCompactLabel") &&
  phpMuhurthamSource.includes('MuhurthamReportNotes::build($result, $event, $lang)') &&
  phpMuhurthamSource.includes('. $selectionGuide') &&
  phpMuhurthamSource.includes('height:100mm;padding:0;vertical-align:top;') &&
  !phpMuhurthamSource.includes('$monthPages')
);
const phpEngineSource = readFileSync(resolve(process.cwd(), 'api/astrology/engine.php'), 'utf8');
assert('Legacy PHP plain-PDF writer is removed and PHP exports fail closed without mPDF',
  !existsSync(resolve(process.cwd(), 'api/astrology/pdf_reports.php')) &&
  !existsSync(resolve(process.cwd(), 'api/astrology/pdf_builder.php')) &&
  !phpEngineSource.includes("'/pdf_reports.php'") &&
  !phpEngineSource.includes('AstroPdfReports::') &&
  !phpEngineSource.includes('buildPdfFromLines') &&
  !phpEngineSource.includes('pdfEscape') &&
  phpEngineSource.includes('no lower-quality fallback is enabled') &&
  phpEngineSource.includes('no fallback PDF was produced')
);

// ── Report selection explanations (read-only, ceremony-specific) ────────────
const weddingNotes = buildMuhurthamReportNotes(muhurthamSample, 'en');
assert('The guide reports actual assessed / recommended / omitted counts, not a generic calendar total',
  weddingNotes.summaryText === '4 days assessed: 2 recommended (1 BEST + 1 GOOD); 1 FAIR and 1 AVOID not listed.'
);
assert('Wedding notes explain both the weekday convention and seasonal / planetary restrictions',
  weddingNotes.weekdayText.includes('Tuesday (Mars), Saturday (Saturn)') &&
  weddingNotes.weekdayText.includes('ceremony-specific') &&
  weddingNotes.selectionText.includes('Aadi, Purattasi, Margazhi') &&
  weddingNotes.selectionText.includes('Jupiter/Venus combustion') &&
  weddingNotes.selectionText.includes('Chandrashtama')
);
assert('The explanation does not claim Tara Balam is a mandatory additional date filter',
  !weddingNotes.selectionText.includes('Tara Balam')
);
const businessNotes = buildMuhurthamReportNotes({ ...muhurthamSample, eventKey: 'business_start' }, 'en');
assert('Business explanations are driven by business rules, not copied from wedding restrictions',
  businessNotes.weekdayText.includes('Tuesday (Mars)') &&
  !businessNotes.weekdayText.includes('Saturday') &&
  !businessNotes.selectionText.includes('Jupiter/Venus combustion') &&
  !businessNotes.selectionText.includes('Aadi, Purattasi, Margazhi')
);
const legacyNotes = buildMuhurthamReportNotes({ ...muhurthamSample, months: undefined, chosenMonth: muhurthamSample.months[0] }, 'en');
assert('Legacy month payloads get the same accurate selection summary', legacyNotes.summaryText === weddingNotes.summaryText);
assert('The selection guide is localized in Tamil and Hindi as well as the date table',
  muhurthamTa.includes('செவ்வாய்க்கிழமை (செவ்வாய் கிரகம்), சனிக்கிழமை (சனி கிரகம்)') &&
  muhurthamTa.includes('ஏன் குறைவான தேதிகள்') &&
  muhurthamHi.includes('मंगलवार (मंगल), शनिवार (शनि)') &&
  muhurthamHi.includes('बहुत कम तिथियाँ')
);
assert('PHP and TypeScript use one shared selection-guide translation file',
  readFileSync(resolve(process.cwd(), 'api/astrology/muhurtham_report_notes.php'), 'utf8').includes("'/muhurtham_report_notes.json'") &&
  readFileSync(resolve(process.cwd(), 'src/services/muhurthamReportNotes.ts'), 'utf8').includes('api/astrology/muhurtham_report_notes.json')
);
assert('Deployment packages include the ceremony rule catalogue needed by PHP explanations',
  readFileSync(resolve(process.cwd(), 'scripts/create_dist_zip.py'), 'utf8').includes("rules_path = 'src/lib/muhurtham/rules.json'") &&
  readFileSync(resolve(process.cwd(), '.cpanel.yml'), 'utf8').includes('src/lib/muhurtham/rules.json')
);

// ── Nalla Neram column fit (muhurtham report text overlap regression) ────────
// A day can carry three Nalla Neram windows on one line; that label used to be
// wider than its cell and printed over the grade pill. The line now steps down to
// fit its column (never below 80%), and every renderer shares the geometry.
const muhurthamWithNallaNeram = (nallaNeram: any[]) => ({
  ...muhurthamSample,
  months: [{
    ...muhurthamSample.months[0],
    days: [{ ...muhurthamSample.months[0].days[0], nallaNeram }]
  }]
});
const threeWindowMuhurthamHtml = buildMuhurthamHtml(muhurthamWithNallaNeram([
  { start: '10:15 AM', end: '11:52 AM' },
  { start: '10:20 AM', end: '1:37 PM' },
  { start: '10:25 AM', end: '1:44 PM' }
]), 'en');
assert('A three-window Nalla Neram line is scaled to its column instead of printing over the grade cell',
  /<span class="time-text" style="font-size: calc\(var\(--row-font, 7\.8px\) \* 0\.[89]\d+\)">10:15 – 11:52 AM · 10:20 AM – 1:37 PM · 10:25 AM – 1:44 PM<\/span>/.test(threeWindowMuhurthamHtml)
);
const twoWindowMuhurthamHtml = buildMuhurthamHtml(muhurthamWithNallaNeram([
  { start: '10:15 AM', end: '11:52 AM' },
  { start: '10:20 AM', end: '1:37 PM' }
]), 'en');
assert('Shorter Nalla Neram lines keep the full row font',
  twoWindowMuhurthamHtml.includes('<span class="time-text">10:15 – 11:52 AM · 10:20 AM – 1:37 PM</span>')
);
assert('Nalla Neram time text owns its clipping so it can never paint over the grade column',
  muhurthamHtml.includes('.six-month-table .time-block { border: none; background: transparent; box-shadow: none; padding: 0; gap: 1mm; min-width: 0; max-width: 100%; }') &&
  muhurthamHtml.includes('.six-month-table .time-text { font-size: var(--row-font, 7.8px); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }') &&
  muhurthamHtml.includes('.six-month-table thead th:nth-child(3) { width: 46%; }')
);
assert('Muhurtham time-fit scale is shared, floors at 80% and leaves fitting lines untouched',
  MUHURTHAM_DATE_COLUMN_RATIOS.join(',') === '0.19,0.21,0.46,0.14' &&
  MUHURTHAM_TIME_TEXT_WIDTH_MM > 75 && MUHURTHAM_TIME_TEXT_WIDTH_MM < 85 &&
  muhurthamTimeFontScale(49, 9.4 * 0.2646) === 1 &&
  muhurthamTimeFontScale(61, 9.4 * 0.2646) < 1 && muhurthamTimeFontScale(61, 9.4 * 0.2646) > 0.8 &&
  muhurthamTimeFontScale(400, 9.4 * 0.2646) === 0.8 &&
  muhurthamTimeFontScale(0, 9.4 * 0.2646) === 1
);
assert('Node jsPDF and mPDF renderers mirror the shared time-fit geometry',
  readFileSync(resolve(process.cwd(), 'server/astrology/pdfGenerator.ts'), 'utf8').includes('MUHURTHAM_DATE_COLUMN_RATIOS') &&
  readFileSync(resolve(process.cwd(), 'server/astrology/pdfGenerator.ts'), 'utf8').includes('muhurthamTimeFontScale') &&
  phpMuhurthamSource.includes('muhurthamTimeFontScale') &&
  phpMuhurthamSource.includes('width:46%')
);

const muhurthamPageSource = readFileSync(resolve(process.cwd(), 'src/pages/MuhurthamPage.tsx'), 'utf8');
const dateTimeFieldsSource = readFileSync(resolve(process.cwd(), 'src/components/common/BirthDateTimeFields.tsx'), 'utf8');
assert('Muhurtham form selects a month, English event names, a shared place picker, and report language',
  // iOS Safari has no <input type="month"> at all (it degrades to a bare text
  // box that demands an exact YYYY-MM string), so the report month is chosen
  // with two <select> elements that work in every mobile browser.
  muhurthamPageSource.includes('<MonthField') &&
  !muhurthamPageSource.includes('type="month"') &&
  dateTimeFieldsSource.includes('export const MonthField') &&
  muhurthamPageSource.includes('EVENTS[key].titleEn') && muhurthamPageSource.includes('<GooglePlacesPicker') && muhurthamPageSource.includes("useState<AppLanguage>('en')") && muhurthamPageSource.includes('setSelectedLanguage(code)')
);
assert('Muhurtham form keeps birth-chart location separate from local calendar location',
  muhurthamPageSource.includes('const [muhurthamPlace, setMuhurthamPlace]') &&
  muhurthamPageSource.includes('describePersonForMuhurtham') &&
  // The wedding / engagement form collects the bride's own birth place (second
  // chart), while every other ceremony stays single-person.
  muhurthamPageSource.includes('const [partnerBirthPlace, setPartnerBirthPlace]') &&
  muhurthamPageSource.includes("describePersonForMuhurtham('bride'") &&
  muhurthamPageSource.includes("const checksBothCharts = selectedEvent === 'wedding' || selectedEvent === 'engagement';") &&
  muhurthamPageSource.includes('placeName: muhurthamPlace!.placeName') &&
  muhurthamPageSource.includes('muhurthamTimezoneOffsetHours') &&
  muhurthamPageSource.includes('where the function will happen')
);
assert('Muhurtham date of birth and birth time inputs open mobile numeric keyboard on tap',
  muhurthamPageSource.includes('id="muhurtham-dob"') &&
  muhurthamPageSource.includes('id="muhurtham-tob"') &&
  muhurthamPageSource.includes('parseFlexibleDob') &&
  muhurthamPageSource.includes('parseFlexibleTob') &&
  dateTimeFieldsSource.includes('inputMode="numeric"') &&
  dateTimeFieldsSource.includes('touch-manipulation')
);

// Field report: "remove the live preview to the users in muhurtham page" —
// the personalised "Preview With My Details" live preview is gone. Visitors now
// get exactly what every other service page offers: the fixed SAMPLE report
// only. The live preview remains an admin tool (admin_testing /
// order_inspection) whose preview-exact PDF is what reaches the customer email.
assert('Muhurtham page shows visitors only the fixed sample report (no personal live preview)',
  !muhurthamPageSource.includes('LivePdfPreviewModal') &&
  !muhurthamPageSource.includes('Preview With My Details') &&
  !muhurthamPageSource.includes('handlePreview') &&
  muhurthamPageSource.includes('SampleReportButton') &&
  muhurthamPageSource.includes('serviceType="MUHURTHAM"'));
assert('Every service page offers the same fixed sample report and no personal live preview',
  ['BirthJathagamPage.tsx', 'BabyNamingPage.tsx', 'MarriageCompatibilityPage.tsx', 'MuhurthamPage.tsx']
    .every(f => {
      const src = readFileSync(resolve(process.cwd(), 'src/pages', f), 'utf8');
      return src.includes('SampleReportButton') && !src.includes('Preview With My Details');
    }));
// Field report: "in muhurtham form the sample report coming inside the form —
// can you transfer that after the form like all other services." The sample
// block is now rendered AFTER the closed </form>, outside the form card, exactly
// like Birth Jathagam / Marriage Compatibility / Baby Naming.
assert('Muhurtham sample report is rendered after the form, not inside it',
  muhurthamPageSource.indexOf('</form>') > -1 &&
  muhurthamPageSource.indexOf('<SampleReportButton') > muhurthamPageSource.indexOf('</form>') &&
  // ...and it is still part of the page body, i.e. before the sign-in / checkout modals.
  muhurthamPageSource.indexOf('<SampleReportButton') < muhurthamPageSource.indexOf('<AuthModal'));
assert('No service page puts the sample report button inside its order form',
  ['BirthJathagamPage.tsx', 'BabyNamingPage.tsx', 'MarriageCompatibilityPage.tsx', 'MuhurthamPage.tsx']
    .every(f => {
      const src = readFileSync(resolve(process.cwd(), 'src/pages', f), 'utf8');
      return src.indexOf('<SampleReportButton') > src.indexOf('</form>');
    }));
// Field report: "subha muhurtham page looks smaller compared to other service pages
// in desktop." A leftover `max-w-3xl` on the Muhurtham page frame capped the shared
// 1180px `.service-page` layout at 768px (and an opaque full-page wrapper hid the
// shared cosmic background). Every service page must use the bare shared frame with
// no width-capping utility on it, and must not nest a second <main> inside the app
// shell's <main> (App.tsx already wraps every page).
assert('Every service page uses the same uncapped .service-page frame (Muhurtham is no narrower on desktop)',
  ['BirthJathagamPage.tsx', 'BabyNamingPage.tsx', 'MarriageCompatibilityPage.tsx', 'MuhurthamPage.tsx']
    .every(f => {
      const src = readFileSync(resolve(process.cwd(), 'src/pages', f), 'utf8');
      return src.includes('<div className="service-page">') && !/<main\b/.test(src);
    }));

// Every service form collects birth details through the same mobile-proof
// fields: a native <input type="date"> / <input type="time"> cannot be typed
// into on several mobile browsers, which is why visitors could not enter a
// date of birth on a phone.
const birthFormPages = [
  'src/pages/BirthJathagamPage.tsx',
  'src/pages/BabyNamingPage.tsx',
  'src/pages/MarriageCompatibilityPage.tsx',
  'src/pages/MuhurthamPage.tsx',
  'src/pages/CustomerDashboard.tsx'
];
assert('All service forms use the shared mobile-proof birth date & time fields',
  birthFormPages.every(file =>
    readFileSync(resolve(process.cwd(), file), 'utf8').includes('BirthDateTimeFields')
  ) &&
  birthFormPages.every(file =>
    !/type="(date|time)"/.test(readFileSync(resolve(process.cwd(), file), 'utf8'))
  )
);
assert('Birth fields offer typing, an in-app calendar/clock sheet and quick-select dropdowns',
  dateTimeFieldsSource.includes('export const BirthDateField') &&
  dateTimeFieldsSource.includes('export const BirthTimeField') &&
  dateTimeFieldsSource.includes('createPortal') &&
  dateTimeFieldsSource.includes('CalendarSheet') &&
  dateTimeFieldsSource.includes('ClockSheet') &&
  dateTimeFieldsSource.includes('Quick select')
);

// Typed-entry behaviour on a mobile numeric keyboard.
assert('Typing 15081990 formats to 15/08/1990 and parses to ISO',
  formatDobInputWhileTyping('15081990') === '15/08/1990' &&
  parseFlexibleDob(formatDobInputWhileTyping('15081990')) === '1990-08-15'
);
assert('A single-digit day/month advances immediately (581990 -> 5/8/1990)',
  formatDobInputWhileTyping('581990') === '5/8/1990' &&
  parseFlexibleDob('5/8/1990') === '1990-08-05'
);
assert('Typed separators are respected and year-first entry still works',
  formatDobInputWhileTyping('5/8/1990') === '5/8/1990' &&
  parseFlexibleDob('1990-08-15') === '1990-08-15' &&
  parseFlexibleDob('19900815') === '1990-08-15'
);
assert('Impossible dates are rejected instead of silently shifted',
  parseFlexibleDob('31/02/1990') === '' &&
  parseFlexibleDob('15/13/1990') === '' &&
  describeDobProblem('31/02/1990') !== ''
);
assert('Typing 0930 formats to 09:30 and resolves with the AM/PM toggle',
  formatTobInputWhileTyping('0930') === '09:30' &&
  parseFlexibleTob(formatTobInputWhileTyping('0930'), 'AM')?.tob24 === '09:30' &&
  parseFlexibleTob(formatTobInputWhileTyping('0930'), 'PM')?.tob24 === '21:30' &&
  formatTobInputWhileTyping('930') === '9:30'
);
assert('A 24-hour entry is accepted and normalised to 12-hour + PM',
  parseFlexibleTob('22:30', 'AM')?.tob24 === '22:30' &&
  parseFlexibleTob('22:30', 'AM')?.display12 === '10:30' &&
  describeTobProblem('09:75') !== ''
);
assert('Muhurtham selected-month window scans two prior months plus selected and next three',
  muhurthamPageSource.includes('Array.from({ length: 6 }') && muhurthamPageSource.includes('index - 2') && muhurthamPageSource.includes('selectedMonth')
);
const nodeAdminSource = readFileSync(resolve(process.cwd(), 'server/routes/admin.ts'), 'utf8');
const orderReportResultSource = readFileSync(resolve(process.cwd(), 'server/astrology/orderReportResult.ts'), 'utf8');
const muhurthamCalculationSource = readFileSync(resolve(process.cwd(), 'server/astrology/muhurthamScan.ts'), 'utf8');
assert('Node Muhurtham approval rebuilds the result from saved inputs and only emails the browser preview PDF',
  nodeAdminSource.includes('computeOrderReportResult(order)') &&
  orderReportResultSource.includes("if (order.serviceType === 'MUHURTHAM')") &&
  orderReportResultSource.includes('computeMuhurthamResultFromPayload({ inputPayload: p, userName: order.userName })') &&
  nodeAdminSource.includes('No server-rendered substitute is allowed for customer email') &&
  nodeAdminSource.includes('Attach the exact browser-rendered documents shown in the admin preview'));
assert('Node Muhurtham calculation keeps birth coordinates for Janma star and event coordinates for local dates/times',
  muhurthamCalculationSource.includes('const birthLatitude = Number(p.latitude)') &&
  muhurthamCalculationSource.includes('const muhurthamLocation = requireMuhurthamLocation(p)') &&
  muhurthamCalculationSource.includes('birthTimezoneOffsetHours, birthLatitude, birthLongitude') &&
  muhurthamCalculationSource.includes('latitude: muhurthamLocation.latitude')
);
const servicesRouteSource = readFileSync(resolve(process.cwd(), 'server/routes/services.ts'), 'utf8');
const customerResendStart = servicesRouteSource.indexOf("servicesRouter.post('/orders/:id/request-resend-email'");
const customerResendSource = customerResendStart >= 0 ? servicesRouteSource.slice(customerResendStart) : '';
assert('Customer report resends require a complete browser-rendered PDF set and never use server PDF fallbacks',
  customerResendSource.includes('resolveCustomerResendDocs') &&
  customerResendSource.includes('if (missing.length > 0 || !docs.invoice)') &&
  customerResendSource.includes('if (!report || !docs.invoice)') &&
  customerResendSource.includes("renderQuality: 'PREVIEW_EXACT'") &&
  !customerResendSource.includes('generateHoroscopePdf') &&
  !customerResendSource.includes('generateInvoicePdf') &&
  !customerResendSource.includes('generateFamilyInvoicePdf'));
assert('Customer resend staging endpoints authorize the order owner and permit complete family staging',
  servicesRouteSource.includes("servicesRouter.post('/orders/:id/stage-doc', requireAuth") &&
  servicesRouteSource.includes("servicesRouter.post('/family-orders/:groupId/stage-doc', requireAuth") &&
  servicesRouteSource.includes('customerCanAccessGroup(user, groupOrders)') &&
  servicesRouteSource.includes('body.orderId = member.id'));
const customerDashboardSource = readFileSync(resolve(process.cwd(), 'src/pages/CustomerDashboard.tsx'), 'utf8');
assert('Customer resend renders preview-exact PDFs in the browser and stages family bundles',
  customerDashboardSource.includes('generateOrderPdfsBase64(resendOrder, language)') &&
  customerDashboardSource.includes('prepareFamilyFulfilPayload') &&
  customerDashboardSource.includes("{ stagingAudience: 'customer' }") &&
  customerDashboardSource.includes('api.requestCustomerEmailResend(resendOrder.id, emailToUse, payload)'));
// The Muhurtham scan normaliser moved into one shared server module so the
// order store, the family endpoint and the admin flow all use the same rules.
const muhurthamScanSource = readFileSync(resolve(process.cwd(), 'server/astrology/muhurthamScan.ts'), 'utf8');
assert('Muhurtham scan normalization preserves Tamil and Hindi weekday names for localized reports',
  muhurthamScanSource.includes('dayOfWeekNameTa: d.dayOfWeekNameTa') && muhurthamScanSource.includes('dayOfWeekNameHi: d.dayOfWeekNameHi')
);
assert('Muhurtham scan normalisation lives in ONE shared server module',
  orderReportResultSource.includes("from './muhurthamScan.js'") &&
  !servicesRouteSource.includes('function normalizeMuhurthamScan')
);
const adminPortalSource = readFileSync(resolve(process.cwd(), 'src/pages/AdminPortal.tsx'), 'utf8');
const orderReportModalSource = readFileSync(resolve(process.cwd(), 'src/components/common/OrderReportModal.tsx'), 'utf8');
assert('Admin report previews start in the language ordered by the customer',
  adminPortalSource.includes('initialLang={previewOrderForPdf.language}') && orderReportModalSource.includes('initialLang={selectedLang}')
);
// Page 2 specifically: the browser and Node PDF paths must use the same eight
// placement-aware cards, and each requested language must carry an explicit
// overflow/disclaimer guard without changing the three-page contract.
console.log('\nTEST 9B: Birth Jathagam Page 2 Predictions & Layout Safety');
const guaranteePredictionCaveats = {
  en: 'Not a guaranteed prediction.',
  ta: 'இது உறுதி கணிப்பு அல்ல.',
  hi: 'यह निश्चित भविष्यवाणी नहीं है।'
};
for (const reportLang of ['en', 'ta', 'hi'] as const) {
  const cards = buildJathagamLifeCards(suvaHoro, reportLang);
  const jathagamHtml = buildJathagamHtml(suvaHoro, reportLang);
  const page2Start = jathagamHtml.indexOf('id="jathagam-page-2"');
  const page3Start = jathagamHtml.indexOf('id="jathagam-page-3"');
  const page2Html = page2Start >= 0 && page3Start > page2Start ? jathagamHtml.slice(page2Start, page3Start) : '';
  assert(`${reportLang}: page 2 has exactly eight shared life cards`, cards.length === 8 && (page2Html.match(/class="panel life-card-big"/g) || []).length === 8);
  assert(`${reportLang}: page 2 renders the localized disclaimer`, page2Html.includes('life-disclaimer') && page2Html.length > 1500);
  assert(`${reportLang}: page 2 omits the guaranteed-prediction caveat`, !page2Html.includes(guaranteePredictionCaveats[reportLang]));
  assert(`${reportLang}: every page-2 card has non-empty title and description`, cards.every(card => card.title.trim().length > 0 && card.desc.trim().length > 20));
}
const sparseLifeCards = buildJathagamLifeCards({ ...suvaHoro, planetPositions: [] }, 'en');
assert('Missing house-lord placement never masquerades as an own-sign placement',
  sparseLifeCards.every(card => !card.desc.includes('in its own sign') && !card.desc.includes('in its own wealth sign'))
);
const sharedBuilderSource = readFileSync(resolve(process.cwd(), 'src/services/jathagamHtmlBuilder.ts'), 'utf8');
const nodePdfSource = readFileSync(resolve(process.cwd(), 'server/astrology/pdfGenerator.ts'), 'utf8');
assert('Page 2 uses placement-aware text instead of categorical summary fallbacks',
  sharedBuilderSource.includes('Traditional Jyotisha indicator') && !nodePdfSource.includes('sum.healthEn ||'));
assert('Page 2 cards fit/wrap complete text without clipping or truncation',
  sharedBuilderSource.includes('overflow-wrap: anywhere') &&
  sharedBuilderSource.includes('fitJathagamLifeCardText.toString()') &&
  nodePdfSource.includes('descLines.length * descLineHeight <= availableHeight') &&
  !nodePdfSource.includes('maxDescLines') && !nodePdfSource.includes('descLines[last]'));
assert('Page 3 Short Summary enlarges type to fill the A4 from the 10.5px floor',
  sharedBuilderSource.includes('fitJathagamSummaryText.toString()') &&
  sharedBuilderSource.includes('--summary-scale') &&
  sharedBuilderSource.includes('flex: 1 0 auto') &&
  nodePdfSource.includes('extraCare'));
assert('Node page 2 imports the same shared card builder', nodePdfSource.includes("buildJathagamLifeCards(result, lang)"));
const phpReportSourceForPage2 = readFileSync(resolve(process.cwd(), 'api/astrology/pdf_mpdf_reports.php'), 'utf8');
assert('PHP page 2 uses localized placement cards and an overflow-safe badge',
  phpReportSourceForPage2.includes('$lifeCardsData') &&
  phpReportSourceForPage2.includes('life-disclaimer') &&
  phpReportSourceForPage2.includes('overflow-wrap: anywhere') &&
  phpReportSourceForPage2.includes('badge-caution'));
assert('PHP page 2 omits the guaranteed-prediction caveat in all languages',
  Object.values(guaranteePredictionCaveats).every(caveat => !phpReportSourceForPage2.includes(caveat)));

// 10. BACKEND PDFKIT GENERATOR
console.log('\nTEST 10: Backend PDFKit Binary Buffers');
const b1 = generateWeddingMatchPdf(match);
assert('generateWeddingMatchPdf produced valid PDF buffer', b1.length > 50000);
assert('Wedding PDF header omits the removed three-part invocation',
  !b1.toString('latin1').includes('Om Saravanabhavaya Namah')
);
const positiveWeddingPdfText = generateWeddingMatchPdf({ ...match, verdictStatus: PoruthamStatus.UTTHAMAM }).toString('latin1');
assert('Node wedding PDF ends with the green Utthamam verdict',
  positiveWeddingPdfText.includes('FINAL VERDICT') && positiveWeddingPdfText.includes('This is a good match.')
);
const moderateWeddingPdfText = generateWeddingMatchPdf({ ...match, verdictStatus: PoruthamStatus.MADHYAMAM }).toString('latin1');
assert('Node wedding PDF ends with the remedies-based Madhyamam verdict',
  moderateWeddingPdfText.includes('FINAL VERDICT') && moderateWeddingPdfText.includes('Acceptable match; suitable with remedies.')
);
const negativeWeddingPdfText = generateWeddingMatchPdf({ ...match, verdictStatus: PoruthamStatus.PORUNDHADHU }).toString('latin1');
assert('Node wedding PDF ends with the cautious red negative verdict',
  negativeWeddingPdfText.includes('FINAL VERDICT') && negativeWeddingPdfText.includes('not recommended on the current assessment')
);
const weightedMaxima = [3, 4, 3, 2, 4, 5, 4, 2, 5, 3];
const weightedPoruthams = match.poruthams.map((p, index) => {
  const maximum = weightedMaxima[index];
  const earned = p.status === PoruthamStatus.UTTHAMAM
    ? maximum
    : p.status === PoruthamStatus.MADHYAMAM ? maximum / 2 : 0;
  return { ...p, pointsEarned: earned, maxPoints: maximum };
});
const weightedTotal = weightedPoruthams.reduce((sum, p) => sum + p.pointsEarned, 0);
const weightedWeddingPdf = generateWeddingMatchPdf({
  ...match,
  totalScore: weightedTotal,
  maxScore: 35,
  poruthams: weightedPoruthams
}).toString('latin1');
assert('Node wedding PDF uses the result/row denominator rather than a hard-coded 10-point scale',
  weightedWeddingPdf.includes(`\\(${Number(weightedTotal.toFixed(1))} / 35 POINTS\\)`)
);
const unavailableWeddingPdf = generateWeddingMatchPdf({
  ...match,
  totalPoruthamsMatched: undefined as any,
  totalScore: undefined as any,
  score: undefined as any,
  maxScore: undefined as any,
  verdictStatus: undefined as any,
  overallVerdictEn: undefined as any,
  rajjuMatch: undefined as any,
  sevvayDosham: undefined as any,
  poruthams: []
} as any).toString('latin1');
assert('Node wedding PDF renders missing score, status, and Rajju data as N/A',
  unavailableWeddingPdf.includes('SCORE: N/A / 10 PORUTHAMS MATCHED \\(N/A / N/A POINTS\\)') &&
  unavailableWeddingPdf.includes('Rajju Status: N/A') &&
  unavailableWeddingPdf.includes('FINAL VERDICT') &&
  !unavailableWeddingPdf.includes('The matching is not good.')
);
// The backend engine draws the disclaimer word by word (bold runs), so assert
// on whole words and on the page count rather than on long phrases.
const weddingPdfWithDisclaimer = generateWeddingMatchPdf(match, 'en').toString('latin1');
assert('Node wedding PDF ships the page-2 Marriage Matching disclaimer',
  (weddingPdfWithDisclaimer.match(/\/Type \/Page[^s]/g) || []).length === 2 &&
  weddingPdfWithDisclaimer.includes('DISCLAIMER') &&
  weddingPdfWithDisclaimer.includes('horoscope') &&
  weddingPdfWithDisclaimer.includes('consent')
);
const b2 = generateBabyNamingPdf(baby);
assert('generateBabyNamingPdf produced valid PDF buffer', b2.length > 50000);
const babyPdfText = b2.toString('latin1');
assert('Node Baby Naming PDF keeps the certificate and name suggestions on two pages',
  (babyPdfText.match(/\/Type \/Page\b/g) || []).length === 2);
assert('Node Baby Naming PDF includes every page-2 name and meaning',
  buildNamakaranPadaNamesFromResult(baby).flatMap(c => [...c.south, ...c.north])
    .every(entry => babyPdfText.includes(entry.name) && babyPdfText.includes(entry.meaning)));
const b3 = generateInvoicePdf({
  orderNumber: 'INV-1001',
  createdAt: new Date().toISOString(),
  serviceType: 'BABY_NAMING',
  amount: 30.0,
  currency: 'FJD',
  language: 'en',
  userName: 'Test User',
  userEmail: 'user@test.com'
});
assert('generateInvoicePdf produced valid PDF buffer', b3.length > 10000);
const muhurthamPdf = generateMuhurthamPdf(muhurthamSample as any, 'en');
const muhurthamPdfText = muhurthamPdf.toString('latin1');
assert('generateMuhurthamPdf produces a two page report',
  muhurthamPdfText.startsWith('%PDF-') && /\/Count\s+2\b/.test(muhurthamPdfText)
);
const sixMonthPdf = generateMuhurthamPdf(sixMonthSample as any, 'en');
assert('generateMuhurthamPdf keeps a six-month window to two pages',
  /\/Count\s+2\b/.test(sixMonthPdf.toString('latin1'))
);
const crowdedPdf = generateMuhurthamPdf({ ...muhurthamSample, months: Array.from({ length: 6 }, (_, index) => crowdedMonth(index)) } as any, 'en');
assert('generateMuhurthamPdf never grows past two pages even when 60 dates are recommended',
  /\/Count\s+2\b/.test(crowdedPdf.toString('latin1'))
);
for (const language of ['ta', 'hi'] as const) {
  const localizedPdf = generateMuhurthamPdf(sixMonthSample as any, language);
  assert(`generateMuhurthamPdf keeps two pages in ${language === 'ta' ? 'Tamil' : 'Hindi'} mode`,
    /\/Count\s+2\b/.test(localizedPdf.toString('latin1'))
  );
  assert(`The Latin-font ${language} fallback keeps its long selection guide readable`,
    localizedPdf.toString('latin1').includes('WHY THESE DATES WERE SELECTED') &&
    localizedPdf.toString('latin1').includes('Tuesday \\(Mars\\)') &&
    localizedPdf.toString('latin1').includes('Saturday \\(Saturn\\)')
  );
}

// 11. SECURITY: SIGNED BEARER TOKENS
console.log('\nTEST 11: Bearer Token Signing & Verification');
const secToken = createSignedToken({ id: 'usr_demo', email: 'demo@astrosivam.com', role: 'customer' });
const secPayload = verifySignedToken(secToken);
assert('A freshly issued token verifies', !!secPayload);
assert('Token round-trips the user id and role', secPayload?.id === 'usr_demo' && secPayload?.role === 'customer');
assert('Token carries an expiry', !!secPayload?.exp && secPayload!.exp > Math.floor(Date.now() / 1000));

// The historic exploit: a hand-crafted, UNSIGNED base64 payload claiming admin.
const forgedUnsigned = Buffer.from(
  JSON.stringify({ id: 'usr_admin_astrosivam_com', email: 'admin@astrosivam.com', role: 'admin' })
).toString('base64');
assert('Unsigned base64 admin token is REJECTED', verifySignedToken(forgedUnsigned) === null);

// Tampering with the payload while keeping the original signature.
const [secPayloadB64, secSig] = [secToken.slice(0, secToken.lastIndexOf('.')), secToken.slice(secToken.lastIndexOf('.') + 1)];
const escalated = Buffer.from(JSON.stringify({ ...secPayload, role: 'admin' })).toString('base64url');
assert('Payload tampered to role=admin is REJECTED', verifySignedToken(`${escalated}.${secSig}`) === null);
assert('Token with a corrupted signature is REJECTED', verifySignedToken(`${secPayloadB64}.${'0'.repeat(64)}`) === null);
assert('Empty / malformed tokens are REJECTED', verifySignedToken('') === null && verifySignedToken('garbage') === null);

// 12. SECURITY: SOCIAL LOGIN CANNOT BE FORGED OFFLINE
console.log('\nTEST 12: Google / Facebook Login Verification');
const fakeJwt = [
  Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ email: 'admin@astrosivam.com', name: 'Attacker', sub: '1' })).toString('base64url'),
  'not-a-real-signature'
].join('.');
const forgedGoogle = await verifyGoogleLogin(fakeJwt, undefined);
assert('Unsigned/forged Google ID token is REJECTED', forgedGoogle === null);
const noCredGoogle = await verifyGoogleLogin(undefined, undefined);
assert('Google login without any provider token is REJECTED', noCredGoogle === null);
const noTokenFb = await verifyFacebookLogin(undefined);
assert('Facebook login without an access token is REJECTED', noTokenFb === null);

// 13. REPORT TEXT FORMATTING (no duplicated / overlapping labels)
console.log('\nTEST 13: Report Label Formatting');
assert('Country is not repeated when the place already ends with it',
  formatBirthPlace('Tiruchirappalli, Tamil Nadu, India', 'India') === 'Tiruchirappalli, Tamil Nadu, India');
assert('Country is not repeated when the place contains it as a word',
  formatBirthPlace('Suva, Fiji Islands', 'Fiji') === 'Suva, Fiji Islands');
assert('Country is appended when genuinely missing',
  formatBirthPlace('Madurai', 'India') === 'Madurai, India');
assert('Missing place falls back to the country', formatBirthPlace('', 'Fiji') === 'Fiji');
assert('Missing country returns the bare place', formatBirthPlace('Nadi', '') === 'Nadi');

// 14. PDF ROBUSTNESS WITH EXTREME INPUT
console.log('\nTEST 14: PDF Robustness (very long names & missing fields)');
const longName = 'Venkataramanasubramanian Chidambaranathaswamy Balasubramaniam';
const longHoro = calculatePrecisionHoroscope(longName, '1988-11-23', '14:45', 'Tiruchirappalli, Tamil Nadu, India', 10.79, 78.70, 5.5, 'India', 'M');
const longBuf = generateHoroscopePdf(longHoro as any, 'en');
assert('Horoscope PDF renders with an extremely long devotee name', longBuf.length > 50000);
assert('Horoscope PDF header omits the removed three-part invocation',
  !longBuf.toString('latin1').includes('Om Saravanabhavaya Namah')
);
const taBuf = generateHoroscopePdf(longHoro as any, 'ta');
assert('Horoscope PDF renders in Tamil', taBuf.length > 50000);
const hiBuf = generateHoroscopePdf(longHoro as any, 'hi');
assert('Horoscope PDF renders in Hindi', hiBuf.length > 50000);
const minimalInvoice = generateInvoicePdf({
  orderNumber: 'INV-EDGE', createdAt: new Date().toISOString(), serviceType: 'BIRTH_JATHAGAM',
  amount: 0, currency: 'FJD', language: 'en', userName: longName, userEmail: 'a@b.co'
} as any);
assert('Invoice PDF renders for a zero-amount free-beta order', minimalInvoice.length > 10000);
const longFamilyOrders = Array.from({ length: 18 }, (_, index) => ({
  groupId: 'FAM-PDF-HOOK-77',
  orderNumber: `ORD-${String(index + 1).padStart(3, '0')}`,
  createdAt: '2026-10-04T00:00:00Z',
  serviceType: 'BIRTH_JATHAGAM',
  amount: 35,
  currency: 'FJD',
  language: 'en',
  userName: 'Family Customer',
  userEmail: 'family@example.com',
  userMobile: '+679 123 4567',
  country: 'Fiji',
  inputPayload: { name: `Family Member ${index + 1} with an intentionally long display name that wraps over several lines on this consolidated invoice` }
}));
const continuedFamilyInvoice = generateFamilyInvoicePdf(longFamilyOrders);
const continuedFamilyInvoiceText = continuedFamilyInvoice.toString('latin1');
assert('Node consolidated family invoice repeats its centered invoice/group/page header on table continuations',
  /\/Count\s+[2-9]\b/.test(continuedFamilyInvoiceText) &&
  continuedFamilyInvoiceText.includes('ASTRO SIVAM - OFFICIAL TAX INVOICE') &&
  continuedFamilyInvoiceText.includes('INV-FAM-PDF-HOOK-77') &&
  continuedFamilyInvoiceText.includes('GROUP: FAM-PDF-HOOK-77') &&
  continuedFamilyInvoiceText.includes('Family Bundle Tax Invoice - Continued') &&
  continuedFamilyInvoiceText.includes('Page 2') &&
  /\/MediaBox\s+\[0\s+0\s+595\.27\d+\s+841\.88\d+\]/.test(continuedFamilyInvoiceText));


// 15. FAMILY ORDER FULFILMENT & BRANDING REGRESSION GUARDS
// These guard the two production defects where (a) a multi-chart family bundle
// was listed and approved as separate orders, producing one email per chart,
// and (b) the ASTRO SIVAM logo never rendered in emails / report PDFs /
// invoice PDFs.
console.log('\nTEST 15: Family Order Grouping & Branding Regression Guards');
const readApi = (rel: string) => readFileSync(resolve(process.cwd(), 'api', rel), 'utf8');
const emailServiceSrc = readFileSync(resolve(process.cwd(), 'server', 'services', 'emailService.ts'), 'utf8');

const adminIndexPhp = readApi('admin/index.php');
const approveOrderPhp = readApi('admin/approve_order.php');
const adminOrdersPhp = readApi('admin/orders.php');
const familyApprovalPhp = readApi('admin/family_approval.php');
const brandingPhp = readApi('branding.php');
const mailerPhp = readApi('mailer.php');
const configPhp = readApi('config.php');
const mpdfReportsPhp = readApi('astrology/pdf_mpdf_reports.php');
const mpdfInvoicePhp = readApi('astrology/pdf_mpdf_invoice.php');
const astrologyEnginePhp = readApi('astrology/engine.php');

// Hidden report/calculation defaults must not turn missing chart data into a
// plausible House 1, Aries, Pada 1, or a clean dosha result.
assert('PHP house-lord placement has no target-house/sign or default-Sun fallback',
  !astrologyEnginePhp.includes("$lordNameToGraha[$lordEnName] ?? 'sun'") &&
  !astrologyEnginePhp.includes('$bhavaByGraha[$lordGraha] ?? $houseNum') &&
  !astrologyEnginePhp.includes('$rasiIdxByGraha[$lordGraha] ?? $targetSignIdx') &&
  astrologyEnginePhp.includes("'isAvailable' => false"));
assert('PHP Kuja Dosha does not turn missing Mars data into House 1 / Aries',
  !astrologyEnginePhp.includes("$bhavaByGraha['mars'] ?? 1") &&
  !astrologyEnginePhp.includes("$rasiIdxByGraha['mars'] ?? 0") &&
  astrologyEnginePhp.includes('Required Mars, Lagna, Moon, Venus or Jupiter placement data is unavailable') &&
  astrologyEnginePhp.includes("'status' => 'NOT_ASSESSED'"));
assert('PHP baby naming rejects a missing Pada instead of defaulting to Pada 1',
  !astrologyEnginePhp.includes("$horoscope['janmaPada'] ?? 1") &&
  astrologyEnginePhp.includes('Unable to resolve the birth Pada for baby naming.'));
assert('PHP Muhurtham report normalization rejects a missing Pada instead of defaulting to 1',
  !astrologyEnginePhp.includes("$day['pada'] ?? 1") &&
  astrologyEnginePhp.includes('missing or invalid Nakshatra Pada'));
assert('PHP report renderer guards missing sign, degree, house, and baby-Pada fields',
  !mpdfReportsPhp.includes("$result['lagnaRasi'] ?? 1") &&
  !mpdfReportsPhp.includes("$p['degrees'] ?? 0") &&
  !mpdfReportsPhp.includes("$p['bhavaNumber'] ?? '1'") &&
  !mpdfReportsPhp.includes("$nakshatraLetters['pada'] ?? 1") &&
  mpdfReportsPhp.includes('function validRasiNumber') &&
  mpdfReportsPhp.includes('No pada syllables are available for this record.'));
assert('PHP life-guidance placements and unassessed Doshas stay unavailable instead of becoming clean defaults',
  !mpdfReportsPhp.includes("$bhavaByGrahaForLife[$lordGraha] ?? $houseNum") &&
  !mpdfReportsPhp.includes("$rasiByGrahaForLife[$lordGraha] ?? $targetSign") &&
  mpdfReportsPhp.includes('chart-specific guidance cannot be determined') &&
  mpdfReportsPhp.includes('Dosha assessment is incomplete (N/A)'));
assert('PHP Pitru wording matches its limited Sun-node / Saturn-9th-house triggers, not an uncalculated 9th-lord test',
  !astrologyEnginePhp.includes('The 9th house or its lord is afflicted by Rahu, Ketu or Saturn.') &&
  !astrologyEnginePhp.includes('$ninthLordHouse') &&
  astrologyEnginePhp.includes('The Sun shares a sign with Rahu or Ketu, or Saturn occupies the 9th house under this simplified rule.'));
assert('PHP Guru Chandala remains an explicitly limited sign-level assessment',
  astrologyEnginePhp.includes('under this sign-level rule; interpretations vary') &&
  astrologyEnginePhp.includes('No trigger was found under this limited sign-level rule; this does not establish the absence of other afflictions.'));

// --- (a1) the admin order list must expose the family group id -------------
assert('Admin orders endpoint returns groupId for every order',
  adminIndexPhp.includes("'groupId' => (!empty($r['group_id']) ? $r['group_id'] : null),"));
assert('Admin orders endpoint returns groupOrderIndex',
  adminIndexPhp.includes("'groupOrderIndex' =>"));

// --- (a2) approving one member must fulfil the WHOLE group in one email ----
assert('Single-order approve delegates family groups to the consolidated routine',
  /if \(!empty\(\$order\['group_id'\]\)\) \{\s*[\r\n]+\s*jsonResponse\(astroApproveFamilyGroup\(/.test(adminIndexPhp));
assert('approve_order.php delegates family groups to the consolidated routine',
  familyGroupDelegates(approveOrderPhp));
assert('orders.php delegates family groups to the consolidated routine',
  familyGroupDelegates(adminOrdersPhp));
assert('Family group routine sends every delivery part through one mailer call site',
  (familyApprovalPhp.match(/AstroMailer::sendEmailWithAttachments\(/g) || []).length === 1);
assert('Family group routine attaches the preview-rendered consolidated invoice exactly once',
  familyApprovalPhp.includes("$invoicePdf = $clientInvoicePdf;") &&
  (familyApprovalPhp.match(/\$attachments\[\] = \['name' => \$invoiceFileName, 'content' => \$invoicePdf\]/g) || []).length === 1 &&
  !/generateFamilyInvoicePdf\(/.test(familyApprovalPhp));
assert('Family group routine updates the whole group by group_id',
  familyApprovalPhp.includes('WHERE group_id = ?'));
assert('Family group routine only marks COMPLETED after every email part is accepted',
  familyApprovalPhp.includes('$deliverySucceeded = empty($failedParts) && !empty($sentParts);') &&
  familyApprovalPhp.includes("$finalStatus = $deliverySucceeded ? 'COMPLETED' : 'PROCESSING'"));
assert('Family group routine hard-caps and splits oversized attachment bundles',
  familyApprovalPhp.includes('astro_plan_attachment_parts($attachments, $pdfAttachmentBudget)') &&
  familyApprovalPhp.includes('$nonPdfReserveBytes') &&
  familyApprovalPhp.includes('(Part {$partNumber} of {$totalParts})') &&
  familyApprovalPhp.includes("astroClearStagedFamilyDocs($groupId);"));

// --- (a3) the legacy JSON emitters must exist (they used to be undefined) --
assert('config.php defines sendResponse()', /function sendResponse\(/.test(configPhp));
assert('config.php defines sendJson()', /function sendJson\(/.test(configPhp));

// --- (b1) no hard-coded remote logo left in any email template -------------
const remoteLogo = "https://astrosivam.com/astrosivam_logo.png";
const phpEmailTemplates = [adminIndexPhp, approveOrderPhp, familyApprovalPhp];
assert('No PHP email template still hot-links the remote logo',
  phpEmailTemplates.every(src => !src.includes(remoteLogo)));
assert('PHP email templates use the inline cid: logo',
  phpEmailTemplates.every(src => src.includes('astro_email_logo_tag(')));
assert('Every PHP mailer call passes the inline logo attachment',
  (adminIndexPhp.match(/astro_inline_logo_attachment\(\)/g) || []).length >= 2 &&
  approveOrderPhp.includes('astro_inline_logo_attachment()') &&
  familyApprovalPhp.includes('astro_inline_logo_attachment()'));

// --- (b2) the mailer must actually emit Content-ID inline images -----------
assert('Mailer accepts an inline images argument',
  /function sendEmailWithAttachments\([^)]*\$inlineImages/.test(mailerPhp));
assert('Mailer emits multipart/related for inline images',
  mailerPhp.includes('multipart/related'));
assert('Mailer writes the Content-ID header',
  mailerPhp.includes('Content-ID: <{$cid}>'));

// --- (b3) logo resolution must cover every deployment layout ---------------
assert('Branding helper resolves the API-bundled logo first',
  brandingPhp.includes("__DIR__ . '/assets/' . $name"));
assert('Branding helper falls back to the site root (cPanel public_html)',
  brandingPhp.includes("__DIR__ . '/../' . $name"));
assert('Report PDFs resolve the logo through the shared helper',
  mpdfReportsPhp.includes('astro_logo_path()') && mpdfReportsPhp.includes('astro_logo_url()'));
assert('Invoice PDFs resolve the logo through the shared helper',
  mpdfInvoicePhp.includes('astro_logo_path()'));
assert('Report header no longer hard-codes a repo-only path',
  !mpdfReportsPhp.includes("realpath(__DIR__ . '/../../public/astrosivam_logo.png')"));

// --- (b4) the bundled logo asset must exist -------------------------------
const bundledLogo = resolve(process.cwd(), 'api', 'assets', 'astrosivam_logo.png');
assert('Bundled API logo asset exists', existsSync(bundledLogo));
assert('Bundled API logo asset is a non-empty PNG',
  existsSync(bundledLogo) && readFileSync(bundledLogo).length > 1024);
assert('Bundled API logo stays small enough to inline in email (< 80 KB)',
  existsSync(bundledLogo) && readFileSync(bundledLogo).length < 80 * 1024);

const logoBytes = readFileSync(bundledLogo);
const expectedLogoUri = `data:image/png;base64,${logoBytes.toString('base64')}`;
assert('Shared logo is a standard RGBA PNG for email and PDF renderer compatibility',
  logoBytes.toString('ascii', 1, 4) === 'PNG' && logoBytes[25] === 6);
assert('Frontend report/invoice logo matches the deployed API logo exactly',
  ASTRO_LOGO_BASE64 === expectedLogoUri);
assert('Node PDF renderer logo matches the deployed API logo exactly',
  EMBEDDED_LOGO_BASE64 === expectedLogoUri);
assert('Browser invoice HTML renders the shared inline emblem in its centered lockup',
  invoiceHtml.includes('class="header-logo-mark"') &&
  invoiceHtml.includes('ASTRO SIVAM - OFFICIAL TAX INVOICE') &&
  invoiceHtml.includes('Official Receipt &amp; Tax Invoice'));
assert('Browser and server Muhurtham use the shared 160mm / 78mm date-pagination budgets',
  readFileSync(resolve(process.cwd(), 'src/services/muhurthamHtmlBuilder.ts'), 'utf8')
    .includes('MUHURTHAM_PAGE2_DATE_BUDGET_MM = 78') &&
  readFileSync(resolve(process.cwd(), 'src/services/muhurthamHtmlBuilder.ts'), 'utf8')
    .includes('MUHURTHAM_PAGE1_DATE_BUDGET_MM = 160') &&
  phpMuhurthamSource.includes('$page1BudgetMm = 160;') &&
  phpMuhurthamSource.includes('$page2BudgetMm = 78;'));
const reportPdfText = longBuf.toString('latin1');
const invoicePdfText = minimalInvoice.toString('latin1');
assert('Server-rendered report PDF contains the logo image and alpha mask',
  reportPdfText.includes('/Subtype /Image') && reportPdfText.includes('/SMask'));
assert('Server-rendered invoice PDF contains the logo image and alpha mask',
  invoicePdfText.includes('/Subtype /Image') && invoicePdfText.includes('/SMask'));

// --- (c) Node backend: logo is embedded inline in outbound email -----------
const logoAttachment = getLogoEmailAttachment();
assert('Node logo file resolves to the bundled asset', getLogoFilePath().includes('astrosivam_logo.png'));
assert('Node email logo attachment is produced', logoAttachment !== null);
assert('Node email logo attachment carries the cid', logoAttachment?.cid === 'astrosivamlogo');
assert('Node email attachment uses the same valid PNG as report and invoice builders',
  !!logoAttachment && logoAttachment.content.equals(logoBytes));
assert('Node email logo attachment is a PNG under 80 KB',
  !!logoAttachment && logoAttachment.contentType === 'image/png' && logoAttachment.content.length < 80 * 1024);
assert('Node single-order email embeds the cid logo',
  emailServiceSrc.includes('<img src="cid:${ASTRO_LOGO_CID}"'));
assert('Node email sends the inline logo alongside the PDFs',
  emailServiceSrc.includes('const mailAttachments = logoAttachment ? [...attachments, logoAttachment] : attachments;'));

// 16. ONE FAMILY ORDER = ONE CURRENCY (the customer's payment method decides)
console.log('\nTEST 16: Family Order Currency Is Decided By The Payment Method, Never By Birth Place');
const {
  PAYMENT_METHOD_CURRENCY,
  getCurrencyForPaymentMethod,
  resolveOrderCurrency,
  getServicePrices,
  getServicePriceInCurrency,
  cartTotalForPaymentMethod,
  cartItemPrices,
  currencyForCountry,
  defaultPaymentMethodForAccount,
  formatMoney,
  getCurrencySymbol
} = await import('../src/services/pricing');

// --- (a) payment method -> currency mapping -------------------------------
assert('Vodafone M-PAiSA settles in FJD', getCurrencyForPaymentMethod('MPAISA') === 'FJD');
assert('Digicel MyCash settles in FJD', getCurrencyForPaymentMethod('MYCASH') === 'FJD');
assert('Google Pay settles in INR', getCurrencyForPaymentMethod('GPAY') === 'INR');
assert('UPI settles in INR', getCurrencyForPaymentMethod('upi') === 'INR');
assert('PayPal settles in USD', getCurrencyForPaymentMethod('PAYPAL') === 'USD');
assert('Card settles in USD', getCurrencyForPaymentMethod('CARD') === 'USD');
assert('NONE has no currency of its own (falls back)', getCurrencyForPaymentMethod('NONE') === 'FJD');
assert('Every real payment method maps to exactly one currency',
  ['MPAISA', 'MYCASH', 'GPAY', 'UPI', 'PAYPAL', 'CARD'].every(
    m => PAYMENT_METHOD_CURRENCY[m as keyof typeof PAYMENT_METHOD_CURRENCY] !== null
  ));

// --- (b) birth place never wins over the payment method -------------------
assert('Born in India but paying by PayPal => USD',
  resolveOrderCurrency({ paymentMethod: 'PAYPAL', country: 'India', billingCountry: 'India' }) === 'USD');
assert('Born in Fiji but paying by Google Pay => INR',
  resolveOrderCurrency({ paymentMethod: 'GPAY', country: 'Fiji', billingCountry: 'Fiji' }) === 'INR');
assert('Born in USA but paying by M-PAiSA => FJD',
  resolveOrderCurrency({ paymentMethod: 'MPAISA', country: 'United States', billingCountry: 'United States' }) === 'FJD');
assert('FREE_BETA (no payment method) falls back to the billing country: India => INR',
  resolveOrderCurrency({ paymentMethod: 'NONE', billingCountry: 'India' }) === 'INR');
assert('FREE_BETA falls back to the billing country: Fiji => FJD',
  resolveOrderCurrency({ paymentMethod: 'NONE', billingCountry: 'Fiji' }) === 'FJD');
assert('FREE_BETA falls back to the billing country: USA => USD',
  resolveOrderCurrency({ paymentMethod: 'NONE', billingCountry: 'United States' }) === 'USD');
assert('FREE_BETA with no country at all defaults to FJD',
  resolveOrderCurrency({ paymentMethod: 'NONE' }) === 'FJD');
assert('Account country only pre-selects a payment method (India => GPAY)',
  defaultPaymentMethodForAccount('India') === 'GPAY' && currencyForCountry('India') === 'INR');
assert('Account country pre-selection: Fiji => MPAISA, USA => PAYPAL',
  defaultPaymentMethodForAccount('Fiji') === 'MPAISA' && defaultPaymentMethodForAccount('United States') === 'PAYPAL');

// --- (c) THE REPORTED BUG: husband + wife born in India, son born in Nadi --
const familyTray = [
  { serviceType: 'BIRTH_JATHAGAM' as const, country: 'India', prices: { FJD: 35, INR: 499, USD: 18 } },
  { serviceType: 'BIRTH_JATHAGAM' as const, country: 'India', prices: { FJD: 35, INR: 499, USD: 18 } },
  { serviceType: 'BIRTH_JATHAGAM' as const, country: 'Fiji', prices: { FJD: 35, INR: 499, USD: 18 } }
];

const gpayTotal = cartTotalForPaymentMethod(familyTray, null, 'GPAY');
assert('Mixed-birthplace family paying by GPay is billed in INR', gpayTotal.currency === 'INR');
assert('GPay total = 3 x 499 INR (not a mixed 499+499+35 sum)',
  gpayTotal.total === 1497, { total: gpayTotal.total });
assert('GPay per-chart amounts are all in INR',
  gpayTotal.lineTotals.join(',') === '499,499,499', { lineTotals: gpayTotal.lineTotals });

const mpaisaTotal = cartTotalForPaymentMethod(familyTray, null, 'MPAISA');
assert('Same family paying by M-PAiSA is billed in FJD', mpaisaTotal.currency === 'FJD');
assert('M-PAiSA total = 3 x 35 FJD', mpaisaTotal.total === 105, { total: mpaisaTotal.total });

const paypalTotal = cartTotalForPaymentMethod(familyTray, null, 'PAYPAL');
assert('Same family paying by PayPal is billed in USD', paypalTotal.currency === 'USD');
assert('PayPal total = 3 x 18 USD', paypalTotal.total === 54, { total: paypalTotal.total });

const mixedServiceTray = [
  { serviceType: 'BIRTH_JATHAGAM' as const, country: 'India' },
  { serviceType: 'MARRIAGE_COMPATIBILITY' as const, country: 'Fiji' },
  { serviceType: 'BABY_NAMING' as const, country: 'United States' }
];
const mixedGpay = cartTotalForPaymentMethod(mixedServiceTray, null, 'GPAY');
assert('Mixed services in one family order still price in ONE currency (INR)',
  mixedGpay.currency === 'INR' && mixedGpay.total === 499 + 699 + 399, { total: mixedGpay.total });
const mixedMpaisa = cartTotalForPaymentMethod(mixedServiceTray, null, 'MPAISA');
assert('Mixed services paying by M-PAiSA = 35+45+30 FJD',
  mixedMpaisa.currency === 'FJD' && mixedMpaisa.total === 110, { total: mixedMpaisa.total });

// --- (d) admin pricing overrides are honoured (both settings shapes) ------
const phpShapedSettings = {
  serviceMode: 'PAID',
  pricing: { BIRTH_JATHAGAM: { fjd: 40, usd: 20, inr: 599 } }
};
assert('PHP-shaped `pricing` overrides are used',
  getServicePriceInCurrency(phpShapedSettings, 'BIRTH_JATHAGAM', 'INR') === 599 &&
  getServicePriceInCurrency(phpShapedSettings, 'BIRTH_JATHAGAM', 'FJD') === 40);
const nodeShapedSettings = {
  serviceMode: 'PAID',
  servicePricing: { BIRTH_JATHAGAM: { fjd: 35, usd: 18, inr: 499 }, BABY_NAMING: { fjd: 30, usd: 15, inr: 399 } }
};
assert('Node-shaped `servicePricing` overrides are used',
  getServicePriceInCurrency(nodeShapedSettings, 'BABY_NAMING', 'USD') === 15);
assert('Missing per-service override falls back to the global country price',
  getServicePriceInCurrency({ serviceMode: 'PAID', indiaPriceINR: 777 }, 'BIRTH_JATHAGAM', 'INR') === 777);
assert('FREE_BETA makes only the FIRST chart free (2 x 499 INR still charged)',
  cartTotalForPaymentMethod(familyTray, { serviceMode: 'FREE_BETA' }, 'GPAY').total === 998);
assert('FREE_BETA with the free chart already used charges the full family',
  cartTotalForPaymentMethod(familyTray, { serviceMode: 'FREE_BETA', betaFreeChartAvailable: false }, 'GPAY').total === 1497);
assert('FREE_BETA single-chart order is fully free',
  cartTotalForPaymentMethod([familyTray[0]], { serviceMode: 'FREE_BETA' }, 'GPAY').total === 0);
assert('FREE_BETA marks the free chart as available in the cart totals',
  cartTotalForPaymentMethod(familyTray, { serviceMode: 'FREE_BETA' }, 'GPAY').freeChartAvailable === true &&
  cartTotalForPaymentMethod(familyTray, { serviceMode: 'FREE_BETA', betaFreeChartAvailable: false }, 'GPAY').freeChartAvailable === false);
assert('Cart items saved before per-currency pricing are rebuilt, not summed blindly',
  cartItemPrices({ serviceType: 'MARRIAGE_COMPATIBILITY' } as any, null).INR === 699);

// --- (e) formatting helpers ----------------------------------------------
assert('INR is formatted with the rupee symbol', formatMoney(1497, 'INR') === '₹1,497.00', { v: formatMoney(1497, 'INR') });
assert('FJD is formatted with FJ$', formatMoney(105, 'FJD') === 'FJ$105.00', { v: formatMoney(105, 'FJD') });
assert('USD is formatted with US$', formatMoney(54, 'USD') === 'US$54.00', { v: formatMoney(54, 'USD') });
assert('Currency symbols: INR/FJD/USD', getCurrencySymbol('INR') === '₹' && getCurrencySymbol('FJD') === 'FJ$' && getCurrencySymbol('USD') === 'US$');

// --- (f) Node backend must apply the same rule when creating orders -------
const previousCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), 'astrosivam-db-'));
process.chdir(tmpDbDir); // keep the test database out of the repo
const storeModule: any = await import('../server/db/store.js');
const nodeDb = storeModule.db;
nodeDb.updateSettings({ serviceMode: 'PAID' }, { id: 'test-admin', name: 'Test Admin' });

const mixedBirthItems = [
  {
    serviceType: 'BIRTH_JATHAGAM' as const,
    language: 'en' as const,
    country: 'India',
    inputPayload: { name: 'Husband', dob: '1990-05-14', tob: '06:30', birthPlace: 'Chennai, India', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5, gender: 'M' }
  },
  {
    serviceType: 'BIRTH_JATHAGAM' as const,
    language: 'en' as const,
    country: 'India',
    inputPayload: { name: 'Wife', dob: '1993-09-02', tob: '18:45', birthPlace: 'Madurai, India', latitude: 9.9252, longitude: 78.1198, timezoneOffsetHours: 5.5, gender: 'F' }
  },
  {
    serviceType: 'BIRTH_JATHAGAM' as const,
    language: 'en' as const,
    country: 'Fiji',
    inputPayload: { name: 'Son', dob: '2018-01-21', tob: '09:15', birthPlace: 'Nadi, Fiji', latitude: -17.7765, longitude: 177.4356, timezoneOffsetHours: 12, gender: 'M' }
  }
];

const nodeGpayOrders = nodeDb.createMultiOrder({
  userId: 'u1', userName: 'Family', userEmail: 'family@example.com', userMobile: '+679 000 0000',
  items: mixedBirthItems, billingCountry: 'India', paymentMethod: 'GPAY', paymentReference: 'UPI-REF-993812', ipAddress: '127.0.0.1'
});
assert('Node: family order via GPay stores INR on every chart',
  nodeGpayOrders.length === 3 && nodeGpayOrders.every((o: any) => o.currency === 'INR'),
  { currencies: nodeGpayOrders.map((o: any) => o.currency) });
assert('Node: every chart of the family costs 499 INR',
  nodeGpayOrders.every((o: any) => o.amount === 499), { amounts: nodeGpayOrders.map((o: any) => o.amount) });
assert('Node: the family shares one group id',
  new Set(nodeGpayOrders.map((o: any) => o.groupId)).size === 1);

const nodePaypalOrders = nodeDb.createMultiOrder({
  userId: 'u1', userName: 'Family', userEmail: 'family@example.com', userMobile: '+679 000 0000',
  items: mixedBirthItems, billingCountry: 'India', paymentMethod: 'PAYPAL', paymentReference: 'PP-REF-556211', ipAddress: '127.0.0.1'
});
assert('Node: the same family paying by PayPal is stored in USD at 18 each',
  nodePaypalOrders.every((o: any) => o.currency === 'USD' && o.amount === 18),
  { rows: nodePaypalOrders.map((o: any) => `${o.currency}:${o.amount}`) });

// Switch the site back to FREE_BETA and confirm the money still stays consistent
nodeDb.updateSettings({ serviceMode: 'FREE_BETA' }, { id: 'test-admin', name: 'Test Admin' });
const nodeBetaOrders = nodeDb.createMultiOrder({
  userId: 'u1', userName: 'Family', userEmail: 'family@example.com', userMobile: '+679 000 0000',
  items: mixedBirthItems, billingCountry: 'Fiji', paymentMethod: 'NONE', ipAddress: '127.0.0.1'
});
assert('Node: FREE_BETA family order makes only the FIRST chart free (0 / 35 / 35 FJD from the billing country)',
  nodeBetaOrders.length === 3 &&
  nodeBetaOrders[0].amount === 0 && nodeBetaOrders[0].serviceMode === 'FREE_BETA' &&
  nodeBetaOrders[1].amount === 35 && nodeBetaOrders[1].serviceMode === 'PAID' &&
  nodeBetaOrders[2].amount === 35 && nodeBetaOrders[2].serviceMode === 'PAID' &&
  nodeBetaOrders.every((o: any) => o.currency === 'FJD'),
  { rows: nodeBetaOrders.map((o: any) => `${o.currency}:${o.amount}:${o.serviceMode}`) });

// The NEXT family order from the same IP is fully paid — the 1 free report
// per IP was consumed by the first chart of the first order.
const nodeBetaSecondOrder = nodeDb.createMultiOrder({
  userId: 'u1', userName: 'Family', userEmail: 'family@example.com', userMobile: '+679 000 0000',
  items: mixedBirthItems, billingCountry: 'Fiji', paymentMethod: 'MPAISA', paymentReference: 'MP-SECONDFAM-8801', ipAddress: '127.0.0.1'
});
assert('Node: the next family order from the same IP is fully paid (3 x 35 FJD)',
  nodeBetaSecondOrder.every((o: any) => o.amount === 35 && o.serviceMode === 'PAID'),
  { rows: nodeBetaSecondOrder.map((o: any) => `${o.amount}:${o.serviceMode}`) });

// A NEW IP gets its own free chart on a single order — and only once.
const freshIp = '198.51.100.77';
const singleItem = {
  serviceType: 'BIRTH_JATHAGAM' as const,
  language: 'en' as const,
  country: 'Fiji',
  inputPayload: { name: 'Devotee', dob: '1992-07-07', tob: '10:20', birthPlace: 'Suva, Fiji', latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12, gender: 'F' }
};
const nodeFreeSingle = nodeDb.createOrder({
  userId: 'u2', userName: 'Devotee', userEmail: 'devotee@example.com', userMobile: '+679 111 2222',
  ...singleItem, billingCountry: 'Fiji', paymentMethod: 'NONE', ipAddress: freshIp
});
assert('Node: the FIRST single order from a new IP is free',
  nodeFreeSingle.amount === 0 && nodeFreeSingle.serviceMode === 'FREE_BETA',
  { amount: nodeFreeSingle.amount, serviceMode: nodeFreeSingle.serviceMode });
const nodePaidSingle = nodeDb.createOrder({
  userId: 'u2', userName: 'Devotee', userEmail: 'devotee@example.com', userMobile: '+679 111 2222',
  ...singleItem, billingCountry: 'Fiji', paymentMethod: 'MPAISA', paymentReference: 'MP-SECONDSINGLE-8802', ipAddress: freshIp
});
assert('Node: the SECOND single order from the same IP is a normal paid order',
  nodePaidSingle.amount === 35 && nodePaidSingle.serviceMode === 'PAID',
  { amount: nodePaidSingle.amount, serviceMode: nodePaidSingle.serviceMode });

process.chdir(previousCwd);
rmSync(tmpDbDir, { recursive: true, force: true });

// --- (f2) the real checkout component renders one price per option -------
const React: any = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { PaymentMethodSelector } = await import('../src/components/cart/PaymentMethodSelector');
const selectorHtml = renderToStaticMarkup(
  React.createElement(PaymentMethodSelector, {
    paymentMethod: 'GPAY',
    onSelect: () => {},
    totals: gpayTotal.totals
  })
);
assert('The payment picker shows the FJD price of the same family order',
  selectorHtml.includes('FJ$105.00'), { html: selectorHtml.slice(0, 200) });
assert('The payment picker shows the INR price of the same family order',
  selectorHtml.includes('₹1,497.00'));
assert('The payment picker shows the USD price of the same family order',
  selectorHtml.includes('US$54.00'));
assert('The payment picker marks the selected method as active',
  selectorHtml.includes('aria-pressed="true"') && selectorHtml.includes('aria-pressed="false"'));
assert('The payment picker labels all three methods',
  selectorHtml.includes('Vodafone M-PAiSA') && selectorHtml.includes('Google Pay / UPI') && selectorHtml.includes('PayPal / Card'));

// --- (f3) the real family tray bar shows ONE currency for the whole family -
const seededTray = [
  { id: 'i1', serviceType: 'BIRTH_JATHAGAM' as const, language: 'en' as const, devoteeName: 'Husband', summaryText: 'Born 1990 • Chennai, India', country: 'India', inputPayload: {}, unitPrice: 499, currency: 'INR' as const, prices: { FJD: 35, INR: 499, USD: 18 } },
  { id: 'i2', serviceType: 'BIRTH_JATHAGAM' as const, language: 'en' as const, devoteeName: 'Wife', summaryText: 'Born 1993 • Madurai, India', country: 'India', inputPayload: {}, unitPrice: 499, currency: 'INR' as const, prices: { FJD: 35, INR: 499, USD: 18 } },
  { id: 'i3', serviceType: 'BIRTH_JATHAGAM' as const, language: 'en' as const, devoteeName: 'Son', summaryText: 'Born 2018 • Nadi, Fiji', country: 'Fiji', inputPayload: {}, unitPrice: 35, currency: 'FJD' as const, prices: { FJD: 35, INR: 499, USD: 18 } }
];
const trayStore: Record<string, string> = {
  astrosivam_family_cart: JSON.stringify(seededTray),
  astrosivam_family_cart_payment_method: 'GPAY'
};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in trayStore ? trayStore[k] : null),
  setItem: (k: string, v: string) => { trayStore[k] = v; },
  removeItem: (k: string) => { delete trayStore[k]; }
};

const { CartProvider } = await import('../src/context/CartContext');
const { FamilyCartFloatingBar } = await import('../src/components/cart/FamilyCartFloatingBar');
const trayHtml = renderToStaticMarkup(
  React.createElement(CartProvider as any, null, React.createElement(FamilyCartFloatingBar as any, {}))
);
assert('The real family tray bar bills a mixed India/Fiji family in one currency (₹1497.00 INR)',
  trayHtml.includes('₹1497.00') && trayHtml.includes('Total in INR'), { html: trayHtml.slice(0, 400) });
assert('The tray bar names the payment method behind that currency',
  trayHtml.includes('via Google Pay / UPI'));
assert('The tray bar never shows a birthplace-driven FJD price for the same family',
  !trayHtml.includes('FJ$') && !trayHtml.includes('₹1033'));
delete (globalThis as any).localStorage;

// --- (g) source-level guards so the birthplace rule cannot creep back ----
const servicesPhp = readApi('services/index.php');
const authPhp = readApi('auth/index.php');
const birthProfileSchema = /CREATE TABLE IF NOT EXISTS `birth_profiles` \(([\s\S]*?)\) ENGINE=/
  .exec(readFileSync(resolve(process.cwd(), 'api', 'schema.sql'), 'utf-8'))?.[1] || '';
const storeSrc = readFileSync(resolve(process.cwd(), 'server', 'db', 'store.ts'), 'utf-8');
const checkoutSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'cart', 'UnifiedCheckoutModal.tsx'), 'utf-8');
const singleCheckoutSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'cart', 'SingleServiceCheckoutModal.tsx'), 'utf-8');
const cartContextSrc = readFileSync(resolve(process.cwd(), 'src', 'context', 'CartContext.tsx'), 'utf-8');
const pageSources = ['BirthJathagamPage.tsx', 'BabyNamingPage.tsx', 'MarriageCompatibilityPage.tsx'].map(f =>
  readFileSync(resolve(process.cwd(), 'src', 'pages', f), 'utf-8')
);

assert('PHP exposes the shared payment-currency rule', configPhp.includes('function astro_currency_for_payment('));
assert('PHP no longer derives the currency from the birth country',
  !/\$currency = \$isIndia \? 'INR'/.test(servicesPhp));
assert('Both PHP order handlers use the shared rule',
  (servicesPhp.match(/astro_currency_for_payment\(/g) || []).length >= 2);
assert('PHP sends the group total + currency back to the client',
  servicesPhp.includes("'totalAmount' => round($groupTotal, 2)") &&
  servicesPhp.includes("'currency' => $currency,"));
assert('PHP birth-profile SQL no longer invents a time, country, coordinates, or timezone',
  !servicesPhp.includes("$body['tob'] ?? '12:00'") &&
  !servicesPhp.includes("$bpTarget['tob'] ?? '12:00'") &&
  !servicesPhp.includes("$bpTarget['latitude'] ?? -17.8") &&
  !servicesPhp.includes("$bpTarget['longitude'] ?? 177.41") &&
  !servicesPhp.includes("$bpTarget['timezoneOffsetHours'] ?? 12.0") &&
  !servicesPhp.includes("$body['country'] ?? $user['country']") &&
  !servicesPhp.includes("$bpTarget['country'] ?? $country") &&
  !authPhp.includes("$birthProfile['country'] ?? $country") &&
  !authPhp.includes("$birthProfile['tob'] ?? '12:00'") &&
  !authPhp.includes("$birthProfile['latitude'] ?? -17.8") &&
  !authPhp.includes("$birthProfile['longitude'] ?? 177.41") &&
  !authPhp.includes("$birthProfile['timezoneOffsetHours'] ?? 12.0") &&
  !birthProfileSchema.includes("country` VARCHAR(100) NOT NULL DEFAULT 'Fiji'") &&
  !birthProfileSchema.includes('latitude` DECIMAL(10, 6) NOT NULL DEFAULT') &&
  !birthProfileSchema.includes('longitude` DECIMAL(10, 6) NOT NULL DEFAULT') &&
  !birthProfileSchema.includes('timezone_offset_hours` DECIMAL(4, 2) NOT NULL DEFAULT'));
assert('Node store resolves the currency through the shared rule',
  (storeSrc.match(/resolveOrderCurrency\(/g) || []).length >= 2);
assert('No service page derives the charge currency from a birth place',
  pageSources.every(src => !src.includes("const curr = isIndia ? 'INR'")) &&
  pageSources.every(src => src.includes('getCurrencyForPaymentMethod(paymentMethod)')));
assert('Service pages attach all three prices to the family tray',
  pageSources.every(src => src.includes('const prices = getServicePrices(settings,')));
assert('Checkout submits the chosen payment method and its currency',
  checkoutSrc.includes('paymentMethod: requiresPayment ? paymentMethod : \'NONE\'') &&
  checkoutSrc.includes('currency,') && checkoutSrc.includes('totalAmount,'));
assert('A completed multi-person checkout snapshots its total and clears receipt/intent data for the next order',
  checkoutSrc.includes('setSuccessSummary({') &&
  checkoutSrc.includes('totalAmount: Number(res.totalAmount ?? checkoutTotal)') &&
  checkoutSrc.includes('chartCount:') && checkoutSrc.includes('peopleCount:') &&
  checkoutSrc.includes("setPaymentRef('')") && checkoutSrc.includes("setPaymentIntentId('')") &&
  checkoutSrc.includes('Place Another Order'));
assert('The single-service checkout resets its previous receipt and success state when reopened',
  singleCheckoutSrc.includes('if (isOpen && !wasOpen.current)') &&
  singleCheckoutSrc.includes("setPaymentRef('')") && singleCheckoutSrc.includes('setSuccessOrder(null)'));
assert('The Node pending-order cap counts unpaid checkout groups and excludes verified payments',
  storeSrc.includes('const pendingGroups = new Set<string>()') &&
  storeSrc.includes("['CAPTURED', 'VERIFIED_MANUAL', 'NOT_REQUIRED'].includes(paymentStatus)") &&
  storeSrc.includes('pendingGroups.size'));
assert('The PHP pending-order cap counts family groups and excludes captured payments',
  servicesPhp.includes('function astro_count_pending_order_groups_by_ip') &&
  servicesPhp.includes("COUNT(DISTINCT COALESCE(NULLIF(group_id, ''), id))") &&
  servicesPhp.includes("NOT IN ('CAPTURED', 'VERIFIED_MANUAL', 'NOT_REQUIRED')"));
assert('Checkout lets the customer pick the payment method',
  checkoutSrc.includes('<PaymentMethodSelector'));
assert('Cart totals come from the shared, tested pricing module',
  cartContextSrc.includes('cartTotalForPaymentMethod(items, settings, paymentMethod'));

function familyGroupDelegates(src: string): boolean {
  return /astroApproveFamilyGroup\(\$pdo, \$admin, \$groupId, 'approve'[^)]*\)/.test(src);
}

// 16. FAMILY ORDER HIGH-QUALITY LIVE-PREVIEW & CONSOLIDATED INVOICE GUARDS
// A family bundle's reports and its consolidated tax invoice must render with
// the SAME high quality as the single-order "View" live preview in the admin
// panel: identical premium invoice design, one line item per member, and the
// emailed PDFs must be the preview-exact renders (not the lower-quality
// server-side PDFs).
console.log('\nTEST 16: Family Order Live-Preview Quality & Consolidated Invoice Guards');

const famMemberA = {
  id: 'ord_fam_a',
  orderNumber: 'ASV-FAM-1001',
  userId: 'usr_fam',
  userName: 'Ravi Kumar',
  userEmail: 'family@test.com',
  userMobile: '+679 111 2222',
  serviceType: 'BIRTH_JATHAGAM',
  language: 'ta',
  country: 'Fiji',
  currency: 'FJD',
  amount: 33.5,
  serviceMode: 'PAID',
  paymentMethod: 'GPAY',
  paymentReference: 'PAY-FAM-1',
  status: 'PENDING',
  emailStatus: 'PENDING',
  emailDeliveryAttempts: 0,
  inputPayload: { name: 'Ravi Kumar', dob: '1990-01-01', tob: '06:30', birthPlace: 'Suva, Fiji' },
  hasPdf: false,
  groupId: 'FAM-2026-001',
  groupOrderIndex: 0,
  createdAt: new Date().toISOString()
} as any;
const famMemberB = {
  ...famMemberA,
  id: 'ord_fam_b',
  orderNumber: 'ASV-FAM-1002',
  userName: 'Priya',
  serviceType: 'BABY_NAMING',
  language: 'en',
  amount: 44.25,
  paymentReference: 'PAY-FAM-1',
  groupOrderIndex: 1,
  inputPayload: { name: 'Priya', babyName: 'Anaya', dob: '2024-06-01', tob: '09:15', birthPlace: 'Nadi, Fiji', gender: 'F' }
} as any;

const famInvoiceHtml = buildFamilyInvoiceHtml([famMemberA, famMemberB], 'FAM-2026-001');
const singleInvoiceHtml = buildInvoiceHtml(famMemberA);

assert('Family invoice HTML generated', famInvoiceHtml.includes('invoice-page'));
assert('Family invoice uses the same premium inner frame as single invoices',
  famInvoiceHtml.includes('class="inner"') && singleInvoiceHtml.includes('class="inner"'));
assert('Family invoice is labelled as the consolidated family package invoice',
  famInvoiceHtml.includes('FAMILY TAX INVOICE') && famInvoiceHtml.includes('FAMILY PACKAGE'));
assert('Family invoice carries the family group reference',
  famInvoiceHtml.includes('INV-FAM-2026-001') && famInvoiceHtml.includes('FAM-2026-001'));
assert('Family invoice lists every member name', famInvoiceHtml.includes('Ravi Kumar') && famInvoiceHtml.includes('Priya'));
assert('Family invoice shows one line item per member', famInvoiceHtml.includes('ASV-FAM-1001') && famInvoiceHtml.includes('ASV-FAM-1002'));
assert('Family invoice shows each member line total', famInvoiceHtml.includes('33.50') && famInvoiceHtml.includes('44.25'));
assert('Family invoice totals the combined family payment', famInvoiceHtml.includes('77.75'));
assert('Family invoice shares the identical premium stylesheet with single invoices',
  famInvoiceHtml.includes('--maroon: #7a2129') && singleInvoiceHtml.includes('--maroon: #7a2129') &&
  famInvoiceHtml.includes('--gold-pale: #f7efdd') && singleInvoiceHtml.includes('--gold-pale: #f7efdd'));
assert('Family invoice marks the package PAID & VERIFIED', famInvoiceHtml.includes('PAID & VERIFIED'));
assert('Family invoice declares digital delivery of all member reports',
  famInvoiceHtml.includes('2 certified') || famInvoiceHtml.includes('2 reports'));

const coupleOrder = {
  ...famMemberA,
  serviceType: 'MARRIAGE_COMPATIBILITY',
  inputPayload: { bride: { name: 'Anitha' }, groom: { name: 'Karthik' }, brideDob: '1992-02-02', groomDob: '1990-03-03' }
} as any;
assert('Couple invoice rows name both partners', memberDisplayName(coupleOrder) === 'Anitha & Karthik');

const exporterSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'jathagamPdfExporter.ts'), 'utf8');
assert('Exporter provides the high-quality family invoice export', exporterSrc.includes('exportFamilyInvoiceHtmlToPdf'));
assert('Exporter provides preview-exact family package generation', exporterSrc.includes('generateFamilyOrderPdfsBase64'));
assert('Family package export renders through the same high-res canvas pipeline',
  exporterSrc.includes('buildFamilyInvoiceHtml(sorted, effectiveGroupId)') &&
  exporterSrc.includes('generatePdfBase64FromHtml(invoiceHtml, renderOptions)'));
assert('Email PDFs use the same high-resolution capture settings as the desktop preview export',
  EMAIL_RENDER_OPTIONS.scale === DOWNLOAD_RENDER_OPTIONS.scale &&
  EMAIL_RENDER_OPTIONS.jpegQuality === DOWNLOAD_RENDER_OPTIONS.jpegQuality &&
  DOWNLOAD_RENDER_OPTIONS.scale === 3 && DOWNLOAD_RENDER_OPTIONS.jpegQuality === 0.95);
assert('Low-memory phone preview exports retain the same responsive high-quality profile',
  DOWNLOAD_RENDER_OPTIONS_MOBILE.scale === 2.5 && DOWNLOAD_RENDER_OPTIONS_MOBILE.jpegQuality === 0.95);
assert('Every email canvas is gated at 1900 × 2800 pixels and fails instead of lowering capture scale',
  EMAIL_RENDER_OPTIONS.minimumCaptureWidthPx === 1900 &&
  EMAIL_RENDER_OPTIONS.minimumCaptureHeightPx === 2800 &&
  exporterSrc.includes('highQualityEmailRenderOptions()') &&
  exporterSrc.includes('minimumCaptureWidthPx && canvas.width < minimumCaptureWidthPx') &&
  exporterSrc.includes('minimumCaptureHeightPx && canvas.height < minimumCaptureHeightPx'));
const structurallyValidPreviewPdf = Buffer.concat([
  Buffer.from('%PDF-1.7\\n'), Buffer.alloc(2048, 0), Buffer.from('\\n%%EOF')
]).toString('base64');
assert('Preview PDF guard accepts a sufficiently complete PDF capture',
  assertPreviewQualityPdfBase64(structurallyValidPreviewPdf, 'test preview PDF') > 2048);
let invalidPreviewPdfRejected = false;
try {
  assertPreviewQualityPdfBase64(Buffer.from('not a pdf').toString('base64'), 'invalid test PDF');
} catch {
  invalidPreviewPdfRejected = true;
}
assert('Preview PDF guard rejects an invalid or truncated capture before email', invalidPreviewPdfRejected);

assert('Family routine accepts only high-resolution preview-exact client PDFs',
  familyApprovalPhp.includes('$clientDocs') &&
  familyApprovalPhp.includes("'reportPdfs'") &&
  familyApprovalPhp.includes('astroFamilyDocsDecodePdf(') &&
  familyApprovalPhp.includes('astroFamilyDocsIsPreviewQualityPdf('));
assert('Family routine attaches the preview-exact consolidated family invoice',
  familyApprovalPhp.includes('$clientInvoicePdf') && familyApprovalPhp.includes('$invoicePdf = $clientInvoicePdf;'));
assert('Family routine fails closed when a preview invoice/report is missing (no server PDF fallback)',
  familyApprovalPhp.includes("$clientInvoicePdf === ''") &&
  familyApprovalPhp.includes('Missing reports:') &&
  familyApprovalPhp.includes('No email was sent; retry the render/upload.') &&
  !familyApprovalPhp.includes('generateFamilyInvoicePdf(') &&
  !familyApprovalPhp.includes('AstroEngine::generateReportPdf($o, $result)'));
assert('Family delegates forward the preview-exact PDF payload',
  /astroApproveFamilyGroup\(\$pdo, \$admin, \$groupId, 'approve', (?:\$body|getJsonBody\(\))\)/.test(approveOrderPhp) &&
  /astroApproveFamilyGroup\(\$pdo, \$admin, \$groupId, 'approve', getJsonBody\(\)\)/.test(adminOrdersPhp) &&
  adminIndexPhp.includes("jsonResponse(astroApproveFamilyGroup($pdo, $admin, $order['group_id'], 'approve', $body));"));

const apiSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'api.ts'), 'utf8');
assert('approveFamilyOrder forwards the preview-exact PDF payload',
  /async approveFamilyOrder\(\s*groupId: string,\s*payload\?/.test(apiSrc) && apiSrc.includes('...(payload || {})'));
assert('resendFamilyEmail forwards the preview-exact PDF payload',
  /async resendFamilyEmail\(\s*groupId: string,\s*payload\?/.test(apiSrc));

const livePreviewSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'common', 'LivePdfPreviewModal.tsx'), 'utf8');
assert('Live preview renders the consolidated family invoice',
  livePreviewSrc.includes('buildFamilyInvoiceHtml'));
assert('Live preview accepts the full family bundle', livePreviewSrc.includes('familyOrders?: Order[]'));
assert('Live preview downloads exactly the HTML it previews, invoices included',
  livePreviewSrc.includes('downloadHtmlPdf(previewHtml') &&
  livePreviewSrc.includes('buildFamilyInvoiceHtml') &&
  livePreviewSrc.includes('previewFileName()'));
assert('Live preview emails the preview-exact family package',
  livePreviewSrc.includes('prepareFamilyFulfilPayload') && livePreviewSrc.includes('api.approveFamilyOrder'));

const orderReportModalSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'common', 'OrderReportModal.tsx'), 'utf8');
assert('Order View modal auto-calculates missing family-member results',
  orderReportModalSrc.includes('api') && orderReportModalSrc.includes('calculateService'));
assert('Order View modal sends the preview-exact family package',
  orderReportModalSrc.includes('prepareFamilyFulfilPayload') && orderReportModalSrc.includes('api.approveFamilyOrder'));

const adminPortalSrc = readFileSync(resolve(process.cwd(), 'src', 'pages', 'AdminPortal.tsx'), 'utf8');
assert('Admin panel previews the family invoice via the live preview pipeline',
  adminPortalSrc.includes('handlePreviewFamilyInvoice') && adminPortalSrc.includes('buildFamilyPreviewPayload'));
assert('Admin panel downloads the family invoice in high quality first',
  adminPortalSrc.includes('exportFamilyInvoiceHtmlToPdf'));
assert('Admin panel approves family groups with the fully prepared preview-exact payload',
  adminPortalSrc.includes('api.approveFamilyOrder(groupId, prepared.payload)'));
assert('Admin panel passes the family bundle into the order View modal',
  adminPortalSrc.includes('familyOrders={'));

// 17. GROUP (FAMILY) ORDERS MUST USE THE SAME PREVIEW-QUALITY PIPELINE AS SINGLE ORDERS
// A single order renders its report + invoice in the browser (~2 MB, ~8 s) and
// emails exactly that. A family bundle used to stuff N reports into ONE request
// body, which can exceed PHP's post_max_size (8M). Every member is now rendered
// and uploaded one at a time, and a missing upload fails closed rather than
// triggering a server-rendered substitute. The complete family delivery may be
// split across several size-bounded emails, all carrying the preview PDFs.
console.log('\nTEST 17: Group Order Render Quality Parity With Single Orders (staged per-member pipeline)');

// ---- A. shared render helpers (behavioural) -------------------------------
const horoOrderForRender = {
  ...famMemberA,
  serviceType: 'BIRTH_JATHAGAM',
  inputPayload: {
    name: 'Ravi Kumar', dob: '1990-01-01', tob: '06:30', birthPlace: 'Suva', country: 'Fiji',
    latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12, gender: 'M'
  }
} as any;
const storedHoroResult = calculatePrecisionHoroscope('Native', '1990-01-01', '06:30', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M');
const mergedHoro = mergeOrderPayloadIntoResult(horoOrderForRender, storedHoroResult as any);
assert('Family member report inherits the devotee name from the order payload (no "Native" placeholder)',
  mergedHoro.devoteeName === 'Ravi Kumar', { devoteeName: mergedHoro.devoteeName });
const horoWithoutBirthCountryOrder = {
  ...horoOrderForRender,
  country: 'Fiji', // account/billing country only
  inputPayload: { ...horoOrderForRender.inputPayload, country: '' }
} as any;
const mergedHoroWithoutBirthCountry = mergeOrderPayloadIntoResult(horoWithoutBirthCountryOrder, storedHoroResult as any);
const noCountryHoroHtml = buildJathagamHtml(mergedHoroWithoutBirthCountry as any, 'en');
assert('Birth Jathagam does not reuse account country as birthplace country',
  mergedHoroWithoutBirthCountry.birthPlace === 'Suva' && mergedHoroWithoutBirthCountry.country === '' &&
  noCountryHoroHtml.includes('Suva') && !noCountryHoroHtml.includes('Suva, Fiji'));
assert('Birth Jathagam cached chart is recalculated when verified birth inputs change',
  resultNeedsRecalculation({ ...horoOrderForRender, inputPayload: { ...horoOrderForRender.inputPayload, dob: '1991-01-01' } }, storedHoroResult as any));

const storedWedding = calculateWeddingCompatibility({
  bride: {
    name: 'Bride', dob: '1992-02-02', tob: '05:30', birthPlace: 'Suva', country: 'Fiji',
    latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12, timeZoneId: 'Pacific/Fiji'
  },
  groom: {
    name: 'Groom', dob: '1990-03-03', tob: '07:45', birthPlace: 'Nadi', country: 'Fiji',
    latitude: -17.8, longitude: 177.41, timezoneOffsetHours: 12, timeZoneId: 'Pacific/Fiji'
  }
});
const weddingOrder = {
  ...famMemberA,
  serviceType: 'MARRIAGE_COMPATIBILITY',
  inputPayload: {
    bride: {
      name: 'Anitha', dob: '1992-02-02', tob: '05:30', birthPlace: 'Suva', country: 'Fiji',
      latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12, timeZoneId: 'Pacific/Fiji'
    },
    groom: {
      name: 'Karthik', dob: '1990-03-03', tob: '07:45', birthPlace: 'Nadi', country: 'Fiji',
      latitude: -17.8, longitude: 177.41, timezoneOffsetHours: 12, timeZoneId: 'Pacific/Fiji'
    }
  }
} as any;
const mergedWedding = mergeOrderPayloadIntoResult(weddingOrder, storedWedding as any);
assert('Family member matchmaking report uses the real bride & groom names',
  mergedWedding.brideName === 'Anitha' && mergedWedding.groomName === 'Karthik',
  { bride: mergedWedding.brideName, groom: mergedWedding.groomName });
assert('Matchmaking birthplace labels append only each person\'s recorded birth country',
  mergedWedding.bridePlace === 'Suva, Fiji' && mergedWedding.groomPlace === 'Nadi, Fiji',
  { bridePlace: mergedWedding.bridePlace, groomPlace: mergedWedding.groomPlace });
const weddingNoCountryOrder = {
  ...weddingOrder,
  country: 'Fiji', // account/billing country must not leak into either birthplace
  inputPayload: {
    bride: { ...weddingOrder.inputPayload.bride, country: '' },
    groom: { ...weddingOrder.inputPayload.groom, country: '' }
  }
} as any;
const weddingWithStaleCountry = {
  ...storedWedding,
  bridePlace: 'Suva, Fiji',
  groomPlace: 'Nadi, Fiji',
  bride: { ...storedWedding.bride, birthPlace: 'Suva', country: 'Fiji' },
  groom: { ...storedWedding.groom, birthPlace: 'Nadi', country: 'Fiji' }
} as any;
const mergedWeddingNoCountry = mergeOrderPayloadIntoResult(weddingNoCountryOrder, weddingWithStaleCountry);
assert('Wedding cache merge strips stale country labels not present in bride/groom birth inputs',
  mergedWeddingNoCountry.bridePlace === 'Suva' && mergedWeddingNoCountry.groomPlace === 'Nadi');
const weddingNoPlaceOrder = {
  ...weddingOrder,
  country: 'Fiji',
  inputPayload: {
    bride: { ...weddingOrder.inputPayload.bride, birthPlace: '', country: '' },
    groom: { ...weddingOrder.inputPayload.groom, birthPlace: '', country: '' }
  }
} as any;
const mergedWeddingNoPlace = mergeOrderPayloadIntoResult(weddingNoPlaceOrder, weddingWithStaleCountry);
const weddingNoPlaceHtml = buildWeddingMatchHtml(mergedWeddingNoPlace, 'en');
assert('Wedding report builders do not fall back to stale cached birthplace labels',
  mergedWeddingNoPlace.bridePlace === '' && mergedWeddingNoPlace.groomPlace === '' &&
  weddingNoPlaceHtml.includes('Not provided') && !weddingNoPlaceHtml.includes('Nadi, Fiji'));
assert('Couple member is displayed as "Bride & Groom" in progress + file names',
  familyMemberDisplayName(weddingOrder) === 'Anitha & Karthik');
assert('Single devotee member is displayed by their own name',
  familyMemberDisplayName(horoOrderForRender) === 'Ravi Kumar');

const legacyBabyResult = { nakshatraLetters: null, primaryPadaInfo: null, babyNamingAlgorithmVersion: 1 };
const currentBabyResult = baby;
const babyOrder = {
  ...famMemberA,
  serviceType: 'BABY_NAMING',
  inputPayload: {
    babyName: 'Aarav', dob: '2024-03-10', tob: '08:45', birthPlace: 'Suva', country: 'Fiji', gender: 'M',
    latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12
  }
} as any;
assert('Legacy baby-naming results are recalculated instead of rendered thin',
  resultNeedsRecalculation(babyOrder, legacyBabyResult) === true);
assert('Current baby-naming results with matching verified birth inputs are rendered as stored',
  resultNeedsRecalculation(babyOrder, currentBabyResult) === false);
assert('Baby Naming cache is refreshed when a saved birth coordinate changes',
  resultNeedsRecalculation({ ...babyOrder, inputPayload: { ...babyOrder.inputPayload, latitude: -17.8 } }, currentBabyResult) === true);
const babyWithoutCountryOrder = {
  ...babyOrder,
  country: 'Fiji',
  inputPayload: { ...babyOrder.inputPayload, country: '' }
} as any;
const mergedBabyWithoutCountry = mergeOrderPayloadIntoResult(babyWithoutCountryOrder, { ...currentBabyResult, country: 'Fiji' });
const babyNoCountryHtml = buildBabyNamingHtml(mergedBabyWithoutCountry, 'en');
assert('Baby Naming cache merge does not reuse account country as birthplace country',
  mergedBabyWithoutCountry.birthPlace === 'Suva' && mergedBabyWithoutCountry.country === '' &&
  babyNoCountryHtml.includes('Suva') && !babyNoCountryHtml.includes('Suva, Fiji'));
assert('Horoscope results saved without bhavas are recalculated',
  resultNeedsRecalculation(horoOrderForRender, { lagnaRasi: 5 } as any) === true);
assert('Complete horoscope results are rendered as stored',
  resultNeedsRecalculation(horoOrderForRender, storedHoroResult as any) === false);

assert('Family reports are built by the SAME builder dispatcher as single orders',
  buildOrderReportHtml(horoOrderForRender, mergedHoro, 'ta').includes('page') &&
  buildOrderReportHtml(horoOrderForRender, mergedHoro, 'ta') ===
    buildJathagamHtml(mergedHoro as any, 'ta'));
assert('Unknown service types render nothing instead of an empty PDF',
  buildOrderReportHtml({ ...horoOrderForRender, serviceType: 'UNKNOWN' } as any, mergedHoro, 'ta') === '');

assert('Render quality verdict is reported for preview-exact delivery',
  describeFamilyRenderQuality({ renderQuality: 'PREVIEW_EXACT' }).includes('live-preview'));
assert('Render quality verdict warns when a member fell back to the server renderer',
  describeFamilyRenderQuality({
    renderQuality: 'MIXED',
    serverRenderedReports: 1,
    serverRenderedOrderNumbers: ['ASV-FAM-1002']
  }).includes('ASV-FAM-1002'));

// ---- B. exporter: one render + one upload per member ----------------------
assert('Exporter stages each family member report individually',
  exporterSrc.includes('export async function stageFamilyOrderPdfs') &&
  exporterSrc.includes('api.stageFamilyDoc(effectiveGroupId'));
assert('Staged upload sends kind/orderId/orderNumber/fileName so the server can match the member',
  /kind: 'report',\s*orderId: order\.id,\s*orderNumber: order\.orderNumber,\s*fileName,\s*pdfBase64/.test(exporterSrc));
assert('The consolidated family invoice is staged too',
  exporterSrc.includes("kind: 'invoice'") && exporterSrc.includes('buildFamilyInvoiceHtml(sorted, effectiveGroupId)'));
assert('Members are rendered sequentially (never all at once) so progress stays live',
  exporterSrc.includes('for (let i = 0; i < total; i++)') && exporterSrc.includes('yieldToBrowser()'));
assert('PDF pages are inserted immediately instead of retaining every huge canvas data URL',
  exporterSrc.includes('doc.addImage(imgData') && !exporterSrc.includes('const imgDataList: string[] = []'));
assert('PDF rendering avoids zero-sized internal gradient canvases before createPattern',
  exporterSrc.includes('onclone: async (clonedDocument: Document)') &&
  exporterSrc.includes("style.backgroundImage.includes('gradient(')") &&
  exporterSrc.includes('rect.width < 1') && exporterSrc.includes('rect.height < 1'));
assert('PDF canvas cleanup never leaves a zero-sized canvas for the next family render',
  !/canvas\.(?:width|height)\s*=\s*0/.test(exporterSrc) &&
  exporterSrc.includes('Drop our reference instead'));
assert('Every family render starts with a clean staging scope (no stale member PDFs)',
  exporterSrc.includes('await clearStagedScope()') && exporterSrc.includes('api.clearFamilyStagedDocs(effectiveGroupId)'));
assert('Family fulfilment is all-or-nothing for any member count',
  exporterSrc.includes('readyReports !== orders.length') && exporterSrc.includes('Nothing was emailed; retry the render'));
assert('Rendering reports progress per member (index / total / member name)',
  exporterSrc.includes("phase: 'rendering'") && exporterSrc.includes("phase: 'uploading'") &&
  exporterSrc.includes('FAMILY_RENDER_HINT_SECONDS'));
assert('Family rendering resolves + refreshes stale calculated results like the live preview',
  exporterSrc.includes('resultNeedsRecalculation(order, order.calculatedResult)'));
assert('A deployment without the staging endpoint falls back to the inline payload',
  exporterSrc.includes("result.mode = 'inline'") && exporterSrc.includes('export async function prepareFamilyFulfilPayload'));
assert('Staged deliveries tell the server to attach what was uploaded',
  exporterSrc.includes('useStagedDocs: true') && exporterSrc.includes('stagedReports: staging.stagedReports'));
assert('Each family member is rendered in the language THEY ordered in',
  exporterSrc.includes("(options?.preferredLang || (order.language as AppLanguage) || 'ta')"));
assert('Family members default to the same language as single orders (ta, never en)',
  exporterSrc.includes("(order.language as AppLanguage) || 'ta'") &&
  !/const lang = \(order\.language as AppLanguage\) \|\| 'en'/.test(exporterSrc));

// ---- C. API client --------------------------------------------------------
assert('API client uploads one document per request',
  /async stageFamilyDoc\(/.test(apiSrc) && /async stageOrderDoc\(/.test(apiSrc) &&
  apiSrc.includes('async function postStagedDoc('));
assert('Staging targets the family + single order endpoints and the direct PHP file',
  apiSrc.includes('/stage-doc') && apiSrc.includes('admin/family_docs.php'));
assert('Staging reports an unsupported deployment so callers can fall back',
  apiSrc.includes('unsupported: true') && apiSrc.includes('res.status === 404'));
assert('Staged documents can be discarded for family and single-order scopes',
  apiSrc.includes('async clearFamilyStagedDocs(') && apiSrc.includes('async clearOrderStagedDocs('));
assert('Customer resend uses owner-authenticated per-document staging for single and family orders',
  apiSrc.includes('async stageCustomerOrderDoc(') && apiSrc.includes('async stageCustomerFamilyDoc(') &&
  apiSrc.includes('async clearCustomerFamilyStagedDocs('));
assert('Family approve payload accepts the staged variant',
  apiSrc.includes('useStagedDocs?: boolean') && apiSrc.includes('FamilyFulfilPayload'));
assert('Family approve response exposes render-quality telemetry',
  apiSrc.includes("renderQuality?: 'PREVIEW_EXACT' | 'MIXED' | 'SERVER_RENDER'"));

// ---- D. PHP backend -------------------------------------------------------
const familyDocsPhp = readFileSync(resolve(process.cwd(), 'api', 'admin', 'family_docs.php'), 'utf8');
assert('PHP staging module stores one preview-rendered document per request',
  familyDocsPhp.includes('function astroStageFamilyDoc(') &&
  familyDocsPhp.includes('function astroLoadStagedFamilyDocs(') &&
  familyDocsPhp.includes('function astroClearStagedFamilyDocs('));
assert('PHP staging requires a high-resolution raster on every page and caps the document size',
  familyDocsPhp.includes('astroFamilyDocsIsPreviewQualityPdf') &&
  familyDocsPhp.includes('ASTRO_FAMILY_DOC_MIN_PREVIEW_WIDTH_PX') &&
  familyDocsPhp.includes('ASTRO_FAMILY_DOC_MIN_PREVIEW_HEIGHT_PX') &&
  familyDocsPhp.includes('$imageCount === $pageCount') &&
  familyDocsPhp.includes('ASTRO_FAMILY_DOC_MAX_BYTES'));
assert('PHP staging keys are filesystem-safe (no traversal)',
  familyDocsPhp.includes('function astroFamilyDocsSanitizeKey('));
assert('Direct PHP single-order staging maps to the same order_<id> scope as rewritten routes',
  familyDocsPhp.includes("$scope = !empty($orderRow['group_id'])") &&
  familyDocsPhp.includes("'order_' . $requestedOrderId"));
assert('PHP staging expires abandoned documents',
  familyDocsPhp.includes('ASTRO_FAMILY_DOC_TTL') && familyDocsPhp.includes('function astroFamilyDocsPrune('));
assert('PHP staging falls back to the system temp dir when public_html is not writable',
  familyDocsPhp.includes("sys_get_temp_dir() . '/astrosivam_family_docs'"));

assert('PHP router exposes the family + single order staging endpoints',
  /family-orders\|admin\\\/orders\)\\\/\(\[\^\\\/\]\+\)\\\/stage-doc/.test(adminIndexPhp) ||
  adminIndexPhp.includes("preg_match('/(?:family-orders|admin\\/orders)\\/([^\\/]+)\\/stage-doc/'"));
assert('PHP router tells the admin when the request body was discarded by post_max_size',
  adminIndexPhp.includes('bodyTooLarge') && adminIndexPhp.includes("ini_get('post_max_size')"));
assert('PHP single-order approve also accepts staged documents',
  adminIndexPhp.includes("astroLoadStagedFamilyDocs($stagedScope)") &&
  adminIndexPhp.includes("astroClearStagedFamilyDocs($stagedScope)"));

assert('Family routine merges the staged preview renders into the email',
  familyApprovalPhp.includes('astroLoadStagedFamilyDocs($groupId)') &&
  familyApprovalPhp.includes('$stagedReportCount'));
assert('Family routine keeps the preview-exact consolidated invoice from staging',
  familyApprovalPhp.includes("$stagedDocs['invoice']['content']"));
assert('Family routine removes staged customer PDFs once the email is sent',
  familyApprovalPhp.includes('astroClearStagedFamilyDocs($groupId)'));
assert('Family routine reports that every sent report and invoice is preview-exact',
  familyApprovalPhp.includes("'renderQuality' => $renderQuality") &&
  familyApprovalPhp.includes("'serverRenderedReports' => $serverReports") &&
  familyApprovalPhp.includes('$previewReports++') &&
  familyApprovalPhp.includes('$serverReports = 0'));
assert('PHP backend refuses any incomplete preview-quality package instead of emailing a fallback',
  familyApprovalPhp.includes('$missingReportNumbers') &&
  familyApprovalPhp.includes("$clientInvoicePdf === ''") &&
  familyApprovalPhp.includes('No email was sent; retry the render/upload.') &&
  !familyApprovalPhp.includes('AstroEngine::generateReportPdf($o, $result)'));

const userIni = readFileSync(resolve(process.cwd(), 'api', '.user.ini'), 'utf8');
assert('api/.user.ini raises post_max_size so a 2 MB preview render is never discarded',
  /post_max_size\s*=\s*(\d+)M/.test(userIni) && Number(userIni.match(/post_max_size\s*=\s*(\d+)M/)![1]) >= 64);
assert('api/.user.ini raises the memory + execution limits for multi-PDF emails',
  /memory_limit\s*=\s*(\d+)M/.test(userIni) && /max_execution_time\s*=\s*(\d+)/.test(userIni));
const apiHtaccess = readFileSync(resolve(process.cwd(), 'api', '.htaccess'), 'utf8');
assert('api/.htaccess applies the same limits when PHP runs as an Apache module',
  apiHtaccess.includes('php_value post_max_size') && apiHtaccess.includes('<IfModule mod_php.c>'));
const storageHtaccess = readFileSync(resolve(process.cwd(), 'api', 'storage', '.htaccess'), 'utf8');
assert('Staged customer PDFs are blocked from direct web access',
  storageHtaccess.includes('Require all denied') && storageHtaccess.includes('Deny from all'));

// Unmatched /api routes used to hit a font-test page (which enabled
// display_errors), so a stale client path returned a Tamil sample PDF.
const zipScript = readFileSync(resolve(process.cwd(), 'scripts', 'create_dist_zip.py'), 'utf8');
assert('The release package ships every document the deployment guide links to',
  readFileSync(resolve(process.cwd(), 'BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md'), 'utf8')
    .includes('RATE_LIMITING_AND_PAYMENT_RECOVERY.md') &&
  readFileSync(resolve(process.cwd(), 'BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md'), 'utf8')
    .includes('PDF_DELIVERY_QUALITY.md') &&
  zipScript.includes("BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md") &&
  zipScript.includes("RATE_LIMITING_AND_PAYMENT_RECOVERY.md") &&
  zipScript.includes("PDF_DELIVERY_QUALITY.md"));
assert('The deployment guide documents the mPDF vendor install the zip omits',
  readFileSync(resolve(process.cwd(), 'BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md'), 'utf8')
    .includes('public_html/vendor/autoload.php') &&
  zipScript.includes("'vendor'"));
const apiNotFoundPhp = readFileSync(resolve(process.cwd(), 'api', '404.php'), 'utf8');
const apiRootPhp = readFileSync(resolve(process.cwd(), 'api', 'index.php'), 'utf8');
assert('api/.htaccess answers unmatched API routes with the JSON 404 handler',
  apiHtaccess.includes('RewriteRule ^(.*)$ 404.php [L,QSA]'));
assert('The API 404 handler returns JSON without loading config or enabling display_errors',
  apiNotFoundPhp.includes('http_response_code(404)') &&
  apiNotFoundPhp.includes("'success' => false") &&
  !apiNotFoundPhp.includes('require_once') &&
  !apiNotFoundPhp.includes("ini_set('display_errors'"));
assert('The API root is a JSON banner, not the mPDF font-test page',
  !apiRootPhp.includes("ini_set('display_errors'") && !apiRootPhp.includes('->Output(') &&
  apiRootPhp.includes("'service' => 'ASTRO SIVAM API'"));

const checkMpdfPhp = readFileSync(resolve(process.cwd(), 'api', 'check_mpdf.php'), 'utf8');
assert('The mPDF diagnostic page is gated behind ASTROSIVAM_DIAGNOSTICS and never shows errors by default',
  checkMpdfPhp.includes("getenv('ASTROSIVAM_DIAGNOSTICS')") &&
  checkMpdfPhp.indexOf("getenv('ASTROSIVAM_DIAGNOSTICS')") < checkMpdfPhp.indexOf("ini_set('display_errors'"));

// ---- E. Node backend ------------------------------------------------------
const stagedDocsTs = readFileSync(resolve(process.cwd(), 'server', 'services', 'stagedDocs.ts'), 'utf8');
assert('Node backend stages one document per request too',
  stagedDocsTs.includes('export function stageDoc(') &&
  stagedDocsTs.includes('export function loadStagedDocs(') &&
  stagedDocsTs.includes('export function clearStagedDocs('));
assert('Node staging enforces a high-resolution image on every page and caps the PDF size',
  stagedDocsTs.includes('isHighQualityPreviewPdf') &&
  stagedDocsTs.includes('MIN_PREVIEW_PAGE_WIDTH_PX') &&
  stagedDocsTs.includes('MIN_PREVIEW_PAGE_HEIGHT_PX') &&
  stagedDocsTs.includes('imageCount === pages') &&
  stagedDocsTs.includes('MAX_DOC_BYTES')
);
assert('Node staging expires abandoned documents', stagedDocsTs.includes('DOC_TTL_MS') && stagedDocsTs.includes('pruneStaleDocs'));
const nodeAdminSrc = readFileSync(resolve(process.cwd(), 'server', 'routes', 'admin.ts'), 'utf8');
assert('Node approval and resend routes share the high-resolution PDF validator',
  nodeAdminSrc.includes("decodePdfPayload } from '../services/stagedDocs.js'") &&
  nodeAdminSrc.includes('decodePdfPayload(item.pdfBase64)') &&
  servicesRouteSource.includes('decodePdfPayload(item.pdfBase64 ?? item.pdf_base64)') &&
  servicesRouteSource.includes('decodePdfPayload(body?.invoicePdfBase64 ?? body?.invoice_pdf_base64)'));

const nodeFamilyFulfilSrc = nodeAdminSrc.slice(
  nodeAdminSrc.indexOf('async function processFamilyOrderCalculationsAndEmail'),
  nodeAdminSrc.indexOf('// GET /api/admin/orders')
);
assert('Node admin router exposes the staging endpoints',
  nodeAdminSrc.includes("adminRouter.post('/family-orders/:groupId/stage-doc'") &&
  nodeAdminSrc.includes("adminRouter.post('/orders/:id/stage-doc'"));
assert('Node family fulfilment merges inline + staged preview documents',
  nodeAdminSrc.includes('resolveClientDocs(clientDocs, groupId)') &&
  nodeAdminSrc.includes('pickClientReport(resolvedDocs, order, false)'));
assert('Node family fulfilment never attaches an unidentified document to the wrong devotee',
  nodeAdminSrc.includes('allowAnonymous'));
assert('Node family fulfilment clears staged documents and reports render quality',
  nodeAdminSrc.includes('clearStagedDocs(groupId)') && nodeAdminSrc.includes('renderQuality'));
assert('Node backend refuses any incomplete preview-quality family package instead of emailing a fallback',
  nodeFamilyFulfilSrc.includes('Every family report and the consolidated invoice is mandatory') &&
  nodeFamilyFulfilSrc.includes('No email was sent; retry the render/upload.') &&
  !nodeFamilyFulfilSrc.includes('generateFamilyInvoicePdf'));
const serverSrc = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
assert('Ordinary Node API requests use a bounded 8 MB JSON body limit',
  serverSrc.includes("process.env.API_BODY_LIMIT || '8mb'"));
assert('Large preview-PDF uploads get a separate 56 MB parser only after admin authentication',
  serverSrc.includes("process.env.STAGED_DOC_BODY_LIMIT || '56mb'") &&
  serverSrc.includes('requireAdmin, parseStagedDocJson'));

// ---- F. every family entry point uses the staged pipeline -----------------
assert('Admin order list renders + uploads each family member before emailing',
  adminPortalSrc.includes('prepareFamilyFulfilPayload') &&
  adminPortalSrc.includes('api.approveFamilyOrder(groupId, prepared.payload)') &&
  adminPortalSrc.includes('api.resendFamilyEmail(groupId, prepared.payload)'));
assert('Admin order list shows per-member render progress for group orders',
  adminPortalSrc.includes('familyRenderProgress') &&
  adminPortalSrc.includes('rendering report {familyRenderProgress.index} of {familyRenderProgress.total}') &&
  adminPortalSrc.includes('Rendering report {familyRenderProgress.index}/{familyRenderProgress.total}') &&
  adminPortalSrc.includes('Report {familyRenderProgress.index}/{familyRenderProgress.total}'));
assert('Admin order list keeps family render-quality reporting visible',
  adminPortalSrc.includes('describeFamilyRenderQuality'));
assert('Live preview + order modal send family bundles through the same pipeline',
  livePreviewSrc.includes('prepareFamilyFulfilPayload') && orderReportModalSrc.includes('prepareFamilyFulfilPayload'));
assert('The modals never override the language each member ordered in',
  livePreviewSrc.includes('No preferredLang: every member keeps the language they ordered in') &&
  orderReportModalSrc.includes('No preferredLang: every member keeps the language they ordered in'));
assert('Family approval reports the combined attachment size before the mailer can reject it',
  familyApprovalPhp.includes('$totalAttachmentMb') && nodeAdminSrc.includes('totalAttachmentBytes'));
assert('Reads never resurrect a cleaned staging folder',
  familyDocsPhp.includes('astroFamilyDocsGroupDir($scope, false)') &&
  stagedDocsTs.includes('scopeDir(cleanScope, false)'));
assert('Single orders keep the proven inline body but stage when it grows too large',
  exporterSrc.includes('SINGLE_ORDER_INLINE_LIMIT_BYTES') &&
  exporterSrc.includes('export async function deliverOrderPdfPayload') &&
  adminPortalSrc.includes('deliverOrderPdfPayload') &&
  livePreviewSrc.includes('deliverOrderPdfPayload') &&
  orderReportModalSrc.includes('deliverOrderPdfPayload'));
assert('A single order keeps every unstaged preview PDF inline or fails before sending',
  exporterSrc.includes('reportStaged ? {} : { reportPdfBase64: payload.reportPdfBase64 }') &&
  exporterSrc.includes('invoiceStaged ? {} : { invoicePdfBase64: payload.invoicePdfBase64 }') &&
  exporterSrc.includes('if (inlineBytes > SINGLE_ORDER_INLINE_LIMIT_BYTES)') &&
  exporterSrc.includes('Nothing was emailed; restore the document-upload route and retry.'));

assert('The deployment zip ships the staging guards but never staged customer PDFs',
  readFileSync(resolve(process.cwd(), 'scripts', 'create_dist_zip.py'), 'utf8').includes('is_runtime_artifact'));

// ────────────────────────────────────────────────────────────────────────────
// DOWNLOADED / EMAILED PDFs MUST BE THE PREVIEW, NOT THE SERVER RENDER
//
// The live preview shows the report's real HTML in an iframe, so it looks
// perfect; the download used to ask a *different* renderer (server-side jsPDF or
// PHP mPDF) for a PDF, which produced visibly thinner documents. Both the
// download button and the approval email capture the previewed HTML in the
// browser. A download can recover with a server PDF; customer email fails closed
// if capture or upload fails.
// ────────────────────────────────────────────────────────────────────────────
assert('The exporter renders previewed HTML at print resolution on download',
  exporterSrc.includes('export async function downloadHtmlPdf') &&
  exporterSrc.includes('export function recommendedDownloadOptions') &&
  exporterSrc.includes('DOWNLOAD_RENDER_OPTIONS'));
assert('Downloads pick the capture density the device can afford',
  exporterSrc.includes('DOWNLOAD_RENDER_OPTIONS_MOBILE') &&
  exporterSrc.includes('deviceMemory'));
assert('Emailed documents use the preview-matching high-resolution capture profile',
  exporterSrc.includes('EMAIL_RENDER_OPTIONS') && exporterSrc.includes('recommendedDownloadOptions()'));
assert('A failed browser download may recover with a server PDF (email fulfillment does not)',
  exporterSrc.includes('export function downloadFromServerUrl') &&
  livePreviewSrc.includes('downloadFromServerUrl') &&
  orderReportModalSrc.includes('exportOrderReportPdf') &&
  livePreviewSrc.includes('no server-rendered substitute is sent'));
assert('Every service exporter renders the preview HTML before asking the server',
  ['exportJathagamHtmlToPdf', 'exportWeddingHtmlToPdf', 'exportBabyNamingHtmlToPdf', 'exportMuhurthamHtmlToPdf']
    .every(fn => new RegExp('export async function ' + fn + '[\\s\\S]{0,700}downloadHtmlPdf\\(').test(exporterSrc)));
assert('The order View modal downloads the report it previews',
  orderReportModalSrc.includes('exportOrderReportPdf(order, lang, result)') &&
  orderReportModalSrc.includes('exportFamilyInvoiceHtmlToPdf(familyOrders, order.groupId)'));
assert('PHP single-order approval accepts the preview-exact documents',
  adminIndexPhp.includes('astroSingleOrderClientDocs') &&
  adminIndexPhp.includes('astroLoadStagedFamilyDocs($stagedScope)') &&
  familyDocsPhp.includes('function astroSingleOrderClientDocs'));
assert('PHP family approval attaches the preview-exact reports and invoice it was given',
  familyApprovalPhp.includes('$pickClientReport($o)') &&
  familyApprovalPhp.includes('$previewReports++') &&
  familyApprovalPhp.includes('$invoiceFromPreview = true') &&
  !familyApprovalPhp.includes('AstroEngine::generateReportPdf($o, $result)') &&
  !familyApprovalPhp.includes('generateFamilyInvoicePdf('));
assert('PHP approval, preview, resend and direct PDF paths rebuild results from saved service inputs',
  adminIndexPhp.includes('rebuildReportResultFromSavedInputs($order)') &&
  adminIndexPhp.includes('UPDATE orders SET calculated_result = ?, updated_at = NOW()') &&
  !adminIndexPhp.includes('AstroEngine::isCurrentMuhurthamResult($result)'));
assert('Muhurtham user email carries the admin live-preview quality, same as every other service',
  livePreviewSrc.includes('buildMuhurthamHtml') &&
  livePreviewSrc.includes('generateOrderPdfsBase64') &&
  livePreviewSrc.includes('deliverOrderPdfPayload') &&
  exporterSrc.includes('return buildMuhurthamHtml(result as MuhurthamScanResult, lang);') &&
  adminPortalSrc.includes('ADMIN LIVE PDF PREVIEW') &&
  adminPortalSrc.includes('deliverOrderPdfPayload'));
assert('The admin panel reports which document quality actually went out',
  adminPortalSrc.includes('describeFamilyRenderQuality(res)') &&
  adminIndexPhp.includes("'renderQuality' => $clientDocs['quality']"));

// 18. FREE BETA = EXACTLY ONE FREE REPORT PER IP ADDRESS
// The first single order from an IP is free. If the first order is a FAMILY
// order, only member 1 (the first chart) is free — the rest of the family
// pays. Every later order from the same IP is a normal paid order (it is NOT
// rejected anymore). The runtime behaviour is covered by TEST 16(f); these
// guards keep the rule wired through every layer.
console.log('\nTEST 18: Free Beta Grants Exactly 1 Free Report Per IP Address');

const pricingSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'pricing.ts'), 'utf-8');
const nodeServicesSrc = readFileSync(resolve(process.cwd(), 'server', 'routes', 'services.ts'), 'utf-8');
const cartContextSrc2 = readFileSync(resolve(process.cwd(), 'src', 'context', 'CartContext.tsx'), 'utf-8');
const schemaSql = readFileSync(resolve(process.cwd(), 'api', 'schema.sql'), 'utf-8');

// --- PHP API (the live cPanel backend) ------------------------------------
assert('PHP family order: only the first chart is free',
  servicesPhp.includes('$isThisItemFree = $freeChartAvailable && $idx === 0;'));
assert('PHP family order: the free chart is decided by the per-IP free slot',
  servicesPhp.includes('$freeChartAvailable = $isFreeBetaMode && $ipOrderCount < 1;'));
assert('PHP family order: payment is required as soon as one chart is chargeable',
  servicesPhp.includes('$requiresGroupPayment = $paidChartCount > 0;'));
assert('PHP single order: a used free chart becomes a PAID order, not a rejection',
  servicesPhp.includes('$isFreeOrder = ($isFreeBeta || $serviceMode === \'FREE_BETA\') && $ipOrderCount < 1;') &&
  servicesPhp.includes("$effectiveServiceMode = $isFreeOrder ? 'FREE_BETA' : 'PAID';"));
assert('PHP records the beta slot only for the genuinely free chart',
  servicesPhp.includes('if ($isThisItemFree) {') && servicesPhp.includes('if ($isFreeOrder) {'));
assert('PHP no longer hard-rejects second orders from the same IP',
  !servicesPhp.includes('FREE BETA LIMIT REACHED'));
assert('PHP settings endpoint tells this IP whether its free chart is still unused',
  servicesPhp.includes('betaFreeChartAvailable'));

// --- Node backend ----------------------------------------------------------
assert('Node settings endpoint reports the per-IP free chart availability',
  nodeServicesSrc.includes('settings.betaFreeChartAvailable =') &&
  nodeServicesSrc.includes('db.getBetaIpOrderCount(resolveClientIp(req)) < 1'));
assert('Node store: only the first chart of a family order is free',
  storeSrc.includes('isThisItemFree = freeChartAvailable && index === 0'));
assert('Node store: single orders consume the free slot only while it is unused',
  storeSrc.includes("this.getBetaIpOrderCount(orderData.ipAddress || '') < 1"));
assert('Node routes: paid charts require a payment method (no 429 beta rejection)',
  nodeServicesSrc.includes('const paidChartCount = Math.max(0, items.length - (freeChartAvailable ? 1 : 0));') &&
  !nodeServicesSrc.includes('FREE BETA LIMIT REACHED'));

// --- Frontend --------------------------------------------------------------
assert('Pricing module: the free beta chart zeroes only the first cart line',
  pricingSrc.includes('if (freeChartAvailable && index === 0)') &&
  pricingSrc.includes('export function isBetaFreeChartAvailable'));
assert('Cart context prices only the first chart free and exposes the flag',
  cartContextSrc2.includes('if (betaFreeChartAvailable && index === 0)') &&
  cartContextSrc2.includes('betaFreeChartAvailable,'));
assert('Checkout sends a real payment method whenever there is something to pay',
  checkoutSrc.includes("paymentMethod: requiresPayment ? paymentMethod : 'NONE'"));
assert('Service pages keep collecting payment once the free chart is used',
  pageSources.every(src => src.includes('orderWillBeFree')));

// --- Schema ----------------------------------------------------------------
assert('Schema documents the 1-free-report-per-IP rule',
  schemaSql.includes('1 FREE REPORT per IP') || schemaSql.includes('ONE free report per IP'));

// ══════════════════════════════════════════════════════════════════════════
// 19. THE DOWNLOAD IS THE PREVIEW — same fonts, same DOM, same quality
//
// Field report: "In muhurtham report preview and download quality is different
// — I want the same quality in preview to download."
//
// Root cause: the preview is a real iframe (browser fonts, real layout), while
// the download was produced by html2canvas photographing a freshly re-parsed
// copy of the HTML. That copy starts with an empty font cache, so the capture
// often ran with fallback serif glyphs and different text metrics — a visibly
// different (and lower-quality) PDF. These guards keep the parity fix wired:
//   1. fonts are injected + awaited (per face, in page AND clone document),
//   2. the download uses the same preview HTML and capture profile, and
//   3. server-rendered recovery exports are download-only; paid emails require the browser PDFs.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 19: Preview-Exact Downloads (font parity + live-preview capture)');

const reportFontsSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'reportFonts.ts'), 'utf8');
const exporterSource = readFileSync(resolve(process.cwd(), 'src', 'services', 'jathagamPdfExporter.ts'), 'utf8');
const previewModalSource = readFileSync(resolve(process.cwd(), 'src', 'components', 'common', 'LivePdfPreviewModal.tsx'), 'utf8');
const jathagamBuilderSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'jathagamHtmlBuilder.ts'), 'utf8');
const weddingBuilderSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'weddingHtmlBuilder.ts'), 'utf8');
const babyBuilderSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'babyNamingHtmlBuilder.ts'), 'utf8');
const muhurthamBuilderSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'muhurthamHtmlBuilder.ts'), 'utf8');
const invoiceBuilderSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'invoiceHtmlBuilder.ts'), 'utf8');

// --- the font parity module itself -----------------------------------------
assert('Report fonts live in ONE shared module (stylesheet + per-face specs)',
  reportFontsSrc.includes('export const REPORT_FONTS_HREF') &&
  reportFontsSrc.includes('export const REPORT_FONT_SPECS') &&
  reportFontsSrc.includes("'Noto Sans Tamil'") &&
  reportFontsSrc.includes("'Baloo Thambi 2'"));
assert('Font readiness is verified per face, not just via document.fonts.ready',
  reportFontsSrc.includes('fontSet.load(spec, REPORT_FONT_SAMPLE)') &&
  reportFontsSrc.includes('fontSet.check(spec, REPORT_FONT_SAMPLE)'));
assert('A blocked font CDN can never hang a download (bounded waits)',
  reportFontsSrc.includes('function withTimeout') &&
  reportFontsSrc.includes('setTimeout(finish, timeoutMs)'));

// --- the exporter waits for the fonts on BOTH documents ---------------------
assert('The capture waits for the report fonts before laying the report out',
  exporterSource.includes('await ensureReportFonts(document, { timeoutMs: 7000 })'));
assert('The html2canvas clone waits for the report fonts too (async onclone)',
  exporterSource.includes('onclone: async (clonedDocument: Document)') &&
  exporterSource.includes('await ensureReportFonts(clonedDocument, { timeoutMs: 6000 })'));
assert('The preview warms the fonts so the first download never races them',
  previewModalSource.includes('warmReportFonts()'));

// html2canvas's baseline probes are created in the PARENT document. Tailwind
// makes their 1px image display:block, moving the baseline to the next line.
let captureStyle: any;
let captureStyleRemoved = false;
const restoreMetrics = installCanvasFontMetricsReset({
  createElement: (tag: string) => {
    if (tag !== 'style') throw new Error('Only a scoped stylesheet is needed');
    captureStyle = { textContent: '', setAttribute() {}, remove() { captureStyleRemoved = true; } };
    return captureStyle;
  },
  head: { appendChild() {} }
} as unknown as Document);
assert('The baseline fix targets only hidden font probes, not visible report / website images',
  captureStyle.textContent.includes('body > div[style*="visibility: hidden"]') &&
  captureStyle.textContent.includes('[style*="font-family:"]') &&
  captureStyle.textContent.includes('> img') &&
  captureStyle.textContent.includes('display: inline !important')
);
restoreMetrics();
assert('The scoped baseline reset can be removed without leaving a global image override', captureStyleRemoved);
assert('Every capture applies the baseline fix and restores it even on retries / errors',
  exporterSource.includes('restoreFontMetrics = installCanvasFontMetricsReset(document)') &&
  exporterSource.includes('restoreFontMetrics?.()')
);
assert('Live iframe exports wait for fonts in the calling document as well as the preview',
  exporterSource.includes('ensureReportFonts(document, { timeoutMs: 7000 })') &&
  exporterSource.includes('ensureReportFonts(ownerDoc, { timeoutMs: 5000 })')
);

// --- the download photographs the LIVE preview, not a re-parsed copy --------
assert('The exporter can render already-laid-out preview pages',
  exporterSource.includes('export async function renderPageElementsToPdfDoc') &&
  exporterSource.includes('export async function downloadPreviewPagesPdf'));
assert('The live-preview capture never re-fits (the pages are already A4)',
  !/renderPageElementsToPdfDoc[\s\S]{0,1200}fitPageToA4Element/.test(exporterSource));
assert('The preview modal keeps a handle on the iframe it is showing',
  previewModalSource.includes('previewFrameRef') &&
  previewModalSource.includes('getLivePreviewPages') &&
  previewModalSource.includes("querySelectorAll<HTMLElement>('.page')"));
assert('Download order: live preview DOM → same HTML string → server render',
  previewModalSource.indexOf('downloadPreviewPagesPdf(livePages') <
    previewModalSource.indexOf('await downloadHtmlPdf(previewHtml, previewFileName())') &&
  previewModalSource.indexOf('await downloadHtmlPdf(previewHtml, previewFileName())') <
    previewModalSource.indexOf('export-preview-pdf'));

// --- every report still ships its fonts from the same URL ------------------
assert('Every report builder links the shared fonts stylesheet',
  [jathagamBuilderSrc, weddingBuilderSrc, babyBuilderSrc, muhurthamBuilderSrc, invoiceBuilderSrc]
    .every(src => src.includes('REPORT_FONT_LINK_TAG')));

// --- runtime check of the pure helpers -------------------------------------
const fontStatusUnsupported = await (async () => {
  const fakeDoc = {
    head: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, addEventListener: () => {}, removeEventListener: () => {} })
  } as unknown as Document;
  const { ensureReportFonts } = await import('../src/services/reportFonts');
  return ensureReportFonts(fakeDoc, { timeoutMs: 30 });
})();
assert('A document without the Font Loading API reports unsupported instead of throwing',
  fontStatusUnsupported.unsupported === true && fontStatusUnsupported.ready === true);

const { downloadAttemptOptions, DOWNLOAD_RENDER_OPTIONS_SAFE } = await import('../src/services/jathagamPdfExporter');
const downloadAttempts = downloadAttemptOptions();
assert('A device that cannot capture at full density retries smaller instead of switching engines',
  downloadAttempts.length >= 2 &&
  downloadAttempts[downloadAttempts.length - 1].scale === DOWNLOAD_RENDER_OPTIONS_SAFE.scale &&
  new Set(downloadAttempts.map(a => `${a.scale}/${a.jpegQuality}`)).size === downloadAttempts.length);

// ══════════════════════════════════════════════════════════════════════════
// 20. SUBHA MUHURTHAM JOINS THE FAMILY ORDER
//
// A Muhurtham chart is a first-class family-tray member: it is added from its
// own page with the six-month scan, priced in the same currency as every other
// chart, calculated by both backends, and rendered by the same preview-exact
// report builder as a single order.
// ══════════════════════════════════════════════════════════════════════════
console.log('\nTEST 20: Subha Muhurtham Is A Family Order Member');

const muhurthamPageSrc = readFileSync(resolve(process.cwd(), 'src', 'pages', 'MuhurthamPage.tsx'), 'utf8');
const cartDrawerSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'cart', 'FamilyCartDrawer.tsx'), 'utf8');
const storeSrc2 = readFileSync(resolve(process.cwd(), 'server', 'db', 'store.ts'), 'utf8');
const nodeServicesSrc2 = readFileSync(resolve(process.cwd(), 'server', 'routes', 'services.ts'), 'utf8');
const nodeAdminSrc2 = readFileSync(resolve(process.cwd(), 'server', 'routes', 'admin.ts'), 'utf8');

// --- frontend: add to tray ---------------------------------------------------
assert('Muhurtham page can add the report to the Family Tray',
  muhurthamPageSrc.includes('handleAddToFamilyTray') &&
  muhurthamPageSrc.includes("serviceType: 'MUHURTHAM'") &&
  muhurthamPageSrc.includes('muhurthamScan'));
assert('The tray line carries the six-month scan, ceremony and month the customer chose',
  muhurthamPageSrc.includes('eventKey: selectedEvent,') &&
  muhurthamPageSrc.includes('eventTitleEn: eventConfig.titleEn') &&
  muhurthamPageSrc.includes('months,') &&
  muhurthamPageSrc.includes('persons'));
assert('The tray line is priced in every currency, like the other services',
  muhurthamPageSrc.includes("getServicePrices(settings, 'MUHURTHAM')") &&
  muhurthamPageSrc.includes('prices,') &&
  muhurthamPageSrc.includes('unitPrice,'));
assert('The family tray offers Subha Muhurtham as a quick add',
  cartDrawerSrc.includes("handleAddAnother('muhurtham')") &&
  cartDrawerSrc.includes('Subha Muhurtham'));

// --- backend: calculated at order time, by both backends --------------------
assert('Node store calculates a Muhurtham family member instead of leaving it empty',
  storeSrc2.includes("data.serviceType === 'MUHURTHAM'") &&
  storeSrc2.includes('computeMuhurthamResultFromPayload'));
assert('The shared Muhurtham module normalises a supplied scan and rescans when missing',
  muhurthamScanSource.includes('export function computeMuhurthamResultFromPayload') &&
  muhurthamScanSource.includes('export function computeMuhurthamResult') &&
  muhurthamScanSource.includes('scanMonthMuhurtham('));
assert('Both order endpoints validate a Muhurtham line before accepting the bundle',
  (nodeServicesSrc2.match(/hasMuhurthamScan/g) || []).length >= 3);
assert('PHP multi-order calculates Muhurtham charts through the engine',
  servicesPhp.includes("} elseif ($st === 'MUHURTHAM') {") &&
  servicesPhp.includes('AstroEngine::calculateMuhurtham($inputPayload);'));
assert("PHP family approval rebuilds each report from its saved service inputs before emailing",
  familyApprovalPhp.includes('rebuildReportResultFromSavedInputs($o)') &&
  familyApprovalPhp.includes('SET calculated_result = ?, updated_at = NOW()'));
assert('Node admin approval recomputes reports from saved order inputs and requires the preview-rendered report',
  nodeAdminSrc2.includes('computeOrderReportResult(order)') &&
  nodeAdminSrc2.includes('No server-rendered substitute is allowed for customer email') &&
  nodeAdminSrc2.includes('Every family report and the consolidated invoice is mandatory'));
assert('Admin calculation previews use the same saved-input dispatcher as official reports',
  servicesRouteSource.includes('Use the same saved-input dispatcher as official reports') &&
  servicesRouteSource.includes('inputPayload: payload') &&
  servicesRouteSource.includes('computeOrderReportResult({'));
assert('Muhurtham order PDFs recalculate from saved locations while customer resends require the browser preview PDF',
  servicesRouteSource.includes('computeOrderReportResult(order)') &&
  orderReportResultSource.includes('computeMuhurthamResultFromPayload({ inputPayload: p, userName: order.userName })') &&
  muhurthamScanSource.includes('scanVersion === MUHURTHAM_ALGORITHM_VERSION && isMuhurthamScanCurrentForPayload(scan, payload)') &&
  muhurthamScanSource.includes('return recalculate(input);') &&
  customerResendSource.includes('resolveCustomerResendDocs') &&
  !customerResendSource.includes('generateMuhurthamPdf')
);

// --- rendering: identical builder as single orders --------------------------
assert('A family Muhurtham member renders through the shared report builder',
  exporterSource.includes("if (order.serviceType === 'MUHURTHAM') {\n    return buildMuhurthamHtml(result as MuhurthamScanResult, lang);") &&
  exporterSource.includes('export function buildOrderReportHtml'));

// --- runtime check: a real scan survives normalisation, and a missing one is
//     rebuilt from explicit birth and Muhurtham locations -------------------
const { scanMonthMuhurtham, findNakshatraFromBirthDetails, MUHURTHAM_ALGORITHM_VERSION } = await import('../src/lib/muhurtham/scanner');
const {
  normalizeMuhurthamScan: normalizeScan,
  computeMuhurthamResultFromPayload: recomputeScan
} = await import('../server/astrology/muhurthamScan');

const muhurthamLocation = { placeName: 'Suva', latitude: -18.1416, longitude: 178.4419, timezoneOffsetHours: 12 };
const muhurthamBirth = { dob: '1990-08-15', tob: '09:30' };
const star = findNakshatraFromBirthDetails(muhurthamBirth.dob, muhurthamBirth.tob, false, 12);
// The scan is always forward-looking (past dates are skipped), so the fixture
// uses the same anchoring the Subha Muhurtham page does: a future window.
const selectedScanMonth = (() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 2, 1);
})();
const scanStart = new Date(selectedScanMonth.getFullYear(), selectedScanMonth.getMonth() - 2, 1);
const scanMonths = Array.from({ length: 6 }, (_, index) => {
  const monthDate = new Date(scanStart.getFullYear(), scanStart.getMonth() + index, 1);
  return scanMonthMuhurtham(monthDate.getFullYear(), monthDate.getMonth() + 1, muhurthamLocation, 'wedding', {
    persons: star ? [{ role: 'self', nakshatraIndex: star.primary.nakshatraIndex, rasiNumber: star.primary.rasiNumber }] : [],
    birthDate: muhurthamBirth.dob,
    skipPastDates: true
  });
});
const scanWindowLabel = `${selectedScanMonth.getFullYear()}-${String(selectedScanMonth.getMonth() + 1).padStart(2, '0')}`;
const trayPayload = {
  name: 'Meena',
  dob: muhurthamBirth.dob,
  tob: muhurthamBirth.tob,
  birthPlace: 'Suva',
  country: 'Fiji',
  latitude: muhurthamLocation.latitude,
  longitude: muhurthamLocation.longitude,
  timezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
  muhurthamPlace: muhurthamLocation.placeName,
  muhurthamCountry: 'Fiji',
  muhurthamLatitude: muhurthamLocation.latitude,
  muhurthamLongitude: muhurthamLocation.longitude,
  muhurthamTimezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
  eventKey: 'wedding',
  selectedMonth: scanWindowLabel,
  muhurthamScan: {
    muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
    selectedMonth: scanWindowLabel,
    eventKey: 'wedding',
    inputContext: {
      dob: muhurthamBirth.dob, tob: muhurthamBirth.tob, birthPlace: 'Suva', country: 'Fiji',
      latitude: muhurthamLocation.latitude, longitude: muhurthamLocation.longitude,
      timezoneOffsetHours: muhurthamLocation.timezoneOffsetHours, timeZoneId: '',
      muhurthamPlace: muhurthamLocation.placeName, muhurthamCountry: 'Fiji',
      muhurthamLatitude: muhurthamLocation.latitude, muhurthamLongitude: muhurthamLocation.longitude,
      muhurthamTimezoneOffsetHours: muhurthamLocation.timezoneOffsetHours, muhurthamTimeZoneId: '',
      eventKey: 'wedding', selectedMonth: scanWindowLabel
    },
    months: scanMonths,
    persons: []
  }
};
const normalized = normalizeScan(trayPayload);
assert('A family-tray Muhurtham payload keeps all six scanned months',
  normalized.months.length === 6 &&
  normalized.months.every((m: any) => m.days.length > 0) &&
  Number(normalized.muhurthamAlgorithmVersion) === MUHURTHAM_ALGORITHM_VERSION);
assert('The normalised scan keeps the ceremony and the devotee name for the report',
  normalized.eventKey === 'wedding' &&
  normalized.devoteeName === 'Meena' &&
  normalized.months[0].bestCount + normalized.months[0].goodCount + normalized.months[0].fairCount + normalized.months[0].avoidCount === normalized.months[0].days.length);

const rescanned = recomputeScan({
  inputPayload: { ...trayPayload, muhurthamScan: undefined, selectedMonth: scanWindowLabel },
  userName: 'Meena',
  country: 'Fiji'
});
assert('A Muhurtham order without a scan is rescanned from explicit locations (never delivered empty)',
  Array.isArray(rescanned.months) &&
  rescanned.months.length === 6 &&
  rescanned.months.some((m: any) => m.days.length > 0) &&
  rescanned.selectedMonth === scanWindowLabel);

let missingScanRejected = false;
try {
  normalizeScan({ name: 'Nobody', dob: '1990-01-01' });
} catch {
  missingScanRejected = true;
}
assert('A Muhurtham payload with no scan and no birth details is rejected loudly',
  missingScanRejected);

// 21. SECURITY REMEDIATION REGRESSIONS
console.log('\nTEST 21: Security remediation guards');
assert('Report languages normalize case/whitespace and reject arbitrary input',
  normalizeReportLanguage(' TA ') === 'ta' &&
  normalizeReportLanguage('hi') === 'hi' &&
  normalizeReportLanguage('ta"><script>alert(1)</script>' as any) === 'en' &&
  normalizeReportLanguage(null as any) === 'en');
const unsafeLanguageHtml = buildBabyNamingHtml(baby, 'ta" onload="alert(1)' as any);
assert('HTML report builders keep untrusted language out of the lang attribute',
  unsafeLanguageHtml.includes('<html lang="en">') && !unsafeLanguageHtml.includes('ta" onload='));
assert('Invoice language labels are selected from the normalized allowlist',
  invoiceLanguageLabel('hi') === 'Hindi' && invoiceLanguageLabel('<script>') === 'English');
assert('Family-order cap is exactly six reports with no capacity for a seventh',
  MAX_FAMILY_ORDER_ITEMS === 6 && hasFamilyOrderCapacity(5) &&
  !hasFamilyOrderCapacity(6) && !hasFamilyOrderCapacity(7));
const familyCartDrawerLimitsSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'cart', 'FamilyCartDrawer.tsx'), 'utf8');
assert('Family tray offers every service below the cap and removes add-another options at six',
  familyCartDrawerLimitsSrc.includes('hasFamilyOrderCapacity(items.length)') &&
  familyCartDrawerLimitsSrc.includes("handleAddAnother('birth-jathagam')") &&
  familyCartDrawerLimitsSrc.includes("handleAddAnother('marriage-compatibility')") &&
  familyCartDrawerLimitsSrc.includes("handleAddAnother('baby-naming')") &&
  familyCartDrawerLimitsSrc.includes("handleAddAnother('muhurtham')") &&
  familyCartDrawerLimitsSrc.includes('no seventh report can be added'));
assert('Family cart explains preview-quality reports, one consolidated invoice and split delivery',
  familyCartDrawerLimitsSrc.includes('preview-quality report') &&
  familyCartDrawerLimitsSrc.includes('one consolidated invoice') &&
  familyCartDrawerLimitsSrc.includes('labelled emails') &&
  familyCartDrawerLimitsSrc.includes('disabled={items.length > MAX_FAMILY_ORDER_ITEMS}'));
const familyTrayPageSources = [
  'BirthJathagamPage.tsx', 'MarriageCompatibilityPage.tsx', 'BabyNamingPage.tsx', 'MuhurthamPage.tsx'
].map(page => readFileSync(resolve(process.cwd(), 'src', 'pages', page), 'utf8'));
assert('All service forms block adding a seventh family report',
  familyTrayPageSources.every(page =>
    page.includes('hasFamilyOrderCapacity(cartItems.length)') &&
    page.includes('const addedItemId = addItem(') &&
    page.includes('Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports')));
const cartContextLimitSrc = readFileSync(resolve(process.cwd(), 'src', 'context', 'CartContext.tsx'), 'utf8');
assert('Cart context enforces the six-report cap on each attempted add',
  cartContextLimitSrc.includes('hasFamilyOrderCapacity(itemsRef.current.length)') &&
  cartContextLimitSrc.includes('string | null'));
const multiPersonCheckoutSrc = readFileSync(
  resolve(process.cwd(), 'src', 'components', 'cart', 'MultiPersonCheckout.tsx'),
  'utf8'
);
const multiPersonModelSrc = readFileSync(resolve(process.cwd(), 'src', 'services', 'multiPersonOrder.ts'), 'utf8');
const peopleValidationIndex = checkoutSrc.indexOf('const validation = validatePeople(people, language);');
const paymentReferenceGuardIndex = checkoutSrc.indexOf('if (requiresPayment && paymentMethod');
assert('Checkout validates every person card before submission or payment validation',
  peopleValidationIndex >= 0 && paymentReferenceGuardIndex > peopleValidationIndex &&
  checkoutSrc.includes('setCheckoutErrors(validation.errors)'));
assert('The person-card checkout enforces 1..6 people and 6x4 reports',
  multiPersonCheckoutSrc.includes('MULTI_PERSON_MAX_PEOPLE') &&
  multiPersonModelSrc.includes('export const MULTI_PERSON_MIN_PEOPLE = 1;') &&
  multiPersonModelSrc.includes('export const MULTI_PERSON_MAX_ITEMS = 24;'));
assert('Multi-person checkout sends the people array and never a client-computed total',
  checkoutSrc.includes('people: buildPeoplePayload(people)') &&
  checkoutSrc.includes('api.placeMultiPersonOrder({'));

const securityAuthSrc = readFileSync(resolve(process.cwd(), 'server', 'routes', 'auth.ts'), 'utf8');
const securityStoreSrc = readFileSync(resolve(process.cwd(), 'server', 'db', 'store.ts'), 'utf8');
const securityServicesSrc = readFileSync(resolve(process.cwd(), 'server', 'routes', 'services.ts'), 'utf8');
const securityEmailSrc = readFileSync(resolve(process.cwd(), 'server', 'services', 'emailService.ts'), 'utf8');
const securityPhpAuthSrc = readFileSync(resolve(process.cwd(), 'api', 'auth', 'index.php'), 'utf8');
const securityPhpServicesSrc = readFileSync(resolve(process.cwd(), 'api', 'services', 'index.php'), 'utf8');
const securityPhpAdminSrc = readFileSync(resolve(process.cwd(), 'api', 'admin', 'approve_order.php'), 'utf8');
const securityPhpLegacyAdminSrc = readFileSync(resolve(process.cwd(), 'api', 'admin', 'orders.php'), 'utf8');
const securityLivePreviewSrc = readFileSync(resolve(process.cwd(), 'src', 'components', 'common', 'LivePdfPreviewModal.tsx'), 'utf8');
const cpanelDeploySrc = readFileSync(resolve(process.cwd(), '.cpanel.yml'), 'utf8');
const zipBuilderSrc = readFileSync(resolve(process.cwd(), 'scripts', 'create_dist_zip.py'), 'utf8');
const signingKeyGuard = readFileSync(resolve(process.cwd(), 'api', 'astrology', 'tmp', '.htaccess'), 'utf8');
assert('Node registration creates local accounts only after a verified OTP',
  securityAuthSrc.includes("authRouter.post('/register/verify'") &&
  securityAuthSrc.includes("emailVerifiedAt: new Date().toISOString()") &&
  securityAuthSrc.includes("status: 'email_verification_required'") &&
  securityAuthSrc.includes("(user.authProvider || 'local') === 'local'"));
assert('Node verification and resend paths have IP/email throttles and bounded OTP attempts',
  securityAuthSrc.includes('verify:ip:${clientIp}') &&
  securityAuthSrc.includes('resend:ip:${clientIp}') &&
  securityAuthSrc.includes('MAX_EMAIL_OTP_ATTEMPTS'));
assert('Registration mailer validates a six-digit code with the correct digit regex',
  securityEmailSrc.includes(String.raw`replace(/\D/g`) &&
  securityEmailSrc.includes(String.raw`/^\d{6}$/`));
assert('Social login is bound to provider subjects and never links by email alone',
  securityStoreSrc.includes('findUserByProviderSubject(provider') &&
  securityAuthSrc.includes("findUserByProviderSubject('google', googleSubject)") &&
  securityAuthSrc.includes("findUserByProviderSubject('facebook', facebookSubject)") &&
  securityAuthSrc.includes('Automatic social account linking is disabled'));
assert('Node caps family orders at the route and persistence boundaries',
  securityServicesSrc.includes('items.length > MAX_FAMILY_ORDER_ITEMS') &&
  securityStoreSrc.includes('data.items.length > MAX_FAMILY_ORDER_ITEMS'));
assert('Node normalizes report language at order creation, updates and legacy load',
  securityStoreSrc.includes('language: normalizeReportLanguage(orderData.language)') &&
  securityStoreSrc.includes('normalizeReportLanguage(order.language)') &&
  securityStoreSrc.includes("safeUpdates.language = normalizeReportLanguage(safeUpdates.language)"));
assert('PHP registration verification and resend endpoints are rate-limited',
  securityPhpAuthSrc.includes("'otp-verify-email'") && securityPhpAuthSrc.includes("'otp-resend-email'"));
assert('PHP caps family orders and reserves Free Beta IP claims atomically',
  securityPhpServicesSrc.includes('count($items) > 6') &&
  securityPhpServicesSrc.includes('INSERT IGNORE INTO beta_ip_claims') &&
  readFileSync(resolve(process.cwd(), 'api', 'schema.sql'), 'utf8').includes('CREATE TABLE IF NOT EXISTS `beta_ip_claims`'));
assert('Both direct PHP approval handlers enforce the delivery limiter',
  securityPhpAdminSrc.includes("'admin-action-delivery'") &&
  securityPhpLegacyAdminSrc.includes("'admin-action-delivery'"));
assert('The report-preview iframe is sandboxed without enabling scripts',
  securityLivePreviewSrc.includes('sandbox="allow-same-origin"') &&
  !securityLivePreviewSrc.includes('sandbox="allow-scripts'));
assert('cPanel deployments omit bundles, source maps, and runtime signing keys while preserving live PHP config',
  cpanelDeploySrc.includes("! -name '*.cjs'") &&
  cpanelDeploySrc.includes("! -name '*.map'") &&
  cpanelDeploySrc.includes('app_secret_key.txt') &&
  cpanelDeploySrc.includes('if [ "$relative" = "config.php" ] && [ -f "$target" ]') &&
  cpanelDeploySrc.includes('/bin/chmod 640 $DEPLOYPATH/api/config.php') &&
  zipBuilderSrc.includes("basename.startswith('app_secret_key.txt')"));
assert('The PHP signing-key fallback directory denies all HTTP access',
  signingKeyGuard.includes('Require all denied') && signingKeyGuard.includes('Deny from all'));
assert('Production start explicitly enables production mode and the build omits Node source maps',
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8').includes('NODE_ENV=production node dist/server.cjs') &&
  !readFileSync(resolve(process.cwd(), 'package.json'), 'utf8').includes('--sourcemap'));

console.log('\n=====================================================');
if (failedTests === 0) {
  console.log('  ALL REGRESSION TESTS PASSED                       ');
} else {
  console.error('  FAILURES DETECTED: ' + failedTests + ' failed tests! ');
  process.exit(1);
}
console.log('=====================================================\n');
