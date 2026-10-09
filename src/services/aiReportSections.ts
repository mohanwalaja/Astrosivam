/**
 * ASTRO SIVAM AI Astrologer — Part 3: uploaded report handling.
 *
 * The customer uploads a PDF into the chat. Before a single word of it is
 * discussed, this module decides three things:
 *   1. is it an ASTRO SIVAM report at all?
 *   2. is it THIS customer's, and is the order PAID?
 *   3. which report type and which section is the customer asking about?
 *
 * OWNERSHIP DESIGN — read this before changing it.
 * The uploaded PDF is treated as an OWNERSHIP TOKEN, not as the source of the
 * explanation. mPDF embeds subset fonts, and glyph-to-Unicode mapping for Tamil
 * and Devanagari runs frequently does not survive PDF text extraction; the
 * extracted Indic text can come back garbled or empty. That could not be tested
 * in the build sandbox because PHP is not installable there. So the design only
 * ever depends on the ASCII order number, which is printed in the page header
 * of every report by AstroMpdfReports::topHeader. The content that actually
 * gets explained is regenerated server-side from the order's saved inputs,
 * which is already how official downloads are produced
 * (AstroEngine::rebuildReportResultFromSavedInputs).
 *
 * Nothing here calls an AI model. Model calls live only in PHP.
 */

import type { Lang } from './aiAstrologerRetrieval';

export interface ReportSection {
  id: string;
  title: Record<Lang, string>;
  page: number;
  means: Record<Lang, string>;
  chartLink?: string;
  askIfWrong?: Record<Lang, string>;
  guardrail?: string;
  source?: { id: string; level: string; note?: string; page?: string }[];
}

export interface ReportType {
  id: string;
  name: Record<Lang, string>;
  pages: number;
  fingerprints: string[];
  sections: ReportSection[];
}

export interface ReportSectionsFile {
  ownership: {
    signals: { id: string; pattern?: string; patterns?: string[] }[];
    mustAllHold: string[];
  };
  rejection: Record<string, Record<Lang, string>>;
  reportTypes: ReportType[];
  quotedLine: { steps: string[]; styleRules: string[] };
}

let kb: ReportSectionsFile | null = null;
export function setReportSections(file: ReportSectionsFile): void {
  kb = file;
}
export function getReportSections(): ReportSectionsFile {
  if (!kb) throw new Error('report sections not loaded - call setReportSections() first');
  return kb;
}

/* ------------------------------------------------------------------ */
/* Text normalisation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Collapses the whitespace damage PDF extraction does: runs of spaces, broken
 * ligatures, soft hyphens and non-breaking spaces all become a single space.
 * Matching quoted lines against section text is hopeless without this.
 */
export function normaliseExtracted(text: string): string {
  return text
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u00AD\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Ownership signals                                                   */
/* ------------------------------------------------------------------ */

/** Order numbers as generated for this platform: ORD- followed by alphanumerics. */
const ORDER_NUMBER_RE = /#?\b(ORD-[A-Z0-9][A-Z0-9-]{2,27})\b/g;
const FILENAME_RE = /ASTRO_SIVAM_(?:Report|Invoice)_([A-Za-z0-9-]+)\.pdf/i;

const BRANDING = [
  'ASTRO SIVAM',
  'ASTRO-MUH',
  'ASTRO SIVAM Vedic Research Desk',
  'ASTRO SIVAM - OFFICIAL VEDIC REPORT',
];

/**
 * Pulls every order number out of extracted PDF text. Returns them in order of
 * appearance with duplicates removed, because a multi-page report repeats the
 * header on every page.
 */
export function extractOrderNumbers(extractedText: string): string[] {
  const norm = normaliseExtracted(extractedText).toUpperCase();
  const found: string[] = [];
  for (const m of norm.matchAll(ORDER_NUMBER_RE)) {
    const id = m[1].replace(/-+$/, '');
    if (!found.includes(id)) found.push(id);
  }
  return found;
}

/** The order number implied by the uploaded filename, if it follows our pattern. */
export function orderNumberFromFilename(filename: string): string | null {
  const m = FILENAME_RE.exec(filename ?? '');
  return m ? m[1].toUpperCase() : null;
}

/** True when the document carries ASTRO SIVAM branding. Necessary, not sufficient. */
export function hasAstroSivamBranding(extractedText: string): boolean {
  const norm = normaliseExtracted(extractedText).toUpperCase();
  return BRANDING.some((b) => norm.includes(b.toUpperCase()));
}

/* ------------------------------------------------------------------ */
/* Report type identification                                          */
/* ------------------------------------------------------------------ */

export interface TypeMatch {
  type: ReportType;
  score: number;
  matched: string[];
}

/**
 * Identifies which of the four report types this is, by counting fingerprint
 * phrases. Fingerprints are the section headings each builder actually emits,
 * so they are Latin-script and survive extraction.
 * Returns null when nothing recognisable is present.
 */
export function identifyReportType(extractedText: string): TypeMatch | null {
  const norm = normaliseExtracted(extractedText);
  const upper = norm.toUpperCase();
  let best: TypeMatch | null = null;
  for (const type of getReportSections().reportTypes) {
    const matched = type.fingerprints.filter((f) => upper.includes(f.toUpperCase()));
    if (matched.length === 0) continue;
    const score = matched.length * 10 + matched.join('').length;
    if (!best || score > best.score) best = { type, score, matched };
  }
  // Require at least two fingerprints, or one long distinctive one, so a stray
  // phrase in an unrelated document cannot be mistaken for one of our reports.
  if (!best) return null;
  const confident = best.matched.length >= 2 || best.matched.some((m) => m.length >= 24);
  return confident ? best : null;
}

/* ------------------------------------------------------------------ */
/* Acceptance decision                                                 */
/* ------------------------------------------------------------------ */

export type RejectionKind = 'notAstroSivam' | 'notYours' | 'unreadable' | 'tooLarge';

export interface AcceptanceInput {
  extractedText: string;
  filename: string;
  /** Order numbers belonging to the logged-in customer, any status. */
  customerOrderNumbers: string[];
  /** Subset of the above that are PAID and approved. */
  paidOrderNumbers: string[];
  /** Bytes, so the size cap can be applied before parsing. */
  sizeBytes: number;
  maxBytes: number;
}

export interface Acceptance {
  accepted: boolean;
  rejection: RejectionKind | null;
  orderNumber: string | null;
  type: ReportType | null;
  /** Why, in plain words - for the server log, never shown to the customer. */
  reason: string;
}

/**
 * The whole Part 3 gate. Every clause in ownership.mustAllHold is enforced
 * here, and the function fails closed: if it cannot prove ownership it refuses,
 * and it never says which order numbers would have been valid.
 */
export function decideAcceptance(input: AcceptanceInput): Acceptance {
  const { extractedText, filename, customerOrderNumbers, paidOrderNumbers } = input;

  if (input.sizeBytes > input.maxBytes) {
    return {
      accepted: false, rejection: 'tooLarge', orderNumber: null, type: null,
      reason: `upload is ${input.sizeBytes} bytes, cap is ${input.maxBytes}`,
    };
  }

  const text = normaliseExtracted(extractedText ?? '');
  if (text.length < 40) {
    return {
      accepted: false, rejection: 'unreadable', orderNumber: null, type: null,
      reason: `only ${text.length} characters extracted; likely a scan or a photo`,
    };
  }

  const fromText = extractOrderNumbers(text);
  const fromFilename = orderNumberFromFilename(filename);
  const customer = customerOrderNumbers.map((o) => o.toUpperCase());
  const paid = paidOrderNumbers.map((o) => o.toUpperCase());

  // The header is authoritative; the filename only corroborates. A filename
  // alone can never grant access, because a customer can rename any file.
  const candidate = fromText.find((o) => customer.includes(o)) ?? fromText[0] ?? null;

  if (!candidate) {
    if (!hasAstroSivamBranding(text)) {
      return {
        accepted: false, rejection: 'notAstroSivam', orderNumber: null, type: null,
        reason: 'no ASTRO SIVAM branding and no order number found',
      };
    }
    return {
      accepted: false, rejection: 'unreadable', orderNumber: null, type: null,
      reason: 'branded document but no order number could be extracted',
    };
  }

  if (!hasAstroSivamBranding(text)) {
    return {
      accepted: false, rejection: 'notAstroSivam', orderNumber: candidate, type: null,
      reason: `order number ${candidate} present but no ASTRO SIVAM branding`,
    };
  }

  if (!customer.includes(candidate)) {
    return {
      accepted: false, rejection: 'notYours', orderNumber: candidate, type: null,
      reason: `order ${candidate} does not belong to the session customer`,
    };
  }

  if (!paid.includes(candidate)) {
    return {
      accepted: false, rejection: 'notYours', orderNumber: candidate, type: null,
      reason: `order ${candidate} belongs to the customer but is not PAID`,
    };
  }

  const match = identifyReportType(text);
  if (!match) {
    return {
      accepted: false, rejection: 'notAstroSivam', orderNumber: candidate, type: null,
      reason: `order ${candidate} verified but the content matches none of our four report types`,
    };
  }

  // Filename disagreement is logged but not fatal: renaming is harmless once
  // the header has proved ownership.
  const reason = fromFilename && fromFilename !== candidate
    ? `accepted on header order ${candidate}; filename said ${fromFilename}`
    : `accepted on header order ${candidate}`;

  return { accepted: true, rejection: null, orderNumber: candidate, type: match.type, reason };
}

/** The polite refusal, in the customer's language. */
export function rejectionText(kind: RejectionKind, lang: Lang): string {
  const entry = getReportSections().rejection[kind];
  if (!entry) throw new Error(`no rejection text registered for "${kind}"`);
  return entry[lang] ?? entry.en;
}

/* ------------------------------------------------------------------ */
/* Section lookup and "what does this line mean?"                      */
/* ------------------------------------------------------------------ */

export interface SectionMatch {
  section: ReportSection;
  score: number;
  kind: 'title' | 'body';
}

/**
 * Longest run of consecutive words from `needle` that also appears consecutively
 * in `haystack`. Scoring on a phrase rather than on individual word hits is what
 * stops a stray common word - "this", "the" - from matching a section it has
 * nothing to do with.
 */
function longestSharedRun(needle: string, haystack: string): number {
  const words = needle.split(' ').filter((w) => w.length > 1);
  let best = 0;
  for (let start = 0; start < words.length; start++) {
    for (let len = words.length - start; len > best; len--) {
      const phrase = words.slice(start, start + len).join(' ');
      if (haystack.includes(phrase)) {
        best = len;
        break;
      }
    }
  }
  return best;
}

/** Minimum consecutive-word overlap for a body match to count. */
const MIN_PHRASE_RUN = 3;

/**
 * Finds the section a quoted line came from. Matches against the section title
 * in all three languages and against its explanation, on normalised text, so
 * spacing and punctuation damage from extraction does not matter.
 *
 * A title match always beats a body match. A body match needs a run of at least
 * three consecutive words, which is what makes "what does this line mean" work
 * on a pasted sentence without matching every section that happens to contain
 * the word "this".
 */
export function matchSection(quoted: string, type: ReportType): SectionMatch | null {
  const q = normaliseExtracted(quoted).toLowerCase();
  if (q.length < 3) return null;
  let best: SectionMatch | null = null;
  for (const section of type.sections) {
    for (const lang of ['en', 'ta', 'hi'] as Lang[]) {
      const title = (section.title[lang] ?? '').toLowerCase();
      if (title && (q.includes(title) || title.includes(q))) {
        const score = 1000 + title.length;
        if (!best || score > best.score) best = { section, score, kind: 'title' };
      }
    }
    for (const lang of ['en', 'ta', 'hi'] as Lang[]) {
      const body = normaliseExtracted(section.means[lang] ?? '').toLowerCase();
      if (!body) continue;
      const run = longestSharedRun(q, body);
      if (run < MIN_PHRASE_RUN) continue;
      const score = run * 10;
      if (!best || score > best.score) best = { section, score, kind: 'body' };
    }
  }
  return best;
}

/**
 * Builds the explanation for one section: what it means, in the customer's
 * language, then the link back to their own chart positions, then the source.
 * `chartValues` are the customer's real values, so the answer names them.
 */
export function explainSection(
  section: ReportSection,
  lang: Lang,
  chartValues: Record<string, string> = {}
): { title: string; body: string; sourceLine: string; guardrail: string | null } {
  const title = section.title[lang] ?? section.title.en;
  const parts = [section.means[lang] ?? section.means.en];

  if (section.chartLink) {
    let link = section.chartLink;
    for (const [key, value] of Object.entries(chartValues)) {
      link = link.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    parts.push(lang === 'ta' ? `உங்கள் ஜாதகத்தில்: ${link}` : lang === 'hi' ? `आपकी कुंडली में: ${link}` : `In your chart: ${link}`);
  }

  const cited = (section.source ?? []).map((s) => s.id);
  const sourceLine = cited.length ? `Source: ${[...new Set(cited)].join(' · ')}` : '';

  return { title, body: parts.join('\n\n'), sourceLine, guardrail: section.guardrail ?? null };
}

/**
 * Full handling of "what does this line mean?" Returns null when the line
 * matches nothing, in which case the caller must ask for the page number
 * rather than guess.
 */
export function explainQuotedLine(
  quoted: string,
  type: ReportType,
  lang: Lang,
  chartValues: Record<string, string> = {}
): ReturnType<typeof explainSection> | null {
  const hit = matchSection(quoted, type);
  if (!hit) return null;
  return explainSection(hit.section, lang, chartValues);
}

/** Every section of a report type, for the "walk me through the report" case. */
export function listSections(type: ReportType, lang: Lang): { id: string; title: string; page: number }[] {
  return type.sections.map((s) => ({ id: s.id, title: s.title[lang] ?? s.title.en, page: s.page }));
}
