<?php
/**
 * ASTRO SIVAM — PHP payment-webhook & attachment-budget regressions.
 *
 * Runs with plain `php tests/payment-webhook.test.php` (no database, no network)
 * and is executed in CI so the PHP delivery path — which cannot be exercised
 * from the Node test runner — is verified at runtime on every push.
 */

// config.php (loaded through payments.php) refuses to boot without a signing
// key; supply a fixed test-only key so the suite never writes one to disk.
putenv('APP_SECRET_KEY=test-only-app-secret-key-0123456789abcdef');

require_once __DIR__ . '/../api/mailer.php';
require_once __DIR__ . '/../api/payments.php';

function check($condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "[PASS] " . $message . "\n";
}

// ---------------------------------------------------------------------------
// 1. MIME size estimation + attachment budgeting
// ---------------------------------------------------------------------------
check(astro_mime_encoded_size(0) >= 512 && astro_mime_encoded_size(0) < 1024, 'Empty attachments still account for MIME headers');
check(astro_mime_encoded_size(3 * 1048576) > 4 * 1048576, 'Base64 expansion (4/3) is accounted for');

$mb = 1048576;
$threeMbBase64Bytes = (int)(ceil((3 * $mb + 2) / 3) * 4);
check(
    astro_mime_encoded_size(3 * $mb) > $threeMbBase64Bytes + 512,
    'MIME sizing accounts for the CRLF line wrapping added to base64 attachments'
);

// The default budget should keep the supported maximum family checkout
// (six reports + one invoice) in one email for typical preview-PDF sizes.
// Clear inherited env values so this test checks the application default.
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_MB');
putenv('FAMILY_EMAIL_MAX_ATTACHMENT_BYTES');
$defaultAttachmentBudget = astro_max_attachment_encoded_bytes();
check($defaultAttachmentBudget === 25 * $mb, 'The default family-email attachment budget is 25 MiB');

$familyNonPdfReserve = 128 * 1024;
foreach (astro_inline_logo_attachment() as $logoPart) {
    $familyNonPdfReserve += astro_mime_encoded_size(strlen((string)($logoPart['content'] ?? '')));
}
$familyPdfBudget = max(512 * 1024, $defaultAttachmentBudget - $familyNonPdfReserve);
$planFamilyBundle = function (int $reportCount, int $reportBytes, int $invoiceBytes, int $budget) {
    $reportContent = str_repeat('R', $reportBytes);
    $invoiceContent = str_repeat('I', $invoiceBytes);
    $bundle = [];
    for ($index = 1; $index <= $reportCount; $index++) {
        $bundle[] = ['name' => "report-{$index}.pdf", 'content' => $reportContent];
    }
    $bundle[] = ['name' => 'invoice.pdf', 'content' => $invoiceContent];
    return astro_plan_attachment_parts($bundle, $budget);
};
$fiveReportPlan = $planFamilyBundle(5, (int)(2.5 * $mb), (int)(1.5 * $mb), $familyPdfBudget);
check(count($fiveReportPlan['parts']) === 1, 'Five typical preview reports and their invoice fit in one email');
check(count($fiveReportPlan['parts'][0]) === 6, 'The five-report email contains all five reports plus the invoice');
$maximumFamilyPlan = $planFamilyBundle(6, (int)(2.25 * $mb), (int)(1.25 * $mb), $familyPdfBudget);
check(count($maximumFamilyPlan['parts']) === 1, 'A typical maximum family bundle fits in one email');
check(count($maximumFamilyPlan['parts'][0]) === 7, 'A maximum family email contains six reports plus the invoice');
unset($fiveReportPlan, $maximumFamilyPlan, $planFamilyBundle);

$attachments = [
    ['name' => 'report-1.pdf', 'content' => str_repeat('A', 4 * $mb)],
    ['name' => 'report-2.pdf', 'content' => str_repeat('B', 4 * $mb)],
    ['name' => 'invoice.pdf', 'content' => str_repeat('C', 2 * $mb)],
];
$plan = astro_plan_attachment_parts($attachments, 12 * $mb);
check(count($plan['parts']) >= 2, 'Three PDFs split into several budget-sized messages');
check($plan['oversize'] === [], 'Attachments inside the budget are never flagged as oversize');
$plannedBytes = 0;
$plannedNames = [];
foreach ($plan['parts'] as $part) {
    $partBytes = 0;
    foreach ($part as $attachment) {
        $plannedNames[] = $attachment['name'];
        $bytes = isset($attachment['content']) ? strlen($attachment['content'])
            : (int)($attachment['size'] ?? $attachment['bytes'] ?? 0);
        $partBytes += $bytes;
    }
    check(astro_mime_encoded_size($partBytes) <= 12 * $mb, 'Every planned message fits inside the configured budget');
    $plannedBytes += $partBytes;
}
check($plannedBytes === 10 * $mb, 'Every document is planned exactly once (no duplicate attachments)');
check($plannedNames === ['report-1.pdf', 'report-2.pdf', 'invoice.pdf'], 'Attachment order is preserved (reports before the invoice)');

$oversizePlan = astro_plan_attachment_parts([
    ['name' => 'huge.pdf', 'content' => str_repeat('D', 40 * $mb)],
    ['name' => 'small.pdf', 'content' => str_repeat('E', 1 * $mb)],
], 12 * $mb);
check($oversizePlan['oversize'] === ['huge.pdf'], 'A single document larger than the budget is reported to the admin');
check($oversizePlan['parts'][0][0]['name'] === 'huge.pdf', 'An unsplittable document ships alone instead of with the bundle');
check(count($oversizePlan['parts']) === 2, 'The remaining documents still travel together');
check($oversizePlan['parts'][1][0]['name'] === 'small.pdf', 'Documents after an oversize one are not lost');

check(astro_max_attachment_encoded_bytes() >= 524288, 'A usable default per-message budget exists without configuration');

// ---------------------------------------------------------------------------
// 2. Razorpay webhook signature verification
// ---------------------------------------------------------------------------
$secret = 'whsec_test_secret_value';
$body = json_encode(['event' => 'payment.captured', 'payload' => ['payment' => ['entity' => ['id' => 'pay_1']]]]);
$signature = hash_hmac('sha256', $body, $secret);
check(astro_payment_verify_razorpay_signature($body, $signature, $secret) === true, 'A correctly signed Razorpay body verifies');
check(astro_payment_verify_razorpay_signature($body, strtoupper($signature), $secret) === false, 'A modified signature fails closed');
check(astro_payment_verify_razorpay_signature($body . ' ', $signature, $secret) === false, 'A tampered body fails verification');
check(astro_payment_verify_razorpay_signature($body, '', $secret) === false, 'A missing signature is rejected');
check(astro_payment_verify_razorpay_signature($body, $signature, '') === false, 'An unconfigured webhook secret rejects every event');

// ---------------------------------------------------------------------------
// 3. Amount / currency matching against the stored intent
// ---------------------------------------------------------------------------
$intent = ['id' => 'pi_test', 'amount' => '499.00', 'currency' => 'INR'];
check(astro_payment_amount_matches($intent, 499.0, 'INR') === true, 'An exact amount and currency matches');
check(astro_payment_amount_matches($intent, '499.00', 'inr') === true, 'Currency comparison is case-insensitive');
check(astro_payment_amount_matches($intent, 499.01, 'INR') === false, 'A higher amount does not match');
check(astro_payment_amount_matches($intent, 100.0, 'INR') === false, 'A lower amount does not match');
check(astro_payment_amount_matches($intent, 499.0, 'USD') === false, 'A different currency does not match');
check(astro_payment_amount_matches(['amount' => 18.0, 'currency' => 'USD'], 18.0, '') === true, 'A missing provider currency still matches on amount');
check(strpos(astro_payment_mismatch_message($intent, 100.0, 'INR', 'Razorpay'), 'Nothing was captured') !== false, 'Mismatch explanations state that nothing was captured');

// ---------------------------------------------------------------------------
// 4. Provider reference and prefix rules
// ---------------------------------------------------------------------------
check(astro_payment_reference('GPAY', 'pay_ABC123-xyz') === 'GPAY-ONL-pay_ABC123-xyz', 'Razorpay payment ids build the same online reference as the Node path');
check(astro_payment_reference('PAYPAL', 'CAP/URE#1') === 'PAYPAL-ONL-CAPURE1', 'Unsafe characters are stripped from provider ids');
check(astro_payment_intent_prefix(['payment_method' => 'PAYPAL']) === 'PAYPAL', 'PayPal intents use the PayPal prefix');
check(astro_payment_intent_prefix(['payment_method' => 'GPAY']) === 'GPAY', 'UPI/Google Pay intents use the GPAY prefix');

// ---------------------------------------------------------------------------
// 5. Webhook secret masking rules
// ---------------------------------------------------------------------------
check(astro_payment_is_masked_secret('••••••••') === true, 'Masked secrets are never treated as configured credentials');
check(astro_payment_is_masked_secret('') === true, 'Empty secrets are never treated as configured credentials');
check(astro_payment_is_masked_secret('a-real-webhook-secret') === false, 'A real webhook secret is accepted');

echo "\nPHP payment webhook & attachment budget tests passed.\n";
