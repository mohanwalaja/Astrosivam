<?php
require_once __DIR__ . '/../api/astrology/engine.php';

/**
 * Page 2 of the Vedic Namakaran report — the South / North Indian name
 * suggestion sheet — must exist in every language for both genders, must show
 * all four pada syllables of the birth star, and must stay byte-for-byte in
 * step with the TypeScript bank used by the live preview.
 */
function checkNamakaran($condition, string $message): void {
    if (!$condition) { throw new RuntimeException($message); }
    echo "[PASS] " . $message . "\n";
}

$letters = json_decode((string) file_get_contents(__DIR__ . '/../api/astrology/baby_nakshatra_letters.json'), true);
checkNamakaran(is_array($letters) && count($letters) === 27, 'PHP delivery table still holds all 27 Nakshatras');

/** Builds the minimal order/result pair the mPDF view needs. */
function namakaranFixture(array $row, string $gender, int $pada): array {
    $result = [
        'babyName' => 'Name Test',
        'gender' => $gender,
        'dob' => '2024-03-10',
        'tob' => '08:45',
        'birthPlace' => 'Suva',
        'country' => 'Fiji',
        'babyNamingAlgorithmVersion' => 2,
        'janmaPada' => $pada,
        'nakshatraLetters' => $row + ['pada' => $pada],
        'primaryPadaInfo' => $row['padas'][$pada - 1],
        'suggestedNames' => [],
        'chandraRasiNameEn' => 'Kumbham (Aquarius)',
        'chandraRasiNameTa' => 'கும்பம்',
        'chandraRasiNameHi' => 'कुंभ',
        'lagnaRasiNameEn' => 'Mesham (Aries)',
        'lagnaRasiNameTa' => 'மேஷம்',
        'lagnaRasiNameHi' => 'मेष'
    ];
    return ['language' => 'en', 'order_number' => 'AS-BN-TEST'] + ['result' => $result];
}

// ── 1. The resolver itself: every pada of the star gets two usable lists ────
$stars = [
    ['Shatabhisha', 24, 'M'],
    ['Ashlesha', 9, 'F'],
    ['Vishakha', 16, 'F'],
    ['Uttara Bhadrapada', 26, 'M'],
    ['Hasta', 13, 'M'],
    ['Magha', 10, 'F']
];
foreach ($stars as [$label, $index, $gender]) {
    $row = $letters[$index - 1];
    $columns = AstroEngine::getBabyNameSuggestionsByPada($row['padas'], $gender, 15);
    checkNamakaran(count($columns) === 4, "PHP builds four pada columns for {$label} ({$gender})");

    $seen = [];
    $southTotal = 0;
    $northTotal = 0;
    foreach ($columns as $column) {
        $sideCounts = count($column['south']) . '/' . count($column['north']);
        checkNamakaran(
            count($column['south']) >= 3 && count($column['north']) >= 3,
            "PHP pada {$column['soundTa']} of {$label} has a usable South/North list ({$sideCounts})"
        );
        checkNamakaran(
            count($column['south']) <= 15 && count($column['north']) <= 15,
            "PHP pada {$column['soundTa']} of {$label} stays within the 15-name cap ({$sideCounts})"
        );
        checkNamakaran(
            $column['soundTa'] === $row['padas'][$column['padaNumber'] - 1]['letterTa'],
            "PHP pada {$column['padaNumber']} of {$label} keeps the pada order of page 1"
        );
        $southTotal += count($column['south']);
        $northTotal += count($column['north']);
        foreach (array_merge($column['south'], $column['north']) as $entry) {
            $key = strtolower($entry['name']);
            checkNamakaran(!isset($seen[$key]), "PHP never repeats \"{$entry['name']}\" twice on the {$label} page");
            $seen[$key] = true;
            checkNamakaran(trim($entry['meaning']) !== '', "PHP prints a meaning for \"{$entry['name']}\"");
            checkNamakaran(mb_strlen($entry['meaning']) <= 30, "PHP meaning of \"{$entry['name']}\" is short");
        }
    }
    checkNamakaran($southTotal >= 20 && $northTotal >= 20, "PHP {$label} page 2 carries a full sheet of names ({$southTotal} South / {$northTotal} North)");
}

// Every pada of every star must print a name list on both sides — the report
// is generated for any birth time, so no pada may render an empty column.
$thinnest = ['min' => 99, 'label' => ''];
foreach ($letters as $star) {
    foreach (['M', 'F'] as $gender) {
        $columns = AstroEngine::getBabyNameSuggestionsByPada($star['padas'], $gender, 15);
        foreach ($columns as $column) {
            $lowest = min(count($column['south']), count($column['north']));
            if ($lowest < $thinnest['min']) {
                $thinnest = ['min' => $lowest, 'label' => $star['nakshatraNameEn'] . ' ' . $gender . ' ' . $column['soundTa']];
            }
        }
    }
}
checkNamakaran($thinnest['min'] >= 1, "PHP gives all 108 padas of all 27 Nakshatras a name list (thinnest: {$thinnest['label']})");

// ── 2. The gender is respected: boys and girls never share one list ────────
function namakaranNamesForGender(array $letters, int $index, string $gender): array {
    $columns = AstroEngine::getBabyNameSuggestionsByPada($letters[$index - 1]['padas'], $gender, 15);
    $names = [];
    foreach ($columns as $column) {
        foreach (array_merge($column['south'], $column['north']) as $entry) {
            $names[] = $entry['name'];
        }
    }
    return $names;
}

$boyNames = namakaranNamesForGender($letters, 9, 'M');   // Ashlesha
$girlNames = namakaranNamesForGender($letters, 9, 'F');
$shared = array_values(array_intersect($boyNames, $girlNames));
checkNamakaran(count($boyNames) > 0 && count($girlNames) > 0, 'PHP builds both the boy and the girl sheet');
checkNamakaran($boyNames !== $girlNames, 'PHP boy and girl sheets are different lists');
checkNamakaran(count($shared) < count($boyNames) / 4, 'PHP boy and girl sheets share at most a few unisex names (shared: ' . implode(', ', array_slice($shared, 0, 5)) . ')');
checkNamakaran(in_array('Dinesh', $boyNames, true) && in_array('Divya', $girlNames, true), 'PHP boy sheet keeps boy names and the girl sheet keeps girl names');

// ── 3. The rendered mPDF HTML: page 1 certificate + page 2 name sheet ──────
foreach ([['en', 'en'], ['ta', 'ta'], ['hi', 'hi']] as [$lang]) {
    foreach (['M', 'F'] as $gender) {
        $row = $letters[23]; // Shatabhisha — one full star in every language
        $fixture = namakaranFixture($row, $gender, 1);
        $fixture['language'] = $lang;
        $html = AstroReportViews::generateBabyNamingHtml(
            ['language' => $lang, 'order_number' => 'AS-BN-TEST'],
            $fixture['result']
        );

        checkNamakaran(substr_count($html, '<pagebreak />') === 1, "PHP {$lang} {$gender} report breaks to a second page exactly once");
        checkNamakaran(substr_count($html, 'class="bn-frame"') === 2, "PHP {$lang} {$gender} report prints the certificate and the name sheet");
        checkNamakaran(substr_count($html, 'class="sug-cols"') === 1, "PHP {$lang} {$gender} name sheet has one two-column name area");
        checkNamakaran(strpos($html, 'class="sug-col-head sug-south"') !== false && strpos($html, 'class="sug-col-head sug-north"') !== false, "PHP {$lang} {$gender} name sheet labels both styles");
        checkNamakaran(stripos($html, 'undefined') === false, "PHP {$lang} {$gender} report has no unfilled label");
        checkNamakaran(strpos($html, 'bn-medallion') === false && strpos($html, 'class="bn-hero-line"') !== false, "PHP {$lang} {$gender} keeps the naming letter without a circular badge");
        checkNamakaran(preg_match('/\.sug-nm\s*\{\s*font-size:\s*14px/', $html) === 1, "PHP {$lang} {$gender} page 2 uses larger name type");
        checkNamakaran(strpos($html, '</span><br/><span class="sug-mn">') !== false, "PHP {$lang} {$gender} places the meaning below each name");
        checkNamakaran(strpos($html, 'class="sug-cell" style="height:') !== false, "PHP {$lang} {$gender} distributes the lists through the full page");

        $columns = AstroEngine::getBabyNameSuggestionsByPada($row['padas'], $gender, 15);
        foreach ($columns as $column) {
            checkNamakaran(strpos($html, $column['soundTa']) !== false, "PHP {$lang} {$gender} page 2 prints pada {$column['soundTa']}");
            foreach ($column['south'] as $entry) {
                $expectedName = $lang === 'ta'
                    ? AstroReportViews::transliterateToTamil($entry['name'])
                    : ($lang === 'hi' ? AstroReportViews::transliterateToHindi($entry['name']) : $entry['name']);
                checkNamakaran(strpos($html, $expectedName) !== false, "PHP {$lang} {$gender} page 2 prints {$expectedName}");
            }
            foreach ($column['north'] as $entry) {
                $expectedName = $lang === 'ta'
                    ? AstroReportViews::transliterateToTamil($entry['name'])
                    : ($lang === 'hi' ? AstroReportViews::transliterateToHindi($entry['name']) : $entry['name']);
                checkNamakaran(strpos($html, $expectedName) !== false, "PHP {$lang} {$gender} page 2 prints the North Indian {$expectedName}");
            }
        }
        $firstSouth = $columns[0]['south'][0]['name'];
        if ($lang === 'ta') {
            $expectedFirst = AstroReportViews::transliterateToTamil($firstSouth);
            checkNamakaran(strpos($html, $expectedFirst) !== false, "PHP {$lang} shows the Tamil name {$expectedFirst} on page 2");
        } elseif ($lang === 'hi') {
            $expectedFirst = AstroReportViews::transliterateToHindi($firstSouth);
            checkNamakaran(strpos($html, $expectedFirst) !== false, "PHP {$lang} shows the Hindi name {$expectedFirst} on page 2");
        } else {
            checkNamakaran(strpos($html, $firstSouth) !== false, "PHP {$lang} keeps the Roman name {$firstSouth} on page 2");
        }
    }
}

// ── 4. A star whose pada sound has no names of its own still gets a sheet ──
$x = array_values(array_filter($letters, fn($row) => $row['nakshatraIndex'] === 26))[0]; // Uttara Bhadrapada (Tha/Jha/Nya)
$columns = AstroEngine::getBabyNameSuggestionsByPada($x['padas'], 'M', 15);
$usesRelated = false;
foreach ($columns as $column) { if (!empty($column['usesRelatedSounds'])) { $usesRelated = true; } }
$html = AstroReportViews::generateBabyNamingHtml(
    ['language' => 'en', 'order_number' => 'AS-BN-TEST'],
    namakaranFixture($x, 'M', 2)['result']
);
checkNamakaran($usesRelated, 'PHP marks lists that were completed with related sounds');
checkNamakaran(strpos($html, 'class="sug-note"') !== false, 'PHP explains the related sounds in a footnote');

// A fully populated bank must still be one full name sheet, never page 3.
$denseResult = namakaranFixture($letters[23], 'F', 2)['result'];
$denseResult['nameSuggestions'] = AstroEngine::getBabyNameSuggestionsByPada($letters[23]['padas'], 'F', 15);
foreach ($denseResult['nameSuggestions'] as &$column) {
    foreach (['south', 'north'] as $side) {
        $column[$side] = array_map(fn($i) => [
            'name' => 'Meenakshisundaram' . $i,
            'meaning' => 'Guiding light, spiritual guide'
        ], range(1, 15));
    }
}
unset($column);
$denseHtml = AstroReportViews::generateBabyNamingHtml(['language' => 'en'], $denseResult);
checkNamakaran(substr_count($denseHtml, 'class="sug-nm"') === 64, 'PHP rebuilds stale oversized lists to the current 64-name sheet');
checkNamakaran(preg_match('/\.sug-nm\s*\{\s*font-size:\s*14px/', $denseHtml) === 1, 'PHP keeps even a full 64-name sheet at enlarged type');
preg_match('/class="sug-cell" style="height:([0-9.]+)mm;"/', $denseHtml, $heightMatch);
checkNamakaran(abs(floatval($heightMatch[1] ?? 0) * 16 - 186) < 0.1, 'PHP budgets the full name area across shared South/North rows');
if (AstroMpdfReports::isAvailable()) {
    $densePdf = AstroMpdfReports::convertHtmlToPdf($denseHtml, 'en');
    checkNamakaran(preg_match_all('/\/Type\s*\/Page\b/', $densePdf) === 2, 'mPDF keeps the certificate and 64 larger names on exactly two pages');
}

// ── 5. The meaning under every name is a curated translation ───────────────
// Page 2 must never fall back to word-by-word output for a shipped name: the
// Tamil and Hindi meanings come from data/namakaran_meaning_glossary.tsv, and
// the shipped name bank is fully covered by it.
$glossary = astro_namakaran_meaning_glossary();
checkNamakaran(count($glossary) > 1000, 'PHP loads the full curated meaning glossary (' . count($glossary) . ' meanings)');

$tsMeaningData = (string) file_get_contents(__DIR__ . '/../server/astrology/namakaranMeaningData.ts');
$phpMeaningData = (string) file_get_contents(__DIR__ . '/../api/astrology/namakaran_meanings.php');
preg_match("/NAMAKARAN_MEANING_GLOSSARY_HASH = '([0-9a-f]+)'/", $tsMeaningData, $tsMeaningHash);
preg_match('/\* Content hash    : ([0-9a-f]+)/', $phpMeaningData, $phpMeaningHash);
checkNamakaran(
    ($tsMeaningHash[1] ?? '') !== '' && ($tsMeaningHash[1] ?? '') === ($phpMeaningHash[1] ?? ''),
    'PHP and TypeScript meaning glossaries share one content hash'
);

$untranslated = [];
foreach (file(__DIR__ . '/../data/namakaran_name_bank.tsv') as $bankLine) {
    $bankLine = trim($bankLine);
    if ($bankLine === '' || $bankLine[0] === '#') continue;
    $cells = explode("\t", $bankLine);
    if (count($cells) !== 5) continue;
    $bankMeaning = trim($cells[4]);
    if ($bankMeaning !== '' && !isset($glossary[strtolower($bankMeaning)])) {
        $untranslated[$bankMeaning] = true;
    }
}
checkNamakaran(
    $untranslated === [],
    'PHP glossary covers every meaning of the name bank'
    . ($untranslated === [] ? '' : ' (missing: ' . implode(' | ', array_slice(array_keys($untranslated), 0, 5)) . ')')
);

$meaningChecks = 0;
$meaningMismatch = 0;
$meaningLatin = 0;
foreach (['M', 'F'] as $gender) {
    foreach ($letters as $starRow) {
        foreach (AstroEngine::getBabyNameSuggestionsByPada($starRow['padas'], $gender, 15) as $column) {
            foreach (array_merge($column['south'], $column['north']) as $entry) {
                $meaningChecks++;
                $curated = $glossary[strtolower(trim((string) ($entry['meaningEn'] ?? $entry['meaning'] ?? '')))] ?? null;
                if ($curated === null) { $meaningMismatch++; continue; }
                if ($entry['meaningTa'] !== $curated['ta'] || $entry['meaningHi'] !== $curated['hi']) { $meaningMismatch++; }
                if (preg_match('/[A-Za-z]/u', $entry['meaningTa'] . $entry['meaningHi'])) { $meaningLatin++; }
            }
        }
    }
}
checkNamakaran($meaningChecks > 3000, "PHP localizes every printed name of all 27 Nakshatras ({$meaningChecks} names)");
checkNamakaran($meaningMismatch === 0, "PHP prints the curated Tamil and Hindi meaning for every name ({$meaningMismatch} mismatches)");
checkNamakaran($meaningLatin === 0, "No localized meaning line carries Latin text ({$meaningLatin})");

// A legacy order cached the broken word-by-word text; the English meaning is
// the source value, so the mPDF report must print the corrected translation.
$legacyRow = $letters[23]; // Shatabhisha
$legacyFixture = namakaranFixture($legacyRow, 'F', 2);
$legacyFixture['result']['nameSuggestions'] = [[
    'padaNumber' => 1,
    'soundTa' => $legacyRow['padas'][0]['letterTa'],
    'soundEn' => $legacyRow['padas'][0]['letterEn'],
    'soundHi' => $legacyRow['padas'][0]['letterHi'],
    'rasiTa' => '',
    'rasiEn' => '',
    'rasiHi' => '',
    'usesRelatedSounds' => false,
    'south' => [[
        'name' => 'Sudhan',
        'meaning' => 'Wealth and virtue',
        'meaningTa' => 'செல்வம் and virtue',
        'meaningHi' => 'धन and virtue'
    ]],
    'north' => []
]];
$legacyHtml = AstroReportViews::generateBabyNamingHtml(
    ['language' => 'ta', 'order_number' => 'AS-BN-TEST'],
    $legacyFixture['result']
);
checkNamakaran(
    strpos($legacyHtml, 'செல்வம் and virtue') === false
    && substr_count($legacyHtml, 'class="sug-nm-ta"') === 64,
    'PHP rebuilds legacy lists from current data instead of printing cached names or meanings'
);

// ── 5b. Page 1 example names carry a localized meaning in every language ───
// The PHP engine used to copy the English meaning into meaningTa/meaningHi, so
// the Tamil and Hindi sheet printed English in its "suggested names" table.
$exampleMeanings = [
    'Ultimate wisdom; the conclusion of the Vedas',
    'Lord of Venkata, an aspect of Vishnu',
    'Sacred knowledge; altar of the Vedas',
    'A sacred musical instrument; melody',
    'One who brings light and awakening',
    'One who brings joy and contentment',
    'Karthikeyan (Murugan); one born in Karthikai',
    'Poetry; a graceful literary creation',
    'Ray of light',
    'Fame, honour and good reputation',
    'Crest jewel; one of great brilliance',
    'A precious crown jewel',
    'Conscious, intelligent spirit',
    'Consciousness; living spirit',
    'A name associated with the ancient Tamil dynasty',
    'A flourishing grove',
    'One with auspicious signs',
    'Graceful, charming and playful'
];
$exampleMismatch = 0;
foreach ($exampleMeanings as $exampleMeaning) {
    $curated = $glossary[strtolower($exampleMeaning)] ?? null;
    if ($curated === null
        || AstroEngine::localizeNamakaranMeaning($exampleMeaning, 'ta') !== $curated['ta']
        || AstroEngine::localizeNamakaranMeaning($exampleMeaning, 'hi') !== $curated['hi']) {
        $exampleMismatch++;
    }
}
checkNamakaran($exampleMismatch === 0, "Every page 1 example meaning is curated in Tamil and Hindi ({$exampleMismatch} mismatches)");

$exampleMethod = new ReflectionMethod(AstroEngine::class, 'getBabyNameExamples');
$exampleMethod->setAccessible(true);
$exampleLatin = 0;
$exampleCount = 0;
foreach (['Ve / Way', 'Vo', 'Kaa / Ka', 'Kee / Ki', 'Chu / Su', 'Che / Se', 'Cho / So', 'La'] as $syllable) {
    foreach (['M', 'F'] as $exampleGender) {
        foreach ((array) $exampleMethod->invoke(null, $syllable, $exampleGender) as $exampleEntry) {
            $exampleCount++;
            if (preg_match('/[A-Za-z]/u', ($exampleEntry['meaningTa'] ?? '') . ($exampleEntry['meaningHi'] ?? ''))) { $exampleLatin++; }
            if (trim((string) ($exampleEntry['meaningTa'] ?? '')) === '') { $exampleLatin++; }
        }
    }
}
checkNamakaran($exampleCount > 0, "PHP builds the page 1 example names for every syllable ({$exampleCount} examples)");
checkNamakaran($exampleLatin === 0, "Every page 1 example meaning prints Tamil and Hindi, never English ({$exampleLatin} bad rows)");

// ── 6. The generated name bank stayed in sync with the TypeScript twin ──────
$tsBank = (string) file_get_contents(__DIR__ . '/../server/astrology/namakaranNameBank.ts');
$phpBank = (string) file_get_contents(__DIR__ . '/../api/astrology/namakaran_name_bank.php');
preg_match("/NAMAKARAN_BANK_HASH = '([0-9a-f]+)'/", $tsBank, $tsHash);
preg_match("/'hash' => '([0-9a-f]+)'/", $phpBank, $phpHash);
checkNamakaran(($tsHash[1] ?? '') !== '' && ($tsHash[1] ?? '') === ($phpHash[1] ?? ''), 'PHP and TypeScript name banks share one content hash');

echo "\nALL NAMAKARAN PAGE 2 CHECKS PASSED!\n";

// The delivery renderer must apply source corrections to the real sample too.
$sample = AstroEngine::calculateBabyNaming([
    'babyName' => 'Aarav', 'gender' => 'M', 'dob' => '2000-01-01', 'tob' => '02:00',
    'birthPlace' => 'Chennai', 'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata'
]);
$sample['generatedAt'] = '2026-10-07T02:30:00Z';
checkNamakaran(strpos($sample['nakshatraLetters']['rajjuEn'], 'Kantha') !== false, 'PHP Swati resolves to Kantha');
$sampleHtml = AstroReportViews::generateBabyNamingHtml(['language' => 'ta'], $sample);
foreach (['கணிப்பு சரிபார்க்கப்பட்டது', 'பெயரின் முதல் ஒலி (A)', 'பொருந்தவில்லை', 'கண்ட ரஜ்ஜு',
    'ASTRO-NAME-20261007', '07 Oct 2026, 08:00 IST', 'அங்கீகரிக்கப்பட்டவர்', 'நவாம்சம்',
    'தனுசு', 'மகரம்', 'கும்பம்', 'மீனம்', '★ பாதம் 2', 'ரூபேஷ்', 'ரமேஷ்', 'ரகேஷ்', 'ராஜேஷ்',
    'ரோனக்', 'ரோனித்', 'உண்மையின் இறைவன்', 'புனித ரேவா நதியின் பகுதி', 'ஒளிமிக்க, சூரியனின் மகன்'] as $expected) {
    checkNamakaran(strpos($sampleHtml, $expected) !== false, "PHP corrected sample contains {$expected}");
}
$markers = 0;
foreach ($sample['nameSuggestions'] as $column) {
    checkNamakaran(count($column['south']) === 8 && count($column['north']) === 8, 'PHP sample has eight names per side');
    $seen = [];
    foreach (array_merge($column['south'], $column['north']) as $entry) {
        $printed = AstroReportViews::transliterateToTamil($entry['name']);
        checkNamakaran(!isset($seen[$printed]), "PHP sample has no display duplicate: {$printed}");
        $seen[$printed] = true;
        if ($entry['isRelatedSound']) $markers++;
        checkNamakaran($entry['name'] !== 'Danish', 'Danish is not a Ta suggestion');
    }
}
checkNamakaran(substr_count($sampleHtml, '<sup>†</sup>') === $markers, 'PHP marks every non-exact syllable');
