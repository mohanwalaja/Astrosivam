<?php
require_once __DIR__ . '/../api/astrology/engine.php';

function checkSampleEngineMeaning(bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] {$message}\n";
}

// Calculation-only regression: no PDF/report renderer or public sample module.
$birth = [
    'dob' => '2000-01-01', 'tob' => '02:00',
    'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata',
];
$groom = array_merge($birth, ['name' => 'Karthik Raman', 'gender' => 'M']);
$bride = array_merge($birth, ['name' => 'Priya Devi', 'gender' => 'F', 'dob' => '1998-06-15', 'tob' => '06:30']);

$chart = AstroEngine::calculateHoroscope($groom);
$first = $chart['dashaPeriods'][0];
checkSampleEngineMeaning($first['mahadashaLord'] === 'rahu', 'The public sample starts with the Rahu birth balance');
checkSampleEngineMeaning($first['periodKind'] === 'BIRTH_BALANCE', 'First span is explicitly a birth balance, not the full Mahadasha');
checkSampleEngineMeaning($first['startDate'] === '2000-01-01', 'Balance display still begins at birth');
checkSampleEngineMeaning(substr($first['fullStartDate'], 0, 4) === '1993', 'The full Mahadasha retains its pre-birth 1993 start');
checkSampleEngineMeaning($first['fullStartDate'] === $first['antardashas'][0]['startDate'], 'Reference Antardashas begin at the full Mahadasha start');
checkSampleEngineMeaning($first['fullYears'] === 18 && count($first['antardashas']) === 9, 'The full eighteen-year Rahu period retains all nine Antardashas');
checkSampleEngineMeaning(abs($first['antardashas'][0]['months'] - 32.4) < 0.001, 'Rahu/Rahu retains the classical (18 x 18) / 120 duration');
foreach (array_slice($chart['dashaPeriods'], 1) as $period) {
    checkSampleEngineMeaning($period['periodKind'] === 'FULL_MAHADASHA' && $period['fullStartDate'] === $period['startDate'], 'Subsequent spans are full Mahadashas');
}

$match = AstroEngine::calculateMatchmaking(['bride' => $bride, 'groom' => $groom]);
// The sample couple is groom Swati (Kanda Rajju) + bride Avittam/Dhanishta
// (Siro Rajju): DIFFERENT groups, so Rajju is a full 5/5 pass. The old table
// put both stars in the Siro group and produced 19/35 with 6/10.
checkSampleEngineMeaning($match['rajjuMatch'] === true && $match['vedhaMatch'] === true, 'The Avittam/Swati sample couple passes both Rajju and Vedha');
$rajju = array_values(array_filter($match['poruthams'], static fn($row) => $row['id'] === 'rajju'))[0];
checkSampleEngineMeaning($rajju['pointsEarned'] === 5 && $rajju['maxPoints'] === 5 && $rajju['status'] === 'UTTHAMAM', 'Rajju is a full 5/5 Uttamam row for the sample couple');
$vedha = array_values(array_filter($match['poruthams'], static fn($row) => $row['id'] === 'vedha'))[0];
checkSampleEngineMeaning($vedha['pointsEarned'] === 3 && $vedha['maxPoints'] === 3 && $vedha['status'] === 'UTTHAMAM', 'Vedha remains a passed 3/3 row');
$yoni = array_values(array_filter($match['poruthams'], static fn($row) => $row['id'] === 'yoni'))[0];
checkSampleEngineMeaning($yoni['pointsEarned'] === 2 && $yoni['maxPoints'] === 4 && $yoni['status'] === 'MADHYAMAM', 'A partial 2/4 Yoni row is labelled Mathimam, not Uttamam');
checkSampleEngineMeaning($match['verdictStatus'] === 'MADHYAMAM' && (float) $match['score'] === 24.0 && $match['maxScore'] === 35 && $match['totalPoruthamsMatched'] === 7,
    'The sample couple scores 24/35 with 7/10 Poruthams and a recalculated Madhyama verdict');
checkSampleEngineMeaning(strpos($match['verdict'], 'Acceptable with Remedies') !== false, 'Legacy verdict is derived from the corrected 68.6% score, not from the old Rajju failure');
foreach (['En', 'Ta', 'Hi'] as $lang) {
    $recommendation = (string) $match['sevvayDosham']['recommendation' . $lang];
    checkSampleEngineMeaning(strpos($recommendation, 'mismatch remains') === false && strpos($recommendation, 'பொருத்தமின்மை நீங்கவில்லை') === false,
        "{$lang} Kuja guidance no longer repeats the crucial-mismatch sentence a third time");
}
checkSampleEngineMeaning(strpos($match['sevvayDosham']['recommendationEn'], 'Kuja Dosha alone') !== false, 'Kuja guidance is still scoped to Kuja Dosha alone');
checkSampleEngineMeaning(strpos($match['sevvayDosham']['recommendationEn'], 'match may proceed') === false, 'Mild Kuja remedies do not by themselves approve a marriage');
checkSampleEngineMeaning($match['doshaSummary'] === $match['sevvayDosham']['recommendationEn'], 'Dosha summary uses the assessed facts, not an invented balanced-planetary-harmonies claim');

$balancedBlocked = AstroEngine::calculateMatchmaking(['bride' => array_merge($groom, ['gender' => 'F']), 'groom' => $groom]);
checkSampleEngineMeaning($balancedBlocked['sevvayDosham']['isBalanced'] === true && $balancedBlocked['verdictStatus'] === 'PORUNDHADHU', 'Balanced Kuja does not remove a Rajju hard stop');
checkSampleEngineMeaning(strpos($balancedBlocked['sevvayDosham']['recommendationEn'], 'not the overall marriage recommendation') !== false, 'Balanced Kuja recommendation is explicitly scoped');

$baby = AstroEngine::calculateBabyNaming(array_merge($birth, ['babyName' => 'Aarav', 'gender' => 'M']));
checkSampleEngineMeaning($baby['primaryPadaInfo']['letterEn'] === 'Re / Ray' && $baby['babyName'] === 'Aarav', 'Preserve the supplied Aarav label separately from the Re birth sound');
checkSampleEngineMeaning($baby['nameProvenance']['status'] === 'SUPPLIED_NOT_CERTIFIED' && $baby['nameProvenance']['suppliedName'] === 'Aarav', 'The supplied name is not presented as a compatible-name certificate');
checkSampleEngineMeaning(AstroEngine::getBabyNameProvenance(' ')['status'] === 'NOT_SUPPLIED', 'An omitted name is not treated as supplied');
checkSampleEngineMeaning(AstroEngine::getBabyNameProvenance('Reyansh')['status'] === 'SUPPLIED_NOT_CERTIFIED', 'A Roman prefix alone does not certify a name');

$table = json_decode(file_get_contents(__DIR__ . '/../api/astrology/baby_nakshatra_letters.json'), true);
$bank = require __DIR__ . '/../api/astrology/namakaran_name_bank.php';
$checkedNames = 0;
foreach ($table as $star) {
    foreach (['M', 'F'] as $gender) {
        foreach (AstroEngine::getBabyNameSuggestionsByPada($star['padas'], $gender) as $column) {
            $hasRelated = false;
            foreach (['south', 'north'] as $side) {
                foreach ($column[$side] as $name) {
                    $checkedNames++;
                    $source = $name['sourceAksharaTa'];
                    $sourceEntries = $bank['bank'][$source][$gender][$side];
                    if (!in_array($name['name'], array_column($sourceEntries, 0), true)) {
                        throw new RuntimeException('A name lost its original bank source: ' . $name['name']);
                    }
                    if ($name['isRelatedSound'] !== (!AstroReportViews::nameMatchesPada($name['name'], $column['soundTa']))) {
                        throw new RuntimeException('A related sound was mislabeled as exact: ' . $name['name']);
                    }
                    $hasRelated = $hasRelated || $name['isRelatedSound'];
                }
            }
            if ($column['usesRelatedSounds'] !== $hasRelated) {
                throw new RuntimeException('Column flag must agree with individual related-name flags');
            }
        }
    }
}
checkSampleEngineMeaning($checkedNames > 3000, "All {$checkedNames} suggestions retain their original/exact-versus-related sound identity");
