#!/usr/bin/env node
/**
 * Builds the Namakaran (baby naming) name bank for BOTH report engines from the
 * single human-editable source of truth: data/namakaran_name_bank.tsv
 *
 *   node scripts/build_namakaran_bank.mjs            # validate + regenerate
 *   node scripts/build_namakaran_bank.mjs --check    # validate only (CI / tests)
 *
 * Outputs:
 *   src/lib/astrology/namakaranNameBank.ts        (browser preview + browser-side TypeScript)
 *   api/astrology/namakaran_name_bank.php        (official PHP/mPDF report)
 *
 * The two generated files carry the same content hash, so a test can prove the
 * live preview and the delivered mPDF report always show the same names.
 *
 * ---------------------------------------------------------------------------
 * VALIDATION RULES
 *   - every akshara must be one of the 108 pada letters in babynames.ts
 *   - every name must be Roman (ASCII) and must actually begin with the sound
 *     of its akshara (long vowels may drop to the bare consonant, which is the
 *     normal Tamil/Sanskrit naming practice — e.g. Kaa -> Karthik)
 *   - meanings stay short enough to print on one line
 *   - no duplicates inside one akshara + gender + style list
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSV_PATH = resolve(ROOT, 'data', 'namakaran_name_bank.tsv');
const OUT_TS = resolve(ROOT, 'src', 'lib', 'astrology', 'namakaranNameBank.ts');
const OUT_PHP = resolve(ROOT, 'api', 'astrology', 'namakaran_name_bank.php');

const MAX_PER_SIDE = 8;

/**
 * A Tamil pada letter covers every voiced/voiceless reading of that letter
 * (ச = cha / sa / sha, க = ka / kha / ga / gha ...), so a name is accepted when
 * it opens with ANY reading of the akshara's letter in the SAME vowel:
 * கு accepts Kumar, Ghuruvam... but never Kamal (that is the bare க).
 */
const CONSONANT_FAMILIES = {
  'க': ['k', 'kh', 'g', 'gh'],
  'ங': ['ng', 'nk', 'n'],
  'ச': ['ch', 's', 'sh', 'z'],
  'ஜ': ['j', 'jh', 'z', 'zh'],
  'ஞ': ['ny', 'n', 'gn', 'tr'],
  'ட': ['t', 'd', 'tt', 'dd'],
  'ண': ['n', 'nn'],
  'த': ['th', 't', 'd', 'dh', 'tt'],
  'ந': ['n', 'nn'],
  'ப': ['p', 'b', 'ph', 'bh'],
  'ம': ['m'],
  'ய': ['y'],
  'ர': ['r'],
  'ல': ['l', 'lh', 'zh'],
  'வ': ['v', 'w'],
  'ஷ': ['sh', 's', 'ssh'],
  'ஹ': ['h'],
  'ஸ': ['s'],
  'ற': ['r', 'tr'],
  'ள': ['l', 'll']
};

/** Latin vowel spellings grouped by the Tamil vowel they represent. */
const VOWEL_GROUPS = [
  ['aa', 'a'],
  ['ee', 'i'],
  ['oo', 'u'],
  ['ai', 'ay', 'ei'],
  ['au', 'ow', 'ou'],
  ['e', 'ae'],
  ['o', 'oh', 'aw']
];

/** Extra literal prefixes accepted for a few aksharas (cluster readings). */
const EXTRA_PREFIXES = {
  'ஞ': ['tr', 'tri', 'tra'],
  'ஜ': ['jha', 'jhi', 'za', 'zi'],
  'ங': ['nga', 'ngi', 'ngu', 'nge', 'ngo'],
  'ணா': ['nna', 'na']
};

/** Splits a transliteration token into its consonant part and vowel part. */
function splitToken(token) {
  const lower = token.toLowerCase().replace(/[^a-z]/g, '');
  for (const group of VOWEL_GROUPS) {
    for (const spelling of group) {
      if (lower.endsWith(spelling)) {
        return {
          consonant: lower.slice(0, lower.length - spelling.length),
          vowels: group
        };
      }
    }
  }
  return { consonant: lower, vowels: ['a', 'aa'] };
}

// ---------------------------------------------------------------------------
// 1. Read the canonical 108-pada table straight out of babynames.ts so the two
//    can never drift apart.
// ---------------------------------------------------------------------------
function readPadaTable() {
  const src = readFileSync(resolve(ROOT, 'src', 'lib', 'astrology', 'babynames.ts'), 'utf8');
  const blocks = [...src.matchAll(/nakshatraIndex:\s*(\d+),([\s\S]*?)(?=\n  \{\n    nakshatraIndex:|\n\](?:;|\.map))/g)];
  const padas = [];
  for (const [, index, body] of blocks) {
    const padaRe = /\{ padaNumber: (\d+), letterTa: '([^']*)', letterEn: '([^']*)', letterHi: '([^']*)'/g;
    for (const [, padaNumber, letterTa, letterEn, letterHi] of body.matchAll(padaRe)) {
      padas.push({
        nakshatraIndex: Number(index),
        padaNumber: Number(padaNumber),
        letterTa,
        letterEn,
        letterHi
      });
    }
  }
  if (padas.length !== 108) {
    throw new Error(`Expected the canonical 108-pada table, found ${padas.length} entries.`);
  }
  return padas;
}

// ---------------------------------------------------------------------------
// 2. Allowed Latin prefixes per akshara.
// ---------------------------------------------------------------------------
function allowedPrefixes(akshara, padaTable) {
  const variants = new Set();
  for (const pada of padaTable) {
    if (pada.letterTa === akshara) variants.add(pada.letterEn);
  }
  const family = CONSONANT_FAMILIES[akshara[0]] || [];
  const prefixes = new Set();

  for (const variant of variants) {
    for (const rawToken of variant.split('/')) {
      const { consonant, vowels } = splitToken(rawToken);
      // The letter's own consonant reading is always valid; the family adds the
      // other voiced/voiceless readings of the same Tamil letter.
      const stems = consonant ? [...new Set([consonant, ...family])] : [''];
      for (const stem of stems) {
        for (const vowel of vowels) {
          prefixes.add(stem + vowel);
          // Tamil writes a conjunct as letter + ர/ல/வ (கிரி for "Kri"), so the
          // first akshara still matches: Kritika, Prakash, Priya... are valid
          // for கீ / பா. Only consonant stems get this, never pure vowels.
          if (consonant) prefixes.add(`${stem}r${vowel}`);
        }
      }
    }
  }
  for (const extra of EXTRA_PREFIXES[akshara] || []) prefixes.add(extra);
  return { prefixes: [...prefixes], variants: [...variants] };
}

// ---------------------------------------------------------------------------
// 3. Parse the TSV.
// ---------------------------------------------------------------------------
function readTsv() {
  const lines = readFileSync(TSV_PATH, 'utf8').split(/\r?\n/);
  const rows = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const cells = line.split('\t').map(c => c.trim());
    if (cells.length !== 5) {
      rows.push({ line: idx + 1, error: `expected 5 tab-separated columns, found ${cells.length}` });
      return;
    }
    const [akshara, gender, style, name, meaning] = cells;
    rows.push({ line: idx + 1, akshara, gender, style, name, meaning });
  });
  return rows;
}

// ---------------------------------------------------------------------------
// 4. Validate.
// ---------------------------------------------------------------------------
function validate(rows, padaTable) {
  const problems = [];
  const knownAksharas = new Set(padaTable.map(p => p.letterTa));
  const seen = new Map();
  const prefixesCache = new Map();

  for (const row of rows) {
    if (row.error) {
      problems.push(`line ${row.line}: ${row.error}`);
      continue;
    }
    const { akshara, gender, style, name, meaning } = row;
    if (!knownAksharas.has(akshara)) {
      problems.push(`line ${row.line}: unknown akshara "${akshara}" (not one of the 108 pada letters)`);
      continue;
    }
    if (!['M', 'F'].includes(gender)) {
      problems.push(`line ${row.line}: gender must be M or F (found "${gender}")`);
    }
    if (!['S', 'N'].includes(style)) {
      problems.push(`line ${row.line}: style must be S or N (found "${style}")`);
    }
    if (!name || !/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
      problems.push(`line ${row.line}: name "${name}" must be plain Roman letters`);
    }
    if (/[?]|placeholder|hmm/i.test(`${name} ${meaning}`)) {
      problems.push(`line ${row.line}: unfinished placeholder entry`);
    }
    if (!meaning) {
      problems.push(`line ${row.line}: missing meaning`);
    } else if (meaning.length > 30) {
      problems.push(`line ${row.line}: meaning "${meaning}" is ${meaning.length} chars (max 30)`);
    }

    if (!prefixesCache.has(akshara)) prefixesCache.set(akshara, allowedPrefixes(akshara, padaTable).prefixes);
    const prefixes = prefixesCache.get(akshara);
    const lower = name.toLowerCase();
    if (!prefixes.some(p => lower.startsWith(p))) {
      problems.push(
        `line ${row.line}: "${name}" does not begin with the sound of ${akshara} ` +
        `(expected one of: ${prefixes.join(', ')})`
      );
    }

    const key = `${akshara}|${gender}|${style}|${lower}`;
    if (seen.has(key)) {
      problems.push(`line ${row.line}: duplicate "${name}" for ${akshara} ${gender} ${style} (first seen on line ${seen.get(key)})`);
    } else {
      seen.set(key, row.line);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// 5. Build the nested bank.
// ---------------------------------------------------------------------------
function buildBank(rows) {
  const bank = {};
  for (const row of rows) {
    if (row.error) continue;
    const { akshara, gender, style, name, meaning } = row;
    const ak = (bank[akshara] = bank[akshara] || {
      M: { south: [], north: [] },
      F: { south: [], north: [] }
    });
    const list = style === 'S' ? ak[gender].south : ak[gender].north;
    list.push({ n: name, m: meaning });
  }
  return bank;
}

// ---------------------------------------------------------------------------
// 6. Emit both files.
// ---------------------------------------------------------------------------
function tsLiteral(value, indent = 0) {
  // Compact, stable, readable JSON-ish literal (valid TypeScript).
  return JSON.stringify(value)
    .replace(/,/g, ', ')
    .replace(/","/g, '", "');
}

function writeTs(bank, hash, aksharaOrder) {
  const entries = aksharaOrder
    .filter(ak => bank[ak])
    .map(ak => {
      const node = bank[ak];
      const side = (g, s) => `[${node[g][s].map(x => `{n:${JSON.stringify(x.n)},m:${JSON.stringify(x.m)}}`).join(',')}]`;
      return `  ${JSON.stringify(ak)}: { M: { south: ${side('M', 'south')}, north: ${side('M', 'north')} }, ` +
        `F: { south: ${side('F', 'south')}, north: ${side('F', 'north')} } }`;
    })
    .join(',\n');

  const content = `/**
 * AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth : data/namakaran_name_bank.tsv
 * Generator       : scripts/build_namakaran_bank.mjs
 * Content hash    : ${hash}
 *
 * The same hash is written into api/astrology/namakaran_name_bank.php so the
 * live preview, the browser-side TypeScript and the official mPDF report can be proven to
 * show an identical name bank.
 */

export const NAMAKARAN_BANK_HASH = '${hash}';

/** Page 2 of the Namakaran report shows at most this many names per side. */
export const NAMAKARAN_MAX_PER_SIDE = ${MAX_PER_SIDE};

export type NamakaranNameStyle = 'south' | 'north';
export type NamakaranGender = 'M' | 'F';

export interface NamakaranBankEntry {
  /** Name in Roman script. */
  n: string;
  /** Short meaning. */
  m: string;
}

export interface NamakaranBankColumn {
  south: NamakaranBankEntry[];
  north: NamakaranBankEntry[];
}

export interface NamakaranBankAkshara {
  M: NamakaranBankColumn;
  F: NamakaranBankColumn;
}

/**
 * Keyed by the pada akshara (Tamil) of the birth star. Aksharas that share a
 * Tamil letter share one list on purpose: Tamil does not distinguish the
 * voiced/voiceless readings (ச = cha/sa, க = ka/ga ...), so one list serves
 * every pada that prints that letter.
 */
export const NAMAKARAN_BANK: Record<string, NamakaranBankAkshara> = {
${entries}
};
`;
  writeFileSync(OUT_TS, content);
}

function writePhp(bank, hash, aksharaOrder) {
  const phpString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const lines = [];
  for (const ak of aksharaOrder) {
    if (!bank[ak]) continue;
    const node = bank[ak];
    const side = (g, s) =>
      `[${node[g][s].map(x => `[${phpString(x.n)}, ${phpString(x.m)}]`).join(', ')}]`;
    lines.push(
      `    ${phpString(ak)} => ['M' => ['south' => ${side('M', 'south')}, 'north' => ${side('M', 'north')}], ` +
      `'F' => ['south' => ${side('F', 'south')}, 'north' => ${side('F', 'north')}]],`
    );
  }
  const content = `<?php
/**
 * AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source of truth : data/namakaran_name_bank.tsv
 * Generator       : scripts/build_namakaran_bank.mjs
 * Content hash    : ${hash}
 *
 * Kept byte-for-byte in step with src/lib/astrology/namakaranNameBank.ts so the
 * live preview and the official mPDF report always print the same names.
 * Each entry is [name, meaning]; 'south' and 'north' are the two columns of
 * page 2 of the Vedic Namakaran report.
 */

return [
    'hash' => ${phpString(hash)},
    'maxPerSide' => ${MAX_PER_SIDE},
    'bank' => [
${lines.join('\n')}
    ],
];
`;
  writeFileSync(OUT_PHP, content);
}

// ---------------------------------------------------------------------------
function main() {
  const checkOnly = process.argv.includes('--check');
  const padaTable = readPadaTable();
  const rows = readTsv();
  const problems = validate(rows, padaTable);

  const usable = rows.filter(r => !r.error && ['M', 'F'].includes(r.gender) && ['S', 'N'].includes(r.style));
  const byAkshara = new Map();
  for (const row of usable) {
    const entry = byAkshara.get(row.akshara) || { M: { S: 0, N: 0 }, F: { S: 0, N: 0 } };
    entry[row.gender][row.style] += 1;
    byAkshara.set(row.akshara, entry);
  }

  const summary = [...byAkshara.entries()].map(([ak, c]) => ({
    akshara: ak,
    boysSouth: c.M.S,
    boysNorth: c.M.N,
    girlsSouth: c.F.S,
    girlsNorth: c.F.N
  }));

  if (problems.length) {
    console.error(`✖ ${problems.length} problem(s) found in data/namakaran_name_bank.tsv:`);
    for (const problem of problems) console.error(`   - ${problem}`);
  }

  const totalNames = usable.length;
  console.log(`Namakaran bank: ${totalNames} names across ${summary.length} aksharas ` +
    `(${padaTable.length} padas covered by the report).`);
  if (problems.length) {
    console.error('Fix the data file, then re-run this generator.');
    process.exitCode = 1;
    return;
  }

  const canonical = usable
    .map(r => [r.akshara, r.gender, r.style, r.name, r.meaning].join('|'))
    .join('\n');
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 16);

  if (checkOnly) {
    const tsCurrent = readFileSync(OUT_TS, 'utf8');
    const phpCurrent = readFileSync(OUT_PHP, 'utf8');
    const inSync = tsCurrent.includes(`NAMAKARAN_BANK_HASH = '${hash}'`) &&
      phpCurrent.includes(`'hash' => '${hash}'`);
    if (!inSync) {
      console.error('✖ Generated bank files are stale — run: node scripts/build_namakaran_bank.mjs');
      process.exitCode = 1;
    } else {
      console.log(`✓ Generated bank files are in sync (hash ${hash}).`);
    }
    return;
  }

  const bank = buildBank(usable);
  const aksharaOrder = padaTable.map(p => p.letterTa).filter((ak, i, arr) => arr.indexOf(ak) === i);
  writeTs(bank, hash, aksharaOrder);
  writePhp(bank, hash, aksharaOrder);
  console.log(`✓ Wrote src/lib/astrology/namakaranNameBank.ts and api/astrology/namakaran_name_bank.php (hash ${hash}).`);
}

main();
