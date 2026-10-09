/**
 * ASTRO SIVAM AI Astrologer — Part 2 knowledge retrieval.
 *
 * WHY THIS EXISTS: the agent must answer the eight life-area cards from the
 * customer's own chart, cite a real source at the level it was verified at,
 * and never say anything the guardrails forbid. This test drives the real
 * retrieval module against the real knowledge base files, so a rule that
 * cannot fire, a citation that overclaims, or a guardrail that leaks is caught
 * here rather than in front of a paying customer.
 *
 * NOTE: the production retrieval runs in PHP (api/astrology/ai_astrologer.php,
 * Part 4). This module is the executable spec it must match.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setKnowledgeBase,
  detectLanguage,
  matchAreas,
  matchRefusalRoute,
  evaluateCondition,
  retrieve,
  checkReply,
  remediesFor,
  formatCitation,
  type ChartFacts,
} from '../src/services/aiAstrologerRetrieval';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = (p: string) => path.join(projectRoot, 'knowledge/ai-astrologer', p);
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const lifeAreas = read(KB('rules/life-areas.json'));
const remedies = read(KB('rules/remedies.json'));
const guardrails = read(KB('rules/guardrails.json'));
const registry = read(KB('sources.json'));
setKnowledgeBase(lifeAreas, remedies, guardrails);

const knownIds = new Set<string>([
  ...registry.sources.map((s: any) => s.id),
  ...registry.excludedSources.map((s: any) => s.id),
]);
const excludedIds = new Set<string>(registry.excludedSources.map((s: any) => s.id));
const byId = new Map<string, any>(registry.sources.map((s: any) => [s.id, s]));
const passageLevel = new Set<string>(
  registry.sources.filter((s: any) => s.verifiedPassages).map((s: any) => s.id)
);
const chapterLevel = new Set<string>(
  registry.sources.filter((s: any) => s.verifiedChapterAnchors).map((s: any) => s.id)
);

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

check('all eight life-area cards from page 2 of the report are present', () => {
  const ids = lifeAreas.areas.map((a: any) => a.id);
  assert.deepStrictEqual(ids, [
    'health',
    'wealth',
    'education',
    'career',
    'marriage',
    'property',
    'travel-foreign',
    'current-guidance',
  ]);
  assert.deepStrictEqual(
    lifeAreas.areas.map((a: any) => a.cardIndex),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
});

check('every area carries a title in all three languages', () => {
  for (const a of lifeAreas.areas) {
    for (const lang of ['en', 'ta', 'hi']) {
      assert.ok(a.cardTitle[lang] && a.cardTitle[lang].length > 2, `${a.id}.${lang} title missing`);
      assert.ok(a.customerPhrases[lang]?.length > 0, `${a.id} has no ${lang} trigger phrases`);
    }
  }
});

check('language detection picks the right script', () => {
  assert.equal(detectLanguage('Will I settle abroad?'), 'en');
  assert.equal(detectLanguage('எனக்கு வெளிநாடு போக முடியுமா?'), 'ta');
  assert.equal(detectLanguage('क्या मेरा विदेश जाना होगा?'), 'hi');
  // a Tamil sentence containing an English loanword stays Tamil
  assert.equal(detectLanguage('எனக்கு visa கிடைக்குமா?'), 'ta');
});

check('every card is reachable by a question written in each language', () => {
  const samples: Record<string, Record<string, string>> = {
    health: { en: 'I have been feeling sick and tired lately', ta: 'எனக்கு உடல்நலம் சரியில்லை, நோய் வருகிறது', hi: 'मेरा स्वास्थ्य ठीक नहीं है, दर्द रहता है' },
    wealth: { en: 'Why is my money going out so fast?', ta: 'என் பணம் எங்கே போகிறது? கடன் அதிகம்', hi: 'मेरा पैसा कहाँ जा रहा है? कर्ज बढ़ रहा है' },
    education: { en: 'When should I sit my exam for college?', ta: 'என் படிப்பு மற்றும் தேர்வு எப்போது நல்லது?', hi: 'मेरी पढ़ाई और परीक्षा कब अच्छी होगी?' },
    career: { en: 'Should I change my job or start a business?', ta: 'வேலை மாறட்டுமா அல்லது தொழில் தொடங்கவா?', hi: 'नौकरी बदलूँ या व्यवसाय शुरू करूँ?' },
    marriage: { en: 'Why is my marriage getting delayed?', ta: 'என் திருமணம் ஏன் தாமதம் ஆகிறது?', hi: 'मेरा विवाह क्यों टल रहा है?' },
    property: { en: 'Should I buy a house or land this year?', ta: 'இந்த வருடம் வீடு வாங்கலாமா?', hi: 'इस साल घर खरीदूँ?' },
    'travel-foreign': { en: 'Will I get a chance to go abroad?', ta: 'எனக்கு வெளிநாடு போக வாய்ப்பு உண்டா?', hi: 'क्या मुझे विदेश जाने का मौका मिलेगा?' },
    'current-guidance': { en: 'When will this current period get better?', ta: 'இந்த காலம் எப்போது நல்லாகும்?', hi: 'यह काल कब अच्छा होगा?' },
  };
  for (const [areaId, langs] of Object.entries(samples)) {
    for (const [lang, q] of Object.entries(langs)) {
      const top = matchAreas(q, lang as any)[0];
      assert.ok(top, `no area matched for ${areaId} / ${lang}: "${q}"`);
      assert.equal(top.area.id, areaId, `"${q}" (${lang}) matched ${top.area.id}, expected ${areaId}`);
    }
  }
});

check('Current Guidance is a fallback and never outranks a specific topic', () => {
  // "this year" is a Current Guidance phrase, but the question is about a house.
  assert.equal(matchAreas('Should I buy a house this year?', 'en')[0].area.id, 'property');
  assert.equal(matchAreas('இந்த வருடம் வீடு வாங்கலாமா?', 'ta')[0].area.id, 'property');
  // with no specific topic present, Current Guidance does answer
  assert.equal(matchAreas('When will this current period get better?', 'en')[0].area.id, 'current-guidance');
  assert.equal(matchAreas('இந்த காலம் எப்போது நல்லாகும்?', 'ta')[0].area.id, 'current-guidance');
});

check('every rule condition actually fires on at least one plausible chart', () => {
  // A chart deliberately built to satisfy each condition type at least once.
  const chart: ChartFacts = {
    lagna: 'Kataka',
    moonSign: 'Vrishabha',
    moonNakshatra: 'Rohini',
    moonNakshatraLord: 'Chandra',
    currentDasha: 'Guru',
    currentAntardasha: 'Budha',
    dashaEndDate: '2027-04-11',
    planetHouse: { Guru: 2, Sani: 2, Surya: 2, Rahu: 12, Ketu: 6, Chandra: 2, Sevvai: 7, Sukra: 7, Budha: 11 },
    lordHouse: { 1: 2, 2: 11, 11: 1, 4: 9, 5: 9, 7: 6, 9: 12, 10: 3, 12: 8, 6: 12, 8: 1 },
    dignity: { lagnaLord: 'weak', Budha: 'weak', Guru: 'weak', Sani: 'weak', Rahu: 'neutral', Ketu: 'neutral', Chandra: 'neutral', Sevvai: 'neutral', Sukra: 'neutral', Surya: 'neutral' },
    saniTransitFromMoon: 1,
    doshas: ['kujaDosha'],
  };
  const fired: string[] = [];
  for (const area of lifeAreas.areas) {
    for (const rule of area.rules) {
      if (evaluateCondition(rule.condition, chart, 'marriage health money exam visa job')) fired.push(rule.id);
    }
  }
  const always = lifeAreas.areas.flatMap((a: any) => a.rules.filter((r: any) => r.condition.type === 'always').map((r: any) => r.id));
  for (const id of always) assert.ok(fired.includes(id), `an 'always' rule never fired: ${id}`);
  assert.ok(fired.length >= 10, `only ${fired.length} rules fired on a chart built to trigger them`);
});

check('a rule with no supporting chart data cannot fire', () => {
  const empty: ChartFacts = {
    lagna: '', moonSign: '', moonNakshatra: '', moonNakshatraLord: '',
    currentDasha: '', currentAntardasha: '', dashaEndDate: '',
    planetHouse: {}, lordHouse: {}, dignity: {}, saniTransitFromMoon: 0, doshas: [],
  };
  const fired = lifeAreas.areas.flatMap((a: any) =>
    a.rules.filter((r: any) => evaluateCondition(r.condition, empty, '')).map((r: any) => r.id)
  );
  const onlyAlways = lifeAreas.areas.flatMap((a: any) =>
    a.rules.filter((r: any) => r.condition.type === 'always').map((r: any) => r.id)
  );
  assert.deepStrictEqual(fired.sort(), onlyAlways.sort(), 'a chart-dependent rule fired on an empty chart');
});

check('every rule cites at least one source, and every source is in the registry', () => {
  let count = 0;
  for (const area of lifeAreas.areas) {
    for (const rule of area.rules) {
      assert.ok(rule.source?.length > 0, `${rule.id} has no source`);
      for (const s of rule.source) {
        count += 1;
        assert.ok(knownIds.has(s.id), `${rule.id} cites unknown id ${s.id}`);
        assert.ok(!excludedIds.has(s.id), `${rule.id} cites EXCLUDED source ${s.id}`);
      }
    }
  }
  assert.ok(count >= 40, `only ${count} citations across the rule base`);
});

check('no rule cites a source beyond its verified level', () => {
  for (const area of lifeAreas.areas) {
    for (const rule of [...area.rules, ...(area.suppressedRules ?? [])]) {
      // rules[].source is an array; suppressedRules[].source is a single object
      const srcs = Array.isArray(rule.source) ? rule.source : [rule.source];
      for (const s of srcs) {
        if (s.level === 'book' || s.level === 'note' || s.level === 'suppressed') continue;
        if (s.level === 'passage') {
          assert.ok(passageLevel.has(s.id), `${rule.id} cites ${s.id} at passage level with no verifiedPassages`);
          assert.ok(s.verse !== undefined || s.page, `${rule.id} passage citation to ${s.id} has no verse or page`);
        } else if (s.level === 'chapter') {
          assert.ok(chapterLevel.has(s.id), `${rule.id} cites ${s.id} at chapter level with no verifiedChapterAnchors`);
          assert.ok(s.note, `${rule.id} chapter citation to ${s.id} has no note naming the chapter`);
        } else if (s.level === 'content') {
          assert.equal(byId.get(s.id)?.verification, 'content-read', `${rule.id} cites ${s.id} as content-read but it is ${byId.get(s.id)?.verification}`);
        } else {
          assert.fail(`${rule.id} uses unknown level ${s.level}`);
        }
      }
    }
  }
});

check('the health area carries the medical safety block and records suppressed verses', () => {
  const health = lifeAreas.areas.find((a: any) => a.id === 'health');
  assert.equal(health.medicalSafety.required, true);
  assert.ok(health.suppressedRules.length >= 3, 'health should record the verses it refuses to relay');
  for (const s of health.suppressedRules) assert.ok(s.reason.length > 20, 'a suppressed verse has no stated reason');
  // the death/disease verses must be suppressed, not usable
  const suppressed = health.suppressedRules.map((s: any) => `${s.source.id}`);
  assert.ok(suppressed.includes('TA-02') && suppressed.includes('TA-07') && suppressed.includes('TA-10'));
});

check('refusal routes fire before any area answer', () => {
  assert.equal(matchRefusalRoute('Will I die young?')?.route, 'refuse-prediction');
  assert.equal(matchRefusalRoute('என் ஆயுள் எத்தனை நாள்? இறப்பு எப்போது?')?.route, 'refuse-prediction');
  assert.equal(matchRefusalRoute('मेरी मौत कब होगी?')?.route, 'refuse-prediction');
  assert.equal(matchRefusalRoute('I am filing a court case, will I win?')?.route, 'decline-with-referral');
  assert.equal(matchRefusalRoute('which stock should I buy?')?.route, 'decline-with-referral');
  assert.equal(matchRefusalRoute('how much does the report cost?')?.route, 'no-sales');
  assert.equal(matchRefusalRoute('someone did black magic on me')?.route, 'decline-respectfully');
  assert.equal(matchRefusalRoute('when will I get a job?'), null, 'an ordinary question must not be refused');
});

check('end-to-end: a foreign-settlement question retrieves the 9th/12th/Rahu rules', () => {
  const chart: ChartFacts = {
    lagna: 'Mesha', moonSign: 'Mithuna', moonNakshatra: 'Ardra', moonNakshatraLord: 'Rahu',
    currentDasha: 'Rahu', currentAntardasha: 'Guru', dashaEndDate: '2027-09-02',
    planetHouse: { Rahu: 12, Ketu: 6, Guru: 9, Sani: 3, Chandra: 4, Surya: 1, Sevvai: 11, Sukra: 2, Budha: 5 },
    lordHouse: { 9: 12, 12: 9, 10: 7, 4: 1 },
    dignity: { Rahu: 'neutral', Guru: 'strong' },
    saniTransitFromMoon: 5, doshas: [],
  };
  const r = retrieve('Will I settle abroad or get a foreign job?', chart);
  assert.equal(r.language, 'en');
  assert.equal(r.area?.id, 'travel-foreign');
  assert.ok(r.rules.some((x) => x.ruleId === 'foreign-rahu-9-12'), 'Rahu in the 12th did not fire');
  assert.ok(r.chartHeader.includes('Rahu'), 'the chart header must name the current Dasha');
  assert.ok(r.sourceLine.startsWith('Source:'), 'no source line produced');
  assert.ok(r.sourceLine.includes('EN-09'), 'the Rahu-Ketu rule must cite Uttara Kalamrita');
});

check('end-to-end: a Tamil health question stays in Tamil and flags the handoff', () => {
  const chart: ChartFacts = {
    lagna: 'Simha', moonSign: 'Kanya', moonNakshatra: 'Hasta', moonNakshatraLord: 'Chandra',
    currentDasha: 'Sani', currentAntardasha: 'Sani', dashaEndDate: '2026-12-30',
    planetHouse: { Sani: 1, Chandra: 1, Guru: 5 },
    lordHouse: { 1: 6, 6: 8 },
    dignity: { lagnaLord: 'weak', Sani: 'weak' },
    saniTransitFromMoon: 1, doshas: [],
  };
  const r = retrieve('எனக்கு உடல்நலம் சரியில்லை, சனி பெயர்ச்சி நேரம் கஷ்டமாக உள்ளது', chart);
  assert.equal(r.language, 'ta');
  assert.equal(r.area?.id, 'health');
  assert.ok(r.rules.some((x) => x.ruleId === 'health-sade-sati'), 'Sade Sati did not fire with Saturn on the natal Moon');
  const sadeSati = r.rules.find((x) => x.ruleId === 'health-sade-sati')!;
  assert.match(sadeSati.meaning, /ஏழரை/, 'the Tamil reply must use the Tamil term');
  assert.match(sadeSati.meaning, /பலதீபிகை/, 'owner decision 3: Sade Sati must be anchored to Phaladeepika');
  assert.ok(!/மரணம்|மரண/.test(sadeSati.meaning), 'the reply must not use death language');
  assert.equal(r.handoff, true, 'a health question must offer the astrologer handoff');
});

check('end-to-end: a Hindi business question answers in Hindi from English/Tamil sources', () => {
  const chart: ChartFacts = {
    lagna: 'Makara', moonSign: 'Tula', moonNakshatra: 'Swati', moonNakshatraLord: 'Rahu',
    currentDasha: 'Budha', currentAntardasha: 'Sukra', dashaEndDate: '2027-02-14',
    planetHouse: { Budha: 10, Sukra: 7, Guru: 3, Sani: 4 },
    lordHouse: { 10: 10, 7: 7 },
    dignity: { Budha: 'strong' },
    saniTransitFromMoon: 7, doshas: [],
  };
  const r = retrieve('क्या मुझे नौकरी छोड़कर अपना व्यवसाय शुरू करना चाहिए?', chart);
  assert.equal(r.language, 'hi');
  assert.equal(r.area?.id, 'career');
  assert.ok(r.rules.some((x) => x.ruleId === 'career-startup-timing'));
  assert.ok(r.rules.every((x) => !/[\u0B80-\u0BFF]/.test(x.meaning)), 'a Hindi reply must not contain Tamil script');
  // owner decision 4: no Hindi source anywhere in the retrieval
  const cited = r.rules.flatMap((x) => x.sources.map((s) => s.id));
  assert.ok(cited.length > 0);
  assert.ok(cited.every((id) => !id.startsWith('HI-')), `a Hindi source was cited: ${cited}`);
});

check('the source line never cites an excluded or unknown id', () => {
  const chart: ChartFacts = {
    lagna: 'Meena', moonSign: 'Mesha', moonNakshatra: 'Ashwini', moonNakshatraLord: 'Ketu',
    currentDasha: 'Ketu', currentAntardasha: 'Chandra', dashaEndDate: '2026-11-05',
    planetHouse: { Ketu: 7, Rahu: 1, Chandra: 7, Guru: 2 },
    lordHouse: { 2: 11, 11: 2, 1: 2, 5: 9 },
    dignity: {},
    saniTransitFromMoon: 3, doshas: [],
  };
  for (const q of [
    'why is my money going out so fast?',
    'என் சம்பளம் எங்கே போகிறது?',
    'मेरा वेतन कहाँ जाता है?',
  ]) {
    const r = retrieve(q, chart);
    for (const token of r.sourceLine.replace('Source: ', '').split(' · ')) {
      const id = token.split(',')[0].trim();
      assert.ok(knownIds.has(id), `source line cites unknown id ${id}`);
      assert.ok(!excludedIds.has(id), `source line cites EXCLUDED id ${id}`);
    }
  }
});

check('remedies are cheap, sourced, and never include a prohibited item', () => {
  const banned = remedies.neverOffer.map((n: any) => n.thing.toLowerCase());
  for (const g of remedies.grahas) {
    assert.ok(g.source?.length > 0, `${g.graha} remedy has no source`);
    const blob = [g.charity, g.fasting, g.lifestyle, g.mantra.simple].join(' ').toLowerCase();
    assert.ok(!/gold|silver image|goat|buffalo|gemstone|ruby|emerald|diamond/.test(blob), `${g.graha} offers a prohibited remedy`);
    for (const s of g.source) {
      assert.ok(knownIds.has(s.id), `${g.graha} cites unknown ${s.id}`);
      assert.ok(!excludedIds.has(s.id), `${g.graha} cites EXCLUDED ${s.id}`);
    }
  }
  for (const n of remedies.neverOffer) assert.ok(banned.includes(n.thing.toLowerCase()));
  assert.equal(remediesFor(['Guru', 'Sani', 'Budha', 'Sukra', 'Rahu']).length, 3, 'remedies must be capped at three');
});

check('every graha remedy has a Navagraha sthalam it can point to', () => {
  const sthalamIds = new Set(registry.sources.filter((s: any) => s.group === 'navagraha-sthalam').map((s: any) => s.id));
  for (const g of remedies.grahas) {
    assert.ok(sthalamIds.has(g.temple.id), `${g.graha} points at ${g.temple.id}, which is not a registered sthalam`);
    assert.ok(g.temple.name.length > 5, `${g.graha} has no temple name`);
  }
});

check('the guardrail checker catches banned phrasing and a missing doctor referral', () => {
  const good = 'The chart reads as heavier for the body in this Bhukti. Please also see a qualified doctor; astrology is complementary guidance only.';
  assert.equal(checkReply(good, 'en').ok, true);

  const guaranteed = 'You will definitely recover. It is guaranteed.';
  const r1 = checkReply(guaranteed, 'en');
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.some((v) => v.includes('will definitely')));

  const frightening = 'There is a risk of death in this period.';
  assert.equal(checkReply(frightening, 'en').ok, false);

  const noDoctor = 'Your health will improve with these remedies.';
  const r2 = checkReply(noDoctor, 'en');
  assert.equal(r2.ok, false);
  assert.ok(r2.violations.some((v) => v.includes('doctor')));

  assert.equal(checkReply('நீங்கள் கண்டிப்பாக குணமாவீர்கள்', 'ta').ok, false, 'Tamil guarantee phrasing must be caught');
});

check('the required identity, disclaimer and handoff strings exist in all three languages', () => {
  assert.equal(guardrails.identity.nameInChat, 'ASTRO SIVAM AI Astrologer');
  for (const lang of ['en', 'ta', 'hi']) {
    assert.ok(guardrails.disclaimer[lang].length > 20, `no ${lang} disclaimer`);
    assert.ok(guardrails.identity.ifAskedIfHuman[lang].length > 20, `no ${lang} AI disclosure`);
    assert.ok(guardrails.health.emergencyFirst[lang].length > 20, `no ${lang} emergency line`);
    assert.ok(guardrails.handoff.label[lang].length > 3, `no ${lang} handoff label`);
  }
  assert.match(guardrails.disclaimer.en, /not a substitute for medical, legal or financial advice/);
  assert.ok(guardrails.health.mustNever.length >= 5);
  assert.ok(guardrails.health.mustAlways.length >= 3);
});

check('the citation formatter only emits verse or page detail it can back up', () => {
  assert.equal(formatCitation({ id: 'TA-02', level: 'passage', verse: 46, page: '20' }, 'en'), 'TA-02, verse 46, p.20');
  assert.equal(formatCitation({ id: 'TA-02', level: 'passage', verse: 46, page: '20' }, 'ta'), 'TA-02, பாடல் 46, p.20');
  assert.equal(formatCitation({ id: 'EN-01', level: 'book' }, 'en'), 'EN-01');
  // a book-level citation must never smuggle a verse number through
  assert.equal(formatCitation({ id: 'EN-01', level: 'book', verse: 12 }, 'en'), 'EN-01');
});

check('no knowledge base file mixes Tamil and Devanagari script', () => {
  // Regression guard: this bug shipped twice - a Devanagari "र" inside a Tamil
  // word, and a Turkish word inside a Hindi sentence. Both read as garbage to
  // a native speaker and neither is visible in a code review on a phone.
  const files = [
    'rules/life-areas.json',
    'rules/remedies.json',
    'rules/guardrails.json',
    'sources.json',
    'README.md',
    'SOURCES.md',
    'VERIFICATION_LOG.md',
    'prompt/system-prompt.md',
  ];
  const mixed = /[\u0B80-\u0BFF][\u0900-\u097F]|[\u0900-\u097F][\u0B80-\u0BFF]/;
  const strayTurkish = /\b(savunmak|için|olarak|bir|ve)\b/;
  for (const rel of files) {
    const text = fs.readFileSync(KB(rel), 'utf8');
    for (const [i, line] of text.split('\n').entries()) {
      assert.ok(!mixed.test(line), `${rel}:${i + 1} mixes Tamil and Devanagari: ${line.slice(0, 80)}`);
      assert.ok(!strayTurkish.test(line), `${rel}:${i + 1} contains a stray non-English word: ${line.slice(0, 80)}`);
    }
  }
});

check('the trilingual card titles match the report generator exactly', () => {
  // The chat must use the same wording as page 2 of the PDF, so the customer
  // sees one vocabulary, not two. jathagamHtmlBuilder.ts is the source of truth.
  const builder = fs.readFileSync(path.join(projectRoot, 'src/services/jathagamHtmlBuilder.ts'), 'utf8');
  for (const area of lifeAreas.areas) {
    for (const lang of ['ta', 'hi'] as const) {
      const title = area.cardTitle[lang];
      assert.ok(
        builder.includes(title),
        `card ${area.cardIndex} ${lang} title "${title}" does not appear in jathagamHtmlBuilder.ts`
      );
    }
  }
});

console.log(`\n[OK] ai-astrologer knowledge retrieval: ${passed} checks passed`);
