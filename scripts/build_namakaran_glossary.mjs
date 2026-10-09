#!/usr/bin/env node
/**
 * Builds the Namakaran (baby naming) page-2 MEANING glossary for BOTH report
 * engines from the single human-editable source of truth:
 *
 *     data/namakaran_meaning_glossary.tsv
 *
 *   node scripts/build_namakaran_glossary.mjs            # validate + regenerate
 *   node scripts/build_namakaran_glossary.mjs --check    # validate only (CI / tests)
 *
 * Outputs:
 *   server/astrology/namakaranMeaningData.ts    (browser preview + Node PDF)
 *   api/astrology/namakaran_meanings.php        (official PHP/mPDF report)
 *
 * The generated files carry the same content hash, so a test can prove the live
 * preview and the delivered mPDF report always localize a meaning identically.
 *
 * ---------------------------------------------------------------------------
 * VALIDATION RULES
 *   - every row is exactly three tab-separated columns: english, tamil, hindi
 *   - the English key is unique and matches a meaning printed by the name bank
 *     (data/namakaran_name_bank.tsv) unless it is a documented extra
 *   - the Tamil column holds Tamil script only, the Hindi column Devanagari
 *     only — no Latin letters may leak into a localized meaning line
 *   - EVERY meaning of the current name bank must be present, so page 2 of the
 *     report can never fall back to word-by-word output for a shipped name
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSV_PATH = resolve(ROOT, 'data', 'namakaran_meaning_glossary.tsv');
const BANK_PATH = resolve(ROOT, 'data', 'namakaran_name_bank.tsv');
const OUT_TS = resolve(ROOT, 'server', 'astrology', 'namakaranMeaningData.ts');
const OUT_PHP = resolve(ROOT, 'api', 'astrology', 'namakaran_meanings.php');

const LATIN_LEAK = /[A-Za-z]/;
const TAMIL_ONLY = /^[\u0B80-\u0BFF\s,.;:!?()\-'"\u2018\u2019\u201c\u201d]+$/;
const HINDI_ONLY = /^[\u0900-\u097F\s,.;:!?()\-'"\u2018\u2019\u201c\u201d/]+$/;

/** Reads the glossary TSV into ordered rows. */
function readGlossary() {
  const lines = readFileSync(TSV_PATH, 'utf8').split(/\r?\n/);
  const rows = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const cells = line.split('\t').map(cell => cell.trim());
    rows.push({ line: index + 1, english: cells[0], tamil: cells[1], hindi: cells[2], cellCount: cells.length });
  });
  return rows;
}

/** Every meaning the shipped name bank prints on page 2. */
function readBankMeanings() {
  const meanings = new Set();
  for (const line of readFileSync(BANK_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cells = line.split('\t');
    if (cells.length === 5) meanings.add(cells[4].trim());
  }
  return meanings;
}

function validate(rows) {
  const problems = [];
  const seen = new Map();

  for (const row of rows) {
    const label = `line ${row.line} [${row.english || 'blank'}]`;
    if (row.cellCount !== 3) {
      problems.push(`${label}: expected 3 tab-separated columns, found ${row.cellCount}`);
      continue;
    }
    if (!row.english) {
      problems.push(`${label}: missing english meaning`);
      continue;
    }
    if (!row.tamil) problems.push(`${label}: missing Tamil text`);
    if (!row.hindi) problems.push(`${label}: missing Hindi text`);
    if (LATIN_LEAK.test(row.tamil)) problems.push(`${label}: Latin letters in the Tamil text "${row.tamil}"`);
    if (LATIN_LEAK.test(row.hindi)) problems.push(`${label}: Latin letters in the Hindi text "${row.hindi}"`);
    if (row.tamil && !TAMIL_ONLY.test(row.tamil)) {
      problems.push(`${label}: the Tamil text has characters outside Tamil script "${row.tamil}"`);
    }
    if (row.hindi && !HINDI_ONLY.test(row.hindi)) {
      problems.push(`${label}: the Hindi text has characters outside Devanagari "${row.hindi}"`);
    }

    const key = row.english.toLowerCase();
    if (seen.has(key)) {
      problems.push(`${label}: duplicate english meaning (first seen on line ${seen.get(key)})`);
    } else {
      seen.set(key, row.line);
    }
  }

  const bankMeanings = readBankMeanings();
  const missing = [...bankMeanings].filter(meaning => !seen.has(meaning.toLowerCase()));
  for (const meaning of missing) {
    problems.push(`the name bank meaning "${meaning}" has no Tamil/Hindi translation in the glossary`);
  }
  return { problems, glossaryCount: seen.size, bankCount: bankMeanings.size, missing };
}

function contentHash(rows) {
  const canonical = [...rows]
    .sort((a, b) => a.english.toLowerCase().localeCompare(b.english.toLowerCase(), 'en'))
    .map(row => [row.english, row.tamil, row.hindi].join('|'))
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function writeTs(rows, hash) {
  const sorted = [...rows].sort((a, b) => a.english.toLowerCase().localeCompare(b.english.toLowerCase(), 'en'));
  // Keys are lower-cased: the report resolves a meaning case-insensitively.
  const entries = sorted
    .map(row => `  ${JSON.stringify(row.english.toLowerCase())}: { ta: ${JSON.stringify(row.tamil)}, hi: ${JSON.stringify(row.hindi)} },`)
    .join('\n');

  writeFileSync(OUT_TS, `/**
 * AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth : data/namakaran_meaning_glossary.tsv
 * Generator       : scripts/build_namakaran_glossary.mjs
 * Content hash    : ${hash}
 *
 * The Tamil and Hindi text printed under every name on page 2 of the Vedic
 * Namakaran report, keyed by the English meaning of the name bank. The same
 * hash is written into api/astrology/namakaran_meanings.php so the live
 * preview, the Node PDF and the official mPDF report can be proven to show an
 * identical meaning for every name.
 */

export const NAMAKARAN_MEANING_GLOSSARY_HASH = '${hash}';

export interface NamakaranGlossaryEntry {
  /** Tamil meaning, exactly as printed in the Tamil report. */
  ta: string;
  /** Hindi meaning, exactly as printed in the Hindi report. */
  hi: string;
}

export const NAMAKARAN_MEANING_GLOSSARY: Record<string, NamakaranGlossaryEntry> = {
${entries}
};
`);
}

function writePhp(rows, hash) {
  const phpString = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const sorted = [...rows].sort((a, b) => a.english.toLowerCase().localeCompare(b.english.toLowerCase(), 'en'));
  // Keys are lower-cased: the report resolves a meaning case-insensitively.
  const entries = sorted
    .map(row => `    ${phpString(row.english.toLowerCase())} => ['ta' => ${phpString(row.tamil)}, 'hi' => ${phpString(row.hindi)}],`)
    .join('\n');

  writeFileSync(OUT_PHP, `<?php
/**
 * AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth : data/namakaran_meaning_glossary.tsv
 * Generator       : scripts/build_namakaran_glossary.mjs
 * Content hash    : ${hash}
 *
 * Tamil and Hindi meanings for page 2 of the Vedic Namakaran report, keyed by
 * the English meaning of the name bank. Kept byte-for-byte in step with
 * server/astrology/namakaranMeaningData.ts so the live preview and the official
 * mPDF report always localize a meaning identically.
 *
 * The bank deliberately keeps one short English meaning as its source value and
 * older orders only persisted that shape, so translations are resolved here at
 * the report boundary instead of requiring a migration of every saved order.
 */

if (!function_exists('astro_namakaran_meaning_glossary')) {
    /** The curated English => [ta, hi] glossary of the baby naming bank. */
    function astro_namakaran_meaning_glossary(): array {
        static $glossary = null;
        if ($glossary === null) {
            $glossary = [
${entries}
            ];
        }
        return $glossary;
    }
}
`);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const rows = readGlossary();
  const { problems, glossaryCount, bankCount } = validate(rows);

  if (problems.length) {
    console.error(`✖ ${problems.length} problem(s) found in data/namakaran_meaning_glossary.tsv:`);
    for (const problem of problems.slice(0, 60)) console.error(`   - ${problem}`);
    if (problems.length > 60) console.error(`   ... and ${problems.length - 60} more`);
    process.exitCode = 1;
    return;
  }

  const hash = contentHash(rows);
  console.log(`Namakaran meaning glossary: ${glossaryCount} curated meanings covering all ${bankCount} name bank meanings.`);

  if (checkOnly) {
    const tsCurrent = readFileSync(OUT_TS, 'utf8');
    const phpCurrent = readFileSync(OUT_PHP, 'utf8');
    if (!tsCurrent.includes(`NAMAKARAN_MEANING_GLOSSARY_HASH = '${hash}'`) ||
        !phpCurrent.includes(`* Content hash    : ${hash}`)) {
      console.error('✖ Generated glossary files are stale — run: node scripts/build_namakaran_glossary.mjs');
      process.exitCode = 1;
    } else {
      console.log(`✓ Generated glossary files are in sync (hash ${hash}).`);
    }
    return;
  }

  writeTs(rows, hash);
  writePhp(rows, hash);
  console.log(`✓ Wrote server/astrology/namakaranMeaningData.ts and api/astrology/namakaran_meanings.php (hash ${hash}).`);
}

main();
