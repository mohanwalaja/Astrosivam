/**
 * ASTRO SIVAM AI Astrologer — GUIDED MODE contracts.
 *
 * Customers never type a question: they pick a topic and then one curated
 * option from knowledge/ai-astrologer/rules/guided-questions.json. The eight
 * life topics mirror the Birth Jathagam page-2 cards; doshas, remedies, order
 * facts and complaints cover everything else the chat is allowed to discuss.
 * Anything outside the menu is impossible to ask — the server refuses
 * free-text questions from customers (administrators keep free text for
 * testing, and complaint options accept one short detail line for the
 * human team).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, sliceToEnd } from './helpers/sourceSlice';
import {
  setKnowledgeBase,
  matchRefusalRoute,
} from '../src/services/aiAstrologerRetrieval';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p));

const guided = readJson('knowledge/ai-astrologer/rules/guided-questions.json');
const lifeAreas = readJson('knowledge/ai-astrologer/rules/life-areas.json');
const remedies = readJson('knowledge/ai-astrologer/rules/remedies.json');
const guardrails = readJson('knowledge/ai-astrologer/rules/guardrails.json');
setKnowledgeBase(lifeAreas, remedies, guardrails);

const endpoint = read('api/ai_astrologer.php');
const provider = read('api/astrology/ai_astrologer_provider.php');
const offline = read('api/astrology/ai_astrologer_offline.php');
const panel = read('src/components/ai-astrologer/AiAstrologerPanel.tsx');
const client = read('src/services/aiAstrologerApi.ts');
const builder = read('src/services/jathagamHtmlBuilder.ts');

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

const LANGS = ['en', 'ta', 'hi'] as const;
const allQuestions = (): any[] =>
  (guided.categories as any[]).flatMap((c) =>
    (c.questions as any[]).map((q) => ({ ...q, _category: c.id }))
  );

check('the menu has the eight page-2 life topics plus dosha, remedy, order and complaint topics', () => {
  const ids = (guided.categories as any[]).map((c) => c.id);
  assert.deepEqual(ids, [
    'health', 'wealth', 'education', 'career', 'marriage', 'property',
    'travel-foreign', 'current-guidance', 'doshas', 'remedies', 'order', 'support',
  ]);
});

check('the eight life topics mirror the page-2 life cards in order, with the same icons', () => {
  // The report's own card order and icons, read from the builder that prints page 2.
  const icons = [...builder.matchAll(/\{\s*\n\s*icon: '(.*?)',/g)].map((m) => m[1]);
  assert.equal(icons.length, 8);
  const topics = (guided.categories as any[]).slice(0, 8);
  topics.forEach((topic, i) => {
    assert.equal(topic.icon, icons[i], `topic ${topic.id} must reuse the page-2 card icon`);
    assert.equal(topic.cardIndex, i + 1);
  });
  // And the topic ids are the life-area rule ids the answers come from.
  const areaIds = new Set((lifeAreas.areas as any[]).map((a) => a.id));
  for (const topic of topics) {
    assert.ok(areaIds.has(topic.id), `topic ${topic.id} has no life-area rule card`);
  }
});

check('every topic and option is trilingual, non-empty and unique', () => {
  const seen = new Set<string>();
  for (const topic of guided.categories as any[]) {
    for (const lang of LANGS) {
      assert.ok(topic.title?.[lang]?.trim(), `topic ${topic.id} misses a ${lang} title`);
      assert.ok(topic.hint?.[lang]?.trim(), `topic ${topic.id} misses a ${lang} hint`);
    }
    assert.ok((topic.questions as any[]).length >= 3, `topic ${topic.id} has too few options`);
    for (const q of topic.questions as any[]) {
      assert.ok(q.id && !seen.has(q.id), `duplicate or missing option id ${q.id}`);
      seen.add(q.id);
      for (const lang of LANGS) {
        assert.ok(q.text?.[lang]?.trim(), `option ${q.id} misses a ${lang} wording`);
      }
    }
  }
});

check('every option routes to exactly one supported answer path', () => {
  const areaIds = new Set((lifeAreas.areas as any[]).map((a) => a.id));
  const grahas = new Set((remedies.grahas as any[]).map((g) => g.graha));
  for (const q of allQuestions()) {
    assert.ok(
      ['area', 'dosha', 'remedy', 'order', 'complaint'].includes(q.kind),
      `option ${q.id} has an unknown kind ${q.kind}`
    );
    if (q.kind === 'area') {
      assert.ok(areaIds.has(q.area), `option ${q.id} names an unknown life area ${q.area}`);
    }
    if (q.kind === 'dosha') {
      assert.ok(
        ['all', 'kuja', 'kalasarpa', 'pitru', 'guruchandala'].includes(q.dosha),
        `option ${q.id} names an unknown dosha ${q.dosha}`
      );
    }
    if (q.kind === 'remedy' && q.planet !== null && q.planet !== undefined) {
      assert.ok(grahas.has(q.planet), `option ${q.id} names an unknown graha ${q.planet}`);
    }
    if (q.kind === 'order') {
      assert.ok(
        ['status', 'payment', 'details', 'correction'].includes(q.topic),
        `option ${q.id} names an unknown order topic ${q.topic}`
      );
    }
    if (q.kind === 'complaint') {
      assert.ok(
        ['not-received', 'report-wrong', 'payment', 'talk-astrologer'].includes(q.topic),
        `option ${q.id} names an unknown complaint topic ${q.topic}`
      );
      assert.equal(q.escalate, true, `complaint option ${q.id} must always reach the human queue`);
    }
  }
});

check('only complaint options accept a detail line, and birth-detail correction always escalates', () => {
  for (const q of allQuestions()) {
    if (q.needsDetails) {
      assert.equal(q.kind, 'complaint', `only complaints take free text, but ${q.id} does`);
    }
  }
  const correction = allQuestions().find((q) => q.id === 'order-correction');
  assert.equal(correction?.escalate, true, 'birth-detail correction must reach the human team');
});

check('no curated option trips a refusal route in any language', () => {
  for (const q of allQuestions()) {
    for (const lang of LANGS) {
      const refusal = matchRefusalRoute(q.text[lang]);
      assert.equal(
        refusal, null,
        `option ${q.id} (${lang}) would be refused as ${refusal?.route}: "${q.text[lang]}"`
      );
    }
  }
});

check('the endpoint serves the guided menu behind both gates', () => {
  assert.match(endpoint, /function astro_ai_action_options\(/);
  assert.match(endpoint, /case 'options':\s*\n\s*astro_ai_action_options\(\$pdo, \$user, \$body\);/);
  const gateCall = endpoint.indexOf('$user = astro_ai_gate($pdo)');
  const dispatch = endpoint.indexOf('switch ($action)');
  assert.ok(gateCall > 0 && gateCall < dispatch, 'options must run behind the combined gate');
  assert.match(endpoint, /guided-questions\.json/);
});

check('customers must send a curated option id; only admins may type', () => {
  const ask = sliceText(
    endpoint, 'function astro_ai_action_ask', 'function astro_ai_action_upload', 'ask handler body'
  );
  assert.match(ask, /astro_ai_guided_find\(\$guidedId\)/);
  assert.match(ask, /'code' => 'UNKNOWN_QUESTION'/);
  assert.match(ask, /'code' => 'GUIDED_ONLY'/);
  // The refusal is trilingual, like every other customer-facing gate message.
  assert.match(ask, /pick a question from the list/);
  assert.match(ask, /பட்டியலிலிருந்து ஒரு கேள்வியை தேர்வு செய்யவும்/);
  assert.match(ask, /सूची से कोई प्रश्न चुनें/);
});

check('guided complaint and correction options always reach the human queue with details', () => {
  const ask = sliceText(
    endpoint, 'function astro_ai_action_ask', 'function astro_ai_action_upload', 'ask handler body'
  );
  assert.match(ask, /complaintDetails/);
  assert.match(ask, /\(\$guided\['escalate'\] \?\? false\) === true/);
  assert.match(ask, /\(\$guided\['kind'\] \?\? ''\) === 'complaint'/);
  assert.match(ask, /astro_ai_record_escalation\(\$pdo, \$user, \$session, \$storedQuestion, \$escalation, \$language\)/);
});

check('the chart facts carry the full dosha block for guided dosha answers', () => {
  const facts = sliceText(
    endpoint, 'function astro_ai_chart_facts', '/* ================================================================== */', 'chart facts body'
  );
  assert.match(facts, /'doshaDetails' => \$doshaDetails/);
  assert.match(facts, /traditionalRemedyEn/);
});

check('the local reply builder routes every guided kind without re-matching', () => {
  assert.match(offline, /\$context\['guided'\]/);
  for (const kind of ['order', 'complaint', 'dosha', 'remedy']) {
    assert.match(offline, new RegExp(`\\$guidedKind === '${kind}'`));
  }
  assert.match(offline, /private static function orderBubbles\(/);
  assert.match(offline, /private static function doshaBubbles\(/);
  assert.match(offline, /private static function complaintAck\(/);
  assert.match(offline, /private static function templeText\(/);
  // Forced-card path: a guided area option names its card directly.
  assert.match(offline, /\$guidedKind === 'area' && is_string\(\$guided\['area'\]/);
});

check('diagnostics cover the guided menu file', () => {
  assert.match(provider, /GUIDED_PATH/);
  assert.match(provider, /'guided' => self::GUIDED_PATH/);
  assert.match(provider, /guidedOptions/);
});

check('the browser client fetches the menu and sends option ids', () => {
  assert.match(client, /async options\(language: ChatLanguage\)/);
  assert.match(client, /questionId\?: string/);
  assert.match(client, /complaintDetails\?: string/);
  assert.match(client, /GuidedCategory/);
});

check('the panel offers topics and options, with no free question box for customers', () => {
  assert.match(panel, /MENU_TITLE/);
  assert.match(panel, /tapOption/);
  assert.match(panel, /aiAstrologer\.options\(language\)/);
  assert.match(panel, /questionId: option\.id/);
  assert.match(panel, /ADMIN_TEST_LABEL/);
  assert.match(panel, /isAdmin && !pendingOption/);
  // The only customer-facing textarea is the short complaint detail line.
  assert.match(panel, /maxLength=\{500\}/);
  assert.match(panel, /DETAILS_PLACEHOLDER\[language\]/);
  // No generic "ask anything" prompt survives for customers.
  assert.doesNotMatch(panel, /Ask about your chart\.\.\./);
  assert.doesNotMatch(panel, /உங்கள் கேள்வியை இங்கே எழுதுங்கள்/);
});

console.log(`\n[OK] ai-astrologer guided: ${passed} checks passed`);
