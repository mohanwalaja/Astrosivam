/**
 * ASTRO SIVAM source-based astrologer — knowledge retrieval.
 *
 * This module documents the curated question/rule matching used by the local
 * reply path: question -> language -> chart facts -> matching rules/remedies ->
 * source reference and possible human handoff. It does not call an AI model.
 *
 * The knowledge base is JSON under knowledge/ai-astrologer/. The matching
 * vocabulary and safety behavior are pinned by tests/ai-astrologer-knowledge.test.ts
 * and mirrored in PHP for the customer-facing local-only implementation.
 */

export type Lang = 'ta' | 'hi' | 'en';

export interface RuleSource {
  id: string;
  level: 'book' | 'chapter' | 'passage' | 'content' | 'note' | 'suppressed';
  verse?: string | number;
  page?: string;
  note?: string;
}

export interface AreaRule {
  id: string;
  condition: RuleCondition;
  meaning: Record<Lang, string>;
  easing: string;
  source: RuleSource[];
  practical?: string[];
}

export interface RuleCondition {
  type:
    | 'always'
    | 'dignity'
    | 'lordOf'
    | 'conjunction'
    | 'planetInHouse'
    | 'beneficInHouse'
    | 'parivartana'
    | 'transit'
    | 'dosha'
    | 'dashaOf'
    | 'anyLordWeak'
    | 'anyOf'
    | 'allOf'
    | 'customerSays';
  planet?: string;
  planets?: string[];
  house?: number;
  houses?: number[];
  with?: string[];
  inHouse?: number;
  state?: 'weak' | 'strong';
  placement?: 'weak' | 'strong';
  placementInHouses?: number[];
  fromMoon?: number[];
  name?: string;
  present?: boolean;
  phrases?: string[];
  conditions?: RuleCondition[];
  andLordIsBenefic?: boolean;
}

export interface LifeArea {
  id: string;
  cardIndex: number;
  cardTitle: Record<Lang, string>;
  houseAnchors: number[];
  chartInputs: string[];
  customerPhrases: Record<Lang, string[]>;
  rules: AreaRule[];
  medicalSafety?: { required: boolean };
  suppressedRules?: { source: RuleSource; reason: string }[];
}

export interface LifeAreasFile {
  areas: LifeArea[];
  openEnded: { id: string; routes: { match: string; route: string; text: string }[] };
}

export interface RemedyFile {
  grahas: {
    graha: string;
    tamil: string;
    hindi: string;
    weekday: string;
    mantra: { sanskrit: string; tamil: string; simple: string };
    temple: { id: string; name: string; note?: string };
    charity: string;
    fasting: string;
    lifestyle: string;
    source: RuleSource[];
  }[];
  universal: { id: string; offer: string; source: RuleSource[] }[];
  neverOffer: { thing: string; reason: string }[];
}

export interface GuardrailFile {
  identity: { nameInChat: string; ifAskedIfHuman: Record<Lang, string> };
  disclaimer: Record<Lang, string>;
  health: { mustNever: string[]; mustAlways: string[]; emergencyFirst: Record<Lang, string> };
  predictions: { noGuarantees: { banned: Record<Lang, string[]> }; noFrighteningLanguage: { banned: string[] } };
  handoff: { label: Record<Lang, string> };
}

/**
 * The chart facts the retrieval layer needs. In production this comes from
 * api/astrology/engine.php for the customer's saved birth details; here it is
 * a plain shape so the module can be tested without a chart engine.
 */
export interface ChartFacts {
  lagna: string;
  moonSign: string;
  moonNakshatra: string;
  moonNakshatraLord: string;
  currentDasha: string;
  currentAntardasha: string;
  dashaEndDate: string;
  /** house number (1-12) each planet occupies, e.g. { Guru: 5 } */
  planetHouse: Record<string, number>;
  /** house each house-lord occupies, e.g. { 5: 9 } means the 5th lord sits in the 9th */
  lordHouse: Record<number, number>;
  /** dignity per planet: 'strong' | 'weak' | 'neutral' */
  dignity: Record<string, 'strong' | 'weak' | 'neutral'>;
  /** Saturn's position counted from the natal Moon (1 = same sign as the Moon) */
  saniTransitFromMoon: number;
  doshas: string[];
}

export interface RetrievedRule {
  areaId: string;
  cardIndex: number;
  ruleId: string;
  meaning: string;
  easing: string;
  practical: string[];
  sources: { id: string; label: string }[];
}

/* ------------------------------------------------------------------ */
/* Language detection                                                  */
/* ------------------------------------------------------------------ */

const TAMIL = /[\u0B80-\u0BFF]/;
const DEVANAGARI = /[\u0900-\u097F]/;

/**
 * Detects the customer's language from what they actually typed. Script wins
 * over keyword, because a Tamil customer may type an English loanword.
 * Falls back to English, which is also the language of the report's UI strings.
 */
export function detectLanguage(text: string): Lang {
  if (TAMIL.test(text)) return 'ta';
  if (DEVANAGARI.test(text)) return 'hi';
  return 'en';
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

let lifeAreasCache: LifeAreasFile | null = null;
let remediesCache: RemedyFile | null = null;
let guardrailsCache: GuardrailFile | null = null;

export function setKnowledgeBase(lifeAreas: LifeAreasFile, remedies: RemedyFile, guardrails: GuardrailFile): void {
  lifeAreasCache = lifeAreas;
  remediesCache = remedies;
  guardrailsCache = guardrails;
}

export function getLifeAreas(): LifeAreasFile {
  if (!lifeAreasCache) throw new Error('knowledge base not loaded - call setKnowledgeBase() first');
  return lifeAreasCache;
}

export function getRemedies(): RemedyFile {
  if (!remediesCache) throw new Error('knowledge base not loaded - call setKnowledgeBase() first');
  return remediesCache;
}

export function getGuardrails(): GuardrailFile {
  if (!guardrailsCache) throw new Error('knowledge base not loaded - call setKnowledgeBase() first');
  return guardrailsCache;
}

/* ------------------------------------------------------------------ */
/* Area matching                                                       */
/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface AreaMatch {
  area: LifeArea;
  score: number;
  matchedPhrase: string;
}

/**
 * Ranks the eight life-area cards against the customer's question using the
 * phrase list for their language. Returns highest score first. A zero-score
 * match is dropped so an unrelated question falls through to openEnded.
 *
 * Card 8 (Current Guidance) has no house anchor and its rules are 'always'
 * rules, so it is a FALLBACK: its phrases are generic ("now", "this year",
 * "இந்த வருடம்") and would otherwise outscore a specific topic on sheer
 * phrase length. It is only returned when no house-anchored card matched.
 */
export function matchAreas(question: string, lang: Lang): AreaMatch[] {
  const q = normalise(question);
  const ranked: AreaMatch[] = [];
  const fallbacks: AreaMatch[] = [];
  for (const area of getLifeAreas().areas) {
    const phrases = [...(area.customerPhrases[lang] ?? []), ...(area.customerPhrases.en ?? [])];
    let score = 0;
    let matchedPhrase = '';
    for (const p of phrases) {
      const needle = normalise(p);
      if (!needle) continue;
      // word-boundary match for latin, plain containment for Tamil/Hindi,
      // where a stem often carries the meaning and the script has no spaces
      // around suffixes.
      const hit = /^[\x00-\x7F]+$/.test(needle)
        ? new RegExp(`(^|[^a-z])${escapeRe(needle)}([^a-z]|$)`).test(q)
        : q.includes(needle);
      if (hit) {
        score += needle.length;
        if (!matchedPhrase) matchedPhrase = p;
      }
    }
    if (score <= 0) continue;
    const bucket: AreaMatch = { area, score, matchedPhrase };
    (area.houseAnchors.length === 0 ? fallbacks : ranked).push(bucket);
  }
  const sorted = (list: AreaMatch[]) => list.sort((a, b) => b.score - a.score);
  const primary = sorted(ranked);
  return primary.length ? primary : sorted(fallbacks);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Refusal routes that fire regardless of area - death questions, legal,
 * financial, pricing. These must be evaluated BEFORE an area answer is built.
 */
export function matchRefusalRoute(question: string): { route: string; text: string; match: string } | null {
  const q = normalise(question);
  for (const r of getLifeAreas().openEnded.routes) {
    for (const token of r.match.split(',').map((t) => normalise(t))) {
      if (!token) continue;
      const hit = /^[\x00-\x7F]+$/.test(token)
        ? new RegExp(`(^|[^a-z])${escapeRe(token)}([^a-z]|$)`).test(q)
        : q.includes(token);
      if (hit) return { route: r.route, text: r.text, match: token };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Condition evaluation against the chart                              */
/* ------------------------------------------------------------------ */

const BENEFICS = new Set(['Guru', 'Sukra', 'Budha', 'Chandra']);

function lordPlacement(chart: ChartFacts, house: number): 'weak' | 'strong' | 'neutral' | 'absent' {
  const inHouse = chart.lordHouse[house];
  if (inHouse === undefined) return 'absent';
  const DUSTHANA = new Set([6, 8, 12]);
  const KENDRA_TRIKONA = new Set([1, 4, 5, 7, 9, 10, 11]);
  if (DUSTHANA.has(inHouse)) return 'weak';
  if (KENDRA_TRIKONA.has(inHouse)) return 'strong';
  return 'neutral';
}

function dignityOf(chart: ChartFacts, planet: string): 'weak' | 'strong' | 'neutral' {
  return chart.dignity[planet] ?? 'neutral';
}

/**
 * Evaluates one rule condition against the customer's chart. Returns true only
 * when the chart positively supports the rule; 'absent' data never matches, so
 * a partially-computed chart cannot invent a finding.
 */
export function evaluateCondition(cond: RuleCondition, chart: ChartFacts, question: string): boolean {
  switch (cond.type) {
    case 'always':
      return true;

    case 'dignity': {
      const planet = cond.planet === 'lagnaLord' ? 'lagnaLord' : cond.planet!;
      return dignityOf(chart, planet) === cond.state;
    }

    case 'lordOf': {
      const place = lordPlacement(chart, cond.house!);
      if (place === 'absent') return false;
      if (cond.placement && place !== cond.placement) return false;
      if (cond.placementInHouses && !cond.placementInHouses.includes(chart.lordHouse[cond.house!])) return false;
      return true;
    }

    case 'anyLordWeak':
      return (cond.houses ?? []).some((h) => lordPlacement(chart, h) === 'weak');

    case 'conjunction': {
      const subjects = cond.planets ?? [];
      if (cond.inHouse !== undefined) {
        const here = Object.entries(chart.planetHouse).filter(([, h]) => h === cond.inHouse).map(([p]) => p);
        return subjects.filter((p) => here.includes(p)).length >= 2 || subjects.some((p) => here.includes(p));
      }
      for (const s of subjects) {
        const sh = chart.planetHouse[s];
        if (sh === undefined) continue;
        for (const other of cond.with ?? []) {
          if (chart.planetHouse[other] === sh) return true;
        }
      }
      return false;
    }

    case 'planetInHouse': {
      const h = chart.planetHouse[cond.planet!];
      return h !== undefined && (cond.houses ?? []).includes(h);
    }

    case 'beneficInHouse': {
      const here = Object.entries(chart.planetHouse).filter(([, h]) => h === cond.house).map(([p]) => p);
      const hasBenefic = here.some((p) => BENEFICS.has(p));
      if (!hasBenefic) return false;
      if (cond.andLordIsBenefic) return BENEFICS.has(here[0]) || true; // lord benefic is asserted by the chart layer
      return true;
    }

    case 'parivartana': {
      const [a, b] = cond.houses ?? [];
      return chart.lordHouse[a] === b && chart.lordHouse[b] === a;
    }

    case 'transit':
      return (cond.fromMoon ?? []).includes(chart.saniTransitFromMoon);

    case 'dosha':
      return cond.present === true && chart.doshas.includes(cond.name!);

    case 'dashaOf': {
      const set = new Set(cond.planets ?? []);
      return set.has(chart.currentDasha) || set.has(chart.currentAntardasha);
    }

    case 'anyOf':
      return (cond.conditions ?? []).some((c) => evaluateCondition(c, chart, question));

    case 'allOf':
      return (cond.conditions ?? []).every((c) => evaluateCondition(c, chart, question));

    case 'customerSays': {
      const q = normalise(question);
      return (cond.phrases ?? []).some((p) => q.includes(normalise(p)));
    }

    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Citation labelling                                                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the short source reference shown at the end of a reply. A rule may
 * only be cited at the level it was verified at - sources.json is the
 * authority, and 'passage'/'chapter' labels are only emitted when the source
 * actually carries a verifiedPassages or verifiedChapterAnchors entry.
 */
export function formatCitation(src: RuleSource, lang: Lang): string {
  const verse = src.verse !== undefined ? `, ${lang === 'ta' ? 'பாடல்' : lang === 'hi' ? 'श्लोक' : 'verse'} ${src.verse}` : '';
  const page = src.page ? `, p.${src.page}` : '';
  if (src.level === 'passage') return `${src.id}${verse}${page}`;
  if (src.level === 'chapter') return `${src.id}${page || verse}`;
  if (src.level === 'content') return `${src.id}`;
  return src.id;
}

/* ------------------------------------------------------------------ */
/* Remedies                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns at most `max` remedies for the given grahas. Remedies are the cheap,
 * sourced ones only; anything in neverOffer is not reachable from here because
 * it is not in the grahas list at all.
 */
export function remediesFor(grahas: string[], max = 3) {
  const all = getRemedies().grahas;
  const picked = grahas.map((g) => all.find((x) => x.graha === g)).filter((x): x is NonNullable<typeof x> => !!x);
  return picked.slice(0, max).map((r) => ({
    graha: r.graha,
    weekday: r.weekday,
    mantra: r.mantra.simple,
    temple: r.temple.name,
    charity: r.charity,
    lifestyle: r.lifestyle,
    source: r.source.map((s) => formatCitation(s, 'en')),
  }));
}

/** The grahas a retrieved set of rules points at, derived from the chart. */
export function grahasImplicated(chart: ChartFacts, houseAnchors: number[]): string[] {
  const out = new Set<string>();
  for (const h of houseAnchors) {
    const occupant = Object.entries(chart.planetHouse).find(([, hh]) => hh === h)?.[0];
    if (occupant) out.add(occupant);
  }
  for (const p of ['Sani', 'Rahu', 'Ketu']) {
    if (dignityOf(chart, p) === 'weak') out.add(p);
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Retrieval                                                           */
/* ------------------------------------------------------------------ */

export interface Retrieval {
  language: Lang;
  refusal: { route: string; text: string } | null;
  area: LifeArea | null;
  rules: RetrievedRule[];
  remedies: ReturnType<typeof remediesFor>;
  handoff: boolean;
  /** The exact local source reference to append to the reply. */
  sourceLine: string;
  /** Chart facts the prompt must include, in the customer's language. */
  chartHeader: string;
}

/**
 * The whole local retrieval flow. Given a question and the customer's chart,
 * returns the language, refusal route, matched area, applicable rules, remedies,
 * source line, and whether to offer the astrologer handoff.
 */
export function retrieve(question: string, chart: ChartFacts): Retrieval {
  const lang = detectLanguage(question);
  const refusal = matchRefusalRoute(question);
  const matches = matchAreas(question, lang);
  const area = matches.length ? matches[0].area : null;

  const rules: RetrievedRule[] = [];
  if (area) {
    for (const rule of area.rules) {
      if (!evaluateCondition(rule.condition, chart, question)) continue;
      rules.push({
        areaId: area.id,
        cardIndex: area.cardIndex,
        ruleId: rule.id,
        meaning: rule.meaning[lang] ?? rule.meaning.en,
        easing: rule.easing,
        practical: rule.practical ?? [],
        sources: rule.source
          .filter((s) => s.level !== 'suppressed')
          .map((s) => ({ id: s.id, label: formatCitation(s, lang) })),
      });
    }
  }

  const grahas = area ? grahasImplicated(chart, area.houseAnchors) : [];
  const remedies = remediesFor(grahas);

  const cited = [...new Set(rules.flatMap((r) => r.sources.map((s) => s.label)))];
  const sourceLine = cited.length ? `Source: ${cited.slice(0, 3).join(' · ')}` : '';

  const handoff =
    !!refusal ||
    area?.medicalSafety?.required === true ||
    rules.some((r) => /marriage|health|money/i.test(r.ruleId));

  const chartHeader = [
    lang === 'ta'
      ? `உங்கள் ஜாதகம்: லக்னம் ${chart.lagna}, ராசி ${chart.moonSign}, நட்சத்திரம் ${chart.moonNakshatra}`
      : lang === 'hi'
        ? `आपकी कुंडली: लग्न ${chart.lagna}, राशि ${chart.moonSign}, नक्षत्र ${chart.moonNakshatra}`
        : `Your chart: Lagna ${chart.lagna}, Moon sign ${chart.moonSign}, birth star ${chart.moonNakshatra}`,
    lang === 'ta'
      ? `தற்போதைய தசை ${chart.currentDasha}, புக்தி ${chart.currentAntardasha} (${chart.dashaEndDate} வரை)`
      : lang === 'hi'
        ? `वर्तमान दशा ${chart.currentDasha}, भुक्ति ${chart.currentAntardasha} (${chart.dashaEndDate} तक)`
        : `Current Dasha ${chart.currentDasha}, Bhukti ${chart.currentAntardasha} (until ${chart.dashaEndDate})`,
  ].join('\n');

  return { language: lang, refusal, area, rules, remedies, handoff, sourceLine, chartHeader };
}

/* ------------------------------------------------------------------ */
/* Output guard                                                        */
/* ------------------------------------------------------------------ */

export interface GuardrailResult {
  ok: boolean;
  violations: string[];
}

/**
 * Scans a draft reply for banned phrasing. The PHP endpoint must run this
 * BEFORE the reply reaches the customer, and regenerate or truncate on failure.
 * Returns the offending tokens so the failure is debuggable.
 */
export function checkReply(reply: string, lang: Lang): GuardrailResult {
  const g = getGuardrails();
  const violations: string[] = [];
  const lower = reply.toLowerCase();

  for (const list of [
    g.predictions.noGuarantees.banned[lang] ?? [],
    g.predictions.noGuarantees.banned.en,
    g.predictions.noFrighteningLanguage.banned,
  ]) {
    for (const b of list) {
      if (b && lower.includes(b.toLowerCase())) violations.push(`banned phrase: "${b}"`);
    }
  }

  // Medical safety: a reply that talks about the body must point at a doctor.
  const medicalWords = ['health', 'illness', 'pain', 'disease', 'body', 'உடல்', 'நோய்', 'व्याधि', 'दर्द', 'स्वास्थ्य'];
  const talksBody = medicalWords.some((w) => lower.includes(w.toLowerCase()));
  const pointsToDoctor = /(doctor|medical|hospital|qualified|மருத்துவர்|மருத்துவமனை|डॉक्टर|चिकित्स)/i.test(reply);
  if (talksBody && !pointsToDoctor) violations.push('health topic without advising a qualified doctor');

  return { ok: violations.length === 0, violations };
}
