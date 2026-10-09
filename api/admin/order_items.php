<?php
/**
 * ASTRO SIVAM - Multi-Person Order Items (admin fulfilment)
 * ---------------------------------------------------------
 * WHY THIS FILE EXISTS
 * --------------------
 * A multi-person order is ONE `orders` header row plus `order_persons` and
 * `order_items`. The admin portal shows it as one row that expands into its
 * people and their reports, and the admin must be able to Preview and Send
 * EVERY report separately - while the customer still receives ONE email per
 * order (one tax invoice + one PDF per item).
 *
 * This file owns:
 *
 *   astro_attach_order_items()          - GET /api/admin/orders gains
 *                                         persons[] + items[] per order
 *   astro_get_or_calculate_result()     - Rebuilds from this item's saved
 *                                         service inputs on every Preview AND
 *                                         Send, then refreshes its cached result
 *                                         so stale admin calculations are never
 *                                         treated as authoritative.
 *   astro_send_order_items_email()      - ONE email per order: the selected
 *                                         item reports + ONE invoice, split
 *                                         into budget-sized parts only when the
 *                                         mail provider would reject the size
 *
 * Nothing here touches auth, OTP, signed tokens or the mPDF report builders -
 * it only calls the existing, unchanged report/invoice generators.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../branding.php';
require_once __DIR__ . '/../chat_alerts.php';
require_once __DIR__ . '/family_docs.php';
// Provides astro_ensure_multi_person_tables() and the service catalogue.
require_once __DIR__ . '/../services/multi_person_order.php';

/** Admin-visible service names (same wording as the existing emails). */
function astro_order_item_service_names(): array
{
    return [
        'BIRTH_JATHAGAM' => 'Vedic Birth Jathagam (Horoscope)',
        'MARRIAGE_COMPATIBILITY' => 'Vedic Marriage Compatibility (10 Poruthams)',
        'BABY_NAMING' => 'Vedic Namakaran (Baby Naming)',
        'MUHURTHAM' => 'Subha Muhurtham (6-Month Auspicious Dates)',
        'MULTI_PERSON' => 'Multi-Person Order',
    ];
}

/** Decode a JSON column that may already be an array. */
function astro_order_item_decode($value)
{
    if (is_array($value)) return $value;
    if (!is_string($value) || trim($value) === '') return null;
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : null;
}

/** One order_items row in the shape the admin portal consumes. */
function astro_order_item_to_client(array $row, array $personsById = []): array
{
    $person = $personsById[(int)($row['person_id'] ?? 0)] ?? [];
    return [
        'id' => (int)($row['id'] ?? 0),
        'orderId' => (string)($row['order_id'] ?? ''),
        'personId' => (int)($row['person_id'] ?? 0),
        'personSeq' => (int)($person['seq'] ?? 0),
        'personName' => (string)($person['full_name'] ?? ''),
        'serviceCode' => (string)($row['service_code'] ?? ''),
        'unitPrice' => (float)($row['unit_price'] ?? 0),
        'reportStatus' => (string)($row['report_status'] ?? 'PENDING'),
        'language' => astro_normalize_report_language($row['language'] ?? 'en'),
        'inputPayload' => astro_order_item_decode($row['input_payload'] ?? null) ?: [],
        'calculatedResult' => astro_order_item_decode($row['calculated_result'] ?? null),
        'sentAt' => $row['sent_at'] ?? null,
    ];
}

/** One order_persons row in the shape the admin portal consumes. */
function astro_order_person_to_client(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'seq' => (int)($row['seq'] ?? 0),
        'fullName' => (string)($row['full_name'] ?? ''),
        'gender' => (string)($row['gender'] ?? 'M'),
        'dob' => (string)($row['dob'] ?? ''),
        'tob' => (string)($row['tob'] ?? ''),
        'place' => (string)($row['place'] ?? ''),
        'country' => (string)($row['country'] ?? ''),
        'lat' => $row['lat'] !== null ? (float)$row['lat'] : null,
        'lon' => $row['lon'] !== null ? (float)$row['lon'] : null,
        'tz' => $row['tz'] !== null ? (float)$row['tz'] : null,
    ];
}

/**
 * Attaches `persons` and `items` to a list of admin order arrays.
 * A missing table (migration not run yet) degrades to empty arrays instead of
 * breaking the whole admin order list.
 */
function astro_attach_order_items($pdo, array $orders): array
{
    if (empty($orders)) return $orders;

    $orderIds = [];
    foreach ($orders as $order) {
        if (!empty($order['id'])) $orderIds[] = (string)$order['id'];
    }
    if (empty($orderIds)) return $orders;

    $peopleByOrder = [];
    $itemsByOrder = [];
    $personsById = [];

    try {
        astro_ensure_multi_person_tables($pdo);
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

        $personStmt = $pdo->prepare("SELECT * FROM order_persons WHERE order_id IN ($placeholders) ORDER BY order_id ASC, seq ASC");
        $personStmt->execute($orderIds);
        foreach ($personStmt->fetchAll() as $row) {
            $client = astro_order_person_to_client($row);
            $personsById[(int)$row['id']] = $row;
            $peopleByOrder[(string)$row['order_id']][] = $client;
        }

        $itemStmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($placeholders) ORDER BY order_id ASC, id ASC");
        $itemStmt->execute($orderIds);
        foreach ($itemStmt->fetchAll() as $row) {
            $itemsByOrder[(string)$row['order_id']][] = astro_order_item_to_client($row, $personsById);
        }
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: could not attach order items: ' . $e->getMessage());
    }

    foreach ($orders as $index => $order) {
        $id = (string)($order['id'] ?? '');
        $orders[$index]['persons'] = $peopleByOrder[$id] ?? [];
        $orders[$index]['items'] = $itemsByOrder[$id] ?? [];
    }
    return $orders;
}

/** Raw order_items rows for one order (with decoded payload/result). */
function astro_order_items_all($pdo, string $orderId): array
{
    try {
        astro_ensure_multi_person_tables($pdo);
        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC");
        $stmt->execute([$orderId]);
        return $stmt->fetchAll();
    } catch (Throwable $e) {
        error_log('ASTRO SIVAM: could not load order items: ' . $e->getMessage());
        return [];
    }
}

/** One order_items row by id, or null. */
function astro_order_item_find($pdo, string $orderId, $itemId)
{
    try {
        astro_ensure_multi_person_tables($pdo);
        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ? AND id = ? LIMIT 1");
        $stmt->execute([$orderId, (int)$itemId]);
        $row = $stmt->fetch();
        return $row ?: null;
    } catch (Throwable $e) {
        return null;
    }
}

/** True when this order is fulfilled item-by-item (multi-person orders). */
function astro_order_uses_items(array $order, array $items): bool
{
    $serviceType = strtoupper((string)($order['service_type'] ?? ''));
    return $serviceType === 'MULTI_PERSON' || count($items) > 1;
}

/**
 * A synthetic single-chart order array for one item, so the UNCHANGED report
 * and invoice builders render exactly the item the admin previewed.
 */
function astro_order_item_synthetic_order(array $order, array $item): array
{
    $synthetic = $order;
    $synthetic['service_type'] = strtoupper((string)($item['service_code'] ?? 'BIRTH_JATHAGAM'));
    $synthetic['language'] = astro_normalize_report_language($item['language'] ?? ($order['language'] ?? 'en'));
    $synthetic['input_payload'] = $item['input_payload'] ?? null;
    $synthetic['calculated_result'] = $item['calculated_result'] ?? null;
    $synthetic['amount'] = (float)($item['unit_price'] ?? 0);
    $synthetic['order_number'] = $order['order_number'] ?? '';
    return $synthetic;
}

/**
 * Preview and Send always rebuild from the item's saved service inputs. The
 * cached calculated_result is only a cache and may no longer match the inputs.
 *
 * @return array{result:?array,item:array,recalculated:bool}
 */
function astro_get_or_calculate_result($pdo, array $order, array $item): array
{
    $syntheticOrder = astro_order_item_synthetic_order($order, $item);
    $result = AstroEngine::rebuildReportResultFromSavedInputs($syntheticOrder);

    // Persist the refreshed calculation; callers fail closed if this write
    // fails, so the next admin view cannot quietly fall back to stale cache data.
    $upd = $pdo->prepare("UPDATE order_items
        SET calculated_result = ?,
            report_status = CASE WHEN report_status = 'SENT' THEN 'SENT' ELSE 'CALCULATED' END,
            updated_at = NOW()
        WHERE id = ?");
    $upd->execute([json_encode($result, JSON_UNESCAPED_UNICODE), (int)$item['id']]);
    $item['calculated_result'] = json_encode($result, JSON_UNESCAPED_UNICODE);
    $item['report_status'] = ($item['report_status'] ?? '') === 'SENT' ? 'SENT' : 'CALCULATED';

    return ['result' => is_array($result) ? $result : null, 'item' => $item, 'recalculated' => true];
}

/**
 * Browser-rendered preview-exact PDFs supplied with a send request, keyed by
 * item id. `reportPdfBase64` without an item id is accepted only for a
 * single-item send, exactly like the single-order flow.
 */
function astro_order_items_index_client_pdfs(array $body): array
{
    $map = [];
    foreach ((array)($body['reportPdfs'] ?? []) as $doc) {
        if (!is_array($doc)) continue;
        $bin = astroFamilyDocsDecodePdf((string)($doc['pdfBase64'] ?? ($doc['pdf_base64'] ?? '')));
        if ($bin === null) continue;
        $key = (string)($doc['itemId'] ?? ($doc['item_id'] ?? ''));
        if ($key !== '') $map[$key] = $bin;
    }
    if (!empty($body['reportPdfBase64'])) {
        $bin = astroFamilyDocsDecodePdf((string)$body['reportPdfBase64']);
        if ($bin !== null) {
            $key = (string)($body['itemId'] ?? ($body['item_id'] ?? ''));
            $map['@single'] = $bin;
            if ($key !== '') $map[$key] = $bin;
        }
    }
    return $map;
}

/** Human label for one item: "Priya Devi - Vedic Birth Jathagam". */
function astro_order_item_label(array $item): string
{
    $names = astro_order_item_service_names();
    $service = $names[strtoupper((string)($item['service_code'] ?? ''))] ?? (string)($item['service_code'] ?? '');
    $payload = astro_order_item_decode($item['input_payload'] ?? null) ?: [];
    $person = trim((string)($payload['bride']['name'] ?? ($payload['name'] ?? ($payload['devoteeName'] ?? ''))));
    return $person !== '' ? $person . ' - ' . $service : $service;
}

/** The branded delivery email: one order, one invoice, one PDF per item. */
function astro_order_items_email_html(array $order, array $items, array $attachments, int $partIndex = 0, int $partCount = 1): string
{
    $orderNumber = htmlspecialchars((string)($order['order_number'] ?? ''));
    $userName = htmlspecialchars((string)($order['user_name'] ?? 'User'));
    $orderDate = date('d M Y', strtotime((string)($order['created_at'] ?? 'now')));
    $amountDisplay = htmlspecialchars((string)($order['currency'] ?? 'FJD')) . ' $' . number_format((float)($order['amount'] ?? 0), 2);
    $personCount = count($items);

    $docRows = '';
    foreach ($attachments as $doc) {
        $docRows .= "<div>&#10003;&nbsp; <strong>" . htmlspecialchars((string)$doc) . '</strong></div>';
    }
    $partNote = $partCount > 1
        ? "<div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'><strong>Large delivery:</strong> this is part " . ($partIndex + 1) . ' of ' . $partCount . ' - all parts belong to order #' . $orderNumber . '.</div>'
        : '';

    return "
    <div style='background:#f4ede1; padding:24px 12px; font-family: Georgia, \\'Times New Roman\\', serif;'>
    <div style='max-width: 600px; margin: 0 auto; background: #fffdf9; border: 1px solid #e8d9b8; border-radius: 10px; overflow: hidden;'>
      <div style='background: #7a1f1f; padding: 22px 24px; text-align: center;'>
        " . astro_email_logo_tag(56) . "
        <div style='color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;'>ASTRO SIVAM</div>
        <div style='color:#e9c98a; font-size:12px; margin-top:2px; letter-spacing:0.5px;'>AUTHENTIC VEDIC ASTROLOGY & MATCHMAKING SERVICES</div>
      </div>
      <div style='height:4px; background: repeating-linear-gradient(90deg, #c9962c 0 10px, #7a1f1f 10px 20px);'></div>
      <div style='padding: 26px 26px 8px;'>
        <p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>{$userName}</strong>,</p>
        <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
          Your Vedic astrology order has been verified, calculated with the precision Nirayana ephemeris, and approved by the ASTRO SIVAM administration. Every report in this order and your official tax invoice are attached to this email.
        </p>
        <div style='border:1px solid #e8d9b8; border-left:4px solid #7a1f1f; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#fbf6ea;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Order Summary</div>
          <table style='width:100%; border-collapse:collapse; font-size:13px; color:#3d3222;'>
            <tr><td style='padding:3px 0; color:#8a7a55;'>Order Number</td><td style='padding:3px 0; text-align:right; font-weight:700;'>{$orderNumber}</td></tr>
            <tr><td style='padding:3px 0; color:#8a7a55;'>Reports In This Email</td><td style='padding:3px 0; text-align:right; font-weight:700;'>{$personCount}</td></tr>
            <tr><td style='padding:3px 0; color:#8a7a55;'>Date Approved</td><td style='padding:3px 0; text-align:right; font-weight:700;'>{$orderDate}</td></tr>
            <tr><td style='padding:3px 0; color:#8a7a55;'>Amount Paid (whole order)</td><td style='padding:3px 0; text-align:right; font-weight:700; color:#166534;'>{$amountDisplay}</td></tr>
          </table>
        </div>
        <div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#ffffff;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Attached Documents</div>
          <div style='font-size:13px; color:#3d3222; line-height:1.8;'>{$docRows}</div>
        </div>
        {$partNote}
        <div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'>
          <strong>Delivery Notice:</strong> If this email lands in your <em>Spam / Junk folder</em>, please mark it <strong>'Not Spam'</strong> and add <strong>admin@astrosivam.com</strong> to your contacts so you don't miss future updates.
        </div>
        <p style='color:#6b5c3e; font-size:12px; line-height:1.6; margin:0 0 4px;'>The attached PDFs are your official records - please save them securely.</p>
      </div>
      <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:16px 24px; text-align:center;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings &amp; Warm Regards, ASTRO SIVAM Team</div>
        <div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div>
      </div>
    </div>
    </div>";
}

/**
 * Sends ONE customer email for the whole order carrying the given items'
 * reports + ONE invoice (split into budget-sized parts only when the mail
 * provider would reject the size), then updates item/order statuses.
 *
 * @param array $items Raw order_items rows (all items, or just the one item).
 * @param array $body  Admin request body: optional preview-exact PDFs.
 * @return array{success:bool,message:string,emailStatus?:string,orderStatus?:string,items?:array,emailPartCount?:int,renderQuality?:string}
 */
function astro_send_order_items_email($pdo, array $admin, array $order, array $items, string $mode = 'approve', array $body = []): array
{
    $orderId = (string)($order['id'] ?? '');
    $orderNumber = (string)($order['order_number'] ?? '');
    if ($orderId === '' || empty($items)) {
        return ['success' => false, 'message' => 'This order has no reports to send.'];
    }

    if (empty($order['user_email'])) {
        return ['success' => false, 'message' => 'The order has no customer email address.'];
    }

    $clientPdfs = astro_order_items_index_client_pdfs($body);
    $singleItemSend = count($items) === 1;

    $attachments = [];
    $attachmentNames = [];
    $resolvedItems = [];
    $qualityCounts = ['PREVIEW_EXACT' => 0, 'SERVER_RENDER' => 0];

    foreach ($items as $item) {
        $itemId = (int)($item['id'] ?? 0);
        $serviceCode = strtoupper((string)($item['service_code'] ?? 'BIRTH_JATHAGAM'));

        try {
            $calculated = astro_get_or_calculate_result($pdo, $order, $item);
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Report calculation failed for "' . astro_order_item_label($item) . '": ' . $e->getMessage() . ' Nothing was emailed.'
            ];
        }
        $item = $calculated['item'];
        $result = $calculated['result'];
        $synthetic = astro_order_item_synthetic_order($order, $item);

        $clientPdf = $clientPdfs[(string)$itemId] ?? ($singleItemSend ? ($clientPdfs['@single'] ?? null) : null);
        $quality = 'PREVIEW_EXACT';
        if ($clientPdf !== null) {
            $pdf = $clientPdf;
        } else {
            $quality = 'SERVER_RENDER';
            try {
                $pdf = AstroEngine::generateReportPdf($synthetic, $result);
            } catch (Throwable $e) {
                return [
                    'success' => false,
                    'message' => 'Could not render the report PDF for "' . astro_order_item_label($item) . '": ' . $e->getMessage() . ' Nothing was emailed.'
                ];
            }
        }
        $qualityCounts[$quality]++;
        $fileName = 'ASTRO_SIVAM_' . preg_replace('/[^A-Za-z0-9]+/', '_', $serviceCode) . '_' . $orderNumber . ($singleItemSend ? '' : '_' . $itemId) . '.pdf';
        $attachments[] = ['name' => $fileName, 'content' => $pdf];
        $attachmentNames[] = $fileName;
        $resolvedItems[] = $item;
    }

    // ONE tax invoice for the WHOLE order (the customer paid one total).
    $invoicePdf = null;
    if (!empty($body['invoicePdfBase64'])) {
        $invoicePdf = astroFamilyDocsDecodePdf((string)$body['invoicePdfBase64']);
    }
    if ($invoicePdf === null) {
        try {
            $pseudoOrders = [];
            foreach ($resolvedItems as $item) {
                $pseudoOrders[] = astro_order_item_synthetic_order($order, $item);
            }
            $invoicePdf = count($pseudoOrders) > 1
                ? AstroEngine::generateFamilyInvoicePdf($pseudoOrders, $orderId)
                : AstroEngine::generateInvoicePdf($pseudoOrders[0]);
        } catch (Throwable $e) {
            return [
                'success' => false,
                'message' => 'Could not render the order tax invoice: ' . $e->getMessage() . ' Nothing was emailed.'
            ];
        }
    }
    $invoiceName = 'ASTRO_SIVAM_Invoice_' . $orderNumber . '.pdf';
    $attachments[] = ['name' => $invoiceName, 'content' => $invoicePdf];
    $attachmentNames[] = $invoiceName;

    // SMTP settings (unchanged source of truth).
    $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
    $sRow = $sStmt ? $sStmt->fetch() : null;
    $emailSettings = ($sRow && !empty($sRow['email_settings'])) ? json_decode($sRow['email_settings'], true) : [];

    // Budget-sized parts: usually ONE email; several labelled parts only when a
    // single message would be rejected by the mail provider.
    $plan = astro_plan_attachment_parts($attachments);
    $parts = $plan['parts'];
    $emailStatus = 'SENT';
    $emailMessage = '';
    $sentParts = 0;

    foreach ($parts as $index => $partAttachments) {
        $partNames = [];
        foreach ($partAttachments as $attachment) {
            $partNames[] = (string)$attachment['name'];
        }
        $subject = $mode === 'resend'
            ? "ASTRO SIVAM: Your Official PDF Report(s) & Tax Invoice (#{$orderNumber}) - Resent"
            : "ASTRO SIVAM: Your Official PDF Report(s) & Tax Invoice (#{$orderNumber})";
        if (count($parts) > 1) {
            $subject .= ' (Part ' . ($index + 1) . ' of ' . count($parts) . ')';
        }

        $html = astro_order_items_email_html($order, $resolvedItems, $partNames, $index, count($parts));
        $mailResult = AstroMailer::sendEmailWithAttachments(
            (string)$order['user_email'],
            (string)($order['user_name'] ?? 'User'),
            $subject,
            $html,
            $partAttachments,
            $emailSettings,
            astro_inline_logo_attachment()
        );

        if (empty($mailResult['success'])) {
            $emailStatus = 'FAILED';
            $emailMessage = (string)($mailResult['message'] ?? 'Unknown mail transport error.');
            break;
        }
        $sentParts++;
    }

    $itemIds = [];
    foreach ($resolvedItems as $item) {
        $itemIds[] = (int)$item['id'];
    }
    $placeholders = implode(',', array_fill(0, count($itemIds), '?'));

    if ($emailStatus === 'SENT') {
        $updItems = $pdo->prepare("UPDATE order_items SET report_status = 'SENT', sent_at = NOW(), updated_at = NOW() WHERE id IN ($placeholders)");
        $updItems->execute($itemIds);
    } else {
        $updItems = $pdo->prepare("UPDATE order_items SET report_status = 'FAILED', updated_at = NOW() WHERE id IN ($placeholders)");
        $updItems->execute($itemIds);
    }

    // The order is COMPLETED only when EVERY item has been delivered.
    $countStmt = $pdo->prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN report_status = 'SENT' THEN 1 ELSE 0 END) AS sent FROM order_items WHERE order_id = ?");
    $countStmt->execute([$orderId]);
    $counts = $countStmt->fetch() ?: ['total' => 0, 'sent' => 0];
    $allSent = (int)$counts['total'] > 0 && (int)$counts['sent'] >= (int)$counts['total'];
    $finalStatus = ($emailStatus === 'SENT' && $allSent) ? 'COMPLETED' : ((string)($order['status'] ?? 'PENDING') === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING');

    $updOrder = $pdo->prepare("UPDATE orders
        SET status = ?,
            payment_confirmed = 1,
            email_status = ?,
            email_sent_at = CASE WHEN ? = 'SENT' THEN NOW() ELSE email_sent_at END,
            email_last_status_message = ?,
            has_pdf = 1,
            has_invoice = 1,
            updated_at = NOW()
        WHERE id = ?");
    $updOrder->execute([$finalStatus, $emailStatus, $emailStatus, $emailMessage !== '' ? $emailMessage : ('Delivered ' . count($resolvedItems) . ' report(s) + 1 invoice in ' . $sentParts . ' email part(s).'), $orderId]);

    logAudit(
        $pdo,
        (string)($admin['id'] ?? ''),
        (string)($admin['name'] ?? 'Admin'),
        'admin',
        $mode === 'resend' ? 'ORDER_ITEMS_RESENT' : 'ORDER_ITEMS_APPROVED',
        'Order #' . $orderNumber . ': delivered ' . count($resolvedItems) . ' report(s) (+1 invoice) in ' . $sentParts . ' email part(s); quality PREVIEW_EXACT=' . $qualityCounts['PREVIEW_EXACT'] . ', SERVER_RENDER=' . $qualityCounts['SERVER_RENDER']
    );

    if ($finalStatus === 'COMPLETED') {
        try {
            $alertOrder = $order;
            $alertOrder['status'] = 'COMPLETED';
            AstroChatAlerts::sendOrderAlerts($pdo, 'order_completed', [$alertOrder]);
        } catch (Throwable $e) {
            // Alerts never block delivery.
        }
    }

    $renderQuality = $qualityCounts['SERVER_RENDER'] === 0 ? 'PREVIEW_EXACT' : ($qualityCounts['PREVIEW_EXACT'] === 0 ? 'SERVER_RENDER' : 'MIXED');
    $delivered = count($resolvedItems);

    return [
        'success' => $emailStatus === 'SENT',
        'message' => $emailStatus === 'SENT'
            ? "Order #{$orderNumber}: {$delivered} report(s) + 1 tax invoice emailed to {$order['user_email']} in {$sentParts} email part(s)."
            : "Order #{$orderNumber}: the email to {$order['user_email']} FAILED ({$emailMessage}). The reports were not marked as sent - fix the mail settings and send again.",
        'emailStatus' => $emailStatus,
        'emailMessage' => $emailMessage,
        'orderStatus' => $finalStatus,
        'itemStatuses' => array_map(function ($item) use ($emailStatus) {
            return ['id' => (int)$item['id'], 'reportStatus' => $emailStatus === 'SENT' ? 'SENT' : 'FAILED'];
        }, $resolvedItems),
        'emailPartCount' => $sentParts,
        'renderQuality' => $renderQuality,
        'attachmentBytes' => (int)$plan['total_bytes']
    ];
}

/**
 * One entry point for the three admin item routes.
 * Emits the JSON response (jsonResponse() exits).
 */
function astro_admin_order_item_action($pdo, array $admin, string $orderId, $itemId, string $action, array $body = []): void
{
    astro_ensure_multi_person_tables($pdo);

    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) {
        jsonResponse(['success' => false, 'message' => 'Order not found'], 404);
    }

    $allItems = astro_order_items_all($pdo, $orderId);
    if (empty($allItems)) {
        jsonResponse(['success' => false, 'message' => 'This order has no itemised reports. Use the standard approve action.'], 409);
    }

    // 1. Rebuild from saved item inputs before exposing a result to Preview or Send.
    if ($action === 'result') {
        if ($itemId === null) {
            jsonResponse(['success' => false, 'message' => 'A report id is required.'], 400);
        }
        $item = astro_order_item_find($pdo, $orderId, $itemId);
        if (!$item) {
            jsonResponse(['success' => false, 'message' => 'Report not found in this order'], 404);
        }
        try {
            $calculated = astro_get_or_calculate_result($pdo, $order, $item);
        } catch (Throwable $e) {
            jsonResponse(['success' => false, 'message' => 'This report could not be calculated: ' . $e->getMessage()], 422);
        }
        $clientItem = astro_order_item_to_client($calculated['item']);
        jsonResponse([
            'success' => true,
            'item' => $clientItem,
            'result' => $calculated['result'],
            'recalculated' => $calculated['recalculated'],
            'message' => 'Report rebuilt from saved item inputs and cached for subsequent admin views.'
        ]);
    }

    // 2. Send to the customer email (one email per order).
    $targets = $allItems;
    if ($itemId !== null) {
        $single = astro_order_item_find($pdo, $orderId, $itemId);
        if (!$single) {
            jsonResponse(['success' => false, 'message' => 'Report not found in this order'], 404);
        }
        $targets = [$single];
    }

    if ((float)($order['amount'] ?? 0) > 0) {
        $paymentStatus = strtoupper((string)($order['payment_status'] ?? ''));
        if (!in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) && (int)($order['payment_confirmed'] ?? 0) !== 1) {
            jsonResponse(['success' => false, 'message' => 'Payment verification is required before sending this paid order.'], 409);
        }
    }

    $mode = ($action === 'resend') ? 'resend' : 'approve';
    $result = astro_send_order_items_email($pdo, $admin, $order, $targets, $mode, $body);
    jsonResponse($result, !empty($result['success']) ? 200 : 503);
}
