import { HoroscopeResult, AppLanguage, Rasi, Graha } from '../lib/astrology/types';
import { REPORT_FONT_LINK_TAG } from './reportFonts';
import {
  JATHAGAM_PLANET_PROFILES,
  NAVAGRAHA_DOSHA_DATA,
  NAVAGRAHA_GUIDANCE,
  NAVAGRAHA_ORDER,
  NAVAGRAHA_TABLE_HEADINGS,
  SHORT_SUMMARY_REMEDY_LABELS,
  SHORT_SUMMARY_TEXT
} from './jathagamDoshaData';
import { classifyJathagamPlanetsForSummary } from './jathagamPlanetSummary';
import { withDerivedNavamsa } from './navamsa';
import { kujaDoshaFromHoroscope } from '../lib/astrology/kujaDosha';
import {
  dignityCardLine,
  debilitationSign,
  EXALTATION_SIGN,
  OWN_SIGNS
} from '../lib/astrology/dignity';
import { formatBirthPlace } from './formatUtils';
import { formatUtcOffset } from '../lib/timezone';
import { buildReportHeaderHtml, reportHeaderCss } from './reportHeader';
import { fitJathagamLifeCardText, fitJathagamSummaryText } from './jathagamLifeCardLayout';
import { normalizeReportLanguage } from './reportLanguage';

// Rasi names in 3 languages
export const RASI_NAMES_REPORT: Record<number, { en: string; ta: string; hi: string }> = {
  1: { en: 'Mesham', ta: 'மேஷம்', hi: 'मेष' },
  2: { en: 'Rishabam', ta: 'ரிஷபம்', hi: 'वृषभ' },
  3: { en: 'Mithunam', ta: 'மிதுனம்', hi: 'मिथुन' },
  4: { en: 'Kadagam', ta: 'கடகம்', hi: 'कर्क' },
  5: { en: 'Simham', ta: 'சிம்மம்', hi: 'सिंह' },
  6: { en: 'Kanni', ta: 'கன்னி', hi: 'कन्या' },
  7: { en: 'Thulam', ta: 'துலாம்', hi: 'तुला' },
  8: { en: 'Viruchigam', ta: 'விருச்சிகம்', hi: 'वृश्चिक' },
  9: { en: 'Dhanusu', ta: 'தனுசு', hi: 'धनु' },
  10: { en: 'Magaram', ta: 'மகரம்', hi: 'मकर' },
  11: { en: 'Kumbam', ta: 'கும்பம்', hi: 'कुंभ' },
  12: { en: 'Meenam', ta: 'மீனம்', hi: 'मीन' }
};

// Planet names transliterated in English (Surya, Chandra, Mangal, Budha, Guru, Sukra, Sani, Rahu, Ketu)
export const GRAHA_NAMES_REPORT: Record<string, { en: string; ta: string; hi: string; tagEn: string; tagTa: string; tagHi: string }> = {
  [Graha.SURYA]: { en: 'Surya', ta: 'சூரியன்', hi: 'सूर्य', tagEn: 'Su', tagTa: 'சூ', tagHi: 'सू' },
  [Graha.CHANDRA]: { en: 'Chandra', ta: 'சந்திரன்', hi: 'चंद्र', tagEn: 'Ch', tagTa: 'சந்', tagHi: 'चं' },
  [Graha.CHEVVAI]: { en: 'Mangal', ta: 'செவ்வாய்', hi: 'मंगल', tagEn: 'Ma', tagTa: 'செவ்', tagHi: 'मं' },
  [Graha.BUDHA]: { en: 'Budha', ta: 'புதன்', hi: 'बुध', tagEn: 'Bu', tagTa: 'பு', tagHi: 'बु' },
  [Graha.GURU]: { en: 'Guru', ta: 'குரு', hi: 'गुरु', tagEn: 'Gu', tagTa: 'குரு', tagHi: 'गु' },
  [Graha.SUKRA]: { en: 'Sukra', ta: 'சுக்கிரன்', hi: 'शुक्र', tagEn: 'Sk', tagTa: 'சுக்', tagHi: 'शु' },
  [Graha.SANI]: { en: 'Sani', ta: 'சனி', hi: 'शनि', tagEn: 'Sa', tagTa: 'சனி', tagHi: 'श' },
  [Graha.RAHU]: { en: 'Rahu', ta: 'ராகு', hi: 'राहु', tagEn: 'Ra', tagTa: 'ரா', tagHi: 'रा' },
  [Graha.KETU]: { en: 'Ketu', ta: 'கேது', hi: 'केतु', tagEn: 'Ke', tagTa: 'கே', tagHi: 'के' }
};

// Rasi Lord Graha mapping
export const RASI_LORDS_MAP: Record<number, Graha> = {
  1: Graha.CHEVVAI,
  2: Graha.SUKRA,
  3: Graha.BUDHA,
  4: Graha.CHANDRA,
  5: Graha.SURYA,
  6: Graha.BUDHA,
  7: Graha.SUKRA,
  8: Graha.CHEVVAI,
  9: Graha.GURU,
  10: Graha.SANI,
  11: Graha.SANI,
  12: Graha.GURU
};

/**
 * House ordinals. English needs 1st/2nd/3rd rather than "1th"/"2th"/"3th", and
 * Hindi uses distinct words for the first three houses, so the numbers are
 * mapped explicitly instead of suffixing a generic ending.
 */
const ENGLISH_HOUSE_ORDINALS = [
  '', '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th'
];
const HINDI_HOUSE_ORDINALS = [
  '', 'पहले', 'दूसरे', 'तीसरे', 'चौथे', 'पांचवें', 'छठे',
  'सातवें', 'आठवें', 'नौवें', 'दसवें', 'ग्यारहवें', 'बारहवें'
];
const enOrdinal = (n: number): string => ENGLISH_HOUSE_ORDINALS[n] || `${n}th`;
const hiOrdinal = (n: number): string => HINDI_HOUSE_ORDINALS[n] || `${n}वें`;

const isValidRasiValue = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};
const isValidBhavaValue = (value: unknown): value is number => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 12;
};

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface JathagamLifeCard {
  icon: string;
  badge: string;
  title: string;
  desc: string;
}

/**
 * A malefic counts as a STRONG conjunction partner only inside this orb.
 * The classical reading blends two grahas sharply within about 8–10°; a
 * same-sign pair 20° apart is "in one sign but largely delivering its results
 * separately" and must not be reported as a close conjunction. Ketu/Rahu,
 * Mars and Saturn inside this window are the case the cards care about.
 */
export const MALEFIC_CONJUNCTION_ORB_DEG = 10;

/** Longitude of a graha on the sidereal zodiac, or null when the row lacks one. */
function grahaLongitude(position: { rasi?: unknown; degrees?: unknown; totalDegrees?: unknown } | undefined): number | null {
  if (!position) return null;
  if (Number.isFinite(position.totalDegrees)) {
    const total = Number(position.totalDegrees);
    return ((total % 360) + 360) % 360;
  }
  if (isValidRasiValue(position.rasi) && Number.isFinite(position.degrees)) {
    const total = (Number(position.rasi) - 1) * 30 + Number(position.degrees);
    return ((total % 360) + 360) % 360;
  }
  return null;
}

/** Shortest angular distance between two zodiacal longitudes (0..180°). */
function longitudeSeparation(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

/**
 * Build the page-2 interpretation cards from the same whole-sign house-lord
 * rule used by the browser report. This deliberately describes traditional
 * indicators, not certainties: a house-lord placement is only one part of a
 * Jyotisha reading and is never medical, financial, legal, or relationship
 * advice.
 */
export function buildJathagamLifeCards(result: HoroscopeResult, lang: AppLanguage = 'en'): JathagamLifeCard[] {
  lang = normalizeReportLanguage(lang);
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';
  const lagnaRasiValid = isValidRasiValue(result.lagnaRasi);
  const chandraRasiValid = isValidRasiValue(result.chandraRasi);
  const lagnaRasi = lagnaRasiValid ? Number(result.lagnaRasi) : null;
  const chandraRasi = chandraRasiValid ? Number(result.chandraRasi) : null;
  const rasiSignName = chandraRasi !== null ? RASI_NAMES_REPORT[chandraRasi]?.[lang] || 'N/A' : 'N/A';

  /**
   * Item 4: debilitation is taken from dignity.ts — the single source of truth
   * shared with the PHP engine — not from a second, card-local table. The seven
   * classical grahas keep their classical Neecha rasi; Rahu and Ketu have NO
   * debilitation sign here, because the classical texts do not agree on one
   * (Taurus/Scorpio vs Gemini/Sagittarius schools), and dignity.ts reports the
   * nodes as 'not-applicable'. The old card table invented Rahu-in-Scorpio and
   * Ketu-in-Taurus, so a card could call a node debilitated while the Navagraha
   * table on the same report said the nodes have no sign dignity.
   */
  const isDebilitatedGraha = (
    graha: Graha,
    position: { rasi?: unknown; dignity?: { isDebilitated: boolean } } | undefined
  ): boolean => {
    if (position?.dignity) return Boolean(position.dignity.isDebilitated);
    const neechaSign = debilitationSign(graha);
    if (neechaSign === null || !isValidRasiValue(position?.rasi)) return false;
    return Number(position?.rasi) === neechaSign;
  };
  /**
   * Exaltation / own sign when the engine did not attach a dignity block —
   * same two tables dignity.ts uses, so the fallback cannot disagree with it.
   */
  const isDignifiedGraha = (
    graha: Graha,
    rasi: number,
    position: { dignity?: { isExalted: boolean; isOwnSign: boolean } } | undefined
  ): boolean => {
    if (position?.dignity) return Boolean(position.dignity.isExalted || position.dignity.isOwnSign);
    return EXALTATION_SIGN[graha] === rasi || (OWN_SIGNS[graha] ?? []).includes(rasi);
  };
  const naturalMalefics = new Set<Graha>([Graha.CHEVVAI, Graha.SANI, Graha.RAHU, Graha.KETU]);
  const supportHouses = new Set([1, 4, 5, 7, 9, 10, 11]);
  const activeDashaPeriod = result.dashaPeriods?.find(d => d.isCurrent);
  const currentDashaLordEn = result.currentDasha?.mahadashaLordEn || activeDashaPeriod?.lordNameEn || '';
  const currentAntarLordEn = result.currentDasha?.antardashaLordEn
    || activeDashaPeriod?.antardashas?.find(a => a.isCurrent)?.lordNameEn
    || '';
  const currentDashaLabel = result.currentDasha
    ? isTa
      ? `${result.currentDasha.mahadashaLordTa} மகாதிசை / ${result.currentDasha.antardashaLordTa} புக்தி`
      : isHi
      ? `${result.currentDasha.mahadashaLordHi} महादशा / ${result.currentDasha.antardashaLordHi} अंतर्दशा`
      : `${currentDashaLordEn} Mahadasha${currentAntarLordEn ? ` / ${currentAntarLordEn} Bhukti` : ''}`
    : activeDashaPeriod
    ? isTa
      ? `${activeDashaPeriod.lordNameTa} மகாதிசை`
      : isHi
      ? `${activeDashaPeriod.lordNameHi} महादशा`
      : `${activeDashaPeriod.lordNameEn} Mahadasha`
    : 'N/A';

  const getHousePlacement = (houseNum: number) => {
    if (lagnaRasi === null) return null;
    const targetSign = ((lagnaRasi - 1 + (houseNum - 1)) % 12) + 1;
    const lordGraha = RASI_LORDS_MAP[targetSign];
    const lordPos = (result.planetPositions || []).find(p => p.graha === lordGraha);
    if (!lordPos || !isValidRasiValue(lordPos.rasi) || !isValidBhavaValue(lordPos.bhavaNumber)) return null;

    const bhava = Number(lordPos.bhavaNumber);
    const placedRasi = Number(lordPos.rasi);
    const gInfo = GRAHA_NAMES_REPORT[lordGraha];
    const lordName = gInfo ? gInfo[lang] : '';
    const isDusthana = [6, 8, 12].includes(bhava);
    const isDebilitated = isDebilitatedGraha(lordGraha, lordPos);
    const isDignifiedLord = isDignifiedGraha(lordGraha, placedRasi, lordPos);
    const isCombust = Boolean(lordPos.isCombust);
    const isRetrograde = Boolean(lordPos.isRetrograde);
    const lordLongitude = grahaLongitude(lordPos);
    // Item 2: a malefic is "joined" only within MALEFIC_CONJUNCTION_ORB_DEG of
    // the lord's longitude. Sharing a sign is not enough: two grahas 20° apart
    // in one rasi were reported as conjunct even though the blend is weak.
    const maleficContacts: { name: string; graha: Graha; debilitated: boolean }[] = [];
    if (lordLongitude !== null) {
      for (const p of result.planetPositions || []) {
        if (p.graha === lordGraha || !naturalMalefics.has(p.graha)) continue;
        if (!isValidBhavaValue(p.bhavaNumber)) continue;
        const maleficLongitude = grahaLongitude(p);
        if (maleficLongitude === null) continue;
        if (longitudeSeparation(maleficLongitude, lordLongitude) > MALEFIC_CONJUNCTION_ORB_DEG) continue;
        maleficContacts.push({
          name: GRAHA_NAMES_REPORT[p.graha]?.[lang] || p.nameEn,
          graha: p.graha,
          // Item 3b: a debilitated malefic is in its weakest state, so it is
          // NOT counted as a strong malefic (e.g. Mars in Kadagam).
          debilitated: isDebilitatedGraha(p.graha, p)
        });
      }
    }
    const strongMalefics = maleficContacts.filter(contact => !contact.debilitated);
    const weakMaleficNames = maleficContacts.filter(contact => contact.debilitated).map(contact => contact.name);
    // Item 3a: a lord that is exalted or in its own sign overrides ONE malefic
    // conjunction — a graha in uchcha/swakshetra is strong enough not to be
    // dominated by a single malefic yuti (and the same dignity offsets a single
    // combustion or affliction in classical reading).
    const dignityOffsetCount = isDignifiedLord && strongMalefics.length > 0 ? 1 : 0;
    const countedMalefics = strongMalefics.slice(dignityOffsetCount);
    const offsetMaleficNames = strongMalefics.slice(0, dignityOffsetCount).map(contact => contact.name);
    const conjunctMalefics = countedMalefics.map(contact => contact.name).slice(0, 2);
    const isOwnHouse = bhava === houseNum;
    const isSupportive = isOwnHouse || (!isDusthana && supportHouses.has(bhava));
    const isChallenging = isDusthana || isDebilitated || isCombust || conjunctMalefics.length > 0;
    const reasonsEn = [
      isDusthana ? `placed in a challenging ${enOrdinal(bhava)} house` : '',
      isDebilitated ? 'debilitated' : '',
      isCombust ? 'combust/too close to Sun' : '',
      conjunctMalefics.length ? `joined within ${MALEFIC_CONJUNCTION_ORB_DEG}° with ${conjunctMalefics.join('/')}` : '',
      offsetMaleficNames.length ? `exalted/own-sign lord offsets one malefic conjunction (${offsetMaleficNames.join('/')})` : '',
      weakMaleficNames.length ? `${weakMaleficNames.join('/')} is debilitated, so not counted as a strong malefic` : '',
      isRetrograde ? 'retrograde, requiring review and patience' : ''
    ].filter(Boolean);
    const reasonsTa = [
      isDusthana ? `${bhava}-ஆம் சவாலான பாவத்தில்` : '',
      isDebilitated ? 'நீச நிலையில்' : '',
      isCombust ? 'சூரியனுக்கு அருகில் அஸ்தமன நிலையில்' : '',
      conjunctMalefics.length ? `${MALEFIC_CONJUNCTION_ORB_DEG}°-க்குள் ${conjunctMalefics.join('/')} சேர்க்கையுடன்` : '',
      offsetMaleficNames.length ? `உச்ச/சொந்த ராசி அதிபதி ஒரு பாவச் சேர்க்கையை ஈடுசெய்கிறார் (${offsetMaleficNames.join('/')})` : '',
      weakMaleficNames.length ? `${weakMaleficNames.join('/')} நீச நிலையில் உள்ளதால் வலுவான பாவ கிரகமாகக் கணக்கிடப்படவில்லை` : '',
      isRetrograde ? 'வக்கிரமாக இருப்பதால் பொறுமை தேவை' : ''
    ].filter(Boolean);
    const reasonsHi = [
      isDusthana ? `${hiOrdinal(bhava)} चुनौतीपूर्ण भाव में` : '',
      isDebilitated ? 'नीच राशि में' : '',
      isCombust ? 'सूर्य के निकट अस्त' : '',
      conjunctMalefics.length ? `${MALEFIC_CONJUNCTION_ORB_DEG}° के भीतर ${conjunctMalefics.join('/')} के साथ` : '',
      offsetMaleficNames.length ? `उच्च/स्वराशि का स्वामी एक पाप-युति की भरपाई करता है (${offsetMaleficNames.join('/')})` : '',
      weakMaleficNames.length ? `${weakMaleficNames.join('/')} नीच होने से प्रबल पाप ग्रह नहीं माना गया` : '',
      isRetrograde ? 'वक्री होने से धैर्य आवश्यक' : ''
    ].filter(Boolean);
    // Item 3: when the card's lord is debilitated (e.g. Mars as the Lagna lord
    // in the Health card, or the 10th lord in the Career card) the card names
    // the Neecha Bhanga rule that applies and carries the caveat.
    const dignityNote = dignityCardLine(lordPos.dignity, lang);
    const reasons = isTa ? reasonsTa : isHi ? reasonsHi : reasonsEn;
    if (dignityNote) reasons.push(dignityNote);
    return {
      targetSign,
      lordGraha,
      lordName,
      bhava,
      isOwnHouse,
      isDusthana,
      isDebilitated,
      isCombust,
      isRetrograde,
      isSupportive,
      isChallenging,
      dignityNote,
      reason: reasons.join(', ')
    };
  };

  const unavailablePlacement = isTa
    ? 'தேவையான லக்னம் அல்லது கிரக பாவத் தகவல் கிடைக்கவில்லை; விளக்கம் உருவாக்கப்படவில்லை.'
    : isHi
    ? 'आवश्यक लग्न या ग्रह-भाव जानकारी उपलब्ध नहीं है; व्याख्या नहीं बनाई गई।'
    : 'Required Ascendant or planet-house data is unavailable; no interpretation was generated.';
  const unavailableDasha = isTa
    ? 'நடப்பு தசை அல்லது சந்திர ராசித் தகவல் கிடைக்கவில்லை; வழிகாட்டல் உருவாக்கப்படவில்லை.'
    : isHi
    ? 'वर्तमान दशा या चंद्र राशि उपलब्ध नहीं है; मार्गदर्शन नहीं बनाया गया।'
    : 'Current Dasha or Moon-sign data is unavailable; no guidance was generated.';
  const badgeFor = (base: string, p: ReturnType<typeof getHousePlacement>) => {
    if (!p) return `${base} · N/A`;
    const suffix = p.isChallenging
      ? (isTa ? ' ⚠ கவனம்' : isHi ? ' ⚠ सावधान' : ' ⚠ Caution')
      : (isTa ? ' ✓ பலம்' : isHi ? ' ✓ बल' : ' ✓ Strength');
    return `${base}${suffix}`;
  };
  const status = (p: ReturnType<typeof getHousePlacement>) => !p
    ? unavailablePlacement
    : p.reason || (isTa ? `${p.lordName} ஆதரவு நிலையில்` : isHi ? `${p.lordName} सहायक स्थिति में` : `${p.lordName} in a supportive placement`);
  const posWord = (p: ReturnType<typeof getHousePlacement>) => !p
    ? 'N/A'
    : isTa
    ? `${p.lordName} ${p.bhava}-ஆம் பாவத்தில்`
    : isHi
    ? `${p.lordName} ${hiOrdinal(p.bhava)} भाव में`
    : `${p.lordName} in the ${enOrdinal(p.bhava)} house`;

  /**
   * Item 6: karaka (significator) lines. Each card reads its natural karaka
   * alongside the house lord it already uses:
   *   Venus     — natural karaka of marriage (Marriage & Relations card);
   *   Jupiter   — natural karaka of wealth and fortune (Wealth card);
   *   11th lord — Labha Bhava, the house of income/gains (Wealth card);
   *   6th lord  — Roga Bhava, the house of health/disease (Health card).
   * A missing planet row yields '' so the cards fail closed instead of
   * inventing a placement.
   */
  const karakaLine = (graha: Graha, role: { en: string; ta: string; hi: string }): string => {
    const pos = (result.planetPositions || []).find(p => p.graha === graha);
    if (!pos || !isValidBhavaValue(pos.bhavaNumber)) return '';
    const bhava = Number(pos.bhavaNumber);
    const name = GRAHA_NAMES_REPORT[graha]?.[lang] || pos.nameEn || String(graha);
    const rasiName = isValidRasiValue(pos.rasi) ? (RASI_NAMES_REPORT[Number(pos.rasi)]?.[lang] || '') : '';
    const dignity = pos.dignity
      ? (isTa ? pos.dignity.statusTa : isHi ? pos.dignity.statusHi : pos.dignity.statusEn)
      : '';
    const place = isTa
      ? `${bhava}-ஆம் பாவத்தில்`
      : isHi
      ? `${hiOrdinal(bhava)} भाव में`
      : `in the ${enOrdinal(bhava)} house`;
    const dignityText = dignity && !/^(Neutral|சம நிலை|सामान्य स्थिति)/.test(dignity) ? ` (${dignity})` : '';
    return ` ${role[lang]}: ${name} ${place}${dignityText}${rasiName ? ` — ${rasiName}` : ''}.`;
  };
  const lordLine = (houseNum: number, role: { en: string; ta: string; hi: string }): string => {
    const placement = getHousePlacement(houseNum);
    if (!placement) return '';
    const state = placement.isChallenging
      ? (isTa ? 'கவனம் தேவை' : isHi ? 'ध्यान आवश्यक' : 'needs attention')
      : (isTa ? 'ஆதரவு நிலை' : isHi ? 'सहायक स्थिति' : 'supportive');
    return ` ${role[lang]}: ${posWord(placement)} — ${state}.`;
  };
  const venusLine = () => karakaLine(Graha.SUKRA, {
    en: 'Venus, karaka of marriage',
    ta: 'திருமண காரகன் சுக்கிரன்',
    hi: 'विवाह कारक शुक्र'
  });
  const jupiterLine = () => karakaLine(Graha.GURU, {
    en: 'Jupiter, karaka of wealth',
    ta: 'தன காரகன் குரு',
    hi: 'धन कारक गुरु'
  });
  const incomeLordLine = () => lordLine(11, {
    en: '11th lord (income/Labha)',
    ta: '11-ஆம் அதிபதி (வருமானம்/லாபம்)',
    hi: '11वें भाव का स्वामी (आय/लाभ)'
  });
  const healthLordLine = () => lordLine(6, {
    en: '6th lord (health/Roga)',
    ta: '6-ஆம் அதிபதி (ஆரோக்கியம்/ரோகம்)',
    hi: 'छठे भाव का स्वामी (स्वास्थ्य/रोग)'
  });

  const h1 = getHousePlacement(1);
  const h2 = getHousePlacement(2);
  const h5 = getHousePlacement(5);
  const h10 = getHousePlacement(10);
  const h7 = getHousePlacement(7);
  const h4 = getHousePlacement(4);
  const h9 = getHousePlacement(9);
  /**
   * Item 1: resolve the running Mahadasa lord from the engine's Graha ENUM —
   * `currentDasha.mahadashaLord` / `dashaPeriods[].mahadashaLord` — never by
   * matching the English display text. The report's own labels are
   * "Sukra"/"Sani" while the dasha block says "Venus"/"Saturn", so the old
   * substring match silently returned undefined for exactly those two lords
   * and their dasha periods were never assessed (badge "N/A", no caution).
   */
  const currentDashaGraha: Graha | undefined =
    result.currentDasha?.mahadashaLord
    ?? activeDashaPeriod?.mahadashaLord
    ?? undefined;
  // Item 4: the guidance card always names the running Mahadasa/Bhukti and,
  // when a Mahadasa changes inside the next 12 months, prints the start date.
  const dashaChangeNotice = (result.currentDasha
    ? (isTa ? result.currentDasha.mahadashaChangeNoticeTa
       : isHi ? result.currentDasha.mahadashaChangeNoticeHi
       : result.currentDasha.mahadashaChangeNoticeEn)
    : '') || '';
  // Item 6: a 9th lord in the 8th is a caution, never "நன்மை / Good". The
  // Sarala yoga (8th lord in the 8th) and own-sign Saturn are named when they
  // apply, and Kendradhipati is carried into the Career and Marriage cards.
  const ninthLordInEighth = (result.yogas || []).some(y => y.code === 'NINTH_LORD_IN_EIGHTH');
  const saralaYoga = (result.yogas || []).find(y => y.code === 'SARALA');
  const saturnOwnSignYoga = (result.yogas || []).find(y => y.code === 'SATURN_OWN_SIGN');
  const yogaSentence = (y: { nameTa: string; nameEn: string; nameHi: string } | undefined) => y
    ? ` ${isTa ? y.nameTa : isHi ? y.nameHi : y.nameEn}.`
    : '';
  const fortuneLead = ninthLordInEighth
    ? (isTa ? 'கவனம்' : isHi ? 'सावधानी' : 'Caution')
    : (isTa ? 'நன்மை' : isHi ? 'शुभ' : 'Good');
  const fortuneCaution = ninthLordInEighth
    ? (isTa
        ? ' 9-ஆம் அதிபதி 8-ஆம் பாவத்தில் உள்ளதால் இது நன்மையாகக் கணக்கிடப்படவில்லை; பாக்கியம் முயற்சி, தாமதம் அல்லது ஆராய்ச்சி வழியே வரும்.'
        : isHi
        ? ' नवमेश अष्टम भाव में होने से इसे शुभ नहीं माना गया; भाग्य परिश्रम, विलंब या शोध से मिलता है।'
        : ' The 9th lord sits in the 8th house, so this is read as a caution rather than a benefit: fortune arrives through effort, delay or research.')
    : '';
  const yogaExtra = `${yogaSentence(saralaYoga)}${yogaSentence(saturnOwnSignYoga)}`;
  const kendraSentence = (k: { descriptionTa: string; descriptionEn: string; descriptionHi: string } | undefined) => k
    ? ` ${isTa ? k.descriptionTa : isHi ? k.descriptionHi : k.descriptionEn}`
    : '';
  const kendraCareerText = kendraSentence((result.kendradhipati || []).find(k => k.houses.includes(10)));
  const kendraMarriageText = kendraSentence((result.kendradhipati || []).find(k => k.houses.includes(7)));

  const dashaPos = currentDashaGraha ? (result.planetPositions || []).find(p => p.graha === currentDashaGraha) : undefined;
  const dashaAssessmentAvailable = Boolean(dashaPos && isValidBhavaValue(dashaPos.bhavaNumber));
  const dashaIsChallenging = dashaAssessmentAvailable
    ? Boolean([6, 8, 12].includes(Number(dashaPos!.bhavaNumber)) || dashaPos!.isCombust || dashaPos!.isRetrograde)
    : null;

  return [
    {
      icon: '🩺',
      badge: badgeFor(isTa ? 'உடல் நலம்' : isHi ? 'आरोग्य' : 'Health', h1),
      title: isTa ? 'ஆரோக்கியம் & நல்வாழ்வு' : isHi ? 'स्वास्थ्य एवं आरोग्य' : 'Health & Vitality',
      desc: !h1 ? unavailablePlacement : isTa
        ? `நன்மை: லக்னாதிபதி ${posWord(h1)} இருப்பதால் உடல் சக்தி மேம்பட முயற்சி, உணவு ஒழுக்கம் உதவும். கவனம்: ${status(h1)}; பலவீனம் இருந்தால் உடல் வலி, சோர்வு, தோல்/வயிறு எரிச்சல் போன்ற சிறு தொந்தரவுகள் வரலாம். அறிகுறிகள் இருந்தால் மருத்துவரை அணுகவும்.${healthLordLine()}`
        : isHi
        ? `शुभ: लग्नेश ${posWord(h1)} होने से ऊर्जा संभालने में दिनचर्या, आहार और व्यायाम सहायक रहेंगे। सावधानी: ${status(h1)}; कमजोरी हो तो शरीर-दर्द, थकान, त्वचा/पेट की परेशानी हो सकती है। लक्षण हों तो डॉक्टर से मिलें।${healthLordLine()}`
        : `Good: Lagna lord ${posWord(h1)} supports vitality when routine, diet, and movement are maintained. Caution: ${status(h1)}; if weak, body pain, fatigue, skin irritation or stomach sensitivity may trouble you. Seek medical care for symptoms.${healthLordLine()}`
    },
    {
      icon: '💰',
      badge: badgeFor(isTa ? 'செல்வம்' : isHi ? 'धन' : 'Wealth', h2),
      title: isTa ? 'தனம் & நிதி நிலை' : isHi ? 'धन एवं संपत्ति' : 'Wealth & Finance',
      desc: !h2 ? unavailablePlacement : isTa
        ? `நன்மை: தனாதிபதி ${posWord(h2)} இருப்பதால் சேமிப்பு, குடும்ப ஆதரவு, வருமான திட்டம் பலன் தரலாம். கவனம்: ${status(h2)}; செலவு அதிகரிப்பு, கடன் அழுத்தம் அல்லது பணம் தாமதம் வரலாம். பட்ஜெட் அவசியம்.${jupiterLine()}${incomeLordLine()}`
        : isHi
        ? `शुभ: धनेश ${posWord(h2)} बचत, परिवार-सहयोग और आय-योजना में मदद दे सकता है। सावधानी: ${status(h2)}; खर्च, कर्ज-दबाव या पैसा अटकना दिख सकता है। बजट रखें।${jupiterLine()}${incomeLordLine()}`
        : `Good: 2nd lord ${posWord(h2)} can support savings, family resources, and income planning. Caution: ${status(h2)}; watch for higher expenses, debt pressure, or delayed payments. Keep a budget.${jupiterLine()}${incomeLordLine()}`
    },
    {
      icon: '📚',
      badge: badgeFor(isTa ? 'கல்வி' : isHi ? 'विद्या' : 'Study', h5),
      title: isTa ? 'கல்வி & அறிவுத்திறன்' : isHi ? 'शिक्षा एवं बौद्धिकता' : 'Education & Intellect',
      desc: !h5 ? unavailablePlacement : isTa
        ? `நன்மை: 5-ஆம் அதிபதி ${posWord(h5)} இருப்பதால் நினைவாற்றல், படைப்பாற்றல், தேர்வு தயாரிப்பு மேம்படலாம். கவனம்: ${status(h5)}; கவனம் சிதறல், மறதி, பாடத்தில் இடைவேளை வரலாம். தினசரி திட்டம் தேவை.`
        : isHi
        ? `शुभ: पंचमेश ${posWord(h5)} स्मरण-शक्ति, रचनात्मकता और परीक्षा-तैयारी में सहायक हो सकता है। सावधानी: ${status(h5)}; ध्यान भटकना, भूलना या पढ़ाई में रुकावट आ सकती है। दैनिक योजना रखें।`
        : `Good: 5th lord ${posWord(h5)} can help memory, creativity, and exam preparation. Caution: ${status(h5)}; concentration breaks, forgetfulness, or study gaps may occur. Use a daily study plan.`
    },
    {
      icon: '💼',
      badge: badgeFor(isTa ? 'தொழில்' : isHi ? 'कार्य' : 'Career', h10),
      title: isTa ? 'தொழில் & உத்தியோகம்' : isHi ? 'व्यवसाय एवं आजीविका' : 'Career & Profession',
      desc: !h10 ? unavailablePlacement : isTa
        ? `நன்மை: 10-ஆம் அதிபதி ${posWord(h10)} இருப்பதால் பொறுப்பு, பெயர், திறன் வளர்ச்சி வாய்ப்பு உண்டு. கவனம்: ${status(h10)}; வேலை தாமதம், மேலதிகாரி உராய்வு, திட்ட மாற்றம் வரலாம். ஆவணங்களையும் காலக்கெடுவையும் கவனிக்கவும்.${kendraCareerText}`
        : isHi
        ? `शुभ: दशमेश ${posWord(h10)} जिम्मेदारी, पहचान और कौशल-विकास में मदद दे सकता है। सावधानी: ${status(h10)}; काम में देरी, वरिष्ठों से मतभेद या योजना-बदलाव हो सकता है। दस्तावेज़ और समय-सीमा संभालें।${kendraCareerText}`
        : `Good: 10th lord ${posWord(h10)} can support responsibility, recognition, and skill growth. Caution: ${status(h10)}; delays, friction with seniors, or project changes may arise. Watch documents and deadlines.${kendraCareerText}`
    },
    {
      icon: '💍',
      badge: badgeFor(isTa ? 'உறவு' : isHi ? 'संबंध' : 'Relations', h7),
      title: isTa ? 'திருமணம் & உறவு' : isHi ? 'विवाह एवं सम्बंध' : 'Marriage & Relations',
      desc: !h7 ? unavailablePlacement : isTa
        ? `நன்மை: 7-ஆம் அதிபதி ${posWord(h7)} இருப்பதால் துணை/கூட்டாண்மை ஆதரவு கிடைக்கலாம். கவனம்: ${status(h7)}; தவறான புரிதல், தாமதம், வாக்குவாதம் வரலாம். மெதுவாக பேசுவது நல்லது.${venusLine()}${kendraMarriageText}`
        : isHi
        ? `शुभ: सप्तमेश ${posWord(h7)} जीवनसाथी/साझेदारी से सहयोग दे सकता है। सावधानी: ${status(h7)}; गलतफहमी, देरी या बहस हो सकती है। शांत संवाद रखें।${venusLine()}${kendraMarriageText}`
        : `Good: 7th lord ${posWord(h7)} can support spouse/partner cooperation. Caution: ${status(h7)}; misunderstanding, delay, or arguments may occur. Use patient communication.${venusLine()}${kendraMarriageText}`
    },
    {
      icon: '🏠',
      badge: badgeFor(isTa ? 'சொத்து' : isHi ? 'संपत्ति' : 'Property', h4),
      title: isTa ? 'வீடு, நிலம் & சொத்து' : isHi ? 'भूमि, भवन एवं संपत्ति' : 'Property & Real Estate',
      desc: !h4 ? unavailablePlacement : isTa
        ? `நன்மை: 4-ஆம் அதிபதி ${posWord(h4)} இருப்பதால் வீட்டு வசதி, வாகனம், மன அமைதி மேம்படலாம். கவனம்: ${status(h4)}; வீடு/நில ஆவண தாமதம், பழுது செலவு, குடும்ப மனஅழுத்தம் வரலாம். சரிபார்ப்பு அவசியம்.`
        : isHi
        ? `शुभ: चतुर्थेश ${posWord(h4)} घर-सुख, वाहन और मानसिक शांति में मदद दे सकता है। सावधानी: ${status(h4)}; संपत्ति कागज़, मरम्मत खर्च या घरेलू तनाव आ सकता है। जाँच ज़रूरी है।`
        : `Good: 4th lord ${posWord(h4)} can support home comfort, vehicle matters, and peace of mind. Caution: ${status(h4)}; property-document delays, repair expenses, or family stress may arise. Verify carefully.`
    },
    {
      icon: '✈️',
      badge: badgeFor(isTa ? 'பாக்கியம்' : isHi ? 'भाग्य' : 'Fortune', h9),
      title: isTa ? 'பயணம் & அதிர்ஷ்டம்' : isHi ? 'विदेश यात्रा एवं भाग्य' : 'Travel & Global Fortune',
      desc: !h9 ? unavailablePlacement : isTa
        ? `${fortuneLead}: 9-ஆம் அதிபதி ${posWord(h9)} இருப்பதால் குரு அருள், பயணம், உயர் கற்றல் வாய்ப்பு கிடைக்கலாம். கவனம்: ${status(h9)}; பயண தாமதம், விசா/ஆவண பிரச்சனை, வழிகாட்டி மாற்றம் வரலாம். முன்கூட்டியே திட்டமிடவும்.${fortuneCaution}${yogaExtra}`
        : isHi
        ? `${fortuneLead}: नवमेश ${posWord(h9)} गुरु-कृपा, यात्रा और उच्च शिक्षा के अवसर दे सकता है। सावधानी: ${status(h9)}; यात्रा देरी, वीज़ा/कागज़ समस्या या मार्गदर्शन बदल सकता है। पहले से योजना करें।${fortuneCaution}${yogaExtra}`
        : `${fortuneLead}: 9th lord ${posWord(h9)} can support blessings, travel, and higher learning. Caution: ${status(h9)}; travel delays, visa/document issues, or mentor changes may happen. Plan early.${fortuneCaution}${yogaExtra}`
    },
    {
      icon: '🧭',
      badge: dashaIsChallenging === null
        ? 'N/A'
        : dashaIsChallenging
        ? (isTa ? 'நடப்பு ஆண்டு ⚠ கவனம்' : isHi ? 'आगामी वर्ष ⚠ सावधान' : 'Upcoming Year ⚠ Caution')
        : (isTa ? 'நடப்பு ஆண்டு ✓ வாய்ப்பு' : isHi ? 'आगामी वर्ष ✓ अवसर' : 'Upcoming Year ✓ Opportunity'),
      title: isTa ? 'தற்போதைய வழிகாட்டல்' : isHi ? 'ज्योतिषीय मार्गदर्शन' : 'Current Guidance',
      desc: !chandraRasiValid || (!result.currentDasha && !activeDashaPeriod)
        ? unavailableDasha
        : isTa
        ? `ஜென்ம ராசி ${rasiSignName}; ${currentDashaLabel}.${dashaChangeNotice ? ' ' + dashaChangeNotice : ''} நன்மை: பழைய முயற்சிகளை முடித்து ஆன்மீக தெளிவு பெறலாம். கவனம்: அடுத்த 12 மாதங்களில் அவசர முடிவு, ஆரோக்கிய அலட்சியம், தேவையற்ற செலவு தவிர்க்கவும்.`
        : isHi
        ? `जन्म राशि ${rasiSignName}; ${currentDashaLabel}.${dashaChangeNotice ? ' ' + dashaChangeNotice : ''} शुभ: पुराने कार्य पूरे करके आध्यात्मिक स्पष्टता मिल सकती है। सावधानी: अगले 12 महीनों में जल्दबाज़ निर्णय, स्वास्थ्य-लापरवाही और अनावश्यक खर्च से बचें।`
        : `Janma Rasi ${rasiSignName}; ${currentDashaLabel}.${dashaChangeNotice ? ' ' + dashaChangeNotice : ''} Good: the next 12 months can help complete pending efforts and improve spiritual clarity. Caution: avoid rushed decisions, health neglect, and unnecessary spending.`
    }
  ];

}

/**
 * The Birth Jathagam report is a STRICT three-page document in every language.
 * The total lives here once: the page labels and the tests read it, so a page
 * can never claim "x / 4" again.
 */
export const JATHAGAM_PAGE_COUNT = 3;

/** Localized "page x / N" label, with N taken from the real page count. */
export function jathagamPageLabel(page: number, lang: AppLanguage, total: number = JATHAGAM_PAGE_COUNT): string {
  return lang === 'ta' ? `பக்கம் ${page} / ${total}` : lang === 'hi' ? `पृष्ठ ${page} / ${total}` : `Page ${page} / ${total}`;
}

/**
 * The complete Navagraha reference table (all nine grahas: graha, prayer focus,
 * weekday, colour, charity, everyday conduct) — the report's single source of
 * Navagraha remedy data.
 *
 * Kept as a standalone builder for the report pages, other screens and future
 * reports. The Short Summary page reads the SAME data through
 * classifyJathagamPlanetsForSummary(), so its remedies can never disagree with
 * this table. `flaggedKeys` highlights the rows that apply to the devotee.
 */
export function buildNavagrahaReferenceTableHtml(
  lang: AppLanguage,
  flaggedKeys: Iterable<string> = []
): string {
  const navHead = NAVAGRAHA_TABLE_HEADINGS[lang] || NAVAGRAHA_TABLE_HEADINGS.en;
  const flagged = new Set<string>(flaggedKeys);
  // Tamil weekdays are shown in their short form (ஞாயிறு, திங்கள் ...), without
  // "கிழமை", so they fit the narrow Day column instead of overlapping Colour.
  return `
    <table class="navagraha-table">
      <colgroup>
        <col style="width: 13%" />
        <col style="width: 19%" />
        <col style="width: 11%" />
        <col style="width: 12%" />
        <col style="width: 21%" />
        <col style="width: 24%" />
      </colgroup>
      <thead>
        <tr>
          <th>${escapeHtml(navHead.graha)}</th>
          <th>${escapeHtml(navHead.deity)}</th>
          <th>${escapeHtml(navHead.day)}</th>
          <th>${escapeHtml(navHead.colour)}</th>
          <th>${escapeHtml(navHead.charity)}</th>
          <th>${escapeHtml(navHead.practice)}</th>
        </tr>
      </thead>
      <tbody>
        ${NAVAGRAHA_ORDER.map(key => {
          const info = NAVAGRAHA_DOSHA_DATA[key];
          if (!info) return '';
          return `<tr${flagged.has(key) ? ' class="is-flagged"' : ''}>
            <td>${escapeHtml(info.name[lang]).replace(/ Affliction Indicator| கிரகப் பாதிப்பு குறியீடு| ग्रह पीड़ा संकेत/g, '')}</td>
            <td>${escapeHtml(info.deity[lang])}</td>
            <td class="col-day">${escapeHtml(info.day[lang])}</td>
            <td>${escapeHtml(info.colour[lang])}</td>
            <td>${escapeHtml(info.charity[lang])}</td>
            <td>${escapeHtml(info.practice[lang])}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

/** Intro line that accompanies the Navagraha reference table. */
export function navagrahaReferenceNote(lang: AppLanguage): string {
  return lang === 'ta'
    ? 'ஒன்பது கிரகங்களுக்குமான பாரம்பரிய வழிபாடு, நாள், நிறம், கொடை மற்றும் அன்றாட நடத்தை கீழே உள்ள அட்டவணையில். இவை பொதுவான பரிந்துரைகள், எனவே நீங்கள் எங்கு வாழ்ந்தாலும் பின்பற்றலாம்.'
    : lang === 'hi'
    ? 'नीचे की तालिका में नौ ग्रहों के लिए पारंपरिक आराधना, वार, रंग, सहायता सामग्री और दैनिक आचरण दिया गया है। ये सामान्य सुझाव हैं, इसलिए आप इन्हें कहीं भी अपना सकते हैं।'
    : 'The table below gives the traditional prayer focus, weekday, colour, charity items and everyday conduct for each of the nine grahas. These are general suggestions, so they can be followed anywhere in the world.';
}

/**
 * The Navagraha guidance handed down in the ASTRO SIVAM handout (what the nine
 * grahas are, why difficulties arise, and how they are traditionally faced).
 */
export function buildNavagrahaGuidanceHtml(lang: AppLanguage): string {
  const guidance = NAVAGRAHA_GUIDANCE[lang] || NAVAGRAHA_GUIDANCE.en;
  const bulletListHtml = (items: Array<{ h: string; p: string }>) =>
    `<ul class="navagraha-list">${items
      .map(i => `<li><strong>${escapeHtml(i.h)}:</strong> ${escapeHtml(i.p)}</li>`)
      .join('')}</ul>`;
  return `
    <p class="navagraha-intro">${escapeHtml(guidance.intro)}</p>
    <div class="navagraha-section-title">${escapeHtml(guidance.reasonsTitle)}</div>
    ${bulletListHtml(guidance.reasons)}
    <div class="navagraha-section-title">${escapeHtml(guidance.waysTitle)}</div>
    ${bulletListHtml(guidance.ways)}
    <p class="navagraha-closing">${escapeHtml(guidance.closing)}</p>`;
}

export function buildJathagamHtml(result: HoroscopeResult, lang: AppLanguage = 'en'): string {
  lang = normalizeReportLanguage(lang);
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';

  const devoteeName = escapeHtml(result.devoteeName || 'User');
  // Validate engine rasi numbers (1-12). Display names fall back to engine names, then 'N/A'
  // -- never silently fabricate Mesham/Magaram on corrupt data.
  const lagnaRasiValid = isValidRasiValue(result.lagnaRasi);
  const chandraRasiValid = isValidRasiValue(result.chandraRasi);
  const lagnaRasi = lagnaRasiValid ? Number(result.lagnaRasi) : null;
  const lagnaDegree = Number.isFinite(result.lagnaDegrees) && result.lagnaDegrees >= 0 && result.lagnaDegrees < 30
    ? result.lagnaDegrees
    : null;
  const chandraRasi = chandraRasiValid ? Number(result.chandraRasi) : null;
  const nakshatraName = (isTa ? result.janmaNakshatraTa : isHi ? result.janmaNakshatraHi : result.janmaNakshatraEn) || 'N/A';
  const pada = Number.isInteger(result.janmaPada) && result.janmaPada >= 1 && result.janmaPada <= 4 ? result.janmaPada : null;
  const lagnaDegreeText = lagnaDegree === null ? 'N/A' : `${lagnaDegree.toFixed(1)}°`;
  const padaText = pada === null ? 'N/A' : isTa ? `${pada}-ஆம் பாதம்` : isHi ? `पाद ${pada}` : `Pada ${pada}`;

  // Format DOB (DD-MM-YYYY)
  let formattedDob = result.dob;
  if (result.dob && result.dob.includes('-')) {
    const parts = result.dob.split('-');
    if (parts.length === 3) {
      formattedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
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

  const birthPlaceStr = escapeHtml(
    formatBirthPlace(result.birthPlace, result.country) ||
    (isTa ? 'குறிப்பிடப்படவில்லை' : isHi ? 'उल्लेख नहीं किया गया' : 'Not provided')
  );
  const birthTimeZone = escapeHtml(
    `${result.timeZoneId ? `${result.timeZoneId} · ` : ''}${formatUtcOffset(result.timezoneOffsetHours)} at birth`
  );
  const lagnaSignName = lagnaRasi !== null ? RASI_NAMES_REPORT[lagnaRasi]?.[lang] || 'N/A' : 'N/A';
  const rasiSignName = chandraRasi !== null ? RASI_NAMES_REPORT[chandraRasi]?.[lang] || 'N/A' : 'N/A';

  // Item 5: the report always states the ayanamsa and the lunar-node convention
  // that produced Rahu/Ketu, so a reader can reproduce the chart. MEAN is the
  // default (classical, always-retrograde); TRUE is the osculating node.
  const ayanamsaValueText = Number.isFinite(result.ayanamsa) ? `${Number(result.ayanamsa).toFixed(4)}°` : 'N/A';
  const ayanamsaMode = String(result.ayanamsaMode || 'TRUE').toUpperCase() === 'MEAN' ? 'MEAN' : 'TRUE';
  const ayanamsaText = `${ayanamsaValueText} Lahiri Chitra Paksha (${ayanamsaMode === 'MEAN' ? 'mean' : 'true'})`;
  const nodeType = String(result.nodeType || 'MEAN').toUpperCase() === 'TRUE' ? 'TRUE' : 'MEAN';
  const nodeTypeText = nodeType === 'TRUE'
    ? (isTa ? 'உண்மை நிலை (True node)' : isHi ? 'सच्चा नोड (True node)' : 'True node (osculating)')
    : (isTa ? 'சராசரி நிலை (Mean node)' : isHi ? 'औसत नोड (Mean node)' : 'Mean node (classical)');

  // 1. Group planets by Rasi sign
  const planetsBySign: Record<number, { tag: string; isLagna?: boolean }[]> = {};
  for (let r = 1; r <= 12; r++) {
    planetsBySign[r] = [];
    if (lagnaRasiValid && r === lagnaRasi) {
      const lagnaTag = isTa ? 'லக்' : isHi ? 'लग्न' : 'Lagna';
      planetsBySign[r].push({ tag: lagnaTag, isLagna: true });
    }
  }

  (result.planetPositions || []).forEach(p => {
    if (!isValidRasiValue(p.rasi)) return;
    const rasiNum = Number(p.rasi);
    const gInfo = GRAHA_NAMES_REPORT[p.graha];
    if (gInfo && planetsBySign[rasiNum]) {
      const tagText = isTa ? gInfo.tagTa : isHi ? gInfo.tagHi : gInfo.tagEn;
      planetsBySign[rasiNum].push({ tag: tagText });
    }
  });

  // 1b. Group the same grahas by their NAVAMSA (D9) rasi for the Navamsa chart
  // beside the Rasi chart on page 1. The Navamsha is the classical confirmation
  // chart (marriage, dharma, and the inner strength of every placement). Each row is read
  // from `navamsaRasi` when the engine provides it, with `result.navamsaPositions`
  // as the fallback. A result saved before the engines emitted D9 has neither, so
  // its missing D9 values are filled from the longitudes it already holds (same
  // rule as the engines; see navamsa.ts). A graha with no usable longitude is simply
  // not drawn (never guessed).
  const navamsaChart = withDerivedNavamsa(result);
  const navamsaBySign: Record<number, { tag: string; isLagna?: boolean }[]> = {};
  for (let r = 1; r <= 12; r++) navamsaBySign[r] = [];
  const lagnaNavamsaRasi = isValidRasiValue(navamsaChart.lagnaNavamsaRasi) ? Number(navamsaChart.lagnaNavamsaRasi) : null;
  // The D9 Lagna marker also requires a usable D1 Ascendant: an invalid chart
  // must never be propped up by substituting the Navamsa Lagna (or the reverse).
  if (lagnaNavamsaRasi !== null && lagnaRasiValid) {
    const lagnaTag = isTa ? 'லக்' : isHi ? 'लग्न' : 'Lagna';
    navamsaBySign[lagnaNavamsaRasi].push({ tag: lagnaTag, isLagna: true });
  }
  const navamsaPositions = navamsaChart.navamsaPositions || {};
  (navamsaChart.planetPositions || []).forEach(p => {
    const gInfo = GRAHA_NAMES_REPORT[p.graha];
    if (!gInfo) return;
    const fromRow = isValidRasiValue(p.navamsaRasi) ? Number(p.navamsaRasi) : null;
    const fromMap = navamsaPositions[p.graha as string];
    const fromMapRasi = fromMap && isValidRasiValue(fromMap.rasi) ? Number(fromMap.rasi) : null;
    const navamsaRasi = fromRow ?? fromMapRasi;
    if (navamsaRasi === null || !navamsaBySign[navamsaRasi]) return;
    const tagText = isTa ? gInfo.tagTa : isHi ? gInfo.tagHi : gInfo.tagEn;
    navamsaBySign[navamsaRasi].push({ tag: tagText });
  });
  const hasNavamsaData = Object.values(navamsaBySign).some(items => items.length > 0);

  // Helper to render sign cell with explicit grid position
  const renderRasiBox = (rasiNum: number, gridClass: string, source: Record<number, { tag: string; isLagna?: boolean }[]> = planetsBySign) => {
    const signName = RASI_NAMES_REPORT[rasiNum]?.[lang] || '';
    const items = source[rasiNum] || [];
    const hasLagna = items.some(i => i.isLagna);
    let tagsHtml = '';
    if (items.length > 0) {
      const itemsHtml = items
        .map(i => `<span class="planet-name ${i.isLagna ? 'is-lagna' : ''}">${i.tag}</span>`)
        .join('');
      tagsHtml = `<div class="planets-wrap">${itemsHtml}</div>`;
    } else {
      tagsHtml = `<div class="empty-planets-wrap"></div>`;
    }
    return `<div class="rasi-cell ${gridClass}${hasLagna ? ' has-lagna' : ''}">
      <span class="rasi-num">${rasiNum}</span>
      <span class="sign-title">${signName}</span>
      ${tagsHtml}
    </div>`;
  };

  // Center Om text
  const centerOmText = isTa
    ? '<div class="om-glyph">ௐ</div><div class="om-caption">நமசிவாய</div>'
    : isHi
    ? '<div class="om-glyph">ॐ</div><div class="om-caption">नमः शिवाय</div>'
    : '<div class="om-glyph">ॐ</div><div class="om-caption">Namah Shivaya</div>';

  // Item 7: one grid renderer feeds both charts, so the Navamsa (D9) square is
  // laid out exactly like the Rasi square (same explicit cell placement, same
  // box model — no CSS "gap", which html2canvas mis-renders).
  const renderRasiGrid = (source: Record<number, { tag: string; isLagna?: boolean }[]>, extraClass = '') => `
    <div class="rasi-chart-grid${extraClass ? ` ${extraClass}` : ''}">
      ${renderRasiBox(12, 'pos-1-1', source)}
      ${renderRasiBox(1, 'pos-1-2', source)}
      ${renderRasiBox(2, 'pos-1-3', source)}
      ${renderRasiBox(3, 'pos-1-4', source)}
      ${renderRasiBox(11, 'pos-2-1', source)}
      <div class="center-om-box">${centerOmText}</div>
      ${renderRasiBox(4, 'pos-2-4', source)}
      ${renderRasiBox(10, 'pos-3-1', source)}
      ${renderRasiBox(5, 'pos-3-4', source)}
      ${renderRasiBox(9, 'pos-4-1', source)}
      ${renderRasiBox(8, 'pos-4-2', source)}
      ${renderRasiBox(7, 'pos-4-3', source)}
      ${renderRasiBox(6, 'pos-4-4', source)}
    </div>`;

  // The Dasha timeline and planetary positions remain in the horoscope result.
  // They continue to power the page-2 predictions and chart placements; their
  // standalone tables and current-period summary are not printed on page 1.
  // Doshas: ALWAYS prefer the engine-computed result.doshas (it applies cancellation/
  // exception rules). Local recompute below is a fallback only for stale results.
  const engineDoshas = result.doshas || [];
  const findEngineDosha = (re: RegExp) => engineDoshas.find(d => re.test(d.nameEn || ''));
  const engineDoshaText = (d: { descriptionTa: string; descriptionEn: string; descriptionHi: string; traditionalRemedyTa: string; traditionalRemedyEn: string; traditionalRemedyHi: string } | undefined, present: boolean): string =>
    d ? ((isTa ? d.descriptionTa : isHi ? d.descriptionHi : d.descriptionEn) + (present ? ' ' + (isTa ? d.traditionalRemedyTa : isHi ? d.traditionalRemedyHi : d.traditionalRemedyEn) : '')) : '';

  // Dosha fallbacks are only calculated when the required placements are
  // present. Missing data is N/A, never interpreted as a clean chart or House 1.
  const unavailableDosha = isTa
    ? 'கணக்கிடத் தேவையான கிரக நிலை கிடைக்கவில்லை; N/A.'
    : isHi
    ? 'आवश्यक ग्रह स्थिति उपलब्ध नहीं है; N/A।'
    : 'Required planetary placement is unavailable; N/A.';
  const kujaEngine = findEngineDosha(/kuja|manglik|sevvay/i);
  // Fallback for stale results that carry no engine dosha block: use the SAME
  // classical rule set as the engine (houses 2, 4, 7, 8, 12 from the Lagna,
  // Moon and Venus with exceptions). The old fallback checked houses 2, 4, 7, 8,
  // 12 from the Lagna only, so a rerender of a stale result could contradict the
  // PDF the engine produced.
  const kujaFallback = kujaEngine ? null : kujaDoshaFromHoroscope(result);
  const isKujaDosha: boolean | null = kujaEngine ? kujaEngine.isPresent : kujaFallback?.isPresent ?? null;
  // Item 2: the badge speaks the verdict — none / present / present-cancelled.
  // Keying it off isPresent made a cancelled dosha read "no indication" while
  // the paragraph underneath listed the dosha and its cancellation rule.
  const kujaVerdict = kujaEngine?.verdict ?? kujaFallback?.verdict ?? null;
  const kujaVerdictLabel = kujaVerdict === 'none'
    ? (isTa ? 'செவ்வாய் தோஷம் இல்லை' : isHi ? 'मंगल दोष नहीं' : 'No Kuja Dosha under this rule set')
    : kujaVerdict === 'present' || kujaVerdict === 'present-cancelled'
    ? ((kujaEngine
        ? (isTa ? kujaEngine.verdictLabelTa : isHi ? kujaEngine.verdictLabelHi : kujaEngine.verdictLabelEn)
        : (isTa ? kujaFallback?.verdictLabelTa : isHi ? kujaFallback?.verdictLabelHi : kujaFallback?.verdictLabelEn))
      || (isTa ? 'செவ்வாய் தோஷம் உள்ளது' : isHi ? 'मंगल दोष उपस्थित' : 'Kuja Dosha present'))
    : 'N/A';
  const kujaStatus = kujaVerdictLabel;
  const kujaBadgeClass = kujaVerdict === null || kujaVerdict === 'not-assessed'
    ? 'badge-na'
    : kujaVerdict === 'present-cancelled'
    ? 'badge-cancelled'
    : kujaVerdict === 'present'
    ? 'badge-moderate'
    : 'badge-clean';
  const kujaDesc = kujaEngine
    ? engineDoshaText(kujaEngine, kujaEngine.isPresent)
    : !kujaFallback || kujaFallback.status === 'NOT_ASSESSED'
    ? unavailableDosha
    : kujaFallback.status === 'DOSHA_NONE'
    ? (isTa
        ? `லக்னம், சந்திரன், சுக்கிரன் ஆகியவற்றிலிருந்து செவ்வாய் தோஷ ஸ்தானங்களில் இல்லை; பிற மரபுகள் மாறுபடலாம்.`
        : isHi
        ? 'लग्न, चंद्र, शुक्र से मंगल दोष भाव में नहीं; अन्य परंपराएँ भिन्न हो सकती हैं।'
        : 'Mars is not in a Kuja Dosha house from the Lagna, Moon or Venus; other Manglik traditions may differ.')
    : isTa
    ? `${kujaFallback.explanationTa} இது குறியீடு மட்டுமே; பரிகாரம் அல்லது திருமண முடிவை உறுதி செய்யாது.`
    : isHi
    ? `${kujaFallback.explanationHi} यह संकेत मात्र है; उपाय या वैवाहिक परिणाम की गारंटी नहीं।`
    : `${kujaFallback.explanationEn} This is an indicator only; it does not guarantee that a remedy or relationship outcome is needed.`;

  const kalaSarpaEngine = findEngineDosha(/kala.?sarpa/i);
  const isKalaSarpa: boolean | null = kalaSarpaEngine ? kalaSarpaEngine.isPresent : null;
  const kalaSarpaStatus = isKalaSarpa === null
    ? 'N/A'
    : isKalaSarpa
    ? (isTa ? 'தேர்ந்த அளவுகோல் பொருந்துகிறது' : isHi ? 'चयनित मानदंड लागू' : 'Selected criterion met')
    : (isTa ? 'தேர்ந்த அளவுகோல் பொருந்தவில்லை' : isHi ? 'चयनित मानदंड लागू नहीं' : 'Selected criterion not met');
  const kalaSarpaBadgeClass = isKalaSarpa === null ? 'badge-na' : isKalaSarpa ? 'badge-moderate' : 'badge-clean';
  const kalaSarpaDesc = kalaSarpaEngine
    ? engineDoshaText(kalaSarpaEngine, kalaSarpaEngine.isPresent)
    : unavailableDosha;

  const pitruEngine = findEngineDosha(/pitru/i);
  const isPitruDosha: boolean | null = pitruEngine ? pitruEngine.isPresent : null;
  // Item 5: Sun with Rahu/Ketu is only flagged inside a 12° orb. A wider
  // same-sign pair is reported as weak (same sign only), never as "none", and
  // the remedies (Amavasya tarpanam, crows, cows, Vishnu prayer) still show.
  const pitruStrength = pitruEngine?.strength
    ?? result.pitruStrength
    ?? (isPitruDosha === null ? null : isPitruDosha ? 'present' : 'none');
  const pitruStrengthLabel = (pitruEngine && pitruStrength === 'weak'
    ? ((isTa ? pitruEngine.strengthLabelTa : isHi ? pitruEngine.strengthLabelHi : pitruEngine.strengthLabelEn) || '')
    : '');
  const pitruStatus = pitruStrength === null
    ? 'N/A'
    : pitruStrength === 'present'
    ? (isTa ? 'எளிய குறியீடு பொருந்துகிறது' : isHi ? 'सरल संकेत लागू' : 'Simplified indicator triggered')
    : pitruStrength === 'weak'
    ? (pitruStrengthLabel || (isTa ? 'பலவீனம் (ஒரே ராசி மட்டும்)' : isHi ? 'दुर्बल (केवल समान राशि)' : 'Weak (same sign only)'))
    : (isTa ? 'எளிய குறியீடு பொருந்தவில்லை' : isHi ? 'सरल संकेत लागू नहीं' : 'Simplified indicator not triggered');
  const pitruBadgeClass = pitruStrength === null
    ? 'badge-na'
    : pitruStrength === 'none'
    ? 'badge-clean'
    : 'badge-moderate';
  // The dosha card prints the fuller ancestral remedy (page 1). The short
  // prayer stays in traditionalRemedy* for the TypeScript/PHP parity contract, so it
  // is deliberately not repeated here.
  const pitruExtendedRemedy = pitruEngine
    ? ((isTa ? pitruEngine.extendedRemedyTa : isHi ? pitruEngine.extendedRemedyHi : pitruEngine.extendedRemedyEn) || '')
    : '';
  const pitruDesc = pitruEngine
    ? ((isTa ? pitruEngine.descriptionTa : isHi ? pitruEngine.descriptionHi : pitruEngine.descriptionEn)
        + (pitruStrength !== 'none' && pitruExtendedRemedy ? ` ${escapeHtml(pitruExtendedRemedy)}` : ''))
    : unavailableDosha;

  // Guru Chandala Dosha (Guru conjunction or aspect with Rahu or Ketu)
  const jupiterPos = (result.planetPositions || []).find(p => p.graha === Graha.GURU);
  const rahuPos = (result.planetPositions || []).find(p => p.graha === Graha.RAHU);
  const ketuPos = (result.planetPositions || []).find(p => p.graha === Graha.KETU);

  const jupiterRasi = jupiterPos?.rasi;
  const rahuRasi = rahuPos?.rasi;
  const ketuRasi = ketuPos?.rasi;

  const hasGuruChandalaSignData = [jupiterRasi, rahuRasi, ketuRasi].every(isValidRasiValue);
  const isGuruWithRahu = isValidRasiValue(jupiterRasi) && isValidRasiValue(rahuRasi) && jupiterRasi === rahuRasi;
  const isGuruWithKetu = isValidRasiValue(jupiterRasi) && isValidRasiValue(ketuRasi) && jupiterRasi === ketuRasi;
  const isGuruAspectRahu = isValidRasiValue(jupiterRasi) && isValidRasiValue(rahuRasi) && (((jupiterRasi + 6) % 12 || 12) === rahuRasi);
  const isGuruAspectKetu = isValidRasiValue(jupiterRasi) && isValidRasiValue(ketuRasi) && (((jupiterRasi + 6) % 12 || 12) === ketuRasi);

  const guruChandalaEngine = findEngineDosha(/guru.?chandala/i);
  const isGuruChandalaDosha: boolean | null = guruChandalaEngine
    ? guruChandalaEngine.isPresent
    : hasGuruChandalaSignData
    ? (isGuruWithRahu || isGuruWithKetu || isGuruAspectRahu || isGuruAspectKetu)
    : null;

  const guruChandalaStatus = isGuruChandalaDosha === null
    ? 'N/A'
    : isGuruChandalaDosha
    ? (isTa ? 'ராசி-அடிப்படை குறியீடு உள்ளது' : isHi ? 'राशि-आधारित संकेत उपस्थित' : 'Sign-level indicator present')
    : (isTa ? 'ராசி-அடிப்படை குறியீடு இல்லை' : isHi ? 'राशि-आधारित संकेत नहीं' : 'Sign-level criterion not met');
  const guruChandalaBadgeClass = isGuruChandalaDosha === null ? 'badge-na' : isGuruChandalaDosha ? 'badge-moderate' : 'badge-clean';
  const guruChandalaDesc = guruChandalaEngine ? engineDoshaText(guruChandalaEngine, guruChandalaEngine.isPresent) : isGuruChandalaDosha === null
    ? unavailableDosha
    : isGuruChandalaDosha
    ? (isTa
        ? 'குரு ராகு அல்லது கேதுவுடன் ஒரே ராசியில் உள்ளார். இது பாகை இடைவெளியை அளவிடாத ராசி-அடிப்படை குறியீடு; அதன் விளக்கம் மரபுக்கு மாறுபடும்.'
        : isHi
        ? 'गुरु राहु या केतु के साथ एक राशि में हैं। यह अंश-दूरी न मापने वाला राशि-आधारित संकेत है; व्याख्या परंपरा के अनुसार बदलती है।'
        : 'Jupiter shares a sign with Rahu or Ketu under a sign-level rule. Degree distance is not measured, and interpretations vary by tradition.')
    : (isTa
        ? 'குரு ராகு/கேதுவுடன் ஒரே ராசியில் இல்லை; இது இந்த ராசி-அடிப்படை விதி மட்டுமே, முழு யோக மதிப்பீடு அல்ல.'
        : isHi
        ? 'गुरु राहु/केतु के साथ एक राशि में नहीं हैं; यह केवल राशि-आधारित नियम है, पूर्ण योग मूल्यांकन नहीं।'
        : 'Jupiter does not share a sign with Rahu/Ketu under this rule; this is not a complete yoga assessment.');

  // The Navagraha Affliction Indicators card is deliberately no longer printed
  // on page 1: the same screening rules stay in the engine (and in the Short
  // Summary planet read on page 3), so no rule data was lost — only the page-1
  // card was dropped to keep the certified first sheet compact.

  // ---- Items 6 & 7: yoga notes and Graha Yuddha ---------------------------
  // Sarala yoga, Saturn in its own sign and the "9th lord in the 8th" caution
  // come straight from the engine so a Java/Jataka reader can audit the rule.
  const yogaCardsHtml = (result.yogas || []).map(y => `
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${escapeHtml(isTa ? y.nameTa : isHi ? y.nameHi : y.nameEn)}</span>
        <span class="dosha-badge ${y.severity === 'caution' ? 'badge-moderate' : 'badge-clean'}">${y.severity === 'caution'
          ? (isTa ? 'கவனம்' : isHi ? 'सावधानी' : 'Caution')
          : (isTa ? 'நன்மை' : isHi ? 'शुभ' : 'Benefit')}</span>
      </div>
      <div class="desc">${escapeHtml(isTa ? y.descriptionTa : isHi ? y.descriptionHi : y.descriptionEn)}</div>
    </div>`).join('');
  const grahaYuddhaCardsHtml = (result.grahaYuddha || []).map(w => `
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${escapeHtml(isTa
          ? `கிரக யுத்தம் — ${w.planetANameTa} / ${w.planetBNameTa}`
          : isHi
          ? `ग्रह युद्ध — ${w.planetANameHi} / ${w.planetBNameHi}`
          : `Graha Yuddha — ${w.planetANameEn} / ${w.planetBNameEn}`)}</span>
        <span class="dosha-badge badge-moderate">${Number(w.separationDegrees).toFixed(2)}°</span>
      </div>
      <div class="desc">${escapeHtml(isTa ? w.descriptionTa : isHi ? w.descriptionHi : w.descriptionEn)}</div>
    </div>`).join('');
  const lifeCards = buildJathagamLifeCards(result, lang);

  // ---- Page 3 (Short Summary) ---------------------------------------------
  // The page reads pages 1 and 2 back in plain language. Its supportive /
  // needs-care lists and its remedies come from the SHARED rule in
  // jathagamPlanetSummary.ts, which draws on the existing Navagraha reference
  // data (NAVAGRAHA_DOSHA_DATA: deity, day, charity) — never from a second
  // remedy system, and never from the removed "Remedies for Indicators in This
  // Chart" list.
  const summaryPlanets = classifyJathagamPlanetsForSummary(result, lang);
  const summaryText = SHORT_SUMMARY_TEXT[lang] || SHORT_SUMMARY_TEXT.en;
  const summaryLabels = SHORT_SUMMARY_REMEDY_LABELS[lang] || SHORT_SUMMARY_REMEDY_LABELS.en;
  const summaryCompact = summaryPlanets.compact;
  const summaryPlanetName = (key: string) => GRAHA_NAMES_REPORT[key]?.[lang] || GRAHA_NAMES_REPORT[key]?.en || key;
  const supportiveHtml = summaryPlanets.supportive.length > 0
    ? summaryPlanets.supportive.map(p => `
      <div class="summary-planet">
        <div class="summary-planet-name">${escapeHtml(summaryPlanetName(p.key))}</div>
        <div class="summary-planet-note">${escapeHtml(JATHAGAM_PLANET_PROFILES[p.key]?.support?.[lang] || '')}</div>
      </div>`).join('')
    : `<div class="summary-empty">${escapeHtml(summaryText.noSupportPlanet)}</div>`;
  const careRowsHtml = summaryPlanets.needsCare.length > 0
    ? summaryPlanets.needsCare.map(p => {
        const name = escapeHtml(summaryPlanetName(p.key));
        const remedyCell = summaryCompact
          ? `<div class="care-compact-line">${escapeHtml(p.compactLine)}</div>`
          : `<div class="care-line"><span class="care-label">${escapeHtml(summaryLabels.worship)}:</span> ${escapeHtml(p.worship)}</div>
             <div class="care-line"><span class="care-label">${escapeHtml(summaryLabels.lamp)}:</span> ${escapeHtml(p.lamp)}</div>
             <div class="care-line"><span class="care-label">${escapeHtml(summaryLabels.donation)}:</span> ${escapeHtml(p.donation)}</div>
             <div class="care-line"><span class="care-label">${escapeHtml(summaryLabels.mantra)}:</span> ${escapeHtml(p.mantra)}</div>`;
        return `<tr>
          <td class="care-planet">${name}</td>
          <td>${escapeHtml(p.difficulties)}</td>
          <td>${remedyCell}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" class="care-empty">${escapeHtml(summaryText.noCarePlanet)}</td></tr>`;
  // A chart with a placement the rule could not read must never look "all
  // clean": the page says so, in the same card that lists what was found.
  const assessmentNoteHtml = summaryPlanets.assessmentComplete
    ? ''
    : `<div class="summary-empty summary-incomplete">${escapeHtml(summaryPlanets.incompleteNote)}</div>`;
  const summarySentences = (() => {
    const supportiveNames = summaryPlanets.supportive.map(p => summaryPlanetName(p.key));
    const careNames = summaryPlanets.needsCare.map(p => summaryPlanetName(p.key));
    const list = (names: string[]) => names.join(isHi ? ', ' : ', ');
    // Pick the sentence form that stays grammatical when a side is empty: the
    // card messages ("no single planet ...") are not clauses and must never be
    // spliced into the lead sentence.
    const lead = (supportiveNames.length === 0
      ? summaryText.summaryLeadNoSupport
      : careNames.length === 0
        ? summaryText.summaryLeadNoCare
        : summaryText.summaryLead
    )
      .replace('{supportive}', list(supportiveNames))
      .replace('{care}', list(careNames));
    return [lead, summaryText.summaryRemedy, summaryCompact ? summaryText.compactModeNote : '']
      .filter(part => part && part.trim().length > 0)
      .join(' ');
  })();
  const summaryDetails: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: isTa ? 'பெயர்' : isHi ? 'नाम' : 'Name', value: devoteeName },
    { label: isTa ? 'பிறந்த தேதி' : isHi ? 'जन्म तिथि' : 'Birth Date', value: escapeHtml(formattedDob) },
    { label: isTa ? 'பிறந்த நேரம்' : isHi ? 'जन्म समय' : 'Birth Time', value: escapeHtml(formattedTob) },
    { label: isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान' : 'Birth Place', value: birthPlaceStr },
    { label: isTa ? 'லக்னம்' : isHi ? 'लग्न' : 'Lagna', value: escapeHtml(lagnaSignName) },
    { label: isTa ? 'ராசி' : isHi ? 'राशि' : 'Rasi', value: escapeHtml(rasiSignName) },
    { label: isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र' : 'Nakshatra', value: `${escapeHtml(nakshatraName)} — ${escapeHtml(padaText)}`, wide: true }
  ];
  const summaryDetailsHtml = summaryDetails.map(item =>
    `<div class="summary-detail${item.wide ? ' is-wide' : ''}">
      <span class="summary-detail-label">${escapeHtml(item.label)}</span>
      <span class="summary-detail-value">${item.value}</span>
    </div>`).join('');

  // Navagraha reference table + guidance prose are kept as exported builders
  // (see buildNavagrahaReferenceTableHtml / buildNavagrahaGuidanceHtml below).
  // They are the report's single Navagraha data surface and stay available to
  // other pages, screens and future reports; the Short Summary page 3 does not
  // embed them because it must always stay inside one A4 sheet.
  // Common Header/Footer content
  const brandTitle = 'ASTRO SIVAM - OFFICIAL VEDIC REPORT';
  const brandSubtitle = 'astrosivam.com • admin@astrosivam.com';
  /**
   * Page label. The total is the report's real page count (JATHAGAM_PAGE_COUNT),
   * never a literal repeated per page, and it sits on the existing footer line
   * so pages 1 and 2 keep exactly the height they had.
   */
  const footerHtmlFor = (pageNumber: number) => `
    <div class="footer">
      <div class="brand-title">${brandTitle}</div>
      <div class="brand-sub">${brandSubtitle} <span class="footer-page">${escapeHtml(jathagamPageLabel(pageNumber, lang))}</span></div>
    </div>
  `;

  const fontFamilies = isTa
    ? "'Noto Sans Tamil', sans-serif"
    : isHi
    ? "'Noto Sans Devanagari', sans-serif"
    : "'Noto Sans', sans-serif";

  const headerFont = isTa
    ? "'Baloo Thambi 2', serif"
    : isHi
    ? "'Yatra One', serif"
    : "'Cinzel', serif";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - Jathagam Report</title>
${REPORT_FONT_LINK_TAG}
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Baloo+Thambi+2:wght@600;700;800&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Yatra+One&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');

  :root {
    --maroon: #881337;
    --maroon-dark: #4c0519;
    --gold: #b45309;
    --gold-light: #fef3c7;
    --green: #047857;
    --slate-bg: #f8fafc;
    --slate-border: #e2e8f0;
    --ink: #0f172a;
    --ink-light: #334155;
    --ink-muted: #64748b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* Every sheet is at least a full A4 (min-height, not height) and every page
     owns one growing block, so the report always fills the sheet. A page with
     genuinely more content than one sheet grows instead of clipping text. */
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    font-family: ${fontFamilies};
    color: var(--ink);
    position: relative;
    padding: 8mm 12mm 8mm;
    box-sizing: border-box;
  }

  .inner { padding: 0; flex: 1; display: flex; flex-direction: column; justify-content: space-between; height: 100%; }

  ${reportHeaderCss(headerFont)}

  .panel {
    background: #ffffff;
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    padding: 2.5mm 4mm;
    margin-bottom: 2mm;
    box-sizing: border-box;
  }
  .panel h2 {
    font-family: ${headerFont};
    color: var(--maroon); font-size: 13.5px; font-weight: 800; margin-bottom: 1.5mm;
    border-bottom: 1px solid var(--slate-border); padding-bottom: 0.8mm;
  }

  .devotee-panel {
    background: var(--slate-bg);
    border: 1px solid var(--slate-border);
    border-radius: 8px;
    padding: 2.5mm 4mm;
    margin-bottom: 2.5mm;
  }
  .devotee-panel h2 {
    font-family: ${headerFont};
    color: var(--maroon);
    font-size: 13.5px;
    font-weight: 800;
    margin-bottom: 1.5mm;
    border-bottom: 1px solid var(--slate-border);
    padding-bottom: 0.8mm;
  }

  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 4mm; }
  .details .item {
    font-size: 12px;
    line-height: 1.3;
    background: #ffffff;
    border-radius: 6px;
    padding: 1mm 2.5mm;
    border: 1px solid var(--slate-border);
  }
  .details .label { color: var(--ink-muted); font-weight: 700; display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 0.2mm; }
  .details .value { font-weight: 700; color: var(--ink); font-size: 12.5px; }

  .chart-section { display: flex; gap: 3.5mm; margin-bottom: 2mm; align-items: stretch; }
  .chart-box { flex: 1; display: flex; flex-direction: column; margin-bottom: 0; background: #ffffff; border: 1px solid var(--slate-border); border-radius: 8px; padding: 2.5mm 3.5mm; }
  .chart-box h2 { font-size: 13px; font-weight: 800; color: var(--maroon); margin-bottom: 1.5mm; padding-bottom: 0.6mm; border-bottom: 1px solid var(--slate-border); }
  
  /* NOTE: this is a CSS grid (not a <table>) with each sign's box explicitly placed via
     grid-column/grid-row, and a 2x2 spanning center box for the deity glyph. Cells use
     box-sizing: border-box with their own borders (no CSS "gap") because html2canvas —
     used to rasterize this HTML into the PDF — has long-standing bugs with the "gap"
     property and with clipping inside gapped grid tracks, which previously caused planet
     names to visually spill outside their box. Keep gap out of this grid. */
  .rasi-chart-grid {
    display: grid;
    grid-template-columns: 25% 25% 25% 25%;
    grid-template-rows: 25% 25% 25% 25%;
    width: 62mm;
    height: 62mm;
    min-height: 62mm;
    max-height: 62mm;
    margin: 0 auto;
    background: linear-gradient(160deg, #fffaf2 0%, #ffffff 55%);
    border: 2px solid var(--maroon);
    border-radius: 2px;
    outline: 1px solid var(--gold-light);
    outline-offset: 2.2px;
    box-shadow: 0 2px 8px rgba(136, 19, 55, 0.10);
    box-sizing: border-box;
    aspect-ratio: 1 / 1;
  }
  .rasi-chart-grid .pos-1-1 { grid-column: 1; grid-row: 1; }
  .rasi-chart-grid .pos-1-2 { grid-column: 2; grid-row: 1; }
  .rasi-chart-grid .pos-1-3 { grid-column: 3; grid-row: 1; }
  .rasi-chart-grid .pos-1-4 { grid-column: 4; grid-row: 1; }

  .rasi-chart-grid .pos-2-1 { grid-column: 1; grid-row: 2; }
  .rasi-chart-grid .center-om-box {
    grid-column: 2 / 4;
    grid-row: 2 / 4;
    background: radial-gradient(circle at 50% 42%, #fffdf7 0%, #fdfbf7 65%, #fbf6ea 100%);
    color: var(--maroon);
    border: 1px solid var(--gold);
    box-shadow: inset 0 0 0 2.5px #ffffff, inset 0 0 0 3.5px var(--gold-light);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: ${headerFont};
    padding: 1mm;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .rasi-chart-grid .om-glyph {
    font-size: 25px;
    line-height: 1;
    margin-bottom: 1mm;
    color: var(--maroon);
    text-shadow: 0 1px 0 #fff7e6;
  }
  .rasi-chart-grid .om-caption {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--maroon);
    letter-spacing: 0.5px;
  }
  .rasi-chart-grid .pos-2-4 { grid-column: 4; grid-row: 2; }

  .rasi-chart-grid .pos-3-1 { grid-column: 1; grid-row: 3; }
  .rasi-chart-grid .pos-3-4 { grid-column: 4; grid-row: 3; }

  .rasi-chart-grid .pos-4-1 { grid-column: 1; grid-row: 4; }
  .rasi-chart-grid .pos-4-2 { grid-column: 2; grid-row: 4; }
  .rasi-chart-grid .pos-4-3 { grid-column: 3; grid-row: 4; }
  .rasi-chart-grid .pos-4-4 { grid-column: 4; grid-row: 4; }

  .rasi-chart-grid .rasi-cell {
    position: relative;
    background: #ffffff;
    border: 0.75px solid #d8dee8;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 0.6mm 0.6mm 0.3mm;
    box-sizing: border-box;
    overflow: hidden;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    transition: none;
  }
  .rasi-chart-grid .rasi-cell.has-lagna {
    background: linear-gradient(160deg, #fff1f2 0%, #ffffff 70%);
    border: 1.1px solid var(--maroon);
  }
  .rasi-chart-grid .rasi-num {
    position: absolute;
    top: 0.4mm;
    left: 0.6mm;
    font-size: 6px;
    font-weight: 700;
    color: #c3c9d4;
    line-height: 1;
  }
  .rasi-chart-grid .rasi-cell.has-lagna .rasi-num { color: var(--gold); }
  .rasi-chart-grid .sign-title {
    font-family: ${headerFont};
    font-size: 8.4px;
    color: var(--maroon);
    font-weight: 700;
    letter-spacing: 0.1px;
    line-height: 1;
    margin: 0 0 0.4mm;
    display: block;
    width: 100%;
    text-align: center;
    white-space: nowrap;
    border-bottom: 0.5px solid #f1e4d0;
    padding-bottom: 0.3mm;
    flex-shrink: 0;
  }
  .rasi-chart-grid .planets-wrap {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    align-content: center;
    gap: 0.3mm 0.8mm;
    line-height: 1.1;
    padding: 0;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .rasi-chart-grid .empty-planets-wrap {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
  .rasi-chart-grid .planet-name {
    color: var(--ink);
    font-weight: 700;
    font-size: 8.6px;
    line-height: 1.1;
    display: inline-block;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    white-space: nowrap;
  }
  .rasi-chart-grid .planet-name.is-lagna {
    color: #b91c1c;
    font-weight: 900;
    font-size: 9.6px;
    line-height: 1.1;
    display: inline-block;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    letter-spacing: 0.2px;
  }

  table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.data-table th {
    background: var(--slate-bg);
    color: var(--ink-muted);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 1mm 2mm;
    text-align: left;
    border-bottom: 1px solid var(--slate-border);
  }
  table.data-table th:last-child { text-align: right; }
  table.data-table td { padding: 0.8mm 2mm; border-bottom: 1px solid #f1f5f9; }
  table.data-table td:first-child { color: var(--maroon); font-weight: 700; width: 44%; }
  table.data-table td:last-child { font-weight: 700; text-align: right; color: var(--ink); }

  .dosha-card {
    border: 1px solid var(--slate-border);
    border-left: 3.5px solid var(--maroon);
    background: #ffffff;
    border-radius: 5px;
    padding: 1.5mm 3mm;
    margin-bottom: 1.2mm;
    box-sizing: border-box;
  }
  .dosha-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.3mm;
  }
  .dosha-card .name {
    color: var(--maroon);
    font-weight: 800;
    font-size: 11.5px;
  }
  .dosha-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 0.3mm 1.8mm;
    border-radius: 8px;
    letter-spacing: 0.2px;
    white-space: nowrap;
  }
  .badge-clean { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .badge-moderate { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .badge-na { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .badge-cancelled { background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }
  .rule-note { font-size: 11.5px; color: #475569; margin-top: 4px; line-height: 1.45; }
  .planet-dignity { font-size: 11.5px; color: #334155; margin-top: 3px; }
  .badge-afflicted { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .dosha-card .desc {
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--ink-light);
  }

  /* ===== Page 3: Short Summary ==========================================
     One A4 sheet, always. --summary-scale (set by fitJathagamSummaryText)
     enlarges type and spacing from this 10.5px floor so a short chart fills
     the sheet; a dense chart stays at 1. The care card is the growing block
     that absorbs the last millimetres. Overflow-wrap keeps a 60-character
     name inside its box. */
  .summary-page {
    --summary-scale: 1;
    padding: 8mm 11mm 8mm;
  }

  .summary-page .card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: calc(6px * var(--summary-scale)) calc(9px * var(--summary-scale));
    margin-bottom: calc(7px * var(--summary-scale));
    box-sizing: border-box;
    break-inside: avoid;
    page-break-inside: avoid;
    min-width: 0;
  }
  .summary-page .card-title {
    color: #7a1230;
    font-size: calc(14px * var(--summary-scale));
    font-weight: 800;
    line-height: 1.35;
    margin-bottom: calc(5px * var(--summary-scale));
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: calc(2px * var(--summary-scale));
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .summary-page .card-title-green { color: #0f6b4a; border-bottom-color: #bfe6d3; }
  .summary-page .card-title-amber { color: #92400e; border-bottom-color: #f1d9a6; }

  /* Person card: four columns; the nakshatra box spans two of them. */
  .summary-details-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: calc(5px * var(--summary-scale));
  }
  .summary-detail {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: calc(3px * var(--summary-scale)) calc(6px * var(--summary-scale));
    min-width: 0;
  }
  .summary-detail.is-wide { grid-column: span 2; }
  .summary-detail-label {
    display: block;
    color: #6b7280;
    font-size: calc(10.5px * var(--summary-scale));
    font-weight: 700;
    letter-spacing: 0.2px;
    margin-bottom: calc(1px * var(--summary-scale));
    overflow-wrap: anywhere;
  }
  .summary-detail-value {
    display: block;
    color: #1f2937;
    font-size: calc(11.5px * var(--summary-scale));
    font-weight: 700;
    line-height: 1.5;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* Supportive planets: green tint, at most three boxes in a row. */
  .summary-good { background: #f2fbf6; border-color: #bfe6d3; }
  .summary-good-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(5px * var(--summary-scale));
  }
  .summary-planet {
    background: #ffffff;
    border: 1px solid #bfe6d3;
    border-radius: 8px;
    padding: calc(4px * var(--summary-scale)) calc(6px * var(--summary-scale));
    min-width: 0;
  }
  .summary-planet-name { color: #0f6b4a; font-size: calc(13px * var(--summary-scale)); font-weight: 800; line-height: 1.45; overflow-wrap: anywhere; }
  .summary-planet-note { color: #1f2937; font-size: calc(11.5px * var(--summary-scale)); line-height: 1.5; overflow-wrap: anywhere; }
  .summary-empty { color: #0f6b4a; font-size: calc(11.5px * var(--summary-scale)); font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
  .summary-incomplete { color: #92400e; font-size: calc(10.5px * var(--summary-scale)); font-weight: 400; line-height: 1.5; }

  /* Planets needing care: amber tint, one row per flagged planet.
     Growing block of page 3: leftover millimetres after the font fitter. */
  .summary-care { background: #fffaf0; border-color: #f1d9a6; }
  .summary-page #summary-care {
    flex: 1 0 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  table.care-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .summary-page #summary-care table.care-table { flex: 1 0 auto; }
  table.care-table th {
    background: #ffffff;
    color: #6b7280;
    /* 10.5px is the report's hard floor, table header included. */
    font-size: calc(10.5px * var(--summary-scale));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    text-align: left;
    padding: calc(3px * var(--summary-scale)) calc(6px * var(--summary-scale));
    border-bottom: 1px solid #f1d9a6;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  table.care-table td {
    padding: calc(3px * var(--summary-scale)) calc(6px * var(--summary-scale));
    border-bottom: 1px solid #f1d9a6;
    vertical-align: top;
    /* 10.5px is the report's floor — scale never goes below 1, so a four-line
       remedy cell never prints smaller type to make it fit. */
    font-size: calc(10.5px * var(--summary-scale));
    line-height: 1.35;
    color: #1f2937;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  table.care-table tr:last-child td { border-bottom: none; }
  table.care-table td.care-planet { color: #7a1230; font-size: calc(13px * var(--summary-scale)); font-weight: 800; line-height: 1.35; }
  table.care-table td.care-empty { color: #0f6b4a; font-weight: 700; font-size: calc(11.5px * var(--summary-scale)); line-height: 1.5; }
  .care-line { margin-bottom: calc(1px * var(--summary-scale)); overflow-wrap: anywhere; }
  .care-line:last-child { margin-bottom: 0; }
  .care-label { color: #92400e; font-size: calc(10.5px * var(--summary-scale)); font-weight: 800; }
  /* Compact mode (5 to 9 flagged grahas): the same facts on one line per
     planet and tighter rows, never smaller than 10.5px. */
  table.care-table.is-compact th { font-size: calc(10.5px * var(--summary-scale)); padding: calc(3px * var(--summary-scale)) calc(6px * var(--summary-scale)); }
  table.care-table.is-compact td { font-size: calc(10.5px * var(--summary-scale)); line-height: 1.5; padding: calc(3px * var(--summary-scale)) calc(6px * var(--summary-scale)); }
  table.care-table.is-compact td.care-planet { font-size: calc(12px * var(--summary-scale)); }
  .care-compact-line { font-size: calc(10.5px * var(--summary-scale)); line-height: 1.5; overflow-wrap: anywhere; }

  /* Compact mode (5 to 9 flagged grahas): the SAME facts with less spacing —
     never smaller text, never a hidden planet, never a second sheet. */
  .summary-page.is-compact .card { padding: calc(5px * var(--summary-scale)) calc(8px * var(--summary-scale)); margin-bottom: calc(5px * var(--summary-scale)); }
  .summary-page.is-compact .card-title { font-size: calc(13.5px * var(--summary-scale)); margin-bottom: calc(4px * var(--summary-scale)); padding-bottom: calc(1px * var(--summary-scale)); }
  .summary-page.is-compact .summary-detail { padding: calc(2px * var(--summary-scale)) calc(5px * var(--summary-scale)); }
  .summary-page.is-compact .summary-detail-value { font-size: calc(11px * var(--summary-scale)); line-height: 1.45; }
  .summary-page.is-compact .summary-planet { padding: calc(3px * var(--summary-scale)) calc(5px * var(--summary-scale)); }
  .summary-page.is-compact .summary-planet-note { font-size: calc(11px * var(--summary-scale)); line-height: 1.45; }
  .summary-page.is-compact table.care-table.is-compact td { padding: calc(2px * var(--summary-scale)) calc(5px * var(--summary-scale)); line-height: 1.4; }
  .summary-page.is-compact .summary-short-text { font-size: calc(11.5px * var(--summary-scale)); line-height: 1.5; margin-bottom: calc(2px * var(--summary-scale)); }
  .summary-page.is-compact .reassurance { padding: calc(5px * var(--summary-scale)) calc(8px * var(--summary-scale)); font-size: calc(11px * var(--summary-scale)); line-height: 1.5; margin-bottom: calc(5px * var(--summary-scale)); }
  .summary-page.is-compact .footer-page { font-size: 10.5px; }

  /* In Short + reassurance note. */
  .summary-short-text {
    color: #1f2937;
    font-size: calc(12px * var(--summary-scale));
    line-height: 1.6;
    margin: 0 0 calc(3px * var(--summary-scale));
    overflow-wrap: anywhere;
  }
  .summary-short-text:last-child { margin-bottom: 0; }
  .reassurance {
    background: #f8f9fb;
    border: 1px solid #e5e7eb;
    border-left: 3.5px solid #7a1230;
    border-radius: 6px;
    padding: calc(6px * var(--summary-scale)) calc(9px * var(--summary-scale));
    color: #1f2937;
    font-size: calc(11.5px * var(--summary-scale));
    line-height: 1.55;
    margin-bottom: calc(7px * var(--summary-scale));
    overflow-wrap: anywhere;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .footer .footer-page { color: #7a1230; font-weight: 800; white-space: nowrap; }

  /* Page 3 second half: the complete Navagraha reference. Compact enough to
     keep all nine grahas on the sheet, and every suggestion is universal
     (prayer focus, weekday, colour, charity, conduct) so it reads the same
     for a devotee in Chennai or in Sydney. */
  /* Item 7: the Navagraha reference table is readable print text — never below
     10px in any language, header included. */
  table.navagraha-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 1.5mm; table-layout: fixed; }
  table.navagraha-table th {
    background: var(--maroon); color: #ffffff; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.2px; padding: 0.9mm 1mm;
    text-align: left; border: 1px solid var(--maroon); line-height: 1.15;
  }
  table.navagraha-table td {
    padding: 0.8mm 1mm; border: 1px solid var(--slate-border);
    vertical-align: top; line-height: 1.25; color: var(--ink-light);
    /* Last-resort safety net: a word wider than its column wraps inside the
       cell instead of painting over the next column. */
    overflow-wrap: anywhere; word-break: break-word;
  }
  table.navagraha-table tr:nth-child(even) td { background: #fdfaf5; }
  table.navagraha-table td:first-child { color: var(--maroon); font-weight: 800; }
  table.navagraha-table td.col-day { font-weight: 700; color: var(--ink); }
  /* Rows for grahas actually flagged in this chart get a soft highlight so the
     reader can see at a glance which lines above belong to their own chart. */
  table.navagraha-table tr.is-flagged td { background: var(--gold-light); font-weight: 600; }
  .navagraha-note { font-size: 8.5px; line-height: 1.35; color: var(--ink-muted); margin: 0 0 1.5mm; }

  /* Navagraha guidance (what the nine grahas are, why difficulties arise, and
     how they are traditionally faced) - kept tight so the reference table
     below it still fits on the same sheet. */
  .navagraha-intro { font-size: 9.5px; line-height: 1.4; color: var(--ink-light); margin: 0 0 1.5mm; }
  .navagraha-section-title { font-family: ${headerFont}; color: var(--maroon); font-size: 10.5px; font-weight: 800; margin: 1.5mm 0 0.8mm; border-bottom: 1px dotted var(--gold); padding-bottom: 0.5mm; }
  .navagraha-subsection { font-family: ${headerFont}; color: var(--green); font-size: 10.5px; font-weight: 800; margin: 2mm 0 0.8mm; }
  ul.navagraha-list { list-style: none; margin: 0 0 1mm; padding: 0; }
  ul.navagraha-list li { font-size: 9px; line-height: 1.3; color: var(--ink-light); padding-left: 3.5mm; position: relative; margin-bottom: 0.5mm; }
  ul.navagraha-list li::before { content: "•"; position: absolute; left: 0.5mm; color: var(--gold); font-size: 12px; line-height: 1; }
  ul.navagraha-list li strong { color: var(--maroon); font-weight: 700; }
  .navagraha-closing { font-style: italic; font-size: 9px; line-height: 1.35; color: var(--green); font-weight: 600; margin: 1.2mm 0 0; text-align: center; }

  .lead { font-size: 12.5px; line-height: 1.55; margin-bottom: 3mm; font-weight: 500; color: var(--ink-light); }
  .section-title {
    font-family: ${headerFont}; color: var(--maroon); font-size: 14px; font-weight: 800;
    margin: 2mm 0 1.5mm; border-bottom: 1px solid var(--slate-border); padding-bottom: 0.6mm;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr; gap: 1.2mm; }
  .grid-2 li { list-style: none; padding-left: 5mm; position: relative; font-size: 12.5px; font-weight: 500; line-height: 1.45; color: var(--ink-light); }
  .grid-2 li::before { content: "•"; position: absolute; left: 1mm; color: var(--maroon); font-size: 16px; line-height: 1; }
  .grid-2 li strong { color: var(--maroon); font-weight: 700; font-size: 12.5px; }
  .closing { font-style: italic; font-size: 12.5px; line-height: 1.45; color: var(--green); margin-top: 2.5mm; font-weight: 600; text-align: center; }

  /* No auto top margin: the growing block owns the leftover space and .inner
     spreads whatever is left, so the footer never sits under a void. */
  .footer { text-align: center; border-top: 1px solid var(--slate-border); padding-top: 2mm; flex-shrink: 0;
    font-size: 11px; color: var(--ink-muted); line-height: 1.35; }
  .footer .brand-title { color: var(--maroon); font-weight: 800; font-size: 12px; letter-spacing: 0.5px; }
  .footer .brand-sub { font-size: 10.5px; color: var(--ink-muted); font-weight: 600; margin-top: 0.2mm; }

  .panel, .dosha-card, .life-card, .summary-page .card, .summary-page table.care-table tr, .reassurance {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .mini-note { font-size: 9px; color: var(--ink-muted); line-height: 1.3; margin: 0.5mm 0 0; }

  .life-disclaimer {
    flex: 0 0 auto;
    color: var(--ink-muted);
    font-size: 8.5px;
    line-height: 1.25;
    text-align: center;
    margin: 0.8mm 0 1.5mm;
    overflow-wrap: anywhere;
  }
  /* Item 7: cards are sized to their own content (auto rows + align-items:
     start) instead of being stretched to four equal fractions of the sheet.
     fitJathagamLifeCardText then picks the largest shared body size whose
     content-sized stack still fits one A4 page. */
  .life-grid-big {
    flex: 0 0 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: auto;
    align-items: start;
    gap: 2.5mm;
    margin-bottom: 1.5mm;
    box-sizing: border-box;
  }
  .life-grid-big .panel.life-card-big {
    min-height: 0;
    margin-bottom: 0;
    padding: 2.5mm 3.5mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background: #ffffff;
    border: 1px solid var(--slate-border);
    border-top: 3px solid var(--maroon);
    border-radius: 6px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    box-sizing: border-box;
    overflow: visible;
  }
  .life-grid-big .panel.life-card-big .card-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2mm;
    margin-bottom: 1mm;
    padding: 0.5mm 0;
    flex-shrink: 0;
    overflow: visible;
  }
  .life-grid-big .panel.life-card-big .card-title-wrap {
    display: flex;
    align-items: center;
    gap: 1.5mm;
    min-width: 0;
    flex: 1;
    overflow: visible;
    padding: 0.2mm 0;
  }
  .life-grid-big .panel.life-card-big .card-icon {
    font-size: 18px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  }
  .life-grid-big .panel.life-card-big .card-title {
    font-family: ${headerFont};
    font-size: 14px;
    font-weight: 800;
    color: var(--maroon);
    line-height: 1.4;
    padding: 0.5mm 0;
    display: inline-block;
    white-space: normal;
    overflow: visible;
    word-break: break-word;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .life-grid-big .panel.life-card-big .bhava-badge {
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 700;
    background: #f8fafc;
    color: var(--ink-muted);
    border: 1px solid var(--slate-border);
    border-radius: 3px;
    padding: 0.4mm 1.8mm;
    max-width: 42%;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: right;
    line-height: 1.25;
    flex: 0 1 auto;
    min-width: 0;
    margin: 0.3mm 0 0 0;
  }
  .life-grid-big .panel.life-card-big .bhava-badge.badge-caution {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  .life-grid-big .panel.life-card-big p {
    /* Safe no-script size; font-aware fitting enlarges all eight cards together.
       The card is content-sized, so the paragraph grows its own card instead of
       being clipped inside a fixed row. */
    font-size: 13.5px;
    line-height: 1.4;
    font-weight: 500;
    color: #1e293b;
    text-align: left;
    margin: 0;
    padding-top: 0.8mm;
    padding-bottom: 0;
    padding-left: 0;
    padding-right: 0;
    border-top: 1px solid #f1f5f9;
    flex: 0 0 auto;
    min-height: 0;
    display: block;
    word-break: break-word;
    overflow-wrap: anywhere;
    overflow: visible;
  }

  @page {
    size: A4 portrait;
    margin: 0;
  }

  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { page-break-after: always; break-after: page; background: #ffffff !important; }
    /* No trailing blank sheet: the last page ends the document. */
    .page:last-child { page-break-after: auto; break-after: auto; }
    .summary-page, .summary-page .card, .summary-page .summary-detail,
    .summary-page .summary-planet, .summary-page tr, .summary-page .reassurance {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
</style>
</head>
<body>

<!-- ======================= PAGE 1 ======================= -->
<div class="page" id="jathagam-page-1">
  <div class="inner">
    ${buildReportHeaderHtml({
      subtitle: isTa
        ? 'ஜாதக கணிப்பு அறிக்கை (Birth Jathagam)'
        : isHi
          ? 'जन्म कुंडली रिपोर्ट (Birth Horoscope)'
          : 'Certified Vedic Horoscope & Ephemeris'
    })}

    <div class="devotee-panel">
      <h2>${isTa ? 'ஜாதகர் விவரங்கள்' : isHi ? 'जातक जन्म विवरण (Birth Particulars)' : 'User Particulars'}</h2>
      <div class="details">
        <div class="item"><span class="label">${isTa ? 'பெயர்' : isHi ? 'नाम (Name)' : 'Name'}</span><span class="value">${devoteeName}</span></div>
        <div class="item"><span class="label">${isTa ? 'பிறந்த தேதி' : isHi ? 'जन्म तिथि (DOB)' : 'Date of Birth'}</span><span class="value">${formattedDob}</span></div>
        <div class="item"><span class="label">${isTa ? 'பிறந்த நேரம்' : isHi ? 'जन्म समय (Time)' : 'Time of Birth'}</span><span class="value">${formattedTob}</span></div>
        <div class="item"><span class="label">${isTa ? 'பிறந்த இடம்' : isHi ? 'जन्म स्थान (Place)' : 'Place of Birth'}</span><span class="value">${birthPlaceStr}</span></div>
        <div class="item"><span class="label">${isTa ? 'பிறந்த நேர மண்டலம்' : isHi ? 'जन्म समय क्षेत्र' : 'Birth Time Zone'}</span><span class="value">${birthTimeZone}</span></div>
        <div class="item"><span class="label">${isTa ? 'லக்னம்' : isHi ? 'लग्न (Ascendant)' : 'Lagna'}</span><span class="value">${lagnaSignName} (${lagnaDegreeText})</span></div>
        <div class="item"><span class="label">${isTa ? 'ராசி' : isHi ? 'राशि (Moon Sign)' : 'Janma Rasi'}</span><span class="value">${rasiSignName}</span></div>
        <div class="item"><span class="label">${isTa ? 'நட்சத்திரம்' : isHi ? 'नक्षत्र (Nakshatra)' : 'Janma Nakshatra'}</span><span class="value">${nakshatraName} — ${padaText}</span></div>
        <div class="item"><span class="label">${isTa ? 'அயனாம்சம்' : isHi ? 'अयनांश' : 'Ayanamsa'}</span><span class="value">${escapeHtml(ayanamsaText)}</span></div>
        <div class="item"><span class="label">${isTa ? 'ராகு நிலை (Node)' : isHi ? 'राहु नोड (Node)' : 'Rahu Node'}</span><span class="value">${escapeHtml(nodeTypeText)}</span></div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-box panel">
        <h2>${isTa ? 'ராசி கட்டம் (Rasi Chart)' : isHi ? 'राशि चक्र (Rasi Chakra)' : 'Rasi Chart (Chakra)'}</h2>
        ${renderRasiGrid(planetsBySign)}
      </div>

      <div class="chart-box panel">
        <h2>${isTa ? 'நவாம்ச கட்டம் (Navamsa D9)' : isHi ? 'नवांश चक्र (Navamsa D9)' : 'Navamsa Chart (D9)'}</h2>
        ${hasNavamsaData
          ? renderRasiGrid(navamsaBySign, 'navamsa-chart-grid')
          : `<p class="mini-note">${isTa ? 'நவாம்ச நிலை தகவல் கிடைக்கவில்லை; N/A.' : isHi ? 'नवांश स्थिति उपलब्ध नहीं; N/A।' : 'Navamsa positions unavailable; N/A.'}</p>`}
      </div>
    </div>

    <div class="section-title">${isTa ? 'தோஷ பரிசீலனை' : isHi ? 'दोष विश्लेषण' : 'Dosha Analysis'}</div>
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${isTa ? 'செவ்வாய் தோஷம் (Kuja Dosha)' : isHi ? 'मंगल (कुज) दोष' : 'Mars (Kuja) Dosha'}</span>
        <span class="dosha-badge ${kujaBadgeClass}">${kujaStatus}</span>
      </div>
      <div class="desc">${kujaDesc}</div>
    </div>
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${isTa ? 'காலசர்ப தோஷம்' : isHi ? 'काल सर्प दोष' : 'Kala Sarpa Dosha'}</span>
        <span class="dosha-badge ${kalaSarpaBadgeClass}">${kalaSarpaStatus}</span>
      </div>
      <div class="desc">${kalaSarpaDesc}</div>
    </div>
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${isTa ? 'பித்ரு தோஷம்' : isHi ? 'पितृ दोष' : 'Pitru Dosha'}</span>
        <span class="dosha-badge ${pitruBadgeClass}">${pitruStatus}</span>
      </div>
      <div class="desc">${pitruDesc}</div>
    </div>
    <div class="dosha-card">
      <div class="dosha-header">
        <span class="name">${isTa ? 'குரு சண்டாள தோஷம் (Guru Chandala)' : isHi ? 'गुरु चांडाल दोष' : 'Guru Chandala Dosha'}</span>
        <span class="dosha-badge ${guruChandalaBadgeClass}">${guruChandalaStatus}</span>
      </div>
      <div class="desc">${guruChandalaDesc}</div>
    </div>
    ${yogaCardsHtml}
    ${grahaYuddhaCardsHtml}

    ${footerHtmlFor(1)}
  </div>
</div>

<!-- ======================= PAGE 2 ======================= -->
<div class="page" id="jathagam-page-2">
  <div class="inner">
    ${buildReportHeaderHtml({
      subtitle: isTa
        ? 'ஜாதக பலன்கள் (Life Predictions)'
        : isHi
          ? 'कुंडली भविष्यफल (Life Predictions)'
          : 'Astrological Life Predictions'
    })}
    <div class="life-disclaimer">${
      isTa
        ? 'பாரம்பரிய ஜோதிடக் குறியீடுகள் மட்டுமே; மருத்துவம், நிதி, சட்டம் அல்லது உறவு ஆலோசனை அல்ல.'
        : isHi
        ? 'पारंपरिक ज्योतिषीय संकेत मात्र; यह चिकित्सा, वित्त, कानूनी या संबंध सलाह नहीं है।'
        : 'Traditional Jyotisha indicators only; not medical, financial, legal, or relationship advice.'
    }</div>

    <div class="life-grid-big">
      ${lifeCards.map(c => `
      <div class="panel life-card-big">
        <div class="card-header-row">
          <div class="card-title-wrap">
            <span class="card-icon">${c.icon}</span>
            <span class="card-title">${c.title}</span>
          </div>
          <span class="bhava-badge${c.badge.includes('Caution') || c.badge.includes('கவனம்') || c.badge.includes('सावधान') ? ' badge-caution' : ''}">${c.badge}</span>
        </div>
        <p>${c.desc}</p>
      </div>`).join('\n')}
    </div>

    ${footerHtmlFor(2)}
  </div>
</div>

<!-- ======================= PAGE 3: SHORT SUMMARY ======================= -->
<!--
  Plain-language summary of pages 1 and 2. Every fact on this page is computed
  from the chart (and from the existing Navagraha reference data); nothing is
  hardcoded. It must always stay inside ONE A4 sheet, in all three languages:
  text never drops below 10.5px, 5 or more flagged grahas switch the table to
  its compact one-line remedy form, and fitJathagamSummaryText enlarges type
  so the sheet is filled instead of leaving a blank band.
-->
<div class="page summary-page${summaryCompact ? ' is-compact' : ''}" id="jathagam-page-3">
  <div class="inner">
    ${buildReportHeaderHtml({ subtitle: summaryText.subtitle })}

    <!-- 1. Person card: 4 columns, nakshatra box spans 2 columns. -->
    <div class="card summary-details-card" id="summary-details">
      <div class="card-title">${escapeHtml(summaryText.detailsTitle)}</div>
      <div class="summary-details-grid">
        ${summaryDetailsHtml}
      </div>
    </div>

    <!-- 2. Supportive planets (green tint), at most three boxes in a row. -->
    <div class="card summary-good" id="summary-supportive">
      <div class="card-title card-title-green">${escapeHtml(summaryText.supportiveTitle)}</div>
      <div class="summary-good-grid">${supportiveHtml}</div>
    </div>

    <!-- 3. Planets needing care (amber tint): planet / difficulties / remedies. -->
    <div class="card summary-care" id="summary-care">
      <div class="card-title card-title-amber">${escapeHtml(summaryText.careTitle)}</div>
      <table class="care-table${summaryCompact ? ' is-compact' : ''}">
        <colgroup>
          <col style="width: 17%" />
          <col style="width: 33%" />
          <col style="width: 50%" />
        </colgroup>
        <thead>
          <tr>
            <th>${escapeHtml(summaryText.tablePlanet)}</th>
            <th>${escapeHtml(summaryText.tableDifficulties)}</th>
            <th>${escapeHtml(summaryText.tableRemedies)}</th>
          </tr>
        </thead>
        <tbody>${careRowsHtml}</tbody>
      </table>
      ${assessmentNoteHtml}
    </div>

    <!-- 4. In Short: two or three sentences plus the daily habit line. -->
    <div class="card summary-short" id="summary-short">
      <div class="card-title">${escapeHtml(summaryText.summaryTitle)}</div>
      <p class="summary-short-text">${escapeHtml(summarySentences)}</p>
      <p class="summary-short-text">${escapeHtml(summaryText.dailyHabit)}</p>
    </div>

    <!-- 5. Reassurance note (maroon left border). -->
    <div class="reassurance" id="summary-reassurance">${escapeHtml(summaryText.reassurance)}</div>

    ${footerHtmlFor(3)}
  </div>
</div>

<script>
function fitPageToA4(pageEl) {
  var mmToPx = pageEl.getBoundingClientRect().width / 210;
  var targetPx = 297 * mmToPx;
  var inner = pageEl.querySelector('.inner');
  if (!inner) return;
  inner.style.transform = 'none';
  // Measure with the sheet free to grow: min-height alone keeps it at least
  // one A4, so a short page is never scaled up and never clipped.
  pageEl.style.height = 'auto';
  pageEl.style.overflow = 'visible';
  var naturalPx = pageEl.scrollHeight;
  if (naturalPx > targetPx) {
    var scale = targetPx / naturalPx;
    inner.style.transform = 'scale(' + scale + ')';
    inner.style.transformOrigin = 'top center';
    // Only lock the sheet back to one A4 when the content had to be shrunk.
    pageEl.style.height = '297mm';
    pageEl.style.overflow = 'hidden';
  }
}
var fitLifeCardText = ${fitJathagamLifeCardText.toString()};
var fitSummaryText = ${fitJathagamSummaryText.toString()};
window.addEventListener('load', function () {
  fitLifeCardText(document);
  fitSummaryText(document);
  document.querySelectorAll('.page').forEach(function (pageEl) {
    // Page 2 sizes its eight cards to their own content; the sheet fitter is
    // the same safety net every other page gets and is a no-op while the
    // content fits one A4.
    //
    // The Short Summary page is never scaled DOWN: 10.5px is the report's text
    // floor. fitSummaryText only enlarges type to fill leftover space, and the
    // compact table (not a transform) is what keeps a dense chart on one sheet.
    if (pageEl.className.indexOf('summary-page') !== -1) return;
    fitPageToA4(pageEl);
  });
});
if (document.fonts) {
  document.fonts.ready.then(function () { fitLifeCardText(document); fitSummaryText(document); });
  document.fonts.addEventListener('loadingdone', function () { fitLifeCardText(document); fitSummaryText(document); });
}
</script>

</body>
</html>`;
}
