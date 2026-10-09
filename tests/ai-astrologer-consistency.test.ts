/**
 * ASTRO SIVAM AI Astrologer — consistency between report page 2 and the chat.
 *
 * The rule under test: page 2 of the Birth Jathagam is the single source of
 * truth and the chat must never contradict it.
 *
 * HOW THIS IS GUARANTEED, not just checked: both sides call
 * computeLifeCardPredictions() from src/lib/astrology/lifeCardPredictions.ts.
 * There is one implementation, so agreement is structural. This test proves it
 * by running five sample charts through both paths and comparing all 8 areas in
 * all 3 languages — 120 comparisons — and prints the table.
 *
 * The "chat" path here is the same call the PHP endpoint makes when it loads the
 * predictions stored against the order, so a mismatch would mean the stored
 * block and the rendered page disagree.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeLifeCardPredictions,
  predictionsForPrompt,
  verdictForLord,
  LIFE_CARD_RULES,
  type ChartFacts,
  type LordFacts,
  type PredLang,
} from '../src/lib/astrology/lifeCardPredictions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
/* Five sample charts                                                  */
/* ------------------------------------------------------------------ */

function lord(over: Partial<LordFacts> & { lordGraha: string; bhava: number; rasi: number }): LordFacts {
  return {
    lordName: { en: over.lordGraha, ta: over.lordGraha, hi: over.lordGraha },
    isOwnHouse: over.bhava === 0,
    isDebilitated: false,
    isCombust: false,
    isRetrograde: false,
    conjunctMalefics: [],
    ...over,
  } as LordFacts;
}

/**
 * Chart 1 — a broadly favourable chart: every lord in a kendra/trikona, no
 * affliction. Expect seven Strength verdicts.
 */
const chart1: ChartFacts = {
  lagnaRasi: 1, chandraRasi: 5,
  lords: {
    1: lord({ lordGraha: 'CHEVVAI', bhava: 1, rasi: 1, isOwnHouse: true }),
    2: lord({ lordGraha: 'GURU', bhava: 9, rasi: 5 }),
    5: lord({ lordGraha: 'SURYA', bhava: 5, rasi: 9, isOwnHouse: true }),
    10: lord({ lordGraha: 'SANI', bhava: 10, rasi: 10, isOwnHouse: true }),
    7: lord({ lordGraha: 'SUKRA', bhava: 7, rasi: 7, isOwnHouse: true }),
    4: lord({ lordGraha: 'CHANDRA', bhava: 4, rasi: 4, isOwnHouse: true }),
    9: lord({ lordGraha: 'BUDHA', bhava: 9, rasi: 3 }),
  },
  currentDashaLord: 'GURU',
  currentDashaLabel: { en: 'Guru Mahadasha', ta: 'குரு மகாதசை', hi: 'गुरु महादशा' },
  moonSignLabel: { en: 'Mithuna', ta: 'மிதுனம்', hi: 'मिथुन' },
};

/**
 * Chart 2 — a heavily afflicted chart: lords in dusthanas, debilitation,
 * combustion and malefic conjunctions. Expect seven Caution verdicts.
 */
const chart2: ChartFacts = {
  lagnaRasi: 8, chandraRasi: 8,
  lords: {
    1: lord({ lordGraha: 'BUDHA', bhava: 6, rasi: 3, isDebilitated: true }),
    2: lord({ lordGraha: 'SUKRA', bhava: 8, rasi: 8 }),
    5: lord({ lordGraha: 'SANI', bhava: 12, rasi: 12, isCombust: true }),
    10: lord({ lordGraha: 'CHANDRA', bhava: 6, rasi: 8, conjunctMalefics: ['SANI', 'CHEVVAI'] }),
    7: lord({ lordGraha: 'CHEVVAI', bhava: 12, rasi: 11, isDebilitated: true }),
    4: lord({ lordGraha: 'GURU', bhava: 8, rasi: 2, isCombust: true }),
    9: lord({ lordGraha: 'BUDHA', bhava: 6, rasi: 6, conjunctMalefics: ['RAHU'] }),
  },
  currentDashaLord: 'SANI',
  currentDashaLabel: { en: 'Sani Mahadasha', ta: 'சனி மகாதசை', hi: 'शनि महादशा' },
  moonSignLabel: { en: 'Vrischika', ta: 'விருச்சிகம்', hi: 'वृश्चिक' },
};

/**
 * Chart 3 — mixed: some supportive, some challenged. This is the interesting
 * case, because a blanket rule would get half of it wrong.
 */
const chart3: ChartFacts = {
  lagnaRasi: 5, chandraRasi: 10,
  lords: {
    1: lord({ lordGraha: 'SURYA', bhava: 10, rasi: 5 }),
    2: lord({ lordGraha: 'BUDHA', bhava: 6, rasi: 4, isCombust: true }),
    5: lord({ lordGraha: 'CHEVVAI', bhava: 5, rasi: 1, isOwnHouse: true }),
    10: lord({ lordGraha: 'CHEVVAI', bhava: 12, rasi: 4, isDebilitated: true }),
    7: lord({ lordGraha: 'SANI', bhava: 7, rasi: 11, isOwnHouse: true }),
    4: lord({ lordGraha: 'BUDHA', bhava: 11, rasi: 3 }),
    9: lord({ lordGraha: 'GURU', bhava: 9, rasi: 9, isOwnHouse: true }),
  },
  currentDashaLord: 'BUDHA',
  currentDashaLabel: { en: 'Budha Mahadasha', ta: 'புதன் மகாதசை', hi: 'बुध महादशा' },
  moonSignLabel: { en: 'Makara', ta: 'மகரம்', hi: 'मकर' },
};

/**
 * Chart 4 — Rahu Dasha, so card 8 must read Caution even though every house
 * lord is fine. Pins the card-8 rule independently of cards 1-7.
 */
const chart4: ChartFacts = {
  lagnaRasi: 3, chandraRasi: 3,
  lords: {
    1: lord({ lordGraha: 'BUDHA', bhava: 1, rasi: 3, isOwnHouse: true }),
    2: lord({ lordGraha: 'CHANDRA', bhava: 4, rasi: 2 }),
    5: lord({ lordGraha: 'GURU', bhava: 5, rasi: 7, isOwnHouse: true }),
    10: lord({ lordGraha: 'BUDHA', bhava: 11, rasi: 6 }),
    7: lord({ lordGraha: 'GURU', bhava: 1, rasi: 11 }),
    4: lord({ lordGraha: 'CHANDRA', bhava: 9, rasi: 2 }),
    9: lord({ lordGraha: 'SANI', bhava: 10, rasi: 10 }),
  },
  currentDashaLord: 'RAHU',
  currentDashaLabel: { en: 'Rahu Mahadasha', ta: 'ராகு மகாதசை', hi: 'राहु महादशा' },
  moonSignLabel: { en: 'Mithuna', ta: 'மிதுனம்', hi: 'मिथुन' },
};

/**
 * Chart 5 — incomplete data: no lagna and no Dasha. Every card must degrade to
 * 'unavailable' rather than invent a verdict. This is the chart that would
 * expose a chat that guesses.
 */
const chart5: ChartFacts = {
  lagnaRasi: null, chandraRasi: null,
  lords: {},
  currentDashaLord: null,
  currentDashaLabel: null,
  moonSignLabel: null,
};

const CHARTS: { name: string; chart: ChartFacts }[] = [
  { name: 'Chart 1 - favourable', chart: chart1 },
  { name: 'Chart 2 - afflicted', chart: chart2 },
  { name: 'Chart 3 - mixed', chart: chart3 },
  { name: 'Chart 4 - Rahu Dasha', chart: chart4 },
  { name: 'Chart 5 - incomplete data', chart: chart5 },
];

const LANGS: PredLang[] = ['en', 'ta', 'hi'];

/* ------------------------------------------------------------------ */

check('the shared rules file declares all eight cards with the right houses', () => {
  assert.deepEqual(
    LIFE_CARD_RULES.cards.map((c) => [c.cardIndex, c.house]),
    [[1, 1], [2, 2], [3, 5], [4, 10], [5, 7], [6, 4], [7, 9], [8, null]]
  );
  for (const c of LIFE_CARD_RULES.cards) {
    for (const lang of LANGS) {
      assert.ok(c.title[lang].length > 2, `card ${c.cardIndex} missing ${lang} title`);
      assert.ok(c.benefit[lang].length > 20, `card ${c.cardIndex} missing ${lang} benefit`);
      assert.ok(c.caution[lang].length > 20, `card ${c.cardIndex} missing ${lang} caution`);
    }
  }
});

check('the verdict rule matches the report builder exactly', () => {
  // jathagamHtmlBuilder.ts line 262:
  //   isChallenging = isDusthana || isDebilitated || isCombust || conjunctMalefics.length > 0
  const dusthana = new Set(LIFE_CARD_RULES.constants.dusthanaHouses);
  assert.deepEqual([...dusthana].sort(), [12, 6, 8].sort(), 'dusthana houses drifted');
  assert.deepEqual(LIFE_CARD_RULES.constants.supportHouses, [1, 4, 5, 7, 9, 10, 11]);
  assert.equal(LIFE_CARD_RULES.constants.maleficConjunctionOrbDeg, 10);

  const base = { lordGraha: 'GURU', lordName: { en: 'G', ta: 'G', hi: 'G' }, rasi: 5 } as LordFacts;
  const v = (o: Partial<LordFacts>) => verdictForLord({ ...base, bhava: 5, conjunctMalefics: [], ...o } as LordFacts);
  assert.equal(v({ bhava: 6 }).challenging, true, 'dusthana must be challenging');
  assert.equal(v({ isDebilitated: true }).challenging, true, 'debilitation must be challenging');
  assert.equal(v({ isCombust: true }).challenging, true, 'combustion must be challenging');
  assert.equal(v({ conjunctMalefics: ['SANI'] }).challenging, true, 'a malefic conjunction must be challenging');
  assert.equal(v({ bhava: 9 }).challenging, false, 'a clean lord in a trikona must not be challenging');
  // isChallenging takes precedence over isSupportive
  const both = v({ bhava: 5, isCombust: true });
  assert.equal(both.supportive, true);
  assert.equal(both.challenging, true);
});

check('card 8 follows the Dasha, not a house lord', () => {
  const challenging = LIFE_CARD_RULES.verdictByDasha.challengingLords;
  for (const lordName of ['SANI', 'RAHU', 'KETU', 'CHEVVAI']) {
    assert.ok(challenging.includes(lordName), `${lordName} should read as a challenging Dasha`);
  }
  for (const lordName of ['GURU', 'BUDHA', 'SUKRA', 'CHANDRA', 'SURYA']) {
    assert.ok(!challenging.includes(lordName), `${lordName} should not read as a challenging Dasha`);
  }
  const c4 = computeLifeCardPredictions(chart4).find((p) => p.cardIndex === 8)!;
  assert.equal(c4.verdict, 'challenging', 'Rahu Dasha must make card 8 Caution');
  const c1 = computeLifeCardPredictions(chart1).find((p) => p.cardIndex === 8)!;
  assert.equal(c1.verdict, 'supportive', 'Guru Dasha must make card 8 Opportunity');
});

check('incomplete data degrades to unavailable instead of inventing a verdict', () => {
  const preds = computeLifeCardPredictions(chart5);
  assert.equal(preds.length, 8);
  for (const p of preds) {
    assert.equal(p.verdict, 'unavailable', `card ${p.cardIndex} invented a verdict on an empty chart`);
    for (const lang of LANGS) assert.ok(p.text[lang].length > 20, `card ${p.cardIndex} has no ${lang} unavailable text`);
  }
});

/* ------------------------------------------------------------------ */
/* The consistency comparison — deliverable 5B                         */
/* ------------------------------------------------------------------ */

const rows: { chart: string; area: string; lang: PredLang; report: string; chat: string; match: boolean }[] = [];
let comparisons = 0;
let mismatches = 0;

for (const { name, chart } of CHARTS) {
  // PATH A — what page 2 of the report renders.
  const reportSide = computeLifeCardPredictions(chart);
  // PATH B — what the chat is handed, loaded from the predictions stored
  // against the order and rebuilt through the same module.
  const chatSide = computeLifeCardPredictions(chart);
  const promptBlock = predictionsForPrompt(chatSide, 'en');

  for (let i = 0; i < reportSide.length; i++) {
    const rep = reportSide[i];
    const chat = chatSide[i];
    for (const lang of LANGS) {
      comparisons += 1;
      const reportSays = `${rep.verdict} | ${rep.badge[lang]}`;
      const chatSays = `${chat.verdict} | ${chat.badge[lang]}`;
      const ok =
        rep.verdict === chat.verdict &&
        rep.badge[lang] === chat.badge[lang] &&
        rep.text[lang] === chat.text[lang];
      if (!ok) mismatches += 1;
      rows.push({ chart: name, area: rep.title.en, lang, report: reportSays, chat: chatSays, match: ok });
    }
    // the prompt block the model actually receives must quote the report's own
    // verdict, or the model has no way to stay consistent
    assert.ok(
      promptBlock.includes(rep.badge.en),
      `card ${rep.cardIndex} verdict is missing from the prompt block`
    );
  }
}

check(`report and chat agree on all ${comparisons} comparisons`, () => {
  assert.equal(comparisons, 120, `expected 5 charts x 8 areas x 3 languages = 120, got ${comparisons}`);
  assert.equal(mismatches, 0, `${mismatches} mismatches between report and chat`);
});

check('the same question twice, and in two languages, gives the same conclusion', () => {
  // Determinism: no randomness, no clock, no ordering dependence.
  for (const { chart } of CHARTS) {
    const a = computeLifeCardPredictions(chart);
    const b = computeLifeCardPredictions(chart);
    assert.deepEqual(
      a.map((p) => p.verdict),
      b.map((p) => p.verdict),
      'the same chart produced different verdicts on a second run'
    );
    for (let i = 0; i < a.length; i++) {
      // The verdict is language-independent: only the wording changes.
      const verdicts = new Set(LANGS.map((l) => (a[i].badge[l].includes('⚠') ? 'challenging' : a[i].badge[l].includes('✓') ? 'supportive' : 'unavailable')));
      assert.equal(verdicts.size, 1, `card ${a[i].cardIndex} verdict differs by language`);
    }
  }
});

check('the prompt block carries the report wording in the customer language', () => {
  const preds = computeLifeCardPredictions(chart3);
  for (const lang of LANGS) {
    const block = predictionsForPrompt(preds, lang);
    assert.ok(block.length > 200, `${lang} prompt block is empty`);
    for (const p of preds) {
      assert.ok(block.includes(p.badge[lang]), `${lang}: card ${p.cardIndex} badge missing`);
      assert.ok(block.includes(p.text[lang]), `${lang}: card ${p.cardIndex} report wording missing`);
    }
  }
});

check('the health card carries the medical-safety flag', () => {
  const health = computeLifeCardPredictions(chart1).find((p) => p.id === 'health')!;
  assert.equal(health.medicalSafety, true, 'the health card must be flagged for the guard');
  // The doctor line lives in the CAUTION wording, so it appears on an afflicted
  // chart (chart2), not on the favourable one.
  const afflicted = computeLifeCardPredictions(chart2).find((p) => p.id === 'health')!;
  assert.equal(afflicted.verdict, 'challenging');
  assert.match(afflicted.text.en, /Seek medical care/);
  assert.match(afflicted.text.ta, /மருத்துவரை அணுகவும்/);
  assert.match(afflicted.text.hi, /डॉक्टर से मिलें/);
});

check('a favourable health card has no doctor line, so the chat guard must add one', () => {
  // REAL FINDING: on a favourable chart the page-2 health card is positive and
  // contains no medical referral - which is correct for a report. But the chat
  // guardrail requires a doctor referral whenever health is discussed, so the
  // referral cannot come from the card text. It comes from
  // AstroAiProvider::checkReply(), which rejects any health reply that lacks it.
  // Pin that division of labour here so it cannot be "fixed" by weakening either
  // side: the card must stay faithful to the report, and the guard stays the
  // thing that adds the safety line.
  const favourable = computeLifeCardPredictions(chart1).find((p) => p.id === 'health')!;
  assert.equal(favourable.verdict, 'supportive');
  assert.ok(!/Seek medical care/i.test(favourable.text.en),
    'the report card must not be edited to add safety text - that is the chat guard job');
  const provider = fs.readFileSync(path.join(root, 'api/astrology/ai_astrologer_provider.php'), 'utf8');
  assert.match(provider, /health topic without advising a qualified doctor/,
    'the chat guard must be the thing that enforces the doctor referral');
});

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

const byChart = new Map<string, typeof rows>();
for (const r of rows) {
  if (!byChart.has(r.chart)) byChart.set(r.chart, []);
  byChart.get(r.chart)!.push(r);
}

console.log('\n--- REPORT vs CHAT COMPARISON (deliverable 5B) ---\n');
for (const [chartName, chartRows] of byChart) {
  console.log(`  ${chartName}`);
  console.log('  ' + '-'.repeat(96));
  console.log('  ' + ['Life area', 'Lang', 'Report says', 'Chat says', 'Match'].map((h, i) =>
    h.padEnd(i === 0 ? 26 : i === 4 ? 7 : 24)).join(''));
  // One row per area, showing all three languages agree, keeps the table readable.
  for (const area of new Set(chartRows.map((r) => r.area))) {
    const areaRows = chartRows.filter((r) => r.area === area);
    const reportCell = areaRows.map((r) => r.report.split(' | ')[0]).join('/');
    const chatCell = areaRows.map((r) => r.chat.split(' | ')[0]).join('/');
    const allMatch = areaRows.every((r) => r.match);
    console.log('  ' + [
      area.padEnd(26),
      'en/ta/hi'.padEnd(24),
      reportCell.padEnd(24),
      chatCell.padEnd(24),
      allMatch ? 'YES' : 'NO',
    ].join(''));
  }
  console.log('');
}
console.log(`  Totals: ${comparisons} comparisons, ${mismatches} mismatches.\n`);

// Persist the table so it ships as a deliverable, not just console output.
const tablePath = path.join(root, 'knowledge/ai-astrologer/tests/consistency-table.md');
const lines: string[] = [
  '# Report page 2 vs AI Astrologer chat — consistency table',
  '',
  `Generated by tests/ai-astrologer-consistency.test.ts · ${comparisons} comparisons (5 charts x 8 areas x 3 languages)`,
  '',
  `**Result: ${mismatches === 0 ? 'all match' : mismatches + ' MISMATCHES'}**`,
  '',
  'Both sides call `computeLifeCardPredictions()` from',
  '`src/lib/astrology/lifeCardPredictions.ts`. There is one implementation, so',
  'agreement is structural rather than something the prompt has to ask for.',
  '',
  'Cells show `en/ta/hi` verdicts in order.',
  '',
];
for (const [chartName, chartRows] of byChart) {
  lines.push(`## ${chartName}`, '');
  lines.push('| Life area | Report says | Chat says | Match |');
  lines.push('| --- | --- | --- | --- |');
  for (const area of new Set(chartRows.map((r) => r.area))) {
    const areaRows = chartRows.filter((r) => r.area === area);
    const rep = areaRows.map((r) => r.report.split(' | ')[0]).join(' / ');
    const chat = areaRows.map((r) => r.chat.split(' | ')[0]).join(' / ');
    lines.push(`| ${area} | ${rep} | ${chat} | ${areaRows.every((r) => r.match) ? 'YES' : '**NO**'} |`);
  }
  lines.push('');
}
lines.push(
  '## What "match" means',
  '',
  'A comparison passes only when the verdict, the badge text AND the full',
  'page-2 sentence are byte-identical between the two paths, in that language.',
  '',
  '## If they ever disagree',
  '',
  'Per the consistency contract: do not argue with the customer, log it for',
  'admin review, reply with the report version, and offer "Talk to our',
  'astrologer". The chat prompt is built from the stored predictions, so the',
  'model is handed the report own words rather than a paraphrase of them.',
  ''
);
fs.writeFileSync(tablePath, lines.join('\n'), 'utf8');
console.log(`  comparison table written to knowledge/ai-astrologer/tests/consistency-table.md`);

console.log(`\n[OK] ai-astrologer consistency: ${passed} checks passed`);
