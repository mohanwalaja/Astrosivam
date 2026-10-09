/**
 * ASTRO SIVAM — lockfiles must agree with package.json.
 *
 * WHY THIS EXISTS: on 6 Oct 2026 a commit shipped a `bun.lock` that had been
 * regenerated from an OLDER package.json. Thirteen of thirty-five packages
 * silently disagreed, including `express ^5.2.1 -> ^4.21.2` while
 * `server.ts` uses the Express-5-only `app.get('/*splat', ...)` route syntax,
 * and `tz-lookup` (imported by src/lib/timezone.ts to turn a birth place into
 * an IANA zone) vanished from the lock entirely.
 *
 * Nothing broke at the time only because this repo installs with npm, which
 * ignores bun.lock — the damage was dormant until the first `bun install` on
 * a new machine or in CI. This test makes that drift loud instead of silent.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

/** bun.lock is JSONC: valid JSON apart from trailing commas. */
function parseJsonc(text: string): any {
  return JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'));
}

function readJson(relative: string): any {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relative), 'utf8'));
}

console.log('--- LOCKFILE / package.json AGREEMENT ---');

const pkg = readJson('package.json');
const declared: Record<string, string> = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {})
};

check('package.json declares dependencies', () => {
  assert.ok(Object.keys(declared).length > 0, 'no dependencies found in package.json');
});

check('bun.lock records the same version range as package.json for every package', () => {
  const lockPath = path.join(projectRoot, 'bun.lock');
  if (!fs.existsSync(lockPath)) {
    console.log('    (bun.lock absent — skipped)');
    return;
  }
  const lock = parseJsonc(fs.readFileSync(lockPath, 'utf8'));
  const root = lock?.workspaces?.[''];
  assert.ok(root, 'bun.lock has no root workspace entry');

  const locked: Record<string, string> = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
    ...(root.optionalDependencies ?? {}),
    ...(root.peerDependencies ?? {})
  };

  const drift: string[] = [];
  for (const [name, range] of Object.entries(declared)) {
    const lockedRange = locked[name];
    if (lockedRange === undefined) {
      drift.push(`${name}: package.json "${range}", MISSING from bun.lock`);
    } else if (lockedRange !== range) {
      drift.push(`${name}: package.json "${range}", bun.lock "${lockedRange}"`);
    }
  }
  for (const name of Object.keys(locked)) {
    if (!(name in declared)) {
      drift.push(`${name}: in bun.lock but not in package.json`);
    }
  }

  assert.deepEqual(
    drift,
    [],
    `bun.lock is out of sync with package.json (${drift.length} package(s)):\n  ` +
      drift.join('\n  ') +
      '\n\nRegenerate it with `bun install`, or restore it from the commit that matched.'
  );
});

check('package-lock.json describes this project and the same declared ranges', () => {
  const lockPath = path.join(projectRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    console.log('    (package-lock.json absent — skipped)');
    return;
  }
  const lock = readJson('package-lock.json');
  const root = lock?.packages?.[''];
  assert.ok(root, 'package-lock.json has no root package entry');

  const locked: Record<string, string> = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {})
  };

  const drift: string[] = [];
  for (const [name, range] of Object.entries(declared)) {
    const lockedRange = locked[name];
    if (lockedRange === undefined) {
      drift.push(`${name}: package.json "${range}", MISSING from package-lock.json`);
    } else if (lockedRange !== range) {
      drift.push(`${name}: package.json "${range}", package-lock.json "${lockedRange}"`);
    }
  }

  assert.deepEqual(
    drift,
    [],
    `package-lock.json is out of sync with package.json (${drift.length} package(s)):\n  ` +
      drift.join('\n  ') +
      '\n\nRegenerate it with `npm install`.'
  );
});

check('Express stays on v5 while server.ts uses the v5-only named-wildcard route', () => {
  const serverSource = fs.readFileSync(path.join(projectRoot, 'server.ts'), 'utf8');
  if (!/app\.get\(\s*['"`]\/\*\w+['"`]/.test(serverSource)) {
    console.log('    (server.ts no longer uses a named wildcard — skipped)');
    return;
  }
  // `/*splat` requires path-to-regexp v8, which ships with Express 5.
  const range = declared.express ?? '';
  assert.match(
    range,
    /^[~^]?5\./,
    `server.ts uses the Express-5-only '/*splat' route syntax but package.json ` +
      `pins express "${range}". Express 4 throws or mis-routes on that pattern.`
  );
});

check('composer.lock pins mpdf/mpdf when present', () => {
  const composerJson = path.join(projectRoot, 'composer.json');
  if (!fs.existsSync(composerJson)) {
    console.log('    (composer.json absent — skipped)');
    return;
  }
  const lockPath = path.join(projectRoot, 'composer.lock');
  if (!fs.existsSync(lockPath)) {
    console.log('    (composer.lock absent — skipped)');
    return;
  }
  const lock = readJson('composer.lock');
  const names = (lock.packages ?? []).map((p: any) => p.name);
  assert.ok(names.includes('mpdf/mpdf'), 'composer.lock does not pin mpdf/mpdf');
});

console.log(`\nLockfile agreement passed (${passed} checks).`);
