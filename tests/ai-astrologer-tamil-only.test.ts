/**
 * ASTRO SIVAM AI Astrologer — Tamil-only citation policy.
 *
 * WHY THIS EXISTS: customers see only Tamil-language sources. English and
 * Sanskrit texts may inform the knowledge base, but no reply may name them.
 * The registry is the source of truth; this test recomputes the citable set
 * from sources.json and checks that the PHP enforces the same policy.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => fs.readFileSync(path.join(projectRoot, rel), 'utf8');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

type Source = { id: string; language: string; verification: string };
const registry = JSON.parse(read('knowledge/ai-astrologer/sources.json')) as { sources: Source[] };
const CITABLE_LEVELS = ['content-read', 'metadata-verified', 'catalogue-verified'];
const citable = registry.sources.filter(
  (s) => s.language === 'ta' && CITABLE_LEVELS.includes(s.verification),
);
const citableIds = new Set(citable.map((s) => s.id));

check('the citable set is Tamil-language and verified only', () => {
  assert.ok(citable.length > 0, 'no citable Tamil sources');
  for (const s of citable) {
    assert.equal(s.language, 'ta', `${s.id} is not Tamil`);
    assert.ok(CITABLE_LEVELS.includes(s.verification), `${s.id} is not verified`);
  }
});

check('English and Sanskrit sources are never citable', () => {
  const english = registry.sources.filter((s) => s.language !== 'ta').map((s) => s.id);
  assert.ok(english.length > 0);
  for (const id of english) assert.ok(!citableIds.has(id), `${id} is citable but not Tamil`);
});

check('linked-not-opened Tamil sources are not citable', () => {
  const pointers = registry.sources.filter((s) => s.verification === 'linked-not-opened' && s.language === 'ta');
  for (const s of pointers) assert.ok(!citableIds.has(s.id), `${s.id} is linked-not-opened but citable`);
});

check('the PHP filters the citation line to citable Tamil ids', () => {
  const php = read('api/astrology/ai_astrologer_provider.php');
  assert.match(php, /function citableTamilSources\(\)/);
  assert.match(php, /function tamilOnlySourceLine\(/);
  assert.match(php, /\$s\['language'\] \?\? ''\) === 'ta'/, 'citable set must check language === ta');
  assert.match(php, /tamilOnlySourceLine\(\(string\) \$retrieved\['sourceLine'\]\)/, 'answer() must filter the source line');
});

check('the output guard rejects any non-Tamil or unverified source id', () => {
  const php = read('api/astrology/ai_astrologer_provider.php');
  const guard = php.slice(php.indexOf('public static function checkReply'), php.indexOf('public static function fallbackReply'));
  assert.match(guard, /EN\|SA\|HI\|TP\|TA\|REF/, 'guard must scan every source prefix');
  assert.match(guard, /isCitableId\(\$cited\)/, 'guard must check each id against the citable set');
});

check('the old prompt is archived and not part of the active local reply path', () => {
  const md = read('knowledge/ai-astrologer/prompt/system-prompt.md');
  const provider = read('api/astrology/ai_astrologer_provider.php');
  const endpoint = read('api/ai_astrologer.php');
  assert.match(md, /Archived prompt draft — not used by the current reply path/);
  assert.match(md, /not sent to an AI model/);
  const answer = provider.slice(provider.indexOf('public static function answer('), provider.indexOf('/** At most three affordable remedies'));
  assert.doesNotMatch(answer, /systemPrompt|fillPrompt|complete\(/);
  assert.match(endpoint, /AstroAiProvider::answerFromKnowledgeBase\(/);
});

console.log(`\n${passed} checks passed.`);
