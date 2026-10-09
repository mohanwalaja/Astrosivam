/**
 * ASTRO SIVAM — Birth Jathagam page 3 (Short Summary): planet classification.
 *
 * ONE named rule for both engines. The Node report (browser HTML builder and
 * jsPDF backend) and the PHP report (api/astrology/pdf_mpdf_reports.php) must
 * print the SAME supportive / needs-care lists for the same chart, so the rule
 * lives here once and `api/astrology/pdf_mpdf_reports.php` mirrors it
 * statement-for-statement (see `jathagamPlanetSummaryLists()` there and the
 * parity fixture tests/fixtures/jathagam-summary-parity.json).
 *
 * The rule reuses the report's EXISTING Navagraha material and nothing else:
 *   - dignity        : server/astrology/dignity.ts (EXALTATION_SIGN, OWN_SIGNS,
 *                      debilitationSign) — the same table the planet table and
 *                      the engine's screening indicators already use.
 *   - combustion     : `isCombust` from the computed chart (Astangata).
 *   - house placement: `bhavaNumber`, with 6/8/12 treated as the challenging
 *                      houses, exactly as the engine's screening indicator does.
 *   - conjunction    : sharing a house with a natural malefic
 *                      (Mars / Saturn / Rahu / Ketu) — the same four grahas the
 *                      engine's screening rule treats as malefics.
 *   - lordship       : the lagna lord placed in a supportive house is counted as
 *                      supportive; the lagna lord in 6/8/12 is counted as a
 *                      planet needing care.
 *   - remedies       : NAVAGRAHA_DOSHA_DATA (worship = deity + day, donation =
 *                      charity) plus the additive lamp-oil and mantra fields in
 *                      jathagamDoshaData.ts. No second remedy system.
 *
 * This module is deliberately DOM-free and dependency-light so the jsPDF
 * backend, the browser builder and the test suites can all import it.
 */
import { Graha, Rasi } from '../../server/astrology/types';
import {
  NAVAGRAHA_DOSHA_DATA,
  NAVAGRAHA_ORDER,
  JATHAGAM_PLANET_PROFILES,
  SHORT_SUMMARY_LAMP_OIL,
  SHORT_SUMMARY_MANTRA,
  SHORT_SUMMARY_DONATION,
  SHORT_SUMMARY_TEXT,
  DoshaLanguage
} from './jathagamDoshaData';
import {
  EXALTATION_SIGN,
  OWN_SIGNS,
  debilitationSign,
  houseFromSign,
  SIGN_LORDS,
  SIGN_EXALTED_BY
} from '../../server/astrology/dignity';

/** Houses read as challenging (Dusthana) by the report's screening rule. */
export const SUMMARY_CHALLENGING_HOUSES: number[] = [6, 8, 12];

/** Houses read as supportive (kendra / trikona / upachaya 11) when occupied. */
export const SUMMARY_SUPPORTIVE_HOUSES: number[] = [1, 4, 5, 7, 9, 10, 11];

/**
 * A malefic only counts as a close conjunction partner inside this orb — the
 * same 10° the page-2 life cards use (`MALEFIC_CONJUNCTION_ORB_DEG`), because a
 * same-house pair 20° apart is not a yuti in classical reading.
 */
export const SUMMARY_MALEFIC_CONJUNCTION_ORB_DEG = 10;

/** Houses read as supportive (kendra / trikona / upachaya) for a LAGNA LORD. */
export const SUMMARY_LORD_SUPPORTIVE_HOUSES: number[] = [1, 2, 4, 5, 7, 9, 10, 11];

/** Grahas this report has always classified as natural malefics. */
export const SUMMARY_NATURAL_MALEFICS: string[] = [Graha.CHEVVAI, Graha.SANI, Graha.RAHU, Graha.KETU];

/**
 * Traditional debilitation sign of the two nodes, as used by the engine's
 * screening indicator (`navagrahaDebilitationSign`). Classical schools do not
 * agree on the nodes, so this is the report's own existing convention.
 */
export const SUMMARY_NODE_DEBILITATION_SIGN: Record<string, Rasi> = {
  [Graha.RAHU]: Rasi.VIRUCHIGAM,
  [Graha.KETU]: Rasi.RISHABAM
};

/** Supportive boxes are capped so the Short Summary always fits one A4 page. */
export const SUMMARY_SUPPORTIVE_LIMIT = 3;

/** From this many flagged grahas the page switches to the compact table. */
export const SUMMARY_COMPACT_THRESHOLD = 5;

export interface SummaryPlanetPosition {
  graha: string;
  rasi?: number | null;
  /** Degrees inside the rasi (0–30); used for the close-conjunction orb. */
  degrees?: number | null;
  bhavaNumber?: number | null;
  isCombust?: boolean;
}

export interface SummaryChartInput {
  lagnaRasi?: number | null;
  planetPositions?: SummaryPlanetPosition[];
}

export interface SummarySupportivePlanet {
  key: string;
  house: number | null;
}

export interface SummaryCarePlanet {
  key: string;
  house: number | null;
  /** Plain-language difficulty line for the flagged graha. */
  difficulties: string;
  /** Deity and weekday, taken from the existing reference-table entry. */
  worship: string;
  /** Lamp oil (additive field). */
  lamp: string;
  /** Grain, taken from the existing reference-table charity entry. */
  donation: string;
  /** Short mantra in the language's own script (additive field). */
  mantra: string;
  /** One-line remedy used in compact mode (5 or more flagged grahas). */
  compactLine: string;
}

export interface JathagamSummaryPlanets {
  supportive: SummarySupportivePlanet[];
  needsCare: SummaryCarePlanet[];
  /** True when 5 or more grahas are flagged: the compact table is required. */
  compact: boolean;
  /** How many of the nine grahas were read from a usable placement. */
  assessedCount: number;
  /**
   * False when some graha could not be read: the report must then say the
   * assessment is incomplete instead of implying that nothing was flagged.
   */
  assessmentComplete: boolean;
  /** The N/A note the page shows when `assessmentComplete` is false. */
  incompleteNote: string;
}

const isValidRasi = (value: unknown): value is number =>
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;

const isValidHouse = (value: unknown): value is number =>
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;

/** Deity + weekday of the existing reference-table entry, one short line. */
const worshipLine = (key: string, lang: DoshaLanguage): string => {
  const info = NAVAGRAHA_DOSHA_DATA[key];
  if (!info) return '';
  return `${info.deity[lang]} · ${info.day[lang]}`;
};

/**
 * Classify the nine grahas of a computed chart into the supportive group and
 * the group needing care. Deterministic: same input, same lists, in both
 * engines.
 */
export function classifyJathagamPlanetsForSummary(
  result: SummaryChartInput,
  lang: DoshaLanguage
): JathagamSummaryPlanets {
  const positions = (result.planetPositions || []).filter(
    p => p && NAVAGRAHA_DOSHA_DATA[p.graha] && isValidRasi(p.rasi)
  );
  const lagnaRasi = isValidRasi(result.lagnaRasi) ? Number(result.lagnaRasi) : null;
  const lagnaLord = lagnaRasi === null ? null : SIGN_LORDS[lagnaRasi] ?? null;

  const supportive: Array<SummarySupportivePlanet & { score: number }> = [];
  const needsCare: Array<SummaryCarePlanet & { score: number }> = [];

  for (const key of NAVAGRAHA_ORDER) {
    const position = positions.find(p => p.graha === key);
    if (!position) continue;
    const rasi = Number(position.rasi);
    const house = isValidHouse(position.bhavaNumber) ? Number(position.bhavaNumber) : null;

    // ---- findings (all reused from the existing report logic) -------------
    const classicalDebilitation = debilitationSign(key);
    const nodeDebilitation = SUMMARY_NODE_DEBILITATION_SIGN[key] ?? null;
    const isDebilitated = classicalDebilitation === rasi || nodeDebilitation === rasi;
    const isExalted = EXALTATION_SIGN[key] === rasi;
    const isOwnSign = (OWN_SIGNS[key] ?? []).includes(rasi);
    const isChallengingHouse = house !== null && SUMMARY_CHALLENGING_HOUSES.includes(house);
    // Close conjunction with a natural malefic: same house AND inside the
    // report's 10° orb (a same-sign pair 20° apart is not a yuti).
    const conjunctMalefic = positions.some(p => {
      if (p.graha === key || !SUMMARY_NATURAL_MALEFICS.includes(p.graha)) return false;
      if (house === null || !isValidHouse(p.bhavaNumber) || Number(p.bhavaNumber) !== house) return false;
      const a = Number(position.degrees);
      const b = Number(p.degrees);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return true; // same house, no degrees: keep the classical reading
      const separation = Math.abs(a - b);
      return Math.min(separation, 30 - separation) <= SUMMARY_MALEFIC_CONJUNCTION_ORB_DEG;
    });
    // Dignity offsets a single combustion, exactly as the page-2 life cards do:
    // a graha in its own sign or exaltation is not reported as "needing care"
    // just because it is close to the Sun.
    const isCombust = Boolean(position.isCombust) && !isExalted && !isOwnSign;
    const isSupportiveHouse = house !== null && SUMMARY_SUPPORTIVE_HOUSES.includes(house);
    const isLagnaLord = lagnaLord !== null && lagnaLord === key;
    const lordInSupportiveHouse = isLagnaLord && house !== null && SUMMARY_LORD_SUPPORTIVE_HOUSES.includes(house);

    // Neecha Bhanga follows the existing dignity rule: a relieved debilitation
    // is still reported, but it is not counted as an extra care signal.
    const neechaBhangaApplies = isDebilitated && classicalDebilitation !== null
      ? neechaBhangaHolds(key, rasi, lagnaRasi, positions)
      : false;

    let careScore = 0;
    if (isDebilitated) careScore += neechaBhangaApplies ? 1 : 2;
    if (isCombust) careScore += 1;
    if (isChallengingHouse) careScore += 1;
    if (conjunctMalefic) careScore += 1;
    if (isLagnaLord && isChallengingHouse) careScore += 1;

    let supportScore = 0;
    if (isExalted) supportScore += 3;
    if (isOwnSign) supportScore += 2;
    if (lordInSupportiveHouse) supportScore += 2;
    if (isSupportiveHouse) supportScore += 1;

    if (careScore > 0) {
      const profile = JATHAGAM_PLANET_PROFILES[key];
      const lamp = SHORT_SUMMARY_LAMP_OIL[key]?.[lang] ?? '';
      const donation = SHORT_SUMMARY_DONATION[key]?.[lang] ?? '';
      const mantra = SHORT_SUMMARY_MANTRA[key]?.[lang] ?? '';
      const worship = worshipLine(key, lang);
      const compactLine = [worship.split(' · ')[0], NAVAGRAHA_DOSHA_DATA[key].day[lang], lamp, donation, mantra]
        .filter(Boolean)
        .join(' · ');
      needsCare.push({
        key,
        house,
        score: careScore,
        difficulties: profile?.difficulties?.[lang] ?? '',
        worship,
        lamp,
        donation,
        mantra,
        compactLine
      });
      continue;
    }

    if (supportScore > 0) {
      supportive.push({ key, house, score: supportScore });
    }
  }

  const assessedCount = NAVAGRAHA_ORDER.filter(key => positions.some(p => p.graha === key)).length;
  const assessmentComplete = assessedCount >= NAVAGRAHA_ORDER.length;
  const incompleteNote = SHORT_SUMMARY_TEXT[lang]?.assessmentIncomplete || SHORT_SUMMARY_TEXT.en.assessmentIncomplete;

  const orderIndex = (key: string) => NAVAGRAHA_ORDER.indexOf(key);
  needsCare.sort((a, b) => b.score - a.score || orderIndex(a.key) - orderIndex(b.key));
  supportive.sort((a, b) => b.score - a.score || orderIndex(a.key) - orderIndex(b.key));

  return {
    supportive: supportive.slice(0, SUMMARY_SUPPORTIVE_LIMIT).map(({ key, house }) => ({ key, house })),
    needsCare: needsCare.map(({ key, house, difficulties, worship, lamp, donation, mantra, compactLine }) => ({
      key, house, difficulties, worship, lamp, donation, mantra, compactLine
    })),
    compact: needsCare.length >= SUMMARY_COMPACT_THRESHOLD,
    assessedCount,
    assessmentComplete,
    incompleteNote
  };
}

/**
 * Neecha Bhanga as the report's dignity.ts defines it: the debilitation is
 * relieved when the graha exalted in the occupied sign, or the dispositor, is
 * conjunct the debilitated graha or sits in a kendra from the Lagna.
 */
function neechaBhangaHolds(
  graha: string,
  rasi: number,
  lagnaRasi: number | null,
  positions: SummaryPlanetPosition[]
): boolean {
  const rasiByGraha: Record<string, number> = {};
  for (const p of positions) rasiByGraha[p.graha] = Number(p.rasi);
  const exaltationGraha = SIGN_EXALTED_BY[rasi];
  const dispositor = SIGN_LORDS[rasi];
  const kendra = [1, 4, 7, 10];
  if (lagnaRasi !== null && exaltationGraha && rasiByGraha[exaltationGraha] !== undefined) {
    if (exaltationGraha !== graha && rasiByGraha[exaltationGraha] === rasi) return true;
    if (kendra.includes(houseFromSign(rasiByGraha[exaltationGraha], lagnaRasi))) return true;
  }
  if (lagnaRasi !== null && dispositor && dispositor !== graha && rasiByGraha[dispositor] !== undefined) {
    if (kendra.includes(houseFromSign(rasiByGraha[dispositor], lagnaRasi))) return true;
  }
  return false;
}
