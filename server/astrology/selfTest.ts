/**
 * ASTRO SIVAM — end-to-end self-test on the reference chart.
 *
 *   npx tsx server/astrology/selfTest.ts     (or: npm run selftest)
 *
 * Prints, for 18-06-1991, 06:30 IST, Walajapet (12.92 N, 79.37 E), Lahiri:
 *   ayanamsa | every graha longitude + sign (+ dignity/retrograde/combustion)
 *   Lagna | Moon nakshatra + pada | Kuja verdict | dignity list
 *   current Mahadasa + Bhukti, and the next Mahadasa with its start date
 *   Graha Yuddha, Kendradhipati, the yoga notes and the Pitru strength.
 *
 * The reference values in EXPECTED come from Swiss Ephemeris 2.10.03
 * (SIDM_LAHIRI, TRUE ayanamsa): ayanamsa 23.742257°, Sun 62.586675°,
 * Asc 71.607308°. A deviation beyond the tolerances below means the engine,
 * the ayanamsa or the birth-time handling has moved.
 */
import { calculatePrecisionHoroscope, RASI_INFO } from './astronomy.js';
import { Graha } from './types.js';
import { ayanamsaDebugLine } from './ayanamsa.js';

const TEST_CHART = {
  name: 'ASTRO SIVAM self-test',
  dob: '1991-06-18',
  tob: '06:30',
  place: 'Walajapet, Tamil Nadu, India',
  lat: 12.92,
  lon: 79.37,
  tz: 5.5
};

const EXPECTED = {
  ayanamsa: 23.742257,
  sunTotal: 62.586675,
  lagnaTotal: 71.607308,
  moonTotal: 138.354897,
  marsTotal: 109.590047,
  jupiterTotal: 108.164381,
  venusTotal: 107.881026,
  saturnTotal: 282.306733,
  nakEn: 'Purva Phalguni',
  pada: 2
};

const fmt = (value: number, digits = 4): string => value.toFixed(digits);
const signOf = (total: number): string => RASI_INFO[((Math.floor(total / 30) % 12) + 1) as 1].nameEn;

export function runAstroSelfTest(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  const failures: string[] = [];
  const push = (text: string) => {
    lines.push(text);
    console.log(text);
  };
  const check = (label: string, condition: boolean, detail = '') => {
    if (!condition) failures.push(detail ? `${label}: ${detail}` : label);
    push(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  };


  const chart = calculatePrecisionHoroscope(
    TEST_CHART.name,
    TEST_CHART.dob,
    TEST_CHART.tob,
    TEST_CHART.place,
    TEST_CHART.lat,
    TEST_CHART.lon,
    TEST_CHART.tz
  );

  push('');
  push('=========================================================');
  push('ASTRO SIVAM SELF-TEST');
  push(`Chart: ${TEST_CHART.dob} ${TEST_CHART.tob} IST, ${TEST_CHART.place} (${TEST_CHART.lat}N, ${TEST_CHART.lon}E)`);
  push('=========================================================');
  push('');
  push('AYANAMSA');
  const ayanamsaLine = `  ${chart.ayanamsa.toFixed(6)}°  (${chart.ayanamsaMode ?? 'TRUE'} Lahiri / Chitra Paksha)`;
  push(ayanamsaLine);
  push(`  debug: ${ayanamsaDebugLine(chart.julianDay ?? 0, chart.ayanamsa)}`);

  push('');
  push('LAGNA');
  push(`  ${chart.lagnaRasiNameEn} (${chart.lagnaRasiNameTa}) ${fmt(chart.lagnaDegrees, 2)}°  [sidereal ${fmt(chart.lagnaRasi * 30 - 30 + chart.lagnaDegrees, 4)}°]`);

  push('');
  push('MOON');
  push(`  ${chart.chandraRasiNameEn}  ${fmt(chart.planetPositions.find(p => p.graha === Graha.CHANDRA)?.degrees ?? 0, 2)}°`);
  push(`  Nakshatra: ${chart.janmaNakshatraEn} (${chart.janmaNakshatraTa})  pada ${chart.janmaPada}`);

  push('');
  push('GRAHA LONGITUDES (sidereal, Lahiri) + DIGNITY');
  push('  Graha      Total°      Sign           Deg    Bhava  Dignity / state');
  for (const graha of Object.values(Graha)) {
    const position = chart.planetPositions.find(p => p.graha === graha);
    if (!position) continue;
    const dignity = position.dignity;
    const tags = dignity ? dignity.tagsEn : '';
    push(
      '  ' +
        position.nameEn.padEnd(10) +
        fmt(position.totalDegrees, 4).padStart(9) +
        '  ' +
        (position.rasiNameEn ?? '').padEnd(14) +
        fmt(position.degrees, 2).padStart(6) +
        String(position.bhavaNumber).padStart(7) +
        '  ' +
        tags
    );
    if (dignity?.isNeechaBhanga) push(`              ↳ ${dignity.neechaBhangaEn}`);
  }

  const kuja = chart.doshas.find(d => /kuja|sevvay/i.test(d.nameEn));
  push('');
  push('KUJA (SEVVAY) DOSHA');
  push(`  verdict: ${kuja?.verdict ?? 'n/a'}   ${kuja?.ruleEn ?? 'rule set: see engine'}`);
  const marsKuja = chart.planetPositions.find(p => p.graha === Graha.CHEVVAI);
  push(`  Mars dignity: ${marsKuja?.dignity?.tagsEn ?? 'N/A'}`);
  if (marsKuja?.dignity?.isNeechaBhanga) push(`    ${marsKuja.dignity.neechaBhangaEn}`);
  push(`  badge EN: ${kuja?.verdictLabelEn ?? ''}`);
  push(`  badge TA: ${kuja?.verdictLabelTa ?? ''}`);
  push(`  ${kuja?.descriptionEn ?? ''}`);

  const pitru = chart.doshas.find(d => /pitru/i.test(d.nameEn));
  push('');
  push('PITRU');
  push(`  strength: ${pitru?.strength ?? 'n/a'} — ${pitru?.strengthLabelEn ?? ''}`);

  push('');
  push('YOGAS / DOSHAS / EXTRAS');
  for (const yoga of chart.yogas ?? []) push(`  [${yoga.severity}] ${yoga.nameEn}`);
  for (const war of chart.grahaYuddha ?? []) {
    push(`  [graha yuddha] ${war.planetANameEn} vs ${war.planetBNameEn} ${fmt(war.separationDegrees, 3)}° → winner ${war.winnerNameEn}`);
  }
  for (const kendra of chart.kendradhipati ?? []) {
    push(`  [kendradhipati] ${kendra.grahaNameEn} owns houses ${kendra.houses.join(', ')}${kendra.appliesToLagnaLord ? ' (Lagna lord — traditionally exempt)' : ''}`);
  }

  push('');
  push('VIMSHOTTARI DASHA (from the Moon longitude)');
  push(`  balance at birth: ${chart.currentDasha?.balanceAtBirth ?? 'n/a'}`);
  push(`  current : ${chart.currentDasha?.mahadashaLordEn ?? 'n/a'} Mahadasa (${chart.currentDasha?.mahadashaStart} to ${chart.currentDasha?.mahadashaEnd})`);
  push(`            ${chart.currentDasha?.antardashaLordEn ?? 'n/a'} Bhukti (${chart.currentDasha?.antardashaStart} to ${chart.currentDasha?.antardashaEnd})`);
  if (chart.currentDasha?.nextMahadasa) {
    push(`  next    : ${chart.currentDasha.nextMahadasa.lordNameEn} Mahadasa begins ${chart.currentDasha.nextMahadasa.beginsOn} (${chart.currentDasha.nextMahadasa.monthsAhead} months)`);
  }
  push(`  notice  : ${chart.currentDasha?.mahadashaChangeNoticeEn || '(no Mahadasa change inside 12 months)'}`);
  push(`  notice TA: ${chart.currentDasha?.mahadashaChangeNoticeTa || '-'}`);

  push('');
  push('CORRECTNESS CHECKS (Swiss Ephemeris reference)');
  const planetTotal = (graha: Graha) => chart.planetPositions.find(p => p.graha === graha)?.totalDegrees ?? NaN;
  check('ayanamsa ≈ 23.742257°', Math.abs(chart.ayanamsa - EXPECTED.ayanamsa) <= 0.01, `got ${chart.ayanamsa}`);
  check('Sun ≈ 62.5867° (Mithunam 2.59°)', Math.abs(planetTotal(Graha.SURYA) - EXPECTED.sunTotal) <= 0.05, `got ${planetTotal(Graha.SURYA)}`);
  check('Moon ≈ 138.3549°', Math.abs(planetTotal(Graha.CHANDRA) - EXPECTED.moonTotal) <= 0.05, `got ${planetTotal(Graha.CHANDRA)}`);
  check('Lagna ≈ 71.6073° (Mithunam 11.61°)', Math.abs(chart.lagnaRasi * 30 - 30 + chart.lagnaDegrees - EXPECTED.lagnaTotal) <= 0.05, `got ${chart.lagnaRasi * 30 - 30 + chart.lagnaDegrees}`);
  check(`Nakshatra = ${EXPECTED.nakEn} pada ${EXPECTED.pada}`, chart.janmaNakshatraEn === EXPECTED.nakEn && chart.janmaPada === EXPECTED.pada, `got ${chart.janmaNakshatraEn} pada ${chart.janmaPada}`);
  check('Kuja verdict = present-cancelled (Guru-Mangala)', kuja?.verdict === 'present-cancelled', `got ${kuja?.verdict}`);
  check(
    'Kuja rule set = 2, 4, 7, 8, 12 (South Indian; no 1st house)',
    // `KujaDoshaResult.ruleSet` is serialised as '2,4,7,8,12' (see
    // server/astrology/kujaDosha.ts), so compare with the spacing normalised
    // instead of pinning one separator style in the report sentence.
    (kuja?.ruleEn ?? '').replace(/,\s*/g, ',').includes('2,4,7,8,12'),
    kuja?.ruleEn ?? 'missing'
  );
  check(
    'Kuja card names the Dosha Nivrutti rule (no flat "cancelled")',
    !/cancelled/i.test(kuja?.verdictLabelEn ?? '') && /nivrutti/i.test(kuja?.verdictLabelEn ?? ''),
    kuja?.verdictLabelEn ?? 'missing'
  );
  const mars = chart.planetPositions.find(p => p.graha === Graha.CHEVVAI);
  check('Mars in Kadagam is debilitated + Neecha Bhanga', Boolean(mars?.dignity?.isDebilitated && mars?.dignity?.isNeechaBhanga));
  check(
    'Mars shows "Debilitated (Neecha)" and "Neecha Bhanga (by Jupiter conjunction)"',
    Boolean(
      mars?.dignity &&
      mars.dignity.tagsEn.includes('Debilitated (Neecha)') &&
      mars.dignity.tagsEn.includes('Neecha Bhanga (by Jupiter conjunction)') &&
      mars.dignity.neechaBhangaEn.includes('by Jupiter conjunction') &&
      !/debilitation cancelled/i.test(mars.dignity.neechaBhangaEn)
    ),
    mars?.dignity?.tagsEn ?? 'missing'
  );
  const saturn = chart.planetPositions.find(p => p.graha === Graha.SANI);
  check('Saturn in Makaram is own sign + retrograde', Boolean(saturn?.dignity?.isOwnSign && saturn?.isRetrograde));
  check('Sarala yoga (8th lord in the 8th) reported', (chart.yogas ?? []).some(yoga => yoga.code === 'SARALA'));
  check('Graha Yuddha Venus–Jupiter with Venus as winner', (chart.grahaYuddha ?? []).some(war => war.winner === Graha.SUKRA && war.loser === Graha.GURU));
  check('Kendradhipati dosha reported for Jupiter (7th + 10th)', (chart.kendradhipati ?? []).some(entry => entry.graha === Graha.GURU && entry.houses.includes(7) && entry.houses.includes(10)));
  check('Pitru Sun–node pair reported weak (same sign only)', pitru?.strength === 'weak', `got ${pitru?.strength}`);
  check('Next Mahadasa computed with a start date', Boolean(chart.currentDasha?.nextMahadasa?.beginsOn));

  push('');
  push('=========================================================');
  push(failures.length === 0 ? 'SELF-TEST PASSED' : `SELF-TEST FAILED (${failures.length}): ${failures.join(' | ')}`);
  push('=========================================================');

  return { ok: failures.length === 0, lines };
}

const isDirectRun = typeof process !== 'undefined' && process.argv[1]
  ? /selfTest\.(ts|js|mjs|cjs)$/.test(process.argv[1])
  : false;
if (isDirectRun) {
  const result = runAstroSelfTest();
  process.exitCode = result.ok ? 0 : 1;
}
