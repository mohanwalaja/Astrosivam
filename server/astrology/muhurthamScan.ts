/**
 * MUHURTHAM on the server — one place, used by the order store, the family
 * (multi-order) endpoint and the admin approval flow.
 *
 * The panchangam scan itself is produced by the tested client engine
 * (`src/lib/muhurtham/scanner.ts`) and travels inside the order payload as
 * `muhurthamScan`. Server code never re-implements that astronomy when the scan
 * is present — it validates and normalises it (identical rules to
 * `AstroEngine::calculateMuhurtham()` in PHP). When the scan is missing,
 * `computeMuhurthamResult()` rebuilds it with the same client scanner, but it
 * requires an explicit residence / ceremony location; legacy rows without one
 * are rejected instead of silently using birthplace coordinates.
 */
import {
  describePersonForMuhurtham,
  findNakshatraFromBirthDetails,
  MUHURTHAM_ALGORITHM_VERSION,
  nakshatraMetaByIndex,
  rasiMetaByNumber,
  scanMonthMuhurtham,
  type MuhurthamEventKey,
  type MuhurthamPersonDetails,
  type PersonInput,
  type PersonRole
} from '../../src/lib/muhurtham/scanner.js';
import muhurthamRules from '../../src/lib/muhurtham/rules.json';

/** The 18 ceremonies the scanner understands (mirrors rules.json order). */
export const MUHURTHAM_EVENT_KEYS = new Set<string>([
  'wedding', 'engagement', 'griha_pravesam', 'house_purchase', 'house_construction', 'land_purchase',
  'shifting_home', 'business_start', 'new_job', 'gold_purchase', 'vehicle_purchase', 'education_start',
  'namakaranam', 'annaprasanam', 'seemantham', 'upanayanam', 'karnavedha', 'mundan'
]);

// Human-readable labels for the 18 muhurtham events (mirrors src/lib/muhurtham/rules.json)
export const MUHURTHAM_EVENT_LABELS_EN: Record<string, string> = {
  'wedding': 'Wedding (Vivaha Muhurtham)',
  'griha_pravesam': 'Housewarming (Griha Pravesam)',
  'business_start': 'New Business / Shop Opening',
  'education_start': 'Vidyarambham (Education Start)',
  'vehicle_purchase': 'New Vehicle Purchase',
  'land_purchase': 'Land / Plot Purchase & Registration',
  'house_construction': 'Bhoomi Pooja (House Construction Start)',
  'namakaranam': 'Namakaranam (Baby Naming Ceremony)',
  'house_purchase': 'Buying a Home (House / Flat Purchase)',
  'engagement': 'Engagement (Nichayathartham)',
  'annaprasanam': 'Annaprasanam (First Rice Feeding)',
  'seemantham': 'Seemantham / Baby Shower (Valaikappu)',
  'upanayanam': 'Upanayanam (Sacred Thread / Janeu)',
  'karnavedha': 'Karnavedha (Ear Piercing)',
  'mundan': 'Mundan / Chudakarana (First Haircut)',
  'gold_purchase': 'Buying Gold & Valuables',
  'new_job': 'New Job / Office Joining',
  'shifting_home': 'Shifting / Relocating Home'
};

export const MUHURTHAM_EVENT_LABELS_TA: Record<string, string> = {
  'wedding': 'திருமண சுப முகூர்த்தம்',
  'griha_pravesam': 'கிருஹப்பிரவேசம் (புதுமனை புகுவிழா)',
  'business_start': 'தொழில் / வியாபார துவக்கம்',
  'education_start': 'வித்யாரம்பம் (கல்வி துவக்கம்)',
  'vehicle_purchase': 'புதிய வாகனம் வாங்குதல்',
  'land_purchase': 'நிலம் / மனை வாங்குதல் & பதிவு',
  'house_construction': 'பூமி பூஜை (வீடு கட்டத் துவங்குதல்)',
  'namakaranam': 'நாமகரணம் (குழந்தைக்கு பெயர் சூட்டுதல்)',
  'house_purchase': 'வீடு / ஃபிளாட் வாங்குதல்',
  'engagement': 'நிச்சயதார்த்தம் (நிச்சயம்)',
  'annaprasanam': 'அன்னபிராசனம் (முதல் சாதம்)',
  'seemantham': 'சீமந்தம் / வளைகாப்பு',
  'upanayanam': 'புண்ணுடை சமஸ்காரம் (ஜனேயு)',
  'karnavedha': 'கர்ணவேதம் (காது துளைப்பு)',
  'mundan': 'முண்டம் / முடி மொட்டை அறுத்தல்',
  'gold_purchase': 'தங்கம் / நகைகள் வாங்குதல்',
  'new_job': 'புதிய வேலை / அலுவலக்கு சேர்வு',
  'shifting_home': 'வீட்டு மாற்றம் / குடியேற்றம்'
};

export const MUHURTHAM_EVENT_LABELS_HI: Record<string, string> = {
  'wedding': 'विवाह शुभ मुहूर्त',
  'griha_pravesam': 'गृह प्रवेश मुहूर्त',
  'business_start': 'व्यापार / दुकान प्रारंभ मुहूर्त',
  'education_start': 'विद्यारंभ मुहूर्त',
  'vehicle_purchase': 'नवीन वाहन क्रय मुहूर्त',
  'land_purchase': 'भूमि / प्लॉट क्रय एवं रजिस्ट्री',
  'house_construction': 'भूमि पूजन (गृह निर्माण प्रारंभ)',
  'namakaranam': 'नामकरण संस्कार मुहूर्त',
  'house_purchase': 'मकान / फ्लैट खरीद',
  'engagement': 'निश्चयार्थ (सगाई)',
  'annaprasanam': 'अन्नप्राशन (पहला अन्न)',
  'seemantham': 'सीमंतन / गोद भराई',
  'upanayanam': 'उपनयन (जनेऊ संस्कार)',
  'karnavedha': 'कर्णवेध (कान छिदना)',
  'mundan': 'मुंडन / चूड़ाकरण',
  'gold_purchase': 'स्वर्ण एवं कीमती वस्तु क्रय',
  'new_job': 'नई नौकरी / कार्यालय में सम्मिलन',
  'shifting_home': 'गृह परिवर्तन / कूट-स्थानांतरण'
};

function requireMuhurthamLocation(payload: any): {
  placeName: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timeZoneId: string;
} {
  const placeName = typeof payload?.muhurthamPlace === 'string' ? payload.muhurthamPlace.trim() : '';
  const rawLatitude = payload?.muhurthamLatitude;
  const rawLongitude = payload?.muhurthamLongitude;
  const rawOffset = payload?.muhurthamTimezoneOffsetHours;
  const isNumber = (value: any) => (typeof value === 'number' || typeof value === 'string') &&
    !(typeof value === 'string' && value.trim() === '') && Number.isFinite(Number(value));
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const timezoneOffsetHours = Number(rawOffset);
  if (!placeName || !isNumber(rawLatitude) || latitude < -90 || latitude > 90 ||
      !isNumber(rawLongitude) || longitude < -180 || longitude > 180 ||
      !isNumber(rawOffset) || timezoneOffsetHours < -14 || timezoneOffsetHours > 14) {
    throw new Error('A separate Muhurtham location with valid coordinates and time zone is required to calculate local dates and times.');
  }
  return {
    placeName,
    country: typeof payload?.muhurthamCountry === 'string' ? payload.muhurthamCountry : '',
    latitude,
    longitude,
    timezoneOffsetHours,
    timeZoneId: typeof payload?.muhurthamTimeZoneId === 'string' ? payload.muhurthamTimeZoneId : ''
  };
}

/** Normalises the client scan exactly like `AstroEngine::calculateMuhurtham()`. */
export function normalizeMuhurthamScan(payload: any): any {
  const scan = payload?.muhurthamScan || payload;
  const rawMonths: any[] = Array.isArray(scan?.months)
    ? scan.months
    : [scan?.prevMonth, scan?.chosenMonth, scan?.nextMonth].filter(Boolean);

  let months = rawMonths
    .filter((m: any) => m && Array.isArray(m.days))
    .map((m: any) => {
      const days = m.days
        .filter((d: any) => d && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date.slice(0, 10)))
        .map((d: any) => ({
          date: d.date.slice(0, 10),
          dayOfWeekNameEn: d.dayOfWeekNameEn || '',
          dayOfWeekNameTa: d.dayOfWeekNameTa || d.dayOfWeekNameEn || '',
          dayOfWeekNameHi: d.dayOfWeekNameHi || d.dayOfWeekNameEn || '',
          tithiNameEn: d.tithiNameEn || '',
          tithiNameTa: d.tithiNameTa || d.tithiNameEn || '',
          tithiNameHi: d.tithiNameHi || d.tithiNameEn || '',
          nakshatraNameEn: d.nakshatraNameEn || '',
          nakshatraNameTa: d.nakshatraNameTa || d.nakshatraNameEn || '',
          nakshatraNameHi: d.nakshatraNameHi || d.nakshatraNameEn || '',
          nallaNeram: Array.isArray(d.nallaNeram)
            ? d.nallaNeram.map((w: any) => (w && typeof w === 'object' ? `${w.start || ''}-${w.end || ''}` : String(w || '')))
            : [],
          rahuKalam: d.rahuKalam ? `${d.rahuKalam.start || ''}-${d.rahuKalam.end || ''}` : '',
          yamagandam: d.yamagandam ? `${d.yamagandam.start || ''}-${d.yamagandam.end || ''}` : '',
          grade: ['BEST', 'GOOD', 'FAIR', 'AVOID'].includes(String(d.grade)) ? d.grade : 'FAIR',
          reasonsEn: Array.isArray(d.reasonsEn) ? d.reasonsEn : [],
          reasonsTa: Array.isArray(d.reasonsTa) ? d.reasonsTa : (Array.isArray(d.reasonsEn) ? d.reasonsEn : []),
          reasonsHi: Array.isArray(d.reasonsHi) ? d.reasonsHi : (Array.isArray(d.reasonsEn) ? d.reasonsEn : []),
          doshasEn: Array.isArray(d.doshasEn) ? d.doshasEn : [],
          doshasTa: Array.isArray(d.doshasTa) ? d.doshasTa : (Array.isArray(d.doshasEn) ? d.doshasEn : []),
          doshasHi: Array.isArray(d.doshasHi) ? d.doshasHi : (Array.isArray(d.doshasEn) ? d.doshasEn : []),
          // The per-date personal verdict must survive the order pipeline: the
          // ♥ mark, the Chandrashtama/Janma-Nakshatra exclusion and the
          // per-date note line are all read back from these fields.
          personalChecks: Array.isArray(d.personalChecks)
            ? d.personalChecks.filter((c: any) => c && typeof c === 'object').map((c: any) => ({
                role: String(c.role || 'self'),
                nakshatraIndex: Number(c.nakshatraIndex) || 0,
                nakshatraNameEn: c.nakshatraNameEn || '',
                nakshatraNameTa: c.nakshatraNameTa || c.nakshatraNameEn || '',
                nakshatraNameHi: c.nakshatraNameHi || c.nakshatraNameEn || '',
                taraNameEn: c.taraNameEn || '',
                taraNameTa: c.taraNameTa || '',
                taraNameHi: c.taraNameHi || '',
                taraBadgeEn: c.taraBadgeEn || '',
                taraBadgeTa: c.taraBadgeTa || '',
                taraBadgeHi: c.taraBadgeHi || '',
                isTaraAuspicious: c.isTaraAuspicious === true,
                isChandrashtama: c.isChandrashtama === true,
                isJanmaNakshatra: c.isJanmaNakshatra === true
              }))
            : [],
          personalNoteEn: d.personalNoteEn || '',
          personalNoteTa: d.personalNoteTa || d.personalNoteEn || '',
          personalNoteHi: d.personalNoteHi || d.personalNoteEn || '',
          // Asta / retrograde flags travel with the date so both engines can
          // prove no recommended day sits inside the Sukra (Venus) asta window.
          planetaryHighlights: d.planetaryHighlights && typeof d.planetaryHighlights === 'object'
            ? {
                guruRetrograde: d.planetaryHighlights.guruRetrograde === true,
                guruCombust: d.planetaryHighlights.guruCombust === true,
                sukraRetrograde: d.planetaryHighlights.sukraRetrograde === true,
                sukraCombust: d.planetaryHighlights.sukraCombust === true,
                budhaRetrograde: d.planetaryHighlights.budhaRetrograde === true,
                eclipseNearby: d.planetaryHighlights.eclipseNearby === true
              }
            : undefined
        }));
      const count = (g: string) => days.filter((d: any) => d.grade === g).length;
      return {
        monthKey: m.monthKey || '',
        month: Number(m.month) || 0,
        year: Number(m.year) || 0,
        monthNameEn: m.monthNameEn || '',
        monthNameTa: m.monthNameTa || m.monthNameEn || '',
        monthNameHi: m.monthNameHi || m.monthNameEn || '',
        days,
        bestCount: count('BEST'),
        goodCount: count('GOOD'),
        fairCount: count('FAIR'),
        avoidCount: count('AVOID')
      };
    });

  if (months.length === 0) {
    throw new Error('Muhurtham scan data is missing from the request payload.');
  }
  const muhurthamLocation = requireMuhurthamLocation(payload);
  // Bride + groom are checked together only for the ceremonies that join two
  // people (wedding, engagement); every other ceremony stays a one-person
  // report even if the payload carries a second chart (a stale couple payload,
  // a family-member edit or a hand-built API call must not change that
  // person's dates).
  const bothCharts = eventUsesBothCharts(payload?.eventKey ?? scan?.eventKey);
  if (!bothCharts) {
    months = months.map((month: any) => ({
      ...month,
      days: (Array.isArray(month?.days) ? month.days : []).map((day: any) => {
        const checks = Array.isArray(day?.personalChecks)
          ? day.personalChecks.filter((check: any) => !['bride', 'groom'].includes(String(check?.role || '')))
          : [];
        const droppedSecondChart = Array.isArray(day?.personalChecks) && checks.length !== day.personalChecks.length;
        const noteStale = droppedSecondChart && (
          noteMentionsSecondChart(String(day?.personalNoteEn || '')) ||
          noteMentionsSecondChart(String(day?.personalNoteTa || '')) ||
          noteMentionsSecondChart(String(day?.personalNoteHi || ''))
        );
        return { ...day, personalChecks: checks, ...(noteStale ? { personalNoteEn: '', personalNoteTa: '', personalNoteHi: '' } : {}) };
      })
    }));
  }
  const allPersons = normalizeMuhurthamPersons(payload?.persons ?? scan?.persons);
  // Without a second chart the report still needs the primary person: keep the
  // first non-bride/groom entry, and if the payload only carried the couple
  // (a stale wedding scan) read the first of them as the single native.
  const primaryPerson = allPersons.find(person => !['bride', 'groom'].includes(person.role));
  const normalizedPersons = bothCharts
    ? allPersons
    : primaryPerson
      ? [primaryPerson]
      : allPersons.slice(0, 1).map(person => ({ ...person, role: 'self' as const }));
  // The window label is the REAL covered range ("07 Oct 2026 – 31 Mar 2027"),
  // identical to the PHP engine and the browser builder.
  const windowRange = windowRangeFromMonths(months);

  return {
    muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
    devoteeName: payload?.name || payload?.devoteeName || 'User',
    dob: payload?.dob || '',
    tob: payload?.tob || '',
    birthPlace: payload?.birthPlace || '',
    country: payload?.country || '',
    latitude: payload?.latitude,
    longitude: payload?.longitude,
    timezoneOffsetHours: payload?.timezoneOffsetHours,
    timeZoneId: payload?.timeZoneId || '',
    muhurthamPlace: muhurthamLocation.placeName,
    muhurthamCountry: muhurthamLocation.country,
    muhurthamLatitude: muhurthamLocation.latitude,
    muhurthamLongitude: muhurthamLocation.longitude,
    muhurthamTimezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
    muhurthamTimeZoneId: muhurthamLocation.timeZoneId,
    eventKey: payload?.eventKey || 'wedding',
    eventTitleEn: payload?.eventTitleEn || MUHURTHAM_EVENT_LABELS_EN[payload?.eventKey || ''] || payload?.eventKey || 'Subha Muhurtham',
    eventTitleTa: payload?.eventTitleTa || MUHURTHAM_EVENT_LABELS_TA[payload?.eventKey || ''] || '',
    eventTitleHi: payload?.eventTitleHi || MUHURTHAM_EVENT_LABELS_HI[payload?.eventKey || ''] || '',
    selectedMonth: payload?.selectedMonth || scan?.selectedMonth || '',
    windowLabelEn: windowRange || `${months.length}-Month Muhurtham Calendar`,
    windowLabelTa: windowRange || `${months.length} மாத சுப முகூர்த்த காலண்டர்`,
    windowLabelHi: windowRange || `${months.length} माह का शुभ मुहूर्त कैलेंडर`,
    months,
    persons: normalizedPersons,
    // 'both' = bride's and groom's charts were both checked; 'single' = only one
    // person's details were supplied, which the report states in plain words.
    personalCheckMode: normalizedPersons.length >= 2 ? 'both' : 'single',
    orderNumber: String(payload?.orderNumber ?? payload?.order_number ?? scan?.orderNumber ?? ''),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Normalises one report person (bride / groom / single native) exactly like
 * `AstroEngine::calculateMuhurtham()`: the computed indices always win, and the
 * display names are derived from them when a client did not send them.
 */
export function normalizeMuhurthamPerson(person: any): MuhurthamPersonDetails | null {
  if (!person || typeof person !== 'object') return null;
  const roleRaw = String(person.role || 'self');
  const role: PersonRole = roleRaw === 'bride' || roleRaw === 'groom' || roleRaw === 'child' || roleRaw === 'mother'
    ? roleRaw
    : 'self';
  const nakshatraIndex = Number(person.nakshatraIndex);
  if (!Number.isInteger(nakshatraIndex) || nakshatraIndex < 0 || nakshatraIndex > 26) return null;
  const nak = nakshatraMetaByIndex(nakshatraIndex);
  const rasiNumber = Number(person.rasiNumber) || Math.floor((nakshatraIndex * 4) / 9) + 1;
  const rasi = rasiMetaByNumber(rasiNumber);
  const lagnaRasiNumber = Number(person.lagnaRasiNumber) || 0;
  const lagna = lagnaRasiNumber >= 1 && lagnaRasiNumber <= 12 ? rasiMetaByNumber(lagnaRasiNumber) : null;
  return {
    role,
    name: String(person.name || ''),
    dob: String(person.dob || ''),
    tob: String(person.tob || ''),
    birthPlace: String(person.birthPlace || ''),
    nakshatraIndex,
    nakshatraNameEn: person.nakshatraNameEn || nak?.nameEn || '',
    nakshatraNameTa: person.nakshatraNameTa || nak?.nameTa || '',
    nakshatraNameHi: person.nakshatraNameHi || nak?.nameHi || '',
    rasiNumber,
    rasiNameEn: person.rasiNameEn || rasi?.nameEn || '',
    rasiNameTa: person.rasiNameTa || rasi?.nameTa || '',
    rasiNameHi: person.rasiNameHi || rasi?.nameHi || '',
    lagnaRasiNumber,
    lagnaNameEn: person.lagnaNameEn || lagna?.nameEn || '',
    lagnaNameTa: person.lagnaNameTa || lagna?.nameTa || '',
    lagnaNameHi: person.lagnaNameHi || lagna?.nameHi || ''
  };
}

/**
 * "07 Oct 2026 – 31 Mar 2027": the actual date range the scan covers, derived
 * from the days that are present (the first non-past date through the last day
 * of the last month). Mirrors the TS builder and the PHP engine.
 */
export function windowRangeFromMonths(months: any): string {
  const dates = (Array.isArray(months) ? months : [])
    .flatMap((month: any) => (Array.isArray(month?.days) ? month.days : []).map((day: any) => String(day?.date || '').slice(0, 10)))
    .filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  if (dates.length === 0) return '';
  return `${formatReportDateEn(dates[0])} – ${formatReportDateEn(dates[dates.length - 1])}`;
}

const MONTH_ABBR_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatReportDateEn(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]} ${MONTH_ABBR_EN[parseInt(match[2], 10) - 1] || match[2]} ${match[1]}`;
}

/**
 * These ceremonies join two people, so their dates are read against BOTH charts
 * (bride + groom). Every other ceremony is a one-person report, so a bride/groom
 * block that arrives with such a payload (a re-submitted or hand-built order) is
 * stripped instead of silently changing that person's dates.
 * Mirrors `$MUHURTHAM_TWO_CHART_EVENTS` in engine.php.
 */
export const MUHURTHAM_TWO_CHART_EVENTS = ['wedding', 'engagement'] as const;

export function eventUsesBothCharts(eventKey: unknown): boolean {
  return (MUHURTHAM_TWO_CHART_EVENTS as readonly string[]).includes(String(eventKey || ''));
}

/** Bride/groom markers that may appear inside a per-date personal note. */
const SECOND_CHART_NOTE_TOKENS = ['bride', 'groom', 'மணமகள்', 'மணமகன்', 'வधू', 'वर'];

function noteMentionsSecondChart(note: string): boolean {
  const lower = note.toLowerCase();
  return SECOND_CHART_NOTE_TOKENS.some(token => lower.includes(token.toLowerCase()));
}

export function normalizeMuhurthamPersons(persons: any): MuhurthamPersonDetails[] {
  if (!Array.isArray(persons)) return [];
  const seen = new Set<string>();
  const result: MuhurthamPersonDetails[] = [];
  for (const person of persons) {
    const normalized = normalizeMuhurthamPerson(person);
    if (!normalized) continue;
    const key = `${normalized.role}:${normalized.nakshatraIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

/** Second-person (bride/groom) fields carried by a wedding order payload. */
export interface MuhurthamSecondPerson {
  role: 'bride' | 'groom';
  name: string;
  dob: string;
  tob: string;
  birthPlace: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timeZoneId: string;
}

/**
 * Reads a complete second person from the payload (`bride` / `groom` object).
 * Returns null when the order is for a single person, and throws when a partial
 * second person is supplied — a half-entered chart must never be silently
 * dropped from the checks.
 */
export function readSecondPerson(payload: any, expectedRole: 'bride' | 'groom'): MuhurthamPersonDetails | null {
  const raw = payload?.[expectedRole];
  if (!raw || typeof raw !== 'object') return null;
  const isFilled = ['name', 'dob', 'tob', 'birthPlace'].some(key => String(raw[key] ?? '').trim() !== '') ||
    raw.latitude !== undefined || raw.longitude !== undefined;
  if (!isFilled) return null;
  const dob = String(raw.dob || '').trim();
  const tob = String(raw.tob || '').trim();
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  const timezoneOffsetHours = Number(raw.timezoneOffsetHours);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !/^\d{1,2}:\d{2}$/.test(tob) ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timezoneOffsetHours)) {
    throw new Error(`The ${expectedRole}'s birth date, time, and birth place with coordinates are required to check both charts.`);
  }
  const person = describePersonForMuhurtham(expectedRole, String(raw.name || ''), {
    dob,
    tob,
    birthPlace: String(raw.birthPlace || ''),
    timezoneOffsetHours,
    latitude,
    longitude
  });
  if (!person) {
    throw new Error(`The ${expectedRole}'s birth details could not be read. Please re-check the date and time of birth.`);
  }
  return person;
}

/**
 * Rebuilds the six-month scan from the order payload (used when a stored /
 * family-member payload has no scan yet). The birth location is used only for
 * the Janma Nakshatra/Rasi; the selected Muhurtham location drives every local
 * calendar date and clock time. Same six-month anchor rule as the client page.
 */
export function computeMuhurthamResult(input: {
  inputPayload?: any;
  userName?: string;
  country?: string;
}): any {
  const p: any = input?.inputPayload || {};
  const eventKey = String(p.eventKey || 'wedding') as MuhurthamEventKey;
  const eventConfig: any = (muhurthamRules as any).events?.[eventKey];
  if (!eventConfig || !MUHURTHAM_EVENT_KEYS.has(eventKey)) {
    throw new Error('Please select a valid Muhurtham ceremony before the order is approved.');
  }

  const birthLatitude = Number(p.latitude);
  const birthLongitude = Number(p.longitude);
  const birthTimezoneOffsetHours = Number(p.timezoneOffsetHours);
  const muhurthamLocation = requireMuhurthamLocation(p);
  if (!p.dob || !p.tob || !p.birthPlace || !Number.isFinite(birthLatitude) || birthLatitude < -90 || birthLatitude > 90 ||
      !Number.isFinite(birthLongitude) || birthLongitude < -180 || birthLongitude > 180 ||
      !Number.isFinite(birthTimezoneOffsetHours) || birthTimezoneOffsetHours < -14 || birthTimezoneOffsetHours > 14) {
    throw new Error('Birth date, time, and a selected birth place with coordinates are required to calculate the Muhurtham report.');
  }

  const location = {
    placeName: muhurthamLocation.placeName,
    latitude: muhurthamLocation.latitude,
    longitude: muhurthamLocation.longitude,
    timezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
    ...(muhurthamLocation.timeZoneId ? { timeZoneId: muhurthamLocation.timeZoneId } : {})
  };
  const birthNakshatra = findNakshatraFromBirthDetails(
    String(p.dob), String(p.tob), false, birthTimezoneOffsetHours, birthLatitude, birthLongitude
  );
  // A wedding or engagement is checked against BOTH charts. The second person
  // (bride or groom) travels in the same payload shape the live order form
  // submits, and is read only for those two ceremonies: no other ceremony may
  // be judged against a second chart.
  const secondRole: 'bride' | 'groom' = p.groom ? 'groom' : 'bride';
  const secondPerson = eventUsesBothCharts(eventKey) ? readSecondPerson(p, secondRole) : null;
  const primaryPerson = describePersonForMuhurtham(secondPerson ? (secondRole === 'bride' ? 'groom' : 'bride') : 'self', String(p.name || p.devoteeName || input.userName || 'User'), {
    dob: String(p.dob),
    tob: String(p.tob),
    birthPlace: String(p.birthPlace || ''),
    timezoneOffsetHours: birthTimezoneOffsetHours,
    latitude: birthLatitude,
    longitude: birthLongitude
  });
  const personDetails: MuhurthamPersonDetails[] = [primaryPerson, secondPerson]
    .filter((person): person is MuhurthamPersonDetails => Boolean(person));
  const persons: PersonInput[] = personDetails.map(person => ({
    role: person.role,
    nakshatraIndex: person.nakshatraIndex,
    rasiNumber: person.rasiNumber
  }));

  const selectedMonthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(p.selectedMonth || ''));
  const now = new Date();
  const defaultTargetDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const targetYear = selectedMonthMatch ? Number(selectedMonthMatch[1]) : defaultTargetDate.getFullYear();
  const targetMonth = selectedMonthMatch ? Number(selectedMonthMatch[2]) : defaultTargetDate.getMonth() + 1;
  const selectedDate = new Date(targetYear, targetMonth - 1, 1);
  const months = Array.from({ length: 6 }, (_, offset) => {
    const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset - 2, 1);
    return scanMonthMuhurtham(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      location,
      eventKey,
      { persons, birthDate: String(p.dob), skipPastDates: true }
    );
  });

  const devoteeName = secondPerson
    ? `${primaryPerson?.name || 'User'} & ${secondPerson.name}`
    : (p.name || p.devoteeName || input.userName || 'User');
  const windowRange = windowRangeFromMonths(months);

  return {
    muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
    devoteeName,
    dob: p.dob,
    tob: p.tob,
    birthPlace: p.birthPlace,
    country: typeof p.country === 'string' ? p.country : '',
    latitude: birthLatitude,
    longitude: birthLongitude,
    timezoneOffsetHours: birthTimezoneOffsetHours,
    timeZoneId: p.timeZoneId || '',
    muhurthamPlace: muhurthamLocation.placeName,
    muhurthamCountry: muhurthamLocation.country,
    muhurthamLatitude: muhurthamLocation.latitude,
    muhurthamLongitude: muhurthamLocation.longitude,
    muhurthamTimezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
    muhurthamTimeZoneId: muhurthamLocation.timeZoneId,
    eventKey,
    eventTitleEn: eventConfig.titleEn || MUHURTHAM_EVENT_LABELS_EN[eventKey] || eventKey,
    eventTitleTa: eventConfig.titleTa || MUHURTHAM_EVENT_LABELS_TA[eventKey] || '',
    eventTitleHi: eventConfig.titleHi || MUHURTHAM_EVENT_LABELS_HI[eventKey] || '',
    eventDescriptionEn: eventConfig.descriptionEn || '',
    eventDescriptionTa: eventConfig.descriptionTa || '',
    eventDescriptionHi: eventConfig.descriptionHi || '',
    selectedMonth: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
    // The window label is the REAL covered range, not the "2 prior months…"
    // rule wording (same derivation as the PHP engine).
    windowLabelEn: windowRange || '2 months before the selected month + the selected month and the following 3 months',
    windowLabelTa: windowRange || 'தேர்ந்தெடுத்த மாதத்திற்கு முன் 2 மாதங்கள் + தேர்ந்தெடுத்த மாதம் மற்றும் அதற்குப் பின் 3 மாதங்கள்',
    windowLabelHi: windowRange || 'चुने हुए महीने से पहले 2 महीने + चयनित माह और उसके बाद के 3 महीने',
    months,
    persons: personDetails,
    personalCheckMode: personDetails.length >= 2 ? 'both' : 'single',
    generatedAt: new Date().toISOString()
  };
}

function isMuhurthamScanCurrentForPayload(scan: any, payload: any): boolean {
  const context = scan?.inputContext;
  if (!context || typeof context !== 'object') return false;
  // The second person travels as a nested `bride` / `groom` object while the
  // scan stamp carries the fields flat: compare against one flat view.
  const secondPerson = [payload?.bride, payload?.groom].find(person => person && typeof person === 'object') || null;
  const flat: any = { ...payload };
  if (secondPerson) {
    const textPairs: Array<[string, string]> = [
      ['brideName', 'name'], ['brideDob', 'dob'], ['brideTob', 'tob'],
      ['brideBirthPlace', 'birthPlace'], ['brideCountry', 'country'], ['brideTimeZoneId', 'timeZoneId']
    ];
    const numberPairs: Array<[string, string]> = [
      ['brideLatitude', 'latitude'], ['brideLongitude', 'longitude'], ['brideTimezoneOffsetHours', 'timezoneOffsetHours']
    ];
    for (const [flatKey, personKey] of textPairs) {
      if (flat[flatKey] === undefined) flat[flatKey] = secondPerson[personKey] ?? '';
    }
    for (const [flatKey, personKey] of numberPairs) {
      if (flat[flatKey] === undefined) flat[flatKey] = secondPerson[personKey];
    }
  }
  const asText = (value: any) => (value === undefined || value === null ? '' : String(value));
  const sameText = (key: string) => asText(context[key]) === asText(flat[key]);
  const sameNumber = (key: string) => {
    const rawContext = context[key];
    const rawPayload = flat[key];
    const contextAbsent = rawContext === undefined || rawContext === null || rawContext === '';
    const payloadAbsent = rawPayload === undefined || rawPayload === null || rawPayload === '';
    // A second person is optional: when neither side carries the key the scan
    // is still current, so a single-person order is never needlessly rescanned.
    if (contextAbsent || payloadAbsent) return contextAbsent && payloadAbsent;
    const fromContext = Number(rawContext);
    const fromPayload = Number(rawPayload);
    return Number.isFinite(fromContext) && Number.isFinite(fromPayload) && fromContext === fromPayload;
  };
  const textKeys = [
    'dob', 'tob', 'birthPlace', 'country', 'timeZoneId',
    'muhurthamPlace', 'muhurthamCountry', 'muhurthamTimeZoneId', 'eventKey', 'selectedMonth',
    // Second person (bride/groom) — a change to either chart must invalidate
    // a cached scan.
    'brideName', 'brideDob', 'brideTob', 'brideBirthPlace', 'brideCountry', 'brideTimeZoneId'
  ];
  const numberKeys = [
    'latitude', 'longitude', 'timezoneOffsetHours',
    'muhurthamLatitude', 'muhurthamLongitude', 'muhurthamTimezoneOffsetHours',
    'brideLatitude', 'brideLongitude', 'brideTimezoneOffsetHours'
  ];
  const months = Array.isArray(scan.months) ? scan.months : [];
  const hasSixMonthWindow = months.length === 6 && months.every(month => Array.isArray(month?.days));
  return hasSixMonthWindow &&
    textKeys.every(sameText) && numberKeys.every(sameNumber) &&
    String(scan.eventKey ?? '') === String(payload?.eventKey ?? '') &&
    String(scan.selectedMonth ?? '') === String(payload?.selectedMonth ?? '');
}

/**
 * Order-payload → Muhurtham result, used at order time. Reuses a browser scan
 * only when its version and full calculation-input context match the order;
 * unversioned, unstamped, partial, or stale scans are recomputed server-side.
 */
export function computeMuhurthamResultFromPayload(
  input: { inputPayload?: any; userName?: string; country?: string },
  recalculate: (input: { inputPayload?: any; userName?: string; country?: string }) => any = computeMuhurthamResult
): any {
  const payload = input?.inputPayload || {};
  const scan = payload.muhurthamScan || payload;
  const hasScan = Boolean(payload.muhurthamScan) || Array.isArray(payload.months);
  const scanVersion = Number(scan?.muhurthamAlgorithmVersion ?? payload.muhurthamAlgorithmVersion ?? 0);
  if (hasScan && scanVersion === MUHURTHAM_ALGORITHM_VERSION && isMuhurthamScanCurrentForPayload(scan, payload)) {
    try {
      return normalizeMuhurthamScan(payload);
    } catch {
      // fall through to a fresh scan
    }
  }
  // A stale browser scan cannot be relabeled as current after the scoring
  // rules change; regenerate dates and grades from the current engine instead.
  return recalculate(input);
}
