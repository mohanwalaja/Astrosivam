import { nameMatchesPada, nameFingerprint } from './namakaranSound';
/**
 * Namakaran (baby naming) page-2 name lists.
 *
 * Turns the four pada syllables of the baby's birth star into South and North
 * Indian style suggestions for the baby's gender. Each list contains only
 * names whose first sound exactly matches that pada's printed syllable. No
 * related-sound alternatives are added; a list may contain fewer names.
 *
 * The data itself lives in namakaranNameBank.ts (generated from
 * data/namakaran_name_bank.tsv). Names are not repeated within one report page.
 */
import {
  NAMAKARAN_BANK,
  NAMAKARAN_MAX_PER_SIDE,
  type NamakaranBankEntry,
  type NamakaranGender
} from './namakaranNameBank.js';
import { localizeNamakaranEntry } from './namakaranMeaning.js';

export { NAMAKARAN_MAX_PER_SIDE };

export interface NamakaranNameOption {
  name: string;
  /** English meaning retained for legacy consumers and the English report. */
  meaning: string;
  meaningEn: string;
  meaningTa: string;
  meaningHi: string;
  /** Akshara whose exact pada sound matched this name. */
  sourceAksharaTa?: string;
}

export interface NamakaranNameProvenance {
  suppliedName: string | null;
  status: 'SUPPLIED_NOT_CERTIFIED' | 'NOT_SUPPLIED';
  noteEn: string;
  noteTa: string;
  noteHi: string;
}

/** The supplied name is an input label, never a compatibility certificate. */
export function buildNamakaranNameProvenance(name?: string): NamakaranNameProvenance {
  const suppliedName = (name || '').trim() || null;
  return {
    suppliedName,
    status: suppliedName ? 'SUPPLIED_NOT_CERTIFIED' : 'NOT_SUPPLIED',
    noteEn: suppliedName
      ? 'The supplied name has not been certified as matching the birth-pada sound. Use the primary sound when choosing a compatible name; related-sound alternatives require separate consideration.'
      : 'No name was supplied. Use the primary birth-pada sound when choosing a name; related-sound alternatives require separate consideration.',
    noteTa: suppliedName
      ? 'வழங்கப்பட்ட பெயர் பிறந்த பாத ஒலிக்குப் பொருந்துவதாகச் சான்றளிக்கப்படவில்லை. பொருத்தமான பெயரைத் தேர்ந்தெடுக்க முதன்மை ஒலியைப் பயன்படுத்தவும்; தொடர்புடைய மாற்று ஒலிப் பெயர்களைத் தனியாகப் பரிசீலிக்க வேண்டும்.'
      : 'பெயர் வழங்கப்படவில்லை. பெயரைத் தேர்ந்தெடுக்க பிறந்த பாதத்தின் முதன்மை ஒலியைப் பயன்படுத்தவும்; தொடர்புடைய மாற்று ஒலிப் பெயர்களைத் தனியாகப் பரிசீலிக்க வேண்டும்.',
    noteHi: suppliedName
      ? 'दिए गए नाम को जन्म-पाद की ध्वनि से मेल खाने वाला प्रमाणित नहीं किया गया है। अनुकूल नाम चुनते समय प्राथमिक ध्वनि का प्रयोग करें; संबंधित ध्वनि वाले विकल्पों पर अलग से विचार आवश्यक है।'
      : 'कोई नाम नहीं दिया गया है। नाम चुनते समय जन्म-पाद की प्राथमिक ध्वनि का प्रयोग करें; संबंधित ध्वनि वाले विकल्पों पर अलग से विचार आवश्यक है।'
  };
}

export interface NamakaranPadaNames {
  /** Pada number (1-4) inside the birth star. */
  padaNumber: number;
  /** Akshara as printed on page 1 (Tamil). */
  soundTa: string;
  /** Transliteration, e.g. "Chu / Su". */
  soundEn: string;
  /** Devanagari reading of the same akshara. */
  soundHi: string;
  /** Moon sign of this pada, as printed on page 1. */
  rasiTa: string;
  rasiEn: string;
  rasiHi: string;
  south: NamakaranNameOption[];
  north: NamakaranNameOption[];
}

export interface NamakaranPadaInput {
  padaNumber: number;
  letterTa: string;
  letterEn: string;
  letterHi: string;
  rasiTa?: string;
  rasiEn?: string;
  rasiHi?: string;
}

function toOption(entry: NamakaranBankEntry, sourceAksharaTa: string): NamakaranNameOption {
  return localizeNamakaranEntry({
    name: entry.n,
    meaning: entry.m,
    sourceAksharaTa
  }) as NamakaranNameOption;
}

/** Collects only names whose first sound matches this pada's exact akshara. */
function collectExact(
  akshara: string,
  style: 'south' | 'north',
  gender: NamakaranGender,
  used: Set<string>,
  limit: number
): NamakaranNameOption[] {
  const candidates = NAMAKARAN_BANK[akshara]?.[gender]?.[style] || [];
  const names: NamakaranNameOption[] = [];
  for (const entry of candidates) {
    if (names.length >= limit) break;
    if (!nameMatchesPada(entry.n, akshara)) continue;
    const fingerprint = nameFingerprint(entry.n);
    if (used.has(fingerprint)) continue;
    used.add(fingerprint);
    names.push(toOption(entry, akshara));
  }
  return names;
}

/**
 * Builds the two name columns of page 2 for every pada of the birth star.
 * Only exact matches for the four supplied pada syllables are included. If a
 * syllable has few (or no) exact matches, the list stays short (or empty).
 *
 * @param padas   The four padas of the birth star (as stored on the result).
 * @param gender  The baby's gender — the report shows that gender's names.
 * @param maxPerSide Maximum names per column (capped at 8).
 */
export function buildNamakaranPadaNames(
  padas: NamakaranPadaInput[],
  gender: NamakaranGender,
  maxPerSide: number = NAMAKARAN_MAX_PER_SIDE
): NamakaranPadaNames[] {
  maxPerSide = Math.max(1, Math.min(NAMAKARAN_MAX_PER_SIDE, maxPerSide));
  const used = new Set<string>();

  return (padas || []).map(pada => {
    const akshara = pada.letterTa || '';
    return {
      padaNumber: pada.padaNumber,
      soundTa: pada.letterTa,
      soundEn: pada.letterEn,
      soundHi: pada.letterHi,
      rasiTa: pada.rasiTa || '',
      rasiEn: pada.rasiEn || '',
      rasiHi: pada.rasiHi || '',
      south: collectExact(akshara, 'south', gender, used, maxPerSide),
      north: collectExact(akshara, 'north', gender, used, maxPerSide)
    };
  });
}

/**
 * Rebuild stored results from the current bank, so spelling, meaning and
 * exact-sound filtering updates also reach previously saved orders.
 */
export function buildNamakaranPadaNamesFromResult(
  result: {
    gender?: 'M' | 'F';
    nakshatraLetters?: { padas?: any[] };
    nameSuggestions?: NamakaranPadaNames[];
  },
  maxPerSide?: number
): NamakaranPadaNames[] {
  const padas = (result?.nakshatraLetters?.padas || []) as NamakaranPadaInput[];
  if (padas.length === 0) return [];
  return buildNamakaranPadaNames(padas, result?.gender === 'F' ? 'F' : 'M', maxPerSide);
}
