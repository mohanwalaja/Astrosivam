/**
 * Shared page-2 life-area prediction rules.
 *
 * The TypeScript report renderer reads these rules, while PHP report/chart
 * rebuilding reads the same JSON file. The source-based chat uses those rebuilt
 * local report facts plus its curated chat rules; this module is not an AI prompt
 * and is not an external generation path.
 *
 * The rules live in api/astrology/life_cards_rules.json so both language stacks
 * can read the same definitions.
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
  /**
   * Where this card's reading comes from. Derived from the chat's own retrieval
   * rules in knowledge/ai-astrologer/rules/life-areas.json, keyed by cardIndex,
   * so page 2 and the chat cite the same authorities at the same level.
   * `level` is passage | chapter | book, and tests/ai-astrologer-consistency.test.ts
   * validates it against sources.json.
   */
  sources: { id: string; level: 'passage' | 'chapter' | 'book'; verse?: string; page?: string }[];
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
  /** Citations for this card - identical for the report and the chat. */
  sources: CardRule['sources'];
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
          sources: card.sources,
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
        sources: card.sources,
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
        sources: card.sources,
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
      sources: card.sources,
    };
  });
}

/**
 * Formats a prediction summary and its citations for reference/testing.
 * This legacy formatter is not used by the current local customer reply path.
 */
export function predictionsForPrompt(predictions: LifeCardPrediction[], lang: PredLang): string {
  return predictions
    .map((p) => {
      const head = `${p.cardIndex}. ${p.title[lang]} — ${p.badge[lang]}`;
      const body = p.text[lang];
      const why = p.reason[lang] ? `  Because: ${p.reason[lang]}` : '';
      const card = RULES.cards.find((c) => c.cardIndex === p.cardIndex);
      const cite = card ? citationFor(card, lang) : '';
      return `${head}\n  ${body}${why ? '\n' + why : ''}${cite ? '\n  ' + cite : ''}`;
    })
    .join('\n');
}

/**
 * The citation line for a card, in the customer's language. Both page 2 and the
 * chat call this, so a customer who checks a claim against their report finds
 * the same reference at the same level of precision.
 *
 * The level matters: a `passage` citation may name a verse or page, because a
 * verifiedPassages entry exists for it (only TA-02 and TA-07). A `chapter`
 * citation may name a chapter, allowed only for EN-02, whose printed index was
 * read. Everything else is book-level only - we do not claim precision we never
 * verified.
 */
export function citationFor(card: CardRule, lang: PredLang): string {
  const label =
    lang === 'ta' ? 'மூலம்' : lang === 'hi' ? 'स्रोत' : 'Source';
  const parts = card.sources.map((src) => {
    const detail =
      src.level === 'passage' && (src.verse || src.page)
        ? src.verse
          ? (lang === 'ta' ? ` (வசனம் ${src.verse})` : lang === 'hi' ? ` (श्लोक ${src.verse})` : ` (verse ${src.verse})`)
          : (lang === 'ta' ? ` (பக்கம் ${src.page})` : lang === 'hi' ? ` (पृष्ठ ${src.page})` : ` (p. ${src.page})`)
        : '';
    return `${src.id}${detail}`;
  });
  return parts.length ? `${label}: ${parts.join(', ')}` : '';
}

export const LIFE_CARD_RULES = RULES;
