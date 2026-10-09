import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const testFiles = [
  'tests/remedies.test.ts',
  'tests/jathagam-summary-parity.test.ts',
  'tests/namakaran-meanings.test.ts',
  'tests/logo-assets.test.ts',
  'tests/mobile-inputs.test.tsx',
  'tests/birth-details-validation.test.ts',
  'tests/timezone-offset.test.ts',
  'tests/family-report-tz-staleness.test.ts',
  'tests/family-report-engine-parity.test.ts',
  'tests/astrology-accuracy-regression.test.ts',
  'tests/node-php-parity.test.ts',
  'tests/astrology-integrity-regression.test.tsx',
  'tests/jathagam-card-rules.test.ts',
  'tests/vimshottari-dasha-timeline.test.ts',
  'tests/dosha-rule-accuracy.test.ts',
  'tests/porutham-reference.test.ts',
  'tests/muhurtham-astronomy-regression.test.ts',
  'tests/sample-engine-meaning.test.ts',
  'tests/report-dob-format.test.ts',
  'tests/lockfile-drift.test.ts'
];
const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');

for (const relativeFile of testFiles) {
  console.log(`\n[TEST] ${relativeFile}`);
  const result = spawnSync(
    process.execPath,
    [tsxCli, resolve(projectRoot, relativeFile)],
    { cwd: projectRoot, stdio: 'inherit' }
  );

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
