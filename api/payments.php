<?php
/**
 * ASTRO SIVAM — shared payment-provider helpers (webhooks + reconciliation).
 *
 * WHY THIS EXISTS: an online checkout is only finished when the *browser* calls
 * /api/services/payment/verify-session. If the customer closes the tab or the
 * callback is dropped, the provider has the money while the payment intent stays
 * CREATED forever: no order, no report, and support has to sort it out by hand.
 *
 * This module gives both recovery paths the same verified primitives:
 *   1. Signed provider webhooks (api/payment_webhook.php).
 *   2. Admin reconciliation of stale intents (api/admin/index.php).
 *
 * SECURITY RULES
 *   - Authenticity is verified before ANY state change (HMAC for Razorpay, the
 *     signed verification call for PayPal).
 *   - Amount and currency are re-checked against the stored intent, so a webhook
 *     can never change what an order costs.
 *   - Orders are still bound to a captured intent only by the authenticated
 *     order endpoint; a forged callback can never create or fulfil an order.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

/** Same masking rules as the rest of the API: placeholders are not credentials. */
function astro_payment_is_masked_secret($value) {
    $value = trim((string)$value);
    if ($value === '' || strpos($value, '•') !== false || preg_match('/^\*+$/', $value)) return true;
    return (bool)preg_match('/^(?:change[-_ ]?me|replace[-_ ]?me|astro_sivam_|your[-_ ]?(?:secret|token|key)|placeholder)/i', $value);
}

function astro_payment_setting_value($general, $keys, $envKeys = []) {
    foreach ($envKeys as $envKey) {
        $value = getenv($envKey);
        if ($value !== false && !astro_payment_is_masked_secret($value)) return trim((string)$value);
    }
    foreach ($keys as $key) {
        $value = $general[$key] ?? '';
        if (!astro_payment_is_masked_secret($value)) return trim((string)$value);
    }
    return '';
}

/** Ensures the durable payment tables exist even when the webhook arrives first. */
function astro_payment_ensure_tables($pdo) {
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_intents (
        id VARCHAR(80) NOT NULL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        provider VARCHAR(32) NOT NULL,
        payment_method VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(8) NOT NULL,
        gateway_order_id VARCHAR(191) NOT NULL,
        gateway_payment_id VARCHAR(191) NULL,
        gateway_signature VARCHAR(512) NULL,
        payment_reference VARCHAR(191) NULL,
        payer_account VARCHAR(191) NULL,
        order_id VARCHAR(64) NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payment_intents_user_status (user_id, status),
        INDEX idx_payment_intents_reference (payment_reference),
        INDEX idx_payment_intents_gateway_order (gateway_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id VARCHAR(80) NOT NULL PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        external_event_id VARCHAR(191) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        intent_id VARCHAR(80) NULL,
        gateway_order_id VARCHAR(191) NULL,
        gateway_payment_id VARCHAR(191) NULL,
        detail VARCHAR(500) NULL,
        payload_digest CHAR(32) NULL,
        ip_address VARCHAR(64) NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payment_webhook_provider_event (provider, external_event_id),
        INDEX idx_payment_webhook_received (received_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}

/** Provider credentials resolved from admin settings (env vars win when present). */
function astro_payment_provider_config($pdo) {
    $general = [];
    try {
        $stmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $row = $stmt->fetch();
        if ($row) $general = json_decode($row['general_settings'] ?? '{}', true) ?: [];
    } catch (Throwable $e) {
        // Settings unavailable — fall back to environment variables only.
    }

    $rzpKeyId = astro_payment_setting_value($general, ['indiaGpayKeyId', 'razorpayKeyId'], ['RAZORPAY_KEY_ID']);
    $rzpKeySecret = astro_payment_setting_value($general, ['indiaGpayKeySecret', 'razorpayKeySecret'], ['RAZORPAY_KEY_SECRET']);
    $rzpWebhookSecret = astro_payment_setting_value($general, ['indiaGpayWebhookSecret', 'razorpayWebhookSecret'], ['RAZORPAY_WEBHOOK_SECRET']);

    $paypalClientId = astro_payment_setting_value($general, ['paypalClientId'], ['PAYPAL_CLIENT_ID']);
    $paypalClientSecret = astro_payment_setting_value($general, ['paypalClientSecret', 'paypalSecret'], ['PAYPAL_CLIENT_SECRET', 'PAYPAL_SECRET']);
    $paypalWebhookId = astro_payment_setting_value($general, ['paypalWebhookId'], ['PAYPAL_WEBHOOK_ID']);
    $paypalEnvironment = strtolower((string)($general['paypalMode'] ?? 'sandbox')) === 'live' ? 'live' : 'sandbox';

    return [
        'razorpay' => [
            'key_id' => $rzpKeyId,
            'key_secret' => $rzpKeySecret,
            'webhook_secret' => $rzpWebhookSecret,
            'configured' => $rzpKeyId !== '' && $rzpKeySecret !== ''
        ],
        'paypal' => [
            'client_id' => $paypalClientId,
            'client_secret' => $paypalClientSecret,
            'webhook_id' => $paypalWebhookId,
            'base_url' => $paypalEnvironment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
            'environment' => $paypalEnvironment,
            'configured' => $paypalClientId !== '' && $paypalClientSecret !== ''
        ]
    ];
}

/** Minimal JSON transport for provider calls (no external dependencies). */
function astro_payment_http_json($url, $method = 'GET', $headers = [], $body = null, $basicUser = null, $basicPassword = null) {
    if (!function_exists('curl_init')) {
        throw new Exception('Server payment transport is unavailable (cURL missing).');
    }
    $ch = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ];
    if ($basicUser !== null) $options[CURLOPT_USERPWD] = $basicUser . ':' . ($basicPassword ?? '');
    if ($body !== null) $options[CURLOPT_POSTFIELDS] = is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_SLASHES);
    curl_setopt_array($ch, $options);
    $raw = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $error !== '') throw new Exception('Payment provider request failed: ' . $error);
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) throw new Exception('Payment provider returned an invalid response.');
    return ['status' => $status, 'body' => $decoded];
}

function astro_payment_intent_by_gateway_order($pdo, $gatewayOrderId) {
    $gatewayOrderId = trim((string)$gatewayOrderId);
    if ($gatewayOrderId === '') return null;
    $stmt = $pdo->prepare("SELECT * FROM payment_intents WHERE gateway_order_id = ? LIMIT 1");
    $stmt->execute([$gatewayOrderId]);
    $intent = $stmt->fetch(PDO::FETCH_ASSOC);
    return $intent ?: null;
}

function astro_payment_intent_by_id($pdo, $intentId) {
    $stmt = $pdo->prepare("SELECT * FROM payment_intents WHERE id = ? LIMIT 1");
    $stmt->execute([trim((string)$intentId)]);
    $intent = $stmt->fetch(PDO::FETCH_ASSOC);
    return $intent ?: null;
}

function astro_payment_intent_prefix($intent) {
    return strtoupper((string)($intent['payment_method'] ?? '')) === 'PAYPAL' ? 'PAYPAL' : 'GPAY';
}

function astro_payment_reference($prefix, $gatewayPaymentId) {
    $clean = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$gatewayPaymentId);
    return $prefix . '-ONL-' . $clean;
}

/**
 * Verify a Razorpay webhook signature (HMAC-SHA256 of the raw request body).
 * Pure and side-effect free so it can be exercised by tests/selftest scripts.
 */
function astro_payment_verify_razorpay_signature($rawBody, $signature, $webhookSecret) {
    $secret = (string)$webhookSecret;
    $provided = trim((string)$signature);
    if ($secret === '' || $provided === '') return false;
    return hash_equals(hash_hmac('sha256', (string)$rawBody, $secret), $provided);
}

/**
 * Does a provider-reported payment match the stored intent exactly?
 * A provider callback must never be able to change what an order costs.
 */
function astro_payment_amount_matches($intent, $amount, $currency) {
    $expectedAmount = round((float)($intent['amount'] ?? 0), 2);
    $actualAmount = round((float)$amount, 2);
    if (abs($expectedAmount - $actualAmount) > 0.009) return false;
    $expectedCurrency = strtoupper(trim((string)($intent['currency'] ?? '')));
    $actualCurrency = strtoupper(trim((string)$currency));
    if ($actualCurrency === '') return true;
    return $expectedCurrency === $actualCurrency;
}

/** Human-readable mismatch explanation used in webhook audit rows. */
function astro_payment_mismatch_message($intent, $amount, $currency, $providerLabel) {
    return $providerLabel . ' reported ' . strtoupper((string)$currency) . ' ' . number_format((float)$amount, 2)
        . ' but intent ' . (string)($intent['id'] ?? '') . ' is ' . strtoupper((string)($intent['currency'] ?? ''))
        . ' ' . number_format((float)($intent['amount'] ?? 0), 2) . '. Nothing was captured.';
}

/**
 * Record a provider-confirmed capture on a CREATED intent. Idempotent: replaying
 * the same capture keeps the original reference and never double-books a payment.
 *
 * @return array{status:string,message:string,intentId?:string,paymentReference?:string}
 */
function astro_payment_capture_intent($pdo, $intent, $gatewayPaymentId, $gatewaySignature = null, $payerAccount = null) {
    $intentId = (string)$intent['id'];
    $status = strtoupper((string)$intent['status']);
    if ($status === 'CAPTURED') {
        return [
            'status' => 'ALREADY_CAPTURED',
            'message' => 'Payment was already captured.',
            'intentId' => $intentId,
            'paymentReference' => (string)($intent['payment_reference'] ?? '')
        ];
    }
    if ($status !== 'CREATED') {
        return ['status' => 'FAILED', 'message' => "Payment intent is {$status}; nothing was captured.", 'intentId' => $intentId];
    }
    if (trim((string)$gatewayPaymentId) === '') {
        return ['status' => 'FAILED', 'message' => 'Provider returned no payment id.', 'intentId' => $intentId];
    }

    $paymentReference = astro_payment_reference(astro_payment_intent_prefix($intent), $gatewayPaymentId);
    $upd = $pdo->prepare("UPDATE payment_intents SET status = 'CAPTURED', gateway_payment_id = ?, gateway_signature = ?, payment_reference = ?, payer_account = ?, updated_at = NOW() WHERE id = ? AND status = 'CREATED'");
    $upd->execute([
        (string)$gatewayPaymentId,
        $gatewaySignature !== null && $gatewaySignature !== '' ? substr((string)$gatewaySignature, 0, 512) : null,
        $paymentReference,
        $payerAccount !== null && $payerAccount !== '' ? substr((string)$payerAccount, 0, 191) : null,
        $intentId
    ]);
    if ($upd->rowCount() !== 1) {
        // Another verified callback (webhook vs. browser) captured it first.
        $fresh = astro_payment_intent_by_id($pdo, $intentId);
        if ($fresh && strtoupper((string)$fresh['status']) === 'CAPTURED') {
            return [
                'status' => 'ALREADY_CAPTURED',
                'message' => 'Payment was already captured by a concurrent verification.',
                'intentId' => $intentId,
                'paymentReference' => (string)($fresh['payment_reference'] ?? '')
            ];
        }
        return ['status' => 'FAILED', 'message' => 'Payment intent changed while it was being captured.', 'intentId' => $intentId];
    }

    return [
        'status' => 'CAPTURED',
        'message' => 'Provider-confirmed payment captured. The customer can now complete the order.',
        'intentId' => $intentId,
        'paymentReference' => $paymentReference
    ];
}

/** Ask the provider for an intent's live state and capture it when it was paid. */
function astro_payment_reconcile_intent($pdo, $intent, $config = null) {
    $config = $config ?: astro_payment_provider_config($pdo);
    $intentId = (string)$intent['id'];
    $provider = strtolower((string)$intent['provider']);

    try {
        if ($provider === 'razorpay') {
            if (empty($config['razorpay']['configured'])) {
                return ['status' => 'UNCONFIGURED', 'message' => 'Razorpay credentials are not configured on this server.', 'intentId' => $intentId];
            }
            $gatewayOrderId = trim((string)$intent['gateway_order_id']);
            $response = astro_payment_http_json(
                'https://api.razorpay.com/v1/orders/' . rawurlencode($gatewayOrderId) . '/payments',
                'GET',
                ['Accept: application/json'],
                null,
                $config['razorpay']['key_id'],
                $config['razorpay']['key_secret']
            );
            if ($response['status'] < 200 || $response['status'] >= 300) {
                return ['status' => 'UNKNOWN', 'message' => 'Razorpay order status could not be read.', 'intentId' => $intentId];
            }
            $expectedMinor = (int)round(((float)$intent['amount']) * 100);
            $captured = null;
            $anyFailed = false;
            foreach (($response['body']['items'] ?? []) as $payment) {
                $paymentStatus = strtolower((string)($payment['status'] ?? ''));
                if ($paymentStatus === 'captured'
                    && (int)($payment['amount'] ?? -1) === $expectedMinor
                    && strtoupper((string)($payment['currency'] ?? '')) === strtoupper((string)$intent['currency'])) {
                    $captured = $payment;
                    break;
                }
                if ($paymentStatus === 'failed') $anyFailed = true;
            }
            if (!$captured) {
                return [
                    'status' => $anyFailed ? 'FAILED' : 'PENDING',
                    'message' => $anyFailed
                        ? 'Razorpay reports no captured payment for this session (a payment attempt failed).'
                        : 'Razorpay reports no captured payment yet; the customer may still be checking out.',
                    'intentId' => $intentId
                ];
            }
            return astro_payment_capture_intent($pdo, $intent, (string)$captured['id']);
        }

        if ($provider === 'paypal') {
            if (empty($config['paypal']['configured'])) {
                return ['status' => 'UNCONFIGURED', 'message' => 'PayPal credentials are not configured on this server.', 'intentId' => $intentId];
            }
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
            if ($accessToken === '') {
                return ['status' => 'UNKNOWN', 'message' => 'PayPal authentication failed.', 'intentId' => $intentId];
            }
            $gatewayOrderId = trim((string)$intent['gateway_order_id']);
            $detailsResponse = astro_payment_http_json(
                $base . '/v2/checkout/orders/' . rawurlencode($gatewayOrderId),
                'GET',
                ['Accept: application/json', 'Authorization: Bearer ' . $accessToken]
            );
            $order = $detailsResponse['body'] ?? [];
            if ($detailsResponse['status'] < 200 || $detailsResponse['status'] >= 300) {
                return ['status' => 'UNKNOWN', 'message' => 'PayPal order status could not be read.', 'intentId' => $intentId];
            }
            // Recovery: the buyer approved the payment but the browser never
            // returned to capture it. Capture server-side now.
            if (strtoupper((string)($order['status'] ?? '')) === 'APPROVED') {
                $captureResponse = astro_payment_http_json(
                    $base . '/v2/checkout/orders/' . rawurlencode($gatewayOrderId) . '/capture',
                    'POST',
                    ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Bearer ' . $accessToken, 'PayPal-Request-Id: recovery-' . $intentId],
                    new stdClass()
                );
                if ($captureResponse['status'] >= 200 && $captureResponse['status'] < 300) {
                    $order = $captureResponse['body'];
                } else {
                    return ['status' => 'PENDING', 'message' => 'PayPal approval exists but the capture could not be completed yet.', 'intentId' => $intentId];
                }
            }
            $purchaseUnit = $order['purchase_units'][0] ?? [];
            $capture = $purchaseUnit['payments']['captures'][0] ?? [];
            $captureStatus = strtoupper((string)($capture['status'] ?? ''));
            $orderStatus = strtoupper((string)($order['status'] ?? ''));
            if ($captureStatus !== 'COMPLETED' && $orderStatus !== 'COMPLETED') {
                return ['status' => 'PENDING', 'message' => 'PayPal reports status ' . ($orderStatus ?: 'UNKNOWN') . '; no capture to record yet.', 'intentId' => $intentId];
            }
            $amountValue = (float)($capture['amount']['value'] ?? ($purchaseUnit['amount']['value'] ?? 0));
            $currencyCode = strtoupper((string)($capture['amount']['currency_code'] ?? ($purchaseUnit['amount']['currency_code'] ?? '')));
            if (abs($amountValue - (float)$intent['amount']) > 0.009
                || ($currencyCode !== '' && $currencyCode !== strtoupper((string)$intent['currency']))) {
                return [
                    'status' => 'MISMATCH',
                    'message' => 'PayPal reported ' . $currencyCode . ' ' . number_format($amountValue, 2) . ' but the intent is '
                        . strtoupper((string)$intent['currency']) . ' ' . number_format((float)$intent['amount'], 2) . '. Nothing was captured.',
                    'intentId' => $intentId
                ];
            }
            $paymentId = (string)($capture['id'] ?? ($order['id'] ?? ''));
            if ($paymentId === '') {
                return ['status' => 'UNKNOWN', 'message' => 'PayPal returned no capture id.', 'intentId' => $intentId];
            }
            return astro_payment_capture_intent($pdo, $intent, $paymentId);
        }

        return ['status' => 'UNKNOWN', 'message' => 'No reconciliation path for provider ' . $provider . '.', 'intentId' => $intentId];
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM payment reconciliation failed for intent ' . $intentId . ': ' . $e->getMessage());
        return ['status' => 'UNKNOWN', 'message' => 'Provider reconciliation failed.', 'intentId' => $intentId];
    }
}

/** Persist a provider callback for audit + idempotency. Returns [record, duplicate]. */
function astro_payment_record_webhook_event($pdo, $event) {
    $externalEventId = (string)($event['externalEventId'] ?? '');
    if ($externalEventId !== '') {
        $stmt = $pdo->prepare("SELECT * FROM payment_webhook_events WHERE provider = ? AND external_event_id = ? LIMIT 1");
        $stmt->execute([(string)$event['provider'], $externalEventId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) return [$existing, true];
    }
    $id = 'pwh_' . bin2hex(random_bytes(8));
    $ins = $pdo->prepare("INSERT INTO payment_webhook_events (id, provider, external_event_id, event_type, status, intent_id, gateway_order_id, gateway_payment_id, detail, payload_digest, ip_address, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $ins->execute([
        $id,
        (string)$event['provider'],
        substr($externalEventId, 0, 191),
        substr((string)($event['eventType'] ?? 'unknown'), 0, 64),
        substr((string)($event['status'] ?? 'IGNORED'), 0, 32),
        $event['intentId'] ?? null,
        isset($event['gatewayOrderId']) ? substr((string)$event['gatewayOrderId'], 0, 191) : null,
        isset($event['gatewayPaymentId']) ? substr((string)$event['gatewayPaymentId'], 0, 191) : null,
        substr((string)($event['detail'] ?? ''), 0, 500),
        $event['payloadDigest'] ?? null,
        $event['ip'] ?? null
    ]);
    return [['id' => $id] + $event, false];
}
