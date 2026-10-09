<?php
require_once __DIR__ . '/../api/astrology/engine.php';

function checkReport($condition, string $message): void {
    if (!$condition) { throw new RuntimeException($message); }
    echo "[PASS] " . $message . "\n";
}

$result = [
    'devoteeName' => 'PDF Regression', 'dob' => '1991-06-18', 'tob' => '06:30',
    'birthPlace' => 'Suva', 'eventKey' => 'wedding',
    'muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION,
    'muhurthamPlace' => 'Suva, Fiji',
    'muhurthamLatitude' => -18.1416,
    'muhurthamLongitude' => 178.4419,
    'muhurthamTimezoneOffsetHours' => 12,
    'months' => [[
        'monthKey' => '2026-11', 'month' => 11, 'year' => 2026,
        'monthNameEn' => 'November 2026', 'monthNameTa' => 'நவம்பர் 2026', 'monthNameHi' => 'नवंबर 2026',
        'days' => [
            ['date' => '2026-11-05', 'grade' => 'BEST', 'dayOfWeekNameEn' => 'Thursday', 'nakshatraNameEn' => 'Rohini', 'nallaNeram' => [['start' => '09:00 AM', 'end' => '10:00 AM']]],
            ['date' => '2026-11-12', 'grade' => 'GOOD', 'dayOfWeekNameEn' => 'Thursday', 'nakshatraNameEn' => 'Hasta', 'nallaNeram' => [['start' => '10:00 AM', 'end' => '11:00 AM']]],
            ['date' => '2026-11-18', 'grade' => 'FAIR'],
            ['date' => '2026-11-24', 'grade' => 'AVOID']
        ]
    ]]
];
$original = json_encode($result);
$rules = AstroEngine::getMuhurthamRules();
$scanInputContext = [
    'dob' => '1991-06-18', 'tob' => '06:30', 'birthPlace' => 'Suva', 'country' => 'Fiji',
    'latitude' => -18.1416, 'longitude' => 178.4419, 'timezoneOffsetHours' => 12, 'timeZoneId' => 'Pacific/Fiji',
    'muhurthamPlace' => 'New York, New York, United States', 'muhurthamCountry' => 'United States',
    'muhurthamLatitude' => 40.7128, 'muhurthamLongitude' => -74.006,
    'muhurthamTimezoneOffsetHours' => -5, 'muhurthamTimeZoneId' => 'America/New_York',
    'eventKey' => 'wedding', 'selectedMonth' => '2026-11'
];
$normalizedLocations = AstroEngine::calculateMuhurtham([
    'name' => 'Place Separation', 'dob' => '1991-06-18', 'tob' => '06:30',
    'birthPlace' => 'Suva', 'country' => 'Fiji', 'latitude' => -18.1416, 'longitude' => 178.4419,
    'timezoneOffsetHours' => 12, 'timeZoneId' => 'Pacific/Fiji',
    'muhurthamPlace' => 'New York, New York, United States', 'muhurthamCountry' => 'United States',
    'muhurthamLatitude' => 40.7128, 'muhurthamLongitude' => -74.006,
    'muhurthamTimezoneOffsetHours' => -5, 'muhurthamTimeZoneId' => 'America/New_York',
    'eventKey' => 'wedding', 'selectedMonth' => '2026-11',
    'muhurthamScan' => ['muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION, 'inputContext' => $scanInputContext, 'months' => [[
        'monthKey' => '2026-11', 'month' => 11, 'year' => 2026,
        'monthNameEn' => 'November 2026', 'days' => [['date' => '2026-11-05', 'grade' => 'BEST', 'pada' => 2]]
    ]]]
]);
checkReport($normalizedLocations['birthPlace'] === 'Suva' && $normalizedLocations['muhurthamPlace'] === 'New York, New York, United States', 'PHP Muhurtham result preserves separate birthplace and local event location');
checkReport($normalizedLocations['muhurthamTimeZoneId'] === 'America/New_York' && AstroEngine::isCurrentMuhurthamResult($normalizedLocations), 'PHP Muhurtham result records the local time zone and current report version');
$staleLocationScanRejected = false;
try {
    $staleLocationPayload = [
        'dob' => '1991-06-18', 'tob' => '06:30', 'birthPlace' => 'Suva', 'country' => 'Fiji',
        'latitude' => -18.1416, 'longitude' => 178.4419, 'timezoneOffsetHours' => 12, 'timeZoneId' => 'Pacific/Fiji',
        'muhurthamPlace' => 'Suva, Fiji', 'muhurthamCountry' => 'Fiji',
        'muhurthamLatitude' => -18.1416, 'muhurthamLongitude' => 178.4419,
        'muhurthamTimezoneOffsetHours' => 12, 'muhurthamTimeZoneId' => 'Pacific/Fiji',
        'eventKey' => 'wedding', 'selectedMonth' => '2026-11',
        'muhurthamScan' => [
            'muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION,
            'inputContext' => $scanInputContext,
            'months' => [[
                'monthKey' => '2026-11', 'month' => 11, 'year' => 2026,
                'days' => [['date' => '2026-11-05', 'grade' => 'BEST']]
            ]]
        ]
    ];
    AstroEngine::calculateMuhurtham($staleLocationPayload);
} catch (RuntimeException $error) {
    $staleLocationScanRejected = strpos($error->getMessage(), 'outdated') !== false;
}
checkReport($staleLocationScanRejected, 'PHP rejects a v6 scan stamped for a different event location instead of relabeling its local times');
$outdatedScanRejected = false;
try {
    AstroEngine::calculateMuhurtham([
        'muhurthamPlace' => 'Suva, Fiji', 'muhurthamLatitude' => -18.1416,
        'muhurthamLongitude' => 178.4419, 'muhurthamTimezoneOffsetHours' => 12,
        'eventKey' => 'wedding',
        'muhurthamScan' => ['muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION - 1, 'months' => [['days' => []]]]
    ]);
} catch (RuntimeException $error) {
    $outdatedScanRejected = strpos($error->getMessage(), 'outdated') !== false;
}
checkReport($outdatedScanRejected, 'PHP refuses to relabel an old Tithi scan as a current report');
$locationHtml = AstroReportViews::generateMuhurthamHtml(['language' => 'en'], $normalizedLocations);
checkReport(strpos($locationHtml, 'MUHURTHAM LOCATION (LOCAL TIMES)') !== false && strpos($locationHtml, 'New York, New York, United States') !== false && strpos($locationHtml, 'Birth place for Janma Nakshatra:') !== false, 'PHP Muhurtham report shows the local event place separately from the birthplace');
$unsafeLanguage = 'en" onload="alert(1)';
$unsafeLanguageHtml = AstroReportViews::generateMuhurthamHtml(['language' => $unsafeLanguage], $normalizedLocations);
checkReport(
    astro_report_normalize_language(' TA ') === 'ta' &&
    astro_report_normalize_language($unsafeLanguage) === 'en' &&
    strpos($unsafeLanguageHtml, '<html lang="en">') !== false &&
    strpos($unsafeLanguageHtml, 'onload=') === false,
    'PHP report languages are allowlisted before rendering the HTML lang attribute'
);
checkReport(!AstroEngine::isCurrentMuhurthamResult(['muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION - 1, 'months' => [['days' => []]]]), 'Version 4 Muhurtham results are invalidated after the Tithi scoring correction');
$missingEventLocationRejected = false;
try {
    AstroEngine::calculateMuhurtham([
        'dob' => '1991-06-18', 'tob' => '06:30', 'birthPlace' => 'Suva',
        'latitude' => -18.1416, 'longitude' => 178.4419, 'timezoneOffsetHours' => 12,
        'eventKey' => 'wedding', 'muhurthamScan' => ['months' => [['days' => [['date' => '2026-11-05']]]]]
    ]);
} catch (RuntimeException $error) {
    $missingEventLocationRejected = strpos($error->getMessage(), 'separate Muhurtham location') !== false;
}
checkReport($missingEventLocationRejected, 'PHP rejects a legacy scan without a separate Muhurtham location instead of treating birthplace as event location');
$notes = MuhurthamReportNotes::build($result, $rules['wedding'], 'en');
checkReport($notes['summaryText'] === '4 days assessed: 2 recommended (1 BEST + 1 GOOD); 1 FAIR and 1 AVOID not listed.', 'PHP notes count actual assessed and recommended dates');
checkReport(strpos($notes['weekdayText'], 'Tuesday (Mars), Saturday (Saturn)') !== false, 'Wedding notes explain Tuesday and Saturday');
checkReport(strpos($notes['selectionText'], 'Aadi, Purattasi, Margazhi') !== false, 'Wedding notes explain the avoided solar months');

$business = $result;
$business['eventKey'] = 'business_start';
$businessNotes = MuhurthamReportNotes::build($business, $rules['business_start'], 'en');
checkReport(strpos($businessNotes['weekdayText'], 'Tuesday (Mars)') !== false && strpos($businessNotes['weekdayText'], 'Saturday') === false, 'Business notes do not falsely exclude Saturday');
checkReport(strpos($businessNotes['selectionText'], 'Jupiter/Venus combustion') === false, 'Wedding-specific combustion rules are not attributed to business dates');

// The ♥ mark highlights personally favourable dates; page 1 carries a plain
// text legend explaining how they differ from the generally good dates.
$personalResult = $result;
$personalResult['months'][0]['days'][0]['personalChecks'] = [[
    'role' => 'devotee', 'nakshatraNameEn' => 'Rohini', 'taraNameEn' => 'Sampath',
    'isTaraAuspicious' => true, 'isChandrashtama' => false
]];
foreach (['en', 'ta', 'hi'] as $lang) {
    $personalNotes = MuhurthamReportNotes::build($personalResult, $rules['wedding'], $lang);
    checkReport(trim((string) $personalNotes['personalMarkNote']) !== '', 'Heart-mark legend copy exists for ' . $lang);
    $personalHtml = AstroReportViews::generateMuhurthamHtml(['language' => $lang, 'order_number' => 'PDF-TEST'], $personalResult);
    $notePos = strpos($personalHtml, '<div class="personal-dates-note">');
    checkReport($notePos !== false, 'Page 1 shows the heart-mark legend when a personal date exists in ' . $lang);
    $page2Pos = strpos($personalHtml, '<div class="sheet muhurtham-sheet">');
    checkReport($notePos !== false && $page2Pos !== false && $notePos < $page2Pos, 'The heart-mark legend sits on page 1, before the page-2 sheet, in ' . $lang);
    checkReport(strpos($personalHtml, 'undefined') === false, 'Heart-mark legend has no unfilled labels in ' . $lang);
}
$plainHtml = AstroReportViews::generateMuhurthamHtml(['language' => 'en', 'order_number' => 'PDF-TEST'], $result);
checkReport(strpos($plainHtml, '<div class="personal-dates-note">') === false, 'No heart-mark legend is printed when no date is personally favourable');

foreach (['en', 'ta', 'hi'] as $lang) {
    $html = AstroReportViews::generateMuhurthamHtml(['language' => $lang, 'order_number' => 'PDF-TEST'], $result);
    checkReport(substr_count($html, '<div class="sheet muhurtham-sheet') === 2, 'PHP HTML remains two report pages in ' . $lang);
    checkReport(substr_count($html, '<div class="muhurtham-selection-notes">') === 1, 'PHP HTML has exactly one selection guide in ' . $lang);
    checkReport(strpos($html, 'height:100mm;padding:0;vertical-align:top;') !== false, 'PHP HTML reserves the upper half before the guide in ' . $lang);
    checkReport(strpos($html, 'undefined') === false, 'PHP localized explanations have no unfilled labels in ' . $lang);
}
checkReport(json_encode($result) === $original, 'Explanation rendering does not modify the scan or grades');

// ---- Two-person wedding: bride + groom are both carried and both printed ----
$twoPersonPayload = [
    'name' => 'Karthik Raman', 'dob' => '2000-01-01', 'tob' => '02:00',
    'birthPlace' => 'Chennai', 'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata',
    'bride' => [
        'name' => 'Priya Devi', 'dob' => '1998-06-15', 'tob' => '06:30',
        'birthPlace' => 'Chennai', 'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707,
        'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata'
    ],
    'muhurthamPlace' => 'Chennai, India', 'muhurthamCountry' => 'India',
    'muhurthamLatitude' => 13.0827, 'muhurthamLongitude' => 80.2707,
    'muhurthamTimezoneOffsetHours' => 5.5, 'muhurthamTimeZoneId' => 'Asia/Kolkata',
    'eventKey' => 'wedding', 'selectedMonth' => '2026-12',
    'muhurthamScan' => [
        'muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION,
        'inputContext' => [
            'dob' => '2000-01-01', 'tob' => '02:00', 'birthPlace' => 'Chennai', 'country' => 'India',
            'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata',
            'muhurthamPlace' => 'Chennai, India', 'muhurthamCountry' => 'India',
            'muhurthamLatitude' => 13.0827, 'muhurthamLongitude' => 80.2707,
            'muhurthamTimezoneOffsetHours' => 5.5, 'muhurthamTimeZoneId' => 'Asia/Kolkata',
            'brideName' => 'Priya Devi', 'brideDob' => '1998-06-15', 'brideTob' => '06:30',
            'brideBirthPlace' => 'Chennai', 'brideCountry' => 'India', 'brideLatitude' => 13.0827,
            'brideLongitude' => 80.2707, 'brideTimezoneOffsetHours' => 5.5, 'brideTimeZoneId' => 'Asia/Kolkata',
            'eventKey' => 'wedding', 'selectedMonth' => '2026-12'
        ],
        'months' => [[
            'monthKey' => '2026-12', 'month' => 12, 'year' => 2026,
            'monthNameEn' => 'December 2026', 'monthNameTa' => 'டிசம்பர் 2026', 'monthNameHi' => 'दिसंबर 2026',
            'days' => [[
                'date' => '2026-12-04', 'grade' => 'BEST', 'pada' => 2, 'dayOfWeekNameEn' => 'Friday',
                'nakshatraNameEn' => 'Hasta', 'nakshatraNameTa' => 'அஸ்தம்', 'nakshatraNameHi' => 'हस्त',
                'nallaNeram' => [['start' => '09:00 AM', 'end' => '10:00 AM']],
                'personalChecks' => [
                    ['role' => 'groom', 'nakshatraIndex' => 14, 'taraNameEn' => 'Mitra', 'isTaraAuspicious' => true, 'isChandrashtama' => false, 'isJanmaNakshatra' => false],
                    ['role' => 'bride', 'nakshatraIndex' => 22, 'taraNameEn' => 'Parama Mitra', 'isTaraAuspicious' => true, 'isChandrashtama' => false, 'isJanmaNakshatra' => false]
                ],
                'personalNoteEn' => 'No Chandrashtama · good Tara Bala',
                'personalNoteTa' => 'சந்திராஷ்டமம் இல்லை · நல்ல தாரா பலா'
            ]]
        ]],
        'persons' => [
            [
                'role' => 'groom', 'name' => 'Karthik Raman', 'dob' => '2000-01-01', 'tob' => '02:00', 'birthPlace' => 'Chennai',
                'nakshatraIndex' => 14, 'nakshatraNameEn' => 'Swati', 'nakshatraNameTa' => 'சுவாதி', 'nakshatraNameHi' => 'स्वाति',
                'rasiNumber' => 7, 'rasiNameEn' => 'Thulam (Libra)', 'rasiNameTa' => 'துலாம்', 'rasiNameHi' => 'तुला',
                'lagnaRasiNumber' => 7, 'lagnaNameEn' => 'Thulam (Libra)', 'lagnaNameTa' => 'துலாம்', 'lagnaNameHi' => 'तुला'
            ],
            [
                'role' => 'bride', 'name' => 'Priya Devi', 'dob' => '1998-06-15', 'tob' => '06:30', 'birthPlace' => 'Chennai',
                'nakshatraIndex' => 22, 'nakshatraNameEn' => 'Dhanishta', 'nakshatraNameTa' => 'அவிட்டம்', 'nakshatraNameHi' => 'धनिष्ठा',
                'rasiNumber' => 10, 'rasiNameEn' => 'Magaram (Capricorn)', 'rasiNameTa' => 'மகரம்', 'rasiNameHi' => 'मकर',
                'lagnaRasiNumber' => 3, 'lagnaNameEn' => 'Mithunam (Gemini)', 'lagnaNameTa' => 'மிதுனம்', 'lagnaNameHi' => 'मिथुन'
            ]
        ]
    ]
];
$twoPersonResult = AstroEngine::calculateMuhurtham($twoPersonPayload);
checkReport(count($twoPersonResult['persons']) === 2 && $twoPersonResult['personalCheckMode'] === 'both',
    'PHP keeps BOTH the bride and the groom for a wedding report');
checkReport($twoPersonResult['persons'][1]['name'] === 'Priya Devi' && $twoPersonResult['persons'][1]['rasiNameTa'] === 'மகரம்',
    'PHP keeps the bride name, rasi and lagna computed from her own birth details');
checkReport($twoPersonResult['months'][0]['days'][0]['personalNoteTa'] !== ''
    && $twoPersonResult['months'][0]['days'][0]['personalChecks'][1]['isJanmaNakshatra'] === false,
    'PHP keeps the per-date Chandrashtama / Tara Bala note and the Janma-Nakshatra flag');
checkReport($twoPersonResult['windowLabelEn'] === '04 Dec 2026 – 04 Dec 2026',
    'PHP window label is the real covered date range, not the "2 prior months" rule');
foreach (['en', 'ta', 'hi'] as $lang) {
    $twoPersonHtml = AstroReportViews::generateMuhurthamHtml(['language' => $lang, 'order_number' => 'PDF-TEST'], $twoPersonResult);
    checkReport(strpos($twoPersonHtml, 'Karthik Raman') !== false && strpos($twoPersonHtml, 'Priya Devi') !== false,
        'PHP report shows both the bride and the groom in ' . $lang);
    checkReport(strpos($twoPersonHtml, 'couple-grid') !== false && strpos($twoPersonHtml, 'class="cal-personal-note"') !== false,
        'PHP report prints the two-person particulars and the per-date personal note in ' . $lang);
    checkReport(strpos($twoPersonHtml, 'muhurtham-selection-notes') !== false
        && !preg_match('/<h2>[^<]*<\/h2>\s*<\/div>/', $twoPersonHtml),
        'PHP selection guide always renders a body under its heading in ' . $lang);
    checkReport(strpos($twoPersonHtml, 'ASTRO-MUH-') !== false || strpos($twoPersonHtml, 'PDF-TEST') !== false,
        'PHP report carries an authorisation block with a reference number in ' . $lang);
}
// A single-person wedding must say so instead of implying both charts were used.
// (Dropping the bride also clears the bride fields from the scan stamp — a scan
// stamped for two charts must never be relabelled as a one-person report.)
$singlePayload = $twoPersonPayload;
unset($singlePayload['bride']);
$singlePayload['muhurthamScan']['persons'] = [$twoPersonPayload['muhurthamScan']['persons'][0]];
foreach (['brideName', 'brideDob', 'brideTob', 'brideBirthPlace', 'brideCountry', 'brideTimeZoneId',
          'brideLatitude', 'brideLongitude', 'brideTimezoneOffsetHours'] as $brideKey) {
    unset($singlePayload['muhurthamScan']['inputContext'][$brideKey]);
}
$staleTwoPersonScanRejected = false;
try {
    $staleTwoPersonPayload = $twoPersonPayload;
    unset($staleTwoPersonPayload['bride']);
    AstroEngine::calculateMuhurtham($staleTwoPersonPayload);
} catch (RuntimeException $error) {
    $staleTwoPersonScanRejected = strpos($error->getMessage(), 'outdated') !== false;
}
checkReport($staleTwoPersonScanRejected, 'PHP rejects a scan stamped for both charts when the bride details are removed');
foreach (['en', 'ta', 'hi'] as $lang) {
    $singleHtml = AstroReportViews::generateMuhurthamHtml(['language' => $lang, 'order_number' => 'PDF-TEST'], AstroEngine::calculateMuhurtham($singlePayload));
    checkReport(strpos($singleHtml, 'single-person-note') !== false,
        'A one-person Muhurtham report states that only one chart was checked in ' . $lang);
}
$tamilNotes = MuhurthamReportNotes::build($result, $rules['wedding'], 'ta');
checkReport(strpos($tamilNotes['weekdayText'], 'செவ்வாய்க்கிழமை (செவ்வாய் கிரகம்)') !== false
    && strpos($tamilNotes['weekdayText'], 'சனிக்கிழமை (சனி கிரகம்)') !== false,
    'Tamil weekday names read as weekdays (செவ்வாய்க்கிழமை / சனிக்கிழமை) with the planet in brackets');
checkReport(trim((string) $tamilNotes['checksHeading']) !== '' && trim((string) $tamilNotes['checksText']) !== '',
    'The selection guide ships the "what was checked" heading and body in Tamil');

$pdfOrder = [
    'service_type' => 'MUHURTHAM',
    'language' => 'en',
    'order_number' => 'PDF-TEST',
    'user_name' => 'PDF Regression'
];
if (AstroMpdfReports::isAvailable()) {
    foreach (['en', 'ta', 'hi'] as $lang) {
        $pdfOrder['language'] = $lang;
        $pdf = AstroEngine::generateReportPdf($pdfOrder, $result);
        checkReport(strpos($pdf, '%PDF-') === 0 && strpos(substr($pdf, -2048), '%%EOF') !== false,
            "{$lang} mPDF returns a complete high-quality Muhurtham PDF");
        if ($lang !== 'en') {
            checkReport(preg_match('/\/BaseFont\s*\/[A-Za-z0-9+_-]*FreeSerif/', $pdf) === 1,
                "{$lang} Muhurtham PDF embeds the compatible Indic font");
        }
        $pages = preg_match_all('/\/Type\s*\/Page\b/', $pdf);
        checkReport($pages === 2, "{$lang} Muhurtham calendar has two physical pages (actual: {$pages})");
    }
} else {
    $failedClosed = false;
    try {
        AstroEngine::generateReportPdf($pdfOrder, $result);
    } catch (RuntimeException $error) {
        $failedClosed = strpos($error->getMessage(), 'no fallback PDF was produced') !== false
            || strpos($error->getMessage(), 'no lower-quality fallback is enabled') !== false;
    }
    checkReport($failedClosed, 'PHP report generation fails closed when mPDF is unavailable (no plain-PDF fallback)');
}

// ---------------------------------------------------------------------------
// Bride + groom are checked together for a WEDDING only. A second chart that
// travels with any other ceremony must be ignored, so no other report can be
// judged (or labelled) as a two-person report.
// ---------------------------------------------------------------------------
{
    foreach (['namakaranam', 'seemantham', 'griha_pravesam', 'business_start', 'vehicle_purchase', 'new_job'] as $eventKey) {
        $otherEventPayload = $twoPersonPayload;
        $otherEventPayload['eventKey'] = $eventKey;
        $otherEventPayload['muhurthamScan']['eventKey'] = $eventKey;
        $otherEventPayload['muhurthamScan']['inputContext']['eventKey'] = $eventKey;
        $otherEventMonths = [];
        foreach ($otherEventPayload['muhurthamScan']['months'] as $filterMonth) {
            $filterDays = [];
            foreach ($filterMonth['days'] as $filterDay) {
                $filterDay['personalChecks'] = [
                    ['role' => 'groom', 'nakshatraIndex' => 14, 'isTaraAuspicious' => true, 'isChandrashtama' => false, 'isJanmaNakshatra' => false],
                    ['role' => 'bride', 'nakshatraIndex' => 22, 'isTaraAuspicious' => false, 'isChandrashtama' => false, 'isJanmaNakshatra' => true]
                ];
                $filterDay['personalNoteEn'] = 'Bride: Janma Tara';
                $filterDay['personalNoteTa'] = 'மணமகள்: ஜன்ம தாரா';
                $filterDay['personalNoteHi'] = 'वधू: जन्म तारा';
                $filterDays[] = $filterDay;
            }
            $filterMonth['days'] = $filterDays;
            $otherEventMonths[] = $filterMonth;
        }
        $otherEventPayload['muhurthamScan']['months'] = $otherEventMonths;
        $otherEventResult = AstroEngine::calculateMuhurtham($otherEventPayload);
        $otherRoles = array_map(function ($person) { return $person['role']; }, $otherEventResult['persons']);
        checkReport(
            !in_array('bride', $otherRoles, true) && !in_array('groom', $otherRoles, true),
            $eventKey . ' is never judged against a second chart (roles: ' . implode(', ', $otherRoles) . ')'
        );
        checkReport($otherEventResult['personalCheckMode'] === 'single', $eventKey . ' stays a single-person report');
        checkReport(count($otherEventResult['persons']) === 1, $eventKey . ' keeps exactly one primary chart');
        $otherEventChecks = $otherEventResult['months'][0]['days'][0]['personalChecks'];
        checkReport(count($otherEventChecks) === 0, $eventKey . ' drops the bride/groom per-date checks');
        checkReport(
            (string) $otherEventResult['months'][0]['days'][0]['personalNoteEn'] === ''
            && (string) $otherEventResult['months'][0]['days'][0]['personalNoteTa'] === ''
            && (string) $otherEventResult['months'][0]['days'][0]['personalNoteHi'] === '',
            $eventKey . ' drops a per-date note that names the removed chart'
        );
    }

    // The two-person ceremonies keep both charts and their per-date note.
    foreach (['wedding', 'engagement'] as $coupleEventKey) {
        $coupleEventPayload = $twoPersonPayload;
        $coupleEventPayload['eventKey'] = $coupleEventKey;
        $coupleEventPayload['muhurthamScan']['eventKey'] = $coupleEventKey;
        $coupleEventPayload['muhurthamScan']['inputContext']['eventKey'] = $coupleEventKey;
        $coupleEventResult = AstroEngine::calculateMuhurtham($coupleEventPayload);
        $coupleRoles = array_map(function ($person) { return $person['role']; }, $coupleEventResult['persons']);
        sort($coupleRoles);
        $coupleArticle = $coupleEventKey === 'engagement' ? 'An' : 'A';
        checkReport($coupleRoles === ['bride', 'groom'], "{$coupleArticle} {$coupleEventKey} keeps both the bride and the groom charts");
        checkReport(
            (string) $coupleEventResult['personalCheckMode'] === 'both',
            "{$coupleArticle} {$coupleEventKey} stays a two-person report"
        );
    }
}

echo "\nALL MUHURTHAM REPORT TESTS PASSED!\n";
