/**
 * Source-based astrologer failure and local-only wiring contracts.
 *
 * The original failure involved a missing external API key. That dependency is
 * retired: today failures must be explained through local PHP/knowledge checks,
 * and no retry or diagnostic may contact an external model.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, sliceToEnd } from './helpers/sourceSlice';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const provider = read('api/astrology/ai_astrologer_provider.php');
const endpoint = read('api/ai_astrologer.php');
const panel = read('src/components/ai-astrologer/AiAstrologerPanel.tsx');
const client = read('src/services/aiAstrologerApi.ts');
const deploySh = read('deploy_cpanel.sh');
const setupPanel = read('src/components/admin/SetupChecklistPanel.tsx');
const providerAdmin = read('src/components/admin/AiAstrologerConfigPanel.tsx');

const code = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/^\s*#(?!\[).*$/gm, '');

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

check('a failed reply returns the composer to idle', () => {
  const sendBody = sliceText(panel, 'const send = async (text: string)', 'const retry = ()', 'send handler');
  assert.doesNotMatch(panel, /setPhase\('failed'\)|\| 'failed'/);
  assert.match(sendBody, /setPhase\('idle'\)/);
});

check('retry resends the unanswered question instead of only clearing the error', () => {
  const retry = sliceText(panel, 'const retry = ()', 'const handoff = async', 'retry handler');
  assert.match(retry, /void send\(question\)/);
  assert.match(retry, /role === 'customer'/);
  assert.match(panel, /setFailedQuestion\(question\)/);
  assert.match(panel, /onClick=\{retry\}/);
});

check('local setup failures show the server message while transient failures keep retry wording', () => {
  const sendBody = sliceText(panel, 'const send = async (text: string)', 'const retry = ()', 'send handler');
  assert.match(sendBody, /err\.isSetupProblem/);
  assert.match(sendBody, /isSetupProblem[\s\S]{0,600}?setError\(err\.message\)/);
  assert.match(sendBody, /setError\(RETRY_TEXT\[language\]\)/);
  assert.match(client, /get isSetupProblem\(\)/);
  assert.match(client, /this\.code === 'LOCAL_KNOWLEDGE_UNAVAILABLE'/);
  assert.match(endpoint, /'code' => 'LOCAL_KNOWLEDGE_UNAVAILABLE'/);
});

check('a missing local knowledge base is explained in all supported languages', () => {
  const refusal = sliceText(endpoint, 'if (!AstroAiProvider::canAnswer())', "$sessionId = trim((string) ($body['sessionId']", 'local setup refusal');
  for (const key of ['message_ta', 'message_hi']) {
    assert.match(refusal, new RegExp(`'${key}'`));
  }
  assert.match(refusal, /local astrology knowledge base is missing/i);
  assert.match(refusal, /astro_ai_is_admin\(\$user\)/);
});

check('the endpoint does not load saved provider settings and only calls local answer generation', () => {
  const endpointCode = code(endpoint);
  assert.doesNotMatch(endpointCode, /astro_ai_load_provider_settings|AstroAiProvider::configure|AstroAiProvider::complete/);
  assert.doesNotMatch(endpoint, /AI_ASTROLOGER_API_KEY|AI_ASTROLOGER_BASE_URL|AI_ASTROLOGER_MODEL/);
  assert.match(endpoint, /AstroAiProvider::answerFromKnowledgeBase\(\$question, \$language, \$chart, \$context\)/);
  assert.match(provider, /return self::answerFromKnowledgeBase\(\$question, \$language, \$chart, \$context\)/);
});

check('the admin diagnostic is admin-only and never pings an external service', () => {
  const diagnose = sliceText(endpoint, 'function astro_ai_action_diagnose(', '/* ================================================================== */\n/* Generation', 'diagnostic action');
  assert.match(diagnose, /astro_ai_is_admin\(\$user\)/);
  assert.match(diagnose, /403/);
  assert.match(diagnose, /AstroAiProvider::diagnostics\(false\)/);
  assert.match(diagnose, /'sourceRegistry'\s*=>\s*\$diagnostics\['sourceRegistry'\]/);
  assert.doesNotMatch(diagnose, /AstroAiProvider::ping\(/);
  assert.match(diagnose, /Ignore legacy ping requests/);
});

check('diagnostics cover local runtime/data dependencies rather than curl or model settings', () => {
  const diagnostics = sliceToEnd(provider, 'public static function diagnostics(', 'diagnostics method');
  for (const id of ['mbstring', 'guardrails', 'lifeAreas', 'remedies', 'sources', 'sourceLibrary']) {
    assert.ok(diagnostics.includes(id), `diagnostics must include ${id}`);
  }
  assert.match(diagnostics, /'kb-' \. \$id/);
  assert.doesNotMatch(diagnostics, /'curl'|'apiKey'|'modelPing'|'systemPrompt'/);
  assert.match(diagnostics, /sourceRegistry/);
  assert.match(diagnostics, /Catalogue records are not full-text books/);
});

check('both admin screens use local diagnostics and no model ping', () => {
  assert.match(setupPanel, /aiAstrologer\.diagnose\(\)/);
  assert.doesNotMatch(setupPanel, /diagnose\(true\)|live model call/i);
  assert.match(setupPanel, /chk-ai-1/);
  assert.match(setupPanel, /Local Astrologer Knowledge Base/);
  assert.match(providerAdmin, /aiAstrologer\.diagnose\(\)/);
  assert.match(providerAdmin, /Check local knowledge base/);
  assert.match(providerAdmin, /Legacy provider settings or server keys, if any, are ignored/);
});

check('the browser client exposes only the authenticated local diagnostic action', () => {
  assert.match(client, /async diagnose\(\)/);
  assert.match(client, /call\('diagnose', \{\}, 'GET'/);
  assert.doesNotMatch(client, /ping\s*=\s*false|diagnose\(ping/);
});

check('both deployment paths copy the complete local knowledge directory', () => {
  assert.match(deploySh, /find knowledge -type f/);
  assert.match(deploySh, /WARNING: no knowledge\//);
  assert.match(deploySh, /source-based astrologer cannot answer/);
});

check('the frontend response cap remains bounded without provider timeout budgets', () => {
  assert.match(panel, /hardCap:\s*12000/);
  assert.doesNotMatch(provider, /CURL_TIMEOUT_SECONDS|CURL_RETRY_TIMEOUT_SECONDS|MAX_GENERATION_ATTEMPTS/);
  assert.doesNotMatch(provider, /curl_init|CURLOPT_/);
});

check('the output guard deduplicates banned phrases and reads local guardrails', () => {
  const guard = sliceText(provider, 'public static function checkReply(', '/** The safe reply used when a draft', 'output guard');
  assert.match(guard, /self::kb\(self::GUARDRAILS_PATH\)/);
  assert.match(guard, /array_unique/);
});

check('every sprintf in the local PHP layer has the required number of arguments', () => {
  const src = code(provider);
  const argList = (open: number): string => {
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) return src.slice(open + 1, i);
      }
    }
    throw new Error('unbalanced sprintf call');
  };
  const splitTopLevel = (text: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let current = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        current += ch;
        if (ch === '\\') current += text[++i] ?? '';
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') quote = ch;
      else if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current);
    return parts.map((part) => part.trim()).filter(Boolean);
  };
  let scanned = 0;
  let cursor = 0;
  while ((cursor = src.indexOf('sprintf(', cursor)) >= 0) {
    const parts = splitTopLevel(argList(cursor + 'sprintf'.length));
    const literals = [...parts[0].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
      .map((match) => match[1] ?? match[2] ?? '')
      .join('');
    const placeholders = (literals.match(/%[sdfu]/g) || []).length;
    const args = parts.length - 1;
    scanned++;
    assert.equal(args, placeholders, `sprintf has ${placeholders} placeholder(s) but ${args} argument(s): ${literals.slice(0, 70)}`);
    cursor += 'sprintf('.length;
  }
  assert.ok(scanned >= 1, `expected at least 1 sprintf call, found ${scanned}`);
});

console.log(`\n[OK] ai-astrologer local failure path: ${passed} checks passed`);
