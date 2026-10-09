/**
 * Birth stone, lucky colour and lucky numbers for the Birth Jathagam page 3.
 *
 * The data follows the classical Tamil Ratna Sastra / Navagraha convention
 * used by Tamil almanac and astrology publications: every indicator is a
 * property of a GRAHA, and the native receives it through
 *
 *   • the NAKSHATRA LORD (ஜென்ம நட்சத்திர அதிபதி) — the Vimshottari lord of the
 *     janma nakshatra; this is the primary source for the birth stone
 *     (நட்சத்திரக் கல்), lucky colour and the three lucky numbers;
 *   • the RASI LORD (ராசி அதிபதி) — the lord of the Chandra rasi; this gives
 *     the rasi stone (ராசிக் கல்), rasi colour and the single rasi number.
 *
 * Tamil sources cross-checked (all agree on the lord → stone / colour / number
 * tables below):
 *   - Samayam Tamil, "நட்சத்திரத்திற்கேற்ற அதிர்ஷ்ட தெய்வம், அதிர்ஷ்ட எண்,
 *     அதிர்ஷ்ட நிறம் மற்றும் வழிபாட்டு முறைகள்" (27 nakshatras, grouped by lord):
 *     stone, colour and numbers per lord.
 *   - Samayam Tamil, "27 நட்சத்திரங்களுக்கு உரிய அதிர்ஷ்ட கல், ரத்தினங்கள்"
 *     (one stone per nakshatra — identical to the lord's Navaratna).
 *   - livingastro.blogspot.com, "27 நட்சத்திரத்தின் குறிப்புகள்" (same colour
 *     and number sets per nakshatra group).
 *   - SwasthikTv, "12 ராசிகளின் நிறங்கள்" (rasi colour follows the rasi lord:
 *     செவ்வாய்–சிவப்பு, சுக்கிரன்/சந்திரன்–வெண்மை, புதன்–பச்சை, குரு–மஞ்சள், சனி–கருப்பு).
 *   - Zee News Tamil, "உங்கள் ராசிக்கு ஏற்ற ரத்தினம்" (rasi stone = lord's gem:
 *     மேஷம்/விருச்சிகம் பவளம், மிதுனம்/கன்னி மரகதம், சிம்மம் மாணிக்கம், ...).
 *   - Samayam Tamil, "எண்களும் அவற்றிற்குரிய கிரகங்கள்" (graha numbers:
 *     சூரியன் 1, சந்திரன் 2, குரு 3, ராகு 4, புதன் 5, சுக்கிரன் 6, கேது 7, சனி 8,
 *     செவ்வாய் 9).
 *
 * The PHP mPDF renderer mirrors this table in
 * api/astrology/pdf_mpdf_reports.php (jathagamLuckyData); keep both in sync.
 * tests/jathagam-lucky-indicators.test.ts freezes the contract.
 */
import { AppLanguage, Graha } from '../lib/astrology/types';

export type LuckyLanguage = AppLanguage;

export interface GrahaLuckyProfile {
  /** Navaratna gem of the graha. */
  stone: Record<LuckyLanguage, string>;
  /** Lucky colour of the graha (Tamil almanac convention). */
  colour: Record<LuckyLanguage, string>;
  /** The graha's own number in Tamil numerology (1-9). */
  number: number;
  /** The three lucky numbers quoted for natives of this graha's nakshatras. */
  luckyNumbers: number[];
}

/** Vimshottari nakshatra-lord cycle, starting from Aswini (index 0). */
export const NAKSHATRA_LORD_CYCLE: Graha[] = [
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI,
  Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
];

/** Rasi (1 = Mesham … 12 = Meenam) → lord. */
export const RASI_LORD_FOR_LUCKY: Record<number, Graha> = {
  1: Graha.CHEVVAI, 2: Graha.SUKRA, 3: Graha.BUDHA, 4: Graha.CHANDRA,
  5: Graha.SURYA, 6: Graha.BUDHA, 7: Graha.SUKRA, 8: Graha.CHEVVAI,
  9: Graha.GURU, 10: Graha.SANI, 11: Graha.SANI, 12: Graha.GURU
};

export const GRAHA_LUCKY_PROFILES: Record<string, GrahaLuckyProfile> = {
  [Graha.SURYA]: {
    stone: { en: 'Ruby (Manikkam)', ta: 'மாணிக்கம்', hi: 'माणिक्य (रूबी)' },
    colour: { en: 'Red', ta: 'சிவப்பு', hi: 'लाल' },
    number: 1,
    luckyNumbers: [1, 5, 7]
  },
  [Graha.CHANDRA]: {
    stone: { en: 'Pearl (Muthu)', ta: 'முத்து', hi: 'मोती' },
    colour: { en: 'White', ta: 'வெள்ளை', hi: 'सफ़ेद' },
    number: 2,
    luckyNumbers: [2, 3, 9]
  },
  [Graha.CHEVVAI]: {
    stone: { en: 'Red Coral (Pavalam)', ta: 'பவளம்', hi: 'मूंगा' },
    colour: { en: 'Light red / Pink', ta: 'இளஞ்சிவப்பு', hi: 'हल्का लाल / गुलाबी' },
    number: 9,
    luckyNumbers: [3, 6, 9]
  },
  [Graha.BUDHA]: {
    stone: { en: 'Emerald (Maragatham)', ta: 'மரகதம்', hi: 'पन्ना' },
    colour: { en: 'Green', ta: 'பச்சை', hi: 'हरा' },
    number: 5,
    luckyNumbers: [1, 5, 8]
  },
  [Graha.GURU]: {
    stone: { en: 'Yellow Sapphire (Pushparagam)', ta: 'புஷ்பராகம்', hi: 'पुखराज' },
    colour: { en: 'Yellow', ta: 'மஞ்சள்', hi: 'पीला' },
    number: 3,
    luckyNumbers: [2, 3, 9]
  },
  [Graha.SUKRA]: {
    stone: { en: 'Diamond (Vairam)', ta: 'வைரம்', hi: 'हीरा' },
    colour: { en: 'White', ta: 'வெள்ளை', hi: 'सफ़ेद' },
    number: 6,
    luckyNumbers: [3, 6, 8]
  },
  [Graha.SANI]: {
    stone: { en: 'Blue Sapphire (Neelam)', ta: 'நீலம்', hi: 'नीलम' },
    colour: { en: 'Dark blue / Black', ta: 'கருநீலம் / கருப்பு', hi: 'गहरा नीला / काला' },
    number: 8,
    luckyNumbers: [5, 6, 8]
  },
  [Graha.RAHU]: {
    stone: { en: 'Hessonite (Gomedhagam)', ta: 'கோமேதகம்', hi: 'गोमेद' },
    colour: { en: 'Black / Smoky', ta: 'கருப்பு', hi: 'काला / धुएँ जैसा' },
    number: 4,
    luckyNumbers: [1, 4, 7]
  },
  [Graha.KETU]: {
    stone: { en: "Cat's Eye (Vaiduryam)", ta: 'வைடூரியம்', hi: 'लहसुनिया (वैदूर्य)' },
    colour: { en: 'Red with mixed colours', ta: 'சிவப்பு கலந்த பல நிறங்கள்', hi: 'लाल व मिश्रित रंग' },
    number: 7,
    luckyNumbers: [5, 7, 9]
  }
};

export const GRAHA_LUCKY_NAMES: Record<string, Record<LuckyLanguage, string>> = {
  [Graha.SURYA]: { en: 'Surya (Sun)', ta: 'சூரியன்', hi: 'सूर्य' },
  [Graha.CHANDRA]: { en: 'Chandra (Moon)', ta: 'சந்திரன்', hi: 'चंद्र' },
  [Graha.CHEVVAI]: { en: 'Chevvai (Mars)', ta: 'செவ்வாய்', hi: 'मंगल' },
  [Graha.BUDHA]: { en: 'Budha (Mercury)', ta: 'புதன்', hi: 'बुध' },
  [Graha.GURU]: { en: 'Guru (Jupiter)', ta: 'குரு', hi: 'गुरु' },
  [Graha.SUKRA]: { en: 'Sukra (Venus)', ta: 'சுக்கிரன்', hi: 'शुक्र' },
  [Graha.SANI]: { en: 'Sani (Saturn)', ta: 'சனி', hi: 'शनि' },
  [Graha.RAHU]: { en: 'Rahu', ta: 'ராகு', hi: 'राहु' },
  [Graha.KETU]: { en: 'Ketu', ta: 'கேது', hi: 'केतु' }
};

export const LUCKY_INDICATOR_TEXT: Record<LuckyLanguage, {
  title: string;
  nakshatraRow: string;
  rasiRow: string;
  lord: string;
  birthStone: string;
  rasiStone: string;
  luckyColour: string;
  rasiColour: string;
  luckyNumbers: string;
  rasiNumber: string;
  note: string;
  /** One-line caution used when page 3 is in compact mode. */
  noteShort: string;
  unavailable: string;
}> = {
  en: {
    title: 'Lucky Indicators — Birth Stone, Colour & Numbers',
    nakshatraRow: 'By Janma Nakshatra',
    rasiRow: 'By Chandra Rasi',
    lord: 'Lord',
    birthStone: 'Birth Stone',
    rasiStone: 'Rasi Stone',
    luckyColour: 'Lucky Colour',
    rasiColour: 'Rasi Colour',
    luckyNumbers: 'Lucky Numbers',
    rasiNumber: 'Rasi Number',
    note: 'As per Tamil Ratna Sastra the stone, colour and numbers follow the nakshatra lord and the rasi lord. A gem should be worn only after a personal consultation; the colour and numbers can be used freely in daily life.',
    noteShort: 'Wear a gem only after a personal consultation; colour and numbers may be used freely.',
    unavailable: 'N/A'
  },
  ta: {
    title: 'அதிர்ஷ்டக் குறிப்புகள் — ராசிக் கல், நிறம், எண்',
    nakshatraRow: 'ஜென்ம நட்சத்திரப்படி',
    rasiRow: 'சந்திர ராசிப்படி',
    lord: 'அதிபதி',
    birthStone: 'நட்சத்திரக் கல்',
    rasiStone: 'ராசிக் கல்',
    luckyColour: 'அதிர்ஷ்ட நிறம்',
    rasiColour: 'ராசி நிறம்',
    luckyNumbers: 'அதிர்ஷ்ட எண்கள்',
    rasiNumber: 'ராசி எண்',
    note: 'தமிழ் ரத்ன சாஸ்திரப்படி கல், நிறம், எண் ஆகியவை நட்சத்திர அதிபதி மற்றும் ராசி அதிபதியைப் பொறுத்து அமைகின்றன. ரத்தினக் கல்லை தனிப்பட்ட ஆலோசனைக்குப் பின்னரே அணிய வேண்டும்; நிறத்தையும் எண்களையும் அன்றாட வாழ்வில் தாராளமாகப் பயன்படுத்தலாம்.',
    noteShort: 'ரத்தினக் கல்லை ஆலோசனைக்குப் பின்னரே அணியவும்; நிறம், எண்களைத் தாராளமாகப் பயன்படுத்தலாம்.',
    unavailable: 'கிடைக்கவில்லை'
  },
  hi: {
    title: 'शुभ संकेत — जन्म रत्न, रंग व अंक',
    nakshatraRow: 'जन्म नक्षत्र के अनुसार',
    rasiRow: 'चंद्र राशि के अनुसार',
    lord: 'स्वामी',
    birthStone: 'जन्म रत्न',
    rasiStone: 'राशि रत्न',
    luckyColour: 'शुभ रंग',
    rasiColour: 'राशि रंग',
    luckyNumbers: 'शुभ अंक',
    rasiNumber: 'राशि अंक',
    note: 'तमिल रत्न शास्त्र के अनुसार रत्न, रंग और अंक नक्षत्र स्वामी तथा राशि स्वामी से निर्धारित होते हैं। रत्न केवल व्यक्तिगत परामर्श के बाद ही धारण करें; रंग और अंक दैनिक जीवन में सहज रूप से अपनाए जा सकते हैं।',
    noteShort: 'रत्न केवल परामर्श के बाद धारण करें; रंग और अंक सहज रूप से अपनाएँ।',
    unavailable: 'उपलब्ध नहीं'
  }
};

export interface LuckyIndicators {
  nakshatraLord: Graha | null;
  rasiLord: Graha | null;
  nakshatraLordName: string;
  rasiLordName: string;
  birthStone: string;
  luckyColour: string;
  luckyNumbers: string;
  rasiStone: string;
  rasiColour: string;
  rasiNumber: string;
}

/** Nakshatra lord for a 0-based janma nakshatra index (0 = Aswini … 26 = Revathi). */
export function nakshatraLordForIndex(index: unknown): Graha | null {
  if (index === null || index === undefined || index === '' || typeof index === 'boolean') return null;
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n > 26) return null;
  return NAKSHATRA_LORD_CYCLE[n % 9];
}

/** Rasi lord for a 1-based rasi number. */
export function rasiLordForNumber(rasi: unknown): Graha | null {
  if (rasi === null || rasi === undefined || rasi === '' || typeof rasi === 'boolean') return null;
  const n = Number(rasi);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return RASI_LORD_FOR_LUCKY[n];
}

/**
 * Resolve the page-3 lucky indicators for a chart. Both inputs are validated:
 * an unreadable nakshatra index or rasi never fabricates a stone — the page
 * prints the language's "N/A" instead.
 */
export function resolveLuckyIndicators(
  janmaNakshatraIndex: unknown,
  chandraRasi: unknown,
  lang: LuckyLanguage = 'en'
): LuckyIndicators {
  const text = LUCKY_INDICATOR_TEXT[lang] || LUCKY_INDICATOR_TEXT.en;
  const nakshatraLord = nakshatraLordForIndex(janmaNakshatraIndex);
  const rasiLord = rasiLordForNumber(chandraRasi);
  const nak = nakshatraLord ? GRAHA_LUCKY_PROFILES[nakshatraLord] : null;
  const rasi = rasiLord ? GRAHA_LUCKY_PROFILES[rasiLord] : null;
  const pick = (record: Record<LuckyLanguage, string> | undefined) =>
    record ? record[lang] || record.en : text.unavailable;
  return {
    nakshatraLord,
    rasiLord,
    nakshatraLordName: nakshatraLord ? pick(GRAHA_LUCKY_NAMES[nakshatraLord]) : text.unavailable,
    rasiLordName: rasiLord ? pick(GRAHA_LUCKY_NAMES[rasiLord]) : text.unavailable,
    birthStone: nak ? pick(nak.stone) : text.unavailable,
    luckyColour: nak ? pick(nak.colour) : text.unavailable,
    luckyNumbers: nak ? nak.luckyNumbers.join(', ') : text.unavailable,
    rasiStone: rasi ? pick(rasi.stone) : text.unavailable,
    rasiColour: rasi ? pick(rasi.colour) : text.unavailable,
    rasiNumber: rasi ? String(rasi.number) : text.unavailable
  };
}
