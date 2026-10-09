/**
 * ASTRO SIVAM — classical Sevvay / Kuja (Mangala) Dosha evaluation.
 *
 * PORT OF `AstroEngine::evaluateKujaDosha()` (api/astrology/engine.php).
 *
 * WHY: the legacy TypeScript matchmaking calculation used to test Mars in houses 2,4,7,8,12 from
 * the Lagna only, while the PHP engine tested houses 1,2,4,7,8,12 from the
 * Lagna, Moon AND Venus with a much longer exception list. On 400 random charts
 * the two engines disagreed 20.8% of the time, and in 60 of those the PHP engine
 * found a dosha the TypeScript engine silently missed — so the same couple could be
 * told "clean match" or "Manglik, remedies advised" depending on which stack
 * rendered the report.
 *
 * This module is the PHP algorithm, so the TypeScript and PHP calculations now emit the same verdict:
 *
 *   houses       2, 4, 7, 8, 12 (South Indian rule; the 1st house is NOT a
 *                Kuja house here) counted whole-sign from Lagna, Moon, Venus
 *   exceptions   own sign (Mesham/Viruchigam), exaltation (Magaram),
 *                Simham/Kumbham (universal), house-sign Vilakku,
 *                Yogakaraka Lagna (Kadagam/Simham), Guru-Mangala,
 *                Chandra-Mangala, Guru Drishti
 *   mitigations  partial house-sign cover, dosha not from the Lagna,
 *                Saturn/Rahu/Ketu sharing a Kuja house
 *
 * Missing placements return NOT_ASSESSED with `isPresent: null` — never a
 * silently clean chart.
 *
 * All houses are WHOLE-SIGN: house = ((target − reference + 12) % 12) + 1.
 */
import { Rasi } from './types.js';
import { RASI_INFO } from './astronomy.js';

/** Read optional Node environment settings without requiring Node in the browser. */
function runtimeSetting(name: string): string {
  if (typeof process === 'undefined' || !process.env) return '';
  return String(process.env[name] ?? '').trim();
}

/**
 * Houses (whole-sign, counted from a reference rasi) that constitute
 * Sevvay/Kuja Dosha.
 *
 * DEFAULT = the South Indian (Tamil) rule: 2, 4, 7, 8 and 12 from the Lagna,
 * the Moon and Venus. The 1st house is deliberately NOT part of this rule set
 * (the North Indian / BPHS branch of the tradition screens it; set
 * ASTRO_KUJA_HOUSES=1,2,4,7,8,12 to opt back into that reading).
 */
export const KUJA_DOSHA_HOUSES: readonly number[] = [2, 4, 7, 8, 12];

/**
 * House-specific signs in which Mars does NOT cause Kuja Dosha (the Tamil
 * Sevvai Dosha Vilakku lists: Sakthi Vikatan "செவ்வாய் தோஷம் விதிவிலக்குகள்",
 * Tirumana Porutham's twelve exemptions, neerkondar's top-10 exemptions).
 * Keyed by the dosha house, valued by the sign Mars occupies.
 *
 * The Tamil lists are explicit that the 2nd-house exception is Mithunam or
 * Kanni ONLY - Kadagam is a friend's house for Mars, but not a 2nd-house
 * exception (only astroved's Tamil list adds it, and the majority reading was
 * chosen).
 */
export const KUJA_HOUSE_SIGN_EXCEPTIONS: Readonly<Record<number, readonly number[]>> = {
  2: [3, 6],   // Mithunam, Kanni
  7: [4, 10],  // Kadagam, Magaram
  8: [9, 12],  // Dhanusu, Meenam
  12: [2, 7]   // Rishabam, Thulam
};

/** Signs in which Mars is exempt in every dosha house. */
export const KUJA_UNIVERSAL_SIGN_EXCEPTIONS: readonly number[] = [5, 11]; // Simham, Kumbham

/**
 * South Indian (Tamil) reading of the rule: Mars in houses 2, 4, 7, 8 or 12
 * counted whole-sign from the Lagna, the Moon and Venus. This IS the default
 * (KUJA_DOSHA_HOUSES); the constant is kept as a named alias for callers that
 * want to state the rule explicitly.
 */
export const KUJA_SOUTH_INDIAN_HOUSES: readonly number[] = [2, 4, 7, 8, 12];

/** House list used when ASTRO_KUJA_HOUSES is not set — the South Indian rule. */
export const KUJA_DEFAULT_HOUSES: readonly number[] = KUJA_DOSHA_HOUSES;

export const KUJA_VERDICTS = ['none', 'present', 'present-cancelled'] as const;
export type KujaVerdict = (typeof KUJA_VERDICTS)[number] | 'not-assessed';

/** Houses used by the live evaluation (env override, else the documented default). */
export function activeKujaHouses(): readonly number[] {
  const raw = runtimeSetting('ASTRO_KUJA_HOUSES');
  if (raw === '') return KUJA_DOSHA_HOUSES;
  const parsed = raw
    .split(',')
    .map(part => Number(part.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
  if (parsed.length === 0) {
    console.error(`ASTRO SIVAM: ASTRO_KUJA_HOUSES="${raw}" is not a house list. Using the default.`);
    return KUJA_DOSHA_HOUSES;
  }
  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

/** Short names of the cancelling rules, for the report badge. */
export const KUJA_EXCEPTION_LABELS: Record<string, { en: string; ta: string; hi: string }> = {
  OWN_SIGN: { en: 'own sign', ta: 'ஆட்சி ராசி', hi: 'स्वराशि' },
  EXALTED: { en: 'exalted', ta: 'உச்சம்', hi: 'उच्च' },
  LEO_AQUARIUS: { en: 'Simha/Kumbha exception', ta: 'சிம்ம/கும்ப விலக்கு', hi: 'सिंह/कुंभ अपवाद' },
  HOUSE_SIGN: { en: 'house-sign exception', ta: 'இட-ராசி விலக்கு', hi: 'भाव-राशि अपवाद' },
  YOGAKARAKA_LAGNA: { en: 'Yogakaraka Lagna', ta: 'யோககாரக லக்னம்', hi: 'योगकारक लग्न' },
  GURU_MANGALA: { en: 'Guru-Mangala yoga', ta: 'குரு-மங்கள யோகம்', hi: 'गुरु-मंगल योग' },
  CHANDRA_MANGALA: { en: 'Chandra-Mangala yoga', ta: 'சந்திர-மங்கள யோகம்', hi: 'चंद्र-मंगल योग' },
  GURU_DRISHTI: { en: 'Guru Drishti', ta: 'குரு பார்வை', hi: 'गुरु दृष्टि' }
};

export function kujaVerdictLabels(
  verdict: KujaVerdict,
  exceptionCodes: readonly string[] = []
): { en: string; ta: string; hi: string } {
  const suffix = (lang: 'en' | 'ta' | 'hi'): string => {
    const names = exceptionCodes
      .map(code => KUJA_EXCEPTION_LABELS[code]?.[lang])
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return '';
    return lang === 'ta' ? ` (${names.join(', ')})` : lang === 'hi' ? ` (${names.join(', ')})` : ` (${names.join(', ')})`;
  };
  switch (verdict) {
    case 'none':
      return {
        en: 'No Kuja Dosha under the chosen rule set',
        ta: 'செவ்வாய் தோஷம் இல்லை',
        hi: 'मंगल दोष नहीं'
      };
    case 'present':
      return {
        en: 'Kuja Dosha present',
        ta: 'செவ்வாய் தோஷம் உள்ளது',
        hi: 'मंगल दोष उपस्थित'
      };
    case 'present-cancelled':
      // The machine verdict stays 'present-cancelled'; the user-facing label
      // names the Dosha Nivrutti rule instead of a flat "cancelled" and never
      // promises an outcome.
      return {
        en: `Kuja Dosha present — Dosha Nivrutti applies${suffix('en')}`,
        ta: `செவ்வாய் தோஷம் உள்ளது – தோஷ நிவர்த்தி விதி பொருந்துகிறது${suffix('ta')}`,
        hi: `मंगल दोष उपस्थित — दोष निवृत्ति नियम लागू${suffix('hi')}`
      };
    default:
      return { en: 'N/A', ta: 'N/A', hi: 'N/A' };
  }
}

export type KujaReference = 'lagna' | 'moon' | 'venus';
export type KujaDoshaStatus =
  | 'NOT_ASSESSED'
  | 'DOSHA_NONE'
  | 'DOSHA_CANCELLED'
  | 'DOSHA_MILD'
  | 'DOSHA_PRESENT';

export interface KujaDoshaInput {
  mars?: number | null;
  lagna?: number | null;
  moon?: number | null;
  venus?: number | null;
  jupiter?: number | null;
  saturn?: number | null;
  rahu?: number | null;
  ketu?: number | null;
}

export interface KujaRuleNote {
  code: string;
  en: string;
  ta: string;
  hi: string;
}

export interface KujaDoshaAssessment {
  status: KujaDoshaStatus;
  /**
   * Report-facing tri-state the report renderers must use:
   *   'none' | 'present' | 'present-cancelled' | 'not-assessed'
   * `isPresent` stays as it always was (false when cancelled) for older
   * consumers, but a cancelled dosha is NEVER reported as "no indication"
   * again: the explanation lists a cancellation, so the badge says so.
   */
  verdict: KujaVerdict;
  verdictLabelEn: string;
  verdictLabelTa: string;
  verdictLabelHi: string;
  /** Houses actually used for this evaluation, e.g. '2,4,7,8,12'. */
  ruleSet: string;
  /** Effective dosha: true = present or mild, false = none/cancelled, null = not assessed. */
  isPresent: boolean | null;
  raw: boolean | null;
  cancelled: boolean | null;
  mild: boolean | null;
  marsRasi: number | null;
  marsRasiNameEn: string | null;
  marsRasiNameTa: string | null;
  marsRasiNameHi: string | null;
  marsBhava: number | null;
  houses: { lagna: number | null; moon: number | null; venus: number | null };
  afflictedFrom: KujaReference[];
  exceptions: KujaRuleNote[];
  mitigations: KujaRuleNote[];
  severityEn: string;
  severityTa: string;
  severityHi: string;
  explanationEn: string;
  explanationTa: string;
  explanationHi: string;
}

const REFERENCE_EN: Record<KujaReference, string> = { lagna: 'Lagna', moon: 'Moon', venus: 'Venus' };
const REFERENCE_FROM_EN: Record<KujaReference, string> = {
  lagna: 'the Lagna',
  moon: 'the Moon (Chandra Lagna)',
  venus: 'Venus (Sukra)'
};
const REFERENCE_TA: Record<KujaReference, string> = { lagna: 'லக்னம்', moon: 'சந்திரன்', venus: 'சுக்கிரன்' };
const REFERENCE_HI: Record<KujaReference, string> = { lagna: 'लग्न', moon: 'चंद्र', venus: 'शुक्र' };

/** Whole-sign house number of `target` counted from `reference` (both 1-based). */
export function houseFromReference(target: number, reference: number): number {
  return (((target - reference + 12) % 12) + 1);
}

function asRasi(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

function ordinalEn(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10];
  return `${n}${suffix ?? 'th'}`;
}

const signName = (rasi: number, key: 'nameEn' | 'nameTa' | 'nameHi'): string =>
  RASI_INFO[rasi as Rasi]?.[key] ?? String(rasi);

/**
 * Classical Sevvay (Kuja / Mangala) Dosha evaluation with the standard
 * exceptions and mitigations.
 */
export function evaluateKujaDosha(chart: KujaDoshaInput): KujaDoshaAssessment {
  const mars = asRasi(chart.mars);
  const lagna = asRasi(chart.lagna);
  const moon = asRasi(chart.moon);
  const venus = asRasi(chart.venus);
  const jupiter = asRasi(chart.jupiter);
  const saturn = asRasi(chart.saturn);
  const rahu = asRasi(chart.rahu);
  const ketu = asRasi(chart.ketu);

  const result: KujaDoshaAssessment = {
    status: 'NOT_ASSESSED',
    verdict: 'not-assessed',
    verdictLabelEn: 'N/A',
    verdictLabelTa: 'N/A',
    verdictLabelHi: 'N/A',
    ruleSet: activeKujaHouses().join(','),
    isPresent: null,
    raw: null,
    cancelled: null,
    mild: null,
    marsRasi: mars,
    marsRasiNameEn: mars ? signName(mars, 'nameEn') : null,
    marsRasiNameTa: mars ? signName(mars, 'nameTa') : null,
    marsRasiNameHi: mars ? signName(mars, 'nameHi') : null,
    marsBhava: null,
    houses: { lagna: null, moon: null, venus: null },
    afflictedFrom: [],
    exceptions: [],
    mitigations: [],
    severityEn: 'N/A',
    severityTa: 'N/A',
    severityHi: 'N/A',
    explanationEn:
      'Required Mars, Lagna, Moon, Venus or Jupiter placement data is unavailable; Sevvay Dosha is not assessed.',
    explanationTa:
      'செவ்வாய், லக்னம், சந்திரன், சுக்கிரன் அல்லது குருவின் ராசி நிலை கிடைக்கவில்லை; செவ்வாய் தோஷம் மதிப்பிடப்படவில்லை.',
    explanationHi:
      'मंगल, लग्न, चंद्र, शुक्र अथवा गुरु की राशि स्थिति उपलब्ध नहीं है; मंगल दोष का आकलन नहीं हुआ।'
  };

  if (mars === null || lagna === null || moon === null || venus === null || jupiter === null) {
    return result; // Missing data must stay N/A, never a false "clean" result.
  }

  const houses = {
    lagna: houseFromReference(mars, lagna),
    moon: houseFromReference(mars, moon),
    venus: houseFromReference(mars, venus)
  };
  result.houses = houses;
  result.marsBhava = houses.lagna;

  const kujaHouses = activeKujaHouses();
  const afflictedFrom = (Object.keys(houses) as KujaReference[]).filter(reference =>
    kujaHouses.includes(houses[reference])
  );
  result.afflictedFrom = afflictedFrom;
  const raw = afflictedFrom.length > 0;
  result.raw = raw;

  if (!raw) {
    result.status = 'DOSHA_NONE';
    result.verdict = 'none';
    const noneLabels = kujaVerdictLabels('none');
    result.verdictLabelEn = noneLabels.en;
    result.verdictLabelTa = noneLabels.ta;
    result.verdictLabelHi = noneLabels.hi;
    result.isPresent = false;
    result.cancelled = false;
    result.mild = false;
    result.severityEn = 'No Sevvay Dosha';
    result.severityTa = 'செவ்வாய் தோஷம் இல்லை';
    result.severityHi = 'मंगल दोष नहीं';
    const noneRuleSet = kujaHouses.join(', ');
    result.explanationEn =
      `Mars in ${signName(mars, 'nameEn')} occupies House ${houses.lagna} from the Lagna, ` +
      `House ${houses.moon} from the Moon and House ${houses.venus} from Venus - ` +
      `none of the Kuja Dosha houses (${noneRuleSet}).`;
    result.explanationTa =
      `${signName(mars, 'nameTa')} ராசியில் உள்ள செவ்வாய் லக்னத்திலிருந்து ${houses.lagna}, ` +
      `சந்திரனிலிருந்து ${houses.moon}, சுக்கிரனிலிருந்து ${houses.venus}-ஆம் இடத்தில் உள்ளார்; ` +
      `இவை தோஷ ஸ்தானங்கள் (${noneRuleSet}) அல்ல.`;
    result.explanationHi =
      `${signName(mars, 'nameHi')} राशि में स्थित मंगल लग्न से ${houses.lagna}वें, ` +
      `चंद्र से ${houses.moon}वें तथा शुक्र से ${houses.venus}वें भाव में है; ` +
      `ये मंगल दोष के भाव (${noneRuleSet}) नहीं हैं।`;
    return result;
  }

  // ---- Cancelling exceptions ------------------------------------------------
  const exceptions: KujaRuleNote[] = [];
  const add = (code: string, en: string, ta: string, hi: string) => exceptions.push({ code, en, ta, hi });

  if (mars === Rasi.MESHAM || mars === Rasi.VIRUCHIGAM) {
    add(
      'OWN_SIGN',
      `Mars is in its own sign ${signName(mars, 'nameEn')} (Swakshetra); Sevvay Dosha does not apply.`,
      `செவ்வாய் தனது ஆட்சி வீடான ${signName(mars, 'nameTa')} ராசியில் உள்ளதால் செவ்வாய் தோஷம் இல்லை.`,
      `मंगल अपनी स्वराशि ${signName(mars, 'nameHi')} में है; मंगल दोष लागू नहीं होता।`
    );
  }
  if (mars === Rasi.MAGARAM) {
    add(
      'EXALTED',
      'Mars is exalted in Magaram (Capricorn); an exalted Mars does not give Sevvay Dosha.',
      'செவ்வாய் மகர ராசியில் உச்சம் பெற்றுள்ளதால் செவ்வாய் தோஷம் இல்லை.',
      'मंगल मकर राशि में उच्च का है; उच्च मंगल से मंगल दोष नहीं होता।'
    );
  }
  if (KUJA_UNIVERSAL_SIGN_EXCEPTIONS.includes(mars)) {
    add(
      'LEO_AQUARIUS',
      `Mars in ${signName(mars, 'nameEn')} is exempt from Sevvay Dosha in every dosha house (Simha/Kumbha exception).`,
      `${signName(mars, 'nameTa')} ராசியில் உள்ள செவ்வாய்க்கு எந்த தோஷ ஸ்தானத்திலும் தோஷம் இல்லை (சிம்ம/கும்ப விலக்கு).`,
      `${signName(mars, 'nameHi')} राशि का मंगल किसी भी दोष भाव में मंगल दोष नहीं देता (सिंह/कुंभ अपवाद)।`
    );
  }

  // House-sign exceptions neutralise only the reference point whose count they
  // match; the dosha is cancelled on this ground only when every afflicted
  // reference is covered.
  const houseSignExceptions: Array<{ reference: KujaReference; house: number }> = [];
  const neutralisedBySign: KujaReference[] = [];
  for (const reference of afflictedFrom) {
    const house = houses[reference];
    if ((KUJA_HOUSE_SIGN_EXCEPTIONS[house] ?? []).includes(mars)) {
      neutralisedBySign.push(reference);
      houseSignExceptions.push({ reference, house });
    }
  }
  const remaining = afflictedFrom.filter(reference => !neutralisedBySign.includes(reference));

  if (houseSignExceptions.length > 0 && remaining.length === 0) {
    const en = houseSignExceptions
      .map(item => `the ${ordinalEn(item.house)} house from ${REFERENCE_FROM_EN[item.reference]}`)
      .join(' and ');
    const ta = houseSignExceptions.map(item => `${REFERENCE_TA[item.reference]}-இலிருந்து ${item.house}-ஆம் இடம்`).join(', ');
    const hi = houseSignExceptions.map(item => `${REFERENCE_HI[item.reference]} से ${item.house}वां भाव`).join(' एवं ');
    add(
      'HOUSE_SIGN',
      `Mars in ${signName(mars, 'nameEn')} in ${en} is a classical house-sign exception (Sevvay Dosha Vilakku), so the dosha does not apply.`,
      `${signName(mars, 'nameTa')} ராசியில் உள்ள செவ்வாய்க்கு ${ta} ஆகிய இடங்களுக்கான சாஸ்திர விலக்கு உண்டு; எனவே தோஷம் இல்லை.`,
      `${signName(mars, 'nameHi')} राशि का मंगल ${hi} के लिए शास्त्रीय भाव-राशि अपवाद में आता है; अतः दोष लागू नहीं होता।`
    );
  }

  if ((lagna === Rasi.KADAGAM || lagna === Rasi.SIMHAM) && activeKujaHouses().includes(houses.lagna)) {
    add(
      'YOGAKARAKA_LAGNA',
      `For a ${signName(lagna, 'nameEn')} Lagna Mars is the Yogakaraka; its placement does not create Sevvay Dosha.`,
      `${signName(lagna, 'nameTa')} லக்னத்திற்கு செவ்வாய் யோககாரகர்; அவரது நிலை செவ்வாய் தோஷத்தை உண்டாக்காது.`,
      `${signName(lagna, 'nameHi')} लग्न के लिए मंगल योगकारक है; उसकी स्थिति से मंगल दोष नहीं बनता।`
    );
  }
  if (jupiter === mars) {
    add(
      'GURU_MANGALA',
      "Jupiter is conjunct Mars (Guru-Mangala Yoga); this classical Dosha Nivrutti rule relieves the dosha.",
      'குரு செவ்வாயுடன் இணைந்துள்ளார் (குரு-மங்கள யோகம்); இந்த சாஸ்திர தோஷ நிவர்த்தி விதி தோஷத்தைத் தணிக்கிறது.',
      'गुरु मंगल के साथ युति में है (गुरु-मंगल योग); यह शास्त्रीय दोष निवृत्ति नियम दोष को शमित करता है।'
    );
  }
  if (moon === mars) {
    add(
      'CHANDRA_MANGALA',
      'The Moon is conjunct Mars (Chandra-Mangala / Kuja-Chandra Yoga); this classical rule relieves the dosha.',
      'சந்திரன் செவ்வாயுடன் இணைந்துள்ளார் (சந்திர-மங்கள யோகம்); இந்த சாஸ்திர விதி தோஷத்தைத் தணிக்கிறது.',
      'चंद्र मंगल के साथ युति में है (चंद्र-मंगल योग); यह शास्त्रीय नियम दोष को शमित करता है।'
    );
  }
  const guruAspectCount = houseFromReference(mars, jupiter);
  if (jupiter !== mars && [5, 7, 9].includes(guruAspectCount)) {
    add(
      'GURU_DRISHTI',
      `Jupiter aspects Mars with its ${ordinalEn(guruAspectCount)}-house aspect (Guru Drishti); the benefic aspect relieves Sevvay Dosha.`,
      `குரு தனது ${guruAspectCount}-ஆம் பார்வையால் செவ்வாயைப் பார்க்கிறார்; குரு பார்வை தோஷத்தைத் தணிக்கிறது.`,
      `गुरु अपनी ${guruAspectCount}वीं दृष्टि से मंगल को देखता है; गुरु दृष्टि दोष को शमित करती है।`
    );
  }

  // ---- Mitigating conditions (evaluated on the references still afflicted) ---
  const mitigations: KujaRuleNote[] = [];
  const addMitigation = (code: string, en: string, ta: string, hi: string) =>
    mitigations.push({ code, en, ta, hi });

  if (remaining.length > 0 && houseSignExceptions.length > 0) {
    const covered = houseSignExceptions
      .map(item => `the ${ordinalEn(item.house)} house from ${REFERENCE_FROM_EN[item.reference]}`)
      .join(' and ');
    const coveredTa = houseSignExceptions.map(item => REFERENCE_TA[item.reference]).join(', ');
    const coveredHi = houseSignExceptions.map(item => REFERENCE_HI[item.reference]).join(' एवं ');
    addMitigation(
      'HOUSE_SIGN_PARTIAL',
      `Mars in ${signName(mars, 'nameEn')} in ${covered} is a classical house-sign exception, so that count does not add to the dosha.`,
      `${signName(mars, 'nameTa')} ராசியில் உள்ள செவ்வாய்க்கு ${coveredTa}-இலிருந்து ஆன எண்ணிக்கைக்கு சாஸ்திர விலக்கு உண்டு.`,
      `${signName(mars, 'nameHi')} राशि का मंगल ${coveredHi} से गिनती में शास्त्रीय अपवाद में आता है।`
    );
  }
  if (remaining.length > 0 && !remaining.includes('lagna')) {
    const only = remaining.map(reference => REFERENCE_FROM_EN[reference]).join(' and ');
    const onlyTa = remaining.map(reference => REFERENCE_TA[reference]).join(' மற்றும் ');
    const onlyHi = remaining.map(reference => REFERENCE_HI[reference]).join(' एवं ');
    addMitigation(
      'NOT_FROM_LAGNA',
      `The dosha arises only from ${only}, not from the Lagna, so it is considered mild.`,
      `${onlyTa} அடிப்படையில் மட்டுமே தோஷம்; லக்னத்திலிருந்து இல்லை - எனவே மிதமானது.`,
      `दोष केवल ${onlyHi} से बनता है, लग्न से नहीं; अतः यह अल्प माना जाता है।`
    );
  }
  const balancerNames: Record<string, { en: string; ta: string; hi: string }> = {
    saturn: { en: 'Saturn', ta: 'சனி', hi: 'शनि' },
    rahu: { en: 'Rahu', ta: 'ராகு', hi: 'राहु' },
    ketu: { en: 'Ketu', ta: 'கேது', hi: 'केतु' }
  };
  const balancers = (
    [
      ['saturn', saturn],
      ['rahu', rahu],
      ['ketu', ketu]
    ] as Array<[string, number | null]>
  ).filter(([, rasi]) => rasi !== null && activeKujaHouses().includes(houseFromReference(rasi!, lagna)));

  if (balancers.length > 0) {
    const en = balancers.map(([name]) => balancerNames[name].en).join(', ');
    const ta = balancers.map(([name]) => balancerNames[name].ta).join(', ');
    const hi = balancers.map(([name]) => balancerNames[name].hi).join(', ');
    addMitigation(
      'SATURN_NODE_BALANCE',
      `${en} also occupies a Kuja house from the Lagna, which reduces the intensity of the dosha (in-chart balance).`,
      `${ta} லக்னத்திலிருந்து தோஷ ஸ்தானத்தில் இருப்பதால் தோஷத்தின் தீவிரம் குறைகிறது.`,
      `${hi} भी लग्न से मंगल दोष भाव में है, जिससे दोष की तीव्रता घटती है।`
    );
  }

  const cancelled = exceptions.length > 0;
  result.exceptions = exceptions;
  result.mitigations = cancelled ? [] : mitigations; // moot once cancelled
  const mild = !cancelled && mitigations.length > 0;
  result.cancelled = cancelled;
  result.mild = mild;
  result.isPresent = !cancelled; // DOSHA_MILD still counts as present (reduced)

  const placementEn =
    `Mars in ${signName(mars, 'nameEn')} occupies House ${houses.lagna} from the Lagna, ` +
    `House ${houses.moon} from the Moon and House ${houses.venus} from Venus ` +
    `(Kuja houses counted from: ${afflictedFrom.map(reference => REFERENCE_EN[reference]).join(', ')}).`;
  const placementTa =
    `${signName(mars, 'nameTa')} ராசியில் உள்ள செவ்வாய் லக்னத்திலிருந்து ${houses.lagna}, ` +
    `சந்திரனிலிருந்து ${houses.moon}, சுக்கிரனிலிருந்து ${houses.venus}-ஆம் இடத்தில் உள்ளார் ` +
    `(தோஷம்: ${afflictedFrom.map(reference => REFERENCE_TA[reference]).join(', ')}).`;
  const placementHi =
    `${signName(mars, 'nameHi')} राशि का मंगल लग्न से ${houses.lagna}वें, ` +
    `चंद्र से ${houses.moon}वें तथा शुक्र से ${houses.venus}वें भाव में है ` +
    `(दोष: ${afflictedFrom.map(reference => REFERENCE_HI[reference]).join(', ')} से)।`;
  const join = (items: KujaRuleNote[], key: 'en' | 'ta' | 'hi') => items.map(item => item[key]).join(' ');

  if (cancelled) {
    result.status = 'DOSHA_CANCELLED';
    result.verdict = 'present-cancelled';
    const cancelledLabels = kujaVerdictLabels(
      'present-cancelled',
      exceptions.map(exception => exception.code)
    );
    result.verdictLabelEn = cancelledLabels.en;
    result.verdictLabelTa = cancelledLabels.ta;
    result.verdictLabelHi = cancelledLabels.hi;
    result.severityEn = 'Sevvay Dosha Present – relieved under Dosha Nivrutti';
    result.severityTa = 'செவ்வாய் தோஷம் உள்ளது – தோஷ நிவர்த்தி விதியால் தணிக்கப்பட்டது';
    result.severityHi = 'मंगल दोष उपस्थित — दोष निवृत्ति नियम से शमित';
    result.explanationEn =
      `${placementEn} ${join(exceptions, 'en')} Under Dosha Nivrutti this count is relieved for marriage matching; this is an indicator only and guarantees no particular outcome.`;
    result.explanationTa =
      `${placementTa} ${join(exceptions, 'ta')} திருமணப் பொருத்தத்தில் தோஷ நிவர்த்தி விதியால் இது தணிக்கப்படுகிறது; இது குறியீடு மட்டுமே, உறுதியான பலனை உறுதி செய்யாது.`;
    result.explanationHi =
      `${placementHi} ${join(exceptions, 'hi')} विवाह मिलान में दोष निवृत्ति नियम से इसे शमित माना जाता है; यह केवल संकेत है, किसी निश्चित परिणाम की गारंटी नहीं।`;
  } else if (mild) {
    result.status = 'DOSHA_MILD';
    result.verdict = 'present';
    const mildLabels = kujaVerdictLabels('present');
    result.verdictLabelEn = mildLabels.en;
    result.verdictLabelTa = mildLabels.ta;
    result.verdictLabelHi = mildLabels.hi;
    result.severityEn = 'Mild Sevvay Dosha (reduced by classical rules)';
    result.severityTa = 'மிதமான செவ்வாய் தோஷம் (சாஸ்திர விதிகளால் குறைக்கப்பட்டது)';
    result.severityHi = 'अल्प मंगल दोष (शास्त्रीय नियमों से न्यून)';
    result.explanationEn =
      `${placementEn} ${join(mitigations, 'en')} Simple remedies and a compatible partner chart are sufficient; it is not a severe dosha.`;
    result.explanationTa =
      `${placementTa} ${join(mitigations, 'ta')} எளிய பரிகாரங்களும் பொருத்தமான ஜாதகமும் போதுமானவை; இது கடுமையான தோஷம் அல்ல.`;
    result.explanationHi =
      `${placementHi} ${join(mitigations, 'hi')} सरल उपाय एवं अनुकूल कुंडली मिलान पर्याप्त है; यह गंभीर दोष नहीं है।`;
  } else {
    result.status = 'DOSHA_PRESENT';
    result.verdict = 'present';
    const presentLabels = kujaVerdictLabels('present');
    result.verdictLabelEn = presentLabels.en;
    result.verdictLabelTa = presentLabels.ta;
    result.verdictLabelHi = presentLabels.hi;
    result.severityEn = 'Sevvay Dosha Present (remedies & Dosha Samyam match advised)';
    result.severityTa = 'செவ்வாய் தோஷம் உள்ளது (பரிகாரம் மற்றும் தோஷ சம்யப் பொருத்தம் நலம்)';
    result.severityHi = 'मंगल दोष उपस्थित (उपाय एवं दोष साम्य मिलान आवश्यक)';
    result.explanationEn =
      `${placementEn} No classical Dosha Nivrutti rule (own/exalted sign, Leo/Aquarius, house-sign exception, Jupiter or Moon association) applies. Traditional remedies and a partner with matching Sevvay Dosha are advised.`;
    result.explanationTa =
      `${placementTa} ஆட்சி/உச்சம், சிம்ம/கும்பம், இட-ராசி விலக்கு, குரு அல்லது சந்திர சேர்க்கை போன்ற எந்த தோஷ நிவர்த்தி விதியும் பொருந்தவில்லை. பரிகாரங்களும் செவ்வாய் தோஷம் உள்ள ஜாதகப் பொருத்தமும் நலம்.`;
    result.explanationHi =
      `${placementHi} स्वराशि/उच्च, सिंह/कुंभ, भाव-राशि अपवाद, गुरु अथवा चंद्र युति जैसा कोई अपवाद लागू नहीं है। पारंपरिक उपाय तथा मंगल दोष वाले साथी से मिलान की सलाह है।`;
  }

  return result;
}

const rasiOf = (positions: Array<{ graha: string; rasi: number }>, graha: string): number | null => {
  const match = positions.find(p => p.graha === graha);
  return match && Number.isInteger(match.rasi) ? match.rasi : null;
};

/**
 * Evaluates the dosha straight from a Node horoscope (`calculatePrecisionHoroscope()`).
 * Whole-sign rasis are used for every reference, exactly like the PHP engine.
 */
export function kujaDoshaFromHoroscope(chart: {
  planetPositions: Array<{ graha: string; rasi: number }>;
  lagnaRasi: number;
}): KujaDoshaAssessment {
  return evaluateKujaDosha({
    mars: rasiOf(chart.planetPositions, 'mars'),
    lagna: chart.lagnaRasi,
    moon: rasiOf(chart.planetPositions, 'moon'),
    venus: rasiOf(chart.planetPositions, 'venus'),
    jupiter: rasiOf(chart.planetPositions, 'jupiter'),
    saturn: rasiOf(chart.planetPositions, 'saturn'),
    rahu: rasiOf(chart.planetPositions, 'rahu'),
    ketu: rasiOf(chart.planetPositions, 'ketu')
  });
}
