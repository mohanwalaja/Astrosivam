import { test, expect, type Frame, type Page } from '@playwright/test';
import { calculatePrecisionHoroscope } from '../../server/astrology/astronomy';
import { buildJathagamHtml, buildJathagamLifeCards } from '../../src/services/jathagamHtmlBuilder';

// Use the real bundled Latin/Indic faces, without depending on the fonts CDN.
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

const sample = calculatePrecisionHoroscope('Page Two Layout Test', '2000-01-01', '02:00', 'Chennai', 13.0827, 80.2707, 5.5, 'India', 'M');
const cautionSample = { ...sample, lagnaRasi: 1, planetPositions: sample.planetPositions.map(p => ({ ...p, bhavaNumber: 12 })) };

async function openReport(page: Page, html: string): Promise<Frame> {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: fontCss }));
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>'
  }));
  await page.goto('/');
  await page.evaluate(async html => {
    const cssPath = '/src/index.css';
    const fontsPath = '/src/services/reportFonts.ts';
    await import(cssPath);
    const { ensureReportFonts } = await import(fontsPath);
    document.body.innerHTML = '<iframe id="report" style="width:794px;height:3400px;border:0"></iframe>';
    const frame = document.getElementById('report') as HTMLIFrameElement;
    const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
    frame.srcdoc = html;
    await loaded;
    await ensureReportFonts(frame.contentDocument);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    (window as any).reportHtml = html;
  }, html);
  return page.frames().find(frame => frame !== page.mainFrame())!;
}

for (const language of ['en', 'ta', 'hi'] as const) {
  test(`${language}: all eight cards fit larger text for every house-lord placement`, async ({ page }) => {
    const frame = await openReport(page, buildJathagamHtml(sample, language));
    await expect(frame.locator('.page')).toHaveCount(3);
    await expect(frame.locator('#jathagam-page-2 .life-card-big')).toHaveCount(8);
    // Exercise the serialized standalone preview script, not just the imported helper.
    expect(await frame.locator('.life-card-big p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(14);

    const variants = [];
    for (let lagnaRasi = 1; lagnaRasi <= 12; lagnaRasi++) {
      for (let bhavaNumber = 1; bhavaNumber <= 12; bhavaNumber++) {
        variants.push({
          lagnaRasi, bhavaNumber,
          cards: buildJathagamLifeCards({ ...sample, lagnaRasi, planetPositions: sample.planetPositions.map(p => ({ ...p, bhavaNumber })) }, language)
        });
      }
    }
    const checked = await page.evaluate(async variants => {
      const layoutPath = '/src/services/jathagamLifeCardLayout.ts';
      const { fitJathagamLifeCardText } = await import(layoutPath);
      const doc = (document.getElementById('report') as HTMLIFrameElement).contentDocument!;
      const view = doc.defaultView!;
      const untouched = [doc.getElementById('jathagam-page-1')!, doc.getElementById('jathagam-page-3')!];
      const before = untouched.map(el => el.outerHTML);
      const cards = Array.from(doc.querySelectorAll<HTMLElement>('.life-card-big'));
      const range = doc.createRange();
      const errors: string[] = [];
      let minFontSize = Infinity;
      for (const variant of variants) {
        variant.cards.forEach((data, i) => {
          cards[i].querySelector('.card-title')!.textContent = data.title;
          const badge = cards[i].querySelector('.bhava-badge')!;
          badge.textContent = data.badge;
          badge.classList.toggle('badge-caution', /Caution|கவனம்|सावधान/.test(data.badge));
          cards[i].querySelector('p')!.textContent = data.desc;
        });
        fitJathagamLifeCardText(doc);
        const sizes = new Set<string>();
        cards.forEach((card, i) => {
          const label = `lagna ${variant.lagnaRasi}, house ${variant.bhavaNumber}, card ${i + 1}`;
          const bounds = card.getBoundingClientRect();
          const style = view.getComputedStyle(card);
          const left = bounds.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
          const right = bounds.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
          const bottom = bounds.bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
          for (const selector of ['.card-title', '.bhava-badge', 'p']) {
            const el = card.querySelector<HTMLElement>(selector)!;
            range.selectNodeContents(el);
            const text = range.getBoundingClientRect();
            if (text.left < left - 0.5 || text.right > right + 0.5 || text.bottom > bottom + 0.5) errors.push(`${label}: ${selector} leaves its box`);
          }
          const title = card.querySelector('.card-title')!.getBoundingClientRect();
          const badge = card.querySelector('.bhava-badge')!.getBoundingClientRect();
          if (title.right > badge.left + 0.5) errors.push(`${label}: title overlaps badge`);
          const p = card.querySelector('p')!;
          range.selectNodeContents(p);
          const text = range.getBoundingClientRect();
          const header = card.querySelector('.card-header-row')!.getBoundingClientRect();
          if (text.top < header.bottom) errors.push(`${label}: paragraph overlaps header`);
          const size = view.getComputedStyle(p).fontSize;
          sizes.add(size);
          minFontSize = Math.min(minFontSize, parseFloat(size));
        });
        if (sizes.size !== 1) errors.push('The eight cards should have a consistent body size');
      }
      const lastCard = cards[7].getBoundingClientRect();
      const footer = doc.querySelector('#jathagam-page-2 .footer')!.getBoundingClientRect();
      if (lastCard.bottom > footer.top) errors.push('Cards overlap the page-2 footer');
      return { errors: errors.slice(0, 30), minFontSize, unchanged: untouched.every((el, i) => el.outerHTML === before[i]), variants: variants.length };
    }, variants);
    expect(checked.errors).toEqual([]);
    expect(checked.variants).toBe(144);
    expect(checked.minFontSize).toBeGreaterThanOrEqual(13);
    expect(checked.unchanged, 'Fitting page 2 must not change pages 1 or 3').toBe(true);
  });

  for (const mode of [
    { name: 'live desktop download', width: 1280, fromHtml: false },
    { name: 'mobile HTML/email export', width: 390, fromHtml: true }
  ]) {
    test(`${language}: full enlarged text survives the ${mode.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const frame = await openReport(page, buildJathagamHtml(cautionSample, language));
      const references = [];
      for (let i = 0; i < 8; i++) {
        const paragraph = frame.locator('.life-card-big p').nth(i);
        const geometry = await paragraph.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          const pageBounds = el.closest('.page')!.getBoundingClientRect();
          return { x: bounds.x - pageBounds.x, y: bounds.y - pageBounds.y, width: bounds.width, height: bounds.height };
        });
        references.push({ geometry, png: (await paragraph.screenshot()).toString('base64') });
      }
      await page.setViewportSize({ width: mode.width, height: 900 });
      const captured = await page.evaluate(async fromHtml => {
        const exporterPath = '/src/services/jathagamPdfExporter.ts';
        const exporter = await import(exporterPath);
        const doc = (document.getElementById('report') as HTMLIFrameElement).contentDocument!;
        const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
        const pdf = fromHtml
          ? await exporter.renderHtmlToPdfDoc((window as any).reportHtml, { scale: 2.5, jpegQuality: 0.95 })
          : await exporter.renderPageElementsToPdfDoc(pages, { scale: 2.5, jpegQuality: 0.95 });
        const images = Object.values((pdf.internal as any).collections.addImage_images) as any[];
        return { pageCount: pdf.getNumberOfPages(), jpeg: btoa(images[1].data), width: images[1].width, height: images[1].height };
      }, mode.fromHtml);
      expect(captured.pageCount).toBe(3);
      expect(captured.width).toBeGreaterThan(1900);
      expect(captured.height).toBeGreaterThan(2800);

      const comparisons = await page.evaluate(async ({ references, captured }) => {
        const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
        });
        const jpeg = await loadImage(`data:image/jpeg;base64,${captured.jpeg}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const results = [];
        for (const reference of references) {
          const native = await loadImage(`data:image/png;base64,${reference.png}`);
          canvas.width = native.width; canvas.height = native.height;
          const ink = () => {
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0, top = canvas.height, bottom = -1, sumY = 0;
            for (let y = 0; y < canvas.height; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                if (Math.abs(pixels[index] - 30) < 45 && Math.abs(pixels[index + 1] - 41) < 45 && Math.abs(pixels[index + 2] - 59) < 45) {
                  count++; top = Math.min(top, y); bottom = Math.max(bottom, y); sumY += y;
                }
              }
            }
            return { count, height: bottom - top + 1, center: count ? sumY / count : -1 };
          };
          ctx.drawImage(native, 0, 0);
          const preview = ink();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const { x, y, width, height } = reference.geometry;
          const scale = captured.width / (210 * 96 / 25.4);
          ctx.drawImage(jpeg, x * scale, y * scale, width * scale, height * scale, 0, 0, canvas.width, canvas.height);
          const downloaded = ink();
          results.push({ countRatio: downloaded.count / preview.count, heightRatio: downloaded.height / preview.height, shift: Math.abs(downloaded.center - preview.center) });
        }
        return results;
      }, { references, captured });
      for (const comparison of comparisons) {
        expect(comparison.countRatio, 'All paragraph glyphs should survive capture').toBeGreaterThan(0.8);
        expect(comparison.countRatio).toBeLessThan(1.25);
        expect(comparison.heightRatio, 'The final line must not be clipped').toBeGreaterThan(0.97);
        expect(comparison.heightRatio).toBeLessThan(1.04);
        expect(comparison.shift, 'PDF text should stay in the preview line boxes').toBeLessThan(6);
      }
    });
  }
}
