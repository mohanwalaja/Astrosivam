/**
 * Executes the local-only customer reply path under PHP-WASM.
 *
 * Native PHP is not installed in the sandbox. When the optional wasm runtime is
 * present, this test executes the committed PHP against the actual knowledge
 * files, rebuilt chart facts, diagnostic payload, and multilingual questions.
 * No external service is contacted.
 *
 * Requires the dev-only runtime (not in package.json):
 *   npm install --no-save @php-wasm/node @php-wasm/universal
 * If it is absent, the test reports SKIPPED rather than claiming PHP execution.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = 'tests/fixtures/php-ai-probes/knowledge-base-mode.php';
const OUT = path.join(root, 'tests', 'fixtures', 'php-ai-probes', 'out.json');

const runtimeInstalled = fs.existsSync(path.join(root, 'node_modules', '@php-wasm', 'node'));
if (!runtimeInstalled) {
  console.log('  [SKIP] @php-wasm/node is not installed - the PHP runtime check did not run.');
  console.log('         npm install --no-save @php-wasm/node @php-wasm/universal');
  console.log('\n[OK] ai-astrologer php runtime: skipped');
  process.exit(0);
}

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

check('the runtime reports local-only mode with no blocking setup issue', () => {
  assert.equal(out.configured, false);
  assert.equal(out.mode, 'knowledge-base');
  assert.equal(out.canAnswer, true);
  assert.deepEqual(out.diagBlocking, []);
  assert.equal(out.pingAttempted, false);
  assert.match(out.externalCompletionError, /disabled/i);
});

check('runtime diagnostics expose the current catalogue size without implying full-text search', () => {
  assert.equal(out.sourceRegistry.total, 224);
  assert.equal(out.sourceRegistry.excluded, 13);
  assert.equal(out.sourceRegistry.byVerification['content-read'], 11);
});

check('local guardrails reject banned prediction language in all supported languages', () => {
  for (const language of ['en', 'ta', 'hi']) {
    assert.equal(out.guardChecks[language].ok, false, `${language} banned phrase was accepted`);
    assert.ok(out.guardChecks[language].violations.length > 0);
  }
});

check('every tested question receives a guard-clean local reply', () => {
  for (const reply of [...out.general, ...out.personal]) {
    assert.ok(!reply.error, `${reply.lang} "${reply.q}" threw: ${reply.error}`);
    assert.equal(reply.mode, 'knowledge-base', `${reply.q} must use local knowledge-base mode`);
    assert.ok(reply.bubbles.length >= 1 && reply.bubbles.length <= 4, `${reply.q} returned ${reply.bubbles.length} bubbles`);
    assert.equal(reply.guardOk, true, `${reply.lang} "${reply.q}" failed: ${reply.violations?.join('; ')}`);
  }
});

check('questions route to supported local topics in all three languages', () => {
  const all = [...out.general, ...out.personal];
  const area = (question: string) => all.find((reply: any) => reply.q === question)?.areaId;
  assert.equal(area('When will I get a job?'), 'career');
  assert.equal(area('how much money will I earn this year'), 'wealth', 'a money question is not a price question');
  assert.equal(area('Can I settle abroad in Australia?'), 'travel-foreign');
  assert.equal(area('என் திருமணம் எப்போது நடக்கும்?'), 'marriage');
  assert.equal(area('मेरा करियर कैसा रहेगा?'), 'career');
  assert.equal(area('What is my current dasha?'), 'current-guidance');
});

check('refusal routes, medical safety, and unknown topics hand off rather than guess', () => {
  const byQ = (question: string) => out.general.find((reply: any) => reply.q === question);
  for (const question of ['Will I die soon?', 'Should I buy shares in crypto?', 'What is the best phone to buy?']) {
    assert.equal(byQ(question).handoff, true, `${question} must offer a human handoff`);
  }
  assert.match(byQ('Should I buy shares in crypto?').bubbles.join(' '), /financial adviser/);
  assert.match(byQ('What is the best phone to buy?').bubbles.join(' '), /could not find/i);
  const health = byQ('I have chest pain, is it dangerous?');
  assert.match(health.bubbles.join(' '), /qualified doctor/);
});

check('the endpoint maps a real AstroEngine chart into local rule facts', () => {
  const chart = out.chartFacts;
  assert.ok(chart, 'astro_ai_chart_facts must return facts for a Birth Jathagam');
  assert.ok(chart.lagna && chart.moonSign && chart.moonNakshatra);
  assert.ok(chart.currentDasha && chart.currentAntardasha);
  assert.match(out.chartFacts.dashaEndDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Object.keys(chart.planetHouse).length >= 9);
  assert.equal(Object.keys(chart.lordHouse).length, 12);
  assert.ok(out.summaryKeys.includes('careerTa'));
});

check('a personal answer includes the customer\'s rebuilt report reading', () => {
  const career = out.personal.find((reply: any) => reply.q === 'How is my career?');
  assert.ok(career.bubbles[0].includes(out.careerSummaryEn));
  const dasha = out.personal.find((reply: any) => reply.q === 'What is my current dasha?');
  assert.match(dasha.bubbles[0], /Mahadasha/);
});

check('reviewed rule cards that fire carry an eligible Tamil reference', () => {
  assert.ok(coverage.cardsFired >= 8, `expected the coverage probe to fire all cards, got ${coverage.cardsFired}`);
  assert.equal(coverage.cardsCited, coverage.cardsFired);
  assert.ok(coverage.citableCount > 100, `only ${coverage.citableCount} Tamil catalogue records are citation-eligible`);
  assert.ok(coverage.registryCount === 224);
});

check('English-only source editions are not emitted as Tamil customer citations', () => {
  assert.ok(coverage.citedNotCitable.length > 0);
  assert.ok(coverage.citedIds.length >= 16);
});

console.log(`\n[OK] ai-astrologer php runtime: ${passed} checks passed`);
