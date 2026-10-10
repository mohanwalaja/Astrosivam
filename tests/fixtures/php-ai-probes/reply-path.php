<?php
/**
 * Probe: does the AI Astrologer's real reply path build an answer?
 *
 * Run with: node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/reply-path.php
 *
 * api/config.php is replaced in the virtual filesystem by a stub before the
 * provider is loaded: the real one starts a session and emits CORS headers,
 * which are meaningless here and would only add noise. The provider itself,
 * the knowledge base and every guardrail it enforces are the committed files.
 */

error_reporting(E_ALL);

file_put_contents('/repo/api/config.php', "<?php\n// probe stub: the real config.php is CORS/session side effects only.\n");
require_once '/repo/api/astrology/ai_astrologer_provider.php';

$line = str_repeat('-', 72);
echo $line, "\n1. CONFIGURATION\n", $line, "\n";
$cfg = AstroAiProvider::config();
echo 'baseUrl          : ', $cfg['baseUrl'], "\n";
echo 'model            : ', $cfg['model'], "\n";
echo 'apiKey present   : ', $cfg['apiKey'] !== '' ? 'yes' : 'NO', "\n";
echo 'isConfigured()   : ', AstroAiProvider::isConfigured() ? 'true' : 'false', "\n";
echo 'curl extension   : ', function_exists('curl_init') ? 'loaded' : 'NOT LOADED', "\n";

echo "\n", $line, "\n2. KNOWLEDGE BASE (read from /repo/knowledge/ai-astrologer)\n", $line, "\n";
foreach ([
    'prompt/system-prompt.md',
    'rules/guardrails.json',
    'rules/life-areas.json',
    'rules/remedies.json',
    'sources.json',
] as $rel) {
    $path = '/repo/knowledge/ai-astrologer/' . $rel;
    printf("%-26s %s\n", $rel, is_file($path) ? 'present (' . filesize($path) . ' bytes)' : 'MISSING');
}

try {
    $prompt = AstroAiProvider::systemPrompt();
    echo 'systemPrompt()      : OK, ' . strlen($prompt) . " bytes\n";
} catch (Throwable $e) {
    echo 'systemPrompt()      : THREW - ' . get_class($e) . ': ' . $e->getMessage() . "\n";
}

echo "\n", $line, "\n3. RETRIEVAL, per question\n", $line, "\n";
$questions = [
    ['ta', 'என் வேலை எப்போது கிடைக்கும்?'],
    ['ta', 'என் திருமணம் எப்போது நடக்கும்?'],
    ['en', 'when will i get a job?'],
    ['en', 'i have chest pain, is it dangerous?'],
    ['en', 'what is the best phone to buy?'],
];
foreach ($questions as [$lang, $q]) {
    try {
        $r = AstroAiProvider::retrieve($q, $lang, null);
        printf(
            "[%s] %-34s area=%-14s rules=%d refusal=%s source='%s'\n",
            $lang,
            mb_substr($q, 0, 32),
            (string) $r['areaId'],
            count($r['rules']),
            $r['refusal'] ? 'YES' : 'no',
            (string) $r['sourceLine']
        );
    } catch (Throwable $e) {
        printf("[%s] %-34s THREW - %s: %s\n", $lang, mb_substr($q, 0, 32), get_class($e), $e->getMessage());
    }
}

echo "\n", $line, "\n4. THE FULL answer() PATH\n", $line, "\n";
// A non-empty key so isConfigured() passes and the code reaches the model call.
// What happens at the model call is exactly what the customer experiences.
putenv('AI_ASTROLOGER_API_KEY=sk-probe-not-a-real-key');
echo 'isConfigured() with a key set: ', AstroAiProvider::isConfigured() ? 'true' : 'false', "\n";

$context = [
    'customerName' => 'Mohan',
    'orderTitle' => 'BIRTH_JATHAGAM',
    'orderDetails' => 'Order number: AST-1 | Service: BIRTH_JATHAGAM',
    'chartHeader' => 'Your chart: Kanni / Rishabha / Rohini',
    'dashaEndDate' => '2027-03-01',
    'chatHistory' => '(this is the first message)',
];

foreach ([['ta', 'என் வேலை எப்போது கிடைக்கும்?'], ['en', 'when will i get a job?']] as [$lang, $q]) {
    $started = microtime(true);
    try {
        $reply = AstroAiProvider::answer($q, $lang, [], null, $context);
        printf(
            "[%s] OK in %dms - %d bubble(s), area=%s\n      first bubble: %s\n",
            $lang,
            (int) round((microtime(true) - $started) * 1000),
            count($reply['bubbles']),
            (string) $reply['areaId'],
            mb_substr($reply['bubbles'][0] ?? '', 0, 90)
        );
    } catch (Throwable $e) {
        printf(
            "[%s] THREW in %dms - %s: %s\n      (ai_astrologer.php turns this into HTTP 503 GENERATION_FAILED\n"
            . "       and the customer sees: \"Please give me a moment, I am checking again.\")\n",
            $lang,
            (int) round((microtime(true) - $started) * 1000),
            get_class($e),
            $e->getMessage()
        );
    }
}

echo "\n", $line, "\n5. CONFIG RESOLUTION AND DIAGNOSTICS\n", $line, "\n";
// No key anywhere: this is the state that made every question fail with the
// same generic retry text and no explanation on screen.
putenv('AI_ASTROLOGER_API_KEY=');
AstroAiProvider::configure([]);
$diag = AstroAiProvider::diagnostics(false);
printf("no key at all        : configured=%s blocking=%s\n", $diag['configured'] ? 'true' : 'false', implode(',', $diag['blocking']) ?: '-');
foreach ($diag['checks'] as $c) {
    printf("   %-22s %-5s %s\n", $c['id'], $c['ok'] ? 'ok' : 'FAIL', mb_substr($c['detail'], 0, 84));
}

// A key copied from .env.example must be treated as unset, not as a key to try.
putenv('AI_ASTROLOGER_API_KEY=your_api_key_here');
printf("placeholder key      : configured=%s source=%s\n",
    AstroAiProvider::isConfigured() ? 'true' : 'false',
    AstroAiProvider::configSource()['source']);

// A key saved in the Admin Portal, with nothing in the environment.
putenv('AI_ASTROLOGER_API_KEY=');
AstroAiProvider::configure(['apiKey' => 'sk-admin-saved-9f2c', 'model' => 'llama-3.1-70b-versatile']);
$cfg = AstroAiProvider::config();
printf("admin-saved key      : configured=%s source=%s hint=%s model=%s\n",
    AstroAiProvider::isConfigured() ? 'true' : 'false',
    AstroAiProvider::configSource()['source'],
    AstroAiProvider::configSource()['keyHint'],
    $cfg['model']);

// A key in $_SERVER only - what cPanel's SetEnv produces under LiteSpeed/PHP-FPM.
putenv('AI_ASTROLOGER_API_KEY=');
AstroAiProvider::configure([]);
$_SERVER['AI_ASTROLOGER_API_KEY'] = 'sk-server-superglobal-4417';
printf("key in \$_SERVER only : configured=%s source=%s\n",
    AstroAiProvider::isConfigured() ? 'true' : 'false',
    AstroAiProvider::configSource()['source']);
unset($_SERVER['AI_ASTROLOGER_API_KEY']);

echo "\n", $line, "\n6. OUTPUT GUARD AND BUBBLE SPLITTER\n", $line, "\n";
foreach ([
    ['en', 'Your job will definitely come in March. You will certainly succeed.'],
    ['en', 'You have chest pain. Rest and drink water.'],
    ['en', 'You have chest pain. Please see a qualified doctor about it.'],
    ['en', 'Buy now, discount available on our report!'],
] as [$lang, $draft]) {
    $check = AstroAiProvider::checkReply($draft, $lang);
    printf("%-6s ok=%-5s %s\n", $lang, $check['ok'] ? 'true' : 'false', implode('; ', $check['violations']) ?: '-');
}
$bubbles = AstroAiProvider::toBubbles("First part of the answer.\n---BUBBLE---\nSecond part, longer than forty characters so it stays its own bubble.");
echo 'toBubbles() on a ---BUBBLE--- reply: ' . count($bubbles) . " bubble(s)\n";

echo "\n", $line, "\nDONE\n", $line, "\n";

// Machine-readable summary, so tests/ai-astrologer-php-runtime.test.ts can
// assert on results instead of scraping this human-readable output.
$out = [
    'configuredWithoutKey' => false,
    'blockingWithoutKey' => [],
    'systemPromptBytes' => 0,
    'placeholderSource' => '',
    'adminKeyConfigured' => false,
    'adminKeySource' => '',
    'adminKeyModel' => '',
    'serverGlobalConfigured' => false,
    'serverGlobalSource' => '',
    'answerError' => '',
    'answerErrorClass' => '',
    'guardViolations' => [],
    'bubbleCount' => 0,
];
putenv('AI_ASTROLOGER_API_KEY=');
AstroAiProvider::configure([]);
$d = AstroAiProvider::diagnostics(false);
$out['configuredWithoutKey'] = $d['configured'];
$out['blockingWithoutKey'] = $d['blocking'];
try {
    $out['systemPromptBytes'] = strlen(AstroAiProvider::systemPrompt());
} catch (Throwable $e) {
    $out['systemPromptBytes'] = -1;
}
putenv('AI_ASTROLOGER_API_KEY=your_api_key_here');
$out['placeholderSource'] = AstroAiProvider::configSource()['source'];
putenv('AI_ASTROLOGER_API_KEY=');
AstroAiProvider::configure(['apiKey' => 'sk-admin-saved-9f2c', 'model' => 'llama-3.1-70b-versatile']);
$out['adminKeyConfigured'] = AstroAiProvider::isConfigured();
$out['adminKeySource'] = AstroAiProvider::configSource()['source'];
$out['adminKeyModel'] = AstroAiProvider::config()['model'];
AstroAiProvider::configure([]);
$_SERVER['AI_ASTROLOGER_API_KEY'] = 'sk-server-superglobal-4417';
$out['serverGlobalConfigured'] = AstroAiProvider::isConfigured();
$out['serverGlobalSource'] = AstroAiProvider::configSource()['source'];
unset($_SERVER['AI_ASTROLOGER_API_KEY']);
putenv('AI_ASTROLOGER_API_KEY=sk-probe-not-a-real-key');
try {
    AstroAiProvider::answer('when will i get a job?', 'en', [], null, ['customerName' => 'Mohan']);
    $out['answerError'] = '';
    $out['answerErrorClass'] = '';
} catch (Throwable $e) {
    $out['answerErrorClass'] = get_class($e);
    $out['answerError'] = $e->getMessage();
}
$out['guardViolations'] = AstroAiProvider::checkReply('Your job will definitely come in March.', 'en')['violations'];
$out['bubbleCount'] = count(AstroAiProvider::toBubbles("First part.\n---BUBBLE---\nSecond part, long enough to stay its own bubble."));

file_put_contents('/repo/out.json', json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "\nwrote /repo/out.json\n";
