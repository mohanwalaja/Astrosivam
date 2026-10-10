<?php
/**
 * PHP-WASM probe for GUIDED MODE: customers pick a curated option id and the
 * server routes it to a fixed answer path (life-area card, dosha, remedy,
 * order fact, or complaint acknowledgement) without re-matching wording.
 *
 * Exercises the real endpoint helpers (guided menu + chart facts) and the
 * real local answer builder against the committed knowledge files. No
 * external service is contacted.
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
// astro_ai_chart_facts() now reads the shared, memoised rebuild helper, so
// that helper has to be in scope too.
$evalFromEndpoint('function astro_ai_report_result(', 'function astro_ai_chart_facts(');
$evalFromEndpoint('function astro_ai_chart_facts(', '/* ================================================================== */');

$out = ['menu' => null, 'gatedMenu' => null, 'replies' => []];

// 1. The guided menu resolves in all three languages. With no delivered
// service report on the account, the three service chapters stay hidden.
foreach (['en', 'ta', 'hi'] as $menuLang) {
    $menu = astro_ai_guided_menu($menuLang);
    $out['menu'][$menuLang] = [
        'categories' => count($menu),
        'options' => array_sum(array_map(function ($c) { return count($c['questions'] ?? []); }, $menu)),
        'firstTopic' => $menu[0]['id'] ?? null,
        'firstOption' => $menu[0]['questions'][0]['text'] ?? null,
        'ids' => array_map(function ($c) { return $c['id']; }, $menu),
    ];
}

// The service chapters appear only for the reports the account holds, and an
// administrator (who may test any path) always sees the whole menu.
$count = function (array $menu): array {
    return [
        'categories' => count($menu),
        'options' => array_sum(array_map(function ($c) { return count($c['questions'] ?? []); }, $menu)),
        'ids' => array_map(function ($c) { return $c['id']; }, $menu),
    ];
};
$out['gatedMenu'] = [
    'none' => $count(astro_ai_guided_menu('en', [], false)),
    'weddingAndMuhurtham' => $count(astro_ai_guided_menu('en', ['MARRIAGE_COMPATIBILITY', 'MUHURTHAM'], false)),
    'allThree' => $count(astro_ai_guided_menu('en', ['MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'], false)),
    'admin' => $count(astro_ai_guided_menu('en', [], true)),
];
// Every option id resolves back to a routed option server-side.
$out['unknownQuestionId'] = astro_ai_guided_find('no-such-option');
$out['knownQuestionId'] = (function () {
    $found = astro_ai_guided_find('career-change');
    return $found ? ['kind' => $found['kind'] ?? null, 'area' => $found['area'] ?? null, 'category' => $found['_category'] ?? null] : null;
})();

// 2. A real chart rebuilt from saved order inputs (dosha block included).
$input = [
    'name' => 'Probe Native', 'dob' => '1990-05-15', 'tob' => '06:30',
    'birthPlace' => 'Chennai', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
];
$order = [
    'service_type' => 'BIRTH_JATHAGAM', 'language' => 'en', 'order_number' => 'AST-PROBE',
    'input_payload' => json_encode($input),
];
$facts = astro_ai_chart_facts($order);
$chart = $facts['chart'] ?? null;
$out['doshaKeys'] = $chart ? array_map(function ($d) { return $d['key']; }, $chart['doshaDetails'] ?? []) : null;

$orderDetails = 'Order number: AST-PROBE | Service: BIRTH_JATHAGAM | Amount paid: FJD 50 | '
    . 'Payment: confirmed | Placed on: 2026-10-01 | Report emailed on: 2026-10-02 | Order status: COMPLETED | '
    . 'Birth details used: Name: Probe Native, Date of birth: 1990-05-15, Time of birth: 06:30, Birth place: Chennai';

// 3. One reply per guided kind, plus a forced Tamil area option.
$cases = [
    ['id' => 'career-change', 'lang' => 'en', 'guided' => ['kind' => 'area', 'area' => 'career', 'timing' => true]],
    ['id' => 'marriage-timing', 'lang' => 'ta', 'guided' => ['kind' => 'area', 'area' => 'marriage', 'timing' => true]],
    ['id' => 'dosha-all', 'lang' => 'en', 'guided' => ['kind' => 'dosha', 'dosha' => 'all']],
    ['id' => 'dosha-kuja', 'lang' => 'hi', 'guided' => ['kind' => 'dosha', 'dosha' => 'kuja']],
    ['id' => 'remedy-personal', 'lang' => 'en', 'guided' => ['kind' => 'remedy', 'planet' => null]],
    ['id' => 'remedy-sani', 'lang' => 'ta', 'guided' => ['kind' => 'remedy', 'planet' => 'Sani']],
    ['id' => 'remedy-temple', 'lang' => 'en', 'guided' => ['kind' => 'remedy', 'planet' => null, 'focus' => 'temple']],
    ['id' => 'order-status', 'lang' => 'en', 'guided' => ['kind' => 'order', 'topic' => 'status']],
    ['id' => 'order-details', 'lang' => 'ta', 'guided' => ['kind' => 'order', 'topic' => 'details']],
    ['id' => 'order-payment', 'lang' => 'hi', 'guided' => ['kind' => 'order', 'topic' => 'payment']],
    ['id' => 'order-correction', 'lang' => 'en', 'guided' => ['kind' => 'order', 'topic' => 'correction', 'escalate' => true]],
    ['id' => 'complaint-not-received', 'lang' => 'en', 'guided' => ['kind' => 'complaint', 'topic' => 'not-received', 'escalate' => true]],
    ['id' => 'complaint-talk-astrologer', 'lang' => 'hi', 'guided' => ['kind' => 'complaint', 'topic' => 'talk-astrologer', 'escalate' => true]],
];
foreach ($cases as $case) {
    $found = astro_ai_guided_find($case['id']);
    $canonical = $found ? (string) ($found['text'][$case['lang']] ?? ($found['text']['en'] ?? '')) : $case['id'];
    try {
        $r = AstroAiProvider::answer($canonical, $case['lang'], [], $chart, [
            'customerName' => 'Mohan',
            'orderTitle' => 'BIRTH_JATHAGAM',
            'orderDetails' => $orderDetails,
            'guided' => $case['guided'],
        ]);
        $guard = AstroAiProvider::checkReply($r['content'], $case['lang']);
        $out['replies'][] = ['id' => $case['id'], 'lang' => $case['lang'], 'mode' => $r['mode'] ?? '',
            'areaId' => $r['areaId'], 'handoff' => $r['handoff'], 'content' => $r['content'],
            'bubbles' => $r['bubbles'], 'sourceLine' => $r['sourceLine'] ?? '',
            'guardOk' => $guard['ok'], 'violations' => $guard['violations']];
    } catch (Throwable $e) {
        $out['replies'][] = ['id' => $case['id'], 'lang' => $case['lang'], 'error' => get_class($e) . ': ' . $e->getMessage()];
    }
}

file_put_contents('/repo/out.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "done\n";
