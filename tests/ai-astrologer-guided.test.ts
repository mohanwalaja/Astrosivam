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

check('the menu has the eight page-2 life topics, the three service reports, and dosha, remedy, order and complaint topics', () => {
  const ids = (guided.categories as any[]).map((c) => c.id);
  assert.deepEqual(ids, [
    'health', 'wealth', 'education', 'career', 'marriage', 'property',
    'travel-foreign', 'current-guidance',
    'wedding-match', 'baby-naming', 'muhurtham',
    'doshas', 'remedies', 'order', 'support',
  ]);
});

check('the three service chapters are gated on a delivered report of that service', () => {
  const gated = (guided.categories as any[]).filter((c) => Array.isArray(c.services));
  assert.deepEqual(gated.map((c) => c.id), ['wedding-match', 'baby-naming', 'muhurtham']);
  const services = new Set(['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM']);
  for (const category of gated) {
    assert.equal(category.services.length, 1, `${category.id} must name the one service it reads`);
    for (const service of category.services) {
      assert.ok(services.has(service), `${category.id} names an unknown service ${service}`);
    }
    // Every question in the chapter reads the same service.
    for (const q of category.questions as any[]) {
      assert.equal(q.service, category.services[0], `${q.id} must read the chapter's service`);
    }
  }
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

/** The topic each service chapter may be asked about, per service. */
const SERVICE_TOPICS: Record<string, string[]> = {
  MARRIAGE_COMPATIBILITY: ['verdict', 'score', 'poruthams', 'unmatched', 'sevvai', 'remedy'],
  BABY_NAMING: ['star', 'letters', 'suggestions', 'meaning', 'our-name'],
  MUHURTHAM: ['dates', 'best', 'why', 'avoid', 'place'],
};

check('every option routes to exactly one supported answer path', () => {
  const areaIds = new Set((lifeAreas.areas as any[]).map((a) => a.id));
  const grahas = new Set((remedies.grahas as any[]).map((g) => g.graha));
  for (const q of allQuestions()) {
    assert.ok(
      ['area', 'service', 'dosha', 'remedy', 'order', 'complaint'].includes(q.kind),
      `option ${q.id} has an unknown kind ${q.kind}`
    );
    if (q.kind === 'area') {
      assert.ok(areaIds.has(q.area), `option ${q.id} names an unknown life area ${q.area}`);
    }
    if (q.kind === 'service') {
      const topics = SERVICE_TOPICS[q.service] ?? [];
      assert.ok(topics.length > 0, `option ${q.id} names an unknown service ${q.service}`);
      assert.ok(topics.includes(q.topic), `option ${q.id} names an unknown ${q.service} topic ${q.topic}`);
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
  for (const kind of ['order', 'complaint', 'dosha', 'remedy', 'service']) {
    assert.match(offline, new RegExp(`\\$guidedKind === '${kind}'`));
  }
  assert.match(offline, /private static function orderBubbles\(/);
  assert.match(offline, /private static function doshaBubbles\(/);
  assert.match(offline, /private static function complaintAck\(/);
  assert.match(offline, /private static function templeText\(/);
  // The three service chapters read the customer's own report readings.
  for (const fn of ['serviceRoute', 'serviceAttachBubbles', 'matchingBubbles', 'namingBubbles', 'muhurthamBubbles']) {
    assert.match(offline, new RegExp(`private static function ${fn}\\(`));
  }
  assert.match(offline, /\$context\['serviceFacts'\]/);
  // A service question about a report that is not attached asks for it.
  assert.match(offline, /serviceAttachBubbles\(\$service, \$bound, \$lang, \$name\)/);
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
  // The client renders the chapters the server allows, and can attach a report.
  assert.match(client, /entitledServices: string\[\]/);
  assert.match(client, /orders: AttachableOrder\[\]/);
  assert.match(client, /async bind\(sessionId: string, orderNumber: string\)/);
  assert.match(client, /call\('bind', \{ sessionId, orderNumber \}\)/);
});

check('the endpoint serves the gated menu, the entitlement list and the attachable reports', () => {
  const options = sliceText(endpoint, 'function astro_ai_action_options', 'function astro_ai_service_title', 'options handler body');
  assert.match(options, /astro_ai_entitled_service_types\(\$pdo, \(string\) \$user\['id'\]\)/);
  assert.match(options, /astro_ai_attachable_orders\(\$pdo, \(string\) \$user\['id'\]\)/);
  assert.match(options, /astro_ai_guided_menu\(\$language, \$services, \$isAdmin\)/);
  assert.match(options, /'entitledServices' => \$services/);
  assert.match(options, /'orders' => \$orders/);
  // An administrator sees every chapter; a customer only their own.
  assert.match(options, /\$services = \$isAdmin \? \[\] : astro_ai_entitled_service_types/);

  // The gating itself: a chapter that names services needs one of them.
  const menu = sliceText(endpoint, 'function astro_ai_guided_menu', 'function astro_ai_action_options', 'menu builder body');
  assert.match(menu, /\$allowedServices = null/);
  assert.match(menu, /\$needs !== \[\] && !\$isAdmin/);
});

check('the endpoint attaches only a delivered report that belongs to the customer', () => {
  assert.match(endpoint, /function astro_ai_action_bind\(/);
  assert.match(endpoint, /case 'bind':\s*\n\s*astro_ai_action_bind\(\$pdo, \$user, \$body\);/);
  const bind = sliceText(endpoint, 'function astro_ai_action_bind', '/* ================================================================== */', 'bind handler body');
  // Ownership AND delivery in the query itself - never a client-supplied fact.
  assert.match(bind, /WHERE order_number = :num/);
  assert.match(bind, /AND user_id = :uid/);
  assert.match(bind, /payment_confirmed = 1/);
  assert.match(bind, /email_status = 'SENT'/);
  assert.match(bind, /email_sent_at IS NOT NULL/);
  assert.match(bind, /'code' => 'ORDER_NOT_FOUND'/);
  // The session being bound must belong to the same account.
  assert.match(bind, /astro_ai_load_session\(\$pdo, \$sessionId, \$user\['id'\]\)/);
});

check('a guided service option is refused when the account holds no such report', () => {
  const ask = sliceText(endpoint, 'function astro_ai_action_ask', 'function astro_ai_action_upload', 'ask handler body');
  assert.match(ask, /astro_ai_guided_required_services\(\$guided\)/);
  assert.match(ask, /\$required !== \[\] && !\$isAdmin/);
});

check('the reply context carries the bound report, so a service answer can read it', () => {
  const reply = sliceText(endpoint, 'function astro_ai_generate_reply', 'function astro_ai_escalation_reason', 'reply builder body');
  assert.match(reply, /astro_ai_service_facts\(\$order\)/);
  assert.match(reply, /\$context\['boundServiceType'\]/);
  assert.match(reply, /\$context\['serviceFacts'\]/);
  // One engine run per order per request, shared by both readings.
  assert.match(endpoint, /function astro_ai_report_result\(array \$order\)/);
  assert.match(reply, /astro_ai_chart_facts\(\$order\)/);
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

check('the panel can attach one of the customer reports, so the service chapters can answer', () => {
  assert.match(panel, /REPORT_LABEL/);
  assert.match(panel, /NO_REPORT/);
  assert.match(panel, /ATTACHED_NOTE/);
  assert.match(panel, /aiAstrologer\.bind\(sessionId, orderNumber\)/);
  assert.match(panel, /setOrders\(menu\.orders \?\? \[\]\)/);
  // Only the customer's own reports, offered by the server, are listed.
  assert.match(panel, /orders\.map\(\(o\) =>/);
  assert.doesNotMatch(panel, /orders\.push\(/);
});

console.log(`\n[OK] ai-astrologer guided: ${passed} checks passed`);
