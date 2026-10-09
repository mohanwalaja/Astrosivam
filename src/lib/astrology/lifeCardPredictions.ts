/**
 * SHARED life-area predictions — the single source of truth.
 *
 * Page 2 of the Birth Jathagam and the AI Astrologer chat both compute from
 * this module. Neither keeps a private copy of the verdict logic, which is what
 * makes "the chat must never contradict the report" a structural property rather
 * than a prompt instruction.
 *
 * The rules live in api/astrology/life_cards_rules.json so the PHP engine can
 * json_decode the same file (the pattern this repo already uses for
 * api/astrology/rajju.json, shared between matchmaking.ts and babynames.ts).
 *
 * The constants and the verdict rule were extracted verbatim from
 * buildJathagamLifeCards in src/services/jathagamHtmlBuilder.ts (lines 122,
 * 192-193, 256-262) — see the _extractedFrom note in the JSON.
 */
import rulesData from '../../../api/astrology/life_cards_rules.json';

export type PredLang = 'en' | 'ta' | 'hi';

export interface CardRule {
  cardIndex: number;
  house: number | null;
  id: string;
  title: Record<PredLang, string>;
  badgeBase: Record<PredLang, string>;
  lordLabel: Record<PredLang, string>;
  benefit: Record<PredLang, string>;
  caution: Record<PredLang, string>;
  medicalSafety?: boolean;
}

/**
 * The minimal chart the predictor needs. Deliberately small: it takes the
 * facts, not a whole HoroscopeResult, so both the report builder (which has the
 * full object) and the chat (which has a flattened copy from the database) can
 * call it with the same shape.
 */
export interface LordFacts {
  /** The graha ruling this card's house, e.g. "GURU". */
  lordGraha: string;
  lordName: Record<PredLang, string>;
  /** House the lord actually sits in, 1-12. */
  bhava: number;
  /** Sign the lord sits in, 1-12. */
  rasi: number;
  isOwnHouse: boolean;
  isDebilitated: boolean;
  isCombust: boolean;
  isRetrograde: boolean;
  /** Strong malefics within the conjunction orb, after the dignity offset. */
  conjunctMalefics: string[];
}

export interface ChartFacts {
  lagnaRasi: number | null;
  chandraRasi: number | null;
  /** card house -> lord facts. Card 8 has no house, so it is absent here. */
  lords: Record<number, LordFacts>;
  /** Current Mahadasha lord, e.g. "SANI". Drives card 8. */
  currentDashaLord: string | null;
  currentDashaLabel: Record<PredLang, string> | null;
  moonSignLabel: Record<PredLang, string> | null;
}

export interface LifeCardPrediction {
  cardIndex: number;
  id: string;
  house: number | null;
  title: Record<PredLang, string>;
  /** The conclusion. THIS is what must never differ between report and chat. */
  verdict: 'supportive' | 'challenging' | 'unavailable';
  badge: Record<PredLang, string>;
  /** The full page-2 sentence, per language. */
  text: Record<PredLang, string>;
  /** Why, in plain words - shared so the chat explains the same reasons. */
  reason: Record<PredLang, string>;
  lordName: Record<PredLang, string> | null;
  bhava: number | null;
  medicalSafety: boolean;
}

const RULES = rulesData as unknown as {
  constants: { maleficConjunctionOrbDeg: number; dusthanaHouses: number[]; supportHouses: number[] };
  cards: CardRule[];
  verdictByDasha: {
    challengingLords: string[];
    badgeChallenging: Record<PredLang, string>;
    badgeSupportive: Record<PredLang, string>;
    badgeUnknown: string;
  };
  badgeSuffix: {
    challenging: Record<PredLang, string>;
    supportive: Record<PredLang, string>;
    unavailable: string;
  };
  unavailable: { placement: Record<PredLang, string>; dasha: Record<PredLang, string> };
  statusWords: { strong: Record<PredLang, string>; weak: Record<PredLang, string> };
};

const DUSTHANA = new Set(RULES.constants.dusthanaHouses);
const SUPPORT = new Set(RULES.constants.supportHouses);

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? `{${k}}`);
}

/**
 * The verdict for one house-anchored card. Verbatim from
 * jathagamHtmlBuilder.ts lines 261-262:
 *
 *   isSupportive  = isOwnHouse || (!isDusthana && supportHouses.includes(bhava))
 *   isChallenging = isDusthana || isDebilitated || isCombust || conjunctMalefics.length > 0
 *
 * isChallenging takes precedence: a card is Caution if ANY challenge flag is
 * set, even when it is also supportive.
 */
export function verdictForLord(lord: LordFacts): { supportive: boolean; challenging: boolean } {
  const isDusthana = DUSTHANA.has(lord.bhava);
  const supportive = lord.isOwnHouse || (!isDusthana && SUPPORT.has(lord.bhava));
  const challenging =
    isDusthana || lord.isDebilitated || lord.isCombust || lord.conjunctMalefics.length > 0;
  return { supportive, challenging };
}

/** The plain-language reasons, so the chat explains the same things the report says. */
function reasonsFor(lord: LordFacts, lang: PredLang): string {
  const orb = RULES.constants.maleficConjunctionOrbDeg;
  const isDusthana = DUSTHANA.has(lord.bhava);
  const parts: string[] = [];
  if (isDusthana) {
    parts.push(
      lang === 'ta' ? `${lord.bhava}-ஆம் சவாலான பாவத்தில்`
      : lang === 'hi' ? `${lord.bhava}वें चुनौतीपूर्ण भाव में`
      : `placed in a challenging house ${lord.bhava}`
    );
  }
  if (lord.isDebilitated) {
    parts.push(lang === 'ta' ? 'நீச நிலையில்' : lang === 'hi' ? 'नीच राशि में' : 'debilitated');
  }
  if (lord.isCombust) {
    parts.push(
      lang === 'ta' ? 'சூரியனுக்கு அருகில் அஸ்தமன நிலையில்'
      : lang === 'hi' ? 'सूर्य के निकट अस्त'
      : 'combust/too close to Sun'
    );
  }
  if (lord.conjunctMalefics.length) {
    const names = lord.conjunctMalefics.slice(0, 2).join('/');
    parts.push(
      lang === 'ta' ? `${orb}°-க்குள் ${names} சேர்க்கையுடன்`
      : lang === 'hi' ? `${orb}° के भीतर ${names} के साथ`
      : `joined within ${orb}° with ${names}`
    );
  }
  if (lord.isRetrograde) {
    parts.push(
      lang === 'ta' ? 'வக்கிரமாக இருப்பதால் பொறுமை தேவை'
      : lang === 'hi' ? 'वक्री होने से धैर्य आवश्यक'
      : 'retrograde, requiring review and patience'
    );
  }
  return parts.join(', ');
}

/**
 * Computes all eight life-area predictions for one chart. This is the ONLY
 * function that decides what page 2 says and what the chat says.
 */
export function computeLifeCardPredictions(chart: ChartFacts): LifeCardPrediction[] {
  return RULES.cards.map((card) => {
    // ---- Card 8: verdict from the current Dasha, not a house lord.
    if (card.house === null) {
      if (!chart.currentDashaLord) {
        return {
          cardIndex: card.cardIndex,
          id: card.id,
          house: null,
          title: card.title,
          verdict: 'unavailable',
          badge: { en: 'N/A', ta: 'N/A', hi: 'N/A' },
          text: {
            en: RULES.unavailable.dasha.en,
            ta: RULES.unavailable.dasha.ta,
            hi: RULES.unavailable.dasha.hi,
          },
          reason: { en: '', ta: '', hi: '' },
          lordName: null,
          bhava: null,
          medicalSafety: false,
        };
      }
      const challenging = RULES.verdictByDasha.challengingLords.includes(
        chart.currentDashaLord.toUpperCase()
      );
      const badge = challenging
        ? RULES.verdictByDasha.badgeChallenging
        : RULES.verdictByDasha.badgeSupportive;
      const body = challenging ? card.caution : card.benefit;
      return {
        cardIndex: card.cardIndex,
        id: card.id,
        house: null,
        title: card.title,
        verdict: challenging ? 'challenging' : 'supportive',
        badge,
        text: { en: body.en, ta: body.ta, hi: body.hi },
        reason: {
          en: `current Mahadasha lord ${chart.currentDashaLord}`,
          ta: `தற்போதைய மகாதசை அதிபதி ${chart.currentDashaLord}`,
          hi: `वर्तमान महादशा स्वामी ${chart.currentDashaLord}`,
        },
        lordName: null,
        bhava: null,
        medicalSafety: false,
      };
    }

    // ---- Cards 1-7: verdict from the house lord.
    const lord = chart.lords[card.house];
    if (!lord) {
      return {
        cardIndex: card.cardIndex,
        id: card.id,
        house: card.house,
        title: card.title,
        verdict: 'unavailable',
        badge: {
          en: card.badgeBase.en + RULES.badgeSuffix.unavailable,
          ta: card.badgeBase.ta + RULES.badgeSuffix.unavailable,
          hi: card.badgeBase.hi + RULES.badgeSuffix.unavailable,
        },
        text: {
          en: RULES.unavailable.placement.en,
          ta: RULES.unavailable.placement.ta,
          hi: RULES.unavailable.placement.hi,
        },
        reason: { en: '', ta: '', hi: '' },
        lordName: null,
        bhava: null,
        medicalSafety: Boolean(card.medicalSafety),
      };
    }

    const { challenging } = verdictForLord(lord);
    const verdict: LifeCardPrediction['verdict'] = challenging ? 'challenging' : 'supportive';

    const text = {} as Record<PredLang, string>;
    const reason = {} as Record<PredLang, string>;
    const badge = {} as Record<PredLang, string>;

    for (const lang of ['en', 'ta', 'hi'] as PredLang[]) {
      const status = challenging ? RULES.statusWords.weak[lang] : RULES.statusWords.strong[lang];
      const pos = challenging ? RULES.statusWords.weak[lang] : RULES.statusWords.strong[lang];
      const template = challenging ? card.caution[lang] : card.benefit[lang];
      text[lang] = fill(template, { pos, status });
      reason[lang] = reasonsFor(lord, lang);
      badge[lang] =
        card.badgeBase[lang] +
        (challenging ? RULES.badgeSuffix.challenging[lang] : RULES.badgeSuffix.supportive[lang]);
    }

    return {
      cardIndex: card.cardIndex,
      id: card.id,
      house: card.house,
      title: card.title,
      verdict,
      badge,
      text,
      reason,
      lordName: lord.lordName,
      bhava: lord.bhava,
      medicalSafety: Boolean(card.medicalSafety),
    };
  });
}

/**
 * The block injected into the chat prompt as OFFICIAL REPORT PREDICTIONS.
 * Because it is generated from the same call the report used, the model is
 * being handed the report's own words, not a paraphrase of them.
 */
export function predictionsForPrompt(predictions: LifeCardPrediction[], lang: PredLang): string {
  return predictions
    .map((p) => {
      const head = `${p.cardIndex}. ${p.title[lang]} — ${p.badge[lang]}`;
      const body = p.text[lang];
      const why = p.reason[lang] ? `  Because: ${p.reason[lang]}` : '';
      return `${head}\n  ${body}${why ? '\n' + why : ''}`;
    })
    .join('\n');
}

export const LIFE_CARD_RULES = RULES;
