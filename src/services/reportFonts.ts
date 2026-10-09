/**
 * ASTRO SIVAM — report webfonts, in ONE place.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 * The live preview is a real `<iframe>`: the browser loads the Google Fonts
 * stylesheet, paints the report with the correct typefaces and keeps
 * re-laying it out until every face has arrived.
 *
 * The download, however, is produced by html2canvas, which clones the report
 * into a brand-new (hidden) iframe and photographs it. That clone starts with
 * an EMPTY font cache: the report stylesheet is fetched again, the font files
 * are requested again, and the capture used to happen a few milliseconds after
 * the clone was created — i.e. while the browser was still falling back to
 * Georgia / Times / system sans. Two engines then disagree:
 *
 *   preview  → 'Baloo Thambi 2' / 'Noto Sans Tamil' / 'Cinzel' glyphs
 *   download → fallback serif, different metrics, different line breaks,
 *              text that looks thinner/blurrier — "the quality is different"
 *
 * The fix is to make the capture wait for EXACTLY the same faces the preview
 * uses (the clone inherits the stylesheet, we just have to hold it still until
 * the fonts have really arrived), and to verify that they did.
 *
 * Everything here is dependency-free so it can run in the browser (parent
 * document, preview iframe and html2canvas clone document) and be asserted in
 * the Node test suite.
 */

/** id of the injected `<link rel="stylesheet">` so it is only added once. */
export const REPORT_FONT_LINK_ID = 'astrosivam-report-fonts';

/**
 * Every family used by every report builder (jathagam, wedding match, baby
 * naming, muhurtham, invoice) in one request — the same URL the reports import
 * through `@import`, so the browser reuses a single cached stylesheet.
 */
export const REPORT_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900' +
  '&family=Baloo+Thambi+2:wght@600;700;800' +
  '&family=Yatra+One' +
  '&family=Plus+Jakarta+Sans:wght@400;500;600;700;800' +
  '&family=Noto+Sans:wght@400;500;600;700;800' +
  '&family=Noto+Sans+Tamil:wght@400;500;600;700;800' +
  '&family=Noto+Sans+Devanagari:wght@400;500;600;700;800' +
  '&display=swap';

/** Ready-made tag the HTML builders drop into `<head>` (parallel to @import). */
export const REPORT_FONT_LINK_TAG =
  `<link id="${REPORT_FONT_LINK_ID}" rel="stylesheet" href="${REPORT_FONTS_HREF}">`;

/** Latin + Tamil + Devanagari sample, so each family is really measured. */
export const REPORT_FONT_SAMPLE = 'AaBbGg 0123 தமிழ் हिन्दी';

/** The families a report can ask for (used for the "did they arrive?" report). */
export const REPORT_FONT_FAMILIES = [
  'Plus Jakarta Sans',
  'Cinzel',
  'Baloo Thambi 2',
  'Yatra One',
  'Noto Sans',
  'Noto Sans Tamil',
  'Noto Sans Devanagari'
] as const;

/** CSS font shorthand specs, i.e. what `document.fonts.load/check` expect. */
export const REPORT_FONT_SPECS: string[] = [
  '400 16px "Plus Jakarta Sans"',
  '600 16px "Plus Jakarta Sans"',
  '700 16px "Plus Jakarta Sans"',
  '800 16px "Plus Jakarta Sans"',
  '600 21px "Cinzel"',
  '700 21px "Cinzel"',
  '800 21px "Cinzel"',
  '700 21px "Baloo Thambi 2"',
  '800 21px "Baloo Thambi 2"',
  '400 21px "Yatra One"',
  '400 16px "Noto Sans"',
  '700 16px "Noto Sans"',
  '400 16px "Noto Sans Tamil"',
  '600 16px "Noto Sans Tamil"',
  '700 16px "Noto Sans Tamil"',
  '800 16px "Noto Sans Tamil"',
  '400 16px "Noto Sans Devanagari"',
  '700 16px "Noto Sans Devanagari"'
];

export interface ReportFontStatus {
  /** Every face resolved (or the document has no Font Loading API at all). */
  ready: boolean;
  /** Specs the browser could not resolve — empty on a healthy device. */
  missing: string[];
  /** True when the Font Loading API is unavailable (we simply cannot tell). */
  unsupported: boolean;
}

function withTimeout<T>(promise: Promise<T> | undefined, ms: number): Promise<T | undefined> {
  if (!promise) return Promise.resolve(undefined);
  return new Promise<T | undefined>(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(undefined);
    }, ms);
    promise.then(
      value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

function fontFaceSetOf(doc: Document): FontFaceSet | null {
  const fonts = (doc as any)?.fonts;
  return fonts && typeof fonts.load === 'function' && typeof fonts.check === 'function' ? (fonts as FontFaceSet) : null;
}

/**
 * Adds the report stylesheet to `doc` (idempotent) and resolves with the link
 * element so callers can wait for it. Works for the page document, a preview
 * iframe document and html2canvas' clone document.
 */
export function injectReportFontStylesheet(doc: Document): HTMLLinkElement | null {
  if (!doc || !doc.head) return null;
  const existing = doc.getElementById(REPORT_FONT_LINK_ID) as HTMLLinkElement | null;
  if (existing) return existing;
  const link = doc.createElement('link');
  link.id = REPORT_FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = REPORT_FONTS_HREF;
  link.setAttribute('data-astrosivam', 'report-fonts');
  doc.head.appendChild(link);
  return link;
}

/** Resolves once the stylesheet has been applied (or the timeout elapses). */
export async function waitForReportStylesheet(
  link: HTMLLinkElement | null,
  timeoutMs = 4000
): Promise<void> {
  if (!link) return;
  if ((link as any).sheet) return;
  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    link.addEventListener('load', finish);
    link.addEventListener('error', finish);
  });
}

/**
 * THE parity guarantee: block until every face a report can use is really
 * available in `doc` (or until the timeout, so a blocked Google Fonts CDN can
 * never hang a download — in that case the preview would have shown the same
 * fallback glyphs, so preview and download still match).
 *
 * Call it:
 *   • in the page document before a capture (so the container lays out with
 *     the real fonts),
 *   • inside html2canvas' `onclone` for the clone document (html2canvas awaits
 *     an async `onclone`, which is exactly the hook we need),
 *   • on the preview iframe's document if you want to be sure the preview and
 *     the PDF are generated from identical text metrics.
 */
export async function ensureReportFonts(
  doc: Document,
  options?: { timeoutMs?: number; fonts?: string[] }
): Promise<ReportFontStatus> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const specs = options?.fonts ?? REPORT_FONT_SPECS;

  if (!doc) return { ready: false, missing: [...specs], unsupported: true };

  const link = injectReportFontStylesheet(doc);
  // The stylesheet only needs to be awaited the very first time; afterwards it
  // is served from the HTTP cache and `link.sheet` is already set.
  await waitForReportStylesheet(link, Math.min(4000, timeoutMs));

  const fontSet = fontFaceSetOf(doc);
  if (!fontSet) return { ready: true, missing: [], unsupported: true };

  // Explicitly request each face: `document.fonts.ready` alone can resolve
  // before a lazily-imported family has even been requested.
  await withTimeout(
    Promise.all(
      specs.map(spec => fontSet.load(spec, REPORT_FONT_SAMPLE).catch(() => undefined as any))
    ),
    timeoutMs
  );
  await withTimeout(fontSet.ready as Promise<FontFaceSet>, timeoutMs);

  let missing: string[] = [];
  try {
    missing = specs.filter(spec => !fontSet.check(spec, REPORT_FONT_SAMPLE));
  } catch {
    missing = [];
  }
  return { ready: missing.length === 0, missing, unsupported: false };
}

/**
 * Fire-and-forget warm-up: request the stylesheet + faces while the visitor is
 * still reading the preview, so the download starts with a warm font cache.
 */
export function warmReportFonts(doc: Document = document): void {
  if (!doc) return;
  void ensureReportFonts(doc, { timeoutMs: 8000 }).catch(() => undefined);
}
