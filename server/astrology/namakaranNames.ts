import { nameMatchesPada, nameFingerprint } from './namakaranSound';
/**
 * Namakaran (baby naming) page-2 name lists.
 *
 * Turns the 4 pada syllables of the baby's birth star into two ready-to-print
 * columns — South Indian style on the left, North Indian style on the right —
 * for the baby's own gender, exactly as the Vedic Namakaran report shows them.
 *
 * The data itself lives in namakaranNameBank.ts (generated from
 * data/namakaran_name_bank.tsv). This module only decides which names to show:
 *
 *   1. up to 8 names of the pada akshara itself,
 *   2. completed with closely related sounds of the SAME letter when Indian
 *      names for that akshara simply do not exist (ங, ஞ, வு, லூ ...). This is
 *      the traditional varga fallback an astrologer would suggest, and the
 *      report marks those lists with a short footnote.
 *
 * Names never repeat within one report page — a name already used by an
 * earlier pada of the same star is skipped.
 */
import {
  NAMAKARAN_BANK,
  NAMAKARAN_BANK_FALLBACKS,
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
  /** Bank akshara this name actually came from, including traditional fallbacks. */
  sourceAksharaTa?: string;
  /** Related/varga names are alternatives, not exact matches to the pada sound. */
  isRelatedSound?: boolean;
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
  /** True when the list also carries names of a related sound. */
  usesRelatedSounds: boolean;
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

function toOption(entry: NamakaranBankEntry, sourceAksharaTa: string, isRelatedSound: boolean): NamakaranNameOption {
  return localizeNamakaranEntry({
    name: entry.n, meaning: entry.m, sourceAksharaTa, isRelatedSound
  }) as NamakaranNameOption;
}

/** Aksharas of the same Tamil letter (டா → டீ, டூ, டே, டோ ...). */
function siblingAksharas(akshara: string): string[] {
  const base = akshara[0];
  return Object.keys(NAMAKARAN_BANK).filter(key => key !== akshara && key[0] === base);
}

/**
 * Ordered list of aksharas whose names may complete this pada's list:
 * the akshara itself first, then the documented varga fallbacks, then the
 * other vowels of the same letter.
 */
export function fallbackAksharas(akshara: string): string[] {
  const explicit = (NAMAKARAN_BANK_FALLBACKS[akshara] || []).filter(key => NAMAKARAN_BANK[key]);
  const siblings = siblingAksharas(akshara).filter(key => !explicit.includes(key));
  return [...explicit, ...siblings];
}

/** Collects the akshara's OWN names for one column, skipping ones already used. */
function collectOwn(
  akshara: string,
  style: 'south' | 'north',
  gender: NamakaranGender,
  used: Set<string>,
  limit: number
): NamakaranNameOption[] {
  const column = NAMAKARAN_BANK[akshara]?.[gender]?.[style] || [];
  const names: NamakaranNameOption[] = [];
  for (const entry of column) {
    if (names.length >= limit) break;
    const fingerprint = nameFingerprint(entry.n);
    if (used.has(fingerprint)) continue;
    used.add(fingerprint);
    names.push(toOption(entry, akshara, false));
  }
  return names;
}

/**
 * Every candidate name of a RELATED sound (same letter, other vowel), in
 * priority order: documented varga fallbacks first, then the other vowels.
 */
function relatedCandidates(
  akshara: string,
  style: 'south' | 'north',
  gender: NamakaranGender
): NamakaranNameOption[] {
  const seen = new Set<string>();
  const names: NamakaranNameOption[] = [];
  for (const key of fallbackAksharas(akshara)) {
    const column = NAMAKARAN_BANK[key]?.[gender]?.[style] || [];
    for (const entry of column) {
      const fingerprint = nameFingerprint(entry.n);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      names.push(toOption(entry, key, true));
    }
  }
  return names;
}

/**
 * Builds the two name columns of page 2 for every pada of the birth star.
 *
 * Every pada gets its OWN names first (one fair pass, so pada 4 of a star is
 * never starved by pada 1), and the short lists are then completed round-robin
 * with related sounds of the same letter.
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
  const target = maxPerSide;
  const used = new Set<string>();
  const list = padas || [];

  // Pass 1 — each pada's own akshara names.
  const columns = list.map(pada => {
    const akshara = pada.letterTa || '';
    return {
      padaNumber: pada.padaNumber,
      soundTa: pada.letterTa,
      soundEn: pada.letterEn,
      soundHi: pada.letterHi,
      rasiTa: pada.rasiTa || '',
      rasiEn: pada.rasiEn || '',
      rasiHi: pada.rasiHi || '',
      usesRelatedSounds: false,
      south: collectOwn(akshara, 'south', gender, used, maxPerSide),
      north: collectOwn(akshara, 'north', gender, used, maxPerSide)
    };
  });

  // Pass 2 — complete short lists round-robin so every pada shares the
  // related-sound names fairly.
  const cursors = columns.map(column => ({
    south: relatedCandidates(column.soundTa, 'south', gender),
    north: relatedCandidates(column.soundTa, 'north', gender),
    southAt: 0,
    northAt: 0
  }));

  const takeNext = (
    columnIndex: number,
    side: 'south' | 'north'
  ): NamakaranNameOption | null => {
    const cursor = cursors[columnIndex];
    const candidates = cursor[side];
    let index = side === 'south' ? cursor.southAt : cursor.northAt;
    while (index < candidates.length) {
      const candidate = candidates[index];
      index += 1;
      if (used.has(nameFingerprint(candidate.name))) continue;
      used.add(nameFingerprint(candidate.name));
      if (side === 'south') cursor.southAt = index; else cursor.northAt = index;
      return candidate;
    }
    if (side === 'south') cursor.southAt = index; else cursor.northAt = index;
    return null;
  };

  const needs = () => columns.some((column, index) =>
    column.south.length < target ||
    column.north.length < target
  );

  while (needs()) {
    let progress = false;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      if (column.south.length < target) {
        const next = takeNext(index, 'south');
        if (next) {
          column.south = [...column.south, next];
          column.usesRelatedSounds = true;
          progress = true;
        }
      }
      if (column.north.length < target) {
        const next = takeNext(index, 'north');
        if (next) {
          column.north = [...column.north, next];
          column.usesRelatedSounds = true;
          progress = true;
        }
      }
    }
    if (!progress) break; // no related names left anywhere
  }

  return columns.map(column => {
    for (const entry of [...column.south, ...column.north]) {
      entry.isRelatedSound = !nameMatchesPada(entry.name, column.soundTa);
    }
    column.usesRelatedSounds = [...column.south, ...column.north].some(entry => entry.isRelatedSound);
    return column;
  });
}

/**
 * Rebuild stored results from the current bank, so corrections to spelling,
 * meaning and exact-sound markers also reach previously saved orders.
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
