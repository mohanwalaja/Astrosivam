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
 * VERIFICATION STATUS: this file IS executed in the sandbox — the wasm PHP
 * runtime runs the real retrieval, prompt-assembly, guard and bubble logic
 * against the committed knowledge base:
 *   node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/reply-path.php
 * What that cannot do is reach a live model, so the curl round trip itself is
 * still unverified here; `?action=diagnose&ping=1` checks it on the server.
 * The guard rules it enforces are the same ones checked by
 * tests/ai-astrologer-knowledge.test.ts against rules/guardrails.json.
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

    /** One retry on a guard failure, then a safe fallback. Never a third try. */
    const MAX_GENERATION_ATTEMPTS = 2;
    // THE WHOLE ANSWER MUST FIT INSIDE THE BROWSER'S 30s ABORT.
    // The client gives up at 30s (ASK_TIMEOUT_MS in src/services/aiAstrologerApi.ts).
    // A guard-rejected draft costs a SECOND model call, so the budget is split:
    // 20s for the first call and 8s for the retry, worst case 28s - inside the
    // abort, with the host's proxy limit to spare. 25s x 2 = 50s was not: the
    // browser disconnected first, the customer saw a network error, and the
    // server kept working on an answer nobody would ever receive.
    const CURL_TIMEOUT_SECONDS = 20;
    const CURL_RETRY_TIMEOUT_SECONDS = 8;
    /** The diagnostic ping must never hold an admin request open. */
    const CURL_PING_TIMEOUT_SECONDS = 15;

    private static $promptCache = null;
    private static $kbCache = [];
    private static $tamilSourcesCache = null;
    /**
     * Configuration the endpoint resolved from the database, applied with
     * configure() before any model call. Empty means "use the environment".
     */
    private static $overrides = [];

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------

    /**
     * Applies admin-saved configuration (system_settings.general_settings
     * .aiAstrologerSettings). The endpoint calls this once per request, before
     * isConfigured() is asked anything, so a key saved in the Admin Portal is
     * honoured exactly like one set in the environment.
     */
    public static function configure(array $overrides): void
    {
        self::$overrides = $overrides;
        // A different key can mean a different provider with a different prompt
        // contract; the caches hold no per-key state, but resetting keeps a
        // later reconfigure predictable.
        self::$promptCache = null;
    }

    /**
     * A value that is not a credential. cPanel hosts and the Admin Portal both
     * echo masked secrets back, and a literal "your_api_key_here" from a copied
     * .env.example is the single most common reason a chat silently never
     * answers - so it is treated as "not set", never as a key to try.
     */
    private static function isPlaceholder(string $value): bool
    {
        if (trim($value) === '' || strpos($value, '•') !== false) {
            return true;
        }
        return preg_match('/^\*+$/', $value) === 1
            || preg_match('/^(?:change[-_ ]?me|replace[-_ ]?me|paste[-_ ]?|your[-_ ]?(?:secret|token|api[-_ ]?key|key)|placeholder|sk-xxx|xxx)/i', $value) === 1;
    }

    /**
     * Reads one environment variable from every place a shared host can put it.
     *
     * getenv() alone is NOT enough on cPanel: under LiteSpeed/PHP-FPM a value
     * set with SetEnv in .htaccess lands in $_SERVER, not in the process
     * environment, so getenv() returns false and the chat reports itself
     * unconfigured while the owner is looking at a key they did set.
     */
    private static function envValue(string $name): string
    {
        $candidates = [getenv($name), $_SERVER[$name] ?? null, $_ENV[$name] ?? null];
        foreach ($candidates as $candidate) {
            if ($candidate === false || $candidate === null) {
                continue;
            }
            $value = trim((string) $candidate);
            if ($value === '' || self::isPlaceholder($value)) {
                continue;
            }
            return $value;
        }
        return '';
    }

    /** First non-placeholder value wins. */
    private static function pick(string ...$values): string
    {
        foreach ($values as $value) {
            $value = trim((string) $value);
            if ($value !== '' && !self::isPlaceholder($value)) {
                return $value;
            }
        }
        return '';
    }

    public static function config(): array
    {
        $o = self::$overrides;

        $maxTokens = (int) self::pick((string) ($o['maxTokens'] ?? ''), self::envValue('AI_ASTROLOGER_MAX_TOKENS'), '900');
        // Clamped: a typo must not request a completion the host will refuse.
        if ($maxTokens < 100) {
            $maxTokens = 900;
        }
        if ($maxTokens > 4000) {
            $maxTokens = 4000;
        }

        return [
            'baseUrl' => rtrim(self::pick(
                (string) ($o['baseUrl'] ?? ''),
                self::envValue('AI_ASTROLOGER_BASE_URL'),
                'https://api.openai.com/v1'
            ), '/'),
            'apiKey' => self::pick((string) ($o['apiKey'] ?? ''), self::envValue('AI_ASTROLOGER_API_KEY')),
            'model' => self::pick(
                (string) ($o['model'] ?? ''),
                self::envValue('AI_ASTROLOGER_MODEL'),
                'gpt-4o-mini'
            ),
            'maxTokens' => $maxTokens,
            'temperature' => 0.4,
        ];
    }

    /**
     * Where the active configuration came from, without ever returning the
     * secret itself. This is the first thing an admin needs to know: "I set the
     * key" and "PHP can see the key" are two different statements on a shared
     * host, and the difference is the whole bug.
     *
     * @return array{source:string, keyHint:string}
     */
    public static function configSource(): array
    {
        $fromAdmin = trim((string) (self::$overrides['apiKey'] ?? ''));
        if ($fromAdmin !== '' && !self::isPlaceholder($fromAdmin)) {
            return ['source' => 'admin-settings', 'keyHint' => self::mask($fromAdmin)];
        }
        $fromEnv = self::envValue('AI_ASTROLOGER_API_KEY');
        if ($fromEnv !== '') {
            return ['source' => 'environment', 'keyHint' => self::mask($fromEnv)];
        }
        $raw = getenv('AI_ASTROLOGER_API_KEY');
        if (is_string($raw) && trim($raw) !== '') {
            // Set, but rejected as a placeholder. Say so rather than "not set".
            return ['source' => 'placeholder-only', 'keyHint' => self::mask(trim($raw))];
        }
        return ['source' => 'none', 'keyHint' => ''];
    }

    /** Shows only enough of a key to recognise it: sk-...abcd. */
    private static function mask(string $secret): string
    {
        $secret = trim($secret);
        if ($secret === '') {
            return '';
        }
        $prefix = preg_match('/^([a-z0-9]{2,6}-)/i', $secret, $m) === 1 ? $m[1] : '';
        return $prefix . '...' . substr($secret, -4);
    }

    /** True when the endpoint can call a model at all. Checked before promising an answer. */
    public static function isConfigured(): bool
    {
        $c = self::config();
        return $c['apiKey'] !== '' && function_exists('curl_init');
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
            self::$kbCache[$rel] = json_decode((string) file_get_contents(self::kbPath($rel)), true) ?: [];
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
        $reg = json_decode((string) file_get_contents(self::kbPath(self::SOURCES_PATH)), true);
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

    /** The list the model may name, one line per citable Tamil source. */
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

    /**
     * Multi-source fallback for questions no life-area card matched directly.
     * Instead of answering "I don't know" immediately, the agent consults, in
     * order:
     *   1. EVERY life-area card with a loose phrase match (not just the best)
     *   2. the remedies registry, on planet names mentioned in the question
     *   3. the customer's own chart period (already in CHART_HEADER)
     * The model is instructed to use only what these sources actually contain
     * and, when nothing truly applies, to say so honestly and offer the
     * handoff. No outside web search: every source is the curated knowledge
     * base, so nothing unreviewed can reach a customer.
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
        // retry instruction the model receives must name each fault once.
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
    // The model call
    // ------------------------------------------------------------------

    /**
     * One chat/completions call. Throws on any failure so the caller records a
     * FAILED message row and returns the friendly retry text.
     *
     * @param int|null $timeoutSeconds Null means the normal budget; the guard
     *                                 retry passes a short one so the whole
     *                                 answer still fits inside the browser's
     *                                 30s abort.
     */
    public static function complete(string $system, array $history, string $question, ?int $timeoutSeconds = null): string
    {
        $cfg = self::config();
        if ($cfg['apiKey'] === '') {
            throw new RuntimeException('AI_ASTROLOGER_API_KEY is not set on this server.');
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('The PHP curl extension is not loaded on this server.');
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
        if (!is_string($payload)) {
            throw new RuntimeException('The prompt could not be encoded as JSON.');
        }

        $ch = curl_init($cfg['baseUrl'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeoutSeconds ?? self::CURL_TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $cfg['apiKey'],
            ],
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = (int) curl_errno($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            // Name the likely cause: on shared hosting a curl error here is
            // almost always outbound HTTPS being blocked, or no CA bundle.
            throw new RuntimeException(sprintf(
                'Model request to %s failed (curl %d: %s). If this repeats, the host is '
                . 'probably blocking outbound HTTPS to that address.',
                $cfg['baseUrl'],
                $errno,
                $err !== '' ? $err : 'no transport error reported'
            ));
        }
        if ($status < 200 || $status >= 300) {
            // Log the status only. The response body can echo prompt fragments.
            throw new RuntimeException(sprintf(
                'Model returned HTTP %d from %s for model "%s". 401/403 means the API key is '
                . 'wrong or not enabled; 404 means that model name is not served at that base URL.',
                $status,
                $cfg['baseUrl'],
                $cfg['model']
            ));
        }

        $data = json_decode((string) $raw, true);
        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('Model returned an empty completion.');
        }
        return trim($content);
    }

    /**
     * A live, minimal model call used only by the admin diagnostics action.
     * Never throws: it reports what happened, because the whole point is to
     * explain a failure rather than produce one.
     *
     * @return array{attempted:bool, ok:bool, httpStatus:int, latencyMs:int, error:string}
     */
    public static function ping(): array
    {
        $notAttempted = ['attempted' => false, 'ok' => false, 'httpStatus' => 0, 'latencyMs' => 0, 'error' => ''];
        $cfg = self::config();
        if (!function_exists('curl_init')) {
            return $notAttempted + ['error' => 'The PHP curl extension is not loaded.'];
        }
        if ($cfg['apiKey'] === '') {
            return $notAttempted + ['error' => 'No API key is visible to PHP, so there was nothing to call.'];
        }

        $payload = json_encode([
            'model' => $cfg['model'],
            'messages' => [['role' => 'user', 'content' => 'ping']],
            'max_tokens' => 1,
        ], JSON_UNESCAPED_UNICODE);

        $started = microtime(true);
        $ch = curl_init($cfg['baseUrl'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => self::CURL_PING_TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $cfg['apiKey'],
            ],
        ]);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = (int) curl_errno($ch);
        $err = curl_error($ch);
        curl_close($ch);
        $latency = (int) round((microtime(true) - $started) * 1000);

        if ($raw === false) {
            return [
                'attempted' => true, 'ok' => false, 'httpStatus' => 0, 'latencyMs' => $latency,
                'error' => sprintf('curl %d: %s', $errno, $err !== '' ? $err : 'no transport error reported'),
            ];
        }
        $ok = $status >= 200 && $status < 300;
        return [
            'attempted' => true,
            'ok' => $ok,
            'httpStatus' => $status,
            'latencyMs' => $latency,
            // A provider's error body is safe to show an admin and is the fastest
            // route to the fix ("model not found", "invalid api key", "quota").
            'error' => $ok ? '' : substr((string) $raw, 0, 400),
        ];
    }

    /**
     * Every reason this endpoint could fail to answer, checked in the order the
     * reply path hits them. Powers `?action=diagnose`, so "the chat never
     * replies" becomes a named cause in one request instead of a guess.
     *
     * @return array{ok:bool, checks:array, blocking:array}
     */
    public static function diagnostics(bool $livePing = false): array
    {
        $cfg = self::config();
        $source = self::configSource();
        $checks = [];
        $blocking = [];

        $add = function (string $id, string $label, bool $ok, string $detail, bool $blocks = true) use (&$checks, &$blocking) {
            $checks[] = ['id' => $id, 'label' => $label, 'ok' => $ok, 'detail' => $detail];
            if (!$ok && $blocks) {
                $blocking[] = $id;
            }
        };

        // 1. The runtime the model call needs.
        $add('curl', 'PHP curl extension', function_exists('curl_init'),
            function_exists('curl_init') ? 'loaded' : 'NOT loaded - the model call cannot be made at all.');
        $add('mbstring', 'PHP mbstring extension', function_exists('mb_strlen'),
            function_exists('mb_strlen') ? 'loaded' : 'NOT loaded - Tamil/Hindi text handling would fail.');

        // 2. The credential, and WHERE PHP found it.
        $add('apiKey', 'Model API key visible to PHP', $source['source'] === 'environment' || $source['source'] === 'admin-settings',
            $source['source'] === 'none'
                ? 'Not set. Set AI_ASTROLOGER_API_KEY, or paste the key into Admin Portal > Setup > AI Astrologer.'
                : ($source['source'] === 'placeholder-only'
                    ? 'A placeholder value (' . $source['keyHint'] . ') is set, which is treated as unset. Replace it with a real key.'
                    : 'found in ' . $source['source'] . ' (' . $source['keyHint'] . ')'));
        $add('baseUrl', 'Base URL', $cfg['baseUrl'] !== '', $cfg['baseUrl'] . '/chat/completions', false);
        $add('model', 'Model', $cfg['model'] !== '', $cfg['model'] . ' (max_tokens ' . $cfg['maxTokens'] . ')', false);

        // 3. The knowledge base. A missing prompt file is a hard stop: systemPrompt()
        //    throws, so EVERY question fails identically.
        foreach ([
            'prompt' => [self::PROMPT_PATH, false],
            'guardrails' => [self::GUARDRAILS_PATH, true],
            'lifeAreas' => [self::LIFE_AREAS_PATH, true],
            'remedies' => [self::REMEDIES_PATH, true],
            'sources' => [self::SOURCES_PATH, true],
        ] as $id => [$rel, $isJson]) {
            $path = self::kbPath($rel);
            $exists = is_file($path);
            $parsed = null;
            if ($exists && $isJson) {
                $parsed = json_decode((string) file_get_contents($path), true);
            }
            $detail = !$exists
                ? 'MISSING at ' . $path . ' - deploy knowledge/ to the document root (see deploy_cpanel.sh).'
                : basename($path) . ' (' . number_format((float) filesize($path)) . ' bytes)'
                    . ($isJson ? (is_array($parsed) ? ', valid JSON' : ', INVALID JSON') : '');
            $ok = $exists && (!$isJson || is_array($parsed));
            // An empty remedies or sources file degrades the answer; a missing
            // prompt or life-area file stops every answer.
            $add('kb-' . $id, 'Knowledge base: ' . $id, $ok, $detail, in_array($id, ['prompt', 'lifeAreas', 'guardrails'], true));
        }

        // 4. The prompt actually extracts, and the retrieval layer has areas to match.
        try {
            $prompt = self::systemPrompt();
            $add('systemPrompt', 'System prompt extracts', strlen($prompt) > 1000,
                strlen($prompt) . ' bytes extracted from the ```text block.', true);
        } catch (Throwable $e) {
            $add('systemPrompt', 'System prompt extracts', false, 'THREW: ' . $e->getMessage(), true);
        }

        $kb = self::kb(self::LIFE_AREAS_PATH);
        $add('lifeAreaCount', 'Life-area cards loaded', count($kb['areas'] ?? []) > 0,
            count($kb['areas'] ?? []) . ' card(s) available for retrieval.');
        $add('tamilSources', 'Citable Tamil sources', count(self::citableTamilSources()) > 0,
            count(self::citableTamilSources()) . ' verified Tamil source(s) may be cited.');

        // 5. The live call. Only when asked for: it spends a real request.
        $pingResult = ['attempted' => false, 'ok' => false, 'httpStatus' => 0, 'latencyMs' => 0, 'error' => 'not requested'];
        if ($livePing) {
            $pingResult = self::ping();
            $add('modelPing', 'Live model call', $pingResult['ok'],
                $pingResult['ok']
                    ? 'HTTP ' . $pingResult['httpStatus'] . ' in ' . $pingResult['latencyMs'] . 'ms'
                    : ($pingResult['error'] !== '' ? $pingResult['error'] : 'no response'),
                true);
        }

        return [
            'ok' => empty($blocking) && (!$livePing || $pingResult['ok']),
            'configured' => self::isConfigured(),
            'blocking' => $blocking,
            'checks' => $checks,
            'ping' => $pingResult,
            'generatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
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
        // Tamil-only citations: drop any English, Sanskrit or unverified id before
        // it reaches the prompt or the customer.
        $retrieved['sourceLine'] = self::tamilOnlySourceLine((string) $retrieved['sourceLine']);

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
        $sourceLine = $retrieved['sourceLine'];
        if ($rulesBlock === '') {
            // No life-area card matched directly: consult the remaining
            // sources before admitting we have nothing - every card loose
            // match, the remedies registry, and the chart period.
            $more = self::consultMoreSources($question, $language, $chart);
            $rulesBlock = $more['rulesBlock'];
            if ($more['sourceLine'] !== '') {
                $sourceLine = $more['sourceLine'];
            }
        }

        $prompt = self::fillPrompt(self::systemPrompt(), [
            'RETRIEVED_RULES' => $rulesBlock,
            // Never leave this placeholder empty. The prompt says "use exactly the
            // source labels you were given", so an empty SOURCE_LINE reads as an
            // instruction with nothing to follow and invites the model to invent
            // one - which the guard then rejects. Say what to do instead.
            'SOURCE_LINE' => $sourceLine !== ''
                ? $sourceLine
                : '(No retrieved rule matched this question, so there is no given source label. '
                    . 'Name a source only if one from the TAMIL SOURCES list genuinely supports what '
                    . 'you are saying; otherwise give no source line at all. Do not invent an id.)',
            'REMEDIES' => self::remedyBlock($chart),
            'CHART_HEADER' => $context['chartHeader'] ?? '(no chart attached to this conversation yet)',
            'CUSTOMER_NAME' => $context['customerName'] ?? 'there',
            'ORDER_TITLE' => $context['orderTitle'] ?? 'your report',
            'ORDER_DETAILS' => $context['orderDetails'] ?? '(no order attached to this conversation yet)',
            'LANGUAGE' => $language,
            'CHAT_HISTORY' => $context['chatHistory'] ?? '(this is the first message)',
            'DASHA_END_DATE' => $context['dashaEndDate'] ?? 'the date shown on your report',
            'TAMIL_SOURCES' => self::tamilSourceList(),
        ]);

        $draft = null;
        $violations = [];
        for ($attempt = 1; $attempt <= self::MAX_GENERATION_ATTEMPTS; $attempt++) {
            // The guard retry gets the short budget: two full-timeout calls would
            // outlast the browser's 30s abort and the answer would be written to
            // a conversation the customer had already given up on.
            $candidate = self::complete(
                $prompt,
                $history,
                $question,
                $attempt === 1 ? null : self::CURL_RETRY_TIMEOUT_SECONDS
            );
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
