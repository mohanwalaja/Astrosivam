/**
 * PARITY between the PHP PDF generator and the shared life-card rules.
 *
 * The PHP mirror of page 2 (api/astrology/pdf_mpdf_reports.php) is what renders
 * the PDF a customer actually reads. It now reads
 * api/astrology/life_cards_rules.json for its dusthana list and its badge
 * wording, so the PDF, the browser report and the chat cannot drift on those.
 *
 * PHP cannot execute TypeScript, so the verdict boolean is necessarily written
 * in both languages. What must NOT drift is (a) the rule's inputs, (b) its
 * wording, and (c) the expression itself. Each is asserted below.
 *
 * PHP is not runnable in this sandbox, so these are source checks. They route
 * every slice through tests/helpers/sourceSlice.ts, which throws when an anchor
 * is missing rather than letting a check pass on an empty slice.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceText, sliceToEnd, assertNonEmptySet } from './helpers/sourceSlice';
import { LIFE_CARD_RULES } from '../src/lib/astrology/lifeCardPredictions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const php = fs.readFileSync(path.join(root, 'api/astrology/pdf_mpdf_reports.php'), 'utf8');
const rules = JSON.parse(
  fs.readFileSync(path.join(root, 'api/astrology/life_cards_rules.json'), 'utf8')
) as {
  constants: { dusthanaHouses: number[]; supportHouses: number[]; maleficConjunctionOrbDeg: number };
  badgeSuffix: {
    challenging: Record<string, string>;
    supportive: Record<string, string>;
    unavailable: string;
  };
};

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

const helper = sliceText(
  php,
  'function astro_life_card_rules()',
  "\nclass ",
  'astro_life_card_rules helper'
);

check('the PHP helper reads the same JSON file the TS module reads', () => {
  assert.match(helper, /life_cards_rules\.json/, 'the helper does not name the shared rules file');
  assert.match(helper, /json_decode\(\$raw, true\)/, 'the helper does not decode the JSON');
  assert.match(helper, /__DIR__ \. '\/life_cards_rules\.json'/, 'the helper uses a different path than the PHP file location');
});

check('the helper falls back to exactly the shared values if the JSON is missing', () => {
  // A fallback that disagreed with the JSON would mean a missing file silently
  // changes what the report says - worse than crashing.
  const fallbackBlock = sliceText(helper, '$fallback = [', '];', 'fallback block');
  assert.deepEqual(rules.constants.dusthanaHouses, [6, 8, 12]);
  assert.match(fallbackBlock, /'dusthanaHouses' => \[6, 8, 12\]/);
  for (const lang of ['ta', 'hi', 'en']) {
    const ch = rules.badgeSuffix.challenging[lang];
    const su = rules.badgeSuffix.supportive[lang];
    assert.ok(fallbackBlock.includes(`'${lang}' => '${ch}'`), `fallback challenging wording for ${lang} drifted from the JSON (${ch})`);
    assert.ok(fallbackBlock.includes(`'${lang}' => '${su}'`), `fallback supportive wording for ${lang} drifted from the JSON (${su})`);
  }
  assert.ok(
    fallbackBlock.includes(rules.badgeSuffix.unavailable.trim()),
    'fallback unavailable wording drifted from the JSON'
  );
});

check('the dusthana rule reads the shared list, not a hardcoded one', () => {
  const placement = sliceText(
    php,
    '$isDusthana = in_array($bhava,',
    "];\n        };",
    'placement return'
  );
  assert.match(
    placement,
    /astro_life_card_rules\(\)\['dusthanaHouses'\]/,
    'the dusthana test is not reading the shared list'
  );
  // The old literal must be gone from the placement logic.
  assert.ok(
    !/in_array\(\$bhava, \[6, 8, 12\]/.test(placement),
    'a hardcoded [6, 8, 12] is back in the placement logic'
  );
});

check('the badge wording comes from the shared rules', () => {
  const badge = sliceText(php, '$lifeBadge = function', '$lifeStatus = function', 'lifeBadge closure');
  assert.match(badge, /astro_life_card_rules\(\)/, 'lifeBadge does not read the shared rules');
  assert.match(badge, /\['badgeChallenging'\]/, 'lifeBadge does not use the shared challenging wording');
  assert.match(badge, /\['badgeSupportive'\]/, 'lifeBadge does not use the shared supportive wording');
  // No hardcoded verdict strings left in the closure.
  for (const s of ['⚠ கவனம்', '⚠ सावधान', '⚠ Caution', '✓ பலம்', '✓ बल', '✓ Strength']) {
    assert.ok(!badge.includes(`' ${s}'`), `lifeBadge still hardcodes the verdict string "${s}"`);
  }
});

check('the PHP verdict expression matches the shared rule exactly', () => {
  // The one piece that must be written twice - so pin it character for character
  // against the rule recorded in the JSON, which is itself extracted from the TS.
  const placement = sliceText(php, "'isChallenging' =>", "'reason' => implode", 'isChallenging expression');
  assert.match(placement, /\$isDusthana \|\| \$isDebilitated \|\| \$isCombust \|\| !empty\(\$conjunctNames\)/,
    'the PHP verdict expression no longer matches the shared rule ' +
    '(isDusthana || isDebilitated || isCombust || conjunctMalefics > 0)');
});

check('the shared JSON records the rule the PHP implements', () => {
  // The JSON is the contract. If someone edits the expression here they must edit
  // the JSON too, or this and the TS side disagree.
  const v = (LIFE_CARD_RULES as unknown as { verdict?: { isChallenging?: string } }).verdict;
  assert.ok(v && typeof v.isChallenging === 'string', 'the JSON no longer records the verdict expression');
  assert.match(v!.isChallenging!, /isDusthana/);
  assert.match(v!.isChallenging!, /isDebilitated/);
  assert.match(v!.isChallenging!, /isCombust/);
  assert.match(v!.isChallenging!, /conjunctMalefics/);
});

check('the helper is in file scope so both call sites can reach it', () => {
  const before = php.indexOf('function astro_life_card_rules()');
  const dusthanaUse = php.indexOf("astro_life_card_rules()['dusthanaHouses']");
  const badgeUse = php.indexOf('astro_life_card_rules();');
  assertNonEmptySet('call sites', [dusthanaUse, badgeUse].filter((i) => i > 0), 2);
  assert.ok(before > 0 && before < dusthanaUse, 'the helper is defined after its dusthana call site');
  assert.ok(before < badgeUse, 'the helper is defined after its badge call site');
  // It must not be nested inside the class, or the closures could not call it.
  const classAt = php.indexOf("\nclass ");
  assert.ok(before < classAt, 'the helper is declared inside the class');
});

check('the rest of the PHP file still balances', () => {
  // Cheap structural guard: a botched string edit here would break the PDF build
  // at parse time, and PHP is not runnable in this sandbox to catch it.
  const opens = (php.match(/\{/g) || []).length;
  const closes = (php.match(/\}/g) || []).length;
  assert.equal(opens, closes, `brace mismatch: ${opens} open vs ${closes} close`);
  assert.match(sliceToEnd(php, 'function astro_life_card_rules()', 'helper body'), /return \$rules;/);
});

console.log(`\n[OK] page-2 PHP parity: ${passed} checks passed`);
