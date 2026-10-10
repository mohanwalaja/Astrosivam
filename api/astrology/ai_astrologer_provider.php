<?php
/**
 * ASTRO SIVAM local astrology knowledge base and safety rules.
 * -------------------------------------------------------------------------------
 * Customer replies are built only from the checked-in local knowledge base,
 * chart calculations, curated rules, report readings and remedies. External AI
 * providers are deliberately disabled: no API key is needed, read, or sent.
 * See ai_astrologer_offline.php for the deterministic answer builder.
 *
 * VERIFICATION STATUS: this file is exercised locally under the wasm PHP
 * runtime against the committed knowledge base. No network request or external
 * model is used by the customer reply path.
 */

// config.php lives one directory up in api/. Requiring '/config.php' here
// would resolve to api/astrology/config.php, which does not exist, and fatal
// the whole endpoint with an empty HTTP 500 before any JSON can be sent.
require_once __DIR__ . '/../config.php';

class AstroAiProvider
{
    const PROMPT_PATH = '/knowledge/ai-astrologer/prompt/system-prompt.md';
    const GUARDRAILS_PATH = '/knowledge/ai-astrologer/rules/guardrails.json';
    const LIFE_AREAS_PATH = '/knowledge/ai-astrologer/rules/life-areas.json';
    const REMEDIES_PATH = '/knowledge/ai-astrologer/rules/remedies.json';
    const SOURCES_PATH = '/knowledge/ai-astrologer/sources.json';
    const GUIDED_PATH = '/knowledge/ai-astrologer/rules/guided-questions.json';

    private static $promptCache = null;
    private static $kbCache = [];
    private static $tamilSourcesCache = null;

    // ------------------------------------------------------------------
    // Local-only mode
    // ------------------------------------------------------------------

    /** Legacy compatibility method: an external model is never configured. */
    public static function isConfigured(): bool
    {
        return false;
    }

    /** Every customer reply is built from ASTRO SIVAM's local knowledge base. */
    public static function mode(): string
    {
        return 'knowledge-base';
    }

    /**
     * True when local replies can be built. Only a missing knowledge file
     * or the required mbstring extension stops the chat. The guided menu is
     * included: customers cannot ask anything without it.
     */
    public static function canAnswer(): bool
    {
        if (!function_exists('mb_strlen')) {
            return false;
        }
        foreach ([self::LIFE_AREAS_PATH, self::GUARDRAILS_PATH, self::REMEDIES_PATH, self::SOURCES_PATH, self::GUIDED_PATH] as $rel) {
            $path = self::kbPath($rel);
            if (!is_file($path)) {
                return false;
            }
            $data = json_decode((string) file_get_contents($path), true);
            if (!is_array($data)) {
                return false;
            }
            if ($rel === self::SOURCES_PATH && empty($data['sources'])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Counts the local source catalogue by verification level. The registry is
     * bibliographic metadata, not a bundle of all the books' full text.
     */
    public static function sourceRegistryStats(): array
    {
        $registry = self::kb(self::SOURCES_PATH);
        $sources = is_array($registry['sources'] ?? null) ? $registry['sources'] : [];
        $byVerification = [];
        foreach ($sources as $source) {
            $level = (string) ($source['verification'] ?? 'unknown');
            $byVerification[$level] = ($byVerification[$level] ?? 0) + 1;
        }
        ksort($byVerification);
        return [
            'total' => count($sources),
            'excluded' => count(is_array($registry['excludedSources'] ?? null) ? $registry['excludedSources'] : []),
            'citableTamil' => count(self::citableTamilSources()),
            'byVerification' => $byVerification,
        ];
    }

    /** The knowledge-base answer (no model). Same return shape as answer(). */
    public static function answerFromKnowledgeBase(string $question, string $language, ?array $chart, array $context = []): array
    {
        require_once __DIR__ . '/ai_astrologer_offline.php';
        return AstroAiOffline::answer($question, $language, $chart, $context);
    }

    /**
     * Resolve a knowledge-base file against the candidate roots.
     *
     * knowledge/ lives at the repository root in development and at the
     * document root on cPanel (the deployment copies it there), i.e. two
     * levels up from this file. api/knowledge/ is accepted as a fallback for
     * manual uploads. The first location that actually has the file wins, so
     * a missing deploy copy fails loudly at read time instead of silently
     * serving an empty knowledge base from the wrong directory.
     */
    private static function kbPath(string $rel): string
    {
        $candidates = [
            dirname(__DIR__, 2) . $rel,
            dirname(__DIR__) . $rel,
        ];
        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }
        return $candidates[0];
    }

    private static function kb(string $rel): array
    {
        if (!isset(self::$kbCache[$rel])) {
            $path = self::kbPath($rel);
            $contents = is_file($path) ? @file_get_contents($path) : false;
            $decoded = is_string($contents) ? json_decode($contents, true) : null;
            self::$kbCache[$rel] = is_array($decoded) ? $decoded : [];
        }
        return self::$kbCache[$rel];
    }

    // ------------------------------------------------------------------
    // Tamil-only citations
    // ------------------------------------------------------------------

    /**
     * Verified Tamil-language sources, keyed by id. English, Sanskrit and
     * Hindi entries never reach a customer reply, even when an English text
     * informed a rule (the English is kept as internal reference only).
     */
    public static function citableTamilSources(): array
    {
        if (self::$tamilSourcesCache !== null) {
            return self::$tamilSourcesCache;
        }
        $path = self::kbPath(self::SOURCES_PATH);
        $contents = is_file($path) ? @file_get_contents($path) : false;
        $reg = is_string($contents) ? json_decode($contents, true) : null;
        $reg = is_array($reg) ? $reg : [];
        $out = [];
        foreach (($reg['sources'] ?? []) as $s) {
            if (($s['language'] ?? '') === 'ta'
                && in_array($s['verification'] ?? '', ['content-read', 'metadata-verified', 'catalogue-verified'], true)) {
                $out[(string) $s['id']] = $s;
            }
        }
        self::$tamilSourcesCache = $out;
        return $out;
    }

    public static function isCitableId(string $id): bool
    {
        return isset(self::citableTamilSources()[$id]);
    }

    /** Keeps only the citable Tamil ids in a "Source: ..." line. */
    public static function tamilOnlySourceLine(string $line): string
    {
        if (strncmp($line, 'Source: ', 8) !== 0) {
            return '';
        }
        $kept = [];
        foreach (explode(' · ', substr($line, 8)) as $token) {
            $id = trim(explode(',', $token)[0]);
            if ($id !== '' && self::isCitableId($id)) {
                $kept[] = trim($token);
            }
        }
        return $kept ? 'Source: ' . implode(' · ', $kept) : '';
    }

    /** Local source index of verified Tamil references available to rule citations. */
    public static function tamilSourceList(): string
    {
        $lines = [];
        foreach (self::citableTamilSources() as $id => $s) {
            $lines[] = '- ' . $id . ' — ' . (string) ($s['title'] ?? '');
        }
        return implode("\n", $lines);
    }

    // ------------------------------------------------------------------
    // The system prompt
    // ------------------------------------------------------------------

    /**
     * Legacy prompt-file reader retained for compatibility only. The current
     * customer reply path does not call it and never submits a prompt to a model.
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
     * empty string rather than leave a visible unresolved template token.
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

    /**
     * Legacy retrieval-context helper retained for compatibility. It reads
     * local rule/remedy JSON only; it is not full-text search and is not called
     * by the active customer reply path, which handles unmatched questions with
     * an explicit local no-match response and human handoff.
     *
     * @return array{rulesBlock:string, sourceLine:string}
     */
    public static function consultMoreSources(string $question, string $language, ?array $chart): array
    {
        $q = mb_strtolower(trim($question), 'UTF-8');
        $lines = [];
        $sources = [];

        // Source 1: loose phrase match across ALL life-area cards.
        $kb = self::kb(self::LIFE_AREAS_PATH);
        foreach (($kb['areas'] ?? []) as $area) {
            $phrases = array_merge(
                $area['customerPhrases'][$language] ?? [],
                $area['customerPhrases']['en'] ?? []
            );
            $hit = false;
            foreach ($phrases as $p) {
                $needle = mb_strtolower(trim((string) $p), 'UTF-8');
                if ($needle !== '' && mb_strpos($q, $needle, 0, 'UTF-8') !== false) {
                    $hit = true;
                    break;
                }
            }
            if (!$hit) {
                continue;
            }
            $title = (string) ($area['cardTitle'][$language] ?? ($area['cardTitle']['en'] ?? ($area['id'] ?? 'card')));
            $added = 0;
            foreach (($area['rules'] ?? []) as $rule) {
                if ($added >= 2) {
                    break;
                }
                if (!self::evaluateCondition($rule['condition'] ?? [], $chart, $question)) {
                    continue;
                }
                $meaning = (string) ($rule['meaning'][$language] ?? ($rule['meaning']['en'] ?? ''));
                if ($meaning === '') {
                    continue;
                }
                $lines[] = '- [' . $title . '] ' . $meaning;
                $added++;
            }
            if ($added > 0) {
                $sources[] = $title;
            }
        }

        // Source 2: the remedies registry, matched on planet names in the question.
        $remedies = self::kb(self::REMEDIES_PATH);
        foreach (($remedies['grahas'] ?? []) as $g) {
            $names = [
                (string) ($g['graha'] ?? ''),
                (string) ($g['tamil'] ?? ''),
                (string) ($g['hindi'] ?? ''),
            ];
            $hit = false;
            foreach ($names as $name) {
                $needle = mb_strtolower(trim($name), 'UTF-8');
                if ($needle !== '' && mb_strpos($q, $needle, 0, 'UTF-8') !== false) {
                    $hit = true;
                    break;
                }
            }
            if (!$hit) {
                continue;
            }
            $lines[] = '- [Remedies registry: ' . ($g['graha'] ?? 'planet') . '] '
                . ($g['mantra']['simple'] ?? '') . ' | charity: ' . ($g['charity'] ?? '')
                . ' | temple: ' . ($g['temple']['name'] ?? '');
            $sources[] = 'Remedies registry (' . ($g['graha'] ?? 'planet') . ')';
            if (count($lines) >= 6) {
                break;
            }
        }

        if (empty($lines)) {
            return [
                'rulesBlock' => "(No curated rule matches this question. Answer it from general Tamil astrology (Jyotisha) knowledge, in the customer's language. Say plainly that this is general guidance, not a reading of their chart. Be honest about anything uncertain. Name only sources from the TAMIL SOURCES list, at book level, or name none. Never quote a verse. Keep every health, legal, financial and prediction rule. If the question is not about astrology, say so politely and offer to help with an astrology question.)",
                'sourceLine' => '',
            ];
        }

        return [
            'rulesBlock' => implode("\n", $lines),
            'sourceLine' => 'Consulted: ' . implode(' · ', array_slice(array_values(array_unique($sources)), 0, 4)),
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
        // Unique: when $language IS 'en' the same list is merged twice, and the
        // safety diagnostic should name each fault once.
        foreach (array_unique(array_map(static function ($b) {
            return mb_strtolower(trim((string) $b), 'UTF-8');
        }, $lists)) as $banned) {
            if ($banned !== '' && mb_strpos($lower, $banned, 0, 'UTF-8') !== false) {
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

        // Tamil-only citations: a reply may name only citable Tamil sources.
        if (preg_match_all('/\b(?:EN|SA|HI|TP|TA|REF)-\d{2,3}\b/u', $reply, $cites)) {
            foreach (array_unique($cites[0]) as $cited) {
                if (!self::isCitableId($cited)) {
                    $violations[] = 'names a source that is not an allowed Tamil source: ' . $cited;
                }
            }
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
    // Disabled external generation (compatibility guard)
    // ------------------------------------------------------------------

    /**
     * One chat/completions call. Throws on any failure so the caller records a
     * FAILED message row. Kept only for compatibility; it always refuses
     * rather than opening a network connection.
     */
    public static function complete(string $system, array $history, string $question, ?int $timeoutSeconds = null): string
    {
        throw new RuntimeException("External AI providers are disabled. Replies use ASTRO SIVAM's local knowledge base.");
    }

    /** A compatibility stub. It never makes an outbound network request. */
    public static function ping(): array
    {
        return [
            'attempted' => false,
            'ok' => false,
            'httpStatus' => 0,
            'latencyMs' => 0,
            'error' => 'External model calls are disabled in local-only mode.',
        ];
    }

    public static function diagnostics(bool $livePing = false): array
    {
        $checks = [];
        $blocking = [];
        $add = function (string $id, string $label, bool $ok, string $detail, bool $blocks = true) use (&$checks, &$blocking) {
            $checks[] = ['id' => $id, 'label' => $label, 'ok' => $ok, 'detail' => $detail];
            if (!$ok && $blocks) {
                $blocking[] = $id;
            }
        };

        $add('localMode', 'Reply mode', true,
            'Local-only: replies use ASTRO SIVAM knowledge and chart calculations. External AI providers and API keys are disabled.', false);
        $add('mbstring', 'PHP mbstring extension', function_exists('mb_strlen'),
            function_exists('mb_strlen') ? 'loaded' : 'NOT loaded - Tamil/Hindi text handling needs mbstring.');

        foreach ([
            'guardrails' => self::GUARDRAILS_PATH,
            'lifeAreas' => self::LIFE_AREAS_PATH,
            'remedies' => self::REMEDIES_PATH,
            'sources' => self::SOURCES_PATH,
            'guided' => self::GUIDED_PATH,
        ] as $id => $rel) {
            $path = self::kbPath($rel);
            $exists = is_file($path);
            $parsed = $exists ? json_decode((string) file_get_contents($path), true) : null;
            $valid = $exists && is_array($parsed);
            if ($valid && $id === 'sources') {
                $valid = !empty($parsed['sources']) && is_array($parsed['sources']);
            }
            $detail = !$exists
                ? 'MISSING at ' . $path . ' - deploy the knowledge/ folder to the website root.'
                : basename($path) . ' (' . number_format((float) filesize($path)) . ' bytes)'
                    . ($valid ? ', valid local data' : ', missing or invalid data');
            $add('kb-' . $id, 'Local knowledge: ' . $id, $valid, $detail);
        }

        $kb = self::kb(self::LIFE_AREAS_PATH);
        $add('lifeAreaCount', 'Curated question topics', count($kb['areas'] ?? []) > 0,
            count($kb['areas'] ?? []) . ' locally reviewed topic cards available.');

        $guided = self::kb(self::GUIDED_PATH);
        $guidedOptions = 0;
        foreach (($guided['categories'] ?? []) as $category) {
            $guidedOptions += count($category['questions'] ?? []);
        }
        $add('guidedOptions', 'Guided question menu', $guidedOptions > 0,
            count($guided['categories'] ?? []) . ' categories with ' . $guidedOptions
            . ' curated options available for customers to pick.');

        $stats = self::sourceRegistryStats();
        $levels = $stats['byVerification'];
        $sourceDetail = sprintf(
            '%d catalogue records; %d text-read, %d metadata-verified, %d catalogue-verified, %d linked-not-opened, %d dead; %d Tamil references eligible at their recorded citation level. Catalogue records are not full-text books.',
            $stats['total'],
            (int) ($levels['content-read'] ?? 0),
            (int) ($levels['metadata-verified'] ?? 0),
            (int) ($levels['catalogue-verified'] ?? 0),
            (int) ($levels['linked-not-opened'] ?? 0),
            (int) ($levels['dead'] ?? 0),
            $stats['citableTamil']
        );
        $add('sourceLibrary', 'Local source catalogue', $stats['total'] > 0, $sourceDetail);

        $pingResult = [
            'attempted' => false,
            'ok' => false,
            'httpStatus' => 0,
            'latencyMs' => 0,
            'error' => $livePing ? 'External model checks are disabled; no network request was made.' : 'not requested',
        ];

        return [
            'ok' => empty($blocking),
            'configured' => false,
            'mode' => self::mode(),
            'blocking' => $blocking,
            'checks' => $checks,
            'ping' => $pingResult,
            'sourceRegistry' => $stats,
            'generatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
    }

    /** Splits a locally assembled reply into readable bubbles. */
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
        return self::answerFromKnowledgeBase($question, $language, $chart, $context);
    }

/** At most three affordable remedies, all from the curated local register. */
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
