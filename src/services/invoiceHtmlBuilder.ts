import { Order } from '../types';
import { buildReportHeaderHtml, reportHeaderCss } from './reportHeader';
import { REPORT_FONT_LINK_TAG } from './reportFonts';
import { normalizeReportLanguage } from './reportLanguage';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrencySymbol(curr: string): string {
  const c = (curr || 'FJD').toUpperCase();
  if (c === 'INR') return '₹';
  if (c === 'USD') return '$';
  if (c === 'FJD') return 'FJ$';
  if (c === 'NZD') return 'NZ$';
  if (c === 'AUD') return 'A$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  if (c === 'CAD') return 'CA$';
  if (c === 'SGD') return 'S$';
  if (c === 'MYR') return 'RM';
  return '$';
}

const INVOICE_BASE_FONT = "'Noto Sans', 'Noto Sans Tamil', 'Noto Sans Devanagari', sans-serif";
const INVOICE_DISPLAY_FONT = "'Cinzel', serif";

/**
 * Shared luxury Vedic invoice stylesheet used by BOTH the single-order invoice and
 * the consolidated family-package invoice, perfectly matching Jathagam and Wedding Matching reports.
 */
function invoiceStyles(): string {
  return `<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Yatra+One&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

  :root {
    --maroon: #7a2129;
    --maroon: #7d1233;
    --maroon-dark: #500a20;
    --gold: #a85a14;
    --gold-light: #fef3c7;
    --gold-pale: #f7efdd;
    --green: #0b7a5a;
    --green-pale: #ecfdf5;
    --card-bg: #f7f8fb;
    --card-border: #e3e6ee;
    --ink: #0f172a;
    --ink-light: #334155;
    --ink-muted: #64748b;
    --radius-card: 14px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 0;
  }

  html, body {
    background: #ffffff;
    font-family: ${INVOICE_BASE_FONT};
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    padding: 0;
  }

  /* Full Page A4 Canvas (210mm x 297mm) */
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    font-family: ${INVOICE_BASE_FONT};
    color: var(--ink);
    position: relative;
    padding: 10mm 12mm 10mm;
    box-sizing: border-box;
    box-shadow: none;
  }

  .inner {
    padding: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 0;
    box-sizing: border-box;
  }

  /* ── Centered Header Lockup ── */
  ${reportHeaderCss(INVOICE_DISPLAY_FONT)}

  /* ── Two Cards: Invoice Details & Billed To ── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3mm;
    margin-bottom: 2.5mm;
    flex-shrink: 0;
  }

  .info-box {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    padding: 2.8mm 3.8mm;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .info-box-title {
    font-family: ${INVOICE_DISPLAY_FONT};
    font-size: clamp(10.5px, 1.6vw, 12px);
    font-weight: 800;
    color: var(--maroon);
    margin-bottom: 1.5mm;
    padding-bottom: 0.8mm;
    border-bottom: 1px solid var(--card-border);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .info-box-body {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.4mm 2.5mm;
    min-width: 0;
  }

  .info-row {
    font-size: clamp(9.5px, 1.4vw, 11px);
    line-height: 1.3;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .info-row.span2 {
    grid-column: span 2;
  }

  .info-label {
    color: var(--ink-muted);
    font-weight: 700;
    font-size: clamp(7.5px, 1.1vw, 8.5px);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: 0.3mm;
  }

  .info-value {
    font-weight: 700;
    color: var(--ink);
    font-size: clamp(9.5px, 1.4vw, 11px);
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* Status Badges */
  .badge-paid {
    display: inline-block;
    background: #ecfdf5;
    color: #0b7a5a;
    border: 1px solid #10b981;
    font-size: 8.5px;
    font-weight: 800;
    padding: 0.4mm 2mm;
    border-radius: 6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .badge-unpaid {
    display: inline-block;
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #f59e0b;
    font-size: 8.5px;
    font-weight: 800;
    padding: 0.4mm 2mm;
    border-radius: 6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .badge-cancelled {
    display: inline-block;
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #ef4444;
    font-size: 8.5px;
    font-weight: 800;
    padding: 0.4mm 2mm;
    border-radius: 6px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  /* ── Payment Verification Strip ── */
  .payment-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2mm;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    padding: 2mm 3.5mm;
    margin-bottom: 2.5mm;
    font-size: clamp(9.5px, 1.4vw, 11px);
    flex-shrink: 0;
  }

  .pay-cell {
    display: flex;
    align-items: center;
    gap: 2mm;
    color: var(--ink-light);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .pay-cell strong {
    color: var(--ink);
    font-weight: 700;
    font-size: clamp(8.5px, 1.2vw, 9.5px);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
  }

  .pay-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fef3c7;
    color: var(--gold);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
    border: 1px solid #fde68a;
  }

  /* ── Itemized Services Table ── */
  .table-container {
    background: #ffffff;
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    overflow: hidden;
    margin-bottom: 2.5mm;
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  table.invoice-table {
    width: 100%;
    flex: 1 1 auto;
    border-collapse: collapse;
    font-size: clamp(9.5px, 1.4vw, 10.5px);
  }

  table.invoice-table thead {
    display: table-header-group;
  }

  table.invoice-table th {
    background: var(--card-bg);
    color: var(--maroon);
    font-size: clamp(8px, 1.2vw, 9px);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2mm 2.8mm;
    text-align: left;
    border-bottom: 1.5px solid var(--card-border);
    white-space: normal;
  }

  table.invoice-table th.center, table.invoice-table td.center { text-align: center; }
  table.invoice-table th.right, table.invoice-table td.right { text-align: right; }

  table.invoice-table tbody tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  table.invoice-table td {
    padding: 2.2mm 2.8mm;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  table.invoice-table tr:last-child td {
    border-bottom: none;
  }

  .item-title {
    font-weight: 800;
    color: var(--maroon);
    font-size: clamp(10px, 1.5vw, 11.5px);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .item-desc {
    font-size: clamp(8px, 1.2vw, 9px);
    color: var(--ink-muted);
    margin-top: 0.4mm;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .amount-strong {
    font-weight: 800;
    color: var(--ink);
    font-size: clamp(10.5px, 1.5vw, 12px);
  }

  /* ── Two Cards: Terms & Payment Summary ── */
  .summary-section {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 3mm;
    margin-bottom: 2.5mm;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .terms-box {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    padding: 2.8mm 3.8mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .terms-title {
    font-family: ${INVOICE_DISPLAY_FONT};
    font-size: clamp(10px, 1.5vw, 11px);
    font-weight: 800;
    color: var(--maroon);
    margin-bottom: 1.2mm;
    padding-bottom: 0.6mm;
    border-bottom: 1px solid var(--card-border);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .terms-box ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .terms-box li {
    font-size: clamp(8.5px, 1.25vw, 9.5px);
    line-height: 1.38;
    color: var(--ink-light);
    margin-bottom: 0.8mm;
    padding-left: 2.8mm;
    position: relative;
    overflow-wrap: anywhere;
  }

  .terms-box li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--gold);
    font-weight: 800;
  }

  .totals-box {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    padding: 2.8mm 3.8mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  .totals-box-title {
    font-family: ${INVOICE_DISPLAY_FONT};
    font-size: clamp(10px, 1.5vw, 11px);
    font-weight: 800;
    color: var(--maroon);
    margin-bottom: 1.2mm;
    padding-bottom: 0.6mm;
    border-bottom: 1px solid var(--card-border);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .totals-body {
    display: flex;
    flex-direction: column;
    gap: 1mm;
    flex: 1 0 auto;
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    font-size: clamp(9.5px, 1.35vw, 10.5px);
    color: var(--ink-light);
    font-weight: 600;
  }

  .totals-row.grand-total {
    margin-top: 1mm;
    padding-top: 1.2mm;
    border-top: 1.5px solid var(--card-border);
    font-size: clamp(12px, 1.8vw, 14px);
    font-weight: 800;
    color: var(--maroon);
  }

  .totals-row.balance {
    font-size: clamp(9.5px, 1.4vw, 10.5px);
    font-weight: 800;
    color: var(--green);
  }

  /* ── Two Cards: Declaration & Digital Seal ── */
  .declaration-and-seal {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 3mm;
    margin-bottom: 2.5mm;
    align-items: stretch;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .declaration-box {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-left: 4px solid var(--maroon);
    border-radius: var(--radius-card);
    padding: 2.8mm 3.8mm;
    min-width: 0;
  }

  .declaration-box p {
    font-size: clamp(8.5px, 1.2vw, 9.2px);
    line-height: 1.38;
    color: var(--ink-light);
    overflow-wrap: anywhere;
  }

  .seal-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card);
    padding: 2.4mm 3.8mm;
    min-width: 0;
  }

  .seal-badge {
    display: flex;
    align-items: center;
    gap: 2.5mm;
    min-width: 0;
  }

  .seal-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--gold);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--maroon);
    font-size: 14px;
    font-weight: 800;
    flex-shrink: 0;
    background: var(--gold-light);
  }

  .seal-text strong {
    display: block;
    font-size: clamp(8px, 1.2vw, 9px);
    color: var(--maroon);
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .seal-text span {
    font-size: clamp(7px, 1vw, 8px);
    color: var(--ink-muted);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .auth-sign {
    text-align: right;
    min-width: 0;
    flex-shrink: 0;
  }

  .sign-title {
    font-size: clamp(8.5px, 1.2vw, 9.5px);
    font-weight: 800;
    color: var(--ink);
  }

  .sign-role {
    font-size: clamp(7.5px, 1vw, 8px);
    color: var(--ink-muted);
  }

  /* ── Footer ── */
  .footer {
    border-top: 1px solid var(--card-border);
    padding-top: 1.8mm;
    font-size: clamp(8.5px, 1.2vw, 9.5px);
    color: var(--ink-muted);
    line-height: 1.3;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer .brand-footer {
    color: var(--maroon);
    font-weight: 800;
    font-size: clamp(9px, 1.3vw, 10px);
    letter-spacing: 0.5px;
    font-family: ${INVOICE_DISPLAY_FONT};
  }

  .footer .brand-sub {
    font-size: clamp(8px, 1.1vw, 8.5px);
    color: var(--ink-muted);
    font-weight: 600;
  }

  @media (max-width: 560px) {
    .info-grid,
    .payment-strip,
    .summary-section,
    .declaration-and-seal {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>`;
}

export function buildInvoiceHtml(order: Order): string {
  const createdDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

  const currency = escapeHtml(order.currency || 'FJD');
  const currencySymbol = getCurrencySymbol(order.currency || 'FJD');
  const amountVal = Number(order.amount || 0).toFixed(2);

  let serviceTitle = 'Vedic Astrological Consultation & Certified Kundali Report';
  let serviceDesc = 'Precision Nirayana Vedic Astrology Calculations, Ephemeris Analysis, and Planetary Placements';
  if (order.serviceType === 'BIRTH_JATHAGAM') {
    serviceTitle = 'Vedic Birth Jathagam (Horoscope)';
    serviceDesc = 'Precision Birth Chart, Planetary Ephemeris, Kuja Dosha Analysis, Dasha Predictions & Guidance';
  } else if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    serviceTitle = 'Vedic Marriage Compatibility (10 Poruthams)';
    serviceDesc = '10-Poruthams Kuta Assessment, Rajju Matching, Kuja Dosha Alignment & Compatibility Report';
  } else if (order.serviceType === 'BABY_NAMING') {
    serviceTitle = 'Vedic Namakaran (Baby Naming)';
    serviceDesc = 'Nakshatra Pada Syllables, Numerological Analysis & Auspicious Name Recommendations';
  } else if (order.serviceType === 'MUHURTHAM') {
    serviceTitle = 'Subha Muhurtham (6-Month Auspicious Dates)';
    serviceDesc = 'Six-Month Panchangam Muhurtham Calendar, Nalla Neram Windows, Rahu Kalam & Personal Star Checks';
  }

  const langDisplay = invoiceLanguageLabel(order.language);

  const paymentMethodDisplay =
    order.paymentMethod === 'GPAY'
      ? 'Google Pay (GPay)'
      : order.paymentMethod === 'PAYPAL'
      ? 'PayPal'
      : order.paymentMethod === 'MPAISA'
      ? 'Vodafone M-PAiSA'
      : order.paymentMethod === 'MYCASH'
      ? 'Digicel MyCash'
      : escapeHtml(order.paymentMethod) || 'Verified Online Payment';

  const invHeader = 'OFFICIAL TAX INVOICE & PAYMENT RECEIPT';
  const invTag = 'TAX INVOICE';

  const boxInvTitle = 'Invoice Details';
  const lblInvNum = 'Invoice No:';
  const lblOrdRef = 'Order Ref:';
  const lblDate = 'Date:';
  const lblPayStatus = 'Status:';
  const isPaid = (order as any).paymentStatus === 'CAPTURED' || (order as any).paymentStatus === 'PAID' || order.status === 'APPROVED' || order.status === 'GENERATED' || (order.status as any) === 'COMPLETED' || (order.status as any) === 'CONFIRMED' || (order as any).paymentConfirmed || Number(order.amount || 0) === 0;
  const badgeClass = isPaid ? 'badge-paid' : 'badge-paid';
  const badgePaid = isPaid ? 'PAID & VERIFIED' : 'PAID & VERIFIED';

  const boxClientTitle = 'Billed To (Client)';
  const lblName = 'Name:';
  const lblEmail = 'Email:';
  const lblMobile = 'Mobile:';
  const lblLoc = 'Location:';

  const lblPayChan = 'Payment Method:';
  const lblTxnRef = 'Txn Ref:';
  const lblCurr = 'Currency:';

  const thItem = '#';
  const thDesc = 'Service Description';
  const thPerson = 'Person';
  const thLang = 'Language';
  const thQty = 'Qty';
  const thUnitPrice = 'Unit Price';
  const thTotal = 'Total';

  const termsTitle = 'Delivery & Fulfillment Terms';
  const term1 = '<strong>Official Report:</strong> Generated and certified with high-accuracy Vedic calculation.';
  const term2 = `<strong>Digital Delivery:</strong> Sent directly to registered email (${escapeHtml(order.userEmail) || '-'}) as attached PDF document.`;
  const term3 = '<strong>Support & Inquiries:</strong> astrosivam.com &bull; admin@astrosivam.com';

  const lblSubtotal = 'Subtotal';
  const lblTax = 'Tax / VAT (0%)';
  const lblTotalPaid = 'Total Paid';
  const lblBalance = 'Balance Due';
  const balancePaid = `${currencySymbol}0.00 (PAID)`;

  const decTitle = 'Declaration';
  const decText = 'This is a computer-generated tax invoice issued electronically. It certifies that the stated amount has been received in full by ASTRO SIVAM and the digital Vedic astrology report delivered directly to the customer\'s registered email.';

  const sealTitle = 'ASTRO SIVAM OFFICIAL DIGITAL SEAL';
  const sealSub = 'Authorized Vedic Astrology Ephemeris & Consulting Services';

  const personName = escapeHtml(memberDisplayName(order)) || escapeHtml(order.userName) || '-';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - Tax Invoice INV-${order.orderNumber}</title>
${REPORT_FONT_LINK_TAG}
${invoiceStyles()}
</head>
<body>

<div class="page invoice-page" id="invoice-page">
  <div class="inner">

    <!-- Top Header -->
    ${buildReportHeaderHtml({
      title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
      subtitle: 'Official Receipt & Tax Invoice • VEDIC ASTROLOGY SERVICES',
      meta: `${invTag} • INV-${order.orderNumber} • Business Reg. ASV-FJ-2026`
    })}

    <!-- Invoice Details & Client Information -->
    <div class="info-grid">
      <!-- Invoice Box -->
      <div class="info-box">
        <div class="info-box-title">${boxInvTitle}</div>
        <div class="info-box-body">
          <div class="info-row">
            <span class="info-label">${lblInvNum}</span>
            <span class="info-value">INV-${escapeHtml(order.orderNumber)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblOrdRef}</span>
            <span class="info-value">${escapeHtml(order.orderNumber)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblDate}</span>
            <span class="info-value">${createdDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblPayStatus}</span>
            <span class="info-value"><span class="${badgeClass}">${badgePaid}</span></span>
          </div>
        </div>
      </div>

      <!-- Client Box -->
      <div class="info-box">
        <div class="info-box-title">${boxClientTitle}</div>
        <div class="info-box-body">
          <div class="info-row">
            <span class="info-label">${lblName}</span>
            <span class="info-value">${escapeHtml(order.userName) || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblEmail}</span>
            <span class="info-value">${escapeHtml(order.userEmail) || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblMobile}</span>
            <span class="info-value">${escapeHtml(order.userMobile) || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${lblLoc}</span>
            <span class="info-value">${escapeHtml(order.country) || '-'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Verification Strip -->
    <div class="payment-strip">
      <div class="pay-cell">
        <span class="pay-icon">&#10003;</span>
        <div><strong>${lblPayChan}</strong> ${paymentMethodDisplay}</div>
      </div>
      <div class="pay-cell">
        <span class="pay-icon">#</span>
        <div><strong>${lblTxnRef}</strong> ${escapeHtml(order.paymentReference) || '-'}</div>
      </div>
      <div class="pay-cell">
        <span class="pay-icon">$</span>
        <div><strong>${lblCurr}</strong> ${currency}</div>
      </div>
    </div>

    <!-- Itemized Services Table -->
    <div class="table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="center" style="width: 26px;">${thItem}</th>
            <th>${thDesc}</th>
            <th class="center" style="width: 80px;">${thPerson}</th>
            <th class="center" style="width: 70px;">${thLang}</th>
            <th class="center" style="width: 32px;">${thQty}</th>
            <th class="right" style="width: 85px;">${thUnitPrice}</th>
            <th class="right" style="width: 85px;">${thTotal}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="center">1</td>
            <td>
              <div class="item-title">${serviceTitle}</div>
              <div class="item-desc">${serviceDesc}</div>
            </td>
            <td class="center">${personName}</td>
            <td class="center">${langDisplay}</td>
            <td class="center">1</td>
            <td class="right">${currencySymbol}${amountVal}</td>
            <td class="right amount-strong">${currencySymbol}${amountVal}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary & Totals -->
    <div class="summary-section">
      <div class="terms-box">
        <div class="terms-title">${termsTitle}</div>
        <ul>
          <li>${term1}</li>
          <li>${term2}</li>
          <li>${term3}</li>
        </ul>
      </div>

      <div class="totals-box">
        <div class="totals-box-title">Payment Summary</div>
        <div class="totals-body">
          <div class="totals-row">
            <span>${lblSubtotal}</span>
            <span>${currencySymbol}${amountVal}</span>
          </div>
          <div class="totals-row">
            <span>${lblTax}</span>
            <span>${currencySymbol}0.00</span>
          </div>
          <div class="totals-row grand-total">
            <span>${lblTotalPaid}</span>
            <span>${currencySymbol}${amountVal}</span>
          </div>
          <div class="totals-row balance">
            <span>${lblBalance}</span>
            <span>${balancePaid}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Declaration & Seal -->
    <div class="declaration-and-seal">
      <div class="declaration-box">
        <div class="terms-title" style="margin-bottom: 0.5mm;">${decTitle}</div>
        <p>${decText}</p>
      </div>

      <div class="seal-section">
        <div class="seal-badge">
          <div class="seal-circle">&#9775;</div>
          <div class="seal-text">
            <strong>${sealTitle}</strong>
            <span>${sealSub}</span>
          </div>
        </div>
        <div class="auth-sign">
          <div class="sign-title">For ASTRO SIVAM</div>
          <div class="sign-role">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span class="brand-footer">ASTRO SIVAM - OFFICIAL TAX INVOICE</span>
      <span class="brand-sub">astrosivam.com &bull; admin@astrosivam.com</span>
      <span style="font-weight: 700;">Page 1 / 1</span>
    </div>

  </div>
</div>

</body>
</html>`;
}

/**
 * Invoice language label. Tax invoices are issued in English only, so the
 * ordered report language is always written as an English word.
 */
export function invoiceLanguageLabel(rawLang?: string | null): string {
  const lang = normalizeReportLanguage(rawLang);
  if (lang === 'ta') return 'Tamil';
  if (lang === 'hi') return 'Hindi';
  return 'English';
}

/** Human-readable service copy shared by the invoice line items. */
function getServiceCopy(serviceType: string): { title: string; desc: string } {
  if (serviceType === 'BIRTH_JATHAGAM') {
    return {
      title: 'Vedic Birth Jathagam (Horoscope)',
      desc: 'Precision Birth Chart, Planetary Ephemeris, Kuja Dosha Analysis, Dasha Predictions & Guidance'
    };
  }
  if (serviceType === 'MARRIAGE_COMPATIBILITY') {
    return {
      title: 'Vedic Marriage Compatibility (10 Poruthams)',
      desc: '10-Poruthams Kuta Assessment, Rajju Matching, Kuja Dosha Alignment & Compatibility Report'
    };
  }
  if (serviceType === 'BABY_NAMING') {
    return {
      title: 'Vedic Namakaran (Baby Naming)',
      desc: 'Nakshatra Pada Syllables, Numerological Analysis & Auspicious Name Recommendations'
    };
  }
  if (serviceType === 'MUHURTHAM') {
    return {
      title: 'Subha Muhurtham (6-Month Auspicious Dates)',
      desc: 'Six-Month Panchangam Muhurtham Calendar, Nalla Neram Windows, Rahu Kalam & Personal Star Checks'
    };
  }
  return {
    title: 'Vedic Astrological Consultation & Certified Kundali Report',
    desc: 'Precision Nirayana Vedic Astrology Calculations, Ephemeris Analysis, and Planetary Placements'
  };
}

/** User display name for invoice rows (handles couple & baby payloads). */
export function memberDisplayName(order: Order): string {
  const p: any = order.inputPayload || {};
  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    const bride = p.bride?.name || p.brideName || p.p1Name || '';
    const groom = p.groom?.name || p.groomName || p.p2Name || '';
    if (bride && groom) return `${bride} & ${groom}`;
    return bride || groom || order.userName || 'User';
  }
  return p.name || p.babyName || p.childName || order.userName || 'User';
}

/**
 * Consolidated FAMILY PACKAGE tax invoice — the exact same luxury Vedic design as
 * the single-order tax invoice, with one line item per family member and a
 * single combined payment summary.
 */
export function buildFamilyInvoiceHtml(orders: Order[], groupId?: string): string {
  const members = orders && orders.length ? orders : [];
  const primary = members[0];
  const rawGroupId =
    groupId ||
    members.find(o => (o as any).groupId)?.groupId ||
    primary?.orderNumber ||
    '2026-001';
  const cleanGroupId = String(rawGroupId).replace(/^INV-/, '').replace(/^FAM-/, '');
  const invoiceNumber = `INV-FAM-${cleanGroupId}`;
  const familyGroupRef = `FAM-${cleanGroupId}`;

  const createdDate = primary?.createdAt
    ? new Date(primary.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

  const currencyCode = (primary?.currency || 'FJD').toUpperCase();
  const currency = escapeHtml(currencyCode);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const totalVal = members.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const totalAmountVal = totalVal.toFixed(2);
  const memberCount = members.length;

  const memberNames = members.map(m => memberDisplayName(m));
  const memberNamesDisplay = escapeHtml(memberNames.join(', ')) || '-';

  const paymentMethodDisplay =
    primary?.paymentMethod === 'GPAY'
      ? 'Google Pay (GPay)'
      : primary?.paymentMethod === 'PAYPAL'
      ? 'PayPal'
      : primary?.paymentMethod === 'MPAISA'
      ? 'Vodafone M-PAiSA'
      : primary?.paymentMethod === 'MYCASH'
      ? 'Digicel MyCash'
      : escapeHtml(primary?.paymentMethod) || 'Verified Online Payment';

  const invHeader = 'CONSOLIDATED FAMILY TAX INVOICE & RECEIPT';
  const invTag = 'FAMILY TAX INVOICE';

  const rowsHtml = members.map((m, idx) => {
    const copy = getServiceCopy(m.serviceType);
    const mName = escapeHtml(memberDisplayName(m)) || '-';
    const mAmount = Number(m.amount || 0).toFixed(2);
    const mOrderNum = escapeHtml(m.orderNumber || `ASV-FAM-${1001 + idx}`);
    const mLang = invoiceLanguageLabel(m.language);

    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>
          <div class="item-title">${copy.title}</div>
          <div class="item-desc"><strong>Ref:</strong> ${mOrderNum}</div>
        </td>
        <td class="center">${mName}</td>
        <td class="center">${mLang}</td>
        <td class="center">1</td>
        <td class="right">${currencySymbol}${mAmount}</td>
        <td class="right amount-strong">${currencySymbol}${mAmount}</td>
      </tr>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - Consolidated Family Tax Invoice ${escapeHtml(invoiceNumber)}</title>
${REPORT_FONT_LINK_TAG}
${invoiceStyles()}
</head>
<body>

<div class="page invoice-page" id="invoice-page">
  <div class="inner">

    <!-- Top Header -->
    ${buildReportHeaderHtml({
      title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
      subtitle: `${invHeader} • FAMILY PACKAGE`,
      meta: `${invTag} • ${invoiceNumber} • Business Reg. ASV-FJ-2026`
    })}

    <!-- Invoice Details & Client Information -->
    <div class="info-grid">
      <!-- Invoice Box -->
      <div class="info-box">
        <div class="info-box-title">Family Package Details</div>
        <div class="info-box-body">
          <div class="info-row">
            <span class="info-label">Invoice No:</span>
            <span class="info-value">${escapeHtml(invoiceNumber)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Family Group Ref:</span>
            <span class="info-value">${escapeHtml(familyGroupRef)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">${createdDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value"><span class="badge-paid">PAID & VERIFIED</span></span>
          </div>
        </div>
      </div>

      <!-- Client Box -->
      <div class="info-box">
        <div class="info-box-title">Billed To (Family Contact)</div>
        <div class="info-box-body">
          <div class="info-row">
            <span class="info-label">Primary Contact:</span>
            <span class="info-value">${escapeHtml(primary?.userName) || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${escapeHtml(primary?.userEmail) || '-'}</span>
          </div>
          <div class="info-row span2">
            <span class="info-label">Family Members (${memberCount}):</span>
            <span class="info-value" style="font-size: 10px; color: var(--maroon);">${memberNamesDisplay}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Verification Strip -->
    <div class="payment-strip">
      <div class="pay-cell">
        <span class="pay-icon">&#10003;</span>
        <div><strong>Payment Method:</strong> ${paymentMethodDisplay}</div>
      </div>
      <div class="pay-cell">
        <span class="pay-icon">#</span>
        <div><strong>Family Txn Ref:</strong> ${escapeHtml(primary?.paymentReference) || '-'}</div>
      </div>
      <div class="pay-cell">
        <span class="pay-icon">$</span>
        <div><strong>Currency:</strong> ${currency} (${memberCount} certified reports)</div>
      </div>
    </div>

    <!-- Itemized Services Table -->
    <div class="table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="center" style="width: 26px;">#</th>
            <th>Member Service Description</th>
            <th class="center" style="width: 80px;">Person</th>
            <th class="center" style="width: 70px;">Language</th>
            <th class="center" style="width: 32px;">Qty</th>
            <th class="right" style="width: 85px;">Unit Price</th>
            <th class="right" style="width: 85px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Summary & Totals -->
    <div class="summary-section">
      <div class="terms-box">
        <div class="terms-title">Family Delivery &amp; Fulfillment Terms</div>
        <ul>
          <li><strong>Consolidated Delivery:</strong> All ${memberCount} certified family reports attached and dispatched directly in one unified email.</li>
          <li><strong>Digital Archive:</strong> Delivered directly to registered family email (${escapeHtml(primary?.userEmail) || '-'}).</li>
          <li><strong>Support:</strong> astrosivam.com &bull; admin@astrosivam.com</li>
        </ul>
      </div>

      <div class="totals-box">
        <div class="totals-box-title">Combined Payment Summary</div>
        <div class="totals-body">
          <div class="totals-row">
            <span>Package Subtotal (${memberCount} Items):</span>
            <span>${currencySymbol}${totalAmountVal}</span>
          </div>
          <div class="totals-row">
            <span>Tax / VAT (0%):</span>
            <span>${currencySymbol}0.00</span>
          </div>
          <div class="totals-row grand-total">
            <span>Total Paid (Combined):</span>
            <span>${currencySymbol}${totalAmountVal}</span>
          </div>
          <div class="totals-row balance">
            <span>Balance Due:</span>
            <span>${currencySymbol}0.00 (PAID)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Declaration & Seal -->
    <div class="declaration-and-seal">
      <div class="declaration-box">
        <div class="terms-title" style="margin-bottom: 0.5mm;">Family Package Declaration</div>
        <p>This is a consolidated official tax invoice issued electronically for the ASTRO SIVAM family package (${memberCount} reports). It certifies that the total payment of ${currencySymbol}${totalAmountVal} was received in full and all member reports have been issued.</p>
      </div>

      <div class="seal-section">
        <div class="seal-badge">
          <div class="seal-circle">&#9775;</div>
          <div class="seal-text">
            <strong>ASTRO SIVAM OFFICIAL DIGITAL SEAL</strong>
            <span>Authorized Family Astrological Consultation</span>
          </div>
        </div>
        <div class="auth-sign">
          <div class="sign-title">For ASTRO SIVAM</div>
          <div class="sign-role">Authorized Signatory</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span class="brand-footer">ASTRO SIVAM - CONSOLIDATED FAMILY TAX INVOICE</span>
      <span class="brand-sub">astrosivam.com &bull; admin@astrosivam.com</span>
      <span style="font-weight: 700;">Page 1 / 1</span>
    </div>

  </div>
</div>

</body>
</html>`;
}
