<?php
require_once __DIR__ . '/../branding.php';
if (!function_exists('astro_report_normalize_language')) {
    function astro_report_normalize_language($value): string {
        if (function_exists('astro_normalize_report_language')) return astro_normalize_report_language($value);
        if (!is_string($value)) return 'en';
        $language = strtolower(trim($value));
        return in_array($language, ['en', 'ta', 'hi'], true) ? $language : 'en';
    }
}
/**
 * ASTRO SIVAM - Server-side Invoice PDF via mPDF (Multi-Language & Real Embedded Fonts)
 *
 * Fully localized in English, Tamil, and Hindi.
 * Matches src/services/invoiceHtmlBuilder.ts styling and layout.
 */

// Load Composer autoloader (mPDF and dependencies in public_html/vendor/)
if (is_file(__DIR__ . '/../../vendor/autoload.php')) {
    require_once __DIR__ . '/../../vendor/autoload.php';
}

require_once __DIR__ . '/mpdf_fontconfig.php';

class AstroMpdfInvoice {

    public static function isAvailable(): bool {
        if (class_exists('\Mpdf\Mpdf')) {
            return true;
        }
        return function_exists('astroEnsureMpdfAutoload') ? astroEnsureMpdfAutoload() : false;
    }

    private static function serviceCopy($serviceType, $lang = 'en'): array {
        switch ($serviceType) {
            case 'BIRTH_JATHAGAM':
                return [
                    'title' => 'Vedic Birth Jathagam (Horoscope)',
                    'desc' => 'Precision Birth Chart, Planetary Ephemeris, Kuja Dosha Analysis, 3-Year Dasha Predictions, and Vedic Guidance',
                ];
            case 'MARRIAGE_COMPATIBILITY':
                return [
                    'title' => 'Vedic Marriage Compatibility (10 Poruthams)',
                    'desc' => '10-Poruthams Kuta Assessment, Rajju Matching, Kuja (Mars) Dosha Alignment, and Matrimonial Compatibility Report',
                ];
            case 'BABY_NAMING':
                return [
                    'title' => 'Vedic Namakaran (Baby Naming)',
                    'desc' => 'Nakshatra Pada Syllables, Numerological Analysis, Auspicious Name Recommendations, and Vedic Naming Certificate',
                ];
            case 'MUHURTHAM':
                return [
                    'title' => 'Subha Muhurtham (6-Month Auspicious Dates)',
                    'desc' => 'Six-Month Panchangam Muhurtham Calendar, Nalla Neram Windows, Rahu Kalam, Tithi, Nakshatra Grading and Personal Star Checks',
                ];
            default:
                return [
                    'title' => 'Vedic Astrological Consultation & Certified Kundali Report',
                    'desc' => 'Comprehensive Nirayana Vedic Astrology Calculations, Ephemeris Analysis, and Planetary Placements',
                ];
        }
    }

    private static function paymentMethodDisplay($method): string {
        $map = [
            'MPAISA' => 'Vodafone M-PAiSA',
            'MYCASH' => 'Digicel MyCash',
            'PAYPAL' => 'PayPal Secure Checkout',
            'CARD' => 'Credit / Debit Card',
        ];
        return $map[$method] ?? ($method ?: 'Direct Payment');
    }

    /** Report language of the order, always written in English. */
    private static function langDisplay($lang): string {
        $lang = astro_report_normalize_language($lang);
        if ($lang === 'ta' || $lang === 'tamil') return 'Tamil';
        if ($lang === 'hi' || $lang === 'hindi') return 'Hindi';
        return 'English';
    }

    private static function e($str): string {
        return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
    }

    private static function currencySymbol($curr): string {
        if ($curr === 'INR') return '₹';
        if ($curr === 'USD') return 'US$';
        return 'FJ$';
    }

    /** Shared professional invoice CSS (mPDF-safe, table-based layout). */
    private static function invoiceCss(): string {
        return <<<'CSS'
  @page { margin: 5mm 6mm 6mm; }
  body { font-family: notosans, notosanstamil, notosansdevanagari, dejavusans, sans-serif; color: #0f172a; font-size: 9px; line-height: 1.3; background: #ffffff; margin: 0; padding: 0; }

  .invoice-brand-lockup { width: 100%; text-align: center; page-break-inside: avoid; margin: 0 0 1mm; }
  .header-logo { width: 58px; height: 58px; display: block; object-fit: contain; margin: 0 auto 1mm; border: 0; border-radius: 0; }
  .brand-title { font-size: 16px; color: #7d1233; letter-spacing: 0.5px; font-weight: bold; line-height: 1.2; }
  .brand-tagline { font-size: 10.5px; color: #0b7a5a; font-weight: bold; letter-spacing: 0; margin-top: 0.5mm; }
  .brand-contact { font-size: 8.5px; color: #64748b; margin-top: 0.5mm; line-height: 1.3; font-weight: bold; }
  .invoice-meta { font-size: 8px; color: #64748b; margin-top: 0.5mm; font-weight: bold; }
  .inv-chip { color: #7d1233; font-size: 8px; font-weight: bold; letter-spacing: 0.3px; }
  .inv-no { color: #334155; font-size: 8px; font-weight: bold; }
  table.modern-divider { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 1.2mm 0 3mm; }
  table.modern-divider td { height: 0.6mm; padding: 0; border: 0; }

  table.info-grid { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; }
  table.info-grid td.info-box { width: 50%; border: 1px solid #e3e6ee; background: #f7f8fb; border-radius: 14px; vertical-align: top; padding: 0; }
  .info-box-title { font-size: 8px; color: #7d1233; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; background: #f7f8fb; border-bottom: 1px solid #e3e6ee; padding: 1.5mm 2.8mm; }
  table.info-rows { width: 100%; font-size: 8.5px; }
  table.info-rows td { padding: 1mm 2.8mm; vertical-align: top; }
  .info-label { color: #64748b; font-weight: bold; width: 42%; font-size: 7.8px; text-transform: uppercase; }
  .info-value { color: #0f172a; font-weight: bold; text-align: right; word-wrap: break-word; }
  .badge-paid { background: #ecfdf5; color: #0b7a5a; border: 1px solid #10b981; padding: 0.3mm 2mm; font-size: 7.5px; font-weight: bold; letter-spacing: 0.4px; border-radius: 4px; }

  .payment-strip { margin-bottom: 2.5mm; }
  table.pay-cells { width: 100%; border-collapse: separate; border-spacing: 2mm 0; }
  table.pay-cells td.pay-cell { background: #f7f8fb; border: 1px solid #e3e6ee; border-radius: 10px; padding: 1.6mm 2.8mm; font-size: 8.5px; color: #334155; width: 33%; }
  .pay-cell strong { color: #0f172a; font-size: 7.2px; letter-spacing: 0.4px; display: block; margin-bottom: 0.3mm; text-transform: uppercase; }
  .pay-cell .pay-val { color: #0f172a; font-weight: bold; }

  table.invoice-table { width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 2.5mm; border: 1px solid #e3e6ee; border-radius: 10px; }
  table.invoice-table th { background: #f7f8fb; color: #7d1233; font-size: 7.6px; text-align: left; padding: 1.8mm 2.4mm; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1.5px solid #e3e6ee; }
  table.invoice-table td { padding: 2mm 2.4mm; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .center { text-align: center; }
  .right { text-align: right; }
  .item-title { font-weight: bold; color: #7d1233; font-size: 9.5px; margin-bottom: 0.4mm; }
  .item-desc { font-size: 7.8px; color: #64748b; line-height: 1.3; font-weight: normal; }
  .amount-strong { font-weight: bold; color: #0f172a; }

  table.summary-section { width: 100%; margin-bottom: 2.5mm; border-collapse: collapse; }
  .terms-box { background: #f7f8fb; border: 1px solid #e3e6ee; border-radius: 14px; padding: 2mm 3mm; vertical-align: top; }
  .terms-title { font-size: 8px; font-weight: bold; color: #7d1233; margin-bottom: 1mm; text-transform: uppercase; letter-spacing: 0.5px; }
  .terms-box ul { margin: 0; padding-left: 3.5mm; font-size: 7.8px; color: #334155; line-height: 1.4; }
  .terms-box li { margin-bottom: 0.8mm; }
  .totals-box { width: 68mm; border: 1px solid #e3e6ee; background: #f7f8fb; border-radius: 14px; vertical-align: top; padding: 0; }
  .totals-box-title { background: #f7f8fb; border-bottom: 1px solid #e3e6ee; color: #7d1233; font-size: 8px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; padding: 1.5mm 2.8mm; }
  table.totals-rows { width: 100%; font-size: 8.5px; color: #334155; }
  table.totals-rows td { padding: 1.1mm 2.8mm; }
  .grand-total { font-size: 10.5px; font-weight: bold; color: #7d1233; border-top: 1.5px solid #e3e6ee; }
  .balance { font-size: 8.5px; font-weight: bold; color: #0b7a5a; }

  .declaration-box { background: #f7f8fb; border: 1px solid #e3e6ee; border-left: 3.5px solid #7d1233; border-radius: 10px; padding: 1.8mm 2.8mm; margin-bottom: 2.5mm; font-size: 7.8px; color: #334155; line-height: 1.4; }

  table.signature-row { width: 100%; margin: 1mm 0 2mm; border-collapse: collapse; }
  .signature-block { text-align: center; width: 30%; }
  .signature-line { border-bottom: 1px solid #64748b; height: 5mm; }
  .signature-label { font-size: 7.8px; color: #0f172a; font-weight: bold; margin-top: 0.8mm; }
  .signature-role { font-size: 6.6px; color: #64748b; font-weight: bold; letter-spacing: 0.4px; text-transform: uppercase; }

  table.seal-section { width: 100%; border-top: 1px solid #e3e6ee; margin-bottom: 2mm; }
  table.seal-section td { padding: 2mm 1mm 1mm; vertical-align: middle; }
  .seal-circle { width: 16mm; height: 16mm; border-radius: 50%; border: 1.5px solid #a85a14; text-align: center; vertical-align: middle; background: #fef3c7; }
  .seal-title { font-size: 7.5px; color: #7d1233; font-weight: bold; line-height: 1.15; }
  .seal-sub { font-size: 5.8px; color: #a85a14; font-weight: bold; }
  .seal-text { font-size: 7.6px; color: #334155; line-height: 1.35; }
  .seal-text strong { color: #7d1233; font-size: 8px; }
  .auth-sign { text-align: right; font-size: 7.6px; color: #64748b; }

  .footer { text-align: center; border-top: 1px solid #e3e6ee; padding-top: 1.4mm; font-size: 7.6px; color: #64748b; margin-top: 1mm; }
  .footer .brand-footer { color: #7d1233; font-weight: bold; font-size: 8.5px; letter-spacing: 0.5px; text-transform: uppercase; }
CSS;
    }

    /**
     * Full-page contract for the emailed invoice (mPDF).
     *
     * mPDF flows content, so a short invoice used to stop two thirds down the
     * sheet and leave the rest of the A4 blank. Flexbox is not available here,
     * so the leftover height is bought with padding: the model estimates how
     * much of the sheet the fixed blocks occupy and the slack is shared
     * between the detail boxes, the payment strip, the item rows, the summary,
     * the declaration, the signature rule and the seal band. Both the estimate
     * and the growth are capped, so the document can never spill onto a second
     * page because of this.
     */
    public static function invoiceFillCss(int $itemCount): string {
        $items = max(1, $itemCount);
        $sheetMm = 286.0;                       // A4 less the 5/6/6mm @page margins
        $baseMm = 155.0 + (6.5 * $items);       // centered header, boxes, tables, tail bands
        $slackMm = max(0.0, min(96.0, $sheetMm - $baseMm - 18.0));
        if ($slackMm < 4.0) return '';

        $fmt = static function (float $value, float $min): string {
            return number_format($min + $value, 2, '.', '');
        };
        $infoPad = $fmt(0.021 * $slackMm, 0.8);          // 4 rows x 2 sides -> 17%
        $payPad = $fmt(0.030 * $slackMm, 1.4);           // one strip        ->  6%
        $itemPad = $fmt(0.090 * $slackMm / $items, 1.8); // the item rows    -> 18%
        $termsGap = $fmt(0.017 * $slackMm, 0.8);         // 3 term lines     ->  5%
        $totalsPad = $fmt(0.017 * $slackMm, 1.0);        // 4 total rows     -> 14%
        $declPad = $fmt(0.030 * $slackMm, 1.5);          // declaration box  -> 12%
        $signH = $fmt(0.080 * $slackMm, 5.0);            // signature rule    ->  8%
        $sealPad = $fmt(0.030 * $slackMm, 2.0);          // seal band        -> 12%

        return 'table.info-rows td { padding-top: ' . $infoPad . 'mm; padding-bottom: ' . $infoPad . 'mm; }'
            . ' table.pay-cells td.pay-cell { padding-top: ' . $payPad . 'mm; padding-bottom: ' . $payPad . 'mm; }'
            . ' table.invoice-table td { padding-top: ' . $itemPad . 'mm; padding-bottom: ' . $itemPad . 'mm; }'
            . ' .terms-box li { margin-bottom: ' . $termsGap . 'mm; }'
            . ' table.totals-rows td { padding-top: ' . $totalsPad . 'mm; padding-bottom: ' . $totalsPad . 'mm; }'
            . ' .declaration-box { padding-top: ' . $declPad . 'mm; padding-bottom: ' . $declPad . 'mm; }'
            . ' .signature-line { height: ' . $signH . 'mm; }'
            . ' table.seal-section td { padding-top: ' . $sealPad . 'mm; padding-bottom: ' . $sealPad . 'mm; }';
    }

    public static function buildHtml($order): string {
        // The tax invoice itself is issued in English only; the ordered report
        // language is still shown, but always as an English word.
        $reportLang = astro_report_normalize_language($order['language'] ?? 'en');
        $lang = 'en';

        $orderNumber = $order['order_number'] ?? $order['orderNumber'] ?? 'ORD-0000';
        $createdAt = $order['created_at'] ?? $order['createdAt'] ?? null;
        $createdDate = $createdAt ? date('F j, Y', strtotime($createdAt)) : date('F j, Y');
        $currency = $order['currency'] ?? 'FJD';
        $currencySymbol = self::currencySymbol($currency);
        $amountVal = number_format((float)($order['amount'] ?? 0), 2);
        $serviceType = $order['service_type'] ?? $order['serviceType'] ?? 'BIRTH_JATHAGAM';
        $svc = self::serviceCopy($serviceType, $lang);
        $langDisplay = self::langDisplay($reportLang);
        $paymentDisplay = self::paymentMethodDisplay($order['payment_method'] ?? $order['paymentMethod'] ?? null);
        $userName = self::e($order['user_name'] ?? $order['userName'] ?? 'Client');
        $userEmail = self::e($order['user_email'] ?? $order['userEmail'] ?? 'N/A');
        $userMobile = self::e($order['user_mobile'] ?? $order['userMobile'] ?? 'N/A');
        $country = self::e($order['country'] ?? 'Global');
        $paymentRef = self::e($order['payment_reference'] ?? $order['paymentReference'] ?? 'ADM-VERIFIED');
        
        // Resolve through the shared helper so the invoice header logo is found
        // in every deployment layout (cPanel public_html, /api/assets bundle,
        // local public/ and dist/). Falls back to the public URL instead of
        // silently dropping the logo.
        $logoPath = astro_logo_path();
        $logoSrc = ($logoPath !== '') ? $logoPath : astro_logo_absolute_url();
        $logoTag = '<img src="' . $logoSrc . '" class="header-logo" alt="ASTRO SIVAM" />';

        // Official Tax Invoice is strictly in English for legal & tax accounting compliance
        $invHeader = 'OFFICIAL TAX INVOICE &amp; PAYMENT RECEIPT';
        $invTag = 'TAX INVOICE';
        
        $boxInvTitle = 'Invoice Details';
        $lblInvNum = 'Invoice Number:';
        $lblOrdRef = 'Order Reference:';
        $lblDate = 'Date Issued:';
        $lblPayStatus = 'Payment Status:';
        $badgePaid = 'PAID &amp; VERIFIED';

        $boxClientTitle = 'Billed To (Client)';
        $lblName = 'Customer Name:';
        $lblEmail = 'Email Address:';
        $lblMobile = 'Mobile Number:';
        $lblLoc = 'Location / Country:';

        $lblPayChan = 'Payment Channel:';
        $lblTxnRef = 'Transaction Ref:';
        $lblCurr = 'Currency:';

        $thDesc = 'Service Description';
        $thLang = 'Language';
        $thQty = 'Qty';
        $thUnitPrice = 'Unit Price';
        $thTotal = 'Total';

        $termsTitle = 'Delivery &amp; Fulfillment Terms';
        $term1 = '<strong>Official PDF Report:</strong> Generated and certified with high-accuracy Vedic calculation.';
        $term2 = '<strong>Digital Delivery:</strong> Sent directly to your registered email (' . $userEmail . ').';
        $term3 = '<strong>Re-download Anytime:</strong> Available from your registered email records.';
        $term4 = '<strong>Support:</strong> admin@astrosivam.com';

        $lblSubtotal = 'Subtotal:';
        $lblTax = 'Tax / VAT (0.0%):';
        $lblTotalPaid = 'Total Paid:';
        $lblBalance = 'Balance Due:';
        $balancePaid = "{$currencySymbol}0.00 (PAID)";

        $decTitle = 'Declaration';
        $decText = 'This is a computer-generated tax invoice issued electronically and does not require a physical signature to be valid. It certifies that the amount stated above has been received in full by ASTRO SIVAM against the service described, and confirms delivery of the associated digital Vedic astrology report to the customer\'s registered email address.';

        $signCust = 'Customer Acknowledgement';
        $signAuth = 'Authorized Signatory, ASTRO SIVAM';
        
        $sealTitle = 'ASTRO SIVAM OFFICIAL DIGITAL SEAL';
        $sealSub = 'Authorized Vedic Astrology Ephemeris &amp; Consulting Services';

        $css = self::invoiceCss() . self::invoiceFillCss(1);

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
{$css}
</style>
</head>
<body>

<div class="invoice-brand-lockup">
  {$logoTag}
  <div class="brand-title">ASTRO SIVAM - OFFICIAL TAX INVOICE</div>
  <div class="brand-tagline">{$invHeader}</div>
  <div class="brand-contact">astrosivam.com &bull; admin@astrosivam.com</div>
  <div class="invoice-meta"><span class="inv-chip">{$invTag}</span> &bull; <span class="inv-no">INV-{$orderNumber}</span> &bull; Business Reg. No: ASV-FJ-2026</div>
</div>
<table class="modern-divider"><tr>
  <td style="width:17%;background:#edd1d9;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:4%;background:#a85a14;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:17%;background:#edd1d9;"></td>
</tr></table>

<table class="info-grid"><tr>
  <td class="info-box">
    <div class="info-box-title">{$boxInvTitle}</div>
    <table class="info-rows">
      <tr><td class="info-label">{$lblInvNum}</td><td class="info-value">INV-{$orderNumber}</td></tr>
      <tr><td class="info-label">{$lblOrdRef}</td><td class="info-value">{$orderNumber}</td></tr>
      <tr><td class="info-label">{$lblDate}</td><td class="info-value">{$createdDate}</td></tr>
      <tr><td class="info-label">{$lblPayStatus}</td><td class="info-value"><span class="badge-paid">{$badgePaid}</span></td></tr>
    </table>
  </td>
  <td class="info-box" style="border-left:3px solid #ffffff;">
    <div class="info-box-title">{$boxClientTitle}</div>
    <table class="info-rows">
      <tr><td class="info-label">{$lblName}</td><td class="info-value">{$userName}</td></tr>
      <tr><td class="info-label">{$lblEmail}</td><td class="info-value">{$userEmail}</td></tr>
      <tr><td class="info-label">{$lblMobile}</td><td class="info-value">{$userMobile}</td></tr>
      <tr><td class="info-label">{$lblLoc}</td><td class="info-value">{$country}</td></tr>
    </table>
  </td>
</tr></table>

<div class="payment-strip">
  <table class="pay-cells"><tr>
    <td class="pay-cell"><strong>{$lblPayChan}</strong><span class="pay-val">{$paymentDisplay}</span></td>
    <td class="pay-cell"><strong>{$lblTxnRef}</strong><span class="pay-val">{$paymentRef}</span></td>
    <td class="pay-cell"><strong>{$lblCurr}</strong><span class="pay-val">{$currency}</span></td>
  </tr></table>
</div>

<table class="invoice-table">
  <thead><tr>
    <th class="center" width="22">#</th>
    <th>{$thDesc}</th>
    <th class="center" width="80">{$thLang}</th>
    <th class="center" width="28">{$thQty}</th>
    <th class="right" width="72">{$thUnitPrice}</th>
    <th class="right" width="76">{$thTotal}</th>
  </tr></thead>
  <tbody><tr>
    <td class="center">1</td>
    <td><div class="item-title">{$svc['title']}</div><div class="item-desc">{$svc['desc']}</div></td>
    <td class="center">{$langDisplay}</td>
    <td class="center">1</td>
    <td class="right">{$currency} {$currencySymbol}{$amountVal}</td>
    <td class="right amount-strong">{$currency} {$currencySymbol}{$amountVal}</td>
  </tr></tbody>
</table>

<table class="summary-section"><tr>
  <td class="terms-box" style="width:57%;">
    <div class="terms-title">{$termsTitle}</div>
    <ul>
      <li>{$term1}</li>
      <li>{$term2}</li>
      <li>{$term3}</li>
      <li>{$term4}</li>
    </ul>
  </td>
  <td style="width:2%;"></td>
  <td class="totals-box">
    <div class="totals-box-title">PAYMENT SUMMARY</div>
    <table class="totals-rows">
      <tr><td>{$lblSubtotal}</td><td class="right" style="font-weight:bold; color:#2d241c;">{$currency} {$currencySymbol}{$amountVal}</td></tr>
      <tr><td>{$lblTax}</td><td class="right">{$currency} {$currencySymbol}0.00</td></tr>
      <tr class="grand-total"><td>{$lblTotalPaid}</td><td class="right">{$currency} {$currencySymbol}{$amountVal}</td></tr>
      <tr class="balance"><td>{$lblBalance}</td><td class="right">{$balancePaid}</td></tr>
    </table>
  </td>
</tr></table>

<div class="declaration-box">
  <div class="terms-title">{$decTitle}</div>
  {$decText}
</div>

<table class="signature-row"><tr>
  <td class="signature-block"><div class="signature-line"></div><div class="signature-label">{$signCust}</div><div class="signature-role">CUSTOMER</div></td>
  <td style="width:10%;"></td>
  <td class="signature-block"><div class="signature-line"></div><div class="signature-label">{$signAuth}</div><div class="signature-role">ASTRO SIVAM</div></td>
  <td style="width:26%; vertical-align:top;">
    <table class="seal-section" style="border:none;"><tr>
      <td style="width:20mm; text-align:center; padding:0;"><div class="seal-circle"><div class="seal-title">ASTRO<br/>SIVAM</div><div class="seal-sub">DIGITAL SEAL</div></div></td>
      <td class="seal-text" style="padding:0 0 0 2mm;"><strong>{$sealTitle}</strong><br/>{$sealSub}</td>
    </tr></table>
  </td>
</tr></table>

<table class="seal-section"><tr>
  <td class="auth-sign" style="text-align:right;">ASTRO SIVAM FULFILLMENT DESK &bull; astrosivam.com &bull; admin@astrosivam.com</td>
</tr></table>

<div class="footer">
  <div class="brand-footer">ASTRO SIVAM &mdash; OFFICIAL VEDIC REPORT &amp; TAX INVOICE</div>
  astrosivam.com &bull; admin@astrosivam.com
</div>

</body>
</html>
HTML;

    }

    /**
     * Generates the invoice PDF using mPDF with embedded temple fonts and Indic language support.
     * Returns raw PDF bytes.
     */
    public static function generateInvoicePdf($order): string {
        $fontDir = function_exists('astroMpdfFontDir') ? astroMpdfFontDir() : __DIR__ . '/fonts';
        $fontDirs = [];
        $fontData = [];

        if (class_exists('\Mpdf\Config\ConfigVariables')) {
            $defaultConfig = (new \Mpdf\Config\ConfigVariables())->getDefaults();
            $fontDirs = $defaultConfig['fontDir'] ?? [];
        }
        if (class_exists('\Mpdf\Config\FontVariables')) {
            $defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
            $fontData = $defaultFontConfig['fontdata'] ?? [];
        }

        $extraFontData = function_exists('astroMpdfFontData') ? astroMpdfFontData() : [];

        $lang = astro_report_normalize_language($order['language'] ?? 'en');
        $defaultFont = 'notosans';
        if ($lang === 'ta' && (isset($extraFontData['notosanstamil']) || isset($extraFontData['nototamil']))) {
            $defaultFont = isset($extraFontData['notosanstamil']) ? 'notosanstamil' : 'nototamil';
        } elseif ($lang === 'hi' && (isset($extraFontData['notosansdevanagari']) || isset($extraFontData['notodevanagari']))) {
            $defaultFont = isset($extraFontData['notosansdevanagari']) ? 'notosansdevanagari' : 'notodevanagari';
        }

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 6,
            'margin_right' => 6,
            'margin_top' => 6,
            'margin_bottom' => 8,
            'tempDir' => function_exists('astroMpdfTempDir') ? astroMpdfTempDir() : sys_get_temp_dir(),
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'useSubstitutions' => true,
            'fontDir' => !empty($fontDirs) ? array_merge($fontDirs, [$fontDir]) : [$fontDir],
            'fontdata' => $fontData + $extraFontData,
            'default_font' => $defaultFont,
        ]);

        $mpdf->WriteHTML(self::buildHtml($order));
        return $mpdf->Output('', 'S');
    }

    /**
     * Builds the HTML for a single consolidated "family" invoice covering every
     * order in a group (same customer, one payment, multiple charts/services).
     * $orders must be a non-empty array of order rows sharing the same group_id,
     * user, and currency (guaranteed by the multi-order checkout flow).
     */
    public static function buildFamilyHtml(array $orders, string $groupId): string {
        $first = $orders[0];
        // Consolidated family tax invoice: English only (see buildHtml()).
        $lang = 'en';

        $createdAt = $first['created_at'] ?? $first['createdAt'] ?? null;
        $createdDate = $createdAt ? date('F j, Y', strtotime($createdAt)) : date('F j, Y');
        $currency = $first['currency'] ?? 'FJD';
        $currencySymbol = self::currencySymbol($currency);
        $paymentDisplay = self::paymentMethodDisplay($first['payment_method'] ?? $first['paymentMethod'] ?? null);
        $userName = self::e($first['user_name'] ?? $first['userName'] ?? 'Client');
        $userEmail = self::e($first['user_email'] ?? $first['userEmail'] ?? 'N/A');
        $userMobile = self::e($first['user_mobile'] ?? $first['userMobile'] ?? 'N/A');
        $country = self::e($first['country'] ?? 'Global');
        $paymentRef = self::e($first['payment_reference'] ?? $first['paymentReference'] ?? 'ADM-VERIFIED');

        // Resolve through the shared helper so the invoice header logo is found
        // in every deployment layout (cPanel public_html, /api/assets bundle,
        // local public/ and dist/). Falls back to the public URL instead of
        // silently dropping the logo.
        $logoPath = astro_logo_path();
        $logoSrc = ($logoPath !== '') ? $logoPath : astro_logo_absolute_url();
        $logoTag = '<img src="' . $logoSrc . '" class="header-logo" alt="ASTRO SIVAM" />';

        // Official Consolidated Tax Invoice is strictly in English for legal & tax accounting compliance
        $invHeader = 'OFFICIAL TAX INVOICE &amp; PAYMENT RECEIPT';
        $invTag = 'CONSOLIDATED FAMILY INVOICE';

        $boxInvTitle = 'Invoice Details';
        $lblInvNum = 'Invoice Number:';
        $lblOrdRef = 'Group Reference:';
        $lblDate = 'Date Issued:';
        $lblPayStatus = 'Payment Status:';
        $badgePaid = 'PAID &amp; VERIFIED';

        $boxClientTitle = 'Billed To (Client)';
        $lblName = 'Customer Name:';
        $lblEmail = 'Email Address:';
        $lblMobile = 'Mobile Number:';
        $lblLoc = 'Location / Country:';

        $lblPayChan = 'Payment Channel:';
        $lblTxnRef = 'Transaction Ref:';
        $lblCurr = 'Currency:';

        $thNum = '#';
        $thDesc = 'Service Description';
        $thLang = 'Language';
        $thQty = 'Qty';
        $thUnitPrice = 'Unit Price';
        $thTotal = 'Total';

        $termsTitle = 'Delivery &amp; Fulfillment Terms';
        $term1 = '<strong>Official PDF Reports:</strong> One certified Vedic report generated per family member/chart listed below.';
        $term2 = '<strong>Digital Delivery:</strong> All reports were sent together with this consolidated invoice to your registered email (' . $userEmail . ').';
        $term3 = '<strong>Re-download Anytime:</strong> Available from your registered email records.';
        $term4 = '<strong>Support:</strong> admin@astrosivam.com';

        $lblSubtotal = 'Subtotal:';
        $lblTax = 'Tax / VAT (0.0%):';
        $lblTotalPaid = 'Total Paid:';
        $lblBalance = 'Balance Due:';
        $balancePaid = "{$currencySymbol}0.00 (PAID)";

        $decTitle = 'Declaration';
        $decText = 'This is a computer-generated official consolidated tax invoice issued electronically and does not require a physical signature to be valid. It certifies that the total amount for all services listed above has been received in full by ASTRO SIVAM, and confirms delivery of each associated digital Vedic astrology report to the customer\'s registered email address.';

        $signCust = 'Customer Acknowledgement';
        $signAuth = 'Authorized Signatory, ASTRO SIVAM';

        $sealTitle = 'ASTRO SIVAM OFFICIAL DIGITAL SEAL';
        $sealSub = 'Authorized Vedic Astrology Ephemeris &amp; Consulting Services';

        // Build one row per order/chart in the group, and sum the subtotal from
        // each order's actual stored amount (never recompute/guess pricing here).
        $rows = '';
        $subtotal = 0.0;
        $i = 0;
        foreach ($orders as $o) {
            $i++;
            $svc = self::serviceCopy($o['service_type'] ?? $o['serviceType'] ?? 'BIRTH_JATHAGAM', $lang);
            $itemLangDisplay = self::langDisplay(astro_report_normalize_language($o['language'] ?? $lang));
            $itemAmount = (float)($o['amount'] ?? 0);
            $subtotal += $itemAmount;
            $itemAmountVal = number_format($itemAmount, 2);
            $itemOrderNumber = self::e($o['order_number'] ?? $o['orderNumber'] ?? '');
            $rows .= '<tr>'
                . '<td class="center">' . $i . '</td>'
                . '<td><div class="item-title">' . $svc['title'] . '</div>'
                . '<div class="item-desc">' . $svc['desc'] . ($itemOrderNumber ? ' &bull; Order Ref: ' . $itemOrderNumber : '') . '</div></td>'
                . '<td class="center">' . $itemLangDisplay . '</td>'
                . '<td class="center">1</td>'
                . '<td class="right">' . $currency . ' ' . $currencySymbol . $itemAmountVal . '</td>'
                . '<td class="right" style="font-weight:bold;color:#0f172a;">' . $currency . ' ' . $currencySymbol . $itemAmountVal . '</td>'
                . '</tr>';
        }
        $subtotalVal = number_format($subtotal, 2);
        $groupIdSafe = self::e($groupId);
        $memberCount = count($orders);

        $css = self::invoiceCss() . self::invoiceFillCss(count($orders));

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
{$css}
</style>
</head>
<body>

<div class="invoice-brand-lockup">
  {$logoTag}
  <div class="brand-title">ASTRO SIVAM - OFFICIAL TAX INVOICE</div>
  <div class="brand-tagline">{$invHeader}</div>
  <div class="brand-contact">astrosivam.com &bull; admin@astrosivam.com</div>
  <div class="invoice-meta"><span class="inv-chip">{$invTag}</span> &bull; <span class="inv-no">INV-{$groupIdSafe}</span> &bull; Business Reg. No: ASV-FJ-2026</div>
</div>
<table class="modern-divider"><tr>
  <td style="width:17%;background:#edd1d9;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:4%;background:#a85a14;"></td>
  <td style="width:15%;background:#7d1233;"></td><td style="width:16%;background:#cf8e9f;"></td>
  <td style="width:17%;background:#edd1d9;"></td>
</tr></table>

<table class="info-grid"><tr>
  <td class="info-box">
    <div class="info-box-title">{$boxInvTitle}</div>
    <table class="info-rows">
      <tr><td class="info-label">{$lblInvNum}</td><td class="info-value">INV-{$groupIdSafe}</td></tr>
      <tr><td class="info-label">{$lblOrdRef}</td><td class="info-value">{$groupIdSafe} ({$memberCount})</td></tr>
      <tr><td class="info-label">{$lblDate}</td><td class="info-value">{$createdDate}</td></tr>
      <tr><td class="info-label">{$lblPayStatus}</td><td class="info-value"><span class="badge-paid">{$badgePaid}</span></td></tr>
    </table>
  </td>
  <td class="info-box" style="border-left:3px solid #ffffff;">
    <div class="info-box-title">{$boxClientTitle}</div>
    <table class="info-rows">
      <tr><td class="info-label">{$lblName}</td><td class="info-value">{$userName}</td></tr>
      <tr><td class="info-label">{$lblEmail}</td><td class="info-value">{$userEmail}</td></tr>
      <tr><td class="info-label">{$lblMobile}</td><td class="info-value">{$userMobile}</td></tr>
      <tr><td class="info-label">{$lblLoc}</td><td class="info-value">{$country}</td></tr>
    </table>
  </td>
</tr></table>

<div class="payment-strip">
  <table class="pay-cells"><tr>
    <td class="pay-cell"><strong>{$lblPayChan}</strong><span class="pay-val">{$paymentDisplay}</span></td>
    <td class="pay-cell"><strong>{$lblTxnRef}</strong><span class="pay-val">{$paymentRef}</span></td>
    <td class="pay-cell"><strong>{$lblCurr}</strong><span class="pay-val">{$currency}</span></td>
  </tr></table>
</div>

<table class="invoice-table">
  <thead><tr>
    <th class="center" width="22">{$thNum}</th>
    <th>{$thDesc}</th>
    <th class="center" width="80">{$thLang}</th>
    <th class="center" width="28">{$thQty}</th>
    <th class="right" width="72">{$thUnitPrice}</th>
    <th class="right" width="76">{$thTotal}</th>
  </tr></thead>
  <tbody>{$rows}</tbody>
</table>

<table class="summary-section"><tr>
  <td class="terms-box" style="width:57%;">
    <div class="terms-title">{$termsTitle}</div>
    <ul>
      <li>{$term1}</li>
      <li>{$term2}</li>
      <li>{$term3}</li>
      <li>{$term4}</li>
    </ul>
  </td>
  <td style="width:2%;"></td>
  <td class="totals-box">
    <div class="totals-box-title">PAYMENT SUMMARY</div>
    <table class="totals-rows">
      <tr><td>{$lblSubtotal}</td><td class="right" style="font-weight:bold; color:#2d241c;">{$currency} {$currencySymbol}{$subtotalVal}</td></tr>
      <tr><td>{$lblTax}</td><td class="right">{$currency} {$currencySymbol}0.00</td></tr>
      <tr class="grand-total"><td>{$lblTotalPaid}</td><td class="right">{$currency} {$currencySymbol}{$subtotalVal}</td></tr>
      <tr class="balance"><td>{$lblBalance}</td><td class="right">{$balancePaid}</td></tr>
    </table>
  </td>
</tr></table>

<div class="declaration-box">
  <div class="terms-title">{$decTitle}</div>
  {$decText}
</div>

<table class="signature-row"><tr>
  <td class="signature-block"><div class="signature-line"></div><div class="signature-label">{$signCust}</div><div class="signature-role">CUSTOMER</div></td>
  <td style="width:10%;"></td>
  <td class="signature-block"><div class="signature-line"></div><div class="signature-label">{$signAuth}</div><div class="signature-role">ASTRO SIVAM</div></td>
  <td style="width:26%; vertical-align:top;">
    <table class="seal-section" style="border:none;"><tr>
      <td style="width:20mm; text-align:center; padding:0;"><div class="seal-circle"><div class="seal-title">ASTRO<br/>SIVAM</div><div class="seal-sub">DIGITAL SEAL</div></div></td>
      <td class="seal-text" style="padding:0 0 0 2mm;"><strong>{$sealTitle}</strong><br/>{$sealSub}</td>
    </tr></table>
  </td>
</tr></table>

<table class="seal-section"><tr>
  <td class="auth-sign" style="text-align:right;">ASTRO SIVAM FULFILLMENT DESK &bull; astrosivam.com &bull; admin@astrosivam.com</td>
</tr></table>

<div class="footer">
  <div class="brand-footer">ASTRO SIVAM &mdash; OFFICIAL VEDIC REPORT &amp; FAMILY TAX INVOICE</div>
  astrosivam.com &bull; admin@astrosivam.com
</div>

</body>
</html>
HTML;

    }

    /**
     * Generates the consolidated family invoice PDF (one PDF, multiple line items,
     * summed grand total) using mPDF with embedded temple fonts.
     */
    public static function generateFamilyInvoicePdf(array $orders, string $groupId): string {
        $fontDir = function_exists('astroMpdfFontDir') ? astroMpdfFontDir() : __DIR__ . '/fonts';
        $fontDirs = [];
        $fontData = [];

        if (class_exists('\Mpdf\Config\ConfigVariables')) {
            $defaultConfig = (new \Mpdf\Config\ConfigVariables())->getDefaults();
            $fontDirs = $defaultConfig['fontDir'] ?? [];
        }
        if (class_exists('\Mpdf\Config\FontVariables')) {
            $defaultFontConfig = (new \Mpdf\Config\FontVariables())->getDefaults();
            $fontData = $defaultFontConfig['fontdata'] ?? [];
        }

        $extraFontData = function_exists('astroMpdfFontData') ? astroMpdfFontData() : [];

        $lang = astro_report_normalize_language($orders[0]['language'] ?? 'en');
        $defaultFont = 'notosans';
        if ($lang === 'ta' && (isset($extraFontData['notosanstamil']) || isset($extraFontData['nototamil']))) {
            $defaultFont = isset($extraFontData['notosanstamil']) ? 'notosanstamil' : 'nototamil';
        } elseif ($lang === 'hi' && (isset($extraFontData['notosansdevanagari']) || isset($extraFontData['notodevanagari']))) {
            $defaultFont = isset($extraFontData['notosansdevanagari']) ? 'notosansdevanagari' : 'notodevanagari';
        }

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 6,
            'margin_right' => 6,
            'margin_top' => 6,
            'margin_bottom' => 8,
            'tempDir' => function_exists('astroMpdfTempDir') ? astroMpdfTempDir() : sys_get_temp_dir(),
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'useSubstitutions' => true,
            'fontDir' => !empty($fontDirs) ? array_merge($fontDirs, [$fontDir]) : [$fontDir],
            'fontdata' => $fontData + $extraFontData,
            'default_font' => $defaultFont,
        ]);

        $mpdf->WriteHTML(self::buildFamilyHtml($orders, $groupId));
        return $mpdf->Output('', 'S');
    }
}
