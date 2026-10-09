<?php
/**
 * Node↔PHP parity for the Birth Jathagam page 3 (Short Summary) — PHP side.
 *
 * tests/fixtures/jathagam-summary-parity.json freezes, per chart and language,
 * the input the rule reads and the lists the page must print. This suite checks
 * AstroReportViews::classifyJathagamPlanetsForSummary() against that contract;
 * the Node suite tests/jathagam-summary-parity.test.ts checks the TypeScript
 * engine against the same file, so the two stacks can never disagree about
 * which grahas a chart flags.
 *
 * Regenerate the fixture with `npx tsx scripts/emit-jathagam-summary-parity.ts`
 * only when the rule changes on purpose.
 */
require_once __DIR__ . '/../api/astrology/pdf_mpdf_reports.php';

function checkSummaryParity(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

$fixturePath = __DIR__ . '/fixtures/jathagam-summary-parity.json';
$fixture = json_decode((string) file_get_contents($fixturePath), true);
if (!is_array($fixture) || !isset($fixture['cases']) || !is_array($fixture['cases'])) {
    throw new RuntimeException("Cannot read the page-3 parity fixture at {$fixturePath}");
}

$checked = 0;
foreach ($fixture['cases'] as $case) {
    $id = (string) ($case['id'] ?? '?');
    $lang = (string) ($case['lang'] ?? 'en');
    $input = is_array($case['input'] ?? null) ? $case['input'] : [];
    $expected = is_array($case['expected'] ?? null) ? $case['expected'] : [];
    $actual = AstroReportViews::classifyJathagamPlanetsForSummary($input, $lang);

    $keys = static function (array $list): string {
        $out = [];
        foreach ($list as $entry) {
            $out[] = (string) ($entry['key'] ?? '');
        }
        return implode(',', $out);
    };

    checkSummaryParity(
        $keys($actual['supportive'] ?? []) === $keys($expected['supportive'] ?? []),
        "{$id}: supportive list matches the Node engine"
    );
    checkSummaryParity(
        $keys($actual['needsCare'] ?? []) === $keys($expected['needsCare'] ?? []),
        "{$id}: needs-care list matches the Node engine"
    );
    checkSummaryParity(
        (bool) ($actual['compact'] ?? false) === (bool) ($expected['compact'] ?? false),
        "{$id}: compact flag matches the Node engine"
    );
    checkSummaryParity(
        (int) ($actual['assessedCount'] ?? -1) === (int) ($expected['assessedCount'] ?? -2),
        "{$id}: assessed count matches the Node engine"
    );
    checkSummaryParity(
        (bool) ($actual['assessmentComplete'] ?? false) === (bool) ($expected['assessmentComplete'] ?? false),
        "{$id}: assessment completeness matches the Node engine"
    );

    // The remedy lines are part of the contract too: they are what the page prints.
    foreach (($expected['needsCare'] ?? []) as $index => $expectedPlanet) {
        $actualPlanet = $actual['needsCare'][$index] ?? [];
        foreach (['difficulties', 'worship', 'lamp', 'donation', 'mantra', 'compactLine'] as $field) {
            checkSummaryParity(
                (string) ($actualPlanet[$field] ?? '') === (string) ($expectedPlanet[$field] ?? ''),
                "{$id}: {$expectedPlanet['key']} {$field} matches the Node engine"
            );
        }
    }
    foreach (($expected['supportive'] ?? []) as $index => $expectedPlanet) {
        $actualPlanet = $actual['supportive'][$index] ?? [];
        checkSummaryParity(
            (string) ($actualPlanet['key'] ?? '') === (string) ($expectedPlanet['key'] ?? ''),
            "{$id}: supportive box {$index} matches the Node engine"
        );
        checkSummaryParity(
            (string) ($actualPlanet['support'] ?? '') !== '',
            "{$id}: supportive box {$index} carries its plain-language line"
        );
    }
    $checked++;
}

checkSummaryParity($checked === count($fixture['cases']), "Every fixture case was checked ({$checked})");

// The nine-graha worst case must stay complete: never hide a flagged planet.
$allNine = null;
foreach ($fixture['cases'] as $case) {
    if (($case['id'] ?? '') === 'all-nine-needing-care|en') {
        $allNine = $case;
    }
}
if ($allNine === null) {
    throw new RuntimeException('The all-nine fixture case is missing');
}
$result = AstroReportViews::classifyJathagamPlanetsForSummary($allNine['input'], 'en');
checkSummaryParity(count($result['needsCare']) === 9, 'All nine flagged grahas are shown in the compact table');
checkSummaryParity($result['compact'] === true, 'Nine flagged grahas switch the page to the compact table');
checkSummaryParity($result['supportive'] === [], 'A graha needing care is never also counted supportive');

// An unreadable placement must never read as a clean chart.
$partial = AstroReportViews::classifyJathagamPlanetsForSummary([
    'lagnaRasi' => 5,
    'planetPositions' => [['graha' => 'sun', 'rasi' => 5, 'degrees' => 10, 'bhavaNumber' => 1, 'isCombust' => false]]
], 'ta');
checkSummaryParity($partial['assessmentComplete'] === false, 'A partial chart is not reported as complete');
checkSummaryParity(trim((string) ($partial['incompleteNote'] ?? '')) !== '', 'The incomplete note is translated and printable');

// The remedy data still comes from the Navagraha reference material.
foreach (['en', 'ta', 'hi'] as $lang) {
    $rows = AstroReportViews::navagrahaReferenceTableData();
    checkSummaryParity(count($rows) === 9, "The Navagraha reference table still holds nine grahas ({$lang})");
    $data = AstroReportViews::jathagamSummaryRemedyData();
    foreach ($data as $key => $entry) {
        foreach (['deity', 'day', 'charity', 'lamp', 'donation', 'mantra', 'support', 'difficulties'] as $field) {
            checkSummaryParity(
                isset($entry[$field][$lang]) && trim((string) $entry[$field][$lang]) !== '',
                "{$key} ({$lang}): {$field} is present"
            );
        }
    }
    $text = AstroReportViews::jathagamSummaryText($lang);
    foreach (['subtitle', 'detailsTitle', 'supportiveTitle', 'careTitle', 'summaryTitle', 'tablePlanet', 'tableDifficulties', 'tableRemedies', 'noCarePlanet', 'noSupportPlanet', 'assessmentIncomplete', 'reassurance', 'summaryLead', 'summaryRemedy', 'dailyHabit'] as $key) {
        checkSummaryParity(
            isset($text['text'][$key]) && trim((string) $text['text'][$key]) !== '',
            "Page-3 string {$key} exists in {$lang}"
        );
    }
    foreach (['worship', 'lamp', 'donation', 'mantra'] as $key) {
        checkSummaryParity(
            isset($text['labels'][$key]) && trim((string) $text['labels'][$key]) !== '',
            "Page-3 remedy label {$key} exists in {$lang}"
        );
    }
    if ($lang !== 'en') {
        checkSummaryParity(
            $text['text']['subtitle'] !== AstroReportViews::jathagamSummaryText('en')['text']['subtitle'],
            "Page-3 subtitle is translated in {$lang}"
        );
        checkSummaryParity(
            $text['text']['assessmentIncomplete'] !== AstroReportViews::jathagamSummaryText('en')['text']['assessmentIncomplete'],
            "The incomplete note is translated in {$lang}"
        );
    }
}

// Every remedy line quotes the reference material for that graha.
$data = AstroReportViews::jathagamSummaryRemedyData();
foreach (['en', 'ta', 'hi'] as $lang) {
    $needsCare = AstroReportViews::classifyJathagamPlanetsForSummary($allNine['input'], $lang);
    foreach ($needsCare['needsCare'] as $planet) {
        checkSummaryParity(
            strpos((string) $planet['worship'], (string) $data[$planet['key']]['deity'][$lang]) === 0,
            "{$lang}: {$planet['key']} worship line quotes the reference deity"
        );
        checkSummaryParity(
            (string) $data[$planet['key']]['day'][$lang] !== ''
                && strpos((string) $planet['worship'], (string) $data[$planet['key']]['day'][$lang]) !== false,
            "{$lang}: {$planet['key']} worship line quotes the reference weekday"
        );
    }
}

echo "\nAll Birth Jathagam page-3 parity checks passed (PHP side, {$checked} fixture cases).\n";
