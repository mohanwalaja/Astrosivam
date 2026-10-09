import { test, expect, type Frame, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculatePrecisionHoroscope } from '../../server/astrology/astronomy';
import { buildJathagamHtml } from '../../src/services/jathagamHtmlBuilder';
import { classifyJathagamPlanetsForSummary } from '../../src/services/jathagamPlanetSummary';
import { assertReportFontsLoaded, routeReportFonts } from '../../scripts/report-fonts.mjs';

/**
 * Birth Jathagam page 3 (Short Summary): one A4 sheet, three languages, the
 * three required cases.
 *
 *   a) normal   — Priya Devi, a chart flagging four grahas (full table)
 *   b) long text — 60+ character name and a long place name
 *   c) maximum  — all nine grahas needing care: the compact table
 *
 * The page must stay exactly one sheet, keep the 10.5px readability floor, never
 * clip text, never hide a flagged graha, and print nothing outside the page box.
 * Page 1 must retain its A4 fit with the paired-chart redesign; page 2 must
 * remain unchanged.
 *
 * Each case also writes a screenshot of all three sheets into
 * tmp/screenshots/ so a reviewer can see every page, language and case
 * (tmp/ is git-ignored; those PNGs are review artifacts, not fixtures).
 */
// The report's real typefaces, served from the repository's shipped fonts
// (see scripts/report-fonts.mjs). Without them Tamil and Devanagari paint as
// tofu boxes and every measurement would describe the wrong layout.

const normal = calculatePrecisionHoroscope('Priya Devi', '1998-06-15', '06:30', 'Chennai, Tamil Nadu, India', 13.0827, 80.2707, 5.5, 'India', 'F');
const longName = calculatePrecisionHoroscope(
  'Lakshminarayanan Subramanian Venkatesan Ramanathan Chidambaranathan',
  '1979-11-23', '04:15', 'Thiruvananthapuram, Kerala State, India (Thampanoor Junction)',
  8.5241, 76.9366, 5.5, 'India', 'M'
);
/** Every graha in the 12th house: the compact-table worst case. */
const allNine = { ...normal, planetPositions: normal.planetPositions.map(p => ({ ...p, bhavaNumber: 12 })) };

const cases = [
  { name: 'normal', chart: normal, compact: false },
  { name: 'long text', chart: longName, compact: true },
  { name: 'all nine needing care', chart: allNine, compact: true }
] as const;

/** tmp/screenshots/normal-en-p1.png ... one per page, language and case. */
const SHOT_DIR = resolve(process.cwd(), 'tmp', 'screenshots');
const caseSlug = (name: string) => name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

async function openReport(page: Page, html: string): Promise<Frame> {
  await routeReportFonts(page);
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'
  }));
  await page.goto('/');
  await page.evaluate(async html => {
    await import('/src/index.css');
    const { ensureReportFonts } = await import('/src/services/reportFonts.ts');
    document.body.innerHTML = '<iframe id="report" style="width:794px;height:3400px;border:0"></iframe>';
    const frame = document.getElementById('report') as HTMLIFrameElement;
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    frame.srcdoc = html;
    await loaded;
    await ensureReportFonts(frame.contentDocument);
    await document.fonts.ready;
    const view = frame.contentWindow as Window & typeof globalThis;
    await view.document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const { fitJathagamSummaryText } = await import('/src/services/jathagamLifeCardLayout.ts');
    if (frame.contentDocument) fitJathagamSummaryText(frame.contentDocument);
  }, html);
  const reportFrame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  // Every script the report prints must have its real face: without it the
  // browser paints .notdef boxes and the screenshots would be unreadable.
  await assertReportFontsLoaded(reportFrame);
  return reportFrame;
}

for (const language of ['en', 'ta', 'hi'] as const) {
  for (const testCase of cases) {
    test(`${language}: ${testCase.name} stays on one page-3 sheet`, async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 1200 });
      const frame = await openReport(page, buildJathagamHtml(testCase.chart, language));

      // Exactly three sheets, in order, with the real "x / 3" label each.
      await expect(frame.locator('.page')).toHaveCount(3);
      const labels = await frame.locator('.footer-page').allTextContents();
      expect(labels).toHaveLength(3);
      expect(labels[0]).toMatch(/1\s*\/\s*3/);
      expect(labels[1]).toMatch(/2\s*\/\s*3/);
      expect(labels[2]).toMatch(/3\s*\/\s*3/);

      const measured = await frame.evaluate(() => {
        const page3 = document.getElementById('jathagam-page-3')! as HTMLElement;
        const page1 = document.getElementById('jathagam-page-1')! as HTMLElement;
        const page2 = document.getElementById('jathagam-page-2')! as HTMLElement;
        const bounds = page3.getBoundingClientRect();

        // A4 height at 96dpi; the page box is 297mm tall and must not grow past
        // the 1123px sheet (280mm content + padding).
        const a4Px = (297 / 25.4) * 96;

        const textNodes: HTMLElement[] = [];
        for (const el of [page3, ...Array.from(page3.querySelectorAll<HTMLElement>('*'))] as HTMLElement[]) {
          if (el.children.length === 0 && (el.textContent || '').trim().length > 0) textNodes.push(el);
        }
        let minFont = Infinity;
        const outside: string[] = [];
        const clipped: string[] = [];
        for (const el of textNodes) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          minFont = Math.min(minFont, size);
          const r = el.getBoundingClientRect();
          if (r.left < bounds.left - 0.5 || r.right > bounds.right + 0.5 || r.bottom > bounds.bottom + 0.5) {
            outside.push(`${el.className || el.tagName}: ${el.textContent!.slice(0, 24)}`);
          }
          if (el.scrollWidth > el.clientWidth + 1) clipped.push(`${el.className || el.tagName}: ${el.textContent!.slice(0, 24)}`);
        }

        // No two text boxes may overlap.
        const boxes = textNodes.map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(box => box.r.width > 0 && box.r.height > 0);
        const overlaps: string[] = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el)) continue;
            const a = boxes[i].r;
            const b = boxes[j].r;
            const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (overlapX > 1 && overlapY > 1) {
              overlaps.push(`${boxes[i].el.textContent!.slice(0, 16)} / ${boxes[j].el.textContent!.slice(0, 16)}`);
            }
          }
        }

        const careRows = page3.querySelectorAll('table.care-table tbody tr').length;
        const compact = page3.classList.contains('is-compact');
        const hasOldRemedies = /Remedies for Indicators|remedy-block/.test(page3.innerHTML);
        const scale = parseFloat(page3.style.getPropertyValue('--summary-scale') || '1');
        return {
          height: bounds.height,
          a4Px,
          minFont,
          outside: outside.slice(0, 6),
          clipped: clipped.slice(0, 6),
          overlaps: overlaps.slice(0, 6),
          careRows,
          compact,
          hasOldRemedies,
          scale,
          pages12UnchangedBoxes: {
            p1: { w: page1.getBoundingClientRect().width, h: page1.getBoundingClientRect().height },
            p2: { w: page2.getBoundingClientRect().width, h: page2.getBoundingClientRect().height }
          }
        };
      });

      expect(measured.hasOldRemedies, 'the removed remedies section is not on page 3').toBe(false);
      expect(measured.clipped, 'no text is clipped horizontally').toEqual([]);
      expect(measured.outside, 'nothing is printed outside the page box').toEqual([]);
      expect(measured.overlaps, 'no two text boxes overlap').toEqual([]);
      expect(measured.minFont, 'never below the 10.5px readability floor').toBeGreaterThanOrEqual(10.5);
      expect(measured.height, 'page 3 stays inside one A4 sheet').toBeLessThanOrEqual(measured.a4Px + 1);
      if (testCase.name === 'normal') {
        expect(measured.scale, 'normal chart enlarges type to fill empty space').toBeGreaterThan(1.05);
      }
      const classified = classifyJathagamPlanetsForSummary(testCase.chart as never, language);
      expect(measured.compact, `${language}/${testCase.name}: compact mode`).toBe(classified.compact);

      // Every graha the shared rule flags must be on the page, with a remedy.
      expect(measured.careRows).toBe(classified.needsCare.length);
      for (const planet of classified.needsCare) {
        await expect(frame.locator('#jathagam-page-3 table.care-table')).toContainText(
          planet.compactLine.split(' · ')[0].slice(0, 12)
        );
      }
      if (testCase.name === 'all nine needing care') {
        expect(classified.needsCare).toHaveLength(9);
      }

      // Review artifacts: every page of this case and language, as rendered.
      mkdirSync(SHOT_DIR, { recursive: true });
      for (const sheet of [1, 2, 3]) {
        await frame.locator(`#jathagam-page-${sheet}`).screenshot({
          path: resolve(SHOT_DIR, `summary-${caseSlug(testCase.name)}-${language}-p${sheet}.png`)
        });
      }
    });
  }
}

test('page 3 keeps the four labelled remedy lines in the normal case', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 });
  const frame = await openReport(page, buildJathagamHtml(normal, 'en'));
  const page3 = frame.locator('#jathagam-page-3');
  await expect(page3).toContainText('Worship');
  await expect(page3).toContainText('Lamp');
  await expect(page3).toContainText('Donation');
  await expect(page3).toContainText('Mantra');
  await expect(page3).toContainText('Your Details');
  await expect(page3).toContainText('Planets Supporting You');
  await expect(page3).toContainText('Planets Needing Extra Care');
  await expect(page3).toContainText('In Short');
  await expect(page3).toContainText('No planet is "bad"');
});

test('page 1 shows paired Rasi/Navamsa charts while page 2 retains its prior layout', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 });
  const frame = await openReport(page, buildJathagamHtml(normal, 'en'));

  const page1 = frame.locator('#jathagam-page-1');
  const chartCards = page1.locator('.chart-section > .chart-box');
  await expect(chartCards).toHaveCount(2);
  await expect(chartCards.nth(0)).toContainText('Rasi Chart (Chakra)');
  await expect(chartCards.nth(1)).toContainText('Navamsa Chart (D9)');
  await expect(page1).not.toContainText('Planetary Positions');
  await expect(page1).not.toContainText('Vimshottari Dasha (Mahadasha)');
  await expect(page1).not.toContainText('Current Dasa');
  const rasiBox = await chartCards.nth(0).boundingBox();
  const navamsaBox = await chartCards.nth(1).boundingBox();
  expect(rasiBox).not.toBeNull();
  expect(navamsaBox).not.toBeNull();
  expect(rasiBox!.x + rasiBox!.width, 'Rasi chart is to the left of Navamsa').toBeLessThanOrEqual(navamsaBox!.x + 1);

  // Keep the previous page-2 fingerprint and verify that the shorter page 1
  // still fits its A4 sheet without shrinking the chart pair.
  const measured = await frame.evaluate(() => {
    const fit = (window as unknown as { fitPageToA4?: (el: HTMLElement) => void }).fitPageToA4;
    if (typeof fit === 'function') {
      document.querySelectorAll<HTMLElement>('.page').forEach(el => fit(el));
    }
    const el = document.getElementById('jathagam-page-2')!;
    const clean = el.outerHTML
      .replace(/\s*<span class="footer-page">[^<]*<\/span>/, '')
      .replace(/ style="font-size: [\d.]+px;"/g, '')
      .replace(/<div class="page" id="([^"]+)"[^>]*>/, '<div class="page" id="$1">')
      .replace(/<div class="inner"[^>]*>/, '<div class="inner">')
      .replace(/>\s+</g, '><')
      .trim();
    const page1 = document.getElementById('jathagam-page-1')!;
    const page1Inner = page1.querySelector('.inner') as HTMLElement;
    const page1Match = /scale\(([\d.]+)\)/.exec(page1Inner.style.transform);
    return {
      page2: clean,
      page1Scale: page1Match ? Number(page1Match[1]) : 1,
      page2Height: el.getBoundingClientRect().height
    };
  });

  const baseline = JSON.parse(readFileSync(new URL('../fixtures/jathagam-page12-baseline.json', import.meta.url), 'utf8'));
  const expected = baseline['normal|en'];
  const cleanBaseline = (html: string) =>
    html
      .replace(/ style="font-size: [\d.]+px;"/g, '')
      .replace(/<div class="page" id="([^"]+)"[^>]*>/, '<div class="page" id="$1">')
      .replace(/<div class="inner"[^>]*>/, '<div class="inner">');
  expect(measured.page2).toBe(cleanBaseline(expected.page2.html));

  // Page 1 used to require shrinking for its extra tables. Removing those
  // tables must not make the chart pair smaller, while page 2 must not grow.
  const previousPage1Scale = Number(/scale\(([\d.]+)\)/.exec(String((expected.page1 as { scale: unknown }).scale))?.[1] ?? 1);
  expect(measured.page1Scale, 'page 1 fitted scale does not shrink').toBeGreaterThanOrEqual(previousPage1Scale * 0.995);
  expect(measured.page2Height, 'page 2 does not grow').toBeLessThanOrEqual(expected.page2.height * 1.01);
});
