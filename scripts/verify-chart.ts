/**
 * Accuracy harness: compute the public sample chart and dump raw values so they
 * can be diffed against an independent ephemeris (Swiss Ephemeris / Lahiri).
 *
 * Run: npx tsx scripts/verify-chart.ts
 */
import { calculatePrecisionHoroscope } from '../src/lib/astrology/astronomy';
import { Graha } from '../src/lib/astrology/types';

const CASES: Array<{
  label: string;
  dob: string;
  tob: string;
  place: string;
  lat: number;
  lon: number;
  tz: number;
}> = [
  {
    label: 'SAMPLE — 01 Jan 2000, 02:00, Chennai (IST +5:30)',
    dob: '2000-01-01',
    tob: '02:00',
    place: 'Chennai, Tamil Nadu, India',
    lat: 13.0827,
    lon: 80.2707,
    tz: 5.5
  },
  {
    label: 'J2000 reference — 01 Jan 2000, 12:00 UT, Greenwich',
    dob: '2000-01-01',
    tob: '12:00',
    place: 'Greenwich, United Kingdom',
    lat: 51.4779,
    lon: -0.0015,
    tz: 0
  }
];

const SIGN_ABBR = ['', 'Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];

for (const c of CASES) {
  const r = calculatePrecisionHoroscope('Verify', c.dob, c.tob, c.place, c.lat, c.lon, c.tz);

  console.log('');
  console.log('=========================================================');
  console.log(c.label);
  console.log('=========================================================');
  console.log('Ayanamsa (Lahiri) : ' + r.ayanamsa.toFixed(4) + ' deg');
  console.log('Lagna             : ' + SIGN_ABBR[r.lagnaRasi] + ' (' + r.lagnaRasiNameEn + ')  ' + r.lagnaDegrees.toFixed(3) + ' deg in sign');
  console.log('Chandra Rasi      : ' + SIGN_ABBR[r.chandraRasi] + ' (' + r.chandraRasiNameEn + ')');
  console.log('Janma Nakshatra   : ' + r.janmaNakshatraEn + '  pada ' + r.janmaPada + '  (index ' + r.janmaNakshatraIndex + ')');
  console.log('');
  console.log('Graha        Sidereal      Sign          DegSign    Bhava  Retro  Combust  Navamsa');
  console.log('---------------------------------------------------------------------------------');

  for (const g of Object.values(Graha)) {
    const p = r.planetPositions.find(x => x.graha === g);
    if (!p) continue;
    const deg = p.degrees ?? 0;
    const nav = r.navamsaPositions[p.graha];
    const line =
      g.padEnd(12) +
      p.totalDegrees.toFixed(3).padStart(9) + '   ' +
      (SIGN_ABBR[p.rasi] + ' (' + p.rasi + ')').padEnd(13) +
      deg.toFixed(3).padStart(9) +
      String(p.bhavaNumber).padStart(7) +
      String(p.isRetrograde).padStart(8) +
      String(p.isCombust).padStart(9) +
      '   ' + SIGN_ABBR[nav.rasi];
    console.log(line);
  }

  console.log('');
  console.log('Doshas flagged present:');
  for (const d of r.doshas || []) {
    if (d.isPresent) {
      console.log('  - ' + d.nameEn + (d.isNavagrahaAfflictionIndicator ? '   [navagraha screening indicator]' : ''));
    }
  }

  console.log('');
  const cd = r.currentDasha;
  console.log('Current dasha : ' + (cd ? cd.mahadashaLordEn : '(none)'));
  if (cd) {
    console.log('   Mahadasha  : ' + cd.mahadashaStart + '  ->  ' + cd.mahadashaEnd);
    console.log('   Antardasha: ' + cd.antardashaLordEn + '   ' + cd.antardashaStart + '  ->  ' + cd.antardashaEnd);
    console.log('   Balance@birth: ' + cd.balanceAtBirth);
  }
  console.log('First 4 dasha periods:');
  for (const p of (r.dashaPeriods || []).slice(0, 4)) {
    console.log('  ' + p.lordNameEn.padEnd(10) + p.startDate + '  ->  ' + p.endDate + '   (' + p.years + 'y)');
  }
}
