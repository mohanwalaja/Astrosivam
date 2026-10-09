import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const testFiles = [
  'tests/remedies.test.ts',
  'tests/jathagam-summary-parity.test.ts',
  'tests/full-suite.test.ts',
  'tests/namakaran-meanings.test.ts',
  'tests/logo-assets.test.ts',
  'tests/mobile-inputs.test.tsx',
  'tests/birth-details-validation.test.ts',
  'tests/service-input-validation.test.ts',
  'tests/comprehensive-system-audit.test.ts',
  'tests/security-delivery.test.ts',
  'tests/timezone-offset.test.ts',
  'tests/family-report-tz-staleness.test.ts',
  'tests/family-report-engine-parity.test.ts',
  'tests/astrology-accuracy-regression.test.ts',
  'tests/node-php-parity.test.ts',
  'tests/astrology-integrity-regression.test.tsx',
  'tests/jathagam-card-rules.test.ts',
  'tests/jathagam-navamsa-page1.test.ts',
  'tests/vimshottari-dasha-timeline.test.ts',
  'tests/dosha-rule-accuracy.test.ts',
  'tests/porutham-reference.test.ts',
  'tests/muhurtham-location.test.ts',
  'tests/muhurtham-astronomy-regression.test.ts',
  'tests/sample-reports.test.ts',
  'tests/sample-engine-meaning.test.ts',
  'tests/auth-regression.test.ts',
  'tests/admin-free-orders.test.ts',
  'tests/multiple-paid-orders.test.ts',
  'tests/multi-person-orders.test.ts',
  'tests/payment-regression.test.ts',
  'tests/payment-recovery.test.ts',
  'tests/attachment-budget.test.ts',
  'tests/preview-pdf-quality.test.ts',
  'tests/rate-limit-shared.test.ts',
  'tests/cors-origins.test.ts',
  'tests/lockfile-drift.test.ts'
];
const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');
const isolationRoot = mkdtempSync(join(tmpdir(), 'astrosivam-test-databases-'));
let exitCode = 0;

try {
  for (const relativeFile of testFiles) {
    const testDataDir = mkdtempSync(join(isolationRoot, `${basename(relativeFile).replace(/[^a-z0-9.-]/gi, '-')}-`));
    console.log(`\n[TEST ISOLATION] ${relativeFile} → temporary database`);
    const result = spawnSync(
      process.execPath,
      [tsxCli, resolve(projectRoot, relativeFile)],
      {
        cwd: projectRoot,
        env: { ...process.env, ASTROSIVAM_DATA_DIR: testDataDir },
        stdio: 'inherit'
      }
    );
    rmSync(testDataDir, { recursive: true, force: true });

    if (result.error) {
      console.error(result.error);
      exitCode = 1;
      break;
    }
    if (result.status !== 0) {
      exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  rmSync(isolationRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;
