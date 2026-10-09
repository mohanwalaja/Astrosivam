/**
 * ASTRO SIVAM — graha dignity (Uchcha / Swakshetra / Neecha), combustion,
 * retrogression and Neecha Bhanga.
 *
 * ONE table for both stacks: `AstroEngine::planetDignityTable()` in
 * api/astrology/engine.php mirrors the constants below value-for-value, so a
 * Node preview and a PHP-rendered PDF can never disagree about whether Mars is
 * debilitated.
 *
 * Classical values used (BPHS / Jataka Parijata):
 *   Sun      exalted Mesham (1)      debilitated Thulam (7)     owns Simham (5)
 *   Moon     exalted Rishabam (2)    debilitated Viruchigam (8) owns Kadagam (4)
 *   Mars     exalted Magaram (10)    debilitated Kadagam (4)    owns Mesham (1), Viruchigam (8)
 *   Mercury  exalted Kanni (6)       debilitated Meenam (12)    owns Mithunam (3), Kanni (6)
 *   Jupiter  exalted Kadagam (4)     debilitated Magaram (10)   owns Dhanusu (9), Meenam (12)
 *   Venus    exalted Meenam (12)     debilitated Kanni (6)      owns Rishabam (2), Thulam (7)
 *   Saturn   exalted Thulam (7)      debilitated Mesham (1)     owns Makaram (10), Kumbham (11)
 * Rahu/Ketu have no unanimous exaltation or own sign between traditions, so
 * they are reported as `not-applicable` instead of guessing a school.
 */
import { Graha } from './types.js';

export interface DignityText {
  en: string;
  ta: string;
  hi: string;
}

export interface NeechaBhangaReason {
  code: string;
  en: string;
  ta: string;
  hi: string;
  /** Short rule name, e.g. 'by Jupiter conjunction' — shown in the tag. */
  tagEn: string;
  tagTa: string;
  tagHi: string;
}

export type DignityStatus = 'exalted' | 'own' | 'debilitated' | 'neutral' | 'not-applicable';

export interface PlanetDignity {
  graha: string;
  status: DignityStatus;
  statusEn: string;
  statusTa: string;
  statusHi: string;
  isExalted: boolean;
  isOwnSign: boolean;
  isDebilitated: boolean;
  isCombust: boolean;
  isRetrograde: boolean;
  /** True only for a debilitated graha for which a Neecha Bhanga rule applies. */
  isNeechaBhanga: boolean;
  neechaBhangaEn: string;
  neechaBhangaTa: string;
  neechaBhangaHi: string;
  /** Short rule names behind the finding, e.g. 'by Jupiter conjunction'. */
  neechaBhangaTagEn: string;
  neechaBhangaTagTa: string;
  neechaBhangaTagHi: string;
  neechaBhangaReasons: string[];
  /**
   * Compact text for the planet table, always naming the rule that applies,
   * e.g. 'Debilitated (Neecha), Neecha Bhanga (by Jupiter conjunction)'.
   */
  tagsEn: string;
  tagsTa: string;
  tagsHi: string;
}

/** Rasi 1..12 -> owning graha. */
export const SIGN_LORDS: Record<number, Graha> = {
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

/** graha -> exaltation rasi (1..12). Nodes intentionally absent. */
export const EXALTATION_SIGN: Record<string, number> = {
  [Graha.SURYA]: 1,
  [Graha.CHANDRA]: 2,
  [Graha.CHEVVAI]: 10,
  [Graha.BUDHA]: 6,
  [Graha.GURU]: 4,
  [Graha.SUKRA]: 12,
  [Graha.SANI]: 7
};

/** graha -> own signs (Swakshetra). Nodes intentionally absent. */
export const OWN_SIGNS: Record<string, number[]> = {
  [Graha.SURYA]: [5],
  [Graha.CHANDRA]: [4],
  [Graha.CHEVVAI]: [1, 8],
  [Graha.BUDHA]: [3, 6],
  [Graha.GURU]: [9, 12],
  [Graha.SUKRA]: [2, 7],
  [Graha.SANI]: [10, 11]
};

/** rasi -> the graha exalted in it (classical seven only). Used by Neecha Bhanga. */
export const SIGN_EXALTED_BY: Record<number, Graha> = {
  1: Graha.SURYA,
  2: Graha.CHANDRA,
  4: Graha.GURU,
  6: Graha.BUDHA,
  7: Graha.SANI,
  10: Graha.CHEVVAI,
  12: Graha.SUKRA
};

/** Debilitation sign of a graha (exaltation + 6 signs). */
export function debilitationSign(graha: string): number | null {
  const exalted = EXALTATION_SIGN[graha];
  if (!exalted) return null;
  return ((exalted - 1 + 6) % 12) + 1;
}

/** Whole-sign house number of `target` counted from `reference` (both 1-based). */
export function houseFromSign(target: number, reference: number): number {
  return ((target - reference + 12) % 12) + 1;
}

const STATUS_TEXT: Record<DignityStatus, DignityText> = {
  exalted: { en: 'Exalted (Uchcha)', ta: 'உச்சம் (உச்ச நிலை)', hi: 'उच्च (उच्च स्थान)' },
  own: { en: 'Own sign (Swakshetra)', ta: 'ஆட்சி (சுய ராசி)', hi: 'स्वराशि (स्वक्षेत्र)' },
  debilitated: { en: 'Debilitated (Neecha)', ta: 'நீசம் (நீச நிலை)', hi: 'नीच (नीच स्थान)' },
  neutral: { en: 'Neutral', ta: 'சம நிலை', hi: 'सामान्य स्थिति' },
  'not-applicable': { en: 'No classical sign dignity (node)', ta: 'சிறப்பு நிலை இல்லை (சாயா கிரகம்)', hi: 'शास्त्रीय राशि-स्थिति नहीं (छाया ग्रह)' }
};

export const COMBUST_TEXT: DignityText = {
  en: 'Combust (Astangata)',
  ta: 'அஸ்தமனம் (சூரியனுக்கு அருகில்)',
  hi: 'अस्त (सूर्य के निकट)'
};

export const RETROGRADE_TEXT: DignityText = {
  en: 'Retrograde (Vakri)',
  ta: 'வக்கிரம்',
  hi: 'वक्री'
};

/**
 * Heading only — the rule that produced the finding is always named next to
 * it, e.g. "Neecha Bhanga (by Jupiter conjunction)". Never a flat
 * "cancelled" and never a promise of a particular result.
 */
export const NEECHA_BHANGA_TEXT: DignityText = {
  en: 'Neecha Bhanga',
  ta: 'நீச பங்க',
  hi: 'नीच भंग'
};

/**
 * The claim a Neecha Bhanga finding is allowed to make: the classical rule
 * relieves the debilitation, it does not erase it and it guarantees nothing.
 */
export const NEECHA_BHANGA_CAVEAT: DignityText = {
  en: 'This rule reduces the effect of the debilitation; it does not erase it, and no particular result is guaranteed.',
  ta: 'இந்த விதி நீச நிலையின் விளைவைத் தணிக்கிறது; அதை முழுமையாக நீக்குவதுமில்லை, உறுதியான பலனை உறுதி செய்வதுமில்லை.',
  hi: 'यह नियम नीच स्थिति के प्रभाव को कम करता है; उसे मिटाता नहीं और किसी निश्चित परिणाम की गारंटी नहीं देता।'
};

function joinTags(parts: string[], fallback: string): string {
  const clean = parts.filter(part => part && part.trim().length > 0);
  return clean.length > 0 ? clean.join(', ') : fallback;
}

/**
 * Neecha Bhanga test for a debilitated graha.
 *
 * A debilitation is relieved when EITHER
 *   (a) the graha that is exalted in the occupied sign is conjunct the
 *       debilitated graha, or sits in a kendra (1/4/7/10) from the Lagna or the
 *       Moon; OR
 *   (b) the dispositor (lord of the occupied sign) sits in a kendra from the
 *       Lagna or the Moon.
 * Example (test chart): Mars debilitated in Kadagam, and Jupiter — the graha
 * exalted in Kadagam — is conjunct Mars, so Mars is Neecha Bhanga "by Jupiter
 * conjunction".
 *
 * The Moon is never used as a kendra reference for itself: the Moon is always
 * in the 1st house from the Moon, so that check would fire on every chart whose
 * dispositor is the Moon (Kadagam) and invent a reason.
 *
 * `isCancelled` is kept as the internal field name for backwards compatibility;
 * the report-facing wording always names the rule and adds the caveat that the
 * debilitation is relieved, not erased.
 */
export function evaluateNeechaBhanga(input: {
  graha: string;
  rasi: number;
  lagnaRasi: number;
  moonRasi: number;
  rasiByGraha: Record<string, number>;
}): {
  isCancelled: boolean;
  reasons: NeechaBhangaReason[];
  tagEn: string;
  tagTa: string;
  tagHi: string;
  en: string;
  ta: string;
  hi: string;
} {
  const { graha, rasi, lagnaRasi, moonRasi, rasiByGraha } = input;
  const reasons: NeechaBhangaReason[] = [];
  const exaltationGraha = SIGN_EXALTED_BY[rasi];
  const dispositor = SIGN_LORDS[rasi];
  const debilitatedName = GRAHA_TEXT[graha] ?? { en: graha, ta: graha, hi: graha };

  if (exaltationGraha) {
    const exaltRasi = rasiByGraha[exaltationGraha];
    const exaltName = GRAHA_TEXT[exaltationGraha] ?? { en: exaltationGraha, ta: exaltationGraha, hi: exaltationGraha };
    if (exaltRasi === rasi) {
      reasons.push({
        code: 'EXALTATION_LORD_CONJUNCT',
        en: `${exaltName.en}, the graha exalted in this sign, is conjunct the debilitated ${debilitatedName.en}.`,
        ta: `இந்த ராசியில் உச்சம் பெறும் ${exaltName.ta} நீச நிலையில் உள்ள ${debilitatedName.ta} உடன் இணைந்துள்ளார்.`,
        hi: `इस राशि में उच्च का ${exaltName.hi} नीच स्थिति वाले ${debilitatedName.hi} के साथ युति में है।`,
        tagEn: `by ${exaltName.en} conjunction`,
        tagTa: `${exaltName.ta} சேர்க்கையால்`,
        tagHi: `${exaltName.hi} युति के कारण`
      });
    }
    if (exaltRasi) {
      const fromLagna = houseFromSign(exaltRasi, lagnaRasi);
      // The Moon is always 1st from itself — never a valid kendra reference for
      // the Moon's own placement.
      const fromMoon = exaltationGraha === Graha.CHANDRA ? 0 : houseFromSign(exaltRasi, moonRasi);
      if ([1, 4, 7, 10].includes(fromLagna)) {
        reasons.push({
          code: 'EXALTATION_LORD_KENDRA_LAGNA',
          en: `${exaltName.en} is in a kendra (${fromLagna}) from the Lagna.`,
          ta: `உச்ச கிரகம் ${exaltName.ta} லக்னத்திலிருந்து ${fromLagna}-ஆம் கேந்திரத்தில் உள்ளார்.`,
          hi: `${exaltName.hi} लग्न से ${fromLagna}वें केंद्र में है।`,
          tagEn: `by ${exaltName.en} in a kendra (${fromLagna}) from the Lagna`,
          tagTa: `${exaltName.ta} லக்னத்திலிருந்து ${fromLagna}-ஆம் கேந்திரத்தில் இருப்பதால்`,
          tagHi: `${exaltName.hi} लग्न से ${fromLagna}वें केंद्र में होने के कारण`
        });
      }
      if ([1, 4, 7, 10].includes(fromMoon)) {
        reasons.push({
          code: 'EXALTATION_LORD_KENDRA_MOON',
          en: `${exaltName.en} is in a kendra (${fromMoon}) from the Moon.`,
          ta: `உச்ச கிரகம் ${exaltName.ta} சந்திரனிலிருந்து ${fromMoon}-ஆம் கேந்திரத்தில் உள்ளார்.`,
          hi: `${exaltName.hi} चंद्र से ${fromMoon}वें केंद्र में है।`,
          tagEn: `by ${exaltName.en} in a kendra (${fromMoon}) from the Moon`,
          tagTa: `${exaltName.ta} சந்திரனிலிருந்து ${fromMoon}-ஆம் கேந்திரத்தில் இருப்பதால்`,
          tagHi: `${exaltName.hi} चंद्र से ${fromMoon}वें केंद्र में होने के कारण`
        });
      }
    }
  }

  if (dispositor && dispositor !== graha) {
    const dispositorRasi = rasiByGraha[dispositor];
    const dispositorName = GRAHA_TEXT[dispositor] ?? { en: dispositor, ta: dispositor, hi: dispositor };
    if (dispositorRasi) {
      const fromLagna = houseFromSign(dispositorRasi, lagnaRasi);
      const fromMoon = dispositor === Graha.CHANDRA ? 0 : houseFromSign(dispositorRasi, moonRasi);
      if ([1, 4, 7, 10].includes(fromLagna)) {
        reasons.push({
          code: 'DISPOSITOR_KENDRA_LAGNA',
          en: `The dispositor ${dispositorName.en} is in a kendra (${fromLagna}) from the Lagna.`,
          ta: `அதிபதி ${dispositorName.ta} லக்னத்திலிருந்து ${fromLagna}-ஆம் கேந்திரத்தில் உள்ளார்.`,
          hi: `राशीश ${dispositorName.hi} लग्न से ${fromLagna}वें केंद्र में है।`,
          tagEn: `by dispositor ${dispositorName.en} in a kendra (${fromLagna}) from the Lagna`,
          tagTa: `அதிபதி ${dispositorName.ta} லக்னத்திலிருந்து ${fromLagna}-ஆம் கேந்திரத்தில் இருப்பதால்`,
          tagHi: `राशीश ${dispositorName.hi} लग्न से ${fromLagna}वें केंद्र में होने के कारण`
        });
      }
      if ([1, 4, 7, 10].includes(fromMoon)) {
        reasons.push({
          code: 'DISPOSITOR_KENDRA_MOON',
          en: `The dispositor ${dispositorName.en} is in a kendra (${fromMoon}) from the Moon.`,
          ta: `அதிபதி ${dispositorName.ta} சந்திரனிலிருந்து ${fromMoon}-ஆம் கேந்திரத்தில் உள்ளார்.`,
          hi: `राशीश ${dispositorName.hi} चंद्र से ${fromMoon}वें केंद्र में है।`,
          tagEn: `by dispositor ${dispositorName.en} in a kendra (${fromMoon}) from the Moon`,
          tagTa: `அதிபதி ${dispositorName.ta} சந்திரனிலிருந்து ${fromMoon}-ஆம் கேந்திரத்தில் இருப்பதால்`,
          tagHi: `राशीश ${dispositorName.hi} चंद्र से ${fromMoon}वें केंद्र में होने के कारण`
        });
      }
    }
  }

  const isCancelled = reasons.length > 0;
  if (!isCancelled) {
    return { isCancelled: false, reasons, tagEn: '', tagTa: '', tagHi: '', en: '', ta: '', hi: '' };
  }
  const tagEn = reasons.map(reason => reason.tagEn).join('; ');
  const tagTa = reasons.map(reason => reason.tagTa).join('; ');
  const tagHi = reasons.map(reason => reason.tagHi).join('; ');
  return {
    isCancelled: true,
    reasons,
    tagEn,
    tagTa,
    tagHi,
    en: `${NEECHA_BHANGA_TEXT.en} (${tagEn}): ${reasons.map(reason => reason.en).join(' ')} ${NEECHA_BHANGA_CAVEAT.en}`,
    ta: `${NEECHA_BHANGA_TEXT.ta} (${tagTa}): ${reasons.map(reason => reason.ta).join(' ')} ${NEECHA_BHANGA_CAVEAT.ta}`,
    hi: `${NEECHA_BHANGA_TEXT.hi} (${tagHi}): ${reasons.map(reason => reason.hi).join(' ')} ${NEECHA_BHANGA_CAVEAT.hi}`
  };
}

export const GRAHA_TEXT: Record<string, DignityText> = {
  [Graha.SURYA]: { en: 'Sun', ta: 'சூரியன்', hi: 'सूर्य' },
  [Graha.CHANDRA]: { en: 'Moon', ta: 'சந்திரன்', hi: 'चंद्र' },
  [Graha.CHEVVAI]: { en: 'Mars', ta: 'செவ்வாய்', hi: 'मंगल' },
  [Graha.BUDHA]: { en: 'Mercury', ta: 'புதன்', hi: 'बुध' },
  [Graha.GURU]: { en: 'Jupiter', ta: 'குரு', hi: 'गुरु' },
  [Graha.SUKRA]: { en: 'Venus', ta: 'சுக்கிரன்', hi: 'शुक्र' },
  [Graha.SANI]: { en: 'Saturn', ta: 'சனி', hi: 'शनि' },
  [Graha.RAHU]: { en: 'Rahu', ta: 'ராகு', hi: 'राहु' },
  [Graha.KETU]: { en: 'Ketu', ta: 'கேது', hi: 'கேது' }
};

/** Dignity of one graha, plus its Neecha Bhanga finding when debilitated. */
export function computePlanetDignity(input: {
  graha: string;
  rasi: number;
  isCombust: boolean;
  isRetrograde: boolean;
  lagnaRasi: number;
  moonRasi: number;
  rasiByGraha: Record<string, number>;
}): PlanetDignity {
  const { graha, rasi, isCombust, isRetrograde, lagnaRasi, moonRasi, rasiByGraha } = input;
  const exalted = EXALTATION_SIGN[graha] === rasi;
  const own = (OWN_SIGNS[graha] ?? []).includes(rasi);
  const debilitated = debilitationSign(graha) === rasi;
  const isNode = graha === Graha.RAHU || graha === Graha.KETU;

  let status: DignityStatus = 'neutral';
  if (isNode) status = 'not-applicable';
  else if (exalted) status = 'exalted';
  else if (own) status = 'own';
  else if (debilitated) status = 'debilitated';

  const neecha = debilitated
    ? evaluateNeechaBhanga({ graha, rasi, lagnaRasi, moonRasi, rasiByGraha })
    : {
        isCancelled: false,
        reasons: [] as NeechaBhangaReason[],
        tagEn: '',
        tagTa: '',
        tagHi: '',
        en: '',
        ta: '',
        hi: ''
      };

  // The tag always names the rule, e.g. "Neecha Bhanga (by Jupiter
  // conjunction)" — never a flat "cancelled".
  const neechaTag = (lang: 'en' | 'ta' | 'hi'): string =>
    neecha.isCancelled ? `${NEECHA_BHANGA_TEXT[lang]} (${lang === 'ta' ? neecha.tagTa : lang === 'hi' ? neecha.tagHi : neecha.tagEn})` : '';
  const statusText = STATUS_TEXT[status];
  const tagsEn = joinTags(
    [
      statusText.en,
      isCombust ? COMBUST_TEXT.en : '',
      isRetrograde ? RETROGRADE_TEXT.en : '',
      neechaTag('en')
    ],
    statusText.en
  );
  const tagsTa = joinTags(
    [
      statusText.ta,
      isCombust ? COMBUST_TEXT.ta : '',
      isRetrograde ? RETROGRADE_TEXT.ta : '',
      neechaTag('ta')
    ],
    statusText.ta
  );
  const tagsHi = joinTags(
    [
      statusText.hi,
      isCombust ? COMBUST_TEXT.hi : '',
      isRetrograde ? RETROGRADE_TEXT.hi : '',
      neechaTag('hi')
    ],
    statusText.hi
  );

  return {
    graha,
    status,
    statusEn: statusText.en,
    statusTa: statusText.ta,
    statusHi: statusText.hi,
    isExalted: exalted,
    isOwnSign: own,
    isDebilitated: debilitated,
    isCombust,
    isRetrograde,
    isNeechaBhanga: neecha.isCancelled,
    neechaBhangaEn: neecha.en,
    neechaBhangaTa: neecha.ta,
    neechaBhangaHi: neecha.hi,
    neechaBhangaTagEn: neecha.tagEn,
    neechaBhangaTagTa: neecha.tagTa,
    neechaBhangaTagHi: neecha.tagHi,
    neechaBhangaReasons: neecha.reasons.map(reason => reason.code),
    tagsEn,
    tagsTa,
    tagsHi
  };
}

/**
 * One-line dignity summary for report cards, or '' when there is nothing to
 * say. When Neecha Bhanga applies the line names the rule that caused it and
 * carries the caveat, e.g.
 *   "Debilitated (Neecha). Neecha Bhanga (by Jupiter conjunction): Jupiter,
 *    the graha exalted in this sign, is conjunct the debilitated Mars. This
 *    rule reduces the effect of the debilitation; it does not erase it, and no
 *    particular result is guaranteed."
 */
export function dignityCardLine(dignity: PlanetDignity | undefined, lang: 'en' | 'ta' | 'hi'): string {
  if (!dignity) return '';
  const tags = lang === 'ta' ? dignity.tagsTa : lang === 'hi' ? dignity.tagsHi : dignity.tagsEn;
  const status = lang === 'ta' ? dignity.statusTa : lang === 'hi' ? dignity.statusHi : dignity.statusEn;
  const note = lang === 'ta' ? dignity.neechaBhangaTa : lang === 'hi' ? dignity.neechaBhangaHi : dignity.neechaBhangaEn;
  if (dignity.status === 'neutral' && !dignity.isNeechaBhanga && !dignity.isCombust) return '';
  // The tags already name the rule, so the card line leads with the debilitation
  // status and lets the note carry the rule name, the explanation and the caveat.
  return dignity.isNeechaBhanga && note ? `${status}. ${note}` : tags;
}
