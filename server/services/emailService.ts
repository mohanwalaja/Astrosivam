import nodemailer from 'nodemailer';
import { db, Order, EmailConfig } from '../db/store';
import { getLogoEmailAttachment, ASTRO_LOGO_CID } from '../astrology/logoBase64.js';
import {
  BatchableAttachment,
  mimeEncodedSize,
  planAttachmentBatches,
  resolveMaxAttachmentEncodedBytes
} from './attachmentBatching.js';

/**
 * Minimal mailer seam. nodemailer's own transporter type is overloaded
 * (promise + callback forms), so a narrow promise-only shape keeps the override
 * parameter strongly typed for tests and automation.
 */
export interface MailTransportLike {
  sendMail(options: any): Promise<any>;
}

/**
 * nodemailer requires a Buffer (or string) for attachment content; the batching
 * layer may hand back a plain Uint8Array, so normalise before sending.
 */
function toMailAttachment(attachment: BatchableAttachment): {
  filename: string;
  content: Buffer;
  contentType?: string;
} {
  return {
    filename: attachment.filename,
    content: Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content),
    contentType: attachment.contentType
  };
}

export interface EmailDispatchResult {
  success: boolean;
  message: string;
  messageId?: string;
  sentAt?: string;
  attachments: Array<{ filename: string; sizeKb: number }>;
  /** How many separate emails the bundle was split across (1 = single message). */
  partCount?: number;
  /** Files that alone exceeded the per-message budget and shipped alone. */
  oversizeFiles?: string[];
  /** Raw byte total of the attachments (pre-base64). */
  totalAttachmentBytes?: number;
}

/**
 * Build a nodemailer transporter based on current system email settings
 */
export function getMailTransporter(config?: EmailConfig): ReturnType<typeof nodemailer.createTransport> | null {
  const emailSettings = config || db.getSettings().emailSettings;

  const host = process.env.SMTP_HOST?.trim() || emailSettings?.smtpHost?.trim();
  const port = Number(process.env.SMTP_PORT || emailSettings?.smtpPort || 587);
  const user = process.env.SMTP_USER?.trim() || emailSettings?.smtpUsername?.trim();
  const storedPassword = String(emailSettings?.smtpPassword || '').trim();
  const isPlaceholderPassword = /[•]/.test(storedPassword) || /^\*{4,}$/.test(storedPassword);
  const pass = process.env.SMTP_PASS?.trim() || (isPlaceholderPassword ? '' : storedPassword);
  const envSecure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = envSecure === 'true' || envSecure === '1'
    ? true
    : envSecure === 'false' || envSecure === '0'
      ? false
      : (emailSettings?.tlsSecure ?? (port === 465));

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      // On submission ports (e.g. 587), fail closed rather than sending SMTP
      // credentials over a connection that did not negotiate STARTTLS.
      requireTLS: !secure,
      auth: {
        user,
        pass,
      },
      // Verify the SMTP certificate and hostname before sending credentials
      // or sensitive report attachments.
      tls: {
        rejectUnauthorized: true,
      },
    });
  }

  return null;
}

/**
 * Format service type into a clean, human-readable name
 */
function formatServiceName(serviceType: string): string {
  switch (serviceType) {
    case 'BIRTH_JATHAGAM':
      return 'Birth Jathagam (Horoscope Reading)';
    case 'MARRIAGE_COMPATIBILITY':
      return 'Marriage Compatibility (Jathagam Porutham)';
    case 'BABY_NAMING':
      return 'Baby Naming Certificate (Vetha Naamakaranam)';
    case 'MUHURTHAM':
      return 'Subha Muhurtham Dates (6-Month Calendar)';
    default:
      return serviceType.replace(/_/g, ' ');
  }
}

/**
 * Send the official Report PDF and Tax Invoice Bill PDF directly to the user upon Admin Approval.
 * Strict Directive:
 * - Both the Report PDF and the Invoice Bill PDF are directly attached to the email.
 * - No server download links are included in the email body, as documents are not stored on host servers.
 * - Delivery of these attached PDFs marks the order as COMPLETED.
 */
export async function sendOrderApprovalEmail(
  order: Order,
  reportPdfBuffer: Buffer,
  reportFileName: string,
  invoicePdfBuffer: Buffer,
  invoiceFileName: string
): Promise<EmailDispatchResult> {
  const settings = db.getSettings();
  const emailSettings = settings.emailSettings;
  const senderName = emailSettings?.senderName || 'ASTRO SIVAM - Vedic Services';
  const senderEmail = emailSettings?.senderEmail || 'admin@astrosivam.com';
  const fromHeader = `"${senderName}" <${senderEmail}>`;
  const replyTo = emailSettings?.replyTo || senderEmail;

  const serviceName = formatServiceName(order.serviceType);
  const subject = `ASTRO SIVAM: Your Official Vedic Astrology Report & Tax Invoice - ${order.orderNumber}`;

  const reportSizeKb = (reportPdfBuffer.length / 1024).toFixed(1);
  const invoiceSizeKb = (invoicePdfBuffer.length / 1024).toFixed(1);

  // Plain Text Body (No download links; both files attached directly)
  const textBody = `Namaste ${order.userName},

Your order (${order.orderNumber}) for ${serviceName} has been approved by the Administrator and is now COMPLETED.

Your certified astrological report and official tax invoice bill are attached directly to this email as PDF files:
  1. ${reportFileName} (${reportSizeKb} KB) - Official Astrological Report
  2. ${invoiceFileName} (${invoiceSizeKb} KB) - Official Tax Invoice & Payment Receipt

IMPORTANT STORAGE NOTICE:
To protect your privacy and sensitive birth chart coordinates, documents are not retained permanently on public web servers. No download link is needed—both PDF files are attached directly above. Please download and save both PDF files to your computer, mobile device, or personal backup immediately.

Order Summary:
• Order Number: ${order.orderNumber}
• Service: ${serviceName}
• Status: COMPLETED
• Amount: ${order.currency} ${order.amount.toFixed(2)}
• Payment Method: ${order.paymentMethod}
• Reference: ${order.paymentReference || 'N/A'}
• Date of Fulfillment: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

Thank you for choosing ASTRO SIVAM. May the divine cosmic alignments and Navagraha blessings bring auspiciousness, health, and prosperity to your life.

Warm regards,
ASTRO SIVAM Astrology Desk & Vedic Scholars
Support: admin@astrosivam.com | Fiji Islands & International
`;

  // Rich, elegant, responsive HTML email (No download links; highlights attached PDFs)
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width:620px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #f59e0b;">
              <img src="cid:${ASTRO_LOGO_CID}" alt="ASTRO SIVAM" width="64" height="64" style="width:64px; height:64px; border-radius:50%; border:2px solid #f59e0b; display:block; margin:0 auto 12px;" />
              <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase; margin-bottom: 4px;">
                ASTRO SIVAM
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase;">
                Certified Vedic Astrology & Nirayana Ephemeris
              </div>
              <div style="margin-top: 16px;">
                <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                  ✓ ORDER APPROVED & COMPLETED
                </span>
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h1 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                Namaste ${escapeHtml(order.userName)},
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                We are pleased to inform you that your astrological service order has been reviewed and <strong>approved by the Administrator</strong>. Your official report and tax invoice bill have been prepared and are <strong>attached directly to this email as PDF files</strong>.
              </p>

              <!-- Attached Documents Box -->
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                  📎 Attached PDF Documents (Ready to Save):
                </div>

                <!-- Item 1: Report PDF -->
                <table role="presentation" width="100%" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:10px;">
                  <tr>
                    <td width="36" valign="middle" style="font-size: 24px; padding-right: 12px;">📄</td>
                    <td valign="middle">
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
                        ${escapeHtml(reportFileName)}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Official ${escapeHtml(serviceName)} • Size: ${reportSizeKb} KB
                      </div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block; font-size:11px; font-weight:700; color:#059669; background-color:#ecfdf5; border:1px solid #a7f3d0; padding:3px 8px; border-radius:6px;">
                        Attached
                      </span>
                    </td>
                  </tr>
                </table>

                <!-- Item 2: Invoice PDF -->
                <table role="presentation" width="100%" style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                  <tr>
                    <td width="36" valign="middle" style="font-size: 24px; padding-right: 12px;">🧾</td>
                    <td valign="middle">
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
                        ${escapeHtml(invoiceFileName)}
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        Official Tax Invoice & Receipt • Size: ${invoiceSizeKb} KB
                      </div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block; font-size:11px; font-weight:700; color:#059669; background-color:#ecfdf5; border:1px solid #a7f3d0; padding:3px 8px; border-radius:6px;">
                        Attached
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Crucial Notice (No download link required) -->
              <div style="background-color: #fefce8; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #854d0e; margin-bottom: 4px;">
                  🔒 Privacy & Storage Notice:
                </div>
                <div style="font-size: 12px; line-height: 1.5; color: #713f12;">
                  Because personal astrological charts and invoices are <strong>not retained on our web server</strong> for storage and privacy reasons, no web download link is needed. Your documents are attached directly to this email. Please download and save both PDF files to your device or local storage now.
                </div>
              </div>

              <!-- Order Summary Table -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                  Order Details
                </div>
                <table role="presentation" width="100%" style="font-size: 12px; color: #334155; line-height: 1.8;">
                  <tr>
                    <td style="color:#64748b; width:40%;">Order Number:</td>
                    <td style="font-weight:700; color:#0f172a;">${escapeHtml(order.orderNumber)}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Service:</td>
                    <td style="font-weight:600;">${escapeHtml(serviceName)}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Order Status:</td>
                    <td><span style="color:#059669; font-weight:700;">COMPLETED</span></td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Total Amount:</td>
                    <td style="font-weight:700; color:#0f172a;">${order.currency} ${order.amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Payment Method:</td>
                    <td>${escapeHtml(order.paymentMethod)} ${order.paymentReference ? `(Ref: ${escapeHtml(order.paymentReference)})` : ''}</td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #475569;">
                May the planetary energies and Navagraha blessings illuminate your journey with wisdom, prosperity, and peace.
              </p>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">ASTRO SIVAM Astrology Desk</div>
                <div style="font-size: 11px; color: #64748b;">India Sanskrit Scholars & ASTRO SIVAM Consulting Board</div>
                <div style="font-size: 11px; color: #64748b;">Email: <a href="mailto:admin@astrosivam.com" style="color:#f59e0b; text-decoration:none;">admin@astrosivam.com</a></div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This is an official automated fulfillment email from ASTRO SIVAM.<br />
                © ${new Date().getFullYear()} ASTRO SIVAM. All rights reserved. Precision Vedic Horoscopes & Consultations.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const attachments = [
    {
      filename: reportFileName,
      content: reportPdfBuffer,
      contentType: 'application/pdf',
    },
    {
      filename: invoiceFileName,
      content: invoicePdfBuffer,
      contentType: 'application/pdf',
    },
  ];

  // The brand logo is embedded as an inline (cid:) image rather than linked
  // from the website: remote images are blocked by default in Gmail, Outlook
  // and Apple Mail, which is why the logo appeared missing in delivered mail.
  const logoAttachment = getLogoEmailAttachment();
  const mailAttachments = logoAttachment ? [...attachments, logoAttachment] : attachments;

  let sentAt: string | undefined;
  let messageId: string | undefined;
  let realEmailDispatched = false;
  let dispatchFailure = 'SMTP is not configured; no email was sent.';

  const transporter = getMailTransporter(emailSettings);
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromHeader,
        to: order.userEmail,
        replyTo,
        subject,
        text: textBody,
        html: htmlBody,
        attachments: mailAttachments,
      });
      messageId = info.messageId || undefined;
      sentAt = new Date().toISOString();
      realEmailDispatched = true;
      console.log(`[SMTP] Approval email accepted by the configured transport (MessageId: ${messageId || 'not provided'}).`);
    } catch (smtpErr: any) {
      dispatchFailure = 'SMTP delivery failed; no completion email was sent. Check the server mail logs and retry.';
      console.warn(`[SMTP Warning] Approval email delivery failed: ${smtpErr?.message || 'unknown SMTP error'}.`);
    }
  } else {
    console.warn('[Email Dispatcher] SMTP is not configured; no approval email was sent.');
  }

  const deliveryMessage = realEmailDispatched
    ? `Report PDF (${reportSizeKb} KB) and Invoice PDF (${invoiceSizeKb} KB) accepted by the SMTP transport.`
    : dispatchFailure;

  return {
    success: realEmailDispatched,
    message: deliveryMessage,
    ...(messageId ? { messageId } : {}),
    ...(sentAt ? { sentAt } : {}),
    attachments: [
      { filename: reportFileName, sizeKb: parseFloat(reportSizeKb) },
      { filename: invoiceFileName, sizeKb: parseFloat(invoiceSizeKb) },
    ],
  };
}

/**
 * Send the unified Family Package email with every family chart and the tax
 * invoice. When the document set exceeds the configured per-message attachment
 * budget the delivery is split across several emails; the parts share a subject
 * prefix and the invoice always travels with the final part.
 */
export async function sendFamilyOrderApprovalEmail(
  orders: Order[],
  reports: Array<{ order: Order; pdfBuffer: Buffer; fileName: string }>,
  invoicePdfBuffer: Buffer,
  invoiceFileName: string,
  recipientEmailOverride?: string,
  /**
   * Test/automation seam: pass a transporter to bypass SMTP configuration.
   * `undefined` uses the configured transport, `null` forces "not configured".
   */
  transporterOverride?: MailTransportLike | null
): Promise<EmailDispatchResult> {
  if (!orders || orders.length === 0) {
    throw new Error('No orders provided for family email dispatch');
  }

  const primaryOrder = orders[0];
  const targetRecipient = recipientEmailOverride || primaryOrder.userEmail;
  const settings = db.getSettings();
  const emailSettings = settings.emailSettings;
  const senderName = emailSettings?.senderName || 'ASTRO SIVAM - Vedic Services';
  const senderEmail = emailSettings?.senderEmail || 'admin@astrosivam.com';
  const fromHeader = `"${senderName}" <${senderEmail}>`;
  const replyTo = emailSettings?.replyTo || senderEmail;

  const groupId = primaryOrder.groupId || `GRP-${primaryOrder.orderNumber}`;
  const currency = primaryOrder.currency || 'FJD';
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const paymentRef = primaryOrder.paymentReference || 'ADM-VERIFIED';

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const attachmentSummary: Array<{ filename: string; sizeKb: number }> = [];

  // Inline brand logo (cid:) so it renders without the recipient allowing
  // remote images. Kept out of `attachments` so the "N PDF files" copy that is
  // rendered into the email body stays accurate.
  const logoAttachment = getLogoEmailAttachment();

  // Add all report PDFs
  reports.forEach((rep, idx) => {
    const sizeKb = parseFloat((rep.pdfBuffer.length / 1024).toFixed(1));
    attachments.push({
      filename: rep.fileName,
      content: rep.pdfBuffer,
      contentType: 'application/pdf'
    });
    attachmentSummary.push({
      filename: rep.fileName,
      sizeKb
    });
  });

  // Add the unified family invoice PDF
  const invoiceSizeKb = parseFloat((invoicePdfBuffer.length / 1024).toFixed(1));
  attachments.push({
    filename: invoiceFileName,
    content: invoicePdfBuffer,
    contentType: 'application/pdf'
  });
  attachmentSummary.push({
    filename: invoiceFileName,
    sizeKb: invoiceSizeKb
  });

  // SMTP budget: reserve room for the inline logo, MIME headers and the HTML
  // body before packing the PDFs. This keeps each complete email below the
  // configured transport budget instead of filling it with PDFs alone.
  const maxEncodedBytes = resolveMaxAttachmentEncodedBytes();
  const nonPdfReserveBytes = (logoAttachment ? mimeEncodedSize(logoAttachment.content.length) : 0) + 128 * 1024;
  const pdfAttachmentBudget = Math.max(512 * 1024, maxEncodedBytes - nonPdfReserveBytes);
  const plan = planAttachmentBatches(attachments, pdfAttachmentBudget);
  const parts: BatchableAttachment[][] = plan.batches.length > 0 ? plan.batches : [[]];
  const totalParts = parts.length;
  const splitDelivery = totalParts > 1;
  const baseSubject = `ASTRO SIVAM: Family Package Vedic Astrology Reports & Tax Invoice (${orders.length} Charts) - ${groupId}`;

  const buildPartBodies = (
    partAttachments: BatchableAttachment[],
    partIndex: number
  ): { subject: string; textBody: string; htmlBody: string } => {
  const partSummary = partAttachments.map(att => ({
    filename: att.filename,
    sizeKb: parseFloat(((att.content?.length || 0) / 1024).toFixed(1))
  }));
  const partFileCount = partAttachments.length;
  const partLabel = splitDelivery
    ? ` This is email ${partIndex + 1} of ${totalParts}; every part is sent separately because the full document set exceeds our mail provider's per-message size limit.`
    : '';
  const subject = splitDelivery
    ? `${baseSubject} (Part ${partIndex + 1} of ${totalParts})`
    : baseSubject;

  // Plain Text Body
  const textMemberList = orders.map((o, i) => {
    const devotee = o.inputPayload?.name || o.userName || `Family Member #${i + 1}`;
    const sName = formatServiceName(o.serviceType);
    return `  ${i + 1}. ${devotee} - ${sName} (Order Ref: #${o.orderNumber})`;
  }).join('\n');

  const textAttachmentList = partSummary.map((att, i) => `  ${i + 1}. ${att.filename} (${att.sizeKb} KB)`).join('\n');

  const textBody = `Namaste ${primaryOrder.userName},

Your Family Order Bundle (${groupId}) with ${orders.length} Astrological Charts has been verified and approved by the ASTRO SIVAM Administrator and is now COMPLETED.

All ${orders.length} astrological reports and your official combined family tax invoice are attached directly to this email as PDF documents:${partLabel}

FAMILY MEMBERS IN THIS BUNDLE:
${textMemberList}

ATTACHED PDF DOCUMENTS IN THIS EMAIL:
${textAttachmentList}

FAMILY BUNDLE FINANCIAL SUMMARY:
• Family Group ID: ${groupId}
• Total Family Members: ${orders.length} Charts
• Total Amount Paid: ${currency} ${totalAmount.toFixed(2)}
• Payment Method: ${primaryOrder.paymentMethod}
• Payment Reference: ${paymentRef}
• Date of Fulfillment: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}

IMPORTANT STORAGE NOTICE:
To protect your family's personal privacy and sensitive birth chart data, documents are not retained permanently on public web servers. No download links are required—all ${partFileCount} PDF files in this email are attached directly. Please download and save all attached files to your personal computer, tablet, or phone immediately.

Thank you for choosing ASTRO SIVAM for your family's auspicious astrology guidance. May the divine cosmic alignments and Navagraha blessings bring auspiciousness, harmony, health, and prosperity to your entire family.

Warm regards,
ASTRO SIVAM Astrology Desk & Vedic Scholars
Support: admin@astrosivam.com | Fiji Islands & International
`;

  // Rich HTML Body
  const htmlMemberRows = orders.map((o, i) => {
    const devotee = escapeHtml(o.inputPayload?.name || o.userName || `Member #${i + 1}`);
    const sName = formatServiceName(o.serviceType);
    const dob = o.inputPayload?.dob || 'N/A';
    const rawBirthPlace = String(o.inputPayload?.birthPlace || '').trim().replace(/[,\\s]+$/, '');
    const rawBirthCountry = String(o.inputPayload?.country || '').trim().replace(/[,\\s]+$/, '');
    const placeTail = rawBirthPlace.split(',').map(part => part.trim()).filter(Boolean).pop() || '';
    const birthPlaceLabel = !rawBirthPlace
      ? rawBirthCountry || 'Not provided'
      : !rawBirthCountry || placeTail.toLowerCase().includes(rawBirthCountry.toLowerCase())
        ? rawBirthPlace
        : `${rawBirthPlace}, ${rawBirthCountry}`;
    const place = escapeHtml(birthPlaceLabel);
    const orderNum = o.orderNumber || o.id;
    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 10px; font-weight: 700; color: #0f172a; font-size: 13px;">
          ${i + 1}. ${devotee}
          <div style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px;">
            DOB: ${dob} | Place: ${place}
          </div>
        </td>
        <td style="padding: 12px 10px; color: #b45309; font-size: 12px; font-weight: 600;">
          ${sName}
        </td>
        <td style="padding: 12px 10px; text-align: right; font-family: monospace; font-size: 11px; color: #475569;">
          #${orderNum}
        </td>
      </tr>
    `;
  }).join('');

  const htmlAttachmentCards = partSummary.map((att, i) => `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
      <div style="font-size: 12px; font-weight: 600; color: #1e293b;">
        📄 ${escapeHtml(att.filename)}
      </div>
      <div style="font-size: 11px; color: #64748b; font-family: monospace;">
        ${att.sizeKb} KB
      </div>
    </div>
  `).join('');

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f172a; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width:640px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.3);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: center; border-bottom: 3px solid #f59e0b;">
              <img src="cid:${ASTRO_LOGO_CID}" alt="ASTRO SIVAM" width="64" height="64" style="width:64px; height:64px; border-radius:50%; border:2px solid #f59e0b; display:block; margin:0 auto 12px;" />
              <div style="font-size: 26px; font-weight: 800; letter-spacing: 2px; color: #f59e0b; text-transform: uppercase; margin-bottom: 4px;">
                ASTRO SIVAM
              </div>
              <div style="font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase;">
                Certified Vedic Astrology & Family Consultation
              </div>
              <div style="margin-top: 16px;">
                <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 6px 16px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                  👨‍👩‍👧‍👦 FAMILY PACKAGE COMPLETED (${orders.length} CHARTS)
                </span>
              </div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">
                Namaste ${escapeHtml(primaryOrder.userName)},
              </h1>
              
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                Your Family Astrology Package (<strong style="color:#0f172a;">${groupId}</strong>) consisting of <strong>${orders.length} family members&apos; birth charts</strong> has been reviewed and verified by our ASTRO SIVAM scholars.
              </p>

              <!-- Family Bundle Summary Card -->
              <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #854d0e; letter-spacing: 1px; margin-bottom: 12px;">
                  👨‍👩‍👧‍👦 Unified Family Order Overview
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                  <tr>
                    <td style="padding: 4px 0; color: #713f12;">Group Reference:</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: 700; font-family: monospace; color: #854d0e;">${groupId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #713f12;">Total Family Charts:</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: 700; color: #0f172a;">${orders.length} Members</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #713f12;">Payment Method:</td>
                    <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #0f172a;">${primaryOrder.paymentMethod}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #713f12;">Transaction Reference:</td>
                    <td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: 700; color: #b45309;">${paymentRef}</td>
                  </tr>
                  <tr style="border-top: 1px solid #fde047;">
                    <td style="padding: 8px 0 0; font-weight: 700; color: #854d0e; font-size: 14px;">Total Amount Paid:</td>
                    <td style="padding: 8px 0 0; text-align: right; font-weight: 800; color: #166534; font-size: 15px;">${currency} ${totalAmount.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              <!-- Members Table -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">
                  Included Family Charts in this Package:
                </div>
                <table width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                      <th style="padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">Member / User</th>
                      <th style="padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">Service Type</th>
                      <th style="padding: 10px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b;">Order Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${htmlMemberRows}
                  </tbody>
                </table>
              </div>

              <!-- Attachments Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 12px;">
                  📎 Attached PDF Documents in this Email (${partFileCount} Files${splitDelivery ? ` — Part ${partIndex + 1} of ${totalParts}` : ''}):
                </div>
                ${htmlAttachmentCards}
              </div>

              <!-- Storage Notice -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  🔒 DIRECT EMAIL ATTACHMENT NOTICE
                </div>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #475569;">
                  To protect your family&apos;s personal privacy, astrological records are not stored permanently on public web hosts. All ${partFileCount} PDFs in this email are directly attached above${splitDelivery ? ` (part ${partIndex + 1} of ${totalParts} — the remaining parts arrive in separate emails with the same subject)` : ''}. Please download and back up these PDF files to your computer or phone now.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #475569;">
                May the planetary energies and Navagraha blessings illuminate your entire family with peace, health, harmony, and prosperity.
              </p>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">ASTRO SIVAM Astrology Desk</div>
                <div style="font-size: 11px; color: #64748b;">India Sanskrit Scholars & ASTRO SIVAM Consulting Board</div>
                <div style="font-size: 11px; color: #64748b;">Email: <a href="mailto:admin@astrosivam.com" style="color:#f59e0b; text-decoration:none;">admin@astrosivam.com</a></div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                This is an official automated fulfillment email for Family Order Bundle ${groupId} from ASTRO SIVAM.<br />
                © ${new Date().getFullYear()} ASTRO SIVAM. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, textBody, htmlBody };
  };

  let sentAt: string | undefined;
  let messageId: string | undefined;
  let realEmailDispatched = false;
  const sentParts: number[] = [];
  const failedParts: number[] = [];
  let dispatchFailure = 'SMTP is not configured; no family email was sent.';

  const transporter = transporterOverride === undefined ? getMailTransporter(emailSettings) : transporterOverride;
  if (transporter) {
    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const partAttachments = parts[partIndex];
      const bodies = buildPartBodies(partAttachments, partIndex);
      try {
        const info = await transporter.sendMail({
          from: fromHeader,
          to: targetRecipient,
          replyTo,
          subject: bodies.subject,
          text: bodies.textBody,
          html: bodies.htmlBody,
          attachments: logoAttachment
            ? [...partAttachments.map(toMailAttachment), logoAttachment]
            : partAttachments.map(toMailAttachment)
        });
        sentParts.push(partIndex + 1);
        if (!messageId && info.messageId) messageId = info.messageId;
        sentAt = new Date().toISOString();
        realEmailDispatched = true;
        console.log(
          `[SMTP] Family email part ${partIndex + 1}/${totalParts} accepted by the configured transport ` +
          `(MessageId: ${info.messageId || 'not provided'}).`
        );
      } catch (smtpErr: any) {
        failedParts.push(partIndex + 1);
        console.warn(
          `[SMTP Warning] Family email part ${partIndex + 1}/${totalParts} delivery failed: ${smtpErr?.message || 'unknown SMTP error'}.`
        );
      }
    }

    if (sentParts.length === 0) {
      dispatchFailure = 'SMTP delivery failed; no family email was sent. Check the server mail logs and retry.';
    } else if (failedParts.length > 0) {
      dispatchFailure = `Family email was only partially delivered: part(s) ${sentParts.join(', ')} were accepted but part(s) ${failedParts.join(', ')} failed. Retry the resend action to complete delivery.`;
    }
  } else {
    console.warn('[Email Dispatcher] SMTP is not configured; no family email was sent.');
  }

  const splitNote = splitDelivery
    ? ` Delivered in ${totalParts} emails so no message exceeded the ${Math.round(maxEncodedBytes / 1048576)} MB attachment budget.`
    : '';
  const oversizeNote = plan.oversizeFiles.length > 0
    ? ` WARNING: ${plan.oversizeFiles.join(', ')} exceeds the per-message budget on its own; consider re-rendering it at a smaller size.`
    : '';
  const partialDelivery = realEmailDispatched && failedParts.length > 0;

  const deliveryMessage = realEmailDispatched
    ? (partialDelivery
        ? dispatchFailure
        : `The family email with ${orders.length} reports and invoice was accepted by the SMTP transport.${splitNote}`)
    : dispatchFailure;

  return {
    success: realEmailDispatched && !partialDelivery,
    message: `${deliveryMessage}${oversizeNote ? oversizeNote.trim() : ''}`.trim(),
    ...(messageId ? { messageId } : {}),
    ...(sentAt ? { sentAt } : {}),
    attachments: attachmentSummary,
    partCount: totalParts,
    ...(plan.oversizeFiles.length > 0 ? { oversizeFiles: plan.oversizeFiles } : {}),
    totalAttachmentBytes: plan.totalBytes
  };
}

/** Send a short-lived registration code only through configured, authenticated SMTP. */
export async function sendRegistrationOtpEmail(toEmail: string, toName: string, otp: string): Promise<boolean> {
  const settings = db.getSettings();
  const emailSettings = settings.emailSettings;
  const transporter = getMailTransporter(emailSettings);
  if (!transporter) return false;

  const senderName = String(emailSettings?.senderName || 'ASTRO SIVAM Website').replace(/[\r\n]+/g, ' ').slice(0, 120);
  const senderEmail = String(emailSettings?.senderEmail || 'admin@astrosivam.com').replace(/[\r\n]+/g, '').trim();
  const replyTo = String(emailSettings?.replyTo || senderEmail).replace(/[\r\n]+/g, '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return false;

  const safeName = escapeHtml(String(toName || 'User').slice(0, 120));
  const safeOtp = String(otp || '').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(safeOtp)) return false;

  try {
    const info = await transporter.sendMail({
      from: { name: senderName, address: senderEmail },
      to: toEmail,
      replyTo,
      subject: 'ASTRO SIVAM: Your Email Verification Code',
      text: `Namaste ${String(toName || 'User').slice(0, 120)},\n\nYour ASTRO SIVAM email verification code is ${safeOtp}. It expires in 10 minutes. If you did not request an account, you can ignore this message.`,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937"><div style="max-width:520px;margin:24px auto;border:1px solid #e7d7b5;border-radius:12px;overflow:hidden"><div style="background:#7a1f1f;color:#fff;text-align:center;padding:20px;font-weight:bold">ASTRO SIVAM · Verify Your Email</div><div style="padding:24px;text-align:center;background:#fdf8ed"><p>Namaste ${safeName},</p><p>Use this code to finish creating your account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#7a1f1f;background:#fff;padding:14px;border:2px solid #d99b2b;border-radius:8px">${safeOtp}</p><p style="font-size:13px;color:#64748b">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p></div></div></body></html>`
    });
    return Array.isArray(info?.accepted)
      && info.accepted.some((address: unknown) => String(address).toLowerCase() === toEmail.toLowerCase());
  } catch (error: any) {
    console.warn(`[SMTP Warning] Registration verification email could not be dispatched (${error?.name || 'SMTP error'}).`);
    return false;
  }
}

export interface ContactInquiryDeliveryResult {
  success: boolean;
  recipient: string;
  messageId?: string;
}

/** Send a public contact inquiry only through configured, authenticated SMTP. */
export async function sendContactInquiryEmail(inquiry: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<ContactInquiryDeliveryResult> {
  const settings = db.getSettings();
  const emailSettings = settings.emailSettings;
  const recipient = (process.env.CONTACT_INQUIRY_TO || settings.supportEmail || 'admin@astrosivam.com').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { success: false, recipient: '' };
  }

  const transporter = getMailTransporter(emailSettings);
  if (!transporter) return { success: false, recipient };

  const senderName = String(emailSettings?.senderName || 'ASTRO SIVAM Website').replace(/[\r\n]+/g, ' ').slice(0, 120);
  const senderEmail = String(emailSettings?.senderEmail || 'admin@astrosivam.com').trim();
  const safeName = String(inquiry.name || '').trim().slice(0, 160);
  const safeEmail = String(inquiry.email || '').trim().slice(0, 254);
  const safeSubject = String(inquiry.subject || 'Website inquiry').replace(/[\r\n]+/g, ' ').trim().slice(0, 200) || 'Website inquiry';
  const safeMessage = String(inquiry.message || '').slice(0, 10000);
  const messageHtml = escapeHtml(safeMessage).replace(/\r?\n/g, '<br>');

  try {
    const info = await transporter.sendMail({
      from: { name: senderName, address: senderEmail },
      to: recipient,
      replyTo: safeEmail,
      subject: `[ASTRO SIVAM Contact] ${safeSubject}`,
      text: `Contact inquiry from ${safeName} <${safeEmail}>\n\nSubject: ${safeSubject}\n\n${safeMessage}`,
      html: `<!doctype html><html><body><h2>ASTRO SIVAM website inquiry</h2><p><strong>From:</strong> ${escapeHtml(safeName)} &lt;${escapeHtml(safeEmail)}&gt;</p><p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p><p>${messageHtml}</p></body></html>`
    });
    return { success: true, recipient, ...(info.messageId ? { messageId: info.messageId } : {}) };
  } catch (error: any) {
    console.warn(`[SMTP Warning] Contact inquiry could not be dispatched (${error?.name || 'SMTP error'}).`);
    return { success: false, recipient };
  }
}

/**
 * Helper to escape HTML characters
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
