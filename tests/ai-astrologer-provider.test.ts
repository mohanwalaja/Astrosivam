/**
 * ASTRO SIVAM source-based astrologer — local reply and safety contracts.
 *
 * The customer path is intentionally deterministic/local-only. These checks
 * protect its wiring, data boundaries, source limits, and the hard guarantee
 * that no credential, network client, or external model is involved.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, sliceToEnd, assertNonEmptySet } from './helpers/sourceSlice';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const provider = read('api/astrology/ai_astrologer_provider.php');
const offline = read('api/astrology/ai_astrologer_offline.php');
const endpoint = read('api/ai_astrologer.php');
const admin = read('api/admin/index.php');
const envExample = read('.env.example');
const panel = read('src/components/admin/AiAstrologerConfigPanel.tsx');
const guardrails = JSON.parse(read('knowledge/ai-astrologer/rules/guardrails.json'));
const lifeAreas = JSON.parse(read('knowledge/ai-astrologer/rules/life-areas.json'));
const sourceRegistry = JSON.parse(read('knowledge/ai-astrologer/sources.json'));

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

check('the customer reply path delegates to the local answer builder', () => {
  const answer = sliceText(provider, 'public static function answer(', '/** At most three affordable remedies', 'compatibility answer');
  assert.match(answer, /return self::answerFromKnowledgeBase\(\$question, \$language, \$chart, \$context\)/);
  const local = sliceText(provider, 'public static function answerFromKnowledgeBase(', '/**\n     * Resolve a knowledge-base file', 'local answer adapter');
  assert.match(local, /require_once __DIR__ \. '\/ai_astrologer_offline\.php'/);
  assert.match(local, /AstroAiOffline::answer\(\$question, \$language, \$chart, \$context\)/);
  assert.match(endpoint, /AstroAiProvider::answerFromKnowledgeBase\(\$question, \$language, \$chart, \$context\)/);
});

check('the provider cannot read a key or make an external request', () => {
  assert.doesNotMatch(provider, /AI_ASTROLOGER_API_KEY|\bgetenv\s*\(|\$_SERVER\s*\[|\$_ENV\s*\[/);
  assert.doesNotMatch(provider, /curl_init|CURLOPT_|Authorization:\s*Bearer|file_get_contents\s*\(\s*['"]https?:/i);
  const complete = sliceText(provider, 'public static function complete(', '/** A compatibility stub', 'disabled completion method');
  assert.match(complete, /throw new RuntimeException/);
  assert.match(complete, /disabled/i);
});

check('legacy ping and diagnostics are permanently local-only', () => {
  const ping = sliceText(provider, 'public static function ping(', 'public static function diagnostics(', 'ping stub');
  assert.match(ping, /'attempted'\s*=>\s*false/);
  const diagnostics = sliceToEnd(provider, 'public static function diagnostics(', 'diagnostics method');
  assert.match(diagnostics, /'attempted'\s*=>\s*false/);
  assert.match(diagnostics, /'sourceRegistry'\s*=>\s*\$stats/);
  assert.match(diagnostics, /Catalogue records are not full-text books/);
  assert.match(endpoint, /AstroAiProvider::diagnostics\(false\)/);
  assert.match(endpoint, /Ignore legacy ping requests/);
});

check('source statistics match the current registry without claiming full-text coverage', () => {
  const counts = new Map<string, number>();
  for (const source of sourceRegistry.sources) {
    const level = source.verification || 'unknown';
    counts.set(level, (counts.get(level) || 0) + 1);
  }
  assert.equal(sourceRegistry.sources.length, 224);
  assert.equal(sourceRegistry.excludedSources.length, 13);
  assert.equal(counts.get('content-read'), 11);
  assert.equal(counts.get('metadata-verified'), 144);
  assert.equal(counts.get('linked-not-opened'), 67);
  assert.equal(counts.get('catalogue-verified'), 1);
  assert.equal(counts.get('dead'), 1);
  assert.match(panel, /catalogue, not 224 complete books/i);
  assert.match(panel, /Only 11 records are marked content-read/i);
});

check('legacy API-key settings are not returned or persisted by admin settings', () => {
  assert.match(admin, /unset\(\$settings\['aiAstrologerSettings'\]\)/);
  assert.match(admin, /unset\(\$body\['aiAstrologerSettings'\]\)/);
  assert.match(admin, /unset\(\$mergedGeneral\['aiAstrologerSettings'\]\)/);
  assert.doesNotMatch(envExample, /AI_ASTROLOGER_API_KEY|AI_ASTROLOGER_BASE_URL|AI_ASTROLOGER_MODEL/);
  assert.match(envExample, /AI_ASTROLOGER_DAILY_LIMIT/);
});

check('local health checks describe the required PHP and knowledge files only', () => {
  const diagnostics = sliceToEnd(provider, 'public static function diagnostics(', 'diagnostics method');
  for (const id of ['localMode', 'mbstring', 'guardrails', 'lifeAreas', 'remedies', 'sources', 'sourceLibrary']) {
    assert.ok(diagnostics.includes(id), `missing local diagnostic ${id}`);
  }
  assert.match(diagnostics, /'kb-' \. \$id/);
  assert.doesNotMatch(diagnostics, /'curl'|'apiKey'|'modelPing'|'systemPrompt'/);
  assert.match(diagnostics, /External model checks are disabled; no network request was made/);
});

check('source catalogue paths resolve relative to the application, not a provider URL', () => {
  assert.match(provider, /require_once __DIR__ \. '\/\.\.\/config\.php'/);
  assert.match(provider, /dirname\(__DIR__, 2\) \. \$rel/);
  assert.match(provider, /dirname\(__DIR__\) \. \$rel/);
});

check('the local guard reads reviewed safety rules and rejects unsafe answers', () => {
  const guard = sliceText(provider, 'public static function checkReply(', '/** The safe reply used when a draft', 'checkReply body');
  assert.match(guard, /self::kb\(self::GUARDRAILS_PATH\)/);
  assert.match(guard, /noGuarantees/);
  assert.match(guard, /noFrighteningLanguage/);
  assert.match(guard, /health topic without advising a qualified doctor/);
  assert.match(guard, /sales language inside an answer/);
  for (const lang of ['en', 'ta', 'hi']) {
    assert.ok(guardrails.predictions.noGuarantees.banned[lang].length > 0, `no banned phrases for ${lang}`);
  }
  assert.ok(guardrails.predictions.noFrighteningLanguage.banned.length >= 5);
  assert.ok(guardrails.predictions.noGuarantees.banned.ta.some((s: string) => /[\u0B80-\u0BFF]/.test(s)));
  assert.ok(guardrails.predictions.noGuarantees.banned.hi.some((s: string) => /[\u0900-\u097F]/.test(s)));
});

check('chart-condition matching has a PHP branch for every condition in the local rules', () => {
  const evaluate = sliceText(provider, 'public static function evaluateCondition', 'private static function phraseHit', 'condition evaluator');
  const used = new Set<string>();
  for (const area of lifeAreas.areas) {
    const walk = (condition: any) => {
      if (!condition) return;
      used.add(condition.type);
      for (const sub of condition.conditions ?? []) walk(sub);
    };
    for (const rule of area.rules) walk(rule.condition);
  }
  assertNonEmptySet('condition types used by the rule base', used, 8);
  const missing = [...used].filter((type) => !new RegExp(`case '${type}':`).test(evaluate));
  assert.deepEqual(missing, [], `condition types with no PHP branch: ${missing.join(', ')}`);
  assert.match(evaluate, /if \(\$chart === null\)/);
  assert.match(evaluate, /'always'/);
  assert.match(evaluate, /customerSays/);
});

check('suppressed and non-Tamil references cannot be shown as customer citations', () => {
  assert.match(provider, /\(\$s\['level'\] \?\? 'book'\) === 'suppressed'/);
  const citedIds = new Set<string>(lifeAreas.areas.flatMap((area: any) => area.rules.flatMap((rule: any) => rule.source.map((source: any) => source.id))));
  for (const id of citedIds) assert.ok(!id.startsWith('HI-'), `rule base cites excluded Hindi source ${id}`);
  assert.match(provider, /tamilOnlySourceLine/);
  assert.match(offline, /AstroAiProvider::tamilOnlySourceLine/);
});

check('the report chart is rebuilt from the authenticated customer order', () => {
  assert.match(endpoint, /AstroEngine::rebuildReportResultFromSavedInputs\(\$order\)/);
  assert.match(endpoint, /never from a cached calculated_result/);
  assert.match(endpoint, /if \(!AstroAiProvider::canAnswer\(\)\)/);
  const generation = sliceText(endpoint, 'function astro_ai_generate_reply(', '/** Trilingual complaint/escalation keywords', 'reply builder');
  assert.match(generation, /AstroAiProvider::answerFromKnowledgeBase/);
  assert.doesNotMatch(generation, /systemPrompt|complete\(|ping\(/);
});

check('customer diagnostics expose accurate source-registry counts', () => {
  const diagnose = sliceText(endpoint, 'function astro_ai_action_diagnose(', '/* ================================================================== */\n/* Generation', 'diagnostic action');
  assert.match(diagnose, /astro_ai_is_admin\(\$user\)/);
  assert.match(diagnose, /'sourceRegistry'\s*=>\s*\$diagnostics\['sourceRegistry'\]/);
  assert.match(diagnose, /AstroAiProvider::diagnostics\(false\)/);
  assert.doesNotMatch(diagnose, /AstroAiProvider::ping\(/);
});

console.log(`\n[OK] ai-astrologer local provider: ${passed} checks passed`);
