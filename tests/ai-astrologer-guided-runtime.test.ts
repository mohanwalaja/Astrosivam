/**
 * Executes GUIDED MODE under PHP-WASM: the real guided-menu helpers, the real
 * chart-fact builder (with dosha results), and the real local answer builder
 * answering one curated option per guided kind (life area, dosha, remedy,
 * order facts, complaint). No external service is contacted.
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
const OUT = path.join(root, 'tests', 'fixtures', 'php-ai-probes', 'out-guided.json');

const runtimeInstalled = fs.existsSync(path.join(root, 'node_modules', '@php-wasm', 'node'));
if (!runtimeInstalled) {
  console.log('  [SKIP] @php-wasm/node is not installed - the guided PHP runtime check did not run.');
  console.log('         npm install --no-save @php-wasm/node @php-wasm/universal');
  console.log('\n[OK] ai-astrologer guided runtime: skipped');
  process.exit(0);
}

fs.rmSync(OUT, { force: true });
const run = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'php-ai-provider-check.mjs'), 'tests/fixtures/php-ai-probes/guided-mode.php', '--emit', OUT],
  { cwd: root, encoding: 'utf8', timeout: 180000 }
);
if (run.status !== 0) {
  console.error(run.stdout);
  console.error(run.stderr);
  throw new Error(`guided-mode.php exited with status ${run.status}`);
}
assert.ok(fs.existsSync(OUT), 'guided-mode.php must write its output file');
const out = JSON.parse(fs.readFileSync(OUT, 'utf8'));

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}
const reply = (id: string) => out.replies.find((r: any) => r.id === id);

check('the guided menu resolves in all three languages', () => {
  for (const lang of ['en', 'ta', 'hi']) {
    assert.equal(out.menu[lang].firstTopic, 'health');
    assert.ok((out.menu[lang].firstOption as string).length > 10);
  }
});

check('the three service chapters appear only for a report the account holds', () => {
  // No delivered service report: the menu is the twelve general chapters.
  assert.equal(out.gatedMenu.none.categories, 12);
  assert.equal(out.gatedMenu.none.options, 49);
  assert.ok(!(out.gatedMenu.none.ids as string[]).includes('wedding-match'));

  // A Wedding Matching + Subha Muhurtham report: those two chapters join.
  assert.equal(out.gatedMenu.weddingAndMuhurtham.categories, 14);
  assert.equal(out.gatedMenu.weddingAndMuhurtham.options, 60);
  const entitled = out.gatedMenu.weddingAndMuhurtham.ids as string[];
  assert.ok(entitled.includes('wedding-match') && entitled.includes('muhurtham'));
  assert.ok(!entitled.includes('baby-naming'), 'a Baby Naming chapter needs a Baby Naming report');

  // All three, and the administrator view, see the whole menu.
  assert.equal(out.gatedMenu.allThree.categories, 15);
  assert.equal(out.gatedMenu.allThree.options, 65);
  assert.equal(out.gatedMenu.admin.categories, 15);
  assert.equal(out.gatedMenu.admin.options, 65);
});

check('option ids resolve server-side and unknown ids do not', () => {
  assert.equal(out.unknownQuestionId, null);
  assert.deepEqual(out.knownQuestionId, { kind: 'area', area: 'career', category: 'career' });
});

check('the rebuilt chart carries dosha results for guided dosha answers', () => {
  assert.deepEqual([...(out.doshaKeys as string[])].sort(), ['guruchandala', 'kalasarpa', 'kuja', 'pitru']);
});

check('every guided reply is guard-clean with no PHP error', () => {
  assert.equal(out.replies.length, 13);
  for (const r of out.replies) {
    assert.equal(r.error ?? null, null, `${r.id} must not raise`);
    assert.equal(r.guardOk, true, `${r.id} must pass the output guard`);
    assert.deepEqual(r.violations ?? [], [], `${r.id} must have no violations`);
    assert.ok((r.content as string).length > 20, `${r.id} must answer`);
  }
});

check('life-area options keep the forced area and personal chart facts', () => {
  assert.equal(reply('career-change').areaId, 'career');
  assert.match(reply('career-change').content as string, /Mohan/);
  assert.equal(reply('marriage-timing').areaId, 'marriage');
  assert.match(reply('marriage-timing').content as string, /7-ஆம் இட அதிபதி/);
});

check('dosha options read the rebuilt chart, not wording matches', () => {
  assert.match(reply('dosha-all').content as string, /Mars \(Kuja\) Dosha/);
  assert.match(reply('dosha-all').content as string, /Kala Sarpa Dosha/);
  assert.match(reply('dosha-kuja').content as string, /कुज/);
});

check('remedy options name the deity, day, and text', () => {
  assert.match(reply('remedy-personal').content as string, /Rahu/);
  assert.match(reply('remedy-sani').content as string, /சனி/);
});

check('order options quote the order facts, never invent them', () => {
  assert.match(reply('order-status').content as string, /AST-PROBE/);
  assert.match(reply('order-status').content as string, /BIRTH_JATHAGAM/);
  assert.match(reply('order-details').content as string, /1990-05-15/);
  assert.match(reply('order-payment').content as string, /FJD 50/);
});

check('corrections and complaints acknowledge and hand off to the team', () => {
  for (const id of ['order-correction', 'complaint-not-received', 'complaint-talk-astrologer']) {
    assert.equal(reply(id).handoff, true, `${id} must hand off`);
  }
  assert.match(reply('complaint-not-received').content as string, /sent to our team/);
});

if (!process.exitCode) console.log(`\n[OK] ai-astrologer guided runtime: ${passed} checks passed`);
