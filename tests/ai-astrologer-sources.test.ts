/**
 * ASTRO SIVAM AI Astrologer — source registry integrity.
 *
 * WHY THIS EXISTS: local replies may only cite references allowed by their
 * recorded verification level. The catalogue is metadata, not a full-text
 * corpus. This test guards source ids, provenance, exclusions, and citation rules.
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
const excluded: Source[] = registry.excludedSources ?? [];
const transforms = registry.guardrailTransforms;
const byId = new Map(sources.map((s) => [s.id, s]));
/** Every id the registry knows about - active sources plus quarantined ones. */
const knownIds = new Set([...sources, ...excluded].map((s) => s.id));
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
    assert.match(s.id, /^(EN|HI|TA|TP|REF)-\d{2,3}$/, `bad id shape: ${s.id}`);
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
  assert.equal(registry.sourceCount.excluded, excluded.length, 'excluded count is stale');
  assert.equal(
    count((s) => s.group === 'classical-english'),
    registry.sourceCount.classicalTextsEnglish,
    'classicalTextsEnglish is stale'
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

  for (const s of sources) {
    const bucketed =
      s.group === 'classical-english' ||
      s.group === 'navagraha-sthalam' ||
      s.group === 'reference' ||
      /-tamil$/.test(s.group);
    assert.ok(bucketed, `${s.id} has group "${s.group}", which no declared bucket covers`);
  }
});

check('owner decision 4 holds: no Hindi source is retrievable', () => {
  assert.equal(registry.sourceCount.hindiBooks, 0, 'hindiBooks must be 0');
  const hindiInUse = sources.filter((s) => s.language === 'hi' || /-hindi$/.test(s.group));
  assert.deepEqual(
    hindiInUse.map((s) => s.id),
    [],
    'Hindi sources are still in the active registry'
  );
  assert.ok(excluded.length >= 13, 'the 13 Hindi books should be preserved in excludedSources');
  for (const s of excluded) {
    assert.equal(s.retrievable, false, `${s.id} in excludedSources is still marked retrievable`);
    assert.ok(
      /owner decision/i.test(s.exclusionReason ?? ''),
      `${s.id} is excluded but does not record the owner decision that excluded it`
    );
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
    (sourcesMd.match(/\b(?:EN|HI|TA|TP|REF)-\d{2,3}\b/g) ?? []).filter(Boolean)
  );
  assert.ok(cited.size > 40, `SOURCES.md cites only ${cited.size} ids; expected the full current registry`);
  const missing = [...cited].filter((id) => !knownIds.has(id));
  assert.deepEqual(missing, [], `SOURCES.md cites ids absent from the registry: ${missing.join(', ')}`);
});

check('every registered active and excluded source is listed in SOURCES.md', () => {
  const absent = [...sources, ...excluded].map((source) => source.id).filter((id) => !sourcesMd.includes(id));
  assert.deepEqual(absent, [], `registered but missing from SOURCES.md: ${absent.join(', ')}`);
  assert.match(sourcesMd, /224 active catalogue records/i);
  assert.match(sourcesMd, /Only 11 active records are marked `content-read`/i);
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

check('owner decision 1 holds: Tamil books are cited at passage level', () => {
  const withPassages = sources.filter((s) => (s as any).verifiedPassages?.length);
  assert.ok(withPassages.length >= 2, 'expected at least two passage-level Tamil sources');
  for (const s of withPassages) {
    assert.equal(s.verification, 'content-read', `${s.id} cites passages but is not content-read`);
    assert.ok(s.tamilSection === true, `${s.id} carries Tamil passages but is not in the Tamil section`);
    for (const p of (s as any).verifiedPassages) {
      assert.ok(p.page || p.verse, `${s.id} has a passage with neither page nor verse`);
      assert.ok(p.quote && p.quote.trim().length > 20, `${s.id} has an empty passage quote`);
      assert.ok(p.status, `${s.id} passage ${p.page ?? p.verse} has no status ruling`);
      assert.match(p.status, /USABLE|DO NOT RELAY|Never relayed|FEAR-LANGUAGE/i,
        `${s.id} passage ${p.page ?? p.verse} has an unusable status: ${p.status}`);
    }
  }
  // The two books named in the decision must be among them.
  for (const id of ['TA-02', 'TA-07']) {
    assert.ok((byId.get(id) as any)?.verifiedPassages?.length, `${id} was not read to passage level`);
  }
});

check('passage-level books carry their real bibliographic detail', () => {
  const t7 = byId.get('TA-07') as any;
  assert.equal(t7.year, 1946, 'TA-07 year should be 1946, read from its title page');
  assert.ok(t7.author && /Srinivasa Ayyangar|ஸ்ரீனிவாச அய்யங்கார்/.test(t7.author),
    'TA-07 author missing');
  assert.ok(/Urania/.test(t7.publisher ?? ''), 'TA-07 printer missing');
  assert.ok(/தசை|Dasha/.test(t7.structure ?? ''), 'TA-07 Dasha-Bhukti structure not recorded');
});

check('the fear / death / disease filter is registered and covers every source passage', () => {
  assert.ok(transforms, 'guardrailTransforms is missing');
  const dropped = JSON.stringify(transforms.dropEntirely).toLowerCase();
  for (const forbidden of ['death', 'disease']) {
    assert.ok(dropped.includes(forbidden), `guardrailTransforms does not drop "${forbidden}"`);
  }
  assert.ok(transforms.rewriteTo && transforms.rewriteTo.length > 40, 'no rewrite guidance');
  assert.ok(transforms.alwaysAllowed?.length >= 5, 'nothing is marked always allowed');

  // Every expensive remedy named in a passage must have a cheap substitute.
  const substitutes: { grahas: string[]; warrant?: string }[] =
    transforms.expensiveRemedySubstitutes;
  const passageText = sources
    .flatMap((s) => (s as any).verifiedPassages ?? [])
    .map((p: any) => p.quote)
    .join(' ');
  // Every graha whose passage prescribes an expensive dana needs a cheap route.
  for (const graha of ['Guru', 'Budha', 'Ketu', 'Sukra', 'Sani', 'Rahu']) {
    const hit = substitutes.filter((x) => x.grahas.includes(graha));
    assert.ok(hit.length > 0, `no cheap substitute registered for ${graha}`);
    for (const x of hit) {
      assert.ok(Array.isArray(x.grahas) && x.grahas.length > 0, 'a substitute names no graha');
      assert.ok(x.warrant && x.warrant.length > 5, `the ${graha} substitute has no warrant`);
    }
  }
  // No substitute may be keyed on a comma-joined string - that is not queryable.
  for (const x of substitutes) {
    assert.ok(
      x.grahas.every((g) => !g.includes(',')),
      `substitute graha list contains a comma-joined entry: ${JSON.stringify(x.grahas)}`
    );
  }
  assert.ok(/தானம்/.test(passageText), 'no dana passage was actually read');
});

check('a yathashakti warrant justifies scaling remedies down', () => {
  const t7 = byId.get('TA-07') as any;
  assert.ok(
    /எதாசக்தி|யதாசக்தி/.test(t7.yathashaktiWarrant ?? ''),
    'the yathashakti warrant must quote the Tamil phrase read from the page'
  );
  assert.ok(/TA-07/.test(t7.yathashaktiWarrant ?? ''), 'the warrant must name its source');
});

check('Sade Sati wording is anchored to Phaladeepika per owner decision 3', () => {
  const ref3 = byId.get('REF-03');
  assert.ok(ref3, 'REF-03 is missing');
  assert.ok(/Phaladeepika/.test((ref3 as any).ownerDecision ?? ''),
    'REF-03 must record the owner decision naming Phaladeepika');
  const en02 = byId.get('EN-02') as any;
  const anchors: string[] = en02.verifiedChapterAnchors ?? [];
  assert.ok(
    anchors.some((a) => /XXVI/.test(a) && /GOCHARA|TRANSIT/i.test(a)),
    'EN-02 must carry a verified Adhyaya XXVI transit anchor'
  );
});

check('SOURCES.md quarantines the excluded Hindi ids inside one clearly-marked section', () => {
  const start = sourcesMd.indexOf('## 2.');
  const end = sourcesMd.indexOf('## 3.');
  assert.ok(start > 0 && end > start, 'cannot locate the exclusion section boundaries');
  const section = sourcesMd.slice(start, end);
  const outside = sourcesMd.slice(0, start) + sourcesMd.slice(end);

  assert.ok(/excluded|not used/i.test(section), 'the section must state that these are excluded');
  for (const s of excluded) {
    assert.ok(section.includes(s.id), `${s.id} is excluded but not listed in the exclusion section`);
    assert.ok(
      !new RegExp(`\\b${s.id}\\b`).test(outside),
      `${s.id} is mentioned outside the exclusion section, so it reads like a live source`
    );
  }
});

check('every rule cites at least one source a customer may actually be shown', () => {
  // THE INVARIANT THAT KEEPS CITATIONS HONEST.
  //
  // The registry has 224 catalogue records, but only 11 are marked content-read;
  // most entries are metadata or unopened links. A customer reply may name only
  // an eligible Tamil reference at its recorded verification level.
  // AstroAiProvider::tamilOnlySourceLine() strips everything else. This check
  // ensures each active rule retains at least one citation that survives that
  // policy, without implying that the registry is a full-text search corpus.
  const lifeAreas = JSON.parse(
    fs.readFileSync(path.join(projectRoot, KB_DIR, 'rules', 'life-areas.json'), 'utf8')
  ) as { areas: { id: string; rules?: any[] }[] };

  const citable = (id: string) => {
    const s = byId.get(id);
    return Boolean(s && s.language === 'ta' && CITABLE.has(s.verification));
  };

  let rules = 0;
  const mute: string[] = [];
  const unknown: string[] = [];
  for (const area of lifeAreas.areas) {
    for (const rule of area.rules ?? []) {
      rules += 1;
      const cites = (rule.source ?? [])
        .filter((s: any) => s.level !== 'suppressed')
        .map((s: any) => String(s.id));
      for (const id of cites) {
        if (!byId.has(id)) unknown.push(`${area.id}/${rule.id} -> ${id}`);
      }
      if (!cites.some(citable)) {
        mute.push(`${area.id}/${rule.id} [${cites.join(', ') || 'no source'}]`);
      }
    }
  }

  assert.deepEqual(unknown, [], 'a rule cites an id that is not in the registry');
  assert.ok(rules > 30, `expected the full rule base, found ${rules} rules`);
  assert.deepEqual(
    mute,
    [],
    `these rules can never show the customer a source, so their answer arrives unattributed:\n    ${mute.join('\n    ')}`
  );
});

console.log(`\n[OK] ai-astrologer source registry: ${passed} checks passed`);
