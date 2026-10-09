import assert from 'node:assert/strict';
import {
  calculateVimshottariDashaTimeline,
  NAKSHATRA_LORDS
} from '../src/lib/astrology/astronomy.js';
import { Graha } from '../src/lib/astrology/types.js';

/**
 * Vimshottari Dasha timeline validation.
 *
 * The reference data below is the classical system itself, written out
 * independently of the implementation:
 *   - the fixed Mahadasha sequence Ketu -> Venus -> Sun -> Moon -> Mars ->
 *     Rahu -> Jupiter -> Saturn -> Mercury,
 *   - the fixed period lengths 7/20/6/10/7/18/16/19/17 years,
 *   - a full cycle of 120 years,
 *   - the Antardasha duration formula (mahadashaYears * antardashaYears) / 120.
 */
const CLASSICAL_ORDER: Graha[] = [
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA,
  Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
];

const CLASSICAL_YEARS: Record<Graha, number> = {
  [Graha.KETU]: 7,
  [Graha.SUKRA]: 20,
  [Graha.SURYA]: 6,
  [Graha.CHANDRA]: 10,
  [Graha.CHEVVAI]: 7,
  [Graha.RAHU]: 18,
  [Graha.GURU]: 16,
  [Graha.SANI]: 19,
  [Graha.BUDHA]: 17
};

const DAY_MS = 86400000;
const YEAR_DAYS = 365.25;
const NAK_SPAN = 360 / 27;
const BIRTH = new Date('2000-01-01T00:00:00Z');
const iso = (value: Date) => value.toISOString().split('T')[0];
const parseDay = (value: string) => Date.parse(`${value}T00:00:00Z`);

assert.equal(
  Object.values(CLASSICAL_YEARS).reduce((sum, years) => sum + years, 0),
  120,
  'The nine classical Mahadasha periods must total exactly 120 years'
);

// ---------------------------------------------------------------------------
// 1. Classical order, starting lord and the 120-year cycle for every Nakshatra
// ---------------------------------------------------------------------------
for (let nakshatraIdx = 0; nakshatraIdx < 27; nakshatraIdx++) {
  const startingLord = NAKSHATRA_LORDS[nakshatraIdx];
  assert.ok(CLASSICAL_ORDER.includes(startingLord), `Nakshatra ${nakshatraIdx} must map to a classical Dasha lord`);

  const { periods } = calculateVimshottariDashaTimeline(
    nakshatraIdx, 0, NAK_SPAN, BIRTH, BIRTH, 'UTC'
  );

  const expectedLords = CLASSICAL_ORDER.map(
    (_, offset) => CLASSICAL_ORDER[(CLASSICAL_ORDER.indexOf(startingLord) + offset) % 9]
  );
  assert.deepEqual(
    periods.map(period => period.mahadashaLord),
    expectedLords,
    `Nakshatra ${nakshatraIdx} Mahadashas must follow the classical cycle from ${startingLord}`
  );
  assert.deepEqual(
    periods.map(period => period.years),
    expectedLords.map(lord => CLASSICAL_YEARS[lord]),
    `Nakshatra ${nakshatraIdx} Mahadasha lengths must match the classical year counts`
  );

  // posInNak = 0 leaves the whole first period, so the timeline spans the
  // complete 120-year cycle from birth.
  const spanDays = (parseDay(periods[8].endDate) - parseDay(periods[0].startDate)) / DAY_MS;
  assert.ok(
    Math.abs(spanDays - 120 * YEAR_DAYS) <= 2,
    `Nakshatra ${nakshatraIdx} must span 120 years from birth; got ${spanDays} days`
  );

  // Contiguous periods: no gap and no overlap between consecutive Mahadashas.
  for (let i = 1; i < periods.length; i++) {
    assert.equal(
      periods[i].startDate,
      periods[i - 1].endDate,
      `Nakshatra ${nakshatraIdx} Mahadasha ${i} must start where Mahadasha ${i - 1} ends`
    );
  }
}

console.log('  [PASS] All 27 Nakshatras open the classical Vimshottari cycle and span 120 years');

// ---------------------------------------------------------------------------
// 2. Balance at birth shortens the timeline by exactly the elapsed fraction
// ---------------------------------------------------------------------------
for (const [label, fraction, expectedBalance] of [
  ['start of Nakshatra', 0, '7 Years 0 Months'],
  ['quarter through Nakshatra', 0.25, '5 Years 3 Months'],
  ['mid Nakshatra', 0.5, '3 Years 6 Months'],
  ['end of Nakshatra', 0.999, '0 Years 0 Months']
] as Array<[string, number, string]>) {
  const { periods, currentDasha } = calculateVimshottariDashaTimeline(
    0, NAK_SPAN * fraction, NAK_SPAN, BIRTH, BIRTH, 'UTC'
  );
  const elapsedYears = CLASSICAL_YEARS[Graha.KETU] * fraction;
  assert.equal(currentDasha.balanceAtBirth, expectedBalance, `Balance at birth (${label})`);
  assert.equal(periods[0].years, Number((CLASSICAL_YEARS[Graha.KETU] - elapsedYears).toFixed(1)),
    `First Mahadasha carries only the remaining balance (${label})`);

  const spanDays = (parseDay(periods[8].endDate) - parseDay(periods[0].startDate)) / DAY_MS;
  assert.ok(
    Math.abs(spanDays - (120 - elapsedYears) * YEAR_DAYS) <= 2,
    `Timeline ends 120 years after the start of the birth Mahadasha (${label}); got ${spanDays} days`
  );
}

// A past-life fraction beyond the Nakshatra span is clamped instead of
// producing a negative first Mahadasha.
const clamped = calculateVimshottariDashaTimeline(0, NAK_SPAN * 1.5, NAK_SPAN, BIRTH, BIRTH, 'UTC');
assert.equal(clamped.periods[0].years, 0, 'An out-of-range Nakshatra position clamps to a zero balance');
assert.equal(clamped.currentDasha.balanceAtBirth, '0 Years 0 Months');
assert.ok(Number.isFinite(clamped.periods[0].years) && clamped.periods[0].years >= 0,
  'A clamped balance must never produce a negative Mahadasha length');

console.log('  [PASS] Balance-at-birth arithmetic, cycle end and out-of-range clamping');

// ---------------------------------------------------------------------------
// 3. Antardasha order and the (mahaYears * antarYears) / 120 formula
// ---------------------------------------------------------------------------
for (let nakshatraIdx = 0; nakshatraIdx < 27; nakshatraIdx++) {
  const { periods } = calculateVimshottariDashaTimeline(
    nakshatraIdx, 0, NAK_SPAN, BIRTH, BIRTH, 'UTC'
  );

  for (const period of periods) {
    const mahaLord = period.mahadashaLord;
    const mahaIdx = CLASSICAL_ORDER.indexOf(mahaLord);
    const antardashas = period.antardashas ?? [];
    assert.equal(antardashas.length, 9, `${mahaLord} must hold nine Antardashas`);

    assert.deepEqual(
      antardashas.map(entry => entry.lord),
      CLASSICAL_ORDER.map((_, offset) => CLASSICAL_ORDER[(mahaIdx + offset) % 9]),
      `${mahaLord} Antardashas must start with its own lord and follow the classical cycle`
    );

    for (const [index, entry] of antardashas.entries()) {
      const expectedMonths = Number(
        ((CLASSICAL_YEARS[mahaLord] * CLASSICAL_YEARS[entry.lord]) / 120 * 12).toFixed(1)
      );
      assert.equal(entry.months, expectedMonths,
        `${mahaLord}/${entry.lord} Antardasha must last (${CLASSICAL_YEARS[mahaLord]} x ` +
        `${CLASSICAL_YEARS[entry.lord]}) / 120 years = ${expectedMonths} months`);
    }

    // The nine Antardashas must exactly fill their Mahadasha.
    const antardashaDays =
      (parseDay(antardashas[8].endDate) - parseDay(antardashas[0].startDate)) / DAY_MS;
    const mahaDays = (parseDay(period.endDate) - parseDay(period.startDate)) / DAY_MS;
    assert.ok(
      Math.abs(antardashaDays - mahaDays) <= 2,
      `${mahaLord} Antardashas must fill the Mahadasha (${antardashaDays} vs ${mahaDays} days)`
    );

    for (let i = 1; i < antardashas.length; i++) {
      assert.equal(antardashas[i].startDate, antardashas[i - 1].endDate,
        `${mahaLord} Antardasha ${i} must start where Antardasha ${i - 1} ends`);
    }
    assert.equal(antardashas[8].endDate, period.endDate,
      `${mahaLord}: the ninth Antardasha must end exactly with its Mahadasha`);
  }
}

console.log('  [PASS] Antardasha order, (mahaYears x antarYears)/120 formula, and full coverage');

// ---------------------------------------------------------------------------
// 4. Current-period lookup across the whole cycle
// ---------------------------------------------------------------------------
for (const nakshatraIdx of [0, 4, 9, 14, 21, 26]) {
  const { periods, currentDasha } = calculateVimshottariDashaTimeline(
    nakshatraIdx, NAK_SPAN * 0.5, NAK_SPAN, BIRTH, BIRTH, 'UTC'
  );
  assert.equal(currentDasha.mahadashaLord, periods[0].mahadashaLord,
    `Nakshatra ${nakshatraIdx}: the birth moment belongs to the first Mahadasha`);

  // Rebuild the exact period boundaries from the classical year counts and the
  // 365.25-day year, so lookups are checked against instants rather than the
  // date-only strings the reports display.
  const startLord = NAKSHATRA_LORDS[nakshatraIdx];
  const startIdx = CLASSICAL_ORDER.indexOf(startLord);
  const elapsedYears = CLASSICAL_YEARS[startLord] * 0.5;
  const birthMs = BIRTH.getTime();
  const firstEndMs = birthMs + Math.round((CLASSICAL_YEARS[startLord] - elapsedYears) * YEAR_DAYS) * DAY_MS;
  const mahaBoundaries: Array<{ lord: Graha; start: number; end: number }> = [
    { lord: startLord, start: birthMs, end: firstEndMs }
  ];
  for (let i = 1; i <= 8; i++) {
    const lord = CLASSICAL_ORDER[(startIdx + i) % 9];
    const start = mahaBoundaries[i - 1].end;
    mahaBoundaries.push({ lord, start, end: start + CLASSICAL_YEARS[lord] * YEAR_DAYS * DAY_MS });
  }

  for (let offsetDays = 0; offsetDays < 120 * YEAR_DAYS; offsetDays += 37) {
    const asOf = new Date(birthMs + offsetDays * DAY_MS);
    const mahaIndex = mahaBoundaries.findIndex(
      range => asOf.getTime() >= range.start && asOf.getTime() < range.end
    );
    if (mahaIndex < 0) continue; // past the end of this cycle
    const maha = mahaBoundaries[mahaIndex];

    // Antardashas of the first Mahadasha are laid out from the theoretical
    // start of that Mahadasha, which lies before birth; the balance at birth is
    // simply the portion remaining inside it.
    const antarStart = mahaIndex === 0 ? birthMs - elapsedYears * YEAR_DAYS * DAY_MS : maha.start;
    const antardashas = CLASSICAL_ORDER.map((_, offset) => CLASSICAL_ORDER[(CLASSICAL_ORDER.indexOf(maha.lord) + offset) % 9]);
    let cursor = antarStart;
    let expectedAntar = antardashas[0];
    let expectedAntarStart = iso(new Date(cursor));
    let expectedAntarEnd = iso(new Date(cursor));
    for (const [index, lord] of antardashas.entries()) {
      const days = Math.round((CLASSICAL_YEARS[maha.lord] * CLASSICAL_YEARS[lord]) / 120 * YEAR_DAYS);
      // The ninth Antardasha is anchored to the Mahadasha's end so that the
      // rounded durations leave no gap at the end of the period.
      const endMs = index === 8 ? maha.end : cursor + days * DAY_MS;
      expectedAntarStart = iso(new Date(cursor));
      expectedAntarEnd = iso(new Date(endMs));
      if (asOf.getTime() >= cursor && asOf.getTime() < endMs) {
        expectedAntar = lord;
        break;
      }
      cursor += days * DAY_MS;
    }

    const resolved = calculateVimshottariDashaTimeline(
      nakshatraIdx, NAK_SPAN * 0.5, NAK_SPAN, BIRTH, asOf, 'UTC'
    ).currentDasha;

    assert.equal(resolved.mahadashaLord, maha.lord,
      `Nakshatra ${nakshatraIdx} at +${offsetDays}d must report ${maha.lord} Mahadasha`);
    assert.equal(resolved.antardashaLord, expectedAntar,
      `Nakshatra ${nakshatraIdx} at +${offsetDays}d must report the ${expectedAntar} Antardasha`);
    assert.equal(resolved.antardashaStart, expectedAntarStart,
      `Nakshatra ${nakshatraIdx} at +${offsetDays}d: Antardasha start date`);
    assert.equal(resolved.antardashaEnd, expectedAntarEnd,
      `Nakshatra ${nakshatraIdx} at +${offsetDays}d: Antardasha end date`);
    assert.ok(
      parseDay(resolved.antardashaStart) - DAY_MS <= asOf.getTime() &&
      asOf.getTime() <= parseDay(resolved.antardashaEnd) + DAY_MS,
      `Nakshatra ${nakshatraIdx} at +${offsetDays}d: the reported Antardasha must contain the date`
    );
  }

  const endMs = mahaBoundaries[8].end;

  // Beyond the 120-year cycle (and before birth) the timeline falls back to the
  // birth Mahadasha rather than throwing or inventing a period.
  const afterCycle = calculateVimshottariDashaTimeline(
    nakshatraIdx, NAK_SPAN * 0.5, NAK_SPAN, BIRTH, new Date(endMs + 365 * DAY_MS), 'UTC'
  );
  assert.equal(afterCycle.currentDasha.mahadashaLord, periods[0].mahadashaLord,
    'A date past the 120-year cycle falls back to the birth Mahadasha');
  const beforeBirth = calculateVimshottariDashaTimeline(
    nakshatraIdx, NAK_SPAN * 0.5, NAK_SPAN, BIRTH, new Date(birthMs - 365 * DAY_MS), 'UTC'
  );
  assert.equal(beforeBirth.currentDasha.mahadashaLord, periods[0].mahadashaLord,
    'A date before birth falls back to the birth Mahadasha');
  assert.equal(iso(BIRTH), '2000-01-01', 'Fixture sanity check');
}

console.log('  [PASS] Current Mahadasha/Antardasha lookup across the full cycle and out-of-range dates');

console.log('Vimshottari Dasha timeline (order, 120-year cycle, Antardasha formula, lookups) passed.');
