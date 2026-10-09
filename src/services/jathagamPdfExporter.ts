import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { HoroscopeResult, WeddingMatchResult, BabyNamingResult, AppLanguage } from '../lib/astrology/types';
import { Order } from '../types';
import { buildJathagamHtml } from './jathagamHtmlBuilder';
import { buildWeddingMatchHtml } from './weddingHtmlBuilder';
import { buildBabyNamingHtml } from './babyNamingHtmlBuilder';
import { buildMuhurthamHtml, MuhurthamScanResult } from './muhurthamHtmlBuilder';
import { MUHURTHAM_ALGORITHM_VERSION } from '../lib/muhurtham/scanner';
import { buildInvoiceHtml, buildFamilyInvoiceHtml } from './invoiceHtmlBuilder';
import { orderChartServiceType } from './multiPersonOrder';
import { formatBirthPlace } from './formatUtils';
import { ensureReportFonts, type ReportFontStatus } from './reportFonts';
import { installCanvasFontMetricsReset } from './reportCapture';
import { fitJathagamLifeCardText, fitJathagamSummaryText } from './jathagamLifeCardLayout';
import { getTimeZoneIdForCoordinates, resolveLocalDateTimeInTimeZone } from '../lib/timezone';

function fitPageToA4Element(pageEl: HTMLElement) {
  const rect = pageEl.getBoundingClientRect();
  const mmToPx = rect.width ? rect.width / 210 : 3.78; // 96dpi fallback
  const targetPx = 297 * mmToPx;

  const inner = (
    pageEl.querySelector('.inner') ||
    pageEl.querySelector('.card') ||
    pageEl.querySelector('.royal-frame') ||
    pageEl.querySelector('.inner-content') ||
    pageEl.firstElementChild
  ) as HTMLElement;

  if (!inner) {
    pageEl.style.height = '297mm';
    pageEl.style.maxHeight = '297mm';
    pageEl.style.overflow = 'hidden';
    pageEl.style.boxSizing = 'border-box';
    return;
  }

  // Temporarily unconstrain height & overflow to measure true natural content height
  pageEl.style.height = 'auto';
  pageEl.style.maxHeight = 'none';
  pageEl.style.overflow = 'visible';
  inner.style.height = 'auto';
  inner.style.maxHeight = 'none';
  inner.style.overflow = 'visible';
  inner.style.transform = 'none';
  inner.style.width = '100%';

  const style = window.getComputedStyle(pageEl);
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const naturalInnerPx = inner.scrollHeight || inner.offsetHeight;
  const naturalPx = Math.max(pageEl.scrollHeight, naturalInnerPx + paddingTop + paddingBottom);

  // scrollHeight is rounded to an integer, whereas 297mm is fractional.
  // Do not shrink an already-fitting A4 page for that subpixel difference.
  if (naturalPx > targetPx + 1) {
    // Never scale below 0.5 to keep readability, and leave 8px breathing room
    const scale = Math.max(0.5, (targetPx - 8) / naturalPx);
    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = 'top center';
    inner.style.width = '100%';
  } else {
    inner.style.transform = 'none';
  }

  pageEl.style.height = '297mm';
  pageEl.style.maxHeight = '297mm';
  pageEl.style.overflow = 'hidden';
  pageEl.style.boxSizing = 'border-box';
}

/**
 * Global render queue — prevents two html2canvas renders from overlapping.
 * Overlapping renders share GPU/canvas memory and cause the \"last 3 PDFs render
 * in 1 second but are blank/low-quality\" bug seen in 4-member family bundles.
 */
/**
 * Capture settings for the html2canvas → jsPDF pipeline.
 *
 * `scale` is the real quality knob: it multiplies the CSS pixel density of the
 * capture, so scale 3 on an A4 page produces a ~2480 × 3508 px raster (≈300 dpi
 * print quality) instead of the ~794 px the on-screen layout uses.
 * `jpegQuality` only affects compression of that raster, never its resolution.
 */
export interface HtmlPdfRenderOptions {
  scale?: number;
  jpegQuality?: number;
  /** Email-only guards: fail closed if any A4 page raster is below this size. */
  minimumCaptureWidthPx?: number;
  minimumCaptureHeightPx?: number;
}

/**
 * Email PDFs use the same print-density capture as the admin's preview download.
 * Family delivery is split into size-bounded emails, so reducing raster quality
 * just to squeeze 10–15 reports into one message is no longer necessary.
 */
export const EMAIL_RENDER_OPTIONS: HtmlPdfRenderOptions = {
  scale: 3,
  jpegQuality: 0.95,
  minimumCaptureWidthPx: 1900,
  minimumCaptureHeightPx: 2800
};

/** Highest fidelity a desktop browser can capture without running out of memory. */
export const DOWNLOAD_RENDER_OPTIONS: HtmlPdfRenderOptions = { scale: 3, jpegQuality: 0.95 };

/** Phones get the preview's high-quality capture with a slightly smaller raster. */
export const DOWNLOAD_RENDER_OPTIONS_MOBILE: HtmlPdfRenderOptions = { scale: 2.5, jpegQuality: 0.95 };

/**
 * Last-resort capture density used only when the device rejects the two
 * attempts above (out of canvas memory, a tainted-canvas policy, …).
 *
 * It is still the SAME renderer and the SAME HTML as the preview — just a
 * smaller raster — which is why it is tried before the server-side renderer.
 * Switching engines is what made a download look different from the preview;
 * dropping from ~300 dpi to ~180 dpi never does.
 */
export const DOWNLOAD_RENDER_OPTIONS_SAFE: HtmlPdfRenderOptions = { scale: 1.8, jpegQuality: 0.92 };

/**
 * The capture densities a download may try, best first, without ever repeating
 * one. Guarantees at least one preview-exact attempt on every device.
 */
export function downloadAttemptOptions(preferred?: HtmlPdfRenderOptions): HtmlPdfRenderOptions[] {
  const first = preferred || recommendedDownloadOptions();
  const candidates = [first, EMAIL_RENDER_OPTIONS, DOWNLOAD_RENDER_OPTIONS_SAFE];
  return candidates.filter(
    (option, index) =>
      candidates.findIndex(
        other => other.scale === option.scale && other.jpegQuality === option.jpegQuality
      ) === index
  );
}

/**
 * A download must look exactly like the on-screen preview, so it is captured at
 * the highest density the device can handle. Desktops render at ~300 dpi;
 * phones (and any browser reporting ≤3 GB of memory) use the 2.5× capture that
 * the email pipeline already proves is stable there.
 */
export function recommendedDownloadOptions(): HtmlPdfRenderOptions {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return DOWNLOAD_RENDER_OPTIONS;
  const deviceMemory = (navigator as any).deviceMemory;
  const isPhone =
    Math.min(window.innerWidth || 9999, window.screen?.width || 9999) < 820 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  if (isPhone || (typeof deviceMemory === 'number' && deviceMemory <= 3)) return DOWNLOAD_RENDER_OPTIONS_MOBILE;
  return DOWNLOAD_RENDER_OPTIONS;
}

/** Email delivery must never fall back to a reduced-resolution page capture. */
function highQualityEmailRenderOptions(): HtmlPdfRenderOptions {
  return {
    ...recommendedDownloadOptions(),
    minimumCaptureWidthPx: EMAIL_RENDER_OPTIONS.minimumCaptureWidthPx,
    minimumCaptureHeightPx: EMAIL_RENDER_OPTIONS.minimumCaptureHeightPx
  };
}

let _renderQueue: Promise<void> = Promise.resolve();

/** Runs `task` after every previously queued render has finished. */
function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const resultPromise = _renderQueue.then(task, task);
  _renderQueue = resultPromise.then(
    () => {},
    () => {}
  );
  return resultPromise;
}

/**
 * Captures one report page with html2canvas and appends it to `doc`.
 *
 * The `onclone` hook is the important part: html2canvas regenerates the report
 * inside a brand-new iframe, and it AWAITS an async `onclone`. We use that to
 * (a) drop the report stylesheet into the clone and (b) wait for every report
 * font face to be live in the clone *before* html2canvas photographs it. That
 * is what makes the downloaded PDF use the same typefaces — and therefore the
 * same metrics, line breaks and pagination — as the on-screen preview instead
 * of fallback serif/sans glyphs.
 */
async function capturePageIntoDoc(
  doc: jsPDF,
  pageEl: HTMLElement,
  options: {
    captureScale: number;
    jpegQuality: number;
    pageNumber: number;
    windowWidth?: number;
    windowHeight?: number;
    minimumCaptureWidthPx?: number;
    minimumCaptureHeightPx?: number;
  }
): Promise<void> {
  const {
    captureScale,
    jpegQuality,
    pageNumber,
    minimumCaptureWidthPx,
    minimumCaptureHeightPx
  } = options;
  const ownerDoc = pageEl.ownerDocument || document;
  const ownerWindow = ownerDoc.defaultView || window;
  let canvas: HTMLCanvasElement | null = null;
  let attempts = 0;
  let success = false;

  while (attempts < 3 && !success) {
    let restoreFontMetrics: (() => void) | undefined;
    try {
      const w = pageEl.offsetWidth || pageEl.getBoundingClientRect().width || 794;
      const h = pageEl.offsetHeight || pageEl.getBoundingClientRect().height || 1123;

      if (w < 20 || h < 20) {
        await new Promise(r => setTimeout(r, 150));
        attempts++;
        continue;
      }

      // html2canvas measures baselines in the CALLING document, not in its
      // clone. Keep Tailwind's block-image reset out of those hidden probes.
      restoreFontMetrics = installCanvasFontMetricsReset(document);
      canvas = await html2canvas(pageEl, {
        scale: captureScale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        width: w,
        height: h,
        windowWidth: options.windowWidth ?? ownerWindow.innerWidth ?? 1280,
        windowHeight: options.windowHeight ?? ownerWindow.innerHeight ?? 1024,
        onclone: async (clonedDocument: Document) => {
          // (1) Guarantee the cloned report really has the webfonts. html2canvas
          //     awaits this promise, so the capture cannot race the font load.
          try {
            const status: ReportFontStatus = await ensureReportFonts(clonedDocument, { timeoutMs: 6000 });
            if (!status.ready && !status.unsupported && status.missing.length > 0) {
              console.warn(
                '[ASTRO SIVAM] Preview-exact capture: font(s) unavailable, the fallback glyphs are used:',
                status.missing.join(', ')
              );
            }
          } catch (fontError) {
            console.warn('[ASTRO SIVAM] Font wait failed for the capture clone:', fontError);
          }
          // Refit Birth Jathagam page-2 card text and page-3 Short Summary
          // type with the clone's loaded fonts. Never shrink the whole page
          // or truncate a card's content.
          fitJathagamLifeCardText(clonedDocument);
          fitJathagamSummaryText(clonedDocument);
          // (2) html2canvas creates an internal canvas for CSS linear-gradients.
          //     A very thin gradient rule can have a positive fractional CSS
          //     size (< 0.5px) that rounds to a 0px canvas dimension; calling
          //     createPattern on that canvas throws the group-render error.
          //     Such subpixel gradients are invisible in the final PDF, so omit
          //     only those backgrounds in the cloned capture document.
          const clonedWindow = clonedDocument.defaultView;
          if (!clonedWindow) return;
          const elements = clonedDocument.querySelectorAll<HTMLElement>('*');
          elements.forEach(element => {
            const style = clonedWindow.getComputedStyle(element);
            if (!style.backgroundImage.includes('gradient(')) return;
            const rect = element.getBoundingClientRect();
            if ((rect.width > 0 && rect.width < 1) || (rect.height > 0 && rect.height < 1)) {
              element.style.setProperty('background-image', 'none', 'important');
            }
          });
        }
      });

      if (
        (minimumCaptureWidthPx && canvas.width < minimumCaptureWidthPx) ||
        (minimumCaptureHeightPx && canvas.height < minimumCaptureHeightPx)
      ) {
        throw new Error(
          `Page ${pageNumber + 1} rendered at ${canvas.width} × ${canvas.height}px; ` +
          `email PDFs require at least ${minimumCaptureWidthPx || 0} × ${minimumCaptureHeightPx || 0}px per A4 page.`
        );
      }

      // Compression only — never resolution. Preview emails and direct
      // downloads use the same JPEG quality so fine Tamil/Devanagari strokes
      // remain as crisp as the admin's high-resolution preview export.
      let imgData = canvas.toDataURL('image/jpeg', jpegQuality);

      // Heuristic: a valid A4 JPEG at 2.5x or more should be >25KB. If it is
      // tiny, the canvas was blank and we should retry.
      if (imgData.length < 25000 && attempts < 2) {
        imgData = '';
        // Do not resize the returned canvas to 0x0. Group renders run many
        // captures back-to-back, and a browser/html2canvas image cache can
        // still hold a reference to the canvas briefly. Reusing that
        // zero-sized canvas as a pattern source throws InvalidStateError.
        // Drop our reference instead and let the browser collect it once the
        // render task has fully unwound.
        canvas = null;
        await new Promise(r => setTimeout(r, 250 + attempts * 150));
        attempts++;
        continue;
      }

      if (pageNumber > 0) {
        doc.addPage('a4', 'portrait');
      }
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'SLOW');
      // Drop the multi-megabyte data URL before the next canvas starts.
      imgData = '';
      success = true;
    } catch (e) {
      console.warn(`html2canvas failed for page ${pageNumber + 1}, attempt ${attempts + 1}`, e);
      attempts++;
      if (attempts >= 3) throw e;
      await new Promise(r => setTimeout(r, 400));
    } finally {
      // Also restore the capture environment on blank-canvas retries / errors.
      restoreFontMetrics?.();
      // Release only our JS reference. Resizing html2canvas's result to 0x0 can
      // invalidate a canvas still temporarily referenced by the browser or
      // html2canvas while the next group member starts.
      canvas = null;
    }
  }

  if (!success) {
    throw new Error(`Failed to render page ${pageNumber + 1} after ${attempts} attempts`);
  }
}

/**
 * Renders a list of ALREADY LAID OUT A4 page elements — i.e. the pages of the
 * live preview iframe the visitor is looking at — into a PDF document.
 *
 * Nothing is re-parsed and nothing is re-fitted: the very same DOM nodes the
 * browser has already painted (fonts loaded, gradients applied, charts drawn)
 * are photographed at print density, so the download is the preview.
 */
export async function renderPageElementsToPdfDoc(
  pages: HTMLElement[],
  options?: HtmlPdfRenderOptions
): Promise<jsPDF> {
  if (!pages || pages.length === 0) {
    throw new Error('No report pages available to render.');
  }
  const captureScale = options?.scale ?? EMAIL_RENDER_OPTIONS.scale ?? 2.5;
  const jpegQuality = options?.jpegQuality ?? EMAIL_RENDER_OPTIONS.jpegQuality ?? 0.92;

  const task = async (): Promise<jsPDF> => {
    const ownerDoc = pages[0].ownerDocument || document;
    // The source, the clone AND html2canvas's canvas / font probes must have
    // the same fonts. Those probes live in the calling (parent) document even
    // when the report itself lives in the preview iframe.
    await Promise.all([
      ensureReportFonts(document, { timeoutMs: 7000 }).catch(() => undefined),
      ...(ownerDoc !== document
        ? [ensureReportFonts(ownerDoc, { timeoutMs: 5000 }).catch(() => undefined)]
        : [])
    ]);
    fitJathagamLifeCardText(ownerDoc);
    fitJathagamSummaryText(ownerDoc);
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    for (let idx = 0; idx < pages.length; idx++) {
      await capturePageIntoDoc(doc, pages[idx], {
        captureScale,
        jpegQuality,
        pageNumber: idx,
        windowWidth: ownerDoc.defaultView?.innerWidth,
        windowHeight: ownerDoc.defaultView?.innerHeight,
        minimumCaptureWidthPx: options?.minimumCaptureWidthPx,
        minimumCaptureHeightPx: options?.minimumCaptureHeightPx
      });
      await new Promise(r => setTimeout(r, 180));
    }
    return doc;
  };

  return enqueueRender(task);
}

export async function renderHtmlToPdfDoc(
  htmlContent: string,
  options?: HtmlPdfRenderOptions
): Promise<jsPDF> {
  const captureScale = options?.scale ?? EMAIL_RENDER_OPTIONS.scale ?? 2.5;
  const jpegQuality = options?.jpegQuality ?? EMAIL_RENDER_OPTIONS.jpegQuality ?? 0.92;

  const task = async (): Promise<jsPDF> => {
    // Reports are complete HTML documents, just like the live srcDoc preview.
    // Keep them in their own document: inserting <html>/<head>/<body> into a
    // div leaked report CSS into the app and inherited Tailwind's line-height,
    // image and table resets, so HTML/email exports could reflow differently.
    const container = document.createElement('iframe');
    container.setAttribute('data-astrosivam-capture', 'report');
    container.setAttribute('aria-hidden', 'true');
    container.setAttribute('sandbox', 'allow-same-origin'); // static report; no scripts
    container.tabIndex = -1;
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '-10000px';
    container.style.width = '210mm';
    container.style.height = '297mm';
    container.style.border = '0';
    container.style.background = '#ffffff';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';
    const frameReady = new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timer);
        container.removeEventListener('load', finish);
        resolve();
      };
      // A blocked image / stylesheet must not hold the download indefinitely.
      const timer = setTimeout(finish, 8000);
      container.addEventListener('load', finish);
    });
    container.srcdoc = htmlContent;
    document.body.appendChild(container);

    try {
      await frameReady;
      const reportDoc = container.contentDocument;
      if (!reportDoc?.body) throw new Error('The report document could not be loaded.');
      // Wait for the report webfonts with a timeout so we never hang forever.
      // `ensureReportFonts` injects the stylesheet itself and waits for the
      // individual faces — plain `document.fonts.ready` resolved before the
      // freshly imported families had even been requested, which is how the
      // capture ended up with fallback glyphs while the preview looked right.
      await ensureReportFonts(document, { timeoutMs: 7000 }).catch(() => null);
      const fontStatus = await ensureReportFonts(reportDoc, { timeoutMs: 7000 }).catch(() => null);
      if (fontStatus && !fontStatus.ready && !fontStatus.unsupported) {
        console.warn(
          '[ASTRO SIVAM] Report fonts unavailable for this capture (the preview would fall back too):',
          fontStatus.missing.join(', ')
        );
      }

      // Ensure all images are fully loaded AND decoded
      const allImages = Array.from(reportDoc.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(
        allImages.map(async (img) => {
          try {
            if (img.complete && img.naturalHeight !== 0) {
              const d = (img as any).decode;
              if (typeof d === 'function') {
                await d.call(img).catch(() => {});
              }
              return;
            }
            await new Promise<void>(resolve => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                resolve();
              };
              img.onload = () => {
                const dec = (img as any).decode;
                if (typeof dec === 'function') {
                  dec.call(img).then(finish).catch(finish);
                } else {
                  finish();
                }
              };
              img.onerror = () => finish();
              setTimeout(finish, 2500);
            });
          } catch {
            // Non-fatal: allow render to continue even if an image fails
          }
        })
      );

      // Let the browser paint the final layout (double RAF ensures styles applied)
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const pages = reportDoc.querySelectorAll('.page') as NodeListOf<HTMLElement>;
      if (pages.length === 0) {
        throw new Error('No pages found in HTML export.');
      }

      // The grid-heavy pages (Muhurtham calendar, Birth Jathagam life cards)
      // already budget an exact A4 box, and enlarge/refit only the text inside
      // them. Every page still goes through the sheet fitter: with the pages'
      // `min-height: 297mm` contract it is a no-op while the content fits, and
      // it scales the sheet down if a report ever has more to say than one
      // page — which is what keeps a grown page from being squashed into the
      // 210 × 297 mm image below.
      fitJathagamLifeCardText(reportDoc);
      fitJathagamSummaryText(reportDoc);
      pages.forEach(p => fitPageToA4Element(p));

      // Wait a tick after fitting so transforms are applied
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => setTimeout(resolve, 80));
      });

      // Create the PDF before capturing pages and add each page immediately.
      //
      // IMPORTANT: do not keep an imgDataList. A scale-2.5 A4 canvas is about
      // 22 MB before encoding. Keeping every JPEG data URL until the end left
      // several large UTF-16 strings alive after each report; by member 4 the
      // browser/GPU was under enough pressure that html2canvas returned a fast,
      // degraded capture. Incremental insertion keeps peak memory bounded by
      // ONE page, whether the bundle contains 4, 10, or more reports.
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let idx = 0; idx < pages.length; idx++) {
        await capturePageIntoDoc(doc, pages[idx] as HTMLElement, {
          captureScale,
          jpegQuality,
          pageNumber: idx,
          windowWidth: reportDoc.defaultView?.innerWidth,
          windowHeight: reportDoc.defaultView?.innerHeight,
          minimumCaptureWidthPx: options?.minimumCaptureWidthPx,
          minimumCaptureHeightPx: options?.minimumCaptureHeightPx
        });

        // Yield between pages to let the browser GC and keep UI responsive
        await new Promise(r => setTimeout(r, 180));
      }

      return doc;
    } finally {
      try {
        document.body.removeChild(container);
      } catch {}
      // Extra tick for GC after container removal
      await new Promise(r => setTimeout(r, 50));
    }
  };

  // Chain onto global queue so family bundle renders never overlap
  return enqueueRender(task);
}

export async function generatePdfBase64FromHtml(
  htmlContent: string,
  options?: HtmlPdfRenderOptions
): Promise<string> {
  const doc = await renderHtmlToPdfDoc(htmlContent, options);
  const dataUri = doc.output('datauristring');
  const commaIdx = dataUri.indexOf(',');
  return commaIdx !== -1 ? dataUri.substring(commaIdx + 1) : dataUri;
}

/** Reject blank, truncated, or non-PDF captures before they reach email delivery. */
export function assertPreviewQualityPdfBase64(
  pdfBase64: string,
  label: string,
  minimumBytes = 1024
): number {
  const normalized = (pdfBase64 || '').replace(/\s/g, '');
  if (!/^JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error(`${label} is not a valid PDF capture. Nothing was emailed.`);
  }
  const paddingBytes = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((normalized.length * 3) / 4) - paddingBytes);
  if (byteLength < minimumBytes) {
    throw new Error(`${label} is incomplete (${byteLength} bytes). Nothing was emailed.`);
  }
  return byteLength;
}

/**
 * Lets the browser paint pending UI updates before a heavy html2canvas render
 * (~8 s per report). Without this the progress bar would freeze on the first
 * member and the admin would think the family render had hung.
 */
export function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(() => resolve(), 100));
      });
    } else {
      setTimeout(() => resolve(), 150);
    }
  });
}

/**
 * Single source of truth for "which HTML builder renders this order".
 * The single-order live preview and every family member report both call this,
 * so a family bundle can never be rendered by a different (lower quality)
 * code path than a single order.
 */
export function buildOrderReportHtml(order: Order, result: any, lang: AppLanguage): string {
  if (!order || !result) return '';
  if (order.serviceType === 'BIRTH_JATHAGAM') {
    return buildJathagamHtml(result as HoroscopeResult, lang);
  }
  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    return buildWeddingMatchHtml(result as WeddingMatchResult, lang, { orderNumber: order?.orderNumber });
  }
  if (order.serviceType === 'BABY_NAMING') {
    return buildBabyNamingHtml(result as BabyNamingResult, lang);
  }
  if (order.serviceType === 'MUHURTHAM') {
    return buildMuhurthamHtml(result as MuhurthamScanResult, lang);
  }
  return '';
}

/**
 * Mirrors the live-preview modal: a persisted result is merged with the
 * original input payload so names / dates / places always come from what the
 * customer actually typed (the calculation layer stores placeholders such as
 * "Native" for legacy rows).
 */
function reportText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function reportNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeBirthInput(input: any): any {
  const value = input || {};
  const timezoneOffsetHours = value.timezoneOffsetHours ?? value.tzOffsetHours ??
    (value.tzOffsetMinutes !== undefined ? Number(value.tzOffsetMinutes) / 60 : undefined);
  return {
    ...value,
    birthPlace: value.birthPlace ?? value.place ?? '',
    country: value.country ?? value.birthCountry ?? '',
    latitude: value.latitude ?? value.lat,
    longitude: value.longitude ?? value.lng,
    timezoneOffsetHours,
    timeZoneId: value.timeZoneId ?? value.timezoneId ?? ''
  };
}

/** Float/rounding slack for offset comparison (offsets are minute-precise in practice). */
const OFFSET_MATCH_TOLERANCE_HOURS = 1 / 3600;

/**
 * Compares the timezone fields as a BIRTH INSTANT, never as raw values.
 *
 * The TypeScript calculation module and the PHP engine
 * intentionally replace the submitted fixed offset with the IANA historical
 * offset in force at the moment of birth — DST included — so a chart computed
 * from these exact inputs may legitimately store an offset that differs from
 * what the customer typed (born in New York in July: submitted -5, stored -4;
 * Fiji in January: submitted 12, stored 13). Requiring a byte-exact match made
 * every such chart "permanently stale": recalculation produced the same stored
 * offset, failed the same check again, and the member was skipped with "no
 * calculated astrology results available" on every retry.
 *
 * The chart matches when its stored offset equals one of the offsets the
 * engines would compute from these same inputs: the IANA zone mapped from the
 * saved coordinates (TypeScript calculation module), the IANA zone the payload itself carries
 * (PHP engine), or the submitted fixed offset (legacy rows).
 */
function birthTimeOffsetsMatch(chartOffset: number | null, input: any): boolean {
  if (chartOffset === null) return true; // rows predating stored offsets: nothing to disprove
  const candidates: Array<number | null> = [];
  const lat = reportNumber(input.latitude);
  const lon = reportNumber(input.longitude);
  // The engines normalise the submitted wall clock before resolving the zone,
  // so resolve the same canonical date/time ('6:30 PM' → '18:30') here too.
  const dob = canonicalBirthDate(input.dob);
  const tob = canonicalBirthTime(input.tob);
  if (lat !== null && lon !== null) {
    const zone = getTimeZoneIdForCoordinates(lat, lon);
    if (zone) {
      const resolved = resolveLocalDateTimeInTimeZone(dob, tob, zone);
      if (resolved) candidates.push(resolved.offsetHours);
    }
  }
  const inputZone = reportText(input.timeZoneId);
  if (inputZone) {
    const resolved = resolveLocalDateTimeInTimeZone(dob, tob, inputZone);
    if (resolved) candidates.push(resolved.offsetHours);
  }
  candidates.push(reportNumber(input.timezoneOffsetHours));
  return candidates.some(
    candidate => candidate !== null && Math.abs(candidate - chartOffset) <= OFFSET_MATCH_TOLERANCE_HOURS
  );
}

/**
 * Canonical 24-hour `HH:MM` for a saved or engine-stored birth time.
 *
 * The engines agree on this canonical form (`AstroEngine::normalizeBirthTime()`
 * and the TypeScript calculation module both store `06:30`), but order rows saved before the
 * birth-time input was canonicalised — and every order placed through the PHP
 * API, which accepts `6:30`, `06:30:00` and `6:30 PM` — keep what the customer
 * typed. Comparing the raw strings made those charts permanently stale: the
 * recalculation returned the canonical time again, failed the same check, and
 * the member was skipped on every retry.
 *
 * Unparseable values fall back to the trimmed text so a genuinely wrong time
 * still forces a recalculation.
 */
function canonicalBirthTime(value: unknown): string {
  const raw = reportText(value);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(raw);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  const period = (match[4] || '').toLowerCase();
  if (period === 'pm' && hour < 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59 || second > 59) return raw;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Canonical `YYYY-MM-DD` for a saved or engine-stored birth date. */
function canonicalBirthDate(value: unknown): string {
  const raw = reportText(value);
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!match) return raw;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Engine-canonical gender letter, or '' when the value is not a binary gender. */
function genderLetter(value: unknown): string {
  const text = reportText(value).toUpperCase();
  if (text === 'M' || text === 'MALE' || text === 'BOY') return 'M';
  if (text === 'F' || text === 'FEMALE' || text === 'GIRL') return 'F';
  return '';
}

/**
 * True only when both sides name a binary gender and disagree.
 *
 * The PHP engine collapses everything that is not `F` to `M` (so the family
 * checkout's "Other" choice is stored as `M`), and older rows hold `male` /
 * `female`. Comparing the letters — and staying silent when the saved value
 * does not pin a gender — stops those charts from being judged stale forever.
 */
function gendersDisagree(chartGender: unknown, inputGender: unknown): boolean {
  const chart = genderLetter(chartGender);
  const input = genderLetter(inputGender);
  return Boolean(chart && input && chart !== input);
}

/** A cached chart is reusable only when every calculation-driving birth input matches. */
function birthDetailsMatch(chart: any, rawInput: any, expectedGender?: string): boolean {
  if (!chart || !rawInput) return false;
  const input = normalizeBirthInput(rawInput);
  const details = chart.birthDetails || chart;
  const chartValue = (key: string) => details[key] ?? chart[key];
  const chartText = (key: string) => reportText(chartValue(key));
  const inputText = (key: string) => reportText(input[key]);
  const chartNumber = (key: string) => reportNumber(chartValue(key));
  const inputNumber = (key: string) => reportNumber(input[key]);
  const requiredText = ['dob', 'tob', 'birthPlace'];
  if (requiredText.some(key => !inputText(key))) return false;
  if (inputNumber('latitude') === null || inputNumber('longitude') === null || inputNumber('timezoneOffsetHours') === null) return false;
  // Birth date/time are compared as the same wall-clock moment the engines
  // consume, never as raw strings (see canonicalBirthTime).
  if (canonicalBirthDate(chartValue('dob')) !== canonicalBirthDate(input.dob)) return false;
  if (canonicalBirthTime(chartValue('tob')) !== canonicalBirthTime(input.tob)) return false;
  if (chartText('birthPlace') !== inputText('birthPlace')) return false;
  if (chartText('country') !== inputText('country')) return false;
  if (chartNumber('latitude') !== inputNumber('latitude') ||
      chartNumber('longitude') !== inputNumber('longitude')) return false;
  if (!birthTimeOffsetsMatch(chartNumber('timezoneOffsetHours'), input)) return false;
  if (expectedGender && chartValue('gender') !== undefined && gendersDisagree(chartValue('gender'), expectedGender)) return false;
  return true;
}

/** A rasi index as both engines store it (1 = Mesham … 12 = Meenam). */
function isRasiNumber(value: unknown): boolean {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
}

/**
 * Is this a COMPLETE Birth Jathagam chart — the same contract both astrology
 * engines produce and the report renderer consumes?
 *
 * The old marker was `Boolean(result.bhavas)`, and only the TypeScript calculation module emits a
 * `bhavas` table: the production PHP engine (`AstroEngine::calculateHoroscope()`)
 * stores the twelve houses on every `planetPositions` entry instead. So on the
 * PHP deployment EVERY rescued member was rejected as "inconsistent with the
 * saved birth inputs" — even a chart recalculated from those very inputs — and
 * the family render skipped it on every retry.
 *
 * The report itself is built from the shared fields below (`lagnaRasi`,
 * `chandraRasi`, nine `planetPositions` with rasi/bhava, the janma nakshatra and
 * pada, and the Vimshottari timeline), so those are what a chart must carry to
 * render at full quality — no matter which engine produced it.
 */
function hasCompleteJathagamChart(result: any): boolean {
  if (!result || typeof result !== 'object') return false;
  if (!isRasiNumber(result.lagnaRasi) || !isRasiNumber(result.chandraRasi)) return false;
  const positions = Array.isArray(result.planetPositions) ? result.planetPositions : [];
  if (positions.length < 9) return false;
  if (!positions.every((position: any) =>
    isRasiNumber(position?.rasi) && isRasiNumber(position?.bhavaNumber ?? position?.house))) {
    return false;
  }
  const nakshatra = reportText(result.janmaNakshatraEn) ||
    reportText(result.janmaNakshatraTa) ||
    reportText(result.janmaNakshatraHi);
  if (!nakshatra) return false;
  const pada = Number(result.janmaPada);
  if (!Number.isInteger(pada) || pada < 1 || pada > 4) return false;
  const timeline = Array.isArray(result.dashaPeriods) ? result.dashaPeriods : [];
  if (timeline.length === 0 && !result.dasha && !result.currentDasha) return false;
  return true;
}

function normalizeWeddingPerson(payload: any, role: 'bride' | 'groom', source?: any, isLegacyFlat = false): any {
  const value = source || {};
  const isBride = role === 'bride';
  const secondRole = isBride ? 'girl' : 'boy';
  const numberedRole = isBride ? 'p1' : 'p2';
  const prefix = isBride ? 'bride' : 'groom';
  const altPrefix = secondRole;
  const birthDetails = value.birthDetails || {};
  const numbered = (key: string) => source ? undefined : payload[`${numberedRole}${key}`];
  return {
    ...value,
    name: value.name ?? value.devoteeName ?? value[`${prefix}Name`] ?? payload[`${prefix}Name`] ?? payload[`${altPrefix}Name`] ?? numbered('Name'),
    dob: value.dob ?? birthDetails.dob ?? value[`${prefix}Dob`] ?? payload[`${prefix}Dob`] ?? payload[`${altPrefix}Dob`] ?? numbered('Dob'),
    tob: value.tob ?? birthDetails.tob ?? value[`${prefix}Tob`] ?? payload[`${prefix}Tob`] ?? payload[`${altPrefix}Tob`] ?? numbered('Tob'),
    birthPlace: value.birthPlace ?? birthDetails.birthPlace ?? value.place ?? value[`${prefix}Place`] ??
      payload[`${prefix}BirthPlace`] ?? payload[`${prefix}Place`] ?? numbered('BirthPlace') ?? (isLegacyFlat ? payload.birthPlace : undefined),
    country: value.country ?? birthDetails.country ?? value.birthCountry ?? value[`${prefix}Country`] ??
      payload[`${prefix}Country`] ?? payload[`${altPrefix}Country`] ?? numbered('Country'),
    latitude: value.latitude ?? birthDetails.latitude ?? value.lat ?? payload[`${prefix}Latitude`] ?? numbered('Latitude') ?? (isLegacyFlat ? payload.latitude : undefined),
    longitude: value.longitude ?? birthDetails.longitude ?? value.lng ?? payload[`${prefix}Longitude`] ?? numbered('Longitude') ?? (isLegacyFlat ? payload.longitude : undefined),
    timezoneOffsetHours: value.timezoneOffsetHours ?? birthDetails.timezoneOffsetHours ?? value.tzOffsetHours ??
      payload[`${prefix}TimezoneOffsetHours`] ?? numbered('TimezoneOffsetHours') ?? (isLegacyFlat ? payload.timezoneOffsetHours : undefined),
    timeZoneId: value.timeZoneId ?? birthDetails.timeZoneId ?? payload[`${prefix}TimeZoneId`] ?? numbered('TimeZoneId') ?? (isLegacyFlat ? payload.timeZoneId : undefined)
  };
}

function normalizeWeddingInputs(payload: any): { bride: any; groom: any } {
  const p = payload || {};
  let bride = p.bride || p.girl || p.brideDetails || p.girlDetails;
  let groom = p.groom || p.boy || p.groomDetails || p.boyDetails;
  if (!bride && !groom && p.p1 && p.p2) {
    const p1IsBride = p.p1Role === 'bride' || String(p.p1.gender || '').toUpperCase() === 'F';
    bride = p1IsBride ? p.p1 : p.p2;
    groom = p1IsBride ? p.p2 : p.p1;
    return {
      bride: normalizeWeddingPerson(p, 'bride', bride),
      groom: normalizeWeddingPerson(p, 'groom', groom)
    };
  }
  if (bride || groom) {
    return {
      bride: normalizeWeddingPerson(p, 'bride', bride),
      groom: normalizeWeddingPerson(p, 'groom', groom)
    };
  }
  return {
    bride: normalizeWeddingPerson(p, 'bride', undefined, true),
    groom: normalizeWeddingPerson(p, 'groom', undefined, true)
  };
}

export function mergeOrderPayloadIntoResult(order: Order, result: any): any {
  if (!result || !order) return result;
  const p: any = order.inputPayload || {};
  const merged: any = { ...result };
  const recordedCountry = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const recordedPlace = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  // The report prints the SAVED birth time; store it in the canonical 24-hour
  // form so a legacy '6:30 PM' row cannot be shown as '06:30 AM'.
  const recordedTime = (value: unknown) => canonicalBirthTime(value);

  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    const { bride, groom } = normalizeWeddingInputs(p);
    const brideName = reportText(bride.name);
    const groomName = reportText(groom.name);
    if (brideName) merged.brideName = brideName;
    else if (!merged.brideName || merged.brideName === 'Native' || merged.brideName === 'Bride') {
      merged.brideName = p.brideName || p.girlName || p.p1Name || merged.brideName;
    }
    if (groomName) merged.groomName = groomName;
    else if (!merged.groomName || merged.groomName === 'Native' || merged.groomName === 'Groom') {
      merged.groomName = p.groomName || p.boyName || p.p2Name || merged.groomName;
    }
    if (bride.dob) merged.brideDob = bride.dob;
    if (bride.tob) merged.brideTob = bride.tob;
    if (groom.dob) merged.groomDob = groom.dob;
    if (groom.tob) merged.groomTob = groom.tob;

    const brideBirthPlace = recordedPlace(bride.birthPlace);
    const brideCountry = recordedCountry(bride.country);
    const groomBirthPlace = recordedPlace(groom.birthPlace);
    const groomCountry = recordedCountry(groom.country);
    // Old calculated results may have appended the account/billing country.
    // Rebuild each label only from the saved bride/groom birth particulars.
    merged.bridePlace = formatBirthPlace(brideBirthPlace, brideCountry);
    merged.groomPlace = formatBirthPlace(groomBirthPlace, groomCountry);
    merged.bride = { ...(merged.bride || {}), birthPlace: brideBirthPlace, country: brideCountry };
    merged.groom = { ...(merged.groom || {}), birthPlace: groomBirthPlace, country: groomCountry };
  } else if (order.serviceType === 'BABY_NAMING') {
    const babyName = reportText(p.babyName ?? p.childName ?? p.name);
    if (babyName) merged.babyName = babyName;
    if (p.dob) merged.dob = p.dob;
    if (p.tob) merged.tob = recordedTime(p.tob);
    merged.birthPlace = recordedPlace(p.birthPlace ?? p.place);
    merged.country = recordedCountry(p.country);
    if (p.gender) merged.gender = p.gender;
  } else if (order.serviceType === 'MUHURTHAM') {
    if (p.name || p.devoteeName) merged.devoteeName = p.name || p.devoteeName;
    else if (!merged.devoteeName || merged.devoteeName === 'Native' || merged.devoteeName === 'Devotee' || merged.devoteeName === 'User') {
      merged.devoteeName = order.userName || merged.devoteeName;
    }
    if (p.dob) merged.dob = p.dob;
    if (p.tob) merged.tob = recordedTime(p.tob);
    merged.birthPlace = recordedPlace(p.birthPlace ?? p.place);
    merged.country = recordedCountry(p.country);
    merged.muhurthamPlace = recordedPlace(p.muhurthamPlace);
    merged.muhurthamCountry = recordedCountry(p.muhurthamCountry);
    merged.eventKey = recordedPlace(p.eventKey) || 'wedding';
    if (!merged.months && !merged.chosenMonth && p.muhurthamScan) {
      merged.months = p.muhurthamScan.months || merged.months;
      merged.prevMonth = p.muhurthamScan.prevMonth || merged.prevMonth;
      merged.chosenMonth = p.muhurthamScan.chosenMonth || merged.chosenMonth;
      merged.nextMonth = p.muhurthamScan.nextMonth || merged.nextMonth;
    }
  } else {
    if (p.name) merged.devoteeName = p.name;
    else if (!merged.devoteeName || merged.devoteeName === 'Native' || merged.devoteeName === 'Devotee' || merged.devoteeName === 'User') {
      merged.devoteeName = order.userName || merged.devoteeName;
    }
    if (p.dob) merged.dob = p.dob;
    if (p.tob) merged.tob = recordedTime(p.tob);
    // Billing/order country is not a substitute for missing birth particulars.
    merged.birthPlace = recordedPlace(p.birthPlace ?? p.place);
    merged.country = recordedCountry(p.country);
    if (p.gender || (order as any).gender) merged.gender = p.gender || (order as any).gender;
  }

  merged.inputPayload = p;
  return merged;
}

/**
 * Same staleness rule the live-preview modal uses: a stored result that predates
 * the current algorithm (e.g. Baby Naming v1 without the 108-pada mapping, or a
 * horoscope saved without bhavas) is recalculated instead of being rendered,
 * otherwise the customer would receive a visibly thinner report.
 */
export function resultNeedsRecalculation(order: Order, result: any): boolean {
  if (!result) return true;
  if (order.serviceType === 'BABY_NAMING') {
    const p: any = order.inputPayload || {};
    const birthInput = normalizeBirthInput(p);
    const chart = result.babyHoroscope || result;
    return (
      !result.nakshatraLetters ||
      !result.primaryPadaInfo ||
      Number(result.babyNamingAlgorithmVersion || 0) !== 2 ||
      !birthDetailsMatch(chart, birthInput) ||
      !genderLetter(result.gender) ||
      gendersDisagree(result.gender, p.gender || 'M')
    );
  }
  if (order.serviceType === 'BIRTH_JATHAGAM') {
    const p: any = order.inputPayload || {};
    return !hasCompleteJathagamChart(result) || !birthDetailsMatch(result, p, p.gender || 'M');
  }
  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    const p: any = order.inputPayload || {};
    const { bride, groom } = normalizeWeddingInputs(p);
    return !birthDetailsMatch(result.bride, bride, 'F') || !birthDetailsMatch(result.groom, groom, 'M');
  }
  if (order.serviceType === 'MUHURTHAM') {
    const p: any = order.inputPayload || {};
    const sameNumber = (left: unknown, right: unknown) =>
      Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right);
    const months = Array.isArray(result.months) ? result.months : [];
    const hasSixMonths = months.length === 6 &&
      months.every(month => Array.isArray(month?.days)) &&
      months.some(month => month.days.length > 0);
    return Number(result.muhurthamAlgorithmVersion) !== MUHURTHAM_ALGORITHM_VERSION || !hasSixMonths ||
      !p.muhurthamPlace || result.muhurthamPlace !== p.muhurthamPlace ||
      String(result.muhurthamCountry || '') !== String(p.muhurthamCountry || '') ||
      !sameNumber(result.muhurthamLatitude, p.muhurthamLatitude) ||
      !sameNumber(result.muhurthamLongitude, p.muhurthamLongitude) ||
      !sameNumber(result.muhurthamTimezoneOffsetHours, p.muhurthamTimezoneOffsetHours) ||
      String(result.muhurthamTimeZoneId || '') !== String(p.muhurthamTimeZoneId || '') ||
      String(result.selectedMonth || '') !== String(p.selectedMonth || '') ||
      String(result.eventKey || '') !== String(p.eventKey || '') ||
      String(result.dob || '') !== String(p.dob || '') ||
      String(result.tob || '') !== String(p.tob || '') ||
      String(result.birthPlace || '') !== String(p.birthPlace || '') ||
      String(result.country || '') !== String(p.country || '') ||
      !sameNumber(result.latitude, p.latitude) ||
      !sameNumber(result.longitude, p.longitude) ||
      !sameNumber(result.timezoneOffsetHours, p.timezoneOffsetHours) ||
      String(result.timeZoneId || '') !== String(p.timeZoneId || '');
  }
  return false;
}

/** Display name of a family member, matching the admin card and the invoice. */
export function familyMemberDisplayName(order: Order): string {
  const p: any = order?.inputPayload || {};
  if (order?.serviceType === 'MARRIAGE_COMPATIBILITY') {
    const bride = p.bride?.name || p.brideName || '';
    const groom = p.groom?.name || p.groomName || '';
    if (bride && groom) return `${bride} & ${groom}`;
  }
  if (order?.serviceType === 'BABY_NAMING' && (p.babyName || p.childName)) {
    return p.babyName || p.childName;
  }
  return p.name || order?.userName || order?.orderNumber || 'User';
}

export async function generateOrderPdfsBase64(
  order: Order,
  preferredLang?: AppLanguage,
  resultOverride?: any
): Promise<{ reportPdfBase64: string; invoicePdfBase64: string }> {
  const lang = preferredLang || (order.language as AppLanguage) || 'ta';
  let effectiveResult = resultOverride || order.calculatedResult;
  let resolveError = '';
  if (!effectiveResult || resultNeedsRecalculation(order, effectiveResult)) {
    const resolved = await resolveCalculatedResult({ ...order, calculatedResult: effectiveResult } as Order);
    effectiveResult = resolved.result;
    resolveError = resolved.error;
  }
  if (!effectiveResult) {
    throw new Error(
      `The report calculation is not available${resolveError ? `: ${resolveError}` : ''}. ` +
      'Nothing was emailed.'
    );
  }

  const reportHtml = buildOrderReportHtml(order, mergeOrderPayloadIntoResult(order, effectiveResult), lang);
  if (!reportHtml) {
    throw new Error(`No report template exists for ${order.serviceType}. Nothing was emailed.`);
  }
  const invoiceHtml = buildInvoiceHtml({ ...order, language: lang });
  const renderOptions = highQualityEmailRenderOptions();

  // Sequential rendering avoids competing canvas allocations and uses the
  // same density/quality profile as the admin live-preview download.
  const reportPdfBase64 = await generatePdfBase64FromHtml(reportHtml, renderOptions);
  assertPreviewQualityPdfBase64(reportPdfBase64, 'Report PDF', 8 * 1024);
  await yieldToBrowser();
  const invoicePdfBase64 = await generatePdfBase64FromHtml(invoiceHtml, renderOptions);
  assertPreviewQualityPdfBase64(invoicePdfBase64, 'Invoice PDF', 8 * 1024);

  return { reportPdfBase64, invoicePdfBase64 };
}

/** Keeps a download recognisable in the customer's downloads folder. */
export function safeFilePart(value: string, fallback: string): string {
  const cleaned = (value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\u0900-\u0D7F]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

export function orderReportFileName(order: Order, lang: AppLanguage): string {
  const service = (order.serviceType || 'REPORT').toLowerCase();
  const who = safeFilePart(
    familyMemberDisplayName(order) || order.userName || order.orderNumber || '',
    'Report'
  );
  return `ASTRO_SIVAM_${service}_${who}_${order.orderNumber || lang}.pdf`;
}

export function orderInvoiceFileName(order: Order): string {
  return `ASTRO_SIVAM_Invoice_${safeFilePart(order.orderNumber || order.id, 'invoice')}.pdf`;
}

/**
 * THE download path: renders the very same HTML string the live preview iframe
 * shows, with the same html2canvas + jsPDF pipeline used for family bundles, so
 * a downloaded report is pixel-identical to the preview instead of the thinner
 * server-side render.
 *
 * The first attempt uses the highest capture density the device can afford. If
 * a phone runs out of canvas memory the render is retried once at the baseline
 * density (still preview-exact, only slightly smaller) before the caller falls
 * back to the server renderer.
 */
export async function downloadHtmlPdf(
  htmlContent: string,
  fileName: string,
  options?: HtmlPdfRenderOptions
): Promise<void> {
  if (!htmlContent) throw new Error('Nothing to render — the report HTML is empty.');

  const attempts = downloadAttemptOptions(options);

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const doc = await renderHtmlToPdfDoc(htmlContent, attempt);
      doc.save(fileName);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Preview-exact PDF render failed at scale ${attempt.scale}; retrying…`, error);
      await yieldToBrowser();
    }
  }
  throw lastError || new Error('PDF rendering failed.');
}

/**
 * THE download path for the live preview: photographs the page elements of the
 * preview iframe itself — the exact DOM nodes the visitor is looking at — at
 * print density, so the saved PDF cannot differ from what is on screen.
 *
 * Same retry policy as `downloadHtmlPdf`: the best density the device can
 * afford first, then the baseline density, and only then does the caller fall
 * back to the server renderer.
 */
export async function downloadPreviewPagesPdf(
  pages: HTMLElement[],
  fileName: string,
  options?: HtmlPdfRenderOptions
): Promise<void> {
  if (!pages || pages.length === 0) {
    throw new Error('The preview has no rendered report pages yet.');
  }

  const attempts = downloadAttemptOptions(options);

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const doc = await renderPageElementsToPdfDoc(pages, attempt);
      doc.save(fileName);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Live-preview PDF capture failed at scale ${attempt.scale}; retrying…`, error);
      await yieldToBrowser();
    }
  }
  throw lastError || new Error('PDF rendering failed.');
}

/**
 * Server-render fallback. Assigning to `location.href` (instead of
 * `window.open`) works after an `await`, which popup blockers otherwise swallow
 * — the endpoints answer with `Content-Disposition: attachment`, so the browser
 * still saves the file instead of navigating away.
 */
export function downloadFromServerUrl(url: string): void {
  window.location.href = url;
}

export async function downloadServerMpdf(serviceType: string, result: any, lang: AppLanguage, fileName: string): Promise<void> {
  try {
    const res = await fetch('/api/services/export-preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType,
        result,
        language: lang
      })
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    console.error('Server mPDF download failed:', err);
  }
}

/**
 * Every service exporter below follows the same rule: build the preview HTML in
 * the browser, capture it at print resolution, and only ask the server for a
 * PDF when the browser render itself failed (out of memory, blocked canvas,
 * ancient WebView). The customer therefore receives what they saw on screen.
 */
export async function exportJathagamHtmlToPdf(
  result: HoroscopeResult,
  lang: AppLanguage = 'en',
  customFileName?: string
): Promise<void> {
  const fileName =
    customFileName || `ASTRO_SIVAM_Jathagam_${safeFilePart(result.devoteeName || '', 'User')}_${lang}.pdf`;
  try {
    await downloadHtmlPdf(buildJathagamHtml(result, lang), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered Jathagam PDF:', error);
    await downloadServerMpdf('BIRTH_JATHAGAM', result, lang, fileName);
  }
}

export async function exportWeddingHtmlToPdf(
  result: WeddingMatchResult,
  lang: AppLanguage = 'en',
  customFileName?: string
): Promise<void> {
  const fileName =
    customFileName ||
    `ASTRO_SIVAM_Matchmaking_${safeFilePart(result.brideName || '', 'Bride')}_${safeFilePart(result.groomName || '', 'Groom')}_${lang}.pdf`;
  try {
    await downloadHtmlPdf(buildWeddingMatchHtml(result, lang), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered matchmaking PDF:', error);
    await downloadServerMpdf('MARRIAGE_COMPATIBILITY', result, lang, fileName);
  }
}

export async function exportBabyNamingHtmlToPdf(
  result: BabyNamingResult,
  lang: AppLanguage = 'en',
  customFileName?: string
): Promise<void> {
  const baby = result.babyName || (result.gender === 'M' ? 'Baby_Boy' : 'Baby_Girl');
  const fileName = customFileName || `ASTRO_SIVAM_BabyNaming_${safeFilePart(baby, 'Baby')}_${lang}.pdf`;
  try {
    await downloadHtmlPdf(buildBabyNamingHtml(result, lang), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered baby naming PDF:', error);
    await downloadServerMpdf('BABY_NAMING', result, lang, fileName);
  }
}

export async function exportMuhurthamHtmlToPdf(
  result: MuhurthamScanResult,
  lang: AppLanguage = 'en',
  customFileName?: string
): Promise<void> {
  const fileName =
    customFileName ||
    `ASTRO_SIVAM_Muhurtham_${safeFilePart(result.eventKey || '', 'muhurtham')}_${safeFilePart(result.devoteeName || '', 'User')}_${lang}.pdf`;
  try {
    await downloadHtmlPdf(buildMuhurthamHtml(result, lang), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered Muhurtham PDF:', error);
    await downloadServerMpdf('MUHURTHAM', result, lang, fileName);
  }
}

export async function exportInvoiceHtmlToPdf(
  order: Order,
  _lang?: AppLanguage,
  customFileName?: string
): Promise<void> {
  const fileName = customFileName || orderInvoiceFileName(order);
  try {
    // Tax invoices are always the English official document.
    await downloadHtmlPdf(buildInvoiceHtml({ ...order, language: 'en' }), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered invoice PDF:', error);
    downloadFromServerUrl(`/api/admin/orders/${order.id}/invoice`);
  }
}

export async function exportOrderInvoicePdf(
  order: Order,
  lang?: AppLanguage,
  customFileName?: string
): Promise<void> {
  return exportInvoiceHtmlToPdf(order, lang, customFileName);
}

export async function exportFamilyInvoiceHtmlToPdf(
  familyOrders: Order[],
  familyGroupId: string,
  customFileName?: string
): Promise<void> {
  const fileName = customFileName || `ASTRO_SIVAM_Family_Invoice_${safeFilePart(familyGroupId, 'FAMILY')}.pdf`;
  try {
    await downloadHtmlPdf(buildFamilyInvoiceHtml(familyOrders, familyGroupId), fileName);
  } catch (error) {
    console.warn('Falling back to the server-rendered family invoice PDF:', error);
    downloadFromServerUrl(`/api/admin/family-orders/${encodeURIComponent(familyGroupId)}/invoice-pdf`);
  }
}

/**
 * Downloads one order's report in preview-exact quality.
 *
 * `resultOverride` lets a caller that has already calculated a fresher result
 * (the order View modal recalculates stale charts on open) pass it in, so the
 * downloaded PDF is built from exactly the data on screen.
 */
export async function exportOrderReportPdf(
  order: Order,
  preferredLang?: AppLanguage,
  resultOverride?: any
): Promise<void> {
  const lang = preferredLang || (order.language as AppLanguage) || 'ta';
  const fileName = orderReportFileName(order, lang);
  try {
    const resolved = resultOverride
      ? { result: resultOverride, error: '' }
      : await resolveCalculatedResult(order);
    const html = buildOrderReportHtml(order, mergeOrderPayloadIntoResult(order, resolved.result), lang);
    if (!html) throw new Error(
      resolved.result
        ? `No report template exists for ${order.serviceType}.`
        : resolved.error || 'The report could not be calculated from the saved inputs.'
    );
    await downloadHtmlPdf(html, fileName);
  } catch (error) {
    console.warn('Preview-exact order download failed; falling back to the server PDF:', error);
    downloadFromServerUrl(`/api/admin/orders/${order.id}/pdf?lang=${lang}`);
  }
}

export async function exportOrderPdf(
  order: Order,
  preferredLang?: AppLanguage
): Promise<void> {
  return exportOrderReportPdf(order, preferredLang);
}

/* ══════════════════════════════════════════════════════════════════════════
 * FAMILY PACKAGE — high-quality consolidated invoice + per-member reports
 *
 * The family package must be delivered with the EXACT same render quality as
 * the single-order "View" live preview in the admin panel. Everything below
 * reuses the same HTML builders + responsive high-resolution html2canvas/jsPDF
 * pipeline (3× desktop, 2.5× mobile), never a server-side substitute.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface FamilyReportPdfItem {
  orderId: string;
  orderNumber: string;
  fileName: string;
  pdfBase64: string;
}

export interface FamilyOrderPdfs {
  reportPdfs: FamilyReportPdfItem[];
  invoicePdfBase64: string;
  invoiceFileName: string;
}

export function getFamilyGroupId(orders: Order[], groupId?: string): string {
  return (
    groupId ||
    orders.find(o => (o as any).groupId)?.groupId ||
    orders[0]?.orderNumber ||
    'FAMILY'
  );
}

export async function generateFamilyInvoicePdfBase64(
  orders: Order[],
  groupId?: string
): Promise<string> {
  const effectiveGroupId = getFamilyGroupId(orders, groupId);
  const pdfBase64 = await generatePdfBase64FromHtml(
    buildFamilyInvoiceHtml(orders, effectiveGroupId),
    highQualityEmailRenderOptions()
  );
  assertPreviewQualityPdfBase64(pdfBase64, 'Family invoice PDF', 8 * 1024);
  return pdfBase64;
}

/** Birth-time / birth-date keys used by the flat and the nested payload shapes. */
const BIRTH_TIME_KEYS = ['tob', 'brideTob', 'girlTob', 'p1Tob', 'groomTob', 'boyTob', 'p2Tob'];
const BIRTH_DATE_KEYS = ['dob', 'brideDob', 'girlDob', 'p1Dob', 'groomDob', 'boyDob', 'p2Dob'];
const NESTED_BIRTH_PEOPLE = [
  'bride', 'groom', 'girl', 'boy', 'brideDetails', 'groomDetails',
  'p1', 'p2', 'partner', 'baby', 'child', 'native'
];

/**
 * The payload the astrology engines accept for a recalculation.
 *
 * The TypeScript and PHP engines consume a canonical `YYYY-MM-DD` / 24-hour `HH:MM` wall clock,
 * but saved rows may hold what the customer typed (`6:30`, `06:30:00`,
 * `6:30 PM` — the PHP API accepts and stores all three). Sending those bytes
 * unchanged made the recalculation itself fail with "the saved birth date,
 * time, place, coordinates, or time zone are incomplete", so the member could
 * never be rescued. Only the calculation-driving date/time fields are
 * rewritten; the stored order keeps exactly what the customer typed.
 */
export function canonicalCalculationPayload(payload: any): any {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const canonicalFields = (source: any): any => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
    const next = { ...source };
    for (const key of BIRTH_TIME_KEYS) {
      if (next[key] !== undefined) next[key] = canonicalBirthTime(next[key]) || next[key];
    }
    for (const key of BIRTH_DATE_KEYS) {
      if (next[key] !== undefined) next[key] = canonicalBirthDate(next[key]) || next[key];
    }
    return next;
  };
  const next = canonicalFields(payload);
  for (const key of NESTED_BIRTH_PEOPLE) {
    if (next[key] && typeof next[key] === 'object') next[key] = canonicalFields(next[key]);
  }
  return next;
}

/**
 * Ensures an order has its calculated astrology result, computing it on the
 * fly through the same calculate-preview API the live preview modal uses.
 * Stale results (older algorithm versions) are recalculated too, exactly like
 * the single-order live preview does.
 *
 * When no result can be resolved, `error` carries the concrete reason (for
 * example the server's "the saved birth date, time, place, coordinates, or
 * time zone are incomplete" message) so the skip/abort the operator sees says
 * WHAT to fix on the order instead of a generic "no results available".
 */
export interface ResolvedOrderResult {
  result: any;
  error: string;
}

export async function resolveCalculatedResult(order: Order): Promise<ResolvedOrderResult> {
  const needsRecalculation = resultNeedsRecalculation(order, order.calculatedResult);
  if (order.calculatedResult && !needsRecalculation) return { result: order.calculatedResult, error: '' };
  // A stale result is never a fallback when its original input is unavailable.
  if (!order.inputPayload) {
    return {
      result: null,
      error: 'the saved chart is outdated and the saved birth particulars are missing, so it cannot be recalculated'
    };
  }
  try {
    const { api } = await import('./api');
    const res = await api.calculateService(
      orderChartServiceType(order),
      canonicalCalculationPayload(order.inputPayload)
    );
    if (res.success && res.result && !resultNeedsRecalculation(order, res.result)) {
      return { result: res.result, error: '' };
    }
    return {
      result: null,
      error: res.message || 'the recalculated chart was rejected as inconsistent with the saved birth inputs'
    };
  } catch (e) {
    console.warn('Failed to calculate result for family member report; the stale result will not be used:', e);
    return { result: null, error: e instanceof Error ? e.message : 'the calculation request failed' };
  }
}

/** Progress report emitted while a family bundle is rendered member by member. */
export interface FamilyRenderProgress {
  /** calculating = fetching/refreshing the chart, rendering = html2canvas, uploading = staging the PDF */
  phase: 'calculating' | 'rendering' | 'uploading' | 'invoice' | 'done';
  index: number;
  total: number;
  memberName: string;
  orderNumber: string;
  message: string;
  bytes?: number;
  elapsedMs?: number;
}

export type FamilyRenderProgressCallback = (progress: FamilyRenderProgress) => void;

export interface FamilyStagingResult {
  /**
   * 'staged'  - every document was uploaded with its own request (the normal
   *             path; the approve call then only carries metadata).
   * 'inline'  - small legacy bundles use a bounded base64 payload; larger
   *             bundles fail closed if the staging endpoint is unavailable.
   */
  mode: 'staged' | 'inline';
  stagedReports: number;
  stagedInvoice: boolean;
  stagedBytes: number;
  skipped: Array<{ orderNumber: string; memberName: string; reason: string }>;
  warnings: string[];
  /** Only populated when mode === 'inline' (or for documents that failed to stage). */
  reportPdfs: FamilyReportPdfItem[];
  invoicePdfBase64: string;
  invoiceFileName: string;
}

const FAMILY_RENDER_HINT_SECONDS = 8;
const MAX_FAMILY_INLINE_BYTES = 5 * 1024 * 1024;

/**
 * Renders a whole family bundle in live-preview quality the SAME way the admin
 * panel renders a single order: one report at a time, with each finished PDF
 * uploaded immediately, then the consolidated family invoice.
 *
 * Uploading one document per request avoids request-body limits. Render or
 * upload failures are retried and then fail closed; the backend never replaces
 * a missing preview render with a lower-quality server-side PDF.
 */
export async function stageFamilyOrderPdfs(
  orders: Order[],
  groupId?: string,
  onProgress?: FamilyRenderProgressCallback,
  options?: { preferredLang?: AppLanguage; stagingAudience?: 'admin' | 'customer' }
): Promise<FamilyStagingResult> {
  const { api } = await import('./api');

  const effectiveGroupId = getFamilyGroupId(orders, groupId);
  const stageDocument = (doc: Parameters<typeof api.stageFamilyDoc>[1]) =>
    options?.stagingAudience === 'customer'
      ? api.stageCustomerFamilyDoc(effectiveGroupId, doc)
      : api.stageFamilyDoc(effectiveGroupId, doc);
  const clearStagedScope = () => options?.stagingAudience === 'customer'
    ? api.clearCustomerFamilyStagedDocs(effectiveGroupId)
    : api.clearFamilyStagedDocs(effectiveGroupId);
  const sorted = [...orders].sort(
    (a, b) => ((a as any).groupOrderIndex ?? 0) - ((b as any).groupOrderIndex ?? 0)
  );
  const total = sorted.length;

  const result: FamilyStagingResult = {
    mode: 'staged',
    stagedReports: 0,
    stagedInvoice: false,
    stagedBytes: 0,
    skipped: [],
    warnings: [],
    reportPdfs: [],
    invoicePdfBase64: '',
    invoiceFileName: `ASTRO_SIVAM_Family_Invoice_${effectiveGroupId}.pdf`
  };

  const base64ToBytes = (b64: string) => Math.round((b64.length * 3) / 4);
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
  const renderOptions = highQualityEmailRenderOptions();

  // A group id is reused on retries. Never merge this render with files left
  // by an interrupted earlier attempt, for either an admin or customer resend.
  await clearStagedScope();

  const retryStage = async (
    doc: Parameters<typeof api.stageFamilyDoc>[1],
    initial: Awaited<ReturnType<typeof api.stageFamilyDoc>>
  ) => {
    let response = initial;
    for (let attempt = 1; attempt < 3 && !response.staged && !response.unsupported; attempt++) {
      await new Promise(r => setTimeout(r, 600 * attempt));
      response = await stageDocument(doc);
    }
    return response;
  };

  for (let i = 0; i < total; i++) {
    const order = sorted[i];
    const memberName = familyMemberDisplayName(order);
    const lang = (options?.preferredLang || (order.language as AppLanguage) || 'ta');
    const startedAt = Date.now();

    onProgress?.({
      phase: 'calculating',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      message: `Preparing ${memberName}'s chart (${i + 1} of ${total})...`
    });

    const resolved = await resolveCalculatedResult(order);
    const reportHtml = buildOrderReportHtml(
      order,
      mergeOrderPayloadIntoResult(order, resolved.result),
      lang
    );

    if (!reportHtml) {
      // Say exactly WHY: a missing template vs. a birth-data problem, with the
      // server's message when the recalculation rejected the saved inputs.
      const reason = resolved.result
        ? `no report template exists for service type ${order.serviceType}`
        : `no calculated astrology result available for this member: ` +
          `${resolved.error || 'the saved chart and birth particulars could not be resolved'} ` +
          "- verify this member's saved birth date, time, place, coordinates and time zone on the order";
      result.skipped.push({ orderNumber: order.orderNumber, memberName, reason });
      result.warnings.push(`#${order.orderNumber} (${memberName}) was skipped: ${reason}.`);
      continue;
    }

    onProgress?.({
      phase: 'rendering',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      message: `Rendering high-quality report for ${memberName} (${i + 1} of ${total}) - about ${FAMILY_RENDER_HINT_SECONDS}s...`
    });
    await yieldToBrowser();
    await new Promise(r => setTimeout(r, 300));

    const safeName = memberName.replace(/[^a-zA-Z0-9_\u0900-\u0D7F]/g, '_');
    const fileName = `ASTRO_SIVAM_Report_${order.orderNumber}_${safeName}_${lang}.pdf`;

    let pdfBase64 = '';
    let renderAttempts = 0;
    let finalRenderMs = 0;
    while (renderAttempts < 3) {
      const renderStart = Date.now();
      pdfBase64 = await generatePdfBase64FromHtml(reportHtml, renderOptions);
      assertPreviewQualityPdfBase64(pdfBase64, `Report PDF for ${order.orderNumber}`);
      const renderMs = Date.now() - renderStart;
      finalRenderMs = renderMs;
      const b = base64ToBytes(pdfBase64);
      const isTooSmall = b < 120 * 1024;
      const isTooFast = renderMs < 1200 && b < 300 * 1024;

      if ((isTooSmall || isTooFast) && renderAttempts < 2) {
        console.warn(
          `Report for ${memberName} looks low-quality (bytes=${b}, ms=${renderMs}), retrying...`
        );
        onProgress?.({
          phase: 'rendering',
          index: i + 1,
          total,
          memberName,
          orderNumber: order.orderNumber,
          message: `Low-quality capture detected for ${memberName}, retrying high-quality render...`
        });
        await new Promise(r => setTimeout(r, 800 + renderAttempts * 500));
        renderAttempts++;
        continue;
      }
      break;
    }

    const bytes = base64ToBytes(pdfBase64);
    const elapsedMs = Date.now() - startedAt;

    if (bytes < 120 * 1024 || (finalRenderMs < 1200 && bytes < 300 * 1024)) {
      const reason = `rendered PDF failed the high-quality check (${mb(bytes)}, ${(finalRenderMs / 1000).toFixed(1)}s)`;
      result.skipped.push({ orderNumber: order.orderNumber, memberName, reason });
      result.warnings.push(`#${order.orderNumber} (${memberName}) was not staged: ${reason}.`);
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    onProgress?.({
      phase: 'uploading',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      bytes,
      elapsedMs,
      message: `Uploading ${memberName}'s ${mb(bytes)} report (rendered in ${(elapsedMs / 1000).toFixed(1)}s)...`
    });
    await yieldToBrowser();

    let stageRes = await stageDocument({
      kind: 'report',
      orderId: order.id,
      orderNumber: order.orderNumber,
      fileName,
      pdfBase64
    });
    if (!stageRes.staged && !stageRes.unsupported) {
      stageRes = await retryStage({
        kind: 'report', orderId: order.id, orderNumber: order.orderNumber, fileName, pdfBase64
      }, stageRes);
    }

    if (stageRes.success && stageRes.staged) {
      result.stagedReports++;
      result.stagedBytes += stageRes.sizeBytes || bytes;
    } else {
      if (stageRes.unsupported && total > 2) {
        await clearStagedScope().catch(() => undefined);
        throw new Error(
          'The preview-PDF upload endpoint is unavailable for this family bundle. ' +
          'Nothing was emailed; install the current API staging routes and retry.'
        );
      }
      if (stageRes.unsupported) {
        result.mode = 'inline';
      }
      const reason = stageRes.message || 'staging endpoint rejected the document';
      result.warnings.push(`#${order.orderNumber} (${memberName}): ${reason}`);
      result.reportPdfs.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        fileName,
        pdfBase64
      });
    }

    onProgress?.({
      phase: 'rendering',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      bytes,
      elapsedMs: Date.now() - startedAt,
      message: `${memberName}'s report ready (${i + 1} of ${total}) - ${mb(bytes)}.`
    });

    await new Promise(r => setTimeout(r, 700));
    await yieldToBrowser();
  }

  onProgress?.({
    phase: 'invoice',
    index: total,
    total,
    memberName: 'Family invoice',
    orderNumber: effectiveGroupId,
    message: `Rendering the consolidated family tax invoice for ${total} user(s)...`
  });
  await yieldToBrowser();
  await new Promise(r => setTimeout(r, 400));

  const invoiceHtml = buildFamilyInvoiceHtml(sorted, effectiveGroupId);

  let invoicePdfBase64 = '';
  let invAttempts = 0;
  let finalInvoiceMs = 0;
  while (invAttempts < 3) {
    const invStart = Date.now();
    invoicePdfBase64 = await generatePdfBase64FromHtml(invoiceHtml, renderOptions);
    assertPreviewQualityPdfBase64(invoicePdfBase64, 'Family invoice PDF');
    const invMs = Date.now() - invStart;
    finalInvoiceMs = invMs;
    const invBytes = base64ToBytes(invoicePdfBase64);
    const tooSmall = invBytes < 80 * 1024;
    const tooFast = invMs < 800 && invBytes < 200 * 1024;
    if ((tooSmall || tooFast) && invAttempts < 2) {
      console.warn(`Family invoice low-quality (bytes=${invBytes}, ms=${invMs}), retrying...`);
      await new Promise(r => setTimeout(r, 600 + invAttempts * 400));
      invAttempts++;
      continue;
    }
    break;
  }

  const invoiceBytes = base64ToBytes(invoicePdfBase64);
  if (invoiceBytes < 80 * 1024 || (finalInvoiceMs < 800 && invoiceBytes < 200 * 1024)) {
    throw new Error(
      `The consolidated invoice failed the high-quality render check (${mb(invoiceBytes)}, ${(finalInvoiceMs / 1000).toFixed(1)}s). ` +
      'Nothing was emailed. Please retry; the already-staged partial run will be replaced.'
    );
  }

  let invoiceStageRes = await stageDocument({
    kind: 'invoice',
    fileName: result.invoiceFileName,
    pdfBase64: invoicePdfBase64
  });
  if (!invoiceStageRes.staged && !invoiceStageRes.unsupported) {
    invoiceStageRes = await retryStage({
      kind: 'invoice', fileName: result.invoiceFileName, pdfBase64: invoicePdfBase64
    }, invoiceStageRes);
  }

  if (invoiceStageRes.success && invoiceStageRes.staged) {
    result.stagedInvoice = true;
    result.stagedBytes += invoiceStageRes.sizeBytes || invoiceBytes;
  } else {
    if (invoiceStageRes.unsupported && total > 2) {
      await clearStagedScope().catch(() => undefined);
      throw new Error(
        'The preview-PDF upload endpoint is unavailable for this family bundle. ' +
        'Nothing was emailed; install the current API staging routes and retry.'
      );
    }
    if (invoiceStageRes.unsupported) {
      result.mode = 'inline';
    }
    result.warnings.push(
      `Consolidated family invoice: ${invoiceStageRes.message || 'could not be staged'}`
    );
    result.invoicePdfBase64 = invoicePdfBase64;
  }

  if (result.reportPdfs.length > 0 || result.invoicePdfBase64) {
    const inlineBytes =
      result.reportPdfs.reduce((sum, r) => sum + base64ToBytes(r.pdfBase64), 0) +
      (result.invoicePdfBase64 ? base64ToBytes(result.invoicePdfBase64) : 0);
    if (inlineBytes > MAX_FAMILY_INLINE_BYTES) {
      await clearStagedScope().catch(() => undefined);
      throw new Error(
        `${mb(inlineBytes)} of preview-quality PDFs could not be staged and will exceed the safe request limit. ` +
        'Nothing was emailed; restore the document-upload route and retry.'
      );
    }
    if (result.mode === 'staged') {
      result.mode = result.stagedReports > 0 || result.stagedInvoice ? 'staged' : 'inline';
    }
  }

  onProgress?.({
    phase: 'done',
    index: total,
    total,
    memberName: 'Family package',
    orderNumber: effectiveGroupId,
    message: `Preview-quality rendering complete: ${result.stagedReports + result.reportPdfs.length} report(s) + 1 invoice (${mb(
      result.stagedBytes
    )}).`
  });

  return result;
}



/**
 * Renders the FULL family package client-side in live-preview quality:
 * one high-resolution report PDF per member + ONE consolidated family tax
 * invoice, all produced from the exact same HTML the admin live preview shows.
 *
 * Kept for the inline (single-body) delivery path and for callers that only
 * need the documents locally; `stageFamilyOrderPdfs` is the preferred pipeline
 * because it uploads each PDF separately and therefore never hits the server's
 * request-body limit.
 */
export async function generateFamilyOrderPdfsBase64(
  orders: Order[],
  groupId?: string,
  onProgress?: FamilyRenderProgressCallback,
  options?: { preferredLang?: AppLanguage }
): Promise<FamilyOrderPdfs> {
  const effectiveGroupId = getFamilyGroupId(orders, groupId);
  const sorted = [...orders].sort(
    (a, b) => ((a as any).groupOrderIndex ?? 0) - ((b as any).groupOrderIndex ?? 0)
  );
  const total = sorted.length;
  const reportPdfs: FamilyReportPdfItem[] = [];
  const renderOptions = highQualityEmailRenderOptions();

  for (let i = 0; i < total; i++) {
    const order = sorted[i];
    const memberName = familyMemberDisplayName(order);
    const lang = (options?.preferredLang || (order.language as AppLanguage) || 'ta');
    const startedAt = Date.now();

    onProgress?.({
      phase: 'calculating',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      message: `Preparing ${memberName}'s chart (${i + 1} of ${total})...`
    });

    const resolved = await resolveCalculatedResult(order);
    const reportHtml = buildOrderReportHtml(
      order,
      mergeOrderPayloadIntoResult(order, resolved.result),
      lang
    );

    if (!reportHtml) {
      throw new Error(
        `No preview-quality report is available for ${order.orderNumber}` +
        (resolved.error ? ` (${resolved.error})` : '') +
        `. Nothing was emailed.`
      );
    }

    onProgress?.({
      phase: 'rendering',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      message: `Rendering high-quality report for ${memberName} (${i + 1} of ${total}) - about ${FAMILY_RENDER_HINT_SECONDS}s...`
    });
    await yieldToBrowser();
    await new Promise(r => setTimeout(r, 300));

    const safeName = memberName.replace(/[^a-zA-Z0-9_\u0900-\u0D7F]/g, '_');
    const fileName = `ASTRO_SIVAM_Report_${order.orderNumber}_${safeName}_${lang}.pdf`;

    // Quality-validated sequential render
    let pdfBase64 = '';
    let attempts = 0;
    let finalRenderMs = 0;
    while (attempts < 3) {
      const s = Date.now();
      pdfBase64 = await generatePdfBase64FromHtml(reportHtml, renderOptions);
      assertPreviewQualityPdfBase64(pdfBase64, `Report PDF for ${order.orderNumber}`);
      const ms = Date.now() - s;
      finalRenderMs = ms;
      const b = Math.round((pdfBase64.length * 3) / 4);
      if ((b < 120 * 1024 || (ms < 1200 && b < 300 * 1024)) && attempts < 2) {
        await new Promise(r => setTimeout(r, 700 + attempts * 400));
        attempts++;
        continue;
      }
      break;
    }
    const finalReportBytes = Math.round((pdfBase64.length * 3) / 4);
    if (finalReportBytes < 120 * 1024 || (finalRenderMs < 1200 && finalReportBytes < 300 * 1024)) {
      throw new Error(
        `The preview-quality report for ${order.orderNumber} failed validation. Nothing was emailed.`
      );
    }

    reportPdfs.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      fileName,
      pdfBase64
    });

    onProgress?.({
      phase: 'rendering',
      index: i + 1,
      total,
      memberName,
      orderNumber: order.orderNumber,
      bytes: Math.round((pdfBase64.length * 3) / 4),
      elapsedMs: Date.now() - startedAt,
      message: `${memberName}'s report rendered (${i + 1} of ${total}).`
    });
    await new Promise(r => setTimeout(r, 600));
    await yieldToBrowser();
  }

  const invoiceHtml = buildFamilyInvoiceHtml(sorted, effectiveGroupId);
  let invoicePdfBase64 = '';
  let invAttempts = 0;
  let finalInvoiceMs = 0;
  while (invAttempts < 3) {
    const s = Date.now();
    invoicePdfBase64 = await generatePdfBase64FromHtml(invoiceHtml, renderOptions);
    assertPreviewQualityPdfBase64(invoicePdfBase64, 'Family invoice PDF');
    const ms = Date.now() - s;
    finalInvoiceMs = ms;
    const b = Math.round((invoicePdfBase64.length * 3) / 4);
    if ((b < 80 * 1024 || (ms < 800 && b < 200 * 1024)) && invAttempts < 2) {
      await new Promise(r => setTimeout(r, 600 + invAttempts * 400));
      invAttempts++;
      continue;
    }
    break;
  }
  const finalInvoiceBytes = Math.round((invoicePdfBase64.length * 3) / 4);
  if (finalInvoiceBytes < 80 * 1024 || (finalInvoiceMs < 800 && finalInvoiceBytes < 200 * 1024)) {
    throw new Error('The preview-quality family invoice failed validation. Nothing was emailed.');
  }
  const invoiceFileName = `ASTRO_SIVAM_Family_Invoice_${effectiveGroupId}.pdf`;

  return { reportPdfs, invoicePdfBase64, invoiceFileName };
}

/** Payload accepted by api.approveFamilyOrder / api.resendFamilyEmail. */
export interface FamilyFulfilPayloadPreparation {
  payload: {
    useStagedDocs?: boolean;
    stagedReports?: number;
    stagedInvoice?: boolean;
    stagedBytes?: number;
    reportPdfs?: FamilyReportPdfItem[];
    invoicePdfBase64?: string;
    language: string;
    requirePreviewQuality: true;
  };
  staging: FamilyStagingResult;
  memberCount: number;
}

/**
 * One-call helper shared by every "approve / send family email" button (admin
 * order list, family card, order View modal and the live PDF preview): renders
 * each member report + the consolidated invoice in live-preview quality,
 * uploads them one document per request, and returns the small payload the
 * approval endpoint needs.
 *
 * Small legacy bundles may use a bounded inline payload when the staging route
 * is absent. Larger bundles fail closed instead of risking a discarded request
 * body or a server-rendered downgrade.
 */
export async function prepareFamilyFulfilPayload(
  orders: Order[],
  groupId?: string,
  onProgress?: FamilyRenderProgressCallback,
  options?: { preferredLang?: AppLanguage; stagingAudience?: 'admin' | 'customer' }
): Promise<FamilyFulfilPayloadPreparation> {
  const staging = await stageFamilyOrderPdfs(orders, groupId, onProgress, options);
  const language = (options?.preferredLang ||
    (orders[0]?.language as AppLanguage) ||
    'ta') as string;

  // All-or-nothing fulfilment: never call approve when member 4 (or any later
  // member) failed capture/upload. The old partial-success behaviour let the
  // backend silently substitute a lower-quality server report, which is why a
  // 4+ member package looked inconsistent. This invariant is independent of N.
  const readyReports = staging.stagedReports + staging.reportPdfs.length;
  const invoiceReady = staging.stagedInvoice || !!staging.invoicePdfBase64;
  if (staging.skipped.length > 0 || readyReports !== orders.length || !invoiceReady) {
    const details = staging.warnings.length ? ` ${staging.warnings.join(' ')}` : '';
    throw new Error(
      `Family package is not complete (${readyReports}/${orders.length} high-quality reports, invoice ${invoiceReady ? 'ready' : 'missing'}). ` +
      `Nothing was emailed; retry the render.${details}`
    );
  }

  if (staging.stagedReports > 0 || staging.stagedInvoice) {
    return {
      payload: {
        useStagedDocs: true,
        stagedReports: staging.stagedReports,
        stagedInvoice: staging.stagedInvoice,
        stagedBytes: staging.stagedBytes,
        language,
        requirePreviewQuality: true,
        // Documents that could not be staged still travel inline.
        ...(staging.reportPdfs.length > 0 ? { reportPdfs: staging.reportPdfs } : {}),
        ...(staging.invoicePdfBase64 ? { invoicePdfBase64: staging.invoicePdfBase64 } : {})
      },
      staging,
      memberCount: orders.length
    };
  }

  return {
    payload: {
      reportPdfs: staging.reportPdfs,
      invoicePdfBase64: staging.invoicePdfBase64,
      language,
      requirePreviewQuality: true
    },
    staging,
    memberCount: orders.length
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * SINGLE ORDER — same protection as the family pipeline
 *
 * A single order usually fits in one request body; unusually large reports or
 * invoices are staged one document per request. If staging still fails and the
 * remaining inline payload exceeds the safe request limit, fulfillment aborts
 * before the server can email a lower-quality substitute.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Base64 payload size above which a single order is uploaded document-by-document. */
export const SINGLE_ORDER_INLINE_LIMIT_BYTES = 5 * 1024 * 1024;

/**
 * Keeps a single order's delivery inside the server's request-body limit.
 * Small PDFs remain inline; large PDFs are staged individually, and an
 * oversized unstaged payload throws instead of being silently discarded.
 */
export async function deliverOrderPdfPayload(
  order: Order,
  payload: { reportPdfBase64: string; invoicePdfBase64: string; language?: string },
  options?: { stagingAudience?: 'admin' | 'customer' }
): Promise<{
  reportPdfBase64?: string;
  invoicePdfBase64?: string;
  language?: string;
  useStagedDocs?: boolean;
  stagedDocs?: number;
  requirePreviewQuality: true;
}> {
  const reportBytes = assertPreviewQualityPdfBase64(payload.reportPdfBase64, 'Report PDF', 8 * 1024);
  const invoiceBytes = assertPreviewQualityPdfBase64(payload.invoicePdfBase64, 'Invoice PDF', 8 * 1024);
  const approxBytes = reportBytes + invoiceBytes;

  if (approxBytes <= SINGLE_ORDER_INLINE_LIMIT_BYTES) {
    return { ...payload, requirePreviewQuality: true };
  }

  const { api } = await import('./api');
  const stageOrderDocument = (doc: Parameters<typeof api.stageOrderDoc>[1]) =>
    options?.stagingAudience === 'customer'
      ? api.stageCustomerOrderDoc(order.id, doc)
      : api.stageOrderDoc(order.id, doc);
  const clearOrderScope = () => options?.stagingAudience === 'customer'
    ? api.clearCustomerOrderStagedDocs(order.id)
    : api.clearOrderStagedDocs(order.id);
  const stageWithRetry = async (doc: Parameters<typeof api.stageOrderDoc>[1]) => {
    let response = await stageOrderDocument(doc);
    for (let attempt = 1; attempt < 3 && !response.staged && !response.unsupported; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 600 * attempt));
      response = await stageOrderDocument(doc);
    }
    return response;
  };

  // Reused order ids can have leftovers from a prior partial attempt. Clearing
  // this scope first prevents an older staged PDF from winning a resend retry.
  await clearOrderScope();

  const reportRes = await stageWithRetry({
    kind: 'report',
    orderId: order.id,
    orderNumber: order.orderNumber,
    fileName: `ASTRO_SIVAM_Report_${order.orderNumber}.pdf`,
    pdfBase64: payload.reportPdfBase64
  });
  const invoiceRes = await stageWithRetry({
    kind: 'invoice',
    fileName: `ASTRO_SIVAM_Invoice_${order.orderNumber}.pdf`,
    pdfBase64: payload.invoicePdfBase64
  });
  const reportStaged = reportRes.success && reportRes.staged;
  const invoiceStaged = invoiceRes.success && invoiceRes.staged;
  const stagedDocs = Number(reportStaged) + Number(invoiceStaged);
  const inlineBytes = (reportStaged ? 0 : reportBytes) + (invoiceStaged ? 0 : invoiceBytes);

  if (inlineBytes > SINGLE_ORDER_INLINE_LIMIT_BYTES) {
    await clearOrderScope().catch(() => undefined);
    throw new Error(
      'The preview-quality PDFs could not be uploaded and exceed the safe request limit. ' +
      'Nothing was emailed; restore the document-upload route and retry.'
    );
  }

  return {
    language: payload.language,
    useStagedDocs: stagedDocs > 0,
    stagedDocs,
    requirePreviewQuality: true,
    ...(reportStaged ? {} : { reportPdfBase64: payload.reportPdfBase64 }),
    ...(invoiceStaged ? {} : { invoicePdfBase64: payload.invoicePdfBase64 })
  };
}
