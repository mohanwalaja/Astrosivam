<?php
/**
 * ASTRO SIVAM - Admin Order Approval & Consolidated Mailer Dispatch Handler
 * 
 * Flow:
 * 1. Preview-PDF Validation & Aggregation:
 *    - Fetches all sub-orders matching group_id (or individual order id).
 *    - Requires each browser-rendered report and the matching invoice PDF.
 *    - Never substitutes a server-rendered PDF when a preview render is missing.
 * 2. Dispatch Execution:
 *    - Dispatches all reports + 1 consolidated invoice in one fulfillment,
 *      split into budget-sized emails when the bundle exceeds the mail limit.
 *    - Addresses the primary applicant and summarizes all member items.
 * 3. Atomic Database Update:
 *    - Updates status to 'COMPLETED', payment_confirmed = 1, email_status = 'SENT' in a single transaction.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../branding.php';
require_once __DIR__ . '/../chat_alerts.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/family_approval.php';

$pdo = getDbConnection();
$admin = requireAdmin($pdo);
astro_rate_limit_enforce(
    $pdo,
    'admin-action-delivery',
    (string)($admin['id'] ?? ''),
    30,
    600,
    'Too many approval emails were sent in a short time. Please wait a few minutes before continuing.'
);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(['success' => false, 'message' => 'Only POST method is allowed'], 405);
}

// 2. Extend Execution Limits for Multi-PDF Rendering Cycles
if (function_exists('set_time_limit')) {
    @set_time_limit(300);
}
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');
if (function_exists('ignore_user_abort')) {
    @ignore_user_abort(true);
}

// 3. Extract Order or Group ID
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$targetId = trim($_GET['group_id'] ?? ($_GET['id'] ?? ($body['group_id'] ?? ($body['groupId'] ?? ($body['id'] ?? '')))));

if (empty($targetId)) {
    sendResponse(['success' => false, 'message' => 'Missing required parameter: group_id or order id'], 400);
}

// 4. Retrieve matching orders
$stmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ? OR id = ? ORDER BY created_at ASC");
$stmt->execute([$targetId, $targetId]);
$matchedOrders = $stmt->fetchAll();

if (empty($matchedOrders)) {
    sendResponse(['success' => false, 'message' => 'No orders found matching the provided identifier'], 404);
}

// A paid order may only reach fulfillment after either provider capture or an
// explicit administrator verification. A receipt/reference alone is pending.
$unpaidOrders = array_values(array_filter($matchedOrders, function ($row) {
    if ((float)($row['amount'] ?? 0) <= 0) return false;
    $paymentStatus = strtoupper((string)($row['payment_status'] ?? ''));
    return !(in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) || (int)($row['payment_confirmed'] ?? 0) === 1);
}));
if (!empty($unpaidOrders)) {
    sendResponse(['success' => false, 'message' => 'Payment verification is required before approving this paid order.', 'unpaidOrders' => array_map(function ($row) { return $row['order_number']; }, $unpaidOrders)], 409);
}

$firstOrder = $matchedOrders[0];
$groupId = !empty($firstOrder['group_id']) ? $firstOrder['group_id'] : null;

// If part of a family group, ensure we fetch the complete group
if ($groupId) {
    $gStmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ? ORDER BY created_at ASC");
    $gStmt->execute([$groupId]);
    $matchedOrders = $gStmt->fetchAll();

    // A family bundle is ONE payment, so it must be fulfilled as one delivery
    // carrying every member's report + ONE consolidated tax invoice. Delegate to
    // the shared routine so this endpoint and /api/admin/family-orders/:groupId/*
    // can never drift apart and email the customer more than once.
    sendResponse(astroApproveFamilyGroup($pdo, $admin, $groupId, 'approve', $body));
}

// Standalone approval also requires both browser-rendered preview PDFs.
$singleOrderScope = 'order_' . (string)$firstOrder['id'];
$stagedSingleDocs = astroLoadStagedFamilyDocs($singleOrderScope);
$singleClientDocs = astroSingleOrderClientDocs($body, $stagedSingleDocs, $firstOrder['id'], $firstOrder['order_number']);
if ($singleClientDocs['report'] === null || $singleClientDocs['invoice'] === null) {
    $missing = [];
    if ($singleClientDocs['report'] === null) $missing[] = 'report';
    if ($singleClientDocs['invoice'] === null) $missing[] = 'invoice';
    sendResponse([
        'success' => false,
        'message' => 'Preview-quality ' . implode(' and ', $missing) . ' PDF did not reach the server. No email was sent; render and upload both documents before approving.'
    ], 422);
}

$isFamilyPackage = (count($matchedOrders) > 1) || !empty($groupId);
$primaryApplicantName = $firstOrder['user_name'];
$primaryApplicantEmail = $firstOrder['user_email'];

$serviceDisplayNames = [
    'BIRTH_JATHAGAM' => 'Vedic Birth Jathagam (Horoscope)',
    'MARRIAGE_COMPATIBILITY' => 'Vedic Marriage Compatibility (10 Poruthams)',
    'BABY_NAMING' => 'Vedic Namakaran (Baby Naming)',
    'MUHURTHAM' => 'Subha Muhurtham (6-Month Auspicious Dates)'
];

$currencySymbolMap = ['INR' => '₹', 'USD' => 'US$'];
$groupCurrency = $firstOrder['currency'] ?? 'FJD';
$groupCurrencySymbol = $currencySymbolMap[$groupCurrency] ?? 'FJ$';

// =========================================================================
// PHASE 1: COMPUTE ASTROLOGICAL DATA & SAVE RESULTS
// =========================================================================
$calculatedResults = [];
$updateCalcStmt = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");

foreach ($matchedOrders as &$o) {
    // Recalculate from the exact saved service payload on every approval; a
    // cached result can outlive edits to dates, locations, or birth countries.
    $result = AstroEngine::rebuildReportResultFromSavedInputs($o);

    $updateCalcStmt->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $o['id']]);
    $o['calculated_result'] = $result;

    $calculatedResults[$o['id']] = $result;
}
unset($o);

// =========================================================================
// PHASE 2: BATCH PDF AGGREGATION (N Member Reports + 1 Consolidated Invoice)
// =========================================================================
$attachments = [];
$memberRowsHtml = '';
$subtotal = 0.0;
$memberNamesList = [];

foreach ($matchedOrders as $idx => $o) {
    if (function_exists('set_time_limit')) {
        @set_time_limit(60);
    }

    $result = $calculatedResults[$o['id']] ?? null;
    $reportPdf = $singleClientDocs['report'];
    $reportFileName = "ASTRO_SIVAM_Report_{$o['order_number']}.pdf";

    if (!astroFamilyDocsIsPreviewQualityPdf($reportPdf)) {
        sendResponse(['success' => false, 'message' => 'Preview-quality report PDF is missing or invalid. No email was sent.'], 422);
    }
    $attachments[] = [
        'name' => $reportFileName,
        'content' => $reportPdf
    ];

    $svcName = $serviceDisplayNames[$o['service_type']] ?? $o['service_type'];
    $subtotal += (float)($o['amount'] ?? 0);
    $memberName = !empty($o['user_name']) ? $o['user_name'] : "User #" . ($idx + 1);
    $memberNamesList[] = $memberName;

    $memberRowsHtml .= "<div style='margin-bottom:6px;'>&#10003;&nbsp; <strong>" . htmlspecialchars($reportFileName) . "</strong> &mdash; " . htmlspecialchars($memberName) . " (" . htmlspecialchars($svcName) . ")</div>";

    unset($reportPdf);
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }
}

// Attach the browser-rendered preview invoice; there is no server-render fallback.
$invoicePdf = $singleClientDocs['invoice'];
$invoiceFileName = "ASTRO_SIVAM_Invoice_{$firstOrder['order_number']}.pdf";
if (!astroFamilyDocsIsPreviewQualityPdf($invoicePdf)) {
    sendResponse(['success' => false, 'message' => 'Preview-quality invoice PDF is missing or invalid. No email was sent.'], 422);
}
$attachments[] = [
    'name' => $invoiceFileName,
    'content' => $invoicePdf
];

// =========================================================================
// PHASE 3: SINGLE EMAIL DISPATCH WITH ALL ATTACHMENTS
// =========================================================================
$sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
$sRow = $sStmt->fetch();
$emailSettings = $sRow ? json_decode($sRow['email_settings'], true) : [];

$totalMembersCount = count($matchedOrders);
$subtotalDisplay = $groupCurrency . ' ' . $groupCurrencySymbol . number_format($subtotal, 2);
$orderDateDisplay = date('d M Y', strtotime($firstOrder['created_at'] ?? 'now'));
$membersSummaryString = implode(', ', $memberNamesList);

$emailSubject = $isFamilyPackage
    ? "ASTRO SIVAM: Family Package Order Approved - {$totalMembersCount} Reports & Consolidated Invoice"
    : "ASTRO SIVAM: Order Approved - {$firstOrder['order_number']} Report & Invoice";

$htmlBody = "
<div style='background:#f4ede1; padding:24px 12px; font-family: Georgia, \'Times New Roman\', serif;'>
  <div style='max-width: 620px; margin: 0 auto; background: #fffdf9; border: 1px solid #e8d9b8; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);'>

    <div style='background: #7a1f1f; padding: 22px 24px; text-align: center;'>
      " . astro_email_logo_tag(56) . "
      <div style='color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;'>ASTRO SIVAM</div>
      <div style='color:#e9c98a; font-size:12px; margin-top:2px; letter-spacing:0.5px;'>AUTHENTIC VEDIC ASTROLOGY & MATCHMAKING SERVICES</div>
    </div>
    <div style='height:4px; background: repeating-linear-gradient(90deg, #c9962c 0 10px, #7a1f1f 10px 20px);'></div>

    <div style='padding: 26px 26px 12px;'>
      <p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>" . htmlspecialchars($primaryApplicantName) . "</strong>,</p>
      
      <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
        " . ($isFamilyPackage 
            ? "Your family package order including <strong>" . htmlspecialchars($membersSummaryString) . "</strong> (" . $totalMembersCount . " users) has been calculated with high-precision Nirayana Vedic planetary ephemeris and approved. All astrological report PDFs along with one consolidated tax invoice are attached directly to this email."
            : "Your astrological order (#" . htmlspecialchars($firstOrder['order_number']) . ") has been approved and calculated with high-precision Nirayana Vedic ephemeris. Your report and tax invoice are attached below.") . "
      </p>

      <div style='border:1px solid #e8d9b8; border-left:4px solid #7a1f1f; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#fbf6ea;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Order & Payment Summary</div>
        <table style='width:100%; border-collapse:collapse; font-size:13px; color:#3d3222;'>
          " . ($groupId ? "
          <tr>
            <td style='padding:3px 0; color:#8a7a55;'>Group ID</td>
            <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($groupId) . "</td>
          </tr>" : "") . "
          <tr>
            <td style='padding:3px 0; color:#8a7a55;'>Family Members</td>
            <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($membersSummaryString) . "</td>
          </tr>
          <tr>
            <td style='padding:3px 0; color:#8a7a55;'>Total Reports</td>
            <td style='padding:3px 0; text-align:right; font-weight:700;'>" . $totalMembersCount . "</td>
          </tr>
          <tr>
            <td style='padding:3px 0; color:#8a7a55;'>Date Approved</td>
            <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($orderDateDisplay) . "</td>
          </tr>
          <tr>
            <td style='padding:3px 0; color:#8a7a55;'>Total Paid</td>
            <td style='padding:3px 0; text-align:right; font-weight:700; color:#166534;'>" . $subtotalDisplay . "</td>
          </tr>
        </table>
      </div>

      <div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#ffffff;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Attached Documents (" . count($attachments) . " Files)</div>
        <div style='font-size:13px; color:#3d3222; line-height:1.8;'>
          " . $memberRowsHtml . "
          <div>&#10003;&nbsp; <strong>" . htmlspecialchars($invoiceFileName) . "</strong> &mdash; Consolidated Official Tax Invoice</div>
        </div>
      </div>

      <div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'>
        <strong>Delivery Note:</strong> If this email appears in your <em>Spam or Junk folder</em>, please mark it as <strong>'Not Spam'</strong> and add <strong>admin@astrosivam.com</strong> to your safe senders.
      </div>

      <p style='color:#6b5c3e; font-size:12px; line-height:1.6; margin:0;'>Please download and preserve these official PDF attachments for your personal records.</p>
    </div>

    <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:16px 24px; text-align:center;'>
      <div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings & Warm Regards, ASTRO SIVAM Team</div>
      <div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div>
    </div>

  </div>
</div>";

$mailResult = AstroMailer::sendEmailWithAttachments(
    $primaryApplicantEmail,
    $primaryApplicantName,
    $emailSubject,
    $htmlBody,
    $attachments,
    $emailSettings,
    astro_inline_logo_attachment()
);

unset($attachments, $invoicePdf, $htmlBody);
if (class_exists('AstroMpdfReports') && method_exists('AstroMpdfReports', 'cleanupTempFiles')) {
    AstroMpdfReports::cleanupTempFiles(60);
}
if (function_exists('gc_collect_cycles')) {
    gc_collect_cycles();
}

$emailStatus = $mailResult['success'] ? 'SENT' : 'FAILED';
$emailMsg = $mailResult['message'] ?? '';
$finalStatus = $mailResult['success'] ? 'COMPLETED' : 'PROCESSING';

// =========================================================================
// PHASE 4: ATOMIC DATABASE TRANSACTION (Update All Sub-Orders)
// =========================================================================
try {
    $pdo->beginTransaction();

    $orderIds = array_column($matchedOrders, 'id');
    $inPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));
    $updateAllSql = "UPDATE orders SET status = ?, payment_confirmed = 1, email_status = ?, email_sent_at = NOW(), email_last_status_message = ?, has_pdf = 1, has_invoice = 1, updated_at = NOW() WHERE id IN ($inPlaceholders)";
    
    $params = array_merge([$finalStatus, $emailStatus, $emailMsg], $orderIds);
    $updAllStmt = $pdo->prepare($updateAllSql);
    $updAllStmt->execute($params);

    $pdo->commit();
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Database transaction failed during batch order approval: " . $e->getMessage());
    sendResponse(['success' => false, 'message' => 'Database error while finalizing batch orders: ' . $e->getMessage()], 500);
}

// Best-effort WhatsApp/Viber "order complete" alert (never blocks approval).
if ($finalStatus === 'COMPLETED') {
    foreach ($matchedOrders as &$alertOrder) {
        $alertOrder['status'] = $finalStatus;
    }
    unset($alertOrder);
    AstroChatAlerts::sendOrderAlerts($pdo, 'order_completed', $matchedOrders);
}

sendResponse([
    'success' => $mailResult['success'],
    'message' => $mailResult['success']
        ? "Successfully approved {$totalMembersCount} member orders. Exactly 1 email containing {$totalMembersCount} reports + 1 consolidated invoice was dispatched to {$primaryApplicantEmail}."
        : "Orders were calculated and saved, but email dispatch failed ({$emailMsg}). Orders remain in PROCESSING for retry.",
    'groupId' => $groupId,
    'membersCount' => $totalMembersCount,
    'members' => $memberNamesList,
    'emailStatus' => $emailStatus,
    'emailMessage' => $emailMsg,
    'orderStatus' => $finalStatus,
    'renderQuality' => 'PREVIEW_EXACT',
    'invoiceQuality' => 'PREVIEW_EXACT',
    'recipientEmail' => $primaryApplicantEmail
]);
