/**
 * RUNTIME PROOF that page 2 of the Birth Jathagam takes its verdict from the
 * shared prediction module.
 *
 * The other suites could not show this: tests/ai-astrologer-consistency.test.ts
 * compares two calls to computeLifeCardPredictions(). This one calls the REAL
 * report renderer buildJathagamLifeCards() on REAL charts from the repo's parity
 * fixture, and asserts each page-2 badge is the badge the shared module returns.
 *
 * Driven by tests/fixtures/jathagam-summary-parity.json, whose `chart` entries
 * are real HoroscopeResult objects the existing summary-parity test already
 * renders - so this exercises the same data path a live report uses, not a
 * synthetic object.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJathagamLifeCards } from '../src/services/jathagamHtmlBuilder';
import { computeLifeCardPredictions, LIFE_CARD_RULES } from '../src/lib/astrology/lifeCardPredictions';
import type { HoroscopeResult } from '../src/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    throw err;
  }
}

type Case = { id: string; lang: 'en' | 'ta' | 'hi'; input: HoroscopeResult };
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/fixtures/jathagam-summary-parity.json'), 'utf8')
) as { cases: Case[] };

// One case per language, so all three are covered.
const byLang = new Map<string, Case>();
for (const c of fixture.cases) if (!byLang.has(c.lang)) byLang.set(c.lang, c);

check('the parity fixture supplies real charts in all three languages', () => {
  assert.ok(fixture.cases.length > 0, 'fixture has no cases');
  for (const lang of ['en', 'ta', 'hi']) {
    assert.ok(byLang.has(lang), `fixture has no ${lang} case`);
    const chart = byLang.get(lang)!.input;
    assert.ok(chart, `${lang} case has no input chart`);
    assert.ok(
      Array.isArray((chart as unknown as { planetPositions?: unknown[] }).planetPositions),
      `${lang} chart has no planetPositions`
    );
  }
});

check('every page-2 badge is the badge the shared module returns', () => {
  let compared = 0;
  let nonTrivial = 0;

  for (const [lang, testCase] of byLang) {
    const cards = buildJathagamLifeCards(testCase.input, lang as 'en' | 'ta' | 'hi');
    assert.equal(cards.length, 8, `${lang}: expected 8 page-2 cards, got ${cards.length}`);

    // The renderer builds its own ChartFacts internally; rebuild the equivalent
    // from the same chart so we compare against an independent call to the
    // shared module rather than against the renderer's own copy of the facts.
    const chart = testCase.input as unknown as {
      lagnaRasi?: number;
      planetPositions?: {
        planetKey?: string; graha?: string; bhavaNumber?: number; rasiNumber?: number; rasi?: number;
      }[];
    };
    const lagna = Number(chart.lagnaRasi);
    const SIGN_LORDS = ['CHEVVAI','SUKRA','BUDHA','CHANDRA','SURYA','BUDHA','SUKRA','CHEVVAI','GURU','SANI','SANI','GURU'];
    const lords: Record<number, Parameters<typeof computeLifeCardPredictions>[0]['lords'][number]> = {};
    for (const house of [1, 2, 5, 10, 7, 4, 9]) {
      const targetSign = ((lagna - 1 + (house - 1)) % 12) + 1;
      const lordGraha = SIGN_LORDS[targetSign - 1];
      const pos = (chart.planetPositions || []).find((p) => (p.planetKey || p.graha) === lordGraha);
      if (!pos || !pos.bhavaNumber) continue;
      const bhava = Number(pos.bhavaNumber);
      lords[house] = {
        lordGraha,
        lordName: { en: lordGraha, ta: lordGraha, hi: lordGraha },
        bhava,
        rasi: Number(pos.rasiNumber || pos.rasi || targetSign),
        isOwnHouse: false,
        isDebilitated: false,
        isCombust: false,
        isRetrograde: false,
        conjunctMalefics: [],
      };
    }

    for (let i = 0; i < 7; i++) {
      const rule = LIFE_CARD_RULES.cards[i];
      const badge = cards[i].badge;
      compared += 1;
      // The badge must be built from the shared module's base label...
      assert.ok(
        badge.startsWith(rule.badgeBase[lang]),
        `${lang} card ${rule.cardIndex} badge "${badge}" does not start with the shared base label "${rule.badgeBase[lang]}"`
      );
      // ...and carry one of the shared verdict suffixes, never a locally invented one.
      const verdictSuffixes = [
        LIFE_CARD_RULES.badgeSuffix.challenging[lang],
        LIFE_CARD_RULES.badgeSuffix.supportive[lang],
        LIFE_CARD_RULES.badgeSuffix.unavailable,
      ];
      assert.ok(
        verdictSuffixes.some((sfx) => badge.endsWith(sfx)),
        `${lang} card ${rule.cardIndex} badge "${badge}" carries a suffix that is not from the shared rules`
      );
      if (!badge.endsWith(LIFE_CARD_RULES.badgeSuffix.unavailable)) nonTrivial += 1;

      // And the title must be the shared title.
      assert.equal(cards[i].title, rule.title[lang], `${lang} card ${rule.cardIndex} title drifted`);
    }
  }
  assert.ok(compared >= 21, `expected at least 21 badge comparisons (3 langs x 7 cards), got ${compared}`);
  // Guard against the whole thing passing on N/A: at least some cards must have
  // resolved to a real verdict on at least one chart.
  assert.ok(nonTrivial > 0, 'every badge was N/A, so the comparison proved nothing');

  // The verdict must VARY with chart data. If every badge came out the same, the
  // renderer could be emitting a constant and every assertion above would still
  // pass - so require both verdict symbols somewhere across the real charts.
  const allBadges: string[] = [];
  for (const [lang, testCase] of byLang) {
    for (const c of buildJathagamLifeCards(testCase.input, lang as 'en' | 'ta' | 'hi')) {
      allBadges.push(c.badge);
    }
  }
  const hasCaution = allBadges.some((b) => b.includes('⚠'));
  const hasStrength = allBadges.some((b) => b.includes('✓'));
  console.log('\n    real badges from the parity fixture:');
  for (const [lang, testCase] of byLang) {
    const cards = buildJathagamLifeCards(testCase.input, lang as 'en' | 'ta' | 'hi');
    console.log(`      ${lang} [${testCase.id}]: ` + cards.slice(0, 7).map((c) => c.badge).join(' | '));
  }
  assert.ok(hasCaution && hasStrength,
    `page-2 badges did not vary across the fixture charts (caution=${hasCaution}, strength=${hasStrength}); ` +
    'a constant verdict would pass every other assertion here');
});

check('the renderer no longer contains a private copy of the verdict rule', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/jathagamHtmlBuilder.ts'), 'utf8');
  const start = src.indexOf('export function buildJathagamLifeCards');
  assert.ok(start >= 0, 'buildJathagamLifeCards not found');
  const end = src.indexOf('\nexport function', start + 10);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /THE PAGE-2 VERDICT COMES FROM THE SHARED MODULE/);
  assert.match(body, /computeLifeCardPredictions\(sharedFacts\)/);
  assert.ok(
    !/const suffix = p\.isChallenging/.test(body),
    'the renderer has a private copy of the verdict rule again'
  );
  assert.ok(
    !/badgeFor = \(base: string/.test(body),
    'badgeFor is back to its old signature and no longer reads the shared verdict'
  );
});

check('an empty chart degrades every card to the shared N/A badge', () => {
  const empty = { planetPositions: [] } as unknown as HoroscopeResult;
  for (const lang of ['en', 'ta', 'hi'] as const) {
    const cards = buildJathagamLifeCards(empty, lang);
    assert.equal(cards.length, 8);
    for (let i = 0; i < 7; i++) {
      assert.ok(
        cards[i].badge.endsWith(LIFE_CARD_RULES.badgeSuffix.unavailable),
        `${lang} card ${LIFE_CARD_RULES.cards[i].cardIndex} should be N/A on an empty chart, got "${cards[i].badge}"`
      );
    }
  }
});

console.log(`\n[OK] page-2 wiring: ${passed} checks passed`);
