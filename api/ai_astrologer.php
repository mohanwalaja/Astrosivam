<?php
/**
 * ASTRO SIVAM AI Astrologer — customer and admin chat endpoint.
 * -------------------------------------------------------------
 * POST /api/ai_astrologer.php?action=...
 *
 * ACTIONS
 *   session            create a conversation, optionally bound to an order
 *   history            the messages of the signed-in account's own sessions
 *   options            the guided question menu (categories + curated options)
 *   bind               attach one of the customer's own delivered reports to
 *                      this conversation (or detach it)
 *   ask                send a questionId picked from options, get an answer
 *   upload             attach an ASTRO SIVAM report PDF (Part 3 gate)
 *   handoff            "Talk to our astrologer"
 *   usage              today's customer allowance (admins are unlimited)
 *   diagnose           admin-only: check the local source-based reply path
 *
 * GUIDED MODE
 * Customers never type a question: the client fetches `options` and sends
 * `ask` with a questionId from that menu. The server resolves the canonical
 * wording and routes it to one supported answer path (life-area card, the
 * customer's own service report, dosha, remedy, order fact, or the human
 * complaint queue). Free-text `question` is accepted from administrators
 * only, for testing. The only free text a customer can send is the short
 * `complaintDetails` line on complaint options, which is queued to the human
 * team and never answered by rules.
 *
 * The Wedding Matching, Baby Naming and Subha Muhurtham chapters are served
 * only to a customer who already holds a delivered report of that service,
 * and they are answered by reading that report (never re-judging it). The
 * customer attaches the report with `bind`; a question about a report that is
 * not attached says so plainly instead of inventing an answer.
 *
 * IF THE CHAT NEVER REPLIES, READ THIS FIRST
 * Replies are local-only: this endpoint never calls an external AI service
 * and never needs an API key. If the chat cannot answer, sign in as an admin
 * and run /api/ai_astrologer.php?action=diagnose to check PHP extensions and
 * the deployed knowledge/ files. See AI_CHAT_NOT_REPLYING_FIX.md.
 *
 * ACCESS GATES — READ BEFORE EDITING
 * Authentication and entitlement checks run in PHP on EVERY action, including
 * read-only ones; the client is never trusted to decide who can use the chat:
 *
 *   1. requireAuth()       — a signed-in account, with the token_version check
 *                            that api/config.php already applies.
 *   2. Customer entitlement — customers need a delivered report (a paid order
 *                            or the free-beta first report). Admins are exempt
 *                            from payment and daily-usage gates.
 *
 * A free-beta first report qualifies for customer access exactly like a paid
 * order once it has been delivered. An order that is
 * PENDING, PROCESSING, REJECTED or CANCELLED does not qualify. A refunded order
 * does not qualify. Admin access is based only on the persisted database role.
 *
 * VERIFICATION STATUS: this file's HTTP dispatch is not executed in the build
 * sandbox (there is no native `php` binary or database here). The local reply
 * builder and chart path are exercised under the wasm PHP runtime:
 *   node scripts/php-ai-provider-check.mjs tests/fixtures/php-ai-probes/knowledge-base-mode.php
 * The gates, migration and schema contracts are checked by
 * tests/ai-astrologer-access.test.ts. Smoke-test the dispatch on the server
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

/** The account role is loaded from the database by requireAuth(). */
function astro_ai_is_admin(array $user): bool
{
    return strtolower(trim((string) ($user['role'] ?? ''))) === 'admin';
}

/**
 * GATE 2 — customers need a current delivered-report entitlement (a paid order
 * or the free-beta first report); admins are exempt.
 *
 * Deliberately a single indexed lookup rather than loading the orders: this runs
 * on every customer request, including history reads, so it must stay cheap on
 * shared hosting. An authenticated administrator always has access and does
 * not need a paid order.
 */
function astro_ai_require_paid_order(PDO $pdo, array $user): array
{
    if (astro_ai_is_admin($user)) {
        return $user;
    }

    $entitlement = astro_ai_chat_entitlement($pdo, $user['id']);

    if (!$entitlement['allowed']) {
        // Trilingual, because the customer may have been browsing in any of the
        // three. Never reveals that a specific order was found and rejected.
        $copy = astro_ai_entitlement_copy($entitlement['code'], $entitlement);
        jsonResponse([
            'success' => false,
            'code' => $entitlement['code'],
            'message' => $copy['en'],
            'message_ta' => $copy['ta'],
            'message_hi' => $copy['hi'],
            'dashboardUrl' => '/customer/dashboard',
            // Days left, so the UI can say "4 days left on this report's chat".
            // Zero once expired.
            'daysRemaining' => $entitlement['daysRemaining'],
            'expiresAt' => $entitlement['expiresAt'],
        ], 403);
    }

    return $user;
}

/**
 * How long the AI chat stays available for a report.
 *
 * Owner rule: the chat stays live for 7 days, starting on the day the report
 * email was delivered, then it disables. A new paid order starts a fresh window.
 *
 * Two decisions that shape this:
 *  - the clock starts at orders.email_sent_at, the real delivery timestamp, not
 *    the order or payment date
 *  - the NEWEST delivered order wins. An older order still inside its own window
 *    does not extend anything.
 *
 * email_sent_at is NULL when the report has not been emailed yet (or the email
 * job failed). That order simply has no window yet - which is correct, because
 * the customer has not received the report the chat would discuss.
 */
define('ASTRO_AI_CHAT_WINDOW_DAYS', 7);

/**
 * @return array{allowed: bool, code: string, daysRemaining: int, expiresAt: ?string,
 *                orderId: ?string, orderNumber: ?string, serviceType: ?string}
 */
function astro_ai_chat_entitlement(PDO $pdo, string $userId): array
{
    $denied = static function (string $code): array {
        return [
            'allowed' => false,
            'code' => $code,
            'daysRemaining' => 0,
            'expiresAt' => null,
            'orderId' => null,
            'orderNumber' => null,
            'serviceType' => null,
        ];
    };

    // Newest delivered order (paid or free-beta first report). Ordering by
    // email_sent_at DESC is what makes "newest order wins" true: we only ever
    // look at the one that would expire last, so an old order cannot keep the
    // chat alive.
    $stmt = $pdo->prepare(
        "SELECT id, order_number, service_type, email_sent_at
           FROM orders
          WHERE user_id = :uid
            AND payment_confirmed = 1
            AND status IN ('COMPLETED', 'PROCESSING')
            AND (refund_status IS NULL OR refund_status = 'NONE')
            AND email_status = 'SENT'
            AND email_sent_at IS NOT NULL
          ORDER BY email_sent_at DESC
          LIMIT 1"
    );
    $stmt->execute([':uid' => $userId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        // Either no qualifying order at all, or one that has not been delivered
        // yet. Distinguishing them only for the server log - the customer sees
        // the same message either way, so the endpoint never leaks which it was.
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) AS c
               FROM orders
              WHERE user_id = :uid
                AND payment_confirmed = 1
                AND status IN ('COMPLETED', 'PROCESSING')
                AND (refund_status IS NULL OR refund_status = 'NONE')"
        );
        $countStmt->execute([':uid' => $userId]);
        $paid = (int) ((array) $countStmt->fetch(PDO::FETCH_ASSOC))['c'];
        return $denied($paid > 0 ? 'REPORT_NOT_DELIVERED' : 'NO_PAID_ORDER');
    }

    $sentAt = strtotime((string) $order['email_sent_at']);
    if ($sentAt === false) {
        // An unparseable timestamp must not open the chat.
        error_log('astro_ai_chat_entitlement: unparseable email_sent_at for user ' . $userId);
        return $denied('REPORT_NOT_DELIVERED');
    }

    $expiresAt = $sentAt + (ASTRO_AI_CHAT_WINDOW_DAYS * 86400);
    $now = time();

    if ($now >= $expiresAt) {
        $expired = $denied('CHAT_WINDOW_EXPIRED');
        $expired['orderId'] = (string) $order['id'];
        $expired['orderNumber'] = (string) $order['order_number'];
        $expired['serviceType'] = (string) $order['service_type'];
        return $expired;
    }

    $secondsLeft = $expiresAt - $now;
    // Round UP so a customer on day 1 of 7 sees 7, not 6.
    return [
        'allowed' => true,
        'code' => 'OK',
        'daysRemaining' => (int) ceil($secondsLeft / 86400),
        'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $expiresAt),
        'orderId' => (string) $order['id'],
        'orderNumber' => (string) $order['order_number'],
        'serviceType' => (string) $order['service_type'],
    ];
}

/** Trilingual wording for each refusal, kept next to the codes that use it. */
function astro_ai_entitlement_copy(string $code, array $entitlement): array
{
    if ($code === 'REPORT_NOT_DELIVERED') {
        return [
            'en' => 'Your report has not been delivered yet. The astrologer chat opens as soon as '
                . 'your report email is sent.',
            'ta' => 'உங்கள் அறிக்கை இன்னும் அனுப்பப்படவில்லை. அறிக்கை மின்னஞ்சல் சென்றவுடன் '
                . 'ஜோதிடர் உரையாடல் தொடங்கும்.',
            'hi' => 'आपकी रिपोर्ट अभी नहीं भेजी गई है। रिपोर्ट ईमेल भेजते ही ज्योतिषी चैट शुरू हो जाएगी।',
        ];
    }

    if ($code === 'CHAT_WINDOW_EXPIRED') {
        return [
            'en' => 'The 7-day astrologer chat period for this report has ended. '
                . 'Place a new order and the chat opens again.',
            'ta' => 'இந்த அறிக்கைக்கான 7 நாள் ஜோதிடர் உரையாடல் காலம் முடிந்தது. '
                . 'புதிய ஆர்டர் செய்தால் மீண்டும் தொடங்கும்.',
            'hi' => 'इस रिपोर्ट के लिए 7 दिन की ज्योतिषी चैट अवधि समाप्त हो गई है। '
                . 'नया ऑर्डर करने पर चैट फिर शुरू हो जाएगी।',
        ];
    }

    return [
        'en' => 'The astrologer chat is available to customers with a completed report. '
            . 'Once your order is complete, I will be here.',
        'ta' => 'முடிந்த அறிக்கை உள்ள வாடிக்கையாளர்களுக்கு மட்டுமே ஜோதிடர் உரையாடல் கிடைக்கும். '
            . 'உங்கள் ஆர்டர் முடிந்ததும் நான் இங்கே இருப்பேன்.',
        'hi' => 'ज्योतिषी चैट उन ग्राहकों के लिए उपलब्ध है जिनकी रिपोर्ट पूरी हो चुकी है। '
            . 'आपका ऑर्डर पूरा होते ही मैं यहाँ रहूँगा।',
    ];
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

/**
 * Split the small, checked-in chat migration into statements.
 *
 * Strip full-line SQL comments before splitting: the migration's documentation
 * contains semicolons, and splitting first would truncate CREATE TABLE blocks
 * (then silently leave the chat tables missing on a fresh database).
 */
function astro_ai_migration_statements(string $sql): array
{
    $sql = preg_replace('/^[[:blank:]]*--.*$/m', '', $sql);
    if (!is_string($sql)) {
        throw new RuntimeException('AI Astrologer schema comments could not be parsed.');
    }

    $statements = [];
    foreach (explode(';', $sql) as $statement) {
        $statement = trim($statement);
        if ($statement !== '') {
            $statements[] = $statement;
        }
    }
    return $statements;
}

/** Create the chat tables if the migration has not been run yet. */
function astro_ai_ensure_tables(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $path = __DIR__ . '/migrations/007_ai_astrologer_chat.sql';
    $sql = @file_get_contents($path);
    if (!is_string($sql) || trim($sql) === '') {
        throw new RuntimeException('AI Astrologer chat schema migration is missing or empty.');
    }

    foreach (astro_ai_migration_statements($sql) as $statement) {
        // The migration uses CREATE TABLE IF NOT EXISTS, so a deployed schema is
        // already a successful no-op. Let real DDL/permission errors surface
        // instead of swallowing them and failing later on an INSERT.
        $pdo->exec($statement);
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
 * The recent conversation, oldest first, capped for efficient history paging.
 * The full conversation remains available through history(); customer replies
 * are built from the current question and local chart/source data.
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

    $isAdmin = astro_ai_is_admin($user);
    $orderId = trim((string) ($body['orderId'] ?? ''));
    $orderNumber = null;
    $serviceType = null;

    if ($orderId !== '') {
        // A report-specific chat can only bind to this account's delivered
        // report (paid or free-beta first report).
        $stmt = $pdo->prepare(
            "SELECT id, order_number, service_type, email_sent_at
               FROM orders
              WHERE id = ? AND user_id = ? AND payment_confirmed = 1
                AND status IN ('COMPLETED', 'PROCESSING')
                AND (refund_status IS NULL OR refund_status = 'NONE')
                AND email_status = 'SENT'
                AND email_sent_at IS NOT NULL
              LIMIT 1"
        );
        $stmt->execute([$orderId, $user['id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            jsonResponse(['success' => false, 'code' => 'ORDER_NOT_FOUND',
                'message' => 'I could not find that delivered report on your account.'], 404);
        }

        $sentAt = strtotime((string) $order['email_sent_at']);
        if ($sentAt === false || (!$isAdmin && time() >= $sentAt + (ASTRO_AI_CHAT_WINDOW_DAYS * 86400))) {
            $copy = astro_ai_entitlement_copy('CHAT_WINDOW_EXPIRED', []);
            jsonResponse(['success' => false, 'code' => 'CHAT_WINDOW_EXPIRED', 'message' => $copy['en']], 403);
        }

        $orderId = (string) $order['id'];
        $orderNumber = (string) $order['order_number'];
        $serviceType = (string) $order['service_type'];
    }

    if ($orderId === '' && !$isAdmin) {
        // The floating launcher starts a general session with the newest report
        // that opened access, so its first answer has the customer's chart.
        $entitlement = astro_ai_chat_entitlement($pdo, (string) $user['id']);
        if (!$entitlement['allowed'] || empty($entitlement['orderId'])) {
            $copy = astro_ai_entitlement_copy($entitlement['code'], $entitlement);
            jsonResponse([
                'success' => false,
                'code' => $entitlement['code'],
                'message' => $copy['en'],
                'message_ta' => $copy['ta'],
                'message_hi' => $copy['hi'],
            ], 403);
        }
        $orderId = (string) $entitlement['orderId'];
        $orderNumber = $entitlement['orderNumber'];
        $serviceType = $entitlement['serviceType'];
    }

    $language = astro_normalize_report_language((string) ($body['language'] ?? (($user['country'] ?? '') === 'India' ? 'hi' : 'ta')));
    $sessionId = astro_ai_new_session_id();

    $stmt = $pdo->prepare(
        "INSERT INTO ai_chat_sessions (id, user_id, language, order_id, order_number, service_type)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$sessionId, $user['id'], $language, $orderId !== '' ? $orderId : null, $orderNumber, $serviceType]);

    // Real delivery timestamp, so the client can greet the customer with the
    // report that just opened this chat.
    $deliveredAt = null;
    if ($orderId !== '') {
        $dStmt = $pdo->prepare("SELECT email_sent_at FROM orders WHERE id = ? LIMIT 1");
        $dStmt->execute([$orderId]);
        $deliveredAt = $dStmt->fetchColumn() ?: null;
    }

    jsonResponse([
        'success' => true,
        'sessionId' => $sessionId,
        'language' => $language,
        'orderNumber' => $orderNumber,
        'serviceType' => $serviceType,
        'deliveredAt' => $deliveredAt,
        'dailyLimit' => $isAdmin ? null : astro_ai_daily_limit(),
        'unlimited' => $isAdmin,
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

    // Fail fast only when the local answer path cannot run. This chat never
    // calls a model provider and never requires an API key.
    if (!AstroAiProvider::canAnswer()) {
        $diag = AstroAiProvider::diagnostics(false);
        error_log('Source-based astrologer: ask refused - local knowledge unavailable. Blocking: '
            . (implode(', ', $diag['blocking']) ?: 'unknown')
            . '. Run /api/ai_astrologer.php?action=diagnose as an admin for the full report.');
        jsonResponse(['success' => false, 'code' => 'LOCAL_KNOWLEDGE_UNAVAILABLE',
            'message' => 'The local astrology knowledge base is missing on this server. '
                . 'Upload the knowledge/ folder to the website root (see deploy_cpanel.sh), then try again.',
            'message_ta' => 'உள்ளூர் ஜோதிட அறிவுத் தளம் இந்த சர்வரில் இல்லை. '
                . 'நிர்வாகி knowledge/ கோப்புறையை பதிவேற்ற வேண்டும்.',
            'message_hi' => 'स्थानीय ज्योतिष ज्ञान-आधार इस सर्वर पर नहीं है। '
                . 'एडमिन को knowledge/ फ़ोल्डर अपलोड करना होगा।',
            'blocking' => $diag['blocking'],
            // Only an administrator can do anything with this, and the client
            // only shows it to one. The customer keeps seeing the short retry
            // wording, never a setup instruction.
            'diagnose' => astro_ai_is_admin($user) ? $diag : null,
        ], 503);
    }

    $sessionId = trim((string) ($body['sessionId'] ?? ''));
    $guidedId = trim((string) ($body['questionId'] ?? ''));

    if ($sessionId === '') {
        jsonResponse(['success' => false, 'code' => 'MISSING_FIELDS',
            'message' => 'sessionId is required.'], 400);
    }

    $session = astro_ai_load_session($pdo, $sessionId, $user['id']);
    if (!$session) {
        jsonResponse(['success' => false, 'code' => 'SESSION_NOT_FOUND', 'message' => 'That conversation was not found.'], 404);
    }
    if ($session['status'] === 'CLOSED') {
        jsonResponse(['success' => false, 'code' => 'SESSION_CLOSED',
            'message' => 'That conversation is closed. Please start a new one.'], 409);
    }

    // GUIDED MODE — customers pick a curated option, they never type a
    // question. The allowlist lives in
    // knowledge/ai-astrologer/rules/guided-questions.json. Administrators keep
    // free text so they can test the reply path; customers without a valid
    // questionId are refused, which is what makes unrelated questions
    // impossible rather than merely discouraged.
    $isAdmin = astro_ai_is_admin($user);
    $guided = null;
    if ($guidedId !== '') {
        $guided = astro_ai_guided_find($guidedId);
        if ($guided === null) {
            jsonResponse(['success' => false, 'code' => 'UNKNOWN_QUESTION',
                'message' => 'That option is not available. Please pick a question from the list.',
                'message_ta' => 'அந்த விருப்பம் இல்லை. பட்டியலிலிருந்து ஒரு கேள்வியை தேர்வு செய்யவும்.',
                'message_hi' => 'वह विकल्प उपलब्ध नहीं है। कृपया सूची से कोई प्रश्न चुनें।'], 400);
        }
        // The three service chapters are only for customers who hold that
        // report. The menu already hides them; this keeps a hand-built request
        // from asking about a report the account does not have.
        $required = astro_ai_guided_required_services($guided);
        if ($required !== [] && !$isAdmin) {
            $held = astro_ai_entitled_service_types($pdo, (string) $user['id']);
            $allowed = false;
            foreach ($required as $service) {
                if (in_array(strtoupper(trim($service)), $held, true)) {
                    $allowed = true;
                    break;
                }
            }
            if (!$allowed) {
                jsonResponse(['success' => false, 'code' => 'UNKNOWN_QUESTION',
                    'message' => 'That option is not available. Please pick a question from the list.',
                    'message_ta' => 'அந்த விருப்பம் இல்லை. பட்டியலிலிருந்து ஒரு கேள்வியை தேர்வு செய்யவும்.',
                    'message_hi' => 'वह विकल्प उपलब्ध नहीं है। कृपया सूची से कोई प्रश्न चुनें।'], 400);
            }
        }
    }

    $language = astro_normalize_report_language((string) ($body['language'] ?? $session['language']));

    if ($guided !== null) {
        // The canonical wording of the option, in the customer's language.
        // This is what retrieval matches on, so every guided question carries
        // the keywords of its own answer path in all three languages.
        $question = trim((string) ($guided['text'][$language] ?? ($guided['text']['en'] ?? '')));
        if ($question === '') {
            jsonResponse(['success' => false, 'code' => 'UNKNOWN_QUESTION',
                'message' => 'That option is not available. Please pick a question from the list.'], 400);
        }
    } else {
        if (!$isAdmin) {
            jsonResponse(['success' => false, 'code' => 'GUIDED_ONLY',
                'message' => 'Please pick a question from the list — typing your own question is not available.',
                'message_ta' => 'பட்டியலிலிருந்து ஒரு கேள்வியை தேர்வு செய்யவும் — நீங்களே கேள்வி எழுதும் வசதி இல்லை.',
                'message_hi' => 'कृपया सूची से कोई प्रश्न चुनें — अपना प्रश्न लिखने की सुविधा नहीं है।'], 400);
        }
        $question = trim((string) ($body['question'] ?? ''));
        if ($question === '') {
            jsonResponse(['success' => false, 'code' => 'MISSING_FIELDS',
                'message' => 'questionId or question is required.'], 400);
        }
    }
    if (mb_strlen($question, 'UTF-8') > 2000) {
        jsonResponse(['success' => false, 'code' => 'TOO_LONG',
            'message' => 'Please keep the question under 2000 characters.'], 400);
    }

    // Complaint options may carry a short detail line (the ONLY free text a
    // customer can send). It is stored with the message and queued to the
    // human team; the rule engine never sees it, so it cannot become an
    // unrelated astrology question by the back door.
    $complaintDetails = trim((string) ($body['complaintDetails'] ?? ''));
    if (mb_strlen($complaintDetails, 'UTF-8') > 500) {
        jsonResponse(['success' => false, 'code' => 'TOO_LONG',
            'message' => 'Please keep the details under 500 characters.'], 400);
    }
    $storedQuestion = $question;
    if ($guided !== null && ($guided['kind'] ?? '') === 'complaint' && $complaintDetails !== '') {
        $storedQuestion = $question . "\n" . $complaintDetails;
    }
    $limit = astro_ai_daily_limit();
    if (!$isAdmin) {
        astro_rate_limit_enforce(
            $pdo,
            AI_ASTROLOGER_RATE_BUCKET,
            (string) $user['id'],
            $limit,
            AI_ASTROLOGER_WINDOW_SECONDS,
            'You have reached today\'s question limit. Please come back tomorrow - your earlier answers are saved in this chat.'
        );
    }

    $startedAt = microtime(true);

    // 1. Store the question before building a reply, so the customer's words are safe.
    $questionId = astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'customer', $language, $storedQuestion);

    try {
        // 2. Retrieve the local rules and build a deterministic reply. No external
        //    provider, model call or API key is involved.
        $reply = astro_ai_generate_reply($pdo, $user, $session, $language, $question, $guided);

        // NOTE: no astro_rate_limit_bump() here. For customers,
        // astro_rate_limit_enforce() above already counted this request
        // (enforce -> hit -> upsert); admins intentionally skip that daily cap.

        $replyId = astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'assistant', $language, $reply['content'], [
            'area_id' => $reply['areaId'] ?? null,
            'sources' => $reply['sourceLine'] ?? null,
            'status' => 'SENT',
            'latency_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);

        // 3. Complaints go straight to the admin queue (ai_chat_handoffs),
        //    whatever the local rule engine answered, and the customer sees a visible
        //    confirmation. Non-complaint handoffs (health, declined topics)
        //    only OFFER the astrologer - they are queued when the customer
        //    accepts via the "Talk to our astrologer" button, so the queue
        //    is never flooded with offers nobody confirmed.
        $escalation = astro_ai_escalation_reason($question);
        // Guided complaint/support options (and the birth-detail correction
        // option) always reach the human queue, even when their wording
        // contains none of the complaint keywords above.
        if ($escalation === null && $guided !== null
            && (($guided['escalate'] ?? false) === true || ($guided['kind'] ?? '') === 'complaint')) {
            $escalation = 'complaint';
        }
        $escalated = false;
        $bubbles = $reply['bubbles'] ?? [];
        if ($escalation !== null) {
            astro_ai_record_escalation($pdo, $user, $session, $storedQuestion, $escalation, $language);
            $notice = astro_ai_escalation_notice($language);
            astro_ai_save_message($pdo, $sessionId, (string) $user['id'], 'system', $language, $notice, [
                'status' => 'SENT',
            ]);
            $bubbles[] = $notice;
            $escalated = true;
        }

        jsonResponse([
            'success' => true,
            'sessionId' => $sessionId,
            'questionId' => $questionId,
            'guidedId' => $guidedId !== '' ? $guidedId : null,
            'messageId' => $replyId,
            'language' => $language,
            'content' => $reply['content'],
            'bubbles' => $bubbles,
            'sources' => $reply['sourceLine'] ?? '',
            'areaId' => $reply['areaId'] ?? null,
            'handoff' => (bool) ($reply['handoff'] ?? false) || $escalated,
            'mode' => (string) ($reply['mode'] ?? AstroAiProvider::mode()),
            'escalated' => $escalated,
            'latencyMs' => (int) round((microtime(true) - $startedAt) * 1000),
            'remainingToday' => $isAdmin ? null : max(0, $limit - astro_ai_usage_count($pdo, (string) $user['id'])),
            'unlimited' => $isAdmin,
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

    if (astro_ai_is_admin($user)) {
        jsonResponse([
            'success' => true,
            'used' => null,
            'limit' => null,
            'remaining' => null,
            'unlimited' => true,
            'windowSeconds' => AI_ASTROLOGER_WINDOW_SECONDS,
        ]);
    }

    $used = astro_ai_usage_count($pdo, (string) $user['id']);
    $limit = astro_ai_daily_limit();
    jsonResponse([
        'success' => true,
        'used' => $used,
        'limit' => $limit,
        'remaining' => max(0, $limit - $used),
        'unlimited' => false,
        'windowSeconds' => AI_ASTROLOGER_WINDOW_SECONDS,
    ]);
}

/**
 * WHY THE CHAT IS NOT ANSWERING — the one request that says so.
 *
 * Admin-only. Checks the local reply path (mbstring, JSON knowledge files and
 * the source catalogue). External providers are disabled, and this diagnostic
 * never makes an outbound network request, even if a legacy key is still stored.
 */
function astro_ai_action_diagnose(PDO $pdo, array $user, array $body): void
{
    if (!astro_ai_is_admin($user)) {
        jsonResponse(['success' => false, 'code' => 'ADMIN_ONLY',
            'message' => 'Admin privileges are required to check the local astrology knowledge base.'], 403);
    }

    // Ignore legacy ping requests: this endpoint is permanently local-only.
    $diagnostics = AstroAiProvider::diagnostics(false);

    // The customer-facing view of the same problem: what the last few attempts
    // actually did. A wall of FAILED rows with the same error message is the
    // signature of a configuration problem rather than a slow computation.
    $recentFailures = [];
    try {
        astro_ai_ensure_tables($pdo);
        $stmt = $pdo->query(
            "SELECT status, error_message, latency_ms, created_at
               FROM ai_chat_messages
              WHERE role = 'assistant'
              ORDER BY id DESC
              LIMIT 50"
        );
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        $failed = 0;
        $sent = 0;
        $lastError = null;
        $slowest = 0;
        foreach ($rows as $row) {
            if (($row['status'] ?? '') === 'FAILED') {
                $failed++;
                if (!empty($row['error_message'])) {
                    $lastError = (string) $row['error_message'];
                }
            } else if (($row['status'] ?? '') === 'SENT') {
                $sent++;
            }
            $slowest = max($slowest, (int) ($row['latency_ms'] ?? 0));
        }
        $recentFailures = [
            'window' => count($rows),
            'failed' => $failed,
            'sent' => $sent,
            'lastError' => $lastError,
            'slowestLatencyMs' => $slowest,
        ];
    } catch (Throwable $e) {
        // The chat tables may not exist yet on a fresh install; that is itself
        // worth reporting, but it must not hide the local knowledge checks.
        $recentFailures = ['error' => $e->getMessage()];
    }

    jsonResponse([
        'success' => true,
        'ok' => $diagnostics['ok'],
        'configured' => $diagnostics['configured'],
        'blocking' => $diagnostics['blocking'],
        'checks' => $diagnostics['checks'],
        'ping' => $diagnostics['ping'],
        'sourceRegistry' => $diagnostics['sourceRegistry'],
        'recentMessages' => $recentFailures,
        'generatedAt' => $diagnostics['generatedAt'],
    ]);
}

/* ================================================================== */
/* Guided questions — customers pick, never type                       */
/* ================================================================== */

/**
 * Locates the guided menu. knowledge/ lives at the repository root in
 * development and at the document root on cPanel, with api/knowledge/ as a
 * fallback for manual uploads (same convention as AstroAiProvider::kbPath).
 */
function astro_ai_guided_path(): string
{
    foreach ([
        dirname(__DIR__) . '/knowledge/ai-astrologer/rules/guided-questions.json',
        __DIR__ . '/knowledge/ai-astrologer/rules/guided-questions.json',
    ] as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }
    return dirname(__DIR__) . '/knowledge/ai-astrologer/rules/guided-questions.json';
}

function astro_ai_guided_data(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $path = astro_ai_guided_path();
    $contents = is_file($path) ? @file_get_contents($path) : false;
    $decoded = is_string($contents) ? json_decode($contents, true) : null;
    $cache = is_array($decoded) ? $decoded : [];
    return $cache;
}

/**
 * Finds one curated option by id, or null. This is the server-side
 * allowlist: a questionId that is not in this file is rejected in ask().
 */
function astro_ai_guided_find(string $questionId): ?array
{
    foreach ((astro_ai_guided_data()['categories'] ?? []) as $category) {
        foreach (($category['questions'] ?? []) as $q) {
            if ((string) ($q['id'] ?? '') === $questionId) {
                $q['_category'] = (string) ($category['id'] ?? '');
                $q['_services'] = array_values(array_filter(array_map('strval', (array) ($category['services'] ?? []))));
                return $q;
            }
        }
    }
    return null;
}

/**
 * The service types a curated option needs a delivered report for, or [] when
 * the option is open to every entitled customer (life areas, doshas, remedies,
 * order facts, complaints).
 *
 * @return string[]
 */
function astro_ai_guided_required_services(array $guided): array
{
    return array_values(array_filter(array_map('strval', (array) ($guided['_services'] ?? []))));
}

/**
 * The service types this customer already has a delivered report for.
 *
 * This is what decides whether the Wedding Matching, Baby Naming and Subha
 * Muhurtham chapters appear in the menu: a chapter about a report the
 * customer has never received would only invite a question the chat cannot
 * answer from their own data. The same query as the entitlement gate, minus
 * the 7-day window — a chapter is about the report, not about the chat window.
 *
 * @return string[] e.g. ['BIRTH_JATHAGAM', 'MUHURTHAM']
 */
function astro_ai_entitled_service_types(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT DISTINCT service_type
           FROM orders
          WHERE user_id = :uid
            AND payment_confirmed = 1
            AND status IN ('COMPLETED', 'PROCESSING')
            AND (refund_status IS NULL OR refund_status = 'NONE')
            AND email_status = 'SENT'
            AND email_sent_at IS NOT NULL"
    );
    $stmt->execute([':uid' => $userId]);
    $types = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $t = strtoupper(trim((string) ($row['service_type'] ?? '')));
        if ($t !== '') {
            $types[] = $t;
        }
    }
    return array_values(array_unique($types));
}

/**
 * The reports this conversation may be attached to: the customer's own
 * delivered orders, newest first. Used by the panel's report picker so a
 * customer can move the chat to the report they want to ask about.
 *
 * @return array<int, array{orderNumber:string, serviceType:string, deliveredAt:?string}>
 */
function astro_ai_attachable_orders(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT order_number, service_type, email_sent_at
           FROM orders
          WHERE user_id = :uid
            AND payment_confirmed = 1
            AND status IN ('COMPLETED', 'PROCESSING')
            AND (refund_status IS NULL OR refund_status = 'NONE')
            AND email_status = 'SENT'
            AND email_sent_at IS NOT NULL
          ORDER BY email_sent_at DESC
          LIMIT 50"
    );
    $stmt->execute([':uid' => $userId]);
    $orders = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $orders[] = [
            'orderNumber' => (string) ($row['order_number'] ?? ''),
            'serviceType' => strtoupper(trim((string) ($row['service_type'] ?? ''))),
            'deliveredAt' => $row['email_sent_at'] !== null ? (string) $row['email_sent_at'] : null,
        ];
    }
    return $orders;
}

/**
 * The menu the client renders: categories with their options in the
 * customer's language. Routing metadata (area, service, dosha, planet, topic)
 * stays on the server — the client only ever sends the id back.
 *
 * A category that names `services` (the three service chapters) is served only
 * when the customer holds a delivered report of one of those service types,
 * or to an administrator. The client is never the one that decides: it simply
 * receives fewer chapters.
 */
function astro_ai_guided_menu(string $language, ?array $allowedServices = null, bool $isAdmin = false): array
{
    $lang = in_array($language, ['en', 'ta', 'hi'], true) ? $language : 'en';
    $allowed = [];
    if (is_array($allowedServices)) {
        foreach ($allowedServices as $s) {
            $allowed[strtoupper(trim((string) $s))] = true;
        }
    }
    $menu = [];
    foreach ((astro_ai_guided_data()['categories'] ?? []) as $category) {
        $needs = array_values(array_filter(array_map('strval', (array) ($category['services'] ?? []))));
        if ($needs !== [] && !$isAdmin) {
            $visible = false;
            foreach ($needs as $service) {
                if (isset($allowed[strtoupper(trim($service))])) {
                    $visible = true;
                    break;
                }
            }
            if (!$visible) {
                continue;
            }
        }
        $questions = [];
        foreach (($category['questions'] ?? []) as $q) {
            $questions[] = [
                'id' => (string) ($q['id'] ?? ''),
                'kind' => (string) ($q['kind'] ?? 'area'),
                'text' => (string) ($q['text'][$lang] ?? ($q['text']['en'] ?? '')),
                'needsDetails' => (bool) ($q['needsDetails'] ?? false),
            ];
        }
        $menu[] = [
            'id' => (string) ($category['id'] ?? ''),
            'icon' => (string) ($category['icon'] ?? ''),
            'title' => (string) ($category['title'][$lang] ?? ($category['title']['en'] ?? '')),
            'hint' => (string) ($category['hint'][$lang] ?? ($category['hint']['en'] ?? '')),
            'questions' => $questions,
        ];
    }
    return $menu;
}

function astro_ai_action_options(PDO $pdo, array $user, array $body): void
{
    // Read-only: the menu and the report list are answered from the knowledge
    // files and the orders table, so there is nothing to bootstrap here.
    $language = astro_normalize_report_language((string) ($body['language'] ?? ($_GET['language'] ?? 'ta')));
    $isAdmin = astro_ai_is_admin($user);
    $services = $isAdmin ? [] : astro_ai_entitled_service_types($pdo, (string) $user['id']);
    $menu = astro_ai_guided_menu($language, $services, $isAdmin);
    if (empty($menu)) {
        error_log('AI Astrologer: guided-questions.json is missing or empty at ' . astro_ai_guided_path());
        jsonResponse(['success' => false, 'code' => 'GUIDED_UNAVAILABLE',
            'message' => 'The question list is not available right now. Please try again in a moment.',
            'message_ta' => 'கேள்விப் பட்டியல் இப்போது இல்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.',
            'message_hi' => 'प्रश्न-सूची अभी उपलब्ध नहीं है। कृपया कुछ देर बाद फिर कोशिश करें।'], 503);
    }
    // The reports this conversation can be attached to. The service chapters
    // are only useful once the matching report is attached, and the floating
    // launcher opens with no report bound.
    $orders = $isAdmin ? [] : astro_ai_attachable_orders($pdo, (string) $user['id']);
    foreach ($orders as &$o) {
        $o['title'] = astro_ai_service_title((string) $o['serviceType'], $language);
    }
    unset($o);

    jsonResponse([
        'success' => true,
        'language' => $language,
        'categories' => $menu,
        /** Service types the customer holds a delivered report for (drives the gated chapters). */
        'entitledServices' => $services,
        /** The customer's own delivered reports, attachable to this conversation. */
        'orders' => $orders,
    ]);
}

/** Plain service names for the report picker, in the customer's language. */
function astro_ai_service_title(string $serviceType, string $language): string
{
    $names = [
        'BIRTH_JATHAGAM' => ['en' => 'Birth Jathagam', 'ta' => 'ஜன்ம ஜாதகம்', 'hi' => 'जन्म कुंडली'],
        'MARRIAGE_COMPATIBILITY' => ['en' => 'Wedding Matching', 'ta' => 'திருமணப் பொருத்தம்', 'hi' => 'विवाह मिलान'],
        'BABY_NAMING' => ['en' => 'Baby Naming', 'ta' => 'குழந்தைப் பெயர்', 'hi' => 'नामकरण'],
        'MUHURTHAM' => ['en' => 'Subha Muhurtham', 'ta' => 'சுப முகூர்த்தம்', 'hi' => 'शुभ मुहूर्त'],
        'MULTI_PERSON' => ['en' => 'Family Report', 'ta' => 'குடும்ப அறிக்கை', 'hi' => 'पारिवारिक रिपोर्ट'],
    ];
    $lang = in_array($language, ['en', 'ta', 'hi'], true) ? $language : 'en';
    $map = $names[$serviceType] ?? null;
    return $map ? (string) ($map[$lang] ?? $map['en']) : $serviceType;
}

/**
 * Attaches one of the customer's own delivered reports to this conversation
 * (or detaches it with an empty orderNumber). Nothing here trusts the client:
 * the order must belong to this account and must already have been delivered.
 */
function astro_ai_action_bind(PDO $pdo, array $user, array $body): void
{
    astro_ai_ensure_tables($pdo);

    $sessionId = trim((string) ($body['sessionId'] ?? ''));
    if ($sessionId === '') {
        jsonResponse(['success' => false, 'code' => 'MISSING_FIELDS',
            'message' => 'sessionId is required.'], 400);
    }
    $session = astro_ai_load_session($pdo, $sessionId, $user['id']);
    if (!$session) {
        jsonResponse(['success' => false, 'code' => 'SESSION_NOT_FOUND', 'message' => 'That conversation was not found.'], 404);
    }
    if ($session['status'] === 'CLOSED') {
        jsonResponse(['success' => false, 'code' => 'SESSION_CLOSED',
            'message' => 'That conversation is closed. Please start a new one.'], 409);
    }

    $orderNumber = trim((string) ($body['orderNumber'] ?? ''));
    $serviceType = null;
    $orderId = null;

    if ($orderNumber !== '') {
        // Ownership AND delivery, in the query itself - an undelivered or
        // someone else's order cannot become the chart this chat discusses.
        $stmt = $pdo->prepare(
            "SELECT id, service_type, order_number
               FROM orders
              WHERE order_number = :num
                AND user_id = :uid
                AND payment_confirmed = 1
                AND status IN ('COMPLETED', 'PROCESSING')
                AND (refund_status IS NULL OR refund_status = 'NONE')
                AND email_status = 'SENT'
                AND email_sent_at IS NOT NULL
              LIMIT 1"
        );
        $stmt->execute([':num' => $orderNumber, ':uid' => $user['id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if (!$order) {
            jsonResponse(['success' => false, 'code' => 'ORDER_NOT_FOUND',
                'message' => 'That report is not available for this conversation.'], 404);
        }
        $orderId = (string) ($order['id'] ?? '');
        $serviceType = strtoupper(trim((string) ($order['service_type'] ?? '')));
        $orderNumber = (string) ($order['order_number'] ?? $orderNumber);
    }

    $bind = $pdo->prepare(
        "UPDATE ai_chat_sessions SET order_id = ?, order_number = ?, service_type = ? WHERE id = ? AND user_id = ?"
    );
    $bind->execute([
        $orderId !== '' ? $orderId : null,
        $orderNumber !== '' ? $orderNumber : null,
        $serviceType,
        $sessionId,
        $user['id'],
    ]);

    jsonResponse([
        'success' => true,
        'sessionId' => $sessionId,
        'orderNumber' => $orderNumber !== '' ? $orderNumber : null,
        'serviceType' => $serviceType,
        'serviceTitle' => $serviceType ? astro_ai_service_title($serviceType, (string) ($session['language'] ?? 'ta')) : null,
    ]);
}

/* ================================================================== */
/* Generation — deterministic local knowledge-base reply               */
/* ================================================================== */

/**
 * Rebuilds the customer's chart from their own saved order inputs, then uses
 * only local rules, report readings and remedies to assemble the reply. Throws
 * on a real local setup/runtime failure so the caller records a FAILED row.
 *
 * @param array|null $guided the curated option the customer picked (kind, area,
 *                             dosha, planet, topic), or null for an admin free-text question.
 * @return array{content:string, bubbles:array, sourceLine:?string, areaId:?string, handoff:bool}
 */
function astro_ai_generate_reply(PDO $pdo, array $user, array $session, string $language, string $question, ?array $guided = null): array
{
    // The chart comes from the order bound to this session, rebuilt from the
    // saved inputs - never from a cached calculated_result.
    $chart = null;
    $context = [
        'customerName' => (string) ($user['name'] ?? 'there'),
        'orderTitle' => 'your report',
        'orderDetails' => '(no order attached to this conversation yet)',
        'dashaEndDate' => null,
    ];

    if (!empty($session['order_id'])) {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$session['order_id'], $user['id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($order) {
            $context['orderTitle'] = (string) ($order['service_type'] ?? 'your report');
            $context['orderDetails'] = astro_ai_order_details_text($order);
            // The bound report's own readings, whichever service it is: a
            // natal chart for a Birth Jathagam, the porutham table / birth-pada
            // syllables / muhurtham calendar for the other three.
            $context['boundServiceType'] = strtoupper(trim((string) ($order['service_type'] ?? '')));
            $serviceFacts = astro_ai_service_facts($order);
            if ($serviceFacts !== null) {
                $context['serviceFacts'] = $serviceFacts;
            }
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
            : ($language === 'hi'
                ? 'इस बातचीत से अभी कोई कुंडली नहीं जुड़ी है।'
                : 'No chart is attached to this conversation yet.');
    }

    // The guided option travels inside the context so the local answer
    // builder can route to the right path (area, dosha, remedy, order fact
    // or complaint acknowledgement) without re-guessing from wording.
    $context['guided'] = $guided;
    return AstroAiProvider::answerFromKnowledgeBase($question, $language, $chart, $context);
}

/** Trilingual complaint/escalation keywords. Deliberately broad: missing a
 *  real complaint is worse than an extra queue row for the admin to dismiss. */
function astro_ai_escalation_reason(string $question): ?string
{
    $q = mb_strtolower(trim($question), 'UTF-8');
    $complaintTokens = [
        // English
        'complaint', 'refund', 'money back', 'wrong report', 'incorrect report',
        'not received', "haven't received", 'did not receive', "didn't receive",
        'never received', 'still waiting for my report', 'report missing',
        'overcharged', 'charged twice', 'double charge', 'cheating', 'fraud',
        'scam', 'disappointed with', 'unhappy with', 'not satisfied',
        'poor quality', 'bad service',
        // Tamil
        'புகார்', 'பணம் திருப்பி', 'பணத்தை திருப்பி', 'ரீஃபண்ட்', 'ரிஃபண்ட்',
        'தவறான அறிக்கை', 'கிடைக்கவில்லை', 'மோசடி', 'ஏமாற்றம்',
        'வரவில்லை', 'அனுப்பவில்லை',
        // Hindi
        'शिकायत', 'रिफंड', 'पैसे वापस', 'पैसा वापस', 'गलत रिपोर्ट',
        'रिपोर्ट नहीं मिली', 'नहीं मिली', 'धोखा', 'नाराज', 'दो बार चार्ज',
    ];
    foreach ($complaintTokens as $token) {
        if ($token !== '' && mb_strpos($q, $token, 0, 'UTF-8') !== false) {
            return 'complaint';
        }
    }
    return null;
}

/** Confirmation shown in the chat once a message has reached the admin queue. */
function astro_ai_escalation_notice(string $language): string
{
    if ($language === 'ta') {
        return 'உங்கள் செய்தியை எங்கள் குழுவிடம் அனுப்பிவிட்டேன். அவர்கள் உங்களை விரைவில் தொடர்பு கொள்வார்கள்.';
    }
    if ($language === 'hi') {
        return 'आपका संदेश हमारी टीम को भेज दिया गया है। वे जल्द ही आपसे संपर्क करेंगे।';
    }
    return 'I have forwarded your message to our team. They will get back to you shortly.';
}

/**
 * Pushes the customer's message into the admin escalation queue
 * (ai_chat_handoffs). Best-effort: a queue insert failure must never break
 * the customer's answer - it is logged instead.
 */
function astro_ai_record_escalation(PDO $pdo, array $user, ?array $session, string $question, string $reason, string $language): void
{
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO ai_chat_handoffs
                (session_id, user_id, user_name, user_email, user_mobile, language, question, reason, order_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $session['id'] ?? null,
            (string) $user['id'],
            (string) ($user['name'] ?? 'Unknown'),
            $user['email'] ?? null,
            $user['mobile'] ?? null,
            astro_normalize_report_language($language),
            $question,
            $reason,
            $session['order_number'] ?? null,
        ]);
    } catch (Throwable $e) {
        error_log('AI Astrologer: escalation insert failed: ' . $e->getMessage());
    }
}

/**
 * The customer's own order facts, for answering "where is my report / what
 * did I pay" questions. Only data from their own row - never prices of other
 * services or any discount.
 */
function astro_ai_order_details_text(array $order): string
{
    $parts = [
        'Order number: ' . (string) ($order['order_number'] ?? ''),
        'Service: ' . (string) ($order['service_type'] ?? ''),
    ];
    $amount = (string) ($order['amount'] ?? '');
    if ($amount !== '') {
        $parts[] = 'Amount paid: ' . trim((string) ($order['currency'] ?? '') . ' ' . $amount);
    }
    $parts[] = 'Payment: ' . ((int) ($order['payment_confirmed'] ?? 0) === 1
        ? 'confirmed'
        : (string) ($order['payment_status'] ?? 'pending'));
    $placed = substr((string) ($order['created_at'] ?? ''), 0, 10);
    if ($placed !== '') {
        $parts[] = 'Placed on: ' . $placed;
    }
    $delivered = substr((string) ($order['email_sent_at'] ?? ''), 0, 10);
    if ($delivered !== '') {
        $parts[] = 'Report emailed on: ' . $delivered;
    }
    $parts[] = 'Order status: ' . (string) ($order['status'] ?? '');

    // The birth facts the chart was calculated from, for the "which birth
    // details were used" guided option. Parsed from this order's own saved
    // inputs only; marriage orders carry a bride and a groom instead of one
    // person.
    $rawInput = $order['input_payload'] ?? null;
    $input = is_array($rawInput) ? $rawInput : (is_string($rawInput) ? json_decode($rawInput, true) : null);
    if (is_array($input)) {
        $birthBits = [];
        $single = static function (array $p): string {
            $bits = [];
            foreach (['name' => 'Name', 'dob' => 'Date of birth', 'tob' => 'Time of birth',
                       'birthPlace' => 'Birth place', 'birth_place' => 'Birth place'] as $key => $label) {
                $value = trim((string) ($p[$key] ?? ''));
                if ($value !== '') {
                    $bits[] = $label . ': ' . $value;
                }
            }
            return implode(', ', $bits);
        };
        $one = $single($input);
        if ($one !== '') {
            $birthBits[] = $one;
        }
        foreach (['groom' => 'Groom', 'bride' => 'Bride', 'boy' => 'Boy', 'girl' => 'Girl'] as $key => $label) {
            if (is_array($input[$key] ?? null)) {
                $two = $single($input[$key]);
                if ($two !== '') {
                    $birthBits[] = $label . ' (' . $two . ')';
                }
            }
        }
        if (!empty($birthBits)) {
            $parts[] = 'Birth details used: ' . implode(' | ', $birthBits);
        }
        $reportLang = trim((string) ($order['language'] ?? ''));
        if ($reportLang !== '') {
            $parts[] = 'Report language: ' . $reportLang;
        }
    }

    return implode(' | ', $parts);
}

/**
 * Flattens a stored order into the small chart shape the retrieval layer reads.
 * Returns null when the order cannot be calculated, which makes every
 * chart-dependent rule decline to fire rather than guess.
 *
 * @return array{chart:array, header:string, dashaEndDate:?string}|null
 */
/**
 * The order's own report result, rebuilt from its saved inputs.
 *
 * ONE rebuild per order per request: the natal chart facts and the service
 * readings (matching / naming / muhurtham) both read this, so asking a
 * question never makes the engine calculate the same report twice.
 */
function astro_ai_report_result(array $order): ?array
{
    static $cache = [];
    $key = (string) ($order['id'] ?? '') . '|' . (string) ($order['order_number'] ?? '');

    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    try {
        require_once __DIR__ . '/astrology/engine.php';
        if (!class_exists('AstroEngine')) {
            return $cache[$key] = null;
        }
        $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
    } catch (Throwable $e) {
        error_log('AI Astrologer: report rebuild failed for order '
            . ($order['order_number'] ?? '?') . ': ' . $e->getMessage());
        return $cache[$key] = null;
    }

    return $cache[$key] = is_array($result) ? $result : null;
}

/**
 * The readings of the three non-Jathagam services, read out of the customer's
 * own report result so the chat repeats the report instead of re-judging it.
 *
 * Every value is copied from the engine result in all three languages; nothing
 * here is invented, and nothing is recalculated. A service whose result does
 * not carry its own shape (an old stored result, a failed rebuild, a service
 * type with no chat chapter) returns null, and the answer route then says it
 * cannot read the report instead of guessing.
 *
 * @return array{serviceType:string, matching:?array, naming:?array, muhurtham:?array}|null
 */
function astro_ai_service_facts(array $order): ?array
{
    $service = (string) ($order['service_type'] ?? '');
    if (!in_array($service, ['MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'], true)) {
        return null;
    }
    $result = astro_ai_report_result($order);
    if (!is_array($result)) {
        return null;
    }

    // Some engine fields are strings, others (reasons, doshas) are lists of
    // strings; both flatten to one readable line per language.
    $tri = static function (array $r, string $base): array {
        $flat = static function ($value): string {
            if (is_array($value)) {
                return implode('; ', array_values(array_filter(array_map('strval', $value),
                    static function (string $s): bool { return trim($s) !== ''; })));
            }
            return trim((string) $value);
        };
        $en = $flat($r[$base . 'En'] ?? '');
        return [
            'en' => $en,
            'ta' => $flat($r[$base . 'Ta'] ?? $en),
            'hi' => $flat($r[$base . 'Hi'] ?? $en),
        ];
    };

    if ($service === 'MARRIAGE_COMPATIBILITY') {
        if (!is_array($result['poruthams'] ?? null) || !isset($result['score'], $result['maxScore'])) {
            return null;
        }
        $poruthams = [];
        foreach ($result['poruthams'] as $p) {
            if (!is_array($p)) {
                continue;
            }
            $status = strtoupper((string) ($p['status'] ?? ''));
            if (!in_array($status, ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'], true)) {
                $status = 'PORUNDHADHU';
            }
            $poruthams[] = [
                'key' => (string) ($p['poruthamKey'] ?? ($p['id'] ?? '')),
                'name' => $tri($p, 'name'),
                'points' => (int) ($p['points'] ?? 0),
                'maxPoints' => (int) ($p['maxPoints'] ?? 0),
                'status' => $status,
                'matched' => $status !== 'PORUNDHADHU',
                'full' => $status === 'UTTHAMAM',
                'crucial' => !empty($p['isCrucial']),
                'note' => $tri($p, 'explanation'),
            ];
        }
        $sevvai = is_array($result['sevvayDosham'] ?? null) ? $result['sevvayDosham'] : [];
        return [
            'serviceType' => 'MARRIAGE_COMPATIBILITY',
            'matching' => [
                'groom' => [
                    'name' => (string) ($result['groomName'] ?? ''),
                    'rasi' => $tri($result, 'groomRasiName'),
                    'nakshatra' => $tri($result, 'groomNakshatraName'),
                    'pada' => (int) ($result['groomPada'] ?? 0),
                ],
                'bride' => [
                    'name' => (string) ($result['brideName'] ?? ''),
                    'rasi' => $tri($result, 'brideRasiName'),
                    'nakshatra' => $tri($result, 'brideNakshatraName'),
                    'pada' => (int) ($result['bridePada'] ?? 0),
                ],
                'score' => (int) ($result['score'] ?? 0),
                'maxScore' => (int) ($result['maxScore'] ?? 0),
                'percentage' => (float) ($result['percentage'] ?? 0),
                'matched' => (int) ($result['totalPoruthamsMatched'] ?? 0),
                'total' => count($poruthams),
                'verdictStatus' => (string) ($result['verdictStatus'] ?? ''),
                'verdict' => $tri($result, 'overallVerdict'),
                'rajjuOk' => !empty($result['rajjuMatch']),
                'vedhaOk' => !empty($result['vedhaMatch']),
                'poruthams' => $poruthams,
                'sevvai' => [
                    'brideStatus' => (string) ($sevvai['brideDoshaStatus'] ?? ''),
                    'groomStatus' => (string) ($sevvai['groomDoshaStatus'] ?? ''),
                    'samyamStatus' => $sevvai['doshaSamyamStatus'] ?? null,
                    'samyamLabel' => $tri($sevvai, 'doshaSamyamStatus'),
                    'advice' => $tri($sevvai, 'recommendation'),
                ],
            ],
            'naming' => null,
            'muhurtham' => null,
        ];
    }

    if ($service === 'BABY_NAMING') {
        if ((int) ($result['janmaNakshatraIndex'] ?? 0) < 1 || !is_array($result['primaryPadaInfo'] ?? null)) {
            return null;
        }
        $letters = is_array($result['nakshatraLetters'] ?? null) ? $result['nakshatraLetters'] : [];
        $padas = [];
        foreach ((array) ($letters['padas'] ?? []) as $p) {
            if (!is_array($p)) {
                continue;
            }
            $padas[] = [
                'pada' => (int) ($p['padaNumber'] ?? 0),
                'sound' => $tri($p, 'letter'),
                'rasi' => $tri($p, 'rasi'),
            ];
        }
        $primary = is_array($result['primaryPadaInfo'] ?? null) ? $result['primaryPadaInfo'] : [];
        $pada = (int) ($result['janmaPada'] ?? 0);
        $names = [];
        $addName = static function (array $n) use (&$names): void {
            if (!is_array($n)) {
                return;
            }
            $name = trim((string) ($n['nameEn'] ?? ($n['name'] ?? '')));
            if ($name === '') {
                return;
            }
            $meanEn = (string) ($n['meaningEn'] ?? ($n['meaning'] ?? ''));
            $names[] = [
                'name' => $name,
                'meaning' => [
                    'en' => $meanEn,
                    'ta' => (string) ($n['meaningTa'] ?? $meanEn),
                    'hi' => (string) ($n['meaningHi'] ?? $meanEn),
                ],
            ];
        };
        // Page-1 suggestions first (they are the report's own short list for
        // the birth-pada sound). Some sounds carry none, because the curated
        // examples cover only a few syllables - in that case the names come
        // from the report's page-2 name bank for this very pada.
        foreach ((array) ($result['suggestedNames'] ?? []) as $n) {
            $addName(is_array($n) ? $n : []);
        }
        if ($names === []) {
            foreach ((array) ($result['nameSuggestions'] ?? []) as $column) {
                if (!is_array($column) || (int) ($column['padaNumber'] ?? 0) !== $pada) {
                    continue;
                }
                foreach (['south', 'north'] as $side) {
                    foreach ((array) ($column[$side] ?? []) as $n) {
                        $addName(is_array($n) ? $n : []);
                    }
                }
            }
        }
        $provenance = is_array($result['nameProvenance'] ?? null) ? $result['nameProvenance'] : [];
        return [
            'serviceType' => 'BABY_NAMING',
            'matching' => null,
            'naming' => [
                'baby' => [
                    'name' => (string) ($result['babyName'] ?? ''),
                    'gender' => (string) ($result['gender'] ?? ''),
                    'dob' => (string) ($result['dob'] ?? ''),
                    'tob' => (string) ($result['tob'] ?? ''),
                    'place' => (string) ($result['birthPlace'] ?? ''),
                ],
                'star' => [
                    'en' => (string) ($result['janmaNakshatraEn'] ?? ''),
                    'ta' => (string) ($result['janmaNakshatraTa'] ?? ($result['janmaNakshatraEn'] ?? '')),
                    'hi' => (string) ($result['janmaNakshatraEn'] ?? ''),
                ],
                'pada' => $pada,
                'rasi' => $tri($result, 'chandraRasiName'),
                'lagna' => $tri($result, 'lagnaRasiName'),
                'primarySound' => [
                    'en' => (string) ($primary['letterEn'] ?? ($result['primaryStartingSyllable'] ?? '')),
                    'ta' => (string) ($primary['letterTa'] ?? ($result['primaryStartingSyllable'] ?? '')),
                    'hi' => (string) ($primary['letterHi'] ?? ($result['primaryStartingSyllable'] ?? '')),
                ],
                'padas' => $padas,
                'names' => array_slice($names, 0, 8),
                'provenance' => [
                    'suppliedName' => (string) ($provenance['suppliedName'] ?? ''),
                    'status' => (string) ($provenance['status'] ?? ''),
                    'note' => $tri($provenance, 'note'),
                ],
            ],
            'muhurtham' => null,
        ];
    }

    // MUHURTHAM - the six-month auspicious-date calendar.
    if (!is_array($result['months'] ?? null) || count($result['months']) === 0) {
        return null;
    }
    $months = [];
    $recommended = [];
    $dayCount = 0;
    foreach ($result['months'] as $m) {
        if (!is_array($m)) {
            continue;
        }
        $days = [];
        foreach ((array) ($m['days'] ?? []) as $d) {
            if (!is_array($d)) {
                continue;
            }
            $day = [
                'date' => (string) ($d['date'] ?? ''),
                'weekday' => $tri($d, 'dayOfWeekName'),
                'nakshatra' => $tri($d, 'nakshatraName'),
                'tithi' => $tri($d, 'tithiName'),
                'grade' => (string) ($d['grade'] ?? 'FAIR'),
                'score' => (int) ($d['score'] ?? 0),
                'recommended' => !empty($d['isRecommended']),
                'nallaNeram' => array_values(array_filter(array_map('strval', (array) ($d['nallaNeram'] ?? [])))),
                'rahuKalam' => (string) ($d['rahuKalam'] ?? ''),
                'yamagandam' => (string) ($d['yamagandam'] ?? ''),
                'gulikai' => (string) ($d['gulikai'] ?? ''),
                'reasons' => $tri($d, 'reasons'),
                'doshas' => $tri($d, 'doshas'),
            ];
            $days[] = $day;
            $dayCount++;
            if ($day['recommended'] || $day['grade'] === 'BEST') {
                $recommended[] = $day;
            }
        }
        if ($days === []) {
            continue;
        }
        $months[] = [
            'key' => (string) ($m['monthKey'] ?? ''),
            'name' => $tri($m, 'monthName'),
            'bestCount' => (int) ($m['bestCount'] ?? 0),
            'goodCount' => (int) ($m['goodCount'] ?? 0),
            'days' => $days,
        ];
    }
    usort($recommended, static function (array $a, array $b): int {
        return $b['score'] <=> $a['score'];
    });

    return [
        'serviceType' => 'MUHURTHAM',
        'matching' => null,
        'naming' => null,
        'muhurtham' => [
            'event' => $tri($result, 'eventTitle'),
            'window' => $tri($result, 'windowLabel'),
            'place' => (string) ($result['muhurthamPlace'] ?? ''),
            'country' => (string) ($result['muhurthamCountry'] ?? ''),
            'personalCheckMode' => (string) ($result['personalCheckMode'] ?? 'single'),
            'dayCount' => $dayCount,
            'months' => $months,
            'recommended' => array_slice($recommended, 0, 6),
        ],
    ];
}

function astro_ai_chart_facts(array $order): ?array
{
    // Shared with astro_ai_service_facts(): one engine run per order per
    // request, whichever reading asks first.
    $result = astro_ai_report_result($order);
    if (!is_array($result)) {
        return null;
    }

    // A Birth Jathagam result is the only shape that carries a natal chart.
    // Other services (matching, naming, muhurtham) answer from the general
    // knowledge base instead of inventing chart facts.
    if (!is_array($result['planetPositions'] ?? null) || !is_array($result['dasha'] ?? null)) {
        return null;
    }

    // AstroEngine::calculateHoroscope() keys, mapped to the vocabulary the
    // rule conditions in knowledge/ai-astrologer/rules/life-areas.json use.
    // (This used to read keys such as 'lagnaSign' and 'planetHouses' that the
    // engine never returns, so every chart reached the rules empty.)
    $grahaVocab = [
        'sun' => 'Surya', 'moon' => 'Chandra', 'mars' => 'Sevvai', 'mercury' => 'Budha',
        'jupiter' => 'Guru', 'venus' => 'Sukra', 'saturn' => 'Sani', 'rahu' => 'Rahu', 'ketu' => 'Ketu',
    ];
    $englishLord = [
        'Sun' => 'Surya', 'Moon' => 'Chandra', 'Mars' => 'Sevvai', 'Mercury' => 'Budha',
        'Jupiter' => 'Guru', 'Venus' => 'Sukra', 'Saturn' => 'Sani', 'Rahu' => 'Rahu', 'Ketu' => 'Ketu',
    ];
    // Sign lords, Aries (1) .. Pisces (12).
    $signLord = [1 => 'Sevvai', 2 => 'Sukra', 3 => 'Budha', 4 => 'Chandra', 5 => 'Surya', 6 => 'Budha',
        7 => 'Sukra', 8 => 'Sevvai', 9 => 'Guru', 10 => 'Sani', 11 => 'Sani', 12 => 'Guru'];

    $planetHouse = [];
    $dignity = [];
    foreach ($result['planetPositions'] as $p) {
        $g = $grahaVocab[strtolower((string) ($p['graha'] ?? ''))] ?? null;
        $house = (int) ($p['house'] ?? ($p['bhavaNumber'] ?? 0));
        if ($g === null || $house < 1 || $house > 12) {
            continue;
        }
        $planetHouse[$g] = $house;
        $d = is_array($p['dignity'] ?? null) ? $p['dignity'] : [];
        if (!empty($d['isExalted']) || !empty($d['isOwnSign'])) {
            $dignity[$g] = 'strong';
        } elseif (!empty($d['isDebilitated']) && empty($d['isNeechaBhanga'])) {
            $dignity[$g] = 'weak';
        } else {
            $dignity[$g] = 'neutral';
        }
    }
    if (isset($planetHouse['Chandra'])) {
        $planetHouse['Moon'] = $planetHouse['Chandra']; // one rule names the Moon in English
    }

    $lagnaRasi = (int) ($result['lagnaRasi'] ?? 0);
    $lordHouse = [];
    if ($lagnaRasi >= 1 && $lagnaRasi <= 12) {
        for ($h = 1; $h <= 12; $h++) {
            $lord = $signLord[(($lagnaRasi - 1 + $h - 1) % 12) + 1];
            if (isset($planetHouse[$lord])) {
                $lordHouse[$h] = $planetHouse[$lord];
            }
        }
        $lagnaLord = $signLord[$lagnaRasi];
        $dignity['lagnaLord'] = $dignity[$lagnaLord] ?? 'neutral';
    }

    $dasha = $result['dasha'];
    $antarPeriod = (string) ($dasha['antarPeriod'] ?? '');
    $dashaEnd = strpos($antarPeriod, ' - ') !== false ? trim(substr($antarPeriod, strrpos($antarPeriod, ' - ') + 3)) : '';
    $kuja = $result['sevvaiDosha'] ?? [];
    $kujaPresent = ($kuja['hasDosha'] ?? null) === true && ($kuja['status'] ?? '') !== 'DOSHA_CANCELLED';

    // The full engine dosha block (page-1 Dosha Analysis), flattened for the
    // guided dosha options. Each entry keeps the engine's own verdict,
    // description and traditional remedy in all three languages, so the chat
    // repeats the report instead of re-judging the chart.
    // Maps an engine dosha name ("Mars (Kuja) Dosha", ...) to the short key
    // the guided dosha options use. Inline closure, not a helper: the WASM
    // probe evals this function alone, so it must not call siblings.
    $doshaKey = static function (string $nameEn): string {
        $name = strtolower($nameEn);
        if (strpos($name, 'kuja') !== false || strpos($name, 'mangal') !== false || strpos($name, 'sevvai') !== false) {
            return 'kuja';
        }
        if (strpos($name, 'kala sarpa') !== false || strpos($name, 'kalasarpa') !== false) {
            return 'kalasarpa';
        }
        if (strpos($name, 'pitru') !== false) {
            return 'pitru';
        }
        if (strpos($name, 'guru chandala') !== false || strpos($name, 'chandala') !== false) {
            return 'guruchandala';
        }
        return '';
    };
    $doshaDetails = [];
    if (is_array($result['doshas'] ?? null)) {
        foreach ($result['doshas'] as $d) {
            if (!is_array($d) || trim((string) ($d['nameEn'] ?? '')) === '') {
                continue;
            }
            $key = $doshaKey((string) $d['nameEn']);
            if ($key === '') {
                continue;
            }
            $doshaDetails[] = [
                'key' => $key,
                'present' => $d['isPresent'] ?? null,
                'status' => (string) ($d['status'] ?? ''),
                'name' => [
                    'en' => (string) ($d['nameEn'] ?? ''),
                    'ta' => (string) ($d['nameTa'] ?? ($d['nameEn'] ?? '')),
                    'hi' => (string) ($d['nameHi'] ?? ($d['nameEn'] ?? '')),
                ],
                'description' => [
                    'en' => (string) ($d['descriptionEn'] ?? ''),
                    'ta' => (string) ($d['descriptionTa'] ?? ''),
                    'hi' => (string) ($d['descriptionHi'] ?? ''),
                ],
                'remedy' => [
                    'en' => (string) ($d['traditionalRemedyEn'] ?? ''),
                    'ta' => (string) ($d['traditionalRemedyTa'] ?? ''),
                    'hi' => (string) ($d['traditionalRemedyHi'] ?? ''),
                ],
            ];
        }
    }

    $chart = [
        'lagna' => (string) ($result['lagna']['rasi'] ?? ''),
        'moonSign' => (string) ($result['rasi']['name'] ?? ''),
        'moonNakshatra' => (string) ($result['nakshatram']['name'] ?? ($result['janmaNakshatraEn'] ?? '')),
        'moonNakshatraLord' => '',
        'currentDasha' => $englishLord[(string) ($dasha['currentLord'] ?? '')] ?? (string) ($dasha['currentLord'] ?? ''),
        'currentAntardasha' => $englishLord[(string) ($dasha['subLord'] ?? '')] ?? (string) ($dasha['subLord'] ?? ''),
        'dashaEndDate' => $dashaEnd,
        'planetHouse' => $planetHouse,
        'lordHouse' => $lordHouse,
        'dignity' => $dignity,
        'saniTransitFromMoon' => (int) ($result['saniTransit']['house'] ?? 0),
        'doshas' => $kujaPresent ? ['kujaDosha'] : [],
        'doshaDetails' => $doshaDetails,
        // The customer's own report readings per life area, in en/ta/hi -
        // the same text as their PDF. Knowledge-base mode answers from these.
        'summary' => is_array($result['summary'] ?? null) ? $result['summary'] : [],
        'labels' => [
            'lagna' => ['en' => (string) ($result['lagna']['rasi'] ?? ''), 'ta' => (string) ($result['lagna']['rasiTa'] ?? ''), 'hi' => (string) ($result['lagna']['rasi'] ?? '')],
            'rasi' => ['en' => (string) ($result['rasi']['name'] ?? ''), 'ta' => (string) ($result['rasi']['nameTa'] ?? ''), 'hi' => (string) ($result['rasi']['name'] ?? '')],
            'nakshatra' => ['en' => (string) ($result['nakshatram']['name'] ?? ''), 'ta' => (string) ($result['nakshatram']['nameTa'] ?? ''), 'hi' => (string) ($result['nakshatram']['name'] ?? '')],
            'dasha' => ['en' => (string) ($dasha['currentLord'] ?? ''), 'ta' => (string) ($dasha['currentLordTa'] ?? ''), 'hi' => (string) ($dasha['currentLordHi'] ?? '')],
            'bhukti' => ['en' => (string) ($dasha['subLord'] ?? ''), 'ta' => (string) ($dasha['subLordTa'] ?? ''), 'hi' => (string) ($dasha['subLordHi'] ?? '')],
        ],
    ];

    $lang = astro_normalize_report_language((string) ($order['language'] ?? 'ta'));
    $label = $lang === 'ta' ? 'உங்கள் ஜாதகம்' : ($lang === 'hi' ? 'आपकी कुंडली' : 'Your chart');
    $header = $label . ': ' . $chart['lagna'] . ' / ' . $chart['moonSign'] . ' / ' . $chart['moonNakshatra'] . "\n"
        . ($lang === 'ta' ? 'தசை' : ($lang === 'hi' ? 'दशा' : 'Dasha')) . ' ' . (string) ($dasha['currentLord'] ?? '')
        . ' / ' . (string) ($dasha['subLord'] ?? '')
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
        case 'diagnose':
            astro_ai_action_diagnose($pdo, $user, $body);
            break;
        case 'options':
            astro_ai_action_options($pdo, $user, $body);
            break;
        case 'bind':
            astro_ai_action_bind($pdo, $user, $body);
            break;
        default:
            jsonResponse(['success' => false, 'message' => 'Unknown action.'], 400);
    }
} catch (Throwable $e) {
    error_log('AI Astrologer endpoint error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Something went wrong. Please try again.'], 500);
}
