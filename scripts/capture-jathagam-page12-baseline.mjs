/**
 * DEV HARNESS (not part of the test suite): captures the page 1 / page 2
 * geometry + text fingerprints of the Birth Jathagam report as it renders
 * BEFORE the 3-page Short Summary change, so the regression suite can prove
 * those two pages were not touched.
 *
 *   node scripts/capture-jathagam-page12-baseline.mjs <out.json>
 *
 * Run it on the base commit, commit the JSON into tests/fixtures, and the
 * browser suite then compares the current render against it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { assertReportFontsLoaded, routeReportFonts } from './report-fonts.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] || 'tests/fixtures/jathagam-page12-baseline.json';

// The harness reuses the repo's own builders through tsx (the astrology engine
// logs to stdout, so the cases are written to a file instead).
const casesFile = `${process.env.TMPDIR || '/tmp'}/jathagam-summary-cases.json`;
const cases = spawnSync('npx', ['tsx', 'scripts/jathagam-summary-cases.ts', casesFile], { encoding: 'utf8' });
if (cases.status !== 0) {
  console.error(cases.stderr);
  process.exit(cases.status ?? 1);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
// The real typefaces: otherwise the fingerprint is of a fallback-font layout
// (and Tamil/Devanagari would be tofu), which is not what the report looks like.
await routeReportFonts(page);
const payload = JSON.parse(readFileSync(casesFile, 'utf8'));
const results = {};
for (const [caseName, languages] of Object.entries(payload)) {
  for (const [lang, html] of Object.entries(languages)) {
    await page.setContent(html, { waitUntil: 'load' });
    await assertReportFontsLoaded(page);
    const fingerprint = await page.evaluate(async () => {
      // Reproduce what the preview / PDF capture actually shows: wait for the
      // report fonts, then let the report's own sheet fitter run.
      if (document.fonts) await document.fonts.ready;
      const fit = window.fitPageToA4;
      if (typeof fit === 'function') {
        document.querySelectorAll('.page').forEach((el) => fit(el));
      }
      const clean = (el) => el.outerHTML
        .replace(/\s*(?:Page|பக்கம்|पृष्ठ)\s*\d+\s*\/\s*\d+/g, ' [[PAGE_LABEL]]')
        .replace(/>\s+</g, '><')
        .trim();
      const boxes = (root) => Array.from(root.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 0)
        .map(el => {
          const r = el.getBoundingClientRect();
          return `${el.className}|${(el.textContent || '').trim()}|${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
        });
      const one = (id) => {
        const root = document.getElementById(id);
        const inner = root.querySelector('.inner');
        const scale = inner && inner.style.transform ? inner.style.transform : 'none';
        return {
          html: clean(root),
          boxes: boxes(root),
          height: root.getBoundingClientRect().height.toFixed(2),
          scale
        };
      };
      return { page1: one('jathagam-page-1'), page2: one('jathagam-page-2') };
    });
    results[`${caseName}|${lang}`] = fingerprint;
  }
}
writeFileSync(out, JSON.stringify(results, null, 1), 'utf8');
await browser.close();
console.log(`wrote ${out}`);
