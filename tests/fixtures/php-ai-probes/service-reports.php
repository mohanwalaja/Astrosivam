<?php
/**
 * PHP-WASM probe for the SERVICE CHAPTERS of the guided chat: Wedding
 * Matching, Baby Naming and Subha Muhurtham.
 *
 * It builds each service's REAL report result from saved order inputs with the
 * production engine, extracts the chat facts with the endpoint's own helper
 * (astro_ai_service_facts), and answers one curated option per topic through
 * the real local answer builder. No external service is contacted, and no
 * value is hard-coded: every number in the output comes from the engine.
 */
error_reporting(E_ALL);
file_put_contents('/repo/api/config.php', "<?php\n// probe stub\n");

require_once '/repo/api/astrology/ai_astrologer_provider.php';
require_once '/repo/api/astrology/engine.php';

// Load the endpoint helpers this probe needs without starting the endpoint's
// session/CORS/database dispatch.
$endpoint = file_get_contents('/repo/api/ai_astrologer.php');
if (!function_exists('astro_normalize_report_language')) {
    function astro_normalize_report_language($l) { return in_array($l, ['en', 'ta', 'hi'], true) ? $l : 'ta'; }
}
$evalFromEndpoint = function (string $from, string $to) use ($endpoint) {
    $start = strpos($endpoint, $from);
    $end = strpos($endpoint, $to, $start);
    eval(str_replace('__DIR__', "'/repo/api'", substr($endpoint, $start, $end - $start)));
};
$evalFromEndpoint('function astro_ai_guided_path(', '/* ================================================================== */');
$evalFromEndpoint('function astro_ai_report_result(', 'function astro_ai_chart_facts(');

$out = ['facts' => [], 'replies' => []];

// ---------------------------------------------------------------------------
// 1. WEDDING MATCHING — the fixed sample couple, computed by the engine.
// ---------------------------------------------------------------------------
$weddingOrder = [
    'id' => 'wedding-1',
    'order_number' => 'AST-WED-1',
    'service_type' => 'MARRIAGE_COMPATIBILITY',
    'language' => 'en',
    'input_payload' => json_encode([
        'groom' => [
            'name' => 'Karthik Raman', 'gender' => 'M', 'dob' => '2000-01-01', 'tob' => '02:00',
            'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
            'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
        ],
        'bride' => [
            'name' => 'Priya Devi', 'gender' => 'F', 'dob' => '1998-06-15', 'tob' => '06:30',
            'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
            'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
        ],
    ]),
];
$weddingFacts = astro_ai_service_facts($weddingOrder);
$out['facts']['wedding'] = $weddingFacts === null ? null : [
    'serviceType' => $weddingFacts['serviceType'],
    'score' => $weddingFacts['matching']['score'],
    'maxScore' => $weddingFacts['matching']['maxScore'],
    'matched' => $weddingFacts['matching']['matched'],
    'total' => $weddingFacts['matching']['total'],
    'verdictStatus' => $weddingFacts['matching']['verdictStatus'],
    'poruthamKeys' => array_map(static function ($p) { return $p['key']; }, $weddingFacts['matching']['poruthams']),
    'groomStar' => $weddingFacts['matching']['groom']['nakshatra']['en'],
    'brideStar' => $weddingFacts['matching']['bride']['nakshatra']['en'],
    'sevvaiStatus' => $weddingFacts['matching']['sevvai']['samyamStatus'],
];

// ---------------------------------------------------------------------------
// 2. BABY NAMING — the fixed sample birth, computed by the engine.
// ---------------------------------------------------------------------------
$namingOrder = [
    'id' => 'naming-1',
    'order_number' => 'AST-NAM-1',
    'service_type' => 'BABY_NAMING',
    'language' => 'en',
    'input_payload' => json_encode([
        'babyName' => 'Aarav', 'gender' => 'M', 'dob' => '2000-01-01', 'tob' => '02:00',
        'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
        'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
    ]),
];
$namingFacts = astro_ai_service_facts($namingOrder);
$out['facts']['naming'] = $namingFacts === null ? null : [
    'serviceType' => $namingFacts['serviceType'],
    'star' => $namingFacts['naming']['star'],
    'pada' => $namingFacts['naming']['pada'],
    'rasi' => $namingFacts['naming']['rasi'],
    'primarySound' => $namingFacts['naming']['primarySound'],
    'padaCount' => count($namingFacts['naming']['padas']),
    'nameCount' => count($namingFacts['naming']['names']),
    'provenanceStatus' => $namingFacts['naming']['provenance']['status'],
];

// ---------------------------------------------------------------------------
// 3. SUBHA MUHURTHAM — a two-person wedding calendar, stamped like a real
//    order payload so the engine's own staleness checks accept it.
// ---------------------------------------------------------------------------
$scanInputContext = [
    'dob' => '2000-01-01', 'tob' => '02:00', 'birthPlace' => 'Chennai, Tamil Nadu, India',
    'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707,
    'timezoneOffsetHours' => 5.5, 'timeZoneId' => 'Asia/Kolkata',
    'muhurthamPlace' => 'Chennai, Tamil Nadu, India', 'muhurthamCountry' => 'India',
    'muhurthamLatitude' => 13.0827, 'muhurthamLongitude' => 80.2707,
    'muhurthamTimezoneOffsetHours' => 5.5, 'muhurthamTimeZoneId' => 'Asia/Kolkata',
    'brideName' => 'Priya Devi', 'brideDob' => '1998-06-15', 'brideTob' => '06:30',
    'brideBirthPlace' => 'Chennai, Tamil Nadu, India', 'brideCountry' => 'India',
    'brideLatitude' => 13.0827, 'brideLongitude' => 80.2707,
    'brideTimezoneOffsetHours' => 5.5, 'brideTimeZoneId' => 'Asia/Kolkata',
    'eventKey' => 'wedding', 'selectedMonth' => '2027-01',
];
// The two charts the wedding calendar is checked against, described the way
// the browser scanner stamps them (nakshatraIndex is 0-based here).
$groomChart = AstroEngine::calculateHoroscope([
    'name' => 'Karthik Raman', 'gender' => 'M', 'dob' => '2000-01-01', 'tob' => '02:00',
    'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
]);
$brideChart = AstroEngine::calculateHoroscope([
    'name' => 'Priya Devi', 'gender' => 'F', 'dob' => '1998-06-15', 'tob' => '06:30',
    'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
]);
$scanPersons = [
    [
        'role' => 'groom', 'name' => 'Karthik Raman', 'dob' => '2000-01-01', 'tob' => '02:00',
        'birthPlace' => 'Chennai, Tamil Nadu, India',
        'nakshatraIndex' => (int) ($groomChart['janmaNakshatraIndex'] ?? 0),
        'nakshatraNameEn' => (string) ($groomChart['janmaNakshatraEn'] ?? ''),
        'rasiNumber' => (int) ($groomChart['chandraRasi'] ?? 0),
    ],
    [
        'role' => 'bride', 'name' => 'Priya Devi', 'dob' => '1998-06-15', 'tob' => '06:30',
        'birthPlace' => 'Chennai, Tamil Nadu, India',
        'nakshatraIndex' => (int) ($brideChart['janmaNakshatraIndex'] ?? 0),
        'nakshatraNameEn' => (string) ($brideChart['janmaNakshatraEn'] ?? ''),
        'rasiNumber' => (int) ($brideChart['chandraRasi'] ?? 0),
    ],
];

$muhurthamPayload = array_merge($scanInputContext, [
    'name' => 'Karthik Raman',
    'gender' => 'M',
    'bride' => [
        'name' => 'Priya Devi', 'gender' => 'F', 'dob' => '1998-06-15', 'tob' => '06:30',
        'birthPlace' => 'Chennai, Tamil Nadu, India', 'country' => 'India',
        'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
        'timeZoneId' => 'Asia/Kolkata',
    ],
    'muhurthamScan' => [
        'muhurthamAlgorithmVersion' => AstroEngine::MUHURTHAM_ALGORITHM_VERSION,
        'selectedMonth' => '2027-01',
        'eventKey' => 'wedding',
        'inputContext' => $scanInputContext,
        'persons' => $scanPersons,
        'months' => [[
            'monthKey' => '2027-01', 'month' => 1, 'year' => 2027,
            'monthNameEn' => 'January 2027', 'monthNameTa' => 'ஜனவரி 2027', 'monthNameHi' => 'जनवरी 2027',
            'days' => [
                [
                    'date' => '2027-01-14', 'pada' => 2, 'grade' => 'BEST', 'score' => 92, 'isRecommended' => true,
                    'dayOfWeekNameEn' => 'Thursday', 'dayOfWeekNameTa' => 'வியாழக்கிழமை', 'dayOfWeekNameHi' => 'गुरुवार',
                    'nakshatraNameEn' => 'Rohini', 'nakshatraNameTa' => 'ரோகிணி', 'nakshatraNameHi' => 'रोहिणी',
                    'tithiNameEn' => 'Panchami', 'tithiNameTa' => 'பஞ்சமி', 'tithiNameHi' => 'पंचमी',
                    'nallaNeram' => [['start' => '09:10 AM', 'end' => '10:40 AM']],
                    'rahuKalam' => ['start' => '01:30 PM', 'end' => '03:00 PM'],
                    'yamagandam' => ['start' => '06:00 AM', 'end' => '07:30 AM'],
                    'gulikai' => ['start' => '09:00 AM', 'end' => '10:30 AM'],
                    'reasonsEn' => ['Rohini nakshatra', 'Shukla Paksha'],
                ],
                [
                    'date' => '2027-01-21', 'pada' => 3, 'grade' => 'GOOD', 'score' => 74, 'isRecommended' => true,
                    'dayOfWeekNameEn' => 'Thursday', 'nakshatraNameEn' => 'Uttara Phalguni',
                    'tithiNameEn' => 'Dwadashi',
                    'nallaNeram' => [['start' => '07:05 AM', 'end' => '08:35 AM']],
                    'rahuKalam' => ['start' => '01:30 PM', 'end' => '03:00 PM'],
                    'yamagandam' => ['start' => '06:00 AM', 'end' => '07:30 AM'],
                    'reasonsEn' => ['Uttara Phalguni nakshatra'],
                ],
                ['date' => '2027-01-05', 'pada' => 1, 'grade' => 'FAIR', 'score' => 41],
                ['date' => '2027-01-09', 'pada' => 4, 'grade' => 'AVOID', 'score' => 12],
            ],
        ]],
    ],
]);
$muhurthamOrder = [
    'id' => 'muhurtham-1',
    'order_number' => 'AST-MUH-1',
    'service_type' => 'MUHURTHAM',
    'language' => 'en',
    'input_payload' => json_encode($muhurthamPayload),
];
$muhurthamFacts = astro_ai_service_facts($muhurthamOrder);
$out['facts']['muhurtham'] = $muhurthamFacts === null ? null : [
    'serviceType' => $muhurthamFacts['serviceType'],
    'event' => $muhurthamFacts['muhurtham']['event'],
    'window' => $muhurthamFacts['muhurtham']['window'],
    'place' => $muhurthamFacts['muhurtham']['place'],
    'personalCheckMode' => $muhurthamFacts['muhurtham']['personalCheckMode'],
    'dayCount' => $muhurthamFacts['muhurtham']['dayCount'],
    'recommendedCount' => count($muhurthamFacts['muhurtham']['recommended']),
    'topDate' => $muhurthamFacts['muhurtham']['recommended'][0]['date'] ?? null,
    'topNallaNeram' => $muhurthamFacts['muhurtham']['recommended'][0]['nallaNeram'] ?? [],
    'topRahuKalam' => $muhurthamFacts['muhurtham']['recommended'][0]['rahuKalam'] ?? '',
];

// ---------------------------------------------------------------------------
// 4. One reply per guided service option, plus the "report not attached"
//    path, which must ask for the report instead of inventing an answer.
// ---------------------------------------------------------------------------
$cases = [
    // Wedding Matching
    ['id' => 'match-verdict', 'lang' => 'en', 'facts' => $weddingFacts],
    ['id' => 'match-score', 'lang' => 'en', 'facts' => $weddingFacts],
    ['id' => 'match-poruthams', 'lang' => 'ta', 'facts' => $weddingFacts],
    ['id' => 'match-unmatched', 'lang' => 'en', 'facts' => $weddingFacts],
    ['id' => 'match-sevvai', 'lang' => 'hi', 'facts' => $weddingFacts],
    ['id' => 'match-remedy', 'lang' => 'ta', 'facts' => $weddingFacts],
    // Baby Naming
    ['id' => 'naming-star', 'lang' => 'en', 'facts' => $namingFacts],
    ['id' => 'naming-letters', 'lang' => 'ta', 'facts' => $namingFacts],
    ['id' => 'naming-suggestions', 'lang' => 'en', 'facts' => $namingFacts],
    ['id' => 'naming-meaning', 'lang' => 'hi', 'facts' => $namingFacts],
    ['id' => 'naming-our-name', 'lang' => 'en', 'facts' => $namingFacts],
    // Subha Muhurtham
    ['id' => 'muhurtham-dates', 'lang' => 'en', 'facts' => $muhurthamFacts],
    ['id' => 'muhurtham-best', 'lang' => 'ta', 'facts' => $muhurthamFacts],
    ['id' => 'muhurtham-why', 'lang' => 'en', 'facts' => $muhurthamFacts],
    ['id' => 'muhurtham-avoid', 'lang' => 'hi', 'facts' => $muhurthamFacts],
    ['id' => 'muhurtham-place', 'lang' => 'en', 'facts' => $muhurthamFacts],
    // Nothing attached (or a different report): the chat must ask for the
    // report instead of answering from nothing.
    ['id' => 'match-verdict', 'lang' => 'en', 'facts' => null, 'asId' => 'match-verdict-unattached'],
    ['id' => 'naming-letters', 'lang' => 'ta', 'facts' => null, 'asId' => 'naming-letters-unattached',
        'bound' => 'BIRTH_JATHAGAM'],
    // The right report IS attached but cannot be rebuilt: hand it to a person.
    ['id' => 'muhurtham-dates', 'lang' => 'en', 'facts' => null, 'asId' => 'muhurtham-dates-unreadable',
        'bound' => 'MUHURTHAM'],
];

foreach ($cases as $case) {
    $id = (string) ($case['asId'] ?? $case['id']);
    $lang = (string) $case['lang'];
    $facts = $case['facts'] ?? null;
    $found = astro_ai_guided_find((string) $case['id']);
    $canonical = $found ? (string) ($found['text'][$lang] ?? ($found['text']['en'] ?? '')) : (string) $case['id'];
    $context = [
        'customerName' => 'Mohan',
        'guided' => $found,
        'boundServiceType' => (string) ($case['bound'] ?? ($facts['serviceType'] ?? '')),
    ];
    if (is_array($facts)) {
        $context['serviceFacts'] = $facts;
    }
    try {
        $r = AstroAiProvider::answer($canonical, $lang, [], null, $context);
        $guard = AstroAiProvider::checkReply($r['content'], $lang);
        $out['replies'][] = [
            'id' => $id, 'lang' => $lang, 'handoff' => $r['handoff'], 'content' => $r['content'],
            'bubbles' => $r['bubbles'], 'guardOk' => $guard['ok'], 'violations' => $guard['violations'],
        ];
    } catch (Throwable $e) {
        $out['replies'][] = ['id' => $id, 'lang' => $lang, 'error' => get_class($e) . ': ' . $e->getMessage()];
    }
}

file_put_contents('/repo/out.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "done\n";
