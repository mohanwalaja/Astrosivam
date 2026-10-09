<?php
/**
 * ASTRO SIVAM - Consolidated Family Order Approval
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A "family order" (multi-order checkout) stores one row per devotee in the
 * `orders` table, all sharing the same `group_id`. Customers pay ONCE and must
 * therefore receive every devotee's report plus ONE consolidated tax invoice —
 * as a single email when it fits, or as several budget-sized emails (each
 * labelled "Part N of M") when the bundle is too large for the mail provider.
 *
 * Before this refactor that consolidation only existed inside two copy-pasted
 * route blocks of api/admin/index.php (the /family-orders/:groupId/... routes).
 * The generic single-order route (POST /api/admin/orders/:id/approve) had no
 * idea about groups, so approving any single member of a family bundle emailed
 * just that one report + one invoice. Approving a 3-member family therefore
 * produced 3 separate emails.
 *
 * This helper is now the single source of truth for family fulfilment and is
 * used by:
 *   - POST /api/admin/family-orders/:groupId/approve
 *   - POST /api/admin/family-orders/:groupId/resend-email
 *   - POST /api/admin/orders/:id/approve      (when the order belongs to a group)
 *   - POST /api/admin/orders.php?action=approve (when the order belongs to a group)
 *   - POST /api/admin/approve_order.php        (group_id / id based entry point)
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../astrology/engine.php';
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../branding.php';
require_once __DIR__ . '/../chat_alerts.php';
require_once __DIR__ . '/family_docs.php';

if (!function_exists('astroApproveFamilyGroup')) {
    /**
     * Calculate order metadata, then email every preview-rendered document in one family fulfillment.
     *
     * @param PDO   $pdo
     * @param array $admin  Authenticated admin row (needs id + name).
     * @param string $groupId
     * @param string $mode  'approve' (first delivery) or 'resend' (re-delivery).
     * @param array $clientDocs  Required preview-exact PDFs rendered in the
     *        admin live preview (html2canvas/jsPDF high-quality pipeline):
     *        - reportPdfs: list of {orderId?, orderNumber?, fileName?, pdfBase64}
     *        - invoicePdfBase64: the consolidated family tax invoice
     *        Staged documents are loaded from family_docs.php and merged with
     *        any bounded inline PDFs. Every member report and the invoice must
     *        pass validation before email; any missing item fails closed.
     *
     *        Because a family bundle can exceed PHP's `post_max_size`, the admin
     *        panel normally stages each document with its OWN request. This
     *        avoids a discarded multi-megabyte request body without changing
     *        PDF quality or asking the server renderer to fill gaps.
     *
     * @return array{success:bool,message:string,emailStatus?:string,emailMessage?:string,orderStatus?:string,memberCount?:int,groupId?:string}
     */
    function astroApproveFamilyGroup(PDO $pdo, array $admin, string $groupId, string $mode = 'approve', array $clientDocs = []): array
    {
        $groupId = trim((string) $groupId);
        if ($groupId === '') {
            return ['success' => false, 'message' => 'Missing family group id.'];
        }

        // ── Client-supplied preview-exact PDFs (high-quality live-preview renders)
        $clientReportPdfs = [];
        foreach ((array)($clientDocs['reportPdfs'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $bin = astroFamilyDocsDecodePdf((string)($item['pdfBase64'] ?? ($item['pdf_base64'] ?? '')));
            if ($bin !== null) {
                $clientReportPdfs[] = [
                    'orderId' => (string)($item['orderId'] ?? ($item['order_id'] ?? '')),
                    'orderNumber' => (string)($item['orderNumber'] ?? ($item['order_number'] ?? '')),
                    'fileName' => (string)($item['fileName'] ?? ($item['file_name'] ?? '')),
                    'content' => $bin,
                ];
            }
        }
        // Single-report fallback shape (reportPdfBase64 + orderId/orderNumber)
        if (empty($clientReportPdfs) && !empty($clientDocs['reportPdfBase64'])) {
            $bin = astroFamilyDocsDecodePdf((string)$clientDocs['reportPdfBase64']);
            if ($bin !== null) {
                $clientReportPdfs[] = [
                    'orderId' => (string)($clientDocs['orderId'] ?? ($clientDocs['id'] ?? '')),
                    'orderNumber' => (string)($clientDocs['orderNumber'] ?? ''),
                    'fileName' => (string)($clientDocs['reportFileName'] ?? ''),
                    'content' => $bin,
                ];
            }
        }
        $clientInvoicePdf = '';
        if (!empty($clientDocs['invoicePdfBase64'])) {
            $bin = astroFamilyDocsDecodePdf((string)$clientDocs['invoicePdfBase64']);
            if ($bin !== null) {
                $clientInvoicePdf = $bin;
            }
        }

        // ── Staged preview-exact PDFs ────────────────────────────────────────
        // The admin panel renders each member report one at a time (≈2 MB,
        // ≈8 s each) and uploads it with its own request, exactly like the
        // single-order flow, because N reports inside ONE JSON body exceed
        // PHP's post_max_size and get silently discarded. Anything staged on
        // disk is merged in here: inline payload wins for a member it covers,
        // staged uploads cover everybody else.
        $stagedDocs = astroLoadStagedFamilyDocs($groupId);
        $stagedReportCount = 0;
        foreach ((array)($stagedDocs['reports'] ?? []) as $stagedReport) {
            if (empty($stagedReport['content'])) {
                continue;
            }
            $clientReportPdfs[] = [
                'orderId' => (string)($stagedReport['orderId'] ?? ''),
                'orderNumber' => (string)($stagedReport['orderNumber'] ?? ''),
                'fileName' => (string)($stagedReport['fileName'] ?? ''),
                'content' => $stagedReport['content']
            ];
            $stagedReportCount++;
        }
        if ($clientInvoicePdf === '' && !empty($stagedDocs['invoice']['content'])) {
            $clientInvoicePdf = $stagedDocs['invoice']['content'];
        }
        $inlineReportCount = count($clientReportPdfs) - $stagedReportCount;

        /**
         * Pick the preview-exact client PDF for one order row, if provided.
         */
        $pickClientReport = function (array $o) use ($clientReportPdfs) {
            foreach ($clientReportPdfs as $item) {
                if ($item['orderId'] !== '' && $item['orderId'] === (string)$o['id']) {
                    return $item;
                }
                if ($item['orderNumber'] !== '' && $item['orderNumber'] === (string)$o['order_number']) {
                    return $item;
                }
            }
            return null;
        };

        // Multi-PDF rendering needs headroom.
        if (function_exists('set_time_limit')) {
            @set_time_limit(300);
        }
        @ini_set('memory_limit', '512M');
        @ini_set('max_execution_time', '300');
        if (function_exists('ignore_user_abort')) {
            @ignore_user_abort(true);
        }

        $stmt = $pdo->prepare("SELECT * FROM orders WHERE group_id = ? ORDER BY created_at ASC, id ASC");
        $stmt->execute([$groupId]);
        $groupOrders = $stmt->fetchAll();

        if (empty($groupOrders)) {
            return ['success' => false, 'message' => 'Family order group not found'];
        }

        $unpaid = array_values(array_filter($groupOrders, function ($row) {
            if ((float)($row['amount'] ?? 0) <= 0) return false;
            $paymentStatus = strtoupper((string)($row['payment_status'] ?? ''));
            return !(in_array($paymentStatus, ['CAPTURED', 'VERIFIED_MANUAL'], true) || (int)($row['payment_confirmed'] ?? 0) === 1);
        }));
        if (!empty($unpaid)) {
            return ['success' => false, 'message' => 'Payment verification is required before fulfilling this family order.', 'unpaidOrders' => array_map(function ($row) { return $row['order_number']; }, $unpaid)];
        }

        // Every family email must contain a complete set of browser-rendered
        // preview PDFs, whether the browser sent them inline or staged them.
        // Missing/invalid documents fail before the renderer or mailer can
        // substitute an mPDF/server-rendered file.
        $missingReportNumbers = [];
        foreach ($groupOrders as $qualityOrder) {
            if (!$pickClientReport($qualityOrder)) {
                $missingReportNumbers[] = (string)$qualityOrder['order_number'];
            }
        }
        if (!empty($missingReportNumbers) || $clientInvoicePdf === '') {
            $readyCount = count($groupOrders) - count($missingReportNumbers);
            return [
                'success' => false,
                'message' => 'Preview-quality family package is incomplete: '
                    . $readyCount . '/' . count($groupOrders) . ' reports and '
                    . ($clientInvoicePdf !== '' ? '1' : '0') . '/1 invoice reached the server.'
                    . (!empty($missingReportNumbers)
                        ? ' Missing reports: ' . implode(', ', $missingReportNumbers) . '.'
                        : '')
                    . ' No email was sent; retry the render/upload.'
            ];
        }

        $first = $groupOrders[0];
        $memberCount = count($groupOrders);

        $serviceDisplayNames = [
            'BIRTH_JATHAGAM' => 'Vedic Birth Jathagam (Horoscope)',
            'MARRIAGE_COMPATIBILITY' => 'Vedic Marriage Compatibility (10 Poruthams)',
            'BABY_NAMING' => 'Vedic Namakaran (Baby Naming)',
            'MUHURTHAM' => 'Subha Muhurtham (6-Month Auspicious Dates)'
        ];
        $currencySymbolMap = ['INR' => '₹', 'USD' => 'US$'];
        $groupCurrency = $first['currency'] ?? 'FJD';
        $groupCurrencySymbol = $currencySymbolMap[$groupCurrency] ?? 'FJ$';

        // ---------------------------------------------------------------------
        // PHASE 1 - Calculate every member's chart & build one report PDF each
        // ---------------------------------------------------------------------
        $attachments = [];
        $memberRowsHtml = '';
        $subtotal = 0.0;
        $generatedReports = 0;
        // Keep quality telemetry for the API response. Strict validation above
        // means every attachment below is preview-exact; serverReports stays 0.
        $previewReports = 0;
        $serverReports = 0;
        $serverReportNumbers = [];

        foreach ($groupOrders as $idx => $o) {
            if (function_exists('set_time_limit')) {
                @set_time_limit(300);
            }

            // The database value is only a cache. Rebuild and persist from each
            // member's saved input so edits never leave an old chart in the email flow.
            $result = AstroEngine::rebuildReportResultFromSavedInputs($o);

            $upd = $pdo->prepare("UPDATE orders SET calculated_result = ?, updated_at = NOW() WHERE id = ?");
            $upd->execute([json_encode($result, JSON_UNESCAPED_UNICODE), $o['id']]);
            $o['calculated_result'] = $result;

            // Keep each member's selected language. Attach only the exact
            // browser-rendered preview PDF, without any server-render fallback.
            $clientReport = $pickClientReport($o);
            $reportFromPreview = ($clientReport !== null
                && astroFamilyDocsIsPreviewQualityPdf($clientReport['content'] ?? null));
            if (!$reportFromPreview) {
                return [
                    'success' => false,
                    'message' => "Preview-quality report for order #{$o['order_number']} is missing or invalid. No email was sent; retry the render/upload."
                ];
            }

            $reportPdf = $clientReport['content'];
            $reportFileName = !empty($clientReport['fileName'])
                ? basename((string)$clientReport['fileName'])
                : "ASTRO_SIVAM_Report_{$o['order_number']}.pdf";
            $attachments[] = ['name' => $reportFileName, 'content' => $reportPdf];
            $generatedReports++;
            $previewReports++;
            unset($reportPdf);
            if (function_exists('gc_collect_cycles')) {
                gc_collect_cycles();
            }

            $payloadForName = json_decode($o['input_payload'], true) ?: [];
            $memberName = !empty($payloadForName['name'])
                ? $payloadForName['name']
                : (!empty($o['user_name']) ? $o['user_name'] : 'User #' . ($idx + 1));
            if ($o['service_type'] === 'MARRIAGE_COMPATIBILITY') {
                $brideName = $payloadForName['bride']['name'] ?? '';
                $groomName = $payloadForName['groom']['name'] ?? '';
                if ($brideName && $groomName) {
                    $memberName = $brideName . ' & ' . $groomName;
                }
            }

            $svcName = $serviceDisplayNames[$o['service_type']] ?? $o['service_type'];
            $subtotal += (float) ($o['amount'] ?? 0);

            $memberRowsHtml .= "<div style='margin-bottom:6px;'>&#10003;&nbsp; <strong>"
                . htmlspecialchars($reportFileName) . "</strong> &mdash; "
                . htmlspecialchars($memberName) . " (" . htmlspecialchars($svcName) . ")</div>";
        }

        if ($generatedReports !== $memberCount) {
            return [
                'success' => false,
                'message' => "Only {$generatedReports}/{$memberCount} preview-quality reports passed validation. No email was sent."
            ];
        }

        // ---------------------------------------------------------------------
        // PHASE 2 - Attach the preview-rendered consolidated family invoice
        // ---------------------------------------------------------------------
        $invoiceFromPreview = false;
        try {
            if ($memberCount > 1) {
                $invoiceFileName = "ASTRO_SIVAM_Family_Invoice_{$groupId}.pdf";
                $invoiceLabel = "One Consolidated Tax Invoice ({$memberCount} items)";
            } else {
                $invoiceFileName = "ASTRO_SIVAM_Invoice_{$first['order_number']}.pdf";
                $invoiceLabel = "Official Tax Invoice & Payment Receipt";
            }

            if (!astroFamilyDocsIsPreviewQualityPdf($clientInvoicePdf)) {
                return [
                    'success' => false,
                    'message' => 'Preview-quality family invoice is missing or invalid. No email was sent; retry the render/upload.'
                ];
            }
            // The admin browser rendered the consolidated invoice from the same
            // builder the live preview uses - attach it unchanged.
            $invoicePdf = $clientInvoicePdf;
            $invoiceFromPreview = true;
        } catch (\Throwable $e) {
            error_log('ASTRO SIVAM: family invoice generation failed - ' . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to generate the consolidated family invoice: ' . $e->getMessage()];
        }

        $attachments[] = ['name' => $invoiceFileName, 'content' => $invoicePdf];
        unset($invoicePdf);

        // ---------------------------------------------------------------------
        // PHASE 3 - Email every attachment, split into budget-sized messages
        // ---------------------------------------------------------------------
        $sStmt = $pdo->query("SELECT * FROM system_settings ORDER BY id ASC LIMIT 1");
        $sRow = $sStmt->fetch();
        $emailSettings = $sRow ? json_decode($sRow['email_settings'], true) : [];

        $subtotalDisplay = htmlspecialchars($groupCurrency) . ' ' . $groupCurrencySymbol . number_format($subtotal, 2);
        $orderDateDisplay = date('d M Y', strtotime($first['created_at'] ?? 'now'));
        $isResend = ($mode === 'resend');

        $intro = $isResend
            ? "Here is your requested copy of your family order's official ASTRO SIVAM documents &mdash; all {$memberCount} reports and your consolidated tax invoice are attached below."
            : "Your family order ({$memberCount} users) has been verified, calculated with precision Nirayana Vedic ephemeris, and approved by the ASTRO SIVAM administration. All {$memberCount} reports and your one consolidated tax invoice are attached to this delivery.";

        $html = "
    <div style=\"background:#f4ede1; padding:24px 12px; font-family: Georgia, 'Times New Roman', serif;\">
    <div style='max-width: 600px; margin: 0 auto; background: #fffdf9; border: 1px solid #e8d9b8; border-radius: 10px; overflow: hidden;'>

      <div style='background: #7a1f1f; padding: 22px 24px; text-align: center;'>
        " . astro_email_logo_tag(56) . "
        <div style='color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;'>ASTRO SIVAM</div>
        <div style='color:#e9c98a; font-size:12px; margin-top:2px; letter-spacing:0.5px;'>AUTHENTIC VEDIC ASTROLOGY &amp; MATCHMAKING SERVICES</div>
      </div>
      <div style='height:4px; background: repeating-linear-gradient(90deg, #c9962c 0 10px, #7a1f1f 10px 20px);'></div>

      <div style='padding: 26px 26px 8px;'>
        <p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>" . htmlspecialchars($first['user_name']) . "</strong>,</p>
        <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
          {$intro}
        </p>
        <p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 18px;'>
          Large bundles can exceed a single mail message, so delivery may arrive as a few emails labelled &ldquo;Part&nbsp;N&nbsp;of&nbsp;M&rdquo; &mdash; every report and the tax invoice is attached across them.
        </p>

        <div style='border:1px solid #e8d9b8; border-left:4px solid #7a1f1f; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#fbf6ea;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Family Order Summary</div>
          <table style='width:100%; border-collapse:collapse; font-size:13px; color:#3d3222;'>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Group Reference</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($groupId) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Charts / Members</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>{$memberCount}</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Date Approved</td>
              <td style='padding:3px 0; text-align:right; font-weight:700;'>" . htmlspecialchars($orderDateDisplay) . "</td>
            </tr>
            <tr>
              <td style='padding:3px 0; color:#8a7a55;'>Total Amount Paid</td>
              <td style='padding:3px 0; text-align:right; font-weight:700; color:#166534;'>{$subtotalDisplay}</td>
            </tr>
          </table>
        </div>

        <div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; margin-bottom:18px; background:#ffffff;'>
          <div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;'>Attached Documents ({$generatedReports} reports + 1 invoice)</div>
          <div style='font-size:13px; color:#3d3222; line-height:1.8;'>
            {$memberRowsHtml}
            <div>&#10003;&nbsp; <strong>" . htmlspecialchars($invoiceFileName) . "</strong> &mdash; {$invoiceLabel}</div>
          </div>
        </div>

        <div style='background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 14px; margin-bottom:18px; font-size:12.5px; color:#92400e; line-height:1.6;'>
          <strong>Delivery Notice:</strong> Your family's documents are sent in one or more emails (a large bundle is split so no message exceeds the mail size limit) &mdash; each email is labelled with its part number. If any part lands in your <em>Spam / Junk folder</em>, please mark it <strong>'Not Spam'</strong> and add <strong>admin@astrosivam.com</strong> to your contacts.
        </div>

        <p style='color:#6b5c3e; font-size:12px; line-height:1.6; margin:0 0 4px;'>These attached PDFs are your official records &mdash; please save them securely, as they are generated at the time of sending and are not stored on our servers afterward.</p>
      </div>

      <div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:16px 24px; text-align:center;'>
        <div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings &amp; Warm Regards, ASTRO SIVAM Team</div>
        <div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div>
      </div>

    </div>
    </div>";

        $subject = $isResend
            ? "ASTRO SIVAM: Re-delivery - Your Family Order ({$memberCount} Reports & Consolidated Tax Invoice, Group {$groupId})"
            : "ASTRO SIVAM: Your Family Order - {$memberCount} Reports & Consolidated Tax Invoice (Group {$groupId})";

        // Preview-quality reports are ~2 MB each, so a large family bundle can
        // produce a big message. Tell the admin how big it is BEFORE the mailer
        // rejects it, instead of leaving them guessing after a failure.
        $totalAttachmentBytes = 0;
        foreach ($attachments as $att) {
            $totalAttachmentBytes += strlen($att['content'] ?? '');
        }
        $totalAttachmentMb = round($totalAttachmentBytes / 1048576, 1);

        // HARD CAP + SPLIT DELIVERY: reserve capacity for the inline logo,
        // MIME headers and email body before packing PDFs. The mailer applies a
        // hard cap to every part, so a bundle is split rather than lost as one
        // oversized message. A single document that cannot fit is reported.
        $inlineLogoForBudget = astro_inline_logo_attachment();
        $nonPdfReserveBytes = 128 * 1024;
        foreach ($inlineLogoForBudget as $logoPart) {
            $nonPdfReserveBytes += astro_mime_encoded_size(strlen($logoPart['content'] ?? ''));
        }
        $maxEncodedBytes = astro_max_attachment_encoded_bytes();
        $pdfAttachmentBudget = max(512 * 1024, $maxEncodedBytes - $nonPdfReserveBytes);
        $attachmentPlan = astro_plan_attachment_parts($attachments, $pdfAttachmentBudget);
        $attachmentParts = $attachmentPlan['parts'];
        $totalParts = count($attachmentParts);
        $budgetMb = (int)round($attachmentPlan['max_encoded_bytes'] / 1048576);
        $oversizeNote = !empty($attachmentPlan['oversize'])
            ? ' WARNING: ' . implode(', ', $attachmentPlan['oversize']) . ' exceeds the per-message budget on its own - re-render or compress it.'
            : '';

        $sentParts = [];
        $failedParts = [];
        $partMessages = [];
        foreach ($attachmentParts as $partIndex => $partAttachments) {
            $partNumber = $partIndex + 1;
            $isMultiPart = $totalParts > 1;
            $partSubject = $isMultiPart ? ($subject . " (Part {$partNumber} of {$totalParts})") : $subject;

            if ($partNumber === 1 || !$isMultiPart) {
                $partHtml = $html;
            } else {
                // Continuation email: compact body listing just this part's files.
                $partListHtml = '';
                foreach ($partAttachments as $partAttachment) {
                    $partListHtml .= "<div style='margin-bottom:6px;'>&#10003;&nbsp; <strong>"
                        . htmlspecialchars((string)($partAttachment['name'] ?? 'report.pdf')) . "</strong></div>";
                }
                $partHtml = "<div style='background:#f4ede1; padding:24px 12px; font-family: Georgia, serif;'>"
                    . "<div style='max-width:600px; margin:0 auto; background:#fffdf9; border:1px solid #e8d9b8; border-radius:10px; overflow:hidden;'>"
                    . "<div style='background:#7a1f1f; padding:18px 24px; text-align:center;'>" . astro_email_logo_tag(52)
                    . "<div style='color:#ffffff; font-size:20px; font-weight:700;'>ASTRO SIVAM</div></div>"
                    . "<div style='padding:22px 24px;'>"
                    . "<p style='color:#1e1508; font-size:15px; margin:0 0 12px;'>Namaste <strong>" . htmlspecialchars($first['user_name']) . "</strong>,</p>"
                    . "<p style='color:#4b3d28; font-size:13.5px; line-height:1.7; margin:0 0 16px;'>This is part {$partNumber} of {$totalParts} of your family order documents (Group "
                    . htmlspecialchars($groupId) . "). The remaining files arrive in separate emails with the same subject so no message exceeds the {$budgetMb} MB mail limit.</p>"
                    . "<div style='border:1px solid #e8d9b8; border-radius:6px; padding:14px 16px; background:#ffffff;'>"
                    . "<div style='color:#7a1f1f; font-weight:700; font-size:12.5px; text-transform:uppercase; margin-bottom:8px;'>Attached in this email</div>"
                    . "<div style='font-size:13px; color:#3d3222; line-height:1.8;'>{$partListHtml}</div></div>"
                    . "<p style='color:#6b5c3e; font-size:12px; line-height:1.6; margin:16px 0 0;'>Please save these PDFs securely &mdash; they are generated at the time of sending and are not stored on our servers afterward.</p>"
                    . "</div>"
                    . "<div style='background:#faf3e3; border-top:1px solid #e8d9b8; padding:14px 24px; text-align:center;'>"
                    . "<div style='color:#7a1f1f; font-weight:700; font-size:13px;'>Blessings &amp; Warm Regards, ASTRO SIVAM Team</div>"
                    . "<div style='color:#a67c1f; font-size:11.5px; margin-top:4px;'>astrosivam.com &bull; admin@astrosivam.com</div></div>"
                    . "</div></div>";
            }

            $partResult = AstroMailer::sendEmailWithAttachments(
                $first['user_email'],
                $first['user_name'],
                $partSubject,
                $partHtml,
                $partAttachments,
                $emailSettings,
                $partNumber === 1 ? astro_inline_logo_attachment() : []
            );

            if (!empty($partResult['success'])) {
                $sentParts[] = $partNumber;
                $partMessages[] = 'part ' . $partNumber . ' accepted';
            } else {
                $failedParts[] = $partNumber;
                $partMessages[] = 'part ' . $partNumber . ' failed: ' . (string)($partResult['message'] ?? 'unknown SMTP error');
            }
        }

        $deliverySucceeded = empty($failedParts) && !empty($sentParts);
        $mailResult = ['success' => $deliverySucceeded];
        $splitNote = $totalParts > 1
            ? " Delivered in {$totalParts} emails to stay within the {$budgetMb} MB per-message attachment budget."
            : '';
        $emailMsg = ($deliverySucceeded
                ? "The family email with {$generatedReports} reports and 1 invoice was accepted by the SMTP transport.{$splitNote}"
                : (!empty($sentParts)
                    ? 'Partial delivery: ' . implode('; ', $partMessages) . '. Use the resend action to retry the failed part(s).'
                    : 'SMTP delivery failed; no family email was sent. Check the server mail logs and retry.'))
            . $oversizeNote;

        $emailStatus = $deliverySucceeded ? 'SENT' : 'FAILED';
        // Never mark a group COMPLETED unless EVERY part of the consolidated
        // delivery actually left the server - otherwise the customer is left
        // with an incomplete set of documents.
        $finalStatus = $deliverySucceeded ? 'COMPLETED' : 'PROCESSING';
        $emailSentAt = $deliverySucceeded ? date('Y-m-d H:i:s') : null;

        // The staged preview renders have now been delivered. Drop them so no
        // customer PDF is left sitting on the server (they are also pruned by
        // TTL). On failure they are kept so a retry does not need the admin
        // panel to re-render every chart again.
        if ($deliverySucceeded) {
            astroClearStagedFamilyDocs($groupId);
        }

        // Compatibility telemetry values remain in the response type, but
        // strict validation means a successful fulfillment is always exact.
        $renderQuality = ($serverReports === 0 && $previewReports > 0)
            ? 'PREVIEW_EXACT'
            : ($previewReports > 0 ? 'MIXED' : 'SERVER_RENDER');
        $invoiceQuality = !empty($invoiceFromPreview) ? 'PREVIEW_EXACT' : 'SERVER_RENDER';
        $qualityNote = '';
        if ($serverReports > 0) {
            $qualityNote = ' WARNING: ' . $serverReports . ' report(s) ('
                . implode(', ', $serverReportNumbers)
                . ') were rendered server-side because their preview-quality PDF never reached the server.';
        }

        // ---------------------------------------------------------------------
        // PHASE 4 - Atomic update of the whole group
        // ---------------------------------------------------------------------
        try {
            $upd = $pdo->prepare("UPDATE orders SET status = ?, payment_confirmed = 1, email_status = ?, email_sent_at = ?, email_last_status_message = ?, has_pdf = 1, has_invoice = 1, updated_at = NOW() WHERE group_id = ?");
            $upd->execute([$finalStatus, $emailStatus, $emailSentAt, $emailMsg, $groupId]);
        } catch (\Throwable $e) {
            error_log('ASTRO SIVAM: family group status update failed - ' . $e->getMessage());
        }

        logAudit(
            $pdo,
            $admin['id'] ?? 'admin',
            $admin['name'] ?? 'Administrator',
            'admin',
            $isResend ? 'FAMILY_EMAIL_RESENT' : 'FAMILY_ORDER_APPROVED',
            ($isResend ? "Re-sent" : "Approved") . " family order group {$groupId} ({$memberCount} charts)"
            . (!empty($mailResult['success'])
                ? " and emailed {$generatedReports} reports + 1 consolidated invoice in {$totalParts} email part(s) (group marked COMPLETED)"
                : " but email delivery FAILED or was only partially delivered - group kept in PROCESSING for retry")
            . " | render quality: {$renderQuality} ({$previewReports} preview-exact / {$serverReports} server-rendered, invoice {$invoiceQuality})"
            . " | attachments: {$totalAttachmentMb} MB across {$totalParts} message(s), budget {$budgetMb} MB each"
            . ($oversizeNote !== '' ? ' |' . $oversizeNote : '')
            . ($stagedReportCount > 0 ? " | staged uploads used: {$stagedReportCount}" : '')
        );

        // Best-effort WhatsApp/Viber "order complete" alert for the family
        // bundle - only on the initial fulfilment (not on admin email re-sends).
        if ($finalStatus === 'COMPLETED' && !$isResend) {
            foreach ($groupOrders as &$alertGroupOrder) {
                $alertGroupOrder['status'] = $finalStatus;
            }
            unset($alertGroupOrder);
            AstroChatAlerts::sendOrderAlerts($pdo, 'order_completed', $groupOrders);
        }

        return [
            'success' => !empty($mailResult['success']),
            'message' => !empty($mailResult['success'])
                ? "Family order group ({$memberCount} users) " . ($isResend ? 're-sent' : 'approved') . " and completed. {$generatedReports} preview-quality reports and 1 consolidated invoice ({$totalAttachmentMb} MB) emailed to {$first['user_email']} in {$totalParts} email part(s).{$qualityNote}{$sizeNote}"
                : "Family order group was calculated, but the email to {$first['user_email']} FAILED to send ({$emailMsg}). The group was NOT marked complete - please fix the email issue and approve again.",
            'emailStatus' => $emailStatus,
            'emailMessage' => $emailMsg,
            'orderStatus' => $finalStatus,
            'memberCount' => $memberCount,
            'groupId' => $groupId,
            'emailPartCount' => $totalParts,
            // Render-quality telemetry for admin confirmation; successful
            // fulfillment is preview-exact because missing PDFs fail closed.
            'renderQuality' => $renderQuality,
            'invoiceQuality' => $invoiceQuality,
            'previewReports' => $previewReports,
            'serverRenderedReports' => $serverReports,
            'serverRenderedOrderNumbers' => $serverReportNumbers,
            'stagedReportsUsed' => $stagedReportCount,
            'inlineReportsUsed' => max(0, $inlineReportCount),
            'totalAttachmentBytes' => $totalAttachmentBytes,
            'totalAttachmentMb' => $totalAttachmentMb
        ];
    }
}
