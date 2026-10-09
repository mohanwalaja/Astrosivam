import assert from 'node:assert/strict';
import * as Astronomy from 'astronomy-engine';
import {
  calculateLahiriAyanamsa,
  calculatePrecisionHoroscope,
  RASI_INFO
} from '../server/astrology/astronomy.js';
import { calculateWeddingCompatibility } from '../server/astrology/matchmaking.js';
import { PoruthamStatus, Rasi } from '../server/astrology/types.js';

/**
 * Ten Porutham (Dasa Porutham) reference validation.
 *
 * The classification tables below are the classical Tamil matchmaking data,
 * written out here independently of the engine: the three Gana groups, the five
 * Rajju groups, the fourteen Yoni animals with their seven inimical pairs, the
 * Vedha obstruction pairs and the Vasiya sign pairs. Each reference case builds
 * two real charts whose Janma Nakshatra (and, where a rule is sign-based, whose
 * Chandra Rasi) is known in advance, then checks the Porutham the engine
 * reports against the classical expectation.
 */

const DEVA = 0;
const MANUSHYA = 1;
const RAKSHASA = 2;

// Gana (temperament): 0 = Deva, 1 = Manushya, 2 = Rakshasa.
const GANA: number[] = [
  DEVA, MANUSHYA, RAKSHASA, MANUSHYA, DEVA, MANUSHYA, DEVA, DEVA, RAKSHASA,
  RAKSHASA, MANUSHYA, MANUSHYA, DEVA, RAKSHASA, DEVA, RAKSHASA, DEVA, RAKSHASA,
  RAKSHASA, MANUSHYA, MANUSHYA, DEVA, RAKSHASA, RAKSHASA, MANUSHYA, MANUSHYA, DEVA
];

// Rajju: 0 = Siro (head), 1 = Kanda (neck), 2 = Udhara (stomach),
// 3 = Uru (thigh), 4 = Pada (foot).
//
// Classical Tamil grouping, written out independently of the engine:
//   Siro   : Mrigashirsha, Chitra, Dhanishta
//   Kanda  : Rohini, Ardra, Hasta, Swati, Shravana, Shatabhisha
//   Udhara : Krittika, Punarvasu, Uttara Phalguni, Vishakha, Uttara Ashadha, Purva Bhadrapada
//   Uru    : Bharani, Pushya, Purva Phalguni, Anuradha, Purva Ashadha, Uttara Bhadrapada
//   Pada   : Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati
// The five groups repeat every nine Nakshatras, so this is the nine-value
// pattern (4,3,2,1,0,1,2,3,4) three times.
const RAJJU: number[] = [
  4, 3, 2, 1, 0, 1, 2, 3, 4,
  4, 3, 2, 1, 0, 1, 2, 3, 4,
  4, 3, 2, 1, 0, 1, 2, 3, 4
];

// Yoni animals, numbered 0-13 as listed by the classical texts.
const YONI: number[] = [
  0, 1, 2, 3, 3, 4, 5, 2, 5,
  6, 6, 7, 8, 9, 8, 9, 10, 10,
  4, 11, 12, 11, 13, 0, 13, 7, 1
];
// Horse-Buffalo, Elephant-Lion, Sheep-Monkey, Serpent-Mongoose,
// Dog-Deer, Cat-Rat, Cow-Tiger.
const INIMICAL_YONIS = new Set([
  '0,8', '8,0',
  '1,13', '13,1',
  '2,11', '11,2',
  '3,12', '12,3',
  '4,10', '10,4',
  '5,6', '6,5',
  '7,9', '9,7'
]);
// Vasiya (mutual attraction) sign pairs, keyed by Rasi number.
const VASIYA: Record<number, number[]> = {
  1: [5, 8], 2: [4, 7], 3: [6], 4: [8, 9], 5: [7, 9], 6: [3, 12],
  7: [10, 12], 8: [4, 11], 9: [12], 10: [1, 11], 11: [1, 10], 12: [3, 10]
};
const VEDHA_PAIRS = new Set([
  '0,17', '17,0', '1,16', '16,1', '2,15', '15,2', '3,14', '14,3',
  '9,26', '26,9', '10,25', '25,10', '11,24', '24,11', '12,23', '23,12'
]);
const DEVA_LORDS = new Set(['Sun', 'Moon', 'Mars', 'Jupiter']);
const ASURA_LORDS = new Set(['Mercury', 'Venus', 'Saturn']);
const RAJ = ['Siro', 'Kanda', 'Udhara', 'Uru', 'Pada'];

const CHENNAI = {
  birthPlace: 'Chennai, Tamil Nadu, India',
  country: 'India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5
};

// ---------------------------------------------------------------------------
// Date index: find a birth date whose Moon sits in a chosen Nakshatra (and,
// where a rule is sign-based, in a chosen Rasi).
// ---------------------------------------------------------------------------
type MoonEntry = { dob: string; nakshatra: number; rasi: number };

const moonEntries: MoonEntry[] = [];
for (let day = 0; day < 150; day++) {
  const utcMs = Date.UTC(2024, 0, 1) + day * 86400000;
  // 12:00 IST == 06:30 UTC, the time used for every chart below.
  const time = Astronomy.MakeTime(new Date(utcMs + 6.5 * 3600000));
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);
  const ecliptic = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, time, true));
  const lon = ((ecliptic.elon - ayanamsa) % 360 + 360) % 360;
  moonEntries.push({
    dob: new Date(utcMs).toISOString().slice(0, 10),
    nakshatra: Math.floor(lon / (360 / 27)) % 27,
    rasi: (Math.floor(lon / 30) % 12) + 1
  });
}

function dateFor(options: { nakshatra?: number; rasi?: number }): string {
  const entry = moonEntries.find(candidate =>
    (options.nakshatra === undefined || candidate.nakshatra === options.nakshatra) &&
    (options.rasi === undefined || candidate.rasi === options.rasi)
  );
  assert.ok(entry, `No sampled date has the Moon in Nakshatra ${options.nakshatra} / Rasi ${options.rasi}`);
  return entry.dob;
}

type Pair = ReturnType<typeof calculateWeddingCompatibility>;

const chartFor = (name: string, dob: string, gender: 'F' | 'M') =>
  calculatePrecisionHoroscope(name, dob, '12:00', CHENNAI.birthPlace, CHENNAI.latitude, CHENNAI.longitude, CHENNAI.timezoneOffsetHours, CHENNAI.country, gender);

function matchFor(bride: { nakshatra?: number; rasi?: number }, groom: { nakshatra?: number; rasi?: number }): Pair {
  return calculateWeddingCompatibility(
    { name: 'Bride', dob: dateFor(bride), tob: '12:00', ...CHENNAI, gender: 'F' },
    { name: 'Groom', dob: dateFor(groom), tob: '12:00', ...CHENNAI, gender: 'M' }
  );
}

const statusOf = (match: Pair, id: string) => {
  const porutham = match.poruthams.find(entry => entry.id === id);
  assert.ok(porutham, `Porutham ${id} must be evaluated`);
  return porutham.status;
};
const starDiff = (bride: number, groom: number) => ((groom - bride + 27) % 27) + 1;

const cases: Array<{ label: string; match: Pair }> = [];

function check(
  label: string,
  bride: { nakshatra?: number; rasi?: number },
  groom: { nakshatra?: number; rasi?: number },
  expectations: Partial<Record<string, PoruthamStatus>>
): Pair {
  const match = matchFor(bride, groom);
  cases.push({ label, match });

  // The date index must agree with the engine's own reading of the charts.
  if (bride.nakshatra !== undefined) {
    assert.equal(chartFor('Bride', dateFor(bride), 'F').janmaNakshatraIndex, bride.nakshatra,
      `${label}: bride Janma Nakshatra index`);
  }
  if (groom.nakshatra !== undefined) {
    assert.equal(chartFor('Groom', dateFor(groom), 'M').janmaNakshatraIndex, groom.nakshatra,
      `${label}: groom Janma Nakshatra index`);
  }

  for (const [id, expected] of Object.entries(expectations)) {
    assert.equal(statusOf(match, id), expected, `${label}: ${id} Porutham`);
  }
  return match;
}

// ---------------------------------------------------------------------------
// 1. Rajju Porutham - identical Rajju is the classical hard stop
// ---------------------------------------------------------------------------
for (const [groupName, first, second] of [
  ['Pada', 0, 9], ['Uru', 1, 10], ['Udhara', 2, 11], ['Kanda', 3, 12], ['Siro', 4, 13]
] as Array<[string, number, number]>) {
  assert.equal(RAJJU[first], RAJJU[second], `${groupName} Rajju reference pair`);
  const match = check(`same ${groupName} Rajju`, { nakshatra: first }, { nakshatra: second }, {
    rajju: PoruthamStatus.PORUNDHADHU
  });
  assert.equal(match.rajjuMatch, false, `same ${groupName} Rajju must fail the Rajju check`);
  assert.match(match.poruthams.find(entry => entry.id === 'rajju')!.explanationEn, /Same Rajju/);
  assert.equal(match.verdictStatus, PoruthamStatus.PORUNDHADHU,
    `same ${groupName} Rajju must block a positive verdict`);
  assert.match(match.overallVerdictEn, /Rajju/);
}
check('different Rajju (Pada + Uru)', { nakshatra: 0 }, { nakshatra: 1 }, {
  rajju: PoruthamStatus.UTTHAMAM
});

// Bride Avittam/Dhanishta (22, Siro Rajju) + groom Swati (14, Kanda Rajju):
// DIFFERENT groups, so Rajju must pass 5/5. This is the exact public sample
// couple, and the old table wrongly put both stars in the same group.
const avittamSwati = check('bride Avittam (Dhanishta) + groom Swati', { nakshatra: 22 }, { nakshatra: 14 }, {
  rajju: PoruthamStatus.UTTHAMAM
});
assert.equal(RAJJU[22], RAJJU[4], 'Dhanishta sits in the Siro Rajju group with Mrigashirsha');
assert.equal(RAJJU[14], RAJJU[3], 'Swati sits in the Kanda Rajju group with Rohini');
assert.equal(avittamSwati.rajjuMatch, true, 'Avittam + Swati must pass Rajju');
assert.equal(avittamSwati.poruthams.find(entry => entry.id === 'rajju')?.pointsEarned, 1.0);
assert.equal(avittamSwati.poruthams.find(entry => entry.id === 'rajju')?.maxPoints, 1.0);
console.log('  [PASS] Rajju Porutham: all five classical Rajju groups flag identical groups');

// ---------------------------------------------------------------------------
// 2. Vedha Porutham - the classical obstruction pairs
// ---------------------------------------------------------------------------
for (const [brideStar, groomStar] of [[0, 17], [1, 16], [2, 15], [3, 14], [9, 26], [10, 25], [11, 24], [12, 23]]) {
  assert.ok(VEDHA_PAIRS.has(`${brideStar},${groomStar}`), `${brideStar}/${groomStar} is a Vedha pair`);
  const match = check(`Vedha ${brideStar}/${groomStar}`, { nakshatra: brideStar }, { nakshatra: groomStar }, {
    vedhai: PoruthamStatus.PORUNDHADHU
  });
  assert.equal(match.vedhaMatch, false, `Vedha ${brideStar}/${groomStar} must fail the Vedha check`);
  assert.equal(match.verdictStatus, PoruthamStatus.PORUNDHADHU, 'Vedha must block a positive verdict');
  // Every classical Vedha pair also shares a Rajju group (the groups repeat
  // every nine Nakshatras), so these pairs are hard-stopped by Rajju as well
  // as Vedha and the verdict must name both failed crucial Poruthams.
  assert.match(match.overallVerdictEn, /Rajju and Vedha/);
  assert.equal(match.rajjuMatch, false, `Vedha ${brideStar}/${groomStar} shares a Rajju group`);
}
check('no Vedha (Ashwini + Bharani)', { nakshatra: 0 }, { nakshatra: 1 }, {
  vedhai: PoruthamStatus.UTTHAMAM
});
console.log('  [PASS] Vedha Porutham: eight classical obstruction pairs are detected');

// ---------------------------------------------------------------------------
// 3. Gana Porutham - the three temperaments and the asymmetric Deva rule
// ---------------------------------------------------------------------------
check('Deva bride + Deva groom', { nakshatra: 0 }, { nakshatra: 4 }, { gana: PoruthamStatus.UTTHAMAM });
check('Manushya bride + Deva groom', { nakshatra: 1 }, { nakshatra: 0 }, { gana: PoruthamStatus.UTTHAMAM });
check('Deva bride + Manushya groom', { nakshatra: 0 }, { nakshatra: 1 }, { gana: PoruthamStatus.MADHYAMAM });
check('Deva bride + Rakshasa groom (close stars)', { nakshatra: 0 }, { nakshatra: 2 }, { gana: PoruthamStatus.PORUNDHADHU });
check('Deva bride + Rakshasa groom (far stars)', { nakshatra: 0 }, { nakshatra: 18 }, { gana: PoruthamStatus.MADHYAMAM });
assert.ok(starDiff(0, 18) > 14, 'The far-star Rakshasa case must clear the 14-star distance');
check('Rakshasa bride + Rakshasa groom', { nakshatra: 2 }, { nakshatra: 8 }, { gana: PoruthamStatus.UTTHAMAM });
console.log('  [PASS] Gana Porutham: Deva/Manushya/Rakshasa combinations including the asymmetric rule');

// ---------------------------------------------------------------------------
// 4. Yoni Porutham - same animal, inimical animal, friendly animal
// ---------------------------------------------------------------------------
check('same Yoni (Horse + Horse)', { nakshatra: 0 }, { nakshatra: 23 }, { yoni: PoruthamStatus.UTTHAMAM });
assert.equal(YONI[0], YONI[23], 'Ashwini and Shatabhisha share the Horse Yoni');
check('inimical Yoni (Horse + Buffalo)', { nakshatra: 0 }, { nakshatra: 12 }, { yoni: PoruthamStatus.PORUNDHADHU });
assert.ok(INIMICAL_YONIS.has(`${YONI[0]},${YONI[12]}`), 'Horse and Buffalo are inimical');
check('inimical Yoni (Cat + Rat)', { nakshatra: 6 }, { nakshatra: 9 }, { yoni: PoruthamStatus.PORUNDHADHU });
check('friendly Yoni (Horse + Elephant)', { nakshatra: 0 }, { nakshatra: 1 }, { yoni: PoruthamStatus.MADHYAMAM });
console.log('  [PASS] Yoni Porutham: identical, inimical and neutral animal pairs');

// ---------------------------------------------------------------------------
// 5. Dina, Mahendra and Stree Deergha - the Nakshatra distance rules
// ---------------------------------------------------------------------------
check('Dina: star distance 4', { nakshatra: 0 }, { nakshatra: 3 }, { dina: PoruthamStatus.UTTHAMAM });
check('Dina: star distance 3', { nakshatra: 0 }, { nakshatra: 2 }, { dina: PoruthamStatus.PORUNDHADHU });
check('Dina: same star without the exception (Ashwini)', { nakshatra: 0 }, { nakshatra: 0 }, { dina: PoruthamStatus.PORUNDHADHU });
check('Dina: same star with the exception (Rohini)', { nakshatra: 3 }, { nakshatra: 3 }, { dina: PoruthamStatus.UTTHAMAM });

check('Mahendra: distance 4', { nakshatra: 0 }, { nakshatra: 3 }, { mahendra: PoruthamStatus.UTTHAMAM });
check('Mahendra: distance 2', { nakshatra: 0 }, { nakshatra: 1 }, { mahendra: PoruthamStatus.PORUNDHADHU });

check('Stree Deergha: distance 14', { nakshatra: 0 }, { nakshatra: 13 }, { sthree_dheergam: PoruthamStatus.UTTHAMAM });
check('Stree Deergha: distance 10', { nakshatra: 0 }, { nakshatra: 9 }, { sthree_dheergam: PoruthamStatus.MADHYAMAM });
check('Stree Deergha: distance 5', { nakshatra: 0 }, { nakshatra: 4 }, { sthree_dheergam: PoruthamStatus.PORUNDHADHU });
console.log('  [PASS] Dina, Mahendra and Stree Deergha star-distance rules');

// ---------------------------------------------------------------------------
// 6. Rasi, Rasiyadhipathi and Vasiya - the Moon-sign rules
// ---------------------------------------------------------------------------
check('Rasi: Sama Sapthama (7 apart)', { rasi: 1 }, { rasi: 7 }, { rasi: PoruthamStatus.UTTHAMAM });
check('Rasi: 3 apart', { rasi: 1 }, { rasi: 3 }, { rasi: PoruthamStatus.UTTHAMAM });
check('Rasi: same sign', { rasi: 1 }, { rasi: 1 }, { rasi: PoruthamStatus.MADHYAMAM });
check('Rasi: Shashtashtaka 6 apart with unfriendly lords', { rasi: 1 }, { rasi: 6 }, { rasi: PoruthamStatus.PORUNDHADHU });
check('Rasi: Shashtashtaka 6 apart, different lords (Kadagam + Dhanusu)', { rasi: 4 }, { rasi: 9 }, { rasi: PoruthamStatus.PORUNDHADHU });
check('Rasi: 8 apart but both Mars-ruled (Mesham + Viruchigam)', { rasi: 1 }, { rasi: 8 }, { rasi: PoruthamStatus.MADHYAMAM });

assert.equal(RASI_INFO[Rasi.MESHAM].lordEn, 'Mars');
assert.equal(RASI_INFO[Rasi.KUMBAM].lordEn, 'Saturn');
check('Rasiyadhipathi: Mars + Sun (both Deva)', { rasi: 1 }, { rasi: 5 }, { rasiyadhipathi: PoruthamStatus.UTTHAMAM });
check('Rasiyadhipathi: Venus + Mercury (both Asura)', { rasi: 2 }, { rasi: 6 }, { rasiyadhipathi: PoruthamStatus.UTTHAMAM });
check('Rasiyadhipathi: Mercury + Sun', { rasi: 6 }, { rasi: 5 }, { rasiyadhipathi: PoruthamStatus.MADHYAMAM });
check('Rasiyadhipathi: Mars + Saturn', { rasi: 1 }, { rasi: 11 }, { rasiyadhipathi: PoruthamStatus.PORUNDHADHU });
assert.ok(DEVA_LORDS.has('Mars') && ASURA_LORDS.has('Saturn'), 'Mars is Deva and Saturn is Asura');

check('Vasiya: Mesham attracts Simham', { rasi: 1 }, { rasi: 5 }, { vasiya: PoruthamStatus.UTTHAMAM });
assert.ok(VASIYA[1].includes(5), 'Mesham holds Simham by Vasiya');
check('Vasiya: Mesham and Mithunam', { rasi: 1 }, { rasi: 3 }, { vasiya: PoruthamStatus.MADHYAMAM });
console.log('  [PASS] Rasi, Rasiyadhipathi and Vasiya Moon-sign rules');

// ---------------------------------------------------------------------------
// 7. Structure, scoring and verdict arithmetic across every reference case
// ---------------------------------------------------------------------------
const PORUTHAM_IDS = [
  'dina', 'gana', 'mahendra', 'sthree_dheergam', 'yoni',
  'rasi', 'rasiyadhipathi', 'vasiya', 'rajju', 'vedhai'
];

for (const { label, match } of cases) {
  assert.deepEqual(match.poruthams.map(entry => entry.id), PORUTHAM_IDS, `${label}: the ten Poruthams`);
  assert.equal(match.maxScore, 10, `${label}: maximum score`);
  assert.equal(
    match.poruthams.reduce((sum, entry) => sum + entry.maxPoints, 0), 10,
    `${label}: the ten Poruthams are unit-weighted`
  );
  assert.equal(
    Number(match.poruthams.reduce((sum, entry) => sum + entry.pointsEarned, 0).toFixed(1)),
    match.totalScore,
    `${label}: the displayed score equals the sum of the row points`
  );
  assert.equal(
    match.totalPoruthamsMatched,
    match.poruthams.filter(entry =>
      entry.status === PoruthamStatus.UTTHAMAM || entry.status === PoruthamStatus.MADHYAMAM
    ).length,
    `${label}: matched count`
  );
  assert.equal(match.score, match.totalScore, `${label}: score aliases the total score`);

  // Independent verdict arithmetic.
  const points = match.poruthams.reduce((sum, entry) => sum + entry.pointsEarned, 0);
  const criticalOk = match.rajjuMatch && match.vedhaMatch;
  const balanced = match.sevvayDosham.isBrideHasDosham === match.sevvayDosham.isGroomHasDosham;
  const expectedVerdict = points >= 7 && criticalOk && balanced
    ? PoruthamStatus.UTTHAMAM
    : points >= 5 && criticalOk
      ? PoruthamStatus.MADHYAMAM
      : PoruthamStatus.PORUNDHADHU;
  assert.equal(match.verdictStatus, expectedVerdict, `${label}: verdict thresholds`);

  // Every row carries an explanation in all three languages.
  for (const entry of match.poruthams) {
    for (const [field, value] of Object.entries({
      nameEn: entry.nameEn, explanationEn: entry.explanationEn,
      nameTa: entry.nameTa, explanationTa: entry.explanationTa,
      nameHi: entry.nameHi, explanationHi: entry.explanationHi
    })) {
      assert.ok(value && value.trim().length > 0, `${label}: ${entry.id} must fill ${field}`);
    }
  }
}
console.log(`  [PASS] ${cases.length} reference matches: scoring, verdict thresholds and trilingual text`);

// ---------------------------------------------------------------------------
// 8. The symmetric rules must not depend on which partner is the bride
// ---------------------------------------------------------------------------
for (const [brideStar, groomStar] of [[0, 9], [0, 17], [0, 23], [6, 9]]) {
  const forward = matchFor({ nakshatra: brideStar }, { nakshatra: groomStar });
  const swapped = matchFor({ nakshatra: groomStar }, { nakshatra: brideStar });
  for (const id of ['rajju', 'vedhai', 'yoni']) {
    assert.equal(statusOf(swapped, id), statusOf(forward, id),
      `${brideStar}/${groomStar}: ${id} must be symmetric in the bride/groom roles`);
  }
  assert.equal(swapped.rajjuMatch, forward.rajjuMatch, 'Rajju check must be symmetric');
  assert.equal(swapped.vedhaMatch, forward.vedhaMatch, 'Vedha check must be symmetric');
}
console.log('  [PASS] Rajju, Vedha and Yoni are symmetric in the bride/groom roles');

// ---------------------------------------------------------------------------
// 9. Kuja (Sevvay) Dosham balancing follows the chart, not the score
// ---------------------------------------------------------------------------
for (const { label, match } of cases.slice(0, 8)) {
  const brideChart = chartFor('Bride', match.brideDob, 'F');
  const groomChart = chartFor('Groom', match.groomDob, 'M');
  for (const [role, chart] of [['bride', brideChart], ['groom', groomChart]] as const) {
    const mars = chart.planetPositions.find(entry => entry.graha === 'mars')!;
    const jupiter = chart.planetPositions.find(entry => entry.graha === 'jupiter')!;
    const raw = [2, 4, 7, 8, 12].includes(mars.bhavaNumber);
    const aspect = ((mars.bhavaNumber - jupiter.bhavaNumber + 12) % 12) + 1;
    const cancelled = raw && (
      [Rasi.MESHAM, Rasi.VIRUCHIGAM, Rasi.MAGARAM].includes(mars.rasi) ||
      jupiter.rasi === mars.rasi ||
      [5, 7, 9].includes(aspect) ||
      (mars.bhavaNumber === 7 && [Rasi.KADAGAM, Rasi.MAGARAM].includes(mars.rasi))
    );
    const expected = raw && !cancelled;
    const reported = role === 'bride'
      ? match.sevvayDosham.isBrideHasDosham
      : match.sevvayDosham.isGroomHasDosham;
    assert.equal(reported, expected,
      `${label}: ${role} Kuja Dosha (Mars in house ${mars.bhavaNumber})`);
  }
  const balanced = match.sevvayDosham.isBrideHasDosham === match.sevvayDosham.isGroomHasDosham;
  assert.equal(
    match.sevvayDosham.doshaSamyamStatusEn.includes('Imbalance'),
    !balanced,
    `${label}: Dosha Samyam text matches the chart`
  );
}
console.log('  [PASS] Sevvay Dosham (Kuja) balancing is derived from both charts');

console.log('Ten Porutham marriage compatibility reference tests passed.');
