import { SUN_EMBLEM_MARKUP } from './logoData';

export interface ReportHeaderOptions {
  /** Main heading; defaults to the shared official-report brand line. */
  title?: string;
  /** Service/document subtitle. Plain text; it is escaped before insertion. */
  subtitle: string;
  /** Optional small line below the common contact details. Plain text. */
  meta?: string;
  /** Contact line. Defaults to the common ASTRO SIVAM contact details. */
  contact?: string;
}

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Shared centred brand lockup, based on the Baby Naming certificate header.
 * All dynamic copy is plain text and escaped here; callers should not pass HTML.
 */
export function buildReportHeaderHtml({
  title = 'ASTRO SIVAM - OFFICIAL VEDIC REPORT',
  subtitle,
  meta,
  contact = 'astrosivam.com • admin@astrosivam.com'
}: ReportHeaderOptions): string {
  const optionalMeta = meta?.trim()
    ? `<div class="header-meta">${escapeHtml(meta.trim())}</div>`
    : '';

  return `
    <header class="header">
      ${SUN_EMBLEM_MARKUP}
      <div class="header-text">
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">${escapeHtml(subtitle)}</div>
        <div class="contact-line">${escapeHtml(contact)}</div>
        ${optionalMeta}
      </div>
    </header>
    <div class="modern-divider"></div>
  `;
}

/**
 * The common report heading treatment used by Birth Jathagam, Marriage
 * Matching, Muhurtham and both invoice layouts. Keep the brand lockup stable
 * while allowing each document to choose its existing display face.
 */
export function reportHeaderCss(headerFont: string): string {
  return `
  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6mm;
    margin-bottom: 2mm;
    text-align: center;
    flex-shrink: 0;
  }
  .header .header-logo {
    margin: 0;
    width: 72px;
    height: 72px;
    display: block;
    flex-shrink: 0;
  }
  .header .header-logo .header-logo-mark {
    display: block;
    width: 100%;
    height: 100%;
  }
  .header .header-text {
    flex: 0 1 auto;
    text-align: center;
    min-width: 0;
  }
  .header h1 {
    font-family: ${headerFont};
    font-size: clamp(17px, 2.7vw, 22px);
    font-weight: 800;
    color: #7d1233;
    line-height: 1.2;
    letter-spacing: 0.5px;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .header .subtitle {
    font-size: clamp(11.5px, 1.75vw, 14px);
    color: #0b7a5a;
    margin-top: 0.4mm;
    font-weight: 700;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .header .contact-line {
    font-size: 10.5px;
    color: #64748b;
    margin-top: 0.4mm;
    font-weight: 600;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .header .header-meta {
    font-size: 9px;
    color: #64748b;
    margin-top: 0.4mm;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .modern-divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, #7d1233, #a85a14, #7d1233, transparent);
    margin: 0.8mm 0 2.5mm;
    flex-shrink: 0;
  }
  `;
}
