<?php
/**
 * ASTRO SIVAM - WhatsApp & Viber Order Alert Dispatcher
 * -----------------------------------------------------
 * Sends chat alerts to customers on two lifecycle events:
 *   1. order_confirmed - the customer's order was placed successfully
 *   2. order_completed - admin approved it and the report + invoice were emailed
 *
 * Channels:
 *   WhatsApp - Meta WhatsApp Cloud API (template or free-text message),
 *              or any gateway via a generic webhook (WATI / AiSensy / Interakt / etc.)
 *   Viber    - Official Viber Bot (PA) REST API
 *              (https://chatapi.viber.com/pa/send_message),
 *              or Viber Business Messages via a partner webhook
 *              (Infobip / MessageBird / etc.)
 *
 * Configuration is stored in system_settings.general_settings under the
 * "chatAlertSettings" key (managed from Admin Portal > WhatsApp & Viber Alerts).
 * Environment variables work as an alternative:
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME,
 *   VIBER_AUTH_TOKEN, VIBER_SENDER_NAME
 *
 * SAFETY RULE: alerts are strictly best-effort. A chat gateway outage must
 * NEVER block order placement or order approval - every network call is
 * wrapped and failures are only written to the PHP error log + audit trail.
 */

class AstroChatAlerts
{
    const EVENTS = ['order_confirmed', 'order_completed'];

    const DEFAULT_ORDER_CONFIRMED_MESSAGE = "Namaste {customer_name},\n\nYour order {order_number} for {service_name} ({amount}) has been received successfully and is confirmed.\n\nStatus: {status}\nPayment method: {payment_method}\n\nOur astrologers will now prepare your report. You will get another alert with delivery details once it is complete.\n\nWarm regards,\nASTRO SIVAM Team";

    const DEFAULT_ORDER_COMPLETED_MESSAGE = "Namaste {customer_name},\n\nGreat news! Your order {order_number} for {service_name} is now COMPLETE.\n\nYour official Vedic Astrology Report PDF and Tax Invoice PDF have been emailed to {customer_email}. Please save both attachments for your records.\n\nThank you for choosing ASTRO SIVAM.\n\nWarm regards,\nASTRO SIVAM Team";

    // ------------------------------------------------------------------
    // Settings
    // ------------------------------------------------------------------

    /** Load chat alert settings (general_settings.chatAlertSettings + env fallbacks). */
    public static function getAlertSettings($pdo = null): array
    {
        $stored = [];
        if ($pdo) {
            try {
                $stmt = $pdo->query("SELECT general_settings FROM system_settings ORDER BY id ASC LIMIT 1");
                $row = $stmt ? $stmt->fetch() : false;
                if ($row) {
                    $general = json_decode($row['general_settings'] ?? '{}', true) ?: [];
                    $stored = is_array($general['chatAlertSettings'] ?? null) ? $general['chatAlertSettings'] : [];
                }
            } catch (\Throwable $e) {
                error_log('AstroChatAlerts: failed to read alert settings: ' . $e->getMessage());
            }
        }

        $envWhatsappToken = getenv('WHATSAPP_ACCESS_TOKEN') ?: '';
        $envWhatsappPhoneId = getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '';
        $envWhatsappTemplate = getenv('WHATSAPP_TEMPLATE_NAME') ?: '';
        $envViberToken = getenv('VIBER_AUTH_TOKEN') ?: '';
        $envViberSender = getenv('VIBER_SENDER_NAME') ?: 'ASTRO SIVAM';

        $defaults = [
            'enabled' => true,
            'notifyOrderConfirmed' => true,
            'notifyOrderCompleted' => true,
            'whatsapp' => [
                'enabled' => false,
                'provider' => 'meta',            // 'meta' | 'webhook'
                'phoneNumberId' => $envWhatsappPhoneId,
                'accessToken' => $envWhatsappToken,
                'apiVersion' => 'v21.0',
                'templateName' => $envWhatsappTemplate,   // approved utility template, e.g. order_update
                'templateLanguage' => 'en',
                'webhookUrl' => '',
                'messageType' => $envWhatsappTemplate !== '' ? 'template' : 'text'
            ],
            'viber' => [
                'enabled' => false,
                'provider' => 'viber_bot',       // 'viber_bot' | 'webhook'
                'authToken' => $envViberToken,
                'senderName' => $envViberSender,
                'webhookUrl' => ''
            ],
            'orderConfirmedMessage' => self::DEFAULT_ORDER_CONFIRMED_MESSAGE,
            'orderCompletedMessage' => self::DEFAULT_ORDER_COMPLETED_MESSAGE
        ];

        return self::arrayMergeDeep($defaults, $stored);
    }

    private static function arrayMergeDeep(array $base, array $over): array
    {
        foreach ($over as $k => $v) {
            if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && !self::isListArray($v)) {
                $base[$k] = self::arrayMergeDeep($base[$k], $v);
            } else {
                $base[$k] = $v;
            }
        }
        return $base;
    }

    /** PHP 7.x compatible replacement for array_is_list() (PHP 8.1+). */
    private static function isListArray(array $arr): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($arr);
        }
        $i = 0;
        foreach ($arr as $k => $_) {
            if ($k !== $i++) {
                return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------------
    // Message rendering & phone normalization
    // ------------------------------------------------------------------

    /** Replace {placeholder} tokens in a message template. */
    public static function renderTemplate(string $template, array $vars): string
    {
        $map = [];
        foreach ($vars as $k => $v) {
            $map['{' . $k . '}'] = (string)$v;
        }
        return trim(strtr($template, $map));
    }

    /**
     * Normalize a mobile number toward E.164 (+countrycode...).
     * Falls back to a per-country dialing code when the number is local.
     */
    public static function normalizePhone(?string $raw, ?string $country = null): string
    {
        $raw = trim((string)$raw);
        if ($raw === '') {
            return '';
        }

        // Keep a single leading '+', strip every other non-digit.
        $hasPlus = (strpos($raw, '+') === 0) || (strpos($raw, '00') === 0);
        $digits = preg_replace('/\D+/', '', $raw);

        // '00' is the international access prefix - drop it (the '+' marker remains).
        if (strpos($raw, '00') === 0 && strpos($digits, '00') === 0) {
            $digits = substr($digits, 2);
        }

        $countryCodes = [
            'fiji' => '679', 'india' => '91', 'usa' => '1', 'united states' => '1',
            'canada' => '1', 'australia' => '61', 'new zealand' => '64',
            'united kingdom' => '44', 'uk' => '44', 'singapore' => '65',
            'malaysia' => '60', 'south africa' => '27', 'uae' => '971',
            'united arab emirates' => '971', 'qatar' => '974', 'kuwait' => '965',
            'sri lanka' => '94', 'bangladesh' => '880', 'pakistan' => '92',
            'nepal' => '977', 'philippines' => '63', 'indonesia' => '62',
            'samoa' => '685', 'tonga' => '676', 'vanuatu' => '678',
            'solomon islands' => '677', 'papua new guinea' => '675'
        ];

        if ($hasPlus) {
            return '+' . $digits;
        }

        // Local format heuristics: strip trunk '0', then prefix the country code.
        $cc = $countryCodes[strtolower(trim((string)$country))] ?? '';
        if ($cc !== '') {
            if (strpos($digits, '0') === 0) {
                $digits = substr($digits, 1);
            }
            return '+' . $cc . $digits;
        }

        // Unknown country: if it already looks international (10+ digits), just add '+'.
        if (strlen($digits) >= 10) {
            return '+' . $digits;
        }
        return $digits;
    }

    /** Standard placeholder set shared by both events. */
    private static function buildVars(array $order, array $extra = []): array
    {
        $serviceNames = [
            'BIRTH_JATHAGAM' => 'Birth Jathagam (Horoscope Reading)',
            'MARRIAGE_COMPATIBILITY' => 'Marriage Compatibility (Jathagam Porutham)',
            'BABY_NAMING' => 'Baby Naming Certificate (Vetha Naamakaranam)',
            'MUHURTHAM' => 'Subha Muhurtham Dates (6-Month Calendar)'
        ];
        $serviceType = $order['service_type'] ?? ($order['serviceType'] ?? '');
        $amount = $order['amount'] ?? 0;
        $currency = $order['currency'] ?? 'FJD';

        return array_merge([
            'customer_name' => $order['user_name'] ?? ($order['userName'] ?? 'User'),
            'customer_email' => $order['user_email'] ?? ($order['userEmail'] ?? ''),
            'order_number' => $order['order_number'] ?? ($order['orderNumber'] ?? ''),
            'service_name' => $serviceNames[$serviceType] ?? str_replace('_', ' ', (string)$serviceType),
            'amount' => trim($currency . ' ' . number_format((float)$amount, 2)),
            'currency' => $currency,
            'status' => $order['status'] ?? 'PENDING',
            'payment_method' => $order['payment_method'] ?? ($order['paymentMethod'] ?? 'N/A'),
            'site_name' => 'ASTRO SIVAM'
        ], $extra);
    }

    // ------------------------------------------------------------------
    // HTTP transport
    // ------------------------------------------------------------------

    private static function httpPostJson(string $url, array $payload, array $headers = []): array
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_SSL_VERIFYPEER => true
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $err = curl_error($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($errno !== 0) {
                return ['ok' => false, 'status' => 0, 'body' => '', 'error' => $err];
            }
            $ok = $status >= 200 && $status < 300;
            return ['ok' => $ok, 'status' => $status, 'body' => (string)$body, 'error' => $ok ? '' : 'HTTP ' . $status];
        }

        // Minimal stream fallback when cURL is unavailable on the host.
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $json,
                'timeout' => 15,
                'ignore_errors' => true
            ]
        ]);
        $body = @file_get_contents($url, false, $ctx);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0] . ' ', $m)) {
            $status = (int)$m[1];
        }
        $ok = $body !== false && $status >= 200 && $status < 300;
        return ['ok' => $ok, 'status' => $status, 'body' => (string)$body, 'error' => $ok ? '' : 'HTTP ' . $status];
    }

    // ------------------------------------------------------------------
    // Channel senders
    // ------------------------------------------------------------------

    /** Send one message through the configured WhatsApp transport. */
    public static function sendWhatsApp(array $settings, string $phone, string $message, array $vars = []): array
    {
        $wa = $settings['whatsapp'] ?? [];
        if (empty($wa['enabled'])) {
            return ['success' => false, 'channel' => 'whatsapp', 'message' => 'WhatsApp alerts are disabled'];
        }
        if ($phone === '') {
            return ['success' => false, 'channel' => 'whatsapp', 'message' => 'No mobile number on the customer profile'];
        }

        $provider = $wa['provider'] ?? 'meta';

        if ($provider === 'webhook') {
            $url = trim((string)($wa['webhookUrl'] ?? ''));
            if ($url === '') {
                return ['success' => false, 'channel' => 'whatsapp', 'message' => 'WhatsApp webhook URL is not configured'];
            }
            $res = self::httpPostJson($url, [
                'channel' => 'whatsapp',
                'event' => $vars['event'] ?? '',
                'to' => $phone,
                'message' => $message,
                'vars' => $vars
            ]);
            return [
                'success' => $res['ok'],
                'channel' => 'whatsapp',
                'message' => $res['ok'] ? 'Delivered via webhook gateway' : 'Webhook error: ' . $res['error'] . ' ' . substr($res['body'], 0, 300)
            ];
        }

        // Meta WhatsApp Cloud API
        $token = trim((string)($wa['accessToken'] ?? ''));
        $phoneId = trim((string)($wa['phoneNumberId'] ?? ''));
        if ($token === '' || $phoneId === '') {
            return ['success' => false, 'channel' => 'whatsapp', 'message' => 'WhatsApp Phone Number ID / Access Token missing'];
        }

        $apiVersion = trim((string)($wa['apiVersion'] ?? 'v21.0')) ?: 'v21.0';
        $url = 'https://graph.facebook.com/' . $apiVersion . '/' . rawurlencode($phoneId) . '/messages';

        $messageType = $wa['messageType'] ?? (empty($wa['templateName']) ? 'text' : 'template');

        if ($messageType === 'template' && !empty($wa['templateName'])) {
            $templateParams = [];
            // Fixed parameter order matching typical order-update templates:
            // {{1}} customer name  {{2}} order number  {{3}} service  {{4}} amount  {{5}} status
            foreach (['customer_name', 'order_number', 'service_name', 'amount', 'status'] as $key) {
                $templateParams[] = ['type' => 'text', 'text' => (string)($vars[$key] ?? '-')];
            }
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => ltrim($phone, '+'),
                'type' => 'template',
                'template' => [
                    'name' => $wa['templateName'],
                    'language' => ['code' => $wa['templateLanguage'] ?? 'en'],
                    'components' => [['type' => 'body', 'parameters' => $templateParams]]
                ]
            ];
        } else {
            $payload = [
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => ltrim($phone, '+'),
                'type' => 'text',
                'text' => ['preview_url' => false, 'body' => substr($message, 0, 4096)]
            ];
        }

        $res = self::httpPostJson($url, $payload, ['Authorization: Bearer ' . $token]);

        // Viber-style template sends cannot carry the full body; for 'text'
        // the payload already includes it.
        $detail = $res['ok'] ? 'Delivered via WhatsApp Cloud API' : 'WhatsApp API error: ' . $res['error'] . ' ' . substr($res['body'], 0, 300);
        return ['success' => $res['ok'], 'channel' => 'whatsapp', 'message' => $detail];
    }

    /** Send one message through the configured Viber transport. */
    public static function sendViber(array $settings, string $phone, string $message, array $vars = []): array
    {
        $vb = $settings['viber'] ?? [];
        if (empty($vb['enabled'])) {
            return ['success' => false, 'channel' => 'viber', 'message' => 'Viber alerts are disabled'];
        }
        if ($phone === '') {
            return ['success' => false, 'channel' => 'viber', 'message' => 'No mobile number on the customer profile'];
        }

        $provider = $vb['provider'] ?? 'viber_bot';

        if ($provider === 'webhook') {
            $url = trim((string)($vb['webhookUrl'] ?? ''));
            if ($url === '') {
                return ['success' => false, 'channel' => 'viber', 'message' => 'Viber webhook URL is not configured'];
            }
            $res = self::httpPostJson($url, [
                'channel' => 'viber',
                'event' => $vars['event'] ?? '',
                'to' => $phone,
                'message' => $message,
                'vars' => $vars
            ]);
            return [
                'success' => $res['ok'],
                'channel' => 'viber',
                'message' => $res['ok'] ? 'Delivered via webhook gateway' : 'Webhook error: ' . $res['error'] . ' ' . substr($res['body'], 0, 300)
            ];
        }

        // Official Viber Bot (PA) REST API
        $token = trim((string)($vb['authToken'] ?? ''));
        if ($token === '') {
            return ['success' => false, 'channel' => 'viber', 'message' => 'Viber auth token missing'];
        }

        $payload = [
            // Unique Viber user id - a subscribed user's phone (E.164) is also
            // accepted by the PA API for users who have interacted with the bot.
            'receiver' => ltrim($phone, '+'),
            'min_api_version' => 7,
            'sender' => ['name' => (string)($vb['senderName'] ?? 'ASTRO SIVAM')],
            'type' => 'text',
            'text' => substr($message, 0, 7000)
        ];

        $res = self::httpPostJson('https://chatapi.viber.com/pa/send_message', $payload, ['X-Viber-Auth-Token: ' . $token]);

        // Viber answers HTTP 200 with a JSON status code - surface it.
        $ok = $res['ok'];
        $detail = 'Delivered via Viber Bot API';
        if ($res['body'] !== '') {
            $decoded = json_decode($res['body'], true);
            if (is_array($decoded) && isset($decoded['status']) && (int)$decoded['status'] !== 0) {
                $ok = false;
                $detail = 'Viber API error ' . $decoded['status'] . ': ' . ($decoded['status_message'] ?? 'unknown');
            } elseif (!$ok) {
                $detail = 'Viber API error: ' . $res['error'] . ' ' . substr($res['body'], 0, 300);
            }
        } elseif (!$ok) {
            $detail = 'Viber API error: ' . $res['error'];
        }

        return ['success' => $ok, 'channel' => 'viber', 'message' => $detail];
    }

    // ------------------------------------------------------------------
    // Orchestrators
    // ------------------------------------------------------------------

    /**
     * Fire WhatsApp + Viber alerts for a lifecycle event.
     *
     * @param object|null $pdo    Database handle (for settings + audit logging).
     * @param string      $event  'order_confirmed' | 'order_completed'.
     * @param array       $orders One or more order rows (DB snake_case or API camelCase).
     * @param array|null  $settings Optional pre-loaded settings (avoids a second read).
     * @return array Per-channel results: [['channel'=>..., 'success'=>..., 'message'=>...], ...]
     */
    public static function sendOrderAlerts($pdo, string $event, array $orders, ?array $settings = null): array
    {
        try {
            if (!in_array($event, self::EVENTS, true) || empty($orders)) {
                return [];
            }

            $settings = $settings ?? self::getAlertSettings($pdo);
            if (empty($settings['enabled'])) {
                return [];
            }
            if ($event === 'order_confirmed' && empty($settings['notifyOrderConfirmed'])) {
                return [];
            }
            if ($event === 'order_completed' && empty($settings['notifyOrderCompleted'])) {
                return [];
            }
            $waOn = !empty($settings['whatsapp']['enabled']);
            $vbOn = !empty($settings['viber']['enabled']);
            if (!$waOn && !$vbOn) {
                return [];
            }

            $first = $orders[0];
            $count = count($orders);
            $vars = self::buildVars($first);
            $vars['event'] = $event;

            if ($count > 1) {
                $vars['order_number'] = ($vars['order_number'] !== '' ? $vars['order_number'] : 'GROUP') . ' (+' . ($count - 1) . ' more chart' . ($count > 2 ? 's' : '') . ')';
                $vars['service_name'] = $count . '-chart family bundle';
                $total = 0.0;
                $currency = $vars['currency'];
                foreach ($orders as $o) {
                    $total += (float)($o['amount'] ?? 0);
                }
                $vars['amount'] = trim($currency . ' ' . number_format($total, 2));
                $vars['status'] = $first['status'] ?? 'PENDING';
            }

            $template = $event === 'order_confirmed'
                ? (string)($settings['orderConfirmedMessage'] ?? self::DEFAULT_ORDER_CONFIRMED_MESSAGE)
                : (string)($settings['orderCompletedMessage'] ?? self::DEFAULT_ORDER_COMPLETED_MESSAGE);
            $message = self::renderTemplate($template, $vars);

            $phone = self::normalizePhone(
                $first['user_mobile'] ?? ($first['userMobile'] ?? ''),
                $first['country'] ?? ($first['billingCountry'] ?? '')
            );

            $results = [];
            if ($waOn) {
                $results[] = self::sendWhatsApp($settings, $phone, $message, $vars);
            }
            if ($vbOn) {
                $results[] = self::sendViber($settings, $phone, $message, $vars);
            }

            foreach ($results as $r) {
                if (!$r['success']) {
                    error_log("AstroChatAlerts [{$event}] {$r['channel']} -> {$phone}: {$r['message']}");
                }
            }

            self::auditResults($pdo, $event, $vars['order_number'], $results);
            return $results;
        } catch (\Throwable $e) {
            // Absolute last resort - alerts must never break the order flow.
            error_log('AstroChatAlerts fatal: ' . $e->getMessage());
            return [];
        }
    }

    /** Send a diagnostic test message to an arbitrary phone number. */
    public static function sendTestAlert(array $settings, string $phone, array $channels = ['whatsapp', 'viber']): array
    {
        $phone = self::normalizePhone($phone);
        $vars = [
            'event' => 'test',
            'customer_name' => 'Test User',
            'customer_email' => 'test@astrosivam.com',
            'order_number' => 'ORD-TEST1',
            'service_name' => 'Diagnostic Test',
            'amount' => 'FJD 0.00',
            'currency' => 'FJD',
            'status' => 'TEST',
            'payment_method' => 'N/A',
            'site_name' => 'ASTRO SIVAM'
        ];
        $message = self::renderTemplate("ASTRO SIVAM chat alert test.\nNamaste {customer_name}, this is a diagnostic message confirming that WhatsApp/Viber alerts are configured correctly.\n\nOrder: {order_number}\nTime: " . date('Y-m-d H:i:s') . ' UTC', $vars);

        $results = [];
        if (in_array('whatsapp', $channels, true)) {
            $results[] = self::sendWhatsApp($settings, $phone, $message, $vars);
        }
        if (in_array('viber', $channels, true)) {
            $results[] = self::sendViber($settings, $phone, $message, $vars);
        }
        return $results;
    }

    private static function auditResults($pdo, string $event, string $orderNumber, array $results): void
    {
        if (!$pdo || empty($results)) {
            return;
        }
        try {
            $parts = [];
            foreach ($results as $r) {
                $parts[] = $r['channel'] . '=' . ($r['success'] ? 'OK' : 'FAIL(' . substr($r['message'], 0, 120) . ')');
            }
            // audit_logs expects an actor; customer alerts are system-generated.
            logAudit($pdo, 'system', 'Chat Alerts', 'system', 'CHAT_ALERT_SENT', "Event {$event} for {$orderNumber}: " . implode(' | ', $parts));
        } catch (\Throwable $e) {
            error_log('AstroChatAlerts: audit logging failed: ' . $e->getMessage());
        }
    }
}
