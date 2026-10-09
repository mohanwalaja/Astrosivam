<?php
/**
 * ASTRO SIVAM - Admin Order Management API
 * 
 * Supports:
 * - Aggregated Family Order Grouping (GROUP BY COALESCE(NULLIF(group_id, ''), id))
 * - Single order & Multi-member package approval in a single request
 * - Full sub-order member expansion
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../branding.php';
require_once __DIR__ . '/../chat_alerts.php';
require_once __DIR__ . '/../rate_limit.php';
require_once __DIR__ . '/family_approval.php';

$pdo = getDbConnection();
$admin = requireAdmin($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// =========================================================================
// 1. GET /api/admin/orders.php (Grouped Family Orders + Sub-orders)
// =========================================================================
if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC");
    $rawRows = $stmt ? $stmt->fetchAll() : [];

    // Group in PHP (100% resilient across all MySQL versions and ONLY_FULL_GROUP_BY configs)
    $groups = [];
    foreach ($rawRows as $r) {
        $gKey = !empty($r['group_id']) ? $r['group_id'] : $r['id'];
        if (!isset($groups[$gKey])) {
            $groups[$gKey] = [
                'effective_group_key' => $gKey,
                'group_id' => $r['group_id'] ?? null,
                'members' => [],
                'primary' => $r
            ];
        }
        $groups[$gKey]['members'][] = $r;
    }

    $orders = [];
    foreach ($groups as $gKey => $grp) {
        $primary = $grp['primary'];
        $members = $grp['members'];
        $totalMembers = count($members);
        $isFamilyOrder = !empty($primary['group_id']) || $totalMembers > 1;

        $memberNames = array_map(function($m) { return $m['user_name']; }, $members);
        $orderNumbers = array_map(function($m) { return $m['order_number']; }, $members);
        $totalAmount = array_sum(array_map(function($m) { return floatval($m['amount']); }, $members));

        $statuses = array_map(function($m) { return $m['status']; }, $members);
        if (in_array('PENDING', $statuses)) {
            $aggregatedStatus = 'PENDING';
        } elseif (in_array('PROCESSING', $statuses)) {
            $aggregatedStatus = 'PROCESSING';
        } elseif (count(array_filter($statuses, function($s) { return $s === 'COMPLETED'; })) === $totalMembers) {
            $aggregatedStatus = 'COMPLETED';
        } else {
            $aggregatedStatus = $primary['status'];
        }

        $formattedMembers = array_map(function($m) {
            return [
                'id' => $m['id'],
                'orderNumber' => $m['order_number'],
                'groupId' => $m['group_id'] ?? null,
                'userId' => $m['user_id'],
                'userName' => $m['user_name'],
                'userEmail' => $m['user_email'],
                'userMobile' => $m['user_mobile'],
                'country' => $m['country'],
                'serviceType' => $m['service_type'],
                'language' => astro_normalize_report_language($m['language'] ?? 'en'),
                'amount' => floatval($m['amount']),
                'currency' => $m['currency'],
                'serviceMode' => $m['service_mode'],
                'status' => $m['status'],
                'paymentMethod' => $m['payment_method'],
                'paymentReference' => $m['payment_reference'],
                'paymentIntentId' => $m['payment_intent_id'] ?? null,
                'paymentStatus' => $m['payment_status'] ?? ((bool)$m['payment_confirmed'] ? 'VERIFIED_MANUAL' : 'PENDING_ADMIN'),
                'paymentConfirmed' => (bool)$m['payment_confirmed'],
                'emailStatus' => $m['email_status'],
                'emailSentAt' => $m['email_sent_at'],
                'emailLastStatusMessage' => $m['email_last_status_message'],
                'inputPayload' => json_decode($m['input_payload'] ?? '', true) ?: [],
                'calculatedResult' => json_decode($m['calculated_result'] ?? '', true) ?: null,
                'hasPdf' => (bool)($m['has_pdf'] ?? 0),
                'hasInvoice' => (bool)($m['has_invoice'] ?? 0),
                'adminNotes' => $m['admin_notes'] ?? null,
                'refundStatus' => $m['refund_status'] ?? 'NONE',
                'refundReason' => $m['refund_reason'] ?? null,
                'createdAt' => $m['created_at'],
                'updatedAt' => $m['updated_at'] ?? $m['created_at']
            ];
        }, $members);

        $orders[] = [
            'id' => $primary['id'],
            'groupId' => $primary['group_id'] ?: null,
            'orderNumber' => $primary['order_number'],
            'groupOrderNumbers' => implode(', ', $orderNumbers),
            'isGroupOrder' => $isFamilyOrder,
            'isFamilyOrder' => $isFamilyOrder,
            'totalMembers' => $totalMembers,
            'memberNames' => implode(', ', $memberNames),
            'userId' => $primary['user_id'],
            'userName' => $primary['user_name'],
            'userEmail' => $primary['user_email'],
            'userMobile' => $primary['user_mobile'],
            'country' => $primary['country'],
            'serviceType' => $primary['service_type'],
            'language' => astro_normalize_report_language($primary['language'] ?? 'en'),
            'amount' => $totalAmount,
            'totalAmount' => $totalAmount,
            'currency' => $primary['currency'],
            'serviceMode' => $primary['service_mode'],
            'status' => $aggregatedStatus,
            'paymentMethod' => $primary['payment_method'],
            'paymentReference' => $primary['payment_reference'],
            'paymentIntentId' => $primary['payment_intent_id'] ?? null,
            'paymentStatus' => $primary['payment_status'] ?? ((bool)$primary['payment_confirmed'] ? 'VERIFIED_MANUAL' : 'PENDING_ADMIN'),
            'paymentConfirmed' => (bool)$primary['payment_confirmed'],
            'emailStatus' => $primary['email_status'],
            'emailSentAt' => $primary['email_sent_at'],
            'emailLastStatusMessage' => $primary['email_last_status_message'],
            'inputPayload' => json_decode($primary['input_payload'] ?? '', true) ?: [],
            'calculatedResult' => json_decode($primary['calculated_result'] ?? '', true) ?: null,
            'hasPdf' => (bool)($primary['has_pdf'] ?? 0),
            'hasInvoice' => (bool)($primary['has_invoice'] ?? 0),
            'adminNotes' => $primary['admin_notes'] ?? null,
            'refundStatus' => $primary['refund_status'] ?? 'NONE',
            'refundReason' => $primary['refund_reason'] ?? null,
            'createdAt' => $primary['created_at'],
            'updatedAt' => $primary['updated_at'] ?? $primary['created_at'],
            'members' => $formattedMembers
        ];
    }

    $statusFilter = $_GET['status'] ?? null;
    $searchFilter = $_GET['search'] ?? null;
    if ($statusFilter) {
        $orders = array_values(array_filter($orders, function($o) use ($statusFilter) {
            return strtoupper($o['status']) === strtoupper($statusFilter);
        }));
    }
    if ($searchFilter) {
        $sf = strtolower($searchFilter);
        $orders = array_values(array_filter($orders, function($o) use ($sf) {
            return strpos(strtolower($o['orderNumber']), $sf) !== false ||
                   strpos(strtolower($o['userName']), $sf) !== false ||
                   strpos(strtolower($o['userEmail']), $sf) !== false ||
                   strpos(strtolower($o['memberNames']), $sf) !== false;
        }));
    }

    sendJson([
        'success' => true,
        'count' => count($orders),
        'orders' => $orders
    ]);
}

// =========================================================================
// 2. POST /api/admin/orders.php?action=approve (Approve by ID or Group ID)
// =========================================================================
if ($method === 'POST' && $action === 'approve') {
    astro_rate_limit_enforce(
        $pdo,
        'admin-action-delivery',
        (string)($admin['id'] ?? ''),
        30,
        600,
        'Too many approval emails were sent in a short time. Please wait a few minutes before continuing.'
    );
    $targetId = $_GET['id'] ?? ($_GET['group_id'] ?? '');
    if (empty($targetId)) {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $targetId = $body['id'] ?? ($body['groupId'] ?? ($body['group_id'] ?? ''));
    }

    if (empty($targetId)) {
        sendJson(['success' => false, 'message' => 'Missing order ID or group ID to approve'], 400);
    }

    // Check if target is a group_id or an individual order
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ? OR id = ? ORDER BY created_at ASC");
    $stmt->execute([$targetId, $targetId]);
    $matchedOrders = $stmt->fetchAll();

    if (empty($matchedOrders)) {
        sendJson(['success' => false, 'message' => 'Order(s) not found'], 404);
    }

    $unpaid = array_values(array_filter($matchedOrders, function ($row) {
        if ((float)($row['amount'] ?? 0) <= 0) return false;
        $paymentStatus = strtoupper((string)($row['payment_status'] ?? ''));
        return !(in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) || (int)($row['payment_confirmed'] ?? 0) === 1);
    }));
    if (!empty($unpaid)) {
        sendJson(['success' => false, 'message' => 'Payment verification is required before approving this paid order.'], 409);
    }

    $firstOrder = $matchedOrders[0];
    $groupId = !empty($firstOrder['group_id']) ? $firstOrder['group_id'] : null;

    // If it is part of a multi-order group, fetch all orders in that group
    if ($groupId) {
        // ONE payment => one delivery with every report + ONE consolidated
        // invoice (split into budget-sized emails when the bundle is too big).
        sendJson(astroApproveFamilyGroup($pdo, $admin, $groupId, 'approve', getJsonBody()));
    }

    // Process approval & astrological calculations for each member
    $calculatedResults = [];
    $updateStmt = $pdo->prepare("UPDATE orders SET calculated_result = ?, status = 'COMPLETED', payment_confirmed = 1, email_status = 'SENT', email_sent_at = NOW(), has_pdf = 1, has_invoice = 1, updated_at = NOW() WHERE id = ?");

    foreach ($matchedOrders as $o) {
        $payload = json_decode($o['input_payload'], true) ?: [];
        $res = !empty($o['calculated_result']) ? (is_array($o['calculated_result']) ? $o['calculated_result'] : json_decode($o['calculated_result'], true)) : null;

        if (!$res || ($o['service_type'] === 'BABY_NAMING' && !AstroEngine::isCurrentBabyNamingResult($res)) || ($o['service_type'] === 'MUHURTHAM' && !AstroEngine::isCurrentMuhurthamResult($res))) {
            if ($o['service_type'] === 'MARRIAGE_COMPATIBILITY') {
                $res = AstroEngine::calculateMatchmaking($payload);
            } elseif ($o['service_type'] === 'BABY_NAMING') {
                $res = AstroEngine::calculateBabyNaming($payload);
            } elseif ($o['service_type'] === 'MUHURTHAM') {
                $res = AstroEngine::calculateMuhurtham($payload);
            } else {
                $res = AstroEngine::calculateHoroscope($payload);
            }
        }
        $updateStmt->execute([json_encode($res, JSON_UNESCAPED_UNICODE), $o['id']]);
        $calculatedResults[$o['id']] = $res;
    }

    // Best-effort WhatsApp/Viber "order complete" alert (never blocks approval).
    foreach ($matchedOrders as &$alertOrder) {
        $alertOrder['status'] = 'COMPLETED';
    }
    unset($alertOrder);
    AstroChatAlerts::sendOrderAlerts($pdo, 'order_completed', $matchedOrders);

    sendJson([
        'success' => true,
        'message' => count($matchedOrders) > 1 
            ? "Family group ({$groupId}) approved successfully with " . count($matchedOrders) . " sub-orders."
            : "Order {$firstOrder['order_number']} approved successfully.",
        'groupId' => $groupId,
        'approvedOrdersCount' => count($matchedOrders),
        'orderIds' => array_column($matchedOrders, 'id')
    ]);
}

sendJson(['success' => false, 'message' => 'Method or action not supported'], 405);
