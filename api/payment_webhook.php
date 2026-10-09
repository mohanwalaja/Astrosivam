<?php
/**
 * ASTRO SIVAM — payment provider webhooks (PHP / cPanel deployment).
 *
 * Endpoints (rewritten to this file by api/.htaccess):
 *   GET  /api/payment/webhook/health      readiness probe (no secrets disclosed)
 *   POST /api/payment/webhook/razorpay    payment.captured / order.paid
 *   POST /api/payment/webhook/paypal      PAYMENT.CAPTURE.COMPLETED
 *
 * Responses are 2xx whenever the event has been accepted (processed, ignored or
 * already seen) so the provider stops retrying. A signature that cannot be
 * verified is rejected and never changes payment state.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/payments.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
$action = $_GET['action'] ?? $_GET['provider'] ?? '';
$rawBody = file_get_contents('php://input');
if ($rawBody === false) $rawBody = '';

function astroWebhookRespond($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function astroWebhookProvider($path, $action) {
    $haystack = strtolower($path . ' ' . $action);
    if (strpos($haystack, 'razorpay') !== false) return 'razorpay';
    if (strpos($haystack, 'paypal') !== false) return 'paypal';
    return '';
}

function astroWebhookClientIp() {
    if (function_exists('getClientIpAddress')) {
        try { return (string)getClientIpAddress(); } catch (Throwable $e) { /* fall through */ }
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '');
}

try {
    $pdo = getDbConnection();
    astro_payment_ensure_tables($pdo);
} catch (Throwable $e) {
    error_log('ASTRO SIVAM payment webhook could not reach the database: ' . $e->getMessage());
    astroWebhookRespond(['success' => false, 'message' => 'Payment webhook storage is unavailable.'], 503);
}

if ($method === 'GET') {
    $config = astro_payment_provider_config($pdo);
    astroWebhookRespond([
        'success' => true,
        'service' => 'ASTRO SIVAM payment webhooks',
        'providers' => [
            'razorpay' => [
                'checkout' => !empty($config['razorpay']['configured']),
                'webhookVerification' => $config['razorpay']['webhook_secret'] !== ''
            ],
            'paypal' => [
                'checkout' => !empty($config['paypal']['configured']),
                'webhookVerification' => $config['paypal']['webhook_id'] !== ''
            ]
        ]
    ]);
}

if ($method !== 'POST') {
    astroWebhookRespond(['success' => false, 'message' => 'Use POST to deliver a provider webhook.'], 405);
}

$provider = astroWebhookProvider($path, $action);
if ($provider === '') {
    astroWebhookRespond(['success' => false, 'message' => 'Unknown webhook provider.'], 404);
}

$config = astro_payment_provider_config($pdo);
$payloadDigest = substr(hash('sha256', $rawBody), 0, 32);
$clientIp = substr(astroWebhookClientIp(), 0, 64);
$event = json_decode($rawBody, true);
$event = is_array($event) ? $event : [];

/** Records the outcome and answers the provider. */
$finish = function ($status, $detail, $eventType, $externalEventId, $gatewayOrderId = '', $gatewayPaymentId = '', $intentId = null) use ($pdo, $provider, $payloadDigest, $clientIp) {
    try {
        list($record, $duplicate) = astro_payment_record_webhook_event($pdo, [
            'provider' => $provider,
            'externalEventId' => (string)$externalEventId,
            'eventType' => (string)$eventType,
            'status' => $status,
            'intentId' => $intentId,
            'gatewayOrderId' => $gatewayOrderId !== '' ? $gatewayOrderId : null,
            'gatewayPaymentId' => $gatewayPaymentId !== '' ? $gatewayPaymentId : null,
            'detail' => $detail,
            'payloadDigest' => $payloadDigest,
            'ip' => $clientIp
        ]);
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM payment webhook audit write failed: ' . $e->getMessage());
        $duplicate = false;
    }
    astroWebhookRespond([
        'success' => true,
        'processed' => $status === 'PROCESSED',
        'duplicate' => (bool)$duplicate,
        'status' => $status,
        'message' => $detail
    ]);
};

// ---------------------------------------------------------------------------
// Razorpay: HMAC-SHA256 of the raw request body with the webhook secret.
// ---------------------------------------------------------------------------
if ($provider === 'razorpay') {
    $signature = (string)($_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '');
    $eventId = (string)($_SERVER['HTTP_X_RAZORPAY_EVENT_ID'] ?? '');
    $webhookSecret = (string)($config['razorpay']['webhook_secret'] ?? '');

    if ($webhookSecret === '') {
        error_log('ASTRO SIVAM: Razorpay webhook secret is not configured; event rejected.');
        astroWebhookRespond(['success' => false, 'message' => 'Razorpay webhook verification is not configured on this server.'], 503);
    }

    if (!astro_payment_verify_razorpay_signature($rawBody, $signature, $webhookSecret)) {
        error_log('ASTRO SIVAM: rejected Razorpay webhook with an invalid signature.');
        $finish('REJECTED', 'Signature verification failed for the Razorpay webhook.', 'signature.invalid', $eventId !== '' ? $eventId : 'invalid-' . $payloadDigest);
    }

    $eventType = (string)($event['event'] ?? 'unknown');
    $payment = $event['payload']['payment']['entity'] ?? [];
    $order = $event['payload']['order']['entity'] ?? [];
    $gatewayOrderId = trim((string)($payment['order_id'] ?? ($order['id'] ?? '')));
    $gatewayPaymentId = trim((string)($payment['id'] ?? ''));
    $dedupeId = $eventId !== '' ? $eventId : ($eventType . ':' . ($gatewayPaymentId !== '' ? $gatewayPaymentId : ($gatewayOrderId !== '' ? $gatewayOrderId : $payloadDigest)));

    if ($eventType !== 'payment.captured' && $eventType !== 'order.paid') {
        $finish('IGNORED', "Event {$eventType} does not change payment state.", $eventType, $dedupeId, $gatewayOrderId, $gatewayPaymentId);
    }
    if ($gatewayOrderId === '') {
        $finish('IGNORED', 'Event carried no gateway order reference.', $eventType, $dedupeId, '', $gatewayPaymentId);
    }

    $intent = astro_payment_intent_by_gateway_order($pdo, $gatewayOrderId);
    if (!$intent) {
        $finish('UNKNOWN_INTENT', "No payment intent matches Razorpay order {$gatewayOrderId}.", $eventType, $dedupeId, $gatewayOrderId, $gatewayPaymentId);
    }

    if (strtolower((string)($payment['status'] ?? '')) !== 'captured') {
        $finish('IGNORED', 'Razorpay payment status is ' . (string)($payment['status'] ?? 'unknown') . '; not captured.', $eventType, $dedupeId, $gatewayOrderId, $gatewayPaymentId, $intent['id']);
    }

    $paidAmount = ((float)($payment['amount'] ?? 0)) / 100;
    $paidCurrency = strtoupper((string)($payment['currency'] ?? ''));
    if (!astro_payment_amount_matches($intent, $paidAmount, $paidCurrency)) {
        $finish(
            'MISMATCH',
            astro_payment_mismatch_message($intent, $paidAmount, $paidCurrency, 'Razorpay'),
            $eventType,
            $dedupeId,
            $gatewayOrderId,
            $gatewayPaymentId,
            $intent['id']
        );
    }

    $outcome = astro_payment_capture_intent($pdo, $intent, $gatewayPaymentId !== '' ? $gatewayPaymentId : $gatewayOrderId);
    if ($outcome['status'] === 'CAPTURED') {
        logAudit($pdo, 'system', 'Razorpay Webhook', 'admin', 'PAYMENT_WEBHOOK_CAPTURED',
            'Razorpay webhook ' . $eventType . ' captured intent ' . $intent['id'] . ' (reference ' . ($outcome['paymentReference'] ?? '') . ').');
    }
    $finish(
        in_array($outcome['status'], ['CAPTURED', 'ALREADY_CAPTURED'], true) ? 'PROCESSED' : 'MISMATCH',
        (string)($outcome['message'] ?? 'Processed.'),
        $eventType,
        $dedupeId,
        $gatewayOrderId,
        $gatewayPaymentId,
        $intent['id']
    );
}

// ---------------------------------------------------------------------------
// PayPal: verified by PayPal itself (only PayPal can validate its certificate).
// ---------------------------------------------------------------------------
$eventId = (string)($_SERVER['HTTP_PAYPAL_TRANSMISSION_ID'] ?? '');
$webhookId = (string)($config['paypal']['webhook_id'] ?? '');

if ($webhookId === '') {
    error_log('ASTRO SIVAM: PayPal webhook id is not configured; event rejected so PayPal retries later.');
    astroWebhookRespond(['success' => false, 'message' => 'PayPal webhook verification is not configured on this server.'], 503);
}
if (empty($config['paypal']['configured'])) {
    astroWebhookRespond(['success' => false, 'message' => 'PayPal credentials are not configured on this server.'], 503);
}

try {
    $base = $config['paypal']['base_url'];
    $tokenResponse = astro_payment_http_json(
        $base . '/v1/oauth2/token',
        'POST',
        ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        'grant_type=client_credentials',
        $config['paypal']['client_id'],
        $config['paypal']['client_secret']
    );
    $accessToken = (string)($tokenResponse['body']['access_token'] ?? '');
    if ($accessToken === '') throw new Exception('PayPal authentication failed.');

    $verification = astro_payment_http_json(
        $base . '/v1/notifications/verify-webhook-signature',
        'POST',
        ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Bearer ' . $accessToken],
        [
            'auth_algo' => (string)($_SERVER['HTTP_PAYPAL_AUTH_ALGO'] ?? ''),
            'cert_url' => (string)($_SERVER['HTTP_PAYPAL_CERT_URL'] ?? ''),
            'transmission_id' => $eventId,
            'transmission_sig' => (string)($_SERVER['HTTP_PAYPAL_TRANSMISSION_SIG'] ?? ''),
            'transmission_time' => (string)($_SERVER['HTTP_PAYPAL_TRANSMISSION_TIME'] ?? ''),
            'webhook_id' => $webhookId,
            'webhook_event' => $event
        ]
    );
    $verificationStatus = strtoupper((string)($verification['body']['verification_status'] ?? ''));
} catch (Throwable $e) {
    error_log('ASTRO SIVAM: PayPal webhook verification failed: ' . $e->getMessage());
    astroWebhookRespond(['success' => false, 'message' => 'PayPal signature verification could not be completed.'], 503);
}

if ($verificationStatus !== 'SUCCESS') {
    error_log('ASTRO SIVAM: rejected PayPal webhook with an invalid signature.');
    $finish('REJECTED', 'Invalid PayPal webhook signature.', 'signature.invalid', $eventId !== '' ? $eventId : 'paypal-' . $payloadDigest);
}

$eventType = (string)($event['event_type'] ?? 'unknown');
$resource = $event['resource'] ?? [];
$gatewayOrderId = trim((string)($resource['supplementary_data']['related_ids']['order_id'] ?? ''));
$gatewayPaymentId = trim((string)($resource['id'] ?? ''));
$dedupeId = $eventId !== '' ? $eventId : ($eventType . ':' . ($gatewayPaymentId !== '' ? $gatewayPaymentId : $payloadDigest));

if ($eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    $finish('IGNORED', "Event {$eventType} does not change payment state.", $eventType, $dedupeId, $gatewayOrderId, $gatewayPaymentId);
}
if ($gatewayOrderId === '') {
    $finish('UNKNOWN_INTENT', 'PayPal capture carried no related order id.', $eventType, $dedupeId, '', $gatewayPaymentId);
}

$intent = astro_payment_intent_by_gateway_order($pdo, $gatewayOrderId);
if (!$intent) {
    $finish('UNKNOWN_INTENT', "No payment intent matches PayPal order {$gatewayOrderId}.", $eventType, $dedupeId, $gatewayOrderId, $gatewayPaymentId);
}

$paidAmount = (float)($resource['amount']['value'] ?? 0);
$paidCurrency = strtoupper((string)($resource['amount']['currency_code'] ?? ''));
if (!astro_payment_amount_matches($intent, $paidAmount, $paidCurrency)) {
    $finish(
        'MISMATCH',
        astro_payment_mismatch_message($intent, $paidAmount, $paidCurrency, 'PayPal capture'),
        $eventType,
        $dedupeId,
        $gatewayOrderId,
        $gatewayPaymentId,
        $intent['id']
    );
}

$outcome = astro_payment_capture_intent($pdo, $intent, $gatewayPaymentId !== '' ? $gatewayPaymentId : $gatewayOrderId, $eventId);
if ($outcome['status'] === 'CAPTURED') {
    logAudit($pdo, 'system', 'PayPal Webhook', 'admin', 'PAYMENT_WEBHOOK_CAPTURED',
        'PayPal webhook ' . $eventType . ' captured intent ' . $intent['id'] . ' (reference ' . ($outcome['paymentReference'] ?? '') . ').');
}
$finish(
    in_array($outcome['status'], ['CAPTURED', 'ALREADY_CAPTURED'], true) ? 'PROCESSED' : 'MISMATCH',
    (string)($outcome['message'] ?? 'Processed.'),
    $eventType,
    $dedupeId,
    $gatewayOrderId,
    $gatewayPaymentId,
    $intent['id']
);
