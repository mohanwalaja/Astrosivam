export enum Rasi {
  MESHAM = 1,
  RISHABAM = 2,
  MITHUNAM = 3,
  KADAGAM = 4,
  SIMHAM = 5,
  KANNI = 6,
  THULAM = 7,
  VIRUCHIGAM = 8,
  DHANUSU = 9,
  MAGARAM = 10,
  KUMBAM = 11,
  MEENAM = 12
}

export enum Graha {
  SURYA = 'sun',
  CHANDRA = 'moon',
  CHEVVAI = 'mars',
  BUDHA = 'mercury',
  GURU = 'jupiter',
  SUKRA = 'venus',
  SANI = 'saturn',
  RAHU = 'rahu',
  KETU = 'ketu'
}

export type AppLanguage = 'ta' | 'en' | 'hi';

export interface PlanetPosition {
  graha: Graha;
  planetKey?: string; // backwards compatibility e.g. 'SUN', 'MOON'
  nameTa: string;
  nameEn: string;
  nameHi: string;
  shortTa: string;
  shortEn: string;
  shortHi: string;
  rasi: Rasi;
  rasiNumber?: number; // alias for rasi
  rasiNameTa: string;
  rasiNameEn: string;
  rasiNameHi: string;
  degrees: number; // 0.0 to 30.0 inside rasi
  totalDegrees: number; // 0.0 to 360.0
  nakshatramTa: string;
  nakshatramEn: string;
  nakshatramHi: string;
  pada: number;
  isRetrograde: boolean;
  isCombust: boolean;
  bhavaNumber: number; // 1 to 12
  navamsaRasi?: Rasi;
  navamsaRasiNameTa?: string;
  navamsaRasiNameEn?: string;
  navamsaRasiNameHi?: string;
  isVargottama?: boolean; // Occupies same sign in Rasi and Navamsa
  /** Ecliptic latitude at birth (deg). Graha Yuddha is decided by this value. */
  eclipticLatitude?: number;
  /** Exalted / own / debilitated / combust / retrograde + Neecha Bhanga (item 3). */
  dignity?: {
    graha: string;
    status: 'exalted' | 'own' | 'debilitated' | 'neutral' | 'not-applicable';
    statusEn: string;
    statusTa: string;
    statusHi: string;
    isExalted: boolean;
    isOwnSign: boolean;
    isDebilitated: boolean;
    isCombust: boolean;
    isRetrograde: boolean;
    isNeechaBhanga: boolean;
    neechaBhangaEn: string;
    neechaBhangaTa: string;
    neechaBhangaHi: string;
    /** Short rule names behind the finding, e.g. 'by Jupiter conjunction'. */
    neechaBhangaTagEn: string;
    neechaBhangaTagTa: string;
    neechaBhangaTagHi: string;
    neechaBhangaReasons: string[];
    tagsEn: string;
    tagsTa: string;
    tagsHi: string;
  };
}

export interface BhavaDetail {
  number: number;
  nameTa: string;
  nameEn: string;
  nameHi: string;
  rasi: Rasi;
  rasiNameTa: string;
  rasiNameEn: string;
  rasiNameHi: string;
  significanceTa: string;
  significanceEn: string;
  significanceHi: string;
  occupantGrahas: Graha[];
}

export interface AntardashaPeriod {
  lord: Graha;
  lordNameTa: string;
  lordNameEn: string;
  lordNameHi: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  months: number;
  isCurrent?: boolean;
}

export interface DashaPeriod {
  mahadashaLord: Graha;
  lordNameTa: string;
  lordNameEn: string;
  lordNameHi: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  years: number;
  descriptionTa: string;
  descriptionEn: string;
  descriptionHi: string;
  antardashas?: AntardashaPeriod[];
  isCurrent?: boolean;
}

export interface CurrentDashaInfo {
  mahadashaLord: Graha;
  mahadashaLordEn: string;
  mahadashaLordTa: string;
  mahadashaLordHi: string;
  mahadashaStart: string;
  mahadashaEnd: string;
  antardashaLord: Graha;
  antardashaLordEn: string;
  antardashaLordTa: string;
  antardashaLordHi: string;
  antardashaStart: string;
  antardashaEnd: string;
  pratyantardashaLord?: Graha;
  pratyantardashaLordEn?: string;
  pratyantardashaLordTa?: string;
  pratyantardashaLordHi?: string;
  pratyantardashaStart?: string;
  pratyantardashaEnd?: string;
  balanceAtBirth: string;
  /** Next Mahadasha, with the "begins on <date>" notice when it starts within 12 months (item 4). */
  nextMahadasa?: {
    lord: Graha;
    lordNameEn: string;
    lordNameTa: string;
    lordNameHi: string;
    beginsOn: string;
    monthsAhead: number;
    within12Months: boolean;
  };
  mahadashaChangeNoticeEn?: string;
  mahadashaChangeNoticeTa?: string;
  mahadashaChangeNoticeHi?: string;
}

export interface SaniTransitStatus {
  isEzharaiSani: boolean;
  ezharaiTypeTa: string;
  ezharaiTypeEn: string;
  ezharaiTypeHi: string;
  isAshtamaSani: boolean;
  isKandakaSani: boolean;
  remedyTa: string;
  remedyEn: string;
  remedyHi: string;
}

export interface DoshaCheckResult {
  nameTa: string;
  nameEn: string;
  nameHi: string;
  /** null = the chart lacks the placements needed to decide (never a "clean" result). */
  isPresent: boolean | null;
  isNavagrahaAfflictionIndicator?: boolean;
  /** Kuja tri-state: 'none' | 'present' | 'present-cancelled' (item 2). */
  verdict?: 'none' | 'present' | 'present-cancelled' | 'not-assessed';
  verdictLabelEn?: string;
  verdictLabelTa?: string;
  verdictLabelHi?: string;
  /** Pitru strength: 'present' | 'weak' (same sign only) | 'none' (item 5). */
  strength?: 'present' | 'weak' | 'none';
  strengthLabelEn?: string;
  strengthLabelTa?: string;
  strengthLabelHi?: string;
  /** Fuller ancestral remedy (item 5) — kept beside traditionalRemedy*, not instead of it. */
  extendedRemedyEn?: string;
  extendedRemedyTa?: string;
  extendedRemedyHi?: string;
  /** Rule that triggered a simplified indicator, printed under it (item 7c). */
  ruleCode?: string;
  ruleEn?: string;
  ruleTa?: string;
  ruleHi?: string;
  severityTa: string;
  severityEn: string;
  severityHi: string;
  descriptionTa: string;
  descriptionEn: string;
  descriptionHi: string;
  traditionalRemedyTa: string;
  traditionalRemedyEn: string;
  traditionalRemedyHi: string;
}

export interface LifeAspectSummary {
  healthTa: string;
  healthEn: string;
  healthHi: string;
  wealthTa: string;
  wealthEn: string;
  wealthHi: string;
  educationTa: string;
  educationEn: string;
  educationHi: string;
  careerTa: string;
  careerEn: string;
  careerHi: string;
  marriageTa: string;
  marriageEn: string;
  marriageHi: string;
  familyTa: string;
  familyEn: string;
  familyHi: string;
  foreignTravelTa: string;
  foreignTravelEn: string;
  foreignTravelHi: string;
  currentPeriodGuidanceTa: string;
  currentPeriodGuidanceEn: string;
  currentPeriodGuidanceHi: string;
}

export interface HoroscopeResult {
  devoteeName: string;
  gender?: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:mm
  birthPlace: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timeZoneId?: string;
  ayanamsa: number;
  /** Julian Day (UT) the chart was computed for — the epoch the ayanamsa belongs to. */
  julianDay?: number;
  /** Ayanamsa convention behind `ayanamsa`: 'TRUE' (mean Lahiri + Δψ) or 'MEAN'. */
  ayanamsaMode?: 'TRUE' | 'MEAN';
  /** Lunar-node convention used for Rahu/Ketu: 'TRUE' (osculating) or 'MEAN'. */
  nodeType?: 'TRUE' | 'MEAN';
  lagnaRasi: Rasi;
  lagnaRasiNumber?: number; // alias for lagnaRasi
  lagnaRasiNameTa: string;
  lagnaRasiNameEn: string;
  lagnaRasiNameHi: string;
  lagnaDegrees: number;
  lagnaNavamsaRasi?: Rasi;
  lagnaNavamsaRasiNameTa?: string;
  lagnaNavamsaRasiNameEn?: string;
  lagnaNavamsaRasiNameHi?: string;
  isLagnaVargottama?: boolean;
  chandraRasi: Rasi;
  chandraRasiNameTa: string;
  chandraRasiNameEn: string;
  chandraRasiNameHi: string;
  janmaNakshatraTa: string;
  janmaNakshatraEn: string;
  janmaNakshatraHi: string;
  nakshatraTa?: string;
  nakshatraEn?: string;
  nakshatraHi?: string;
  janmaNakshatraIndex: number; // 0 to 26
  janmaPada: number; // 1 to 4
  planetPositions: PlanetPosition[];
  bhavas: BhavaDetail[];
  navamsaPositions: Record<string, { rasi: Rasi; rasiNameTa: string; rasiNameEn: string; rasiNameHi: string; isVargottama?: boolean }>;
  dashaPeriods: DashaPeriod[];
  currentDasha?: CurrentDashaInfo;
  saniStatus: SaniTransitStatus;
  doshas: DoshaCheckResult[];
  /** Graha Yuddha pairs (Mars/Mercury/Jupiter/Venus/Saturn within 1°) — item 7a. */
  grahaYuddha?: Array<{
    planetA: string;
    planetB: string;
    planetANameEn: string;
    planetANameTa: string;
    planetANameHi: string;
    planetBNameEn: string;
    planetBNameTa: string;
    planetBNameHi: string;
    separationDegrees: number;
    winner: string;
    loser: string;
    winnerNameEn: string;
    winnerNameTa: string;
    winnerNameHi: string;
    loserNameEn: string;
    loserNameTa: string;
    loserNameHi: string;
    winnerLatitude: number;
    loserLatitude: number;
    descriptionEn: string;
    descriptionTa: string;
    descriptionHi: string;
  }>;
  /** Kendradhipati dosha for Jupiter/Mercury owning two kendras — item 7b. */
  kendradhipati?: Array<{
    graha: string;
    grahaNameEn: string;
    grahaNameTa: string;
    grahaNameHi: string;
    houses: number[];
    signs: number[];
    appliesToLagnaLord: boolean;
    isDosha: boolean;
    descriptionEn: string;
    descriptionTa: string;
    descriptionHi: string;
  }>;
  /** Sarala yoga, Saturn in own sign, 9th lord in the 8th caution — item 6. */
  yogas?: Array<{
    code: string;
    nameEn: string;
    nameTa: string;
    nameHi: string;
    severity: 'auspicious' | 'caution';
    descriptionEn: string;
    descriptionTa: string;
    descriptionHi: string;
  }>;
  /** Pitru strength summary so a renderer can badge it without scanning doshas. */
  pitruStrength?: 'present' | 'weak' | 'none';
  summary: LifeAspectSummary;
  generatedAt: string;
}

// Marriage Compatibility (10 Poruthams) Types
export enum PoruthamStatus {
  UTTHAMAM = 'UTTHAMAM', // Good / Auspicious (1.0)
  MADHYAMAM = 'MADHYAMAM', // Moderate (0.5)
  PORUNDHADHU = 'PORUNDHADHU' // Not Compatible (0.0)
}

export interface SinglePoruthamResult {
  id: string;
  nameTa: string;
  nameEn: string;
  nameHi: string;
  status: PoruthamStatus;
  pointsEarned: number;
  maxPoints: number;
  explanationTa: string;
  explanationEn: string;
  explanationHi: string;
  isCrucial: boolean;
  /** Actual Yoni pair used for this row, when `id === 'yoni'`. */
  yoniBrideAnimalTa?: string;
  yoniBrideAnimalEn?: string;
  yoniBrideAnimalHi?: string;
  yoniGroomAnimalTa?: string;
  yoniGroomAnimalEn?: string;
  yoniGroomAnimalHi?: string;
  yoniRelationship?: 'same' | 'friend' | 'neutral' | 'enemy';
}

export type MarriageKujaReference = 'lagna' | 'moon' | 'venus';

export interface SevvayDoshamAnalysis {
  isBrideHasDosham: boolean | null;
  isGroomHasDosham: boolean | null;
  brideDoshamSeverityTa: string;
  brideDoshamSeverityEn: string;
  brideDoshamSeverityHi: string;
  groomDoshamSeverityTa: string;
  groomDoshamSeverityEn: string;
  groomDoshamSeverityHi: string;
  brideCancellationReasonTa?: string | null;
  brideCancellationReasonEn?: string | null;
  brideCancellationReasonHi?: string | null;
  groomCancellationReasonTa?: string | null;
  groomCancellationReasonEn?: string | null;
  groomCancellationReasonHi?: string | null;
  /** Whole-sign Mars houses from the three references used by Kuja Dosha. */
  brideMarsHouses?: { lagna: number | null; moon: number | null; venus: number | null } | null;
  groomMarsHouses?: { lagna: number | null; moon: number | null; venus: number | null } | null;
  /** References that actually triggered the raw Kuja Dosha assessment. */
  brideAfflictedFrom?: MarriageKujaReference[];
  groomAfflictedFrom?: MarriageKujaReference[];
  brideDoshaStatus?: 'NOT_ASSESSED' | 'DOSHA_NONE' | 'DOSHA_CANCELLED' | 'DOSHA_MILD' | 'DOSHA_PRESENT';
  groomDoshaStatus?: 'NOT_ASSESSED' | 'DOSHA_NONE' | 'DOSHA_CANCELLED' | 'DOSHA_MILD' | 'DOSHA_PRESENT';
  doshaSamyamStatusTa: string;
  doshaSamyamStatusEn: string;
  doshaSamyamStatusHi: string;
  recommendationTa: string;
  recommendationEn: string;
  recommendationHi: string;
}

export interface WeddingMatchResult {
  brideName: string;
  brideDob: string;
  brideTob: string;
  bridePlace: string;
  brideRasi: Rasi;
  brideRasiNameTa: string;
  brideRasiNameEn: string;
  brideRasiNameHi: string;
  brideNakshatraNameTa: string;
  brideNakshatraNameEn: string;
  brideNakshatraNameHi: string;
  bridePada: number;
  brideLagnaNameTa?: string;
  brideLagnaNameEn?: string;
  brideLagnaNameHi?: string;
  brideMarsHouse: number | null;

  groomName: string;
  groomDob: string;
  groomTob: string;
  groomPlace: string;
  groomRasi: Rasi;
  groomRasiNameTa: string;
  groomRasiNameEn: string;
  groomRasiNameHi: string;
  groomNakshatraNameTa: string;
  groomNakshatraNameEn: string;
  groomNakshatraNameHi: string;
  groomPada: number;
  groomLagnaNameTa?: string;
  groomLagnaNameEn?: string;
  groomLagnaNameHi?: string;
  groomMarsHouse: number | null;

  poruthams: SinglePoruthamResult[];
  totalPoruthamsMatched: number;
  totalScore: number;
  maxScore: number;
  overallVerdictTa: string;
  overallVerdictEn: string;
  overallVerdictHi: string;
  verdictStatus: PoruthamStatus;
  rajjuMatch: boolean;
  /** Added for newer results; absent on older saved marriage reports. */
  vedhaMatch?: boolean;
  sevvayDosham: SevvayDoshamAnalysis;
  generatedAt: string;
  /** Server/report generation zone used to render the issued timestamp. */
  generatedAtTimeZoneId?: string;
  bride?: HoroscopeResult;
  groom?: HoroscopeResult;
  score?: number;
  inputPayload?: any;
}

// Baby Naming Types
export interface PadaLetterInfo {
  padaNumber: number;
  letterTa: string;
  letterEn: string;
  letterHi: string;
  rasi: Rasi;
  rasiTa: string;
  rasiEn: string;
  rasiHi: string;
}

export interface NakshatraBabyLetters {
  nakshatraIndex: number;
  nakshatraNameTa: string;
  nakshatraNameEn: string;
  nakshatraNameHi: string;
  deityTa: string;
  deityEn: string;
  deityHi: string;
  lordTa: string;
  lordEn: string;
  lordHi: string;
  ganaTa: string;
  ganaEn: string;
  ganaHi: string;
  yoniTa: string;
  yoniEn: string;
  yoniHi: string;
  rajjuTa: string;
  rajjuEn: string;
  rajjuHi: string;
  padas: PadaLetterInfo[];
  allLettersSummaryTa: string;
  allLettersSummaryEn: string;
  allLettersSummaryHi: string;
}

export interface BabyNameSuggestion {
  nameTa: string;
  nameEn: string;
  nameHi: string;
  gender: 'M' | 'F';
  meaningTa: string;
  meaningEn: string;
  meaningHi: string;
  startingLetter: string;
}

import type { NamakaranPadaNames } from './namakaranNames.js';

export interface BabyNamingResult {
  /** Versioned so stored reports can be refreshed when naming rules improve. */
  babyNamingAlgorithmVersion: number;
  babyName: string;
  gender: 'M' | 'F';
  dob: string;
  tob: string;
  birthPlace: string;
  country: string;
  /** Calculation provenance used to reject cached results for changed birth inputs. */
  latitude?: number;
  longitude?: number;
  timezoneOffsetHours?: number;
  timeZoneId?: string;
  nakshatraLetters: NakshatraBabyLetters;
  janmaPada: number;
  primaryPadaInfo: PadaLetterInfo;
  chandraRasi: Rasi;
  chandraRasiNameTa: string;
  chandraRasiNameEn: string;
  chandraRasiNameHi: string;
  lagnaRasi: Rasi;
  lagnaRasiNameTa: string;
  lagnaRasiNameEn: string;
  lagnaRasiNameHi: string;
  suggestedNames: BabyNameSuggestion[];
  /**
   * Page 2 of the Vedic Namakaran report: for every pada of the birth star the
   * South Indian and North Indian name lists for the baby's gender.
   * Optional because orders stored before page 2 existed do not carry it —
   * the HTML builders rebuild it on the fly in that case.
   */
  nameSuggestions?: NamakaranPadaNames[];
  generatedAt: string;
}

export interface PanchangamResult {
  date: string;
  time: string;
  cityName: string;
  country: string;
  latitude: number;
  longitude: number;
  tithiIndex: number;
  tithiNameEn: string;
  tithiNameTa: string;
  tithiNameHi: string;
  tithiPaksha: 'Shukla' | 'Krishna';
  tithiProgressPercent: number;
  nakshatraIndex: number;
  nakshatraNameEn: string;
  nakshatraNameTa: string;
  nakshatraNameHi: string;
  nakshatraPada: number;
  nakshatraProgressPercent: number;
  varaIndex: number;
  varaNameEn: string;
  varaNameTa: string;
  varaNameHi: string;
  yogaIndex: number;
  yogaNameEn: string;
  yogaNameTa: string;
  yogaNameHi: string;
  karanaIndex: number;
  karanaNameEn: string;
  karanaNameTa: string;
  karanaNameHi: string;
  rahuKalam: { start: string; end: string };
  yamaGandam: { start: string; end: string };
  gulikaKalam: { start: string; end: string };
  abhijitMuhurtham: { start: string; end: string };
  sunriseTime: string;
  sunsetTime: string;
  moonriseTime?: string;
  moonsetTime?: string;
}
