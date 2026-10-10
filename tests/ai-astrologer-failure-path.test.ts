/**
 * ASTRO SIVAM AI Astrologer — the failure path.
 *
 * WHY THIS FILE EXISTS
 * The chat once answered nothing at all and every question ended on the same
 * line, "Please give me a moment, I am checking again." Four separate defects
 * produced that one symptom, and none of the existing suites covered any of
 * them because they all test the happy path: the client discarded the server's
 * explanation, one failure froze the composer so later questions were never
 * sent, the API key was readable only through getenv(), and the SSH deploy
 * script did not copy the knowledge base that the prompt is read from.
 *
 * These are static contract checks, like the rest of the PHP suites here. The
 * generation layer itself is executed for real by
 * tests/ai-astrologer-php-runtime.test.ts when the wasm PHP runtime is
 * available; this file is what still guards the wiring when it is not.
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
const deployYml = read('.cpanel.yml');
const setupPanel = read('src/components/admin/SetupChecklistPanel.tsx');

/** PHP source with comments removed, so prose cannot satisfy a structural check. */
const code = (src: string) =>
  src
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

/* ------------------------------------------------------------------ */
/* 1. The client must not freeze after one failure                     */
/* ------------------------------------------------------------------ */

check('a failed reply returns the composer to idle instead of locking it', () => {
  const sendBody = sliceText(panel, 'const send = async (text: string)', 'const retry = ()', 'send handler');
  // 'failed' is not a phase any more: with it set, send() returned early and the
  // send button stayed disabled, so every later question was silently dropped.
  assert.doesNotMatch(
    panel,
    /setPhase\('failed'\)/,
    'the panel must never park the phase at failed - that disabled the composer for the rest of the session'
  );
  assert.doesNotMatch(panel, /\| 'failed'/, "the phase union must not include 'failed'");
  assert.match(
    sendBody,
    /setPhase\('idle'\)/,
    'the catch block must return the phase to idle so the customer can ask again'
  );
});

check('the retry action resends the question that got no answer', () => {
  const retry = sliceText(panel, 'const retry = ()', 'const handoff = async', 'retry handler');
  assert.match(retry, /void send\(question\)/, 'Retry must resend, not just clear the error');
  assert.match(
    retry,
    /role === 'customer'/,
    'Retry must drop the unanswered question bubble so the chat does not show it twice'
  );
  assert.match(panel, /setFailedQuestion\(question\)/, 'the failed question must be remembered');
  assert.match(panel, /onClick=\{retry\}/, 'the error bar button must call retry');
});

/* ------------------------------------------------------------------ */
/* 2. The server's explanation must reach the screen                   */
/* ------------------------------------------------------------------ */

check('a configuration failure shows the server message, not the retry wording', () => {
  const sendBody = sliceText(panel, 'const send = async (text: string)', 'const retry = ()', 'send handler');
  assert.match(sendBody, /err\.isSetupProblem/, 'the panel must distinguish a setup problem from a transient one');
  assert.match(
    sendBody,
    /isSetupProblem[\s\S]{0,600}?setError\(err\.message\)/,
    'a setup problem must surface the server wording'
  );
  // The generic line must still exist, and must still be the fallback.
  assert.match(sendBody, /setError\(RETRY_TEXT\[language\]\)/, 'transient failures keep the retry wording');
});

check('the client can tell a setup problem from a slow model', () => {
  assert.match(client, /get isSetupProblem\(\)/, 'AiAstrologerError must expose isSetupProblem');
  assert.match(client, /this\.code === 'AI_NOT_CONFIGURED'/, 'the setup code must be the one the endpoint returns');
  assert.match(endpoint, /'code' => 'AI_NOT_CONFIGURED'/, 'the endpoint must label the refusal');
});

check('the endpoint refuses only when the knowledge base is missing, in all three languages', () => {
  const refusal = sliceText(
    endpoint,
    'if (!AstroAiProvider::canAnswer())',
    '$sessionId = trim((string) ($body[\'sessionId\']',
    'not-configured refusal'
  );
  for (const key of ['message_ta', 'message_hi']) {
    assert.match(refusal, new RegExp(`'${key}'`), `the refusal needs a ${key} so the customer is told in their language`);
  }
  assert.match(refusal, /astro_ai_is_admin\(\$user\)/, 'only an administrator may receive the diagnostic detail');
});

/* ------------------------------------------------------------------ */
/* 3. The API key must be findable on a shared host                    */
/* ------------------------------------------------------------------ */

check('the provider resolves the key from every place a host can put it', () => {
  const envValue = sliceText(provider, 'private static function envValue(', 'private static function pick(', 'envValue');
  assert.match(envValue, /getenv\(\$name\)/, 'the process environment must still be read first');
  assert.match(envValue, /\$_SERVER\[\$name\]/, 'cPanel SetEnv under LiteSpeed/PHP-FPM lands in $_SERVER');
  assert.match(envValue, /\$_ENV\[\$name\]/, 'some hosts populate $_ENV instead');
});

check('a placeholder key is treated as unset rather than attempted', () => {
  const placeholder = sliceText(provider, 'private static function isPlaceholder(', 'private static function envValue(', 'isPlaceholder');
  assert.match(placeholder, /your\[-_ \]\?\(\?:secret\|token\|api\[-_ \]\?key\|key\)/, 'the .env.example placeholder must be rejected');
  assert.match(placeholder, /\\\*\+\$/, 'a masked secret echoed back by the admin UI must be rejected');
  const source = sliceText(provider, 'public static function configSource(', 'private static function mask(', 'configSource');
  assert.match(source, /'placeholder-only'/, 'a placeholder must be reported as its own state, not as "not set"');
});

check('the endpoint loads admin-saved model settings before asking isConfigured()', () => {
  assert.match(code(endpoint), /function astro_ai_load_provider_settings\(/, 'a settings loader must exist');
  assert.match(endpoint, /general_settings FROM system_settings/, 'it must read the same row the other credentials use');
  assert.match(endpoint, /aiAstrologerSettings/, 'the key must be namespaced like chatAlertSettings');
  assert.match(code(endpoint), /AstroAiProvider::configure\(/, 'the provider must be given the stored values');
  const dispatch = sliceToEnd(code(endpoint), 'try {\n    $pdo = getDbConnection();');
  const loadAt = dispatch.indexOf('astro_ai_load_provider_settings($pdo)');
  const askAt = dispatch.indexOf("case 'ask':");
  assert.ok(loadAt >= 0, 'the dispatcher must call the settings loader');
  assert.ok(askAt > loadAt, 'settings must be applied before any action can reach the model');
});

/* ------------------------------------------------------------------ */
/* 4. The cause must be discoverable                                   */
/* ------------------------------------------------------------------ */

check('there is an admin-only diagnose action that names the broken step', () => {
  const diagnose = sliceText(endpoint, 'function astro_ai_action_diagnose(', '/* ================================================================== */\n/* Generation', 'diagnose action');
  assert.match(diagnose, /astro_ai_is_admin\(\$user\)/, 'diagnostics are admin-only');
  assert.match(diagnose, /403/, 'a non-admin must be refused');
  assert.match(diagnose, /AstroAiProvider::diagnostics\(/, 'it must report the provider checks');
  assert.match(diagnose, /ai_chat_messages/, 'it must summarise recent failures');
  assert.match(code(endpoint), /case 'diagnose':/, 'the action must be dispatched');
});

check('the diagnostics cover every step that can silently fail', () => {
  const diag = sliceText(provider, 'public static function diagnostics(', "Splits the model's answer into the 2-4 bubbles", 'diagnostics');
  for (const id of ['curl', 'apiKey', 'kb-prompt', 'systemPrompt', 'modelPing']) {
    assert.ok(diag.includes(`'${id.split('-')[0]}`) || diag.includes(id), `diagnostics must check ${id}`);
  }
  assert.match(diag, /MISSING at/, 'a missing knowledge file must say where it looked');
  assert.match(diag, /deploy_cpanel\.sh/, 'the fix for a missing knowledge base must be named');
});

check('the admin panel can run the real check', () => {
  assert.match(setupPanel, /aiAstrologer\.diagnose\(true\)/, 'the panel must call the diagnose action with a live ping');
  assert.match(setupPanel, /handleRunAiCheck/, 'there must be a handler for it');
  assert.match(setupPanel, /chk-ai-1/, 'the result must appear on the checklist');
  assert.match(setupPanel, /Not checked yet/, 'before the check runs the item must not imply the chat works');
});

check('the client exposes the diagnose action', () => {
  assert.match(client, /async diagnose\(/, 'aiAstrologer.diagnose must exist');
  assert.match(client, /call\('diagnose'/, 'it must go through the authenticated endpoint');
});

/* ------------------------------------------------------------------ */
/* 5. The deploy must ship the knowledge base                          */
/* ------------------------------------------------------------------ */

check('both deployment paths copy the knowledge base', () => {
  assert.match(deployYml, /find knowledge -type f/, '.cpanel.yml already copied it');
  assert.match(deploySh, /find knowledge -type f/, 'deploy_cpanel.sh must copy it too');
  assert.match(
    deploySh,
    /WARNING: no knowledge\//,
    'a checkout without knowledge/ must warn, because the chat cannot answer without it'
  );
});

/* ------------------------------------------------------------------ */
/* 6. The answer must fit inside the browser's patience                */
/* ------------------------------------------------------------------ */

check('two generation attempts cannot outlast the client abort', () => {
  const clientAbort = Number(client.match(/ASK_TIMEOUT_MS = (\d+)/)?.[1]);
  assert.ok(clientAbort > 0, 'the client abort must be defined');
  const first = Number(provider.match(/const CURL_TIMEOUT_SECONDS = (\d+)/)?.[1]);
  const retry = Number(provider.match(/const CURL_RETRY_TIMEOUT_SECONDS = (\d+)/)?.[1]);
  const attempts = Number(provider.match(/const MAX_GENERATION_ATTEMPTS = (\d+)/)?.[1]);
  assert.ok(first > 0 && retry > 0 && attempts >= 2, 'the budget constants must all be present');
  const worstCaseSeconds = first + retry * (attempts - 1);
  assert.ok(
    worstCaseSeconds * 1000 < clientAbort,
    `worst case ${worstCaseSeconds}s of model time must fit inside the client's ${clientAbort / 1000}s abort`
  );
  // And the retry must actually use the short budget.
  const answerBody = sliceText(provider, 'public static function answer(', 'private static function remedyBlock(', 'answer path');
  assert.match(answerBody, /self::CURL_RETRY_TIMEOUT_SECONDS/, 'the guard retry must use the short timeout');
});

/* ------------------------------------------------------------------ */
/* 7. The guard must name each fault once                              */
/* ------------------------------------------------------------------ */

check('the output guard deduplicates the banned-phrase list', () => {
  const guard = sliceText(provider, 'public static function checkReply(', '/** The safe reply used when a draft', 'output guard');
  assert.match(guard, /array_unique/, 'en merges the same list twice, so the retry instruction would repeat every fault');
});

/* ------------------------------------------------------------------ */
/* 8. sprintf must be given the arguments it asks for                  */
/* ------------------------------------------------------------------ */

check('every sprintf in the AI layer has as many arguments as placeholders', () => {
  // A sprintf with too few arguments throws ArgumentCountError instead of the
  // intended exception, which turns a useful diagnostic into "5 arguments are
  // required, 4 given" in the log - exactly the failure this file exists to
  // prevent. This really happened: the model-call error branch shipped with
  // four placeholders and three arguments.
  const src = code(provider);

  /** The full argument list of the call starting at `open`, paren-balanced. */
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
    throw new Error('unbalanced sprintf call - the scan reached the end of the file');
  };

  /** Splits on commas that are not inside a nested call, array or string. */
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
    return parts.map((p) => p.trim()).filter((p) => p !== '');
  };

  let scanned = 0;
  let cursor = 0;
  while ((cursor = src.indexOf('sprintf(', cursor)) >= 0) {
    const list = argList(cursor + 'sprintf'.length);
    const parts = splitTopLevel(list);
    // The format is the first argument, which may be several literals joined
    // with '.', the way every long message in this file is written.
    const literals = [...parts[0].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => m[1] ?? m[2] ?? '')
      .join('');
    const placeholders = (literals.match(/%[sdfu]/g) || []).length;
    const args = parts.length - 1;
    scanned += 1;
    assert.equal(
      args,
      placeholders,
      `sprintf has ${placeholders} placeholder(s) but ${args} argument(s): ${literals.slice(0, 70)}`
    );
    cursor += 'sprintf('.length;
  }
  assert.ok(scanned >= 3, `expected to scan the sprintf calls in the model path, found ${scanned}`);
});

console.log(`\n[OK] ai-astrologer failure path: ${passed} checks passed`);
