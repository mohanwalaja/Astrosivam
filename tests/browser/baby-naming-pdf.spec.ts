import { readFileSync } from 'node:fs';
import { test, expect, type Frame, type Page } from '@playwright/test';
import { ALL_NAKSHATRA_LETTERS, calculateBabyNamingDetails } from '../../src/lib/astrology/babynames';
import { buildNamakaranPadaNames } from '../../src/lib/astrology/namakaranNames';
import { buildBabyNamingHtml } from '../../src/services/babyNamingHtmlBuilder';

// Load the bundled faces in the parent, report and capture clone alike.
const fontCss = [
  ['Plus Jakarta Sans', 'NotoSans'], ['Noto Sans', 'NotoSans'],
  ['Noto Sans Tamil', 'NotoSansTamil'], ['Noto Sans Devanagari', 'NotoSansDevanagari'],
  ['Cinzel', 'Cinzel'], ['Baloo Thambi 2', 'BalooThambi2'], ['Yatra One', 'YatraOne']
].flatMap(([family, file]) => {
  const faces: [number, string][] = file === 'YatraOne' ? [[400, 'Regular']]
    : ['Cinzel', 'BalooThambi2'].includes(file) ? [[600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']]
    : [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'Bold']];
  return faces.map(([weight, suffix]) =>
    `@font-face { font-family:'${family}'; font-style:normal; font-weight:${weight}; src:url('http://127.0.0.1:4173/fonts/${file}-${suffix}.ttf') format('truetype'); }`
  );
}).join('\n');

function fixture(starIndex: number, gender: 'M' | 'F', full = false) {
  const star = ALL_NAKSHATRA_LETTERS[starIndex];
  const result = calculateBabyNamingDetails('Baby Layout Test', '2024-03-10', '08:45', 'Suva', gender, -18.1416, 178.4419, 12, 'Fiji');
  result.nakshatraLetters = star;
  result.primaryPadaInfo = star.padas[0];
  result.janmaPada = 1;
  result.nameSuggestions = buildNamakaranPadaNames(star.padas, gender);
  if (full) {
    // Stress the documented cap, beyond the density of today's name bank.
    result.nameSuggestions = result.nameSuggestions.map(column => ({
      ...column,
      south: Array.from({ length: 15 }, (_, i) => ({ name: `Meenakshisundaram${i + 1}`, meaning: 'Guiding light, spiritual guide' })),
      north: Array.from({ length: 15 }, (_, i) => ({ name: `Lakshminarayanan${i + 1}`, meaning: 'Divine blessing and prosperity' }))
    }));
  }
  return result;
}

async function preparePage(page: Page) {
  // Serve the bundled PHP/preview fonts, without relying on an absent public/fonts copy.
  await page.route('**/fonts/*.ttf', route => route.fulfill({
    contentType: 'font/ttf', body: readFileSync(new URL('../../api/astrology/fonts/' + route.request().url().split('/').pop(), import.meta.url))
  }));
  await page.addInitScript(() => { (window as any).process = { env: {} }; });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: fontCss }));
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'
  }));
  await page.goto('/');
  await page.evaluate(async () => {
    const cssPath = '/src/index.css';
    await import(cssPath);
    document.body.innerHTML = '<iframe id="report" style="width:794px;height:2250px;border:0"></iframe>';
  });
}

async function openReport(page: Page, html: string): Promise<Frame> {
  await page.evaluate(async html => {
    const fontsPath = '/src/services/reportFonts.ts';
    const { ensureReportFonts } = await import(fontsPath);
    const frame = document.getElementById('report') as HTMLIFrameElement;
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    (window as any).reportHtml = html;
    frame.srcdoc = html;
    await loaded;
    await ensureReportFonts(frame.contentDocument);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, html);
  return page.frames().find(frame => frame !== page.mainFrame())!;
}

async function layout(frame: Frame) {
  return frame.evaluate(() => {
    const page = document.querySelector<HTMLElement>('#namakaran-page-2')!;
    const pageRect = page.getBoundingClientRect();
    const columns = page.querySelector('.sug-columns')!.getBoundingClientRect();
    const cards = Array.from(page.querySelectorAll<HTMLElement>('.sug-name'));
    const clipped: string[] = [];
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      for (const text of Array.from(card.children)) {
        const range = document.createRange();
        range.selectNodeContents(text);
        const ink = range.getBoundingClientRect();
        if (ink.top < rect.top - 1 || ink.bottom > rect.bottom + 1 || ink.left < rect.left - 1 || ink.right > rect.right + 1) {
          clipped.push(card.textContent!.trim());
        }
      }
    }
    const southHeads = Array.from(page.querySelectorAll('.south-panel .sug-block-head'));
    const northHeads = Array.from(page.querySelectorAll('.north-panel .sug-block-head'));
    return {
      count: cards.length, clipped,
      nameSize: getComputedStyle(cards[0].querySelector('.sug-name-text')!).fontSize,
      meaningSize: getComputedStyle(cards[0].querySelector('.sug-name-meaning')!).fontSize,
      height: pageRect.height, scrollHeight: page.scrollHeight,
      columnHeight: columns.height, columnBottom: columns.bottom,
      lastNameBottom: Math.max(...cards.map(card => card.getBoundingClientRect().bottom)) - pageRect.top,
      footerTop: page.querySelector('.footer')!.getBoundingClientRect().top,
      headingOffsets: southHeads.map((head, i) => head.getBoundingClientRect().top - northHeads[i].getBoundingClientRect().top)
    };
  });
}

for (const language of ['en', 'ta', 'hi'] as const) {
  for (const gender of ['M', 'F'] as const) {
    test(`${language} ${gender}: all 27 birth stars use larger names and the full second page`, async ({ page }) => {
      await preparePage(page);
      for (let star = 0; star < ALL_NAKSHATRA_LETTERS.length; star++) {
        const result = fixture(star, gender);
        const frame = await openReport(page, buildBabyNamingHtml(result, language));
        const metrics = await layout(frame);
        const label = ALL_NAKSHATRA_LETTERS[star].nakshatraNameEn;
        await expect(frame.locator('.page')).toHaveCount(2);
        await expect(frame.locator('.sound-medallion')).toHaveCount(0);
        await expect(frame.locator('.sound-big-char')).toContainText(
          language === 'ta' ? result.primaryPadaInfo.letterTa : language === 'hi' ? result.primaryPadaInfo.letterHi : result.primaryPadaInfo.letterEn
        );
        expect(metrics.count, label).toBe(result.nameSuggestions!.reduce((sum, c) => sum + c.south.length + c.north.length, 0));
        expect(metrics.nameSize, label).toBe(language === 'ta' ? '13px' : '14px');
        expect(metrics.meaningSize, label).toBe(language === 'ta' ? '9px' : '10px');
        expect(metrics.clipped, label).toEqual([]);
        expect(metrics.scrollHeight, label).toBeLessThanOrEqual(Math.ceil(metrics.height));
        expect(metrics.columnHeight / metrics.height, label).toBeGreaterThan(0.7);
        expect(metrics.lastNameBottom / metrics.height, label).toBeGreaterThan(0.91);
        expect(metrics.columnBottom, label).toBeLessThan(metrics.footerTop);
        for (const offset of metrics.headingOffsets) expect(Math.abs(offset), label).toBeLessThan(1);
      }
    });
  }

  test(`${language}: stale oversized lists rebuild to 64 current names without truncation`, async ({ page }) => {
    await preparePage(page);
    const frame = await openReport(page, buildBabyNamingHtml(fixture(23, 'M', true), language));
    const metrics = await layout(frame);
    expect(metrics.count).toBe(64);
    expect(metrics.nameSize).toBe(language === 'ta' ? '13px' : '14px');
    expect(metrics.clipped).toEqual([]);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(Math.ceil(metrics.height));
    expect(metrics.lastNameBottom / metrics.height).toBeGreaterThan(0.91);
    expect(metrics.columnBottom).toBeLessThan(metrics.footerTop);
  });

  for (const fromHtml of [false, true]) {
    test(`${language}: larger first and last names survive the ${fromHtml ? 'mobile HTML/email' : 'desktop preview'} PDF export`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await preparePage(page);
      const frame = await openReport(page, buildBabyNamingHtml(fixture(23, 'F'), language));
      const references = [];
      const texts = frame.locator('.sug-name-text');
      for (const element of [texts.first(), texts.last()]) {
        const geometry = await element.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const page = el.closest('.page')!.getBoundingClientRect();
          return { x: rect.x - page.x, y: rect.y - page.y, width: rect.width, height: rect.height };
        });
        references.push({ geometry, png: (await element.screenshot()).toString('base64') });
      }
      if (fromHtml) await page.setViewportSize({ width: 390, height: 900 });
      const captured = await page.evaluate(async fromHtml => {
        const exporterPath = '/src/services/jathagamPdfExporter.ts';
        const exporter = await import(exporterPath);
        const frame = document.getElementById('report') as HTMLIFrameElement;
        const pdf = fromHtml
          ? await exporter.renderHtmlToPdfDoc((window as any).reportHtml, { scale: 2, jpegQuality: 0.95 })
          : await exporter.renderPageElementsToPdfDoc(Array.from(frame.contentDocument!.querySelectorAll<HTMLElement>('.page')), { scale: 2, jpegQuality: 0.95 });
        const images = Object.values((pdf.internal as any).collections.addImage_images) as any[];
        return { pageCount: pdf.getNumberOfPages(), width: images[1].width, jpeg: btoa(images[1].data) };
      }, fromHtml);
      expect(captured.pageCount).toBe(2);
      const comparisons = await page.evaluate(async ({ captured, references }) => {
        const load = (src: string) => new Promise<HTMLImageElement>(resolve => {
          const image = new Image(); image.onload = () => resolve(image); image.src = src;
        });
        const jpeg = await load(`data:image/jpeg;base64,${captured.jpeg}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const ink = () => {
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let count = 0, top = canvas.height, bottom = -1;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (pixels[i] < 70 && pixels[i + 1] < 70 && pixels[i + 2] < 90) {
              count++; top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
          }
          return { count, height: bottom - top + 1 };
        };
        const comparisons = [];
        for (const reference of references) {
          const native = await load(`data:image/png;base64,${reference.png}`);
          canvas.width = native.width; canvas.height = native.height;
          ctx.drawImage(native, 0, 0);
          const preview = ink();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { x, y, width, height } = reference.geometry;
          const scale = captured.width / (210 * 96 / 25.4);
          ctx.drawImage(jpeg, x * scale, y * scale, width * scale, height * scale, 0, 0, canvas.width, canvas.height);
          comparisons.push({ preview, exported: ink() });
        }
        return comparisons;
      }, { captured, references });
      for (const comparison of comparisons) {
        expect(comparison.preview.count).toBeGreaterThan(10);
        expect(comparison.exported.count / comparison.preview.count).toBeGreaterThan(0.7);
        expect(comparison.exported.height / comparison.preview.height).toBeGreaterThan(0.8);
      }
      await expect(page.locator('iframe[data-astrosivam-capture="report"]')).toHaveCount(0);
    });
  }
}

// Real calculation, not a fabricated star/pada fixture.
test('Aarav corrected Tamil report fits two A4 pages with no overlapping name ink', async ({ page }, testInfo) => {
  await preparePage(page);
  const result = calculateBabyNamingDetails('Aarav', '2000-01-01', '02:00', 'Chennai', 'M', 13.0827, 80.2707, 5.5, 'India');
  const html = buildBabyNamingHtml(result, 'ta');
  const frame = await openReport(page, html);
  const metrics = await layout(frame);
  expect(metrics.count).toBe(64);
  expect(metrics.clipped).toEqual([]);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(Math.ceil(metrics.height));
  await expect(frame.locator('.verified-badge')).toHaveText('✓ கணிப்பு சரிபார்க்கப்பட்டது');
  await expect(frame.locator('.name-sound-check')).toContainText('பொருந்தவில்லை');
  await expect(frame.locator('.birth-pada-section')).toHaveCount(2);
  await expect(frame.locator('.pada-rasi-line')).toHaveText([
    'நவாம்சம்: தனுசு', 'நவாம்சம்: மகரம்', 'நவாம்சம்: கும்பம்', 'நவாம்சம்: மீனம்'
  ]);
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(2);
  await testInfo.attach('Aarav Tamil PDF', { body: pdf, contentType: 'application/pdf' });
});
