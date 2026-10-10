<?php
/**
 * PHP-WASM probe for the current local-only astrologer reply path.
 *
 * Executes representative multilingual replies, source diagnostics, and a
 * chart rebuilt through the endpoint helper. It does not set/read credentials
 * or contact an external service.
 */
error_reporting(E_ALL);
file_put_contents('/repo/api/config.php', "<?php\n// probe stub\n");

require_once '/repo/api/astrology/ai_astrologer_provider.php';
require_once '/repo/api/astrology/engine.php';

// Load only astro_ai_chart_facts() from the endpoint; including the full endpoint
// would start its normal session/CORS/database dispatch in this isolated probe.
$endpoint = file_get_contents('/repo/api/ai_astrologer.php');
$start = strpos($endpoint, 'function astro_ai_chart_facts(');
$end = strpos($endpoint, '/* ================================================================== */', $start);
if (!function_exists('astro_normalize_report_language')) {
    function astro_normalize_report_language($l) { return in_array($l, ['en', 'ta', 'hi'], true) ? $l : 'ta'; }
}
eval(str_replace('__DIR__', "'/repo/api'", substr($endpoint, $start, $end - $start)));

$diagnostics = AstroAiProvider::diagnostics(false);
$liveDiagnostics = AstroAiProvider::diagnostics(true);
$out = [
    'configured' => AstroAiProvider::isConfigured(),
    'mode' => AstroAiProvider::mode(),
    'canAnswer' => AstroAiProvider::canAnswer(),
    'diagBlocking' => $diagnostics['blocking'],
    'sourceRegistry' => $diagnostics['sourceRegistry'],
    'pingAttempted' => $liveDiagnostics['ping']['attempted'],
    'guardChecks' => [],
    'general' => [],
    'personal' => [],
];

try {
    AstroAiProvider::complete('', [], 'probe');
    $out['externalCompletionError'] = '';
} catch (Throwable $e) {
    $out['externalCompletionError'] = $e->getMessage();
}

$guardrails = json_decode((string) file_get_contents('/repo/knowledge/ai-astrologer/rules/guardrails.json'), true);
foreach (['en', 'ta', 'hi'] as $guardLanguage) {
    $bannedPhrase = $guardrails['predictions']['noGuarantees']['banned'][$guardLanguage][0] ?? '';
    $out['guardChecks'][$guardLanguage] = AstroAiProvider::checkReply((string) $bannedPhrase, $guardLanguage);
}

$ask = function (string $lang, string $q, ?array $chart) {
    try {
        $r = AstroAiProvider::answer($q, $lang, [], $chart, ['customerName' => 'Mohan']);
        $guard = AstroAiProvider::checkReply($r['content'], $lang);
        return ['lang' => $lang, 'q' => $q, 'mode' => $r['mode'] ?? '', 'areaId' => $r['areaId'],
            'handoff' => $r['handoff'], 'content' => $r['content'], 'bubbles' => $r['bubbles'],
            'sourceLine' => $r['sourceLine'] ?? '', 'guardOk' => $guard['ok'], 'violations' => $guard['violations']];
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
