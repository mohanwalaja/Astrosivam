/**
 * ASTRO SIVAM AI Astrologer — the generation layer, EXECUTED.
 *
 * Every other PHP suite in this repository reads the source and asserts on its
 * shape, because the sandbox has no `php` binary. That leaves a real gap: a
 * syntactically valid file that throws at runtime passes all of them. This one
 * closes the gap by running the committed provider under the wasm PHP runtime
 * against the committed knowledge base, and asserting on what it returns.
 *
 * It found a real defect on the day it was written: a sprintf in the model-call
 * error branch had four placeholders and three arguments, so every failed model
 * call threw ArgumentCountError instead of the explanation it was meant to
 * carry. No static check caught that; executing the code did.
 *
 * Requires the dev-only runtime, which is not in package.json:
 *   npm install --no-save @php-wasm/node @php-wasm/universal
 * Without it this test reports SKIPPED and exits green, so CI stays honest
 * about what it did and did not run.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = 'tests/fixtures/php-ai-probes/reply-path.php';
const OUT = path.join(root, 'tests', 'fixtures', 'php-ai-probes', 'out.json');

const runtimeInstalled = fs.existsSync(path.join(root, 'node_modules', '@php-wasm', 'node'));
if (!runtimeInstalled) {
  console.log('  [SKIP] @php-wasm/node is not installed - the PHP runtime check did not run.');
  console.log('         npm install --no-save @php-wasm/node @php-wasm/universal');
  console.log('\n[OK] ai-astrologer php runtime: skipped');
  process.exit(0);
}

/** Runs one probe under the wasm PHP runtime and returns its structured output. */
function runProbe(probe: string, outFile: string): any {
  fs.rmSync(outFile, { force: true });
  const run = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'php-ai-provider-check.mjs'), probe, '--emit', outFile],
    { cwd: root, encoding: 'utf8', timeout: 180000 }
  );
  if (run.status !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`${probe} exited with status ${run.status}`);
  }
  assert.ok(fs.existsSync(outFile), `${probe} must write its output file`);
  return JSON.parse(fs.readFileSync(outFile, 'utf8'));
}

const out = runProbe(PROBE, OUT);
const coverage = runProbe(
  'tests/fixtures/php-ai-probes/sources-coverage.php',
  path.join(root, 'tests', 'fixtures', 'php-ai-probes', 'out-coverage.json')
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

check('the knowledge base loads and the system prompt extracts', () => {
  assert.ok(out.systemPromptBytes > 10000, `the prompt extracted only ${out.systemPromptBytes} bytes`);
});

check('no key anywhere means the provider reports itself unconfigured', () => {
  assert.equal(out.configuredWithoutKey, false);
  assert.deepEqual(out.blockingWithoutKey, ['apiKey'], 'the blocking check must be named, not guessed');
});

check('a placeholder key is refused rather than sent to the model', () => {
  assert.equal(out.placeholderSource, 'placeholder-only');
});

check('a key saved in the Admin Portal is used, with its model override', () => {
  assert.equal(out.adminKeyConfigured, true);
  assert.equal(out.adminKeySource, 'admin-settings');
  assert.equal(out.adminKeyModel, 'llama-3.1-70b-versatile');
});

check('a key that only exists in $_SERVER is still found', () => {
  // cPanel's SetEnv under LiteSpeed/PHP-FPM puts it here and nowhere else.
  assert.equal(out.serverGlobalConfigured, true);
  assert.equal(out.serverGlobalSource, 'environment');
});

check('a failed model call explains itself instead of throwing a PHP error', () => {
  assert.equal(out.answerErrorClass, 'RuntimeException', `got ${out.answerErrorClass}: ${out.answerError}`);
  assert.doesNotMatch(
    out.answerErrorClass,
    /ArgumentCountError|TypeError|ValueError/,
    'an argument-count error here means a sprintf is malformed and the real reason is lost'
  );
  assert.match(out.answerError, /Model request to https:\/\//, 'the error must name the endpoint it tried');
});

check('the guard names each fault exactly once', () => {
  const dupes = out.guardViolations.filter(
    (v: string, i: number) => out.guardViolations.indexOf(v) !== i
  );
  assert.deepEqual(dupes, [], `the retry instruction would repeat: ${dupes.join(', ')}`);
  assert.ok(out.guardViolations.length >= 1, 'a guaranteed prediction must be rejected');
});

check('a ---BUBBLE--- reply splits into the bubbles the UI shows', () => {
  assert.equal(out.bubbleCount, 2);
});

check('the curated source library actually reaches a customer reply', () => {
  // Executed proof of the invariant the registry test checks statically: when a
  // card's rules fire, the source line that survives the Tamil-only filter must
  // be non-empty. Before the Tamil editions were cited alongside the English
  // ones this was 0 of 8 - the chat answered with no attribution at all while
  // 139 citable Tamil sources sat unused.
  assert.ok(coverage.cardsFired >= 8, `expected all 8 cards to fire, only ${coverage.cardsFired} did`);
  assert.equal(
    coverage.cardsCited,
    coverage.cardsFired,
    `${coverage.cardsFired - coverage.cardsCited} card(s) fired but produced no citable source line`
  );
  assert.ok(
    coverage.citableCount > 100,
    `only ${coverage.citableCount} citable Tamil sources - the library should be far larger`
  );
});

check('the sources the rules cite in English are not the ones shown to customers', () => {
  // This is expected, not a bug: the English editions stay as internal
  // reference and the Tamil edition of the same work carries the citation. What
  // would be a bug is a rule citing ONLY an English id - the registry test
  // catches that, and cardsCited above catches it at runtime.
  assert.ok(coverage.citedNotCitable.length > 0, 'the registry keeps English editions as internal reference');
  assert.ok(coverage.citedIds.length >= 16, `expected the rules to cite the library, found ${coverage.citedIds.length} ids`);
});

console.log(`\n[OK] ai-astrologer php runtime: ${passed} checks passed`);
