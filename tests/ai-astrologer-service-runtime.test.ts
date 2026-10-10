/**
 * Executes the SERVICE CHAPTERS under PHP-WASM: the real engine builds a
 * Wedding Matching, a Baby Naming and a Subha Muhurtham result from saved
 * order inputs, the endpoint extracts the chat facts, and the real local
 * answer builder answers one curated option per topic in en/ta/hi.
 *
 * The point of these checks: the chat reads the customer's own report and
 * never re-judges it, and a question about a report that is not attached is
 * answered with a request to attach it rather than a made-up answer.
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
const OUT = path.join(root, 'tests', 'fixtures', 'php-ai-probes', 'out-service-reports.json');

const runtimeInstalled = fs.existsSync(path.join(root, 'node_modules', '@php-wasm', 'node'));
if (!runtimeInstalled) {
  console.log('  [SKIP] @php-wasm/node is not installed - the service-chapter PHP runtime check did not run.');
  console.log('         npm install --no-save @php-wasm/node @php-wasm/universal');
  console.log('\n[OK] ai-astrologer service chapters runtime: skipped');
  process.exit(0);
}

fs.rmSync(OUT, { force: true });
const run = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'php-ai-provider-check.mjs'), 'tests/fixtures/php-ai-probes/service-reports.php', '--emit', OUT],
  { cwd: root, encoding: 'utf8', timeout: 300000 },
);
if (run.status !== 0) {
  console.error(run.stdout);
  console.error(run.stderr);
  throw new Error(`service-reports.php exited with status ${run.status}`);
}
assert.ok(fs.existsSync(OUT), 'service-reports.php must write its output file');
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

check('the engine builds real facts for all three service reports', () => {
  assert.equal(out.facts.wedding.serviceType, 'MARRIAGE_COMPATIBILITY');
  assert.equal(out.facts.wedding.total, 10);
  assert.deepEqual(out.facts.wedding.poruthamKeys, [
    'dina', 'gana', 'mahendra', 'stree_deergha', 'yoni',
    'rasi', 'rasiyadhipathi', 'vasiya', 'rajju', 'vedha',
  ]);
  assert.ok(out.facts.wedding.score > 0 && out.facts.wedding.score <= out.facts.wedding.maxScore);
  assert.ok(out.facts.wedding.groomStar.length > 2 && out.facts.wedding.brideStar.length > 2);

  assert.equal(out.facts.naming.serviceType, 'BABY_NAMING');
  assert.ok(out.facts.naming.pada >= 1 && out.facts.naming.pada <= 4);
  assert.equal(out.facts.naming.padaCount, 4);
  assert.ok(out.facts.naming.primarySound.en.length > 0);
  assert.ok(out.facts.naming.star.en.length > 2);

  assert.equal(out.facts.muhurtham.serviceType, 'MUHURTHAM');
  assert.equal(out.facts.muhurtham.dayCount, 4);
  assert.equal(out.facts.muhurtham.personalCheckMode, 'both');
  assert.equal(out.facts.muhurtham.topDate, '2027-01-14');
  assert.match(out.facts.muhurtham.window.en, /2027/);
  assert.match(out.facts.muhurtham.place, /Chennai/);
});

check('every service reply is guard-clean, with no PHP error', () => {
  assert.equal(out.replies.length, 19);
  for (const r of out.replies) {
    assert.equal(r.error ?? null, null, `${r.id} must not raise`);
    assert.equal(r.guardOk, true, `${r.id} must pass the output guard (${JSON.stringify(r.violations)})`);
    assert.deepEqual(r.violations ?? [], [], `${r.id} must have no violations`);
    assert.ok((r.content as string).length > 20, `${r.id} must answer`);
  }
});

check('wedding answers quote the report, never re-judge it', () => {
  const score = `${out.facts.wedding.score}`;
  assert.match(reply('match-score').content as string, new RegExp(`${score}\\s*/\\s*${out.facts.wedding.maxScore}`));
  assert.match(reply('match-score').content as string, new RegExp(`${out.facts.wedding.total} poruthams`));
  assert.match(reply('match-verdict').content as string, /Chennai|Karthik|Priya|Recommended|Not Recommended/);
  assert.match(reply('match-poruthams').content as string, /பொருந்த|உத்தமம்|மத்திமம்/);
  assert.match(reply('match-sevvai').content as string, /संतुलित|असंतुलन|दोष/);
  assert.match(reply('match-remedy').content as string, /பரிகார|செவ்வாய்/);
});

check('baby naming answers use the baby own birth star and pada sounds', () => {
  const sound = out.facts.naming.primarySound.en.split(' ')[0];
  assert.match(reply('naming-star').content as string, new RegExp(out.facts.naming.star.en));
  // The Tamil reply quotes the sound in Tamil script, never transliterated.
  assert.match(reply('naming-letters').content as string, new RegExp(out.facts.naming.primarySound.ta));
  assert.match(reply('naming-suggestions').content as string, new RegExp(sound));
  assert.match(reply('naming-letters').content as string, /பாதம்/);
  assert.match(reply('naming-suggestions').content as string, /•/);
  assert.match(reply('naming-meaning').content as string, /•/);
  // The supplied sample name is recorded as supplied, never certified.
  assert.match(reply('naming-our-name').content as string, /Aarav/);
  assert.match(reply('naming-our-name').content as string, /SUPPLIED|supplied|not certified/);
});

check('muhurtham answers carry the report own dates, windows and place', () => {
  assert.match(reply('muhurtham-dates').content as string, /14 Jan 2027/);
  assert.match(reply('muhurtham-best').content as string, /14 Jan 2027/);
  assert.match(reply('muhurtham-best').content as string, /09:10 AM/);
  assert.match(reply('muhurtham-why').content as string, /Rohini/);
  assert.match(reply('muhurtham-avoid').content as string, /01:30 PM/);
  // Yamagandam and Gulikai are printed too, whenever the report carries them.
  assert.match(reply('muhurtham-avoid').content as string, /यमगण्ड/);
  assert.match(reply('muhurtham-avoid').content as string, /गुलिक काल/);
  assert.match(reply('muhurtham-place').content as string, /Chennai/);
  assert.match(reply('muhurtham-place').content as string, /both charts|இரு ஜாதகங்களோடும்|दोनों कुंडलियों/);
});

check('a report that is attached but cannot be rebuilt is handed to a person', () => {
  const r = reply('muhurtham-dates-unreadable');
  assert.equal(r.handoff, true, 'an unreadable report must offer the astrologer');
  assert.match(r.content as string, /could not read/i);
  assert.doesNotMatch(r.content as string, /\d{4}-\d{2}-\d{2}/, 'no invented date');
});

check('a question about an unattached report asks for it instead of inventing one', () => {
  for (const id of ['match-verdict-unattached', 'naming-letters-unattached']) {
    const r = reply(id);
    assert.equal(r.handoff, false, `${id} is a nudge, not a complaint`);
    assert.ok((r.content as string).length > 20);
  }
  assert.match(reply('match-verdict-unattached').content as string, /Wedding Matching report/);
  // The second case is attached to a Birth Jathagam report, so it names that.
  assert.match(reply('naming-letters-unattached').content as string, /ஜன்ம ஜாதக அறிக்கை/);
});

if (!process.exitCode) console.log(`\n[OK] ai-astrologer service chapters runtime: ${passed} checks passed`);
