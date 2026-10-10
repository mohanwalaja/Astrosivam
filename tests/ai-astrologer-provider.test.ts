/**
 * ASTRO SIVAM AI Astrologer — Part 5: prompt assembly and output guard.
 *
 * PHP cannot be executed here, so this is a static contract test. The most
 * valuable thing it does is prove the placeholder names in the PHP match the
 * placeholders in the prompt markdown: a typo on either side would silently ship
 * an empty CHART_HEADER or an unretrieved rule block, and nothing else would
 * catch it.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, sliceToEnd, assertNonEmptySet } from './helpers/sourceSlice';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const provider = read('api/astrology/ai_astrologer_provider.php');
const endpoint = read('api/ai_astrologer.php');
const promptMd = read('knowledge/ai-astrologer/prompt/system-prompt.md');
const guardrails = JSON.parse(read('knowledge/ai-astrologer/rules/guardrails.json'));
const lifeAreas = JSON.parse(read('knowledge/ai-astrologer/rules/life-areas.json'));

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

/** PHP source with comments and string contents removed. */
function codeNoStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/* ------------------------------------------------------------------ */

check('the prompt markdown contains exactly one extractable ```text block', () => {
  const blocks = [...promptMd.matchAll(/```text\s*\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1, `expected one \`\`\`text block, found ${blocks.length}`);
  const prompt = blocks[0][1];
  assert.ok(prompt.length > 4000, 'the extracted prompt looks truncated');
  // The provider's regex is the same shape as this one.
  assert.match(provider, /preg_match\('\/```text\\s\*\\n\(\.\*\?\)\\n```\/s'/);
  assert.match(prompt, /You are the ASTRO SIVAM AI Astrologer/);
});

check('every placeholder in the prompt is filled by the provider', () => {
  const block = promptMd.match(/```text\s*\n([\s\S]*?)\n```/)![1];
  const inPrompt = new Set([...block.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]));
  assert.ok(inPrompt.size >= 8, `only ${inPrompt.size} placeholders found in the prompt`);

  const filled = new Set([...provider.matchAll(/'([A-Z0-9_]+)'\s*=>/g)].map((m) => m[1]));
  const missing = [...inPrompt].filter((p) => !filled.has(p));
  assert.deepEqual(missing, [], `placeholders never filled: ${missing.join(', ')}`);
});

check('the provider fills nothing the prompt does not ask for', () => {
  const block = promptMd.match(/```text\s*\n([\s\S]*?)\n```/)![1];
  const inPrompt = new Set([...block.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]));
  const fillCall = sliceText(
    provider, 'self::fillPrompt(self::systemPrompt()', '$draft = null;', 'provider fillPrompt call'
  );
  assertNonEmptySet('placeholders filled by the provider', fillCall.matchAll(/'([A-Z0-9_]+)'\s*=>/g), 8);
  const filled = new Set([...fillCall.matchAll(/'([A-Z0-9_]+)'\s*=>/g)].map((m) => m[1]));
  const stray = [...filled].filter((p) => !inPrompt.has(p));
  assert.deepEqual(stray, [], `provider fills placeholders the prompt never declares: ${stray.join(', ')}`);
});

check('an unfilled placeholder is stripped rather than shown to the model', () => {
  assert.match(provider, /preg_replace\('\/\\\{\\\{\[A-Z0-9_\]\+\\\}\\\}\/', ''/);
});

check('the guard reads its banned phrases from guardrails.json, not a hardcoded list', () => {
  const guard = sliceText(provider, 'public static function checkReply', 'public static function fallbackReply', 'checkReply body');
  assert.match(guard, /self::kb\(self::GUARDRAILS_PATH\)/);
  assert.match(guard, /noGuarantees/);
  assert.match(guard, /noFrighteningLanguage/);
  // the doctor rule, which is the one that protects the health answers
  assert.match(guard, /health topic without advising a qualified doctor/);
  assert.match(guard, /மருத்துவர்/);
  assert.match(guard, /डॉक्टर/);
  // and the no-sales rule
  assert.match(guard, /sales language inside an answer/);
});

check('the guard actually has rules to enforce in every language', () => {
  for (const lang of ['en', 'ta', 'hi']) {
    assert.ok(guardrails.predictions.noGuarantees.banned[lang].length > 0, `no banned phrases for ${lang}`);
  }
  assert.ok(guardrails.predictions.noFrighteningLanguage.banned.length >= 5);
  // the Tamil and Hindi guarantee phrases really are Tamil and Hindi
  assert.ok(guardrails.predictions.noGuarantees.banned.ta.some((s: string) => /[\u0B80-\u0BFF]/.test(s)));
  assert.ok(guardrails.predictions.noGuarantees.banned.hi.some((s: string) => /[\u0900-\u097F]/.test(s)));
});

check('a rejected draft is retried once and then falls back, never a third try', () => {
  assert.match(provider, /MAX_GENERATION_ATTEMPTS = 2/);
  const answer = sliceText(provider, 'public static function answer', 'private static function remedyBlock', 'answer body');
  assert.match(answer, /for \(\$attempt = 1; \$attempt <= self::MAX_GENERATION_ATTEMPTS/);
  assert.match(answer, /self::fallbackReply\(\$language\)/);
  assert.match(answer, /'handoff' => true/, 'a non-compliant reply must escalate to a human');
  // the rejection reason is logged, and the model is told what it did wrong
  assert.match(answer, /error_log\('AI Astrologer guard rejected a draft/);
  assert.match(answer, /Rewrite it without those/);
});

check('the API key never leaves the server', () => {
  assert.match(provider, /getenv\('AI_ASTROLOGER_API_KEY'\)/);
  // logged context must not echo the key or the response body
  const answer = codeNoStrings(provider);
  assert.ok(!/error_log\([^)]*apiKey/.test(answer), 'the API key is written to the error log');
  assert.match(provider, /Log the status only/);
  // the key is sent only to the provider as an Authorization header
  assert.match(provider, /'Authorization: Bearer ' \. \$cfg\['apiKey'\]/);

  // The diagnostics endpoint reports WHERE the key came from, which is what
  // makes a misconfigured host debuggable - so the exposure has to be provably
  // partial. These three are what keeps that safe, and they matter more than a
  // raw count of how often the word appears does.
  assert.match(provider, /'keyHint' => self::mask\(/, 'diagnostics must expose a mask, never the value');
  assert.match(provider, /substr\(\$secret, -4\)/, 'the mask must reveal only the last four characters');
  assert.ok(
    !/'apiKey'\s*=>\s*\$cfg\['apiKey'\]/.test(provider),
    'the resolved config array must never be embedded in a response body'
  );
  assert.ok(
    !/jsonResponse\([^)]*apiKey/.test(codeNoStrings(endpoint)),
    'the endpoint must never put the key in a JSON response'
  );

  // A tripwire, not the guarantee: the key is legitimately read in more places
  // now (config, configSource, the empty-key guards in complete() and ping()),
  // but each new reference should be a deliberate one.
  const occurrences = [...provider.matchAll(/apiKey/g)].length;
  assert.ok(occurrences <= 10, `apiKey appears ${occurrences} times - every read should be deliberate`);
});

check('the reply is split into at most four bubbles', () => {
  const bubbles = sliceText(provider, 'public static function toBubbles', 'public static function answer', 'toBubbles body');
  assert.match(bubbles, /count\(\$bubbles\) > 4/);
  assert.match(bubbles, /array_slice\(\$bubbles, 0, 3\)/);
  // short fragments are merged, not sent as one-word messages
  assert.match(bubbles, /mb_strlen\(\$p, 'UTF-8'\) < 40/);
});

check('the source line rides on the last bubble', () => {
  const answer = sliceText(provider, 'public static function answer', 'private static function remedyBlock', 'answer body');
  assert.ok(
    answer.includes(`$bubbles[count($bubbles) - 1] .= "\\n" . $retrieved['sourceLine']`),
    'the source line is not appended to the final bubble'
  );
});

check('the PHP retrieval honours the same two rules the TS spec pins', () => {
  // Card 8 is a fallback: areas with no houseAnchors go to a separate pool.
  assert.match(provider, /if \(empty\(\$area\['houseAnchors'\]\)\)/);
  assert.match(provider, /\$pool = \$ranked \?: \$fallback/);
  // Without a chart, only 'always' and customerSays conditions may fire.
  const evaluate = sliceText(
    provider, 'public static function evaluateCondition', 'private static function phraseHit',
    'evaluateCondition body'
  );
  assert.match(evaluate, /if \(\$chart === null\)/);
  assert.match(evaluate, /'always'/);
  assert.match(evaluate, /customerSays/);
  // suppressed rules never reach the prompt
  assert.match(provider, /'suppressed'/);
});

check('every condition type in the rule base has a PHP branch', () => {
  const used = new Set<string>();
  for (const area of lifeAreas.areas) {
    const walk = (c: any) => {
      if (!c) return;
      used.add(c.type);
      for (const sub of c.conditions ?? []) walk(sub);
    };
    for (const r of area.rules) walk(r.condition);
  }
  const evaluate = sliceText(
    provider, 'public static function evaluateCondition', 'private static function phraseHit',
    'evaluateCondition body'
  );
  assertNonEmptySet('condition types used by the rule base', used, 8);
  const missing = [...used].filter((t) => !new RegExp(`case '${t}':`).test(evaluate));
  assert.deepEqual(missing, [], `rule conditions with no PHP branch: ${missing.join(', ')}`);
});

check('suppressed and excluded sources can never reach the prompt', () => {
  assert.match(provider, /if \(\(\$s\['level'\] \?\? 'book'\) === 'suppressed'\)/);
  // no Hindi source may be retrievable, per owner decision 4
  const allIds = new Set<string>(lifeAreas.areas.flatMap((a: any) => a.rules.flatMap((r: any) => r.source.map((s: any) => s.id))));
  for (const id of allIds) assert.ok(!id.startsWith('HI-'), `rule base cites excluded Hindi source ${id}`);
});

check('the endpoint hands the provider everything it needs', () => {
  assert.match(endpoint, /AstroAiProvider::answer\(\$question, \$language, \$history, \$chart, \$context\)/);
  assert.match(endpoint, /'chartHeader'/);
  assert.match(endpoint, /'customerName'/);
  assert.match(endpoint, /'chatHistory'/);
  // the chart is rebuilt from saved inputs, never from a cached result
  assert.match(endpoint, /rebuildReportResultFromSavedInputs/);
  assert.match(endpoint, /never from a cached calculated_result/);
});

check('a chart that cannot be built declines rather than guessing', () => {
  assert.match(endpoint, /function astro_ai_chart_facts\(array \$order\): \?array/);
  const facts = sliceToEnd(endpoint, 'function astro_ai_chart_facts', 'astro_ai_chart_facts');
  assert.match(facts, /return null/);
  assert.match(facts, /error_log\('AI Astrologer: chart rebuild failed/);
  // Only a Birth Jathagam result (planetPositions + dasha) yields chart facts;
  // anything else declines instead of feeding the rules an empty chart.
  assert.match(facts, /is_array\(\$result\['planetPositions'\] \?\? null\)/);
  assert.match(facts, /'summary' =>/, 'the report readings must reach knowledge-base mode');
});

check('the provider includes resolve relative to this file, never to the wrong directory', () => {
  // The provider lives in api/astrology/, so config.php is one level up and
  // the knowledge base is two levels up (repo root / document root). Requiring
  // '/config.php' here shipped as a fatal empty-500 on every chat request.
  assert.match(provider, /require_once __DIR__ \. '\/\.\.\/config\.php'/);
  assert.doesNotMatch(provider, /require_once __DIR__ \. '\/config\.php'/);
  assert.match(provider, /dirname\(__DIR__, 2\) \. \$rel/);
});

check('an unmatched question consults more sources before admitting it has nothing', () => {
  // retrieve() keeps its strict semantics (the TS/PHP parity tests guard it);
  // the multi-source fallback lives in answer() and must only fire when no
  // rule matched.
  assert.match(provider, /public static function consultMoreSources\(/);
  assert.match(provider, /self::consultMoreSources\(\$question, \$language, \$chart\)/);
  const fallback = sliceText(provider, 'public static function consultMoreSources', 'public static function evaluateCondition', 'consultMoreSources body');
  assert.match(fallback, /LIFE_AREAS_PATH/, 'fallback must search every life-area card');
  assert.match(fallback, /REMEDIES_PATH/, 'fallback must search the remedies registry');
  assert.match(fallback, /Consulted: /, 'the consulted sources must be named for the customer');
  // An empty consultation answers as LABELLED general Tamil guidance, never as a rule.
  assert.match(fallback, /general guidance, not a reading/, 'a no-match answer must be labelled as general guidance');
  assert.match(fallback, /TAMIL SOURCES list/, 'a no-match answer may only name the Tamil source list');
  // answer() only swaps the fallback in when the strict retrieval found nothing.
  const answer = sliceText(provider, 'public static function answer', 'private static function remedyBlock', 'answer body');
  assert.match(answer, /if \(\$rulesBlock === ''\) \{\s*\/\/ No life-area card matched directly/);
  assert.match(answer, /'ORDER_DETAILS' =>/, 'the customer\'s own order facts must reach the prompt');
});

check('the model call fails loudly and never returns a degraded answer', () => {
  const complete = sliceText(provider, 'public static function complete', 'public static function toBubbles', 'complete body');
  assert.match(complete, /throw new RuntimeException\('AI_ASTROLOGER_API_KEY is not set/);
  assert.match(complete, /throw new RuntimeException\('Model returned an empty completion\.'\)/);
  assert.match(complete, /CURLOPT_TIMEOUT/);
  assert.match(complete, /CURLINFO_HTTP_CODE/);
  assert.match(provider, /isConfigured\(\)/);
});

console.log(`\n[OK] ai-astrologer provider: ${passed} checks passed`);
