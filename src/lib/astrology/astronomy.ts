import * as Astronomy from 'astronomy-engine';
import { hasValidBirthDetails } from './birthDetails.js';
import { NAVAGRAHA_DOSHA_DATA, navagrahaRemedyText } from '../../services/jathagamDoshaData.js';
import {
  formatTimeInTimeZone,
  getLocalDateKey,
  getTimeZoneIdForCoordinates,
  getZonedDateTimeParts,
  resolveLocalDateTimeInTimeZone
} from '../timezone.js';
import { kujaDoshaFromHoroscope } from './kujaDosha.js';
import {
  Graha,
  Rasi,
  PlanetPosition,
  BhavaDetail,
  DashaPeriod,
  AntardashaPeriod,
  CurrentDashaInfo,
  SaniTransitStatus,
  DoshaCheckResult,
  LifeAspectSummary,
  HoroscopeResult,
  PanchangamResult
} from './types.js';

export const NAKSHATRAM_NAMES_TA = [
  'அஸ்வினி', 'பரணி', 'கிருத்திகை', 'ரோகிணி', 'மிருகசீரிடம்', 'திருவாதிரை',
  'புனர்பூசம்', 'பூசம்', 'ஆயில்யம்', 'மகம்', 'பூரம்', 'உத்திரம்',
  'அஸ்தம்', 'சித்திரை', 'சுவாதி', 'விசாகம்', 'அனுஷம்', 'கேட்டை',
  'மூலம்', 'பூராடம்', 'உத்திராடம்', 'திருவோணம்', 'அவிட்டம்', 'சதயம்',
  'பூரட்டாதி', 'உத்திரட்டாதி', 'ரேவதி'
];

export const NAKSHATRAM_NAMES_EN = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Arudra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

export const NAKSHATRAM_NAMES_HI = [
  'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा',
  'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्वाफाल्गुनी', 'उत्तराफाल्गुनी',
  'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
  'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा',
  'पूर्वाभाद्रपद', 'उत्तराभाद्रपद', 'रेवती'
];

/**
 * Rahu/Ketu convention of this engine.
 *
 *   MEAN  the smoothed ascending node of the lunar orbit (Meeus 47.7) — the
 *         classical convention: the nodes are always retrograde, most printed
 *         panchang tables and older horoscopes assume it, and B. V. Raman's
 *         "Hindu Predictive Astrology" recommends it "for all practical
 *         purposes of horoscopy". DEFAULT.
 *   TRUE  the osculating node derived from the instantaneous lunar state
 *         vector, i.e. Swiss Ephemeris SE_TRUE_NODE (Drik Panchang / Jhora).
 *
 * Because the two differ by up to ~1.29°, the choice can move Rahu/Ketu to a
 * different nakshatra pada (and, near a cusp, a different rasi), so the report
 * always states which convention produced its chart. Override with the
 * ASTRO_RAHU_NODE_TYPE environment variable (MEAN | TRUE), the same setting
 * the PHP engine reads from api/config.php. The default is MEAN for both
 * stacks so the browser preview and a PHP-rendered PDF describe the same lunar node.
 */
export type RahuNodeType = 'TRUE' | 'MEAN';

/**
 * Resolve the configured node convention. Read at call time (not cached at
 * module load) so tests and admin tooling can flip the setting in-process, and
 * guarded for the browser bundle, where `process` does not exist.
 */
export function rahuNodeType(): RahuNodeType {
  if (typeof process === 'undefined' || !process.env) return 'MEAN';
  const raw = String(process.env.ASTRO_RAHU_NODE_TYPE ?? '').trim().toUpperCase();
  if (raw === 'TRUE' || raw === 'OSCULATING') return 'TRUE';
  if (raw === 'MEAN') return 'MEAN';
  if (raw !== '') {
    console.warn(`[astro] invalid ASTRO_RAHU_NODE_TYPE "${raw}"; expected MEAN or TRUE. Using MEAN.`);
  }
  return 'MEAN';
}

export const RAHU_NODE_TYPE: RahuNodeType = rahuNodeType();

/**
 * Ayanamsa convention of this engine: TRUE (mean Lahiri + Δψ), the same
 * convention the PHP engine and Drik Panchang use. Set ASTRO_AYANAMSA_MODE=MEAN
 * to cross-check against `swe_get_ayanamsa_ut()`.
 */
export const AYANAMSA_MODE: AyanamsaMode = ayanamsaMode();

export const NAKSHATRA_LORDS: Graha[] = [
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA,
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA,
  Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
];

export const RASI_INFO: Record<Rasi, {
  nameTa: string;
  nameEn: string;
  nameHi: string;
  lordGraha: Graha;
  lordTa: string;
  lordEn: string;
  lordHi: string;
  symbolEmoji: string;
}> = {
  [Rasi.MESHAM]: { nameTa: 'மேஷம்', nameEn: 'Mesham (Aries)', nameHi: 'मेष (Aries)', lordGraha: Graha.CHEVVAI, lordTa: 'செவ்வாய்', lordEn: 'Mars', lordHi: 'मंगल', symbolEmoji: '♈' },
  [Rasi.RISHABAM]: { nameTa: 'ரிஷபம்', nameEn: 'Rishabam (Taurus)', nameHi: 'वृषभ (Taurus)', lordGraha: Graha.SUKRA, lordTa: 'சுக்கிரன்', lordEn: 'Venus', lordHi: 'शुक्र', symbolEmoji: '♉' },
  [Rasi.MITHUNAM]: { nameTa: 'மிதுனம்', nameEn: 'Mithunam (Gemini)', nameHi: 'मिथुन (Gemini)', lordGraha: Graha.BUDHA, lordTa: 'புதன்', lordEn: 'Mercury', lordHi: 'बुध', symbolEmoji: '♊' },
  [Rasi.KADAGAM]: { nameTa: 'கடகம்', nameEn: 'Kadagam (Cancer)', nameHi: 'कर्क (Cancer)', lordGraha: Graha.CHANDRA, lordTa: 'சந்திரன்', lordEn: 'Moon', lordHi: 'चंद्र', symbolEmoji: '♋' },
  [Rasi.SIMHAM]: { nameTa: 'சிம்மம்', nameEn: 'Simham (Leo)', nameHi: 'सिंह (Leo)', lordGraha: Graha.SURYA, lordTa: 'சூரியன்', lordEn: 'Sun', lordHi: 'सूर्य', symbolEmoji: '♌' },
  [Rasi.KANNI]: { nameTa: 'கன்னி', nameEn: 'Kanni (Virgo)', nameHi: 'कन्या (Virgo)', lordGraha: Graha.BUDHA, lordTa: 'புதன்', lordEn: 'Mercury', lordHi: 'बुध', symbolEmoji: '♍' },
  [Rasi.THULAM]: { nameTa: 'துலாம்', nameEn: 'Thulam (Libra)', nameHi: 'तुला (Libra)', lordGraha: Graha.SUKRA, lordTa: 'சுக்கிரன்', lordEn: 'Venus', lordHi: 'शुक्र', symbolEmoji: '♎' },
  [Rasi.VIRUCHIGAM]: { nameTa: 'விருச்சிகம்', nameEn: 'Viruchigam (Scorpio)', nameHi: 'वृश्चिक (Scorpio)', lordGraha: Graha.CHEVVAI, lordTa: 'செவ்வாய்', lordEn: 'Mars', lordHi: 'मंगल', symbolEmoji: '♏' },
  [Rasi.DHANUSU]: { nameTa: 'தனுசு', nameEn: 'Dhanusu (Sagittarius)', nameHi: 'धनु (Sagittarius)', lordGraha: Graha.GURU, lordTa: 'குரு', lordEn: 'Jupiter', lordHi: 'गुरु', symbolEmoji: '♐' },
  [Rasi.MAGARAM]: { nameTa: 'மகரம்', nameEn: 'Magaram (Capricorn)', nameHi: 'मकर (Capricorn)', lordGraha: Graha.SANI, lordTa: 'சனி', lordEn: 'Saturn', lordHi: 'शनि', symbolEmoji: '♑' },
  [Rasi.KUMBAM]: { nameTa: 'கும்பம்', nameEn: 'Kumbam (Aquarius)', nameHi: 'कुंभ (Aquarius)', lordGraha: Graha.SANI, lordTa: 'சனி', lordEn: 'Saturn', lordHi: 'शनि', symbolEmoji: '♒' },
  [Rasi.MEENAM]: { nameTa: 'மீனம்', nameEn: 'Meenam (Pisces)', nameHi: 'मीन (Pisces)', lordGraha: Graha.GURU, lordTa: 'குரு', lordEn: 'Jupiter', lordHi: 'गुरु', symbolEmoji: '♓' }
};

export const GRAHA_INFO: Record<Graha, {
  nameTa: string;
  nameEn: string;
  nameHi: string;
  shortTa: string;
  shortEn: string;
  shortHi: string;
  planetKey: string;
}> = {
  [Graha.SURYA]: { nameTa: 'சூரியன் (Surya)', nameEn: 'Sun (Surya)', nameHi: 'सूर्य (Surya)', shortTa: 'சூரி', shortEn: 'Su', shortHi: 'सूर्य', planetKey: 'SUN' },
  [Graha.CHANDRA]: { nameTa: 'சந்திரன் (Chandra)', nameEn: 'Moon (Chandra)', nameHi: 'चंद्र (Chandra)', shortTa: 'சந்', shortEn: 'Mo', shortHi: 'चंद्र', planetKey: 'MOON' },
  [Graha.CHEVVAI]: { nameTa: 'செவ்வாய் (Chevvai)', nameEn: 'Mars (Mangal)', nameHi: 'मंगल (Mangal)', shortTa: 'செவ்', shortEn: 'Ma', shortHi: 'मंगल', planetKey: 'MARS' },
  [Graha.BUDHA]: { nameTa: 'புதன் (Budha)', nameEn: 'Mercury (Budha)', nameHi: 'बुध (Budha)', shortTa: 'புத', shortEn: 'Me', shortHi: 'बुध', planetKey: 'MERCURY' },
  [Graha.GURU]: { nameTa: 'குரு (Guru)', nameEn: 'Jupiter (Guru)', nameHi: 'गुरु (Guru)', shortTa: 'குரு', shortEn: 'Ju', shortHi: 'गुरु', planetKey: 'JUPITER' },
  [Graha.SUKRA]: { nameTa: 'சுக்கிரன் (Sukra)', nameEn: 'Venus (Shukra)', nameHi: 'शुक्र (Shukra)', shortTa: 'சுக்', shortEn: 'Ve', shortHi: 'शुक्र', planetKey: 'VENUS' },
  [Graha.SANI]: { nameTa: 'சனி (Sani)', nameEn: 'Saturn (Shani)', nameHi: 'शनि (Shani)', shortTa: 'சனி', shortEn: 'Sa', shortHi: 'शनि', planetKey: 'SATURN' },
  [Graha.RAHU]: { nameTa: 'ராகு (Rahu)', nameEn: 'Rahu (North Node)', nameHi: 'राहु (Rahu)', shortTa: 'ராகு', shortEn: 'Ra', shortHi: 'राहु', planetKey: 'RAHU' },
  [Graha.KETU]: { nameTa: 'கேது (Ketu)', nameEn: 'Ketu (South Node)', nameHi: 'केतु (Ketu)', shortTa: 'கேது', shortEn: 'Ke', shortHi: 'केतु', planetKey: 'KETU' }
};

export const YOGA_NAMES_EN = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva',
  'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla',
  'Brahma', 'Indra', 'Vaidhriti'
];

export const YOGA_NAMES_TA = [
  'விஷ்கம்பம்', 'ப்ரீதி', 'ஆயுஷ்மான்', 'சௌபாக்யம்', 'சோபனம்', 'அதிகண்டம்',
  'சுகர்மம்', 'திருதி', 'சூலம்', 'கண்டம்', 'விருத்தி', 'துருவம்',
  'வியாகாதம்', 'ஹர்ஷணம்', 'வஜ்ரம்', 'அசித்தி', 'வியதீபாதம்', 'வரீயான்',
  'பரிகம்', 'சிவம்', 'சித்தம்', 'சாத்தியம்', 'சுபம்', 'சுப்ரம்',
  'பிராமியம்', 'ஐந்திரம்', 'வைதிருதி'
];

export const YOGA_NAMES_HI = [
  'विष्कुंभ', 'प्रीति', 'आयुष्मान', 'सौभाग्य', 'शोभन', 'अतिगंड',
  'सुकर्मा', 'धृति', 'शूल', 'गंड', 'वृद्धि', 'ध्रुव',
  'व्याघात', 'हर्षण', 'वज्र', 'सिद्धि', 'व्यतीपात', 'वरीयान',
  'परिघ', 'शिव', 'सिद्ध', 'साध्य', 'शुभ', 'शुक्ल',
  'ब्रह्म', 'इन्द्र', 'वैधृति'
];

export const KARANA_NAMES_EN = [
  'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti (Bhadra)',
  'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'
];

export const KARANA_NAMES_TA = [
  'பவ', 'பாலவ', 'கௌலவ', 'சைத்துலை', 'கரசை', 'வணிசை', 'பத்திரை (விஷ்டி)',
  'சகுனி', 'சதுஷ்பாதம்', 'நாகவம்', 'கிமிஸ்துக்னம்'
];

export const KARANA_NAMES_HI = [
  'बव', 'बालव', 'कौलव', 'तैतिल', 'गर', 'वणिज', 'विष्टि (भद्रा)',
  'शकुनि', 'चतुष्पद', 'नाग', 'किंस्तुघ्न'
];

export function normalizeDeg(deg: number): number {
  let d = deg % 360.0;
  if (d < 0) d += 360.0;
  return d;
}

export function normalizeDelta(deg: number): number {
  let d = deg % 360.0;
  if (d > 180.0) d -= 360.0;
  if (d < -180.0) d += 360.0;
  return d;
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180.0;
}

export function radToDeg(r: number): number {
  return (r * 180.0) / Math.PI;
}

/**
 * Ayanamsa (Chitra Paksha / Lahiri) used by every chart this engine produces.
 *
 * The implementation lives in ./ayanamsa.ts and is a port of the PHP engine's
 * `AstroEngine::lahiriAyanamsa()`: IAU 2006 general precession for the mean
 * value plus the IAU 1980 63-term Δψ for the TRUE value. Both stacks default to
 * TRUE (the Drik Panchang / `swe_get_ayanamsa_ex_ut()` convention) so a Node
 * preview and a PHP-rendered PDF are computed from the same ayanamsa.
 *
 * The old two-term polynomial returned the MEAN ayanamsa, which put every
 * sidereal longitude and the Lagna up to 18.44″ away from the PHP engine.
 */
import {
  LAHIRI_AYANAMSA_J2000,
  ayanamsaMode,
  calculateLahiriAyanamsa,
  julianCenturiesTT,
  julianDayTT,
  lahiriAyanamsaForJulianDayUT,
  lahiriAyanamsaMean,
  lahiriAyanamsaTrue,
  meanObliquity,
  nutation1980,
  trueObliquity,
  type AyanamsaMode
} from './ayanamsa.js';

import { logAyanamsa } from './ayanamsa.js';
import {
  computePlanetDignity,
  debilitationSign,
  dignityCardLine,
  houseFromSign,
  SIGN_LORDS
} from './dignity.js';

export {
  LAHIRI_AYANAMSA_J2000,
  ayanamsaMode,
  calculateLahiriAyanamsa,
  julianCenturiesTT,
  julianDayTT,
  lahiriAyanamsaForJulianDayUT,
  lahiriAyanamsaMean,
  lahiriAyanamsaTrue,
  meanObliquity,
  nutation1980,
  trueObliquity,
  type AyanamsaMode
};

/**
 * High-precision Sidereal Ascendant (Lagna)
 * Computes exact Local Sidereal Time and intersection of eastern horizon with the ecliptic.
 * Correct quadrant formula: y = cos(RAMC), x = -[sin(RAMC)*cos(eps) + tan(lat)*sin(eps)]
 */
export function calculateSiderealAscendant(
  time: Astronomy.AstroTime,
  latDeg: number,
  lonDeg: number,
  ayanamsa: number
): { ascTropical: number; lagnaSidereal: number } {
  // Greenwich Mean Sidereal Time in degrees
  const gmstHours = Astronomy.SiderealTime(time);
  const gmstDeg = normalizeDeg(gmstHours * 15.0);
  const lstDeg = normalizeDeg(gmstDeg + lonDeg); // Local Sidereal Time / RAMC

  const ramcRad = degToRad(lstDeg);
  const latRad = degToRad(latDeg);

  // True obliquity of the ecliptic
  const tilt = Astronomy.e_tilt(time);
  const epsRad = degToRad(tilt.tobl);

  const y = Math.cos(ramcRad);
  const x = -(Math.sin(ramcRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad));
  const ascTropical = normalizeDeg(radToDeg(Math.atan2(y, x)));
  const lagnaSidereal = normalizeDeg(ascTropical - ayanamsa);

  return { ascTropical, lagnaSidereal };
}

/**
 * Geocentric osculating ascending lunar node (Rahu), in tropical longitude.
 *
 * The five-term "true node" correction to the mean node is useful as a quick
 * approximation, but it is not the osculating node: the latter is the
 * intersection of the Moon's instantaneous orbital plane with the ecliptic.
 * Derive that plane directly from Astronomy Engine's geocentric lunar state
 * vector, then rotate both vectors into the same true ecliptic-of-date frame.
 */
export function calculateTrueLunarNode(jd: number): number {
  if (!Number.isFinite(jd)) {
    throw new RangeError('calculateTrueLunarNode requires a finite Julian Date.');
  }

  const time = Astronomy.MakeTime(jd - 2451545.0);
  const moon = Astronomy.GeoMoonState(time);
  const position = Astronomy.Ecliptic(new Astronomy.Vector(moon.x, moon.y, moon.z, time)).vec;
  const velocity = Astronomy.Ecliptic(new Astronomy.Vector(moon.vx, moon.vy, moon.vz, time)).vec;

  // h = r × v is the lunar orbit's angular-momentum vector. The ascending
  // node direction is k × h = (-h_y, h_x, 0), where k is ecliptic north.
  const hX = position.y * velocity.z - position.z * velocity.y;
  const hY = position.z * velocity.x - position.x * velocity.z;
  const nodeX = -hY;
  const nodeY = hX;
  if (!Number.isFinite(nodeX) || !Number.isFinite(nodeY) || Math.hypot(nodeX, nodeY) < 1e-20) {
    throw new Error('Astronomy Engine returned an invalid lunar state for the true node calculation.');
  }

  return normalizeDeg(radToDeg(Math.atan2(nodeY, nodeX)));
}

/**
 * Mean ascending node of the lunar orbit (Meeus, Astronomical Algorithms 47.7),
 * tropical longitude of date in degrees.
 *
 * This mirrors `AstroEngine::meanLunarNode()` in api/astrology/engine.php
 * value-for-value, so MEAN-node charts agree across the two stacks.
 */
export function calculateMeanLunarNode(jd: number): number {
  if (!Number.isFinite(jd)) {
    throw new RangeError('calculateMeanLunarNode requires a finite Julian Date.');
  }
  const T = julianCenturiesTT(jd);
  return normalizeDeg(
    125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T ** 3) / 467441.0 - (T ** 4) / 60616000.0
  );
}

/**
 * Calculates high-precision sidereal positions of all 9 Grahas using Astronomy Engine (VSOP87/ELP2000)
 *
 * `nodeType` selects the Rahu/Ketu convention (see RAHU_NODE_TYPE); the seven
 * classical grahas are identical either way and their longitudes never depend
 * on this switch.
 */
export function calculateAllGrahaPositions(
  time: Astronomy.AstroTime,
  jd: number,
  ayanamsa: number,
  nodeType: RahuNodeType = rahuNodeType()
): {
  siderealLongitudes: Record<Graha, number>;
  tropicalLongitudes: Record<Graha, number>;
  tropicalLatitudes: Record<Graha, number>;
  retrogrades: Record<Graha, boolean>;
} {
  // Planetary bodies
  const bodyMap: Array<{ graha: Graha; body: Astronomy.Body }> = [
    { graha: Graha.SURYA, body: Astronomy.Body.Sun },
    { graha: Graha.CHANDRA, body: Astronomy.Body.Moon },
    { graha: Graha.BUDHA, body: Astronomy.Body.Mercury },
    { graha: Graha.SUKRA, body: Astronomy.Body.Venus },
    { graha: Graha.CHEVVAI, body: Astronomy.Body.Mars },
    { graha: Graha.GURU, body: Astronomy.Body.Jupiter },
    { graha: Graha.SANI, body: Astronomy.Body.Saturn }
  ];

  const siderealLongitudes = {} as Record<Graha, number>;
  const tropicalLongitudes = {} as Record<Graha, number>;
  const tropicalLatitudes = {} as Record<Graha, number>;
  const retrogrades = {} as Record<Graha, boolean>;

  // Compute for t
  for (const item of bodyMap) {
    const geo = Astronomy.GeoVector(item.body, time, true);
    const ecl = Astronomy.Ecliptic(geo);
    const trop = normalizeDeg(ecl.elon);
    const sid = normalizeDeg(trop - ayanamsa);
    tropicalLatitudes[item.graha] = ecl.elat;
    tropicalLongitudes[item.graha] = trop;
    siderealLongitudes[item.graha] = sid;
  }

  // Lunar Nodes: the configured convention produces Rahu; Ketu is always
  // exactly 180° away.
  //
  // Frame note: the osculating TRUE node is derived in the apparent
  // (true-equinox) frame, so the true ayanamsa converts it to sidereal. The
  // Meeus MEAN node is referred to the MEAN equinox of date, so it must be
  // converted with the MEAN ayanamsa — exactly the pairing
  // `AstroEngine::computeGeocentricPositions()` uses in PHP, which is what
  // keeps MEAN-node charts identical across the two stacks (and within a few
  // arcseconds of Swiss Ephemeris SE_MEAN_NODE).
  const resolvedNodeType: RahuNodeType = nodeType === 'MEAN' ? 'MEAN' : 'TRUE';
  let rahuSid: number;
  let rahuTrop: number;
  if (resolvedNodeType === 'MEAN') {
    const meanEquinoxNode = calculateMeanLunarNode(jd);
    const ayanamsaMean = lahiriAyanamsaMean(julianCenturiesTT(jd));
    rahuSid = normalizeDeg(meanEquinoxNode - ayanamsaMean);
    rahuTrop = normalizeDeg(rahuSid + ayanamsa);
  } else {
    rahuTrop = calculateTrueLunarNode(jd);
    rahuSid = normalizeDeg(rahuTrop - ayanamsa);
  }
  const ketuSid = normalizeDeg(rahuSid + 180.0);

  tropicalLongitudes[Graha.RAHU] = rahuTrop;
  tropicalLongitudes[Graha.KETU] = normalizeDeg(rahuTrop + 180.0);
  tropicalLatitudes[Graha.RAHU] = 0.0;
  tropicalLatitudes[Graha.KETU] = 0.0;
  siderealLongitudes[Graha.RAHU] = rahuSid;
  siderealLongitudes[Graha.KETU] = ketuSid;

  // Retrograde evaluation: centered two-sided difference over +-0.5 day.
  // A very short window (minutes) is numerically unstable for slow outer
  // planets near station (daily motion of Saturn is only ~0.03 deg/day),
  // while a centered +-0.5d window keeps birth-moment accuracy and a robust sign.
  const halfDay = 0.5;
  const timePlus = time.AddDays(halfDay);
  const timeMinus = time.AddDays(-halfDay);
  const jdPlus = jd + halfDay;
  const jdMinus = jd - halfDay;
  const ayanamsaPlus = calculateLahiriAyanamsa(jdPlus);
  const ayanamsaMinus = calculateLahiriAyanamsa(jdMinus);

  for (const item of bodyMap) {
    if (item.graha === Graha.SURYA || item.graha === Graha.CHANDRA) {
      retrogrades[item.graha] = false;
      continue;
    }
    const geoPlus = Astronomy.GeoVector(item.body, timePlus, true);
    const eclPlus = Astronomy.Ecliptic(geoPlus);
    const tropPlus = normalizeDeg(eclPlus.elon);
    const sidPlus = normalizeDeg(tropPlus - ayanamsaPlus);
    const geoMinus = Astronomy.GeoVector(item.body, timeMinus, true);
    const eclMinus = Astronomy.Ecliptic(geoMinus);
    const tropMinus = normalizeDeg(eclMinus.elon);
    const sidMinus = normalizeDeg(tropMinus - ayanamsaMinus);
    const delta = normalizeDelta(sidPlus - sidMinus);
    retrogrades[item.graha] = delta < 0;
  }

  retrogrades[Graha.RAHU] = true; // Lunar nodes are traditionally retrograde
  retrogrades[Graha.KETU] = true;

  return { siderealLongitudes, tropicalLongitudes, tropicalLatitudes, retrogrades };
}

export function getCombustionLimit(graha: Graha): number {
  switch (graha) {
    case Graha.CHANDRA: return 12.0;
    case Graha.CHEVVAI: return 17.0;
    case Graha.BUDHA: return 14.0;
    case Graha.GURU: return 11.0;
    case Graha.SUKRA: return 10.0;
    case Graha.SANI: return 15.0;
    default: return 0.0;
  }
}

export function getBhavaDetails(bhavaNum: number): {
  nameTa: string; nameEn: string; nameHi: string;
  sigTa: string; sigEn: string; sigHi: string;
} {
  switch (bhavaNum) {
    case 1:
      return {
        nameTa: 'தனு பாவம் (1st House)', nameEn: '1st Bhava - Self, Personality & Physical Vitality', nameHi: 'तनु भाव - लग्न एवं व्यक्तित्व',
        sigTa: 'உடல் ஆரோக்கியம், தோற்றம், சுயம், கீர்த்தி மற்றும் ஆயுள்.', sigEn: 'Physical vitality, personality, character, and longevity.', sigHi: 'शारीरिक स्वास्थ्य, आभा और जीवन ऊर्जा।'
      };
    case 2:
      return {
        nameTa: 'தன பாவம் (2nd House)', nameEn: '2nd Bhava - Wealth, Family & Speech', nameHi: 'धन भाव - संपत्ति एवं वाणी',
        sigTa: 'செல்வம், குடும்பம், வாக்கு வன்மை, ஆரம்பக் கல்வி, கண் பார்வை.', sigEn: 'Financial liquidity, family harmony, eloquence of speech, and assets.', sigHi: 'धन संचय, पारिवारिक सुख एवं वाणी प्रभाव।'
      };
    case 3:
      return {
        nameTa: 'சகஜ பாவம் (3rd House)', nameEn: '3rd Bhava - Siblings, Courage & Initiative', nameHi: 'सहज भाव - पराक्रम एवं भ्रातृ',
        sigTa: 'தைரியம், இளைய சகோதரர், முயற்சிகள், தகவல் தொடர்பு.', sigEn: 'Courage, younger siblings, communications, and self-efforts.', sigHi: 'साहस, छोटे भाई-बहन और संकल्प शक्ति।'
      };
    case 4:
      return {
        nameTa: 'சுக பாவம் (4th House)', nameEn: '4th Bhava - Mother, Comforts & Property', nameHi: 'सुख भाव - मातृ एवं वाहन',
        sigTa: 'தாய், பூமி, வீடு, வாகனம், கல்வி மற்றும் சுகவாழ்வு.', sigEn: 'Mother, real estate, landed properties, conveyances, and happiness.', sigHi: 'माता, अचल संपत्ति, वाहन सुख और आंतरिक शांति।'
      };
    case 5:
      return {
        nameTa: 'புத்திர பாவம் (5th House)', nameEn: '5th Bhava - Intellect, Progeny & Past Merits', nameHi: 'पुत्र भाव - संतान एवं बुद्धि',
        sigTa: 'புத்தி கூர்மை, குழந்தைகள், பூர்வ புண்ணியம், கலை ஞானம்.', sigEn: 'Children, analytical intellect, creativity, and past life merits (Purva Punya).', sigHi: 'संतान सुख, तीव्र बुद्धि और पूर्व जन्म के पुण्य।'
      };
    case 6:
      return {
        nameTa: 'சத்ரு பாவம் (6th House)', nameEn: '6th Bhava - Health, Rivals & Debts', nameHi: 'शत्रु भाव - रोग, ऋण एवं प्रतियोगिता',
        sigTa: 'ஆரோக்கியம், கடன் நிவாரணம், போட்டி மற்றும் உழைப்பு.', sigEn: 'Health challenges, overcoming adversaries, debt management, and daily service.', sigHi: 'प्रतिस्पर्धा विजय, स्वास्थ्य सुरक्षा और ऋण मुक्ति।'
      };
    case 7:
      return {
        nameTa: 'களத்திர பாவம் (7th House)', nameEn: '7th Bhava - Spouse, Marriage & Partnerships', nameHi: 'कलत्र भाव - जीवनसाथी एवं साझेदारी',
        sigTa: 'வாழ்க்கைத் துணை, திருமணம், கூட்டுத் தொழில் மற்றும் சமூக உறவுகள்.', sigEn: 'Life partner, marital harmony, business partnerships, and diplomacy.', sigHi: 'वैवाहिक सुख, जीवनसाथी और व्यापारिक साझेदारी।'
      };
    case 8:
      return {
        nameTa: 'ஆயுள் பாவம் (8th House)', nameEn: '8th Bhava - Longevity, Transformation & Occult', nameHi: 'आयु भाव - दीर्घायु एवं गूढ़ ज्ञान',
        sigTa: 'ஆயுள், திடீர் திருப்பங்கள், ஆன்மீக ஞானம், ஆராய்ச்சி அறிவு.', sigEn: 'Longevity, unforeseen transformations, hidden wealth, and spiritual depth.', sigHi: 'आयु, रहस्यमयी अनुभव और गहन आध्यात्मिक अंतर्दृष्टि।'
      };
    case 9:
      return {
        nameTa: 'பாக்ய பாவம் (9th House)', nameEn: '9th Bhava - Fortune, Dharma & Higher Knowledge', nameHi: 'भाग्य भाव - धर्म एवं भाग्य',
        sigTa: 'தந்தை, குரு ஆசி, அதிர்ஷ்டம், ஆன்மீக யாத்திரைகள், உயர்கல்வி.', sigEn: 'Father, spiritual mentor (Guru), fortune, philanthropy, and pilgrimages.', sigHi: 'पिता का आशीर्वाद, भाग्योदय और आध्यात्मिक प्रगति।'
      };
    case 10:
      return {
        nameTa: 'கர்ம பாவம் (10th House)', nameEn: '10th Bhava - Profession, Status & Achievements', nameHi: 'कर्म भाव - व्यवसाय एवं प्रतिष्ठा',
        sigTa: 'தொழில், பதவி, சமூக அந்தஸ்து, தலைமைத்துவம் மற்றும் வெற்றி.', sigEn: 'Career, executive governance, reputation, status, and life accomplishments.', sigHi: 'कार्यक्षेत्र में उन्नति, पद-प्रतिष्ठा और व्यावसायिक सफलता।'
      };
    case 11:
      return {
        nameTa: 'லாப பாவம் (11th House)', nameEn: '11th Bhava - Gains, Aspirations & Social Circle', nameHi: 'लाभ भाव - आय एवं आकांक्षाएं',
        sigTa: 'வருமான பெருக்கம், விருப்பங்கள் நிறைவேறுதல், மூத்த சகோதரர்.', sigEn: 'Financial gains, fulfilled ambitions, wide influential networks, and prosperity.', sigHi: 'आर्थिक लाभ, मनोकामना पूर्ति और मित्रों का सहयोग।'
      };
    default:
      return {
        nameTa: 'விரய பாவம் (12th House)', nameEn: '12th Bhava - Expenses, Foreign Lands & Moksha', nameHi: 'व्यय भाव - विदेश गमन एवं मोक्ष',
        sigTa: 'சுப விரயங்கள், வெளிநாட்டுப் பயணம், தூக்கம் மற்றும் மோக்ஷ ஞானம்.', sigEn: 'Auspicious expenditures, foreign travels, sound sleep, and spiritual liberation (Moksha).', sigHi: 'शुभ व्यय, विदेश यात्रा और मोक्ष मार्ग।'
      };
  }
}

/** A birth balance is not the start or full length of its enclosing Mahadasha. */
export interface VimshottariDashaPeriod extends DashaPeriod {
  periodKind: 'BIRTH_BALANCE' | 'FULL_MAHADASHA';
  fullStartDate: string;
  fullYears: number;
}

/**
 * Calculates complete 120-year Vimshottari Mahadasha and Antardasha timeline
 * and identifies the exact active Mahadasha and Antardasha for the native today.
 */
export function calculateVimshottariDashaTimeline(
  nakshatraIdx: number,
  posInNak: number,
  nakSpan: number,
  dobDate: Date,
  asOfDate: Date = new Date(),
  timeZoneId?: string
): {
  periods: VimshottariDashaPeriod[];
  currentDasha: CurrentDashaInfo;
} {
  const dashaOrder: Graha[] = [
    Graha.KETU, Graha.SUKRA, Graha.SURYA, Graha.CHANDRA,
    Graha.CHEVVAI, Graha.RAHU, Graha.GURU, Graha.SANI, Graha.BUDHA
  ];

  const dashaYears: Record<Graha, number> = {
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

  const startingLord = NAKSHATRA_LORDS[nakshatraIdx % 27];
  const startLordIdx = dashaOrder.indexOf(startingLord);
  const totalYears = dashaYears[startingLord];
  const elapsedFraction = Math.max(0, Math.min(1, posInNak / nakSpan));
  const remainingYears = totalYears * (1.0 - elapsedFraction);

  const remYearsInt = Math.floor(remainingYears);
  const remMonthsInt = Math.floor((remainingYears - remYearsInt) * 12);
  const balanceAtBirth = `${remYearsInt} Years ${remMonthsInt} Months`;

  const periods: VimshottariDashaPeriod[] = [];
  const mahaRanges: Array<{ period: DashaPeriod; start: Date; end: Date }> = [];
  const antardashaRanges = new Map<DashaPeriod, Array<{ period: AntardashaPeriod; start: Date; end: Date }>>();
  const DAY_MS = 86400000;
  const YEAR_DAYS = 365.25;
  const displayDate = (value: Date): string =>
    (timeZoneId ? getLocalDateKey(value, timeZoneId) : null) ?? value.toISOString().split('T')[0];

  let currentStart = dobDate;

  // Helper to build Antardashas for a Mahadasha
  const buildAntardashas = (
    mahaLord: Graha,
    mStart: Date,
    mYears: number,
    isFirstMaha = false,
    rangeCollector?: Array<{ period: AntardashaPeriod; start: Date; end: Date }>,
    // Exact end instant of the enclosing Mahadasha. Each Antardasha duration is
    // rounded to whole days, so the nine rounded spans can fall a few days
    // short of the Mahadasha they belong to. Anchoring the ninth Antardasha to
    // the Mahadasha's end keeps the timeline gap-free, so a date in the final
    // days of a Mahadasha reports that Antardasha instead of falling back to
    // the first one.
    mahaEndMs?: number
  ): AntardashaPeriod[] => {
    const antarList: AntardashaPeriod[] = [];
    const mIdx = dashaOrder.indexOf(mahaLord);
    let aStart = mStart;

    for (let j = 0; j < 9; j++) {
      const aLord = dashaOrder[(mIdx + j) % 9];
      const aLordYears = dashaYears[aLord];
      // Classical formula: (mahaYears * antarYears) / 120
      const durationYears = (dashaYears[mahaLord] * aLordYears) / 120.0;
      const durationMonths = Number((durationYears * 12).toFixed(1));
      const durDays = Math.round(durationYears * YEAR_DAYS);
      const isLastAntardasha = j === 8;
      const aEnd = isLastAntardasha && mahaEndMs !== undefined && mahaEndMs > aStart.getTime()
        ? new Date(mahaEndMs)
        : new Date(aStart.getTime() + durDays * DAY_MS);

      const aInfo = GRAHA_INFO[aLord];
      const antardasha: AntardashaPeriod = {
        lord: aLord,
        lordNameTa: aInfo.nameTa,
        lordNameEn: aInfo.nameEn,
        lordNameHi: aInfo.nameHi,
        startDate: displayDate(aStart),
        endDate: displayDate(aEnd),
        months: durationMonths
      };
      antarList.push(antardasha);
      rangeCollector?.push({ period: antardasha, start: aStart, end: aEnd });
      aStart = aEnd;
    }

    if (isFirstMaha) {
      // Retain all 9 Antardashas for the birth Mahadasha for complete classical reference
      return antarList;
    }

    return antarList;
  };

  // 1st Mahadasha: Balance at birth
  const firstDays = Math.round(remainingYears * YEAR_DAYS);
  const firstEnd = new Date(dobDate.getTime() + firstDays * DAY_MS);
  const startLordInfo = GRAHA_INFO[startingLord];

  const firstAntardashaRanges: Array<{ period: AntardashaPeriod; start: Date; end: Date }> = [];
  const firstAntardashas = buildAntardashas(
    startingLord,
    new Date(dobDate.getTime() - (totalYears - remainingYears) * YEAR_DAYS * DAY_MS),
    totalYears,
    true,
    firstAntardashaRanges,
    firstEnd.getTime()
  );

  const fullStartDate = firstAntardashas[0].startDate;
  const firstPeriod: VimshottariDashaPeriod = {
    mahadashaLord: startingLord,
    lordNameTa: startLordInfo.nameTa,
    lordNameEn: startLordInfo.nameEn,
    lordNameHi: startLordInfo.nameHi,
    startDate: displayDate(dobDate),
    endDate: displayDate(firstEnd),
    years: Number(remainingYears.toFixed(1)),
    periodKind: 'BIRTH_BALANCE',
    fullStartDate,
    fullYears: totalYears,
    descriptionTa: `${startLordInfo.nameTa} மகாதிசை பிறப்பிலிருந்து இருப்பு: ${remYearsInt} வருடங்கள் ${remMonthsInt} மாதங்கள். முழு மகாதிசை தொடக்கம்: ${fullStartDate}; பிறப்புக்கு முந்தைய புக்திகளும் குறிப்புக்காகக் காட்டப்படுகின்றன.`,
    descriptionEn: `${startLordInfo.nameEn} Mahadasha Balance from birth: ${balanceAtBirth}. Full Mahadasha began ${fullStartDate}; pre-birth Antardashas are shown for reference.`,
    descriptionHi: `${startLordInfo.nameHi} महादशा का जन्म से शेष: ${remYearsInt} वर्ष ${remMonthsInt} महीने। पूरी महादशा का आरंभ: ${fullStartDate}; जन्म से पहले की अंतर्दशाएं संदर्भ के लिए दिखाई गई हैं।`,
    antardashas: firstAntardashas
  };
  periods.push(firstPeriod);
  mahaRanges.push({ period: firstPeriod, start: dobDate, end: firstEnd });
  antardashaRanges.set(firstPeriod, firstAntardashaRanges);

  currentStart = firstEnd;

  // Complete the 9 Mahadasha cycle (120 years total)
  for (let i = 1; i <= 8; i++) {
    const lord = dashaOrder[(startLordIdx + i) % 9];
    const years = dashaYears[lord];
    const currentEnd = new Date(currentStart.getTime() + years * YEAR_DAYS * DAY_MS);
    const lordInfo = GRAHA_INFO[lord];
    const currentAntardashaRanges: Array<{ period: AntardashaPeriod; start: Date; end: Date }> = [];
    const antardashas = buildAntardashas(lord, currentStart, years, false, currentAntardashaRanges, currentEnd.getTime());
    const period: VimshottariDashaPeriod = {
      mahadashaLord: lord,
      lordNameTa: lordInfo.nameTa,
      lordNameEn: lordInfo.nameEn,
      lordNameHi: lordInfo.nameHi,
      startDate: displayDate(currentStart),
      endDate: displayDate(currentEnd),
      years,
      periodKind: 'FULL_MAHADASHA',
      fullStartDate: displayDate(currentStart),
      fullYears: years,
      descriptionTa: `${lordInfo.nameTa} மகாதிசை (${years} வருடங்கள்)`,
      descriptionEn: `${lordInfo.nameEn} Mahadasha (${years} Years)`,
      descriptionHi: `${lordInfo.nameHi} महादशा (${years} वर्ष)`,
      antardashas
    };
    periods.push(period);
    mahaRanges.push({ period, start: currentStart, end: currentEnd });
    antardashaRanges.set(period, currentAntardashaRanges);
    currentStart = currentEnd;
  }

  // Determine active periods from their exact instants rather than UTC-midnight
  // parses of date-only display strings. This preserves the birth-time offset
  // and avoids switching dasha early/late on a displayed boundary date.
  const asOfTime = asOfDate.getTime();
  let currentMaha: DashaPeriod = periods[0];
  for (const range of mahaRanges) {
    if (asOfTime >= range.start.getTime() && asOfTime < range.end.getTime()) {
      currentMaha = range.period;
      range.period.isCurrent = true;
      break;
    }
  }

  let currentAntar: AntardashaPeriod = currentMaha.antardashas?.[0] || {
    lord: currentMaha.mahadashaLord,
    lordNameTa: currentMaha.lordNameTa,
    lordNameEn: currentMaha.lordNameEn,
    lordNameHi: currentMaha.lordNameHi,
    startDate: currentMaha.startDate,
    endDate: currentMaha.endDate,
    months: 12
  };

  if (currentMaha.antardashas) {
    for (const range of antardashaRanges.get(currentMaha) || []) {
      if (asOfTime >= range.start.getTime() && asOfTime < range.end.getTime()) {
        currentAntar = range.period;
        range.period.isCurrent = true;
        break;
      }
    }
  }

  // Next Mahadasha and the "begins on <date>" notice (item 4).
  // The notice is ALWAYS emitted when the change lands inside the next 12 months.
  const nextMahaRange = mahaRanges.find(range => range.start.getTime() > asOfTime);
  const nextMahaMonths = nextMahaRange
    ? Number(((nextMahaRange.start.getTime() - asOfTime) / (30.44 * 86400000)).toFixed(1))
    : null;
  const nextMahaLord = nextMahaRange ? nextMahaRange.period.mahadashaLord : null;
  const nextMahaInfo = nextMahaRange && nextMahaLord
    ? {
        lord: nextMahaLord,
        lordNameEn: nextMahaRange.period.lordNameEn,
        lordNameTa: nextMahaRange.period.lordNameTa,
        lordNameHi: nextMahaRange.period.lordNameHi,
        beginsOn: displayDate(nextMahaRange.start),
        monthsAhead: nextMahaMonths ?? 0,
        within12Months: (nextMahaMonths ?? 999) <= 12
      }
    : null;
  const changeNoticeEn = nextMahaInfo && nextMahaInfo.within12Months
    ? `${nextMahaInfo.lordNameEn} Mahadasa begins on ${nextMahaInfo.beginsOn} (about ${nextMahaInfo.monthsAhead} months from now).`
    : '';
  const changeNoticeTa = nextMahaInfo && nextMahaInfo.within12Months
    ? `${nextMahaInfo.lordNameTa} மகாதிசை ${nextMahaInfo.beginsOn} அன்று தொடங்குகிறது (இன்னும் சுமார் ${nextMahaInfo.monthsAhead} மாதங்கள்).`
    : '';
  const changeNoticeHi = nextMahaInfo && nextMahaInfo.within12Months
    ? `${nextMahaInfo.lordNameHi} महादशा ${nextMahaInfo.beginsOn} को आरंभ होगी (लगभग ${nextMahaInfo.monthsAhead} माह में)।`
    : '';

  const currentDasha: CurrentDashaInfo = {
    mahadashaLord: currentMaha.mahadashaLord,
    mahadashaLordEn: currentMaha.lordNameEn,
    mahadashaLordTa: currentMaha.lordNameTa,
    mahadashaLordHi: currentMaha.lordNameHi,
    mahadashaStart: currentMaha.startDate,
    mahadashaEnd: currentMaha.endDate,
    antardashaLord: currentAntar.lord,
    antardashaLordEn: currentAntar.lordNameEn,
    antardashaLordTa: currentAntar.lordNameTa,
    antardashaLordHi: currentAntar.lordNameHi,
    antardashaStart: currentAntar.startDate,
    antardashaEnd: currentAntar.endDate,
    balanceAtBirth,
    nextMahadasa: nextMahaInfo ?? undefined,
    mahadashaChangeNoticeEn: changeNoticeEn,
    mahadashaChangeNoticeTa: changeNoticeTa,
    mahadashaChangeNoticeHi: changeNoticeHi
  };

  return { periods, currentDasha };
}

/**
 * Precision Horoscope Calculation (Thirukanitha Sidereal Jyotish)
 */
export function calculatePrecisionHoroscope(
  name: string,
  dob: string, // YYYY-MM-DD
  tob: string, // HH:mm
  birthPlace: string,
  latitude: number,
  longitude: number,
  timezoneOffsetHours: number,
  country = '',
  gender = 'M'
): HoroscopeResult {
  if (!birthPlace || !birthPlace.trim()) {
    throw new Error(`calculatePrecisionHoroscope: a verified birth place is required for "${name}".`);
  }

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    !Number.isFinite(timezoneOffsetHours) || timezoneOffsetHours < -14 || timezoneOffsetHours > 14
  ) {
    throw new Error(
      `calculatePrecisionHoroscope: missing or invalid latitude/longitude/timezoneOffsetHours for "${name}" ` +
      `(birthPlace: "${birthPlace}"). Coordinates must be captured.`
    );
  }

  const birthDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const birthTimeMatch = /^(\d{2}):(\d{2})$/.exec(tob);
  if (!birthDateMatch || !birthTimeMatch) {
    throw new Error(`calculatePrecisionHoroscope: invalid birth date/time for "${name}"`);
  }

  const year = Number(birthDateMatch[1]);
  const month = Number(birthDateMatch[2]);
  const day = Number(birthDateMatch[3]);
  const hour = Number(birthTimeMatch[1]);
  const minute = Number(birthTimeMatch[2]);
  const localCalendarCheck = new Date(0);
  localCalendarCheck.setUTCFullYear(year, month - 1, day);
  localCalendarCheck.setUTCHours(hour, minute, 0, 0);
  if (
    year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 ||
    localCalendarCheck.getUTCFullYear() !== year ||
    localCalendarCheck.getUTCMonth() !== month - 1 ||
    localCalendarCheck.getUTCDate() !== day
  ) {
    throw new Error(`calculatePrecisionHoroscope: out-of-range birth date/time for "${name}"`);
  }
  // Resolve the wall-clock birth time through the IANA zone for the coordinates.
  // This applies the historical standard/DST offset at the birth date; the
  // submitted numeric offset remains a fallback for unmapped coordinates.
  const timeZoneId = getTimeZoneIdForCoordinates(latitude, longitude);
  const resolvedBirthTime = timeZoneId
    ? resolveLocalDateTimeInTimeZone(dob, tob, timeZoneId)
    : null;
  if (timeZoneId && (!resolvedBirthTime || resolvedBirthTime.nonexistent || resolvedBirthTime.ambiguous)) {
    throw new Error(`calculatePrecisionHoroscope: birth time is ambiguous or does not exist in the selected time zone for "${name}".`);
  }
  if (!hasValidBirthDetails({ dob, tob, birthPlace, latitude, longitude, timezoneOffsetHours })) {
    throw new Error(`calculatePrecisionHoroscope: birth particulars must resolve to a valid past local instant for "${name}".`);
  }
  const effectiveTimezoneOffsetHours = resolvedBirthTime?.offsetHours ?? timezoneOffsetHours;
  const localDateMs = Date.UTC(year, month - 1, day, hour, minute);
  const utcDate = resolvedBirthTime?.utcDate ?? new Date(
    localDateMs - Math.round(effectiveTimezoneOffsetHours * 60) * 60000
  );

  const time = Astronomy.MakeTime(utcDate);
  const jd = time.ut + 2451545.0; // Julian Date in UT

  // High-precision Chitra Paksha (Lahiri) Ayanamsa — the ONLY value this chart
  // uses; every sidereal longitude and the Lagna subtract this number.
  const ayanamsa = calculateLahiriAyanamsa(jd);

  // Debug line (item 1): proves which ayanamsa produced this report.
  // Suppress with ASTRO_AYANAMSA_SILENT=1.
  logAyanamsa(jd, ayanamsa);

  // Exact Sidereal Ascendant (Lagna)
  const { lagnaSidereal } = calculateSiderealAscendant(time, latitude, longitude, ayanamsa);
  const lagnaRasiIdx = (Math.floor(lagnaSidereal / 30.0) % 12) + 1;
  const lagnaRasi = lagnaRasiIdx as Rasi;
  const lagnaDegrees = lagnaSidereal % 30.0;

  // Rahu/Ketu convention for THIS chart: the ASTRO_RAHU_NODE_TYPE setting,
  // MEAN by default. Resolved once and carried on the result so the report can
  // always state which node produced its Rahu/Ketu positions. The seven
  // classical grahas are unaffected by this switch.
  const nodeType = rahuNodeType();

  // Exact Grahas Sidereal Positions & Retrogrades
  const { siderealLongitudes, tropicalLatitudes, retrogrades } = calculateAllGrahaPositions(time, jd, ayanamsa, nodeType);

  const moonSid = siderealLongitudes[Graha.CHANDRA];
  const moonRasiIdx = (Math.floor(moonSid / 30.0) % 12) + 1;
  const chandraRasi = moonRasiIdx as Rasi;

  const nakSpan = 360.0 / 27.0; // 13.3333333 degrees
  const nakshatraIdx = Math.floor(moonSid / nakSpan) % 27;
  const posInNak = moonSid - nakshatraIdx * nakSpan;
  const janmaPada = Math.min(4, Math.max(1, Math.floor(posInNak / (nakSpan / 4.0)) + 1));

  // Navamsha (D9) Chart mapping for Lagna
  const lagnaPadaOverall = Math.floor(lagnaSidereal / (360.0 / 108.0)) % 108;
  const lagnaNavamsaRasiIdx = (lagnaPadaOverall % 12) + 1;
  const lagnaNavRasi = lagnaNavamsaRasiIdx as Rasi;
  const lagnaNavInfo = RASI_INFO[lagnaNavRasi];
  const isLagnaVargottama = lagnaRasi === lagnaNavRasi;


  // Whole-sign rasi of every graha — the dignity, yoga and Kendradhipati rules
  // all count whole signs, exactly like the PHP engine.
  const rasiByGraha: Record<string, number> = {};
  for (const graha of Object.values(Graha)) {
    rasiByGraha[graha] = (Math.floor(siderealLongitudes[graha] / 30.0) % 12) + 1;
  }

  // Planet Positions
  const sunLon = siderealLongitudes[Graha.SURYA];
  const planetPositions: PlanetPosition[] = Object.values(Graha).map(graha => {
    const lon = siderealLongitudes[graha];
    const rasiIdx = (Math.floor(lon / 30.0) % 12) + 1;
    const rasi = rasiIdx as Rasi;
    const degInRasi = lon % 30.0;
    const nIdx = Math.floor(lon / nakSpan) % 27;
    const pInN = lon - nIdx * nakSpan;
    const pada = Math.min(4, Math.max(1, Math.floor(pInN / (nakSpan / 4.0)) + 1));
    const bhavaNum = ((rasi - lagnaRasi + 12) % 12) + 1;

    // Navamsha (D9) mapping
    const padaOverall = Math.floor(lon / (360.0 / 108.0)) % 108;
    const navamsaRasiIdx = (padaOverall % 12) + 1;
    const navRasi = navamsaRasiIdx as Rasi;
    const navInfo = RASI_INFO[navRasi];
    const isVargottama = rasi === navRasi;

    const isCombust =
      graha !== Graha.SURYA &&
      graha !== Graha.RAHU &&
      graha !== Graha.KETU &&
      Math.abs(normalizeDelta(lon - sunLon)) < getCombustionLimit(graha);

    const rInfo = RASI_INFO[rasi];
    const gInfo = GRAHA_INFO[graha];

    const dignity = computePlanetDignity({
      graha,
      rasi: rasi as number,
      isCombust,
      isRetrograde: retrogrades[graha] || false,
      lagnaRasi: lagnaRasi as number,
      moonRasi: chandraRasi as number,
      rasiByGraha
    });

    return {
      graha,
      planetKey: gInfo.planetKey,
      nameTa: gInfo.nameTa,
      nameEn: gInfo.nameEn,
      nameHi: gInfo.nameHi,
      shortTa: gInfo.shortTa,
      shortEn: gInfo.shortEn,
      shortHi: gInfo.shortHi,
      rasi,
      rasiNumber: rasi,
      rasiNameTa: rInfo.nameTa,
      rasiNameEn: rInfo.nameEn,
      rasiNameHi: rInfo.nameHi,
      degrees: Number(degInRasi.toFixed(2)),
      totalDegrees: Number(lon.toFixed(2)),
      eclipticLatitude: Number((tropicalLatitudes[graha] ?? 0).toFixed(4)),
      dignity,
      nakshatramTa: NAKSHATRAM_NAMES_TA[nIdx],
      nakshatramEn: NAKSHATRAM_NAMES_EN[nIdx],
      nakshatramHi: NAKSHATRAM_NAMES_HI[nIdx],
      pada,
      isRetrograde: retrogrades[graha] || false,
      isCombust,
      bhavaNumber: bhavaNum,
      navamsaRasi: navRasi,
      navamsaRasiNameTa: navInfo.nameTa,
      navamsaRasiNameEn: navInfo.nameEn,
      navamsaRasiNameHi: navInfo.nameHi,
      isVargottama
    };
  });

  // 12 Bhavas
  const bhavas: BhavaDetail[] = Array.from({ length: 12 }, (_, i) => {
    const bhavaNum = i + 1;
    const rasiIdx = ((lagnaRasi - 1 + i) % 12) + 1;
    const rasi = rasiIdx as Rasi;
    const rInfo = RASI_INFO[rasi];
    const bInfo = getBhavaDetails(bhavaNum);
    const occupants = planetPositions.filter(p => p.rasi === rasi).map(p => p.graha);

    return {
      number: bhavaNum,
      nameTa: bInfo.nameTa,
      nameEn: bInfo.nameEn,
      nameHi: bInfo.nameHi,
      rasi,
      rasiNameTa: rInfo.nameTa,
      rasiNameEn: rInfo.nameEn,
      rasiNameHi: rInfo.nameHi,
      significanceTa: bInfo.sigTa,
      significanceEn: bInfo.sigEn,
      significanceHi: bInfo.sigHi,
      occupantGrahas: occupants
    };
  });


  // ---- Graha Yuddha (planetary war) — item 7a ---------------------------
  // Classical rule: two of Mars, Mercury, Jupiter, Venus or Saturn in the same
  // sign within 1° of each other are at war; the winner is the planet with the
  // northern (greater) ecliptic latitude.
  const grahaYuddha: NonNullable<HoroscopeResult['grahaYuddha']> = [];
  const yuddhaPlanets: Graha[] = [Graha.CHEVVAI, Graha.BUDHA, Graha.GURU, Graha.SUKRA, Graha.SANI];
  for (let i = 0; i < yuddhaPlanets.length; i += 1) {
    for (let k = i + 1; k < yuddhaPlanets.length; k += 1) {
      const planetA = yuddhaPlanets[i];
      const planetB = yuddhaPlanets[k];
      if (rasiByGraha[planetA] !== rasiByGraha[planetB]) continue;
      const separation = Math.abs(normalizeDelta(siderealLongitudes[planetA] - siderealLongitudes[planetB]));
      if (separation >= 1.0) continue;
      const latitudeA = tropicalLatitudes[planetA] ?? 0;
      const latitudeB = tropicalLatitudes[planetB] ?? 0;
      const winner = latitudeA >= latitudeB ? planetA : planetB;
      const loser = winner === planetA ? planetB : planetA;
      const winnerLatitude = winner === planetA ? latitudeA : latitudeB;
      const loserLatitude = winner === planetA ? latitudeB : latitudeA;
      const warSign = RASI_INFO[rasiByGraha[planetA] as Rasi];
      const separationText = separation.toFixed(2);
      grahaYuddha.push({
        planetA,
        planetB,
        planetANameEn: GRAHA_INFO[planetA].nameEn,
        planetANameTa: GRAHA_INFO[planetA].nameTa,
        planetANameHi: GRAHA_INFO[planetA].nameHi,
        planetBNameEn: GRAHA_INFO[planetB].nameEn,
        planetBNameTa: GRAHA_INFO[planetB].nameTa,
        planetBNameHi: GRAHA_INFO[planetB].nameHi,
        separationDegrees: Number(separation.toFixed(3)),
        winner,
        loser,
        winnerNameEn: GRAHA_INFO[winner].nameEn,
        winnerNameTa: GRAHA_INFO[winner].nameTa,
        winnerNameHi: GRAHA_INFO[winner].nameHi,
        loserNameEn: GRAHA_INFO[loser].nameEn,
        loserNameTa: GRAHA_INFO[loser].nameTa,
        loserNameHi: GRAHA_INFO[loser].nameHi,
        winnerLatitude: Number(winnerLatitude.toFixed(4)),
        loserLatitude: Number(loserLatitude.toFixed(4)),
        descriptionEn:
          `${GRAHA_INFO[planetA].nameEn} and ${GRAHA_INFO[planetB].nameEn} are ${separationText}° apart in ${warSign.nameEn} — Graha Yuddha. ` +
          `Decided by ecliptic latitude (north wins): ${GRAHA_INFO[winner].nameEn} (${winnerLatitude >= 0 ? '+' : ''}${winnerLatitude.toFixed(3)}°) defeats ${GRAHA_INFO[loser].nameEn} (${loserLatitude.toFixed(3)}°).`,
        descriptionTa:
          `${warSign.nameTa} ராசியில் ${GRAHA_INFO[planetA].nameTa}–${GRAHA_INFO[planetB].nameTa} இடையே ${separationText}° இடைவெளி — கிரக யுத்தம். ` +
          `வடக்கு அகலாங்கு (ecliptic latitude) விதிப்படி ${GRAHA_INFO[winner].nameTa} (${winnerLatitude.toFixed(3)}°) ${GRAHA_INFO[loser].nameTa}-ஐ (${loserLatitude.toFixed(3)}°) வெல்கிறார்.`,
        descriptionHi:
          `${warSign.nameHi} राशि में ${GRAHA_INFO[planetA].nameHi}–${GRAHA_INFO[planetB].nameHi} के बीच ${separationText}° — ग्रह युद्ध। ` +
          `उत्तर दिशा के अक्षांश (ecliptic latitude) के नियम से ${GRAHA_INFO[winner].nameHi} (${winnerLatitude.toFixed(3)}°) ने ${GRAHA_INFO[loser].nameHi} (${loserLatitude.toFixed(3)}°) को पराजित किया।`
      });
    }
  }

  // ---- Kendradhipati dosha — item 7b ------------------------------------
  // Jupiter or Mercury owning two of the four kendras (1, 4, 7, 10) for the
  // Lagna. The Lagna lord itself is traditionally exempt; the note is still
  // emitted so the Career and Marriage cards can quote it.
  const kendraSignNumbers = [1, 4, 7, 10].map(offset => ((lagnaRasi - 1 + (offset - 1)) % 12) + 1);
  const kendradhipati: NonNullable<HoroscopeResult['kendradhipati']> = [];
  const houseOrdinal = (n: number): string => {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
  };
  for (const graha of [Graha.GURU, Graha.BUDHA]) {
    const ownedSigns = kendraSignNumbers.filter(sign => SIGN_LORDS[sign] === graha);
    if (ownedSigns.length < 2) continue;
    const houses = ownedSigns.map(sign => houseFromSign(sign, lagnaRasi)).sort((a, b) => a - b);
    const appliesToLagnaLord = houses.includes(1);
    const info = GRAHA_INFO[graha];
    const houseListEn = houses.map(house => houseOrdinal(house)).join(' and ');
    const signListEn = ownedSigns.map(sign => RASI_INFO[sign as Rasi].nameEn).join(', ');
    const signListTa = ownedSigns.map(sign => RASI_INFO[sign as Rasi].nameTa).join(', ');
    const signListHi = ownedSigns.map(sign => RASI_INFO[sign as Rasi].nameHi).join(', ');
    const houseListTa = houses.map(house => `${house}-ஆம்`).join(', ');
    const houseListHi = houses.map(house => `${house}वें`).join(', ');
    kendradhipati.push({
      graha,
      grahaNameEn: info.nameEn,
      grahaNameTa: info.nameTa,
      grahaNameHi: info.nameHi,
      houses,
      signs: ownedSigns,
      appliesToLagnaLord,
      isDosha: !appliesToLagnaLord,
      descriptionEn: appliesToLagnaLord
        ? `${info.nameEn} rules the ${houseListEn} houses (${signListEn}) for this Lagna. As the Lagna lord it is traditionally exempt from Kendradhipati dosha, but the dual-kendra lordship is still noted in the Career and Marriage cards.`
        : `${info.nameEn} rules the ${houseListEn} houses (${signListEn}) for this Lagna — Kendradhipati dosha. A benefic owning two kendras is read as a caution for those houses; it is mentioned in the Career and Marriage cards.`,
      descriptionTa: appliesToLagnaLord
        ? `${info.nameTa} இந்த லக்னத்திற்கு ${houseListTa} பாவங்களை (${signListTa}) ஆள்கிறார். லக்னாதிபதி என்பதால் கேந்திராதிபதி தோஷத்தில் இருந்து மரபு விலக்கு அளிக்கிறது; ஆயினும் தொழில்/திருமண அட்டைகளில் குறிப்பிடப்பட்டுள்ளது.`
        : `${info.nameTa} இந்த லக்னத்திற்கு ${houseListTa} பாவங்களை (${signListTa}) ஆள்கிறார் — கேந்திராதிபதி தோஷம். நல்ல கிரகம் இரண்டு கேந்திரங்களை ஆள்வது அந்த பாவ விஷயங்களுக்கு எச்சரிக்கையாகக் கருதப்படுகிறது; தொழில்/திருமண அட்டைகளில் குறிப்பிடப்பட்டுள்ளது.`,
      descriptionHi: appliesToLagnaLord
        ? `${info.nameHi} इस लग्न के लिए ${houseListHi} भावों (${signListHi}) के स्वामी हैं। लग्नेश होने से केंद्राधिपति दोष से पारंपरिक छूट है, फिर भी कार्य/विवाह कार्ड में यह उल्लेख किया गया है।`
        : `${info.nameHi} इस लग्न के लिए ${houseListHi} भावों (${signListHi}) के स्वामी हैं — केंद्राधिपति दोष। शुभ ग्रह का दो केंद्रों पर स्वामित्व उन भावों के लिए सावधानी माना जाता है; कार्य/विवाह कार्ड में इसका उल्लेख है।`
    });
  }

  // ---- Yogas the report must show — item 6 ------------------------------
  const yogas: NonNullable<HoroscopeResult['yogas']> = [];
  const lordOfBhava = (bhavaNum: number): Graha => SIGN_LORDS[((lagnaRasi - 1 + (bhavaNum - 1)) % 12) + 1];
  const marsDignity = planetPositions.find(p => p.graha === Graha.CHEVVAI)?.dignity;
  void marsDignity;
  const eighthLord = lordOfBhava(8);
  const eighthLordPosition = planetPositions.find(p => p.graha === eighthLord);
  if (eighthLordPosition && eighthLordPosition.bhavaNumber === 8) {
    yogas.push({
      code: 'SARALA',
      nameEn: `Sarala Yoga — 8th lord ${GRAHA_INFO[eighthLord].nameEn} in the 8th`,
      nameTa: `சரள யோகம் — 8-ஆம் அதிபதி ${GRAHA_INFO[eighthLord].nameTa} 8-ஆம் பாவத்தில்`,
      nameHi: `सरल योग — अष्टमेश ${GRAHA_INFO[eighthLord].nameHi} अष्टम भाव में`,
      severity: 'auspicious',
      descriptionEn: `${GRAHA_INFO[eighthLord].nameEn}, lord of the 8th house, occupies the 8th house itself (Sarala Yoga). Traditionally this protects longevity and turns crises into endurance, research depth and inheritance of knowledge rather than sudden loss.`,
      descriptionTa: `8-ஆம் பாவ அதிபதி ${GRAHA_INFO[eighthLord].nameTa} அதே 8-ஆம் பாவத்தில் அமர்ந்துள்ளார் (சரள யோகம்). மரபில் இது ஆயுள் மற்றும் தைரியத்தைப் பாதுகாக்கும்; நெருக்கடிகளை அறிவுத் தேடலாக மாற்றும்.`,
      descriptionHi: `अष्टम भाव के स्वामी ${GRAHA_INFO[eighthLord].nameHi} स्वयं अष्टम भाव में हैं (सरल योग)। परंपरा में यह आयु और धैर्य की रक्षा करता है तथा संकट को शोध-गहराई में बदलता है।`
    });
  }
  const saturnSignNow = rasiByGraha[Graha.SANI];
  const saturnPositionNow = planetPositions.find(p => p.graha === Graha.SANI);
  if (saturnSignNow === 10 || saturnSignNow === 11) {
    const saturnSign = RASI_INFO[saturnSignNow as Rasi];
    const retroText = saturnPositionNow?.isRetrograde ? ' and retrograde (Vakri)' : '';
    yogas.push({
      code: 'SATURN_OWN_SIGN',
      nameEn: `Saturn in its own sign ${saturnSign.nameEn}${retroText}`,
      nameTa: `சனி தனது ஆட்சி ராசி ${saturnSign.nameTa}-இல்${saturnPositionNow?.isRetrograde ? ' (வக்கிரம்)' : ''}`,
      nameHi: `शनि अपनी स्वराशि ${saturnSign.nameHi} में${saturnPositionNow?.isRetrograde ? ' (वक्री)' : ''}`,
      severity: 'auspicious',
      descriptionEn: `Saturn occupies its own sign ${saturnSign.nameEn} in the ${houseOrdinal(saturnPositionNow?.bhavaNumber ?? 0)} house${retroText}. Own-sign Saturn gives structure, discipline, hard-won stability and slow but durable results; retrogression intensifies the lesson and asks for patience.`,
      descriptionTa: `சனி தனது ஆட்சி ராசி ${saturnSign.nameTa}-இல் ${saturnPositionNow?.bhavaNumber ?? '-'}-ஆம் பாவத்தில் உள்ளார்${saturnPositionNow?.isRetrograde ? '; வக்கிரமாக இருப்பதால் பாடம் தீவிரமாகும், பொறுமை தேவை' : ''}. ஆட்சி சனி கட்டமைப்பு, ஒழுக்கம், நிலைத்த வெற்றியைத் தரும்.`,
      descriptionHi: `शनि अपनी स्वराशि ${saturnSign.nameHi} में ${saturnPositionNow?.bhavaNumber ?? '-'}वें भाव में है${saturnPositionNow?.isRetrograde ? '; वक्री होने से पाठ तीव्र होता है और धैर्य चाहिए' : ''}। स्वराशि का शनि अनुशासन और स्थायी उपलब्धि देता है।`
    });
  }
  const yogaNinthLord = lordOfBhava(9);
  const yogaNinthLordPosition = planetPositions.find(p => p.graha === yogaNinthLord);
  const isYogaNinthLordInEighth = yogaNinthLordPosition?.bhavaNumber === 8;
  if (isYogaNinthLordInEighth) {
    yogas.push({
      code: 'NINTH_LORD_IN_EIGHTH',
      nameEn: `9th lord ${GRAHA_INFO[yogaNinthLord].nameEn} in the 8th house — caution`,
      nameTa: `9-ஆம் அதிபதி ${GRAHA_INFO[yogaNinthLord].nameTa} 8-ஆம் பாவத்தில் — கவனம்`,
      nameHi: `नवमेश ${GRAHA_INFO[yogaNinthLord].nameHi} अष्टम भाव में — सावधानी`,
      severity: 'caution',
      descriptionEn: `${GRAHA_INFO[yogaNinthLord].nameEn}, lord of the 9th (fortune, dharma, teachers, long journeys), sits in the 8th house. Read this as a caution, not as a blessing: fortune arrives through effort, delay, research or transformation, and documents/journeys need care.`,
      descriptionTa: `9-ஆம் பாவ (பாக்கியம், தர்மம், குரு, தூர பயணம்) அதிபதி ${GRAHA_INFO[yogaNinthLord].nameTa} 8-ஆம் பாவத்தில் உள்ளார். இதை நன்மை எனக் கூறக்கூடாது — கவனமே: பாக்கியம் முயற்சி, தாமதம், ஆராய்ச்சி அல்லது மாற்றத்தின் வழியே வரும்.`,
      descriptionHi: `नवम भाव (भाग्य, धर्म, गुरु, दूर यात्रा) के स्वामी ${GRAHA_INFO[yogaNinthLord].nameHi} अष्टम भाव में हैं। इसे शुभ न मानें — सावधानी: भाग्य परिश्रम, विलंब, शोध या परिवर्तन से मिलता है।`
    });
  }
  const kendradhipatiCareerNote = kendradhipati.find(entry => entry.houses.includes(10));
  const kendradhipatiMarriageNote = kendradhipati.find(entry => entry.houses.includes(7));
  const kendraNoteEn = (entry: typeof kendradhipatiCareerNote): string =>
    entry
      ? ` Kendradhipati dosha: ${entry.grahaNameEn} rules the ${entry.houses.join(' and ')} houses for this Lagna${entry.appliesToLagnaLord ? ' (Lagna lord — traditionally exempt, still noted)' : ''}.`
      : '';
  const kendraNoteTa = (entry: typeof kendradhipatiCareerNote): string =>
    entry
      ? ` கேந்திராதிபதி தோஷம்: ${entry.grahaNameTa} ${entry.houses.join(', ')}-ஆம் கேந்திரங்களை ஆள்கிறார்${entry.appliesToLagnaLord ? ' (லக்னாதிபதி — மரபு விலக்கு, ஆயினும் குறிப்பு)' : ''}.`
      : '';
  const kendraNoteHi = (entry: typeof kendradhipatiCareerNote): string =>
    entry
      ? ` केंद्राधिपति दोष: ${entry.grahaNameHi} इस लग्न के ${entry.houses.join(', ')} भावों के स्वामी हैं${entry.appliesToLagnaLord ? ' (लग्नेश — पारंपरिक छूट, फिर भी उल्लेख)' : ''}.`
      : '';
  const kendradhipatiCareerEn = kendraNoteEn(kendradhipatiCareerNote);
  const kendradhipatiCareerTa = kendraNoteTa(kendradhipatiCareerNote);
  const kendradhipatiCareerHi = kendraNoteHi(kendradhipatiCareerNote);
  const kendradhipatiMarriageEn = kendraNoteEn(kendradhipatiMarriageNote);
  const kendradhipatiMarriageTa = kendraNoteTa(kendradhipatiMarriageNote);
  const kendradhipatiMarriageHi = kendraNoteHi(kendradhipatiMarriageNote);

  // Navamsa (D9) Chart mapping for all planets & Lagna
  const navamsaPositions: Record<string, { rasi: Rasi; rasiNameTa: string; rasiNameEn: string; rasiNameHi: string; isVargottama?: boolean }> = {
    lagna: {
      rasi: lagnaNavRasi,
      rasiNameTa: lagnaNavInfo.nameTa,
      rasiNameEn: lagnaNavInfo.nameEn,
      rasiNameHi: lagnaNavInfo.nameHi,
      isVargottama: isLagnaVargottama
    }
  };

  planetPositions.forEach(p => {
    navamsaPositions[p.graha] = {
      rasi: p.navamsaRasi!,
      rasiNameTa: p.navamsaRasiNameTa!,
      rasiNameEn: p.navamsaRasiNameEn!,
      rasiNameHi: p.navamsaRasiNameHi!,
      isVargottama: p.isVargottama
    };
  });

  // Vimshottari Dasha Timeline & Current Active Dasha
  const dobDate = utcDate;
  const { periods: dashaPeriods, currentDasha } = calculateVimshottariDashaTimeline(
    nakshatraIdx,
    posInNak,
    nakSpan,
    dobDate,
    new Date(),
    timeZoneId ?? undefined
  );

  // Sani Transit Status - computed LIVE from today's actual Saturn position
  // (Saturn leaves Meenam/Pisces ~Mar 2027, so this must never be hardcoded).
  const nowTime = Astronomy.MakeTime(new Date());
  const nowJd = nowTime.ut + 2451545.0;
  const nowAyanamsa = calculateLahiriAyanamsa(nowJd);
  const nowSatGeo = Astronomy.GeoVector(Astronomy.Body.Saturn, nowTime, true);
  const nowSatTrop = normalizeDeg(Astronomy.Ecliptic(nowSatGeo).elon);
  const nowSatSid = normalizeDeg(nowSatTrop - nowAyanamsa);
  const currentSaniRasi = ((Math.floor(nowSatSid / 30.0) % 12) + 1) as Rasi;
  const saniDiff = (currentSaniRasi - chandraRasi + 12) % 12;
  const isEzharai = saniDiff === 11 || saniDiff === 0 || saniDiff === 1;

  let ezharaiTa = 'இல்லை';
  let ezharaiEn = 'None';
  let ezharaiHi = 'कोई नहीं';

  if (saniDiff === 11) {
    ezharaiTa = 'விரய சனி (12-ம் வீடு - முதல் பருவம்)';
    ezharaiEn = 'Viraya Sani (12th House - Phase 1)';
    ezharaiHi = 'व्यय शनि (12वां भाव - प्रथम चरण)';
  } else if (saniDiff === 0) {
    ezharaiTa = 'ஜென்ம சனி (ஜென்ம ராசி - இரண்டாம் பருவம்)';
    ezharaiEn = 'Jenma Sani (Janma Rasi - Core Phase 2)';
    ezharaiHi = 'जन्म शनि (जन्म राशि - द्वितीय चरण)';
  } else if (saniDiff === 1) {
    ezharaiTa = 'பாத சனி (2-ம் வீடு - மூன்றாம் பருவம்)';
    ezharaiEn = 'Patha Sani (2nd House - Phase 3)';
    ezharaiHi = 'पाद शनि (दूसरा भाव - तृतीय चरण)';
  }

  const saniStatus: SaniTransitStatus = {
    isEzharaiSani: isEzharai,
    ezharaiTypeTa: ezharaiTa,
    ezharaiTypeEn: ezharaiEn,
    ezharaiTypeHi: ezharaiHi,
    isAshtamaSani: saniDiff === 7,
    isKandakaSani: [3, 6, 9].includes(saniDiff),
    remedyTa: 'சிவனைப் பிரார்த்தனை செய்யுங்கள்.',
    remedyEn: 'Pray to Shiva.',
    remedyHi: 'शिव से प्रार्थना करें।'
  };

  // 1. Dynamic Kuja Dosha (Mars / Manglik Dosha) — classical Sevvay Dosham
  const marsPosition = planetPositions.find(p => p.graha === Graha.CHEVVAI);
  if (!marsPosition) throw new Error('Mars placement unavailable; Kuja Dosha was not calculated.');

  // Ported from AstroEngine::evaluateKujaDosha() (api/astrology/engine.php) so
  // both stacks reach the same verdict: Mars in house 2, 4, 7, 8 or 12 (the
  // South Indian rule) counted whole-sign from the Lagna, the Moon AND Venus,
  // subject to the classical exceptions (own/exalted sign, Simham/Kumbham,
  // house-sign Vilakku, Yogakaraka Lagna, Guru-Mangala, Chandra-Mangala, Guru
  // Drishti) and mitigations (partial sign cover, dosha not from the Lagna,
  // Saturn/Rahu/Ketu sharing a Kuja house). ASTRO_KUJA_HOUSES can override the
  // house list. The old rule set tested 1,2,4,7,8,12.
  const kujaDosha = kujaDoshaFromHoroscope({ planetPositions, lagnaRasi });
  const marsBhava = kujaDosha.marsBhava ?? marsPosition.bhavaNumber;
  const isKujaCancelled = kujaDosha.cancelled === true;
  const isKujaDosha = kujaDosha.isPresent; // null when the chart cannot decide
  // Item 3: the Kuja card also states Mars's dignity and — when a Neecha
  // Bhanga rule applies — names that rule ("Neecha Bhanga (by Jupiter
  // conjunction)") instead of implying the debilitation simply vanished.
  const marsDignityLineEn = dignityCardLine(marsPosition.dignity, 'en');
  const marsDignityLineTa = dignityCardLine(marsPosition.dignity, 'ta');
  const marsDignityLineHi = dignityCardLine(marsPosition.dignity, 'hi');
  const withMarsDignity = (text: string, note: string): string => (note ? `${text} ${note}` : text);

  // 2. Dynamic Kala Sarpa Dosha
  // True when all 7 classical planets lie on one side of Rahu-Ketu nodal axis
  const rahuLon = siderealLongitudes[Graha.RAHU];
  const classicalGrahas = [Graha.SURYA, Graha.CHANDRA, Graha.CHEVVAI, Graha.BUDHA, Graha.GURU, Graha.SUKRA, Graha.SANI];
  const sideFlags = classicalGrahas.map(g => normalizeDeg(siderealLongitudes[g] - rahuLon) < 180.0);
  const isKalaSarpa = sideFlags.every(f => f === sideFlags[0]);

  // 3. Simplified Pitru indicator
  // The Sun–Rahu/Ketu rule counts ONLY when they are within 12° of each other.
  // A same-sign pair further apart is reported as "weak (same sign only)"
  // instead of being flagged as a dosha. Saturn in the 9th keeps its classical
  // trigger. Broader traditions, including additional 9th-lord affliction
  // rules, are still not assessed.
  const sunPosition = planetPositions.find(p => p.graha === Graha.SURYA);
  const rahuPosition = planetPositions.find(p => p.graha === Graha.RAHU);
  const ketuPosition = planetPositions.find(p => p.graha === Graha.KETU);
  const saturnPosition = planetPositions.find(p => p.graha === Graha.SANI);
  const sunRasi = sunPosition?.rasi;
  const rahuRasi = rahuPosition?.rasi;
  const ketuRasi = ketuPosition?.rasi;
  const saturnRasi = saturnPosition?.rasi;
  const ninthBhava = bhavas[8];
  const nodeCandidates = [
    { node: Graha.RAHU, nameEn: 'Rahu', nameTa: 'ராகு', nameHi: 'राहु', position: rahuPosition },
    { node: Graha.KETU, nameEn: 'Ketu', nameTa: 'கேது', nameHi: 'केतु', position: ketuPosition }
  ]
    .filter(candidate => Boolean(candidate.position && sunPosition) && candidate.position!.rasi === sunRasi)
    .map(candidate => ({
      ...candidate,
      separation: Math.abs(normalizeDelta((candidate.position!.totalDegrees ?? 0) - (sunPosition!.totalDegrees ?? 0)))
    }))
    .sort((a, b) => a.separation - b.separation);
  const closestNode = nodeCandidates[0];
  const sunNodeSeparation = closestNode ? Number(closestNode.separation.toFixed(2)) : null;
  const isSunWithNodes = Boolean(closestNode && closestNode.separation <= 12.0);
  const isSunNodeSameSignOnly = Boolean(closestNode && closestNode.separation > 12.0);
  const isSaturnIn9th = saturnRasi === ninthBhava.rasi;
  const pitruStrength: 'present' | 'weak' | 'none' = isSunWithNodes || isSaturnIn9th
    ? 'present'
    : isSunNodeSameSignOnly
    ? 'weak'
    : 'none';
  const isPitruDosha = pitruStrength === 'present';
  const pitruStrengthLabelEn = pitruStrength === 'present'
    ? 'Simplified indicator triggered'
    : pitruStrength === 'weak'
    ? `Weak (same sign only)${closestNode ? ` — Sun and ${closestNode.nameEn} are ${sunNodeSeparation}° apart` : ''}`
    : 'Simplified indicator not triggered';
  const pitruStrengthLabelTa = pitruStrength === 'present'
    ? 'தேர்ந்த எளிய விதி பொருந்துகிறது'
    : pitruStrength === 'weak'
    ? `பலவீனம் (ஒரே ராசி மட்டும்)${closestNode ? ` — சூரியன்–${closestNode.nameTa} இடைவெளி ${sunNodeSeparation}°` : ''}`
    : 'தேர்ந்த எளிய விதி பொருந்தவில்லை';
  const pitruStrengthLabelHi = pitruStrength === 'present'
    ? 'सरल संकेत लागू हुआ'
    : pitruStrength === 'weak'
    ? `दुर्बल (केवल एक ही राशि)${closestNode ? ` — सूर्य और ${closestNode.nameHi} में ${sunNodeSeparation}° अंतर` : ''}`
    : 'सरल संकेत लागू नहीं हुआ';

  // Sign-level Guru Chandala indicator. Because Rahu and Ketu occupy opposite
  // signs, Jupiter's opposition to one node is its same-sign relation to the
  // other; degree-based conjunction strength is intentionally not claimed.
  const guruRasiNum = planetPositions.find(p => p.graha === Graha.GURU)?.rasi;
  const rahuRasiNum = rahuRasi as number | undefined;
  const ketuRasiNum = ketuRasi as number | undefined;
  const isGuruSameSignWithNode = Boolean(
    guruRasiNum && (guruRasiNum === rahuRasiNum || guruRasiNum === ketuRasiNum)
  );
  const isGuruChandala = isGuruSameSignWithNode;

  const doshas: DoshaCheckResult[] = [
    {
      nameTa: 'செவ்வாய் / மங்களத் தோஷம் (லக்னம், சந்திரன், சுக்கிரன் அடிப்படை)',
      nameEn: 'Sevvay / Kuja Dosha (from Lagna, Moon and Venus)',
      nameHi: 'सेव्वाय / मंगल दोष (लग्न, चंद्र, शुक्र से)',
      isPresent: isKujaDosha, // null = not assessable; never a false "clean"
      verdict: kujaDosha.verdict,
      verdictLabelEn: kujaDosha.verdictLabelEn,
      verdictLabelTa: kujaDosha.verdictLabelTa,
      verdictLabelHi: kujaDosha.verdictLabelHi,
      ruleEn: `Rule set: Mars in houses ${kujaDosha.ruleSet} counted from the Lagna, the Moon and Venus.`,
      ruleTa: `விதி: செவ்வாய் லக்னம், சந்திரன், சுக்கிரன் ஆகியவற்றிலிருந்து ${kujaDosha.ruleSet} ஆகிய இடங்களில்.`,
      ruleHi: `नियम: मंगल लग्न, चंद्र और शुक्र से ${kujaDosha.ruleSet} भावों में।`,
      severityTa: kujaDosha.severityTa,
      severityEn: kujaDosha.severityEn,
      severityHi: kujaDosha.severityHi,
      descriptionTa: withMarsDignity(kujaDosha.explanationTa, marsDignityLineTa),
      descriptionEn: withMarsDignity(kujaDosha.explanationEn, marsDignityLineEn),
      descriptionHi: withMarsDignity(kujaDosha.explanationHi, marsDignityLineHi),
      traditionalRemedyTa: NAVAGRAHA_DOSHA_DATA.mars.remedies.ta,
      traditionalRemedyEn: NAVAGRAHA_DOSHA_DATA.mars.remedies.en,
      traditionalRemedyHi: NAVAGRAHA_DOSHA_DATA.mars.remedies.hi
    },
    {
      nameTa: 'கால சர்ப்ப குறியீடு (ஒரு பாரம்பரிய அளவுகோல்)',
      nameEn: 'Kala Sarpa Indicator (one traditional criterion)',
      nameHi: 'कालसर्प संकेत (एक पारंपरिक मानदंड)',
      isPresent: isKalaSarpa,
      severityTa: isKalaSarpa ? 'இந்த அளவுகோல் பொருந்துகிறது' : 'இந்த அளவுகோல் பொருந்தவில்லை',
      severityEn: isKalaSarpa ? 'This selected criterion is met' : 'This selected criterion is not met',
      severityHi: isKalaSarpa ? 'चयनित मानदंड लागू है' : 'चयनित मानदंड लागू नहीं है',
      descriptionTa: isKalaSarpa
        ? 'கணக்கில் பயன்படுத்திய 7 பாரம்பரிய கிரகங்களும் ராகு–கேது அச்சின் ஒரே அரை வட்டத்தில் உள்ளன. மற்ற ஜோதிட மரபுகள் இதை வேறுபடக் கருதலாம்.'
        : 'கணக்கில் பயன்படுத்திய 7 பாரம்பரிய கிரகங்களும் ஒரே அரை வட்டத்தில் இல்லை. இது இந்த அளவுகோல் மட்டுமே; முழு ஜாதக மதிப்பீடு அல்ல.',
      descriptionEn: isKalaSarpa
        ? 'The seven classical planets fall within one semicircle of the Rahu–Ketu axis under this implementation. Traditions differ on this criterion.'
        : 'The seven classical planets do not fall within one semicircle under this implementation. This is only one criterion, not a complete chart assessment.',
      descriptionHi: isKalaSarpa
        ? 'इस गणना में सात पारंपरिक ग्रह राहु–केतु अक्ष के एक अर्धवृत्त में हैं। इस मानदंड पर परंपराओं में मतभेद हैं।'
        : 'इस गणना में सात पारंपरिक ग्रह एक अर्धवृत्त में नहीं हैं। यह केवल एक मानदंड है, पूर्ण कुंडली मूल्यांकन नहीं।',
      traditionalRemedyTa: 'சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
      traditionalRemedyEn: 'Pray to Lord Shiva.',
      traditionalRemedyHi: 'भगवान शिव का नाम लेकर प्रार्थना करें।'
    },
    {
      nameTa: 'பித்ரு தோஷக் குறியீடு (எளிய ராசி/பாவ விதி)',
      nameEn: 'Pitru Indicator (simplified sign/house rule)',
      nameHi: 'पितृ संकेत (सरल राशि/भाव नियम)',
      isPresent: isPitruDosha,
      strength: pitruStrength,
      strengthLabelEn: pitruStrengthLabelEn,
      strengthLabelTa: pitruStrengthLabelTa,
      strengthLabelHi: pitruStrengthLabelHi,
      severityTa: pitruStrengthLabelTa,
      severityEn: pitruStrengthLabelEn,
      severityHi: pitruStrengthLabelHi,
      descriptionTa: isPitruDosha
        ? `${isSunWithNodes ? `சூரியன் ${closestNode?.nameTa} உடன் ${sunNodeSeparation}° இடைவெளியில் (12° எல்லைக்குள்) உள்ளார். ` : ''}${isSaturnIn9th ? 'சனி 9-ஆம் பாவத்தில் உள்ளார். ' : ''}இவை தேர்ந்தெடுத்த எளிய குறியீடுகள் மட்டுமே; பித்ரு நிலை பற்றிய முழு முடிவு அல்ல.`
        : pitruStrength === 'weak'
        ? `சூரியனும் ${closestNode?.nameTa} உம் ஒரே ராசியில் ${sunNodeSeparation}° இடைவெளியில் உள்ளனர் — 12° எல்லைக்குள் இல்லாததால் தோஷம் கொடுக்கவில்லை; பலவீனமான (ஒரே ராசி மட்டும்) அறிகுறி.`
        : 'சூரியன் ராகு/கேதுவுடன் 12° எல்லைக்குள் இல்லை; சனியும் 9-ஆம் பாவத்தில் இல்லை. இது இந்த எளிய விதி மட்டுமே; முன்னோர் ஆசீர்வாதத்தை உறுதிப்படுத்தாது.',
      descriptionEn: isPitruDosha
        ? `${isSunWithNodes ? `The Sun is within 12° of ${closestNode?.nameEn} (${sunNodeSeparation}° apart). ` : ''}${isSaturnIn9th ? 'Saturn occupies the 9th house by sign. ' : ''}These are simplified indicators only, not a complete Pitru assessment.`
        : pitruStrength === 'weak'
        ? `The Sun and ${closestNode?.nameEn} share a sign but are ${sunNodeSeparation}° apart — outside the 12° orb, so no dosha is flagged: weak (same sign only).`
        : 'The Sun is not within 12° of Rahu/Ketu and Saturn is not in the 9th house by sign. This limited rule does not establish ancestral blessings or the absence of other interpretations.',
      descriptionHi: isPitruDosha
        ? `${isSunWithNodes ? `सूर्य ${closestNode?.nameHi} से 12° के भीतर (${sunNodeSeparation}° अंतर) है। ` : ''}${isSaturnIn9th ? 'शनि राशि-आधारित नवम भाव में हैं। ' : ''}ये केवल सरल संकेत हैं, पूर्ण पितृ मूल्यांकन नहीं।`
        : pitruStrength === 'weak'
        ? `सूर्य और ${closestNode?.nameHi} एक ही राशि में हैं पर ${sunNodeSeparation}° दूर — 12° सीमा से बाहर, इसलिए दोष नहीं: दुर्बल (केवल एक ही राशि)।`
        : 'सूर्य राहु/केतु से 12° के भीतर नहीं हैं और शनि राशि-आधारित नवम भाव में नहीं हैं। यह सीमित नियम पितृ-कृपा या अन्य व्याख्याओं की अनुपस्थिति सिद्ध नहीं करता।',
      traditionalRemedyTa: 'மகா விஷ்ணு பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
      traditionalRemedyEn: 'Pray to Maha Vishnu.',
      traditionalRemedyHi: 'महाविष्णु का नाम लेकर प्रार्थना करें।',
      // Item 5: the fuller ancestral remedy the report prints for a Pitru
      // indicator. The short prayer above stays in traditionalRemedy* so the
      // ordered TypeScript/PHP remedy parity contract (tests/remedies.test.ts) holds.
      extendedRemedyTa: 'அமாவாசை தர்ப்பணம் செய்யுங்கள்; காகங்களுக்கும் பசுக்களுக்கும் உணவளியுங்கள்; மகா விஷ்ணு பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
      extendedRemedyEn: 'Offer Amavasya tarpanam; feed crows and cows; pray to Maha Vishnu.',
      extendedRemedyHi: 'अमावस्या तर्पण करें; कौओं और गायों को भोजन कराएँ; महाविष्णु का नाम लेकर प्रार्थना करें।'
    },
    {
      nameTa: 'குரு சண்டாள குறியீடு (ராசி-அடிப்படை)',
      nameEn: 'Guru Chandala Indicator (sign-level)',
      nameHi: 'गुरु चांडाल संकेत (राशि-आधारित)',
      isPresent: isGuruChandala,
      severityTa: isGuruChandala ? 'ராசி-அடிப்படை குறியீடு உள்ளது' : 'ராசி-அடிப்படை குறியீடு இல்லை',
      severityEn: isGuruChandala ? 'Sign-level indicator present' : 'Sign-level indicator not present',
      severityHi: isGuruChandala ? 'राशि-आधारित संकेत उपस्थित' : 'राशि-आधारित संकेत उपस्थित नहीं',
      descriptionTa: isGuruChandala
        ? 'குரு ராகு அல்லது கேதுவுடன் ஒரே ராசியில் உள்ளார். இது பாகை இடைவெளி/சேர்க்கை வலிமையை அளவிடாத ராசி-அடிப்படை குறியீடு; மரபுகள் மாறுபடும்.'
        : 'குரு ராகு/கேதுவுடன் ஒரே ராசியில் இல்லை. இது ராசி-அடிப்படை விதி மட்டுமே; முழு யோக மதிப்பீடு அல்ல.',
      descriptionEn: isGuruChandala
        ? 'Jupiter shares a sign with Rahu or Ketu under this sign-level rule. It does not measure degree distance or conjunction strength; traditions differ.'
        : 'Jupiter does not share a sign with Rahu/Ketu under this rule. This is a sign-level criterion, not a complete yoga assessment.',
      descriptionHi: isGuruChandala
        ? 'इस राशि-आधारित नियम के अनुसार गुरु राहु या केतु के साथ एक राशि में हैं। अंश-दूरी या युति की शक्ति नहीं मापी गई; परंपराएँ भिन्न हैं।'
        : 'इस नियम के अनुसार गुरु राहु/केतु के साथ एक राशि में नहीं हैं। यह केवल राशि-आधारित मानदंड है, पूर्ण योग मूल्यांकन नहीं।',
      traditionalRemedyTa: 'தட்சிணாமூர்த்தி அல்லது சிவன் பெயரைச் சொல்லி பிரார்த்தனை செய்யுங்கள்.',
      traditionalRemedyEn: 'Pray to Lord Dakshinamurthy or Lord Shiva.',
      traditionalRemedyHi: 'भगवान दक्षिणामूर्ति या भगवान शिव का नाम लेकर प्रार्थना करें।'
    }
  ];

  // Simple Navagraha screening indicators, kept separate from the named doshas
  // above. These placement rules are one traditional filter, not a definitive
  // astrological diagnosis. Mangala is covered by Kuja Dosha when that rule is
  // already present, avoiding duplicate Mars recommendations.
  const navagrahaDebilitationSign: Partial<Record<Graha, Rasi>> = {
    [Graha.SURYA]: Rasi.THULAM,
    [Graha.CHANDRA]: Rasi.VIRUCHIGAM,
    [Graha.CHEVVAI]: Rasi.KADAGAM,
    [Graha.BUDHA]: Rasi.MEENAM,
    [Graha.GURU]: Rasi.MAGARAM,
    [Graha.SUKRA]: Rasi.KANNI,
    [Graha.SANI]: Rasi.MESHAM,
    [Graha.RAHU]: Rasi.VIRUCHIGAM,
    [Graha.KETU]: Rasi.RISHABAM
  };
  const naturallyMaleficGrahas = new Set<Graha>([Graha.CHEVVAI, Graha.SANI, Graha.RAHU, Graha.KETU]);

  for (const graha of Object.values(Graha) as Graha[]) {
    const position = planetPositions.find(p => p.graha === graha);
    const meta = NAVAGRAHA_DOSHA_DATA[graha];
    if (!position || !meta) continue;

    const isDebilitated = position.rasi === navagrahaDebilitationSign[graha];
    const conjunctMalefic = planetPositions.find(p =>
      p.graha !== graha &&
      naturallyMaleficGrahas.has(p.graha) &&
      p.bhavaNumber === position.bhavaNumber
    );
    const isDusthana = [6, 8, 12].includes(position.bhavaNumber);
    const isAfflicted = isDebilitated || Boolean(conjunctMalefic) || isDusthana;

    if (!isAfflicted || (graha === Graha.CHEVVAI && isKujaDosha)) continue;

    const planetEn = GRAHA_INFO[graha].nameEn;
    const planetTa = GRAHA_INFO[graha].nameTa;
    const planetHi = GRAHA_INFO[graha].nameHi;
    const reasonEn = isDebilitated
      ? 'is in its traditional debilitation sign'
      : conjunctMalefic
      ? `shares a house with ${GRAHA_INFO[conjunctMalefic.graha].nameEn}, classified as a natural malefic by this rule`
      : `is placed in House ${position.bhavaNumber}, treated as a challenging house by this rule`;
    const reasonTa = isDebilitated
      ? 'பாரம்பரிய நீச ராசியில் உள்ளது'
      : conjunctMalefic
      ? `${GRAHA_INFO[conjunctMalefic.graha].nameTa} உடன் ஒரே பாவத்தில் உள்ளது`
      : `${position.bhavaNumber}-ஆம் பாவத்தில் இந்த எளிய விதிப்படி கணிக்கப்பட்டுள்ளது`;
    const reasonHi = isDebilitated
      ? 'पारंपरिक नीच राशि में स्थित है'
      : conjunctMalefic
      ? `${GRAHA_INFO[conjunctMalefic.graha].nameHi} के साथ एक भाव में स्थित है`
      : `इस सरल नियम के अनुसार भाव ${position.bhavaNumber} में स्थित है`;

    doshas.push({
      nameTa: meta.name.ta,
      nameEn: meta.name.en,
      nameHi: meta.name.hi,
      isPresent: true,
      isNavagrahaAfflictionIndicator: true,
      ruleCode: isDebilitated ? 'DEBILITATED' : conjunctMalefic ? 'MALEFIC_HOUSE_CONJUNCTION' : 'DUSTHANA_HOUSE',
      ruleEn: reasonEn,
      ruleTa: reasonTa,
      ruleHi: reasonHi,
      severityTa: 'எளிய குறியீட்டின்படி பாதிப்பு உள்ளது',
      severityEn: 'Simplified indicator present',
      severityHi: 'सरल मानदंड के अनुसार संकेत उपस्थित',
      descriptionTa: `${planetTa} ${reasonTa}. இது எளிய குறியீடு மட்டுமே; மரபுகளின் விளக்கங்கள் மாறுபடலாம்.`,
      descriptionEn: `${planetEn} ${reasonEn}. This is a simplified screening indicator; interpretations vary by tradition.`,
      descriptionHi: `${planetHi} ${reasonHi}। यह केवल एक सरल संकेत है; परंपराओं में व्याख्याएँ भिन्न हो सकती हैं।`,
      traditionalRemedyTa: navagrahaRemedyText(meta, 'ta'),
      traditionalRemedyEn: navagrahaRemedyText(meta, 'en'),
      traditionalRemedyHi: navagrahaRemedyText(meta, 'hi')
    });
  }

  // Chart-derived, non-deterministic Life Aspect Summary. The earlier copy
  // asserted guaranteed health, wealth, marriage and travel outcomes without
  // evaluating those houses. Keep the summaries tied to calculated placements
  // and clearly label them as traditional symbolism rather than advice.
  const lagnaInfo = RASI_INFO[lagnaRasi];
  const chandraInfo = RASI_INFO[chandraRasi];
  const lagnaLordPos = planetPositions.find(p => p.graha === lagnaInfo.lordGraha);
  const lagnaLordBhava = lagnaLordPos && Number.isInteger(lagnaLordPos.bhavaNumber) && lagnaLordPos.bhavaNumber >= 1 && lagnaLordPos.bhavaNumber <= 12
    ? lagnaLordPos.bhavaNumber
    : null;
  const houseLordPlacement = (houseNumber: number) => {
    const house = bhavas[houseNumber - 1];
    if (!house || !RASI_INFO[house.rasi]) return null;
    const signInfo = RASI_INFO[house.rasi];
    const lordInfo = GRAHA_INFO[signInfo.lordGraha];
    const lordPosition = planetPositions.find(p => p.graha === signInfo.lordGraha);
    if (!lordPosition || !RASI_INFO[lordPosition.rasi] || !Number.isInteger(lordPosition.bhavaNumber) || lordPosition.bhavaNumber < 1 || lordPosition.bhavaNumber > 12) return null;
    const placedSign = RASI_INFO[lordPosition.rasi];
    return {
      houseNumber,
      signTa: signInfo.nameTa,
      signEn: signInfo.nameEn,
      signHi: signInfo.nameHi,
      lordTa: lordInfo.nameTa,
      lordEn: lordInfo.nameEn,
      lordHi: lordInfo.nameHi,
      placedHouse: lordPosition.bhavaNumber,
      placedSignTa: placedSign.nameTa,
      placedSignEn: placedSign.nameEn,
      placedSignHi: placedSign.nameHi
    };
  };
  const housePlacementEn = (placement: ReturnType<typeof houseLordPlacement>, houseNumber: number) => placement
    ? `House ${placement.houseNumber} lord ${placement.lordEn} (ruled sign ${placement.signEn}) is placed in house ${placement.placedHouse} (${placement.placedSignEn}).`
    : `House ${houseNumber} lord placement is unavailable (N/A).`;
  const housePlacementTa = (placement: ReturnType<typeof houseLordPlacement>, houseNumber: number) => placement
    ? `${placement.houseNumber}-ஆம் பாவத்தின் அதிபதி ${placement.lordTa} (${placement.signTa}) ${placement.placedHouse}-ஆம் பாவத்தில் (${placement.placedSignTa}) உள்ளார்.`
    : `${houseNumber}-ஆம் பாவத்தின் அதிபதி நிலை கிடைக்கவில்லை (N/A).`;
  const housePlacementHi = (placement: ReturnType<typeof houseLordPlacement>, houseNumber: number) => placement
    ? `भाव ${placement.houseNumber} के स्वामी ${placement.lordHi} (${placement.signHi}) भाव ${placement.placedHouse} (${placement.placedSignHi}) में स्थित हैं।`
    : `भाव ${houseNumber} के स्वामी की स्थिति उपलब्ध नहीं है (N/A)।`;
  const caveatEn = 'Traditional Jyotish symbolism only; not a guaranteed prediction or professional advice.';
  const caveatTa = 'இவை பாரம்பரிய ஜோதிடக் குறியீடுகள் மட்டுமே; உறுதியான கணிப்போ மருத்துவ/நிதி ஆலோசனையோ அல்ல.';
  const caveatHi = 'यह केवल पारंपरिक ज्योतिषीय संकेत हैं; निश्चित भविष्यवाणी या चिकित्सा/वित्तीय सलाह नहीं।';
  const secondLord = houseLordPlacement(2);
  const fourthLord = houseLordPlacement(4);
  const fifthLord = houseLordPlacement(5);
  const seventhLord = houseLordPlacement(7);
  const ninthLord = houseLordPlacement(9);
  const tenthLord = houseLordPlacement(10);
  const eleventhLord = houseLordPlacement(11);
  const twelfthLord = houseLordPlacement(12);

  const summary: LifeAspectSummary = {
    healthTa: lagnaLordBhava === null
      ? 'லக்னாதிபதியின் பாவ நிலை கிடைக்கவில்லை (N/A); விளக்கம் உருவாக்கப்படவில்லை.'
      : `பாரம்பரிய ஜோதிடக் குறிப்பு: லக்னம் ${lagnaInfo.nameTa}; லக்னாதிபதி ${lagnaInfo.lordTa} ${lagnaLordBhava}-ஆம் பாவத்தில் உள்ளார். இது ஜோதிட விளக்கம் மட்டுமே; மருத்துவ மதிப்பீடு அல்லது உடல்நல முன்னறிவிப்பு அல்ல.`,
    healthEn: lagnaLordBhava === null
      ? 'Ascendant-lord house placement unavailable (N/A); no interpretation was generated.'
      : `Traditional Jyotish observation: the Ascendant is ${lagnaInfo.nameEn}, and its lord ${lagnaInfo.lordEn} is placed in House ${lagnaLordBhava}. This is a symbolic reading, not a medical assessment or health forecast.`,
    healthHi: lagnaLordBhava === null
      ? 'लग्नेश का भाव उपलब्ध नहीं है (N/A); व्याख्या नहीं बनाई गई।'
      : `पारंपरिक ज्योतिषीय टिप्पणी: लग्न ${lagnaInfo.nameHi} है और लग्नेश ${lagnaInfo.lordHi} भाव ${lagnaLordBhava} में स्थित हैं। यह ज्योतिषीय व्याख्या है, चिकित्सा मूल्यांकन या स्वास्थ्य पूर्वानुमान नहीं।`,

    wealthTa: `${housePlacementTa(secondLord, 2)} ${housePlacementTa(eleventhLord, 11)} ${caveatTa}`,
    wealthEn: `${housePlacementEn(secondLord, 2)} ${housePlacementEn(eleventhLord, 11)} ${caveatEn}`,
    wealthHi: `${housePlacementHi(secondLord, 2)} ${housePlacementHi(eleventhLord, 11)} ${caveatHi}`,

    educationTa: `${housePlacementTa(fourthLord, 4)} ${housePlacementTa(fifthLord, 5)} ${caveatTa}`,
    educationEn: `${housePlacementEn(fourthLord, 4)} ${housePlacementEn(fifthLord, 5)} ${caveatEn}`,
    educationHi: `${housePlacementHi(fourthLord, 4)} ${housePlacementHi(fifthLord, 5)} ${caveatHi}`,

    careerTa: `${housePlacementTa(tenthLord, 10)}${kendradhipatiCareerTa} ${caveatTa}`,
    careerEn: `${housePlacementEn(tenthLord, 10)}${kendradhipatiCareerEn} ${caveatEn}`,
    careerHi: `${housePlacementHi(tenthLord, 10)}${kendradhipatiCareerHi} ${caveatHi}`,

    marriageTa: `${housePlacementTa(seventhLord, 7)}${kendradhipatiMarriageTa} ${caveatTa}`,
    marriageEn: `${housePlacementEn(seventhLord, 7)}${kendradhipatiMarriageEn} ${caveatEn}`,
    marriageHi: `${housePlacementHi(seventhLord, 7)}${kendradhipatiMarriageHi} ${caveatHi}`,

    familyTa: `${housePlacementTa(fourthLord, 4)} ${caveatTa}`,
    familyEn: `${housePlacementEn(fourthLord, 4)} ${caveatEn}`,
    familyHi: `${housePlacementHi(fourthLord, 4)} ${caveatHi}`,

    foreignTravelTa: `${housePlacementTa(ninthLord, 9)} ${housePlacementTa(twelfthLord, 12)} ${caveatTa}`,
    foreignTravelEn: `${housePlacementEn(ninthLord, 9)} ${housePlacementEn(twelfthLord, 12)} ${caveatEn}`,
    foreignTravelHi: `${housePlacementHi(ninthLord, 9)} ${housePlacementHi(twelfthLord, 12)} ${caveatHi}`,

    currentPeriodGuidanceTa: `ஜென்ம ராசி ${chandraInfo.nameTa}. தற்போது ${currentDasha.mahadashaLordTa} மகாதிசை (${currentDasha.mahadashaStart} முதல் ${currentDasha.mahadashaEnd} வரை), ${currentDasha.antardashaLordTa} புத்தியுடன் உள்ளது.${currentDasha.mahadashaChangeNoticeTa ? ' ' + currentDasha.mahadashaChangeNoticeTa : ''} இது பாரம்பரிய ஜோதிட காலக் குறிப்பு மட்டுமே; உறுதியான நிகழ்வு கணிப்பு அல்ல.`,
    currentPeriodGuidanceEn: `Janma Rasi is ${chandraInfo.nameEn}. The calculated period is ${currentDasha.mahadashaLordEn} Mahadasha (${currentDasha.mahadashaStart} to ${currentDasha.mahadashaEnd}) with ${currentDasha.antardashaLordEn} Bhukti (${currentDasha.antardashaStart} to ${currentDasha.antardashaEnd}).${currentDasha.mahadashaChangeNoticeEn ? ' ' + currentDasha.mahadashaChangeNoticeEn : ''} Traditional timing symbolism only; not a certain event prediction.`,
    currentPeriodGuidanceHi: `जन्म राशि ${chandraInfo.nameHi} है। गणना के अनुसार ${currentDasha.mahadashaLordHi} महादशा (${currentDasha.mahadashaStart} से ${currentDasha.mahadashaEnd}) में ${currentDasha.antardashaLordHi} अंतर्दशा (${currentDasha.antardashaStart} से ${currentDasha.antardashaEnd}) चल रही है।${currentDasha.mahadashaChangeNoticeHi ? ' ' + currentDasha.mahadashaChangeNoticeHi : ''} यह पारंपरिक ज्योतिषीय काल-संकेत है, निश्चित घटना की भविष्यवाणी नहीं।`
  };

  return {
    devoteeName: name.trim() || 'User',
    gender,
    dob,
    tob,
    birthPlace: birthPlace.trim(),
    country: country.trim(),
    latitude,
    longitude,
    timezoneOffsetHours: effectiveTimezoneOffsetHours,
    timeZoneId: timeZoneId ?? undefined,
    ayanamsa: Number(ayanamsa.toFixed(4)),
    // Julian Day (UT) this chart was computed from; the ayanamsa is a
    // function of exactly this number.
    julianDay: Number(jd.toFixed(6)),
    // Declared alongside `nodeType` so a report can always state which
    // ayanamsa convention produced its sidereal longitudes.
    ayanamsaMode: AYANAMSA_MODE,
    nodeType,
    lagnaRasi,
    lagnaRasiNumber: lagnaRasi,
    lagnaRasiNameTa: lagnaInfo.nameTa,
    lagnaRasiNameEn: lagnaInfo.nameEn,
    lagnaRasiNameHi: lagnaInfo.nameHi,
    lagnaDegrees: Number(lagnaDegrees.toFixed(2)),
    lagnaNavamsaRasi: lagnaNavRasi,
    lagnaNavamsaRasiNameTa: lagnaNavInfo.nameTa,
    lagnaNavamsaRasiNameEn: lagnaNavInfo.nameEn,
    lagnaNavamsaRasiNameHi: lagnaNavInfo.nameHi,
    isLagnaVargottama,
    chandraRasi,
    chandraRasiNameTa: chandraInfo.nameTa,
    chandraRasiNameEn: chandraInfo.nameEn,
    chandraRasiNameHi: chandraInfo.nameHi,
    janmaNakshatraTa: NAKSHATRAM_NAMES_TA[nakshatraIdx],
    janmaNakshatraEn: NAKSHATRAM_NAMES_EN[nakshatraIdx],
    janmaNakshatraHi: NAKSHATRAM_NAMES_HI[nakshatraIdx],
    nakshatraTa: NAKSHATRAM_NAMES_TA[nakshatraIdx],
    nakshatraEn: NAKSHATRAM_NAMES_EN[nakshatraIdx],
    nakshatraHi: NAKSHATRAM_NAMES_HI[nakshatraIdx],
    janmaNakshatraIndex: nakshatraIdx,
    janmaPada,
    planetPositions,
    bhavas,
    navamsaPositions,
    dashaPeriods,
    currentDasha,
    saniStatus,
    doshas,
    grahaYuddha,
    kendradhipati,
    yogas,
    pitruStrength,
    summary,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Authentic Live Panchangam Calculation using Astronomy Engine
 */
export function calculatePrecisionPanchangam(
  date: Date = new Date(),
  latitude = 13.0827,
  longitude = 80.2707,
  cityName = 'Chennai',
  country = 'India'
): PanchangamResult {
  const timeZoneId = getTimeZoneIdForCoordinates(latitude, longitude);
  const localDateKey = (timeZoneId ? getLocalDateKey(date, timeZoneId) : null) ?? date.toISOString().slice(0, 10);
  const localDateTime = timeZoneId ? getZonedDateTimeParts(date, timeZoneId) : null;
  const time = Astronomy.MakeTime(date);
  const jd = time.ut + 2451545.0;
  const ayanamsa = calculateLahiriAyanamsa(jd);

  // Exact Sun & Moon Positions
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const sunEcl = Astronomy.Ecliptic(sunGeo);
  const sunTrop = normalizeDeg(sunEcl.elon);
  const sunSid = normalizeDeg(sunTrop - ayanamsa);

  const moonGeo = Astronomy.GeoVector(Astronomy.Body.Moon, time, true);
  const moonEcl = Astronomy.Ecliptic(moonGeo);
  const moonTrop = normalizeDeg(moonEcl.elon);
  const moonSid = normalizeDeg(moonTrop - ayanamsa);

  // 1. TITHI (12° separation between Moon and Sun)
  const diffDeg = normalizeDeg(moonTrop - sunTrop);
  const tithiIndex = Math.floor(diffDeg / 12.0); // 0 to 29
  const tithiProgressPercent = Number(((diffDeg % 12.0) / 12.0 * 100).toFixed(1));
  const tithiPaksha: 'Shukla' | 'Krishna' = tithiIndex < 15 ? 'Shukla' : 'Krishna';

  const TITHI_NAMES_EN = [
    'Prathama (Shukla)', 'Dvitiya (Shukla)', 'Tritiya (Shukla)', 'Chaturthi (Shukla)',
    'Panchami (Shukla)', 'Shashthi (Shukla)', 'Saptami (Shukla)', 'Ashtami (Shukla)',
    'Navami (Shukla)', 'Dashami (Shukla)', 'Ekadashi (Shukla)', 'Dvadashi (Shukla)',
    'Trayodashi (Shukla)', 'Chaturdashi (Shukla)', 'Purnima (Full Moon)',
    'Prathama (Krishna)', 'Dvitiya (Krishna)', 'Tritiya (Krishna)', 'Chaturthi (Krishna)',
    'Panchami (Krishna)', 'Shashthi (Krishna)', 'Saptami (Krishna)', 'Ashtami (Krishna)',
    'Navami (Krishna)', 'Dashami (Krishna)', 'Ekadashi (Krishna)', 'Dvadashi (Krishna)',
    'Trayodashi (Krishna)', 'Chaturdashi (Krishna)', 'Amavasya (New Moon)'
  ];

  const TITHI_NAMES_TA = [
    'பிரதமை (சுக்ல)', 'துவிதியை (சுக்ல)', 'திருதியை (சுக்ல)', 'சதுர்த்தி (சுக்ல)',
    'பஞ்சமி (சுக்ல)', 'சஷ்டி (சுக்ல)', 'சப்தமி (சுக்ல)', 'அஷ்டமி (சுக்ல)',
    'நவமி (சுக்ல)', 'தசமி (சுக்ல)', 'ஏகாதசி (சுக்ல)', 'துவாதசி (சுக்ல)',
    'திரயோதசி (சுக்ல)', 'சதுர்தசி (சுக்ல)', 'பௌர்ணமி',
    'பிரதமை (கிருஷ்ண)', 'துவிதியை (கிருஷ்ண)', 'திருதியை (கிருஷ்ண)', 'சதுர்த்தி (கிருஷ்ண)',
    'பஞ்சமி (கிருஷ்ண)', 'சஷ்டி (கிருஷ்ண)', 'சப்தமி (கிருஷ்ண)', 'அஷ்டமி (கிருஷ்ண)',
    'நவமி (கிருஷ்ண)', 'தசமி (கிருஷ்ண)', 'ஏகாதசி (கிருஷ்ண)', 'துவாதசி (கிருஷ்ண)',
    'திரயோதசி (கிருஷ்ண)', 'சதுர்தசி (கிருஷ்ண)', 'அமாவாசை'
  ];

  const TITHI_NAMES_HI = [
    'प्रतिपदा (शुक्ल)', 'द्वितीया (शुक्ल)', 'तृतीया (शुक्ल)', 'चतुर्थी (शुक्ल)',
    'पंचमी (शुक्ल)', 'षष्ठी (शुक्ल)', 'सप्तमी (शुक्ल)', 'अष्टमी (शुक्ल)',
    'नवमी (शुक्ल)', 'दशमी (शुक्ल)', 'एकादशी (शुक्ल)', 'द्वादशी (शुक्ल)',
    'त्रयोदशी (शुक्ल)', 'चतुर्दशी (शुक्ल)', 'पूर्णिमा',
    'प्रतिपदा (कृष्ण)', 'द्वितीया (कृष्ण)', 'तृतीया (कृष्ण)', 'चतुर्थी (कृष्ण)',
    'पंचमी (कृष्ण)', 'षष्ठी (कृष्ण)', 'सप्तमी (कृष्ण)', 'अष्टमी (कृष्ण)',
    'नवमी (कृष्ण)', 'दशमी (कृष्ण)', 'एकादशी (कृष्ण)', 'द्वादशी (कृष्ण)',
    'त्रयोदशी (कृष्ण)', 'चतुर्दशी (कृष्ण)', 'अमावस्या'
  ];

  // 2. NAKSHATRA (13°20' per Nakshatra in Sidereal)
  const nakSpan = 360.0 / 27.0;
  const nakshatraIndex = Math.floor(moonSid / nakSpan) % 27;
  const degInNak = moonSid - nakshatraIndex * nakSpan;
  const nakshatraPada = Math.min(4, Math.max(1, Math.floor(degInNak / (nakSpan / 4.0)) + 1));
  const nakshatraProgressPercent = Number((degInNak / nakSpan * 100).toFixed(1));

  // 3. VARA (Day of the Week)
  const varaIndex = localDateTime
    ? new Date(Date.UTC(localDateTime.year, localDateTime.month - 1, localDateTime.day)).getUTCDay()
    : new Date(`${localDateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday; UTC fallback is deterministic
  const VARA_NAMES_EN = ['Sunday (Bhanu Vasara)', 'Monday (Soma Vasara)', 'Tuesday (Mangala Vasara)', 'Wednesday (Budha Vasara)', 'Thursday (Guru Vasara)', 'Friday (Shukra Vasara)', 'Saturday (Shani Vasara)'];
  const VARA_NAMES_TA = ['ஞாயிறு (பானு வாரம்)', 'திங்கள் (சோம வாரம்)', 'செவ்வாய் (மங்கள வாரம்)', 'புதன் (புத வாரம்)', 'வியாழன் (குரு வாரம்)', 'வெள்ளி (சுக்ர வாரம்)', 'சனி (மந்த வாரம்)'];
  const VARA_NAMES_HI = ['रविवार (भानु वार)', 'सोमवार (सोम वार)', 'मंगलवार (मंगल वार)', 'बुधवार (बुध वार)', 'गुरुवार (गुरु वार)', 'शुक्रवार (शुक्र वार)', 'शनिवार (शनि वार)'];

  // 4. YOGA ((Sun + Moon) / 13°20')
  const yogaSum = normalizeDeg(sunSid + moonSid);
  const yogaIndex = Math.floor(yogaSum / nakSpan) % 27;

  // 5. KARANA (Half of a Tithi = 6°)
  const karanaIndex = Math.floor(diffDeg / 6.0) % 60;
  let karanaFixedIdx = 0;
  if (karanaIndex === 0) {
    karanaFixedIdx = 10; // Kimstughna
  } else if (karanaIndex >= 57) {
    karanaFixedIdx = karanaIndex - 50; // Shakuni, Chatushpada, Naga
  } else {
    karanaFixedIdx = (karanaIndex - 1) % 7; // Repeating 7 movable karanas
  }

  // Sunrise/sunset and daytime muhurta windows belong to the location's local civil day.
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const resolvedMidnight = localDateKey && timeZoneId
    ? resolveLocalDateTimeInTimeZone(localDateKey, '00:00', timeZoneId)
    : null;
  const dayStartDate = resolvedMidnight?.utcDate ?? new Date(`${localDateKey}T00:00:00Z`);
  const dayStartTime = Astronomy.MakeTime(dayStartDate);
  const formatLocalClock = (instant: Date): string => timeZoneId
    ? (formatTimeInTimeZone(instant, timeZoneId) ?? 'Unavailable')
    : new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: true
      }).format(instant);
  const localDateOfInstant = (instant: Date): string =>
    (timeZoneId ? getLocalDateKey(instant, timeZoneId) : null) ?? instant.toISOString().slice(0, 10);

  let sunriseInstant: Date | null = null;
  let sunsetInstant: Date | null = null;
  let sunriseStr = 'Unavailable';
  let sunsetStr = 'Unavailable';
  try {
    const sunriseObj = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, 1, dayStartTime, 1.5);
    const sunsetObj = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, dayStartTime, 1.5);
    if (sunriseObj && localDateOfInstant(sunriseObj.date) === localDateKey) {
      sunriseInstant = sunriseObj.date;
      sunriseStr = formatLocalClock(sunriseObj.date);
    }
    if (sunsetObj && localDateOfInstant(sunsetObj.date) === localDateKey) {
      sunsetInstant = sunsetObj.date;
      sunsetStr = formatLocalClock(sunsetObj.date);
    }
  } catch {
    // Some polar locations have no sunrise or sunset on a given civil date.
  }

  const daylightMs = sunriseInstant && sunsetInstant && sunsetInstant.getTime() > sunriseInstant.getTime()
    ? sunsetInstant.getTime() - sunriseInstant.getTime()
    : null;
  const getDaytimePart = (part: number): { start: string; end: string } => {
    if (!daylightMs || !sunriseInstant) return { start: 'Unavailable', end: 'Unavailable' };
    const partMs = daylightMs / 8;
    return {
      start: formatLocalClock(new Date(sunriseInstant.getTime() + (part - 1) * partMs)),
      end: formatLocalClock(new Date(sunriseInstant.getTime() + part * partMs))
    };
  };

  // Traditional weekday segment numbers (1..8), applied to the actual local
  // sunrise-to-sunset interval rather than assuming a fixed 06:00-18:00 day.
  const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
  const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
  const GULIKA_PART = [7, 6, 5, 4, 3, 2, 1];
  const rahuKalam = getDaytimePart(RAHU_PART[varaIndex]);
  const yamaGandam = getDaytimePart(YAMA_PART[varaIndex]);
  const gulikaKalam = getDaytimePart(GULIKA_PART[varaIndex]);

  // Abhijit is the central 1/15th of daytime (about 48 minutes on a 12-hour
  // day), so its duration tracks seasonal daylight at the selected location.
  const abhijitMuhurtham = daylightMs && sunriseInstant
    ? {
        start: formatLocalClock(new Date(sunriseInstant.getTime() + daylightMs * (0.5 - 1 / 30))),
        end: formatLocalClock(new Date(sunriseInstant.getTime() + daylightMs * (0.5 + 1 / 30)))
      }
    : { start: 'Unavailable', end: 'Unavailable' };

  return {
    date: localDateKey ?? date.toISOString().split('T')[0],
    time: localDateTime
      ? `${String(localDateTime.hour).padStart(2, '0')}:${String(localDateTime.minute).padStart(2, '0')}:${String(localDateTime.second).padStart(2, '0')}`
      : date.toISOString().split('T')[1].substring(0, 8),
    cityName,
    country,
    latitude,
    longitude,
    tithiIndex,
    tithiNameEn: TITHI_NAMES_EN[tithiIndex],
    tithiNameTa: TITHI_NAMES_TA[tithiIndex],
    tithiNameHi: TITHI_NAMES_HI[tithiIndex],
    tithiPaksha,
    tithiProgressPercent,
    nakshatraIndex,
    nakshatraNameEn: NAKSHATRAM_NAMES_EN[nakshatraIndex],
    nakshatraNameTa: NAKSHATRAM_NAMES_TA[nakshatraIndex],
    nakshatraNameHi: NAKSHATRAM_NAMES_HI[nakshatraIndex],
    nakshatraPada,
    nakshatraProgressPercent,
    varaIndex,
    varaNameEn: VARA_NAMES_EN[varaIndex],
    varaNameTa: VARA_NAMES_TA[varaIndex],
    varaNameHi: VARA_NAMES_HI[varaIndex],
    yogaIndex,
    yogaNameEn: YOGA_NAMES_EN[yogaIndex],
    yogaNameTa: YOGA_NAMES_TA[yogaIndex],
    yogaNameHi: YOGA_NAMES_HI[yogaIndex],
    karanaIndex: karanaFixedIdx,
    karanaNameEn: KARANA_NAMES_EN[karanaFixedIdx],
    karanaNameTa: KARANA_NAMES_TA[karanaFixedIdx],
    karanaNameHi: KARANA_NAMES_HI[karanaFixedIdx],
    rahuKalam,
    yamaGandam,
    gulikaKalam,
    abhijitMuhurtham,
    sunriseTime: sunriseStr,
    sunsetTime: sunsetStr
  };
}
