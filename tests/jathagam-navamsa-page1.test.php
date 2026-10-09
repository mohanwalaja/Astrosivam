<?php
/**
 * Birth Jathagam page 1 — Navamsa (D9) chart, PHP side.
 *
 * The Navamsa chart on page 1 printed "Navamsa positions unavailable" in English,
 * Tamil and Hindi, because AstroEngine::calculateHoroscope() emitted no D9 data
 * at all. The Hindi Rasi chart also lost every graha, because the report looked up
 * capitalised graha names ('Sun') while the engine emits the lowercase Graha enum
 * ('sun'), so no planet ever matched its tag.
 *
 * This suite checks:
 *   1. the engine emits navamsaRasi / totalDegrees / isVargottama for every graha
 *      and lagnaNavamsaRasi / isLagnaVargottama for the Lagna, and its D9 signs
 *      equal tests/fixtures/navamsa-d9-parity.json for every parity chart (the Node
 *      suite tests/jathagam-navamsa-page1.test.ts checks the same file);
 *   2. AstroReportViews::generateBirthJathagamHtml() prints the nine grahas and
 *      the Lagna in the Navamsa chart for en, ta and hi, with no "unavailable" note.
 */
require_once __DIR__ . '/../api/astrology/engine.php';
require_once __DIR__ . '/../api/astrology/pdf_mpdf_reports.php';

function checkNavamsa(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

/** The D9 sign of a sidereal longitude: nine 3°20′ parts per sign. */
function navamsaRasiOf(float $longitude): int
{
    return (intval(floor($longitude / (360.0 / 108.0))) % 12) + 1;
}

/** One panel of the Rasi/Navamsa row: from its title to the end of its table. */
function navamsaPanelOf(string $html, string $title): string
{
    $start = strpos($html, '<div class="panel-title">' . $title . '</div>');
    if ($start === false) {
        return '';
    }
    $end = strpos($html, '</tr></table>', $start);
    return $end === false ? substr($html, $start) : substr($html, $start, $end - $start + strlen('</tr></table>'));
}

function navamsaTagsOf(string $panel): array
{
    preg_match_all('/<span class="planet-name[^"]*">(.*?)<\/span>/s', $panel, $matches);
    return $matches[1];
}

$GRAHAS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

$corpus = json_decode((string) file_get_contents(__DIR__ . '/fixtures/node-php-parity-corpus.json'), true);
$fixture = json_decode((string) file_get_contents(__DIR__ . '/fixtures/navamsa-d9-parity.json'), true);
if (!is_array($corpus['birthCharts'] ?? null) || !is_array($fixture['charts'] ?? null)) {
    throw new RuntimeException('Cannot read the parity corpus or the Navamsa fixture');
}

$calculate = static function (array $birth): array {
    return AstroEngine::calculateHoroscope([
        'name' => $birth['devoteeName'],
        'dob' => $birth['dob'],
        'tob' => $birth['tob'],
        'birthPlace' => $birth['birthPlace'],
        'country' => $birth['country'],
        'latitude' => $birth['latitude'],
        'longitude' => $birth['longitude'],
        'timezoneOffsetHours' => $birth['timezoneOffsetHours'],
    ]);
};

// --- 1. The engine emits D9 and agrees with the committed fixture --------------
$sampleBirth = $corpus['birthCharts'][0];
$chart = $calculate($sampleBirth);

$hasKeys = array_key_exists('lagnaNavamsaRasi', $chart) && array_key_exists('isLagnaVargottama', $chart);
foreach ($chart['planetPositions'] as $position) {
    foreach (['navamsaRasi', 'totalDegrees', 'isVargottama'] as $key) {
        $hasKeys = $hasKeys && array_key_exists($key, $position);
    }
}
checkNavamsa($hasKeys, 'the engine emits navamsaRasi, totalDegrees and isVargottama for every graha, and lagnaNavamsaRasi for the Lagna');

$lagnaInRange = is_int($chart['lagnaNavamsaRasi']) && $chart['lagnaNavamsaRasi'] >= 1 && $chart['lagnaNavamsaRasi'] <= 12;
checkNavamsa($lagnaInRange, "the Lagna's D9 sign is a rasi number (got {$chart['lagnaNavamsaRasi']})");

$mismatches = [];
$placements = 0;
$derivedMismatches = [];
foreach ($corpus['birthCharts'] as $parityBirth) {
    $expected = $fixture['charts'][$parityBirth['id']] ?? null;
    if ($expected === null) {
        $mismatches[] = "{$parityBirth['id']} missing from the fixture";
        continue;
    }
    $horoscope = $calculate($parityBirth);
    if (($horoscope['lagnaNavamsaRasi'] ?? null) !== $expected['lagnaNavamsaRasi']) {
        $mismatches[] = "{$parityBirth['id']} Lagna";
    }
    foreach ($horoscope['planetPositions'] as $position) {
        $placements++;
        $graha = $position['graha'];
        if (($position['navamsaRasi'] ?? null) !== ($expected['planets'][$graha]['navamsaRasi'] ?? -1)) {
            $mismatches[] = "{$parityBirth['id']} {$graha}";
        }
        // The stored 2-decimal longitude must reproduce the same sign, because a
        // result saved before this fix is completed from it (src/services/navamsa.ts).
        if (navamsaRasiOf((float) $position['totalDegrees']) !== $position['navamsaRasi']) {
            $derivedMismatches[] = "{$parityBirth['id']} {$graha}";
        }
    }
}
$chartCount = count($corpus['birthCharts']);
checkNavamsa(
    count($mismatches) === 0 && $placements === $chartCount * count($GRAHAS),
    "the live PHP engine matches the committed D9 fixture for all {$chartCount} parity charts ({$placements} graha placements)"
);
checkNavamsa(
    count($derivedMismatches) === 0,
    'the stored 2-decimal longitude reproduces every D9 sign the engine reports'
);

// --- 2. Page 1 in en, ta and hi -------------------------------------------------
$expectedTags = [
    'en' => ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Lag'],
    'ta' => ['சூ', 'சந்', 'செவ்', 'பு', 'குரு', 'சுக்', 'சனி', 'ரா', 'கே', 'லக்'],
    'hi' => ['सू', 'चं', 'मं', 'बु', 'गु', 'शु', 'श', 'रा', 'के', 'लग्न'],
];
$titles = [
    'en' => ['Rasi Chart (Chakra)', 'Navamsa Chart (D9)'],
    'ta' => ['ராசி கட்டம் (Rasi Chart)', 'நவாம்ச கட்டம் (Navamsa D9)'],
    'hi' => ['राशि चक्र (Rasi Chakra)', 'नवांश चक्र (Navamsa D9)'],
];

// Chart rows are compared as sorted lists so the check does not depend on the sign grid.
$report = AstroEngine::calculateHoroscope([
    'name' => $sampleBirth['devoteeName'],
    'dob' => $sampleBirth['dob'],
    'tob' => $sampleBirth['tob'],
    'birthPlace' => $sampleBirth['birthPlace'],
    'country' => $sampleBirth['country'],
    'latitude' => $sampleBirth['latitude'],
    'longitude' => $sampleBirth['longitude'],
    'timezoneOffsetHours' => $sampleBirth['timezoneOffsetHours'],
    'gender' => 'M',
]);

foreach (['en', 'ta', 'hi'] as $lang) {
    $order = ['language' => $lang, 'service_type' => 'BIRTH_JATHAGAM', 'order_number' => 'NAVAMSA-TEST'];
    $html = AstroReportViews::generateBirthJathagamHtml($order, $report);
    [$rasiTitle, $navamsaTitle] = $titles[$lang];

    $navamsaPanel = navamsaPanelOf($html, $navamsaTitle);
    $navamsaTags = navamsaTagsOf($navamsaPanel);
    $expectedSorted = $expectedTags[$lang];
    sort($expectedSorted);
    $actualSorted = $navamsaTags;
    sort($actualSorted);

    checkNavamsa(
        $navamsaPanel !== '' && strpos($navamsaPanel, 'mini-note') === false && $actualSorted === $expectedSorted,
        "[{$lang}] page-1 Navamsa chart shows the 9 grahas and the Lagna, with no unavailable note (tags: " . implode(' ', $navamsaTags) . ')'
    );

    $rasiTags = navamsaTagsOf(navamsaPanelOf($html, $rasiTitle));
    checkNavamsa(
        count($rasiTags) === 10,
        "[{$lang}] page-1 Rasi chart shows the 9 grahas and the Lagna (tags: " . implode(' ', $rasiTags) . ')'
    );
}

echo "PASSED: Birth Jathagam page-1 Navamsa (PHP side)\n";
