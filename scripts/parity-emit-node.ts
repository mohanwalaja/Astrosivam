/**
 * Emits the Node engine's side of the Node↔PHP parity corpus:
 *   npx tsx scripts/parity-emit-node.ts  →  tests/fixtures/parity-node.json
 *
 * The file is a diagnostic artefact (git-ignored). The committed contract both
 * stacks are checked against is tests/fixtures/node-php-parity-expected.json;
 * run `npm run parity:php` and then `npm run parity:compare` to diff the two
 * engines directly, or `npx tsx scripts/parity-emit-node.ts --write-expected` to
 * re-seed the contract from the Node engine after an intentional rule change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  NAKSHATRAM_NAMES_EN,
  calculateLahiriAyanamsa,
  calculatePrecisionHoroscope
} from '../src/lib/astrology/astronomy.js';
import { evaluateKujaDosha, type KujaDoshaAssessment } from '../src/lib/astrology/kujaDosha.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const corpus = JSON.parse(
  readFileSync(path.join(root, 'tests', 'fixtures', 'node-php-parity-corpus.json'), 'utf8')
) as {
  version: number;
  kujaCharts: Array<{ id: string; kind: string; placements: Record<string, number | null> }>;
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

/** The exact fields both stacks must agree on for a Kuja chart. */
export function kujaVerdict(assessment: KujaDoshaAssessment) {
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
}

const round4 = (value: number) => Number(value.toFixed(4));

const kuja: Record<string, ReturnType<typeof kujaVerdict>> = {};
for (const chart of corpus.kujaCharts) {
  kuja[chart.id] = kujaVerdict(evaluateKujaDosha(chart.placements));
}

const births: Record<string, Record<string, number>> = {};
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
  const body = (graha: string) => {
    const position = horoscope.planetPositions.find(entry => entry.graha === graha);
    if (!position) throw new Error(`${graha} missing from ${birth.id}`);
    return position.rasi;
  };
  births[birth.id] = {
    ayanamsa: round4(horoscope.ayanamsa),
    lagnaRasi: horoscope.lagnaRasi,
    chandraRasi: horoscope.chandraRasi,
    marsRasi: body('mars'),
    // Compared by index so the two engines' transliterations do not matter.
    janmaNakshatraIndex: NAKSHATRAM_NAMES_EN.indexOf(horoscope.janmaNakshatraEn) + 1,
    janmaPada: horoscope.janmaPada
  };
}

const ayanamsa: Record<string, number> = {};
for (const instant of corpus.ayanamsaDays) {
  ayanamsa[instant.id] = round4(calculateLahiriAyanamsa(instant.jd));
}

const payload = {
  stack: 'node',
  corpusVersion: corpus.version,
  generatedBy: 'scripts/parity-emit-node.ts',
  kuja,
  births,
  ayanamsa
};

const writeExpected = process.argv.includes('--write-expected');
const target = writeExpected
  ? path.join(root, 'tests', 'fixtures', 'node-php-parity-expected.json')
  : path.join(root, 'tests', 'fixtures', 'parity-node.json');

if (writeExpected) {
  writeFileSync(
    target,
    `${JSON.stringify(
      {
        version: 1,
        corpusVersion: corpus.version,
        note:
          'Agreed Node↔PHP parity contract over tests/fixtures/node-php-parity-corpus.json. ' +
          'Both engines must reproduce every verdict here: tests/node-php-parity.test.ts checks ' +
          'the Node engine and tests/node-php-parity.test.php checks the PHP engine. Re-seed with ' +
          '`npx tsx scripts/parity-emit-node.ts --write-expected` after an intentional, ' +
          'reviewed rule change.',
        kuja,
        births,
        ayanamsa
      },
      null,
      2
    )}\n`,
    'utf8'
  );
} else {
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

console.log(
  `Wrote ${Object.keys(kuja).length} Kuja verdicts, ${Object.keys(births).length} birth-chart summaries ` +
    `and ${Object.keys(ayanamsa).length} ayanamsa values to ${path.relative(root, target)}`
);
