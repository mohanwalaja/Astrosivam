<?php
/**
 * TypeScript↔PHP parity: the PHP half.
 *
 * The site renders the same report from two engines — this PHP engine
 * (api/astrology/engine.php) and the TypeScript engine in src/lib/astrology/. They
 * used to disagree on the two things a customer actually reads: the Sevvay/Kuja
 * Dosha verdict and the ayanamsa behind every sidereal longitude.
 *
 * Both stacks are now held to one answer over a committed corpus:
 *   tests/fixtures/node-php-parity-corpus.json     the charts
 *   tests/fixtures/node-php-parity-expected.json   the verdict both engines owe
 *   tests/node-php-parity.test.ts                  the Node half of this check
 *
 * Any drift fails this suite; `npm run parity:php && npm run parity:compare`
 * additionally diffs the two engines directly.
 */
require_once __DIR__ . '/../api/astrology/engine.php';

function checkNodePhpParity(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$failures = [];

$corpusPath = __DIR__ . '/fixtures/node-php-parity-corpus.json';
$expectedPath = __DIR__ . '/fixtures/node-php-parity-expected.json';
foreach ([$corpusPath, $expectedPath] as $required) {
    if (!is_file($required)) {
        throw new RuntimeException("Missing parity fixture {$required}");
    }
}
$corpus = json_decode((string) file_get_contents($corpusPath), true);
$expected = json_decode((string) file_get_contents($expectedPath), true);
checkNodePhpParity(is_array($corpus) && is_array($expected), 'The parity corpus and contract must both be readable JSON');
checkNodePhpParity(
    (int) ($expected['corpusVersion'] ?? -1) === (int) ($corpus['version'] ?? -2),
    'The parity contract was generated from a different corpus version; rebuild both with npm run parity:seed'
);

const PARITY_AYANAMSA_TOLERANCE = 0.0005; // 1.8″ — a convention switch moves it by up to 18.44″

$kujaMethod = new ReflectionMethod(AstroEngine::class, 'evaluateKujaDosha');
$kujaMethod->setAccessible(true);

$verdictProblems = static function (array $actual, array $contract): array {
    $problems = [];
    $same = static function ($key) use ($actual, $contract, &$problems): void {
        if (($actual[$key] ?? null) !== ($contract[$key] ?? null)) {
            $problems[] = sprintf(
                '%s %s vs %s',
                $key,
                json_encode($actual[$key] ?? null),
                json_encode($contract[$key] ?? null)
            );
        }
    };
    foreach (['status', 'isPresent', 'raw', 'cancelled', 'mild'] as $key) {
        $same($key);
    }
    foreach (['lagna', 'moon', 'venus'] as $reference) {
        $actualHouse = $actual['houses'][$reference] ?? null;
        $contractHouse = $contract['houses'][$reference] ?? null;
        if ($actualHouse !== $contractHouse) {
            $problems[] = sprintf('house from %s %s vs %s', $reference, json_encode($actualHouse), json_encode($contractHouse));
        }
    }
    foreach (['afflictedFrom' => 'afflictedFrom', 'exceptionCodes' => 'exceptions', 'mitigationCodes' => 'mitigations'] as $key => $label) {
        $actualList = $actual[$key] ?? [];
        $contractList = $contract[$key] ?? [];
        sort($actualList);
        sort($contractList);
        if ($actualList !== $contractList) {
            $problems[] = sprintf('%s [%s] vs [%s]', $label, implode(',', $actualList), implode(',', $contractList));
        }
    }
    return $problems;
};

$doctrineChecked = 0;

// 1. Sevvay / Kuja Dosha verdicts — doctrine expectations, then the contract.
foreach ($corpus['kujaCharts'] as $chart) {
    $evaluation = $kujaMethod->invoke(null, $chart['placements']);
    $verdict = [
        'status' => $evaluation['status'],
        'isPresent' => $evaluation['isPresent'],
        'raw' => $evaluation['raw'],
        'cancelled' => $evaluation['cancelled'],
        'mild' => $evaluation['mild'],
        'houses' => $evaluation['houses'],
        'afflictedFrom' => array_values($evaluation['afflictedFrom']),
        'exceptionCodes' => array_column($evaluation['exceptions'], 'code'),
        'mitigationCodes' => array_column($evaluation['mitigations'], 'code'),
    ];

    if (isset($chart['expect'])) {
        $doctrineChecked++;
        $codes = array_merge($verdict['exceptionCodes'], $verdict['mitigationCodes']);
        if ($verdict['status'] !== $chart['expect']['status']) {
            $failures[] = sprintf(
                '%s (%s): PHP returned %s [%s] where the rule table expects %s',
                $chart['id'],
                $chart['note'],
                $verdict['status'],
                implode(',', $codes),
                $chart['expect']['status']
            );
        }
        foreach ($chart['expect']['codes'] as $code) {
            if (!in_array($code, $codes, true)) {
                $failures[] = sprintf('%s (%s): expected the %s rule to apply', $chart['id'], $chart['note'], $code);
            }
        }
    }

    if (!isset($expected['kuja'][$chart['id']])) {
        $failures[] = "{$chart['id']}: missing from the parity contract";
        continue;
    }
    foreach ($verdictProblems($verdict, $expected['kuja'][$chart['id']]) as $problem) {
        $failures[] = "{$chart['id']} ({$chart['note']}): {$problem}";
    }
}
checkNodePhpParity($doctrineChecked >= 20, 'The corpus must keep its hand-written doctrine cases');

// 2. Birth charts: ayanamsa plus the sign-level results a customer reads.
foreach ($corpus['birthCharts'] as $birth) {
    $horoscope = AstroEngine::calculateHoroscope([
        'name' => $birth['devoteeName'],
        'dob' => $birth['dob'],
        'tob' => $birth['tob'],
        'birthPlace' => $birth['birthPlace'],
        'country' => $birth['country'],
        'latitude' => $birth['latitude'],
        'longitude' => $birth['longitude'],
        'timezoneOffsetHours' => $birth['timezoneOffsetHours'],
    ]);
    $marsRasi = null;
    foreach ($horoscope['planetPositions'] as $position) {
        if ($position['graha'] === 'mars') {
            $marsRasi = (int) $position['rasi'];
        }
    }
    $summary = [
        'ayanamsa' => round((float) $horoscope['ayanamsa'], 4),
        'lagnaRasi' => (int) $horoscope['lagnaRasi'],
        'chandraRasi' => (int) $horoscope['chandraRasi'],
        'marsRasi' => $marsRasi,
        // The engine keeps a 0-based nakshatra index; the contract is 1-based.
        'janmaNakshatraIndex' => ((int) $horoscope['janmaNakshatraIndex']) + 1,
        'janmaPada' => (int) $horoscope['janmaPada'],
    ];

    if (!isset($expected['births'][$birth['id']])) {
        $failures[] = "{$birth['id']}: missing from the parity contract";
        continue;
    }
    foreach ($expected['births'][$birth['id']] as $key => $contractValue) {
        if (!array_key_exists($key, $summary)) {
            $failures[] = "{$birth['id']}: PHP did not produce {$key}";
            continue;
        }
        if ($key === 'ayanamsa') {
            if (abs($summary[$key] - (float) $contractValue) > PARITY_AYANAMSA_TOLERANCE) {
                $failures[] = sprintf('%s: ayanamsa %s vs the agreed %s', $birth['id'], $summary[$key], $contractValue);
            }
        } elseif ($summary[$key] !== (int) $contractValue) {
            $failures[] = sprintf('%s: %s %s vs the agreed %s', $birth['id'], $key, json_encode($summary[$key]), json_encode($contractValue));
        }
    }
}

// 3. Ayanamsa convention (TRUE = mean Lahiri + Δψ) across the whole service range.
$peakAyanamsa = 0.0;
foreach ($corpus['ayanamsaDays'] as $instant) {
    $positions = AstroEngine::computeGeocentricPositions((float) $instant['jd'], false);
    $value = round((float) $positions['ayanamsa'], 4);
    if (!isset($expected['ayanamsa'][$instant['id']])) {
        $failures[] = "{$instant['id']}: missing from the parity contract";
        continue;
    }
    $contractValue = (float) $expected['ayanamsa'][$instant['id']];
    $peakAyanamsa = max($peakAyanamsa, abs($value - $contractValue));
    if (abs($value - $contractValue) > PARITY_AYANAMSA_TOLERANCE) {
        $failures[] = sprintf('%s (%s): ayanamsa %s vs the agreed %s', $instant['id'], $instant['label'], $value, $contractValue);
    }
}
checkNodePhpParity(
    $peakAyanamsa < 0.0001,
    sprintf('The ayanamsa must stay locked to the agreed convention; largest drift %.6f°', $peakAyanamsa)
);

if ($failures !== []) {
    foreach (array_slice($failures, 0, 20) as $failure) {
        echo "[FAIL] {$failure}\n";
    }
    if (count($failures) > 20) {
        echo '[FAIL] … and ' . (count($failures) - 20) . " more\n";
    }
    throw new RuntimeException(count($failures) . ' TypeScript↔PHP parity mismatch(es)');
}

printf(
    "  [PASS] %d Kuja verdicts (%d doctrine), %d birth charts and %d ayanamsa instants match the TypeScript↔PHP contract\n",
    count($corpus['kujaCharts']),
    $doctrineChecked,
    count($corpus['birthCharts']),
    count($corpus['ayanamsaDays'])
);
echo "Node ↔ PHP parity (Kuja Dosha rule set + ayanamsa convention) passed.\n";
