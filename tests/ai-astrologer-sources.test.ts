/**
 * ASTRO SIVAM AI Astrologer — source registry integrity.
 *
 * WHY THIS EXISTS: the chat agent may only answer with a source it can cite,
 * and the whole point of knowledge/ai-astrologer/ is that no source was
 * invented. If someone edits sources.json or SOURCES.md by hand, this test
 * fails before a broken or fabricated citation can reach a paying customer.
 *
 * It checks the registry against itself AND against the human-readable table,
 * so the two can never drift apart.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB_DIR = 'knowledge/ai-astrologer';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

type Source = {
  id: string;
  group: string;
  title: string;
  titleNative?: string | null;
  language: string;
  url: string;
  publisher?: string | null;
  verification: string;
  verificationNote?: string;
  usefulFor: string[];
  caveat?: string;
  usageRestriction?: string;
  tamilSection?: boolean;
};

const registry = JSON.parse(
  fs.readFileSync(path.join(projectRoot, KB_DIR, 'sources.json'), 'utf8')
) as { sources: Source[]; sourceCount: Record<string, any>; verificationPolicy: any };
const sources = registry.sources;
const byId = new Map(sources.map((s) => [s.id, s]));
const sourcesMd = fs.readFileSync(path.join(projectRoot, KB_DIR, 'SOURCES.md'), 'utf8');

const VERIFICATION_LEVELS = [
  'content-read',
  'metadata-verified',
  'catalogue-verified',
  'linked-not-opened',
  'dead'
] as const;

/** Sources that may appear in a customer-facing answer. */
const CITABLE = new Set(['content-read', 'metadata-verified', 'catalogue-verified']);

console.log('--- AI ASTROLOGER SOURCE REGISTRY ---');

check('sources.json parses and declares sources', () => {
  assert.ok(Array.isArray(sources), 'sources must be an array');
  assert.ok(sources.length > 0, 'registry is empty');
});

check('every id is unique and matches the EN|HI|TA|TP|REF-<n> scheme', () => {
  const seen = new Set<string>();
  for (const s of sources) {
    assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
    seen.add(s.id);
    assert.match(s.id, /^(EN|HI|TA|TP|REF)-\d{2}$/, `bad id shape: ${s.id}`);
  }
});

check('every source carries a title, a URL and a verification level', () => {
  for (const s of sources) {
    assert.ok(s.title && s.title.trim().length > 0, `${s.id} has no title`);
    assert.ok(/^https?:\/\//.test(s.url), `${s.id} has no usable URL: ${s.url}`);
    assert.ok(
      (VERIFICATION_LEVELS as readonly string[]).includes(s.verification),
      `${s.id} has an unknown verification level: ${s.verification}`
    );
  }
});

check('every source records how it was verified', () => {
  for (const s of sources) {
    assert.ok(
      s.verificationNote && s.verificationNote.trim().length > 20,
      `${s.id} has no meaningful verificationNote`
    );
  }
});

check('every source says what it is useful for (dead links excepted)', () => {
  for (const s of sources) {
    if (s.verification === 'dead') {
      assert.equal(s.usefulFor.length, 0, `${s.id} is dead but still claims uses`);
      continue;
    }
    assert.ok(Array.isArray(s.usefulFor) && s.usefulFor.length > 0, `${s.id} lists no use`);
  }
});

check('declared sourceCount matches the actual registry', () => {
  const count = (pred: (s: Source) => boolean) => sources.filter(pred).length;
  assert.equal(registry.sourceCount.total, sources.length, 'total is stale');
  assert.equal(
    count((s) => s.group === 'classical-english'),
    registry.sourceCount.classicalTextsEnglish,
    'classicalTextsEnglish is stale'
  );
  assert.equal(
    count((s) => /-hindi$/.test(s.group)),
    registry.sourceCount.hindiBooks,
    'hindiBooks is stale'
  );
  assert.equal(
    count((s) => /-tamil$/.test(s.group)),
    registry.sourceCount.tamilBooks,
    'tamilBooks is stale'
  );
  assert.equal(
    count((s) => s.group === 'navagraha-sthalam'),
    registry.sourceCount.navagrahaSthalamAndTemples,
    'navagrahaSthalamAndTemples is stale'
  );
  assert.equal(
    count((s) => s.group === 'reference'),
    registry.sourceCount.reference,
    'reference is stale'
  );
  const declaredSum =
    registry.sourceCount.classicalTextsEnglish +
    registry.sourceCount.hindiBooks +
    registry.sourceCount.tamilBooks +
    registry.sourceCount.navagrahaSthalamAndTemples +
    registry.sourceCount.reference;
  assert.equal(declaredSum, sources.length, 'declared buckets do not add up to total');

  // Every entry belongs to exactly one declared bucket.
  for (const s of sources) {
    const bucketed =
      s.group === 'classical-english' ||
      s.group === 'navagraha-sthalam' ||
      s.group === 'reference' ||
      /-hindi$/.test(s.group) ||
      /-tamil$/.test(s.group);
    assert.ok(bucketed, `${s.id} has group "${s.group}", which no declared bucket covers`);
  }
});

check('all five classical texts named in the brief are registered', () => {
  const needle = (id: string, words: string[]) => {
    const s = byId.get(id);
    assert.ok(s, `missing source ${id}`);
    for (const w of words) {
      assert.ok(
        `${s.title} ${s.titleNative ?? ''}`.toLowerCase().includes(w.toLowerCase()),
        `${id} does not mention "${w}"`
      );
    }
  };
  needle('EN-01', ['Brihat Parashara Hora Shastra']);
  needle('EN-02', ['Phaladeepika']);
  needle('EN-04', ['Saravali']);
  needle('EN-06', ['Jataka Parijata']);
  needle('EN-09', ['Uttara Kalamrita']);
});

check('all nine Navagraha sthalams named in the brief are mapped', () => {
  const required = [
    'Suryanar',
    'Thingalur',
    'Vaitheeswaran',
    'Thiruvenkadu',
    'Alangudi',
    'Kanjanur',
    'Thirunallar',
    'Thirunageswaram',
    'Keezha'
  ];
  const nine = byId.get('TP-01');
  assert.ok(nine, 'TP-01 is missing');
  const table = JSON.stringify((nine as any).verifiedNine ?? []);
  for (const place of required) {
    assert.ok(
      table.toLowerCase().includes(place.toLowerCase()),
      `TP-01 nine-temple table does not map "${place}"`
    );
  }
  assert.equal(((nine as any).verifiedNine ?? []).length, 9, 'TP-01 must list exactly nine');
});

check('every graha has at least one temple source it can point to', () => {
  const grahas = ['Surya', 'Chandra', 'Angaraka', 'Budha', 'Guru', 'Sukra', 'Sani', 'Rahu', 'Ketu'];
  const nine = (byId.get('TP-01') as any).verifiedNine as { graha: string }[];
  for (const g of grahas) {
    assert.ok(
      nine.some((row) => row.graha.toLowerCase().includes(g.toLowerCase())),
      `no Navagraha sthalam row for ${g}`
    );
  }
});

check('Tamil sources are marked and form the largest single language group', () => {
  const tamil = sources.filter((s) => s.tamilSection === true);
  assert.ok(tamil.length >= 25, `expected a substantial Tamil section, found ${tamil.length}`);
  const byLang = new Map<string, number>();
  for (const s of sources) byLang.set(s.language, (byLang.get(s.language) ?? 0) + 1);
  assert.ok(
    (byLang.get('ta') ?? 0) > (byLang.get('en') ?? 0),
    `Tamil (${byLang.get('ta')}) should outnumber English (${byLang.get('en')})`
  );
});

check('health sources carry the never-diagnose restriction', () => {
  const health = sources.filter((s) =>
    s.usefulFor.some((u) => /illness|disease|ailment|health/i.test(u))
  );
  assert.ok(health.length > 0, 'no health-related source registered');
  for (const s of health) {
    const guarded = Boolean(s.usageRestriction) || Boolean(s.caveat);
    assert.ok(
      guarded,
      `${s.id} touches health but carries neither usageRestriction nor caveat`
    );
  }
});

check('non-citable sources are never presented as authorities', () => {
  for (const s of sources) {
    if (CITABLE.has(s.verification)) continue;
    if (s.verification === 'dead') {
      assert.ok(
        /dead|archived|suspended|unreachable|no longer available/i.test(s.verificationNote),
        `${s.id} is dead but its note does not say why`
      );
    }
    if (s.verification === 'linked-not-opened') {
      assert.ok(
        /not opened|not be cited|linked inside/i.test(s.verificationNote),
        `${s.id} is linked-not-opened but its note does not warn about it`
      );
    }
  }
});

check('SOURCES.md only cites ids that exist in sources.json', () => {
  const cited = new Set<string>(
    (sourcesMd.match(/\b(?:EN|HI|TA|TP|REF)-\d{2}\b/g) ?? []).filter(Boolean)
  );
  assert.ok(cited.size > 40, `SOURCES.md cites only ${cited.size} ids; expected the full table`);
  const missing = [...cited].filter((id) => !byId.has(id));
  assert.deepEqual(missing, [], `SOURCES.md cites ids absent from the registry: ${missing.join(', ')}`);
});

check('every registered source appears in SOURCES.md', () => {
  const absent = sources.map((s) => s.id).filter((id) => !sourcesMd.includes(id));
  assert.deepEqual(absent, [], `registered but missing from the table: ${absent.join(', ')}`);
});

check('the dead Gita Press catalogue is quarantined, not citable', () => {
  const dead = sources.filter((s) => s.verification === 'dead');
  assert.ok(dead.length >= 1, 'the dead jyotishbooks catalogue should be logged');
  for (const s of dead) {
    assert.equal(s.usefulFor.length, 0, `${s.id} must not be usable`);
    assert.ok(!CITABLE.has(s.verification));
  }
});

check('no source claims a verse-level citation it cannot back up', () => {
  // Only EN-02 (Phaladeepika) had its printed index read, so only it may carry
  // chapter anchors. Any other entry doing so would be an unverifiable quote.
  for (const s of sources) {
    const anchors = (s as any).verifiedChapterAnchors;
    if (!anchors) continue;
    assert.equal(
      s.id,
      'EN-02',
      `${s.id} declares verifiedChapterAnchors but only EN-02's index was read`
    );
    assert.ok(anchors.length > 10, 'EN-02 anchors look truncated');
  }
});

console.log(`\n[OK] ai-astrologer source registry: ${passed} checks passed`);
