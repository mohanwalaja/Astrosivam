/**
 * Dev harness: build the sample birth-Jathagam HTML so page 3 can be reviewed
 * in a browser (npm run build:sample-report).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder';
import type { AppLanguage } from '../src/lib/astrology/types';

const lang = (process.argv[2] || 'en') as AppLanguage;
const result = calculatePrecisionHoroscope(
  'Sample Devotee',
  '2000-01-01',
  '02:00',
  'Chennai, Tamil Nadu, India',
  13.0827,
  80.2707,
  5.5
);

const html = buildJathagamHtml(result, lang);
const outDir = '/home/user/astrosivam/tmp';
mkdirSync(outDir, { recursive: true });
const out = `${outDir}/jathagam-${lang}.html`;
writeFileSync(out, html, 'utf8');
console.log('wrote ' + out);
