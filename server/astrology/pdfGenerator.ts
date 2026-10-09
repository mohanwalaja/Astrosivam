import { jsPDF } from 'jspdf';
import {
  NAVAGRAHA_DOSHA_DATA,
  SHORT_SUMMARY_REMEDY_LABELS,
  SHORT_SUMMARY_TEXT,
  JATHAGAM_PLANET_PROFILES
} from '../../src/services/jathagamDoshaData.js';
// ONE classification rule for the Short Summary page, shared with the HTML
// builder and mirrored by the PHP renderer.
import { classifyJathagamPlanetsForSummary } from '../../src/services/jathagamPlanetSummary.js';
import { withDerivedNavamsa } from '../../src/services/navamsa.js';
import { buildJathagamLifeCards, jathagamPageLabel } from '../../src/services/jathagamHtmlBuilder.js';
import { formatUtcOffset } from '../../src/lib/timezone.js';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import { buildNamakaranPadaNamesFromResult } from './namakaranNames.js';
import {
  HoroscopeResult,
  WeddingMatchResult,
  BabyNamingResult,
  AppLanguage,
  PoruthamStatus,
  Graha
} from './types.js';
import { ASTRO_SIVAM_LOGO_BASE64 } from './logoBase64.js';
import muhurthamRules from '../../src/lib/muhurtham/rules.json';
import { buildMuhurthamReportNotes } from '../../src/services/muhurthamReportNotes';
import {
  buildWeddingDisclaimerNotes,
  weddingDisclaimerRuns
} from '../../src/services/weddingDisclaimerNotes';
import {
  MUHURTHAM_TOTAL_PAGES,
  MUHURTHAM_PAGE1_DATE_BUDGET_MM,
  MUHURTHAM_PAGE2_DATE_BUDGET_MM,
  MUHURTHAM_PAGE2_NOTES_START_MM,
  MUHURTHAM_DENSITY_TIERS,
  MUHURTHAM_DATE_COLUMN_RATIOS,
  muhurthamTimeFontScale
} from '../../src/services/muhurthamHtmlBuilder';

// ---------------------------------------------------------------------------
// Latin-safe text pipeline for jsPDF backend PDFs.
//
// The backend jsPDF path uses the built-in helvetica/times fonts (WinAnsi),
// which cannot render Tamil or Devanagari glyphs (they would print as
// mojibake), and jsPDF performs no complex-script shaping. Fully native
// Tamil/Hindi PDFs are produced by the production PHP mPDF engine (which
// shapes Indic scripts correctly) and by the browser HTML-builder export.
// To guarantee backend PDFs NEVER show garbled text, every free-text field
// is passed through `latin()`, which transliterates Tamil/Devanagari into
// readable Latin and replaces glyphs missing from WinAnsi.
// ---------------------------------------------------------------------------

const TA_INDEP: Record<string, string> = {
  '\u0b85': 'a', '\u0b86': 'aa', '\u0b87': 'i', '\u0b88': 'ee', '\u0b89': 'u', '\u0b8a': 'oo',
  '\u0b8e': 'e', '\u0b8f': 'ee', '\u0b90': 'ai', '\u0b92': 'o', '\u0b93': 'oo', '\u0b94': 'au', '\u0b83': 'h'
};
const TA_CONS: Record<string, string> = {
  '\u0b95': 'k', '\u0b99': 'ng', '\u0b9a': 's', '\u0b9e': 'nj', '\u0b9f': 't', '\u0ba3': 'n',
  '\u0ba4': 'th', '\u0ba8': 'n', '\u0baa': 'p', '\u0bae': 'm', '\u0baf': 'y', '\u0bb0': 'r',
  '\u0bb2': 'l', '\u0bb5': 'v', '\u0bb4': 'zh', '\u0bb3': 'l', '\u0bb1': 'tr', '\u0ba9': 'n',
  '\u0b9c': 'j', '\u0bb7': 'sh', '\u0bb8': 's', '\u0bb9': 'h', '\u0bb6': 'sh'
};
const TA_SIGN: Record<string, string> = {
  '\u0bbe': 'aa', '\u0bbf': 'i', '\u0bc0': 'ee', '\u0bc1': 'u', '\u0bc2': 'oo', '\u0bc6': 'e',
  '\u0bc7': 'ee', '\u0bc8': 'ai', '\u0bca': 'o', '\u0bcb': 'oo', '\u0bcc': 'au'
};
const TA_PULLI = '\u0bcd';

const HI_INDEP: Record<string, string> = {
  '\u0905': 'a', '\u0906': 'aa', '\u0907': 'i', '\u0908': 'ee', '\u0909': 'u', '\u090a': 'oo',
  '\u090f': 'e', '\u0910': 'ai', '\u0913': 'o', '\u0914': 'au', '\u0911': 'o', '\u090b': 'ri',
  '\u0902': 'm', '\u0903': 'h', '\u0901': 'n'
};
const HI_CONS: Record<string, string> = {
  '\u0915': 'k', '\u0916': 'kh', '\u0917': 'g', '\u0918': 'gh', '\u0919': 'ng',
  '\u091a': 'ch', '\u091b': 'chh', '\u091c': 'j', '\u091d': 'jh', '\u091e': 'ny',
  '\u091f': 't', '\u0920': 'th', '\u0921': 'd', '\u0922': 'dh', '\u0923': 'n',
  '\u0924': 't', '\u0925': 'th', '\u0926': 'd', '\u0927': 'dh', '\u0928': 'n',
  '\u092a': 'p', '\u092b': 'ph', '\u092c': 'b', '\u092d': 'bh', '\u092e': 'm',
  '\u092f': 'y', '\u0930': 'r', '\u0932': 'l', '\u0935': 'v',
  '\u0936': 'sh', '\u0937': 'sh', '\u0938': 's', '\u0939': 'h',
  '\u0958': 'q', '\u0959': 'kh', '\u095a': 'gh', '\u095b': 'z', '\u095c': 'r',
  '\u095d': 'rh', '\u095e': 'f', '\u095f': 'y', '\u0933': 'l'
};
const HI_SIGN: Record<string, string> = {
  '\u093e': 'aa', '\u093f': 'i', '\u0940': 'ee', '\u0941': 'u', '\u0942': 'oo', '\u0947': 'e',
  '\u0948': 'ai', '\u094b': 'o', '\u094c': 'au', '\u0949': 'o', '\u0943': 'ri',
  '\u0902': 'm', '\u0901': 'n', '\u0903': 'h'
};
const HI_HALANT = '\u094d';
const HI_NUKTA = '\u093c';

function transliterateIndic(input: string): string {
  const chars = Array.from(input);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (TA_INDEP[ch]) { out += TA_INDEP[ch]; continue; }
    if (TA_CONS[ch]) {
      out += TA_CONS[ch];
      if (next === TA_PULLI) { i++; continue; }
      if (next && TA_SIGN[next]) { out += TA_SIGN[next]; i++; continue; }
      out += 'a';
      continue;
    }
    if (TA_SIGN[ch] || ch === TA_PULLI) continue;
    if (ch >= '\u0be6' && ch <= '\u0bef') { out += String(ch.charCodeAt(0) - 0x0be6); continue; }
    if (ch >= '\u0966' && ch <= '\u096f') { out += String(ch.charCodeAt(0) - 0x0966); continue; }
    if (HI_INDEP[ch]) { out += HI_INDEP[ch]; continue; }
    if (HI_CONS[ch]) {
      out += HI_CONS[ch];
      if (next === HI_HALANT) { i++; continue; }
      if (next && HI_SIGN[next]) { out += HI_SIGN[next]; i++; continue; }
      // Hindi schwa deletion: drop the word-final inherent 'a' (e.g. Aarav, not Aarava).
      const nextIsDevaLetter = next !== undefined && (HI_CONS[next] || HI_SIGN[next] || HI_INDEP[next] || next === HI_HALANT || next === HI_NUKTA);
      if (nextIsDevaLetter) out += 'a';
      continue;
    }
    if (HI_SIGN[ch] || ch === HI_HALANT || ch === HI_NUKTA) continue;
    out += ch;
  }
  return out;
}

/** Convert any string into WinAnsi-safe Latin for jsPDF core fonts. Never returns undefined. */
export function latin(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = transliterateIndic(String(value));
  s = s
    .replace(/\u2605|\u2726|\u2727/g, '*')
    .replace(/\u2713|\u2714/g, 'Yes ')
    .replace(/\u2717|\u2718/g, 'X ')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
  // Final safety net: anything still outside true WinAnsi becomes '?'
  // (prevents silent mojibake from unexpected scripts/emoji).
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u2013\u2014\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g, '?');
  return s.replace(/[ \t]+/g, ' ');
}

/** Shrink font size until `text` fits `maxWidth` (single line). Returns chosen size. */

/**
 * Joins a birth place with its country WITHOUT repeating the country when the
 * place string already ends with it (geocoded places usually do), which
 * produced labels such as "Tiruchirappalli, Tamil Nadu, India, India".
 */
function formatBirthPlace(birthPlace?: string, country?: string): string {
  const place = (birthPlace || '').trim().replace(/[,\s]+$/, '');
  const land = (country || '').trim().replace(/[,\s]+$/, '');

  if (!place) return land;
  if (!land) return place;

  // Skip the country when the last segment already names it, either exactly
  // ("Madurai, India") or as a word inside it ("Suva, Fiji Islands" + "Fiji").
  const tail = place
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .pop() || '';

  const landWord = land.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${landWord}\\b`, 'i').test(tail)) return place;

  return `${place}, ${land}`;

}


/**
 * Draws a "• Bold Label: description" bullet on one line and returns the next y.
 *
 * The bold label width MUST be measured while the bold font is still selected.
 * The previous inline version called `doc.getTextWidth(title)` *after*
 * switching to the normal face, so it under-measured wide labels and the
 * description was printed on top of them
 * (e.g. "Correction, Not PunishmentHardships help us...").
 * Descriptions that no longer fit are wrapped instead of running off the page.
 */
function drawLabelledBullet(
  doc: jsPDF,
  title: string,
  desc: string,
  margin: number,
  contentWidth: number,
  y: number,
  bulletColor: readonly number[] | number[],
  textColor: readonly number[] | number[],
  fontSize = 8.5,
  lineHeight = 13.5
): number {
  doc.setFillColor(bulletColor[0], bulletColor[1], bulletColor[2]);
  doc.circle(margin + 12, y - 3, 2, 'F');

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  // Measure and draw the label in BOLD.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const labelWidth = doc.getTextWidth(title);
  doc.text(title, margin + 20, y);

  // Draw the description in the normal face, starting after the real label width.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const descX = margin + 20 + labelWidth + 4;
  const descMaxWidth = Math.max(60, margin + contentWidth - 6 - descX);
  const lines = doc.splitTextToSize(desc, descMaxWidth);

  lines.forEach((line: string, i: number) => {
    // Continuation lines align under the description, not under the bullet.
    doc.text(line, i === 0 ? descX : margin + 20, y + i * lineHeight);
  });

  return y + lines.length * lineHeight;
}


/**
 * "House 12" + "Kuja Dosha Present (House 12)" previously rendered as
 * "House 12 (Kuja Dosha Present (House 12))". The house number is already
 * shown by the label, so drop the repeated "(House N)" from the verdict.
 */
function formatMarsHouseLabel(
  house: number | string | null | undefined,
  severity: string | undefined,
  houses?: { lagna?: number | null; moon?: number | null; venus?: number | null } | null,
  afflictedFrom?: readonly ('lagna' | 'moon' | 'venus')[]
): string {
  // The profile card is narrow: always identify the Lagna house and include
  // each other reference that actually triggered the Kuja assessment.
  const references: ('lagna' | 'moon' | 'venus')[] = ['lagna'];
  for (const reference of afflictedFrom || []) {
    if (!references.includes(reference)) references.push(reference);
  }
  const referenceNames = { lagna: 'Lagna', moon: 'Moon', venus: 'Venus' };
  const locations = references.map(reference => {
    const rawHouse = houses?.[reference] ?? (reference === 'lagna' ? house : null);
    const houseNumber = Number(rawHouse);
    if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) return null;
    return `${referenceNames[reference]} ${houseNumber}`;
  }).filter((location): location is string => Boolean(location));
  const rawVerdict = (severity || '').replace(/\s*\(House\s*\d+\)\s*/gi, '').trim();
  const verdict = /no .*dosha|nivrutti/i.test(rawVerdict)
    ? 'No Dosha'
    : /mild/i.test(rawVerdict)
    ? 'Mild'
    : /present/i.test(rawVerdict)
    ? 'Present'
    : rawVerdict;
  const housePart = locations.length > 0 ? locations.join('; ') : 'House N/A';
  return verdict ? `${housePart} (${verdict})` : housePart;
}

function finiteNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNonnegativeMetric(value: unknown, positiveOnly = false): string {
  const number = finiteNumericValue(value);
  if (number === null || number < 0 || (positiveOnly && number === 0)) return 'N/A';
  return String(Number(number.toFixed(1)));
}

function fitFontSize(doc: jsPDF, text: string, maxWidth: number, baseSize: number, minSize = 6.5): number {
  let size = baseSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

// ---------------------------------------------------------------------------
// Rich text (**bold** runs) for the backend wedding disclaimer page.
//
// jsPDF's built-in fonts have no single call for mixed bold/normal runs, so a
// paragraph is measured word by word and each word is drawn with its own
// weight. Text still goes through `latin()` first (see the file header) — the
// backend engine cannot shape Tamil or Devanagari.
// ---------------------------------------------------------------------------
interface RichWord {
  text: string;
  bold: boolean;
}

function wrapRichWords(doc: jsPDF, rich: string, maxWidth: number, fontSize: number): RichWord[][] {
  doc.setFontSize(fontSize);
  const words: RichWord[] = [];
  for (const run of weddingDisclaimerRuns(rich)) {
    for (const word of latin(run.text).split(/\s+/)) {
      if (word) words.push({ text: word, bold: run.bold });
    }
  }

  const lines: RichWord[][] = [];
  let line: RichWord[] = [];
  let lineWidth = 0;
  const spaceWidth = doc.getTextWidth(' ');

  for (const word of words) {
    doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
    const wordWidth = doc.getTextWidth(word.text);
    const gap = line.length ? spaceWidth : 0;
    if (line.length && lineWidth + gap + wordWidth > maxWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    line.push(word);
    lineWidth += (line.length > 1 ? spaceWidth : 0) + wordWidth;
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawRichWords(
  doc: jsPDF,
  lines: RichWord[][],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  textColor: [number, number, number],
  boldColor: [number, number, number]
): number {
  let cy = y;
  for (const line of lines) {
    let cx = x;
    for (const word of line) {
      doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const [r, g, b] = word.bold ? boldColor : textColor;
      doc.setTextColor(r, g, b);
      doc.text(word.text, cx, cy);
      cx += doc.getTextWidth(word.text) + doc.getTextWidth(' ');
    }
    cy += lineHeight;
  }
  return cy;
}

// The Birth Jathagam, Wedding, Muhurtham and invoice renderers share this
// centered Baby Naming-style lockup. These legacy inset values are used only by
// Node's bespoke Baby Naming certificate pages, not by the shared headers.
const BABY_NAMING_RIGHT_HEADER_LOGO_INSET_PT = 24;
const BABY_NAMING_LEFT_HEADER_LOGO_INSET_PT = 24;
/** Add the shared ASTRO SIVAM logo at the requested header size. */
function addLogo(doc: jsPDF, x: number, y: number, size: number): void {
  if (!ASTRO_SIVAM_LOGO_BASE64) return;

  const format = ASTRO_SIVAM_LOGO_BASE64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  doc.addImage(ASTRO_SIVAM_LOGO_BASE64, format, x, y, size, size);
}

interface CenteredBrandHeaderOptions {
  title?: string;
  subtitle: string;
  meta?: string;
  topY?: number;
  logoSize?: number;
}

/**
 * Draw the centered emblem / brand / subtitle / contact lockup used by the
 * Baby Naming browser certificate. The return value is the first body baseline
 * after its segmented maroon-to-gold divider and spacing.
 */
function drawCenteredBrandHeader(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  options: CenteredBrandHeaderOptions
): number {
  const title = latin(options.title || 'ASTRO SIVAM - OFFICIAL VEDIC REPORT');
  const subtitle = latin(options.subtitle);
  const meta = latin(options.meta || '');
  const maxWidth = pageWidth - 2 * margin - 8;
  const logoSize = options.logoSize ?? 38;
  let y = options.topY ?? 14;

  try {
    addLogo(doc, pageWidth / 2 - logoSize / 2, y, logoSize);
  } catch (err) {
    // Keep all text and page geometry even if an image decoder fails.
  }
  y += logoSize + 9;

  doc.setFont('times', 'bold');
  doc.setTextColor(125, 18, 51);
  const titleSize = fitFontSize(doc, title, maxWidth, 17, 13.5);
  doc.setFontSize(titleSize);
  doc.text(title, pageWidth / 2, y, { align: 'center', maxWidth });
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.7);
  doc.setTextColor(11, 122, 90);
  const subtitleLines = doc.splitTextToSize(subtitle, maxWidth);
  doc.text(subtitleLines, pageWidth / 2, y, { align: 'center', lineHeightFactor: 1.12, maxWidth });
  y += subtitleLines.length * 10.8 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  const contactLines = doc.splitTextToSize('astrosivam.com • admin@astrosivam.com', maxWidth);
  doc.text(contactLines, pageWidth / 2, y, { align: 'center', lineHeightFactor: 1.1, maxWidth });
  y += contactLines.length * 9 + 1;

  if (meta) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 116, 139);
    const metaLines = doc.splitTextToSize(meta, maxWidth);
    doc.text(metaLines, pageWidth / 2, y, { align: 'center', lineHeightFactor: 1.1, maxWidth });
    y += metaLines.length * 8.6 + 1;
  }

  const dividerY = y + 1;
  const dividerColors: [number, number, number][] = [
    [237, 209, 217], [207, 142, 159], [125, 18, 51], [168, 90, 20],
    [125, 18, 51], [207, 142, 159], [237, 209, 217]
  ];
  const dividerWidth = pageWidth - 2 * margin;
  const segmentWidth = dividerWidth / dividerColors.length;
  dividerColors.forEach((color, index) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(margin + index * segmentWidth, dividerY, segmentWidth + 0.2, 1.1, 'F');
  });

  return dividerY + 13;
}

// Rasi names for reports
const RASI_NAMES_EN: Record<number, string> = {
  1: 'Mesham', 2: 'Rishabam', 3: 'Mithunam', 4: 'Kadagam',
  5: 'Simham', 6: 'Kanni', 7: 'Thulam', 8: 'Viruchigam',
  9: 'Dhanusu', 10: 'Magaram', 11: 'Kumbam', 12: 'Meenam'
};

const GRAHA_NAMES_EN: Record<string, { name: string; tag: string }> = {
  [Graha.SURYA]: { name: 'Surya', tag: 'Su' },
  [Graha.CHANDRA]: { name: 'Chandra', tag: 'Ch' },
  [Graha.CHEVVAI]: { name: 'Mangal', tag: 'Mangal' },
  [Graha.BUDHA]: { name: 'Budha', tag: 'Bu' },
  [Graha.GURU]: { name: 'Guru', tag: 'Gu' },
  [Graha.SUKRA]: { name: 'Sukra', tag: 'Sukra' },
  [Graha.SANI]: { name: 'Sani', tag: 'Sani' },
  [Graha.RAHU]: { name: 'Rahu', tag: 'Rahu' },
  [Graha.KETU]: { name: 'Ketu', tag: 'Ketu' }
};

const RASI_LORDS_LOOKUP: Record<number, Graha> = {
  1: Graha.CHEVVAI, 2: Graha.SUKRA, 3: Graha.BUDHA, 4: Graha.CHANDRA,
  5: Graha.SURYA, 6: Graha.BUDHA, 7: Graha.SUKRA, 8: Graha.CHEVVAI,
  9: Graha.GURU, 10: Graha.SANI, 11: Graha.SANI, 12: Graha.GURU
};

function drawPillarFluting(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const stripeW = 11; // ~4mm
  const maroon: [number, number, number] = [122, 31, 31];
  const gold: [number, number, number] = [201, 150, 44];
  const ivory2: [number, number, number] = [247, 231, 196];

  const step = 24;
  for (let y = 0; y < pageHeight; y += step) {
    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.rect(0, y, stripeW, 11, 'F');
    doc.rect(pageWidth - stripeW, y, stripeW, 11, 'F');

    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(0, y + 11, stripeW, 1.2, 'F');
    doc.rect(pageWidth - stripeW, y + 11, stripeW, 1.2, 'F');

    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.rect(0, y + 12.2, stripeW, 11, 'F');
    doc.rect(pageWidth - stripeW, y + 12.2, stripeW, 11, 'F');

    doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
    doc.rect(0, y + 23.2, stripeW, 0.8, 'F');
    doc.rect(pageWidth - stripeW, y + 23.2, stripeW, 0.8, 'F');
  }
}

export function generateHoroscopePdf(result: HoroscopeResult, lang: AppLanguage = 'en'): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const contentWidth = pageWidth - 2 * margin;

  // Colors
  const maroon: [number, number, number] = [122, 31, 31];
  const gold: [number, number, number] = [201, 150, 44];
  const deepGold = [166, 124, 31];
  const green: [number, number, number] = [45, 90, 61];
  const ivory: [number, number, number] = [253, 243, 224];
  const ivory2: [number, number, number] = [247, 231, 196];
  const ink: [number, number, number] = [51, 28, 14];

  const devoteeName = latin(result.devoteeName || 'User');
  // Validate engine rasi numbers (1-12) -- never silently fabricate Mesham/Magaram on corrupt data.
  const lagnaRasiValid = Number.isInteger(result.lagnaRasi) && result.lagnaRasi >= 1 && result.lagnaRasi <= 12;
  const chandraRasiValid = Number.isInteger(result.chandraRasi) && result.chandraRasi >= 1 && result.chandraRasi <= 12;
  const lagnaRasi = lagnaRasiValid ? result.lagnaRasi : null;
  const chandraRasi = chandraRasiValid ? result.chandraRasi : null;
  const lagnaDegrees = Number.isFinite(result.lagnaDegrees) && result.lagnaDegrees >= 0 && result.lagnaDegrees < 30
    ? result.lagnaDegrees
    : null;
  const nakshatraName = latin(result.janmaNakshatraEn || 'N/A');
  const pada = Number.isInteger(result.janmaPada) && result.janmaPada >= 1 && result.janmaPada <= 4
    ? result.janmaPada
    : null;
  // Format DOB (DD-MM-YYYY)
  let formattedDob = result.dob;
  if (result.dob && result.dob.includes('-')) {
    const parts = result.dob.split('-');
    if (parts.length === 3) formattedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Format TOB
  let formattedTob = result.tob;
  if (result.tob) {
    const [hStr, mStr] = result.tob.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      formattedTob = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
  }

  const birthPlaceStr = latin(formatBirthPlace(result.birthPlace, result.country));
  const birthZoneStr = latin(
    `${result.timeZoneId ? `${result.timeZoneId} · ` : ''}${formatUtcOffset(result.timezoneOffsetHours)} at birth`
  );
  const lagnaSignName = lagnaRasi !== null ? RASI_NAMES_EN[lagnaRasi] || 'N/A' : 'N/A';
  const rasiSignName = chandraRasi !== null ? RASI_NAMES_EN[chandraRasi] || 'N/A' : 'N/A';

  // D1 and D9 chart groupings. The planetary and Dasha source data remains in
  // the result for the page-2 predictions; page 1 only renders these charts.
  const planetsBySign: Record<number, string[]> = {};
  const navamsaBySign: Record<number, string[]> = {};
  for (let r = 1; r <= 12; r++) {
    planetsBySign[r] = [];
    navamsaBySign[r] = [];
    if (lagnaRasiValid && r === lagnaRasi) planetsBySign[r].push('Lagna');
  }

  // A result saved before the engines emitted D9 has no navamsa fields; they are
  // completed from the longitudes it holds (same rule as the engines; navamsa.ts).
  const navamsaSource = withDerivedNavamsa(result);
  const lagnaNavamsaValue = Number(navamsaSource.lagnaNavamsaRasi);
  const lagnaNavamsaRasiValid = Number.isInteger(lagnaNavamsaValue)
    && lagnaNavamsaValue >= 1 && lagnaNavamsaValue <= 12;
  const lagnaNavamsaRasi = lagnaNavamsaRasiValid ? lagnaNavamsaValue : null;
  if (lagnaRasiValid && lagnaNavamsaRasi !== null) navamsaBySign[lagnaNavamsaRasi].push('Lagna');

  (navamsaSource.planetPositions || []).forEach(p => {
    const gInfo = GRAHA_NAMES_EN[p.graha];
    if (!gInfo) return;
    if (Number.isInteger(p.rasi) && p.rasi >= 1 && p.rasi <= 12) {
      planetsBySign[p.rasi].push(gInfo.tag);
    }

    const rowNavamsaRasi = Number.isInteger(p.navamsaRasi) && p.navamsaRasi! >= 1 && p.navamsaRasi! <= 12
      ? Number(p.navamsaRasi)
      : null;
    const mappedNavamsaValue = Number(navamsaSource.navamsaPositions?.[p.graha]?.rasi);
    const mapNavamsaRasi = Number.isInteger(mappedNavamsaValue) && mappedNavamsaValue >= 1 && mappedNavamsaValue <= 12
      ? mappedNavamsaValue
      : null;
    const navamsaRasi = rowNavamsaRasi ?? mapNavamsaRasi;
    if (navamsaRasi !== null) navamsaBySign[navamsaRasi].push(gInfo.tag);
  });
  const hasNavamsaData = Object.values(navamsaBySign).some(signs => signs.length > 0);

  // ==========================================
  // PAGE 1: Birth Details, Rasi + Navamsa Charts & Doshas
  // ==========================================
  doc.setFillColor(ivory[0], ivory[1], ivory[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawPillarFluting(doc, pageWidth, pageHeight);

  // The backend core fonts cannot shape Tamil/Devanagari, so the native script
  // lives in the HTML/mPDF renderers — the language suffix identifies the
  // ordered report language in this Latin-safe direct-download PDF.
  const horoLangSuffix = lang === 'ta' ? ' (Tamil)' : lang === 'hi' ? ' (Hindi)' : '';
  let y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: `Jathagam Report${horoLangSuffix}`
  });

  // Panel 1: Birth Details Grid. The final Place of Birth row spans the panel;
  // current-Dasha details are kept for the prediction logic, not printed here.
  // Height is derived from the four visible rows and their label/value baselines.
  const detailRowGap = 22;
  const detailFirstLabelY = 18;
  const detailValueOffset = 11;
  const panel1H = detailFirstLabelY + 3 * detailRowGap + detailValueOffset + 10;
  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, y, contentWidth, panel1H, 5, 5, 'FD');

  const col1X = margin + 14;
  const col2X = margin + contentWidth / 2 + 10;
  let py = y + detailFirstLabelY;

  const detailColW = contentWidth / 2 - 24;
  const drawDetail = (lbl: string, val: string, x: number, curY: number, maxWidth = detailColW) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.text(latin(lbl).toUpperCase(), x, curY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const safeVal = latin(val);
    fitFontSize(doc, safeVal, maxWidth, 9.5); // shrink long names/places instead of spilling
    doc.text(safeVal, x, curY + detailValueOffset, { maxWidth });
  };

  drawDetail('Name', devoteeName, col1X, py);
  drawDetail('Lagna (Ascendant)', `${lagnaSignName} (${lagnaDegrees === null ? 'N/A' : `${lagnaDegrees.toFixed(1)}°`})`, col2X, py);
  py += detailRowGap;

  drawDetail('Date of Birth', formattedDob, col1X, py);
  drawDetail('Moon Sign (Rasi)', rasiSignName, col2X, py);
  py += detailRowGap;

  drawDetail('Time of Birth', `${formattedTob} • ${birthZoneStr}`, col1X, py);
  drawDetail('Janma Nakshatram', `${nakshatraName} - ${pada === null ? 'Pada N/A' : `Pada ${pada}`}`, col2X, py);
  py += detailRowGap;

  drawDetail('Place of Birth', birthPlaceStr, col1X, py, contentWidth - 28);

  y += panel1H + 12;

  // Chart Section: Rasi (D1) left, Navamsa (D9) right.
  const chartSecW = (contentWidth - 10) / 2;
  const chartSecH = 220;
  const rightBoxX = margin + chartSecW + 10;
  const signGridMap: { rasi: number; col: number; row: number }[] = [
    { rasi: 12, col: 0, row: 0 }, { rasi: 1, col: 1, row: 0 }, { rasi: 2, col: 2, row: 0 }, { rasi: 3, col: 3, row: 0 },
    { rasi: 11, col: 0, row: 1 },                                                             { rasi: 4, col: 3, row: 1 },
    { rasi: 10, col: 0, row: 2 },                                                             { rasi: 5, col: 3, row: 2 },
    { rasi: 9, col: 0, row: 3 },  { rasi: 8, col: 1, row: 3 }, { rasi: 7, col: 2, row: 3 }, { rasi: 6, col: 3, row: 3 }
  ];

  const drawChartBox = (
    boxX: number,
    title: string,
    positionsBySign: Record<number, string[]>,
    hasChartData = true
  ) => {
    doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(1.2);
    doc.roundedRect(boxX, y, chartSecW, chartSecH, 5, 5, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(latin(title), boxX + 12, y + 16);
    doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.setLineWidth(0.75);
    doc.line(boxX + 12, y + 20, boxX + chartSecW - 12, y + 20);

    if (!hasChartData) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Navamsa positions unavailable; N/A.', boxX + chartSecW / 2, y + chartSecH / 2, {
        align: 'center',
        maxWidth: chartSecW - 24
      });
      return;
    }

    const gridX = boxX + 10;
    const gridY = y + 26;
    const gridW = chartSecW - 20;
    const gridH = chartSecH - 36;
    const cellW = gridW / 4;
    const cellH = gridH / 4;

    signGridMap.forEach(item => {
      const cx = gridX + item.col * cellW;
      const cy = gridY + item.row * cellH;

      doc.setFillColor(255, 250, 240);
      doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(cx + 1, cy + 1, cellW - 2, cellH - 2, 2, 2, 'FD');

      const sName = RASI_NAMES_EN[item.rasi] || '';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(ink[0], ink[1], ink[2]);
      doc.text(sName, cx + cellW / 2, cy + 11, { align: 'center' });

      const tags = positionsBySign[item.rasi] || [];
      if (tags.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(maroon[0], maroon[1], maroon[2]);
        // Wrap crowded stelliums across up to 2 centered lines so tags never spill into neighbours.
        const tagLines = doc.splitTextToSize(tags.join(', '), cellW - 6).slice(0, 2);
        tagLines.forEach((line: string, li: number) => {
          doc.text(line, cx + cellW / 2, cy + 22 + li * 8, { align: 'center' });
        });
      }
    });

    // Center Merged 2x2 Box
    const centerCX = gridX + cellW;
    const centerCY = gridY + cellH;
    const centerCW = cellW * 2;
    const centerCH = cellH * 2;

    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.setDrawColor(maroon[0], maroon[1], maroon[2]);
    doc.roundedRect(centerCX + 1, centerCY + 1, centerCW - 2, centerCH - 2, 3, 3, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(253, 243, 224);
    doc.text('Om', centerCX + centerCW / 2, centerCY + centerCH / 2 - 4, { align: 'center' });
    doc.text('Nama Shivaya', centerCX + centerCW / 2, centerCY + centerCH / 2 + 10, { align: 'center' });
  };

  drawChartBox(margin, 'Rasi Chart', planetsBySign);
  drawChartBox(rightBoxX, 'Navamsa Chart (D9)', navamsaBySign, hasNavamsaData);
  y += chartSecH + 12;

  // Use the REAL computed doshas from the engine - never hardcoded "clean" verdicts.
  const doshaList: Array<{
    nameEn: string;
    severityEn: string;
    descriptionEn: string;
    isPresent: boolean | null;
    isNavagrahaAfflictionIndicator?: boolean;
    traditionalRemedyEn?: string;
    verdict?: string;
    verdictLabelEn?: string;
    strength?: string;
    extendedRemedyEn?: string;
    ruleEn?: string;
  }> =
    (result.doshas && result.doshas.length > 0)
      ? result.doshas
      : (() => {
        const marsPos = (result.planetPositions || []).find(p => p.graha === Graha.CHEVVAI);
        const marsHouseIsValid = Number.isInteger(marsPos?.bhavaNumber) && marsPos!.bhavaNumber >= 1 && marsPos!.bhavaNumber <= 12;
        const marsBhava = marsHouseIsValid ? marsPos!.bhavaNumber : null;
        const kuja = marsBhava === null ? null : [2, 4, 7, 8, 12].includes(marsBhava);
        return [
          {
            nameEn: 'Kuja / Manglik Dosha Indicator (Lagna-based)',
            severityEn: kuja === null ? 'N/A' : kuja ? 'Indicator under selected rule' : 'Criterion not met; traditions may differ',
            descriptionEn: kuja === null
              ? 'Mars house placement unavailable; Kuja Dosha was not assessed (N/A).'
              : kuja
              ? `Mars is in House ${marsBhava} under the selected Lagna-based criterion; this is an indicator, not a prediction.`
              : `Mars is in House ${marsBhava}; the selected house criterion is not met. Other traditions may differ.`,
            isPresent: kuja
          }
        ];
      })();
  const isKujaDosha = doshaList.some(d => d.isPresent && /kuja|manglik|mars|chevvai/i.test(d.nameEn));

  // Fill page 1: the dosha block is the only part of this sheet that can
  // grow, so the space left above the footer band is shared between the cards
  // instead of being printed empty.
  const page1BottomLimit = pageHeight - 34 - 10;
  const page1CardCount = Math.min(4, doshaList.filter(d => !d.isNavagrahaAfflictionIndicator).length)
    + (doshaList.some(d => d.isPresent && d.isNavagrahaAfflictionIndicator) ? 1 : 0);
  const page1NaturalCards = (() => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const items = [
      ...doshaList.filter(d => !d.isNavagrahaAfflictionIndicator).slice(0, 4),
      ...(doshaList.some(d => d.isPresent && d.isNavagrahaAfflictionIndicator)
        ? [{ descriptionEn: 'Navagraha screening indicators: these are screening indicators under simplified selected rules; interpretations vary by tradition.' }]
        : [])
    ];
    return items.reduce((sum, d) => sum + 24 + doc.splitTextToSize(latin(String(d.descriptionEn || '')), contentWidth - 18).slice(0, 3).length * 9 + 4, 0);
  })();
  const page1Slack = Math.max(0, page1BottomLimit - (y + 34 + page1NaturalCards));
  const page1CardPad = Math.min(26, page1Slack / Math.max(1, page1CardCount));
  const page1HeadGap = Math.min(30, Math.max(0, page1Slack - page1CardPad * page1CardCount));

  // Dosha Analysis Section
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('Dosha Analysis', margin, y + 10 + page1HeadGap);
  doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.setLineWidth(0.75);
  doc.line(margin, y + 14 + page1HeadGap, margin + contentWidth, y + 14 + page1HeadGap);

  y += 22 + page1HeadGap;

  const drawDoshaCard = (name: string, status: string, desc: string, present: boolean | null, curY: number, extraPad = 0): number => {
    const safeDesc = latin(desc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const descLines = doc.splitTextToSize(safeDesc, contentWidth - 18).slice(0, 3);
    const cardH = 24 + descLines.length * 9 + extraPad;
    // Cards grow from the inside: the rule under the title and the wrapped
    // description follow the padding so the text stays centred in the box.
    const descTop = curY + 21 + extraPad / 2;
    doc.setFillColor(255, 250, 240);
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.roundedRect(margin, curY, contentWidth, cardH, 3, 3, 'FD');

    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.rect(margin, curY, 3.5, cardH, 'F');

    // Title (left) and status (right) share one line. The status is
    // right-aligned and measured FIRST so the title can be shrunk to the space
    // that is actually left over. Drawing the status at a fixed x made long
    // titles such as "Pitru Indicator & Ancestral Blessings" run straight
    // through the status text.
    const safeStatus = latin(status);
    const safeName = latin(name);
    const gutter = 10;
    const rightEdge = margin + contentWidth - 8;

    doc.setFont('helvetica', 'bold');
    const statusSize = fitFontSize(doc, safeStatus, contentWidth * 0.45, 8);
    doc.setFontSize(statusSize);
    const statusWidth = doc.getTextWidth(safeStatus);

    const nameMaxWidth = Math.max(40, contentWidth - 16 - statusWidth - gutter);
    doc.setFont('helvetica', 'bold');
    const nameSize = fitFontSize(doc, safeName, nameMaxWidth, 9);
    doc.setFontSize(nameSize);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(safeName, margin + 8, curY + 11 + extraPad / 2, { maxWidth: nameMaxWidth });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(statusSize);
    if (present === true) doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    else if (present === false) doc.setTextColor(green[0], green[1], green[2]);
    else doc.setTextColor(100, 116, 139);
    doc.text(safeStatus, rightEdge, curY + 11 + extraPad / 2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    descLines.forEach((line: string, li: number) => {
      doc.text(line, margin + 8, descTop + li * 9);
    });
    return cardH + 4;
  };

  doshaList.filter(d => !d.isNavagrahaAfflictionIndicator).slice(0, 4).forEach(d => {
    // Item 2: the badge quotes the Kuja verdict; item 5: the fuller ancestral
    // remedy travels with the Pitru card.
    const badgeText = d.verdictLabelEn || d.severityEn;
    const cardDesc = d.descriptionEn
      + (d.extendedRemedyEn && d.strength && d.strength !== 'none' ? ` ${d.extendedRemedyEn}` : '');
    const cardPresent = d.verdict === 'present-cancelled' ? true : d.isPresent;
    y += drawDoshaCard(d.nameEn, badgeText, cardDesc, cardPresent, y, page1CardPad);
  });
  // The Navagraha Affliction Indicators card is no longer printed on page 1.
  // The screening rules themselves stay in the engine (and surface in the Short
  // Summary planet read), so only this page-1 card was dropped.
  // Items 6/7a: yoga notes (Sarala, own-sign Saturn, the 9th-lord caution)
  // and Graha Yuddha pairs, straight from the engine.
  (result.yogas || []).forEach(note => {
    y += drawDoshaCard(
      note.nameEn,
      note.severity === 'caution' ? 'Caution' : 'Benefit',
      note.descriptionEn,
      note.severity !== 'caution',
      y,
      page1CardPad
    );
  });
  (result.grahaYuddha || []).forEach(war => {
    y += drawDoshaCard(
      `Graha Yuddha — ${war.planetANameEn} / ${war.planetBNameEn}`,
      `${war.separationDegrees.toFixed(2)}°`,
      war.descriptionEn,
      true,
      y,
      page1CardPad
    );
  });
  y += 4;

  // Page 1 Footer
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 34, margin + contentWidth, pageHeight - 34);

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM', pageWidth / 2, pageHeight - 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.text(
    `Authentic Vedic Astrology Services • admin@astrosivam.com • ${latin(jathagamPageLabel(1, lang))}`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  // ==========================================
  // PAGE 2: 8 Life-Prediction Cards in 4x2 Grid
  // ==========================================
  doc.addPage();
  doc.setFillColor(ivory[0], ivory[1], ivory[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawPillarFluting(doc, pageWidth, pageHeight);

  y = 28;

  const page2Title = lang === 'ta' ? 'ஜாதக வாழ்க்கை வழிகாட்டல்' : lang === 'hi' ? 'कुंडली जीवन मार्गदर्शन' : 'Life Predictions';
  const page2Subtitle = lang === 'ta'
    ? `${devoteeName} அவர்களின் ஜாதகக் குறியீடுகள்`
    : lang === 'hi'
    ? `${devoteeName} की कुंडली के संकेत`
    : `Traditional chart indicators for ${devoteeName}`;
  const page2Disclaimer = lang === 'ta'
    ? 'பாரம்பரிய ஜோதிடக் குறியீடுகள் மட்டுமே; மருத்துவம், நிதி, சட்டம் அல்லது உறவு ஆலோசனை அல்ல.'
    : lang === 'hi'
    ? 'पारंपरिक ज्योतिषीय संकेत मात्र; यह चिकित्सा, वित्त, कानूनी या संबंध सलाह नहीं है।'
    : 'Traditional Jyotisha indicators only; not medical, financial, legal, or relationship advice.';

  y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: page2Title,
    meta: page2Subtitle
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 80, 65);
  doc.text(latin(page2Disclaimer), pageWidth / 2, y, { align: 'center', maxWidth: contentWidth - 24 });
  y += 12;

  // Keep this list shared with the browser/HTML report so the eight page-2
  // interpretations cannot silently diverge between PDF services.
  const lifeCards = buildJathagamLifeCards(result, lang);
  const cardColW = (contentWidth - 12) / 2;
  // Eight cards in four rows: the row pitch is derived from the space left on
  // the sheet so page 2 always ends on the footer band, never above it.
  const cardRowGap = 8;
  const page2BottomLimit = pageHeight - 30 - 10;
  const cardRowH = Math.max(152, Math.floor((page2BottomLimit - y - 3 * cardRowGap) / 4));
  const cardPadding = 12;

  lifeCards.forEach((c, idx) => {
    const r = Math.floor(idx / 2);
    const col = idx % 2;
    const cx = margin + col * (cardColW + 12);
    const cy = y + r * (cardRowH + cardRowGap);

    doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(1.2);
    doc.roundedRect(cx, cy, cardColW, cardRowH, 5, 5, 'FD');

    // A numbered marker is used instead of emoji: the built-in jsPDF fonts do
    // not contain colour emoji, and this keeps every language PDF deterministic.
    doc.setFillColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.circle(cx + 7, cy + 16, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(idx + 1), cx + 7, cy + 18.2, { align: 'center' });

    const titleText = latin(c.title);
    const badgeText = latin(c.badge);
    const badgeMaxWidth = cardColW * 0.40;
    const badgeSize = 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(badgeSize);
    const badgeLines = doc.splitTextToSize(badgeText, badgeMaxWidth - 4);

    const titleMaxWidth = Math.max(44, cardColW - cardPadding * 2 - badgeMaxWidth - 8);
    const titleSize = 12;
    doc.setFont('times', 'bold');
    doc.setFontSize(titleSize);
    const titleLines = doc.splitTextToSize(titleText, titleMaxWidth);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(titleLines, cx + cardPadding + 5, cy + 16, { lineHeightFactor: 1.15 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(badgeSize);
    doc.setTextColor(c.badge.includes('Caution') || c.badge.includes('கவனம்') || c.badge.includes('सावधान') ? 146 : 90,
      c.badge.includes('Caution') || c.badge.includes('கவனம்') || c.badge.includes('सावधान') ? 64 : 80,
      c.badge.includes('Caution') || c.badge.includes('கவனம்') || c.badge.includes('सावधान') ? 14 : 65);
    doc.text(badgeLines, cx + cardColW - cardPadding, cy + 14, { align: 'right', lineHeightFactor: 1.2 });

    const headerHeight = Math.max(titleLines.length * titleSize * 1.15, badgeLines.length * badgeSize * 1.2);
    const dividerY = cy + 12 + headerHeight;
    doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.setLineWidth(0.75);
    doc.line(cx + cardPadding, dividerY, cx + cardColW - cardPadding, dividerY);

    const descX = cx + cardPadding;
    const descWidth = cardColW - cardPadding * 2;
    const descY = dividerY + 15;
    const availableHeight = cardRowH - (descY - cy) - cardPadding;
    let descSize = 12;
    let descLines: string[] = [];
    let descLineHeight = descSize * 1.3;
    // Fit the complete paragraph, not a capped/ellipsized set of lines, and
    // use the full card: the copy is enlarged while it still fits, so a taller
    // row never leaves a block of blank paper inside the box.
    while (descSize < 15) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(descSize + 0.25);
      const grown = doc.splitTextToSize(latin(c.desc), descWidth);
      if (grown.length * (descSize + 0.25) * 1.3 > availableHeight) break;
      descSize += 0.25;
    }
    while (true) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(descSize);
      descLines = doc.splitTextToSize(latin(c.desc), descWidth);
      descLineHeight = descSize * 1.3;
      if (descLines.length * descLineHeight <= availableHeight || descSize <= 6) break;
      descSize -= 0.25;
    }
    // Centre the paragraph in the box when the card is taller than the text.
    const descUsed = descLines.length * descLineHeight;
    const descCentreShift = Math.max(0, Math.min(18, (availableHeight - descUsed) / 2));
    doc.setFontSize(descSize);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(descLines, descX, descY + descCentreShift, { lineHeightFactor: 1.3, maxWidth: descWidth });
  });

  // Page 2 Footer
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 30, margin + contentWidth, pageHeight - 30);

  // Page 2 footer carries the real page label ("2 / 3"), like the HTML and
  // mPDF renderers, so every page of the report states its place.
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(
    `ASTRO SIVAM • admin@astrosivam.com • ${latin(jathagamPageLabel(2, lang))}`,
    pageWidth / 2,
    pageHeight - 16,
    { align: 'center' }
  );


  // ==========================================
  // PAGE 3: Short Summary (one A4, always)
  // ==========================================
  // Plain-language summary of pages 1 and 2. The supportive / needs-care lists
  // come from the shared rule in src/services/jathagamPlanetSummary.ts, and the
  // remedies come from the existing Navagraha reference data (deity, weekday,
  // charity) plus the additive lamp-oil and mantra fields. Nothing here is
  // hardcoded, and the whole page is laid out inside ONE A4 sheet.
  doc.addPage();
  doc.setFillColor(ivory[0], ivory[1], ivory[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawPillarFluting(doc, pageWidth, pageHeight);

  const isTa = lang === 'ta';
  const isHi = lang === 'hi';
  const summary = classifyJathagamPlanetsForSummary(result, lang);
  const summaryText = SHORT_SUMMARY_TEXT[lang] || SHORT_SUMMARY_TEXT.en;
  const summaryLabels = SHORT_SUMMARY_REMEDY_LABELS[lang] || SHORT_SUMMARY_REMEDY_LABELS.en;
  const summaryCompact = summary.compact;
  const summaryPlanetName = (key: string): string => {
    const position = (result.planetPositions || []).find(p => p.graha === key);
    const info = NAVAGRAHA_DOSHA_DATA[key];
    return latin(position?.nameEn || info?.name.en || key).replace(/ Affliction Indicator/g, '');
  };
  const shortSupportiveLabel = isTa ? 'ஆதரவு' : isHi ? 'सहायक' : 'Support';

  y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: latin(summaryText.subtitle),
    meta: devoteeName
  });

  // Larger type on a typical chart so the Short Summary fills the A4;
  // compact mode (5–9 flagged grahas) keeps the tighter floor so every
  // graha still fits one sheet.
  const bodySize = summaryCompact ? 8.6 : 10.2;
  const labelSize = summaryCompact ? 7.9 : 9.4;
  const planetSize = summaryCompact ? 9.75 : 11.5;
  const titleSize = summaryCompact ? 10.5 : 12;
  const valueLine = summaryCompact ? 10.75 : 12.8;
  const paraLine = summaryCompact ? 11 : 13.2;
  const cardGap = summaryCompact ? 4 : 8;
  const cardPad = summaryCompact ? 4 : 8;
  const boxRadius = 4;
  const cardHeaderH = summaryCompact ? 15 : 18;

  /** One bordered card with a maroon title rule; returns its bottom edge. */
  const drawCard = (
    title: string,
    titleColor: [number, number, number],
    bodyHeight: number,
    options: { fill?: [number, number, number]; border?: [number, number, number] } = {}
  ): { top: number; bodyTop: number; bodyHeight: number; bottom: number } => {
    const fill = options.fill || [255, 255, 255];
    const border = options.border || [229, 231, 235];
    const headerH = cardHeaderH;
    const cardH = headerH + bodyHeight + cardPad * 2;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, cardH, boxRadius, boxRadius, 'FD');
    doc.setFont('times', 'bold');
    doc.setFontSize(titleSize);
    doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
    doc.text(title, margin + cardPad, y + cardPad + 8, { maxWidth: contentWidth - cardPad * 2 });
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.4);
    doc.line(margin + cardPad, y + cardPad + 9.6, margin + contentWidth - cardPad, y + cardPad + 9.6);
    const top = y;
    y += cardH + cardGap;
    return { top, bodyTop: top + cardPad + headerH, bodyHeight, bottom: top + cardH };
  };

  // 1. Person card: a four-column grid of small boxes (the nakshatra box spans
  //    two columns). Every box grows to the tallest cell in its row, so a 60+
  //    character name wraps instead of spilling over the next box.
  const detailGap = 3;
  const detailCols = 4;
  const detailBoxW = (contentWidth - cardPad * 2 - detailGap * (detailCols - 1)) / detailCols;
  const details: Array<{ label: string; value: string; span: number }> = [
    { label: isTa ? 'பெயர்' : isHi ? 'नाम' : 'Name', value: devoteeName, span: 1 },
    { label: isTa ? 'பிறந்த தேதி' : isHi ? 'जन्म तिथि' : 'Birth date', value: formattedDob, span: 1 },
    { label: isTa ? 'பிறந்த நேரம்' : isHi ? 'जन्म समय' : 'Birth time', value: formattedTob, span: 1 },
    { label: isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान' : 'Birth place', value: birthPlaceStr, span: 1 },
    { label: isTa ? 'லக்னம்' : isHi ? 'लग्न' : 'Lagna', value: lagnaSignName, span: 1 },
    { label: isTa ? 'ராசி' : isHi ? 'राशि' : 'Rasi', value: rasiSignName, span: 1 },
    {
      label: isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र' : 'Nakshatra',
      value: `${nakshatraName}${pada === null ? '' : ` — Pada ${pada}`}`,
      span: 2
    }
  ];
  const detailRows: Array<Array<{ label: string; value: string; span: number }>> = [details.slice(0, 4), details.slice(4)];
  // splitTextToSize depends on the current font/size, so measure with exactly
  // the font the values are drawn with.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(bodySize);
  const detailLayout = detailRows.map(row => {
    const lines = row.map(cell =>
      doc.splitTextToSize(latin(String(cell.value ?? '')), detailBoxW * cell.span + detailGap * (cell.span - 1) - 8)
    );
    const height = 14 + Math.max(...lines.map(cellLines => cellLines.length)) * valueLine;
    return { row, lines, height };
  });
  const detailsBodyH = detailLayout.reduce((sum, row) => sum + row.height, 0) + detailGap * (detailLayout.length - 1);
  const detailsCard = drawCard(latin(summaryText.detailsTitle), maroon, detailsBodyH);
  {
    let rowY = detailsCard.bodyTop;
    detailLayout.forEach(({ row, lines, height }) => {
      let col = 0;
      row.forEach((cell, index) => {
        const width = detailBoxW * cell.span + detailGap * (cell.span - 1);
        const boxX = margin + cardPad + col * (detailBoxW + detailGap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.roundedRect(boxX, rowY, width, height, 3, 3, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(labelSize);
        doc.setTextColor(107, 114, 128);
        doc.text(latin(cell.label), boxX + 4, rowY + 8, { maxWidth: width - 8 });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(bodySize);
        doc.setTextColor(31, 41, 55);
        doc.text(lines[index], boxX + 4, rowY + 18, { lineHeightFactor: 1.25, maxWidth: width - 8 });
        col += cell.span;
      });
      rowY += height + detailGap;
    });
  }

  // 2. Supportive planets (green tint), at most three boxes in a row.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  const supportiveBoxes = summary.supportive.map(planet => {
    const note = latin(JATHAGAM_PLANET_PROFILES[planet.key]?.support?.[lang] || '');
    return {
      name: summaryPlanetName(planet.key),
      noteLines: doc.splitTextToSize(note, detailBoxW - 10)
    };
  });
  const supportiveRowH = supportiveBoxes.length
    ? Math.max(...supportiveBoxes.map(box => box.noteLines.length * valueLine)) + 22
    : 16;
  const supportiveCard = drawCard(latin(summaryText.supportiveTitle), green, supportiveRowH, {
    fill: [242, 251, 246],
    border: [191, 230, 211]
  });
  if (supportiveBoxes.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bodySize);
    doc.setTextColor(15, 107, 74);
    doc.text(latin(summaryText.noSupportPlanet), margin + cardPad, supportiveCard.bodyTop + 9, {
      maxWidth: contentWidth - cardPad * 2
    });
  }
  supportiveBoxes.forEach((box, index) => {
    const boxX = margin + cardPad + index * (detailBoxW + detailGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(191, 230, 211);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, supportiveCard.bodyTop, detailBoxW, supportiveRowH, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(planetSize);
    doc.setTextColor(15, 107, 74);
    doc.text(box.name, boxX + 5, supportiveCard.bodyTop + 11, { maxWidth: detailBoxW - 10 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodySize);
    doc.setTextColor(31, 41, 55);
    doc.text(box.noteLines, boxX + 5, supportiveCard.bodyTop + 21, {
      lineHeightFactor: 1.25,
      maxWidth: detailBoxW - 10
    });
  });

  // 3. Planets needing care (amber tint): one row per flagged graha, with the
  //    four labelled remedy lines in the normal case and one short remedy line
  //    in compact mode. Every flagged graha is always shown.
  const careRemedyText = (planet: (typeof summary.needsCare)[number]): string => {
    if (summaryCompact) return latin(planet.compactLine);
    return [
      `${latin(summaryLabels.worship)}: ${latin(planet.worship)}`,
      `${latin(summaryLabels.lamp)}: ${latin(planet.lamp)}`,
      `${latin(summaryLabels.donation)}: ${latin(planet.donation)}`,
      `${latin(summaryLabels.mantra)}: ${latin(planet.mantra)}`
    ].join('\n');
  };
  const careRows = summary.needsCare.map(planet => [
    summaryPlanetName(planet.key),
    latin(planet.difficulties),
    careRemedyText(planet)
  ]);
  // The amber card must be sized to the real table height. autoTable's own
  // row heights depend on the wrapped remedy text, so an estimate can let a
  // long row run into the card below; measure with a scratch document first.
  const careTableOptions = (startY: number): UserOptions => ({
    startY,
    margin: { left: margin + cardPad, right: margin + cardPad },
    tableWidth: contentWidth - cardPad * 2,
    head: [[latin(summaryText.tablePlanet), latin(summaryText.tableDifficulties), latin(summaryText.tableRemedies)]],
    body: careRows,
    styles: {
      font: 'helvetica',
      fontSize: labelSize,
      cellPadding: summaryCompact ? 2 : 3,
      textColor: [31, 41, 55],
      lineColor: [241, 217, 166],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'top'
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [107, 114, 128],
      fontStyle: 'bold',
      fontSize: labelSize,
      lineColor: [241, 217, 166]
    },
    columnStyles: {
      // Fractions of the table width itself (not of the page), so the table
      // can never exceed the card's inner width.
      0: { cellWidth: (contentWidth - cardPad * 2) * 0.17, fontStyle: 'bold', textColor: [122, 18, 48] },
      1: { cellWidth: (contentWidth - cardPad * 2) * 0.33 },
      2: { cellWidth: (contentWidth - cardPad * 2) * 0.5 }
    },
    theme: 'grid'
  });
  const measuredCareTableH = Math.max(measureAutoTableHeight(careTableOptions(40)), 10);

  // 4–5. Measure the remaining cards before drawing the care card so leftover
  // space on the sheet can enlarge the care table instead of leaving a blank
  // band above the footer.
  const supportiveNames = summary.supportive.map(planet => summaryPlanetName(planet.key));
  const careNames = summary.needsCare.map(planet => summaryPlanetName(planet.key));
  const leadTemplate = supportiveNames.length === 0
    ? summaryText.summaryLeadNoSupport
    : careNames.length === 0
      ? summaryText.summaryLeadNoCare
      : summaryText.summaryLead;
  const summarySentences = [
    leadTemplate
      .replace('{supportive}', supportiveNames.join(', '))
      .replace('{care}', careNames.join(', ')),
    summaryText.summaryRemedy,
    summaryCompact ? summaryText.compactModeNote : ''
  ].filter(part => part && part.trim().length > 0).map(part => latin(part)).join(' ');
  const habitText = latin(summaryText.dailyHabit);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  const shortLines = doc.splitTextToSize(summarySentences, contentWidth - cardPad * 2);
  const habitLines = doc.splitTextToSize(habitText, contentWidth - cardPad * 2);
  const shortBodyH = (shortLines.length + habitLines.length) * paraLine + 2;
  const reassuranceLines = doc.splitTextToSize(latin(summaryText.reassurance), contentWidth - cardPad * 2 - 6);
  const reassuranceH = reassuranceLines.length * paraLine + 10;
  let incompleteH = 0;
  if (!summary.assessmentComplete) {
    incompleteH = doc.splitTextToSize(latin(summary.incompleteNote), contentWidth - cardPad * 2).length * paraLine + 4;
  }
  const shortCardH = cardHeaderH + shortBodyH + cardPad * 2;
  const remaining = (pageHeight - 30 - 8) - y;
  const extraCare = Math.max(
    0,
    remaining - (cardHeaderH + measuredCareTableH + cardPad * 2 + incompleteH + cardGap + shortCardH + cardGap + reassuranceH)
  );

  const careCard = drawCard(latin(summaryText.careTitle), [146, 64, 14], measuredCareTableH + extraCare, {
    fill: [255, 250, 240],
    border: [241, 217, 166]
  });
  if (careRows.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bodySize);
    doc.setTextColor(15, 107, 74);
    doc.text(latin(summaryText.noCarePlanet), margin + cardPad, careCard.bodyTop + 9, {
      maxWidth: contentWidth - cardPad * 2
    });
  } else {
    autoTable(doc, careTableOptions(careCard.bodyTop));
  }
  // A chart with a placement the rule could not read must never look "all
  // clean": say so, in the card that lists what was found.
  if (!summary.assessmentComplete) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(labelSize);
    doc.setTextColor(146, 64, 14);
    const incompleteLines = doc.splitTextToSize(latin(summary.incompleteNote), contentWidth - cardPad * 2);
    doc.text(incompleteLines, margin + cardPad, careCard.bottom + 7, {
      lineHeightFactor: 1.3,
      maxWidth: contentWidth - cardPad * 2
    });
    y += incompleteH;
  }

  // 4. In Short: two or three sentences plus the daily-habit line.
  const shortCard = drawCard(latin(summaryText.summaryTitle), maroon, shortBodyH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  doc.setTextColor(31, 41, 55);
  doc.text(shortLines, margin + cardPad, shortCard.bodyTop + 6, { lineHeightFactor: 1.35, maxWidth: contentWidth - cardPad * 2 });
  doc.text(habitLines, margin + cardPad, shortCard.bodyTop + 6 + shortLines.length * paraLine, {
    lineHeightFactor: 1.35,
    maxWidth: contentWidth - cardPad * 2
  });

  // 5. Reassurance note with the maroon left border.
  doc.setFillColor(248, 249, 251);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, reassuranceH, 3, 3, 'FD');
  doc.setFillColor(122, 18, 48);
  doc.rect(margin, y, 2.5, reassuranceH, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(bodySize);
  doc.setTextColor(31, 41, 55);
  doc.text(reassuranceLines, margin + cardPad + 2, y + 8, {
    lineHeightFactor: 1.35,
    maxWidth: contentWidth - cardPad * 2 - 6
  });

  // Page 3 footer: the real label, from the same page-count constant.
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 30, margin + contentWidth, pageHeight - 30);
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(
    `ASTRO SIVAM • admin@astrosivam.com • ${latin(jathagamPageLabel(3, lang))}`,
    pageWidth / 2,
    pageHeight - 16,
    { align: 'center' }
  );

  return Buffer.from(doc.output('arraybuffer'));
}

export function generateWeddingMatchPdf(result: WeddingMatchResult, lang: AppLanguage = 'en'): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const contentWidth = pageWidth - 2 * margin;

  const maroon: [number, number, number] = [122, 31, 31];
  const gold: [number, number, number] = [201, 150, 44];
  const deepGold = [166, 124, 31];
  const green: [number, number, number] = [45, 90, 61];
  const ivory: [number, number, number] = [253, 243, 224];
  const ivory2: [number, number, number] = [247, 231, 196];
  const ink: [number, number, number] = [51, 28, 14];
  const matchResultAny = result as any;
  const matchPoruthams = Array.isArray(matchResultAny.poruthams) ? matchResultAny.poruthams : [];
  const completePointRows = matchPoruthams.length === 10 && matchPoruthams.every((p: any) => {
    const earned = finiteNumericValue(p?.pointsEarned ?? p?.points);
    const maximum = finiteNumericValue(p?.maxPoints);
    return earned !== null && earned >= 0 && maximum !== null && maximum > 0;
  });
  const derivedMaximumScore = completePointRows
    ? matchPoruthams.reduce((sum: number, p: any) => sum + Number(p.maxPoints), 0)
    : undefined;
  const derivedTotalScore = completePointRows
    ? matchPoruthams.reduce((sum: number, p: any) => sum + Number(p.pointsEarned ?? p.points), 0)
    : undefined;
  const scoreDisplay = formatNonnegativeMetric(matchResultAny.totalScore ?? matchResultAny.score ?? derivedTotalScore);
  const maxScoreDisplay = formatNonnegativeMetric(
    matchResultAny.maxScore ?? matchResultAny.maxPossiblePoints ?? derivedMaximumScore,
    true
  );
  const rawMatchedCount = finiteNumericValue(matchResultAny.totalPoruthamsMatched ?? matchResultAny.matchedCount);
  const countableMatchRows = matchPoruthams.length === 10 && matchPoruthams.every((p: any) =>
    [PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(p?.status) ||
    finiteNumericValue(p?.pointsEarned ?? p?.points) !== null
  );
  const derivedMatchedCount = rawMatchedCount ?? (countableMatchRows
    ? matchPoruthams.filter((p: any) => {
      if ([PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(p?.status)) {
        return p.status === PoruthamStatus.UTTHAMAM || p.status === PoruthamStatus.MADHYAMAM;
      }
      return Number(p.pointsEarned ?? p.points) > 0;
    }).length
    : null);
  const matchedCountDisplay = derivedMatchedCount !== null && Number.isInteger(derivedMatchedCount) && derivedMatchedCount >= 0 && derivedMatchedCount <= 10
    ? String(derivedMatchedCount)
    : 'N/A';
  const verdictStatus = String(matchResultAny.verdictStatus || '').toUpperCase();
  const verdictKnown = [PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(verdictStatus as PoruthamStatus);
  const isGood = verdictStatus === PoruthamStatus.UTTHAMAM;
  const isModerate = verdictStatus === PoruthamStatus.MADHYAMAM;
  const verdictBadgeText = !verdictKnown
    ? 'N/A'
    : isGood ? 'UTTHAMAM (HIGHLY AUSPICIOUS)' : isModerate ? 'MADHYAMAM (WITH REMEDIES)' : 'NOT RECOMMENDED';
  // The final line follows the same tier as the score badge: Madhyamam is
  // acceptable with remedies, not an unqualified "good match".
  const finalVerdictText = !verdictKnown
    ? 'N/A'
    : isGood
    ? 'This is a good match.'
    : isModerate
    ? 'Acceptable match; suitable with remedies.'
    : 'This match is not recommended on the current assessment; this is astrological guidance only. Seek a detailed horoscope review before deciding.';
  const rajjuStatusText = typeof matchResultAny.rajjuMatch !== 'boolean'
    ? 'N/A'
    : matchResultAny.rajjuMatch ? 'Auspicious Match' : 'Afflicted';
  const brideRasiNumber = finiteNumericValue(matchResultAny.brideRasi);
  const groomRasiNumber = finiteNumericValue(matchResultAny.groomRasi);
  const brideRasiLabel = brideRasiNumber !== null && Number.isInteger(brideRasiNumber) ? RASI_NAMES_EN[brideRasiNumber] || 'N/A' : 'N/A';
  const groomRasiLabel = groomRasiNumber !== null && Number.isInteger(groomRasiNumber) ? RASI_NAMES_EN[groomRasiNumber] || 'N/A' : 'N/A';

  // Background & Pillar Fluting
  doc.setFillColor(ivory[0], ivory[1], ivory[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawPillarFluting(doc, pageWidth, pageHeight);

  // As with Jathagam, the direct jsPDF fallback names the requested language
  // because its built-in core fonts cannot render Tamil or Devanagari glyphs.
  const weddingLangSuffix = lang === 'ta' ? ' (Tamil)' : lang === 'hi' ? ' (Hindi)' : '';
  let y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: `10-Poruthams Vedic Marriage Compatibility Report${weddingLangSuffix}`
  });

  // Side-by-side Bride & Groom Profiles
  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  // Last field row has its value baseline at y+84; leave clear room below it.
  const cardHeight = 94;
  const brideX = margin;
  const groomX = brideX + cardWidth + cardGap;

  // Bride Card
  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(brideX, y, cardWidth, cardHeight, 5, 5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('BRIDE PROFILE', brideX + 12, y + 16);

  doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.setLineWidth(0.75);
  doc.line(brideX + 12, y + 20, brideX + cardWidth - 12, y + 20);

  // Each card holds two columns. The left column must stop short of the right
  // column's x, otherwise long names such as "Karthikeyan Balasubramanian"
  // butt straight up against the date in the neighbouring column.
  const cardColGutter = 8;
  const drawCardField = (lbl: string, val: string, bx: number, by: number, cardLeft: number) => {
    const rightColX = cardLeft + cardWidth / 2;
    const isLeftCol = bx < rightColX;
    const maxW = isLeftCol
      ? rightColX - bx - cardColGutter
      : cardLeft + cardWidth - 12 - bx;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.text(latin(lbl).toUpperCase(), bx, by, { maxWidth: maxW });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const safeVal = latin(val);
    fitFontSize(doc, safeVal, Math.max(30, maxW), 9); // shrink long names/places to fit the column
    doc.text(safeVal, bx, by + 10, { maxWidth: Math.max(30, maxW) });
  };

  const brideChart: any = (result as any).bride || (result as any).girl || {};
  const brideBirthDetails = brideChart.birthDetails || {};
  const bridePlaceForPdf = formatBirthPlace(
    brideChart.birthPlace || brideBirthDetails.birthPlace,
    brideChart.country ?? brideBirthDetails.country
  ) || 'Not provided';
  drawCardField('Name', result.brideName || 'N/A', brideX + 12, y + 32, brideX);
  drawCardField('Birth', `${result.brideDob || 'N/A'} (${result.brideTob || 'N/A'})`, brideX + cardWidth / 2, y + 32, brideX);
  drawCardField('Moon Sign (Rasi)', brideRasiLabel, brideX + 12, y + 54, brideX);
  drawCardField('Nakshatra & Pada', `${result.brideNakshatraNameEn || 'N/A'} (Pada ${Number.isInteger(result.bridePada) && result.bridePada >= 1 && result.bridePada <= 4 ? result.bridePada : 'N/A'})`, brideX + cardWidth / 2, y + 54, brideX);
  drawCardField('Birth Place', bridePlaceForPdf, brideX + 12, y + 74, brideX);
  drawCardField('Mars House', formatMarsHouseLabel(
    result.brideMarsHouse,
    matchResultAny.sevvayDosham?.brideDoshamSeverityEn,
    matchResultAny.sevvayDosham?.brideMarsHouses,
    matchResultAny.sevvayDosham?.brideAfflictedFrom
  ), brideX + cardWidth / 2, y + 74, brideX);

  // Groom Card
  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(groomX, y, cardWidth, cardHeight, 5, 5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('GROOM PROFILE', groomX + 12, y + 16);

  doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.setLineWidth(0.75);
  doc.line(groomX + 12, y + 20, groomX + cardWidth - 12, y + 20);

  const groomChart: any = (result as any).groom || (result as any).boy || {};
  const groomBirthDetails = groomChart.birthDetails || {};
  const groomPlaceForPdf = formatBirthPlace(
    groomChart.birthPlace || groomBirthDetails.birthPlace,
    groomChart.country ?? groomBirthDetails.country
  ) || 'Not provided';
  drawCardField('Name', result.groomName || 'N/A', groomX + 12, y + 32, groomX);
  drawCardField('Birth', `${result.groomDob || 'N/A'} (${result.groomTob || 'N/A'})`, groomX + cardWidth / 2, y + 32, groomX);
  drawCardField('Moon Sign (Rasi)', groomRasiLabel, groomX + 12, y + 54, groomX);
  drawCardField('Nakshatra & Pada', `${result.groomNakshatraNameEn || 'N/A'} (Pada ${Number.isInteger(result.groomPada) && result.groomPada >= 1 && result.groomPada <= 4 ? result.groomPada : 'N/A'})`, groomX + cardWidth / 2, y + 54, groomX);
  drawCardField('Birth Place', groomPlaceForPdf, groomX + 12, y + 74, groomX);
  drawCardField('Mars House', formatMarsHouseLabel(
    result.groomMarsHouse,
    matchResultAny.sevvayDosham?.groomDoshamSeverityEn,
    matchResultAny.sevvayDosham?.groomMarsHouses,
    matchResultAny.sevvayDosham?.groomAfflictedFrom
  ), groomX + cardWidth / 2, y + 74, groomX);

  y += cardHeight + 10;

  // Compatibility Score & Summary Medallion (banner grows with wrapped text).
  // Display the actual denominator carried by this engine/result, derived from
  // complete point rows only when the stored aggregate is absent.
  const scoreLine1 = `SCORE: ${matchedCountDisplay} / 10 PORUTHAMS MATCHED (${scoreDisplay} / ${maxScoreDisplay} POINTS)  -  ${verdictBadgeText}`;
  const scoreLine2 = latin(`Rajju Status: ${rajjuStatusText}   |   Kuja (Mars) Dosha: ${matchResultAny.sevvayDosham?.doshaSamyamStatusEn || 'N/A'}`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const scoreLine2Wrapped = doc.splitTextToSize(scoreLine2, contentWidth - 28);
  const scoreBannerH = 28 + scoreLine2Wrapped.length * 12;

  doc.setFillColor(255, 250, 240);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, y, contentWidth, scoreBannerH, 5, 5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  fitFontSize(doc, scoreLine1, contentWidth - 28, 10.5);
  doc.text(scoreLine1, margin + 14, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  scoreLine2Wrapped.forEach((line: string, li: number) => {
    doc.text(line, margin + 14, y + 30 + li * 12);
  });

  y += scoreBannerH + 10;

  // 10 Poruthams Table
  const poruthamRows = matchPoruthams.map((p: any, idx: number) => {
    const rawEarned = finiteNumericValue(p?.pointsEarned ?? p?.points);
    const rawMaximum = finiteNumericValue(p?.maxPoints);
    const pointsText = rawEarned !== null && rawEarned >= 0 && rawMaximum !== null && rawMaximum > 0
      ? `${formatNonnegativeMetric(rawEarned)} / ${formatNonnegativeMetric(rawMaximum, true)}`
      : 'N/A / N/A';
    const rawStatus = String(p?.status || p?.statusLabel || '');
    const statusText = [PoruthamStatus.UTTHAMAM, PoruthamStatus.MADHYAMAM, PoruthamStatus.PORUNDHADHU].includes(rawStatus as PoruthamStatus)
      ? rawStatus
      : 'N/A';
    return [
      `${idx + 1}`,
      latin(`${p?.nameEn || p?.name || 'N/A'} ${p?.isCrucial ? '*' : ''}`),
      latin(statusText),
      pointsText,
      latin(p?.explanationEn || p?.description || 'N/A')
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['#', 'Porutham (Kuta)', 'Verdict', 'Score', 'Astrological Significance']],
    body: poruthamRows,
    theme: 'grid',
    headStyles: {
      fillColor: [122, 31, 31],
      textColor: [253, 243, 224],
      fontStyle: 'bold',
      fontSize: 9.5,
      cellPadding: 4.5
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 28, 14],
      cellPadding: 3.8
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      1: { fontStyle: 'bold', cellWidth: 125, textColor: [122, 31, 31] },
      2: { halign: 'center', cellWidth: 80, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 50, fontStyle: 'bold' },
      4: { cellWidth: 'auto' }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 10;

  // Kuja Dosha & Final Recommendation Panel (height grows with wrapped text)
  const sevva = result.sevvayDosham || ({} as any);
  const kujaLine = latin(`- Bride: ${sevva.brideDoshamSeverityEn || ''}   |   Groom: ${sevva.groomDoshamSeverityEn || ''}   |   Dosha Balance: ${sevva.doshaSamyamStatusEn || ''}`);
  const verdictLine = latin(`- Verdict: ${result.overallVerdictEn || 'N/A'}`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const kujaWrapped = doc.splitTextToSize(kujaLine, contentWidth - 26);
  const verdictWrapped = doc.splitTextToSize(verdictLine, contentWidth - 26);
  let verdictBoxHeight = 28 + (kujaWrapped.length + verdictWrapped.length) * 11.5;
  let finalVerdictHeight = 40;

  // ── Fill the sheet ────────────────────────────────────────────────────────
  // The table has already been drawn, so whatever vertical space is left before
  // the footer rule is shared between the gap under the table, the guidance box
  // and the final verdict banner. Page 1 therefore always runs down to the
  // footer instead of ending a third of the way up an empty sheet.
  const pageOneBottom = pageHeight - 44;   // footer rule sits at pageHeight - 30
  const naturalBottom = y + verdictBoxHeight + 8 + finalVerdictHeight;
  const pageOneSlack = Math.max(0, pageOneBottom - naturalBottom);
  const extraGap = Math.min(pageOneSlack * 0.3, 34);
  const extraBox = pageOneSlack - extraGap;
  const extraGuidance = Math.round(extraBox * 0.55);
  const extraVerdict = extraBox - extraGuidance;
  y += extraGap;
  verdictBoxHeight += extraGuidance;
  finalVerdictHeight += extraVerdict;
  const guidanceTextOffset = Math.round(extraGuidance / 2);

  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, y, contentWidth, verdictBoxHeight, 5, 5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('Kuja (Mars) Dosha Analysis & Astrological Recommendation', margin + 12, y + 15 + guidanceTextOffset);

  doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.setLineWidth(0.75);
  doc.line(margin + 12, y + 19 + guidanceTextOffset, margin + contentWidth - 12, y + 19 + guidanceTextOffset);

  let vy = y + 33 + guidanceTextOffset;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  kujaWrapped.forEach((line: string) => { doc.text(line, margin + 12, vy); vy += 11.5; });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  verdictWrapped.forEach((line: string) => { doc.text(line, margin + 12, vy); vy += 11.5; });

  // Put one explicit, color-coded verdict at the end of every wedding report.
  const finalVerdictY = y + verdictBoxHeight + 8;
  const verdictColor: [number, number, number] = !verdictKnown ? [71, 85, 105] : isGood ? [22, 101, 52] : isModerate ? [146, 64, 14] : [153, 27, 27];
  const verdictBackground: [number, number, number] = !verdictKnown ? [248, 250, 252] : isGood ? [236, 253, 245] : isModerate ? [255, 251, 235] : [254, 242, 242];
  const verdictBorder: [number, number, number] = !verdictKnown ? [203, 213, 225] : isGood ? [134, 239, 172] : isModerate ? [252, 211, 77] : [252, 165, 165];
  doc.setFillColor(verdictBackground[0], verdictBackground[1], verdictBackground[2]);
  doc.setDrawColor(verdictBorder[0], verdictBorder[1], verdictBorder[2]);
  doc.setLineWidth(1);
  doc.roundedRect(margin, finalVerdictY, contentWidth, finalVerdictHeight, 5, 5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  // Centred in the banner so a taller (sheet-filling) banner never looks empty.
  const verdictTextTop = finalVerdictY + finalVerdictHeight / 2 - 8;
  doc.text('FINAL VERDICT', pageWidth / 2, verdictTextTop, { align: 'center' });
  doc.setFontSize(11);
  doc.text(finalVerdictText, pageWidth / 2, verdictTextTop + 16, { align: 'center' });

  // Page Footer (page 1)
  drawWeddingPageFooter(doc, pageWidth, pageHeight, margin, contentWidth, gold, maroon);

  // ── Page 2: Marriage Matching Disclaimer ──────────────────────────────────
  // Browser exports and the PHP mPDF email print this page in the customer's
  // own script; the backend engine draws WinAnsi only, so the same localized
  // copy goes through `latin()` like every other field in this file.
  const disclaimer = buildWeddingDisclaimerNotes(lang);
  const page2Margin = 46;
  const page2Width = pageWidth - 2 * page2Margin;

  doc.addPage();
  doc.setFillColor(ivory[0], ivory[1], ivory[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  drawPillarFluting(doc, pageWidth, pageHeight);

  let dy = drawCenteredBrandHeader(doc, pageWidth, page2Margin, {
    subtitle: disclaimer.pageSubtitle,
    logoSize: 38
  });

  // Larger, airier type than before: the copy is the whole page, so it is set
  // to read comfortably and to carry the sheet down to the attestation block.
  const disclaimerFontSize = 12;
  const disclaimerLineHeight = 17;
  const disclaimerTextWidth = page2Width - 30;
  const disclaimerLayouts = disclaimer.paragraphs.map(paragraph =>
    wrapRichWords(doc, paragraph, disclaimerTextWidth, disclaimerFontSize)
  );
  const disclaimerLineCount = disclaimerLayouts.reduce((sum, lines) => sum + lines.length, 0);
  const naturalPanelHeight = 44 + disclaimerLineCount * disclaimerLineHeight + disclaimer.paragraphs.length * 6;
  // Fill the sheet: the disclaimer panel runs from under the header band down to
  // the attestation block, and any space its copy does not need is shared evenly
  // between the paragraphs. Nothing is left blank above or below the panel.
  const contentTop = dy;
  const contentBottom = pageHeight - 48;
  const attestationHeight = 130;
  const attestationTop = contentBottom - attestationHeight;
  const panelTop = contentTop;
  const panelHeight = Math.max(naturalPanelHeight, attestationTop - 10 - panelTop);
  const paragraphGap = 6;
  const panelSlack = Math.max(0, panelHeight - naturalPanelHeight);
  // Spread the leftover space between the paragraphs, but never so far that the
  // copy looks padded out: anything beyond that stays as panel padding.
  const spreadGap = Math.min(16, panelSlack / (disclaimer.paragraphs.length + 1));
  const spreadTop = Math.max(0, (panelSlack - spreadGap * (disclaimer.paragraphs.length + 1)) / 2);

  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(page2Margin, panelTop, page2Width, panelHeight, 5, 5, 'FD');

  let py = panelTop + 20 + spreadTop + spreadGap;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(latin(disclaimer.title), pageWidth / 2, py, { align: 'center', maxWidth: page2Width - 20 });
  py += 14;

  doc.setFontSize(10.5);
  doc.setTextColor(green[0], green[1], green[2]);
  doc.text(latin(disclaimer.heading), pageWidth / 2, py, { align: 'center', maxWidth: page2Width - 20 });
  py += 16;

  disclaimerLayouts.forEach(lines => {
    py = drawRichWords(
      doc,
      lines,
      page2Margin + 15,
      py,
      disclaimerFontSize,
      disclaimerLineHeight,
      ink,
      maroon
    );
    py += paragraphGap + spreadGap;
  });

  // ── Attestation block ─────────────────────────────────────────────────────
  // Closes the sheet with the report reference, the issue date and the signature
  // line, mirroring the browser preview and the mPDF email renderer.
  const attestLabels = lang === 'ta'
    ? ['குறிப்பு எண்', 'வழங்கப்பட்ட நாள்', 'இவர்களுக்காக']
    : lang === 'hi'
    ? ['संदर्भ क्रमांक', 'जारी तिथि', 'हेतु तैयार']
    : ['Reference', 'Issued On', 'Prepared For'];
  const attestSignatory = lang === 'ta'
    ? 'அங்கீகரிக்கப்பட்டவர்'
    : lang === 'hi'
    ? 'अधिकृत हस्ताक्षरकर्ता'
    : 'Authorised Signatory';
  const attestDesk = lang === 'ta'
    ? 'ASTRO SIVAM வேத ஆய்வு மையம்'
    : lang === 'hi'
    ? 'ASTRO SIVAM वैदिक अनुसंधान केंद्र'
    : 'ASTRO SIVAM Vedic Research Desk';
  const attestTitle = lang === 'ta'
    ? 'சான்றளிக்கப்பட்டது & உறுதிப்படுத்தப்பட்டது'
    : lang === 'hi'
    ? 'प्रमाणित एवं अभिप्रमाणित'
    : 'CERTIFIED & ATTESTED';
  const issuedStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const coupleLine = `${result.brideName || 'Bride'} & ${result.groomName || 'Groom'}`;
  const attestValues = [issuedStamp.slice(0, 10), `${issuedStamp.slice(11)} UTC`, coupleLine];

  doc.setFillColor(ivory2[0], ivory2[1], ivory2[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, attestationTop, contentWidth, attestationHeight, 5, 5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(latin(attestTitle), pageWidth / 2, attestationTop + 18, { align: 'center' });

  doc.setDrawColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.setLineWidth(0.75);
  doc.line(margin + 12, attestationTop + 24, margin + contentWidth - 12, attestationTop + 24);

  let ay = attestationTop + 40;
  const attestValueX = margin + contentWidth * 0.34;
  attestLabels.forEach((label, index) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(deepGold[0], deepGold[1], deepGold[2]);
    doc.text(latin(label).toUpperCase(), margin + 12, ay);
    doc.setFontSize(9);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.text(
      latin(attestValues[index] || '').slice(0, 46),
      attestValueX,
      ay,
      { maxWidth: contentWidth * 0.3 }
    );
    ay += 20;
  });

  const signX = margin + contentWidth * 0.66;
  doc.setDrawColor(maroon[0], maroon[1], maroon[2]);
  doc.setLineWidth(0.75);
  doc.line(signX, attestationTop + attestationHeight - 30, margin + contentWidth - 12, attestationTop + attestationHeight - 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(latin(attestSignatory), signX, attestationTop + attestationHeight - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(deepGold[0], deepGold[1], deepGold[2]);
  doc.text(latin(attestDesk), signX, attestationTop + attestationHeight - 8, { maxWidth: contentWidth * 0.32 });

  drawWeddingPageFooter(doc, pageWidth, pageHeight, margin, contentWidth, gold, maroon);

  return Buffer.from(doc.output('arraybuffer'));
}

/** Shared footer band for every page of the backend wedding report. */
function drawWeddingPageFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  contentWidth: number,
  gold: number[],
  maroon: number[]
): void {
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.line(margin, pageHeight - 30, margin + contentWidth, pageHeight - 30);

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM • admin@astrosivam.com', pageWidth / 2, pageHeight - 16, { align: 'center' });
}

/**
 * The hand-drawn fallback pages must know how tall an auto-table will be
 * before their rows can be grown to fill the sheet, so the table is measured
 * on a throwaway document with identical metrics and margins.
 */
function measureAutoTableHeight(options: any): number {
  const scratch = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const startY = 40;
  autoTable(scratch, { ...options, startY });
  const finalY = (scratch as any).lastAutoTable?.finalY ?? startY;
  return Math.max(0, finalY - startY);
}

export function generateBabyNamingPdf(result: BabyNamingResult, lang: AppLanguage = 'en'): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 34;
  const contentWidth = pageWidth - 2 * margin;

  // Refined professional palette (matches the browser certificate export)
  const maroon: [number, number, number] = [122, 33, 41];
  const maroonDeep: [number, number, number] = [92, 23, 32];
  const gold: [number, number, number] = [179, 134, 46];
  const goldDeep: [number, number, number] = [140, 106, 30];
  const cream: [number, number, number] = [253, 250, 244];
  const cream2: [number, number, number] = [246, 239, 225];
  const goldPale: [number, number, number] = [247, 239, 221];
  const ink: [number, number, number] = [45, 36, 28];
  const inkSoft: [number, number, number] = [92, 80, 68];
  const inkMute: [number, number, number] = [138, 124, 108];
  const line: [number, number, number] = [229, 217, 197];
  const lineStrong: [number, number, number] = [203, 187, 137];
  const green: [number, number, number] = [46, 107, 79];
  const white: [number, number, number] = [255, 255, 255];

  // ── Page field & certificate frame ─────────────────────────────
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(white[0], white[1], white[2]);
  doc.rect(23, 23, pageWidth - 46, pageHeight - 46, 'F');

  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.3);
  doc.rect(18, 18, pageWidth - 36, pageHeight - 36);
  doc.setDrawColor(maroon[0], maroon[1], maroon[2]);
  doc.setLineWidth(0.5);
  doc.rect(23, 23, pageWidth - 46, pageHeight - 46);

  // Corner brackets
  doc.setDrawColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.setLineWidth(1);
  const cb = 10;
  doc.line(26, 26, 26 + cb, 26); doc.line(26, 26, 26, 26 + cb);
  doc.line(pageWidth - 26, 26, pageWidth - 26 - cb, 26); doc.line(pageWidth - 26, 26, pageWidth - 26, 26 + cb);
  doc.line(26, pageHeight - 26, 26 + cb, pageHeight - 26); doc.line(26, pageHeight - 26, 26, pageHeight - 26 - cb);
  doc.line(pageWidth - 26, pageHeight - 26, pageWidth - 26 - cb, pageHeight - 26); doc.line(pageWidth - 26, pageHeight - 26, pageWidth - 26, pageHeight - 26 - cb);

  // Side dotted ornaments (subtle temple column reference)
  doc.setFillColor(gold[0], gold[1], gold[2]);
  for (let oy = 70; oy < pageHeight - 70; oy += 26) {
    doc.circle(27.5, oy, 1.1, 'F');
    doc.circle(pageWidth - 27.5, oy, 1.1, 'F');
  }

  // Faint watermark
  doc.setFont('times', 'bold');
  doc.setFontSize(150);
  doc.setTextColor(cream2[0], cream2[1], cream2[2]);
  doc.text('Om', pageWidth / 2, pageHeight / 2 + 45, { align: 'center' });

  // ── Header ────────────────────────────────────────────────────
  let y = 36;
  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('||  OM SRI GANESHAYA NAMAH  ||', pageWidth / 2, y, { align: 'center' });
  y += 15;

  try {
    if (ASTRO_SIVAM_LOGO_BASE64) {
      addLogo(doc, margin + 8 + BABY_NAMING_LEFT_HEADER_LOGO_INSET_PT, y - 2, 30);
      addLogo(
        doc,
        pageWidth - margin - 8 - 30 - BABY_NAMING_RIGHT_HEADER_LOGO_INSET_PT,
        y - 2,
        30
      );
    }
  } catch (e) {}

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM', pageWidth / 2, y + 11, { align: 'center' });
  y += 19;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('V E D I C   A S T R O L O G Y   •   P A N C H A N G A M   •   N A M A K A R A N', pageWidth / 2, y + 4, { align: 'center' });
  y += 14;

  // Ornamental divider
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.75);
  doc.line(margin + 30, y, pageWidth / 2 - 10, y);
  doc.line(pageWidth / 2 + 10, y, pageWidth - margin - 30, y);
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.circle(pageWidth / 2, y, 2.4, 'F');
  doc.setFillColor(white[0], white[1], white[2]);
  doc.circle(pageWidth / 2, y, 1.1, 'F');
  y += 12;

  // ── Title band ────────────────────────────────────────────────
  const bandH = 52;
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentWidth, bandH, 3, 3, 'FD');
  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.line(margin, y, margin + contentWidth, y);
  doc.line(margin, y + bandH, margin + contentWidth, y + bandH);

  const isTaPdf = lang === 'ta';
  const isHiPdf = lang === 'hi';
  const docTitle = isTaPdf ? 'Vedic Namakaran Report (Tamil)' : isHiPdf ? 'Vedic Namakaran Report (Hindi)' : 'Vedic Namakaran Report';
  const docSubtitle = isTaPdf
    ? 'Certified Baby Naming Dossier - Janma Nakshatra & Auspicious Syllables'
    : isHiPdf
    ? 'Certified Baby Naming Dossier - Janma Nakshatra & Auspicious Syllables'
    : 'Certified Baby Naming Dossier - Janma Nakshatra & Auspicious Syllables';

  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(maroonDeep[0], maroonDeep[1], maroonDeep[2]);
  doc.text(latin(docTitle), pageWidth / 2, y + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text(latin(docSubtitle), pageWidth / 2, y + 30, { align: 'center' });

  const certId = `AS-BN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const langName = isTaPdf ? 'Tamil' : isHiPdf ? 'Hindi' : 'English';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text(latin(`REPORT NO: ${certId}      •      ISSUE DATE: ${issueDate}      •      LANGUAGE: ${langName}`), pageWidth / 2, y + 43, { align: 'center' });
  y += bandH + 14;

  // ── Section head helper ───────────────────────────────────────
  const drawSectionHead = (no: string, title: string, curY: number): number => {
    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.roundedRect(margin, curY - 9, 14, 13, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(white[0], white[1], white[2]);
    doc.text(no, margin + 7, curY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(latin(title.toUpperCase()), margin + 21, curY);

    const titleW = doc.getTextWidth(latin(title.toUpperCase()));
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.7);
    doc.line(margin + 26 + titleW, curY - 3, margin + contentWidth, curY - 3);
    return curY + 12;
  };

  // ── 01: Baby particulars & astrological coordinates ───────────
  y = drawSectionHead('01', 'Baby Particulars & Astrological Coordinates', y);

  const genderStr = result.gender === 'M' ? 'Baby Boy' : 'Baby Girl';
  const detailRows = [
    [latin('Baby Name').toUpperCase(), latin(`${result.babyName || 'Newborn'} — ${genderStr}`), latin('Janma Nakshatram').toUpperCase(), latin(result.nakshatraLetters.nakshatraNameEn || 'N/A')],
    [latin('Date of Birth').toUpperCase(), latin(`${result.dob || 'N/A'}`), latin('Janma Pada').toUpperCase(), latin(`Pada ${result.janmaPada}`)],
    [latin('Time of Birth').toUpperCase(), latin(result.tob || 'N/A'), latin('Chandra Rasi (Moon)').toUpperCase(), latin(result.chandraRasiNameEn || 'N/A')],
    [latin('Place of Birth').toUpperCase(), latin(formatBirthPlace(result.birthPlace, result.country)), latin('Lagnam (Ascendant)').toUpperCase(), latin(result.lagnaRasiNameEn || 'N/A')],
    [latin('Nakshatra Lord').toUpperCase(), latin(result.nakshatraLetters.lordEn || 'N/A'), latin('Gana / Yoni').toUpperCase(), latin(`${result.nakshatraLetters.ganaEn || '-'} / ${result.nakshatraLetters.yoniEn || '-'}`)],
    [latin('Deity').toUpperCase(), latin(result.nakshatraLetters.deityEn || 'N/A'), latin('Rajju').toUpperCase(), latin(result.nakshatraLetters.rajjuEn || 'N/A')]
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: detailRows,
    theme: 'grid',
    bodyStyles: {
      fontSize: 8,
      textColor: ink,
      cellPadding: { top: 4.5, right: 5, bottom: 4.5, left: 5 },
      lineColor: line,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 88, fontStyle: 'bold', fillColor: cream2, textColor: goldDeep, fontSize: 6.6 },
      1: { cellWidth: 170, fontStyle: 'bold', textColor: ink },
      2: { cellWidth: 100, fontStyle: 'bold', fillColor: cream2, textColor: goldDeep, fontSize: 6.6 },
      3: { cellWidth: 'auto', fontStyle: 'bold', textColor: maroon }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 16;

  // ── 02: Primary auspicious naming syllable ────────────────────
  y = drawSectionHead('02', 'Primary Auspicious Naming Syllable', y);

  const panelH = 76;
  doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentWidth, panelH, 4, 4, 'FD');

  // One clear naming letter — no duplicate circular syllable badge.
  const txX = margin + 14;
  const txW = contentWidth - 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('PRIMARY AUSPICIOUS SOUND FOR THE JANMA PADA', txX, y + 16);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(maroonDeep[0], maroonDeep[1], maroonDeep[2]);
  const heroLine = latin(result.primaryPadaInfo.letterEn);
  fitFontSize(doc, heroLine, txW, 13, 8);
  doc.text(heroLine, txX, y + 32);

  // Rasi chip
  doc.setFillColor(white[0], white[1], white[2]);
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.6);
  const chipTxt = latin(`Rasi: ${result.primaryPadaInfo.rasiEn}`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  const chipW = doc.getTextWidth(chipTxt) + 16;
  doc.roundedRect(txX, y + 38, chipW, 12, 6, 6, 'FD');
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(chipTxt, txX + 8, y + 46);

  // Tamil / Hindi readings alongside the chip
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text(latin(`Tamil: ${result.primaryPadaInfo.letterTa}   •   Hindi: ${result.primaryPadaInfo.letterHi}`), txX + chipW + 12, y + 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  const desc = latin(`Names beginning with this sound are recommended for a baby born in ${result.nakshatraLetters.nakshatraNameEn} Nakshatra, Pada ${result.janmaPada}.`);
  const descLines = doc.splitTextToSize(desc, txW);
  doc.text(descLines.slice(0, 2), txX, y + 60);

  y += panelH + 16;

  // ── 03: Nakshatra pada syllables ──────────────────────────────
  const padaRows = result.nakshatraLetters.padas.map(p => [
    `Pada ${p.padaNumber}${p.padaNumber === result.janmaPada ? '  * JANMA PADA' : ''}`,
    latin(`${p.letterTa}   (${p.letterEn})`),
    latin(p.letterHi),
    latin(p.rasiEn)
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[latin('Pada (Quarter)').toUpperCase(), latin('Auspicious Starting Sound').toUpperCase(), latin('Hindi Reading').toUpperCase(), latin('Corresponding Rasi').toUpperCase()]],
    body: padaRows,
    theme: 'grid',
    headStyles: {
      fillColor: cream2,
      textColor: maroon,
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'left',
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: lineStrong,
      lineWidth: 0.5
    },
    bodyStyles: {
      fontSize: 8.2,
      textColor: ink,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: line,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 118, fontStyle: 'bold' },
      1: { cellWidth: 150, fontStyle: 'bold' },
      2: { cellWidth: 110 },
      3: { cellWidth: 'auto' }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.row.index === result.janmaPada - 1) {
        data.cell.styles.fillColor = goldPale;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = maroonDeep;
      }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 16;

  // ── 04: Vedic gunam & virtues ─────────────────────────────────
  y = drawSectionHead('04', 'Vedic Gunam & Innate Virtues', y);

  const birthSound = result.nakshatraLetters?.padas?.find(p => p.padaNumber === result.janmaPada)?.letterEn
    || result.nakshatraLetters?.allLettersSummaryEn || 'Vedic';
  const gunamRows = [
    ['1', latin(`Radiant Vitality & Intellect — blessed with high mental agility, keen observational clarity, and noble presence.`)],
    ['2', latin(`Compassion & Dharma Alignment — naturally inclined toward truthfulness, generosity, and strong moral grounding.`)],
    ['3', latin(`Auspicious Name Vibrations — the namakshara initial sound '${birthSound}' harmonizes longevity, success, and spiritual protection.`)],
    ['4', latin(`Family Blessing & Growth — the janma pada syllables support healthy development, affection, and auspicious beginnings.`)]
  ];

  const gunamTableOptions: any = {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [[latin('#').toUpperCase(), latin('Innate Vedic Virtue (Gunam) & Significance').toUpperCase()]],
    body: gunamRows,
    theme: 'grid',
    headStyles: {
      fillColor: cream2,
      textColor: green,
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'left',
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: lineStrong,
      lineWidth: 0.5
    },
    bodyStyles: {
      fontSize: 7.6,
      textColor: inkSoft,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: line,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center', fontStyle: 'bold', textColor: green },
      1: { cellWidth: 'auto' }
    }
  };

  // Fill the sheet: the virtue table is the last block above the certification
  // band, so its rows absorb the space between them (heights measured on a
  // scratch document with identical metrics) instead of the page ending in a
  // blank strip under the table.
  const gunamNaturalHeight = measureAutoTableHeight(gunamTableOptions);
  const gunamBandTop = pageHeight - 92 - 12;
  const gunamRowExtra = Math.max(0, Math.min(34, Math.floor((gunamBandTop - y - gunamNaturalHeight) / gunamRows.length)));
  if (gunamRowExtra > 0) {
    gunamTableOptions.bodyStyles = {
      ...gunamTableOptions.bodyStyles,
      minCellHeight: Math.round(gunamNaturalHeight / gunamRows.length) + gunamRowExtra
    };
  }
  autoTable(doc, gunamTableOptions);

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 16;

  // ── Footer: certification, signature & seal ───────────────────
  const footerTop = pageHeight - 92;
  if (y < footerTop) y = footerTop;

  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y - 8, margin + contentWidth, y - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  const certText = latin(`This report certifies the computed Janma Nakshatra, auspicious naming syllables and Vedic attributes for ${result.babyName || 'the newborn'}, derived through Lahiri Ayanamsa ephemeris calculations and verified by the ASTRO SIVAM astrology desk.`);
  doc.text(doc.splitTextToSize(certText, contentWidth - 190), margin, y + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text(latin(`REPORT NO: ${certId}   •   ISSUE DATE: ${issueDate}   •   astrosivam.com`), margin, y + 30);

  // Signature
  const signX = margin + contentWidth - 150;
  doc.setDrawColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.setLineWidth(0.6);
  doc.line(signX, y + 18, signX + 100, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text('ASTRO SIVAM — Astrology Desk', signX + 50, y + 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('AUTHORIZED ASTROLOGER', signX + 50, y + 31, { align: 'center' });

  // Verification seal
  const sealX = margin + contentWidth - 32;
  const sealY = y + 8;
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1.1);
  doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
  doc.circle(sealX, sealY, 26, 'FD');
  doc.setLineWidth(0.55);
  doc.circle(sealX, sealY, 22);
  doc.setFont('times', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO', sealX, sealY - 2, { align: 'center' });
  doc.text('SIVAM', sealX, sealY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.6);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('VERIFIED', sealX, sealY + 13, { align: 'center' });

  // Footer bar
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 42, margin + contentWidth, pageHeight - 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM', margin, pageHeight - 31);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('Official Vedic Namakaran Report', pageWidth / 2, pageHeight - 31, { align: 'center' });
  doc.text('admin@astrosivam.com', margin + contentWidth, pageHeight - 31, { align: 'right' });

  // Page 2 must also survive the server fallback used for email/downloads.
  // Use the same bank, gender and four pada sounds as the browser report.
  const nameColumns = buildNamakaranPadaNamesFromResult(result);
  if (nameColumns.length > 0) {
    doc.addPage('a4', 'portrait');
    doc.setFillColor(cream[0], cream[1], cream[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(1);
    doc.rect(18, 18, pageWidth - 36, pageHeight - 36);

    addLogo(doc, margin + BABY_NAMING_LEFT_HEADER_LOGO_INSET_PT, 35, 30);
    doc.setFont('times', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text('ASTRO SIVAM', pageWidth / 2, 51, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
    doc.text('Vedic Namakaran Report - Name Suggestions', pageWidth / 2, 67, { align: 'center' });
    doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
    doc.line(margin, 79, pageWidth - margin, 79);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(maroonDeep[0], maroonDeep[1], maroonDeep[2]);
    doc.text('South & North Indian Style Names', pageWidth / 2, 96, { align: 'center' });
    const metadata = latin(`${result.babyName || 'Newborn'} | ${result.nakshatraLetters.nakshatraNameEn} | Pada ${result.janmaPada} | ${genderStr}`);
    fitFontSize(doc, metadata, contentWidth, 8, 6);
    doc.setTextColor(green[0], green[1], green[2]);
    doc.text(metadata, pageWidth / 2, 111, { align: 'center' });

    const rowCounts = nameColumns.map(column =>
      Math.max(1, Math.ceil(Math.max(column.south.length, column.north.length) / 2)));
    const totalRows = rowCounts.reduce((sum, count) => sum + count, 0);
    const panelTop = 124;
    const panelBottom = pageHeight - 73;
    const panelWidth = (contentWidth - 10) / 2;
    const blockHeaderHeight = 19;
    const blockGap = 5;
    const rowHeight = (panelBottom - panelTop - 37 - nameColumns.length * blockHeaderHeight
      - (nameColumns.length - 1) * blockGap) / totalRows;
    const nameSize = totalRows > 28 ? 8.4 : totalRows > 22 ? 9.4 : 10.5;
    const meaningSize = totalRows > 28 ? 6.2 : 7.2;

    (['south', 'north'] as const).forEach((side, sideIndex) => {
      const panelX = margin + sideIndex * (panelWidth + 10);
      const headingColor = side === 'south' ? green : maroon;
      doc.setFillColor(white[0], white[1], white[2]);
      doc.setDrawColor(line[0], line[1], line[2]);
      doc.roundedRect(panelX, panelTop, panelWidth, panelBottom - panelTop, 3, 3, 'FD');
      doc.setFillColor(headingColor[0], headingColor[1], headingColor[2]);
      doc.rect(panelX + 4, panelTop + 4, panelWidth - 8, 17, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(white[0], white[1], white[2]);
      doc.text(side === 'south' ? 'SOUTH INDIAN STYLE NAMES' : 'NORTH INDIAN STYLE NAMES',
        panelX + panelWidth / 2, panelTop + 16, { align: 'center' });

      let blockY = panelTop + 29;
      const cellWidth = (panelWidth - 24) / 2;
      nameColumns.forEach((column, columnIndex) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(maroon[0], maroon[1], maroon[2]);
        doc.text(latin(`${column.soundEn} - Pada ${column.padaNumber}`), panelX + 8, blockY + 8);
        doc.setFontSize(6.5);
        doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
        doc.text(latin(column.rasiEn), panelX + panelWidth - 8, blockY + 8, { align: 'right' });
        doc.setDrawColor(line[0], line[1], line[2]);
        doc.line(panelX + 8, blockY + 13, panelX + panelWidth - 8, blockY + 13);
        blockY += blockHeaderHeight;

        column[side].forEach((entry, index) => {
          const textX = panelX + 8 + (index % 2) * (cellWidth + 8);
          const textY = blockY + Math.floor(index / 2) * rowHeight + rowHeight / 2 - 1.6;
          doc.setFont('helvetica', 'bold');
          fitFontSize(doc, latin(entry.name), cellWidth, nameSize, 8);
          doc.setTextColor(ink[0], ink[1], ink[2]);
          doc.text(latin(entry.name), textX, textY);
          doc.setFont('helvetica', 'normal');
          // The core-font fallback is Latin-safe, but the source meaning still
          // follows the ordered report language before `latin()` transliterates
          // it for jsPDF's WinAnsi font.
          const localizedMeaning = lang === 'ta'
            ? entry.meaningTa
            : lang === 'hi' ? entry.meaningHi : (entry.meaningEn || entry.meaning);
          fitFontSize(doc, latin(localizedMeaning), cellWidth, meaningSize, 5.5);
          doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
          doc.text(latin(localizedMeaning), textX, textY + meaningSize + 0.8);
        });
        blockY += rowCounts[columnIndex] * rowHeight + blockGap;
      });
    });

    if (nameColumns.some(column => column.usesRelatedSounds)) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
      doc.text('Where tradition offers few names for a pada sound, closely related sounds of the same letter are included.',
        pageWidth / 2, panelBottom + 14, { align: 'center' });
    }
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.line(margin, pageHeight - 46, pageWidth - margin, pageHeight - 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text('ASTRO SIVAM - Official Vedic Namakaran Report', pageWidth / 2, pageHeight - 34, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
    doc.text('astrosivam.com | admin@astrosivam.com', pageWidth / 2, pageHeight - 24, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Muhurtham PDF - recommended dates plus a ceremony-specific selection guide.
 * 2 pages: page 1 = devotee details + dates, page 2 = continuation + selection guide.
 */
export function generateMuhurthamPdf(result: any, lang: AppLanguage = 'en'): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const maroon: [number, number, number] = [122, 33, 41];
  const gold: [number, number, number] = [179, 134, 46];
  const cream: [number, number, number] = [253, 250, 244];
  const ink: [number, number, number] = [45, 36, 28];
  const soft: [number, number, number] = [92, 80, 68];
  const green: [number, number, number] = [46, 107, 79];
  const white: [number, number, number] = [255, 255, 255];
  const months: any[] = Array.isArray(result?.months)
    ? result.months
    : [result?.prevMonth, result?.chosenMonth, result?.nextMonth].filter((month: any) => Array.isArray(month?.days));
  const eventKey = String(result?.eventKey || 'wedding');
  const eventConfig: any = (muhurthamRules.events as Record<string, any>)[eventKey] || muhurthamRules.events.wedding;
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';
  const languageName = isTa ? 'Tamil' : isHi ? 'Hindi' : 'English';
  const eventTitle = latin(isTa
    ? result?.eventTitleTa || eventConfig?.titleTa || result?.eventTitleEn || eventConfig?.titleEn || 'சுப முகூர்த்தம்'
    : isHi
      ? result?.eventTitleHi || eventConfig?.titleHi || result?.eventTitleEn || eventConfig?.titleEn || 'शुभ मुहूर्त'
      : result?.eventTitleEn || eventConfig?.titleEn || 'Subha Muhurtham');
  const selectedMonthLabel = latin(isTa
    ? months[2]?.monthNameTa || months[2]?.monthNameEn || result?.selectedMonth || 'தேர்ந்தெடுத்த மாதம்'
    : isHi
      ? months[2]?.monthNameHi || months[2]?.monthNameEn || result?.selectedMonth || 'चुना हुआ महीना'
      : months[2]?.monthNameEn || result?.selectedMonth || 'selected month');
  const devotee = latin(result?.devoteeName || 'User');

  // Clean copy - only needed labels
  const copy: any = isTa ? {
    calendarTag: 'தனிப்பட்ட ஆறு மாத முகூர்த்த நாட்காட்டி',
    datesTitle: 'பரிந்துரைக்கப்பட்ட முகூர்த்த தேதிகள் - ஆறு மாதங்கள்',
    datesSub: 'தேதி • கிழமை • நட்சத்திரம் (சூரிய உதயம்) • நல்ல நேரம்',
    dateTableHeaders: ['தேதி & கிழமை', 'நட்சத்திரம்', 'நல்ல நேரம்', 'தரம்'],
    continued: 'தொடர்ச்சி',
    recommendedDates: 'பரிந்துரைக்கப்பட்ட தேதிகள்',
    bride: 'மணப்பெண்', groom: 'மணமகன்', janmaStar: 'ஜன்ம நட்சத்திரம்',
    singlePersonNote: 'ஒருவரின் விவரங்கள் மட்டும் பயன்படுத்தப்பட்டன - இரு ஜாதகங்களும் சரிபார்க்கப்படவில்லை.',
    reference: 'குறிப்பு எண்', issuedOn: 'வெளியிடப்பட்டது', preparedFor: 'தயாரிக்கப்பட்டது',
    signatory: 'அதிகாரம் பெற்ற கையொப்பம்', signatoryDesk: 'ASTRO SIVAM வேத ஆய்வு மேசை',
    certified: 'சான்றளித்தவர்: ASTRO SIVAM',
    name: 'பெயர்', dob: 'பிறந்த தேதி', tob: 'பிறந்த நேரம்', place: 'முகூர்த்த இடம் (உள்ளூர் நேரம்)', birthPlace: 'ஜன்ம நட்சத்திரத்திற்கான பிறந்த இடம்', language: 'அறிக்கை மொழி',
    best: 'உத்தமம்', good: 'சுபம்',
    noDates: 'இந்த மாதத்தில் பரிந்துரைக்கப்பட்ட தேதிகள் இல்லை',
    footer: 'ASTRO SIVAM • Clean auspicious dates only • astrosivam.com',
    page: (n: number, total: number) => `பக்கம் ${n} / ${total}`
  } : isHi ? {
    calendarTag: 'व्यक्तिगत छह-माह का शुभ मुहूर्त कैलेंडर',
    datesTitle: 'अनुशंसित मुहूर्त तिथियाँ - छह माह',
    datesSub: 'दिनांक • वार • नक्षत्र (सूर्योदय के समय) • शुभ समय',
    dateTableHeaders: ['दिनांक व वार', 'नक्षत्र', 'शुभ समय', 'श्रेणी'],
    continued: 'जारी',
    recommendedDates: 'अनुशंसित तिथियाँ',
    bride: 'वधू', groom: 'वर', janmaStar: 'जन्म नक्षत्र',
    singlePersonNote: 'केवल एक व्यक्ति का विवरण प्रयोग हुआ - दोनों कुंडलियाँ नहीं जाँची गईं।',
    reference: 'संदर्भ संख्या', issuedOn: 'जारी दिनांक', preparedFor: 'के लिए तैयार',
    signatory: 'अधिकृत हस्ताक्षरकर्ता', signatoryDesk: 'ASTRO SIVAM वैदिक अनुसंधान डेस्क',
    certified: 'प्रमाणित: ASTRO SIVAM',
    name: 'नाम', dob: 'जन्म तिथि', tob: 'जन्म समय', place: 'मुहूर्त स्थान (स्थानीय समय)', birthPlace: 'जन्म नक्षत्र हेतु जन्म स्थान', language: 'रिपोर्ट की भाषा',
    best: 'उत्तम', good: 'शुभ',
    noDates: 'इस माह कोई अनुशंसित तिथि नहीं है',
    footer: 'ASTRO SIVAM • Clean auspicious dates only • astrosivam.com',
    page: (n: number, total: number) => `पृष्ठ ${n} / ${total}`
  } : {
    calendarTag: 'PERSONALISED AUSPICIOUS DATES - SIX-MONTH CALENDAR',
    datesTitle: 'RECOMMENDED MUHURTHAM DATES - SIX MONTHS',
    datesSub: 'Date - Weekday - Nakshatra (at sunrise) - Nalla Neram',
    dateTableHeaders: ['DATE & DAY', 'NAKSHATRA', 'NALLA NERAM', 'GRADE'],
    continued: 'Continued from page 1',
    recommendedDates: 'recommended dates',
    bride: 'Bride', groom: 'Groom', janmaStar: 'Janma Nakshatra',
    singlePersonNote: 'Only one person\u2019s details were used - both charts were not checked.',
    reference: 'Reference', issuedOn: 'Issued On', preparedFor: 'Prepared For',
    signatory: 'Authorised Signatory', signatoryDesk: 'ASTRO SIVAM Vedic Research Desk',
    certified: 'Certified by ASTRO SIVAM',
    name: 'Name', dob: 'Date of birth', tob: 'Time of birth', place: 'Muhurtham location (local times)', birthPlace: 'Birth place for Janma Nakshatra', language: 'Report language',
    best: 'BEST', good: 'GOOD',
    noDates: 'No recommended dates this month',
    footer: 'ASTRO SIVAM • Clean auspicious dates only • astrosivam.com',
    page: (n: number, total: number) => `Page ${n} of ${total}`
  };

  const gradeLabels: Record<string, string> = { BEST: copy.best, GOOD: copy.good };
  const reportPageCount = MUHURTHAM_TOTAL_PAGES;
  // The window line is the REAL covered range the engines scanned
  // ("07 Oct 2026 - 31 Mar 2027"), never the rule wording.
  const windowRangeLabel = latin(
    (isTa ? result?.windowLabelTa : isHi ? result?.windowLabelHi : result?.windowLabelEn)
    || result?.windowLabelEn
    || '-'
  );
  // Both charts (when the order carries them) plus the honest one-person note.
  const persons: any[] = Array.isArray(result?.persons) ? result.persons : [];
  const bridePerson = persons.find((person: any) => String(person?.role || '').toLowerCase() === 'bride');
  const groomPerson = persons.find((person: any) => String(person?.role || '').toLowerCase() === 'groom');
  const singlePersonMode = !(bridePerson && groomPerson);
  const personStarLine = (person: any): string => latin([
    String(person?.name || '').trim(),
    String(person?.nakshatraNameEn || person?.nakshatraNameTa || '').trim(),
    String(person?.rasiNameEn || person?.rasiNameTa || '').trim(),
    String(person?.lagnaNameEn || person?.lagnaNameTa || '').trim()
  ].filter(Boolean).join(' - '));
  const preparedFor = latin(!singlePersonMode
    ? `${String(bridePerson?.name || '').trim()} & ${String(groomPerson?.name || '').trim()}`
    : String(persons[0]?.name || result?.devoteeName || 'User'));

  const MM = 2.834645;
  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = (value: unknown): string => {
    const parts = String(value ?? '').split('-');
    if (parts.length !== 3) return latin(value ?? '');
    return `${parts[2]} ${MONTH_ABBR[parseInt(parts[1], 10) - 1] || ''}`.trim();
  };
  const compactWindow = (value: unknown): string => {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    const clock = (raw: unknown) => {
      const match = /^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i.exec(String(raw ?? '').trim());
      return match ? `${parseInt(match[1], 10)}:${match[2]} ${match[3].toUpperCase()}M` : '';
    };
    const parts = items.map((item: any) => {
      if (typeof item === 'string') return item.trim();
      const start = clock(item?.start);
      const end = clock(item?.end);
      if (!start || !end) return String(item?.labelEn || item?.start || '').trim();
      return start.slice(-2) === end.slice(-2) ? `${start.slice(0, -3)} - ${end}` : `${start} - ${end}`;
    }).filter(Boolean);
    return parts.join(' · ') || '-';
  };

  type MuhurthamPdfRow = { blockIndex: number; kind: 'band' | 'date' | 'note'; cells: string[]; isBest: boolean; counts?: string; note?: string };
  const monthBlocks = months.map((month: any, monthIndex: number) => {
    const monthLabel = latin(isTa
      ? month.monthNameTa || month.monthNameEn || month.monthKey || `Month ${monthIndex + 1}`
      : isHi
        ? month.monthNameHi || month.monthNameEn || month.monthKey || `Month ${monthIndex + 1}`
        : month.monthNameEn || month.monthKey || `Month ${monthIndex + 1}`);
    const recommended = (month.days || []).filter((day: any) => ['BEST', 'GOOD'].includes(String(day.grade || '').toUpperCase()));
    const bestInMonth = recommended.filter((day: any) => String(day.grade || '').toUpperCase() === 'BEST').length;
    const counts = latin(recommended.length
      ? `${bestInMonth} ${copy.best} · ${recommended.length - bestInMonth} ${copy.good}`
      : copy.noDates);
    const rows: MuhurthamPdfRow[] = recommended.map((day: any) => {
      const isBest = String(day.grade || '').toUpperCase() === 'BEST';
      const weekday = latin(isTa ? day.dayOfWeekNameTa || day.dayOfWeekNameEn || '' : isHi ? day.dayOfWeekNameHi || day.dayOfWeekNameEn || '' : day.dayOfWeekNameEn || '');
      const star = latin(isTa ? day.nakshatraNameTa || day.nakshatraNameEn || '' : isHi ? day.nakshatraNameHi || day.nakshatraNameEn || '' : day.nakshatraNameEn || '');
      return {
        blockIndex: monthIndex,
        kind: 'date' as const,
        isBest,
        // The per-date Chandrashtama / Tara Bala line the browser and mPDF
        // reports print under each recommended date.
        note: latin(String(day.personalNoteEn || '').trim()),
        cells: [
          `${shortDate(day.date)} ${weekday}`.trim(),
          star || '-',
          latin(compactWindow(day.nallaNeram)),
          latin(gradeLabels[isBest ? 'BEST' : 'GOOD'] || String(day.grade || ''))
        ]
      };
    });
    if (!rows.length) {
      rows.push({ blockIndex: monthIndex, kind: 'note', isBest: false, cells: [latin(copy.noDates)] });
    }
    return { monthLabel, counts, rows };
  });

  const renderRows: MuhurthamPdfRow[] = [];
  monthBlocks.forEach((block: any, blockIndex: number) => {
    renderRows.push({ blockIndex, kind: 'band', isBest: false, cells: [block.monthLabel], counts: block.counts });
    block.rows.forEach((row: MuhurthamPdfRow) => renderRows.push(row));
  });

  const rowHeightMm = (fontPx: number, padMm: number) => fontPx * 0.3528 * 1.5 + padMm * 2 + 0.3;
  // A recommended date that carries a Chandrashtama / Tara Bala note is a
  // two-line row, so page fitting counts it as 1.55 single rows.
  const MUHURTHAM_NOTE_ROW_FACTOR = 1.55;
  const rowUnits = (row: MuhurthamPdfRow): number =>
    row.kind === 'date' && row.note ? MUHURTHAM_NOTE_ROW_FACTOR : 1;
  const totalUnits = renderRows.reduce((sum, row) => sum + rowUnits(row), 0);
  const densityTiers = MUHURTHAM_DENSITY_TIERS.map(tier => {
    const rowH = rowHeightMm(tier.fontPx, tier.padMm) * MM;
    return {
      ...tier,
      rowH,
      capacityUnits: Math.max(0, ((MUHURTHAM_PAGE1_DATE_BUDGET_MM + MUHURTHAM_PAGE2_DATE_BUDGET_MM) * MM) / rowH - 2)
    };
  });
  let density = densityTiers.find(tier => tier.capacityUnits >= totalUnits) || densityTiers[densityTiers.length - 1];
  if (density.capacityUnits < totalUnits) {
    const scale = ((MUHURTHAM_PAGE1_DATE_BUDGET_MM + MUHURTHAM_PAGE2_DATE_BUDGET_MM) * MM * 0.97) / (totalUnits * density.rowH);
    density = { ...density, fontPx: density.fontPx * scale, padMm: density.padMm * scale, rowH: density.rowH * scale };
  }
  const page1UnitBudget = Math.max(4, ((MUHURTHAM_PAGE1_DATE_BUDGET_MM * MM) / density.rowH) - 1);
  const page2UnitBudget = Math.max(0, (MUHURTHAM_PAGE2_DATE_BUDGET_MM * MM) / density.rowH);
  let page1Units = 0;
  let page1Count = 0;
  for (const row of renderRows) {
    const units = rowUnits(row);
    if (page1Count > 0 && page1Units + units > page1UnitBudget) break;
    page1Units += units;
    page1Count += 1;
  }
  const page1Rows = renderRows.slice(0, page1Count);
  const page2Rows = renderRows.slice(page1Count);
  const page2Capacity = Math.max(0, Math.floor(page2UnitBudget / MUHURTHAM_NOTE_ROW_FACTOR));
  if (page2Rows.length && page1Rows.length && page1Rows[page1Rows.length - 1].kind === 'band') {
    page2Rows.unshift(page1Rows.pop() as MuhurthamPdfRow);
  }
  const datesContinueOnPage2 = page2Rows.length > 0;
  if (datesContinueOnPage2 && page2Rows[0].kind !== 'band') {
    const carriedIndex = page2Rows[0].blockIndex;
    if (page1Rows.some(row => row.blockIndex === carriedIndex) && page2Rows.length < page2Capacity) {
      page2Rows.unshift({
        blockIndex: carriedIndex,
        kind: 'band',
        isBest: false,
        cells: [`${monthBlocks[carriedIndex].monthLabel} (${latin(copy.continued)})`],
        counts: monthBlocks[carriedIndex].counts
      });
    }
  }
  const recommendedCount = renderRows.filter(row => row.kind === 'date').length;

  const dateColRatios = MUHURTHAM_DATE_COLUMN_RATIOS;
  const dateColX = dateColRatios.reduce((xs: number[], ratio: number, index: number) => {
    xs.push(index === 0 ? margin : xs[index - 1] + dateColRatios[index - 1] * contentWidth);
    return xs;
  }, [] as number[]);
  const headerHeight = density.rowH * 0.9;

  const fitText = (text: string, maxWidth: number, fontSize: number, style: 'normal' | 'bold'): string => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let clipped = text;
    while (clipped.length > 1 && doc.getTextWidth(`${clipped}...`) > maxWidth) clipped = clipped.slice(0, -1);
    return `${clipped.trimEnd()}...`;
  };

  const fitTimeCell = (text: string, maxWidth: number, fontSize: number): { text: string; fontSize: number } => {
    const scale = muhurthamTimeFontScale(text.length, fontSize * 0.3528);
    const scaledFontSize = fontSize * scale;
    const fitted = fitText(text, maxWidth, scaledFontSize, 'normal');
    return { text: fitted, fontSize: scaledFontSize };
  };

  const drawDatesTable = (rows: MuhurthamPdfRow[], startY: number, grow = 1): number => {
    const fontPt = Math.max(5, density.fontPx * 0.75);
    // Only the pitch grows (never the glyphs): a short date list spreads over
    // the sheet instead of leaving the bottom half blank, and a full one is
    // untouched because `grow` stays 1.
    const rowH = density.rowH * grow;
    const rowHeightOf = (row: MuhurthamPdfRow) => rowH * rowUnits(row);
    let y = startY;
    doc.setFillColor(maroon[0], maroon[1], maroon[2]);
    doc.rect(margin, y, contentWidth, headerHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.max(5, fontPt * 0.86));
    doc.setTextColor(white[0], white[1], white[2]);
    copy.dateTableHeaders.forEach((heading: string, index: number) => {
      doc.text(latin(heading).toUpperCase(), dateColX[index] + 4, y + headerHeight * 0.68, {
        align: index === 3 ? 'center' : 'left'
      });
    });
    y += headerHeight;
    rows.forEach((row, rowIndex) => {
      const thisRowH = rowHeightOf(row);
      if (row.kind === 'band') {
        doc.setFillColor(253, 242, 244);
        doc.rect(margin, y, contentWidth, rowH, 'F');
        doc.setDrawColor(gold[0], gold[1], gold[2]);
        doc.setLineWidth(0.25);
        doc.line(margin, y, margin + contentWidth, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(5, fontPt * 0.94));
        doc.setTextColor(maroon[0], maroon[1], maroon[2]);
        doc.text(fitText(latin(row.cells[0]), contentWidth * 0.6, fontPt * 0.94, 'bold'), margin + 4, y + rowH * 0.66);
        doc.setTextColor(green[0], green[1], green[2]);
        doc.text(fitText(latin(String(row.counts || '')), contentWidth * 0.36, fontPt * 0.9, 'bold'), margin + contentWidth - 4, y + rowH * 0.66, { align: 'right' });
      } else if (row.kind === 'note') {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowH, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(Math.max(5, fontPt * 0.9));
        doc.setTextColor(120, 130, 145);
        doc.text(fitText(latin(row.cells[0]), contentWidth - 12, fontPt * 0.9, 'normal'), margin + contentWidth / 2, y + rowH * 0.66, { align: 'center' });
      } else {
        const isBest = row.isBest;
        doc.setFillColor(isBest ? 244 : rowIndex % 2 === 0 ? 250 : 255, isBest ? 251 : rowIndex % 2 === 0 ? 246 : 255, isBest ? 247 : rowIndex % 2 === 0 ? 238 : 255);
        doc.rect(margin, y, contentWidth, rowH, 'F');
        if (isBest) {
          doc.setFillColor(gold[0], gold[1], gold[2]);
          doc.rect(margin, y, 1.6, rowH, 'F');
        }
        // A row with a personal note is two lines: the primary cells sit on the
        // upper line, the Chandrashtama / Tara Bala note underneath the star.
        const primaryY = y + thisRowH * (row.note ? 0.38 : 0.66);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontPt);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.text(fitText(latin(row.cells[0]), dateColX[1] - dateColX[0] - 6, fontPt, 'bold'), dateColX[0] + 4, primaryY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(maroon[0], maroon[1], maroon[2]);
        doc.text(fitText(latin(row.cells[1]), dateColX[2] - dateColX[1] - 6, fontPt, 'normal'), dateColX[1] + 3, primaryY);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        const timeCell = fitTimeCell(latin(row.cells[2]), dateColX[3] - dateColX[2] - 6, fontPt);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(timeCell.fontSize);
        doc.text(timeCell.text, dateColX[2] + 3, primaryY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isBest ? green[0] : 146, isBest ? green[1] : 64, isBest ? green[2] : 14);
        doc.text(fitText(latin(row.cells[3]), 70, fontPt, 'bold'), margin + contentWidth - 4, primaryY, { align: 'right' });
        if (row.note) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(Math.max(4.6, fontPt * 0.78));
          doc.setTextColor(soft[0], soft[1], soft[2]);
          doc.text(
            fitText(latin(row.note), dateColX[3] - dateColX[1] - 6, Math.max(4.6, fontPt * 0.78), 'normal'),
            dateColX[1] + 3,
            y + thisRowH * 0.82
          );
        }
      }
      doc.setDrawColor(232, 224, 210);
      doc.setLineWidth(0.2);
      doc.line(margin, y + thisRowH, margin + contentWidth, y + thisRowH);
      y += thisRowH;
    });
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    return y;
  };

  const drawFooter = (pageNumber: number) => {
    const footerY = pageHeight - 16;
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(latin(copy.footer), margin, footerY);
    doc.text(latin(copy.page(pageNumber, reportPageCount)), pageWidth - margin, footerY, { align: 'right' });
  };
  // PAGE 1
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  let y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: copy.calendarTag,
    meta: `${languageName.toUpperCase()} MUHURTHAM REPORT`
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  const titleLines = doc.splitTextToSize(`${eventTitle} - ${recommendedCount} ${latin(copy.recommendedDates)}`, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 13 + 2;

  const MONTH_ABBR_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const prettyDob = (() => {
    const parts = String(result?.dob || '').split('-');
    if (parts.length !== 3) return '-';
    return `${parts[2]} ${MONTH_ABBR_FULL[parseInt(parts[1], 10) - 1] || ''} ${parts[0]}`.replace(/\s+/g, ' ').trim();
  })();
  const prettyTob = (() => {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(result?.tob || '').trim());
    if (!match) return latin(result?.tob || '-');
    const hour = parseInt(match[1], 10);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  })();
  const muhurthamPlace = formatBirthPlace(
    result?.muhurthamPlace,
    result?.muhurthamCountry
  ) || '-';
  const birthPlaceForStar = formatBirthPlace(result?.birthPlace, result?.country) || '-';
  const placeDetails = `${muhurthamPlace}\n${copy.birthPlace}: ${birthPlaceForStar}`;
  const personRows: any[][] = [];
  if (!singlePersonMode) {
    personRows.push([latin(copy.bride), personStarLine(bridePerson), latin(copy.groom), personStarLine(groomPerson)]);
  } else if (persons.length) {
    personRows.push([latin(copy.janmaStar), personStarLine(persons[0]), latin(copy.place), latin(muhurthamPlace)]);
  }
  const details = [
    [latin(copy.name), devotee, latin(copy.dob), latin(prettyDob)],
    [latin(copy.tob), latin(prettyTob), latin(copy.place), latin(placeDetails)],
    [latin(copy.window), windowRangeLabel, latin(copy.language), languageName],
    ...personRows
  ];
  if (singlePersonMode && persons.length) {
    // Never pretend both charts were checked.
    details.push([{ content: latin(copy.singlePersonNote), colSpan: 4, styles: { fontStyle: 'italic', textColor: [120, 53, 15], fillColor: [255, 251, 235], fontSize: 6.4 } }]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    body: details,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: { top: 1.9, right: 4, bottom: 1.9, left: 4 }, textColor: ink, lineColor: [229, 217, 197], lineWidth: 0.35 },
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold', textColor: soft },
      1: { cellWidth: contentWidth / 2 - 68 },
      2: { cellWidth: 68, fontStyle: 'bold', textColor: soft },
      3: { cellWidth: 'auto' }
    },
    alternateRowStyles: { fillColor: [250, 246, 238] }
  });
  y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(latin(copy.datesTitle), margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(soft[0], soft[1], soft[2]);
  doc.text(fitText(latin(copy.datesSub), contentWidth - doc.getTextWidth(latin(copy.datesTitle)) - 12, 6.9, 'normal'), pageWidth - margin, y, { align: 'right' });
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.45);
  doc.line(margin, y + 3, pageWidth - margin, y + 3);
  const page1TableTop = y + 7;
  const page1CertTop = pageHeight - 16 - 8 - 20;   // footer rule, then the cert line
  const page1NaturalTable = headerHeight + page1Rows.length * density.rowH;
  // Stretch the calendar rows until they reach the certification band (the
  // same rule the browser and mPDF versions apply), so a month with few
  // muhurtham dates still covers the sheet. The pitch cap keeps an almost
  // empty list from turning into a page of oversized boxes.
  const page1Grow = Math.max(1, Math.min(
    (page1CertTop - 8 - page1TableTop) / Math.max(1, page1NaturalTable),
    200 / Math.max(1, density.rowH)
  ));
  y = drawDatesTable(page1Rows, page1TableTop, page1Grow);
  // Certification beneath the first-page calendar, kept on the band above the
  // footer so the sheet ends with content instead of a blank strip.
  const page1CertLineY = Math.min(Math.max(y + 14, page1CertTop + 10), pageHeight - 44);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(latin(copy.certified), margin, page1CertLineY);
  drawFooter(1);

  // PAGE 2 - date continuation and compact selection guide
  doc.addPage();
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    subtitle: `${copy.datesTitle} - ${datesContinueOnPage2 ? copy.continued : 'Complete'}`,
    meta: copy.calendarTag
  });
  // Everything below the header is split between the (optional) continuation
  // table, the guide panel and the certification band, so page 2 is filled from
  // the header down to the footer band instead of ending mid-sheet.
  const page2CertTop = pageHeight - 16 - 8 - 44;
  const page2NotesTop = Math.max(y + 46, MUHURTHAM_PAGE2_NOTES_START_MM * MM + 10);
  if (datesContinueOnPage2) {
    const natural2 = headerHeight + page2Rows.length * density.rowH;
    const page2Grow = Math.max(1, Math.min(
      (page2NotesTop - 14 - y) / Math.max(1, natural2),
      200 / Math.max(1, density.rowH)
    ));
    y = drawDatesTable(page2Rows, y, page2Grow) + 14;
  } else {
    // The calendar is complete on page 1: keep the frame that states so, sized
    // to the upper half (same panel the browser and mPDF versions draw).
    doc.setFillColor(white[0], white[1], white[2]);
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentWidth, page2NotesTop - 14 - y, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(soft[0], soft[1], soft[2]);
    doc.text(`All ${recommendedCount} recommended dates are listed on page 1 - Clean dates only`, margin + contentWidth / 2, y + (page2NotesTop - 14 - y) / 2, { align: 'center' });
    // (the panel is drawn from `y` to `page2NotesTop - 14`; the guide starts
    // immediately after it so the explanation, not empty space, owns the page)
    y = page2NotesTop;
  }
  // These notes explain the rules; they never change the dates / grades in the
  // scan. This Node direct-download renderer only has Helvetica / Latin fonts.
  // Keep a long explanation readable in English rather than transliterating
  // whole paragraphs. Browser / mPDF use native scripts; customer emails use
  // browser PDFs.
  y = Math.max(y, page2NotesTop);
  const notes = buildMuhurthamReportNotes(result, 'en');
  // Larger type for the lower-half explanation, matching the browser and mPDF
  // reports. The measured worst case (all dates AVOID + a full page-2 table)
  // still ends well above the footer band.
  const noteBlocks = [
    { text: notes.title, size: 11.5, bold: true },
    { text: notes.checksHeading, size: 10, bold: true },
    { text: notes.checksText, size: 9.6, bold: false },
    { text: notes.weekdayHeading, size: 10, bold: true },
    { text: notes.weekdayText, size: 9.6, bold: false },
    { text: notes.selectionHeading, size: 10, bold: true },
    { text: notes.summaryText, size: 9.6, bold: true },
    { text: notes.selectionText, size: 9.6, bold: false }
  ];
  // Measure the guide before drawing it so the leftover height between the
  // blocks (and inside the panel) can be shared out instead of pooling under
  // the last paragraph.
  const notePad = 12;
  const measuredNotes = noteBlocks.map(block => {
    doc.setFont('helvetica', block.bold ? 'bold' : 'normal');
    doc.setFontSize(block.size);
    return { ...block, lines: doc.splitTextToSize(latin(block.text), contentWidth - 24) };
  });
  const notesNatural = measuredNotes.reduce((sum, n) => sum + n.lines.length * n.size * 1.5 + 5, 0);
  const notesPanelTop = y;
  const notesPanelHeight = Math.max(notesNatural + notePad * 2, page2CertTop - notesPanelTop - 10);
  const notesSpread = Math.min(26, (notesPanelHeight - notePad * 2 - notesNatural) / (measuredNotes.length + 1));
  doc.setFillColor(255, 250, 240);
  doc.setDrawColor(203, 187, 137);
  doc.setLineWidth(0.5);
  doc.rect(margin, notesPanelTop, contentWidth, notesPanelHeight, 'FD');
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, notesPanelTop, 2, notesPanelHeight, 'F');
  y = notesPanelTop + notePad + notesSpread;
  for (const n of measuredNotes) {
    doc.setFont('helvetica', n.bold ? 'bold' : 'normal');
    doc.setFontSize(n.size);
    doc.setTextColor(...(n.bold ? maroon : ink));
    doc.text(n.lines, margin + 12, y, { lineHeightFactor: 1.5 });
    y += n.lines.length * n.size * 1.5 + 5 + notesSpread;
  }

  // Authorisation block: reference number, issued-on, prepared-for and the
  // signatory desk - the same block the marriage report, the browser report and
  // the mPDF report print.
  const referenceNo = ((): string => {
    const explicit = result?.orderNumber || result?.reportNumber;
    if (explicit) return latin(explicit);
    const stampSource = result?.generatedAt ? new Date(result.generatedAt) : new Date();
    if (isNaN(stampSource.getTime())) return 'ASTRO-MUH';
    return `ASTRO-MUH-${stampSource.getFullYear()}${String(stampSource.getMonth() + 1).padStart(2, '0')}${String(stampSource.getDate()).padStart(2, '0')}`;
  })();
  const issuedOn = ((): string => {
    const source = result?.generatedAt ? new Date(result.generatedAt) : new Date();
    if (isNaN(source.getTime())) return '-';
    const offset = Number(result?.muhurthamTimezoneOffsetHours ?? 5.5);
    const safeOffset = isFinite(offset) ? offset : 5.5;
    const shifted = new Date(source.getTime() + safeOffset * 3600 * 1000);
    const sign = safeOffset < 0 ? '-' : '+';
    const abs = Math.abs(safeOffset);
    const clock = `${String(shifted.getUTCDate()).padStart(2, '0')} ${MONTH_ABBR_FULL[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}, `
      + `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
    return `${clock} GMT${sign}${Math.floor(abs)}:${String(Math.round((abs % 1) * 60)).padStart(2, '0')}`;
  })();
  doc.setFillColor(253, 242, 244);
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, page2CertTop, contentWidth, 36, 'FD');
  const authCols: [string, string][] = [
    [copy.reference, referenceNo],
    [copy.issuedOn, issuedOn],
    [copy.preparedFor, preparedFor]
  ];
  authCols.forEach(([label, value], index) => {
    const colX = margin + 8 + index * (contentWidth * 0.24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text(latin(label).toUpperCase(), colX, page2CertTop + 10);
    doc.setFontSize(7.4);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(fitText(latin(value), contentWidth * 0.23 - 8, 7.4, 'bold'), colX, page2CertTop + 19);
  });
  const signX = margin + 8 + contentWidth * 0.73;
  doc.setDrawColor(soft[0], soft[1], soft[2]);
  doc.setLineWidth(0.4);
  doc.line(signX, page2CertTop + 13, margin + contentWidth - 8, page2CertTop + 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(soft[0], soft[1], soft[2]);
  doc.text(latin(copy.signatory), signX, page2CertTop + 20);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.setFontSize(6.6);
  doc.text(fitText(latin(copy.signatoryDesk), margin + contentWidth - 8 - signX, 6.6, 'bold'), signX, page2CertTop + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(latin(copy.certified), margin + 8, page2CertTop + 30);
  drawFooter(2);

  return Buffer.from(doc.output('arraybuffer'));
}
export function generateInvoicePdf(order: any): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Professional palette (matches the browser invoice export)
  const maroon: [number, number, number] = [122, 33, 41];
  const maroonDeep: [number, number, number] = [92, 23, 32];
  const gold: [number, number, number] = [179, 134, 46];
  const goldDeep: [number, number, number] = [140, 106, 30];
  const goldPale: [number, number, number] = [247, 239, 221];
  const cream: [number, number, number] = [253, 250, 244];
  const cream2: [number, number, number] = [246, 239, 225];
  const ink: [number, number, number] = [45, 36, 28];
  const inkSoft: [number, number, number] = [92, 80, 68];
  const inkMute: [number, number, number] = [138, 124, 108];
  const line: [number, number, number] = [229, 217, 197];
  const lineStrong: [number, number, number] = [203, 187, 137];
  const green: [number, number, number] = [46, 107, 79];
  const greenPale: [number, number, number] = [234, 244, 238];
  const white: [number, number, number] = [255, 255, 255];

  // ── Centered Baby Naming-style invoice header ──────────────────
  const invNo = `INV-${order.orderNumber || '0000'}`;
  let y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
    subtitle: 'Official Receipt & Tax Invoice • Vedic Astrology Services',
    meta: `TAX INVOICE • ${invNo} • Business Reg. ASV-FJ-2026`
  });

  // ── Service line items ────────────────────────────────────────
  let serviceDesc = 'Vedic Astrological Calculation & Comprehensive Kundali';
  if (order.serviceType === 'BIRTH_JATHAGAM') {
    serviceDesc = 'Vedic Birth Jathagam — Precision Horoscope, Planetary Positions & Dasha Predictions';
  } else if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    serviceDesc = '10-Poruthams Vedic Marriage Compatibility Assessment & Kuja Dosha Alignment';
  } else if (order.serviceType === 'BABY_NAMING') {
    serviceDesc = 'Sacred Vedic Namakaran (Baby Naming) Nakshatra Syllables & Auspicious Names Report';
  } else if (order.serviceType === 'MUHURTHAM') {
    serviceDesc = 'Subha Muhurtham — Six-Month Panchangam Auspicious Date Calendar';
  }

  const langDisplay = order.language === 'ta' ? 'Tamil' : order.language === 'hi' ? 'Hindi' : 'English';
  const amountVal = Number(order.amount || 0).toFixed(2);
  const currency = order.currency || 'FJD';

  // ── Fill the sheet ────────────────────────────────────────────
  // Every block of the one-page invoice is measured before anything is drawn
  // (the item table on a scratch document, the wrapped copy with the same
  // fonts), so the space between the last block and the certification band is
  // shared out as extra height inside the existing blocks. The invoice covers
  // the sheet from the header rule to the footer band instead of ending in a
  // blank lower third.
  const itemTableProbe: any = {
    startY: 40,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['#', 'SERVICE DESCRIPTION', 'LANGUAGE', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: [['1', latin(serviceDesc), langDisplay, '1', `${currency} ${amountVal}`, `${currency} ${amountVal}`]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8 }
  };
  const itemTableNatural = measureAutoTableHeight(itemTableProbe);
  const itemRowNatural = Math.max(14, itemTableNatural - measureAutoTableHeight({ ...itemTableProbe, body: [] }));
  const boxW = (contentWidth - 12) / 2;
  const payStripNatural = 30;
  const termsCopy = [
    '• Official Report: generated and certified with high-accuracy Vedic ephemeris calculations.',
    '• Digital Delivery: your certified report and this tax invoice are emailed directly to your registered address as PDF attachments.',
    '• Permanent Keeping: please save both PDFs to your personal device for future reference.',
    '• Support & Inquiries: astrosivam.com • admin@astrosivam.com'
  ];
  const decTextPre = 'This is a computer-generated tax invoice issued electronically and does not require a physical signature to be valid. It certifies that the amount stated above has been received in full by ASTRO SIVAM against the service described, and confirms delivery of the associated digital Vedic astrology report to the customer\'s registered email address.';
  const decLines: string[] = doc.splitTextToSize(decTextPre, contentWidth - 22);
  const decLineH = 6.6 * 1.15; // jsPDF default lineHeightFactor at 6.6pt
  const decH = Math.max(30, 20 + (decLines.length - 1) * decLineH + 6.6 + 5);
  const termsLineCounts = termsCopy.map(n => doc.splitTextToSize(n, (pageWidth - margin * 2) * 0.6 - 26).length);
  const termsLineTotal = termsLineCounts.reduce((a, b) => a + b, 0);
  const termsBlockNatural = termsLineTotal * 9.5 + termsLineCounts.length * 2.5;
  const sealBlockHeight = 52;
  const invoiceSealTop = pageHeight - 38 - 14 - sealBlockHeight;
  const invoiceNaturalSealTop = y + 96 + 14 + payStripNatural + 14 + itemTableNatural + 16
    + Math.max(104, termsBlockNatural) + 16 + decH + 18;
  const invoiceSlack = Math.max(0, invoiceSealTop - invoiceNaturalSealTop);
  const boxExtra = Math.min(34, Math.round(invoiceSlack * 0.2));
  const payExtra = Math.min(14, Math.round(invoiceSlack * 0.08));
  const itemRowExtra = Math.min(34, Math.round(invoiceSlack * 0.14));
  const boxH = 96 + boxExtra;
  const payStripH = payStripNatural + payExtra;
  const invoiceRowStep = 15 + Math.min(10, boxExtra / 6);


  // ── Info boxes: Invoice Details + Billed To ───────────────────

  const drawInfoBox = (bx: number, title: string, rows: Array<[string, string]>) => {
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(bx, y, boxW, boxH, 3, 3, 'D');
    doc.setFillColor(cream2[0], cream2[1], cream2[2]);
    doc.rect(bx + 0.6, y + 0.6, boxW - 1.2, 17, 'F');
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(bx, y + 17.5, bx + boxW, y + 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(title.toUpperCase(), bx + 9, y + 11.5);

    rows.forEach((r, ri) => {
      const ry = y + 31 + ri * invoiceRowStep + (boxH - 96) * 0.28;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
      doc.text(r[0], bx + 9, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(ink[0], ink[1], ink[2]);
      const safeVal = latin(r[1]);
      fitFontSize(doc, safeVal, boxW - 90, 8, 6);
      doc.text(safeVal, bx + boxW - 9, ry, { align: 'right' });
    });
  };

  const createdDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  drawInfoBox(margin, 'Invoice Details', [
    ['INVOICE NO.', invNo],
    ['ORDER REF.', `${order.orderNumber || '0000'}`],
    ['DATE ISSUED.', createdDate],
    ['PAYMENT STATUS.', 'PAID & VERIFIED']
  ]);
  drawInfoBox(margin + boxW + 12, 'Billed To (Client)', [
    ['NAME', order.userName || 'Client'],
    ['EMAIL', order.userEmail || 'N/A'],
    ['MOBILE', order.userMobile || 'N/A'],
    ['LOCATION', order.country || 'Global']
  ]);
  y += boxH + 14;

  // ── Payment verification strip ────────────────────────────────
  const payMethodDisplay = order.paymentMethod === 'MPAISA' ? 'Vodafone M-PAiSA'
    : order.paymentMethod === 'MYCASH' ? 'Digicel MyCash'
    : order.paymentMethod === 'PAYPAL' ? 'PayPal Checkout'
    : order.paymentMethod === 'GPAY' ? 'Google Pay'
    : order.paymentMethod || 'Direct Payment';

  const cellW = (contentWidth - 16) / 3;
  const payCells: Array<[string, string]> = [
    ['PAYMENT METHOD', payMethodDisplay],
    ['TXN REF.', order.paymentReference || 'ADM-VERIFIED'],
    ['CURRENCY', order.currency || 'FJD']
  ];
  payCells.forEach((c, ci) => {
    const cx = margin + ci * (cellW + 8);
    doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
    doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(cx, y, cellW, payStripH, 3, 3, 'FD');
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.circle(cx + 13, y + payStripH / 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(white[0], white[1], white[2]);
    doc.text(['✓', '#', '$'][ci], cx + 13, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
    doc.text(c[0], cx + 25, y + payStripH / 2 - 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const safePay = latin(c[1]);
    fitFontSize(doc, safePay, cellW - 32, 7.4, 5.5);
    doc.text(safePay, cx + 25, y + payStripH / 2 + 7);
  });
  y += payStripH + 14;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['#', 'SERVICE DESCRIPTION', 'LANGUAGE', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: [['1', latin(serviceDesc), langDisplay, '1', `${currency} ${amountVal}`, `${currency} ${amountVal}`]],
    theme: 'grid',
    // The single service line takes its share of the leftover height (the copy
    // stays vertically centred inside the taller row).
    ...(itemRowExtra > 0
      ? { bodyStyles: { cellPadding: { top: 6, right: 6, bottom: 6, left: 6 }, minCellHeight: Math.round(itemRowNatural) + itemRowExtra } }
      : {}),
    headStyles: {
      fillColor: maroon,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineWidth: 0
    },
    bodyStyles: {
      textColor: inkSoft,
      fontSize: 8,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      lineColor: line,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24, textColor: inkMute },
      1: { cellWidth: 'auto', fontStyle: 'bold', textColor: ink },
      2: { halign: 'center', cellWidth: 62 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 76 },
      5: { halign: 'right', cellWidth: 82, fontStyle: 'bold', textColor: ink }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 16;

  // ── Terms (left) + Totals (right) ─────────────────────────────
  const totalsW = 216;
  const totalsX = margin + contentWidth - totalsW;
  const totalsH = 104;

  // The totals card, the terms list and the declaration box split the space
  // between the items table and the signature band (the card's inner rows
  // spread with it), so the sheet is covered down to the footer rule.
  // The summary card takes the whole space between the items table and the
  // declaration (its five rows spread across it); the declaration only grows if
  // the card has already reached its own limit.
  const invoiceTailSpace = Math.max(0, invoiceSealTop - y - 16 - decH - 18);
  const totalsCardH = Math.min(420, Math.max(totalsH, Math.round(invoiceTailSpace)));
  const totalsScale = totalsCardH / totalsH;
  const termsStep = 9.5 + Math.max(0, Math.min(6,
    (totalsCardH - termsBlockNatural) / Math.max(1, termsLineTotal)));
  const decExtra = Math.min(96, Math.max(0, Math.round(invoiceTailSpace - totalsCardH)));
  const declarationH = decH + decExtra;
  // The declaration keeps its heading at the top of the box and the copy is
  // centred in the space below it, so growing the box never looks like a gap.
  const declarationBodyHeight = decLines.length * decLineH + 6;
  const declarationTextTop = 20 + Math.max(0, (declarationH - 26 - declarationBodyHeight) / 2);

  // Totals card
  doc.setFillColor(white[0], white[1], white[2]);
  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.setLineWidth(0.9);
  doc.roundedRect(totalsX, y, totalsW, totalsCardH, 3, 3, 'FD');
  doc.setFillColor(cream2[0], cream2[1], cream2[2]);
  doc.rect(totalsX + 0.6, y + 0.6, totalsW - 1.2, 17, 'F');
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.line(totalsX, y + 17.5, totalsX + totalsW, y + 17.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('PAYMENT SUMMARY', totalsX + totalsW / 2, y + 11.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text('Subtotal', totalsX + 12, y + 33 * totalsScale);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(`${currency} ${amountVal}`, totalsX + totalsW - 12, y + 33 * totalsScale, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text('Tax / VAT (0.0%)', totalsX + 12, y + 47 * totalsScale);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(`${currency} 0.00`, totalsX + totalsW - 12, y + 47 * totalsScale, { align: 'right' });

  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.setLineWidth(0.6);
  doc.line(totalsX + 12, y + 55 * totalsScale, totalsX + totalsW - 12, y + 55 * totalsScale);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('TOTAL PAID', totalsX + 12, y + 70 * totalsScale);
  doc.text(`${currency} ${amountVal}`, totalsX + totalsW - 12, y + 70 * totalsScale, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(green[0], green[1], green[2]);
  doc.text('Balance Due', totalsX + 12, y + 88 * totalsScale);
  doc.text(`${currency} 0.00  (PAID)`, totalsX + totalsW - 12, y + 88 * totalsScale, { align: 'right' });

  // Terms (left of totals)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('DELIVERY & FULFILLMENT TERMS', margin, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  const terms = termsCopy;
  let noteY = y + 15;
  terms.forEach(n => {
    doc.setFillColor(gold[0], gold[1], gold[2]);
    const wrapped = doc.splitTextToSize(n, totalsX - margin - 26);
    wrapped.forEach((ln: string, i: number) => {
      if (i === 0) doc.circle(margin + 3, noteY - 2.5, 1.2, 'F');
      doc.text(ln, margin + 10, noteY);
      noteY += termsStep;
    });
    noteY += 2.5;
  });

  y += Math.max(totalsCardH, noteY - y) + 16;

  // ── Declaration ───────────────────────────────────────────────
  // Box height comes from the WRAPPED text (see above) so the last line can
  // never spill below the rounded border; the grown height is padding.
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(margin, y, contentWidth, declarationH, 3, 3, 'FD');
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, y, 2.5, declarationH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('DECLARATION', margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text(decLines, margin + 10, y + declarationTextTop);
  y += declarationH + 18;

  // ── Seal + signature ──────────────────────────────────────────
  // The block sits on the band just above the footer rule, which is what keeps
  // the bottom of the sheet covered whatever the rows above it needed.
  y = Math.max(y, invoiceSealTop);
  // Seal (left)
  const sealCX = margin + 30;
  const sealCY = y + 12;
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
  doc.circle(sealCX, sealCY, 24, 'FD');
  doc.setLineWidth(0.5);
  doc.circle(sealCX, sealCY, 20);
  doc.setFont('times', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO', sealCX, sealCY - 1, { align: 'center' });
  doc.text('SIVAM', sealCX, sealCY + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.2);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('DIGITAL SEAL', sealCX, sealCY + 12.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM OFFICIAL DIGITAL SEAL', margin + 64, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text('Authorized Vedic Astrology Ephemeris & Consulting Services', margin + 64, y + 15);

  // Signature (right)
  const signX = margin + contentWidth - 160;
  doc.setDrawColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.setLineWidth(0.6);
  doc.line(signX, y + 10, signX + 160, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text('For ASTRO SIVAM', signX + 160, y + 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('AUTHORIZED SIGNATORY • FULFILLMENT DESK', signX + 160, y + 25, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 38, margin + contentWidth, pageHeight - 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM', margin, pageHeight - 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('Official Vedic Report & Tax Invoice  •  astrosivam.com  •  admin@astrosivam.com', pageWidth / 2, pageHeight - 27, { align: 'center' });
  doc.text('Page 1 / 1', margin + contentWidth, pageHeight - 27, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Generates a combined ASTRO SIVAM Family Bundle Tax Invoice PDF
 */
export function generateFamilyInvoicePdf(orders: any[]): Buffer {
  if (!orders || orders.length === 0) {
    throw new Error('No orders provided for family invoice');
  }

  const primaryOrder = orders[0];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Shared professional palette
  const maroon: [number, number, number] = [122, 33, 41];
  const maroonDeep: [number, number, number] = [92, 23, 32];
  const gold: [number, number, number] = [179, 134, 46];
  const goldDeep: [number, number, number] = [140, 106, 30];
  const goldPale: [number, number, number] = [247, 239, 221];
  const cream: [number, number, number] = [253, 250, 244];
  const cream2: [number, number, number] = [246, 239, 225];
  const ink: [number, number, number] = [45, 36, 28];
  const inkSoft: [number, number, number] = [92, 80, 68];
  const inkMute: [number, number, number] = [138, 124, 108];
  const line: [number, number, number] = [229, 217, 197];
  const lineStrong: [number, number, number] = [203, 187, 137];
  const green: [number, number, number] = [46, 107, 79];
  const white: [number, number, number] = [255, 255, 255];

  // ── Centered consolidated-family invoice header ────────────────
  const groupId = primaryOrder.groupId || `GRP-${primaryOrder.orderNumber || '0000'}`;
  let y = drawCenteredBrandHeader(doc, pageWidth, margin, {
    title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
    subtitle: 'Family Bundle Tax Invoice & Payment Receipt',
    meta: `FAMILY BUNDLE • TAX INVOICE • INV-${groupId} • GROUP: ${groupId} • Business Reg. ASV-FJ-2026`
  });

  // ── Info boxes ────────────────────────────────────────────────
  const boxW = (contentWidth - 12) / 2;
  const boxH = 96;
  const drawInfoBox = (bx: number, title: string, rows: Array<[string, string]>) => {
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(bx, y, boxW, boxH, 3, 3, 'D');
    doc.setFillColor(cream2[0], cream2[1], cream2[2]);
    doc.rect(bx + 0.6, y + 0.6, boxW - 1.2, 17, 'F');
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(bx, y + 17.5, bx + boxW, y + 17.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(maroon[0], maroon[1], maroon[2]);
    doc.text(title.toUpperCase(), bx + 9, y + 11.5);
    rows.forEach((r, ri) => {
      const ry = y + 31 + ri * 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
      doc.text(r[0], bx + 9, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(ink[0], ink[1], ink[2]);
      const safeVal = latin(r[1]);
      fitFontSize(doc, safeVal, boxW - 90, 8, 6);
      doc.text(safeVal, bx + boxW - 9, ry, { align: 'right' });
    });
  };

  const createdDate = primaryOrder.createdAt
    ? new Date(primaryOrder.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  drawInfoBox(margin, 'Bundle & Invoice Details', [
    ['GROUP ID.', groupId],
    ['TOTAL CHARTS.', `${orders.length} Family Members`],
    ['DATE ISSUED.', createdDate],
    ['PAYMENT STATUS.', 'FAMILY BUNDLE PAID']
  ]);
  drawInfoBox(margin + boxW + 12, 'Billed To (Family Patron)', [
    ['PRIMARY CLIENT', primaryOrder.userName || 'Family Patron'],
    ['EMAIL', primaryOrder.userEmail || 'N/A'],
    ['MOBILE', primaryOrder.userMobile || 'N/A'],
    ['LOCATION', primaryOrder.country || 'Global']
  ]);
  y += boxH + 14;

  // ── Payment strip ─────────────────────────────────────────────
  const payMethodDisplay = primaryOrder.paymentMethod === 'MPAISA' ? 'Vodafone M-PAiSA'
    : primaryOrder.paymentMethod === 'MYCASH' ? 'Digicel MyCash'
    : primaryOrder.paymentMethod === 'PAYPAL' ? 'PayPal Checkout'
    : primaryOrder.paymentMethod === 'GPAY' ? 'Google Pay'
    : primaryOrder.paymentMethod || 'Unified Checkout';

  const cellW = (contentWidth - 16) / 3;
  const payCells: Array<[string, string]> = [
    ['PAYMENT METHOD', payMethodDisplay],
    ['PAYMENT REF.', primaryOrder.paymentReference || 'ADM-VERIFIED'],
    ['GROUP REF.', groupId]
  ];
  payCells.forEach((c, ci) => {
    const cx = margin + ci * (cellW + 8);
    doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
    doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(cx, y, cellW, 30, 3, 3, 'FD');
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.circle(cx + 13, y + 15, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(white[0], white[1], white[2]);
    doc.text(['✓', '#', '#'][ci], cx + 13, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
    doc.text(c[0], cx + 25, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(ink[0], ink[1], ink[2]);
    const safePay = latin(c[1]);
    fitFontSize(doc, safePay, cellW - 32, 7.4, 5.5);
    doc.text(safePay, cx + 25, y + 22);
  });
  y += 44;

  // ── Family line items ─────────────────────────────────────────
  const currency = primaryOrder.currency || 'FJD';
  let totalSum = 0;

  const tableBody = orders.map((ord, idx) => {
    let serviceTitle = ord.serviceType === 'BIRTH_JATHAGAM' ? 'Birth Horoscope (Jathagam)' :
      ord.serviceType === 'MARRIAGE_COMPATIBILITY' ? 'Marriage Compatibility (Porutham)' :
      ord.serviceType === 'BABY_NAMING' ? 'Baby Naming Certificate' :
      ord.serviceType === 'MUHURTHAM' ? 'Subha Muhurtham (6-Month Dates)' : ord.serviceType;

    const memberName = latin(ord.inputPayload?.name || ord.userName || `Member #${idx + 1}`);
    const langDisplay = ord.language === 'ta' ? 'Tamil' : ord.language === 'hi' ? 'Hindi' : 'English';
    const amountVal = Number(ord.amount || 0);
    totalSum += amountVal;

    return [
      String(idx + 1),
      `${memberName} — ${serviceTitle}\nOrder Ref: #${ord.orderNumber || ord.id}`,
      langDisplay,
      '1',
      `${currency} ${amountVal.toFixed(2)}`,
      `${currency} ${amountVal.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { top: 125, left: margin, right: margin },
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        drawCenteredBrandHeader(doc, pageWidth, margin, {
          title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
          subtitle: 'Family Bundle Tax Invoice - Continued',
          meta: `INV-${groupId} • GROUP: ${groupId} • Page ${data.pageNumber}`
        });
      }
    },
    tableWidth: contentWidth,
    head: [['#', 'FAMILY MEMBER & SERVICE DESCRIPTION', 'LANGUAGE', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: maroon,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineWidth: 0
    },
    bodyStyles: {
      textColor: inkSoft,
      fontSize: 7.4,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: line,
      lineWidth: 0.5
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24, textColor: inkMute },
      1: { cellWidth: 'auto', fontStyle: 'bold', textColor: ink },
      2: { halign: 'center', cellWidth: 58 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 74 },
      5: { halign: 'right', cellWidth: 80, fontStyle: 'bold', textColor: ink }
    }
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 14;

  // Large families push the table onto extra pages - start totals on a fresh
  // page rather than colliding with the footer zone.
  if (y > pageHeight - 250) {
    doc.addPage();
    y = drawCenteredBrandHeader(doc, pageWidth, margin, {
      title: 'ASTRO SIVAM - OFFICIAL TAX INVOICE',
      subtitle: 'Family Bundle Tax Invoice - Continued',
      meta: `INV-${groupId} • GROUP: ${groupId} • Page ${doc.getNumberOfPages()}`
    });
  }

  // ── Terms + totals ────────────────────────────────────────────
  const totalsW = 216;
  const totalsX = margin + contentWidth - totalsW;
  const totalsH = 104;

  doc.setFillColor(white[0], white[1], white[2]);
  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.setLineWidth(0.9);
  // Same full-page rule as the single invoice: the signature band is anchored
  // above the footer rule and the totals card and declaration share the space
  // between them, so a family bundle never ends with an empty lower third.
  const famDecText = 'This is a computer-generated family bundle tax invoice issued electronically and does not require a physical signature to be valid. It certifies that the total amount stated above has been received in full by ASTRO SIVAM for the family services described, with all digital Vedic astrology reports delivered to the registered email address.';
  const famDecLines: string[] = doc.splitTextToSize(famDecText, contentWidth - 22);
  const famDecLineH = 6.6 * 1.15;
  const famDecH = Math.max(30, 20 + (famDecLines.length - 1) * famDecLineH + 6.6 + 5);
  const famSealTop = pageHeight - 38 - 14 - 52;
  const famTailSpace = Math.max(0, famSealTop - y - 16 - famDecH - 18);
  const famTotalsCardH = Math.min(420, Math.max(totalsH, Math.round(famTailSpace)));
  const famTotalsScale = famTotalsCardH / totalsH;
  const famDecExtra = Math.min(96, Math.max(0, Math.round(famTailSpace - famTotalsCardH)));
  const famDeclarationH = famDecH + famDecExtra;
  const famDecBodyHeight = famDecLines.length * famDecLineH + 6;
  const famDecTextTop = 20 + Math.max(0, (famDeclarationH - 26 - famDecBodyHeight) / 2);
  const famDecNoteLines = doc.splitTextToSize('• Bundle Delivery: all individual report PDFs and this combined invoice are delivered together (a very large bundle arrives as a few emails, each labelled with its part number).', totalsX - margin - 26).length;
  const famNotesNatural = (3 + famDecNoteLines) * 9.5 + 4 * 2.5;
  const famNotesStep = 9.5 + Math.max(0, Math.min(5, (famTotalsCardH - famNotesNatural) / Math.max(1, 3 + famDecNoteLines)));

  doc.roundedRect(totalsX, y, totalsW, famTotalsCardH, 3, 3, 'FD');
  doc.setFillColor(cream2[0], cream2[1], cream2[2]);
  doc.rect(totalsX + 0.6, y + 0.6, totalsW - 1.2, 17, 'F');
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.line(totalsX, y + 17.5, totalsX + totalsW, y + 17.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('PAYMENT SUMMARY', totalsX + totalsW / 2, y + 11.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text(`Subtotal (${orders.length} Charts)`, totalsX + 12, y + 33 * famTotalsScale);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(`${currency} ${totalSum.toFixed(2)}`, totalsX + totalsW - 12, y + 33 * famTotalsScale, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text('Tax / VAT (0.0%)', totalsX + 12, y + 47 * famTotalsScale);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(`${currency} 0.00`, totalsX + totalsW - 12, y + 47 * famTotalsScale, { align: 'right' });

  doc.setDrawColor(lineStrong[0], lineStrong[1], lineStrong[2]);
  doc.setLineWidth(0.6);
  doc.line(totalsX + 12, y + 55 * famTotalsScale, totalsX + totalsW - 12, y + 55 * famTotalsScale);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('TOTAL PAID', totalsX + 12, y + 70 * famTotalsScale);
  doc.text(`${currency} ${totalSum.toFixed(2)}`, totalsX + totalsW - 12, y + 70 * famTotalsScale, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(green[0], green[1], green[2]);
  doc.text('Balance Due', totalsX + 12, y + 88 * famTotalsScale);
  doc.text(`${currency} 0.00  (PAID)`, totalsX + totalsW - 12, y + 88 * famTotalsScale, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('UNIFIED FAMILY PACKAGE NOTICE', margin, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  const notes = [
    `• Complete Family Package: this invoice certifies payment for all ${orders.length} family horoscope charts.`,
    '• Bundle Delivery: all individual report PDFs and this combined invoice are delivered together (a very large bundle arrives as a few emails, each labelled with its part number).',
    '• Permanent Keeping: please download all attached PDF reports and this invoice to your personal storage.',
    '• Support: contact admin@astrosivam.com for questions or auspicious consultation requests.'
  ];
  let noteY = y + 15;
  notes.forEach(n => {
    const wrapped = doc.splitTextToSize(n, totalsX - margin - 26);
    wrapped.forEach((ln: string, i: number) => {
      if (i === 0) {
        doc.setFillColor(gold[0], gold[1], gold[2]);
        doc.circle(margin + 3, noteY - 2.5, 1.2, 'F');
      }
      doc.text(ln, margin + 10, noteY);
      noteY += famNotesStep;
    });
    noteY += 2.5;
  });

  y += Math.max(famTotalsCardH, noteY - y) + 16;

  // ── Declaration ───────────────────────────────────────────────
  // Dynamic height from the wrapped text — the last line must stay INSIDE
  // the rounded border (never spill below it).
  doc.setFillColor(cream[0], cream[1], cream[2]);
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(margin, y, contentWidth, famDeclarationH, 3, 3, 'FD');
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(margin, y, 2.5, famDeclarationH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('DECLARATION', margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text(famDecLines, margin + 10, y + famDecTextTop);
  y += famDeclarationH + 18;

  // ── Seal + signature ──────────────────────────────────────────
  y = Math.max(y, famSealTop);
  const sealCX = margin + 30;
  const sealCY = y + 12;
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(1);
  doc.setFillColor(goldPale[0], goldPale[1], goldPale[2]);
  doc.circle(sealCX, sealCY, 24, 'FD');
  doc.setLineWidth(0.5);
  doc.circle(sealCX, sealCY, 20);
  doc.setFont('times', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO', sealCX, sealCY - 1, { align: 'center' });
  doc.text('SIVAM', sealCX, sealCY + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.2);
  doc.setTextColor(goldDeep[0], goldDeep[1], goldDeep[2]);
  doc.text('DIGITAL SEAL', sealCX, sealCY + 12.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM OFFICIAL DIGITAL SEAL', margin + 64, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(inkSoft[0], inkSoft[1], inkSoft[2]);
  doc.text('Authorized Vedic Astrology Ephemeris & Consulting Services', margin + 64, y + 15);

  const signX = margin + contentWidth - 160;
  doc.setDrawColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.setLineWidth(0.6);
  doc.line(signX, y + 10, signX + 160, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text('For ASTRO SIVAM', signX + 160, y + 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('AUTHORIZED SIGNATORY • FULFILLMENT DESK', signX + 160, y + 25, { align: 'right' });

  // ── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 38, margin + contentWidth, pageHeight - 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text('ASTRO SIVAM', margin, pageHeight - 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(inkMute[0], inkMute[1], inkMute[2]);
  doc.text('Official Vedic Report & Family Tax Invoice  •  astrosivam.com  •  admin@astrosivam.com', pageWidth / 2, pageHeight - 27, { align: 'center' });
  doc.text('Page 1 / 1', margin + contentWidth, pageHeight - 27, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}


export const generateWeddingPdf = generateWeddingMatchPdf;
