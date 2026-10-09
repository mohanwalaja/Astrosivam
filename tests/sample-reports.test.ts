/**
 * SAMPLE REPORTS regression suite.
 *
 * Guarantees:
 *  1. Every sample is built from the ONE fixed birth: 01/01/2000, 2:00 AM,
 *     Chennai — with no user choice anywhere.
 *  2. Each sample payload is accepted by the same engines that produce the
 *     paid reports (Node copy of the astrology service).
 *  3. Every sample page carries a "SAMPLE" watermark, and applying it does not
 *     alter page count or the report document structure.
 *  4. Sample file names are service-specific and language-specific.
 */
import assert from 'node:assert/strict';
import {
  SAMPLE_BIRTH,
  SAMPLE_BRIDE,
  SAMPLE_BIRTH_LABEL,
  SAMPLE_SERVICE_TYPES,
  SAMPLE_WATERMARK_MARKUP,
  applySampleWatermark,
  buildSamplePayload,
  countSampleWatermarks,
  sampleDetailsLine,
  sampleMuhurthamMonth,
  sampleReportFileName,
  sampleReportTitle
} from '../src/services/sampleReports.js';
import { calculatePrecisionHoroscope } from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { generateWeddingMatchPdf } from '../server/astrology/pdfGenerator.js';
import { PoruthamStatus } from '../server/astrology/types.js';
import { calculateBabyNamingDetails } from '../server/astrology/babynames.js';
import { computeMuhurthamResultFromPayload } from '../server/astrology/muhurthamScan.js';
import { generateMuhurthamPdf, latin } from '../server/astrology/pdfGenerator.js';
import { inflateSync } from 'node:zlib';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder.js';
import { buildWeddingMatchHtml } from '../src/services/weddingHtmlBuilder.js';
import { buildBabyNamingHtml } from '../src/services/babyNamingHtmlBuilder.js';
import { buildMuhurthamHtml } from '../src/services/muhurthamHtmlBuilder.js';

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
}

function countPages(html: string): number {
  return (html.match(/<div\s+class="page(?:\s[^"]*)?"/g) || []).length;
}

function assertWatermarkPerPage(html: string, expectedPages: number, label: string): void {
  const pages = countPages(html);
  assert.equal(pages, expectedPages, `${label}: expected ${expectedPages} pages, found ${pages}`);
  assert.equal(
    countSampleWatermarks(html),
    pages,
    `${label}: every page must carry exactly one SAMPLE watermark`
  );
}

console.log('SAMPLE REPORTS TEST SUITE');
console.log('=========================');

/* ------------------------------------------------------------------ *
 * 1. The fixed sample details (no user choice)
 * ------------------------------------------------------------------ */
{
  assert.equal(SAMPLE_BIRTH.dob, '2000-01-01', 'Sample date of birth must be fixed to 01/01/2000');
  assert.equal(SAMPLE_BIRTH.tob, '02:00', 'Sample time of birth must be fixed to 2:00 AM');
  assert.equal(SAMPLE_BIRTH.timezoneOffsetHours, 5.5, 'Chennai sample must use IST (+5:30)');
  assert.equal(SAMPLE_BIRTH.timeZoneId, 'Asia/Kolkata', 'Chennai sample must use the Asia/Kolkata zone');
  assert.match(SAMPLE_BIRTH.birthPlace, /Chennai/i, 'Sample birth place must be Chennai');
  ok(Math.abs(SAMPLE_BIRTH.latitude - 13.0827) < 0.01, 'Chennai latitude must be the fixed sample latitude');
  ok(Math.abs(SAMPLE_BIRTH.longitude - 80.2707) < 0.01, 'Chennai longitude must be the fixed sample longitude');
  assert.equal(SAMPLE_BIRTH_LABEL, '01 Jan 2000, 2:00 AM, Chennai (India)');

  // The bride of the marriage sample is fixed too (never a user choice).
  assert.equal(SAMPLE_BRIDE.dob, '1998-06-15');
  assert.equal(SAMPLE_BRIDE.tob, '06:30');
  assert.match(SAMPLE_BRIDE.birthPlace, /Chennai/i);

  assert.deepEqual(
    [...SAMPLE_SERVICE_TYPES].sort(),
    ['BABY_NAMING', 'BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'MUHURTHAM'],
    'All four services must publish a sample'
  );
  console.log('✔ Fixed 01 Jan 2000, 2:00 AM, Chennai sample details (all four services)');
}

/* ------------------------------------------------------------------ *
 * 2. Payloads
 * ------------------------------------------------------------------ */
{
  const birth = buildSamplePayload('BIRTH_JATHAGAM');
  assert.equal(birth.dob, SAMPLE_BIRTH.dob);
  assert.equal(birth.tob, SAMPLE_BIRTH.tob);
  assert.equal(birth.birthPlace, SAMPLE_BIRTH.birthPlace);
  assert.equal(birth.timezoneOffsetHours, SAMPLE_BIRTH.timezoneOffsetHours);
  assert.ok(birth.name, 'Birth Jathagam sample needs a sample name');

  const baby = buildSamplePayload('BABY_NAMING');
  assert.equal(baby.dob, SAMPLE_BIRTH.dob);
  assert.ok(baby.babyName, 'Baby Naming sample needs a sample baby name');

  const wedding = buildSamplePayload('MARRIAGE_COMPATIBILITY');
  assert.equal(wedding.groom.dob, SAMPLE_BIRTH.dob, 'Groom uses the fixed sample date');
  assert.equal(wedding.bride.dob, SAMPLE_BRIDE.dob, 'Bride uses the second fixed sample date');
  assert.equal(wedding.groom.gender, 'M');
  assert.equal(wedding.bride.gender, 'F');
  assert.notEqual(wedding.bride.dob, wedding.groom.dob, 'The two sample people must differ');

  const muhurtham = buildSamplePayload('MUHURTHAM');
  assert.equal(muhurtham.dob, SAMPLE_BIRTH.dob);
  assert.equal(muhurtham.eventKey, 'wedding');
  assert.match(muhurtham.selectedMonth, /^\d{4}-(0[1-9]|1[0-2])$/);
  assert.equal(muhurtham.selectedMonth, sampleMuhurthamMonth(), 'Sample window is the automatic current+2 month');
  assert.equal(muhurtham.muhurthamScan.months.length, 6, 'Sample must carry the six-month panchangam scan');
  // A wedding sample carries BOTH fixed people: the groom's and the bride's own
  // Janma Nakshatra / Rasi drive the per-date Chandrashtama + Tara Bala checks.
  assert.equal(muhurtham.muhurthamScan.persons.length, 2, 'Wedding sample must carry both the groom and the bride charts');
  assert.deepEqual(
    muhurtham.muhurthamScan.persons.map((p: any) => p.role),
    ['groom', 'bride'],
    'Sample persons are the wedding couple, in report order'
  );
  assert.equal(muhurtham.bride.dob, SAMPLE_BRIDE.dob, 'Sample payload carries the bride with the second fixed birth');
  // PHP rejects a v5 scan unless this complete source-input stamp matches the
  // outer payload. The fixed public sample must be valid on cPanel/PHP as well
  // as the Node calculator, rather than looking temporarily unavailable.
  assert.deepEqual(muhurtham.muhurthamScan.inputContext, {
    dob: muhurtham.dob,
    tob: muhurtham.tob,
    birthPlace: muhurtham.birthPlace,
    country: muhurtham.country,
    latitude: muhurtham.latitude,
    longitude: muhurtham.longitude,
    timezoneOffsetHours: muhurtham.timezoneOffsetHours,
    timeZoneId: muhurtham.timeZoneId,
    muhurthamPlace: muhurtham.muhurthamPlace,
    muhurthamCountry: muhurtham.muhurthamCountry,
    muhurthamLatitude: muhurtham.muhurthamLatitude,
    muhurthamLongitude: muhurtham.muhurthamLongitude,
    muhurthamTimezoneOffsetHours: muhurtham.muhurthamTimezoneOffsetHours,
    muhurthamTimeZoneId: muhurtham.muhurthamTimeZoneId,
    // Second person (bride) — part of the stamp, so a change to either chart
    // invalidates the cached scan in both engines.
    brideName: muhurtham.bride.name,
    brideDob: muhurtham.bride.dob,
    brideTob: muhurtham.bride.tob,
    brideBirthPlace: muhurtham.bride.birthPlace,
    brideCountry: muhurtham.bride.country,
    brideLatitude: muhurtham.bride.latitude,
    brideLongitude: muhurtham.bride.longitude,
    brideTimezoneOffsetHours: muhurtham.bride.timezoneOffsetHours,
    brideTimeZoneId: muhurtham.bride.timeZoneId,
    eventKey: muhurtham.eventKey,
    selectedMonth: muhurtham.selectedMonth
  }, 'Muhurtham sample scan must be stamped with its complete verified input context');
  ok(
    muhurtham.muhurthamScan.months.every((m: any) => Array.isArray(m.days)),
    'Every sample month must contain day rows'
  );
  console.log('✔ Sample payloads are fixed and complete for all four services');
}

/* ------------------------------------------------------------------ *
 * 3. Real engines accept the samples and every page is watermarked
 * ------------------------------------------------------------------ */
{
  // Birth Jathagam
  const birthPayload = buildSamplePayload('BIRTH_JATHAGAM');
  const horoscope = calculatePrecisionHoroscope(
    birthPayload.name,
    birthPayload.dob,
    birthPayload.tob,
    birthPayload.birthPlace,
    birthPayload.latitude,
    birthPayload.longitude,
    birthPayload.timezoneOffsetHours,
    birthPayload.country,
    birthPayload.gender
  );
  const jathagamHtml = applySampleWatermark(buildJathagamHtml(horoscope, 'en'));
  assertWatermarkPerPage(jathagamHtml, 3, 'Birth Jathagam sample');
  ok(jathagamHtml.startsWith('<!DOCTYPE html>'), 'Sample document must keep its doctype');
  ok(jathagamHtml.trimEnd().endsWith('</html>'), 'Sample document must stay complete');
  ok(jathagamHtml.includes('Chennai'), 'Birth Jathagam sample must show the fixed Chennai birth place');
  ok(jathagamHtml.includes(SAMPLE_WATERMARK_MARKUP), 'Watermark markup must be present');
  assert.equal(
    applySampleWatermark(jathagamHtml),
    jathagamHtml,
    'Applying the watermark twice must be idempotent'
  );

  // Marriage Compatibility
  const wedding = buildSamplePayload('MARRIAGE_COMPATIBILITY');
  const match = calculateWeddingCompatibility(wedding.bride, wedding.groom);
  const weddingHtml = applySampleWatermark(buildWeddingMatchHtml(match, 'en'));
  const weddingTamilHtml = applySampleWatermark(buildWeddingMatchHtml(match, 'ta'));
  assertWatermarkPerPage(weddingHtml, 2, 'Marriage sample');
  assertWatermarkPerPage(weddingTamilHtml, 2, 'Tamil Marriage sample');
  ok(
    weddingHtml.includes(wedding.bride.name) && weddingHtml.includes(wedding.groom.name),
    'Marriage sample must show both fixed sample people'
  );
  assert.equal(match.verdictStatus, PoruthamStatus.MADHYAMAM, 'The fixed marriage sample must retain its Madhyamam rating');
  const sampleYoni = match.poruthams.find(row => row.id === 'yoni');
  assert.equal(sampleYoni?.yoniBrideAnimalEn, 'Lion');
  assert.equal(sampleYoni?.yoniGroomAnimalEn, 'Buffalo');
  assert.equal(sampleYoni?.yoniRelationship, 'neutral');
  assert.ok(weddingHtml.includes('Bride: Lion; Groom: Buffalo. Yoni relationship: neutral.'),
    'The sample Yoni explanation must identify both computed animals and their neutral relationship');
  assert.ok(match.sevvayDosham.groomMarsHouses?.lagna === 5 && !match.sevvayDosham.isGroomHasDosham &&
    match.sevvayDosham.groomDoshamSeverityTa === 'தோஷம் இல்லை',
    'The groom fifth-house Mars placement must be reported as no active Kuja Dosha');
  assert.ok(match.sevvayDosham.brideAfflictedFrom?.includes('venus') && match.sevvayDosham.brideMarsHouses?.venus === 2,
    'The bride Kuja assessment must identify its computed Venus-based second-house reference');
  assert.ok(weddingTamilHtml.includes('லக்னத்திலிருந்து 5-ஆம் இடம்') &&
    weddingTamilHtml.includes('சுக்கிரனிலிருந்து 4-ஆம் இடம்') &&
    weddingTamilHtml.includes('(தோஷம் இல்லை)'),
    'Tamil report must show the groom fifth-house placement, Venus count and no-active-dosha summary');
  assert.ok(weddingTamilHtml.includes('சுக்கிரனிலிருந்து 2-ஆம் இடம்'),
    'Tamil report must show the bride computed Venus reference explicitly');
  const weddingPdfText = generateWeddingMatchPdf(match).toString('latin1');
  assert.ok(weddingPdfText.includes('Lagna 5; Venus 4 \\(No Dosha\\)') &&
    weddingPdfText.includes('Lagna 12; Venus 2 \\(Mild\\)') &&
    weddingPdfText.includes('MADHYAMAM \\(WITH REMEDIES\\)'),
    'Direct PDF must show the same computed Kuja references and remedies-tier badge');
  assert.ok(weddingTamilHtml.includes('மத்திமம் (பரிகாரங்களுடன்)') &&
    weddingTamilHtml.split('ஏற்றுக்கொள்ளத்தக்க பொருத்தம்; பரிகாரங்களுடன் பொருந்தும்').length - 1 >= 2 &&
    !weddingTamilHtml.includes('இந்தப் பொருத்தம் நல்லது'),
    'Badge, summary and final box must keep Madhyamam in the remedies-acceptable tier');
  const failedRows = match.poruthams.filter(row => Number(row.pointsEarned ?? row.points) === 0);
  assert.ok(failedRows.length > 0, 'The sample must contain failed Porutham rows');
  for (const row of failedRows) {
    assert.ok(weddingHtml.includes(`0 / ${Number(row.maxPoints)}`),
      `The failed ${row.id} row must render its explicit zero score`);
  }
  assert.match(weddingTamilHtml, /\.disclaimer-para\s*\{[^}]*text-align:\s*left;/s,
    'Page-2 disclaimer paragraphs must be left-aligned');
  const expectedIssuedAt = new Date(match.generatedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: match.generatedAtTimeZoneId, timeZoneName: 'short'
  });
  assert.ok(match.generatedAtTimeZoneId && weddingHtml.includes(expectedIssuedAt),
    'The issue timestamp must include the generated time in the recorded timezone');

  // Baby Naming
  const baby = buildSamplePayload('BABY_NAMING');
  const naming = calculateBabyNamingDetails(
    baby.babyName,
    baby.dob,
    baby.tob,
    baby.birthPlace,
    baby.gender,
    baby.latitude,
    baby.longitude,
    baby.timezoneOffsetHours,
    baby.country
  );
  const babyHtml = applySampleWatermark(buildBabyNamingHtml(naming, 'en'));
  assertWatermarkPerPage(babyHtml, 2, 'Baby Naming sample');
  ok(babyHtml.includes(baby.babyName), 'Baby Naming sample must show the sample baby name');
  assert.match(babyHtml, /not a certified birth-pada name match/i, 'Printing the supplied name must not certify its syllable');
  assert.match(babyHtml, /data-related-sound="true"/, 'Related-sound alternatives must be marked individually');
  assert.match(babyHtml, /† Marked names use related alternative sounds/, 'Explain that marked names are not exact pada matches');

  // Subha Muhurtham (server normalises the client scan exactly like an order)
  const muhurthamPayload = buildSamplePayload('MUHURTHAM');
  const muhurthamResult = computeMuhurthamResultFromPayload({ inputPayload: muhurthamPayload });
  assert.equal(muhurthamResult.months.length, 6, 'Muhurtham sample must normalise to six months');
  assert.equal(muhurthamResult.dob, SAMPLE_BIRTH.dob);
  const muhurthamHtml = applySampleWatermark(buildMuhurthamHtml(muhurthamResult, 'en'));
  ok(countPages(muhurthamHtml) >= 2, 'Muhurtham sample must contain multiple pages');
  assertWatermarkPerPage(muhurthamHtml, countPages(muhurthamHtml), 'Muhurtham sample');

  // Exercise all 12 service/language combinations; a working English template
  // does not establish that Tamil, Hindi, or Muhurtham templates can render.
  for (const lang of ['ta', 'hi'] as const) {
    for (const [name, build] of [
      ['Birth Jathagam', () => buildJathagamHtml(horoscope, lang)],
      ['Marriage Matching', () => buildWeddingMatchHtml(match, lang)],
      ['Baby Naming', () => buildBabyNamingHtml(naming, lang)],
      ['Subha Muhurtham', () => buildMuhurthamHtml(muhurthamResult, lang)]
    ] as const) {
      const html = applySampleWatermark(build());
      assert.match(html, new RegExp(`<html lang="${lang}"`), `${name} must declare its report language`);
      assertWatermarkPerPage(html, countPages(html), `${lang} ${name} sample`);
      ok(countPages(html) >= 2, `${lang} ${name} must contain report pages`);
      if (name === 'Baby Naming') {
        assert.match(html, lang === 'ta' ? /பொருந்துவதாகச் சான்றளிக்கப்படவில்லை/ : /मेल प्रमाणित नहीं है/,
          `${lang} supplied name must not be certified as a pada match`);
      }
    }
  }
  console.log('✔ All 12 sample report/language combinations render with one watermark per page');
}

/* ------------------------------------------------------------------ *
 * 3b. The Node jsPDF Muhurtham renderer (direct downloads)
 * ------------------------------------------------------------------ */
{
  // The direct-download PDF is built by server/astrology/pdfGenerator.ts, which
  // only has Helvetica: it must still carry both charts, the real covered date
  // range, the per-date Chandrashtama / Tara Bala notes and the authorisation
  // block, in every language and for a one-person order.
  const muhurthamPayload = buildSamplePayload('MUHURTHAM');
  const muhurthamResult: any = computeMuhurthamResultFromPayload({ inputPayload: muhurthamPayload });
  muhurthamResult.generatedAt = new Date('2026-10-07T01:41:00Z');
  muhurthamResult.muhurthamTimezoneOffsetHours = 5.5;

  const pdfStrings = (buffer: Buffer): string => {
    const raw = buffer.toString('latin1');
    let text = raw;
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let stream: RegExpExecArray | null;
    while ((stream = streamRe.exec(raw))) {
      try { text += `\n${inflateSync(Buffer.from(stream[1], 'latin1')).toString('latin1')}`; } catch { /* not flate */ }
    }
    const strings: string[] = [];
    const stringRe = /\((?:\\.|[^\\()])*\)/g;
    let literal: RegExpExecArray | null;
    while ((literal = stringRe.exec(text))) strings.push(literal[0].slice(1, -1).replace(/\\([()\\])/g, '$1'));
    // jsPDF writes WinAnsi; recover the glyphs a latin1 decode loses.
    return strings.join('\n').replace(/\x96/g, '\u2013').replace(/\x91|\x92/g, "'").replace(/\x93|\x94/g, '"');
  };

  const copySignatoryDesk: Record<string, string> = {
    en: 'ASTRO SIVAM Vedic Research Desk',
    ta: 'ASTRO SIVAM வேத ஆய்வு மேசை',
    hi: 'ASTRO SIVAM वैदिक अनुसंधान डेस्क'
  };
  const windowRange = muhurthamResult.windowLabelEn;
  assert.match(windowRange, /^\d{2} \w{3} \d{4} \u2013 \d{2} \w{3} \d{4}$/,
    'The Muhurtham window label is the real covered date range');
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const buffer = generateMuhurthamPdf(muhurthamResult, lang);
    const pages = (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const text = pdfStrings(buffer);
    assert.equal(pages, 2, `${lang} Muhurtham direct-download PDF stays two pages`);
    for (const person of muhurthamResult.persons as any[]) {
      assert.ok(text.includes(person.name), `${lang} PDF names ${person.role} ${person.name}`);
      assert.ok(text.includes(person.nakshatraNameEn), `${lang} PDF shows ${person.role} nakshatra`);
      assert.ok(text.includes(person.rasiNameEn), `${lang} PDF shows ${person.role} rasi`);
    }
    assert.ok(text.includes(windowRange), `${lang} PDF prints the real window range`);
    assert.ok(!text.includes('2 prior months'), `${lang} PDF never prints the rule wording window line`);
    assert.ok(text.includes('ASTRO-MUH-20261007'), `${lang} PDF carries the reference number`);
    assert.ok(text.includes('07 Oct 2026, 07:11 GMT+5:30'), `${lang} PDF prints issued-on with its timezone`);
    // The jsPDF renderer only has Helvetica, so Indic copy is romanised through
    // the same `latin()` helper the renderer uses.
    const certifiedCopy: Record<string, string> = {
      en: 'Certified by ASTRO SIVAM',
      ta: 'சான்றளித்தவர்: ASTRO SIVAM',
      hi: 'प्रमाणित: ASTRO SIVAM'
    };
    assert.ok(text.includes(latin(certifiedCopy[lang])), `${lang} PDF keeps its certification`);
    assert.ok(text.includes(latin(copySignatoryDesk[lang])), `${lang} PDF keeps the authorisation signatory desk`);
    // Per-date personal notes travel with every recommended date.
    const recommended = (muhurthamResult.months as any[]).flatMap(month => month.days as any[])
      .filter(day => ['BEST', 'GOOD'].includes(String(day.grade)));
    for (const day of recommended) {
      assert.ok(day.personalNoteEn && text.includes(day.personalNoteEn),
        `${lang} PDF prints the Chandrashtama / Tara Bala note for ${day.date}`);
    }
  }

  const singlePersonBuffer = generateMuhurthamPdf({ ...muhurthamResult, persons: [muhurthamResult.persons[1]] }, 'en');
  const singlePersonText = pdfStrings(singlePersonBuffer);
  assert.ok(singlePersonText.includes('Only one person'),
    'A one-person direct-download PDF says only one chart was checked');
  assert.ok(!singlePersonText.includes('Priya Devi & Karthik Raman'),
    'A one-person PDF never claims the couple was checked');
  console.log('✔ The Node direct-download Muhurtham PDF carries both charts, the real range and the per-date notes');
}

/* ------------------------------------------------------------------ *
 * 4. Labels and file names
 * ------------------------------------------------------------------ */
{
  assert.match(sampleReportTitle('BIRTH_JATHAGAM'), /Sample Report/);
  assert.match(sampleDetailsLine('MARRIAGE_COMPATIBILITY'), /Groom 01 Jan 2000/);
  assert.match(sampleDetailsLine('MARRIAGE_COMPATIBILITY'), /Bride 15 Jun 1998/);
  assert.match(sampleDetailsLine('MUHURTHAM'), /01 Jan 2000/);
  assert.match(sampleReportTitle('BIRTH_JATHAGAM', 'ta'), /மாதிரி அறிக்கை/);
  assert.match(sampleReportTitle('MARRIAGE_COMPATIBILITY', 'hi'), /नमूना रिपोर्ट/);
  assert.match(sampleDetailsLine('MARRIAGE_COMPATIBILITY', 'ta'), /மணமகன்.*மணமகள்/);
  assert.match(sampleDetailsLine('MUHURTHAM', 'hi'), /विवाह समारोह/);

  assert.equal(sampleReportFileName('BIRTH_JATHAGAM', 'en'), 'ASTRO_SIVAM_Sample_Birth_Jathagam_EN.pdf');
  assert.equal(sampleReportFileName('MARRIAGE_COMPATIBILITY', 'ta'), 'ASTRO_SIVAM_Sample_Marriage_Matching_TA.pdf');
  assert.equal(sampleReportFileName('BABY_NAMING', 'hi'), 'ASTRO_SIVAM_Sample_Baby_Naming_HI.pdf');
  assert.equal(sampleReportFileName('MUHURTHAM', 'en'), 'ASTRO_SIVAM_Sample_Subha_Muhurtham_EN.pdf');
  console.log('✔ Sample titles, notes and PDF file names');
}

console.log('\nALL SAMPLE REPORT TESTS PASSED');
