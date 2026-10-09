<?php
require_once __DIR__ . '/../api/astrology/engine.php';

function checkAstrologyAccuracyRegression(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

$signs = AstroEngine::$RASIS;
checkAstrologyAccuracyRegression($signs[4]['en'] === 'Simham (Leo)', 'PHP Rasi index 5 is Simham (Leo)');
checkAstrologyAccuracyRegression($signs[4]['ta'] === 'சிம்மம்', 'PHP Simham uses the Tamil Simham glyph mapping');
checkAstrologyAccuracyRegression($signs[9]['en'] === 'Magaram (Capricorn)', 'PHP Rasi index 10 is Magaram (Capricorn)');
checkAstrologyAccuracyRegression($signs[9]['ta'] === 'மகரம்', 'PHP Magaram uses the Tamil Magaram glyph mapping');

$angularDifference = static function (float $actual, float $expected): float {
    return abs(fmod(($actual - $expected + 540.0), 360.0) - 180.0);
};

// Swiss Ephemeris 2.10.03 references (Lahiri, SE_TRUE_NODE) at UT Julian Days.
// The PHP engine derives the osculating node from the ELP2000-82 lunar state
// vector; its documented ceiling against Swiss Ephemeris is ≈ 1′ (0.03° here).
$nodeMethod = new ReflectionMethod(AstroEngine::class, 'trueLunarNode');
$nodeMethod->setAccessible(true);
$nodeReferences = [
    [2451545.0, 100.099672927],
    [2460409.25, 351.431376048],
    [2469807.5, 214.939271678]
];
foreach ($nodeReferences as [$julianDay, $expectedRahuSidereal]) {
    // Ask for the osculating node explicitly: the engine default is the
    // classical MEAN node (ASTRO_RAHU_NODE_TYPE=MEAN), so this reference block
    // must not inherit the default when it is comparing against SE_TRUE_NODE.
    $positions = AstroEngine::computeGeocentricPositions((float) $julianDay, false, 'TRUE');
    $phpRahu = $positions['sidereal']['rahu'];
    $difference = $angularDifference($phpRahu, $expectedRahuSidereal);
    checkAstrologyAccuracyRegression(
        $difference <= 0.03,
        sprintf('PHP osculating Rahu agrees with the Swiss Ephemeris true node within 0.03° (Δ %.4f°)', $difference)
    );
    $phpKetu = $positions['sidereal']['ketu'];
    $axisDifference = abs(abs(fmod(($phpKetu - $phpRahu + 540.0), 360.0) - 180.0) - 180.0);
    checkAstrologyAccuracyRegression($axisDifference < 1e-10, 'PHP Ketu is exactly opposite Rahu');
    // Legacy wrapper: apparent tropical node minus the true ayanamsa must equal the sidereal node.
    $legacy = fmod((float) $nodeMethod->invoke(null, $positions['T']) - $positions['ayanamsa'] + 720.0, 360.0);
    checkAstrologyAccuracyRegression(
        $angularDifference($legacy, $phpRahu) < 1e-6,
        'Legacy trueLunarNode() wrapper is consistent with computeGeocentricPositions()'
    );
}

// Rahu node convention (ASTRO_RAHU_NODE_TYPE): MEAN (the classical,
// always-retrograde convention) by default, TRUE (osculating) on request; Ketu
// is always exactly opposite whichever Rahu is chosen.
AstroEngine::setNodeType(null);
checkAstrologyAccuracyRegression(
    defined('ASTRO_RAHU_NODE_TYPE') || AstroEngine::nodeType() === AstroEngine::NODE_TYPE_MEAN,
    'Without config.php the engine defaults to the classical MEAN node'
);
$nodeSample = 2460409.25; // 2024-04-08 18:00 UT — SE_TRUE_NODE 351.431376048, SE_MEAN_NODE 351.453090361 (Lahiri)
$asTrue = AstroEngine::computeGeocentricPositions($nodeSample, false, 'TRUE');
$asMean = AstroEngine::computeGeocentricPositions($nodeSample, false, 'MEAN');
checkAstrologyAccuracyRegression($asTrue['nodeType'] === 'TRUE' && $asMean['nodeType'] === 'MEAN', 'computeGeocentricPositions() echoes the node convention it used');
checkAstrologyAccuracyRegression(
    $angularDifference($asTrue['sidereal']['rahu'], $asTrue['sidereal']['trueNode']) < 1e-12
    && $angularDifference($asMean['sidereal']['rahu'], $asMean['sidereal']['meanNode']) < 1e-12,
    'Rahu follows the selected convention while both trueNode and meanNode remain available'
);
checkAstrologyAccuracyRegression(
    $angularDifference($asMean['sidereal']['rahu'], 351.453090361) * 3600.0 < 2.0,
    sprintf('MEAN Rahu matches the Swiss Ephemeris SE_MEAN_NODE reference (Δ %.2f″)', $angularDifference($asMean['sidereal']['rahu'], 351.453090361) * 3600.0)
);
foreach ([$asTrue, $asMean] as $variant) {
    $ketuOpposition = abs(abs(fmod(($variant['sidereal']['ketu'] - $variant['sidereal']['rahu'] + 540.0), 360.0) - 180.0) - 180.0);
    checkAstrologyAccuracyRegression($ketuOpposition < 1e-10, $variant['nodeType'] . ' node: Ketu is exactly 180° from Rahu');
}
$nodeBirth = ['name' => 'Node', 'dob' => '1990-01-05', 'tob' => '12:00', 'birthPlace' => 'Chennai', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata'];
AstroEngine::setNodeType('MEAN');
$meanChart = AstroEngine::calculateHoroscope($nodeBirth);
AstroEngine::setNodeType('TRUE');
$trueChart = AstroEngine::calculateHoroscope($nodeBirth);
AstroEngine::setNodeType(null);
checkAstrologyAccuracyRegression(
    ($meanChart['nodeType'] ?? null) === 'MEAN' && ($trueChart['nodeType'] ?? null) === 'TRUE'
    && ($meanChart['ephemeris']['rahuNodeType'] ?? null) === 'MEAN',
    'calculateHoroscope() declares nodeType and the ephemeris block records rahuNodeType'
);
checkAstrologyAccuracyRegression(
    $angularDifference($meanChart['ephemeris']['siderealLongitudes']['rahu'], $trueChart['ephemeris']['siderealLongitudes']['rahu']) > 1.0,
    'Switching ASTRO_RAHU_NODE_TYPE really changes Rahu (1990-01-05 Chennai: TRUE 293.21° vs MEAN 294.51°)'
);
checkAstrologyAccuracyRegression(
    abs($meanChart['ephemeris']['siderealLongitudes']['rahu'] - $meanChart['ephemeris']['rahuMeanNode']) < 1e-4
    && abs($trueChart['ephemeris']['siderealLongitudes']['rahu'] - $trueChart['ephemeris']['rahuTrueNode']) < 1e-4,
    'The chart Rahu longitude equals the declared convention\'s node longitude'
);
$rahuRow = static fn(array $chart, string $graha) => array_values(array_filter($chart['planetPositions'], static fn($p) => $p['graha'] === $graha))[0];
foreach ([$meanChart, $trueChart] as $chart) {
    $r = $rahuRow($chart, 'rahu'); $k = $rahuRow($chart, 'ketu');
    checkAstrologyAccuracyRegression(
        (($r['rasi'] + 6 - 1) % 12) + 1 === $k['rasi'] && abs($r['degrees'] - $k['degrees']) < 1e-9,
        $chart['nodeType'] . ' node: Ketu occupies the 7th Rasi from Rahu at the same degree'
    );
}
$invalidRejected = false;
try { AstroEngine::setNodeType('SIDEREAL'); } catch (InvalidArgumentException $e) { $invalidRejected = true; }
AstroEngine::setNodeType(null);
checkAstrologyAccuracyRegression($invalidRejected, 'An unsupported node type is rejected instead of silently changing Rahu');

// Chitra Paksha / Lahiri ayanamsa: mean (swe_get_ayanamsa_ut) and true
// (swe_get_ayanamsa_ex_ut = mean + Δψ, the value Drik Panchang prints).
$j2000 = AstroEngine::computeGeocentricPositions(2451545.0, false);
checkAstrologyAccuracyRegression(
    abs($j2000['ayanamsaMean'] - 23.8570923537) * 3600.0 < 0.05,
    sprintf('J2000 Lahiri mean ayanamsa matches Swiss Ephemeris to 0.05″ (Δ %.4f″)', ($j2000['ayanamsaMean'] - 23.8570923537) * 3600.0)
);
checkAstrologyAccuracyRegression(
    abs($j2000['ayanamsa'] - 23.8532225) * 3600.0 < 0.1,
    sprintf('J2000 Lahiri true ayanamsa (23°51′11.6″) includes nutation Δψ (Δ %.4f″)', ($j2000['ayanamsa'] - 23.8532225) * 3600.0)
);
checkAstrologyAccuracyRegression(
    abs($j2000['nutation']['dpsi'] * 3600.0 - (-13.93)) < 0.05,
    'J2000 nutation in longitude is −13.93″ (IAU 1980 full series)'
);
$greenwichLagna = AstroEngine::computeAscendant(2451545.0, 51.4779, -0.0015, $j2000);
checkAstrologyAccuracyRegression(
    $angularDifference($greenwichLagna['sidereal'], 0.409689230) < 0.001,
    sprintf('J2000 Greenwich sidereal Lagna matches the Swiss Ephemeris Lahiri reference (Δ %.2f″)', $angularDifference($greenwichLagna['sidereal'], 0.409689230) * 3600.0)
);

// Full-span accuracy sweep (1900–2100) against the committed Swiss Ephemeris fixture.
$fixturePath = __DIR__ . '/fixtures/swiss-ephemeris-lahiri-reference.json';
$fixture = json_decode((string) file_get_contents($fixturePath), true);
checkAstrologyAccuracyRegression(is_array($fixture) && count($fixture['samples'] ?? []) >= 100, 'Swiss Ephemeris reference fixture is present');
$toleranceArcsec = ['sun' => 5.0, 'moon' => 36.0, 'mercury' => 10.0, 'venus' => 10.0, 'mars' => 10.0, 'jupiter' => 10.0, 'saturn' => 10.0, 'rahu' => 90.0, 'meanNode' => 2.0];
$worst = array_fill_keys(array_keys($toleranceArcsec), 0.0);
$worstAyanamsa = 0.0;
foreach ($fixture['samples'] as $sample) {
    $positions = AstroEngine::computeGeocentricPositions((float) $sample['jd_ut'], false, 'TRUE');
    foreach ($toleranceArcsec as $body => $_) {
        $worst[$body] = max($worst[$body], $angularDifference($positions['sidereal'][$body], (float) $sample['sidereal'][$body]) * 3600.0);
    }
    $worstAyanamsa = max($worstAyanamsa, abs($positions['ayanamsa'] - (float) $sample['ayanamsaTrue']) * 3600.0);
}
foreach ($toleranceArcsec as $body => $limit) {
    checkAstrologyAccuracyRegression(
        $worst[$body] <= $limit,
        sprintf('%s stays within %.0f″ of Swiss Ephemeris across %d samples 1900–2100 (worst %.2f″)', ucfirst($body), $limit, count($fixture['samples']), $worst[$body])
    );
}
checkAstrologyAccuracyRegression($worstAyanamsa <= 0.1, sprintf('True Lahiri ayanamsa stays within 0.1″ of Swiss Ephemeris (worst %.3f″)', $worstAyanamsa));

$dateFormatter = new ReflectionMethod(AstroEngine::class, 'formatDashaDate');
$dateFormatter->setAccessible(true);
$instant = (new DateTimeImmutable('2000-01-01T00:30:00+00:00'))->getTimestamp();
checkAstrologyAccuracyRegression(
    $dateFormatter->invoke(null, $instant, 'Asia/Kolkata', 5.5) === '2000-01-01',
    'Dasha boundaries use the native IANA timezone rather than the PHP server timezone'
);
checkAstrologyAccuracyRegression(
    $dateFormatter->invoke(null, $instant, '', -8.0) === '1999-12-31',
    'Dasha boundaries honor a fixed negative UTC offset when no IANA zone is supplied'
);

$birth = [
    'name' => 'Dasha Timeline Regression',
    'dob' => '1990-01-05',
    'tob' => '12:00',
    'birthPlace' => 'Chennai, Tamil Nadu, India',
    'country' => 'India',
    'latitude' => 13.0827,
    'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5,
    'timeZoneId' => 'Asia/Kolkata'
];
$chart = AstroEngine::calculateHoroscope($birth);
$periods = $chart['dashaPeriods'] ?? [];
$lords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
$expectedStartingLord = $lords[((int) $chart['janmaNakshatraIndex']) % 9];
checkAstrologyAccuracyRegression(count($periods) === 9, 'PHP builds nine birth-specific sequential Mahadashas');
checkAstrologyAccuracyRegression(
    ($periods[0]['lordNameEn'] ?? null) === $expectedStartingLord,
    'The first Mahadasha lord is derived from the birth Moon Nakshatra, not a hard-coded list'
);
checkAstrologyAccuracyRegression(
    ($periods[0]['startDate'] ?? null) === $birth['dob'],
    'The first displayed Dasha begins on the native local birth date'
);
checkAstrologyAccuracyRegression(
    count($periods[0]['antardashas'] ?? []) === 9 &&
    count(array_filter($periods, static fn($period) => count($period['antardashas'] ?? []) === 9)) === 9,
    'Every Mahadasha includes nine calculated Antardashas'
);
$currentMahadashas = array_values(array_filter($periods, static fn($period) => !empty($period['isCurrent'])));
checkAstrologyAccuracyRegression(count($currentMahadashas) === 1, 'Exactly one Mahadasha is current at the calculation timestamp');
checkAstrologyAccuracyRegression(
    ($currentMahadashas[0]['lordNameEn'] ?? null) === ($chart['dasha']['currentLord'] ?? null),
    'The timeline current-Mahadasha flag agrees with the current Dasha summary'
);
$currentAntardashas = [];
foreach ($periods as $period) {
    foreach (($period['antardashas'] ?? []) as $antar) {
        if (!empty($antar['isCurrent'])) $currentAntardashas[] = $antar;
    }
}
checkAstrologyAccuracyRegression(count($currentAntardashas) === 1, 'Exactly one birth-specific Antardasha is current');
checkAstrologyAccuracyRegression(
    ($currentAntardashas[0]['lordNameEn'] ?? null) === ($chart['dasha']['subLord'] ?? null),
    'The timeline current-Antardasha flag agrees with the current Dasha summary'
);
checkAstrologyAccuracyRegression(
    count($chart['planetPositions'] ?? []) === 9 &&
    count(array_filter($chart['planetPositions'], static fn($planet) =>
        is_int($planet['rasi'] ?? null) && $planet['rasi'] >= 1 && $planet['rasi'] <= 12 &&
        is_int($planet['bhavaNumber'] ?? null) && $planet['bhavaNumber'] >= 1 && $planet['bhavaNumber'] <= 12
    )) === 9,
    'PHP planet outputs contain valid numeric Rasi and Bhava placements'
);

fwrite(STDOUT, "PHP astrology accuracy regression tests passed.\n");
