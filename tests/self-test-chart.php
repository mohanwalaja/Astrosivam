<?php
/**
 * ASTRO SIVAM — end-to-end self-test on the reference chart (PHP stack).
 *
 *   php tests/self-test-chart.php
 *
 * Chart: 18-06-1991, 06:30 IST, Walajapet (12.92 N, 79.37 E), Lahiri ayanamsa.
 * Reference values below come from Swiss Ephemeris 2.10.03 (SIDM_LAHIRI, TRUE
 * ayanamsa); a deviation beyond the tolerances means the engine, the ayanamsa
 * or the birth-time handling has moved.
 *
 * Prints: ayanamsa | every graha longitude + sign + dignity | Lagna |
 * Moon nakshatra + pada | Kuja verdict | Graha Yuddha | Kendradhipati |
 * yoga notes | Pitru strength | current Mahadasa + Bhukti and the next one.
 *
 * This file lives in tests/ (never deployed: deployment copies only api/ and
 * dist/) and refuses to run outside the PHP CLI, so it can never execute from
 * the live site.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/astrology/engine.php';

$payload = [
    'devoteeName' => 'ASTRO SIVAM self-test',
    'gender' => 'M',
    'dob' => '1991-06-18',
    'tob' => '06:30',
    'birthPlace' => 'Walajapet, Tamil Nadu, India',
    'country' => 'India',
    'latitude' => 12.92,
    'longitude' => 79.37,
    'timezoneOffsetHours' => 5.5,
];

$failures = [];
$check = static function (string $label, bool $condition, string $detail = '') use (&$failures): void {
    printf("  %s  %s%s\n", $condition ? 'PASS' : 'FAIL', $label, $detail !== '' ? '   ' . $detail : '');
    if (!$condition) { $failures[] = $label; }
};
$close = static function ($value, float $expected, float $tolerance): bool {
    return is_numeric($value) && abs((float) $value - $expected) <= $tolerance;
};

printf("\n=========================================================\n");
printf("ASTRO SIVAM SELF-TEST (PHP)\n");
printf("Chart: %s %s IST, %s (%sN, %sE)\n", $payload['dob'], $payload['tob'], $payload['birthPlace'], $payload['latitude'], $payload['longitude']);
printf("=========================================================\n\n");

try {
    $result = AstroEngine::calculateHoroscope($payload);
} catch (Throwable $error) {
    printf("FATAL: %s\n", $error->getMessage());
    exit(1);
}

printf("AYANAMSA\n  %s° (true Lahiri / Chitra Paksha)\n\n", number_format((float) $result['ayanamsa'], 6, '.', ''));

$lagna = $result['lagna']['rasi'] ?? 'N/A';
printf("LAGNA\n  %s %s°\n\n", $lagna, number_format((float) ($result['lagnaDegrees'] ?? 0), 2, '.', ''));
printf("MOON\n  %s | Nakshatra %s pada %s\n\n", $result['rasi']['name'] ?? 'N/A', $result['nakshatram']['name'] ?? 'N/A', $result['nakshatram']['pada'] ?? ($result['janmaPada'] ?? 'N/A'));

printf("GRAHA LONGITUDES (sidereal, Lahiri) + DIGNITY\n");
printf("  %-16s %10s  %-24s %-6s %s\n", 'Graha', 'Total°', 'Sign', 'Bhava', 'Dignity / state');
$moonTotal = null;
foreach (($result['planetPositions'] ?? []) as $position) {
    $total = (float) ($position['degrees'] ?? 0) + ((int) ($position['rasi'] ?? 1) - 1) * 30.0;
    if (($position['graha'] ?? '') === 'moon') { $moonTotal = $total; }
    printf(
        "  %-16s %10s  %-24s %-6s %s\n",
        $position['nameEn'] ?? $position['graha'],
        number_format($total, 4, '.', ''),
        ($position['rasiNameEn'] ?? 'N/A'),
        $position['bhavaNumber'] ?? '-',
        $position['dignity']['tagsEn'] ?? 'N/A'
    );
    if (!empty($position['dignity']['isNeechaBhanga'])) {
        printf("      ↳ %s\n", $position['dignity']['neechaBhangaEn']);
    }
}

$kuja = null;
foreach (($result['doshas'] ?? []) as $dosha) {
    if (stripos((string) ($dosha['nameEn'] ?? ''), 'kuja') !== false) { $kuja = $dosha; }
}
printf("\nKUJA (SEVVAY) DOSHA\n  verdict: %s\n  badge EN: %s\n  badge TA: %s\n  %s\n  %s\n\n",
    $kuja['verdict'] ?? 'N/A',
    $kuja['verdictLabelEn'] ?? 'N/A',
    $kuja['verdictLabelTa'] ?? 'N/A',
    $kuja['ruleEn'] ?? 'rule set: see engine',
    $kuja['descriptionEn'] ?? '');

$pitru = null;
foreach (($result['doshas'] ?? []) as $dosha) {
    if (stripos((string) ($dosha['nameEn'] ?? ''), 'pitru') !== false) { $pitru = $dosha; }
}
printf("PITRU\n  strength: %s | %s\n\n", $pitru['strength'] ?? 'N/A', $pitru['strengthLabelEn'] ?? '');

printf("YOGAS / DOSHAS / EXTRAS\n");
foreach (($result['yogas'] ?? []) as $yoga) {
    printf("  [%s] %s\n", $yoga['severity'] ?? '', $yoga['nameEn'] ?? '');
}
foreach (($result['grahaYuddha'] ?? []) as $war) {
    printf("  [graha yuddha] %s vs %s %.3f° → winner %s\n", $war['planetANameEn'] ?? '', $war['planetBNameEn'] ?? '', (float) ($war['separationDegrees'] ?? 0), $war['winnerNameEn'] ?? '');
}
foreach (($result['kendradhipati'] ?? []) as $kendra) {
    printf("  [kendradhipati] %s owns houses %s%s\n", $kendra['grahaNameEn'] ?? '', implode(', ', $kendra['houses'] ?? []), !empty($kendra['isDosha']) ? '' : ' (Lagna lord — traditionally exempt)');
}

$dasha = $result['dasha'] ?? [];
$next = $dasha['nextMahadasa'] ?? [];
printf("\nVIMSHOTTARI DASHA (from the Moon longitude)\n");
printf("  current : %s Mahadasa | %s Bhukti (%s)\n", $dasha['currentLord'] ?? 'N/A', $dasha['subLord'] ?? 'N/A', $dasha['period'] ?? 'N/A');
printf("  next    : %s %s\n", $next['lordNameEn'] ?? 'N/A', !empty($next['beginsOn']) ? 'begins ' . $next['beginsOn'] : '');
printf("  notice  : %s\n\n", $next['noticeEn'] ?? '');

printf("CORRECTNESS CHECKS (Swiss Ephemeris reference)\n");
$check('ayanamsa ~ 23.742257 deg', $close($result['ayanamsa'] ?? null, 23.742257, 0.02), number_format((float) ($result['ayanamsa'] ?? 0), 6, '.', ''));
$check('Lagna ~ 71.6073 deg (Mithunam 11.61)', $close(($result['lagnaDegrees'] ?? null) === null ? null : ((int) $result['lagnaRasi'] - 1) * 30 + (float) $result['lagnaDegrees'], 71.6073, 0.05));
$check('Moon ~ 138.3549 deg', $close($moonTotal, 138.3549, 0.05), number_format((float) $moonTotal, 4, '.', ''));
$check('Nakshatra = Purva Phalguni pada 2', stripos((string) ($result['nakshatram']['name'] ?? ''), 'Purva Phalguni') !== false && (int) ($result['nakshatram']['pada'] ?? $result['janmaPada'] ?? 0) === 2, (string) ($result['nakshatram']['name'] ?? ''));
$check('Kuja verdict = present-cancelled', ($kuja['verdict'] ?? '') === 'present-cancelled', (string) ($kuja['verdict'] ?? 'N/A'));
$check('Kuja rule set = 2, 4, 7, 8, 12 (South Indian; no 1st house)', strpos((string) ($kuja['ruleEn'] ?? ''), '2, 4, 7, 8, 12') !== false, (string) ($kuja['ruleEn'] ?? 'N/A'));
$check('Kuja card names the Dosha Nivrutti rule (not a flat cancelled)', stripos((string) ($kuja['verdictLabelEn'] ?? ''), 'cancelled') === false && stripos((string) ($kuja['verdictLabelEn'] ?? ''), 'nivrutti') !== false, (string) ($kuja['verdictLabelEn'] ?? 'N/A'));
$check('Mars in Kadagam is debilitated + Neecha Bhanga', (static function (array $result): bool {
    foreach (($result['planetPositions'] ?? []) as $position) {
        if (($position['graha'] ?? '') === 'mars') {
            return ($position['dignity']['status'] ?? '') === 'debilitated' && !empty($position['dignity']['isNeechaBhanga']);
        }
    }
    return false;
})($result));
$check('Mars shows "Debilitated (Neecha)" and "Neecha Bhanga (by Jupiter conjunction)"', (static function (array $result): bool {
    foreach (($result['planetPositions'] ?? []) as $position) {
        if (($position['graha'] ?? '') === 'mars') {
            $tags = (string) ($position['dignity']['tagsEn'] ?? '');
            $note = (string) ($position['dignity']['neechaBhangaEn'] ?? '');
            return strpos($tags, 'Debilitated (Neecha)') !== false
                && strpos($tags, 'Neecha Bhanga (by Jupiter conjunction)') !== false
                && strpos($note, 'by Jupiter conjunction') !== false
                && stripos($note, 'debilitation cancelled') === false;
        }
    }
    return false;
})($result));
$check('Sarala yoga (8th lord in the 8th)', (static function (array $result): bool {
    foreach (($result['yogas'] ?? []) as $yoga) { if (($yoga['code'] ?? '') === 'SARALA') { return true; } }
    return false;
})($result));
$check('Graha Yuddha Jupiter-Venus with Venus winning', (static function (array $result): bool {
    foreach (($result['grahaYuddha'] ?? []) as $war) {
        if (($war['winner'] ?? '') === 'venus' && in_array('jupiter', [(string) ($war['planetA'] ?? ''), (string) ($war['planetB'] ?? '')], true)) { return true; }
    }
    return false;
})($result));
$check('Kendradhipati dosha reported for Jupiter (7th + 10th)', (static function (array $result): bool {
    foreach (($result['kendradhipati'] ?? []) as $kendra) {
        if (($kendra['graha'] ?? '') === 'jupiter' && $kendra['houses'] === [7, 10]) { return true; }
    }
    return false;
})($result));
$check('Pitru strength = weak (same sign only)', ($pitru['strength'] ?? '') === 'weak', (string) ($pitru['strength'] ?? 'N/A'));
$check('Next Mahadasa with a start date', !empty($next['beginsOn']) && !empty($next['noticeEn']), (string) ($next['beginsOn'] ?? 'N/A'));

if ($failures !== []) {
    printf("\nSELF-TEST FAILED (%d check(s))\n", count($failures));
    exit(1);
}
printf("\n=========================================================\nSELF-TEST PASSED\n=========================================================\n");
