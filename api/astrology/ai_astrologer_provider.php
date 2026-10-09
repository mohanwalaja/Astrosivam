<?php
/**
 * ASTRO SIVAM AI Astrologer — Part 5: prompt assembly, model call and output guard.
 * -------------------------------------------------------------------------------
 * THE ONLY PLACE A MODEL IS CALLED. The API key lives in an environment
 * variable on the server and never reaches the browser.
 *
 * The reply path is: assemble prompt -> call model -> parse bubbles -> GUARD ->
 * persist. The guard runs before the reply is returned, so a draft that breaks a
 * rule is regenerated once and then replaced by a safe fallback. The customer
 * never sees an unguarded draft.
 *
 * The provider is OpenAI-compatible (chat/completions), so the same code works
 * against OpenAI, Groq, Together, OpenRouter or a self-hosted endpoint by
 * changing AI_ASTROLOGER_BASE_URL and AI_ASTROLOGER_MODEL.
 *
 * VERIFICATION STATUS: PHP cannot be installed in the build sandbox (the Debian
 * apt repositories are unreachable; only github.com, registry.npmjs.org and
 * pypi.org are allowed), so this file has NOT been executed. The guard rules it
 * enforces are the same ones checked by tests/ai-astrologer-knowledge.test.ts
 * against rules/guardrails.json. Smoke-test on the server before relying on it.
 */

require_once __DIR__ . '/config.php';

class AstroAiProvider
{
    const PROMPT_PATH = '/knowledge/ai-astrologer/prompt/system-prompt.md';
    const GUARDRAILS_PATH = '/knowledge/ai-astrologer/rules/guardrails.json';
    const LIFE_AREAS_PATH = '/knowledge/ai-astrologer/rules/life-areas.json';
    const REMEDIES_PATH = '/knowledge/ai-astrologer/rules/remedies.json';

    /** One retry on a guard failure, then a safe fallback. Never a third try. */
    const MAX_GENERATION_ATTEMPTS = 2;
    const CURL_TIMEOUT_SECONDS = 45;

    private static $promptCache = null;
    private static $kbCache = [];

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------

    public static function config(): array
    {
        return [
            'baseUrl' => rtrim((string) (getenv('AI_ASTROLOGER_BASE_URL') ?: 'https://api.openai.com/v1'), '/'),
            'apiKey' => (string) (getenv('AI_ASTROLOGER_API_KEY') ?: ''),
            'model' => (string) (getenv('AI_ASTROLOGER_MODEL') ?: 'gpt-4o-mini'),
            'maxTokens' => (int) (getenv('AI_ASTROLOGER_MAX_TOKENS') ?: 900),
            'temperature' => 0.4,
        ];
    }

    /** True when the endpoint can call a model at all. Checked before promising an answer. */
    public static function isConfigured(): bool
    {
        $c = self::config();
        return $c['apiKey'] !== '' && function_exists('curl_init');
    }

    private static function kbPath(string $rel): string
    {
        return dirname(__DIR__) . $rel;
    }

    private static function kb(string $rel): array
    {
        if (!isset(self::$kbCache[$rel])) {
            self::$kbCache[$rel] = json_decode((string) file_get_contents(self::kbPath($rel)), true) ?: [];
        }
        return self::$kbCache[$rel];
    }

    // ------------------------------------------------------------------
    // The system prompt
    // ------------------------------------------------------------------

    /**
     * The system prompt, extracted from the fenced block in the markdown file.
     * Keeping it in the repo means every change to what the agent may say is a
     * reviewed diff, not a database row an admin panel can silently rewrite.
     */
    public static function systemPrompt(): string
    {
        if (self::$promptCache !== null) {
            return self::$promptCache;
        }
        $md = (string) file_get_contents(self::kbPath(self::PROMPT_PATH));
        if ($md === '') {
            throw new RuntimeException('The AI Astrologer system prompt could not be read.');
        }
        // The prompt is the first ```text ... ``` block in the document.
        if (preg_match('/```text\s*\n(.*?)\n```/s', $md, $m)) {
            self::$promptCache = trim($m[1]);
            return self::$promptCache;
        }
        throw new RuntimeException('The system prompt file has no ```text block to extract.');
    }

    /**
     * Fills the {{PLACEHOLDERS}}. Anything left unfilled is replaced with an
     * empty string rather than shipped to the model, because a literal
     * "{{CHART_HEADER}}" in a prompt invites the model to talk about it.
     */
    public static function fillPrompt(string $prompt, array $values): string
    {
        $out = $prompt;
        foreach ($values as $key => $value) {
            $out = str_replace('{{' . strtoupper($key) . '}}', (string) $value, $out);
        }
        return (string) preg_replace('/\{\{[A-Z0-9_]+\}\}/', '', $out);
    }

    // ------------------------------------------------------------------
    // Retrieval context
    // ------------------------------------------------------------------

    /**
     * Picks the rules that apply, in the customer's language. This is the PHP
     * counterpart of matchAreas() + evaluateCondition() in
     * src/services/aiAstrologerRetrieval.ts; the condition vocabulary is
     * deliberately limited to what the rule base actually uses.
     *
     * @return array{areaId:?string, cardTitle:?string, rules:array, sourceLine:string, refusal:?array}
     */
    public static function retrieve(string $question, string $language, ?array $chart): array
    {
        $kb = self::kb(self::LIFE_AREAS_PATH);
        $q = mb_strtolower(trim($question), 'UTF-8');

        // Refusal routes fire before any area answer.
        foreach (($kb['openEnded']['routes'] ?? []) as $route) {
            foreach (explode(',', (string) $route['match']) as $token) {
                $token = mb_strtolower(trim($token), 'UTF-8');
                if ($token !== '' && mb_strpos($q, $token, 0, 'UTF-8') !== false) {
                    return ['areaId' => null, 'cardTitle' => null, 'rules' => [],
                        'sourceLine' => '', 'refusal' => ['route' => $route['route'], 'text' => $route['text']]];
                }
            }
        }

        $ranked = [];
        $fallback = [];
        foreach (($kb['areas'] ?? []) as $area) {
            $phrases = array_merge(
                $area['customerPhrases'][$language] ?? [],
                $area['customerPhrases']['en'] ?? []
            );
            $score = 0;
            foreach ($phrases as $p) {
                $needle = mb_strtolower(trim((string) $p), 'UTF-8');
                if ($needle === '') {
                    continue;
                }
                if (mb_strpos($q, $needle, 0, 'UTF-8') !== false) {
                    $score += mb_strlen($needle, 'UTF-8');
                }
            }
            if ($score <= 0) {
                continue;
            }
            // Card 8 has no house anchor and its rules are 'always' rules, so its
            // generic phrases would otherwise win on length alone.
            if (empty($area['houseAnchors'])) {
                $fallback[$area['id']] = ['area' => $area, 'score' => $score];
            } else {
                $ranked[$area['id']] = ['area' => $area, 'score' => $score];
            }
        }
        arsort($ranked);
        arsort($fallback);
        $pool = $ranked ?: $fallback;
        if (empty($pool)) {
            return ['areaId' => null, 'cardTitle' => null, 'rules' => [], 'sourceLine' => '', 'refusal' => null];
        }

        $area = reset($pool)['area'];
        $rules = [];
        $sources = [];
        foreach (($area['rules'] ?? []) as $rule) {
            if (!self::evaluateCondition($rule['condition'] ?? [], $chart, $question)) {
                continue;
            }
            $meaning = $rule['meaning'][$language] ?? ($rule['meaning']['en'] ?? '');
            $labels = [];
            foreach (($rule['source'] ?? []) as $s) {
                if (($s['level'] ?? 'book') === 'suppressed') {
                    continue;
                }
                $labels[] = self::formatCitation($s, $language);
            }
            $rules[] = [
                'id' => $rule['id'],
                'meaning' => $meaning,
                'easing' => $rule['easing'] ?? '',
                'practical' => $rule['practical'] ?? [],
                'sources' => $labels,
            ];
            $sources = array_merge($sources, $labels);
        }

        $unique = array_values(array_unique($sources));
        $sourceLine = $unique ? 'Source: ' . implode(' · ', array_slice($unique, 0, 3)) : '';

        return [
            'areaId' => $area['id'],
            'cardTitle' => $area['cardTitle'][$language] ?? ($area['cardTitle']['en'] ?? null),
            'rules' => $rules,
            'sourceLine' => $sourceLine,
            'refusal' => null,
        ];
    }

    /** Mirrors evaluateCondition() in the TS spec. Unknown types return false. */
    public static function evaluateCondition(array $cond, ?array $chart, string $question): bool
    {
        if ($chart === null) {
            // Without a chart only the 'always' rules and quoted-phrase rules hold,
            // so a missing chart can never invent a finding.
            return ($cond['type'] ?? '') === 'always'
                || (($cond['type'] ?? '') === 'customerSays' && self::phraseHit($cond, $question));
        }

        $dusthana = [6, 8, 12];
        $good = [1, 4, 5, 7, 9, 10, 11];
        $lordPlace = function (int $house) use ($chart, $dusthana, $good): ?string {
            $in = $chart['lordHouse'][$house] ?? null;
            if ($in === null) {
                return null;
            }
            if (in_array((int) $in, $dusthana, true)) {
                return 'weak';
            }
            return in_array((int) $in, $good, true) ? 'strong' : 'neutral';
        };

        switch ($cond['type'] ?? '') {
            case 'always':
                return true;
            case 'dignity':
                return ($chart['dignity'][$cond['planet'] ?? ''] ?? 'neutral') === ($cond['state'] ?? '');
            case 'lordOf':
                $place = $lordPlace((int) ($cond['house'] ?? 0));
                if ($place === null) {
                    return false;
                }
                if (!empty($cond['placement']) && $place !== $cond['placement']) {
                    return false;
                }
                if (!empty($cond['placementInHouses'])
                    && !in_array((int) ($chart['lordHouse'][$cond['house']] ?? 0), $cond['placementInHouses'], true)) {
                    return false;
                }
                return true;
            case 'anyLordWeak':
                foreach (($cond['houses'] ?? []) as $h) {
                    if ($lordPlace((int) $h) === 'weak') {
                        return true;
                    }
                }
                return false;
            case 'conjunction':
                foreach (($cond['planets'] ?? []) as $p) {
                    $sh = $chart['planetHouse'][$p] ?? null;
                    if ($sh === null) {
                        continue;
                    }
                    foreach (($cond['with'] ?? []) as $other) {
                        if (($chart['planetHouse'][$other] ?? null) === $sh) {
                            return true;
                        }
                    }
                }
                return false;
            case 'planetInHouse':
                $h = $chart['planetHouse'][$cond['planet'] ?? ''] ?? null;
                return $h !== null && in_array((int) $h, $cond['houses'] ?? [], true);
            case 'beneficInHouse':
                foreach (($chart['planetHouse'] ?? []) as $planet => $house) {
                    if ((int) $house === (int) ($cond['house'] ?? -1)
                        && in_array($planet, ['Guru', 'Sukra', 'Budha', 'Chandra'], true)) {
                        return true;
                    }
                }
                return false;
            case 'parivartana':
                [$a, $b] = array_pad($cond['houses'] ?? [], 2, 0);
                return ($chart['lordHouse'][$a] ?? null) === $b
                    && ($chart['lordHouse'][$b] ?? null) === $a;
            case 'transit':
                return in_array((int) ($chart['saniTransitFromMoon'] ?? 0), $cond['fromMoon'] ?? [], true);
            case 'dosha':
                return ($cond['present'] ?? false) === true
                    && in_array($cond['name'] ?? '', $chart['doshas'] ?? [], true);
            case 'dashaOf':
                $set = $cond['planets'] ?? [];
                return in_array($chart['currentDasha'] ?? '', $set, true)
                    || in_array($chart['currentAntardasha'] ?? '', $set, true);
            case 'anyOf':
                foreach (($cond['conditions'] ?? []) as $c) {
                    if (self::evaluateCondition($c, $chart, $question)) {
                        return true;
                    }
                }
                return false;
            case 'allOf':
                foreach (($cond['conditions'] ?? []) as $c) {
                    if (!self::evaluateCondition($c, $chart, $question)) {
                        return false;
                    }
                }
                return true;
            case 'customerSays':
                return self::phraseHit($cond, $question);
            default:
                return false;
        }
    }

    private static function phraseHit(array $cond, string $question): bool
    {
        $q = mb_strtolower($question, 'UTF-8');
        foreach (($cond['phrases'] ?? []) as $p) {
            if (mb_strpos($q, mb_strtolower(trim((string) $p), 'UTF-8'), 0, 'UTF-8') !== false) {
                return true;
            }
        }
        return false;
    }

    public static function formatCitation(array $src, string $language): string
    {
        $id = (string) ($src['id'] ?? '');
        $level = $src['level'] ?? 'book';
        if ($level === 'passage') {
            $word = $language === 'ta' ? 'பாடல்' : ($language === 'hi' ? 'श्लोक' : 'verse');
            $verse = isset($src['verse']) ? ", {$word} {$src['verse']}" : '';
            $page = !empty($src['page']) ? ', p.' . $src['page'] : '';
            return $id . $verse . $page;
        }
        if ($level === 'chapter') {
            return $id . (!empty($src['page']) ? ', p.' . $src['page'] : '');
        }
        return $id;
    }

    // ------------------------------------------------------------------
    // The output guard
    // ------------------------------------------------------------------

    /**
     * Scans a draft reply for banned phrasing. PHP counterpart of checkReply()
     * in the TS spec. Returns the offending tokens so a failure is debuggable.
     *
     * @return array{ok:bool, violations:array}
     */
    public static function checkReply(string $reply, string $language): array
    {
        $g = self::kb(self::GUARDRAILS_PATH);
        $violations = [];
        $lower = mb_strtolower($reply, 'UTF-8');

        $lists = array_merge(
            $g['predictions']['noGuarantees']['banned'][$language] ?? [],
            $g['predictions']['noGuarantees']['banned']['en'] ?? [],
            $g['predictions']['noFrighteningLanguage']['banned'] ?? []
        );
        foreach ($lists as $banned) {
            $banned = trim((string) $banned);
            if ($banned !== '' && mb_strpos($lower, mb_strtolower($banned, 'UTF-8'), 0, 'UTF-8') !== false) {
                $violations[] = 'banned phrase: "' . $banned . '"';
            }
        }

        // A reply that talks about the body must point at a qualified doctor.
        $medical = ['health', 'illness', 'pain', 'disease', 'body', 'உடல்', 'நோய்', 'व्याधि', 'दर्द', 'स्वास्थ्य'];
        $talksBody = false;
        foreach ($medical as $w) {
            if (mb_strpos($lower, mb_strtolower($w, 'UTF-8'), 0, 'UTF-8') !== false) {
                $talksBody = true;
                break;
            }
        }
        $pointsToDoctor = preg_match(
            '/doctor|medical|hospital|qualified|மருத்துவர்|மருத்துவமனை|डॉक्टर|चिकित्स/iu',
            $reply
        ) === 1;
        if ($talksBody && !$pointsToDoctor) {
            $violations[] = 'health topic without advising a qualified doctor';
        }

        // No sales talk inside an answer.
        if (preg_match('/\b(discount|offer price|only today|buy now)\b/iu', $reply) === 1) {
            $violations[] = 'sales language inside an answer';
        }

        return ['ok' => empty($violations), 'violations' => $violations];
    }

    /** The safe reply used when a draft cannot be made compliant. */
    public static function fallbackReply(string $language): string
    {
        $text = [
            'en' => "I want to be careful here rather than give you a half-answer. Let me pass your question to our astrologer, who can look at your chart properly and reply to you directly. In the meantime, if anything is urgent - especially about your health - please speak to a qualified doctor.",
            'ta' => "பாதியளவு பதில் சொல்வதை விட கவனமாக இருக்க விரும்புகிறேன். உங்கள் கேள்வியை எங்கள் ஜோதிடரிடம் அனுப்புகிறேன்; அவர்கள் உங்கள் ஜாதகத்தை முறையாக பார்த்து நேரடியாக பதிலளிப்பார்கள். இதற்கிடையில் ஏதேனும் அவசரம் என்றால் - குறிப்பாக உடல்நலம் சம்பந்தமாக - தயவுசெய்து தகுதியான மருத்துவரை அணுகவும்.",
            'hi' => "आधा-अधूरा उत्तर देने के बजाय मैं सावधान रहना चाहता हूँ। मैं आपका प्रश्न हमारे ज्योतिषी को भेज देता हूँ; वे आपकी कुंडली ठीक से देखकर सीधे उत्तर देंगे। इस बीच कुछ भी आपातकालीन हो - विशेषकर स्वास्थ्य संबंधी - तो कृपया किसी योग्य डॉक्टर से मिलें।",
        ];
        return $text[$language] ?? $text['en'];
    }

    // ------------------------------------------------------------------
    // The model call
    // ------------------------------------------------------------------

    /**
     * One chat/completions call. Throws on any failure so the caller records a
     * FAILED message row and returns the friendly retry text.
     */
    public static function complete(string $system, array $history, string $question): string
    {
        $cfg = self::config();
        if ($cfg['apiKey'] === '') {
            throw new RuntimeException('AI_ASTROLOGER_API_KEY is not set on this server.');
        }

        $messages = [['role' => 'system', 'content' => $system]];
        foreach ($history as $m) {
            $role = ($m['role'] ?? '') === 'customer' ? 'user' : 'assistant';
            $content = trim((string) ($m['content'] ?? ''));
            if ($content !== '') {
                $messages[] = ['role' => $role, 'content' => $content];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $question];

        $payload = json_encode([
            'model' => $cfg['model'],
            'messages' => $messages,
            'temperature' => $cfg['temperature'],
            'max_tokens' => $cfg['maxTokens'],
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init($cfg['baseUrl'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::CURL_TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $cfg['apiKey'],
            ],
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            throw new RuntimeException('Model request failed: ' . $err);
        }
        if ($status < 200 || $status >= 300) {
            // Log the status only. The response body can echo prompt fragments.
            throw new RuntimeException('Model returned HTTP ' . $status);
        }

        $data = json_decode((string) $raw, true);
        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('Model returned an empty completion.');
        }
        return trim($content);
    }

    /**
     * Splits the model's answer into the 2-4 bubbles the UI shows one at a time.
     * The prompt asks for ---BUBBLE--- separators; this also copes with a model
     * that ignores them, by splitting on blank lines and merging anything short.
     */
    public static function toBubbles(string $content): array
    {
        $parts = preg_split('/-{2,}BUBBLE-{2,}/i', $content) ?: [$content];
        if (count($parts) < 2) {
            $parts = preg_split('/\n\s*\n/', $content) ?: [$content];
        }
        $bubbles = [];
        foreach ($parts as $p) {
            $p = trim((string) $p);
            if ($p === '') {
                continue;
            }
            // Merge very short fragments into the previous bubble rather than
            // sending a one-word message.
            if (!empty($bubbles) && mb_strlen($p, 'UTF-8') < 40) {
                $bubbles[count($bubbles) - 1] .= ' ' . $p;
                continue;
            }
            $bubbles[] = $p;
        }
        if (empty($bubbles)) {
            return [trim($content)];
        }
        // The brief caps this at four bubbles.
        if (count($bubbles) > 4) {
            $head = array_slice($bubbles, 0, 3);
            $head[] = implode(' ', array_slice($bubbles, 3));
            $bubbles = $head;
        }
        return $bubbles;
    }

    // ------------------------------------------------------------------
    // The whole reply path
    // ------------------------------------------------------------------

    /**
     * @return array{content:string, bubbles:array, sourceLine:string, areaId:?string, handoff:bool}
     */
    public static function answer(string $question, string $language, array $history, ?array $chart, array $context = []): array
    {
        if (!self::isConfigured()) {
            throw new RuntimeException('The AI Astrologer is not configured on this server.');
        }

        $retrieved = self::retrieve($question, $language, $chart);

        // A refusal route short-circuits: no chart reading, offer the handoff.
        if (!empty($retrieved['refusal'])) {
            return [
                'content' => $retrieved['refusal']['text'],
                'bubbles' => [$retrieved['refusal']['text']],
                'sourceLine' => '',
                'areaId' => null,
                'handoff' => true,
            ];
        }

        $rulesBlock = '';
        foreach ($retrieved['rules'] as $r) {
            $rulesBlock .= "- " . $r['meaning'] . "\n  Eases: " . $r['easing'] . "\n";
            foreach (($r['practical'] ?? []) as $p) {
                $rulesBlock .= "  Practical: " . $p . "\n";
            }
        }
        if ($rulesBlock === '') {
            $rulesBlock = "(No rule in the knowledge base covers this question. Say so honestly and offer the handoff.)";
        }

        $prompt = self::fillPrompt(self::systemPrompt(), [
            'RETRIEVED_RULES' => $rulesBlock,
            'SOURCE_LINE' => $retrieved['sourceLine'],
            'REMEDIES' => self::remedyBlock($chart),
            'CHART_HEADER' => $context['chartHeader'] ?? '(no chart attached to this conversation yet)',
            'CUSTOMER_NAME' => $context['customerName'] ?? 'there',
            'ORDER_TITLE' => $context['orderTitle'] ?? 'your report',
            'LANGUAGE' => $language,
            'CHAT_HISTORY' => $context['chatHistory'] ?? '(this is the first message)',
            'DASHA_END_DATE' => $context['dashaEndDate'] ?? 'the date shown on your report',
        ]);

        $draft = null;
        $violations = [];
        for ($attempt = 1; $attempt <= self::MAX_GENERATION_ATTEMPTS; $attempt++) {
            $candidate = self::complete($prompt, $history, $question);
            $check = self::checkReply($candidate, $language);
            if ($check['ok']) {
                $draft = $candidate;
                break;
            }
            $violations = $check['violations'];
            error_log('AI Astrologer guard rejected a draft (attempt ' . $attempt . '): ' . implode('; ', $violations));
            // Tell the model what it did wrong, once.
            $prompt .= "\n\nYour previous draft was rejected because it contained: "
                . implode('; ', $violations)
                . "\nRewrite it without those. Keep everything else the same.";
        }

        if ($draft === null) {
            // Two non-compliant drafts is enough. Ship the safe fallback rather
            // than an unguarded answer, and escalate to a human.
            return [
                'content' => self::fallbackReply($language),
                'bubbles' => [self::fallbackReply($language)],
                'sourceLine' => '',
                'areaId' => $retrieved['areaId'],
                'handoff' => true,
            ];
        }

        $bubbles = self::toBubbles($draft);
        // The source line rides on the last bubble so it is the last thing read.
        if ($retrieved['sourceLine'] !== '') {
            $bubbles[count($bubbles) - 1] .= "\n" . $retrieved['sourceLine'];
        }

        return [
            'content' => implode("\n\n", $bubbles),
            'bubbles' => $bubbles,
            'sourceLine' => $retrieved['sourceLine'],
            'areaId' => $retrieved['areaId'],
            'handoff' => self::shouldOfferHandoff($retrieved['areaId'] ?? null, $question),
        ];
    }

    /** At most three remedies, all from the cheap sourced register. */
    private static function remedyBlock(?array $chart): string
    {
        $kb = self::kb(self::REMEDIES_PATH);
        if ($chart === null) {
            return '(No chart attached yet, so no remedy can be targeted.)';
        }
        $wanted = [];
        foreach (($chart['planetHouse'] ?? []) as $planet => $house) {
            $wanted[$planet] = true;
        }
        foreach (['Sani', 'Rahu', 'Ketu'] as $p) {
            if (($chart['dignity'][$p] ?? 'neutral') === 'weak') {
                $wanted[$p] = true;
            }
        }

        $out = [];
        foreach (($kb['grahas'] ?? []) as $g) {
            if (!isset($wanted[$g['graha']])) {
                continue;
            }
            $out[] = '- ' . $g['graha'] . ' (' . $g['weekday'] . '): ' . $g['mantra']['simple']
                . ' | charity: ' . $g['charity']
                . ' | temple: ' . $g['temple']['name'];
            if (count($out) >= 3) {
                break;
            }
        }
        return $out ? implode("\n", $out) : '(No remedy applies to this chart right now.)';
    }

    private static function shouldOfferHandoff(?string $areaId, string $question): bool
    {
        if ($areaId === 'health') {
            return true;
        }
        $q = mb_strtolower($question, 'UTF-8');
        foreach (['doctor', 'hospital', 'மருத்துவ', 'डॉक्टर', 'complaint', 'புகார்', 'शिकायत'] as $w) {
            if (mb_strpos($q, mb_strtolower($w, 'UTF-8'), 0, 'UTF-8') !== false) {
                return true;
            }
        }
        return false;
    }
}
