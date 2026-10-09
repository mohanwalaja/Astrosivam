/**
 * Compares the two engines' output over the parity corpus.
 *
 *   npm run parity:node     → tests/fixtures/parity-node.json   (Node engine)
 *   npm run parity:php      → tests/fixtures/parity-php.json    (PHP engine)
 *   npm run parity:compare  → this file; exits non-zero on ANY disagreement
 *
 * The committed contract (tests/fixtures/node-php-parity-expected.json) is what
 * the two suites assert against in CI, because the Node and PHP jobs run on
 * separate machines; this comparator is the direct engine-vs-engine check used
 * locally and by the cross-stack CI step.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type ParityVerdict = {
  status: string;
  isPresent: boolean | null;
  raw: boolean | null;
  cancelled: boolean | null;
  mild: boolean | null;
  houses: { lagna: number | null; moon: number | null; venus: number | null };
  afflictedFrom: string[];
  exceptionCodes: string[];
  mitigationCodes: string[];
};

export type ParityPayload = {
  stack: string;
  corpusVersion: number;
  kuja: Record<string, ParityVerdict>;
  births: Record<string, Record<string, number>>;
  ayanamsa: Record<string, number>;
};

/**
 * Both engines round the ayanamsa to 4 decimals and both are within ~0.04″ of
 * Swiss Ephemeris, so 0.0005° (1.8″) separates a real convention switch
 * (Δψ peaks at 18.44″) from rounding noise.
 */
export const AYANAMSA_TOLERANCE_DEG = 0.0005;

const sortCopy = (values: readonly string[]) => [...values].sort();

const describe = (value: unknown): string => JSON.stringify(value);

export function compareVerdicts(node: ParityVerdict, php: ParityVerdict): string[] {
  const problems: string[] = [];
  if (node.status !== php.status) problems.push(`status ${node.status} vs ${php.status}`);
  if (node.isPresent !== php.isPresent) problems.push(`isPresent ${describe(node.isPresent)} vs ${describe(php.isPresent)}`);
  if (node.raw !== php.raw) problems.push(`raw ${describe(node.raw)} vs ${describe(php.raw)}`);
  if (node.cancelled !== php.cancelled) problems.push(`cancelled ${describe(node.cancelled)} vs ${describe(php.cancelled)}`);
  if (node.mild !== php.mild) problems.push(`mild ${describe(node.mild)} vs ${describe(php.mild)}`);
  for (const reference of ['lagna', 'moon', 'venus'] as const) {
    if (node.houses[reference] !== php.houses[reference]) {
      problems.push(`house from ${reference} ${node.houses[reference]} vs ${php.houses[reference]}`);
    }
  }
  if (sortCopy(node.afflictedFrom).join() !== sortCopy(php.afflictedFrom).join()) {
    problems.push(`afflictedFrom [${node.afflictedFrom}] vs [${php.afflictedFrom}]`);
  }
  if (sortCopy(node.exceptionCodes).join() !== sortCopy(php.exceptionCodes).join()) {
    problems.push(`exceptions [${node.exceptionCodes}] vs [${php.exceptionCodes}]`);
  }
  if (sortCopy(node.mitigationCodes).join() !== sortCopy(php.mitigationCodes).join()) {
    problems.push(`mitigations [${node.mitigationCodes}] vs [${php.mitigationCodes}]`);
  }
  return problems;
}

export function compareBirths(node: Record<string, number>, php: Record<string, number>): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(node)) {
    if (!(key in php)) {
      problems.push(`${key} missing on the PHP side`);
      continue;
    }
    if (key === 'ayanamsa') {
      if (Math.abs(node[key] - php[key]) > AYANAMSA_TOLERANCE_DEG) {
        problems.push(`ayanamsa ${node[key]} vs ${php[key]}`);
      }
    } else if (node[key] !== php[key]) {
      problems.push(`${key} ${node[key]} vs ${php[key]}`);
    }
  }
  return problems;
}

export function compareParity(node: ParityPayload, php: ParityPayload): string[] {
  const mismatches: string[] = [];
  for (const id of Object.keys(node.kuja)) {
    const phpVerdict = php.kuja?.[id];
    if (!phpVerdict) {
      mismatches.push(`kuja ${id}: missing on the PHP side`);
      continue;
    }
    for (const problem of compareVerdicts(node.kuja[id], phpVerdict)) {
      mismatches.push(`kuja ${id}: ${problem}`);
    }
  }
  for (const id of Object.keys(node.births)) {
    const phpBirth = php.births?.[id];
    if (!phpBirth) {
      mismatches.push(`birth ${id}: missing on the PHP side`);
      continue;
    }
    for (const problem of compareBirths(node.births[id], phpBirth)) {
      mismatches.push(`birth ${id}: ${problem}`);
    }
  }
  for (const id of Object.keys(node.ayanamsa)) {
    const phpValue = php.ayanamsa?.[id];
    if (typeof phpValue !== 'number') {
      mismatches.push(`ayanamsa ${id}: missing on the PHP side`);
      continue;
    }
    if (Math.abs(node.ayanamsa[id] - phpValue) > AYANAMSA_TOLERANCE_DEG) {
      mismatches.push(`ayanamsa ${id}: ${node.ayanamsa[id]} vs ${phpValue}`);
    }
  }
  return mismatches;
}

const isDirectRun = (() => {
  const entry = process.argv[1];
  return Boolean(entry) && entry.endsWith('compare-parity.ts');
})();

if (isDirectRun) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.join(here, '..');
  const nodePath = path.join(root, 'tests', 'fixtures', 'parity-node.json');
  const phpPath = path.join(root, 'tests', 'fixtures', 'parity-php.json');
  if (!existsSync(nodePath) || !existsSync(phpPath)) {
    console.error('Missing engine output. Run both emitters first:');
    console.error('  npm run parity:node   (Node engine → tests/fixtures/parity-node.json)');
    console.error('  npm run parity:php    (PHP engine → tests/fixtures/parity-php.json)');
    process.exit(1);
  }
  const node = JSON.parse(readFileSync(nodePath, 'utf8')) as ParityPayload;
  const php = JSON.parse(readFileSync(phpPath, 'utf8')) as ParityPayload;
  const mismatches = compareParity(node, php);
  const compared =
    Object.keys(node.kuja).length + Object.keys(node.births).length + Object.keys(node.ayanamsa).length;
  if (mismatches.length === 0) {
    console.log(`Node and PHP agree on all ${compared} parity values.`);
    process.exit(0);
  }
  console.error(`Node and PHP disagree on ${mismatches.length} of ${compared} parity values:\n`);
  for (const mismatch of mismatches.slice(0, 40)) console.error(`  - ${mismatch}`);
  if (mismatches.length > 40) console.error(`  … and ${mismatches.length - 40} more`);
  process.exit(1);
}
