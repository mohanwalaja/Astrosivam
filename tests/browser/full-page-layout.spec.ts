import { test, expect, type Frame, type Page } from '@playwright/test';
import { calculatePrecisionHoroscope } from '../../src/lib/astrology/astronomy';
import { calculateWeddingCompatibility } from '../../src/lib/astrology/matchmaking';
import { calculateBabyNamingDetails } from '../../src/lib/astrology/babynames';
import { buildJathagamHtml } from '../../src/services/jathagamHtmlBuilder';
import { buildWeddingMatchHtml } from '../../src/services/weddingHtmlBuilder';
import { buildBabyNamingHtml } from '../../src/services/babyNamingHtmlBuilder';
import { buildMuhurthamHtml } from '../../src/services/muhurthamHtmlBuilder';
import { buildInvoiceHtml, buildFamilyInvoiceHtml } from '../../src/services/invoiceHtmlBuilder';
import type { AppLanguage } from '../../src/lib/astrology/types';
import { routeReportFonts } from '../../scripts/report-fonts.mjs';

/**
 * Full-page contract (see REPORT_AND_INVOICE_FULL_PAGE_LAYOUT.md).
 *
 * Every sheet of every report and the invoice must be covered from the header
 * to the footer band: no half-empty page, no blank band inside a page, and no
 * page that grows past one A4 sheet (which would be clipped to the sheet when
 * the capture is placed into the PDF). The rule is enforced by measuring the
 * real layout with the shipped Noto faces, because "filled" is a measurement.
 */

// The report's real typefaces, served from the repository's shipped fonts
// (see scripts/report-fonts.mjs) - 'filled to the footer' is only meaningful
// when the sheet is painted in the faces the customer's PDF will use.

const MM = 96 / 25.4;
/** Half a millimetre of tolerance for sub-pixel rounding at 96 dpi. */
const TOL = 0.5;

const horoscope = calculatePrecisionHoroscope(
  'Fiji Native', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M'
);
const wedding = calculateWeddingCompatibility({
  brideName: 'Anitha Devi',
  groomName: 'Rajan Kumar',
  bride: { dob: '1995-06-14', tob: '06:45', birthPlace: 'Nadi, Fiji', latitude: -17.79, longitude: 177.95, timezoneOffsetHours: 12 },
  groom: { dob: '1993-02-09', tob: '18:20', birthPlace: 'Suva, Fiji', latitude: -18.14, longitude: 178.44, timezoneOffsetHours: 12 }
} as any);
const baby = calculateBabyNamingDetails(
  'Aarav', '2024-03-10', '08:45', 'Suva', 'M', -18.1416, 178.4419, 12, 'Fiji'
);

function muhurthamMonth(index: number) {
  const names = ['November 2026', 'December 2026', 'January 2027', 'February 2027', 'March 2027', 'April 2027'];
  return {
    monthKey: `m${index}`,
    month: (10 + index) % 12 + 1,
    year: 2026 + Math.floor((10 + index) / 12),
    monthNameEn: names[index], monthNameTa: names[index], monthNameHi: names[index],
    days: [
      { date: '2026-11-05', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Dwitiya', nakshatraNameEn: 'Rohini', grade: 'BEST', nallaNeram: [{ start: '09:00 AM', end: '10:00 AM' }] },
      { date: '2026-11-12', dayOfWeekNameEn: 'Thursday', tithiNameEn: 'Shukla Navami', nakshatraNameEn: 'Hasta', grade: 'GOOD', nallaNeram: [{ start: '10:00 AM', end: '11:00 AM' }] },
      { date: '2026-11-18', dayOfWeekNameEn: 'Wednesday', tithiNameEn: 'Krishna Chaturthi', nakshatraNameEn: 'Moola', grade: 'FAIR' },
      { date: '2026-11-24', dayOfWeekNameEn: 'Tuesday', tithiNameEn: 'Krishna Dashami', nakshatraNameEn: 'Swati', grade: 'AVOID' }
    ],
    bestCount: 1, goodCount: 1, fairCount: 1, avoidCount: 1
  };
}
const muhurthamSparse = {
  devoteeName: 'Muhurtham Layout Test', dob: '1990-01-01', tob: '08:00', birthPlace: 'Suva', country: 'Fiji',
  eventKey: 'wedding', eventTitleEn: 'Wedding (Vivaha Muhurtham)', months: [muhurthamMonth(0)]
};
const muhurthamFull = { ...muhurthamSparse, months: Array.from({ length: 6 }, (_, i) => muhurthamMonth(i)) };

const invoiceOrder = (over: Record<string, unknown> = {}) => ({
  id: 'ord-1', orderNumber: 'LAYOUT-1001', userId: 'u1', userName: 'Client Name', userEmail: 'client@example.com',
  userMobile: '+679 999 8888', serviceType: 'MARRIAGE_COMPATIBILITY', language: 'en', country: 'Fiji',
  currency: 'FJD', amount: 45, serviceMode: 'PAID', paymentMethod: 'GPAY', paymentReference: 'PAY-1',
  status: 'PAID', emailStatus: 'SENT', emailDeliveryAttempts: 1, inputPayload: {}, hasPdf: true,
  createdAt: new Date('2026-10-02T09:00:00Z').toISOString(), ...over
}) as any;

/**
 * `contentSized` lists the sheets that are height:auto BY CONTRACT and therefore
 * must NOT be stretched to fill the A4. Birth Jathagam page 3 (Short Summary)
 * is no longer one of them: fitJathagamSummaryText enlarges type so the sheet
 * is filled, and the care card is the growing block that absorbs leftover
 * millimetres.
 */
const DOCUMENTS: Array<{ name: string; pages: number; html: (lang: AppLanguage) => string; contentSized?: string[] }> = [
  { name: 'Birth Jathagam', pages: 3, html: lang => buildJathagamHtml(horoscope as any, lang) },
  { name: 'Marriage Matching', pages: 2, html: lang => buildWeddingMatchHtml(wedding as any, lang, { orderNumber: 'LAYOUT-1001' }) },
  { name: 'Baby Naming', pages: 2, html: lang => buildBabyNamingHtml(baby as any, lang) },
  // The sparse month is the difficult case: a full six-month calendar is already
  // dense enough to fill the sheet, a two-date month is the one that used to
  // leave half the paper empty.
  { name: 'Muhurtham (sparse)', pages: 2, html: lang => buildMuhurthamHtml(muhurthamSparse as any, lang) },
  { name: 'Muhurtham (six months)', pages: 2, html: lang => buildMuhurthamHtml(muhurthamFull as any, lang) },
  { name: 'Tax invoice', pages: 1, html: () => buildInvoiceHtml(invoiceOrder()) },
  {
    name: 'Family invoice', pages: 1,
    html: () => buildFamilyInvoiceHtml([
      invoiceOrder({ id: 'a', orderNumber: 'LAYOUT-1001', userName: 'Ravi Kumar', serviceType: 'BIRTH_JATHAGAM', amount: 33.5, groupOrderIndex: 0 }),
      invoiceOrder({ id: 'b', orderNumber: 'LAYOUT-1002', userName: 'Priya', serviceType: 'BABY_NAMING', amount: 44.25, groupOrderIndex: 1 }),
      invoiceOrder({ id: 'c', orderNumber: 'LAYOUT-1003', userName: 'Kamal', serviceType: 'MUHURTHAM', amount: 29, groupOrderIndex: 2 })
    ], 'FAM-LAYOUT-1')
  }
];

async function preparePage(page: Page) {
  await routeReportFonts(page);
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'
  }));
  await page.goto('/');
  await page.evaluate(() => {
    document.body.innerHTML = '<iframe id="report" style="width:794px;height:1200px;border:0"></iframe>';
  });
}

async function openReport(page: Page, html: string): Promise<Frame> {
  await page.evaluate(async source => {
    const fontsPath = '/src/services/reportFonts.ts';
    const { ensureReportFonts } = await import(fontsPath);
    const { fitJathagamLifeCardText, fitJathagamSummaryText } = await import('/src/services/jathagamLifeCardLayout.ts');
    const frame = document.getElementById('report') as HTMLIFrameElement;
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    (window as any).reportHtml = source;
    frame.srcdoc = source;
    await loaded;
    await ensureReportFonts(frame.contentDocument);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (frame.contentDocument) {
      fitJathagamLifeCardText(frame.contentDocument);
      fitJathagamSummaryText(frame.contentDocument);
    }
  }, html);
  return page.frames().find(frame => frame !== page.mainFrame())!;
}

/** Per page: sheet height, the band under the last block, the widest gap between blocks. */
function measurePages(frame: Frame) {
  return frame.evaluate(() => {
    const PXMM = 96 / 25.4;
    return Array.from(document.querySelectorAll<HTMLElement>('.page')).map(page => {
      const rect = page.getBoundingClientRect();
      const style = getComputedStyle(page);
      const inner = (page.querySelector('.inner') || page) as HTMLElement;
      const children = Array.from(inner.children) as HTMLElement[];
      const blocks = children
        .map(child => {
          const box = child.getBoundingClientRect();
          const after = parseFloat(getComputedStyle(child).marginBottom) || 0;
          return { top: box.top - rect.top, bottom: box.bottom - rect.top + after };
        })
        .filter(box => box.bottom - box.top > 1);
      let widestGap = 0;
      for (let i = 1; i < blocks.length; i++) widestGap = Math.max(widestGap, blocks[i].top - blocks[i - 1].bottom);
      const contentBottom = blocks.length ? blocks[blocks.length - 1].bottom : 0;
      const trailing = rect.height - parseFloat(style.paddingBottom) - contentBottom;
      return {
        id: page.id || '(unnamed page)',
        heightMm: rect.height / PXMM,
        scrollMm: page.scrollHeight / PXMM,
        trailingMm: trailing / PXMM,
        widestGapMm: widestGap / PXMM
      };
    });
  });
}

for (const language of ['en', 'ta', 'hi'] as const) {
  for (const doc of DOCUMENTS) {
    test(`${doc.name} (${language}): every sheet is filled and stays one page`, async ({ page }) => {
      test.skip(language !== 'en' && doc.name.includes('nvoice'), 'tax invoices are English only');
      await page.setViewportSize({ width: 1280, height: 1100 });
      await preparePage(page);
      const frame = await openReport(page, doc.html(language));
      await expect(frame.locator('.page')).toHaveCount(doc.pages);

      const pages = await measurePages(frame);
      for (const sheet of pages) {
        const label = `${doc.name} / ${language} / ${sheet.id}`;
        if (doc.contentSized?.includes(sheet.id)) {
          // Content-sized by contract: it may end early, but it may never grow
          // past the sheet and it may never be clipped.
          expect(sheet.heightMm, `${label} (never taller than A4)`).toBeLessThanOrEqual(297 + TOL);
          expect(sheet.scrollMm, `${label} (nothing clipped)`).toBeLessThanOrEqual(sheet.heightMm + 0.5);
          expect(sheet.heightMm, `${label} (has real content)`).toBeGreaterThan(200);
          continue;
        }
        // (1) at least one full A4 sheet, and never more than one
        expect(sheet.heightMm, label).toBeGreaterThanOrEqual(297 - TOL);
        expect(sheet.scrollMm, label).toBeLessThanOrEqual(297 + 1.5);
        // (2) no leftover band above the footer
        expect(sheet.trailingMm, `${label} (bottom band)`).toBeLessThanOrEqual(2);
        // (3) no blank area inside the page: the gap between two blocks may be
        //     roomy, but never a hole in the middle of the sheet
        expect(sheet.widestGapMm, `${label} (widest gap)`).toBeLessThanOrEqual(10);
      }
    });
  }
}
