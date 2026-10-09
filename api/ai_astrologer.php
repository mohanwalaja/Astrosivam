<?php
/**
 * ASTRO SIVAM AI Astrologer — customer chat endpoint.
 * --------------------------------------------------
 * POST /api/ai_astrologer.php?action=...
 *
 * ACTIONS
 *   session            create a conversation, optionally bound to an order
 *   history            the messages of one of the customer's own sessions
 *   ask                send a question, get an answer
 *   upload             attach an ASTRO SIVAM report PDF (Part 3 gate)
 *   handoff            "Talk to our astrologer"
 *   usage              today's remaining question allowance
 *
 * THE TWO GATES — READ BEFORE EDITING
 * Both run on EVERY action, including read-only ones. The brief is explicit
 * that the paid check happens in PHP on every request and never only in React,
 * because React is client-side and the client is not trustworthy:
 *
 *   1. requireAuth()      — a signed-in customer, with the token_version check
 *                           that api/config.php already applies.
 *   2. requirePaidOrder() — at least one PAID order owned by THAT customer.
 *
 * A free-beta order does not qualify. An order that is PENDING, PROCESSING,
 * REJECTED or CANCELLED does not qualify. A refunded order does not qualify.
 *
 * VERIFICATION STATUS: PHP cannot be installed in the build sandbox (the Debian
 * apt repositories are unreachable; only github.com, registry.npmjs.org and
 * pypi.org are allowed), so this file has NOT been executed. The retrieval and
 * report-gate logic it calls IS covered by tests/ai-astrologer-knowledge.test.ts
 * and tests/ai-astrologer-report.test.ts. Smoke-test this file on the server
 * before relying on it — see BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md.
 */

require_once __DIR__ . '/config.php';
// config.php does NOT include db.php - getDbConnection() lives there.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rate_limit.php';
require_once __DIR__ . '/client_ip.php';
require_once __DIR__ . '/astrology/ai_report_extract.php';
require_once __DIR__ . '/astrology/ai_astrologer_provider.php';

// Questions per customer per rolling 24 hours. Overridable by env on the server
// without a code change, clamped so a typo cannot open the floodgates.
const AI_ASTROLOGER_DAILY_LIMIT_DEFAULT = 20;
const AI_ASTROLOGER_WINDOW_SECONDS = 86400;
const AI_ASTROLOGER_RATE_BUCKET = 'ai_astrologer_ask';
const AI_ASTROLOGER_MAX_UPLOAD_BYTES = 8388608; // 8 MB
const AI_ASTROLOGER_HISTORY_CONTEXT_MESSAGES = 20;

/**
 * GATE 2 — at least one PAID order belonging to this customer.
 *
 * Deliberately a single indexed COUNT rather than loading the orders: this runs
 * on every request, including history reads, so it must stay cheap on shared
 * hosting.
 */
function astro_ai_require_paid_order(PDO $pdo, array $user): array
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS c
           FROM orders
          WHERE user_id = :uid
            AND payment_confirmed = 1
            AND status IN ('COMPLETED', 'PROCESSING')
            AND (refund_status IS NULL OR refund_status = 'NONE')"
    );
    $stmt->execute([':uid' => $user['id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || (int) $row['c'] < 1) {
        // Trilingual, because the customer may have been browsing in any of the
        // three. Never reveals that a specific order was found and rejected.
        jsonResponse([
            'success' => false,
            'code' => 'NO_PAID_ORDER',
            'message' => 'The AI Astrologer is available to customers with a completed paid report. '
                . 'Once your order is complete, I will be here.',
            'message_ta' => 'AI ஜோதிடர், முடிந்த கட்டண அறிக்கை உள்ள வாடிக்கையாளர்களுக்கு மட்டுமே. '
                . 'உங்கள் ஆர்டர் முடிந்ததும் நான் இங்கே இருப்பேன்.',
            'message_hi' => 'AI ज्योतिषी उन ग्राहकों के लिए उपलब्ध है जिनकी भुगतान की गई रिपोर्ट पूरी हो चुकी है। '
                . 'आपका ऑर्डर पूरा होते ही मैं यहाँ रहूँगा।',
            'dashboardUrl' => '/customer/dashboard',
        ], 403);
    }

    return $user;
}

/** Both gates, in order. Every action calls this and nothing else for auth. */
function astro_ai_gate(PDO $pdo): array
{
    $user = requireAuth($pdo);
    return astro_ai_require_paid_order($pdo, $user);
}

/** The customer's daily question allowance, from the existing rate limiter. */
function astro_ai_daily_limit(): int
{
    return astro_env_int('AI_ASTROLOGER_DAILY_LIMIT', AI_ASTROLOGER_DAILY_LIMIT_DEFAULT, 1, 1000);
}

/** Create the chat tables if the migration has not been run yet. */
function astro_ai_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    $sql = @file_get_contents(__DIR__ . '/migrations/007_ai_astrologer_chat.sql');
    if ($sql !== false && $sql !== '') {
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            if ($statement === '' || strpos($statement, '--') === 0) {
                continue;
            }
            try {
                $pdo->exec($statement);
            } catch (Throwable $e) {
                // A table that already exists is the normal case on re-run.
                error_log('AI Astrologer schema: ' . $e->getMessage());
            }
        }
    }
    $ready = true;
}

/** A new conversation id. Prefixed so it is obvious in a log line. */
function astro_ai_new_session_id(): string
{
    return 'AICHAT-' . strtoupper(bin2hex(random_bytes(12)));
}

/**
 * Writes one message row and returns its id.
 *
 * This is called BEFORE the customer sees anything, which is what makes the
 * retry path honest: a failed generation is a FAILED row, not a silent gap.
 */
function astro_ai_save_message(
    PDO $pdo,
    string $sessionId,
    string $userId,
    string $role,
    string $language,
    string $content,
    array $extra = []
): int {
    $stmt = $pdo->prepare(
        "INSERT INTO ai_chat_messages
            (session_id, user_id, role, language, content, area_id, section_id, sources,
             status, attempt, latency_ms, error_message,
             attachment_kind, attachment_filename, attachment_bytes,
             attachment_order_number, attachment_rejection)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $sessionId,
        $userId,
        $role,
        $language,
        $content,
        $extra['area_id'] ?? null,
        $extra['section_id'] ?? null,
        $extra['sources'] ?? null,
        $extra['status'] ?? 'SAVED',
        $extra['attempt'] ?? 1,
        $extra['latency_ms'] ?? null,
        $extra['error_message'] ?? null,
        $extra['attachment_kind'] ?? null,
        $extra['attachment_filename'] ?? null,
        $extra['attachment_bytes'] ?? null,
        $extra['attachment_order_number'] ?? null,
        $extra['attachment_rejection'] ?? null,
    ]);

    $id = (int) $pdo->lastInsertId();

    $touch = $pdo->prepare(
        "UPDATE ai_chat_sessions
            SET message_count = message_count + 1, last_message_at = NOW()
          WHERE id = ?"
    );
    $touch->execute([$sessionId]);

    return $id;
}

/** Loads a session, and refuses if it is not this customer's. */
function astro_ai_load_session(PDO $pdo, string $sessionId, string $userId): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM ai_chat_sessions WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$sessionId, $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/**
 * The recent conversation, oldest first, capped. The cap is what keeps the
 * prompt bounded on shared hosting; the agent still "remembers" the whole chat
 * because history() can page it, but only this window is sent to the model.
 */
function astro_ai_recent_messages(PDO $pdo, string $sessionId): array
{
    $stmt = $pdo->prepare(
        "SELECT id, role, language, content, area_id, sources, status, created_at
           FROM ai_chat_messages
          WHERE session_id = ? AND status IN ('SENT', 'SAVED')
          ORDER BY id DESC
          LIMIT " . AI_ASTROLOGER_HISTORY_CONTEXT_MESSAGES
    );
    $stmt->execute([$sessionId]);
    return array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

/* ================================================================== */
/* ACTIONS                                                            */
/* ================================================================== */

function astro_ai_action_session(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);

    $orderId = trim((string) ($body['orderId'] ?? ''));
    $orderNumber = null;
    $serviceType = null;

    if ($orderId !== '') {
        // The order must be the customer's own and paid. Same rule as Part 3.
        $stmt = $pdo->prepare(
            "SELECT order_number, service_type
               FROM orders
              WHERE id = ? AND user_id = ? AND payment_confirmed = 1
                AND status IN ('COMPLETED', 'PROCESSING')
                AND (refund_status IS NULL OR refund_status = 'NONE')
              LIMIT 1"
        );
        $stmt->execute([$orderId, $user['id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            jsonResponse(['success' => false, 'code' => 'ORDER_NOT_FOUND',
                'message' => 'I could not find that report on your account.'], 404);
        }
        $orderNumber = $order['order_number'];
        $serviceType = $order['service_type'];
    }

    $language = astro_normalize_report_language((string) ($body['language'] ?? ($user['country'] === 'India' ? 'hi' : 'ta')));
    $sessionId = astro_ai_new_session_id();

    $stmt = $pdo->prepare(
        "INSERT INTO ai_chat_sessions (id, user_id, language, order_id, order_number, service_type)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$sessionId, $user['id'], $language, $orderId ?: null, $orderNumber, $serviceType]);

    jsonResponse([
        'success' => true,
        'sessionId' => $sessionId,
        'language' => $language,
        'orderNumber' => $orderNumber,
        'serviceType' => $serviceType,
        'dailyLimit' => astro_ai_daily_limit(),
    ], 201);
}

function astro_ai_action_history(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);

    $sessionId = trim((string) ($body['sessionId'] ?? ($_GET['sessionId'] ?? '')));
    if ($sessionId === '') {
        jsonResponse(['success' => false, 'code' => 'MISSING_SESSION', 'message' => 'sessionId is required.'], 400);
    }

    $session = astro_ai_load_session($pdo, $sessionId, $user['id']);
    if (!$session) {
        // 404, not 403: do not confirm that the session exists.
        jsonResponse(['success' => false, 'code' => 'SESSION_NOT_FOUND', 'message' => 'That conversation was not found.'], 404);
    }

    $messages = astro_ai_recent_messages($pdo, $sessionId);
    jsonResponse([
        'success' => true,
        'session' => [
            'id' => $session['id'],
            'language' => $session['language'],
            'orderNumber' => $session['order_number'],
            'serviceType' => $session['service_type'],
            'status' => $session['status'],
            'messageCount' => (int) $session['message_count'],
        ],
        'messages' => array_map(function ($m) {
            return [
                'id' => (int) $m['id'],
                'role' => $m['role'],
                'language' => $m['language'],
                'content' => $m['content'],
                'areaId' => $m['area_id'],
                'sources' => $m['sources'],
                'createdAt' => $m['created_at'],
            ];
        }, $messages),
    ]);
}

function astro_ai_action_ask(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);

    $sessionId = trim((string) ($body['sessionId'] ?? ''));
    $question = trim((string) ($body['question'] ?? ''));

    if ($sessionId === '' || $question === '') {
        jsonResponse(['success' => false, 'code' => 'MISSING_FIELDS',
            'message' => 'sessionId and question are both required.'], 400);
    }
    if (mb_strlen($question, 'UTF-8') > 2000) {
        jsonResponse(['success' => false, 'code' => 'TOO_LONG',
            'message' => 'Please keep the question under 2000 characters.'], 400);
    }

    $session = astro_ai_load_session($pdo, $sessionId, $user['id']);
    if (!$session) {
        jsonResponse(['success' => false, 'code' => 'SESSION_NOT_FOUND', 'message' => 'That conversation was not found.'], 404);
    }
    if ($session['status'] === 'CLOSED') {
        jsonResponse(['success' => false, 'code' => 'SESSION_CLOSED',
            'message' => 'That conversation is closed. Please start a new one.'], 409);
    }

    // DAILY LIMIT — the existing sliding-window limiter, keyed on the user id so
    // signing in from another device does not reset it.
    $limit = astro_ai_daily_limit();
    astro_rate_limit_enforce(
        $pdo,
        AI_ASTROLOGER_RATE_BUCKET,
        (string) $user['id'],
        $limit,
        AI_ASTROLOGER_WINDOW_SECONDS,
        'You have reached today\'s question limit. Please come back tomorrow - your earlier answers are saved in this chat.'
    );

    $language = astro_normalize_report_language((string) ($body['language'] ?? $session['language']));
    $startedAt = microtime(true);

    // 1. Store the question BEFORE doing anything slow. If the model call dies
    //    the customer's words are already safe.
    $questionId = astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'customer', $language, $question);

    try {
        // 2. Retrieve, then generate. Both are server-side; no key reaches the
        //    browser. See knowledge/ai-astrologer/prompt/system-prompt.md.
        $reply = astro_ai_generate_reply($pdo, $user, $session, $language, $question);

        // NOTE: no astro_rate_limit_bump() here. astro_rate_limit_enforce() above
        // already counted this request (enforce -> hit -> upsert). Bumping again
        // would charge the customer two questions for one answer.

        $replyId = astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'assistant', $language, $reply['content'], [
            'area_id' => $reply['areaId'] ?? null,
            'sources' => $reply['sourceLine'] ?? null,
            'status' => 'SENT',
            'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        jsonResponse([
            'success' => true,
            'sessionId' => $sessionId,
            'questionId' => $questionId,
            'messageId' => $replyId,
            'language' => $language,
            'content' => $reply['content'],
            'bubbles' => $reply['bubbles'] ?? [],
            'sources' => $reply['sourceLine'] ?? '',
            'areaId' => $reply['areaId'] ?? null,
            'handoff' => (bool) ($reply['handoff'] ?? false),
            'latencyMs' => (int) round((microtime(true) - $startedAt) * 1000),
            'remainingToday' => max(0, $limit - astro_ai_usage_count($pdo, (string) $user['id']) ),
        ]);
    } catch (Throwable $e) {
        error_log('AI Astrologer generation failed: ' . $e->getMessage());

        // Record the failure as its own row. The customer's question stays, and
        // the FAILED row is what lets a retry be linked back to it.
        astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'assistant', $language,
            'Please give me a moment, I am checking again.', [
                'status' => 'FAILED',
                'error_message' => mb_substr($e->getMessage(), 0, 500, 'UTF-8'),
                'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ]);

        // The question did not consume an allowance: the customer got no answer.
        jsonResponse([
            'success' => false,
            'code' => 'GENERATION_FAILED',
            'questionId' => $questionId,
            'message' => 'Please give me a moment, I am checking again.',
            'retry' => true,
        ], 503);
    }
}

function astro_ai_action_upload(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);
    require_once __DIR__ . '/astrology/ai_report_extract.php';

    $sessionId = trim((string) ($body['sessionId'] ?? ''));
    $session = astro_ai_load_session($pdo, $sessionId, $user['id']);
    if (!$session) {
        jsonResponse(['success' => false, 'code' => 'SESSION_NOT_FOUND', 'message' => 'That conversation was not found.'], 404);
    }

    if (empty($_FILES['report']) || !is_uploaded_file($_FILES['report']['tmp_name'] ?? '')) {
        jsonResponse(['success' => false, 'code' => 'MISSING_FILE', 'message' => 'No file was received.'], 400);
    }
    $file = $_FILES['report'];
    $size = (int) ($file['size'] ?? 0);
    $filename = basename((string) ($file['name'] ?? 'report.pdf'));

    $language = astro_normalize_report_language((string) ($session['language'] ?? 'ta'));

    $accept = function (string $kind, ?string $orderNumber) use ($pdo, $sessionId, $user, $language, $filename, $size) {
        astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'system', $language,
            AstroAiReportExtract::rejectionText($kind, $language), [
                'attachment_kind' => 'pdf',
                'attachment_filename' => $filename,
                'attachment_bytes' => $size,
                'attachment_order_number' => $orderNumber,
                'attachment_rejection' => $kind,
            ]);
        jsonResponse([
            'success' => false,
            'code' => strtoupper($kind),
            'message' => AstroAiReportExtract::rejectionText($kind, $language),
        ], 422);
    };

    if ($size > AI_ASTROLOGER_MAX_UPLOAD_BYTES) {
        $accept('tooLarge', null);
    }
    if (strtolower((string) pathinfo($filename, PATHINFO_EXTENSION)) !== 'pdf') {
        $accept('unreadable', null);
    }

    // Extract, then gate. The PDF is an ownership token, not the explanation -
    // see knowledge/ai-astrologer/rules/report-sections.json.
    $extracted = AstroAiReportExtract::extractPdfText((string) $file['tmp_name']);
    $orders = AstroAiReportExtract::customerOrders($pdo, (int) $user['id']);

    $decision = AstroAiReportExtract::decideAcceptance(
        (string) $extracted['text'],
        $filename,
        $orders['all'],
        $orders['paid'],
        $size
    );

    if (!$decision['accepted']) {
        error_log('AI Astrologer upload refused: ' . $decision['reason']);
        $accept((string) $decision['rejection'], $decision['orderNumber']);
    }

    // Accepted. Bind the session to this order so later questions use its chart,
    // and record the accepted attachment. The PDF itself is NOT stored.
    $orderNumber = (string) $decision['orderNumber'];
    $stmt = $pdo->prepare("SELECT id, service_type FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$orderNumber, $user['id']]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $bind = $pdo->prepare(
        "UPDATE ai_chat_sessions SET order_id = ?, order_number = ?, service_type = ? WHERE id = ? AND user_id = ?"
    );
    $bind->execute([$order['id'] ?? null, $orderNumber, $order['service_type'] ?? null, $sessionId, $user['id']]);

    astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'system', $language,
        $language === 'ta' ? 'உங்கள் அறிக்கையை இணைத்துவிட்டேன். எந்த பகுதியை விளக்க வேண்டும்?'
            : ($language === 'hi' ? 'मैंने आपकी रिपोर्ट जोड़ दी है। कौन सा हिस्सा समझाऊँ?'
            : 'I have attached your report. Which part would you like me to explain?'), [
            'attachment_kind' => 'pdf',
            'attachment_filename' => $filename,
            'attachment_bytes' => $size,
            'attachment_order_number' => $orderNumber,
            'status' => 'SENT',
        ]);

    $type = $decision['type'] ?? null;
    jsonResponse([
        'success' => true,
        'sessionId' => $sessionId,
        'orderNumber' => $orderNumber,
        'serviceType' => $order['service_type'] ?? null,
        'reportType' => $type['id'] ?? null,
        'sections' => array_map(function ($s) use ($language) {
            return ['id' => $s['id'], 'title' => $s['title'][$language] ?? $s['title']['en'], 'page' => $s['page']];
        }, $type['sections'] ?? []),
    ]);
}

function astro_ai_action_handoff(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);

    $question = trim((string) ($body['question'] ?? ''));
    if ($question === '') {
        jsonResponse(['success' => false, 'code' => 'MISSING_QUESTION',
            'message' => 'Please tell our astrologer what you would like help with.'], 400);
    }

    $sessionId = trim((string) ($body['sessionId'] ?? '')) ?: null;
    $session = $sessionId ? astro_ai_load_session($pdo, $sessionId, (string) $user['id']) : null;

    $stmt = $pdo->prepare(
        "INSERT INTO ai_chat_handoffs
            (session_id, user_id, user_name, user_email, user_mobile, language, question, reason, order_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $sessionId,
        $user['id'],
        $user['name'],
        $user['email'] ?? null,
        $user['mobile'] ?? null,
        astro_normalize_report_language((string) ($body['language'] ?? ($session['language'] ?? 'ta'))),
        $question,
        (string) ($body['reason'] ?? 'requested'),
        $session['order_number'] ?? null,
    ]);

    if ($session) {
        astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'handoff', $session['language'], $question, [
            'status' => 'SENT',
        ]);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Thank you. Our astrologer has your question and will reply to you directly.',
        'message_ta' => 'நன்றி. உங்கள் கேள்வி எங்கள் ஜோதிடரிடம் சென்றுவிட்டது; அவர்கள் நேரடியாக பதிலளிப்பார்கள்.',
        'message_hi' => 'धन्यवाद। आपका प्रश्न हमारे ज्योतिषी तक पहुँच गया है; वे सीधे उत्तर देंगे।',
    ], 201);
}

function astro_ai_usage_count(PDO $pdo, string $userId): int
{
    $row = astro_rate_limit_fetch($pdo, astro_rate_limit_key(AI_ASTROLOGER_RATE_BUCKET, $userId));
    if (!$row) {
        return 0;
    }
    // astro_rate_limit_fetch() does not know about window expiry, so a stale row
    // would otherwise report yesterday's usage as today's.
    if ($row['windowStartedAt'] <= time() - AI_ASTROLOGER_WINDOW_SECONDS) {
        return 0;
    }
    return (int) $row['hits'];
}

function astro_ai_action_usage(PDO $pdo, array $user): void
{
    astro_ai_ensure_tables($pdo);
    $used = astro_ai_usage_count($pdo, (string) $user['id']);
    $limit = astro_ai_daily_limit();
    jsonResponse([
        'success' => true,
        'used' => $used,
        'limit' => $limit,
        'remaining' => max(0, $limit - $used),
        'windowSeconds' => AI_ASTROLOGER_WINDOW_SECONDS,
    ]);
}

/* ================================================================== */
/* Generation — the only place a model is called                      */
/* ================================================================== */

/**
 * Builds the reply. All of it happens server-side: retrieval from the knowledge
 * base, prompt assembly, the model call and the output guard. No key reaches the
 * browser. Throws on failure so the caller records a FAILED row.
 *
 * @return array{content:string, bubbles:array, sourceLine:?string, areaId:?string, handoff:bool}
 */
function astro_ai_generate_reply(PDO $pdo, array $user, array $session, string $language, string $question): array
{
    // The chart comes from the order bound to this session, rebuilt from the
    // saved inputs - never from a cached calculated_result.
    $chart = null;
    $context = [
        'customerName' => (string) ($user['name'] ?? 'there'),
        'orderTitle' => 'your report',
        'dashaEndDate' => null,
    ];

    if (!empty($session['order_id'])) {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$session['order_id'], $user['id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($order) {
            $context['orderTitle'] = (string) ($order['service_type'] ?? 'your report');
            $facts = astro_ai_chart_facts($order);
            if ($facts !== null) {
                $chart = $facts['chart'];
                $context['chartHeader'] = $facts['header'];
                $context['dashaEndDate'] = $facts['dashaEndDate'];
            }
        }
    }

    if (!isset($context['chartHeader'])) {
        $context['chartHeader'] = $language === 'ta'
            ? 'இந்த உரையாடலுடன் இன்னும் ஜாதகம் இணைக்கப்படவில்லை.'
            : $language === 'hi'
                ? 'इस बातचीत से अभी कोई कुंडली नहीं जुड़ी है।'
                : 'No chart is attached to this conversation yet.';
    }

    $history = astro_ai_recent_messages($pdo, $session['id']);
    $context['chatHistory'] = $history
        ? implode(' | ', array_map(function ($m) {
            return $m['role'] . ': ' . mb_substr((string) $m['content'], 0, 120, 'UTF-8');
        }, $history))
        : '(this is the first message)';

    return AstroAiProvider::answer($question, $language, $history, $chart, $context);
}

/**
 * Flattens a stored order into the small chart shape the retrieval layer reads.
 * Returns null when the order cannot be calculated, which makes every
 * chart-dependent rule decline to fire rather than guess.
 *
 * @return array{chart:array, header:string, dashaEndDate:?string}|null
 */
function astro_ai_chart_facts(array $order): ?array
{
    try {
        require_once __DIR__ . '/astrology/engine.php';
        if (!class_exists('AstroEngine')) {
            return null;
        }
        $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
    } catch (Throwable $e) {
        error_log('AI Astrologer: chart rebuild failed for order '
            . ($order['order_number'] ?? '?') . ': ' . $e->getMessage());
        return null;
    }
    if (!is_array($result)) {
        return null;
    }

    // Only the handful of facts the rule conditions read are needed. Anything
    // absent stays absent, which is what stops a partial chart from inventing a
    // finding. Field names are read defensively because the engine's result is
    // shaped for the report, not for this layer.
    $chart = [
        'lagna' => (string) ($result['lagnaSign'] ?? ''),
        'moonSign' => (string) ($result['chandraRasi'] ?? ($result['moonSign'] ?? '')),
        'moonNakshatra' => (string) ($result['janmaNakshatra'] ?? ''),
        'moonNakshatraLord' => (string) ($result['nakshatraLord'] ?? ''),
        'currentDasha' => (string) ($result['currentDasha'] ?? ''),
        'currentAntardasha' => (string) ($result['currentBhukti'] ?? ($result['currentAntardasha'] ?? '')),
        'dashaEndDate' => (string) ($result['dashaEndDate'] ?? ''),
        'planetHouse' => is_array($result['planetHouses'] ?? null) ? $result['planetHouses'] : [],
        'lordHouse' => is_array($result['houseLords'] ?? null) ? $result['houseLords'] : [],
        'dignity' => is_array($result['dignities'] ?? null) ? $result['dignities'] : [],
        'saniTransitFromMoon' => (int) ($result['saniFromMoon'] ?? 0),
        'doshas' => is_array($result['doshas'] ?? null) ? array_keys(array_filter($result['doshas'])) : [],
    ];

    $lang = astro_normalize_report_language((string) ($order['language'] ?? 'ta'));
    $label = $lang === 'ta' ? 'உங்கள் ஜாதகம்' : ($lang === 'hi' ? 'आपकी कुंडली' : 'Your chart');
    $header = $label . ': ' . $chart['lagna'] . ' / ' . $chart['moonSign'] . ' / ' . $chart['moonNakshatra'] . "\n"
        . ($lang === 'ta' ? 'தசை' : $lang === 'hi' ? 'दशा' : 'Dasha') . ' ' . $chart['currentDasha']
        . ' / ' . $chart['currentAntardasha']
        . ($chart['dashaEndDate'] !== '' ? ' (' . $chart['dashaEndDate'] . ')' : '');

    return ['chart' => $chart, 'header' => $header, 'dashaEndDate' => $chart['dashaEndDate'] ?: null];
}

/* ================================================================== */
/* Dispatch                                                           */
/* ================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

try {
    $pdo = getDbConnection();

    // BOTH GATES, on every action, before anything else.
    $user = astro_ai_gate($pdo);

    $action = strtolower((string) ($_GET['action'] ?? ($_POST['action'] ?? '')));
    $rawBody = file_get_contents('php://input');
    $body = [];
    if (is_string($rawBody) && $rawBody !== '') {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded)) {
            $body = $decoded;
        }
    }
    foreach ($_POST as $k => $v) {
        if (!isset($body[$k])) {
            $body[$k] = $v;
        }
    }

    switch ($action) {
        case 'session':
            astro_ai_action_session($pdo, $user, $body);
            break;
        case 'history':
            astro_ai_action_history($pdo, $user, $body);
            break;
        case 'ask':
            astro_ai_action_ask($pdo, $user, $body);
            break;
        case 'upload':
            astro_ai_action_upload($pdo, $user, $body);
            break;
        case 'handoff':
            astro_ai_action_handoff($pdo, $user, $body);
            break;
        case 'usage':
            astro_ai_action_usage($pdo, $user);
            break;
        default:
            jsonResponse(['success' => false, 'message' => 'Unknown action.'], 400);
    }
} catch (Throwable $e) {
    error_log('AI Astrologer endpoint error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Something went wrong. Please try again.'], 500);
}
