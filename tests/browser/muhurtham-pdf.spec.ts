import { test, expect, type Page } from '@playwright/test';
import type { AppLanguage } from '../../src/types';

// Avoid CDN / font-download races in the regression test. The app already
// ships these Indic and Latin fonts. Plus Jakarta Sans is aliased to the
// bundled Latin face here; the important thing is that all three documents
// (parent, report iframe, capture clone) use identical loaded faces.
const fontCss = [
  ['Plus Jakarta Sans', 'NotoSans'],
  ['Noto Sans', 'NotoSans'],
  ['Noto Sans Tamil', 'NotoSansTamil'],
  ['Noto Sans Devanagari', 'NotoSansDevanagari'],
  ['Cinzel', 'Cinzel'],
  ['Baloo Thambi 2', 'BalooThambi2'],
  ['Yatra One', 'YatraOne']
].flatMap(([family, file]) => {
  const faces = file === 'YatraOne' ? [[400, 'Regular']]
    : ['Cinzel', 'BalooThambi2'].includes(file) ? [[600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']]
    : [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']];
  return faces.map(([weight, suffix]) =>
    `@font-face { font-family:'${family}'; font-style:normal; font-weight:${weight}; src:url('http://127.0.0.1:4173/fonts/${file}-${suffix}.ttf') format('truetype'); }`
  );
}).join('\n');

function sampleResult(daysPerMonth = 4) {
  return {
    devoteeName: 'Muhurtham PDF regression', dob: '1991-06-18', tob: '06:30',
    birthPlace: 'Walajapet, Tamil Nadu', country: 'India', eventKey: 'wedding',
    months: Array.from({ length: 6 }, (_, monthIndex) => ({
      monthKey: `2027-0${monthIndex + 1}`, month: monthIndex + 1, year: 2027,
      monthNameEn: `Month ${monthIndex + 1} 2027`,
      monthNameTa: `மாதம் ${monthIndex + 1} 2027`, monthNameHi: `माह ${monthIndex + 1} 2027`,
      goodCount: daysPerMonth / 2, bestCount: daysPerMonth / 2, fairCount: 0, avoidCount: 0,
      days: Array.from({ length: daysPerMonth }, (_, dayIndex) => ({
        date: `2027-0${monthIndex + 1}-${String(dayIndex + 3).padStart(2, '0')}`,
        dayOfWeekNameEn: 'Wednesday', dayOfWeekNameTa: 'புதன்கிழமை', dayOfWeekNameHi: 'बुधवार',
        nakshatraNameEn: 'Purva Ashadha', nakshatraNameTa: 'பூராடம்', nakshatraNameHi: 'पूर्वाषाढ़ा',
        grade: dayIndex % 2 ? 'BEST' : 'GOOD',
        nallaNeram: [
          { start: '10:15 AM', end: '11:52 AM' },
          { start: '10:20 AM', end: '1:37 PM' },
          { start: '10:25 AM', end: '1:44 PM' }
        ]
      }))
    }))
  };
}

async function openReport(page: Page, language: AppLanguage, daysPerMonth = 4, result?: ReturnType<typeof sampleResult>) {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: fontCss }));
  // Test the real Tailwind preflight, without starting the app / database / API.
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'
  }));
  await page.goto('/');
  await page.evaluate(async ({ result, language }) => {
    const cssPath = '/src/index.css';
    const builderPath = '/src/services/muhurthamHtmlBuilder.ts';
    const fontsPath = '/src/services/reportFonts.ts';
    await import(cssPath);
    const { buildMuhurthamHtml } = await import(builderPath);
    const { ensureReportFonts } = await import(fontsPath);
    document.body.innerHTML = '<img id="site-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="1" height="1">'
      + '<iframe id="report" style="position:absolute;left:0;top:0;width:794px;height:2305px;border:0"></iframe>';
    const frame = document.getElementById('report') as HTMLIFrameElement;
    (window as any).reportHtml = buildMuhurthamHtml(result, language);
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    frame.srcdoc = (window as any).reportHtml;
    await loaded;
    await ensureReportFonts(frame.contentDocument);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, { result: result ?? sampleResult(daysPerMonth), language });
  await expect(page.locator('#site-image')).toHaveCSS('display', 'block');
  return page.frames().find(frame => frame !== page.mainFrame())!;
}

for (const language of ['en', 'ta', 'hi'] as const) {
  for (const mode of [
    { name: 'live desktop preview', width: 1280, fromHtml: false },
    { name: 'live mobile preview', width: 390, fromHtml: false },
    { name: 'mobile HTML / email export', width: 390, fromHtml: true }
  ]) {
    test(`${language}: full row glyphs survive the ${mode.name} PDF export`, async ({ page }) => {
      // Read native browser-painted text before exporting. A wider viewport is
      // needed for reference screenshots of the rightmost A4 column; then
      // restore the actual mobile / desktop viewport for the capture itself.
      await page.setViewportSize({ width: 1280, height: 900 });
      const frame = await openReport(page, language);
      const references = [];
      for (const selector of ['.date-cell', '.primary-star', '.time-text', '.grade-pill', '.muhurtham-selection-notes h2']) {
        const element = selector.startsWith('.muhurtham-selection-notes')
          ? frame.locator(selector) : frame.locator(`.date-row ${selector}`).nth(1);
        const geometry = await element.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const page = el.closest('.page')!.getBoundingClientRect();
          const color = getComputedStyle(el.querySelector('.date-num') || el).color;
          return { x: rect.x - page.x, y: rect.y - page.y, width: rect.width, height: rect.height, color,
            pageIndex: Array.from(document.querySelectorAll('.page')).indexOf(el.closest('.page')!) };
        });
        references.push({ selector, geometry, png: (await element.screenshot()).toString('base64') });
      }
      await page.setViewportSize({ width: mode.width, height: 900 });

      const captured = await page.evaluate(async ({ fromHtml }) => {
        const exporterPath = '/src/services/jathagamPdfExporter.ts';
        const exporter = await import(exporterPath);
        const frame = document.getElementById('report') as HTMLIFrameElement;
        const pages = Array.from(frame.contentDocument!.querySelectorAll<HTMLElement>('.page'));
        const pdf = fromHtml
          ? await exporter.renderHtmlToPdfDoc((window as any).reportHtml, { scale: 2.5, jpegQuality: 0.95 })
          : await exporter.renderPageElementsToPdfDoc(pages, { scale: 2.5, jpegQuality: 0.95 });
        // Inspect the image actually embedded in the PDF, not a separate canvas.
        const images = Object.values((pdf.internal as any).collections.addImage_images) as any[];
        return { pageCount: pdf.getNumberOfPages(), jpegs: images.map(image => btoa(image.data)), width: images[0].width, height: images[0].height };
      }, { fromHtml: mode.fromHtml });
      expect(captured.pageCount).toBe(2);
      expect(captured.width).toBeGreaterThan(1900);

      const comparisons = await page.evaluate(async ({ references, captured }) => {
        const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
        });
        const jpegs = await Promise.all(captured.jpegs.map(jpeg => loadImage(`data:image/jpeg;base64,${jpeg}`)));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const results = [];
        for (const reference of references) {
          const native = await loadImage(`data:image/png;base64,${reference.png}`);
          canvas.width = native.width; canvas.height = native.height;
          const color = reference.geometry.color.match(/\d+/g)!.map(Number);
          const ink = () => {
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0, top = canvas.height, bottom = -1, sumY = 0;
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                if (Math.abs(pixels[index] - color[0]) < 45 && Math.abs(pixels[index + 1] - color[1]) < 45 && Math.abs(pixels[index + 2] - color[2]) < 45) {
                  count++; top = Math.min(top, y); bottom = Math.max(bottom, y); sumY += y;
                }
              }
            }
            return { count, height: bottom - top + 1, center: count ? sumY / count : -1 };
          };
          ctx.drawImage(native, 0, 0);
          const previewInk = ink();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { x, y, width, height } = reference.geometry;
          // A4 is 210mm / 297mm at 96 CSS dpi; capture dimensions are rounded.
          const scale = captured.width / (210 * 96 / 25.4);
          ctx.drawImage(jpegs[reference.geometry.pageIndex], x * scale, y * scale, width * scale, height * scale, 0, 0, canvas.width, canvas.height);
          results.push({ selector: reference.selector, previewInk, pdfInk: ink() });
        }
        return results;
      }, { references, captured });
      for (const result of comparisons) {
        expect(result.previewInk.count, `${result.selector}: reference text must be present`).toBeGreaterThan(10);
        expect(result.pdfInk.height / result.previewInk.height, `${result.selector}: not a half-height text run`).toBeGreaterThan(0.75);
        expect(result.pdfInk.count / result.previewInk.count, `${result.selector}: all glyph strokes survive`).toBeGreaterThan(0.65);
        expect(Math.abs(result.pdfInk.center - result.previewInk.center), `${result.selector}: matching baseline`).toBeLessThan(6);
      }
      await expect(page.locator('style[data-astrosivam-capture="font-metrics"]')).toHaveCount(0);
      await expect(page.locator('iframe[data-astrosivam-capture="report"]')).toHaveCount(0);
      await expect(page.locator('#site-image')).toHaveCSS('display', 'block');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 7, 24)');
    });
  }

  test(`${language}: 60 dates and the explanations fit inside two A4 pages`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const frame = await openReport(page, language, 10);
    await expect(frame.locator('.page')).toHaveCount(2);
    await expect(frame.locator('.date-row:not(.row-empty-month)')).toHaveCount(60);
    await expect(frame.locator('.muhurtham-selection-notes')).toHaveCount(1);
    const bounds = await frame.evaluate(() => {
      const notes = document.querySelector('.muhurtham-selection-notes')!.getBoundingClientRect();
      const page = document.querySelector('.page:last-of-type')!.getBoundingClientRect();
      const rows = Array.from(document.querySelectorAll('.date-row')).map(row => {
        const panel = row.closest('.table-panel')!.getBoundingClientRect();
        const rect = row.getBoundingClientRect();
        return { bottom: rect.bottom, panelBottom: panel.bottom };
      });
      return { notesTop: notes.top, notesBottom: notes.bottom, pageMidpoint: page.top + page.height / 2, pageBottom: page.bottom, rows };
    });
    expect(bounds.notesTop, 'Guide starts in the lower half of page 2').toBeGreaterThanOrEqual(bounds.pageMidpoint);
    expect(bounds.notesBottom).toBeLessThan(bounds.pageBottom);
    for (const row of bounds.rows) expect(row.bottom).toBeLessThanOrEqual(row.panelBottom + 1);
    await expect(frame.locator('.muhurtham-selection-notes')).not.toContainText('undefined');
  });

  test(`${language}: the guide stays in the lower half when every date fits on page 1`, async ({ page }) => {
    const frame = await openReport(page, language, 2);
    await expect(frame.locator('.page')).toHaveCount(2);
    await expect(frame.locator('.date-row:not(.row-empty-month)')).toHaveCount(12);
    await expect(frame.locator('.page').last().locator('.date-row')).toHaveCount(0);
    const bounds = await frame.evaluate(() => {
      const notes = document.querySelector('.muhurtham-selection-notes')!.getBoundingClientRect();
      const page = document.querySelector('.page:last-of-type')!.getBoundingClientRect();
      return { top: notes.top, bottom: notes.bottom, midpoint: page.top + page.height / 2, pageBottom: page.bottom };
    });
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.midpoint);
    expect(bounds.bottom).toBeLessThan(bounds.pageBottom);
  });
}

test('ta: the lower half of page 2 is one larger-type explanation and still fits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Same crowded data as the page-2 capacity test: a long continuation table
  // still has to leave room for an enlarged explanation underneath it.
  const result: any = sampleResult(6);
  result.persons = [{
    role: 'devotee', nakshatraIndex: 0, nakshatraNameEn: 'Pooram', nakshatraNameTa: 'பூரம்',
    taraNameEn: 'Sampath', taraNameTa: 'சம்பத்', isTaraAuspicious: true, isChandrashtama: false
  }];
  for (const month of result.months) {
    month.days.forEach((day: any, dayIndex: number) => {
      if (dayIndex % 3 === 0) {
        day.personalChecks = [{
          role: 'devotee', nakshatraNameEn: 'Pooram', nakshatraNameTa: 'பூரம்',
          taraNameEn: 'Sampath', taraNameTa: 'சம்பத்', isTaraAuspicious: true, isChandrashtama: false
        }];
      }
    });
  }
  const frame = await openReport(page, 'ta', 6, result);
  await expect(frame.locator('.page')).toHaveCount(2);
  const metrics = await frame.evaluate(() => {
    const guide = document.querySelector<HTMLElement>('.muhurtham-selection-notes')!;
    const pageEl = guide.closest('.page')!;
    const pageRect = pageEl.getBoundingClientRect();
    const guideRect = guide.getBoundingClientRect();
    const cs = (el: Element) => getComputedStyle(el);
    return {
      pageIndex: Array.from(document.querySelectorAll('.page')).indexOf(pageEl),
      guideSize: cs(guide).fontSize,
      guideH2Size: cs(guide.querySelector('h2')!).fontSize,
      guideStrongSize: cs(guide.querySelector('strong')!).fontSize,
      panelRemoved: document.querySelectorAll('.personal-days, .personal-chip').length === 0,
      guideTop: guideRect.top - pageRect.top,
      guideBottom: guideRect.bottom - pageRect.top,
      pageHeight: pageRect.height
    };
  });
  expect(metrics.pageIndex).toBe(1);
  // The panel the customer asked us to remove must not come back through any code path.
  expect(metrics.panelRemoved).toBe(true);
  // Real reading type: the explanation is now far larger than the date tables.
  expect(metrics.guideSize).toBe('14.4px');
  expect(metrics.guideH2Size).toBe('16.5px');
  expect(metrics.guideStrongSize).toBe('15px');
  expect(metrics.guideTop, 'Explanation starts in the lower half of page 2')
    .toBeGreaterThanOrEqual(metrics.pageHeight / 2);
  expect(metrics.guideBottom, 'Explanation still fits above the page bottom')
    .toBeLessThan(metrics.pageHeight);
  await frame.locator('.page').nth(1).screenshot({ path: 'muhurtham_preview_p2_month.png' });
});

test('Failed canvas encoding restores font probes and removes the temporary report frame', async ({ page }) => {
  await openReport(page, 'ta');
  const error = await page.evaluate(async () => {
    const exporterPath = '/src/services/jathagamPdfExporter.ts';
    const { renderHtmlToPdfDoc } = await import(exporterPath);
    const encode = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('Simulated canvas memory limit'); };
    try {
      await renderHtmlToPdfDoc((window as any).reportHtml);
      return '';
    } catch (error) {
      return (error as Error).message;
    } finally {
      HTMLCanvasElement.prototype.toDataURL = encode;
    }
  });
  expect(error).toContain('Simulated canvas memory limit');
  await expect(page.locator('style[data-astrosivam-capture="font-metrics"]')).toHaveCount(0);
  await expect(page.locator('iframe[data-astrosivam-capture="report"]')).toHaveCount(0);
  await expect(page.locator('#site-image')).toHaveCSS('display', 'block');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 7, 24)');
});

test('The shared isolated HTML exporter still renders the other reports and invoices', async ({ page }) => {
  await openReport(page, 'en');
  const results = await page.evaluate(async () => {
    const load = (path: string) => import(path);
    const { calculatePrecisionHoroscope } = await load('/server/astrology/astronomy.ts');
    const { calculateBabyNamingDetails } = await load('/server/astrology/babynames.ts');
    const { calculateWeddingCompatibility } = await load('/server/astrology/matchmaking.ts');
    const { buildJathagamHtml } = await load('/src/services/jathagamHtmlBuilder.ts');
    const { buildBabyNamingHtml } = await load('/src/services/babyNamingHtmlBuilder.ts');
    const { buildWeddingMatchHtml } = await load('/src/services/weddingHtmlBuilder.ts');
    const { buildInvoiceHtml, buildFamilyInvoiceHtml } = await load('/src/services/invoiceHtmlBuilder.ts');
    const { renderHtmlToPdfDoc } = await load('/src/services/jathagamPdfExporter.ts');
    const horoscope = calculatePrecisionHoroscope('PDF Test', '2000-01-01', '12:00', 'Suva', -18.1416, 178.4419, 12, 'Fiji', 'M');
    const baby = calculateBabyNamingDetails('Baby Test', '2024-03-10', '08:45', 'Suva', 'M', -18.1416, 178.4419, 12, 'Fiji');
    const wedding = calculateWeddingCompatibility(
      { name: 'Bride Test', dob: '1995-05-15', tob: '10:30', birthPlace: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5 },
      { name: 'Groom Test', dob: '1993-08-20', tob: '14:15', birthPlace: 'Coimbatore', latitude: 11.0168, longitude: 76.9558, timezoneOffsetHours: 5.5 }
    );
    const order = {
      id: 'pdf-test', orderNumber: 'PDF-TEST-1', createdAt: '2026-09-30T00:00:00Z',
      serviceType: 'BIRTH_JATHAGAM', amount: 35, currency: 'FJD', language: 'en',
      userName: 'PDF Test', userEmail: 'test@example.com', inputPayload: { name: 'PDF Test' }
    };
    const reports = [
      ['Jathagam', buildJathagamHtml(horoscope, 'ta'), 3],
      ['Baby Naming', buildBabyNamingHtml(baby, 'hi'), 2],
      ['Marriage Matching', buildWeddingMatchHtml(wedding, 'en'), 2], // Includes the existing disclaimer page.
      ['Invoice', buildInvoiceHtml(order), 1],
      ['Family Invoice', buildFamilyInvoiceHtml([order], 'PDF-TEST-FAMILY'), 1]
    ];
    const rendered = [];
    for (const [name, html, expectedPages] of reports) {
      const pdf = await renderHtmlToPdfDoc(html, { scale: 2, jpegQuality: 0.92 });
      rendered.push({ name, expectedPages, pages: pdf.getNumberOfPages(), bytes: pdf.output('arraybuffer').byteLength });
    }
    return rendered;
  });
  for (const result of results) {
    expect(result.pages, String(result.name)).toBe(result.expectedPages);
    expect(result.bytes, `${result.name}: nonblank PDF`).toBeGreaterThan(25000);
  }
  await expect(page.locator('style[data-astrosivam-capture="font-metrics"]')).toHaveCount(0);
  await expect(page.locator('iframe[data-astrosivam-capture="report"]')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 7, 24)');
});
