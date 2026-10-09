/**
 * Birth Jathagam Short Summary — the three test cases the 3-page contract is
 * checked against, in one place so the browser suite and the page-1/page-2
 * baseline harness always use identical charts.
 *
 *   a) normal     — Priya Devi, 15-06-1998 06:30 AM, Chennai (a full A4 page of
 *                   supportive + needs-care planets under the report's rule)
 *   b) long name  — a 60+ character devotee name and a long birth place
 *   c) all nine   — every one of the nine grahas flagged: the compact table
 *
 * Run `npx tsx scripts/jathagam-summary-cases.ts` to print { case: { lang: html } }.
 */
import { writeFileSync } from 'node:fs';
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy';
import { buildJathagamHtml } from '../src/services/jathagamHtmlBuilder';
import type { AppLanguage, HoroscopeResult } from '../src/lib/astrology/types';

export const SUMMARY_LANGUAGES: AppLanguage[] = ['en', 'ta', 'hi'];

/** a) The normal sample: 15-06-1998, 06:30 AM, Chennai. */
const priya = calculatePrecisionHoroscope(
  'Priya Devi',
  '1998-06-15',
  '06:30',
  'Chennai, Tamil Nadu, India',
  13.0827,
  80.2707,
  5.5,
  'India',
  'F'
);

/** b) A 60+ character name with a long birth place. */
const longName = calculatePrecisionHoroscope(
  'Lakshminarayanan Subramanian Venkatesan Ramanathan Chidambaranathan',
  '1979-11-23',
  '04:15',
  'Thiruvananthapuram, Kerala State, India (Thampanoor Junction)',
  8.5241,
  76.9366,
  5.5,
  'India',
  'M'
);

/**
 * c) Maximum case: every graha sits in a challenging house (12), so all nine
 * are flagged and the Short Summary must switch to its compact table.
 */
const allNineNeedingCare: HoroscopeResult = {
  ...priya,
  devoteeName: 'All Nine Grahas Sample',
  planetPositions: priya.planetPositions.map(position => ({ ...position, bhavaNumber: 12 }))
};

export const SUMMARY_CASES: Array<{ name: string; result: HoroscopeResult }> = [
  { name: 'normal', result: priya },
  { name: 'long-name', result: longName },
  { name: 'all-nine-needing-care', result: allNineNeedingCare }
];

/** Convenience: every case × language as report HTML. */
export function buildSummaryCaseHtml(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const testCase of SUMMARY_CASES) {
    out[testCase.name] = {};
    for (const lang of SUMMARY_LANGUAGES) {
      out[testCase.name][lang] = buildJathagamHtml(testCase.result, lang);
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('jathagam-summary-cases.ts')) {
  // The astrology engine logs to stdout, so the payload goes to a file.
  const target = process.argv[2];
  if (target) writeFileSync(target, JSON.stringify(buildSummaryCaseHtml()), 'utf8');
  else console.log(JSON.stringify(buildSummaryCaseHtml()));
}
