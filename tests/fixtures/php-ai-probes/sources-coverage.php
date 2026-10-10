<?php
/**
 * Probe: how much of the curated source library actually reaches a customer?
 *
 * Run with: node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/sources-coverage.php
 *
 * Three questions this answers against the committed knowledge base:
 *   1. with a real chart attached, how many curated rules fire per question?
 *   2. how many of the sources those rules cite survive the Tamil-only filter?
 *   3. does the guard reject a draft that names a source the rules block cites?
 */

error_reporting(E_ALL);

file_put_contents('/repo/api/config.php', "<?php\n// probe stub\n");
require_once '/repo/api/astrology/ai_astrologer_provider.php';

$line = str_repeat('-', 74);

$citable = AstroAiProvider::citableTamilSources();
echo $line, "\nCITABLE POOL\n", $line, "\n";
echo 'Tamil sources the agent is allowed to name: ', count($citable), "\n";
echo "source list handed to the model (first 400 chars):\n";
echo mb_substr(AstroAiProvider::tamilSourceList(), 0, 400), "\n...\n";

// A chart shaped the way astro_ai_chart_facts() builds it, so the chart-conditional
// rules can actually fire instead of everything degrading to 'always'.
$chart = [
    'lagna' => 'Kanni',
    'moonSign' => 'Vrischika',
    'moonNakshatra' => 'Anusham',
    'moonNakshatraLord' => 'Sani',
    'currentDasha' => 'Sani',
    'currentAntardasha' => 'Rahu',
    'dashaEndDate' => '2027-03-01',
    'planetHouse' => [
        'Suriya' => 3, 'Chandra' => 3, 'Sevvai' => 2, 'Budha' => 1,
        'Guru' => 6, 'Sukra' => 12, 'Sani' => 5, 'Rahu' => 8, 'Ketu' => 2,
    ],
    'lordHouse' => [1 => 1, 2 => 3, 3 => 1, 4 => 12, 5 => 2, 6 => 6, 7 => 3, 8 => 4, 9 => 5, 10 => 6, 11 => 2, 12 => 7],
    'dignity' => ['Sani' => 'weak', 'Rahu' => 'weak', 'Guru' => 'neutral', 'Sukra' => 'weak'],
    'saniTransitFromMoon' => 3,
    'doshas' => ['SadeSati'],
];

echo "\n", $line, "\nRETRIEVAL WITH A CHART ATTACHED\n", $line, "\n";
printf("%-38s %-12s %6s %-8s %s\n", 'QUESTION', 'AREA', 'RULES', 'CITABLE', 'SOURCE LINE THAT SURVIVES');
$questions = [
    ['ta', 'என் வேலை எப்போது கிடைக்கும்?'],
    ['ta', 'என் திருமணம் எப்போது நடக்கும்?'],
    ['ta', 'எனக்கு பணம் வரவு எப்போது?'],
    ['ta', 'என் உடல்நலம் எப்படி இருக்கும்?'],
    ['ta', 'வெளிநாடு போக முடியுமா?'],
    ['ta', 'நான் படித்தது வேலைக்கு உதவுமா?'],
    ['en', 'when will i get a job?'],
    ['en', 'will i go abroad?'],
];
$totalRules = 0;
$withSource = 0;
foreach ($questions as [$lang, $q]) {
    $r = AstroAiProvider::retrieve($q, $lang, $chart);
    $kept = AstroAiProvider::tamilOnlySourceLine((string) $r['sourceLine']);
    $totalRules += count($r['rules']);
    if ($kept !== '') {
        $withSource++;
    }
    printf(
        "%-38s %-12s %6d %-8s %s\n",
        mb_substr($q, 0, 36),
        (string) $r['areaId'],
        count($r['rules']),
        count($r['rules']) > 0 ? (count(explode(' · ', substr((string) $r['sourceLine'], 8)))) : 0,
        $kept !== '' ? mb_substr($kept, 0, 34) : '(EMPTY - all stripped)'
    );
}
printf("\n%d rules fired across %d questions; %d questions kept a citable source line (%d%%)\n",
    $totalRules, count($questions), $withSource, (int) round(100 * $withSource / count($questions)));

// A second chart, built to satisfy the marriage and wealth conditions, so a card
// that fired nothing above is still proven to cite when it does fire. A card
// whose rules never match is not evidence either way.
$chartMarriageWealth = $chart;
$chartMarriageWealth['lordHouse'] = [1 => 1, 2 => 8, 3 => 1, 4 => 12, 5 => 6, 6 => 6, 7 => 8, 8 => 4, 9 => 5, 10 => 6, 11 => 8, 12 => 7];
$chartMarriageWealth['doshas'] = ['SadeSati', 'KujaDosha'];
$chartMarriageWealth['planetHouse']['Sevvai'] = 8;

echo "\n", $line, "\nEVERY CARD, FORCED TO FIRE\n", $line, "\n";
printf("%-16s %-12s %6s %-8s %s\n", 'CARD', 'AREA', 'RULES', 'CITABLE', 'SOURCE LINE THAT SURVIVES');
$cardQuestions = [
    ['health', 'ta', 'என் உடல்நலம் எப்படி இருக்கும்?'],
    ['wealth', 'ta', 'எனக்கு பணம் வரவு எப்போது?'],
    ['education', 'ta', 'நான் படித்தது வேலைக்கு உதவுமா?'],
    ['career', 'ta', 'என் வேலை எப்போது கிடைக்கும்?'],
    ['marriage', 'ta', 'என் திருமணம் எப்போது நடக்கும்?'],
    ['property', 'ta', 'வீடு கட்ட முடியுமா?'],
    ['travel-foreign', 'ta', 'வெளிநாடு போக முடியுமா?'],
    ['current-guidance', 'ta', 'இந்த தசை என்ன சொல்கிறது?'],
];
$cardsFired = 0;
$cardsCited = 0;
foreach ($cardQuestions as [$card, $lang, $q]) {
    $r = AstroAiProvider::retrieve($q, $lang, $chartMarriageWealth);
    $kept = AstroAiProvider::tamilOnlySourceLine((string) $r['sourceLine']);
    $fired = count($r['rules']) > 0;
    if ($fired) {
        $cardsFired++;
        if ($kept !== '') {
            $cardsCited++;
        }
    }
    printf(
        "%-16s %-12s %6d %-8s %s\n",
        $card,
        (string) $r['areaId'],
        count($r['rules']),
        $fired ? ($kept !== '' ? 'yes' : 'NO') : 'n/a',
        $kept !== '' ? mb_substr($kept, 0, 34) : ($fired ? '(EMPTY - all stripped)' : '(no rule matched)')
    );
}
printf("\n%d of 8 cards fired; %d of those kept a citable source line\n", $cardsFired, $cardsCited);

echo "\n", $line, "\nGUARD vs THE RULES BLOCK (the important one)\n", $line, "\n";
// The rules block the prompt receives names these sources. If the model repeats
// one of them, does the output guard accept the draft?
$rulesBlockSources = ['EN-01', 'EN-02', 'EN-06', 'EN-09', 'EN-04', 'TA-02', 'TA-07', 'TA-25'];
foreach ($rulesBlockSources as $sid) {
    $draft = 'Your chart shows this period is demanding. Source: ' . $sid . '. Please see a qualified doctor if health worries you.';
    $check = AstroAiProvider::checkReply($draft, 'ta');
    printf(
        "  a draft naming %-7s -> %s%s\n",
        $sid,
        $check['ok'] ? 'ACCEPTED' : 'REJECTED',
        $check['ok'] ? '' : '  [' . implode('; ', $check['violations']) . ']'
    );
}

echo "\n", $line, "\nWHAT THE PROMPT IS TOLD vs WHAT IT MAY SAY\n", $line, "\n";
$registry = json_decode((string) file_get_contents('/repo/knowledge/ai-astrologer/sources.json'), true);
$lifeAreas = json_decode((string) file_get_contents('/repo/knowledge/ai-astrologer/rules/life-areas.json'), true);
$citedIds = [];
foreach (($lifeAreas['areas'] ?? []) as $area) {
    foreach (($area['rules'] ?? []) as $rule) {
        foreach (($rule['source'] ?? []) as $s) {
            if (($s['level'] ?? 'book') !== 'suppressed') {
                $citedIds[$s['id']] = ($citedIds[$s['id']] ?? 0) + 1;
            }
        }
    }
}
$citedNotCitable = [];
foreach ($citedIds as $id => $n) {
    if (!AstroAiProvider::isCitableId((string) $id)) {
        $citedNotCitable[] = $id . '(x' . $n . ')';
    }
}
echo 'sources cited by the rules: ', count($citedIds), "\n";
echo 'citable Tamil sources available: ', count($citable), "\n";
echo 'cited but NOT citable (the model is told these, then forbidden them): ',
    $citedNotCitable ? implode(', ', $citedNotCitable) : 'none', "\n";

$out = [
    'citableCount' => count($citable),
    'registryCount' => count($registry['sources'] ?? []),
    'rulesFired' => $totalRules,
    'questionsAsked' => count($questions),
    'questionsWithCitableSource' => $withSource,
    'cardsFired' => $cardsFired,
    'cardsCited' => $cardsCited,
    'citedIds' => array_keys($citedIds),
    'citedNotCitable' => $citedNotCitable,
];
file_put_contents('/repo/out.json', json_encode($out, JSON_PRETTY_PRINT));
echo "\nwrote /repo/out.json\n";
