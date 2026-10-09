import * as Astronomy from 'astronomy-engine';
import rulesData from './rules.json';
import {
  getLocalDateKey,
  getTimeZoneIdForCoordinates,
  getTimezoneOffsetAtInstant,
  resolveLocalDateTimeInTimeZone
} from '../timezone.js';
// The scanner used to carry a private two-term copy of the Lahiri ayanamsa,
// which silently returned the MEAN value while every other engine returned the
// TRUE one. Import the shared implementation so a Muhurtham day and the chart
// of the same instant are computed from the same ayanamsa.
import { calculateLahiriAyanamsa } from '../astrology/ayanamsa.js';
// The Lagna shown beside each person's Nakshatra/Rasi is the same sidereal
// ascendant every chart report prints (one shared formula, no second copy).
import { calculateSiderealAscendant } from '../astrology/astronomy.js';

export type MuhurthamEventKey =
  | 'wedding'
  | 'griha_pravesam'
  | 'business_start'
  | 'education_start'
  | 'vehicle_purchase'
  | 'land_purchase'
  | 'house_construction'
  | 'namakaranam'
  | 'house_purchase'
  | 'engagement'
  | 'annaprasanam'
  | 'seemantham'
  | 'upanayanam'
  | 'karnavedha'
  | 'mundan'
  | 'gold_purchase'
  | 'new_job'
  | 'shifting_home';

export type MuhurthamGrade = 'BEST' | 'GOOD' | 'FAIR' | 'AVOID';

/**
 * Version stamp of the Muhurtham scan contract.
 *
 * Bump it whenever the grading rules, the payload shape or the reported fields
 * change, so a scan cached in a browser, an order payload, or the database is
 * transparently recalculated instead of being delivered with old grades.
 *
 * 6 — bride + groom are both checked (Chandrashtama, Tara Bala, Janma
 *     Nakshatra), a Janma-Nakshatra or Chandrashtama day is never recommended,
 *     Uttamam needs a good Tara Bala for every person, and Sukra asta uses the
 *     classical 10° orb with boundary days excluded.
 */
export const MUHURTHAM_ALGORITHM_VERSION = 6;

/**
 * Asta (combustion) orbs in degrees from the Sun, measured at the local
 * sunrise that fixes the day's Panchangam.
 *
 * These are the classical Surya Siddhanta values and are the SAME numbers the
 * rest of the engine already uses (`getCombustionLimit()` in
 * src/lib/astrology/astronomy.ts and `AstroEngine::COMBUSTION_LIMITS` in
 * api/astrology/engine.php): Guru 11°, Sukra 10°. Sukra is the wedding karaka,
 * so the report must not rate a date on a narrower 8° orb — a retrograde Venus
 * is given no looser standard than a direct one.
 */
export const GURU_ASTA_ORB_DEG = 11.0;
export const SUKRA_ASTA_ORB_DEG = 10.0;

/**
 * Boundary-day guard for the asta window.
 *
 * The Sun–planet elongation changes by up to ~1.5° a day around an inferior
 * conjunction, so the day that sits *just* outside the orb is still inside the
 * asta period's shadow: the planet rises/sets minutes apart from the Sun and no
 * ceremony can be timed around it. Any day within this margin of the orb is
 * therefore excluded as well.
 *
 * 2026 worked example (Chennai sunrise, 10° orb): Venus is at inferior
 * conjunction on 24 Oct; elongations are 12.67° (16 Oct), 11.19° (17 Oct),
 * 9.68° (18 Oct), 8.14° (19 Oct), ... 9.32° (30 Oct), 10.86° (31 Oct) and
 * 12.37° (1 Nov). With this 1.5° guard the whole 17–31 Oct window is excluded
 * instead of letting 19 Oct / 30 Oct through by a fraction of a degree.
 */
export const ASTA_BOUNDARY_MARGIN_DEG = 1.5;

/** True when a planet is inside its asta (combustion) window, boundary days included. */
export function isInsideAstaWindow(elongationDeg: number, orbDeg: number): boolean {
  return Number.isFinite(elongationDeg) && Math.abs(elongationDeg) <= orbDeg + ASTA_BOUNDARY_MARGIN_DEG;
}

/** Whose personal star is being cross-checked for a given ceremony. */
export type PersonRole = 'bride' | 'groom' | 'child' | 'mother' | 'self';

export interface PersonInput {
  nakshatraIndex: number;
  rasiNumber?: number;
  role: PersonRole;
}

/**
 * One person carried in a Muhurtham report: their Janma Nakshatra, Rasi and
 * Lagna computed from their own birth details, plus the display details the
 * report prints. A wedding report carries TWO of these (bride and groom); every
 * other ceremony carries the single person the order is for.
 */
export interface MuhurthamPersonDetails extends PersonInput {
  role: PersonRole;
  name: string;
  dob: string;
  tob: string;
  birthPlace: string;
  nakshatraNameEn: string;
  nakshatraNameTa: string;
  nakshatraNameHi: string;
  rasiNumber: number;
  rasiNameEn: string;
  rasiNameTa: string;
  rasiNameHi: string;
  lagnaRasiNumber: number;
  lagnaNameEn: string;
  lagnaNameTa: string;
  lagnaNameHi: string;
}

export const ROLE_LABELS: Record<PersonRole, { en: string; ta: string; hi: string }> = {
  bride: { en: 'Bride', ta: 'மணப்பெண்', hi: 'वधू' },
  groom: { en: 'Groom', ta: 'மணமகன்', hi: 'वर' },
  child: { en: 'Child', ta: 'குழந்தை', hi: 'शिशु' },
  mother: { en: 'Mother', ta: 'தாய்', hi: 'माता' },
  self: { en: 'You', ta: 'நீங்கள்', hi: 'आप' }
};

export interface LocationInput {
  placeName: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timeZoneId?: string;
}

export interface TimeWindow {
  start: string;
  end: string;
  startMinutes?: number;
  endMinutes?: number;
  labelEn: string;
  labelTa: string;
  labelHi: string;
}

export interface PersonalAstroCheck {
  role: PersonRole;
  nakshatraIndex: number;
  nakshatraNameEn: string;
  nakshatraNameTa: string;
  nakshatraNameHi: string;
  taraNumber: number; // 1 - 9
  taraNameEn: string;
  taraNameTa: string;
  taraNameHi: string;
  taraBadgeEn: string;
  taraBadgeTa: string;
  taraBadgeHi: string;
  isTaraAuspicious: boolean;
  isChandrashtama: boolean;
  /**
   * The day's Nakshatra IS this person's own Janma Nakshatra. A birth-star day
   * is never presented as an Uttamam (BEST) date for that person, and a date
   * that is either bride's or groom's Janma Nakshatra is not recommended.
   */
  isJanmaNakshatra: boolean;
  summaryEn: string;
  summaryTa: string;
  summaryHi: string;
}

export interface DayMuhurthamResult {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  month: number;
  year: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  dayOfWeekNameEn: string;
  dayOfWeekNameTa: string;
  dayOfWeekNameHi: string;
  sunrise: string;
  sunset: string;
  tamilMonthIndex: number;
  tamilMonthKey: string;
  tamilDay: number;
  tithiIndex: number;
  tithiNumberInPaksha: number;
  tithiNameEn: string;
  tithiNameTa: string;
  tithiNameHi: string;
  isShuklaPaksha: boolean;
  nakshatraIndex: number;
  nakshatraNameEn: string;
  nakshatraNameTa: string;
  nakshatraNameHi: string;
  pada: number;
  moonRasiNumber: number;
  nakshatraPlainMeaningEn: string;
  nakshatraPlainMeaningTa: string;
  nakshatraPlainMeaningHi: string;
  yogaIndex: number;
  yogaNameEn: string;
  yogaNameTa: string;
  yogaNameHi: string;
  karanaIndex: number;
  karanaNameEn: string;
  karanaNameTa: string;
  karanaNameHi: string;
  rahuKalam: TimeWindow;
  yamagandam: TimeWindow;
  gulikai: TimeWindow;
  abhijit: TimeWindow | null;
  nallaNeram: TimeWindow[];
  avoidWindows: TimeWindow[];
  grade: MuhurthamGrade;
  score: number;
  isRecommended: boolean;
  isAdhikaMasa: boolean;
  isPitruPaksha: boolean;
  reasonsEn: string[];
  reasonsTa: string[];
  reasonsHi: string[];
  doshasEn: string[];
  doshasTa: string[];
  doshasHi: string[];
  personalChecks: PersonalAstroCheck[];
  /**
   * One short line printed in the date row summarising the Chandrashtama /
   * Tara Bala check for every person (empty when no chart was supplied). The
   * report shows it verbatim, so the browser and PHP agree.
   */
  personalNoteEn: string;
  personalNoteTa: string;
  personalNoteHi: string;
  /** @deprecated use personalChecks — kept for backwards compatibility */
  bridePersonalCheck?: PersonalAstroCheck;
  /** @deprecated use personalChecks — kept for backwards compatibility */
  groomPersonalCheck?: PersonalAstroCheck;
  planetaryHighlights: {
    guruRetrograde: boolean;
    guruCombust: boolean;
    sukraRetrograde: boolean;
    sukraCombust: boolean;
    budhaRetrograde: boolean;
    eclipseNearby: boolean;
  };
  babyNamingSyllables?: {
    pada: number;
    letterEn: string;
    letterTa: string;
    letterHi: string;
    allSummaryEn: string;
    allSummaryTa: string;
    allSummaryHi: string;
  };
  isTraditional11thOr12thDay?: boolean;
}

export interface MonthScanResult {
  monthKey: string; // YYYY-MM
  month: number; // 1-12
  year: number;
  monthNameEn: string;
  monthNameTa: string;
  monthNameHi: string;
  days: DayMuhurthamResult[];
  goodCount: number;
  bestCount: number;
  fairCount: number;
  avoidCount: number;
}

/** Sidereal Lagna (rising sign) at the birth instant, when coordinates are known. */
export interface FoundLagna {
  rasiNumber: number;
  nameEn: string;
  nameTa: string;
  nameHi: string;
  siderealDeg: number;
}

export interface FoundNakshatraResult {
  isAmbiguous: boolean;
  primary: {
    nakshatraIndex: number;
    nakshatraNameEn: string;
    nakshatraNameTa: string;
    nakshatraNameHi: string;
    pada: number;
    rasiNumber: number;
    rasiNameEn: string;
    rasiNameTa: string;
    rasiNameHi: string;
    degInNak: number;
    /** Present only when the birth place coordinates were supplied. */
    lagna?: FoundLagna;
  };
  secondary?: {
    nakshatraIndex: number;
    nakshatraNameEn: string;
    nakshatraNameTa: string;
    nakshatraNameHi: string;
    pada: number;
    rasiNumber: number;
    rasiNameEn: string;
    rasiNameTa: string;
    rasiNameHi: string;
  };
  transitionTimeFormatted?: string;
  noteEn?: string;
  noteTa?: string;
  noteHi?: string;
}

// Global in-memory cache to ensure snappy instantaneous tab switching
const SCAN_CACHE = new Map<string, MonthScanResult>();

const DAYS_NAMES = [
  { en: 'Sunday', ta: 'ஞாயிறு', hi: 'रविवार', shortEn: 'Sun', shortTa: 'ஞாயிறு', shortHi: 'रवि' },
  { en: 'Monday', ta: 'திங்கள்', hi: 'सोमवार', shortEn: 'Mon', shortTa: 'திங்கள்', shortHi: 'सोम' },
  { en: 'Tuesday', ta: 'செவ்வாய்', hi: 'मंगलवार', shortEn: 'Tue', shortTa: 'செவ்வாய்', shortHi: 'मंगल' },
  { en: 'Wednesday', ta: 'புதன்', hi: 'बुधवार', shortEn: 'Wed', shortTa: 'புதன்', shortHi: 'बुध' },
  { en: 'Thursday', ta: 'வியாழன்', hi: 'गुरुवार', shortEn: 'Thu', shortTa: 'வியாழன்', shortHi: 'गुरु' },
  { en: 'Friday', ta: 'வெள்ளி', hi: 'शुक्रवार', shortEn: 'Fri', shortTa: 'வெள்ளி', shortHi: 'शुक्र' },
  { en: 'Saturday', ta: 'சனி', hi: 'शनिवार', shortEn: 'Sat', shortTa: 'சனி', shortHi: 'शनि' }
];

const MONTH_NAMES_GREGORIAN = [
  { en: 'January', ta: 'ஜனவரி', hi: 'जनवरी', shortEn: 'Jan', shortTa: 'ஜனவரி', shortHi: 'जन' },
  { en: 'February', ta: 'பிப்ரவரி', hi: 'फ़रवरी', shortEn: 'Feb', shortTa: 'பிப்ரவரி', shortHi: 'फ़र' },
  { en: 'March', ta: 'மார்ச்', hi: 'मार्च', shortEn: 'Mar', shortTa: 'மார்ச்', shortHi: 'मार्च' },
  { en: 'April', ta: 'ஏப்ரல்', hi: 'अप्रैल', shortEn: 'Apr', shortTa: 'ஏப்ரல்', shortHi: 'अप्रै' },
  { en: 'May', ta: 'மே', hi: 'मई', shortEn: 'May', shortTa: 'மே', shortHi: 'मई' },
  { en: 'June', ta: 'ஜூன்', hi: 'जून', shortEn: 'Jun', shortTa: 'ஜூன்', shortHi: 'जून' },
  { en: 'July', ta: 'ஜூலை', hi: 'जुलाई', shortEn: 'Jul', shortTa: 'ஜூலை', shortHi: 'जुला' },
  { en: 'August', ta: 'ஆகஸ்ட்', hi: 'अगस्त', shortEn: 'Aug', shortTa: 'ஆகஸ்ட்', shortHi: 'अग' },
  { en: 'September', ta: 'செப்டம்பர்', hi: 'सितंबर', shortEn: 'Sep', shortTa: 'செப்டம்பர்', shortHi: 'सित' },
  { en: 'October', ta: 'அக்டோபர்', hi: 'अक्टूबर', shortEn: 'Oct', shortTa: 'அக்டோபர்', shortHi: 'अक्टू' },
  { en: 'November', ta: 'நவம்பர்', hi: 'नवंबर', shortEn: 'Nov', shortTa: 'நவம்பர்', shortHi: 'नव' },
  { en: 'December', ta: 'டிசம்பர்', hi: 'दिसंबर', shortEn: 'Dec', shortTa: 'டிசம்பர்', shortHi: 'दिस' }
];

export const RASI_METADATA = [
  { number: 1, nameEn: 'Mesham (Aries)', nameTa: 'மேஷம்', nameHi: 'मेष' },
  { number: 2, nameEn: 'Rishabam (Taurus)', nameTa: 'ரிஷபம்', nameHi: 'वृषभ' },
  { number: 3, nameEn: 'Mithunam (Gemini)', nameTa: 'மிதுனம்', nameHi: 'मिथुन' },
  { number: 4, nameEn: 'Kadagam (Cancer)', nameTa: 'கடகம்', nameHi: 'कर्क' },
  { number: 5, nameEn: 'Simham (Leo)', nameTa: 'சிம்மம்', nameHi: 'सिंह' },
  { number: 6, nameEn: 'Kanni (Virgo)', nameTa: 'கன்னி', nameHi: 'कन्या' },
  { number: 7, nameEn: 'Thulam (Libra)', nameTa: 'துலாம்', nameHi: 'तुला' },
  { number: 8, nameEn: 'Viruchigam (Scorpio)', nameTa: 'விருச்சிகம்', nameHi: 'वृश्चिक' },
  { number: 9, nameEn: 'Dhanusu (Sagittarius)', nameTa: 'தனுசு', nameHi: 'धनु' },
  { number: 10, nameEn: 'Magaram (Capricorn)', nameTa: 'மகரம்', nameHi: 'मकर' },
  { number: 11, nameEn: 'Kumbam (Aquarius)', nameTa: 'கும்பம்', nameHi: 'कुंभ' },
  { number: 12, nameEn: 'Meenam (Pisces)', nameTa: 'மீனம்', nameHi: 'मीन' }
];

const TITHI_NAMES = [
  { en: 'Shukla Prathama (1)', ta: 'சுக்ல பிரதமை (1)', hi: 'शुक्ल प्रतिपदा (1)' },
  { en: 'Shukla Dvitiya (2)', ta: 'சுக்ல துவிதியை (2)', hi: 'शुक्ल द्वितीया (2)' },
  { en: 'Shukla Tritiya (3)', ta: 'சுக்ல திருதியை (3)', hi: 'शुक्ल तृतीया (3)' },
  { en: 'Shukla Chaturthi (4)', ta: 'சுக்ல சதுர்த்தி (4)', hi: 'शुक्ल चतुर्थी (4)' },
  { en: 'Shukla Panchami (5)', ta: 'சுக்ல பஞ்சமி (5)', hi: 'शुक्ल पंचमी (5)' },
  { en: 'Shukla Shashthi (6)', ta: 'சுக்ல சஷ்டி (6)', hi: 'शुक्ल षष्ठी (6)' },
  { en: 'Shukla Saptami (7)', ta: 'சுக்ல சப்தமி (7)', hi: 'शुक्ल सप्तमी (7)' },
  { en: 'Shukla Ashtami (8)', ta: 'சுக்ல அஷ்டமி (8)', hi: 'शुक्ल अष्टमी (8)' },
  { en: 'Shukla Navami (9)', ta: 'சுக்ல நவமி (9)', hi: 'शुक्ल नवमी (9)' },
  { en: 'Shukla Dashami (10)', ta: 'சுக்ல தசமி (10)', hi: 'शुक्ल दशमी (10)' },
  { en: 'Shukla Ekadashi (11)', ta: 'சுக்ல ஏகாதசி (11)', hi: 'शुक्ल एकादशी (11)' },
  { en: 'Shukla Dvadashi (12)', ta: 'சுக்ல துவாதசி (12)', hi: 'शुक्ल द्वादशी (12)' },
  { en: 'Shukla Trayodashi (13)', ta: 'சுக்ல திரயோதசி (13)', hi: 'शुक्ल त्रयोदशी (13)' },
  { en: 'Shukla Chaturdashi (14)', ta: 'சுக்ல சதுர்தசி (14)', hi: 'शुक्ल चतुर्दशी (14)' },
  { en: 'Purnima (Full Moon)', ta: 'பௌர்ணமி (முழு நிலவு)', hi: 'पूर्णिमा (पूर्ण चंद्र)' },
  { en: 'Krishna Prathama (1)', ta: 'கிருஷ்ண பிரதமை (1)', hi: 'कृष्ण प्रतिपदा (1)' },
  { en: 'Krishna Dvitiya (2)', ta: 'கிருஷ்ண துவிதியை (2)', hi: 'कृष्ण द्वितीया (2)' },
  { en: 'Krishna Tritiya (3)', ta: 'கிருஷ்ண திருதியை (3)', hi: 'कृष्ण तृतीया (3)' },
  { en: 'Krishna Chaturthi (4)', ta: 'கிருஷ்ண சதுர்த்தி (4)', hi: 'कृष्ण चतुर्थी (4)' },
  { en: 'Krishna Panchami (5)', ta: 'கிருஷ்ண பஞ்சமி (5)', hi: 'कृष्ण पंचमी (5)' },
  { en: 'Krishna Shashthi (6)', ta: 'கிருஷ்ண சஷ்டி (6)', hi: 'कृष्ण षष्ठी (6)' },
  { en: 'Krishna Saptami (7)', ta: 'கிருஷ்ண சப்தமி (7)', hi: 'कृष्ण सप्तमी (7)' },
  { en: 'Krishna Ashtami (8)', ta: 'கிருஷ்ண அஷ்டமி (8)', hi: 'कृष्ण अष्टमी (8)' },
  { en: 'Krishna Navami (9)', ta: 'கிருஷ்ண நவமி (9)', hi: 'कृष्ण नवमी (9)' },
  { en: 'Krishna Dashami (10)', ta: 'கிருஷ்ண தசமி (10)', hi: 'कृष्ण दशमी (10)' },
  { en: 'Krishna Ekadashi (11)', ta: 'கிருஷ்ண ஏகாதசி (11)', hi: 'कृष्ण एकादशी (11)' },
  { en: 'Krishna Dvadashi (12)', ta: 'கிருஷ்ண துவாதசி (12)', hi: 'कृष्ण द्वादशी (12)' },
  { en: 'Krishna Trayodashi (13)', ta: 'கிருஷ்ண திரயோதசி (13)', hi: 'कृष्ण त्रयोदशी (13)' },
  { en: 'Krishna Chaturdashi (14)', ta: 'கிருஷ்ண சதுர்தசி (14)', hi: 'कृष्ण चतुर्दशी (14)' },
  { en: 'Amavasya (New Moon)', ta: 'அமாவாசை', hi: 'अमावस्या (नव चंद्र)' }
];

const YOGA_NAMES = [
  { en: 'Vishkambha', ta: 'விஷ்கம்பம்', hi: 'विष्कुंभ' },
  { en: 'Priti', ta: 'ப்ரீதி', hi: 'प्रीति' },
  { en: 'Ayushman', ta: 'ஆயுஷ்மான்', hi: 'आयुष्मान' },
  { en: 'Saubhagya', ta: 'சௌபாக்யம்', hi: 'सौभाग्य' },
  { en: 'Shobhana', ta: 'சோபனம்', hi: 'शोभन' },
  { en: 'Atiganda', ta: 'அதிகண்டம்', hi: 'अतिगंड' },
  { en: 'Sukarma', ta: 'சுகர்மம்', hi: 'सुकर्मा' },
  { en: 'Dhriti', ta: 'திருதி', hi: 'धृति' },
  { en: 'Shoola', ta: 'சூலம்', hi: 'शूल' },
  { en: 'Ganda', ta: 'கண்டம்', hi: 'गंड' },
  { en: 'Vriddhi', ta: 'விருத்தி', hi: 'वृद्धि' },
  { en: 'Dhruva', ta: 'துருவம்', hi: 'ध्रुव' },
  { en: 'Vyaghata', ta: 'வியாகாதம்', hi: 'व्याघात' },
  { en: 'Harshana', ta: 'ஹர்ஷணம்', hi: 'हर्षण' },
  { en: 'Vajra', ta: 'வஜ்ரம்', hi: 'वज्र' },
  { en: 'Asiddhi', ta: 'அசித்தி', hi: 'असिद्धि' },
  { en: 'Vyatipata', ta: 'வியதீபாதம்', hi: 'व्यतीपात' },
  { en: 'Variyan', ta: 'வரீயான்', hi: 'वरीयान' },
  { en: 'Parigha', ta: 'பரிகம்', hi: 'परिघ' },
  { en: 'Shiva', ta: 'சிவம்', hi: 'शिव' },
  { en: 'Siddha', ta: 'சித்தம்', hi: 'सिद्ध' },
  { en: 'Sadhya', ta: 'சாத்தியம்', hi: 'சாध्य' },
  { en: 'Shubha', ta: 'சுபம்', hi: 'शुभ' },
  { en: 'Shukla', ta: 'சுப்ரம்', hi: 'शुक्ल' },
  { en: 'Brahma', ta: 'பிராமியம்', hi: 'ब्रह्म' },
  { en: 'Indra', ta: 'ஐந்திரம்', hi: 'इन्द्र' },
  { en: 'Vaidhriti', ta: 'வைதிருதி', hi: 'वैधृति' }
];

const KARANA_NAMES = [
  { en: 'Bava', ta: 'பவ', hi: 'बव' },
  { en: 'Balava', ta: 'பாலவ', hi: 'बालव' },
  { en: 'Kaulava', ta: 'கௌலவ', hi: 'कौलव' },
  { en: 'Taitila', ta: 'சைத்துலை', hi: 'तैतिल' },
  { en: 'Gara', ta: 'கரசை', hi: 'गर' },
  { en: 'Vanija', ta: 'வணிசை', hi: 'वणिज' },
  { en: 'Vishti (Bhadra)', ta: 'பத்திரை (விஷ்டி)', hi: 'विष्टि (भद्रा)' },
  { en: 'Shakuni', ta: 'சகுனி', hi: 'शकुनि' },
  { en: 'Chatushpada', ta: 'சதுஷ்பாதம்', hi: 'चतुष्पद' },
  { en: 'Naga', ta: 'நாகவம்', hi: 'नाग' },
  { en: 'Kimstughna', ta: 'கிமிஸ்துக்னம்', hi: 'किंस्तुघ्न' }
];

const NAVATARA_TABLE = [
  { num: 1, en: 'Janma Tara', ta: 'ஜன்ம தாரை', hi: 'जन्म तारा', isGood: false, badgeEn: 'Janma (Birth Star)', badgeTa: 'ஜன்ம தாரை', badgeHi: 'जन्म तारा', descEn: 'Birth star vibration (average/mixed)', descTa: 'ஜன்ம தாரை - மிதமான பலன்', descHi: 'जन्म तारा - सामान्य प्रभाव' },
  { num: 2, en: 'Sampat Tara', ta: 'சம்பத் தாரை', hi: 'सम्पत तारा', isGood: true, badgeEn: 'Sampat (Wealth & Prosperity) ✓', badgeTa: 'சம்பத் தாரை (தன லாபம்) ✓', badgeHi: 'सम्पत तारा (धन लाभ) ✓', descEn: 'Brings immense wealth, prosperity and joy', descTa: 'சம்பத் தாரை - தன தான்ய சம்பத்தும் செல்வ விருத்தியும் அருளும்', descHi: 'सम्पत तारा - अपार धन-धान्य व समृद्धि प्रदायक' },
  { num: 3, en: 'Vipat Tara', ta: 'விபத் தாரை', hi: 'विपत तारा', isGood: false, badgeEn: 'Vipat (Obstacles)', badgeTa: 'விபத் தாரை (எச்சரிக்கை)', badgeHi: 'विपत तारा', descEn: 'Prone to delays and minor friction', descTa: 'விபத் தாரை - கவனமுடன் செயல்பட வேண்டிய நாள்', descHi: 'विपत तारा - कार्यों में सावधानी बरतें' },
  { num: 4, en: 'Kshema Tara', ta: 'க்ஷேம தாரை', hi: 'क्षेम तारा', isGood: true, badgeEn: 'Kshema (Well-being & Safety) ✓', badgeTa: 'க்ஷேம தாரை (சுகவாழ்வு) ✓', badgeHi: 'क्षेम तारा (कल्याण) ✓', descEn: 'Grants safety, health and peaceful happiness', descTa: 'க்ஷேம தாரை - குடும்ப சுகமும் ஆரோக்கியமும் நல்கும்', descHi: 'क्षेम तारा - स्वास्थ्य, शांति व सुरक्षा प्रदायक' },
  { num: 5, en: 'Pratyak Tara', ta: 'பிரத்யக் தாரை', hi: 'प्रत्यक तारा', isGood: false, badgeEn: 'Pratyak (Opposition)', badgeTa: 'பிரத்யக் தாரை', badgeHi: 'प्रत्यक तारा', descEn: 'Possibility of differences or hurdles', descTa: 'பிரத்யக் தாரை - சுமாரான பலன்', descHi: 'प्रत्यक तारा - सामान्य विरोध संभव' },
  { num: 6, en: 'Sadhaka Tara', ta: 'சாதக தாரை', hi: 'साधक तारा', isGood: true, badgeEn: 'Sadhaka (Success & Victory) ✓', badgeTa: 'சாதக தாரை (வெற்றி) ✓', badgeHi: 'साधक तारा (सफलता) ✓', descEn: 'Accomplishes all intended endeavors with success', descTa: 'சாதக தாரை - எண்ணிய காரியங்களை வெற்றிகரமாக முடிக்கும்', descHi: 'साधक तारा - कार्य सिद्धि एवं मनोकामना पूर्ति' },
  { num: 7, en: 'Vadha Tara', ta: 'வத தாரை', hi: 'वध तारा', isGood: false, badgeEn: 'Vadha (Caution)', badgeTa: 'வத தாரை (அசுபம்)', badgeHi: 'वध तारा', descEn: 'Heavy planetary pressure on this day', descTa: 'வத தாரை - சாந்தி பரிகாரங்கள் தேவைப்படும் நாள்', descHi: 'वध तारा - सतर्कता आवश्यक' },
  { num: 8, en: 'Mitra Tara', ta: 'மித்ர தாரை', hi: 'मित्र तारा', isGood: true, badgeEn: 'Mitra (Harmony & Friendship) ✓', badgeTa: 'மித்ர தாரை (ஆதரவு) ✓', badgeHi: 'मित्र तारा (मैत्री) ✓', descEn: 'Promotes deep friendship, support and mutual goodwill', descTa: 'மித்ர தாரை - நல்லுறவும் பரஸ்பர ஆதரவும் தரும்', descHi: 'मित्र तारा - सौहार्द, सहयोग व प्रेम प्रदायक' },
  { num: 9, en: 'Parama Mitra Tara', ta: 'பரம மித்ர தாரை', hi: 'परम मित्र तारा', isGood: true, badgeEn: 'Parama Mitra (Supreme Fortune) ✓', badgeTa: 'பரம மித்ர தாரை (மகா சுபம்) ✓', badgeHi: 'परम मित्र तारा (परम शुभ) ✓', descEn: 'Supreme cosmic harmony and divine blessings', descTa: 'பரம மித்ர தாரை - தெய்வ கடாட்சமும் மகா சுபிட்சமும் அருளும்', descHi: 'परम मित्र तारा - ईश्वरीय कृपा व परम आनंद प्रदायक' }
];

// Plain language explanations for everyday users
const NAKSHATRA_PLAIN_DESCRIPTIONS: Record<string, { en: string; ta: string; hi: string }> = {
  'Ashwini': {
    en: 'Ashwini - quick, energetic star ideal for fresh starts, learning and travel',
    ta: 'அஸ்வினி - புதிய துவக்கங்களுக்கும் விரைவான சுப காரியங்களுக்கும் ஏற்ற நட்சத்திரம்',
    hi: 'अश्विनी - नवीन शुरुआत, विद्यारंभ एवं शुभ यात्राओं हेतु ऊर्जावान नक्षत्र'
  },
  'Bharani': {
    en: 'Bharani - intense star suited for austerity and discipline (avoided for ceremonies)',
    ta: 'பரணி - தியானம் மற்றும் கட்டுப்பாட்டு காரியங்களுக்கு உரிய நட்சத்திரம்',
    hi: 'भरणी - तप एवं संयम से जुड़ा नक्षत्र (मांगलिक कार्यों में त्याज्य)'
  },
  'Krittika': {
    en: 'Krittika - fiery star ruled by Sun (avoided for marriages and housewarming)',
    ta: 'கிருத்திகை - சூரியனின் ஆதிக்கம் கொண்ட அக்னி நட்சத்திரம்',
    hi: 'कृत्तिका - सूर्य प्रधान तेज एवं आत्मशुद्धि का नक्षत्र'
  },
  'Rohini': {
    en: 'Rohini - a deeply favourable star for weddings, prosperity and lasting joy',
    ta: 'ரோகிணி - திருமணம் மற்றும் குடும்ப சுபிட்சத்திற்கு மிகவும் உன்னதமான சுப நட்சத்திரம்',
    hi: 'रोहिणी - विवाह, धन-धान्य व दीर्घकालिक सुख हेतु परम शुभ नक्षत्र'
  },
  'Mrigashira': {
    en: 'Mrigashira - harmonious star fostering affection, weddings and new homes',
    ta: 'மிருகசீரிடம் - திருமணம், புதுமனை மற்றும் சுப காரியங்களுக்கு சிறந்த நட்சத்திரம்',
    hi: 'मृगशिरा - परस्पर स्नेह, विवाह एवं गृह प्रवेश हेतु अत्यंत कल्याणकारी'
  },
  'Arudra': {
    en: 'Arudra - transformative star known for keen intellectual focus and deep concentration',
    ta: 'திருவாதிரை - ஆழ்ந்த ஞானமும் புத்தி கூர்மையும் தரும் மங்கள நட்சத்திரம்',
    hi: 'आर्द्रा - गहन ज्ञान, विवेक एवं बौद्धिक एकाग्रता का नक्षत्र'
  },
  'Punarvasu': {
    en: 'Punarvasu - auspicious star of renewal, vehicles, wealth and safe journeys',
    ta: 'புனர்பூசம் - மறுமலர்ச்சி, வாகனம் மற்றும் நல்வாய்ப்புகள் அருளும் மங்கள நட்சத்திரம்',
    hi: 'पुनर्वसु - नवीन अवसर, वाहन क्रय एवं शुभ यात्रा प्रदायक नक्षत्र'
  },
  'Pushya': {
    en: 'Pushya - king of auspicious stars, supreme for business, education and wealth',
    ta: 'பூசம் - அனைத்து நட்சத்திரங்களின் அரசன், தொழில் மற்றும் கல்விக்கு மிக உன்னதமானது',
    hi: 'पुष्य - नक्षत्रों का राजा, व्यापार, विद्या एवं धन वृद्धि हेतु सर्वोत्तम'
  },
  'Ashlesha': {
    en: 'Ashlesha - deep mystical star of intuition and wisdom',
    ta: 'ஆயில்யம் - ஆன்மீக ஞானம் மற்றும் நுட்பமான அறிவு தரும் நட்சத்திரம்',
    hi: 'आश्लेषा - अंतर्ज्ञान एवं गूढ़ विद्याओं का नक्षत्र'
  },
  'Magha': {
    en: 'Magha - royal star bestowing ancestral blessings, authority and weddings',
    ta: 'மகம் - முன்னோர்கள் ஆசியும் கௌரவமும் தரும் திருமண சுப நட்சத்திரம்',
    hi: 'मघा - पितृ कृपा, पद-प्रतिष्ठा एवं विवाह हेतु शुभ नक्षत्र'
  },
  'Purva Phalguni': {
    en: 'Purva Phalguni - creative star of arts, romance and joy',
    ta: 'பூரம் - கலை, மகிழ்ச்சி மற்றும் வசந்த விழாக்கள் கொண்டாடும் நட்சத்திரம்',
    hi: 'पूर्वाफाल्गुनी - आनंद, कला एवं उत्सव प्रिय नक्षत्र'
  },
  'Uttara Phalguni': {
    en: 'Uttara Phalguni - highly auspicious for weddings, construction and steady partnerships',
    ta: 'உத்திரம் - திருமணம், வீடு கட்டுதல் மற்றும் நீடித்த பந்தங்களுக்கு உகந்த சுப நட்சத்திரம்',
    hi: 'उत्तराफाल्गुनी - विवाह एवं स्थायी निर्माण हेतु अत्यंत शुभ नक्षत्र'
  },
  'Hasta': {
    en: 'Hasta - fortunate star of skilled craftsmanship, trade, weddings and new homes',
    ta: 'அஸ்தம் - திருமணம், புதுமனை புகுவிழா மற்றும் வர்த்தகத்திற்கு சிறந்த நட்சத்திரம்',
    hi: 'हस्त - कार्य कुशलता, व्यापार, विवाह व गृह प्रवेश हेतु श्रेष्ठ'
  },
  'Chitra': {
    en: 'Chitra - radiant star of beauty, architecture, design and construction',
    ta: 'சித்திரை - அழகு, கட்டிடக்கலை, பூமி பூஜை மற்றும் புதுமைக்கு ஏற்ற சுப நட்சத்திரம்',
    hi: 'चित्रा - सौंदर्य, वास्तु निर्माण एवं नवनिर्माण हेतु शुभ'
  },
  'Swati': {
    en: 'Swati - gentle star of freedom, vehicle purchase, learning and weddings',
    ta: 'சுவாதி - திருமணம், வாகனம் வாங்குதல் மற்றும் கல்விக்கு அருமையான நட்சத்திரம்',
    hi: 'स्वाति - वाहन क्रय, विद्या एवं विवाह हेतु श्रेष्ठ नक्षत्र'
  },
  'Vishakha': {
    en: 'Vishakha - goal-oriented star of determination and triumph',
    ta: 'விசாகம் - இலக்குகளை வெல்லும் ஆற்றலும் வெற்றியும் தரும் நட்சத்திரம்',
    hi: 'विशाखा - लक्ष्य सिद्धि एवं विजय प्रदायक नक्षत्र'
  },
  'Anuradha': {
    en: 'Anuradha - sacred star of lifelong friendship, weddings, business and travel',
    ta: 'அனுஷம் - மாறாத நட்பும் விசுவாசமும் நல்கும் உன்னத திருமண சுப நட்சத்திரம்',
    hi: 'अनुराधा - मित्रता, निष्ठा, विवाह एवं शुभ यात्राओं हेतु कल्याणकारी'
  },
  'Jyeshtha': {
    en: 'Jyeshtha - star of leadership, courage and executive strength',
    ta: 'கேட்டை - தலைமைத்துவமும் தைரியமும் தரும் நட்சத்திரம்',
    hi: 'ज्येष्ठा - नेतृत्व एवं साहसिक कार्यों का नक्षत्र'
  },
  'Moola': {
    en: 'Moola - rooted star of profound research, medicine and spiritual depth',
    ta: 'மூலம் - ஆன்மீகம், மருத்துவம் மற்றும் ஆழமான ஆராய்ச்சிக்கு ஏற்ற நட்சத்திரம்',
    hi: 'मूल - आध्यात्मिक गहराई एवं अनुसंधान का नक्षत्र'
  },
  'Purva Ashadha': {
    en: 'Purva Ashadha - invincible star of confidence, fame and victory',
    ta: 'பூராடம் - தன்னம்பிக்கையும் வெற்றியும் நல்கும் சுப நட்சத்திரம்',
    hi: 'पूर्वाषाढ़ा - विजय, यश एवं आत्मविश्वास प्रदायक नक्षत्र'
  },
  'Uttarashada': {
    en: 'Uttarashada - peaceful star of permanent success, construction, housewarming and weddings',
    ta: 'உத்திராடம் - திருமணம், வீடு கட்டுதல் மற்றும் புதுமனைக்கு உகந்த உன்னத நட்சத்திரம்',
    hi: 'उत्तराषाढ़ा - स्थायी सफलता, गृह निर्माण, गृह प्रवेश व विवाह हेतु श्रेष्ठ'
  },
  'Shravana': {
    en: 'Shravana - auspicious star ideal for learning, acquiring knowledge, and harmonious beginnings',
    ta: 'திருவோணம் - வித்யா, கல்வி மற்றும் சுப காரியங்களுக்கான உன்னத நட்சத்திரம்',
    hi: 'श्रवण - विद्या, ज्ञानार्जन एवं शुभ कार्यों हेतु सर्वोत्तम नक्षत्र'
  },
  'Dhanishta': {
    en: 'Dhanishta - prosperous star of wealth, property, construction and vehicles',
    ta: 'அவிட்டம் - தன லாபம், பூமி பூஜை மற்றும் வாகன சேர்க்கைக்கு உகந்த நட்சத்திரம்',
    hi: 'धनिष्ठा - धन, अचल संपत्ति एवं भूमि पूजन हेतु शुभ'
  },
  'Shatabhisha': {
    en: 'Shatabhisha - healing star of 100 remedies, ideal for vehicles and medicine',
    ta: 'சதயம் - ஆரோக்கியம், மருத்துவம் மற்றும் வாகன சேர்க்கைக்கு ஏற்ற நட்சத்திரம்',
    hi: 'शतभिषा - आरोग्य, चिकित्सा एवं वाहन प्राप्ति हेतु उत्तम'
  },
  'Purva Bhadrapada': {
    en: 'Purva Bhadrapada - philosophical star of tapas and contemplation',
    ta: 'பூரட்டாதி - தத்துவ சிந்தனை மற்றும் ஆன்மீக சாதனைகளுக்கு உரிய நட்சத்திரம்',
    hi: 'पूर्वाभाद्रपद - तपस्या एवं गंभीर चिंतन का नक्षत्र'
  },
  'Uttara Bhadrapada': {
    en: 'Uttara Bhadrapada - benevolent star of wisdom, weddings and lasting domestic peace',
    ta: 'உத்திரட்டாதி - சாந்தமும் குடும்ப சுபிட்சமும் நல்கும் உன்னத திருமண சுப நட்சத்திரம்',
    hi: 'उत्तराभाद्रपद - ज्ञान, शांति, विवाह एवं गृह सुख हेतु श्रेष्ठ'
  },
  'Revati': {
    en: 'Revati - gentle, bountiful star of prosperity, weddings and auspicious beginnings',
    ta: 'ரேவதி - இனிமையான துவக்கங்களும் மங்கள யோகமும் தரும் சுப நட்சத்திரம்',
    hi: 'रेवती - अत्यंत मधुर, कल्याणकारी, विवाह एवं समृद्धि प्रदायक नक्षत्र'
  }
};

// Baby naming syllables by Nakshatra and Pada
const NAKSHATRA_PADA_SYLLABLES: Array<{
  padas: Array<{ pada: number; en: string; ta: string; hi: string }>;
  summaryEn: string;
  summaryTa: string;
  summaryHi: string;
}> = [
  { padas: [{ pada: 1, en: 'Chu', ta: 'சு', hi: 'चु' }, { pada: 2, en: 'Che', ta: 'சே', hi: 'चे' }, { pada: 3, en: 'Cho', ta: 'சோ', hi: 'चो' }, { pada: 4, en: 'La', ta: 'லா', hi: 'ला' }], summaryEn: 'Chu, Che, Cho, La', summaryTa: 'சு, சே, சோ, லா', summaryHi: 'चु, चे, चो, ला' }, // Ashwini
  { padas: [{ pada: 1, en: 'Lee', ta: 'லீ', hi: 'ली' }, { pada: 2, en: 'Lu', ta: 'லூ', hi: 'लू' }, { pada: 3, en: 'Ley', ta: 'லே', hi: 'ले' }, { pada: 4, en: 'Lo', ta: 'லோ', hi: 'लो' }], summaryEn: 'Lee, Lu, Ley, Lo', summaryTa: 'லீ, லூ, லே, லோ', summaryHi: 'ली, लू, ले, लो' }, // Bharani
  { padas: [{ pada: 1, en: 'Aa', ta: 'அ', hi: 'अ' }, { pada: 2, en: 'Ee', ta: 'ஈ', hi: 'ई' }, { pada: 3, en: 'Oo', ta: 'உ', hi: 'उ' }, { pada: 4, en: 'Ey', ta: 'ஏ', hi: 'ए' }], summaryEn: 'Aa, Ee, Oo, Ey', summaryTa: 'அ, ஈ, உ, ஏ', summaryHi: 'अ, ई, उ, ए' }, // Krittika
  { padas: [{ pada: 1, en: 'O', ta: 'ஒ', hi: 'ओ' }, { pada: 2, en: 'Va', ta: 'வா', hi: 'वा' }, { pada: 3, en: 'Vi', ta: 'வி', hi: 'वि' }, { pada: 4, en: 'Vu', ta: 'வு', hi: 'वु' }], summaryEn: 'O, Va, Vi, Vu', summaryTa: 'ஒ, வா, வி, வு', summaryHi: 'ओ, वा, वि, वु' }, // Rohini
  { padas: [{ pada: 1, en: 'Ve', ta: 'வே', hi: 'वे' }, { pada: 2, en: 'Vo', ta: 'வோ', hi: 'वो' }, { pada: 3, en: 'Ka', ta: 'கா', hi: 'का' }, { pada: 4, en: 'Kee', ta: 'கீ', hi: 'की' }], summaryEn: 'Ve, Vo, Ka, Kee', summaryTa: 'வே, வோ, கா, கீ', summaryHi: 'वे, वो, का, की' }, // Mrigashira
  { padas: [{ pada: 1, en: 'Ku', ta: 'கு', hi: 'कु' }, { pada: 2, en: 'Gha', ta: 'க', hi: 'घ' }, { pada: 3, en: 'Ng', ta: 'ஞ', hi: 'ङ' }, { pada: 4, en: 'Chha', ta: 'சா', hi: 'छ' }], summaryEn: 'Ku, Gha, Nga, Chha', summaryTa: 'கு, க, ஞ, சா', summaryHi: 'कु, घ, ङ, छ' }, // Arudra
  { padas: [{ pada: 1, en: 'Key', ta: 'கே', hi: 'के' }, { pada: 2, en: 'Ko', ta: 'கோ', hi: 'को' }, { pada: 3, en: 'Haa', ta: 'ஹா', hi: 'हा' }, { pada: 4, en: 'Hee', ta: 'ஹீ', hi: 'ही' }], summaryEn: 'Key, Ko, Haa, Hee', summaryTa: 'கே, கோ, ஹா, ஹீ', summaryHi: 'के, को, हा, ही' }, // Punarvasu
  { padas: [{ pada: 1, en: 'Hu', ta: 'ஹு', hi: 'हु' }, { pada: 2, en: 'Hey', ta: 'ஹே', hi: 'हे' }, { pada: 3, en: 'Ho', ta: 'ஹோ', hi: 'हो' }, { pada: 4, en: 'Daa', ta: 'டா', hi: 'डा' }], summaryEn: 'Hu, Hey, Ho, Daa', summaryTa: 'ஹு, ஹே, ஹோ, டா', summaryHi: 'हु, हे, हो, डा' }, // Pushya
  { padas: [{ pada: 1, en: 'Dee', ta: 'டீ', hi: 'डी' }, { pada: 2, en: 'Du', ta: 'டூ', hi: 'डू' }, { pada: 3, en: 'Dey', ta: 'டே', hi: 'डे' }, { pada: 4, en: 'Do', ta: 'டோ', hi: 'डो' }], summaryEn: 'Dee, Du, Dey, Do', summaryTa: 'டீ, டூ, டே, டோ', summaryHi: 'डी, डू, डे, डो' }, // Ashlesha
  { padas: [{ pada: 1, en: 'Maa', ta: 'மா', hi: 'मा' }, { pada: 2, en: 'Mee', ta: 'மீ', hi: 'मी' }, { pada: 3, en: 'Moo', ta: 'மூ', hi: 'मू' }, { pada: 4, en: 'Mey', ta: 'மே', hi: 'मे' }], summaryEn: 'Maa, Mee, Moo, Mey', summaryTa: 'மா, மீ, மூ, மே', summaryHi: 'मा, मी, मू, मे' }, // Magha
  { padas: [{ pada: 1, en: 'Moo', ta: 'மோ', hi: 'मो' }, { pada: 2, en: 'Taa', ta: 'டா', hi: 'टा' }, { pada: 3, en: 'Tee', ta: 'டீ', hi: 'टी' }, { pada: 4, en: 'Too', ta: 'டூ', hi: 'टू' }], summaryEn: 'Mo, Taa, Tee, Too', summaryTa: 'மோ, டா, டீ, டூ', summaryHi: 'मो, टा, टी, टू' }, // Purva Phalguni
  { padas: [{ pada: 1, en: 'Tey', ta: 'டே', hi: 'टे' }, { pada: 2, en: 'To', ta: 'டோ', hi: 'टो' }, { pada: 3, en: 'Paa', ta: 'பா', hi: 'पा' }, { pada: 4, en: 'Pee', ta: 'பீ', hi: 'पी' }], summaryEn: 'Tey, To, Paa, Pee', summaryTa: 'டே, டோ, பா, பீ', summaryHi: 'टे, टो, पा, पी' }, // Uttara Phalguni
  { padas: [{ pada: 1, en: 'Poo', ta: 'பூ', hi: 'पू' }, { pada: 2, en: 'Sha', ta: 'ஷ', hi: 'ष' }, { pada: 3, en: 'Na', ta: 'ண', hi: 'ण' }, { pada: 4, en: 'Tha', ta: 'டா', hi: 'ठ' }], summaryEn: 'Poo, Sha, Na, Tha', summaryTa: 'பூ, ஷ, ண, டா', summaryHi: 'पू, ष, ण, ठ' }, // Hasta
  { padas: [{ pada: 1, en: 'Pey', ta: 'பே', hi: 'पे' }, { pada: 2, en: 'Po', ta: 'போ', hi: 'पो' }, { pada: 3, en: 'Raa', ta: 'ரா', hi: 'रा' }, { pada: 4, en: 'Ree', ta: 'ரீ', hi: 'री' }], summaryEn: 'Pey, Po, Raa, Ree', summaryTa: 'பே, போ, ரா, ரீ', summaryHi: 'पे, पो, रा, री' }, // Chitra
  { padas: [{ pada: 1, en: 'Roo', ta: 'ரூ', hi: 'रू' }, { pada: 2, en: 'Rey', ta: 'ரே', hi: 'रे' }, { pada: 3, en: 'Ro', ta: 'ரோ', hi: 'रो' }, { pada: 4, en: 'Thaa', ta: 'தா', hi: 'ता' }], summaryEn: 'Roo, Rey, Ro, Thaa', summaryTa: 'ரூ, ரே, ரோ, தா', summaryHi: 'रू, रे, रो, ता' }, // Swati
  { padas: [{ pada: 1, en: 'Thee', ta: 'தீ', hi: 'ती' }, { pada: 2, en: 'Thu', ta: 'தூ', hi: 'तू' }, { pada: 3, en: 'They', ta: 'தே', hi: 'ते' }, { pada: 4, en: 'Tho', ta: 'தோ', hi: 'तो' }], summaryEn: 'Thee, Thu, They, Tho', summaryTa: 'தீ, தூ, தே, தோ', summaryHi: 'ती, तू, ते, तो' }, // Vishakha
  { padas: [{ pada: 1, en: 'Naa', ta: 'நா', hi: 'ना' }, { pada: 2, en: 'Nee', ta: 'நீ', hi: 'नी' }, { pada: 3, en: 'Noo', ta: 'நூ', hi: 'नू' }, { pada: 4, en: 'Ney', ta: 'நே', hi: 'ने' }], summaryEn: 'Naa, Nee, Noo, Ney', summaryTa: 'நா, நீ, நூ, நே', summaryHi: 'ना, नी, नू, ने' }, // Anuradha
  { padas: [{ pada: 1, en: 'No', ta: 'நோ', hi: 'नो' }, { pada: 2, en: 'Yaa', ta: 'யா', hi: 'या' }, { pada: 3, en: 'Yee', ta: 'யீ', hi: 'यी' }, { pada: 4, en: 'Yoo', ta: 'யூ', hi: 'यू' }], summaryEn: 'No, Yaa, Yee, Yoo', summaryTa: 'நோ, யா, யீ, யூ', summaryHi: 'नो, या, यी, यू' }, // Jyeshtha
  { padas: [{ pada: 1, en: 'Yey', ta: 'யே', hi: 'ये' }, { pada: 2, en: 'Yo', ta: 'யோ', hi: 'यो' }, { pada: 3, en: 'Bhaa', ta: 'பா', hi: 'भा' }, { pada: 4, en: 'Bhee', ta: 'பீ', hi: 'भी' }], summaryEn: 'Yey, Yo, Bhaa, Bhee', summaryTa: 'யே, யோ, பா, பீ', summaryHi: 'ये, यो, भा, भी' }, // Moola
  { padas: [{ pada: 1, en: 'Bhoo', ta: 'பூ', hi: 'भू' }, { pada: 2, en: 'Dhaa', ta: 'தா', hi: 'धा' }, { pada: 3, en: 'Phaa', ta: 'பா', hi: 'फा' }, { pada: 4, en: 'Dha', ta: 'டா', hi: 'ढा' }], summaryEn: 'Bhoo, Dhaa, Phaa, Dha', summaryTa: 'பூ, தா, பா, டா', summaryHi: 'भू, धा, फा, ढा' }, // Purva Ashadha
  { padas: [{ pada: 1, en: 'Bhey', ta: 'பே', hi: 'भे' }, { pada: 2, en: 'Bho', ta: 'போ', hi: 'भो' }, { pada: 3, en: 'Jaa', ta: 'ஜா', hi: 'जा' }, { pada: 4, en: 'Jee', ta: 'ஜீ', hi: 'जी' }], summaryEn: 'Bhey, Bho, Jaa, Jee', summaryTa: 'பே, போ, ஜா, ஜீ', summaryHi: 'भे, भो, जा, जी' }, // Uttara Ashadha
  { padas: [{ pada: 1, en: 'Khee', ta: 'கீ', hi: 'खी' }, { pada: 2, en: 'Khoo', ta: 'கூ', hi: 'खू' }, { pada: 3, en: 'Khey', ta: 'கே', hi: 'खे' }, { pada: 4, en: 'Kho', ta: 'கோ', hi: 'खो' }], summaryEn: 'Khee, Khoo, Khey, Kho', summaryTa: 'கீ, கூ, கே, கோ', summaryHi: 'खी, खू, खे, खो' }, // Shravana
  { padas: [{ pada: 1, en: 'Gaa', ta: 'கா', hi: 'गा' }, { pada: 2, en: 'Gee', ta: 'கீ', hi: 'गी' }, { pada: 3, en: 'Goo', ta: 'கூ', hi: 'गू' }, { pada: 4, en: 'Gey', ta: 'கே', hi: 'गे' }], summaryEn: 'Gaa, Gee, Goo, Gey', summaryTa: 'கா, கீ, கூ, கே', summaryHi: 'गा, गी, गू, गे' }, // Dhanishta
  { padas: [{ pada: 1, en: 'Go', ta: 'கோ', hi: 'गो' }, { pada: 2, en: 'Saa', ta: 'சா', hi: 'सा' }, { pada: 3, en: 'See', ta: 'சீ', hi: 'सी' }, { pada: 4, en: 'Soo', ta: 'சூ', hi: 'सू' }], summaryEn: 'Go, Saa, See, Soo', summaryTa: 'கோ, சா, சீ, சூ', summaryHi: 'गो, सा, सी, सू' }, // Shatabhisha
  { padas: [{ pada: 1, en: 'Sey', ta: 'சே', hi: 'से' }, { pada: 2, en: 'So', ta: 'சோ', hi: 'सो' }, { pada: 3, en: 'Daa', ta: 'தா', hi: 'दा' }, { pada: 4, en: 'Dee', ta: 'தீ', hi: 'दी' }], summaryEn: 'Sey, So, Daa, Dee', summaryTa: 'சே, சோ, தா, தீ', summaryHi: 'से, सो, दा, दी' }, // Purva Bhadrapada
  { padas: [{ pada: 1, en: 'Doo', ta: 'தூ', hi: 'दू' }, { pada: 2, en: 'Thaa', ta: 'தா', hi: 'था' }, { pada: 3, en: 'Jha', ta: 'ஜா', hi: 'झ' }, { pada: 4, en: 'Dha', ta: 'ஞா', hi: 'ञ' }], summaryEn: 'Doo, Thaa, Jha, Dha', summaryTa: 'தூ, தா, ஜா, ஞா', summaryHi: 'दू, था, झ, ञ' }, // Uttara Bhadrapada
  { padas: [{ pada: 1, en: 'Dey', ta: 'தே', hi: 'दे' }, { pada: 2, en: 'Do', ta: 'தோ', hi: 'दो' }, { pada: 3, en: 'Chaa', ta: 'சா', hi: 'चा' }, { pada: 4, en: 'Chee', ta: 'சீ', hi: 'ची' }], summaryEn: 'Dey, Do, Chaa, Chee', summaryTa: 'தே, தோ, சா, சீ', summaryHi: 'दे, दो, चा, ची' } // Revati
];

function normalizeDeg(deg: number): number {
  let d = deg % 360.0;
  if (d < 0) d += 360.0;
  return d;
}

// -----------------------------------------------------------------------------
// ADHIK MASA & PITRU PAKSHA DETECTION
// Computed from real new-moon and solar-ingress (sankranti) positions rather
// than from hard-coded calendar tables, so they stay correct for any year.
// -----------------------------------------------------------------------------

/** Sidereal (Lahiri) longitude of the Sun at a given instant. */
function sunSiderealAt(date: Date): number {
  const time = new Astronomy.AstroTime(date);
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const sunEcl = Astronomy.Ecliptic(sunGeo);
  return normalizeDeg(sunEcl.elon - ayanamsa);
}

/** New moon (Sun–Moon elongation = 0) at or after `date`. */
function newMoonAtOrAfter(date: Date): Date {
  const found = Astronomy.SearchMoonPhase(0, new Astronomy.AstroTime(date), 45);
  if (found) return found.date;
  return new Date(date.getTime() + 29.53 * 86400000);
}

/**
 * Next new moon strictly after an instant that is itself a new moon.
 * The 6-hour nudge guarantees we advance to the following month instead of
 * returning the same conjunction again.
 */
function nextNewMoonAfter(newMoonInstant: Date): Date {
  const from = new Date(newMoonInstant.getTime() + 6 * 3600000);
  const found = Astronomy.SearchMoonPhase(0, new Astronomy.AstroTime(from), 45);
  if (found) return found.date;
  return new Date(newMoonInstant.getTime() + 29.53 * 86400000);
}

/**
 * Most recent new moon at or before `date`, which opens the lunar month
 * containing it. Search backwards from the instant itself: searching forward
 * from an arbitrary point 31 days earlier can hit the previous lunation when
 * `date` is within roughly the first day after a conjunction.
 */
function previousNewMoon(date: Date): Date {
  const found = Astronomy.SearchMoonPhase(0, new Astronomy.AstroTime(date), -40);
  if (!found) {
    throw new Error('Unable to find the preceding new moon within 40 days.');
  }
  return found.date;
}

/** Full moon (Sun–Moon elongation = 180) at or after `date`. */
function fullMoonAtOrAfter(date: Date): Date {
  const found = Astronomy.SearchMoonPhase(180, new Astronomy.AstroTime(date), 25);
  if (found) return found.date;
  return new Date(date.getTime() + 14.77 * 86400000);
}

function getEventTithiConfig(eventKey: MuhurthamEventKey): any {
  return (rulesData.events as any)[eventKey] || rulesData.events.wedding;
}

/** Event-specific Tithi vetoes are stored as zero-based indices from 0 to 29. */
export function isEventTithiAvoided(eventKey: MuhurthamEventKey, tithiIndex: number): boolean {
  const eventConfig = getEventTithiConfig(eventKey);
  return eventConfig.avoidTithiIndexes?.includes(tithiIndex) ?? false;
}

/**
 * Tithi allowlists use the same zero-based 0–29 lunation index as the scanner.
 * Rikta tithis and Amavasya remain globally disallowed, independent of event.
 */
export function isGoodTithiForEvent(eventKey: MuhurthamEventKey, tithiIndex: number): boolean {
  if (!Number.isInteger(tithiIndex) || tithiIndex < 0 || tithiIndex > 29) return false;

  const eventConfig = getEventTithiConfig(eventKey);
  const tithiNumberInPaksha = (tithiIndex % 15) + 1;
  const isListedAsGood =
    eventConfig.goodTithiIndexes?.includes(tithiIndex) ||
    (tithiIndex < 15 && eventConfig.preferShuklaTithiIndexes?.includes(tithiIndex));

  return Boolean(
    isListedAsGood &&
    ![4, 9, 14].includes(tithiNumberInPaksha) &&
    tithiIndex !== 29 &&
    !isEventTithiAvoided(eventKey, tithiIndex)
  );
}

const ADHIKA_MASA_CACHE = new Map<string, boolean>();

/**
 * Adhika Masa (intercalary "extra" lunar month): a lunar month that contains
 * NO solar ingress — the Sun stays inside the same sidereal rasi from the
 * opening new moon to the closing new moon. Avoided for all auspicious work.
 */
export function isAdhikaMasa(dateObj: Date): boolean {
  const prev = previousNewMoon(dateObj);
  const cacheKey = prev.toISOString().slice(0, 10);
  const cached = ADHIKA_MASA_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const next = nextNewMoonAfter(prev);
  const rasiAtStart = Math.floor(sunSiderealAt(new Date(prev.getTime() + 3600000)) / 30);
  const rasiAtEnd = Math.floor(sunSiderealAt(new Date(next.getTime() - 3600000)) / 30);

  const result = rasiAtStart === rasiAtEnd;
  ADHIKA_MASA_CACHE.set(cacheKey, result);
  return result;
}

const PITRU_PAKSHA_CACHE = new Map<number, { start: number; end: number } | null>();

/**
 * Pitru Paksha (Mahalaya fortnight): Bhadrapada Krishna Paksha in the amanta
 * scheme — from the full moon of the lunar month in which the Sun reaches
 * Kanya (Virgo) up to the following new moon (Mahalaya Amavasya).
 */
function getPitruPakshaWindow(year: number): { start: number; end: number } | null {
  const cached = PITRU_PAKSHA_CACHE.get(year);
  if (cached !== undefined) return cached;

  let window: { start: number; end: number } | null = null;
  try {
    let cursor = new Date(Date.UTC(year, 0, 1));
    const hardStop = new Date(Date.UTC(year + 1, 2, 1));
    let amavasya: Date | null = null;

    // First new moon whose sidereal Sun sits in Kanya (rasi index 5).
    while (cursor < hardStop) {
      const nm = newMoonAtOrAfter(cursor);
      if (Math.floor(sunSiderealAt(nm) / 30) === 5) {
        amavasya = nm;
        break;
      }
      cursor = nextNewMoonAfter(nm);
    }

    if (amavasya) {
      // Preceding full moon (~14.8 days earlier) opens the fortnight.
      const fullMoon = fullMoonAtOrAfter(new Date(amavasya.getTime() - 20 * 86400000));
      const start = fullMoon < amavasya ? fullMoon : new Date(amavasya.getTime() - 15 * 86400000);
      window = { start: start.getTime(), end: amavasya.getTime() };
    }
  } catch (e) {
    window = null;
  }

  PITRU_PAKSHA_CACHE.set(year, window);
  return window;
}

export function isPitruPaksha(dateObj: Date): boolean {
  const t = dateObj.getTime();
  for (const y of [dateObj.getFullYear(), dateObj.getFullYear() - 1]) {
    const w = getPitruPakshaWindow(y);
    if (w && t >= w.start && t <= w.end) return true;
  }
  return false;
}

/** Panchaka: the five nakshatras Dhanishta -> Revati (indices 22..26). */
export function isPanchakaNakshatra(nakshatraIndex: number): boolean {
  return nakshatraIndex >= 22;
}

function formatMinutesToTime(totalMinutes: number): string {
  let m = Math.round(totalMinutes) % 1440;
  if (m < 0) m += 1440;
  const hours = Math.floor(m / 60);
  const mins = Math.floor(m % 60);
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function calculatePanchangamStateAt(utcDate: Date): { tithiIndex: number; tithiNumberInPaksha: number; karanaIndex: number; yogaIndex: number; yogaNameEn: string } {
  const time = new Astronomy.AstroTime(utcDate);
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const sunEcl = Astronomy.Ecliptic(sunGeo);
  const sunTrop = normalizeDeg(sunEcl.elon);
  const sunSid = normalizeDeg(sunTrop - ayanamsa);
  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
  const moonEcl = Astronomy.Ecliptic(moonGeo);
  const moonTrop = normalizeDeg(moonEcl.elon);
  const moonSid = normalizeDeg(moonTrop - ayanamsa);
  const diffDeg = normalizeDeg(moonTrop - sunTrop);
  const tithiIndex = Math.floor(diffDeg / 12.0) % 30;
  const tithiNumberInPaksha = (tithiIndex % 15) + 1;
  const karanaIndexRaw = Math.floor(diffDeg / 6.0) % 60;
  let karanaIndex = 0;
  if (karanaIndexRaw === 0) karanaIndex = 10;
  else if (karanaIndexRaw >= 57) karanaIndex = karanaIndexRaw - 50;
  else karanaIndex = (karanaIndexRaw - 1) % 7;
  const nakSpan = 360.0 / 27.0;
  const yogaSum = (sunSid + moonSid) % 360;
  const yogaIndex = Math.floor(yogaSum / nakSpan) % 27;
  const yogaNameEn = (YOGA_NAMES[yogaIndex] || YOGA_NAMES[0]).en;
  return { tithiIndex, tithiNumberInPaksha, karanaIndex, yogaIndex, yogaNameEn };
}

function utcForLocalMinutes(dateStr: string, localMinutes: number, location: LocationInput, timeZoneId: string | null): Date {
  const hours = Math.floor(localMinutes / 60);
  const mins = Math.round(localMinutes % 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  const resolved = timeZoneId ? resolveLocalDateTimeInTimeZone(dateStr, clock, timeZoneId) : null;
  if (resolved) return resolved.utcDate;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hours, mins, 0) - location.timezoneOffsetHours * 3600000);
}

function isPanchangamVetoAt(utcDate: Date, eventKey: MuhurthamEventKey): boolean {
  const state = calculatePanchangamStateAt(utcDate);
  const eventConfig = (rulesData.events as any)[eventKey] || (rulesData.events as any).wedding;
  if (state.tithiIndex === 29) return true;
  if ([4, 9, 14].includes(state.tithiNumberInPaksha)) return true;
  if (state.karanaIndex === 6) return true;
  const globalAvoidYogas = ['Vishkambha', 'Vyatipata', 'Parigha', 'Vaidhriti', 'Atiganda', 'Shoola', 'Ganda', 'Vyaghata', 'Vajra'];
  if (globalAvoidYogas.includes(state.yogaNameEn) || eventConfig.avoidYogas?.includes(state.yogaNameEn)) return true;
  if (isEventTithiAvoided(eventKey, state.tithiIndex)) return true;
  return false;
}

/**
 * Calculates Moon's sidereal longitude, nakshatra index (0-26), pada (1-4), and Rasi for a given Date and UTC offset.
 */
export function calculateMoonPositionAt(
  utcDate: Date
): {
  moonSid: number;
  nakshatraIndex: number;
  pada: number;
  rasiNumber: number;
  degInNak: number;
} {
  const time = new Astronomy.AstroTime(utcDate);
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);

  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
  const moonEcl = Astronomy.Ecliptic(moonGeo);
  const moonTrop = normalizeDeg(moonEcl.elon);
  const moonSid = normalizeDeg(moonTrop - ayanamsa);

  const nakSpan = 360.0 / 27.0;
  const nakshatraIndex = Math.floor(moonSid / nakSpan) % 27;
  const degInNak = moonSid - nakshatraIndex * nakSpan;
  const pada = Math.min(4, Math.max(1, Math.floor(degInNak / (nakSpan / 4.0)) + 1));
  const rasiNumber = Math.floor(moonSid / 30.0) + 1;

  return {
    moonSid,
    nakshatraIndex,
    pada,
    rasiNumber,
    degInNak
  };
}

/**
 * Finds user's personal Janma Nakshatra and Moon sign from Birth Date, Time & Place.
 * If time is unknown, computes at 12:00 PM and checks if Moon transits into a new star during the day.
 */
export function findNakshatraFromBirthDetails(
  birthDateStr: string, // YYYY-MM-DD
  birthTimeStr?: string, // HH:mm
  isTimeUnknown?: boolean,
  timezoneOffsetHours: number = 5.5,
  latitude?: number,
  longitude?: number
): FoundNakshatraResult | null {
  if (!birthDateStr) return null;

  try {
    const [year, month, day] = birthDateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    let hour = 12;
    let minute = 0;

    if (!isTimeUnknown && birthTimeStr) {
      const parts = birthTimeStr.split(':').map(Number);
      if (!isNaN(parts[0])) hour = parts[0];
      if (!isNaN(parts[1])) minute = parts[1];
    }

    const timeZoneId = latitude !== undefined && longitude !== undefined
      ? getTimeZoneIdForCoordinates(latitude, longitude)
      : null;
    const resolveBirthClock = (localHour: number, localMinute: number): Date => {
      const localClock = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
      const zoned = timeZoneId
        ? resolveLocalDateTimeInTimeZone(birthDateStr, localClock, timeZoneId)
        : null;
      if (zoned) return zoned.utcDate;
      return new Date(
        Date.UTC(year, month - 1, day, localHour, localMinute, 0) - timezoneOffsetHours * 3600000
      );
    };

    // Midday or specified local birth time, resolved with historical DST rules.
    const targetUtc = resolveBirthClock(hour, minute);
    const calc = calculateMoonPositionAt(targetUtc);
    const nakObj = rulesData.nakshatras[calc.nakshatraIndex];
    const rasiObj = RASI_METADATA.find(r => r.number === calc.rasiNumber) || RASI_METADATA[0];

    // Lagna (rising sign) at the same birth instant, from the same true
    // ayanamsa the charts use. Only meaningful with real coordinates.
    let lagna: FoundLagna | undefined;
    if (latitude !== undefined && longitude !== undefined && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const astroTime = new Astronomy.AstroTime(targetUtc);
      const jd = astroTime.ut + 2451545.0;
      const ayanamsa = calculateLahiriAyanamsa(jd);
      const { lagnaSidereal } = calculateSiderealAscendant(astroTime, latitude, longitude, ayanamsa);
      const lagnaRasiNumber = Math.floor(lagnaSidereal / 30.0) + 1;
      const lagnaRasiObj = RASI_METADATA.find(r => r.number === lagnaRasiNumber) || RASI_METADATA[0];
      lagna = {
        rasiNumber: lagnaRasiNumber,
        nameEn: lagnaRasiObj.nameEn,
        nameTa: lagnaRasiObj.nameTa,
        nameHi: lagnaRasiObj.nameHi,
        siderealDeg: lagnaSidereal
      };
    }

    const primaryResult = {
      nakshatraIndex: calc.nakshatraIndex,
      nakshatraNameEn: nakObj.nameEn,
      nakshatraNameTa: nakObj.nameTa,
      nakshatraNameHi: nakObj.nameHi,
      pada: calc.pada,
      rasiNumber: calc.rasiNumber,
      rasiNameEn: rasiObj.nameEn,
      rasiNameTa: rasiObj.nameTa,
      rasiNameHi: rasiObj.nameHi,
      degInNak: calc.degInNak,
      ...(lagna ? { lagna } : {})
    };

    // If time is unknown, check whether star changed between 00:01 and 23:59
    if (isTimeUnknown) {
      const startOfDayUtc = resolveBirthClock(0, 1);
      const endOfDayUtc = resolveBirthClock(23, 59);

      const startCalc = calculateMoonPositionAt(startOfDayUtc);
      const endCalc = calculateMoonPositionAt(endOfDayUtc);

      if (startCalc.nakshatraIndex !== endCalc.nakshatraIndex) {
        const star1 = rulesData.nakshatras[startCalc.nakshatraIndex];
        const star2 = rulesData.nakshatras[endCalc.nakshatraIndex];
        const rasi2 = RASI_METADATA.find(r => r.number === endCalc.rasiNumber) || RASI_METADATA[0];

        return {
          isAmbiguous: true,
          primary: {
            nakshatraIndex: startCalc.nakshatraIndex,
            nakshatraNameEn: star1.nameEn,
            nakshatraNameTa: star1.nameTa,
            nakshatraNameHi: star1.nameHi,
            pada: startCalc.pada,
            rasiNumber: startCalc.rasiNumber,
            rasiNameEn: rasiObj.nameEn,
            rasiNameTa: rasiObj.nameTa,
            rasiNameHi: rasiObj.nameHi,
            degInNak: startCalc.degInNak
          },
          secondary: {
            nakshatraIndex: endCalc.nakshatraIndex,
            nakshatraNameEn: star2.nameEn,
            nakshatraNameTa: star2.nameTa,
            nakshatraNameHi: star2.nameHi,
            pada: endCalc.pada,
            rasiNumber: endCalc.rasiNumber,
            rasiNameEn: rasi2.nameEn,
            rasiNameTa: rasi2.nameTa,
            rasiNameHi: rasi2.nameHi
          },
          noteEn: `Moon transitioned from ${star1.nameEn} to ${star2.nameEn} on this day. The exact star depends on the birth time.`,
          noteTa: `சந்திரன் அன்றைய நாளில் ${star1.nameTa} நட்சத்திரத்திலிருந்து ${star2.nameTa} நட்சத்திரத்திற்கு மாறுகிறது. சரியான நட்சத்திரம் பிறந்த நேரத்தைப் பொறுத்தது.`,
          noteHi: `चंद्रमा इस दिन ${star1.nameHi} से ${star2.nameHi} में प्रवेश करता है। सटीक नक्षत्र जन्म समय पर निर्भर करता है।`
        };
      }
    }

    return {
      isAmbiguous: false,
      primary: primaryResult
    };
  } catch (e) {
    return null;
  }
}

/**
 * Tamil spellings accepted from older payloads. The report data now uses the
 * Tamil panchangam spelling (மிருகசீரிடம்), but an order saved before the rename
 * must still resolve to the same star.
 */
const NAKSHATRA_TA_ALIASES: Record<string, string> = {
  'மிருகசீரிஷம்': 'மிருகசீரிடம்'
};

/** Resolves an English / Tamil / Hindi Nakshatra name to its index (legacy option strings). */
export function findNakshatraIndexByName(name: string): number | null {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const canonical = NAKSHATRA_TA_ALIASES[raw] || raw;
  const lowered = canonical.toLowerCase();
  const index = rulesData.nakshatras.findIndex(
    n => (n.nameEn || '').toLowerCase() === lowered || n.nameTa === canonical || n.nameHi === canonical
  );
  return index >= 0 ? index : null;
}

/**
 * Builds the report-facing record for one person: their Janma Nakshatra, Rasi
 * and Lagna from their OWN birth details. Used for the bride and the groom of a
 * wedding order (and for the single person of every other ceremony) so the
 * browser, the TypeScript engine and the order payload always carry the same values.
 */
export function describePersonForMuhurtham(
  role: PersonRole,
  name: string,
  birth: {
    dob: string;
    tob: string;
    birthPlace: string;
    timezoneOffsetHours: number;
    latitude?: number;
    longitude?: number;
  }
): MuhurthamPersonDetails | null {
  const star = findNakshatraFromBirthDetails(
    birth.dob,
    birth.tob,
    false,
    birth.timezoneOffsetHours,
    birth.latitude,
    birth.longitude
  );
  if (!star) return null;
  return {
    role,
    name: name || ROLE_LABELS[role].en,
    dob: birth.dob,
    tob: birth.tob,
    birthPlace: birth.birthPlace || '',
    nakshatraIndex: star.primary.nakshatraIndex,
    nakshatraNameEn: star.primary.nakshatraNameEn,
    nakshatraNameTa: star.primary.nakshatraNameTa,
    nakshatraNameHi: star.primary.nakshatraNameHi,
    rasiNumber: star.primary.rasiNumber,
    rasiNameEn: star.primary.rasiNameEn,
    rasiNameTa: star.primary.rasiNameTa,
    rasiNameHi: star.primary.rasiNameHi,
    lagnaRasiNumber: star.primary.lagna?.rasiNumber ?? 0,
    lagnaNameEn: star.primary.lagna?.nameEn ?? '',
    lagnaNameTa: star.primary.lagna?.nameTa ?? '',
    lagnaNameHi: star.primary.lagna?.nameHi ?? ''
  };
}

/** Nakshatra names for an index (0-26), or null when the index is out of range. */
export function nakshatraMetaByIndex(index: number): {
  nameEn: string; nameTa: string; nameHi: string;
} | null {
  const meta = rulesData.nakshatras[index];
  return meta ? { nameEn: meta.nameEn, nameTa: meta.nameTa, nameHi: meta.nameHi } : null;
}

/** Rasi names for a rasi number (1-12), or null when the number is out of range. */
export function rasiMetaByNumber(number: number): {
  nameEn: string; nameTa: string; nameHi: string;
} | null {
  const meta = RASI_METADATA.find(r => r.number === number);
  return meta ? { nameEn: meta.nameEn, nameTa: meta.nameTa, nameHi: meta.nameHi } : null;
}

/** Localized role label that also understands the legacy 'You' role. */
export function muhurthamRoleLabel(role: string, lang: 'en' | 'ta' | 'hi'): string {
  const key = (role === 'bride' || role === 'groom' || role === 'child' || role === 'mother' || role === 'self')
    ? role
    : 'self';
  return ROLE_LABELS[key][lang];
}

/**
 * Calculates Tara Balam (Navatara strength) and Chandrashtama (Moon in 8th house) for an individual.
 */
export function calculateTaraBalamAndChandrashtama(
  personNakshatraIndex: number,
  personRasiNumber: number,
  dayNakshatraIndex: number,
  dayMoonRasiNumber: number,
  role: PersonRole = 'self'
): PersonalAstroCheck {
  const nakObj = rulesData.nakshatras[personNakshatraIndex];

  // 1. Tara Balam Calculation:
  // Count from Janma Nakshatra (person) to Muhurtham Nakshatra (day)
  const distance = ((dayNakshatraIndex - personNakshatraIndex + 27) % 27) + 1;
  const taraNumber = ((distance - 1) % 9) + 1; // 1 to 9
  const taraMeta = NAVATARA_TABLE.find(t => t.num === taraNumber) || NAVATARA_TABLE[0];

  // 2. Chandrashtama Check:
  // If current day Moon Rasi is the 8th rasi from Janma Rasi
  const rasiDiff = ((dayMoonRasiNumber - personRasiNumber + 12) % 12) + 1;
  const isChandrashtama = rasiDiff === 8;

  // 3. Janma Nakshatra Check:
  // The day's star IS this person's own birth star. Derived from the computed
  // indices — never from a hard-coded date list.
  const isJanmaNakshatra = dayNakshatraIndex === personNakshatraIndex;

  let summaryEn = `${taraMeta.en}`;
  let summaryTa = `${taraMeta.ta}`;
  let summaryHi = `${taraMeta.hi}`;

  if (isChandrashtama) {
    summaryEn += ' • Chandrashtama (Caution)';
    summaryTa += ' • சந்திராஷ்டமம் (எச்சரிக்கை)';
    summaryHi += ' • चंद्राष्टम (सतर्कता)';
  }
  if (isJanmaNakshatra) {
    summaryEn += ' • Janma Nakshatra day';
    summaryTa += ' • ஜன்ம நட்சத்திர நாள்';
    summaryHi += ' • जन्म नक्षत्र दिवस';
  }

  return {
    role,
    nakshatraIndex: personNakshatraIndex,
    nakshatraNameEn: nakObj.nameEn,
    nakshatraNameTa: nakObj.nameTa,
    nakshatraNameHi: nakObj.nameHi,
    taraNumber,
    taraNameEn: taraMeta.en,
    taraNameTa: taraMeta.ta,
    taraNameHi: taraMeta.hi,
    taraBadgeEn: isChandrashtama ? 'Chandrashtama' : isJanmaNakshatra ? 'Janma Nakshatra' : taraMeta.badgeEn,
    taraBadgeTa: isChandrashtama ? 'சந்திராஷ்டமம்' : isJanmaNakshatra ? 'ஜன்ம நட்சத்திரம்' : taraMeta.badgeTa,
    taraBadgeHi: isChandrashtama ? 'चंद्राष्टम' : isJanmaNakshatra ? 'जन्म नक्षत्र' : taraMeta.badgeHi,
    isTaraAuspicious: taraMeta.isGood && !isChandrashtama && !isJanmaNakshatra,
    isChandrashtama,
    isJanmaNakshatra,
    summaryEn,
    summaryTa,
    summaryHi
  };
}

/**
 * High-precision Panchangam & Muhurtham computation for a single calendar day at a specific location.
 */
export function computeDayMuhurtham(
  dateObj: Date,
  location: LocationInput,
  eventKey: MuhurthamEventKey,
  options?: {
    brideNakshatra?: string;
    groomNakshatra?: string;
    brideNakshatraIndex?: number;
    groomNakshatraIndex?: number;
    brideRasiNumber?: number;
    groomRasiNumber?: number;
    /** Generic personal-star cross-checks (child, mother, self, couple…) */
    persons?: PersonInput[];
    birthDate?: string;
  }
): DayMuhurthamResult {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const timeZoneId = location.timeZoneId ?? getTimeZoneIdForCoordinates(location.latitude, location.longitude);

  // Create observer at location
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  // Approximate 06:00 local time in UTC using the zone's offset on this date.
  const local6am = timeZoneId
    ? resolveLocalDateTimeInTimeZone(dateStr, '06:00', timeZoneId)
    : null;
  const local6amUtcMs = local6am?.utcDate.getTime() ??
    Date.UTC(year, month - 1, day, 6, 0, 0) - location.timezoneOffsetHours * 3600000;
  const approxTime = new Astronomy.AstroTime(new Date(local6amUtcMs));

  // Search exact sunrise and sunset for this date & place
  let sunriseMinutes = 6 * 60;
  let sunsetMinutes = 18 * 60;
  let sunriseAstroTime = approxTime;

  try {
    const sunriseSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, approxTime.AddDays(-0.5), 1.5);
    if (sunriseSearch) {
      sunriseAstroTime = sunriseSearch;
      const srDate = sunriseSearch.date;
      const sunriseOffset = timeZoneId
        ? getTimezoneOffsetAtInstant(timeZoneId, srDate) ?? location.timezoneOffsetHours
        : location.timezoneOffsetHours;
      const srLocalMs = srDate.getTime() + sunriseOffset * 3600000;
      const srLocalDate = new Date(srLocalMs);
      sunriseMinutes = srLocalDate.getUTCHours() * 60 + srLocalDate.getUTCMinutes();
    }
  } catch (e) {
    // Fallback standard 06:00
  }

  try {
    const sunsetSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, sunriseAstroTime, 1.0);
    if (sunsetSearch) {
      const ssDate = sunsetSearch.date;
      const sunsetOffset = timeZoneId
        ? getTimezoneOffsetAtInstant(timeZoneId, ssDate) ?? location.timezoneOffsetHours
        : location.timezoneOffsetHours;
      const ssLocalMs = ssDate.getTime() + sunsetOffset * 3600000;
      const ssLocalDate = new Date(ssLocalMs);
      sunsetMinutes = ssLocalDate.getUTCHours() * 60 + ssLocalDate.getUTCMinutes();
    }
  } catch (e) {
    // Fallback standard 18:00
  }

  if (sunsetMinutes <= sunriseMinutes) {
    sunsetMinutes = sunriseMinutes + 12 * 60;
  }

  const dayDuration = sunsetMinutes - sunriseMinutes;
  const partDuration = dayDuration / 8.0;

  // 1. Compute 8 parts for Rahu Kalam, Yamagandam, Gulikai Kalam based on weekday (1-indexed 1..8)
  // Rahu part: Sun 8, Mon 2, Tue 7, Wed 5, Thu 6, Fri 4, Sat 3
  const rahuPartIndices = [8, 2, 7, 5, 6, 4, 3];
  // Yamagandam part: Sun 5, Mon 4, Tue 3, Wed 2, Thu 1, Fri 7, Sat 6
  const yamaPartIndices = [5, 4, 3, 2, 1, 7, 6];
  // Gulikai part: Sun 7, Mon 6, Tue 5, Wed 4, Thu 3, Fri 2, Sat 1
  const guliPartIndices = [7, 6, 5, 4, 3, 2, 1];

  const getWindowForPart = (partIdx: number, labelEn: string, labelTa: string, labelHi: string): TimeWindow => {
    const startM = sunriseMinutes + (partIdx - 1) * partDuration;
    const endM = sunriseMinutes + partIdx * partDuration;
    return {
      start: formatMinutesToTime(startM),
      end: formatMinutesToTime(endM),
      startMinutes: startM,
      endMinutes: endM,
      labelEn,
      labelTa,
      labelHi
    };
  };

  const rahuPart = rahuPartIndices[dayOfWeek];
  const yamaPart = yamaPartIndices[dayOfWeek];
  const guliPart = guliPartIndices[dayOfWeek];

  const rahuKalam = getWindowForPart(rahuPart, 'Rahu Kalam', 'இராகு காலம்', 'राहु काल');
  const yamagandam = getWindowForPart(yamaPart, 'Yamagandam', 'எமகண்டம்', 'यमगण्ड');
  const gulikai = getWindowForPart(guliPart, 'Gulikai Kalam', 'குளிகை காலம்', 'गुलिक काल');

  // Abhijit Muhurtham: mid-day (8th muhurtham of 15 muhurthams)
  const solarNoonMinutes = sunriseMinutes + dayDuration / 2.0;
  const abhijitHalf = (dayDuration / 15.0) / 2.0;
  const abhijit: TimeWindow = {
    start: formatMinutesToTime(solarNoonMinutes - abhijitHalf),
    end: formatMinutesToTime(solarNoonMinutes + abhijitHalf),
    startMinutes: solarNoonMinutes - abhijitHalf,
    endMinutes: solarNoonMinutes + abhijitHalf,
    labelEn: 'Abhijit Muhurtham (Midday Auspicious)',
    labelTa: 'அபிஜித் முகூர்த்தம் (மங்கள நற்பொழுது)',
    labelHi: 'अभिजित मुहूर्त (परम शुभ)'
  };

  // 2. Nalla Neram computation:
  // Daytime (sunrise to sunset) minus Rahu Kalam, Yamagandam, and Gulikai.
  // We identify the remaining free parts out of 1..8, merge adjacent parts into contiguous intervals,
  // drop windows shorter than 30 minutes, and select the longest 2-3 windows sorted chronologically.
  const inauspiciousParts = new Set([rahuPart, yamaPart, guliPart]);
  const freeIntervals: Array<{ startPart: number; endPart: number; startM: number; endM: number; durationM: number }> = [];

  let currentBlockStartPart: number | null = null;
  for (let p = 1; p <= 8; p++) {
    if (!inauspiciousParts.has(p)) {
      if (currentBlockStartPart === null) {
        currentBlockStartPart = p;
      }
    } else {
      if (currentBlockStartPart !== null) {
        const startM = sunriseMinutes + (currentBlockStartPart - 1) * partDuration;
        const endM = sunriseMinutes + (p - 1) * partDuration;
        freeIntervals.push({
          startPart: currentBlockStartPart,
          endPart: p - 1,
          startM,
          endM,
          durationM: endM - startM
        });
        currentBlockStartPart = null;
      }
    }
  }
  if (currentBlockStartPart !== null) {
    const startM = sunriseMinutes + (currentBlockStartPart - 1) * partDuration;
    const endM = sunriseMinutes + 8 * partDuration;
    freeIntervals.push({
      startPart: currentBlockStartPart,
      endPart: 8,
      startM,
      endM,
      durationM: endM - startM
    });
  }

  // Filter windows >= 30 minutes
  const validFreeIntervals = freeIntervals.filter(w => w.durationM >= 30);

  // Take top 2-3 longest windows
  const sortedByDuration = [...validFreeIntervals].sort((a, b) => b.durationM - a.durationM);
  const topWindows = sortedByDuration.slice(0, 3).sort((a, b) => a.startM - b.startM);

  let nallaNeram: TimeWindow[] = topWindows.map(w => {
    return {
      start: formatMinutesToTime(w.startM),
      end: formatMinutesToTime(w.endM),
      startMinutes: w.startM,
      endMinutes: w.endM,
      labelEn: 'Best time',
      labelTa: 'சிறந்த நேரம்',
      labelHi: 'शुभ समय'
    };
  });

  // DEV CHECK: Check if any nalla neram window overlaps with Rahu Kalam or Yamagandam
  for (const win of nallaNeram) {
    const sM = win.startMinutes || 0;
    const eM = win.endMinutes || 0;
    const rStart = rahuKalam.startMinutes || 0;
    const rEnd = rahuKalam.endMinutes || 0;
    const yStart = yamagandam.startMinutes || 0;
    const yEnd = yamagandam.endMinutes || 0;

    const overlapsRahu = Math.max(sM, rStart) < Math.min(eM, rEnd);
    const overlapsYama = Math.max(sM, yStart) < Math.min(eM, yEnd);

    if (overlapsRahu || overlapsYama) {
      console.error(
        `[NALLA NERAM OVERLAP ERROR] Date: ${dateStr}, Nalla Neram (${win.start} - ${win.end}) overlaps with Rahu Kalam (${rahuKalam.start} - ${rahuKalam.end}) or Yamagandam (${yamagandam.start} - ${yamagandam.end})`
      );
    }
  }

  // Intraday Panchangam recheck: a day graded BEST at sunrise may turn Rikta
  // inside a Nalla Neram window (e.g. Chennai 2026-02-20 12:22-15:19 with
  // Chaturthi at 14:43). Sample each window at start, 25%, mid, 75%, end
  // so a transition inside the window is caught and that window is removed.
  let vetoedWindows: TimeWindow[] = [];
  {
    const filtered: TimeWindow[] = [];
    for (const win of nallaNeram) {
      const sM = win.startMinutes ?? 0;
      const eM = win.endMinutes ?? 0;
      const samples: number[] = [
        sM + 2,
        sM + (eM - sM) * 0.25,
        (sM + eM) / 2,
        sM + (eM - sM) * 0.75,
        eM - 2
      ].filter(v => v >= sM && v <= eM);
      let vetoed = false;
      for (const sampleM of samples) {
        const utc = utcForLocalMinutes(dateStr, sampleM, location, timeZoneId);
        if (isPanchangamVetoAt(utc, eventKey)) {
          vetoed = true;
          break;
        }
      }
      if (vetoed) vetoedWindows.push(win);
      else filtered.push(win);
    }
    nallaNeram = filtered;
  }

  const avoidWindows: TimeWindow[] = [rahuKalam, yamagandam, gulikai, ...vetoedWindows.map(w => ({
    ...w,
    labelEn: 'Avoid (Inauspicious Tithi/Karana/Yoga within window)',
    labelTa: 'தவிர்க்க வேண்டிய நேரம் (அசுப திதி/யோகம்)',
    labelHi: 'वर्जित समय (अशुभ तिथि/योग)'
  }))];

  // 3. Planetary Calculation at Sunrise using Astronomy Engine
  const time = sunriseAstroTime;
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);

  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const sunEcl = Astronomy.Ecliptic(sunGeo);
  const sunTrop = normalizeDeg(sunEcl.elon);
  const sunSid = normalizeDeg(sunTrop - ayanamsa);

  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
  const moonEcl = Astronomy.Ecliptic(moonGeo);
  const moonTrop = normalizeDeg(moonEcl.elon);
  const moonSid = normalizeDeg(moonTrop - ayanamsa);

  // A. Tithi
  const diffDeg = normalizeDeg(moonTrop - sunTrop);
  const tithiIndex = Math.floor(diffDeg / 12.0) % 30;
  const isShuklaPaksha = tithiIndex < 15;
  const tithiNumberInPaksha = (tithiIndex % 15) + 1;
  const tithiObj = TITHI_NAMES[tithiIndex] || TITHI_NAMES[0];

  // B. Nakshatra & Pada
  const nakSpan = 360.0 / 27.0;
  const nakshatraIndex = Math.floor(moonSid / nakSpan) % 27;
  const degInNak = moonSid - nakshatraIndex * nakSpan;
  const pada = Math.min(4, Math.max(1, Math.floor(degInNak / (nakSpan / 4.0)) + 1));
  const moonRasiNumber = Math.floor(moonSid / 30.0) + 1;

  const nakObj = rulesData.nakshatras[nakshatraIndex];
  const nakName = nakObj.nameEn;
  const plainDesc = NAKSHATRA_PLAIN_DESCRIPTIONS[nakName] || {
    en: `${nakName} - auspicious planetary star for sacred beginnings`,
    ta: `${nakObj.nameTa} - சுப காரியங்களுக்கு உகந்த மங்கள நட்சத்திரம்`,
    hi: `${nakObj.nameHi} - शुभ कार्यों हेतु अनुकूल नक्षत्र`
  };

  // C. Yoga
  const yogaSum = (sunSid + moonSid) % 360;
  const yogaIndex = Math.floor(yogaSum / nakSpan) % 27;
  const yogaObj = YOGA_NAMES[yogaIndex] || YOGA_NAMES[0];

  // D. Karana
  const karanaIndexRaw = Math.floor(diffDeg / 6.0) % 60;
  let karanaIndex = 0;
  if (karanaIndexRaw === 0) {
    karanaIndex = 10; // Kimstughna
  } else if (karanaIndexRaw >= 57) {
    karanaIndex = karanaIndexRaw - 50;
  } else {
    karanaIndex = (karanaIndexRaw - 1) % 7;
  }
  const karanaObj = KARANA_NAMES[karanaIndex] || KARANA_NAMES[0];

  // E. Tamil Solar Month key (1=chithirai...12=panguni) used solely for internal calculation
  const sunRasiIndex = Math.floor(sunSid / 30.0);
  const tamilMonthIndex = sunRasiIndex + 1;
  const tamilMonthObj = rulesData.tamilMonths.find(m => m.index === tamilMonthIndex) || rulesData.tamilMonths[0];
  const tamilDay = Math.floor(sunSid % 30) + 1;

  // Planetary retrograde / combustion checks
  let guruRetrograde = false;
  let guruCombust = false;
  let sukraRetrograde = false;
  let sukraCombust = false;
  let budhaRetrograde = false;

  try {
    // Guru (Jupiter)
    const jupPos1 = Astronomy.GeoVector(Astronomy.Body.Jupiter, time, true);
    const jupPos2 = Astronomy.GeoVector(Astronomy.Body.Jupiter, time.AddDays(1), true);
    const jupEcl1 = Astronomy.Ecliptic(jupPos1);
    const jupEcl2 = Astronomy.Ecliptic(jupPos2);
    if (normalizeDeg(jupEcl2.elon - jupEcl1.elon) > 180) {
      guruRetrograde = true;
    }
    const sunJupDiff = Math.abs(normalizeDeg(jupEcl1.elon - sunTrop));
    const minJupDiff = Math.min(sunJupDiff, 360 - sunJupDiff);
    if (isInsideAstaWindow(minJupDiff, GURU_ASTA_ORB_DEG)) {
      guruCombust = true;
    }

    // Sukra (Venus)
    const venPos1 = Astronomy.GeoVector(Astronomy.Body.Venus, time, true);
    const venPos2 = Astronomy.GeoVector(Astronomy.Body.Venus, time.AddDays(1), true);
    const venEcl1 = Astronomy.Ecliptic(venPos1);
    const venEcl2 = Astronomy.Ecliptic(venPos2);
    if (normalizeDeg(venEcl2.elon - venEcl1.elon) > 180) {
      sukraRetrograde = true;
    }
    const sunVenDiff = Math.abs(normalizeDeg(venEcl1.elon - sunTrop));
    const minVenDiff = Math.min(sunVenDiff, 360 - sunVenDiff);
    if (isInsideAstaWindow(minVenDiff, SUKRA_ASTA_ORB_DEG)) {
      sukraCombust = true;
    }

    // Budha (Mercury)
    const merPos1 = Astronomy.GeoVector(Astronomy.Body.Mercury, time, true);
    const merPos2 = Astronomy.GeoVector(Astronomy.Body.Mercury, time.AddDays(1), true);
    const merEcl1 = Astronomy.Ecliptic(merPos1);
    const merEcl2 = Astronomy.Ecliptic(merPos2);
    if (normalizeDeg(merEcl2.elon - merEcl1.elon) > 180) {
      budhaRetrograde = true;
    }
  } catch (e) {
    // Ignore astronomy exceptions
  }

  // Eclipse detection in proximity (1.5 days)
  let eclipseNearby = false;
  try {
    const lunEclipse = Astronomy.SearchLunarEclipse(time.AddDays(-1.5));
    if (lunEclipse && Math.abs(lunEclipse.peak.ut - time.ut) <= 1.5) {
      eclipseNearby = true;
    }
  } catch (e) {
    // Ignore
  }

  // -------------------------------------------------------------------------
  // 4. GRADING & EVALUATION (ACCORDING TO USER'S EXACT SPECIFIED ORDER)
  // -------------------------------------------------------------------------
  const reasonsEn: string[] = [];
  const reasonsTa: string[] = [];
  const reasonsHi: string[] = [];
  const doshasEn: string[] = [];
  const doshasTa: string[] = [];
  const doshasHi: string[] = [];

  const eventConfig = (rulesData.events as any)[eventKey] || rulesData.events.wedding;

  // Closed-season detection from real astronomical positions
  // Lunar-month and Paksha status are anchored to the same local sunrise used
  // for Tithi/Nakshatra, not to the host browser/server's local-noon timezone.
  const panchangDate = sunriseAstroTime.date;
  const adhikaMasa = isAdhikaMasa(panchangDate);
  const pitruPaksha = isPitruPaksha(panchangDate);
  const panchakaActive = isPanchakaNakshatra(nakshatraIndex);

  let isVetoed = false;

  // A. HARD RULES FIRST:
  // 1. Amavasya check (Tithi 30 / index 29)
  if (tithiIndex === 29) {
    isVetoed = true;
    doshasEn.push('Amavasya (New Moon) — strictly avoided for auspicious ceremonies.');
    doshasTa.push('அமாவாசை திதி — சுப முகூர்த்தங்களுக்கு விலக்கப்பட வேண்டும்.');
    doshasHi.push('अमावस्या तिथि — मांगलिक कार्यों हेतु वर्जित है।');
  }

  // 2. Rikta Tithis check (4, 9, 14 of Shukla & Krishna)
  if ([4, 9, 14].includes(tithiNumberInPaksha)) {
    isVetoed = true;
    doshasEn.push(`Rikta Tithi (${tithiObj.en}) is inauspicious for sacred beginnings.`);
    doshasTa.push(`ரிக்தா திதி (${tithiObj.ta}) — சுப காரியங்களுக்கு தவிர்க்கப்பட வேண்டும்.`);
    doshasHi.push(`रिक्ता तिथि (${tithiObj.hi}) — शुभ कार्यों के लिए वर्जित है।`);
  }

  // 3. Vishti (Bhadra) Karana
  if (karanaIndex === 6) {
    isVetoed = true;
    doshasEn.push('Vishti (Bhadra) Karana is active — all Subha Muhurthams are prohibited.');
    doshasTa.push('பத்திரை / விஷ்டி கரணம் உள்ளதால் சுப காரியங்கள் செய்யக்கூடாது.');
    doshasHi.push('विष्टि (भद्रा) करण होने के कारण शुभ मुहूर्त निषेध है।');
  }

  // 4. Avoided Yogas
  const globalAvoidYogas = ['Vishkambha', 'Vyatipata', 'Parigha', 'Vaidhriti', 'Atiganda', 'Shoola', 'Ganda', 'Vyaghata', 'Vajra'];
  if (globalAvoidYogas.includes(yogaObj.en) || eventConfig.avoidYogas?.includes(yogaObj.en)) {
    isVetoed = true;
    doshasEn.push(`Inauspicious Yoga (${yogaObj.en}) present.`);
    doshasTa.push(`அசுப யோகம் (${yogaObj.ta}) விலக்கப்பட வேண்டும்.`);
    doshasHi.push(`अशुभ योग (${yogaObj.hi}) उपस्थित है।`);
  }

  // 5. Avoided Solar Months (uses internal solar key, reasoning text omits Tamil month name)
  if (eventConfig.avoidMonths?.includes(tamilMonthObj.key)) {
    isVetoed = true;
    doshasEn.push('This month is traditionally avoided for this sacred ceremony.');
    doshasTa.push('இந்த மாதம் இந்த சுப நிகழ்விற்கு பாரம்பரியமாக விலக்கப்படும் மாதமாகும்.');
    doshasHi.push('यह माह इस शुभ संस्कार हेतु शास्त्र वर्जित है।');
  }

  // 6. Avoided Weekday
  if (eventConfig.avoidWeekdays?.includes(dayOfWeek)) {
    isVetoed = true;
    doshasEn.push(`${DAYS_NAMES[dayOfWeek].en} is traditionally avoided for this event.`);
    doshasTa.push(`${DAYS_NAMES[dayOfWeek].ta} கிழமை இந்த நிகழ்விற்கு உகந்தது அல்ல.`);
    doshasHi.push(`${DAYS_NAMES[dayOfWeek].hi} इस कार्य हेतु वर्जित है।`);
  }

  // 7. Event-specific avoid / hard-veto nakshatras
  if (eventConfig.avoidNakshatras?.includes(nakName) || eventConfig.hardVetoNakshatras?.includes(nakName)) {
    isVetoed = true;
    doshasEn.push(`Inauspicious Nakshatra (${nakObj.nameEn}) for this event.`);
    doshasTa.push(`இந்த சுப நிகழ்விற்கு விலக்கப்பட வேண்டிய நட்சத்திரம் (${nakObj.nameTa}).`);
    doshasHi.push(`इस कार्य हेतु वर्जित नक्षत्र (${nakObj.nameHi})।`);
  }

  // 8. Event-specific avoided tithis
  if (isEventTithiAvoided(eventKey, tithiIndex)) {
    isVetoed = true;
    doshasEn.push(`${tithiObj.en} is avoided for this ceremony.`);
    doshasTa.push(`${tithiObj.ta} இந்த சம்பவத்திற்கு விலக்கப்படும் திதி.`);
    doshasHi.push(`${tithiObj.hi} इस कार्य हेतु त्याज्य तिथि है।`);
  }

  // 9. Jupiter/Venus Combustion (for weddings / engagements)
  if ((eventKey === 'wedding' || eventKey === 'engagement' || eventConfig.requireGuruSukraClean) && (guruCombust || sukraCombust)) {
    isVetoed = true;
    const combustPlanet = guruCombust ? 'Jupiter (Guru)' : 'Venus (Sukra)';
    doshasEn.push(`${combustPlanet} combustion (Moudhya dosha) — weddings strictly prohibited.`);
    doshasTa.push('குரு / சுக்கிர மௌட்ய அஸ்தமன தோஷம் உள்ளதால் திருமணம் விலக்கப்படும்.');
    doshasHi.push('गुरु/शुक्र अस्त होने के कारण विवाह पूर्णतः वर्जित है।');
  }

  // 10. Close Eclipse proximity
  if (eclipseNearby) {
    isVetoed = true;
    doshasEn.push('Solar/Lunar eclipse in close proximity (Grahan Vedha).');
    doshasTa.push('கிரகண தோஷ காலம் அருகில் உள்ளதால் சுபகாரியங்கள் விலக்கப்படும்.');
    doshasHi.push('ग्रहण वेध के कारण मुहूर्त त्याज्य है।');
  }

  // 11. Pitru Paksha (Mahalaya fortnight) — blocked for almost every ceremony
  if (pitruPaksha && eventConfig.avoidPitruPaksha !== false) {
    isVetoed = true;
    doshasEn.push('Pitru Paksha (ancestral fortnight) — no new beginnings or celebrations.');
    doshasTa.push('பித்திரு பக்ஷ காலம் — புதிய மங்கள காரியங்களுக்கு விலக்கு.');
    doshasHi.push('पितृ पक्ष काल — नए मांगलिक कार्य हेतु वर्जित।');
  }

  // 12. Adhika Masa (intercalary extra lunar month)
  if (adhikaMasa && rulesData.globalRules.avoidAdhikaMasam !== false && eventConfig.avoidAdhikaMasam !== false) {
    isVetoed = true;
    doshasEn.push('Adhika Masa (extra intercalary month) — avoided for auspicious work.');
    doshasTa.push('அதிக மாச காலம் — சுப காரியங்களுக்கு விலக்கப்படும்.');
    doshasHi.push('अधिक मास काल — शुभ कार्यों हेतु वर्जित।');
  }

  // 13. Panchaka — strictly avoided for land, house and construction work
  if (panchakaActive && eventConfig.avoidPanchaka) {
    isVetoed = true;
    doshasEn.push('Panchaka nakshatra (Dhanishta–Revati group) is active — land and house work is prohibited.');
    doshasTa.push('பஞ்சக நட்சத்திர காலம் — நிலம், வீடு மற்றும் கட்டிட பணிகளுக்கு விலக்கு.');
    doshasHi.push('पंचक नक्षत्र काल — भूमि, गृह एवं निर्माण कार्य हेतु वर्जित।');
  }

  // B. NAKSHATRA QUALITY CHECK:
  const isGoodNakshatra =
    eventConfig.goodNakshatras?.includes(nakName) ||
    eventConfig.bestNakshatras?.includes(nakName) ||
    (eventKey === 'business_start' && nakName === 'Pushya');

  // Rule 2b: For wedding, griha pravesam, land/house purchase, house construction
  // and engagement: a nakshatra outside the event's good list = Avoid.
  const strictNakshatraEvents = ['wedding', 'griha_pravesam', 'land_purchase', 'house_construction'];
  const isStrictNakshatraEvent =
    strictNakshatraEvents.includes(eventKey) || eventConfig.strictNakshatra === true;

  if (isStrictNakshatraEvent && !isGoodNakshatra) {
    isVetoed = true;
    doshasEn.push(`Nakshatra ${nakObj.nameEn} is outside the approved auspicious stars list for this ceremony.`);
    doshasTa.push(`${nakObj.nameTa} நட்சத்திரம் இந்த சுப நிகழ்விற்கான உத்தம நட்சத்திரப் பட்டியலில் இல்லை.`);
    doshasHi.push(`नक्षत्र ${nakObj.nameHi} इस मांगलिक कार्य की अनुशंसित सूची में नहीं है।`);
  }

  // Rule 2c: For the other events: a nakshatra outside the good list caps the grade at Fair.
  let isCappedAtFair = false;
  if (!isStrictNakshatraEvent && !isGoodNakshatra) {
    isCappedAtFair = true;
    doshasEn.push(`Nakshatra ${nakObj.nameEn} is of ordinary quality for this event.`);
    doshasTa.push(`${nakObj.nameTa} நட்சத்திரம் இந்த நிகழ்விற்கு சாதாரண பலன் தரும்.`);
    doshasHi.push(`नक्षत्र ${nakObj.nameHi} इस कार्य हेतु सामान्य फलदायी है।`);
  }

  // C. WEEKDAY & TITHI QUALITY CHECK:
  const isGoodWeekday =
    (eventConfig.goodWeekdays?.includes(dayOfWeek) || eventConfig.bestWeekdays?.includes(dayOfWeek)) &&
    !eventConfig.avoidWeekdays?.includes(dayOfWeek);

  const isGoodTithi = isGoodTithiForEvent(eventKey, tithiIndex);

  // Add positive reasons
  if (isGoodNakshatra) {
    reasonsEn.push(`Favorable Nakshatra (${nakObj.nameEn})`);
    reasonsTa.push(`சுபகரமான நட்சத்திரம் (${nakObj.nameTa})`);
    reasonsHi.push(`शुभ नक्षत्र (${nakObj.nameHi})`);
  }
  if (isGoodWeekday) {
    reasonsEn.push(`Auspicious Day (${DAYS_NAMES[dayOfWeek].en})`);
    reasonsTa.push(`மங்களகரமான கிழமை (${DAYS_NAMES[dayOfWeek].ta})`);
    reasonsHi.push(`शुभ वार (${DAYS_NAMES[dayOfWeek].hi})`);
  }
  if (isGoodTithi) {
    reasonsEn.push(`Subha Tithi (${tithiObj.en})`);
    reasonsTa.push(`சுப திதி (${tithiObj.ta})`);
    reasonsHi.push(`शुभ तिथि (${tithiObj.hi})`);
  }
  if (isShuklaPaksha) {
    reasonsEn.push('Shukla Paksha (Waxing Moon phase)');
    reasonsTa.push('சுக்ல பக்ஷம் (வளர்பிறை காலம்)');
    reasonsHi.push('शुक्ल पक्ष (शुभ चंद्र बल)');
  }

  // Rule 2d:
  // Best requires a good nakshatra AND a good weekday AND a good tithi.
  // If only two of the three are good, the grade is Good at most.
  let grade: MuhurthamGrade = 'FAIR';
  let score = 50;

  if (isVetoed) {
    grade = 'AVOID';
    score = 25;
  } else if (isCappedAtFair) {
    grade = 'FAIR';
    score = 55;
  } else {
    // We have a good nakshatra; check count of good attributes (out of 3)
    const goodCount = (isGoodNakshatra ? 1 : 0) + (isGoodWeekday ? 1 : 0) + (isGoodTithi ? 1 : 0);

    if (goodCount === 3) {
      grade = 'BEST';
      score = 90;
    } else if (goodCount >= 2) {
      grade = 'GOOD';
      score = 75;
    } else {
      grade = 'FAIR';
      score = 55;
    }
  }

  // Soft penalty (does not change the grade): Chaturmas / Kharmas months are
  // traditionally weak for construction and foundation work.
  if (eventConfig.avoidChaturmas && eventConfig.chaturmasMonths?.includes(tamilMonthObj.key) && grade !== 'AVOID') {
    score -= 12;
    doshasEn.push('Falls in the Chaturmas / Kharmas period — traditionally weak for this work.');
    doshasTa.push('சதுர்மாச / கர்மாச காலம் — இந்த பணிக்கு பாரம்பரியமாக பலம் குறைந்தது.');
    doshasHi.push('चातुर्मास / खरमास काल — इस कार्य हेतु पारंपरिक रूप से बल कम।');
  }

  // Intraday downgrade: if Nalla Neram windows were vetoed due to Tithi/
  // Karana/Yoga transition inside the window, the day cannot remain BEST.
  if (vetoedWindows.length > 0 && grade !== 'AVOID') {
    if (grade === 'BEST') {
      grade = 'GOOD';
      score = Math.min(score, 75);
    }
    if (nallaNeram.length === 0) {
      grade = 'FAIR';
      score = Math.min(score, 55);
      doshasEn.push('No auspicious window remains after intraday Panchangam validation (Rikta/Amavasya/Vishti or inauspicious Yoga began inside the best-time interval).');
      doshasTa.push('பகல் பொழுதில் திதி/கரணம்/யோகம் அசுபமாக மாறியதால் சிறந்த நேரம் முழுவதும் விலக்கப்பட்டது.');
      doshasHi.push('दिन में तिथि/करण/योग के अशुभ होने से शुभ समय पूर्णतः वर्जित हुआ।');
    } else {
      doshasEn.push(`${vetoedWindows.length} daytime window(s) turned inauspicious (Rikta Tithi, Vishti Karana or inauspicious Yoga began inside the interval) and have been removed from auspicious times.`);
      doshasTa.push(`${vetoedWindows.length} பகல் நேரப் பகுதி திதி/யோகம் அசுபமாக மாறியதால் விலக்கப்பட்டது.`);
      doshasHi.push(`${vetoedWindows.length} दिन के शुभ समय खंड अशुभ तिथि/योग के कारण वर्जित किए गए।`);
    }
  }

  // Check traditional 11th or 12th day if birth date is supplied (for Namakaranam)
  let isTraditional11thOr12thDay = false;
  if (eventKey === 'namakaranam' && options?.birthDate) {
    try {
      const birthDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(options.birthDate);
      if (!birthDateMatch) throw new Error('Invalid birth date');
      const birthDate = new Date(0);
      birthDate.setUTCFullYear(
        Number(birthDateMatch[1]), Number(birthDateMatch[2]) - 1, Number(birthDateMatch[3])
      );
      birthDate.setUTCHours(0, 0, 0, 0);
      const eventDate = new Date(0);
      eventDate.setUTCFullYear(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      eventDate.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.round((eventDate.getTime() - birthDate.getTime()) / (24 * 3600000));
      if (diffDays === 11 || diffDays === 12 || diffDays === 16) {
        isTraditional11thOr12thDay = true;
        reasonsEn.push(`Traditional Vedic Day #${diffDays} from birth: Inherently auspicious for Namakaranam.`);
        reasonsTa.push(`குழந்தை பிறந்த ${diffDays}-வது பாரம்பரிய சுப நாள்: தனி முகூர்த்தம் இன்றியே பெயர் சூட்ட சிறந்த நாள்.`);
        reasonsHi.push(`जन्म से ${diffDays}वां पारंपरिक दिवस: नामकरण संस्कार हेतु स्वाभाविक रूप से परम शुभ।`);
      }
    } catch (e) {
      // Ignore
    }
  }

  // -------------------------------------------------------------------------
  // PERSONAL ASTRO CHECKS (Tara Balam & Chandrashtama)
  // Works for bride/groom (wedding), child (namakaranam, annaprasanam, mundan,
  // karnavedha, upanayanam), mother (seemantham) and self (all other events).
  // The personal verdict is applied for every person supplied: a Chandrashtama
  // or Janma-Nakshatra day for either person drops the date from the
  // recommended list, and an Uttamam needs a good Tara Balam for both.
  // -------------------------------------------------------------------------
  const personalChecks: PersonalAstroCheck[] = [];

  const buildPersonChecks = (
    entries: Array<{ idx?: number; rasi?: number; role: PersonRole }>
  ) => {
    for (const entry of entries) {
      if (entry.idx === undefined || entry.idx < 0 || entry.idx > 26) continue;
      const rasi = entry.rasi || (Math.floor((entry.idx * 4) / 9) + 1);
      personalChecks.push(
        calculateTaraBalamAndChandrashtama(entry.idx, rasi, nakshatraIndex, moonRasiNumber, entry.role)
      );
    }
  };

  // Legacy bride/groom option names (still supported)
  let brideIdx = options?.brideNakshatraIndex;
  if (brideIdx === undefined && options?.brideNakshatra) {
    const foundIdx = findNakshatraIndexByName(options.brideNakshatra);
    if (foundIdx !== null) brideIdx = foundIdx;
  }

  let groomIdx = options?.groomNakshatraIndex;
  if (groomIdx === undefined && options?.groomNakshatra) {
    const foundIdx = findNakshatraIndexByName(options.groomNakshatra);
    if (foundIdx !== null) groomIdx = foundIdx;
  }

  buildPersonChecks([
    { idx: brideIdx, rasi: options?.brideRasiNumber, role: 'bride' },
    { idx: groomIdx, rasi: options?.groomRasiNumber, role: 'groom' }
  ]);

  // Generic persons array (used by the page for every event type)
  if (options?.persons && options.persons.length > 0) {
    const already = new Set(personalChecks.map(p => `${p.role}:${p.nakshatraIndex}`));
    const extra = options.persons
      .filter(p => !already.has(`${p.role}:${p.nakshatraIndex}`))
      .map(p => ({ idx: p.nakshatraIndex, rasi: p.rasiNumber, role: p.role }));
    buildPersonChecks(extra);
  }

  // ---- Bride / groom (or single person) verdict ---------------------------
  // Every date is checked against EVERY person's chart:
  //   a) Chandrashtamam  — the day's Moon sign is the 8th from that person's Rasi
  //   b) Tara Balam      — the Navatara counted from that person's Janma Nakshatra
  //   c) Janma Nakshatra — the day's star IS that person's own birth star
  // A date that fails (a) or (c) for either person is dropped from the
  // recommended list; Uttamam (BEST) additionally needs (b) to pass for both.
  const personalFailures = personalChecks.filter(p => p.isChandrashtama || p.isJanmaNakshatra);
  if (grade !== 'AVOID' && personalChecks.length > 0) {
    if (personalFailures.length > 0) {
      grade = 'FAIR';
      score = Math.min(score, 55);
    } else if (grade === 'BEST' && personalChecks.some(p => !p.isTaraAuspicious)) {
      grade = 'GOOD';
      score = Math.min(score, 75);
    }
  }
  personalFailures.forEach(p => {
    const roleEn = muhurthamRoleLabel(p.role, 'en');
    const roleTa = muhurthamRoleLabel(p.role, 'ta');
    const roleHi = muhurthamRoleLabel(p.role, 'hi');
    if (p.isChandrashtama) {
      doshasEn.push(`${roleEn}'s Chandrashtama (Moon in the 8th from Janma Rasi) — not recommended for this person.`);
      doshasTa.push(`${roleTa} சந்திராஷ்டமம் — இந்நாள் இவருக்கு மிகச் சுபமானது அல்ல.`);
      doshasHi.push(`${roleHi} चंद्राष्टम — इस दिवस इनके लिए अत्यंत शुभ नहीं है।`);
    }
    if (p.isJanmaNakshatra) {
      doshasEn.push(`${roleEn}'s own Janma Nakshatra (${p.nakshatraNameEn}) — this star day is not recommended.`);
      doshasTa.push(`${roleTa} ஜன்ம நட்சத்திர நாள் (${p.nakshatraNameTa}) — இந்நாள் பரிந்துரைக்கப்படுவதில்லை.`);
      doshasHi.push(`${roleHi} का जन्म नक्षत्र दिवस (${p.nakshatraNameHi}) — यह तिथि अनुशंसित नहीं है।`);
    }
  });

  // Positive note when the day also carries a strong personal Tara Balam
  if (grade !== 'AVOID') {
    personalChecks
      .filter(p => p.isTaraAuspicious)
      .forEach(p => {
        reasonsEn.push(`${muhurthamRoleLabel(p.role, 'en')}'s Tara Balam: ${p.taraNameEn} (auspicious)`);
        reasonsTa.push(`${muhurthamRoleLabel(p.role, 'ta')} தாரா பலம்: ${p.taraNameTa} (சுபம்)`);
        reasonsHi.push(`${muhurthamRoleLabel(p.role, 'hi')} तारा बल: ${p.taraNameHi} (शुभ)`);
      });
  }

  // One short report line per date summarising the personal check, so a reader
  // can see that Chandrashtamam and Tara Balam were verified for each person.
  const personalNoteFor = (lang: 'en' | 'ta' | 'hi'): string => {
    if (personalChecks.length === 0) return '';
    const everyonePasses = personalChecks.every(p => p.isTaraAuspicious && !p.isChandrashtama && !p.isJanmaNakshatra);
    if (everyonePasses) {
      return lang === 'ta' ? 'சந்திராஷ்டமம் இல்லை · நல்ல தாரா பலம்'
        : lang === 'hi' ? 'चंद्राष्टम नहीं · शुभ तारा बल'
        : 'No Chandrashtama · good Tara Bala';
    }
    return personalChecks
      .filter(p => !p.isTaraAuspicious)
      .map(p => {
        const role = muhurthamRoleLabel(p.role, lang);
        if (p.isJanmaNakshatra) {
          return `${role}: ${lang === 'ta' ? 'ஜன்ம நட்சத்திரம்' : lang === 'hi' ? 'जन्म नक्षत्र' : 'Janma Nakshatra'}`;
        }
        if (p.isChandrashtama) {
          return `${role}: ${lang === 'ta' ? 'சந்திராஷ்டமம்' : lang === 'hi' ? 'चंद्राष्टम' : 'Chandrashtama'}`;
        }
        return `${role}: ${lang === 'ta' ? p.taraNameTa : lang === 'hi' ? p.taraNameHi : p.taraNameEn}`;
      })
      .join(' · ');
  };
  const personalNoteEn = personalNoteFor('en');
  const personalNoteTa = personalNoteFor('ta');
  const personalNoteHi = personalNoteFor('hi');

  const bridePersonalCheck = personalChecks.find(p => p.role === 'bride');
  const groomPersonalCheck = personalChecks.find(p => p.role === 'groom');

  // Baby naming syllables metadata
  const padaSyllablesMeta = NAKSHATRA_PADA_SYLLABLES[nakshatraIndex];
  const activePadaLetter = padaSyllablesMeta.padas.find(p => p.pada === pada) || padaSyllablesMeta.padas[0];

  const babyNamingSyllables = {
    pada,
    letterEn: activePadaLetter.en,
    letterTa: activePadaLetter.ta,
    letterHi: activePadaLetter.hi,
    allSummaryEn: padaSyllablesMeta.summaryEn,
    allSummaryTa: padaSyllablesMeta.summaryTa,
    allSummaryHi: padaSyllablesMeta.summaryHi
  };

  return {
    date: dateStr,
    dayNumber: day,
    month,
    year,
    dayOfWeek,
    dayOfWeekNameEn: DAYS_NAMES[dayOfWeek].en,
    dayOfWeekNameTa: DAYS_NAMES[dayOfWeek].ta,
    dayOfWeekNameHi: DAYS_NAMES[dayOfWeek].hi,
    sunrise: formatMinutesToTime(sunriseMinutes),
    sunset: formatMinutesToTime(sunsetMinutes),
    tamilMonthIndex,
    tamilMonthKey: tamilMonthObj.key,
    tamilDay,
    tithiIndex,
    tithiNumberInPaksha,
    tithiNameEn: tithiObj.en,
    tithiNameTa: tithiObj.ta,
    tithiNameHi: tithiObj.hi,
    isShuklaPaksha,
    nakshatraIndex,
    nakshatraNameEn: nakObj.nameEn,
    nakshatraNameTa: nakObj.nameTa,
    nakshatraNameHi: nakObj.nameHi,
    pada,
    moonRasiNumber,
    nakshatraPlainMeaningEn: plainDesc.en,
    nakshatraPlainMeaningTa: plainDesc.ta,
    nakshatraPlainMeaningHi: plainDesc.hi,
    yogaIndex,
    yogaNameEn: yogaObj.en,
    yogaNameTa: yogaObj.ta,
    yogaNameHi: yogaObj.hi,
    karanaIndex,
    karanaNameEn: karanaObj.en,
    karanaNameTa: karanaObj.ta,
    karanaNameHi: karanaObj.hi,
    rahuKalam,
    yamagandam,
    gulikai,
    abhijit,
    nallaNeram,
    avoidWindows,
    grade,
    score,
    isRecommended: grade === 'BEST' || grade === 'GOOD',
    isAdhikaMasa: adhikaMasa,
    isPitruPaksha: pitruPaksha,
    reasonsEn,
    reasonsTa,
    reasonsHi,
    doshasEn,
    doshasTa,
    doshasHi,
    personalChecks,
    personalNoteEn,
    personalNoteTa,
    personalNoteHi,
    bridePersonalCheck,
    groomPersonalCheck,
    planetaryHighlights: {
      guruRetrograde,
      guruCombust,
      sukraRetrograde,
      sukraCombust,
      budhaRetrograde,
      eclipseNearby
    },
    babyNamingSyllables,
    isTraditional11thOr12thDay
  };
}

/**
 * Scans a single Gregorian calendar month for a given event, location, and options.
 * Caches results in memory for instant switching.
 */
export function scanMonthMuhurtham(
  year: number,
  month: number, // 1 - 12
  location: LocationInput,
  eventKey: MuhurthamEventKey,
  options?: {
    brideNakshatra?: string;
    groomNakshatra?: string;
    brideNakshatraIndex?: number;
    groomNakshatraIndex?: number;
    brideRasiNumber?: number;
    groomRasiNumber?: number;
    /** Generic personal-star cross-checks (child, mother, self, couple…) */
    persons?: PersonInput[];
    birthDate?: string;
    skipPastDates?: boolean;
  }
): MonthScanResult {
  const cacheToday = new Date();
  const timeZoneId = location.timeZoneId ?? getTimeZoneIdForCoordinates(location.latitude, location.longitude);
  const scanLocation: LocationInput = timeZoneId ? { ...location, timeZoneId } : location;
  const todayKey = options?.skipPastDates === false
    ? ''
    : (timeZoneId ? getLocalDateKey(cacheToday, timeZoneId) : null) ??
      `${cacheToday.getFullYear()}-${String(cacheToday.getMonth() + 1).padStart(2, '0')}-${String(cacheToday.getDate()).padStart(2, '0')}`;
  const cacheKey = `${eventKey}_${year}_${month}_${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}_${timeZoneId ?? ''}_${options?.brideNakshatraIndex ?? options?.brideNakshatra ?? ''}_${options?.groomNakshatraIndex ?? options?.groomNakshatra ?? ''}_${(options?.persons || []).map(p => `${p.role}:${p.nakshatraIndex}`).join('|')}_${options?.birthDate || ''}_${todayKey}`;

  if (SCAN_CACHE.has(cacheKey)) {
    return SCAN_CACHE.get(cacheKey)!;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: DayMuhurthamResult[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, month - 1, d, 12, 0, 0);

    // Compare local Gregorian calendar dates in the selected location's zone.
    if (options?.skipPastDates !== false) {
      const testDateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (testDateKey < todayKey) continue;
    }

    const dayResult = computeDayMuhurtham(dayDate, scanLocation, eventKey, options);
    days.push(dayResult);
  }

  const bestCount = days.filter(d => d.grade === 'BEST').length;
  const goodCount = days.filter(d => d.grade === 'GOOD').length;
  const fairCount = days.filter(d => d.grade === 'FAIR').length;
  const avoidCount = days.filter(d => d.grade === 'AVOID').length;

  const monthObj = MONTH_NAMES_GREGORIAN[month - 1] || MONTH_NAMES_GREGORIAN[0];

  const result: MonthScanResult = {
    monthKey: `${year}-${month.toString().padStart(2, '0')}`,
    month,
    year,
    monthNameEn: `${monthObj.en} ${year}`,
    monthNameTa: `${monthObj.ta} ${year}`,
    monthNameHi: `${monthObj.hi} ${year}`,
    days,
    bestCount,
    goodCount,
    fairCount,
    avoidCount
  };

  SCAN_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Scans a 3-month window: (previous month, chosen month, next month).
 */
export function scanThreeMonthWindow(
  chosenYear: number,
  chosenMonth: number, // 1 - 12
  location: LocationInput,
  eventKey: MuhurthamEventKey,
  options?: {
    brideNakshatra?: string;
    groomNakshatra?: string;
    brideNakshatraIndex?: number;
    groomNakshatraIndex?: number;
    brideRasiNumber?: number;
    groomRasiNumber?: number;
    /** Generic personal-star cross-checks (child, mother, self, couple…) */
    persons?: PersonInput[];
    birthDate?: string;
  }
): {
  prevMonth: MonthScanResult;
  chosenMonth: MonthScanResult;
  nextMonth: MonthScanResult;
} {
  // Previous Month
  let prevM = chosenMonth - 1;
  let prevY = chosenYear;
  if (prevM < 1) {
    prevM = 12;
    prevY = chosenYear - 1;
  }

  // Next Month
  let nextM = chosenMonth + 1;
  let nextY = chosenYear;
  if (nextM > 12) {
    nextM = 1;
    nextY = chosenYear + 1;
  }

  const prevMonth = scanMonthMuhurtham(prevY, prevM, location, eventKey, options);
  const chosen = scanMonthMuhurtham(chosenYear, chosenMonth, location, eventKey, options);
  const nextMonth = scanMonthMuhurtham(nextY, nextM, location, eventKey, options);

  return {
    prevMonth,
    chosenMonth: chosen,
    nextMonth
  };
}
