<?php
/**
 * ASTRO SIVAM AI Astrologer — Part 3: uploaded report verification.
 * ------------------------------------------------------------------
 * Verifies that a PDF a customer dropped into the chat is (a) an ASTRO SIVAM
 * report and (b) theirs, from a PAID order, before any of it is discussed.
 *
 * THIS IS A PORT OF src/services/aiReportSections.ts, which is the executable
 * spec and is covered by tests/ai-astrologer-report.test.ts. The regexes, the
 * ordering of the checks and the rejection kinds here must stay identical to
 * that file. If you change one, change the other.
 *
 * VERIFICATION STATUS — READ BEFORE TRUSTING THIS FILE:
 * PHP cannot be installed in the build sandbox (the Debian apt repositories are
 * unreachable; only github.com, registry.npmjs.org and pypi.org are allowed),
 * so this file has NOT been executed. The logic it mirrors has been executed,
 * in TypeScript, by 26 passing checks. Run api/astrology/ai_report_extract.php
 * through a smoke test on the server before relying on it — see
 * BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md.
 *
 * OWNERSHIP DESIGN (same reasoning as the TS file):
 * The uploaded PDF is an OWNERSHIP TOKEN, not the source of the explanation.
 * mPDF embeds subset fonts and glyph-to-Unicode mapping for Tamil and Devanagari
 * runs frequently does not survive extraction, so extracted Indic text can come
 * back garbled or empty. This gate therefore depends only on the ASCII order
 * number that AstroMpdfReports::topHeader prints on every page. The content that
 * gets explained is regenerated from the order's saved inputs, which is already
 * how official downloads are produced.
 */

require_once __DIR__ . '/../config.php';

class AstroAiReportExtract
{
    /** Largest upload we will parse. Reports are a few pages; this is generous. */
    const MAX_BYTES = 8388608; // 8 MB

    /** Fewer extracted characters than this means a scan or a photo, not a PDF. */
    const MIN_EXTRACTED_CHARS = 40;

    /** Minimum consecutive-word overlap for a quoted line to match a section. */
    const MIN_PHRASE_RUN = 3;

    const BRANDING = [
        'ASTRO SIVAM',
        'ASTRO-MUH',
        'ASTRO SIVAM VEDIC RESEARCH DESK',
        'ASTRO SIVAM - OFFICIAL VEDIC REPORT',
    ];

    // ------------------------------------------------------------------
    // Text extraction
    // ------------------------------------------------------------------

    /**
     * Extracts text from an uploaded PDF using smalot/pdfparser (pure PHP, so it
     * runs on shared cPanel hosting with no shell access).
     *
     * Returns ['text' => string, 'ok' => bool, 'error' => ?string].
     * Never throws: extraction failure is an expected outcome here, not a bug.
     */
    public static function extractPdfText(string $pathOnDisk): array
    {
        if (!is_readable($pathOnDisk)) {
            return ['text' => '', 'ok' => false, 'error' => 'file not readable'];
        }

        $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
        if (!is_file($autoload)) {
            return ['text' => '', 'ok' => false, 'error' => 'composer vendor/ is missing - run composer install'];
        }
        require_once $autoload;

        if (!class_exists('\Smalot\PdfParser\Parser')) {
            return ['text' => '', 'ok' => false, 'error' => 'smalot/pdfparser is not installed'];
        }

        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($pathOnDisk);
            $text = (string) $pdf->getText();
            return ['text' => self::normalise($text), 'ok' => true, 'error' => null];
        } catch (\Throwable $e) {
            // Encrypted, corrupt or image-only PDFs all land here.
            error_log('AI Astrologer: PDF text extraction failed: ' . $e->getMessage());
            return ['text' => '', 'ok' => false, 'error' => 'extraction failed'];
        }
    }

    /**
     * Collapses the whitespace damage extraction does. Must stay in step with
     * normaliseExtracted() in the TS spec.
     */
    public static function normalise(string $text): string
    {
        $text = str_replace(["\xC2\xA0", "\xE2\x80\x87", "\xE2\x80\xAF"], ' ', $text);
        $text = preg_replace('/[\x{2010}-\x{2015}\x{00AD}]/u', '-', $text) ?? $text;
        $text = preg_replace('/[\x{2018}\x{2019}]/u', "'", $text) ?? $text;
        $text = preg_replace('/[\x{201C}\x{201D}]/u', '"', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return trim($text);
    }

    // ------------------------------------------------------------------
    // Ownership signals
    // ------------------------------------------------------------------

    /** Every order number in the extracted text, de-duplicated, header order. */
    public static function extractOrderNumbers(string $text): array
    {
        $norm = strtoupper(self::normalise($text));
        if (!preg_match_all('/#?\b(ORD-[A-Z0-9][A-Z0-9-]{2,27})\b/', $norm, $m)) {
            return [];
        }
        $out = [];
        foreach ($m[1] as $id) {
            $id = rtrim($id, '-');
            if (!in_array($id, $out, true)) {
                $out[] = $id;
            }
        }
        return $out;
    }

    /** The order number implied by the filename. Corroborating only. */
    public static function orderNumberFromFilename(string $filename): ?string
    {
        if (preg_match('/ASTRO_SIVAM_(?:Report|Invoice)_([A-Za-z0-9-]+)\.pdf/i', $filename, $m)) {
            return strtoupper($m[1]);
        }
        return null;
    }

    /** Necessary but never sufficient. */
    public static function hasAstroSivamBranding(string $text): bool
    {
        $norm = strtoupper(self::normalise($text));
        foreach (self::BRANDING as $b) {
            if (strpos($norm, strtoupper($b)) !== false) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------
    // The gate
    // ------------------------------------------------------------------

    /**
     * Decides whether the upload may be discussed at all.
     *
     * @param string   $text          extracted PDF text
     * @param string   $filename      original uploaded filename
     * @param string[] $customerOrderNumbers every order number owned by the session user
     * @param string[] $paidOrderNumbers     the PAID + approved subset of the above
     * @param int      $sizeBytes
     * @return array{accepted:bool, rejection:?string, orderNumber:?string, reason:string}
     *
     * Fails closed. The `reason` is for the server log only — never send it to
     * the customer, because it would reveal which order numbers exist.
     */
    public static function decideAcceptance(
        string $text,
        string $filename,
        array $customerOrderNumbers,
        array $paidOrderNumbers,
        int $sizeBytes
    ): array {
        $fail = function (string $kind, ?string $order, string $reason): array {
            return ['accepted' => false, 'rejection' => $kind, 'orderNumber' => $order, 'reason' => $reason];
        };

        if ($sizeBytes > self::MAX_BYTES) {
            return $fail('tooLarge', null, "upload is {$sizeBytes} bytes, cap is " . self::MAX_BYTES);
        }

        $clean = self::normalise($text);
        if (mb_strlen($clean, 'UTF-8') < self::MIN_EXTRACTED_CHARS) {
            return $fail('unreadable', null, 'only ' . mb_strlen($clean, 'UTF-8') . ' characters extracted; likely a scan or a photo');
        }

        $customer = array_map('strtoupper', $customerOrderNumbers);
        $paid = array_map('strtoupper', $paidOrderNumbers);

        $fromText = self::extractOrderNumbers($clean);
        $fromFilename = self::orderNumberFromFilename($filename);

        // The header is authoritative. A filename alone can never grant access,
        // because a customer can rename any file to look like ours.
        $candidate = null;
        foreach ($fromText as $id) {
            if (in_array($id, $customer, true)) {
                $candidate = $id;
                break;
            }
        }
        if ($candidate === null) {
            $candidate = $fromText[0] ?? null;
        }

        if ($candidate === null) {
            if (!self::hasAstroSivamBranding($clean)) {
                return $fail('notAstroSivam', null, 'no ASTRO SIVAM branding and no order number found');
            }
            return $fail('unreadable', null, 'branded document but no order number could be extracted');
        }

        if (!self::hasAstroSivamBranding($clean)) {
            return $fail('notAstroSivam', $candidate, "order number {$candidate} present but no ASTRO SIVAM branding");
        }

        if (!in_array($candidate, $customer, true)) {
            return $fail('notYours', $candidate, "order {$candidate} does not belong to the session customer");
        }

        if (!in_array($candidate, $paid, true)) {
            return $fail('notYours', $candidate, "order {$candidate} belongs to the customer but is not PAID");
        }

        $reason = ($fromFilename !== null && $fromFilename !== $candidate)
            ? "accepted on header order {$candidate}; filename said {$fromFilename}"
            : "accepted on header order {$candidate}";

        return ['accepted' => true, 'rejection' => null, 'orderNumber' => $candidate, 'reason' => $reason];
    }

    // ------------------------------------------------------------------
    // Order lookup
    // ------------------------------------------------------------------

    /**
     * The order numbers this customer owns, and which of them are PAID.
     * Both lists come from the database on every request — never from the client.
     *
     * @return array{all:string[], paid:string[]}
     */
    public static function customerOrders(\PDO $pdo, int $userId): array
    {
        $stmt = $pdo->prepare(
            'SELECT order_number, status, payment_status
               FROM orders
              WHERE user_id = :uid'
        );
        $stmt->execute([':uid' => $userId]);

        $all = [];
        $paid = [];
        while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
            $number = strtoupper((string) $row['order_number']);
            if ($number === '') {
                continue;
            }
            $all[] = $number;
            $status = strtoupper((string) ($row['status'] ?? ''));
            $payment = strtoupper((string) ($row['payment_status'] ?? ''));
            // A report may only be discussed once the money has actually landed.
            $isPaid = ($payment === 'PAID' || $payment === 'SUCCEEDED' || $payment === 'COMPLETED')
                && $status !== 'CANCELLED'
                && $status !== 'REFUNDED';
            if ($isPaid) {
                $paid[] = $number;
            }
        }
        return ['all' => $all, 'paid' => $paid];
    }

    /**
     * Loads one verified order row, or null. Called only after decideAcceptance()
     * has returned accepted=true.
     */
    public static function loadVerifiedOrder(\PDO $pdo, int $userId, string $orderNumber): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT * FROM orders WHERE order_number = :onum AND user_id = :uid LIMIT 1'
        );
        $stmt->execute([':onum' => $orderNumber, ':uid' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // ------------------------------------------------------------------
    // Rejection wording
    // ------------------------------------------------------------------

    private static function reportSectionsPath(): string
    {
        foreach ([
            dirname(__DIR__, 2) . '/knowledge/ai-astrologer/rules/report-sections.json',
            dirname(__DIR__) . '/knowledge/ai-astrologer/rules/report-sections.json',
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }
        return dirname(__DIR__, 2) . '/knowledge/ai-astrologer/rules/report-sections.json';
    }

    /**
     * The polite refusal, in the customer's language, straight from the knowledge
     * base so the wording can never drift from what the agent says elsewhere.
     */
    public static function rejectionText(string $kind, string $lang): string
    {
        static $kb = null;
        if ($kb === null) {
            $path = self::reportSectionsPath();
            $kb = is_file($path) ? (json_decode((string) @file_get_contents($path), true) ?: []) : [];
        }
        $entry = $kb['rejection'][$kind] ?? null;
        if (!is_array($entry)) {
            return 'I am not able to open that file. Please choose the report from your dashboard instead.';
        }
        return (string) ($entry[$lang] ?? $entry['en']);
    }

    // ------------------------------------------------------------------
    // Quoted-line matching
    // ------------------------------------------------------------------

    /**
     * Longest run of consecutive words from $needle appearing consecutively in
     * $haystack. Mirrors longestSharedRun() in the TS spec.
     */
    public static function longestSharedRun(string $needle, string $haystack): int
    {
        $words = array_values(array_filter(
            preg_split('/\s+/u', $needle) ?: [],
            function ($w) { return mb_strlen($w, 'UTF-8') > 1; }
        ));
        $count = count($words);
        $best = 0;
        for ($start = 0; $start < $count; $start++) {
            for ($len = $count - $start; $len > $best; $len--) {
                $phrase = implode(' ', array_slice($words, $start, $len));
                if (mb_strpos($haystack, $phrase, 0, 'UTF-8') !== false) {
                    $best = $len;
                    break;
                }
            }
        }
        return $best;
    }

    /**
     * Finds the section a quoted line came from. Returns the section array or
     * null — and null means "ask for the page number", never "guess".
     *
     * @return array{section:array, score:int, kind:string}|null
     */
    public static function matchSection(string $quoted, array $reportType): ?array
    {
        $q = mb_strtolower(self::normalise($quoted), 'UTF-8');
        if (mb_strlen($q, 'UTF-8') < 3) {
            return null;
        }
        $best = null;
        foreach (($reportType['sections'] ?? []) as $section) {
            foreach (['en', 'ta', 'hi'] as $lang) {
                $title = mb_strtolower((string) ($section['title'][$lang] ?? ''), 'UTF-8');
                if ($title !== '' && (mb_strpos($q, $title, 0, 'UTF-8') !== false || mb_strpos($title, $q, 0, 'UTF-8') !== false)) {
                    $score = 1000 + mb_strlen($title, 'UTF-8');
                    if ($best === null || $score > $best['score']) {
                        $best = ['section' => $section, 'score' => $score, 'kind' => 'title'];
                    }
                }
            }
            foreach (['en', 'ta', 'hi'] as $lang) {
                $body = mb_strtolower(self::normalise((string) ($section['means'][$lang] ?? '')), 'UTF-8');
                if ($body === '') {
                    continue;
                }
                $run = self::longestSharedRun($q, $body);
                if ($run < self::MIN_PHRASE_RUN) {
                    continue;
                }
                $score = $run * 10;
                if ($best === null || $score > $best['score']) {
                    $best = ['section' => $section, 'score' => $score, 'kind' => 'body'];
                }
            }
        }
        return $best;
    }

    /**
     * Identifies which of the four report types this is, by fingerprint count.
     * Two fingerprints, or one long distinctive one, are required.
     */
    public static function identifyReportType(string $text): ?array
    {
        $norm = self::normalise($text);
        $upper = mb_strtoupper($norm, 'UTF-8');

        $path = self::reportSectionsPath();
        $kb = is_file($path) ? (json_decode((string) @file_get_contents($path), true) ?: []) : [];

        $best = null;
        foreach (($kb['reportTypes'] ?? []) as $type) {
            $matched = [];
            foreach (($type['fingerprints'] ?? []) as $f) {
                if (mb_strpos($upper, mb_strtoupper((string) $f, 'UTF-8'), 0, 'UTF-8') !== false) {
                    $matched[] = $f;
                }
            }
            if (empty($matched)) {
                continue;
            }
            $score = count($matched) * 10 + strlen(implode('', $matched));
            if ($best === null || $score > $best['score']) {
                $best = ['type' => $type, 'score' => $score, 'matched' => $matched];
            }
        }
        if ($best === null) {
            return null;
        }
        $long = false;
        foreach ($best['matched'] as $m) {
            if (strlen($m) >= 24) {
                $long = true;
                break;
            }
        }
        return (count($best['matched']) >= 2 || $long) ? $best : null;
    }
}
