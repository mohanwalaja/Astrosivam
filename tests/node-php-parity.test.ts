import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  NAKSHATRAM_NAMES_EN,
  calculateLahiriAyanamsa,
  calculatePrecisionHoroscope
} from '../server/astrology/astronomy.js';
import { evaluateKujaDosha } from '../server/astrology/kujaDosha.js';
import {
  AYANAMSA_TOLERANCE_DEG,
  compareBirths,
  compareParity,
  compareVerdicts,
  type ParityPayload,
  type ParityVerdict
} from '../scripts/compare-parity.js';

/**
 * Node↔PHP parity over a fixed corpus of charts.
 *
 * WHY: the site renders the same report from two engines — this Node engine and
 * api/astrology/engine.php on cPanel. They used to disagree on the two things
 * customers actually read: the Sevvay/Kuja Dosha verdict (finding F1) and the
 * ayanamsa behind every sidereal longitude (finding F2). This suite locks both
 * stacks to one answer over a committed corpus:
 *
 *   tests/fixtures/node-php-parity-corpus.json       the charts
 *   tests/fixtures/node-php-parity-expected.json     the verdict both engines owe
 *   tests/node-php-parity.test.php                   the PHP half of the same check
 *
 * The doctrine cases in the corpus carry hand-written expectations taken from
 * the PHP rule table, so they verify this engine against the published rule
 * rather than against itself. If tests/fixtures/parity-php.json is present
 * (produced by `npm run parity:php`), the Node and PHP outputs are also diffed
 * directly and ANY disagreement fails.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const fixture = (name: string) => JSON.parse(readFileSync(path.join(root, 'tests', 'fixtures', name), 'utf8'));

const corpus = fixture('node-php-parity-corpus.json') as {
  version: number;
  kujaCharts: Array<{
    id: string;
    kind: string;
    note: string;
    placements: Record<string, number | null>;
    expect?: { status: string; codes: string[] };
  }>;
  birthCharts: Array<{
    id: string;
    devoteeName: string;
    dob: string;
    tob: string;
    birthPlace: string;
    country: string;
    latitude: number;
    longitude: number;
    timezoneOffsetHours: number;
  }>;
  ayanamsaDays: Array<{ id: string; label: string; jd: number }>;
};
const expected = fixture('node-php-parity-expected.json') as {
  version: number;
  corpusVersion: number;
  kuja: Record<string, ParityVerdict>;
  births: Record<string, Record<string, number>>;
  ayanamsa: Record<string, number>;
};

assert.equal(
  expected.corpusVersion,
  corpus.version,
  'The parity contract was generated from a different corpus version; rebuild both with npm run parity:seed'
);

const verdictOf = (placements: Record<string, number | null>): ParityVerdict => {
  const assessment = evaluateKujaDosha(placements);
  return {
    status: assessment.status,
    isPresent: assessment.isPresent,
    raw: assessment.raw,
    cancelled: assessment.cancelled,
    mild: assessment.mild,
    houses: assessment.houses,
    afflictedFrom: assessment.afflictedFrom,
    exceptionCodes: assessment.exceptions.map(entry => entry.code),
    mitigationCodes: assessment.mitigations.map(entry => entry.code)
  };
};

const nodePayload: ParityPayload = {
  stack: 'node',
  corpusVersion: corpus.version,
  kuja: {},
  births: {},
  ayanamsa: {}
};

// ---------------------------------------------------------------------------
// 1. Kuja / Sevvay Dosha — doctrine cases with hand-written expectations, then
//    every chart against the shared contract.
// ---------------------------------------------------------------------------
let doctrineChecked = 0;
for (const chart of corpus.kujaCharts) {
  const verdict = verdictOf(chart.placements);
  nodePayload.kuja[chart.id] = verdict;

  if (chart.expect) {
    doctrineChecked += 1;
    const codes = [...verdict.exceptionCodes, ...verdict.mitigationCodes];
    assert.equal(
      verdict.status,
      chart.expect.status,
      `${chart.id} (${chart.note}): Node returned ${verdict.status} ` +
        `${JSON.stringify(codes)} where the classical rule table expects ${chart.expect.status}`
    );
    for (const code of chart.expect.codes) {
      assert.ok(codes.includes(code), `${chart.id} (${chart.note}): expected the ${code} rule to apply`);
    }
  }

  const contract = expected.kuja[chart.id];
  assert.ok(contract, `${chart.id}: missing from the parity contract`);
  const problems = compareVerdicts(verdict, contract);
  assert.equal(
    problems.length,
    0,
    `${chart.id} (${chart.note}): Node drifts from the agreed PHP/Node verdict — ${problems.join('; ')}`
  );
}
assert.ok(doctrineChecked >= 20, 'The corpus must keep its hand-written doctrine cases');

// ---------------------------------------------------------------------------
// 2. Birth charts: ayanamsa plus the sign-level results a customer reads.
// ---------------------------------------------------------------------------
for (const birth of corpus.birthCharts) {
  const horoscope = calculatePrecisionHoroscope(
    birth.devoteeName,
    birth.dob,
    birth.tob,
    birth.birthPlace,
    birth.latitude,
    birth.longitude,
    birth.timezoneOffsetHours,
    birth.country ?? '',
    'M'
  );
  const mars = horoscope.planetPositions.find(entry => entry.graha === 'mars');
  assert.ok(mars, `${birth.id}: Mars must be present in every chart`);
  const summary = {
    ayanamsa: Number(horoscope.ayanamsa.toFixed(4)),
    lagnaRasi: horoscope.lagnaRasi,
    chandraRasi: horoscope.chandraRasi,
    marsRasi: mars.rasi,
    janmaNakshatraIndex: NAKSHATRAM_NAMES_EN.indexOf(horoscope.janmaNakshatraEn) + 1,
    janmaPada: horoscope.janmaPada
  };
  nodePayload.births[birth.id] = summary;

  const contract = expected.births[birth.id];
  assert.ok(contract, `${birth.id}: missing from the parity contract`);
  const problems = compareBirths(summary, contract);
  assert.equal(problems.length, 0, `${birth.id} (${birth.dob} ${birth.tob}): ${problems.join('; ')}`);
}

// ---------------------------------------------------------------------------
// 3. Ayanamsa: TRUE (mean + Δψ) on both stacks, over the whole service range.
// ---------------------------------------------------------------------------
let peakAyanamsa = 0;
for (const instant of corpus.ayanamsaDays) {
  const value = Number(calculateLahiriAyanamsa(instant.jd).toFixed(4));
  nodePayload.ayanamsa[instant.id] = value;
  const contract = expected.ayanamsa[instant.id];
  assert.ok(contract !== undefined, `${instant.id}: missing from the parity contract`);
  peakAyanamsa = Math.max(peakAyanamsa, Math.abs(value - contract));
  assert.ok(
    Math.abs(value - contract) <= AYANAMSA_TOLERANCE_DEG,
    `${instant.id} (${instant.label}): ayanamsa ${value} drifts from the agreed ${contract}`
  );
}
// The whole point of the fix: a MEAN↔TRUE switch moves this by up to 18.44″.
assert.ok(
  peakAyanamsa < 0.0001,
  `The ayanamsa must stay locked to the agreed convention; largest drift ${peakAyanamsa.toFixed(6)}°`
);

// ---------------------------------------------------------------------------
// 4. Direct Node↔PHP comparison when the PHP engine's output is available.
// ---------------------------------------------------------------------------
const phpPath = path.join(root, 'tests', 'fixtures', 'parity-php.json');
if (existsSync(phpPath)) {
  const phpPayload = JSON.parse(readFileSync(phpPath, 'utf8')) as ParityPayload;
  const mismatches = compareParity(nodePayload, phpPayload);
  assert.equal(
    mismatches.length,
    0,
    `The Node and PHP engines disagree on ${mismatches.length} parity value(s):\n  - ${mismatches.slice(0, 20).join('\n  - ')}`
  );
  console.log('  [PASS] Node and PHP agree on every parity value (direct engine-vs-engine diff)');
} else {
  console.log('  [NOTE] tests/fixtures/parity-php.json is absent — the PHP engine was not run here.');
  console.log('         Run `npm run parity:php && npm run parity:compare` where PHP 8.1 is available');
  console.log('         for the direct engine-vs-engine diff; CI runs both halves.');
}

console.log(
  `  [PASS] ${Object.keys(nodePayload.kuja).length} Kuja verdicts (${doctrineChecked} doctrine), ` +
    `${Object.keys(nodePayload.births).length} birth charts and ` +
    `${Object.keys(nodePayload.ayanamsa).length} ayanamsa instants match the Node↔PHP contract`
);
console.log('Node ↔ PHP parity (Kuja Dosha rule set + ayanamsa convention) passed.');
