/**
 * DEV/TEST HARNESS: the report's real typefaces for a headless browser.
 *
 * The report HTML asks Google Fonts for its faces. A sandboxed test browser has
 * no route to fonts.googleapis.com, so without this harness every report would
 * be measured and screenshotted in fallback fonts - Latin in DejaVu, and Tamil
 * or Devanagari as .notdef boxes (tofu). Measurements would then be of a layout
 * the customer never sees.
 *
 * This module supplies the exact families the reports request, fulfilled from
 * the repository's own shipped Noto/Cinzel/Baloo files (api/astrology/fonts -
 * the same files the PDF renderers embed), so the browser suite and the
 * baseline-capture harness both paint the real report.
 *
 * Usage:
 *   import { REPORT_FONT_CSS, routeReportFonts } from '../scripts/report-fonts.mjs';
 *   await routeReportFonts(page);   // serve Google Fonts + /fonts/*.ttf
 *   ... route 'https://fonts.googleapis.com/**' -> REPORT_FONT_CSS
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The families the reports ask for, mapped to the shipped file basename.
 * `Plus Jakarta Sans` has no file of its own in this repository, so it is
 * served from Noto Sans - the same substitution the PDF exporters make.
 */
const FACES = [
  ['Plus Jakarta Sans', 'NotoSans'],
  ['Noto Sans', 'NotoSans'],
  ['Noto Sans Tamil', 'NotoSansTamil'],
  ['Noto Sans Devanagari', 'NotoSansDevanagari'],
  ['Cinzel', 'Cinzel'],
  ['Baloo Thambi 2', 'BalooThambi2'],
  ['Yatra One', 'YatraOne']
];

/** Which weights exist on disk for each file basename. */
function faceWeights(file) {
  if (file === 'YatraOne') return [[400, 'Regular']];
  if (file === 'Cinzel' || file === 'BalooThambi2') return [[600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']];
  return [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'Bold']];
}

/**
 * @font-face CSS for every family/weight the reports use. The font files are
 * fetched from `/fonts/<name>.ttf`, which `routeReportFonts` fulfils from the
 * repository - see the module docblock.
 * @type {string}
 */
export const REPORT_FONT_CSS = FACES.flatMap(([family, file]) =>
  faceWeights(file).map(([weight, suffix]) =>
    `@font-face { font-family:'${family}'; font-style:normal; font-weight:${weight}; ` +
    `src:url('http://127.0.0.1:4173/fonts/${file}-${suffix}.ttf') format('truetype'); }`
  )
).join('\n');

/** Families a report cannot paint without; asserted before measuring. */
export const REPORT_FONT_FAMILIES = ['Noto Sans', 'Noto Sans Tamil', 'Noto Sans Devanagari'];

/**
 * Serve the Google Fonts stylesheet and every `/fonts/*.ttf` request from the
 * repository's own font files.
 * @param {import('@playwright/test').Page} page
 */
export async function routeReportFonts(page) {
  await page.route('https://fonts.googleapis.com/**', route =>
    route.fulfill({ contentType: 'text/css', body: REPORT_FONT_CSS }));
  await page.route('**/fonts/*.ttf', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    route.fulfill({
      contentType: 'font/ttf',
      body: readFileSync(resolve(process.cwd(), 'api', 'astrology', 'fonts', name))
    });
  });
}

/**
 * Runs INSIDE the browser: force every family to load (a face is only fetched
 * once something uses it, and an English page never pulls the Tamil face) and
 * return the families that still are not usable. Serialisable on purpose -
 * Playwright evaluates the function source, so it must not close over anything.
 * @param {string[]} families
 * @returns {Promise<string[]>}
 */
export async function loadReportFonts(families) {
  if (!document.fonts) return [];
  await Promise.all(families.map(family => document.fonts.load(`400 16px "${family}"`).catch(() => [])));
  await document.fonts.ready;
  return families.filter(family => !document.fonts.check(`400 16px "${family}"`));
}

/**
 * Throw unless every report family really loaded in that frame. Without the
 * faces the browser paints tofu boxes, so a screenshot or a measurement taken
 * then would be worthless.
 * @param {import('@playwright/test').Page | import('@playwright/test').Frame} target
 */
export async function assertReportFontsLoaded(target) {
  const missing = await target.evaluate(loadReportFonts, REPORT_FONT_FAMILIES);
  if (missing.length > 0) throw new Error(`report faces did not load: ${missing.join(', ')}`);
}
