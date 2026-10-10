<?php
/**
 * Probe: the AI Astrologer answers with NO API key, from our own sources only.
 *
 * Run with: node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/knowledge-base-mode.php --emit out.json
 *
 * 1. Without a key, answer() must return a real reply (mode knowledge-base),
 *    not throw, for general questions, refusals and greetings.
 * 2. With a real chart built by AstroEngine and mapped by the endpoint's own
 *    astro_ai_chart_facts(), the reply must carry the customer's report text.
 */
error_reporting(E_ALL);
file_put_contents('/repo/api/config.php', "<?php\n// probe stub\n");
putenv('AI_ASTROLOGER_API_KEY');
unset($_SERVER['AI_ASTROLOGER_API_KEY'], $_ENV['AI_ASTROLOGER_API_KEY']);

require_once '/repo/api/astrology/ai_astrologer_provider.php';
require_once '/repo/api/astrology/engine.php';

// astro_ai_chart_facts() lives in the endpoint, which dispatches on include.
// Load just that function (and the language helper it calls) from the source.
$endpoint = file_get_contents('/repo/api/ai_astrologer.php');
$start = strpos($endpoint, 'function astro_ai_chart_facts(');
$end = strpos($endpoint, '/* ================================================================== */', $start);
if (!function_exists('astro_normalize_report_language')) {
    function astro_normalize_report_language($l) { return in_array($l, ['en', 'ta', 'hi'], true) ? $l : 'ta'; }
}
eval(str_replace('__DIR__', "'/repo/api'", substr($endpoint, $start, $end - $start)));

$out = [
    'configured' => AstroAiProvider::isConfigured(),
    'mode' => AstroAiProvider::mode(),
    'canAnswer' => AstroAiProvider::canAnswer(),
    'diagBlocking' => AstroAiProvider::diagnostics(false)['blocking'],
    'general' => [],
    'personal' => [],
];

$ask = function (string $lang, string $q, ?array $chart) {
    try {
        $r = AstroAiProvider::answer($q, $lang, [], $chart, ['customerName' => 'Mohan']);
        $guard = AstroAiProvider::checkReply($r['content'], $lang);
        return ['lang' => $lang, 'q' => $q, 'mode' => $r['mode'] ?? '', 'areaId' => $r['areaId'],
            'handoff' => $r['handoff'], 'bubbles' => $r['bubbles'], 'guardOk' => $guard['ok'],
            'violations' => $guard['violations']];
    } catch (Throwable $e) {
        return ['lang' => $lang, 'q' => $q, 'error' => get_class($e) . ': ' . $e->getMessage()];
    }
};

$questions = [
    ['en', 'Hello'],
    ['en', 'When will I get a job?'],
    ['en', 'How is my marriage life?'],
    ['en', 'how much money will I earn this year'],
    ['en', 'I have chest pain, is it dangerous?'],
    ['en', 'Will I die soon?'],
    ['en', 'Should I buy shares in crypto?'],
    ['en', 'What remedy for Saturn?'],
    ['en', 'What is the best phone to buy?'],
    ['en', 'Can I settle abroad in Australia?'],
    ['ta', 'வணக்கம்'],
    ['ta', 'என் வேலை எப்போது கிடைக்கும்?'],
    ['ta', 'என் திருமணம் எப்போது நடக்கும்?'],
    ['ta', 'சனி பரிகாரம் என்ன?'],
    ['hi', 'मेरी शादी कब होगी?'],
    ['hi', 'मेरा करियर कैसा रहेगा?'],
];
foreach ($questions as [$lang, $q]) {
    $out['general'][] = $ask($lang, $q, null);
}

$horoscope = AstroEngine::calculateHoroscope([
    'name' => 'Probe Native', 'dob' => '1990-05-15', 'tob' => '06:30',
    'birthPlace' => 'Chennai', 'country' => 'India',
    'latitude' => 13.0827, 'longitude' => 80.2707, 'timezoneOffsetHours' => 5.5,
]);
$order = ['service_type' => 'BIRTH_JATHAGAM', 'language' => 'en', 'order_number' => 'AST-PROBE',
    'input_payload' => json_encode(['name' => 'Probe Native', 'dob' => '1990-05-15', 'tob' => '06:30',
        'birthPlace' => 'Chennai', 'country' => 'India', 'latitude' => 13.0827, 'longitude' => 80.2707,
        'timezoneOffsetHours' => 5.5])];
$facts = astro_ai_chart_facts($order);
$out['chartFacts'] = $facts ? array_diff_key($facts['chart'], ['summary' => 1, 'labels' => 1]) : null;
$out['chartHeader'] = $facts['header'] ?? null;
$out['summaryKeys'] = $facts ? array_keys($facts['chart']['summary']) : [];
$chart = $facts['chart'] ?? null;
foreach ([
    ['en', 'How is my career?'],
    ['en', 'When will I get married?'],
    ['en', 'What is my current dasha?'],
    ['en', 'How is my health?'],
    ['en', 'remedy for my dasha'],
    ['ta', 'என் தொழில் எப்படி இருக்கும்?'],
    ['ta', 'தற்போதைய தசை என்ன?'],
    ['hi', 'मेरा स्वास्थ्य कैसा रहेगा?'],
] as [$lang, $q]) {
    $out['personal'][] = $ask($lang, $q, $chart);
}
$out['careerSummaryEn'] = $chart['summary']['careerEn'] ?? '';

file_put_contents('/repo/out.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "done\n";
