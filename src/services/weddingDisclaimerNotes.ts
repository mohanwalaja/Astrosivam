import disclaimerData from '../../api/astrology/wedding_disclaimer_notes.json';
import type { AppLanguage } from '../types';

/**
 * ASTRO SIVAM — Marriage Matching disclaimer (report page 2).
 *
 * The copy lives in ONE place (`api/astrology/wedding_disclaimer_notes.json`)
 * so the browser preview, the html2canvas download, the Node download renderer
 * and the PHP/mPDF renderer print the same wording in the language the
 * customer ordered (English / Tamil / Hindi).
 *
 * Paragraphs may contain **bold** emphasis markers. Every renderer converts
 * them: HTML/mPDF use `<strong>`, while the Node download renderer draws bold
 * runs or strips the markers. Never pass a raw `**` string to a PDF surface.
 */

export interface WeddingDisclaimerNotes {
  /** Subtitle printed in the page-2 header band. */
  pageSubtitle: string;
  /** Panel heading, e.g. "DISCLAIMER". */
  title: string;
  /** Secondary heading, e.g. "Marriage Matching - Important Note". */
  heading: string;
  /** Body paragraphs, each possibly containing **bold** markers. */
  paragraphs: string[];
}

const FALLBACK: WeddingDisclaimerNotes = {
  pageSubtitle: 'Marriage Matching - Important Note & Disclaimer',
  title: 'DISCLAIMER',
  heading: 'Marriage Matching - Important Note',
  paragraphs: [
    'This Marriage Matching Report is primarily intended for couples considering an **Arranged Marriage**, where the prospective bride and groom may not have had the opportunity to know each other personally or understand each other deeply before marriage.',
    'In an arranged marriage, both families may be introducing the prospective bride and groom to each other with limited prior personal knowledge. Therefore, traditional Vedic astrology-based marriage matching can serve as a supplementary guide by examining factors such as the **Ten Poruthams (Dasa Porutham)**, **Kuja Dosha (Sevvai Dosham)**, and other relevant astrological considerations.',
    'In a **Love Marriage**, or where the bride and groom already know each other well, they may already have personal understanding of each other\'s personality, habits, values, expectations, lifestyle, and family circumstances. Therefore, the role and relevance of traditional horoscope matching may differ in such circumstances.',
    'The results and interpretations provided in this report are based on **traditional Vedic astrology principles** and should be considered as astrological guidance only.',
    'Marriage is an important life decision and should not be based solely on horoscope matching. **Mutual understanding, compatibility, character, communication, shared values, life goals, family circumstances, and the free and informed consent of both individuals** should also be carefully considered.',
    '**This report is intended as a supplementary source of astrological guidance and should not be considered the sole or final basis for making a marriage decision.**'
  ]
};

/** Localized disclaimer copy for the language the order was placed in. */
export function buildWeddingDisclaimerNotes(lang: AppLanguage = 'en'): WeddingDisclaimerNotes {
  const table = disclaimerData as unknown as Record<string, Partial<WeddingDisclaimerNotes>>;
  const copy = table[lang] || table.en || {};
  const paragraphs = Array.isArray(copy.paragraphs) ? copy.paragraphs.filter(Boolean) : [];
  if (!paragraphs.length) return FALLBACK;
  return {
    pageSubtitle: copy.pageSubtitle || FALLBACK.pageSubtitle,
    title: copy.title || FALLBACK.title,
    heading: copy.heading || FALLBACK.heading,
    paragraphs: paragraphs.map(String)
  };
}

/** Escape for HTML and upgrade **markers** to <strong>. */
export function weddingDisclaimerRichHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
}

/** Remove the **markers** for renderers that cannot style inline runs. */
export function weddingDisclaimerPlainText(text: string): string {
  return String(text).replace(/\*\*/g, '');
}

/**
 * Split a paragraph into styled runs so a canvas/PDF engine can draw the bold
 * segments with a bold font. False = normal weight, true = bold.
 */
export function weddingDisclaimerRuns(text: string): Array<{ text: string; bold: boolean }> {
  return String(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(segment => segment !== '')
    .map(segment =>
      segment.startsWith('**') && segment.endsWith('**') && segment.length > 4
        ? { text: segment.slice(2, -2), bold: true }
        : { text: segment, bold: false }
    );
}
