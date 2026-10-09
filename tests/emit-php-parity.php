<?php
/**
 * Emits the PHP engine's side of the Node↔PHP parity corpus:
 *   php tests/emit-php-parity.php  →  tests/fixtures/parity-php.json
 *
 * This is a diagnostic artefact, not a test: the suites that gate a merge are
 * tests/node-php-parity.test.ts (Node) and tests/node-php-parity.test.php (PHP),
 * both of which check their engine against the committed contract in
 * tests/fixtures/node-php-parity-expected.json.
 *
 * Run both emitters and then `npm run parity:compare` to diff the two engines
 * directly; any disagreement exits non-zero.
 */
require_once __DIR__ . '/../api/astrology/engine.php';

$corpusPath = __DIR__ . '/fixtures/node-php-parity-corpus.json';
$corpus = json_decode((string) file_get_contents($corpusPath), true);
if (!is_array($corpus)) {
    fwrite(STDERR, "Cannot read the parity corpus at {$corpusPath}\n");
    exit(1);
}

$kujaMethod = new ReflectionMethod(AstroEngine::class, 'evaluateKujaDosha');
$kujaMethod->setAccessible(true);

$kuja = [];
foreach ($corpus['kujaCharts'] as $chart) {
    $evaluation = $kujaMethod->invoke(null, $chart['placements']);
    $kuja[$chart['id']] = [
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
}

$births = [];
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
    $births[$birth['id']] = [
        'ayanamsa' => round((float) $horoscope['ayanamsa'], 4),
        'lagnaRasi' => (int) $horoscope['lagnaRasi'],
        'chandraRasi' => (int) $horoscope['chandraRasi'],
        'marsRasi' => $marsRasi,
        // The engine keeps a 0-based nakshatra index; the contract is 1-based.
        'janmaNakshatraIndex' => ((int) $horoscope['janmaNakshatraIndex']) + 1,
        'janmaPada' => (int) $horoscope['janmaPada'],
    ];
}

$ayanamsa = [];
foreach ($corpus['ayanamsaDays'] as $instant) {
    $positions = AstroEngine::computeGeocentricPositions((float) $instant['jd'], false);
    $ayanamsa[$instant['id']] = round((float) $positions['ayanamsa'], 4);
}

$payload = [
    'stack' => 'php',
    'corpusVersion' => $corpus['version'],
    'generatedBy' => 'tests/emit-php-parity.php',
    'kuja' => $kuja,
    'births' => $births,
    'ayanamsa' => $ayanamsa,
];

$target = __DIR__ . '/fixtures/parity-php.json';
file_put_contents($target, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
echo 'Wrote ' . count($kuja) . ' Kuja verdicts, ' . count($births) . ' birth-chart summaries and '
    . count($ayanamsa) . " ayanamsa values to tests/fixtures/parity-php.json\n";
