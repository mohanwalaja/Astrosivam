/**
 * Run a PHP probe against the AI Astrologer's real server code, locally.
 *
 * Same idea as scripts/php-wasm-check.mjs (there is no `php` binary in the
 * sandbox; the committed PHP suites run under a real PHP in CI), but it mounts
 * the trees the AI provider actually reads instead of the PDF report builder's:
 *
 *   /repo/api/astrology/ai_astrologer_provider.php  (the model-call layer)
 *   /repo/api/ai_astrologer.php                     (the endpoint)
 *   /repo/knowledge/**                              (prompt, rules, sources)
 *
 * The probe decides what to exercise. Two useful ones live in
 * tests/fixtures/php-ai-probes/: reply-path.php (does the whole answer path
 * build a prompt and return bubbles?) and provider-health.php (is the provider
 * configured, and is the knowledge base readable?).
 *
 * Usage:
 *   npm install --no-save @php-wasm/node
 *   node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/reply-path.php
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const [probeArg, ...rest] = process.argv.slice(2);
if (!probeArg) {
  console.error('usage: node scripts/php-ai-provider-check.mjs <probe.php> [--emit hostPath] [--env K=V ...]');
  process.exit(2);
}
const emitIndex = rest.indexOf('--emit');
const emitHostPath = emitIndex >= 0 ? rest[emitIndex + 1] : null;
const envArgs = rest.filter((a) => !a.startsWith('--') && a.includes('=') && a !== probeArg);

const repoRoot = resolve(import.meta.dirname, '..');
const probePath = resolve(repoRoot, probeArg);

/** Every server file the AI chat path can reach, mounted at its real relative path. */
const MOUNT_FILES = [
  'api/config.php',
  'api/db.php',
  'api/rate_limit.php',
  'api/client_ip.php',
  'api/ai_astrologer.php',
  'api/astrology/ai_astrologer_provider.php',
  'api/astrology/ai_astrologer_offline.php',
  // The horoscope engine, so a probe can build a real chart for knowledge-base mode.
  'api/branding.php',
  'api/astrology/engine.php',
  'api/astrology/ephemeris_tables.php',
  'api/astrology/mpdf_fontconfig.php',
  'api/astrology/pdf_mpdf_reports.php',
  'api/astrology/muhurtham_report_notes.php',
  'api/astrology/wedding_disclaimer_notes.php',
  'api/astrology/namakaran_meanings.php',
  'api/astrology/namakaran_meaning_localizer.php',
  'api/astrology/namakaran_name_bank.php',
  'api/astrology/tz_lookup_data.php',
  'api/astrology/ai_report_extract.php',
  'api/migrations/007_ai_astrologer_chat.sql',
];

/** Mounted whole: the provider resolves it two levels up from api/astrology/. */
const MOUNT_DIRS = ['knowledge/ai-astrologer'];

const php = new PHP(await loadNodeRuntime('8.4', { emscriptenOptions: { processId: 42 } }));

const mkdirp = (path) => {
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    try {
      php.mkdir(current);
    } catch {
      /* already exists */
    }
  }
};

const writeInto = (virtualPath, contents) => {
  mkdirp(virtualPath.slice(0, virtualPath.lastIndexOf('/')));
  php.writeFile(virtualPath, contents);
};

const mountTree = (hostDir, virtualDir) => {
  for (const name of readdirSync(hostDir)) {
    const hostPath = join(hostDir, name);
    if (statSync(hostPath).isDirectory()) {
      mountTree(hostPath, virtualDir + '/' + name);
    } else {
      writeInto(virtualDir + '/' + name, readFileSync(hostPath));
    }
  }
};

for (const rel of MOUNT_FILES) {
  try {
    writeInto('/repo/' + rel, readFileSync(join(repoRoot, rel)));
  } catch {
    /* optional file */
  }
}
for (const rel of MOUNT_DIRS) {
  try {
    mountTree(join(repoRoot, rel), '/repo/' + rel);
  } catch {
    /* optional tree */
  }
}

const probeRelative = relative(repoRoot, probePath).replaceAll('\\', '/');
writeInto('/repo/' + probeRelative, readFileSync(probePath));

const env = { REPO_ROOT: '/repo' };
for (const pair of envArgs) {
  const eq = pair.indexOf('=');
  env[pair.slice(0, eq)] = pair.slice(eq + 1);
}

const result = await php.run({
  scriptPath: '/repo/' + probeRelative,
  relativeUri: '/',
  env,
});

process.stdout.write(result.text ?? '');
if (result.errors) process.stderr.write(result.errors);

if (emitHostPath) {
  writeFileSync(resolve(emitHostPath), php.readFileAsBuffer('/repo/out.json'));
}

process.exit(result.exitCode ?? 0);
