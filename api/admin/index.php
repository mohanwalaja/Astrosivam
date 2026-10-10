<?php
/**
 * ASTRO SIVAM - Admin Management API Router
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../branding.php';
require_once __DIR__ . '/../chat_alerts.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/family_approval.php';
require_once __DIR__ . '/family_docs.php';

$pdo = getDbConnection();
try {
    $pdo->exec("SET NAMES 'utf8mb4'");
} catch (\Throwable $e) {
    // Ignore if already set
}
$admin = requireAdmin($pdo);

/**
 * Admin actions that generate PDFs, send customer email or call a provider API
 * are rate-limited per administrator, so a valid admin token cannot be used as
 * a bulk-mail or provider-quota weapon.
 */
function astro_admin_action_limit($pdo, $admin, $action) {
    $limits = array(
        // Approve / resend: 30 customer emails per 10 minutes per admin.
        'delivery' => array(30, 600, 'Too many approval emails were sent in a short time. Please wait a few minutes before continuing.'),
        // The test mail is sent to an arbitrary address: 5 per 10 minutes.
        'test-mail' => array(5, 600, 'Too many test emails were sent in a short time. Please wait a few minutes.'),
        // Reconciliation sweeps hit provider APIs: 10 per 10 minutes.
        'provider' => array(10, 600, 'Too many reconciliation runs in a short time. Please wait before sweeping again.')
    );
    if (!isset($limits[$action])) return;
    list($maxHits, $windowSeconds, $message) = $limits[$action];
    astro_rate_limit_enforce($pdo, 'admin-action-' . $action, (string)($admin['id'] ?? ''), $maxHits, $windowSeconds, $message);
}
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

/** Credential values are never returned to the browser, including to admins. */
function astroAdminSecretConfigured($value) {
    if (!is_string($value)) return false;
    $secret = trim($value);
    if (strlen($secret) < 8 || strpos($secret, '•') !== false || preg_match('/^\*+$/', $secret)) return false;
    if (preg_match('/^(?:astro_sivam_|change[-_ ]?me|replace[-_ ]?me|your[-_ ]?(?:secret|token|key)|placeholder)/i', $secret)) return false;
    return true;
}

function astroRedactAdminSettings($settings) {
    if (!is_array($settings)) return $settings;
    foreach (['paypalSecret', 'paypalClientSecret', 'indiaGpayKeySecret', 'indiaGpayWebhookSecret', 'razorpayKeySecret', 'razorpayWebhookSecret', 'razorpaySecret', 'vodafoneMPaisaApiSecret', 'facebookAppSecret'] as $field) {
        $settings[$field . 'Configured'] = astroAdminSecretConfigured($settings[$field] ?? null);
        $settings[$field] = '';
    }

    if (!empty($settings['emailSettings']) && is_array($settings['emailSettings'])) {
        $email = $settings['emailSettings'];
        $secret = $email['smtpPassword'] ?? $email['smtpPass'] ?? null;
        $email['smtpUsername'] = $email['smtpUsername'] ?? $email['smtpUser'] ?? '';
        $email['smtpPasswordConfigured'] = astroAdminSecretConfigured($secret);
        $email['smtpPassword'] = '';
        $email['smtpPass'] = '';
        $email['senderName'] = $email['senderName'] ?? $email['fromName'] ?? 'ASTRO SIVAM Desk';
        $email['senderEmail'] = $email['senderEmail'] ?? $email['fromEmail'] ?? '';
        $email['replyTo'] = $email['replyTo'] ?? $email['replyToEmail'] ?? ($email['senderEmail'] ?? '');
        $email['tlsSecure'] = $email['tlsSecure'] ?? (($email['smtpSecure'] ?? '') === 'ssl');
        $settings['emailSettings'] = $email;
    }

    if (isset($settings['chatAlertSettings']) && is_array($settings['chatAlertSettings'])) {
        foreach (['whatsapp' => ['accessToken', 'webhookUrl'], 'viber' => ['authToken', 'webhookUrl']] as $channel => $fields) {
            if (!isset($settings['chatAlertSettings'][$channel]) || !is_array($settings['chatAlertSettings'][$channel])) continue;
            foreach ($fields as $field) {
                $settings['chatAlertSettings'][$channel][$field . 'Configured'] = astroAdminSecretConfigured($settings['chatAlertSettings'][$channel][$field] ?? null);
                $settings['chatAlertSettings'][$channel][$field] = '';
            }
        }
    }
    return $settings;
}

/** Remove blank/masked form values so partial admin saves retain stored credentials. */
function astroOmitBlankAdminSecrets($body) {
    if (!is_array($body)) return [];
    foreach (['paypalSecret', 'paypalClientSecret', 'indiaGpayKeySecret', 'indiaGpayWebhookSecret', 'razorpayKeySecret', 'razorpayWebhookSecret', 'razorpaySecret', 'vodafoneMPaisaApiSecret', 'facebookAppSecret'] as $field) {
        if (!astroAdminSecretConfigured($body[$field] ?? null)) unset($body[$field]);
        unset($body[$field . 'Configured']);
    }
    if (isset($body['emailSettings']) && is_array($body['emailSettings'])) {
        $mailPassword = $body['emailSettings']['smtpPassword'] ?? $body['emailSettings']['smtpPass'] ?? null;
        if (!astroAdminSecretConfigured($mailPassword)) {
            unset($body['emailSettings']['smtpPassword'], $body['emailSettings']['smtpPass']);
        }
        unset($body['emailSettings']['smtpPasswordConfigured']);
    }
    if (isset($body['chatAlertSettings']) && is_array($body['chatAlertSettings'])) {
        foreach (['whatsapp' => ['accessToken', 'webhookUrl'], 'viber' => ['authToken', 'webhookUrl']] as $channel => $fields) {
            if (!isset($body['chatAlertSettings'][$channel]) || !is_array($body['chatAlertSettings'][$channel])) continue;
            foreach ($fields as $field) {
                if (!astroAdminSecretConfigured($body['chatAlertSettings'][$channel][$field] ?? null)) unset($body['chatAlertSettings'][$channel][$field]);
                unset($body['chatAlertSettings'][$channel][$field . 'Configured']);
            }
        }
    }
    return $body;
}

// 1. GET /api/admin/orders
if (strpos($path, 'admin/orders') !== false && $method === 'GET' && !preg_match('/admin\/orders\/[^\/]+/', $path)) {
    // Defensive: older databases may predate the family-bundle columns.
    try {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `group_id` VARCHAR(64) NULL AFTER `order_number`");
    } catch (\Throwable $e) {}
    try {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `group_order_index` INT NOT NULL DEFAULT 0 AFTER `group_id`");
    } catch (\Throwable $e) {}

    $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC, id ASC");
    $rows = $stmt->fetchAll();

    $orders = array_map(function($r) {
        return [
            'id' => $r['id'],
            'orderNumber' => $r['order_number'],
            // groupId is what the admin portal uses to collapse a multi-chart
            // family bundle into ONE approval unit. Without it every chart
            // renders as a separate order and gets approved/emailed separately.
            'groupId' => (!empty($r['group_id']) ? $r['group_id'] : null),
            'groupOrderIndex' => (int)($r['group_order_index'] ?? 0),
            'ipAddress' => $r['ip_address'] ?? null,
            'userId' => $r['user_id'],
            'userName' => $r['user_name'],
            'userEmail' => $r['user_email'],
            'userMobile' => $r['user_mobile'],
            'country' => $r['country'],
            'serviceType' => $r['service_type'],
            'language' => astro_normalize_report_language($r['language'] ?? 'en'),
            'amount' => floatval($r['amount']),
            'currency' => $r['currency'],
            'serviceMode' => $r['service_mode'],
            'status' => $r['status'],
            'paymentMethod' => $r['payment_method'],
            'paymentReference' => $r['payment_reference'],
            'paymentIntentId' => $r['payment_intent_id'] ?? null,
            'paymentStatus' => $r['payment_status'] ?? ((bool)$r['payment_confirmed'] ? 'VERIFIED_MANUAL' : 'PENDING_ADMIN'),
            'paymentConfirmed' => (bool)$r['payment_confirmed'],
            'emailStatus' => $r['email_status'],
            'emailSentAt' => $r['email_sent_at'],
            'emailLastStatusMessage' => $r['email_last_status_message'],
            'inputPayload' => json_decode($r['input_payload'], true) ?: [],
            'calculatedResult' => json_decode($r['calculated_result'], true) ?: null,
            'hasPdf' => (bool)($r['has_pdf'] ?? 0),
            'hasInvoice' => (bool)($r['has_invoice'] ?? 0),
            'adminNotes' => $r['admin_notes'],
            'refundStatus' => $r['refund_status'],
            'refundReason' => $r['refund_reason'],
            'createdAt' => $r['created_at'],
            'updated_at' => $r['updated_at'],
            'updatedAt' => $r['updated_at'] ?? $r['created_at']
        ];
    }, $rows);

    // Multi-person orders: attach the people and their report items, so the
    // admin portal renders ONE row per order that expands into its people and
    // items. Legacy orders were backfilled with one person + one item each by
    // api/migrations/003_multi_person_orders.sql.
    require_once __DIR__ . '/order_items.php';
    $orders = astro_attach_order_items($pdo, $orders);

    jsonResponse(['success' => true, 'orders' => $orders]);
}

// 1a. POST /api/admin/orders/:id/verify-payment
// Manual payment references remain pending until this explicit admin action.
if (preg_match('/admin\/orders\/([^\/]+)\/verify-payment/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    $body = getJsonBody();
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    if ((float)($order['amount'] ?? 0) <= 0) {
        jsonResponse(['success' => false, 'message' => 'This order does not require payment verification.'], 400);
    }

    foreach ([
        "ALTER TABLE orders ADD COLUMN payment_intent_id VARCHAR(80) NULL",
        "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ADMIN'"
    ] as $migration) { try { $pdo->exec($migration); } catch (Exception $e) {} }

    $adminNotes = trim((string)($body['adminNotes'] ?? 'Payment manually verified by administrator.'));
    if (!empty($order['group_id'])) {
        $upd = $pdo->prepare("UPDATE orders SET payment_status = 'VERIFIED_MANUAL', payment_confirmed = 1, admin_notes = ?, updated_at = NOW() WHERE group_id = ? AND status NOT IN ('CANCELLED', 'REJECTED')");
        $upd->execute([$adminNotes, $order['group_id']]);
    } else {
        $upd = $pdo->prepare("UPDATE orders SET payment_status = 'VERIFIED_MANUAL', payment_confirmed = 1, admin_notes = ?, updated_at = NOW() WHERE id = ?");
        $upd->execute([$adminNotes, $orderId]);
    }
    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'PAYMENT_MANUALLY_VERIFIED', "Payment manually verified for order #{$order['order_number']}");

    $autoApprove = array_key_exists('autoApprove', $body) && (bool)$body['autoApprove'];
    if ($autoApprove) {
        $_GET['id'] = $orderId;
        require __DIR__ . '/approve_order.php';
        exit;
    }
    $fresh = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $fresh->execute([$orderId]);
    jsonResponse(['success' => true, 'message' => 'Payment manually verified. The order is ready for approval.', 'order' => $fresh->fetch()]);
}

// 1b. GET /api/admin/orders/:id/preview-html (Returns exact single-source HTML)
if (preg_match('/admin\/orders\/([^\/]+)\/preview-html/', $path, $matches) && $method === 'GET') {
    $orderId = $matches[1];
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
    $refreshResult = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");
    $refreshResult->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $order['id']]);
    $order['calculated_result'] = json_encode($result, JSON_UNESCAPED_UNICODE);

    $order['language'] = astro_normalize_report_language($order['language'] ?? 'en');
    require_once __DIR__ . '/../astrology/pdf_mpdf_reports.php';
    $html = AstroReportViews::renderFullReportHtml($order, $result);

    if (isset($_GET['format']) && $_GET['format'] === 'json') {
        jsonResponse(['success' => true, 'html' => $html]);
    } else {
        header('Content-Type: text/html; charset=UTF-8');
        echo $html;
        exit;
    }
}

// 1c. POST /api/admin/preview-html (Returns exact single-source HTML for any live preview)
if (strpos($path, 'admin/preview-html') !== false && $method === 'POST') {
    $body = getJsonBody();
    $serviceType = $body['serviceType'] ?? 'BIRTH_JATHAGAM';
    $lang = astro_normalize_report_language($body['language'] ?? 'ta');
    $result = $body['result'] ?? [];
    $order = $body['order'] ?? [
        'service_type' => $serviceType,
        'order_number' => 'PREVIEW-' . strtoupper(substr(md5(uniqid()), 0, 6)),
        'language' => $lang,
        'user_name' => $result['nativeName'] ?? ($result['devoteeName'] ?? 'Valued User')
    ];
    if (!is_array($order)) $order = [];
    $order['service_type'] = $order['service_type'] ?? $serviceType;
    $order['language'] = astro_normalize_report_language($order['language'] ?? $lang);

    require_once __DIR__ . '/../astrology/pdf_mpdf_reports.php';
    $html = AstroReportViews::renderFullReportHtml($order, $result);

    if (isset($_GET['format']) && $_GET['format'] === 'raw') {
        header('Content-Type: text/html; charset=UTF-8');
        echo $html;
        exit;
    } else {
        jsonResponse(['success' => true, 'html' => $html]);
    }
}

// 1d. GET /api/admin/orders/:id/pdf & invoice-pdf & invoice (Direct download in admin)
if (preg_match('/admin\/orders\/([^\/]+)\/(pdf|invoice-pdf|invoice)/', $path, $matches) && $method === 'GET') {
    $orderId = $matches[1];
    $docType = $matches[2];

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $lang = astro_normalize_report_language($_GET['lang'] ?? ($order['language'] ?? 'ta'));
    $order['language'] = $lang;

    try {
        if ($docType === 'pdf') {
            $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
            $refreshResult = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");
            $refreshResult->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $orderId]);
            $order['calculated_result'] = json_encode($result, JSON_UNESCAPED_UNICODE);
            $pdfContent = AstroEngine::generateReportPdf($order, $result);
            $filename = "ASTRO_SIVAM_Report_{$order['order_number']}_{$lang}.pdf";
        } else {
            $pdfContent = AstroEngine::generateInvoicePdf($order);
            $filename = "ASTRO_SIVAM_Invoice_{$order['order_number']}.pdf";
        }
    } catch (\Throwable $e) {
        error_log('Admin PDF generation failed; no fallback PDF was produced: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'message' => 'High-quality PDF generation is unavailable right now. No lower-quality PDF was produced; please retry later.'
        ], 503);
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdfContent));
    echo $pdfContent;
    exit;
}

// 1e. POST /api/admin/orders/:id/stage-doc
//     POST /api/admin/family-orders/:groupId/stage-doc
//     DELETE (same paths) - discard staged documents
//
//     The admin panel renders every report / invoice in the browser at the same
//     high resolution as the live preview. A family bundle cannot reliably fit
//     inside ONE JSON body, so each document is uploaded with its OWN request
//     here and picked up from disk by the approve / resend handlers. Those
//     handlers fail closed if any required preview PDF is missing.
if (preg_match('/(?:family-orders|admin\/orders)\/([^\/]+)\/stage-doc/', $path, $matches)
    && in_array($method, ['POST', 'DELETE'], true)) {

    $rawId = $matches[1];
    $isFamilyRoute = strpos($path, 'family-orders') !== false;

    // A single order stages under "order_<id>" unless it belongs to a family
    // bundle, in which case the group id is the staging scope so ONE approve
    // call can collect every member document.
    $scope = $rawId;
    if (!$isFamilyRoute) {
        $stmt = $pdo->prepare("SELECT group_id FROM orders WHERE id = ? LIMIT 1");
        $stmt->execute([$rawId]);
        $row = $stmt->fetch();
        if ($row && !empty($row['group_id'])) {
            $scope = $row['group_id'];
        } else {
            $scope = 'order_' . $rawId;
        }
    }

    if ($method === 'DELETE') {
        jsonResponse([
            'success' => true,
            'removed' => astroClearStagedFamilyDocs($scope),
            'message' => 'Staged preview documents discarded.'
        ]);
    }

    $body = getJsonBody();
    if (empty($body)) {
        // The request body was dropped (post_max_size / ModSecurity). Tell the
        // admin panel explicitly; approval remains blocked until the exact
        // preview-quality document can be uploaded.
        jsonResponse([
            'success' => false,
            'message' => 'The document upload was rejected by the server before PHP could read it '
                . '(request body too large). Raise post_max_size / upload_max_filesize in '
                . 'public_html/api/.user.ini and retry.',
            'bodyTooLarge' => true,
            'postMaxSize' => ini_get('post_max_size'),
            'uploadMaxFilesize' => ini_get('upload_max_filesize')
        ], 413);
    }

    jsonResponse(astroStageFamilyDoc($pdo, $admin, $scope, $body));
}

// 1g. Multi-person order items
//     GET  /api/admin/orders/:id/items/:itemId/result  -> get-or-calculate the
//          ONE cached result that both Preview and Send use
//     POST /api/admin/orders/:id/items/:itemId/send    -> one email per order,
//          carrying THIS report + the order's tax invoice
//     POST /api/admin/orders/:id/items/send-all        -> every report of the
//          order + one invoice in ONE email
if (preg_match('/admin\/orders\/([^\/]+)\/items\/(\d+)\/result/', $path, $matches) && $method === 'GET') {
    require_once __DIR__ . '/order_items.php';
    astro_admin_order_item_action($pdo, $admin, $matches[1], $matches[2], 'result', []);
}

if (preg_match('/admin\/orders\/([^\/]+)\/items\/(\d+)\/(send|resend)/', $path, $matches) && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'delivery');
    require_once __DIR__ . '/order_items.php';
    astro_admin_order_item_action($pdo, $admin, $matches[1], $matches[2], $matches[3], getJsonBody());
}

if (preg_match('/admin\/orders\/([^\/]+)\/items\/send-all/', $path, $matches) && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'delivery');
    require_once __DIR__ . '/order_items.php';
    astro_admin_order_item_action($pdo, $admin, $matches[1], null, 'send-all', getJsonBody());
}

// 2. POST /api/admin/orders/:id/approve
if (preg_match('/admin\/orders\/([^\/]+)\/approve/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    astro_admin_action_limit($pdo, $admin, 'delivery');
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $body = getJsonBody();

    if ((float)($order['amount'] ?? 0) > 0) {
        $paymentStatus = strtoupper((string)($order['payment_status'] ?? ''));
        if (!in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) && (int)($order['payment_confirmed'] ?? 0) !== 1) {
            jsonResponse(['success' => false, 'message' => 'Payment verification is required before approving this paid order.'], 409);
        }
    }

    // FAMILY ORDERS: this row belongs to a multi-chart bundle that was paid
    // for with a single payment, so it must be fulfilled as one delivery
    // carrying every report + ONE consolidated family tax invoice. Approving
    // the single row here would send 1 report + 1 invoice per member.
    // $body may carry preview-exact high-quality PDFs from the admin live
    // preview (reportPdfs + invoicePdfBase64) - forwarded so the customer
    // receives exactly what the admin previewed.
    if (!empty($order['group_id'])) {
        jsonResponse(astroApproveFamilyGroup($pdo, $admin, $order['group_id'], 'approve', $body));
    }

    // MULTI-PERSON ORDERS: ONE header row (`service_type = MULTI_PERSON`) plus
    // order_items. The per-item action rebuilds each result from that item's
    // saved inputs, and the customer receives ONE email with every report + one invoice.
    require_once __DIR__ . '/order_items.php';
    if (astro_order_uses_items($order, astro_order_items_all($pdo, $orderId))) {
        astro_admin_order_item_action($pdo, $admin, $orderId, null, 'approve', $body);
    }
    // Always rebuild and persist from the saved service inputs; the cached
    // calculated_result is never the source of truth for approval.
    $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
    $refreshResult = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");
    $refreshResult->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $orderId]);
    $order['calculated_result'] = json_encode($result, JSON_UNESCAPED_UNICODE);

    if (!empty($body['language'])) {
        $order['language'] = astro_normalize_report_language($body['language']);
    }

    // Customer email fulfillment requires both browser-rendered PDFs. A missing
    // or oversized payload is a hard failure, never a reason to substitute mPDF.
    $stagedScope = 'order_' . $orderId;
    $stagedDocs = astroLoadStagedFamilyDocs($stagedScope);
    $clientDocs = astroSingleOrderClientDocs($body, $stagedDocs, $orderId, $order['order_number']);
    if ($clientDocs['report'] === null || $clientDocs['invoice'] === null) {
        $missing = [];
        if ($clientDocs['report'] === null) $missing[] = 'report';
        if ($clientDocs['invoice'] === null) $missing[] = 'invoice';
        jsonResponse([
            'success' => false,
            'message' => 'Preview-quality ' . implode(' and ', $missing) . ' PDF did not reach the server. No email was sent; render and upload both documents before approving.'
        ], 422);
    }
    $reportPdf = $clientDocs['report'];
    $invoicePdf = $clientDocs['invoice'];

    // Fetch SMTP settings
    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $emailSettings = $sRow ? json_decode($sRow['email_settings'], true) : [];

    // Human-readable service name for the email body
    $serviceDisplayNames = [
        'BIRTH_JATHAGAM' => 'Vedic Birth Jathagam (Horoscope)',
        'MARRIAGE_COMPATIBILITY' => 'Vedic Marriage Compatibility (10 Poruthams)',
        'BABY_NAMING' => 'Vedic Namakaran (Baby Naming)',
        'MUHURTHAM' => 'Subha Muhurtham (6-Month Auspicious Dates)'
    ];
    $serviceDisplayName = $serviceDisplayNames[$order['service_type']] ?? $order['service_type'];
    $orderDateDisplay = date('d M Y', strtotime($order['created_at'] ?? 'now'));
    $orderAmountDisplay = htmlspecialchars($order['currency'] ?? 'FJD') . ' $' . number_format(floatval($order['amount'] ?? 0), 2);

    // Email HTML content - maroon/gold temple branding to match the report & invoice PDFs
    $html = "
    <div style='background:#f4ede1; padding:24px 12px; font-family: Georgia, \'Times New Roman\', serif;'>
    <div style='max-width: 600px; margin: 0 auto; background: #fffdf9; border: 1px solid #e8d9b8; border-radius: 10px; overflow: hidden;'>

      <!-- Header -->
      <div style='background: #7a1f1f; padding: 22px 24px; text-align: center;'>
        " . astro_email_logo_tag(56) . "
        <div style='color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;'>ASTRO SIVAM</div>
        <div style='color:#e9c98a; font-size:12px; margin-top:2px; letter-spacing:0.5px;'>AUTHENTIC VEDIC ASTROLOGY & MATCHMAKING SERVICES</div>
      </div>
      <div style='height:4px; background: repeating-linear-gradient(90deg, #c9962c 0 10px, #7a1f1f 10px 20px);'></div>

      <!-- Body -->
      <div style='padding: 26px 26px 8px;'>
        <p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>" . htmlspecialchars($order['user_name']) . "</strong>,</p>
        <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
          We are pleased to inform you that your order has been verified, calculated with precision Nirayana Vedic ephemeris, and approved by the ASTRO SIVAM administration. Your official documents are attached to this email.
        </p>

        <!-- Order Summary -->
        <div style='border:1px solid #e8d9b8; border-left:4px solid #7a1f1f; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#fbf6ea;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Order Summary</div>
          <table style='width:100%; border-collapse:collapse; font-size:13px; color:#3d3222;'>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Order Number</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($order['order_number']) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Service</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($serviceDisplayName) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Date Approved</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($orderDateDisplay) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Amount Paid</td>
              <td style='padding:3px 0; text-align:right; font-weight:700; color:#166534;'>" . $orderAmountDisplay . "</td>
            </tr>
          </table>
        </div>

        <!-- Attached Documents -->
        <div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#ffffff;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Attached Documents</div>
          <div style='font-size:13px; color:#3d3222; line-height:1.8;'>
            <div>&#10003;&nbsp; <strong>ASTRO_SIVAM_Report_" . htmlspecialchars($order['order_number']) . ".pdf</strong> &mdash; Official Astrological Report</div>
            <div>&#10003;&nbsp; <strong>ASTRO_SIVAM_Invoice_" . htmlspecialchars($order['order_number']) . ".pdf</strong> &mdash; Official Tax Invoice & Payment Receipt</div>
          </div>
        </div>

        <!-- Spam Folder Notice -->
        <div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'>
          <strong>Delivery Notice:</strong> If this email lands in your <em>Spam / Junk folder</em>, please mark it <strong>'Not Spam'</strong> and add <strong>admin@astrosivam.com</strong> to your contacts so you don't miss future updates.
        </div>

        <p style='color:#6b5c3e; font-size:12px; line-height:1.6; margin:0 0 4px;'>The two attached PDFs are your official records &mdash; please save them securely, as they are generated for you at the time of sending and are not stored on our servers afterward.</p>
      </div>

      <!-- Footer -->
      <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:16px 24px; text-align:center;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings & Warm Regards, ASTRO SIVAM Team</div>
        <div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div>
      </div>

    </div>
    </div>";

    $attachments = [
        ['name' => "ASTRO_SIVAM_Report_{$order['order_number']}.pdf", 'content' => $reportPdf],
        ['name' => "ASTRO_SIVAM_Invoice_{$order['order_number']}.pdf", 'content' => $invoicePdf]
    ];

    $mailResult = AstroMailer::sendEmailWithAttachments(
        $order['user_email'],
        $order['user_name'],
        "ASTRO SIVAM: Your Official PDF Report & Tax Invoice (#{$order['order_number']})",
        $html,
        $attachments,
        $emailSettings,
        astro_inline_logo_attachment()
    );

    $emailStatus = $mailResult['success'] ? 'SENT' : 'FAILED';
    $emailMsg = $mailResult['message'] ?? '';

    // Order is only "COMPLETED" once the report + invoice have actually been
    // delivered by email. If sending failed, keep it in PROCESSING (not
    // COMPLETED) so it's clear to the admin that the customer has NOT
    // received their PDFs yet and the approval needs to be retried.
    // No PDF is ever written to disk here or elsewhere - $reportPdf and
    // $invoicePdf exist only in memory for the duration of this request and
    // are attached directly to the outgoing email, never persisted.
    $finalStatus = $mailResult['success'] ? 'COMPLETED' : 'PROCESSING';

    // The staged preview render (if any) has been delivered - remove it.
    if ($mailResult['success']) {
        astroClearStagedFamilyDocs($stagedScope);
    }

    $upd = $pdo->prepare("UPDATE orders SET status = ?, payment_confirmed = 1, email_status = ?, email_sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE email_sent_at END, email_last_status_message = ?, calculated_result = ?, has_pdf = 1, has_invoice = 1, updated_at = NOW() WHERE id = ?");
    $upd->execute([$finalStatus, $emailStatus, $emailStatus, $emailMsg, json_encode($result, JSON_UNESCAPED_UNICODE), $orderId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'ORDER_APPROVED', "Approved order #{$order['order_number']} | document quality: {$clientDocs['quality']}" . ($mailResult['success'] ? " and emailed dual PDFs (order marked COMPLETED)" : " but email delivery FAILED - order kept in PROCESSING for retry"));

    // Best-effort WhatsApp/Viber "order complete" alert (never blocks approval).
    if ($finalStatus === 'COMPLETED') {
        $order['status'] = $finalStatus;
        AstroChatAlerts::sendOrderAlerts($pdo, 'order_completed', [$order]);
    }

    jsonResponse([
        'success' => $mailResult['success'],
        'message' => $mailResult['success']
            ? "Order #{$order['order_number']} approved and completed. Report & Invoice PDFs generated and emailed to {$order['user_email']}."
            : "Order #{$order['order_number']} was calculated, but the email to {$order['user_email']} FAILED to send ({$emailMsg}). The order was NOT marked complete - please fix the email issue and approve again.",
        'emailStatus' => $emailStatus,
        'emailMessage' => $emailMsg,
        'orderStatus' => $finalStatus,
        // Both attached PDFs have passed validation as browser-rendered previews.
        'renderQuality' => $clientDocs['quality'],
        'invoiceQuality' => 'PREVIEW_EXACT'
    ], $mailResult['success'] ? 200 : 503);
}

// 2b. POST /api/admin/orders/:id/resend-email
if (preg_match('/admin\/orders\/([^\/]+)\/resend-email/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    astro_admin_action_limit($pdo, $admin, 'delivery');
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }
    if ((float)($order['amount'] ?? 0) > 0) {
        $paymentStatus = strtoupper((string)($order['payment_status'] ?? ''));
        if (!in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) && (int)($order['payment_confirmed'] ?? 0) !== 1) {
            jsonResponse(['success' => false, 'message' => 'Payment verification is required before fulfilling this paid order.'], 409);
        }
    }

    $body = getJsonBody();
    if (!empty($order['group_id'])) {
        jsonResponse(astroApproveFamilyGroup($pdo, $admin, $order['group_id'], 'resend', $body));
    }

    // MULTI-PERSON ORDERS: re-deliver every item's report + one invoice.
    require_once __DIR__ . '/order_items.php';
    if (astro_order_uses_items($order, astro_order_items_all($pdo, $orderId))) {
        astro_admin_order_item_action($pdo, $admin, $orderId, null, 'resend', $body);
    }

    $result = AstroEngine::rebuildReportResultFromSavedInputs($order);
    $refreshResult = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");
    $refreshResult->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $orderId]);
    $order['calculated_result'] = json_encode($result, JSON_UNESCAPED_UNICODE);

    if (!empty($body['language'])) {
        $order['language'] = astro_normalize_report_language($body['language']);
    }

    // Resends follow the same strict preview-quality contract as approvals.
    $stagedScope = 'order_' . $orderId;
    $stagedDocs = astroLoadStagedFamilyDocs($stagedScope);
    $clientDocs = astroSingleOrderClientDocs($body, $stagedDocs, $orderId, $order['order_number']);
    if ($clientDocs['report'] === null || $clientDocs['invoice'] === null) {
        $missing = [];
        if ($clientDocs['report'] === null) $missing[] = 'report';
        if ($clientDocs['invoice'] === null) $missing[] = 'invoice';
        jsonResponse([
            'success' => false,
            'message' => 'Preview-quality ' . implode(' and ', $missing) . ' PDF did not reach the server. No email was sent; render and upload both documents before resending.'
        ], 422);
    }
    $reportPdf = $clientDocs['report'];
    $invoicePdf = $clientDocs['invoice'];

    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $emailSettings = $sRow ? json_decode($sRow['email_settings'], true) : [];

    $serviceDisplayNames = [
        'BIRTH_JATHAGAM' => 'Vedic Birth Jathagam (Horoscope)',
        'MARRIAGE_COMPATIBILITY' => 'Vedic Marriage Compatibility (10 Poruthams)',
        'BABY_NAMING' => 'Vedic Namakaran (Baby Naming)',
        'MUHURTHAM' => 'Subha Muhurtham (6-Month Auspicious Dates)'
    ];
    $serviceDisplayName = $serviceDisplayNames[$order['service_type']] ?? $order['service_type'];
    $orderDateDisplay = date('d M Y', strtotime($order['created_at'] ?? 'now'));
    $orderAmountDisplay = htmlspecialchars($order['currency'] ?? 'FJD') . ' $' . number_format(floatval($order['amount'] ?? 0), 2);

    $html = "
    <div style='background:#f4ede1; padding:24px 12px; font-family: Georgia, \'Times New Roman\', serif;'>
    <div style='max-width: 600px; margin: 0 auto; background: #fffdf9; border: 1px solid #e8d9b8; border-radius: 10px; overflow: hidden;'>

      <div style='background: #7a1f1f; padding: 22px 24px; text-align: center;'>
        " . astro_email_logo_tag(56) . "
        <div style='color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;'>ASTRO SIVAM</div>
        <div style='color:#e9c98a; font-size:12px; margin-top:2px; letter-spacing:0.5px;'>AUTHENTIC VEDIC ASTROLOGY & MATCHMAKING SERVICES</div>
      </div>
      <div style='height:4px; background: repeating-linear-gradient(90deg, #c9962c 0 10px, #7a1f1f 10px 20px);'></div>

      <div style='padding: 26px 26px 8px;'>
        <p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>" . htmlspecialchars($order['user_name']) . "</strong>,</p>
        <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
          Here is your requested copy of your official ASTRO SIVAM astrological documents. Your official reports and tax invoice are attached below.
        </p>

        <div style='border:1px solid #e8d9b8; border-left:4px solid #7a1f1f; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#fbf6ea;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Order Summary</div>
          <table style='width:100%; border-collapse:collapse; font-size:13px; color:#3d3222;'>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Order Number</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($order['order_number']) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Service</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($serviceDisplayName) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Date</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($orderDateDisplay) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Amount Paid</td>
              <td style='padding:3px 0; text-align:right; font-weight:700; color:#166534;'>" . $orderAmountDisplay . "</td>
            </tr>
          </table>
        </div>

        <div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#ffffff;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Attached Documents</div>
          <div style='font-size:13px; color:#3d3222; line-height:1.8;'>
            <div>&#10003;&nbsp; <strong>ASTRO_SIVAM_Report_" . htmlspecialchars($order['order_number']) . ".pdf</strong> &mdash; Official Astrological Report</div>
            <div>&#10003;&nbsp; <strong>ASTRO_SIVAM_Invoice_" . htmlspecialchars($order['order_number']) . ".pdf</strong> &mdash; Official Tax Invoice & Payment Receipt</div>
          </div>
        </div>

        <div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'>
          <strong>Delivery Notice:</strong> If this email lands in your <em>Spam / Junk folder</em>, please mark it <strong>'Not Spam'</strong> and add <strong>admin@astrosivam.com</strong> to your contacts.
        </div>
      </div>

      <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:16px 24px; text-align:center;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings & Warm Regards, ASTRO SIVAM Team</div>
        <div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div>
      </div>

    </div>
    </div>";

    $attachments = [
        ['name' => "ASTRO_SIVAM_Report_{$order['order_number']}.pdf", 'content' => $reportPdf],
        ['name' => "ASTRO_SIVAM_Invoice_{$order['order_number']}.pdf", 'content' => $invoicePdf]
    ];

    $mailResult = AstroMailer::sendEmailWithAttachments(
        $order['user_email'],
        $order['user_name'],
        "ASTRO SIVAM: Official PDF Report & Tax Invoice (#{$order['order_number']})",
        $html,
        $attachments,
        $emailSettings,
        astro_inline_logo_attachment()
    );

    $emailStatus = $mailResult['success'] ? 'SENT' : 'FAILED';
    $emailMsg = $mailResult['message'] ?? '';

    $upd = $pdo->prepare("UPDATE orders SET email_status = ?, email_sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE email_sent_at END, email_last_status_message = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute([$emailStatus, $emailStatus, $emailMsg, $orderId]);

    if ($mailResult['success']) {
        astroClearStagedFamilyDocs($stagedScope);
    }

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'EMAIL_RESENT', "Resent PDF report & invoice email to {$order['user_email']} for order #{$order['order_number']} | document quality: {$clientDocs['quality']}");

    jsonResponse([
        'success' => $mailResult['success'],
        'message' => $mailResult['success']
            ? "Report & Invoice PDFs successfully resent to {$order['user_email']}."
            : "Failed to send email to {$order['user_email']} ({$emailMsg}).",
        'emailStatus' => $emailStatus,
        'emailMessage' => $emailMsg,
        'renderQuality' => $clientDocs['quality'],
        'invoiceQuality' => 'PREVIEW_EXACT'
    ], $mailResult['success'] ? 200 : 503);
}

// 3. POST /api/admin/orders/:id/reject
if (preg_match('/admin\/orders\/([^\/]+)\/reject/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    $body = getJsonBody();
    $reason = trim($body['reason'] ?? 'Payment reference could not be verified');

    $upd = $pdo->prepare("UPDATE orders SET status = 'REJECTED', admin_notes = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute([$reason, $orderId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'ORDER_REJECTED', "Rejected order {$orderId}: {$reason}");

    jsonResponse(['success' => true, 'message' => 'Order rejected successfully']);
}

// 3b. POST /api/admin/orders/:id/cancel
if (preg_match('/admin\/orders\/([^\/]+)\/cancel/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    $body = getJsonBody();
    $reason = trim($body['reason'] ?? 'Cancelled by administrator');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $upd = $pdo->prepare("UPDATE orders SET status = 'CANCELLED', admin_notes = ?, refund_reason = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute([$reason, $reason, $orderId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'ORDER_CANCELLED', "Cancelled order #{$order['order_number']}: {$reason}");

    jsonResponse(['success' => true, 'message' => "Order #{$order['order_number']} has been cancelled successfully."]);
}

// 3c. DELETE /api/admin/orders/:id
if (preg_match('/admin\/orders\/([^\/]+)$/', $path, $matches) && $method === 'DELETE') {
    $orderId = $matches[1];

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $del = $pdo->prepare("DELETE FROM orders WHERE id = ?");
    $del->execute([$orderId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'ORDER_DELETED', "Deleted order #{$order['order_number']} ({$orderId})");

    jsonResponse(['success' => true, 'message' => "Order #{$order['order_number']} permanently deleted."]);
}

// 3d. POST /api/admin/orders/:id/process-refund
if (preg_match('/admin\/orders\/([^\/]+)\/process-refund/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    $body = getJsonBody();
    $notes = trim($body['adminNotes'] ?? 'Refund processed by administrator.');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $upd = $pdo->prepare("UPDATE orders SET status = 'REFUNDED', refund_status = 'REFUNDED', admin_notes = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute([$notes, $orderId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'ORDER_REFUNDED', "Processed refund for order #{$order['order_number']}");

    jsonResponse(['success' => true, 'message' => "Refund for order #{$order['order_number']} recorded as completed."]);
}

// ===================================================================
// FAMILY ORDER GROUP MANAGEMENT (multiple charts, one payment, one
// customer, sharing the same orders.group_id from the multi-order
// checkout). These mirror the single-order approve/resend-email/cancel
// routes above, but operate on every order in the group at once and send all
// preview-exact reports + one consolidated invoice as one fulfillment,
// split into size-bounded email parts only when needed.
// ===================================================================

// 3e. POST /api/admin/family-orders/:groupId/approve
//     every devotee's report + ONE consolidated family invoice (split into
//     budget-sized emails when the bundle is too large for one message).
if (preg_match('/family-orders\/([^\/]+)\/approve/', $path, $matches) && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'delivery');
    jsonResponse(astroApproveFamilyGroup($pdo, $admin, $matches[1], 'approve', getJsonBody()));
}


// 3f. POST /api/admin/family-orders/:groupId/resend-email
//     Re-delivery of the SAME single consolidated message.
if (preg_match('/family-orders\/([^\/]+)\/resend-email/', $path, $matches) && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'delivery');
    jsonResponse(astroApproveFamilyGroup($pdo, $admin, $matches[1], 'resend', getJsonBody()));
}


// 3g. POST /api/admin/family-orders/:groupId/cancel
if (preg_match('/family-orders\/([^\/]+)\/cancel/', $path, $matches) && $method === 'POST') {
    $groupId = $matches[1];
    $body = getJsonBody();
    $reason = trim($body['reason'] ?? 'Cancelled by administrator');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ?");
    $stmt->execute([$groupId]);
    $groupOrders = $stmt->fetchAll();

    if (empty($groupOrders)) {
        jsonResponse(['success' => false, 'message' => 'Family order group not found'], 404);
    }

    $upd = $pdo->prepare("UPDATE orders SET status = 'CANCELLED', admin_notes = ?, refund_reason = ?, updated_at = NOW() WHERE group_id = ?");
    $upd->execute([$reason, $reason, $groupId]);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'FAMILY_ORDER_CANCELLED', "Cancelled family order group {$groupId} (" . count($groupOrders) . " charts): {$reason}");

    jsonResponse(['success' => true, 'message' => "Entire family package (" . count($groupOrders) . " charts) has been cancelled successfully."]);
}

// 3h. GET /api/admin/family-orders/:groupId/invoice-pdf (consolidated invoice, admin-authenticated)
if (preg_match('/family-orders\/([^\/]+)\/invoice-pdf/', $path, $matches) && $method === 'GET') {
    $groupId = $matches[1];
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ? ORDER BY created_at ASC");
    $stmt->execute([$groupId]);
    $groupOrders = $stmt->fetchAll();

    if (empty($groupOrders)) {
        jsonResponse(['success' => false, 'message' => 'Family order group not found'], 404);
    }

    try {
        $pdfContent = AstroEngine::generateFamilyInvoicePdf($groupOrders, $groupId);
    } catch (\Throwable $e) {
        error_log('Family invoice generation failed; no fallback PDF was produced: ' . $e->getMessage());
        jsonResponse(['success' => false, 'message' => 'High-quality family invoice generation is unavailable right now. No lower-quality PDF was produced; please retry later.'], 503);
    }
    $filename = "ASTRO_SIVAM_Family_Invoice_{$groupId}.pdf";

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdfContent));
    echo $pdfContent;
    exit;
}

// 4. GET & PUT /api/admin/settings
if (strpos($path, 'admin/settings') !== false && !strpos($path, 'test-email')) {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $row = $stmt->fetch();
        if ($row) {
            $general = json_decode($row['general_settings'] ?? '{}', true) ?: [];
            $email = json_decode($row['email_settings'] ?? '{}', true) ?: [];
            $pricing = json_decode($row['pricing'] ?? '{}', true) ?: [];
            $paymentMethods = json_decode($row['payment_methods'] ?? '{}', true) ?: [];

            // Merge all general settings into a unified full settings object
            $settings = array_merge($general, [
                'serviceMode' => $row['service_mode'] ?? $general['serviceMode'] ?? 'PAID',
                'freeBetaActive' => isset($row['free_beta_active']) ? (bool)$row['free_beta_active'] : ($general['freeBetaActive'] ?? false),
                'currency' => $row['currency'] ?? $general['currency'] ?? 'FJD',
                'pricing' => $pricing,
                'paymentMethods' => $paymentMethods,
                'emailSettings' => !empty($email) ? $email : ($general['emailSettings'] ?? [])
            ]);

            // Ensure specific keys exist with sensible defaults if not set
            if (!isset($settings['fijiPriceFJD'])) $settings['fijiPriceFJD'] = $general['fijiPriceFJD'] ?? 10;
            if (!isset($settings['intlPriceUSD'])) $settings['intlPriceUSD'] = $general['intlPriceUSD'] ?? 5;
            if (!isset($settings['googleLoginEnabled'])) $settings['googleLoginEnabled'] = $general['googleLoginEnabled'] ?? true;
            if (!isset($settings['googleClientId'])) $settings['googleClientId'] = $general['googleClientId'] ?? '';
            if (!isset($settings['facebookLoginEnabled'])) $settings['facebookLoginEnabled'] = $general['facebookLoginEnabled'] ?? true;
            if (!isset($settings['facebookAppId'])) $settings['facebookAppId'] = $general['facebookAppId'] ?? '';
            if (!isset($settings['facebookAppSecret'])) $settings['facebookAppSecret'] = $general['facebookAppSecret'] ?? '';
            if (!isset($settings['activeThemeTemplate'])) $settings['activeThemeTemplate'] = $general['activeThemeTemplate'] ?? 'classic-primary';
            if (!isset($settings['vodafoneMPaisaNumber'])) $settings['vodafoneMPaisaNumber'] = $general['vodafoneMPaisaNumber'] ?? '+679 999 1234';
            if (!isset($settings['vodafoneMPaisaPaymentMode'])) $settings['vodafoneMPaisaPaymentMode'] = $general['vodafoneMPaisaPaymentMode'] ?? 'offline';
            if (!isset($settings['indiaGpayPaymentMode'])) $settings['indiaGpayPaymentMode'] = $general['indiaGpayPaymentMode'] ?? 'offline';
            if (!isset($settings['paypalPaymentMode'])) $settings['paypalPaymentMode'] = $general['paypalPaymentMode'] ?? 'offline';
            if (!isset($settings['digicelMyCashNumber'])) $settings['digicelMyCashNumber'] = $general['digicelMyCashNumber'] ?? '+679 777 5678';
            if (!isset($settings['paypalEmail'])) $settings['paypalEmail'] = $general['paypalEmail'] ?? 'payments@astrosivam.com';
            if (!isset($settings['paypalClientId'])) $settings['paypalClientId'] = $general['paypalClientId'] ?? '';
            if (!isset($settings['paypalSecret'])) $settings['paypalSecret'] = $general['paypalSecret'] ?? $general['paypalClientSecret'] ?? '';
            if (!isset($settings['paypalMode'])) $settings['paypalMode'] = $general['paypalMode'] ?? 'sandbox';
            // WhatsApp/Viber order alert configuration (tokens included - admin only).
            if (!isset($settings['chatAlertSettings'])) $settings['chatAlertSettings'] = $general['chatAlertSettings'] ?? [];
        } else {
            $settings = [
                'serviceMode' => 'PAID',
                'freeBetaActive' => false,
                'fijiPriceFJD' => 10,
                'intlPriceUSD' => 5,
                'currency' => 'FJD',
                'googleLoginEnabled' => true,
                'googleClientId' => '',
                'facebookLoginEnabled' => true,
                'facebookAppId' => '',
                'facebookAppSecret' => '',
                'activeThemeTemplate' => 'classic-primary',
                'vodafoneMPaisaNumber' => '+679 999 1234',
                'vodafoneMPaisaPaymentMode' => 'offline',
                'indiaGpayPaymentMode' => 'offline',
                'paypalPaymentMode' => 'offline',
                'digicelMyCashNumber' => '+679 777 5678',
                'paypalEmail' => 'payments@astrosivam.com',
                'paypalClientId' => '',
                'paypalSecret' => '',
                'paypalMode' => 'sandbox',
                'supportEmail' => 'admin@astrosivam.com',
                'supportPhone' => '+679 999 8888',
                'emailSettings' => []
            ];
        }

        // Automated M-PAiSA checkout/capture is not implemented in this API.
        $settings['vodafoneMPaisaPaymentMode'] = 'offline';

        // FREE BETA RULE (1 free report per IP): also tell THIS connection
        // (admins can place customer orders too) whether its own free chart
        // is still unused, so the checkout prices chart 1 correctly.
        $betaModeActive = (($settings['serviceMode'] ?? 'PAID') === 'FREE_BETA') || (bool)($settings['freeBetaActive'] ?? false);
        $settings['betaFreeChartAvailable'] = false;
        if ($betaModeActive) {
            try {
                $betaIp = getClientIpAddress();
                $betaStmt = $pdo->prepare("SELECT COUNT(*) FROM beta_ip_orders WHERE ip_address = ?");
                $betaStmt->execute([$betaIp]);
                $settings['betaFreeChartAvailable'] = ((int)($betaStmt->fetchColumn() ?: 0)) < 1;
            } catch (Exception $e) {
                $settings['betaFreeChartAvailable'] = true;
            }
        }

        jsonResponse(['success' => true, 'settings' => astroRedactAdminSettings($settings)]);
    } elseif ($method === 'PUT') {
        $body = astroOmitBlankAdminSecrets(getJsonBody());
        // Automated M-PAiSA checkout/capture is not implemented in this API.
        if (($body['vodafoneMPaisaPaymentMode'] ?? null) === 'online') $body['vodafoneMPaisaPaymentMode'] = 'offline';
        
        // Fetch current row to merge changes
        $stmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $existingRow = $stmt->fetch();
        $existingGeneral = $existingRow ? (json_decode($existingRow['general_settings'] ?? '{}', true) ?: []) : [];
        $existingEmail = $existingRow ? (json_decode($existingRow['email_settings'] ?? '{}', true) ?: []) : [];
        $existingPricing = $existingRow ? (json_decode($existingRow['pricing'] ?? '{}', true) ?: []) : [];
        $existingPayment = $existingRow ? (json_decode($existingRow['payment_methods'] ?? '{}', true) ?: []) : [];

        // Deep merge body into general settings
        $mergedGeneral = array_merge($existingGeneral, $body);

        $serviceMode = $body['serviceMode'] ?? $mergedGeneral['serviceMode'] ?? ($existingRow['service_mode'] ?? 'PAID');
        $freeBetaActive = isset($body['freeBetaActive']) ? (!empty($body['freeBetaActive']) ? 1 : 0) : ($existingRow['free_beta_active'] ?? 0);
        $currency = $body['currency'] ?? $mergedGeneral['currency'] ?? ($existingRow['currency'] ?? 'FJD');
        
        $pricing = isset($body['pricing']) ? $body['pricing'] : ($body['servicePricing'] ?? $existingPricing);
        $paymentMethods = isset($body['paymentMethods']) ? $body['paymentMethods'] : $existingPayment;
        $emailSettings = isset($body['emailSettings']) ? array_merge($existingEmail, $body['emailSettings']) : $existingEmail;

        // Chat alert settings: nested-safe merge so a partial update (e.g. only
        // toggling "enabled") never wipes the stored WhatsApp/Viber credentials.
        if (isset($body['chatAlertSettings']) && is_array($body['chatAlertSettings'])) {
            $existingChat = is_array($existingGeneral['chatAlertSettings'] ?? null) ? $existingGeneral['chatAlertSettings'] : [];
            $mergedChat = array_merge($existingChat, $body['chatAlertSettings']);
            foreach (['whatsapp', 'viber'] as $chatChannelKey) {
                if (isset($body['chatAlertSettings'][$chatChannelKey]) && is_array($body['chatAlertSettings'][$chatChannelKey])) {
                    $mergedChat[$chatChannelKey] = array_merge(
                        is_array($existingChat[$chatChannelKey] ?? null) ? $existingChat[$chatChannelKey] : [],
                        $body['chatAlertSettings'][$chatChannelKey]
                    );
                }
            }
            $mergedGeneral['chatAlertSettings'] = $mergedChat;
        }

        $pricingJson = json_encode($pricing, JSON_UNESCAPED_UNICODE);
        $paymentJson = json_encode($paymentMethods, JSON_UNESCAPED_UNICODE);
        $emailJson = json_encode($emailSettings, JSON_UNESCAPED_UNICODE);
        $generalJson = json_encode($mergedGeneral, JSON_UNESCAPED_UNICODE);

        if ($existingRow) {
            $pdo->prepare("UPDATE system_settings SET service_mode = ?, free_beta_active = ?, currency = ?, pricing = ?, payment_methods = ?, email_settings = ?, general_settings = ?, updated_at = NOW() WHERE id = ?")->execute([
                $serviceMode, $freeBetaActive, $currency, $pricingJson, $paymentJson, $emailJson, $generalJson, $existingRow['id']
            ]);
        } else {
            $pdo->prepare("INSERT INTO system_settings (service_mode, free_beta_active, currency, pricing, payment_methods, email_settings, general_settings, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())")->execute([
                $serviceMode, $freeBetaActive, $currency, $pricingJson, $paymentJson, $emailJson, $generalJson
            ]);
        }

        logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'SETTINGS_UPDATED', 'Updated system settings & integrations');

        // Return updated settings
        $finalSettings = array_merge($mergedGeneral, [
            'serviceMode' => $serviceMode,
            'freeBetaActive' => (bool)$freeBetaActive,
            'currency' => $currency,
            'pricing' => $pricing,
            'paymentMethods' => $paymentMethods,
            'emailSettings' => $emailSettings
        ]);

        jsonResponse(['success' => true, 'message' => 'Settings saved successfully', 'settings' => astroRedactAdminSettings($finalSettings)]);
    }
}

// 5. POST /api/admin/settings/test-email (also accepts /api/admin/testing/email)
if (($strpos_test_email = (strpos($path, 'admin/settings/test-email') !== false || strpos($path, 'admin/testing/email') !== false)) && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'test-mail');
    $body = getJsonBody();
    $targetEmail = trim((string)($body['email'] ?? $body['testRecipient'] ?? $admin['email']));
    $settingsStmt = $pdo->query("SELECT email_settings, general_settings FROM system_settings ORDER BY id ASC LIMIT 1");
    $settingsRow = $settingsStmt->fetch();
    $storedEmailConfig = $settingsRow ? (json_decode($settingsRow['email_settings'] ?? '{}', true) ?: []) : [];
    if (!$storedEmailConfig && $settingsRow) {
        $storedGeneral = json_decode($settingsRow['general_settings'] ?? '{}', true) ?: [];
        $storedEmailConfig = is_array($storedGeneral['emailSettings'] ?? null) ? $storedGeneral['emailSettings'] : [];
    }
    $providedEmailConfig = is_array($body['emailSettings'] ?? null) ? $body['emailSettings'] : [];
    $emailConfig = array_merge($storedEmailConfig, $providedEmailConfig);
    $smtpUser = $emailConfig['smtpUsername'] ?? $emailConfig['smtpUser'] ?? '';
    $smtpPassword = trim((string)($emailConfig['smtpPassword'] ?? '')) !== ''
        ? $emailConfig['smtpPassword']
        : ($emailConfig['smtpPass'] ?? '');
    if (trim((string)($emailConfig['smtpHost'] ?? '')) === '' || trim((string)$smtpUser) === '' || !astroAdminSecretConfigured($smtpPassword)) {
        jsonResponse(['success' => false, 'message' => 'SMTP is not configured with a host, username and saved app password. No email was sent.'], 400);
    }

    $html = "
    <div style='font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;'>
      <h2 style='color: #b45309; margin-top: 0;'>ASTRO SIVAM - SMTP Diagnostic Test</h2>
      <p>This is an automated test email confirming that your PHP SMTP email system on BigRock cPanel is functioning properly.</p>
      <p style='background: #fffbeb; padding: 10px; border-left: 4px solid #f59e0b; color: #92400e;'>
        <strong>Note:</strong> If this email appeared in your Spam folder, check your SPF, DKIM, and DMARC records in cPanel Email Deliverability.
      </p>
      <p style='color: #64748b; font-size: 12px;'>Timestamp: " . date('Y-m-d H:i:s') . "</p>
    </div>";

    $res = AstroMailer::sendEmailWithAttachments(
        $targetEmail,
        $admin['name'],
        "ASTRO SIVAM: PHP SMTP Diagnostic Test Email",
        $html,
        [],
        $emailConfig
    );

    jsonResponse([
        'success' => $res['success'],
        'message' => $res['success'] ? "Test email accepted by the configured mail transport for {$targetEmail}" : "Email dispatch failed: {$res['message']}"
    ], $res['success'] ? 200 : 502);
}

// 5b. POST /api/admin/settings/test-alert (also accepts /api/admin/testing/chat-alert)
//     Dispatches a diagnostic WhatsApp/Viber message to a mobile number so the
//     operator can verify chat gateway credentials before enabling alerts.
if ((strpos($path, 'admin/settings/test-alert') !== false || strpos($path, 'admin/testing/chat-alert') !== false) && $method === 'POST') {
    $body = getJsonBody();
    $targetPhone = trim($body['phone'] ?? $body['testPhone'] ?? ($admin['mobile'] ?? ''));

    if ($targetPhone === '') {
        jsonResponse(['success' => false, 'message' => 'A destination mobile number is required for the test alert.'], 400);
    }

    // Allow testing with unsaved edits by accepting a settings snapshot.
    $baseSettings = AstroChatAlerts::getAlertSettings($pdo);
    if (isset($body['chatAlertSettings']) && is_array($body['chatAlertSettings'])) {
        $override = $body['chatAlertSettings'];
        foreach (['whatsapp', 'viber'] as $chatChannelKey) {
            if (isset($override[$chatChannelKey]) && is_array($override[$chatChannelKey])) {
                $override[$chatChannelKey] = array_merge(
                    is_array($baseSettings[$chatChannelKey] ?? null) ? $baseSettings[$chatChannelKey] : [],
                    $override[$chatChannelKey]
                );
            }
        }
        $baseSettings = array_merge($baseSettings, $override);
    }

    $channelList = ['whatsapp', 'viber'];
    if (!empty($body['channels']) && is_array($body['channels'])) {
        $filtered = array_values(array_intersect($body['channels'], ['whatsapp', 'viber']));
        if (!empty($filtered)) {
            $channelList = $filtered;
        }
    }

    $results = AstroChatAlerts::sendTestAlert($baseSettings, $targetPhone, $channelList);
    $success = false;
    $parts = [];
    foreach ($results as $r) {
        if ($r['success']) {
            $success = true;
        }
        $parts[] = strtoupper($r['channel']) . ': ' . ($r['success'] ? 'delivered' : 'failed - ' . $r['message']);
    }

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'CHAT_ALERT_TEST', 'Chat alert diagnostic sent to ' . $targetPhone . ': ' . implode(' | ', $parts));

    jsonResponse([
        'success' => $success,
        'message' => implode(' • ', $parts),
        'results' => $results
    ]);
}

// 5c. POST /api/admin/testing/payment
// This checks saved configuration only; it never claims a provider transaction occurred.
if ((strpos($path, 'admin/testing/payment') !== false || strpos($path, 'admin/settings/test-payment') !== false) && $method === 'POST') {
    $body = getJsonBody();
    $pm = strtoupper(trim((string)($body['method'] ?? '')));

    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt->fetch();
    $general = $sRow ? (json_decode($sRow['general_settings'] ?? '{}', true) ?: []) : [];
    if (!empty($body['settings']) && is_array($body['settings'])) {
        $general = array_merge($general, astroOmitBlankAdminSecrets($body['settings']));
    }

    $success = true;
    $message = '';
    if ($pm === 'GPAY') {
        $mode = strtolower((string)($general['indiaGpayPaymentMode'] ?? 'offline'));
        $upiId = trim((string)($general['indiaGpayUpiId'] ?? ''));
        $gpayNum = trim((string)($general['indiaGpayNumber'] ?? ''));
        $provider = strtolower((string)($general['indiaGpayOnlineProvider'] ?? 'razorpay'));
        $keyId = trim((string)($general['indiaGpayKeyId'] ?? ''));
        $hasRazorpaySecret = astroAdminSecretConfigured($general['indiaGpayKeySecret'] ?? null);
        $env = strtoupper((string)($general['indiaGpayEnvironment'] ?? 'sandbox'));
        if ($mode === 'online') {
            if ($provider !== 'razorpay') {
                $success = false;
                $message = "Online {$provider} checkout is not implemented. Only Razorpay has a server-side capture flow.";
            } elseif (strpos($keyId, 'rzp_') !== 0 || !$hasRazorpaySecret) {
                $success = false;
                $message = 'Razorpay online mode needs an rzp_ Key ID and a saved API secret. No checkout is available until both are configured.';
            } else {
                $message = "Razorpay {$env} credentials are present. Configuration check only—no provider request or payment was made. Complete a sandbox checkout before enabling live payments.";
            }
        } elseif ($upiId === '' && !preg_match('/^\+?[0-9 ()-]{7,20}$/', $gpayNum)) {
            $success = false;
            $message = 'Manual Google Pay / UPI mode needs a valid UPI ID or mobile number.';
        } else {
            $message = 'Manual Google Pay / UPI recipient details are configured. UTR references require administrator verification; no payment was tested.';
        }
    } elseif ($pm === 'MPAISA') {
        $mode = strtolower((string)($general['vodafoneMPaisaPaymentMode'] ?? 'offline'));
        $mpNum = trim((string)($general['vodafoneMPaisaNumber'] ?? ''));
        if ($mode === 'online') {
            $success = false;
            $message = 'Automated M-PAiSA checkout/capture is not implemented. Keep this gateway in manual mode and verify receipts with the provider.';
        } elseif (!preg_match('/^\+?[0-9 ()-]{7,20}$/', $mpNum)) {
            $success = false;
            $message = 'Manual M-PAiSA mode needs a valid recipient mobile number.';
        } else {
            $message = 'Manual M-PAiSA recipient details are configured. Receipts require administrator verification; no payment was tested.';
        }
    } elseif ($pm === 'PAYPAL') {
        $mode = strtolower((string)($general['paypalPaymentMode'] ?? 'offline'));
        $email = trim((string)($general['paypalEmail'] ?? ''));
        $clientId = trim((string)($general['paypalClientId'] ?? ''));
        $paypalSecret = $general['paypalClientSecret'] ?? $general['paypalSecret'] ?? null;
        $clientIdConfigured = strlen($clientId) >= 8 && !preg_match('/^(?:live_client_id|your[-_ ]|replace[-_ ]|placeholder)/i', $clientId);
        $env = strtoupper((string)($general['paypalMode'] ?? 'sandbox'));
        if ($mode === 'online') {
            if (!$clientIdConfigured || !astroAdminSecretConfigured($paypalSecret)) {
                $success = false;
                $message = 'PayPal online mode needs a real REST Client ID and saved Client Secret. No checkout is available until both are configured.';
            } else {
                $message = "PayPal {$env} credentials are present. Configuration check only—no provider request or payment was made. Complete a sandbox checkout before enabling live payments.";
            }
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $success = false;
            $message = 'Manual PayPal mode needs a valid receiver email address.';
        } else {
            $message = 'Manual PayPal recipient details are configured. Payment receipts require administrator verification; no payment was tested.';
        }
    } else {
        $success = false;
        $message = 'Unknown payment method. Select a specific gateway to check its saved configuration.';
    }

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'PAYMENT_TEST_RUN', "Configuration check for {$pm}: {$message}");
    jsonResponse(['success' => $success, 'message' => $message, 'testedAt' => date('c')]);
}

// 6. GET /api/admin/audit-logs
if (strpos($path, 'admin/audit-logs') !== false && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100");
    $rows = $stmt->fetchAll();
    jsonResponse(['success' => true, 'logs' => $rows]);
}

// 7. GET /api/admin/contact-messages
if (strpos($path, 'admin/contact-messages') !== false && $method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM contact_messages ORDER BY created_at DESC");
    $rows = $stmt->fetchAll();
    jsonResponse(['success' => true, 'messages' => $rows]);
}

// 7b. GET /api/admin/reports/financial
if (strpos($path, 'admin/reports/financial') !== false && $method === 'GET') {
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    
    $where = [];
    $params = [];
    if ($startDate) {
        $where[] = "created_at >= ?";
        $params[] = $startDate . " 00:00:00";
    }
    if ($endDate) {
        $where[] = "created_at <= ?";
        $params[] = $endDate . " 23:59:59";
    }
    
    $sql = "SELECT * FROM orders";
    if (!empty($where)) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    
    $totalPaymentsCount = 0;
    $totalPaymentsAmountFJD = 0.0;
    $totalPaymentsAmountUSD = 0.0;
    $totalPaymentsAmountINR = 0.0;
    $pendingPaymentsCount = 0;
    $approvedPaymentsCount = 0;
    $rejectedPaymentsCount = 0;
    $totalRefundsCount = 0;
    $totalRefundsAmountFJD = 0.0;
    $totalRefundsAmountUSD = 0.0;
    $totalRefundsAmountINR = 0.0;
    $pendingRefundsCount = 0;
    $betaUsageCount = 0;
    
    $revenueByService = [
        'BIRTH_JATHAGAM' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'MARRIAGE_COMPATIBILITY' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'BABY_NAMING' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'MUHURTHAM' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0]
    ];
    
    $revenueByPaymentMethod = [
        'MPAISA' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'MYCASH' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'GPAY' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'UPI' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'PAYPAL' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0],
        'NONE' => ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0]
    ];
    
    foreach ($rows as $r) {
        $mode = $r['service_mode'] ?? 'PAID';
        $status = $r['status'] ?? 'PENDING';
        $curr = strtoupper($r['currency'] ?? 'FJD');
        $amt = floatval($r['amount'] ?? 0);
        $st = $r['service_type'] ?? 'BIRTH_JATHAGAM';
        $pm = strtoupper($r['payment_method'] ?? 'NONE');
        
        if ($mode === 'FREE_BETA') {
            $betaUsageCount++;
        }
        
        if ($status === 'PENDING_APPROVAL' || $status === 'PENDING_PAYMENT_VERIFICATION') {
            $pendingPaymentsCount++;
        } elseif ($status === 'APPROVED' || $status === 'COMPLETED' || $status === 'PROCESSING') {
            $approvedPaymentsCount++;
            $totalPaymentsCount++;
            if ($curr === 'FJD') $totalPaymentsAmountFJD += $amt;
            if ($curr === 'USD') $totalPaymentsAmountUSD += $amt;
            if ($curr === 'INR') $totalPaymentsAmountINR += $amt;
            
            if (isset($revenueByService[$st])) {
                $revenueByService[$st]['count']++;
                if ($curr === 'FJD') $revenueByService[$st]['fjd'] += $amt;
                if ($curr === 'USD') $revenueByService[$st]['usd'] += $amt;
                if ($curr === 'INR') $revenueByService[$st]['inr'] += $amt;
            }
            
            if (!isset($revenueByPaymentMethod[$pm])) {
                $revenueByPaymentMethod[$pm] = ['fjd' => 0.0, 'usd' => 0.0, 'inr' => 0.0, 'count' => 0];
            }
            $revenueByPaymentMethod[$pm]['count']++;
            if ($curr === 'FJD') $revenueByPaymentMethod[$pm]['fjd'] += $amt;
            if ($curr === 'USD') $revenueByPaymentMethod[$pm]['usd'] += $amt;
            if ($curr === 'INR') $revenueByPaymentMethod[$pm]['inr'] += $amt;
        } elseif ($status === 'REJECTED') {
            $rejectedPaymentsCount++;
        } elseif ($status === 'REFUNDED') {
            $totalRefundsCount++;
            if ($curr === 'FJD') $totalRefundsAmountFJD += $amt;
            if ($curr === 'USD') $totalRefundsAmountUSD += $amt;
            if ($curr === 'INR') $totalRefundsAmountINR += $amt;
        } elseif ($status === 'CANCELLED' || $status === 'REFUND_REQUESTED') {
            $pendingRefundsCount++;
        }
    }
    
    $netRevenueFJD = $totalPaymentsAmountFJD - $totalRefundsAmountFJD;
    $netRevenueUSD = $totalPaymentsAmountUSD - $totalRefundsAmountUSD;
    $netRevenueINR = $totalPaymentsAmountINR - $totalRefundsAmountINR;
    
    $gpayCount = ($revenueByPaymentMethod['GPAY']['count'] ?? 0) + ($revenueByPaymentMethod['UPI']['count'] ?? 0);
    $gpayAmountINR = ($revenueByPaymentMethod['GPAY']['inr'] ?? 0.0) + ($revenueByPaymentMethod['UPI']['inr'] ?? 0.0);
    $gpayAmountFJD = ($revenueByPaymentMethod['GPAY']['fjd'] ?? 0.0) + ($revenueByPaymentMethod['UPI']['fjd'] ?? 0.0);
    
    $report = [
        'generatedAt' => date('c'),
        'dateRange' => ['startDate' => $startDate, 'endDate' => $endDate],
        'totalPaymentsCount' => $totalPaymentsCount,
        'totalPaymentsAmountFJD' => $totalPaymentsAmountFJD,
        'totalPaymentsAmountUSD' => $totalPaymentsAmountUSD,
        'totalPaymentsAmountINR' => $totalPaymentsAmountINR,
        'grossRevenueFJD' => $totalPaymentsAmountFJD,
        'grossRevenueUSD' => $totalPaymentsAmountUSD,
        'grossRevenueINR' => $totalPaymentsAmountINR,
        'pendingPaymentsCount' => $pendingPaymentsCount,
        'approvedPaymentsCount' => $approvedPaymentsCount,
        'rejectedPaymentsCount' => $rejectedPaymentsCount,
        'totalRefundsCount' => $totalRefundsCount,
        'totalRefundsAmountFJD' => $totalRefundsAmountFJD,
        'totalRefundsAmountUSD' => $totalRefundsAmountUSD,
        'totalRefundsAmountINR' => $totalRefundsAmountINR,
        'totalRefundsFJD' => $totalRefundsAmountFJD,
        'totalRefundsUSD' => $totalRefundsAmountUSD,
        'totalRefundsINR' => $totalRefundsAmountINR,
        'refundsCount' => $totalRefundsCount,
        'totalOrdersCount' => count($rows),
        'paidOrdersCount' => $totalPaymentsCount,
        'betaOrdersCount' => $betaUsageCount,
        'pendingRefundsCount' => $pendingRefundsCount,
        'netRevenueFJD' => $netRevenueFJD,
        'netRevenueUSD' => $netRevenueUSD,
        'netRevenueINR' => $netRevenueINR,
        'revenueByService' => $revenueByService,
        'revenueByPaymentMethod' => $revenueByPaymentMethod,
        'byPaymentMethod' => [
            'MPAISA' => ['amount' => $revenueByPaymentMethod['MPAISA']['fjd'] ?? 0.0, 'count' => $revenueByPaymentMethod['MPAISA']['count'] ?? 0],
            'MYCASH' => ['amount' => $revenueByPaymentMethod['MYCASH']['fjd'] ?? 0.0, 'count' => $revenueByPaymentMethod['MYCASH']['count'] ?? 0],
            'GPAY' => ['amount' => $gpayAmountINR > 0 ? $gpayAmountINR : $gpayAmountFJD, 'inrAmount' => $gpayAmountINR, 'fjdAmount' => $gpayAmountFJD, 'count' => $gpayCount],
            'UPI' => ['amount' => $revenueByPaymentMethod['UPI']['inr'] ?? 0.0, 'count' => $revenueByPaymentMethod['UPI']['count'] ?? 0],
            'PAYPAL' => ['amount' => $revenueByPaymentMethod['PAYPAL']['usd'] ?? 0.0, 'count' => $revenueByPaymentMethod['PAYPAL']['count'] ?? 0]
        ],
        'byServiceType' => [
            'BIRTH_JATHAGAM' => ['amount' => $revenueByService['BIRTH_JATHAGAM']['fjd'] ?? 0.0, 'count' => $revenueByService['BIRTH_JATHAGAM']['count'] ?? 0],
            'MARRIAGE_COMPATIBILITY' => ['amount' => $revenueByService['MARRIAGE_COMPATIBILITY']['fjd'] ?? 0.0, 'count' => $revenueByService['MARRIAGE_COMPATIBILITY']['count'] ?? 0],
            'BABY_NAMING' => ['amount' => $revenueByService['BABY_NAMING']['fjd'] ?? 0.0, 'count' => $revenueByService['BABY_NAMING']['count'] ?? 0],
            'MUHURTHAM' => ['amount' => $revenueByService['MUHURTHAM']['fjd'] ?? 0.0, 'count' => $revenueByService['MUHURTHAM']['count'] ?? 0]
        ],
        'betaUsageCount' => $betaUsageCount,
        'orders' => array_map(function($r) {
            return [
                'id' => $r['id'],
                'orderNumber' => $r['order_number'],
                'amount' => floatval($r['amount']),
                'currency' => $r['currency'],
                'serviceType' => $r['service_type'],
                'status' => $r['status'],
                'paymentMethod' => $r['payment_method'],
                'createdAt' => $r['created_at']
            ];
        }, $rows)
    ];
    
    jsonResponse(['success' => true, 'report' => $report]);
}

// 8. GET & POST & PUT & DELETE /api/admin/team
if (strpos($path, 'admin/team') !== false) {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM team_members ORDER BY display_order ASC");
        $rows = $stmt->fetchAll();
        $team = array_map(function($r) {
            return [
                'id' => $r['id'],
                'name' => $r['name'],
                'nameEn' => $r['name'],
                'nameTa' => $r['name_ta'] ?? '',
                'fullName' => $r['name'],
                'title' => $r['title'],
                'titleEn' => $r['title'],
                'titleTa' => $r['title_ta'],
                'titleHi' => $r['title_hi'],
                'bio' => $r['bio'],
                'location' => $r['location'],
                'experienceYears' => intval($r['experience_years']),
                'yearsOfExperience' => intval($r['experience_years']),
                'education' => $r['education'] ?? $r['title'] ?? '',
                'educationEn' => $r['education'] ?? $r['title'] ?? '',
                'educationTa' => $r['education_ta'] ?? '',
                'specialization' => $r['specialization'] ?? '',
                'specializations' => json_decode($r['specializations'], true) ?: [],
                'photoUrl' => $r['photo_url'],
                'isActive' => (bool)$r['is_active'],
                'displayOrder' => intval($r['display_order']),
                'contactPhone' => $r['contact_phone'],
                'contactEmail' => $r['contact_email']
            ];
        }, $rows);
        jsonResponse(['success' => true, 'team' => $team]);
    } elseif ($method === 'POST') {
        $body = getJsonBody();
        $id = $body['id'] ?? ('tm_' . uniqid());
        $name = $body['fullName'] ?? $body['nameEn'] ?? $body['name'] ?? 'Team Scholar';
        $name_ta = $body['nameTa'] ?? '';
        $title = $body['titleEn'] ?? $body['title'] ?? 'Vedic Astrologer';
        $title_ta = $body['titleTa'] ?? '';
        $title_hi = $body['titleHi'] ?? '';
        $bio = $body['bio'] ?? '';
        $location = $body['location'] ?? 'Tamil Nadu, India';
        $exp = intval($body['experienceYears'] ?? $body['yearsOfExperience'] ?? 10);
        $specs = isset($body['specializations']) && is_array($body['specializations']) ? json_encode($body['specializations']) : '[]';
        $photo = $body['photoUrl'] ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&fit=crop&q=80';
        $is_active = isset($body['isActive']) ? ($body['isActive'] ? 1 : 0) : 1;
        $order = intval($body['displayOrder'] ?? 1);

        $stmt = $pdo->prepare("INSERT INTO team_members (id, name, name_ta, title, title_ta, title_hi, bio, location, experience_years, specializations, photo_url, is_active, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), title=VALUES(title), updated_at=NOW()");
        $stmt->execute([$id, $name, $name_ta, $title, $title_ta, $title_hi, $bio, $location, $exp, $specs, $photo, $is_active, $order]);
        jsonResponse(['success' => true, 'message' => 'Team member saved successfully', 'member' => array_merge($body, ['id' => $id])]);
    } elseif ($method === 'PUT') {
        $body = getJsonBody();
        $parts = explode('/', trim($path, '/'));
        $id = end($parts);
        if ($id === 'team' || empty($id)) {
            $id = $body['id'] ?? ($_GET['id'] ?? '');
        }
        if ($id) {
            $sets = [];
            $params = [];
            if (isset($body['isActive'])) {
                $sets[] = "is_active = ?";
                $params[] = $body['isActive'] ? 1 : 0;
            }
            if (isset($body['fullName']) || isset($body['nameEn']) || isset($body['name'])) {
                $sets[] = "name = ?";
                $params[] = $body['fullName'] ?? $body['nameEn'] ?? $body['name'];
            }
            if (isset($body['titleEn']) || isset($body['title'])) {
                $sets[] = "title = ?";
                $params[] = $body['titleEn'] ?? $body['title'];
            }
            if (isset($body['experienceYears']) || isset($body['yearsOfExperience'])) {
                $sets[] = "experience_years = ?";
                $params[] = intval($body['experienceYears'] ?? $body['yearsOfExperience']);
            }
            if (isset($body['photoUrl'])) {
                $sets[] = "photo_url = ?";
                $params[] = $body['photoUrl'];
            }
            if (!empty($sets)) {
                $params[] = $id;
                $stmt = $pdo->prepare("UPDATE team_members SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE id = ?");
                $stmt->execute($params);
            }
            jsonResponse(['success' => true, 'message' => 'Team member updated']);
        }
        jsonResponse(['success' => false, 'message' => 'ID missing for update'], 400);
    } elseif ($method === 'DELETE') {
        $parts = explode('/', trim($path, '/'));
        $id = end($parts);
        if ($id === 'team' || empty($id)) {
            $id = $_GET['id'] ?? '';
        }
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM team_members WHERE id = ?");
            $stmt->execute([$id]);
            jsonResponse(['success' => true, 'message' => 'Team member removed']);
        }
        jsonResponse(['success' => false, 'message' => 'ID missing for deletion'], 400);
    }
}

// 9. GET /api/admin/users
if (strpos($path, 'admin/users') !== false && $method === 'GET') {
    $stmt = $pdo->query("SELECT id, name, email, mobile, role, country, created_at, last_login FROM users ORDER BY created_at DESC");
    $rows = $stmt->fetchAll();
    jsonResponse(['success' => true, 'users' => $rows]);
}

// 11. BANNED IPS MANAGEMENT (GET, POST, DELETE /api/admin/banned-ips)
if (strpos($path, 'admin/banned-ips') !== false) {
    // Ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS `banned_ips` (
      `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      `ip_address` VARCHAR(64) NOT NULL UNIQUE,
      `reason` VARCHAR(255) NOT NULL DEFAULT 'Repeated fake orders / policy violation',
      `banned_by` VARCHAR(191) NULL DEFAULT 'Admin',
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX `idx_banned_ip` (`ip_address`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM banned_ips ORDER BY created_at DESC");
        $rows = $stmt->fetchAll();
        $bannedIps = array_map(function($r) {
            return [
                'id' => 'ban_' . $r['id'],
                'ipAddress' => $r['ip_address'],
                'reason' => $r['reason'],
                'bannedBy' => $r['banned_by'],
                'bannedAt' => $r['created_at']
            ];
        }, $rows);
        jsonResponse(['success' => true, 'count' => count($bannedIps), 'bannedIps' => $bannedIps]);
    } elseif ($method === 'POST') {
        $body = getJsonBody();
        $ip = trim($body['ipAddress'] ?? '');
        $reason = trim($body['reason'] ?? 'Repeated fake orders / policy violation');
        if (empty($ip)) {
            jsonResponse(['success' => false, 'message' => 'IP address is required.'], 400);
        }

        $ins = $pdo->prepare("INSERT INTO banned_ips (ip_address, reason, banned_by, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by), created_at = NOW()");
        $ins->execute([$ip, $reason, $admin['name'] ?? 'Admin']);

        logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'IP_BANNED', "Banned IP {$ip}. Reason: {$reason}");

        jsonResponse([
            'success' => true,
            'message' => "IP {$ip} has been blocked. Future orders from this IP will be rejected."
        ]);
    } elseif ($method === 'DELETE') {
        $parts = explode('/', trim($path, '/'));
        $ip = end($parts);
        if ($ip === 'banned-ips' || empty($ip)) {
            $ip = $_GET['ip'] ?? '';
        }
        $ip = urldecode($ip);

        if (empty($ip)) {
            jsonResponse(['success' => false, 'message' => 'IP address missing for unban.'], 400);
        }

        $del = $pdo->prepare("DELETE FROM banned_ips WHERE ip_address = ?");
        $del->execute([$ip]);

        logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'IP_UNBANNED', "Unbanned IP {$ip}");

        jsonResponse([
            'success' => true,
            'message' => "IP {$ip} has been unblocked. Orders can now be received."
        ]);
    }
}

// 12. POST /api/admin/orders/:id/ban-ip
if (preg_match('/admin\/orders\/([^\/]+)\/ban-ip/', $path, $matches) && $method === 'POST') {
    $orderId = $matches[1];
    $body = getJsonBody();
    $reason = trim($body['reason'] ?? 'Fake order / fake transaction number');

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $ip = $order['ip_address'] ?? null;
    if (empty($ip)) {
        jsonResponse(['success' => false, 'message' => 'This order does not contain an IP address.'], 400);
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS `banned_ips` (
      `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      `ip_address` VARCHAR(64) NOT NULL UNIQUE,
      `reason` VARCHAR(255) NOT NULL DEFAULT 'Repeated fake orders / policy violation',
      `banned_by` VARCHAR(191) NULL DEFAULT 'Admin',
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX `idx_banned_ip` (`ip_address`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    $ins = $pdo->prepare("INSERT INTO banned_ips (ip_address, reason, banned_by, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by), created_at = NOW()");
    $ins->execute([$ip, $reason . " (#" . $order['order_number'] . ")", $admin['name'] ?? 'Admin']);

    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'IP_BANNED', "Banned IP {$ip} from order #{$order['order_number']}. Reason: {$reason}");

    jsonResponse([
        'success' => true,
        'message' => "IP {$ip} for order #{$order['order_number']} ({$order['user_name']}) has been blocked."
    ]);
}

// ---------------------------------------------------------------------------
// 13. PAYMENT RECOVERY — webhook audit trail + reconciliation of stale sessions
//
// A customer who pays but never returns to the browser leaves a CREATED intent.
// These endpoints let the operator see that state, and recover the payment from
// the provider instead of asking the customer to pay twice.
// ---------------------------------------------------------------------------
require_once __DIR__ . '/../payments.php';
astro_payment_ensure_tables($pdo);

// GET /api/admin/payments/recovery
if (strpos($path, 'admin/payments/recovery') !== false && $method === 'GET') {
    $minutes = isset($_GET['minutes']) ? (int)$_GET['minutes'] : 30;
    $minutes = max(5, min(24 * 60, $minutes));

    $staleStmt = $pdo->prepare("SELECT pi.*, u.email AS user_email, u.name AS user_name
        FROM payment_intents pi
        LEFT JOIN users u ON u.id = pi.user_id
        WHERE pi.status = 'CREATED' AND pi.created_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        ORDER BY pi.created_at ASC
        LIMIT 100");
    $staleStmt->execute([$minutes]);
    $stale = $staleStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $eventStmt = $pdo->query("SELECT * FROM payment_webhook_events ORDER BY received_at DESC, id DESC LIMIT 50");
    $events = $eventStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $config = astro_payment_provider_config($pdo);
    jsonResponse([
        'success' => true,
        'minutes' => $minutes,
        'staleCount' => count($stale),
        'stale' => $stale,
        'events' => $events,
        'providers' => [
            'razorpay' => [
                'checkoutConfigured' => !empty($config['razorpay']['configured']),
                'webhookSecretConfigured' => $config['razorpay']['webhook_secret'] !== ''
            ],
            'paypal' => [
                'checkoutConfigured' => !empty($config['paypal']['configured']),
                'webhookIdConfigured' => $config['paypal']['webhook_id'] !== ''
            ]
        ]
    ]);
}

// POST /api/admin/payments/reconcile  ({intentId} or {sweep:true})
if (strpos($path, 'admin/payments/reconcile') !== false && $method === 'POST') {
    astro_admin_action_limit($pdo, $admin, 'provider');
    $body = getJsonBody();
    $sweep = !empty($body['sweep']) || !empty($body['all']);
    $config = astro_payment_provider_config($pdo);

    if ($sweep) {
        $minutes = isset($body['minutes']) ? (int)$body['minutes'] : 30;
        $minutes = max(5, min(24 * 60, $minutes));
        $limit = 25;

        $staleStmt = $pdo->prepare("SELECT * FROM payment_intents WHERE status = 'CREATED' AND created_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE) ORDER BY created_at ASC LIMIT " . (int)$limit);
        $staleStmt->execute([$minutes]);
        $intents = $staleStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $results = [];
        $captured = 0;
        $failed = 0;
        foreach ($intents as $intent) {
            $outcome = astro_payment_reconcile_intent($pdo, $intent, $config);
            if ($outcome['status'] === 'CAPTURED') {
                $captured++;
                logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'PAYMENT_RECONCILED',
                    'Recovered payment for intent ' . $intent['id'] . ' (' . $intent['provider'] . ', ' . $intent['currency'] . ' ' . $intent['amount'] . ').');
            } elseif (in_array($outcome['status'], ['UNKNOWN', 'FAILED'], true)) {
                $failed++;
            }
            $results[] = $outcome;
        }
        logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'PAYMENT_RECONCILIATION_SWEEP',
            'Reconciled ' . count($intents) . ' stale payment intent(s): ' . $captured . ' captured, ' . $failed . ' unresolved.');
        jsonResponse([
            'success' => true,
            'message' => count($intents) . ' stale payment session(s) checked; ' . $captured . ' recovered.',
            'checked' => count($intents),
            'captured' => $captured,
            'failed' => $failed,
            'results' => $results
        ]);
    }

    $intentId = trim((string)($body['intentId'] ?? ''));
    if ($intentId === '') {
        jsonResponse(['success' => false, 'message' => 'Provide an intentId, or {"sweep": true} to check every stale session.'], 400);
    }
    $intent = astro_payment_intent_by_id($pdo, $intentId);
    if (!$intent) {
        jsonResponse(['success' => false, 'message' => 'Payment intent not found.'], 404);
    }
    $outcome = astro_payment_reconcile_intent($pdo, $intent, $config);
    if ($outcome['status'] === 'CAPTURED') {
        logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'PAYMENT_RECONCILED',
            'Recovered payment for intent ' . $intent['id'] . ' (' . $intent['provider'] . ', ' . $intent['currency'] . ' ' . $intent['amount'] . '). Reference ' . ($outcome['paymentReference'] ?? '') . '.');
    }
    jsonResponse([
        'success' => in_array($outcome['status'], ['CAPTURED', 'ALREADY_CAPTURED'], true),
        'outcome' => $outcome
    ]);
}

// =========================================================================
// AI Astrologer escalation queue — customer complaints forwarded from the
// AI chat plus the "Talk to our astrologer" handoffs. The table is owned by
// api/migrations/007_ai_astrologer_chat.sql and bootstrapped here too, so
// the queue works even before the first chat request on a fresh database.
// =========================================================================
function astroAdminEnsureAiChatTables($pdo) {
    static $done = false;
    if ($done) return;
    $file = __DIR__ . '/../migrations/007_ai_astrologer_chat.sql';
    if (is_file($file)) {
        $sql = preg_replace('/^[[:blank:]]*--.*$/m', '', (string) file_get_contents($file));
        foreach (explode(';', (string) $sql) as $statement) {
            $statement = trim($statement);
            if ($statement === '') continue;
            try {
                $pdo->exec($statement);
            } catch (\Throwable $e) {
                // CREATE TABLE IF NOT EXISTS: any error here is surfaced by
                // the SELECT below, not swallowed silently.
            }
        }
    }
    $done = true;
}

if (strpos($path, 'admin/ai-handoffs') !== false) {
    astroAdminEnsureAiChatTables($pdo);

    if ($method === 'GET') {
        try {
            $rows = $pdo->query(
                "SELECT id, session_id, user_id, user_name, user_email, user_mobile,
                        language, question, reason, order_number, status, admin_notes,
                        resolved_at, created_at
                   FROM ai_chat_handoffs
                  ORDER BY (status = 'NEW') DESC, created_at DESC
                  LIMIT 200"
            )->fetchAll(PDO::FETCH_ASSOC);
            jsonResponse(['success' => true, 'count' => count($rows), 'handoffs' => $rows]);
        } catch (\Throwable $e) {
            error_log('AI handoffs list failed: ' . $e->getMessage());
            jsonResponse(['success' => true, 'count' => 0, 'handoffs' => [],
                'note' => 'The AI chat tables are not available on this database yet.']);
        }
    }

    // POST — update status / admin notes for one escalation.
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int) ($body['id'] ?? ($_GET['id'] ?? 0));
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Missing handoff id.'], 400);
    }
    $status = strtoupper(trim((string) ($body['status'] ?? '')));
    if (!in_array($status, ['NEW', 'ACKNOWLEDGED', 'RESOLVED'], true)) {
        jsonResponse(['success' => false, 'message' => 'status must be NEW, ACKNOWLEDGED or RESOLVED.'], 400);
    }
    $notes = isset($body['adminNotes']) ? mb_substr((string) $body['adminNotes'], 0, 2000, 'UTF-8') : null;

    $stmt = $pdo->prepare(
        "UPDATE ai_chat_handoffs
            SET status = ?,
                admin_notes = COALESCE(?, admin_notes),
                resolved_at = CASE WHEN ? = 'RESOLVED' THEN NOW() ELSE resolved_at END
          WHERE id = ?"
    );
    $stmt->execute([$status, $notes, $status, $id]);
    if ($stmt->rowCount() === 0) {
        jsonResponse(['success' => false, 'message' => 'Handoff not found.'], 404);
    }
    logAudit($pdo, $admin['id'], $admin['name'], 'admin', 'AI_HANDOFF_UPDATED',
        'AI chat escalation #' . $id . ' set to ' . $status . '.');
    jsonResponse(['success' => true, 'id' => $id, 'status' => $status]);
}

jsonResponse(['success' => false, 'message' => 'Admin endpoint not found'], 404);
