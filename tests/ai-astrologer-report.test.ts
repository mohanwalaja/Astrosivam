/**
 * ASTRO SIVAM AI Astrologer — Part 3: uploaded report handling.
 *
 * The critical property under test is that an uploaded PDF cannot be discussed
 * until it is proved to be an ASTRO SIVAM report belonging to a PAID order of
 * the logged-in customer. Every branch of that gate is driven here, including
 * the ones an attacker would try: a renamed file, a valid order number on a
 * foreign document, and an order that exists but was never paid.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setReportSections,
  normaliseExtracted,
  extractOrderNumbers,
  orderNumberFromFilename,
  hasAstroSivamBranding,
  identifyReportType,
  decideAcceptance,
  rejectionText,
  matchSection,
  explainSection,
  explainQuotedLine,
  listSections,
  type AcceptanceInput,
} from '../src/services/aiReportSections';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = (p: string) => path.join(projectRoot, 'knowledge/ai-astrologer', p);
const kb = JSON.parse(fs.readFileSync(KB('rules/report-sections.json'), 'utf8'));
setReportSections(kb);

const registry = JSON.parse(fs.readFileSync(KB('sources.json'), 'utf8'));
const knownIds = new Set<string>([
  ...registry.sources.map((s: any) => s.id),
  ...registry.excludedSources.map((s: any) => s.id),
]);
const excludedIds = new Set<string>(registry.excludedSources.map((s: any) => s.id));

const MAX = 8 * 1024 * 1024;

/* Realistic fixtures: what pdfparser would hand back, header included. */
const JATHAGAM_TEXT = `ASTRO SIVAM  Astrological Life Guidance  #ORD-2026-0417  1/3
Certified Vedic Horoscope & Ephemeris
User Particulars  Name  Priya Devi  Date of Birth  14-03-1994  Time of Birth  06:42
Place of Birth  Chennai  Ayanamsa  Lahiri
Navagraha Positions  Surya  Meena  29d 12m  house 2  exalted
Janma Rasi  Kanya   Janma Nakshatra  Hasta   nakshatra lord Chandra
Dosha Analysis  Kuja Dosha present   No Kala Sarpa Dosha
2/3  #ORD-2026-0417  Astrological Life Predictions
Health & Vitality   Wealth & Finance   Education & Intellect   Career & Profession
Marriage & Relations   Property & Real Estate   Travel & Global Fortune   Current Guidance
3/3  #ORD-2026-0417  Parikaram / Remedies
Why the Navagrahas Bring Difficulties   Ways to Face Planetary Doshas`;

const WEDDING_TEXT = `ASTRO SIVAM Vedic Research Desk  #ORD-2026-0552  1/2
Bride Profile  Anita  Groom Profile  Ravi
Porutham (Kuta)  Dina 1  Gana 1  Mahendra 1  Stree Deergha 1  Total 28/36
Dosha Balance  BALANCED   FINAL RECOMMENDATION  Auspicious Match`;

const BABY_TEXT = `ASTRO SIVAM Vedic Research Desk  #ORD-2026-0601  1/1
JANMA PADA  Nakshatra Rohini  Pada 2   CALCULATION VERIFIED
Baby Name suggestions   Deva Gana   Janma Nakshatra lord Chandra`;

const MUHURTHAM_TEXT = `ASTRO-MUH  ASTRO SIVAM Vedic Research Desk  #ORD-2026-0688  1/2
CALCULATION WINDOW  01-01-2027 to 31-03-2027
BRIDE & GROOM PARTICULARS   DATE OF BIRTH   FULL NAME
2/2  DATE & DAY  14-02-2027 Sunday   Chandrashtama  not present`;

const FOREIGN_PDF = `INVOICE 2026-8842  Acme Plumbing Supplies  Total due 480.00
Payment terms 30 days  Thank you for your business`;

const SOMEONE_ELSES = `ASTRO SIVAM  Astrological Life Guidance  #ORD-2026-9999  1/3
Certified Vedic Horoscope & Ephemeris  Janma Rasi  Mesha  Dosha Analysis
Health & Vitality  Wealth & Finance  Current Guidance  Parikaram / Remedies`;

function input(overrides: Partial<AcceptanceInput> = {}): AcceptanceInput {
  return {
    extractedText: JATHAGAM_TEXT,
    filename: 'ASTRO_SIVAM_Report_ORD-2026-0417.pdf',
    customerOrderNumbers: ['ORD-2026-0417'],
    paidOrderNumbers: ['ORD-2026-0417'],
    sizeBytes: 240_000,
    maxBytes: MAX,
    ...overrides,
  };
}

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    throw err;
  }
}

/* ------------------------------------------------------------------ */

check('all four report types the brief names are covered', () => {
  assert.deepStrictEqual(
    kb.reportTypes.map((t: any) => t.id),
    ['BIRTH_JATHAGAM', 'WEDDING_MATCHING', 'BABY_NAMING', 'MUHURTHAM']
  );
  for (const t of kb.reportTypes) {
    assert.ok(t.sections.length >= 3, `${t.id} has only ${t.sections.length} sections`);
    assert.ok(t.fingerprints.length >= 3, `${t.id} has too few fingerprints`);
    assert.ok(t.pages >= 1, `${t.id} has no page count`);
  }
});

check('every section explains itself in all three languages', () => {
  for (const t of kb.reportTypes) {
    for (const s of t.sections) {
      for (const lang of ['en', 'ta', 'hi']) {
        assert.ok(s.title[lang]?.length > 2, `${t.id}/${s.id} missing ${lang} title`);
        assert.ok(s.means[lang]?.length > 40, `${t.id}/${s.id} missing ${lang} explanation`);
      }
      assert.ok(typeof s.page === 'number' && s.page >= 1 && s.page <= t.pages, `${t.id}/${s.id} page out of range`);
      assert.ok(s.chartLink && s.chartLink.length > 15, `${t.id}/${s.id} does not link back to chart positions`);
    }
  }
});

check('the sections the brief lists are all present for the Jathagam', () => {
  const ids = kb.reportTypes[0].sections.map((s: any) => s.id);
  for (const required of ['user-particulars', 'planetary-positions', 'life-cards', 'remedies', 'navagraha-page']) {
    assert.ok(ids.includes(required), `Jathagam is missing the "${required}" section`);
  }
});

check('no section cites an excluded or unknown source', () => {
  let n = 0;
  for (const t of kb.reportTypes) {
    for (const s of t.sections) {
      for (const src of s.source ?? []) {
        n += 1;
        assert.ok(knownIds.has(src.id), `${t.id}/${s.id} cites unknown ${src.id}`);
        assert.ok(!excludedIds.has(src.id), `${t.id}/${s.id} cites EXCLUDED ${src.id}`);
      }
    }
  }
  assert.ok(n > 0, 'no section carries any source at all');
});

check('normalisation repairs the damage PDF extraction does', () => {
  assert.equal(normaliseExtracted('Navagraha\u00A0Positions\u2003 here'), 'Navagraha Positions here');
  assert.equal(normaliseExtracted('ASTRO\u2010SIVAM\u2011Report'), 'ASTRO-SIVAM-Report');
  assert.equal(normaliseExtracted('a\r\n\t  b   c'), 'a b c');
});

check('the order number is read out of the page header on every page', () => {
  assert.deepEqual(extractOrderNumbers(JATHAGAM_TEXT), ['ORD-2026-0417']);
  assert.deepEqual(extractOrderNumbers('no reference here at all'), []);
  assert.deepEqual(extractOrderNumbers('#ORD-2026-1 and again ORD-2026-1'), ['ORD-2026-1']);
  assert.equal(orderNumberFromFilename('ASTRO_SIVAM_Report_ORD-2026-0417.pdf'), 'ORD-2026-0417');
  assert.equal(orderNumberFromFilename('ASTRO_SIVAM_Invoice_ORD-2026-0417.pdf'), 'ORD-2026-0417');
  assert.equal(orderNumberFromFilename('my scan.pdf'), null);
});

check('branding is detected, and is treated as necessary but not sufficient', () => {
  assert.equal(hasAstroSivamBranding(JATHAGAM_TEXT), true);
  assert.equal(hasAstroSivamBranding(MUHURTHAM_TEXT), true, 'the ASTRO-MUH prefix must count');
  assert.equal(hasAstroSivamBranding(FOREIGN_PDF), false);
});

check('each fixture is identified as the right report type', () => {
  assert.equal(identifyReportType(JATHAGAM_TEXT)?.type.id, 'BIRTH_JATHAGAM');
  assert.equal(identifyReportType(WEDDING_TEXT)?.type.id, 'WEDDING_MATCHING');
  assert.equal(identifyReportType(BABY_TEXT)?.type.id, 'BABY_NAMING');
  assert.equal(identifyReportType(MUHURTHAM_TEXT)?.type.id, 'MUHURTHAM');
  assert.equal(identifyReportType(FOREIGN_PDF), null, 'a plumbing invoice must not be identified');
});

check('one stray fingerprint is not enough to identify a report', () => {
  // "Janma Nakshatra" appears in both the Jathagam and Baby Naming reports, so a
  // document containing only that phrase must not be mistaken for either.
  assert.equal(identifyReportType('Some essay mentioning Janma Nakshatra in passing.'), null);
});

check('ACCEPT: a paid order of this customer is opened', () => {
  const r = decideAcceptance(input());
  assert.equal(r.accepted, true, r.reason);
  assert.equal(r.rejection, null);
  assert.equal(r.orderNumber, 'ORD-2026-0417');
  assert.equal(r.type?.id, 'BIRTH_JATHAGAM');
});

check('REFUSE: a document that is not an ASTRO SIVAM report', () => {
  const r = decideAcceptance(input({ extractedText: FOREIGN_PDF, filename: 'invoice-2026-8842.pdf' }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection, 'notAstroSivam');
  assert.match(rejectionText('notAstroSivam', 'en'), /only read reports that ASTRO SIVAM prepared/);
});

check('REFUSE: another customer\u2019s genuine report', () => {
  const r = decideAcceptance(input({ extractedText: SOMEONE_ELSES, filename: 'ASTRO_SIVAM_Report_ORD-2026-9999.pdf' }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection, 'notYours');
  assert.equal(r.orderNumber, 'ORD-2026-9999');
});

check('REFUSE: the customer\u2019s own order that was never paid', () => {
  const r = decideAcceptance(input({ paidOrderNumbers: [] }));
  assert.equal(r.accepted, false, 'an unpaid order must never be explained');
  assert.equal(r.rejection, 'notYours');
  assert.match(r.reason, /not PAID/);
});

check('REFUSE: a filename alone never grants access', () => {
  // A customer can rename any file. The header is the only authoritative signal.
  const r = decideAcceptance(input({ extractedText: FOREIGN_PDF, filename: 'ASTRO_SIVAM_Report_ORD-2026-0417.pdf' }));
  assert.equal(r.accepted, false, 'a spoofed filename must not open the report');
  assert.equal(r.rejection, 'notAstroSivam');
});

check('REFUSE: a scan or photo yields too little text', () => {
  const r = decideAcceptance(input({ extractedText: '', filename: 'photo.jpg' }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection, 'unreadable');
});

check('REFUSE: an oversized upload is stopped before parsing', () => {
  const r = decideAcceptance(input({ sizeBytes: 40_000_000 }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection, 'tooLarge');
});

check('a branded document with no readable order number is unreadable, not foreign', () => {
  const branded = 'ASTRO SIVAM  Certified Vedic Horoscope & Ephemeris  Janma Rasi  Mesha  Dosha Analysis  Current Guidance';
  const r = decideAcceptance(input({ extractedText: branded, filename: 'scan.pdf' }));
  assert.equal(r.accepted, false);
  assert.equal(r.rejection, 'unreadable');
});

check('a renamed file is still accepted, and the disagreement is logged', () => {
  const r = decideAcceptance(input({ filename: 'renamed-copy.pdf' }));
  assert.equal(r.accepted, true, r.reason);
  const r2 = decideAcceptance(input({ filename: 'ASTRO_SIVAM_Report_ORD-2026-0001.pdf' }));
  assert.equal(r2.accepted, true);
  assert.match(r2.reason, /filename said ORD-2026-0001/, 'a filename/header disagreement must be logged');
});

check('every rejection kind has text in all three languages', () => {
  for (const kind of ['notAstroSivam', 'notYours', 'unreadable', 'tooLarge']) {
    for (const lang of ['en', 'ta', 'hi'] as const) {
      const t = rejectionText(kind as any, lang);
      assert.ok(t.length > 40, `${kind}/${lang} rejection text is missing`);
    }
  }
  // the refusal must never reveal which order numbers are valid
  for (const kind of ['notYours', 'unreadable'] as const) {
    assert.ok(!/ORD-/.test(rejectionText(kind, 'en')), `${kind} leaks an order number`);
  }
});

check('a quoted line is traced back to its section', () => {
  const type = kb.reportTypes[0];
  assert.equal(matchSection('Dosha Analysis', type)?.section.id, 'dosha-analysis');
  assert.equal(matchSection('Parikaram / Remedies', type)?.section.id, 'remedies');
  assert.equal(matchSection('தோஷ பகுப்பாய்வு', type)?.section.id, 'dosha-analysis', 'a Tamil quote must match');
  assert.equal(matchSection('दोष विश्लेषण', type)?.section.id, 'dosha-analysis', 'a Hindi quote must match');
  assert.equal(matchSection('User Particulars  Name  Priya Devi', type)?.section.id, 'user-particulars');
  assert.equal(matchSection('zzz nothing like this exists', type), null);
});

check('explaining a section states it in the customer\u2019s language and links it to their chart', () => {
  const type = kb.reportTypes[0];
  const section = type.sections.find((s: any) => s.id === 'rasi-nakshatra')!;
  const ta = explainSection(section, 'ta', { moonSign: 'Kanya', nakshatra: 'Hasta' });
  assert.match(ta.body, /ஜன்ம ராசி/);
  assert.match(ta.body, /உங்கள் ஜாதகத்தில்:/);
  assert.ok(!/[\u0900-\u097F]/.test(ta.body), 'a Tamil explanation must not contain Devanagari');
  const en = explainSection(section, 'en', {});
  assert.match(en.body, /In your chart:/);
  assert.equal(en.sourceLine, 'Source: TA-06 · TA-25');
});

check('explainQuotedLine returns null rather than guessing', () => {
  const type = kb.reportTypes[0];
  assert.equal(explainQuotedLine('totally unrelated sentence here', type, 'en'), null);
  const hit = explainQuotedLine('Dosha Analysis', type, 'en');
  assert.ok(hit);
  assert.equal(hit!.guardrail, 'Never present a dosha as a verdict. Never attach a frightening outcome to it.');
});

check('the health section carries the medical-safety guardrail', () => {
  const type = kb.reportTypes[0];
  const health = type.sections.find((s: any) => s.id === 'life-cards')!;
  assert.match(health.guardrail, /medical-safety rules/);
  assert.match(health.means.en, /1st for health/);
});

check('every report type can be walked through section by section', () => {
  for (const t of kb.reportTypes) {
    for (const lang of ['en', 'ta', 'hi'] as const) {
      const list = listSections(t, lang);
      assert.equal(list.length, t.sections.length, `${t.id} ${lang} walkthrough is incomplete`);
      assert.ok(list.every((s) => s.title.length > 2 && s.page >= 1));
    }
  }
});

check('the ownership contract is stated and the design does not depend on Indic extraction', () => {
  assert.ok(kb.ownership.mustAllHold.length >= 4);
  const policy = kb.ownership.extractionPolicy;
  assert.match(policy.whyNotTrustIndicText, /subset fonts/);
  assert.match(policy.consequence, /OWNERSHIP TOKEN/);
  assert.match(policy.consequence, /rebuildReportResultFromSavedInputs/);
  assert.match(policy.fallbackIfExtractionFails, /dashboard/);
  const header = kb.ownership.signals.find((s: any) => s.id === 'order-number-in-header');
  assert.equal(header.strength, 'authoritative');
  const filename = kb.ownership.signals.find((s: any) => s.id === 'filename');
  assert.equal(filename.strength, 'supporting');
});

check('the quoted-line contract forbids guessing and forbids correcting the report', () => {
  const steps = kb.quotedLine.steps.join(' ');
  assert.match(steps, /do not guess/);
  assert.match(steps, /page number/);
  const style = kb.quotedLine.styleRules.join(' ');
  assert.match(style, /Never correct the report/);
  assert.match(style, /THEIR chart/);
});

console.log(`\n[OK] ai-astrologer report handling: ${passed} checks passed`);
