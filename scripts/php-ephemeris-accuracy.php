<?php
/**
 * Compare the pure-PHP ephemeris in api/astrology/engine.php against Swiss
 * Ephemeris (Lahiri) fixtures produced by scripts/swe_reference.py.
 *
 *   python3 scripts/swe_reference.py        # optional: regenerate the fixture
 *   php scripts/php-ephemeris-accuracy.php  # [path/to/fixture.json]
 *
 * Prints max / RMS error in arcseconds per body and exits non-zero when the
 * documented tolerances are exceeded.
 */
declare(strict_types=1);

require_once __DIR__ . '/../api/astrology/engine.php';

$fixture = $argv[1] ?? __DIR__ . '/../tests/fixtures/swiss-ephemeris-lahiri-reference.json';
$data = json_decode((string) file_get_contents($fixture), true);
if (!is_array($data) || empty($data['samples'])) {
    fwrite(STDERR, "Cannot read fixture {$fixture}\n");
    exit(2);
}

$call = static function (string $method, ...$args) {
    $m = new ReflectionMethod(AstroEngine::class, $method);
    $m->setAccessible(true);
    return $m->invoke(null, ...$args);
};
$hasMethod = static fn(string $m): bool => method_exists(AstroEngine::class, $m);

$delta = static function (float $a, float $b): float {
    $d = fmod($a - $b + 540.0, 360.0) - 180.0;
    return $d * 3600.0; // arcseconds
};

// Tolerances in arcseconds (1' = 60").
$tolerance = [
    'ayanamsa' => 1.0,
    'ayanMean' => 1.0,
    'deltaT(s)' => 2.0,
    'sun' => 20.0,
    'moon' => 36.0,       // ±0.01°
    'mercury' => 60.0,
    'venus' => 60.0,
    'mars' => 60.0,
    'jupiter' => 60.0,
    'saturn' => 60.0,
    'rahu' => 60.0,
    'meanNode' => 2.0,
];

$stats = [];
$record = static function (string $key, float $err, string $utc) use (&$stats): void {
    if (!isset($stats[$key])) $stats[$key] = ['max' => 0.0, 'maxAt' => '', 'sq' => 0.0, 'n' => 0, 'fail' => 0];
    $s =& $stats[$key];
    if (abs($err) > abs($s['max'])) { $s['max'] = $err; $s['maxAt'] = $utc; }
    $s['sq'] += $err * $err;
    $s['n']++;
};

$modern = $hasMethod('computeGeocentricPositions');

foreach ($data['samples'] as $sample) {
    $jdUt = (float) $sample['jd_ut'];
    $utc = (string) $sample['utc'];
    if ($modern) {
        $pos = AstroEngine::computeGeocentricPositions($jdUt, true, 'TRUE');
        $record('ayanamsa', ($pos['ayanamsa'] - (float) $sample['ayanamsaTrue']) * 3600.0, $utc);
        $record('ayanMean', ($pos['ayanamsaMean'] - (float) $sample['ayanamsaMean']) * 3600.0, $utc);
        $record('deltaT(s)', ($pos['deltaT'] - (float) $sample['deltaT']), $utc);
        foreach (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'rahu', 'meanNode'] as $body) {
            $record($body, $delta($pos['sidereal'][$body], (float) $sample['sidereal'][$body]), $utc);
        }
    } else {
        // Legacy engine: UT-based T and polynomial ayanamsa.
        $T = ($jdUt - 2451545.0) / 36525.0;
        $ayan = 23.85709167 + 1.396971 * $T + 0.000308 * $T * $T;
        $record('ayanMean', ($ayan - (float) $sample['ayanamsaMean']) * 3600.0, $utc);
        $trop = [
            'sun' => $call('sunTropicalLongitude', $T),
            'moon' => $call('moonTropicalLongitude', $T),
            'rahu' => $call('trueLunarNode', $T),
        ];
        foreach (['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as $p) {
            $trop[$p] = $call('planetGeocentricLongitude', $p, $T);
        }
        foreach ($trop as $body => $lon) {
            $sid = fmod($lon - $ayan + 720.0, 360.0);
            $record($body, $delta($sid, (float) $sample['sidereal'][$body]), $utc);
        }
    }
}

$failed = false;
printf("%-10s %12s %12s %8s   %s\n", 'body', 'max(\")', 'rms(\")', 'tol(\")', 'worst sample');
foreach ($stats as $body => $s) {
    $rms = sqrt($s['sq'] / max(1, $s['n']));
    $tol = $tolerance[$body] ?? 60.0;
    $ok = abs($s['max']) <= $tol;
    if (!$ok) $failed = true;
    printf("%-10s %12.2f %12.2f %8.1f   %s %s\n", $body, $s['max'], $rms, $tol, $s['maxAt'], $ok ? 'OK' : 'FAIL');
}
printf("Samples: %d  (Swiss Ephemeris %s)\n", count($data['samples']), $data['sweVersion'] ?? '?');
exit($failed ? 1 : 0);
