import rulesData from '../lib/muhurtham/rules.json';
import { rasiMetaByNumber } from '../lib/muhurtham/scanner';
import { REPORT_FONT_LINK_TAG } from './reportFonts';
import { normalizeReportLanguage } from './reportLanguage';
import { buildMuhurthamReportNotes } from './muhurthamReportNotes';
import { AppLanguage } from '../types';
import { buildReportHeaderHtml, reportHeaderCss } from './reportHeader';
import { formatBirthDate } from './formatUtils';

export interface MuhurthamDayRow {
  date: string;
  dayOfWeekNameEn?: string;
  dayOfWeekNameTa?: string;
  dayOfWeekNameHi?: string;
  tithiNameEn?: string;
  tithiNameTa?: string;
  tithiNameHi?: string;
  nakshatraNameEn?: string;
  nakshatraNameTa?: string;
  nakshatraNameHi?: string;
  grade: string;
  nallaNeram?: Array<{ start?: string; end?: string; labelEn?: string } | string>;
  rahuKalam?: { start?: string; end?: string; labelEn?: string } | string;
  yamagandam?: { start?: string; end?: string; labelEn?: string } | string;
  reasonsEn?: string[];
  reasonsTa?: string[];
  reasonsHi?: string[];
  doshasEn?: string[];
  doshasTa?: string[];
  doshasHi?: string[];
  personalChecks?: Array<{
    role?: string;
    nakshatraNameEn?: string;
    nakshatraNameTa?: string;
    nakshatraNameHi?: string;
    taraNameEn?: string;
    taraNameTa?: string;
    taraNameHi?: string;
    isTaraAuspicious?: boolean;
    isChandrashtama?: boolean;
    isJanmaNakshatra?: boolean;
  }>;
  /** Short per-date line summarising the Chandrashtama / Tara Bala check. */
  personalNoteEn?: string;
  personalNoteTa?: string;
  personalNoteHi?: string;
}

/**
 * One person carried by a two-person Muhurtham report (wedding / engagement):
 * Rasi and Lagna, computed from their own birth details. A single-person
 * ceremony sends one entry with role 'self'.
 */
export interface MuhurthamPersonRow {
  role?: string;
  name?: string;
  dob?: string;
  tob?: string;
  birthPlace?: string;
  nakshatraIndex?: number;
  nakshatraNameEn?: string;
  nakshatraNameTa?: string;
  nakshatraNameHi?: string;
  rasiNumber?: number;
  rasiNameEn?: string;
  rasiNameTa?: string;
  rasiNameHi?: string;
  lagnaRasiNumber?: number;
  lagnaNameEn?: string;
  lagnaNameTa?: string;
  lagnaNameHi?: string;
  taraNameEn?: string;
  taraNameTa?: string;
  taraNameHi?: string;
  isTaraAuspicious?: boolean;
}

/**
 * A recommended (BEST/GOOD) date is "personally favourable" when it was
 * checked against the devotee's own Janma Nakshatra / Rasi and every person
 * has a good Tara Balam with no Chandrashtama — i.e. it is not just a generally
 * good day, it is specifically good for this horoscope.
 */
export function isPersonalMuhurthamDay(day: MuhurthamDayRow): boolean {
  const grade = (day.grade || '').toUpperCase();
  if (grade !== 'BEST' && grade !== 'GOOD') return false;
  const checks = Array.isArray(day.personalChecks) ? day.personalChecks : [];
  return checks.length > 0 &&
    checks.every(c => c && c.isTaraAuspicious === true && !c.isChandrashtama && !c.isJanmaNakshatra);
}

export interface MuhurthamMonthRow {
  monthKey: string;
  month: number;
  year: number;
  monthNameEn: string;
  monthNameTa: string;
  monthNameHi: string;
  days: MuhurthamDayRow[];
  goodCount: number;
  bestCount: number;
  fairCount: number;
  avoidCount: number;
}

export interface MuhurthamScanResult {
  muhurthamAlgorithmVersion?: number;
  devoteeName?: string;
  dob?: string;
  tob?: string;
  birthPlace?: string;
  country?: string;
  muhurthamPlace?: string;
  muhurthamCountry?: string;
  muhurthamTimeZoneId?: string;
  muhurthamTimezoneOffsetHours?: number;
  eventKey?: string;
  eventTitleEn?: string;
  eventTitleTa?: string;
  eventTitleHi?: string;
  eventDescriptionEn?: string;
  eventDescriptionTa?: string;
  eventDescriptionHi?: string;
  windowLabelEn?: string;
  windowLabelTa?: string;
  windowLabelHi?: string;
  selectedMonth?: string;
  generatedAt?: string;
  months?: MuhurthamMonthRow[];
  prevMonth?: MuhurthamMonthRow;
  chosenMonth?: MuhurthamMonthRow;
  nextMonth?: MuhurthamMonthRow;
  persons?: MuhurthamPersonRow[];
  /** 'both' when the bride's and groom's charts were both checked. */
  personalCheckMode?: 'both' | 'single';
  orderNumber?: string;
  reportNumber?: string;
}

/** Clock in the report's one 12-hour format: "02:00 AM" / "06:30 AM". */
function formatClock12(value: string | undefined): string {
  const raw = String(value || '');
  if (!raw.includes(':')) return raw || '—';
  const [hStr, mStr] = raw.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return raw;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(isNaN(m) ? 0 : m).padStart(2, '0')} ${ampm}`;
}

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');

const localise = (lang: AppLanguage, en?: unknown, ta?: unknown, hi?: unknown) =>
  escapeHtml(lang === 'ta' ? ta ?? en ?? '' : lang === 'hi' ? hi ?? en ?? '' : en ?? '');

function formatNallaNeramCompact(value: MuhurthamDayRow['nallaNeram']): string {
  if (!value) return '—';
  const items = Array.isArray(value) ? value : [value];
  const parseClock = (raw: string) => {
    const match = /^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i.exec(String(raw || '').trim());
    if (!match) return null;
    return `${parseInt(match[1], 10)}:${match[2]} ${match[3].toUpperCase()}M`;
  };
  const parts = items.map(item => {
    if (typeof item === 'string') return item.trim();
    const start = item?.start ? String(item.start).trim() : '';
    const end = item?.end ? String(item.end).trim() : '';
    if (!start || !end) return item?.labelEn || '';
    const startClock = parseClock(start);
    const endClock = parseClock(end);
    if (startClock && endClock) {
      const sameHalf = startClock.slice(-2) === endClock.slice(-2);
      return sameHalf ? `${startClock.slice(0, -3)} – ${endClock}` : `${startClock} – ${endClock}`;
    }
    return `${start} – ${end}`;
  }).filter(Boolean);
  return parts.join(' · ') || '—';
}

function formatDateDisplay(dateStr: string): { dayNum: string; monthYear: string; fullFormatted: string } {
  if (!dateStr || !dateStr.includes('-')) {
    return { dayNum: dateStr, monthYear: '', fullFormatted: dateStr };
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { dayNum: dateStr, monthYear: '', fullFormatted: dateStr };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = months[monthIdx] || parts[1];
  const dayNum = parts[2];
  const year = parts[0];
  return {
    dayNum,
    monthYear: `${monthName} ${year}`,
    fullFormatted: `${dayNum} ${monthName} ${year}`
  };
}

function resolveMonths(result: MuhurthamScanResult): MuhurthamMonthRow[] {
  if (Array.isArray(result.months) && result.months.length > 0) return result.months;
  return [result.prevMonth, result.chosenMonth, result.nextMonth].filter(Boolean) as MuhurthamMonthRow[];
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * THE report date format, used everywhere a calendar date is printed:
 * "07 Oct 2026" (DD Mon YYYY, English month names). Keeping one helper means a
 * date can never appear in two different formats in the same report.
 */
function formatReportDate(iso: string | undefined): string {
  const raw = String(iso || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw || '—';
  const month = MONTH_ABBR[parseInt(match[2], 10) - 1] || match[2];
  return `${match[3]} ${month} ${match[1]}`;
}

/**
 * The actual date range the calendar covers, derived from the scanned days
 * ("07 Oct 2026 – 31 Mar 2027"). The first scanned day is already the first
 * non-past date, so this is the honest window, not the "2 prior months…" rule.
 */
function windowRangeLabel(months: MuhurthamMonthRow[]): string {
  const dates = months
    .flatMap(month => (month.days || []).map(day => String(day.date || '').slice(0, 10)))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  if (dates.length === 0) return '';
  return `${formatReportDate(dates[0])} – ${formatReportDate(dates[dates.length - 1])}`;
}

/**
 * Issued-on stamp in the same format the marriage report uses
 * ("07 Oct 2026, 06:35 GMT+5:30") in the Muhurtham location's own timezone, so
 * every report reads the same way.
 */
function formatIssuedAt(generatedAt: string | undefined, timeZoneId?: string): string {
  const date = generatedAt ? new Date(generatedAt) : new Date();
  if (isNaN(date.getTime())) return formatReportDate(undefined);
  const zone = timeZoneId && timeZoneId.trim() ? timeZoneId.trim() : Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: zone, timeZoneName: 'short'
    });
  } catch {
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}

/** Reference number, e.g. ASTRO-MUH-20261007 (the order number when one exists). */
function muhurthamReferenceNumber(result: MuhurthamScanResult): string {
  const explicit = (result as any).orderNumber || (result as any).reportNumber;
  if (explicit) return String(explicit);
  const date = result.generatedAt ? new Date(result.generatedAt) : new Date();
  if (isNaN(date.getTime())) return 'ASTRO-MUH';
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `ASTRO-MUH-${stamp}`;
}

const ROLE_TA: Record<string, string> = { bride: 'மணப்பெண்', groom: 'மணமகன்', self: 'ஜாதகர்', child: 'குழந்தை', mother: 'தாய்' };
const ROLE_HI: Record<string, string> = { bride: 'वधू', groom: 'वर', self: 'जातक', child: 'शिशु', mother: 'माता' };
const ROLE_EN: Record<string, string> = { bride: 'Bride', groom: 'Groom', self: 'Native', child: 'Child', mother: 'Mother' };

/** Role label that also understands the legacy 'You' role. */
function personRoleLabel(role: string | undefined, lang: AppLanguage): string {
  const key = role === 'bride' || role === 'groom' || role === 'child' || role === 'mother' ? role : 'self';
  return lang === 'ta' ? ROLE_TA[key] : lang === 'hi' ? ROLE_HI[key] : ROLE_EN[key];
}

/**
 * The per-date Chandrashtama / Tara Bala line. Rendered from the check flags
 * (browser engine) or, for older scans, from the pre-built note strings, so a
 * date can never silently claim a personal check that was not run.
 */
function personalNoteFor(day: MuhurthamDayRow, lang: AppLanguage): string {
  const stored = lang === 'ta' ? day.personalNoteTa : lang === 'hi' ? day.personalNoteHi : day.personalNoteEn;
  if (stored) return stored;
  const checks = Array.isArray(day.personalChecks) ? day.personalChecks : [];
  if (checks.length === 0) return '';
  const parts = checks
    .filter(c => c && (c.isChandrashtama || c.isJanmaNakshatra || c.isTaraAuspicious !== true))
    .map(c => {
      const role = personRoleLabel(c.role, lang);
      if (c.isJanmaNakshatra) return `${role}: ${lang === 'ta' ? 'ஜன்ம நட்சத்திரம்' : lang === 'hi' ? 'जन्म नक्षत्र' : 'Janma Nakshatra'}`;
      if (c.isChandrashtama) return `${role}: ${lang === 'ta' ? 'சந்திராஷ்டமம்' : lang === 'hi' ? 'चंद्राष्टम' : 'Chandrashtama'}`;
      const tara = lang === 'ta' ? c.taraNameTa : lang === 'hi' ? c.taraNameHi : c.taraNameEn;
      return `${role}: ${tara || ''}`.trim();
    });
  const everyonePasses = checks.every(c => c && c.isTaraAuspicious === true && !c.isChandrashtama && !c.isJanmaNakshatra);
  if (everyonePasses) {
    return lang === 'ta' ? 'சந்திராஷ்டமம் இல்லை · நல்ல தாரா பலம்'
      : lang === 'hi' ? 'चंद्राष्टम नहीं · शुभ तारा बल'
      : 'No Chandrashtama · good Tara Bala';
  }
  return parts.join(' · ');
}

/**
 * Two-page Muhurtham report geometry:
 *  - page 1 = devotee details + date calendar (BEST/GOOD only)
 *  - page 2 = remaining dates + a compact ceremony-specific selection guide
 * Reserve space for the guide before choosing density / splitting date rows.
 */
export const MUHURTHAM_TOTAL_PAGES = 2;
// Leave room for wrapped devotee / place details as well as the A4 footer.
export const MUHURTHAM_PAGE1_DATE_BUDGET_MM = 160;
export const MUHURTHAM_PAGE2_DATE_BUDGET_MM = 78;
// Extra height the two-person (bride + groom) particulars panel needs on page 1.
export const MUHURTHAM_COUPLE_PANEL_EXTRA_MM = 12;
// Vertical space reserved on page 1 for the ♥ legend line whenever at least
// one personally favourable date exists, so date rows never overflow the page.
export const MUHURTHAM_PERSONAL_NOTE_RESERVE_MM = 11;
// A4 midpoint is 148.5mm; the guide belongs in the lower half of page 2. The
// reserved height leaves room for the full explanation (three paragraphs in
// Tamil / Hindi) plus the authorisation block inside the same two pages.
export const MUHURTHAM_PAGE2_NOTES_START_MM = 114;
export const MUHURTHAM_DENSITY_TIERS = [
  { fontPx: 9.4, padMm: 1.5 },
  { fontPx: 8.6, padMm: 1.15 },
  { fontPx: 7.8, padMm: 0.9 },
  { fontPx: 7.1, padMm: 0.7 },
  { fontPx: 6.5, padMm: 0.55 },
  { fontPx: 6.0, padMm: 0.4 }
];

export const MUHURTHAM_DATE_COLUMN_RATIOS = [0.19, 0.21, 0.46, 0.14];
export const MUHURTHAM_TIME_TEXT_WIDTH_MM = 188 * MUHURTHAM_DATE_COLUMN_RATIOS[2] - 2 - 4;
export const MUHURTHAM_TIME_CHAR_EM = 0.62;

export function muhurthamTimeFontScale(textLength: number, fontMm: number): number {
  if (!Number.isFinite(textLength) || textLength <= 0 || !Number.isFinite(fontMm) || fontMm <= 0) return 1;
  const capacity = MUHURTHAM_TIME_TEXT_WIDTH_MM / (MUHURTHAM_TIME_CHAR_EM * fontMm);
  if (textLength <= capacity) return 1;
  return Math.max(0.8, capacity / textLength);
}

export function buildMuhurthamHtml(result: MuhurthamScanResult, lang: AppLanguage = 'en'): string {
  lang = normalizeReportLanguage(lang);
  const isTa = lang === 'ta';
  const isHi = lang === 'hi';
  const months = resolveMonths(result);
  const event: any = (rulesData.events as Record<string, any>)[result.eventKey || 'wedding'] || {};
  
  const title = isTa ? result.eventTitleTa || event.titleTa || result.eventTitleEn || event.titleEn || 'விவாக சுப முகூர்த்தம்'
    : isHi ? result.eventTitleHi || event.titleHi || result.eventTitleEn || event.titleEn || 'शुभ विवाह मुहूर्त'
    : result.eventTitleEn || event.titleEn || 'Wedding (Vivaha Muhurtham)';
    
  const devotee = escapeHtml(result.devoteeName || 'User');
  const formatPlace = (name?: string, country?: string) => {
    const trimmedName = String(name || '').trim().replace(/[,\s]+$/, '');
    const trimmedCountry = String(country || '').trim().replace(/[,\s]+$/, '');
    const missingLocation = isTa ? 'குறிப்பிடப்படவில்லை' : isHi ? 'उल्लेख नहीं किया गया' : 'Not provided';
    if (!trimmedName) return trimmedCountry || missingLocation;
    if (!trimmedCountry) return trimmedName;
    const tail = trimmedName.split(',').map(part => part.trim()).filter(Boolean).pop() || '';
    return tail.toLowerCase().includes(trimmedCountry.toLowerCase())
      ? trimmedName
      : `${trimmedName}, ${trimmedCountry}`;
  };
  const place = escapeHtml(formatPlace(result.muhurthamPlace, result.muhurthamCountry));
  const birthPlace = escapeHtml(formatPlace(result.birthPlace, result.country));

  // Dates of birth are always printed as DD/MM/YYYY (e.g. "27/07/1990").
  const formattedDob = formatBirthDate(result.dob) || '—';
  const formattedTob = formatClock12(result.tob);

  // Every person the report is checked against. A wedding carries both the
  // bride and the groom; any other ceremony carries the single person. A
  // single chart is stated in words — never presented as if two were checked.
  const persons: MuhurthamPersonRow[] = (Array.isArray(result.persons) ? result.persons : [])
    .filter(person => person && Number(person.nakshatraIndex) >= 0)
    .map(person => ({
      ...person,
      rasiNameEn: person.rasiNameEn || rasiMetaByNumber(Number(person.rasiNumber) || 0)?.nameEn || '',
      rasiNameTa: person.rasiNameTa || rasiMetaByNumber(Number(person.rasiNumber) || 0)?.nameTa || '',
      rasiNameHi: person.rasiNameHi || rasiMetaByNumber(Number(person.rasiNumber) || 0)?.nameHi || ''
    }));
  const bride = persons.find(person => person.role === 'bride');
  const groom = persons.find(person => person.role === 'groom');
  const singlePersonMode = !(bride && groom);
  const windowRange = windowRangeLabel(months);
  const referenceNo = muhurthamReferenceNumber(result);
  const issuedOn = formatIssuedAt(result.generatedAt, result.muhurthamTimeZoneId);

  // Gather recommended BEST and GOOD dates
  const dates = months.flatMap(month => (month.days || [])
    .filter(day => (day.grade || '').toUpperCase() === 'BEST' || (day.grade || '').toUpperCase() === 'GOOD')
    .map(day => ({
      ...day,
      monthKey: month.monthKey,
      monthLabel: isTa ? month.monthNameTa : isHi ? month.monthNameHi : month.monthNameEn
    })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const bestCount = dates.filter(d => (d.grade || '').toUpperCase() === 'BEST').length;
  const goodCount = dates.filter(d => (d.grade || '').toUpperCase() === 'GOOD').length;
  // When any date carries the ♥ mark, page 1 shows a one-line text legend
  // explaining how heart-marked dates differ from the other good dates.
  const hasPersonalDates = dates.some(day => isPersonalMuhurthamDay(day));
  const anchorMonth = months[2] || months[0];
  const selectedMonthLabel = anchorMonth
    ? isTa ? anchorMonth.monthNameTa : isHi ? anchorMonth.monthNameHi : anchorMonth.monthNameEn
    : result.selectedMonth || '';

  const labels = isTa
    ? {
        docHeader: 'சுப முகூர்த்த அறிக்கை',
        clientInfo: 'பயனர் விவரங்கள்', coupleInfo: 'மணமகன் & மணமகள் விவரங்கள்',
        name: 'பெயர்', dob: 'பிறந்த தேதி', tob: 'பிறந்த நேரம்', place: 'முகூர்த்த இடம் (உள்ளூர் நேரம்)', birthPlace: 'ஜன்ம நட்சத்திரத்திற்கான பிறந்த இடம்',
        window: 'கால அளவு',
        // The actual dates the calendar covers — never the "+2 / +3 months" rule wording.
        windowVal: windowRange || `${selectedMonthLabel} முதல் ஆறு மாதங்கள்`,
        summaryCount: `${dates.length} சிறந்த மற்றும் சுப நாட்கள்`,
        datesTableTitle: 'பரிந்துரைக்கப்பட்ட தேதிகள் — ஆறு மாதங்கள்',
        // States the reference time of the Nakshatra column: the star at local sunrise.
        datesTableNote: 'தேதி • கிழமை • நட்சத்திரம் (சூரிய உதயம்) • நல்ல நேரம்',
        continuedLabel: 'தொடர்ச்சி',
        bandBest: 'உத்தமம்', bandGood: 'சுபம்',
        pageTag: (page: number) => `பக்கம் ${page} / 2`,
        colDate: 'தேதி & கிழமை', colStar: 'நட்சத்திரம் (சூரிய உதயம்)', colTime: 'நல்ல நேரம்', colGrade: 'தரம்',
        certifiedBy: 'சான்றளித்தவர்: ASTRO SIVAM',
        monthDatesLabel: (count: number) => `${count} சிறந்த / சுப தேதிகள்`,
        monthEmpty: 'இந்த மாதத்தில் சிறந்த அல்லது சுப தேதிகள் இல்லை.',
        singlePersonNote: 'ஒருவரின் விவரங்கள் மட்டும் பயன்படுத்தப்பட்டன — சந்திராஷ்டமம் மற்றும் தாரா பலம் இந்த ஒருவரின் ஜாதகத்திற்கு மட்டுமே சரிபார்க்கப்பட்டது.',
        brideLabel: 'மணமகள்', groomLabel: 'மணமகன்',
        starLabel: 'ஜன்ம நட்சத்திரம்', rasiLabel: 'ராசி', lagnaLabel: 'லக்னம்',
        reference: 'குறிப்பு எண்', issuedOn: 'வழங்கப்பட்ட நாள்', authorisedBy: 'அங்கீகரிப்பு',
        signatory: 'அங்கீகரிக்கப்பட்ட கையொப்பம்', signatoryDesk: 'ASTRO SIVAM வேத ஆய்வு மையம்'
      }
    : isHi
    ? {
        docHeader: 'शुभ मुहूर्त रिपोर्ट',
        clientInfo: 'जातक विवरण', coupleInfo: 'वर एवं वधू विवरण',
        name: 'नाम', dob: 'जन्म तिथि', tob: 'जन्म समय', place: 'मुहूर्त स्थान (स्थानीय समय)', birthPlace: 'जन्म नक्षत्र हेतु जन्म स्थान',
        window: 'अवधि',
        windowVal: windowRange || `${selectedMonthLabel} से छह माह`,
        summaryCount: `${dates.length} उत्तम एवं शुभ मुहूर्त दिवस`,
        datesTableTitle: 'अनुशंसित तिथियाँ — छह माह',
        datesTableNote: 'दिनांक • वार • नक्षत्र (स्थानीय सूर्योदय) • शुभ समय',
        continuedLabel: 'जारी',
        bandBest: 'उत्तम', bandGood: 'शुभ',
        pageTag: (page: number) => `पृष्ठ ${page} / 2`,
        colDate: 'दिनांक व वार', colStar: 'नक्षत्र (सूर्योदय)', colTime: 'शुभ समय', colGrade: 'श्रेणी',
        certifiedBy: 'प्रमाणित: ASTRO SIVAM',
        monthDatesLabel: (count: number) => `${count} उत्तम / शुभ तिथियाँ`,
        monthEmpty: 'इस माह कोई BEST या GOOD तिथि नहीं मिली।',
        singlePersonNote: 'केवल एक व्यक्ति का विवरण उपयोग किया गया है — चंद्राष्टम और तारा बल केवल इसी जातक की कुंडली से जाँचे गए हैं।',
        brideLabel: 'वधू', groomLabel: 'वर',
        starLabel: 'जन्म नक्षत्र', rasiLabel: 'राशि', lagnaLabel: 'लग्न',
        reference: 'संदर्भ क्रमांक', issuedOn: 'जारी तिथि', authorisedBy: 'प्राधिकरण',
        signatory: 'अधिकृत हस्ताक्षरकर्ता', signatoryDesk: 'ASTRO SIVAM वैदिक अनुसंधान केंद्र'
      }
    : {
        docHeader: 'SUBHA MUHURTHAM REPORT',
        clientInfo: 'USER PARTICULARS', coupleInfo: 'BRIDE & GROOM PARTICULARS',
        name: 'FULL NAME', dob: 'DATE OF BIRTH', tob: 'TIME OF BIRTH', place: 'MUHURTHAM LOCATION (LOCAL TIMES)', birthPlace: 'Birth place for Janma Nakshatra',
        window: 'CALCULATION WINDOW',
        windowVal: windowRange || `${selectedMonthLabel}: six months`,
        summaryCount: `${dates.length} Best & Good Dates across ${months.length} Months`,
        datesTableTitle: 'RECOMMENDED MUHURTHAM DATES — SIX MONTHS',
        datesTableNote: 'Date • Weekday • Nakshatra (at sunrise) • Nalla Neram',
        continuedLabel: 'Continued from page 1',
        bandBest: 'BEST', bandGood: 'GOOD',
        pageTag: (page: number) => `PAGE ${page} / 2`,
        colDate: 'DATE & DAY', colStar: 'NAKSHATRA (AT SUNRISE)', colTime: 'BEST TIME (NALLA NERAM)', colGrade: 'GRADE',
        certifiedBy: 'Certified by ASTRO SIVAM',
        monthDatesLabel: (count: number) => `${count} BEST / GOOD dates`,
        monthEmpty: 'No BEST or GOOD dates were found for this month.',
        singlePersonNote: 'Only one person\u2019s details were used \u2014 Chandrashtama and Tara Bala were checked for that single chart alone.',
        brideLabel: 'Bride', groomLabel: 'Groom',
        starLabel: 'Janma Nakshatra', rasiLabel: 'Rasi', lagnaLabel: 'Lagna',
        reference: 'Reference', issuedOn: 'Issued On', authorisedBy: 'Authorisation',
        signatory: 'Authorised Signatory', signatoryDesk: 'ASTRO SIVAM Vedic Research Desk'
      };

  /**
   * One bride/groom card: name, birth details and their own Janma Nakshatra,
   * Rasi and Lagna. Both people are shown whenever a couple order supplies
   * both charts.
   */
  const personCardHtml = (person: MuhurthamPersonRow | undefined, roleLabel: string, l: any, personLang: AppLanguage): string => {
    if (!person) return '';
    const star = personLang === 'ta' ? person.nakshatraNameTa : personLang === 'hi' ? person.nakshatraNameHi : person.nakshatraNameEn;
    const rasi = personLang === 'ta' ? person.rasiNameTa : personLang === 'hi' ? person.rasiNameHi : person.rasiNameEn;
    const lagna = personLang === 'ta' ? person.lagnaNameTa : personLang === 'hi' ? person.lagnaNameHi : person.lagnaNameEn;
    const meta = [formatBirthDate(person.dob), formatClock12(person.tob)].filter(Boolean).join(' • ');
    return `<div class="person-card">
      <div class="person-role">${escapeHtml(roleLabel)}</div>
      <div class="person-name">${escapeHtml(person.name || '—')}</div>
      <div class="person-meta">${escapeHtml(meta)}</div>
      <div class="person-astro"><span>${escapeHtml(l.starLabel)}:</span> ${escapeHtml(star || '—')}<span>·</span><span>${escapeHtml(l.rasiLabel)}:</span> ${escapeHtml(rasi || '—')}${lagna ? `<span>·</span><span>${escapeHtml(l.lagnaLabel)}:</span> ${escapeHtml(lagna)}` : ''}</div>
      <div class="person-place">${escapeHtml(person.birthPlace || '')}</div>
    </div>`;
  };

  /** Compact Nakshatra / Rasi line for the single-person particulars card. */
  const personStarLine = (person: MuhurthamPersonRow | undefined, l: any, personLang: AppLanguage): string => {
    if (!person) return '';
    const star = personLang === 'ta' ? person.nakshatraNameTa : personLang === 'hi' ? person.nakshatraNameHi : person.nakshatraNameEn;
    const rasi = personLang === 'ta' ? person.rasiNameTa : personLang === 'hi' ? person.rasiNameHi : person.rasiNameEn;
    if (!star && !rasi) return '';
    return `<span class="detail-note">${escapeHtml(l.starLabel)}: ${escapeHtml(star || '—')} · ${escapeHtml(l.rasiLabel)}: ${escapeHtml(rasi || '—')}</span>`;
  };

  // Never pretend two charts were checked when only one was supplied.
  const singlePersonNoteHtml = `<div class="single-person-note">${escapeHtml(labels.singlePersonNote)}</div>`;

  // Build month blocks - clean dates only
  type MuhurthamRenderRow = { blockIndex: number; kind: 'band' | 'date' | 'note'; html: string; timeText?: string };
  // Set while building the rows: a date row with a personal note is taller, so
  // the density model below has to account for the extra line.
  let hasPersonalNotes = false;

  const monthBlocks = months.map((month, monthIndex) => {
    const monthLabel = isTa ? month.monthNameTa : isHi ? month.monthNameHi : month.monthNameEn;
    const monthDates = dates.filter(day => day.monthKey === month.monthKey);
    const bestInMonth = monthDates.filter(day => (day.grade || '').toUpperCase() === 'BEST').length;
    const goodInMonth = monthDates.length - bestInMonth;
    const bandCounts = monthDates.length
      ? `★ ${bestInMonth} ${labels.bandBest} · ✓ ${goodInMonth} ${labels.bandGood}`
      : escapeHtml(labels.monthDatesLabel(0));
    const bandHtml = (suffix = ''): string => `<tr class="month-band-row"><td colspan="4"><span class="band-name">${escapeHtml(monthLabel)}${suffix}</span><span class="band-counts">${bandCounts}</span></td></tr>`;
    const dateRows: MuhurthamRenderRow[] = monthDates.map(day => {
      const isBest = (day.grade || '').toUpperCase() === 'BEST';
      const isPersonal = isPersonalMuhurthamDay(day);
      const dateInfo = formatDateDisplay(day.date);
      const dayOfWeek = localise(lang, day.dayOfWeekNameEn, day.dayOfWeekNameTa, day.dayOfWeekNameHi);
      const star = localise(lang, day.nakshatraNameEn, day.nakshatraNameTa, day.nakshatraNameHi);
      const timing = escapeHtml(formatNallaNeramCompact(day.nallaNeram));
      // Small per-date line proving the Chandrashtama / Tara Bala check ran for
      // each person (and naming the failing person when one fails).
      const note = personalNoteFor(day, lang);
      if (note) hasPersonalNotes = true;
      const noteHtml = note ? `<div class="personal-note">${escapeHtml(note)}</div>` : '';
      return {
        blockIndex: monthIndex,
        kind: 'date' as const,
        timeText: formatNallaNeramCompact(day.nallaNeram),
        html: `<tr class="date-row ${isBest ? 'row-best' : 'row-good'}${isPersonal ? ' row-personal' : ''}"><td class="col-date-wrap"><div class="date-cell"><span class="date-num">${escapeHtml(dateInfo.dayNum)}</span><span class="day-badge">${escapeHtml(dayOfWeek)}</span></div></td><td class="col-star-wrap"><div class="primary-star">${isPersonal ? '<span class="personal-mark">♥</span>' : ''}${escapeHtml(star || '—')}</div>${noteHtml}</td><td class="col-time-wrap"><div class="time-block"><span class="time-clock">⏰</span><span class="time-text">${timing}</span></div></td><td class="col-grade-wrap"><span class="grade-pill ${isBest ? 'pill-best' : 'pill-good'}">${isBest ? '★ ' + escapeHtml(labels.bandBest) : '✓ ' + escapeHtml(labels.bandGood)}</span></td></tr>`
      };
    });
    const rows = dateRows.length
      ? dateRows
      : [{ blockIndex: monthIndex, kind: 'note' as const, html: `<tr class="date-row row-empty-month"><td colspan="4" class="month-empty-line">${escapeHtml(labels.monthEmpty)}</td></tr>` }];
    return { monthLabel, bandHtml, rows, count: monthDates.length };
  });

  const renderRows: MuhurthamRenderRow[] = [];
  monthBlocks.forEach((block) => {
    renderRows.push({ blockIndex: block.rows[0]?.blockIndex ?? 0, kind: 'band', html: block.bandHtml() });
    block.rows.forEach(row => renderRows.push(row));
  });

  // Choose date density after reserving room for details and the selection guide.
  const page1BudgetMm = MUHURTHAM_PAGE1_DATE_BUDGET_MM
    - (hasPersonalDates ? MUHURTHAM_PERSONAL_NOTE_RESERVE_MM : 0)
    // A second person's card makes the particulars panel taller; reserve the
    // space here so the page count never changes.
    - (!singlePersonMode ? MUHURTHAM_COUPLE_PANEL_EXTRA_MM : 0);
  const rowHeightMm = (fontPx: number, padMm: number) =>
    fontPx * 0.3528 * 1.5 + padMm * 2 + 0.3
    // The per-date Chandrashtama / Tara Bala line renders under the star.
    + (hasPersonalNotes ? fontPx * 0.3528 * 1.5 : 0);
  const densityTiers = MUHURTHAM_DENSITY_TIERS.map(tier => {
    const rowHeight = rowHeightMm(tier.fontPx, tier.padMm);
    return {
      fontPx: tier.fontPx,
      padMm: tier.padMm,
      rowHeight,
      // One spare row per page covers the split and a repeated month band.
      capacity: Math.floor(page1BudgetMm / rowHeight) + Math.floor(MUHURTHAM_PAGE2_DATE_BUDGET_MM / rowHeight) - 2
    };
  });
  let density = densityTiers.find(tier => tier.capacity >= renderRows.length) || densityTiers[densityTiers.length - 1];
  if (density.capacity < renderRows.length) {
    const scale = ((page1BudgetMm + MUHURTHAM_PAGE2_DATE_BUDGET_MM) * 0.97) / (renderRows.length * density.rowHeight);
    density = { ...density, fontPx: density.fontPx * scale, padMm: density.padMm * scale, rowHeight: density.rowHeight * scale };
  }

  // Fix text overlap: scale down long Nalla Neram lines + ensure no spill into grade column
  const timeScaleFor = (row: MuhurthamRenderRow) =>
    row.timeText ? muhurthamTimeFontScale(row.timeText.length, density.fontPx * 0.2646) : 1;
  const fittedRows = renderRows.map(row => {
    const scale = timeScaleFor(row);
    if (scale >= 0.999) return row;
    return {
      ...row,
      html: row.html.replace(
        '<span class="time-text">',
        `<span class="time-text" style="font-size: calc(var(--row-font, 7.8px) * ${scale.toFixed(3)})">`
      )
    };
  });

  const page1Capacity = Math.max(4, Math.floor(page1BudgetMm / density.rowHeight) - 1);
  const page2Capacity = Math.max(0, Math.floor(MUHURTHAM_PAGE2_DATE_BUDGET_MM / density.rowHeight));
  const page1Rows = fittedRows.slice(0, page1Capacity);
  const page2Rows = fittedRows.slice(page1Capacity);

  if (page2Rows.length && page1Rows.length && page1Rows[page1Rows.length - 1].kind === 'band') {
    page2Rows.unshift(page1Rows.pop() as MuhurthamRenderRow);
  }
  const datesContinueOnPage2 = page2Rows.length > 0;
  if (datesContinueOnPage2 && page2Rows[0].kind !== 'band') {
    const carriedIndex = page2Rows[0].blockIndex;
    const startedOnPage1 = page1Rows.some(row => row.blockIndex === carriedIndex);
    if (startedOnPage1 && page2Rows.length < page2Capacity) {
      page2Rows.unshift({ blockIndex: carriedIndex, kind: 'band', html: monthBlocks[carriedIndex].bandHtml(` (${labels.continuedLabel})`) });
    }
  }

  const densityVars = `--row-font:${density.fontPx.toFixed(2)}px;--row-pad:${density.padMm.toFixed(2)}mm;--band-font:${(density.fontPx * 0.92).toFixed(2)}px;--row-height:${density.rowHeight.toFixed(2)}mm;`;
  const datesTableHead = `<thead><tr><th>${escapeHtml(labels.colDate)}</th><th>${escapeHtml(labels.colStar)}</th><th>${escapeHtml(labels.colTime)}</th><th>${escapeHtml(labels.colGrade)}</th></tr></thead>`;
  const datesTable = (rows: MuhurthamRenderRow[]) => `<table class="muhurtham-table six-month-table" style="${densityVars}">${datesTableHead}<tbody>${rows.map(row => row.html).join('\n')}</tbody></table>`;
  const page1DatesHtml = datesTable(page1Rows);
  const page2DatesHtml = datesContinueOnPage2 ? datesTable(page2Rows) : '';

  // One date format + the report's own timezone everywhere.
  const systemCertifiedLine = `${labels.certifiedBy} • ${issuedOn}`;
  const notes = buildMuhurthamReportNotes(result, lang);
  // Plain-text page-1 legend: what ♥ heart-marked dates mean versus the other
  // good dates. Rendered only when a heart-marked date actually exists.
  const personalDatesNoteHtml = hasPersonalDates
    ? `<div class="personal-dates-note">${escapeHtml(notes.personalMarkNote)}</div>`
    : '';
  // The page-2 guide must never render a heading without a body: each <p> is
  // emitted only when it carries real text, and the paragraph that names every
  // check is always present.
  const notesParagraphs = [
    `<p><strong>${escapeHtml(notes.checksHeading)}</strong>${escapeHtml(notes.checksText)}</p>`,
    (notes.weekdayText
      ? `<p><strong>${escapeHtml(notes.weekdayHeading)}</strong>${escapeHtml(notes.weekdayText)}</p>`
      : ''),
    ((notes.summaryText || notes.selectionText)
      ? `<p><strong>${escapeHtml(notes.selectionHeading)}</strong>${notes.summaryText ? `<span class="selection-counts">${escapeHtml(notes.summaryText)}</span>` : ''}${escapeHtml(notes.selectionText)}</p>`
      : '')
  ].filter(Boolean).join('\n    ');
  const reportNotesHtml = `<aside class="muhurtham-selection-notes">
    <h2>${escapeHtml(notes.title)}</h2>
    ${notesParagraphs}
  </aside>`;

  // Authorisation block — mirrors the marriage report's attestation (reference
  // number, issued-on, prepared-for, signatory) without adding a page.
  const preparedForLabel = singlePersonMode
    ? escapeHtml(persons[0]?.name || result.devoteeName || '')
    : `${escapeHtml(bride?.name || '')} &amp; ${escapeHtml(groom?.name || '')}`;
  const attestationHtml = `<div class="muhurtham-attestation">
      <div class="attest-line">
        <span class="attest-label">${escapeHtml(labels.reference)}</span>
        <span class="attest-value">${escapeHtml(referenceNo)}</span>
      </div>
      <div class="attest-line">
        <span class="attest-label">${escapeHtml(labels.issuedOn)}</span>
        <span class="attest-value">${escapeHtml(issuedOn)}</span>
      </div>
      <div class="attest-line">
        <span class="attest-label">${escapeHtml(labels.authorisedBy)}</span>
        <span class="attest-value">${preparedForLabel}</span>
      </div>
      <div class="attest-sign">
        <div class="signature-rule"></div>
        <div class="signature-block">
          <div class="signatory-label">${escapeHtml(labels.signatory)}</div>
          <div class="signatory-desk">${escapeHtml(labels.signatoryDesk)}</div>
        </div>
      </div>
    </div>`;
  const allDatesNote = isTa
    ? `பரிந்துரைக்கப்பட்ட ${dates.length} தேதிகளும் பக்கம் 1-ல் உள்ளன.`
    : isHi ? `सभी ${dates.length} अनुशंसित तिथियाँ पृष्ठ 1 पर दी गई हैं।`
    : `All ${dates.length} recommended dates are listed on page 1.`;

  const fontFamilies = isTa
    ? "'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif"
    : isHi
    ? "'Noto Sans Devanagari', 'Plus Jakarta Sans', sans-serif"
    : "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const headerFont = isTa
    ? "'Baloo Thambi 2', serif"
    : isHi
    ? "'Yatra One', serif"
    : "'Cinzel', serif";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<title>ASTRO SIVAM - ${escapeHtml(labels.docHeader)}</title>
${REPORT_FONT_LINK_TAG}
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Baloo+Thambi+2:wght@600;700;800&family=Yatra+One&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Tamil:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap');

  :root {
    --maroon: #881337;
    --maroon-dark: #4c0519;
    --gold: #b45309;
    --gold-light: #fef3c7;
    --gold-border: #d7a85c;
    --green: #047857;
    --emerald-light: #ecfdf5;
    --slate-bg: #f8fafc;
    --slate-border: #e2e8f0;
    --ink: #0f172a;
    --ink-light: #334155;
    --ink-muted: #64748b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page { size: A4 portrait; margin: 0; }

  body {
    background: #ffffff;
    font-family: ${fontFamilies};
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
  }

  /* min-height (not height): a sheet is always at least one A4, and a report
     with more content than one sheet grows instead of clipping its rows. */
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    font-family: ${fontFamilies};
    line-height: normal; /* same inheritance inside the iframe and HTML export */
    color: var(--ink);
    position: relative;
    padding: 7mm 11mm 7mm;
    box-sizing: border-box;
  }

  .inner {
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  ${reportHeaderCss(headerFont)}

  .devotee-panel {
    background: var(--slate-bg); border: 1px solid var(--slate-border); border-radius: 8px;
    padding: 2.5mm 4mm; margin-bottom: 2.5mm;
    /* Shares a little of the spare height so a short date list does not have
       to absorb all of it inside its rows. */
    flex: 1 0 auto; min-height: 0; display: flex; flex-direction: column;
  }
  .devotee-panel h2 {
    font-family: ${headerFont}; color: var(--maroon); font-size: 13.5px; font-weight: 800;
    margin-bottom: 1.5mm; border-bottom: 1px solid var(--slate-border); padding-bottom: 0.8mm;
    display: flex; align-items: center; justify-content: space-between;
  }
  /* Bride + groom side by side: each card carries their own Janma Nakshatra,
     Rasi and Lagna, so the reader sees both charts were used. */
  .couple-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 3mm; flex: 1 0 auto; min-height: 0; }
  .person-card {
    background: #ffffff; border: 1px solid var(--slate-border); border-radius: 6px;
    padding: 1.4mm 2.4mm; display: flex; flex-direction: column; gap: 0.6mm; min-width: 0;
  }
  .person-role {
    color: var(--gold); font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .person-name { color: var(--maroon); font-family: ${headerFont}; font-size: 13px; font-weight: 800; line-height: 1.15; }
  .person-meta { color: var(--ink-light); font-size: 8.6px; font-weight: 700; }
  .person-astro { color: var(--ink); font-size: 9.4px; font-weight: 800; line-height: 1.3; }
  .person-astro span { color: var(--ink-muted); font-weight: 700; margin-right: 0.8mm; }
  .person-astro span + span { margin-left: 1.6mm; }
  .person-place { color: var(--ink-muted); font-size: 7.6px; font-weight: 600; }
  .couple-place { margin-top: 1.6mm; padding-top: 1.2mm; border-top: 1px solid var(--slate-border); }
  /* One person's details only — stated in words, never implied otherwise. */
  .single-person-note {
    margin-top: 1.6mm; background: #fffbeb; border: 1px solid #fde68a; border-left: 2.5px solid var(--gold);
    border-radius: 4px; padding: 1.1mm 2mm; color: #78350f; font-size: 8.4px; font-weight: 700; line-height: 1.35;
  }
  .details-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1.4fr; gap: 2mm 3.5mm; flex: 1 0 auto; min-height: 0; align-content: center; }
  .detail-card { background: #ffffff; border-radius: 6px; padding: 1.5mm 2.5mm; border: 1px solid var(--slate-border); }
  .detail-label { color: var(--gold); font-weight: 800; display: block; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0.4mm; }
  .detail-val { font-weight: 800; color: var(--ink); font-size: 13px; line-height: 1.25; word-break: break-word; }
  .detail-note { display: block; margin-top: 0.8mm; color: var(--ink-muted); font-size: 8px; line-height: 1.25; word-break: break-word; }

  .ceremony-summary-bar {
    background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%); border: 1.5px solid #fde68a; border-radius: 8px;
    padding: 2.2mm 4mm; margin-bottom: 2.5mm; display: flex; align-items: center; justify-content: space-between;
    gap: 3mm; flex: 1 0 auto; min-height: 0;
  }
  .ceremony-info { display: flex; flex-direction: column; gap: 0.6mm; min-width: 0; flex: 1 1 auto; }
  .ceremony-title-large { font-family: ${headerFont}; font-size: 15px; font-weight: 800; color: var(--maroon); }
  /* The sparkle sits with the title, never alone on its own line. */
  .ceremony-emoji { font-size: 15px; margin-right: 1.2mm; }
  .ceremony-window { font-size: 9.5px; color: var(--ink-muted); font-weight: 700; }
  .summary-badges { display: flex; align-items: center; gap: 2mm; flex-shrink: 0; }
  .badge-best-summary { background: #d1fae5; color: #065f46; border: 1px solid #34d399; padding: 1mm 2.8mm; border-radius: 5px; font-size: 11.5px; font-weight: 800; white-space: nowrap; }
  .badge-good-summary { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 1mm 2.8mm; border-radius: 5px; font-size: 11.5px; font-weight: 800; white-space: nowrap; }

  .table-panel {
    flex: 1; background: #ffffff; border: 1px solid var(--slate-border); border-radius: 8px;
    padding: 0; margin-bottom: 2mm; overflow: hidden; display: flex; flex-direction: column;
  }

  .muhurtham-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .muhurtham-table thead th {
    background: var(--maroon); color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.6px; padding: 2.6mm 3mm; text-align: left; border-bottom: 2px solid var(--gold);
  }
  .muhurtham-table thead th:nth-child(1) { width: 19%; }
  .muhurtham-table thead th:nth-child(2) { width: 21%; }
  .muhurtham-table thead th:nth-child(3) { width: 46%; }
  .muhurtham-table thead th:nth-child(4) { width: 14%; text-align: center; }

  .date-row td { border-bottom: 1px solid #f1f5f9; padding: 3.2mm 3mm; vertical-align: middle; }
  .date-row:nth-child(even) { background: #fafbfc; }
  .row-best { background: #f4fbf7 !important; }

  .date-cell { display: flex; align-items: center; gap: 3mm; }
  .date-num { font-size: 26px; font-weight: 900; color: var(--maroon); line-height: 1; font-family: ${headerFont}; min-width: 32px; }
  .day-badge { font-size: 10.5px; font-weight: 800; color: var(--gold); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 0.6mm; }
  .primary-star { font-size: 13.5px; font-weight: 800; color: var(--maroon); line-height: 1.25; }

  .time-block {
    background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 1.8mm 2.6mm;
    display: inline-flex; align-items: center; gap: 2mm; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    max-width: 100%; min-width: 0;
  }
  .time-clock { font-size: 13px; line-height: 1; flex-shrink: 0; }
  .time-text {
    font-size: 13.5px; font-weight: 800; color: #0f172a; letter-spacing: 0.2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: 100%;
  }
  .col-grade-wrap { text-align: center; }
  .grade-pill {
    display: inline-block; padding: 1.8mm 2.8mm; border-radius: 6px; font-size: 11px; font-weight: 800;
    letter-spacing: 0.3px; text-transform: uppercase; white-space: nowrap;
  }
  .pill-best { background: #d1fae5; color: #065f46; border: 1.5px solid #34d399; }
  .pill-good { background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; }

  .page-bottom-brand {
    text-align: center; font-size: 8.5px; color: var(--ink-muted); font-weight: 600;
    margin-top: 1.5mm; letter-spacing: 0.3px; flex-shrink: 0;
  }

  /* Calendar layout; the selection guide follows in normal flow. */
  .muhurtham-dates-page .inner { justify-content: flex-start; gap: 1.5mm; }
  .muhurtham-dates-page .header { margin-bottom: 0; }
  /* Growing block of the page: takes the bulk of the spare height (and never
     shrinks, so a full date list is never clipped to make room for it). */
  .dates-section { display: flex; flex-direction: column; flex: 6 0 auto; min-height: 0; gap: 1.4mm; }
  .dates-section-head {
    display: flex; align-items: baseline; justify-content: space-between; gap: 4mm;
    padding: 1.1mm 2mm; border-left: 3px solid var(--gold); background: #fffaf0;
  }
  .dates-section-head h2 { color: var(--maroon); font-family: ${headerFont}; font-size: 10.5px; font-weight: 900; }
  .dates-section-head span { color: var(--green); font-size: 7.4px; font-weight: 800; }
  .six-month-panel { flex: 1; min-height: 0; }
  /* Growing block: the date table always fills its panel, so a month with few
     muhurtham dates spreads them over the sheet instead of leaving it blank. */
  .six-month-table { font-size: var(--row-font, 7.8px); flex: 1 0 auto; min-height: 0; }
  .six-month-table thead th { padding: 1.3mm 1mm; font-size: calc(var(--row-font, 7.8px) * 0.82); letter-spacing: 0.2px; }
  .six-month-table thead th:nth-child(1) { width: 19%; }
  .six-month-table thead th:nth-child(2) { width: 21%; }
  .six-month-table thead th:nth-child(3) { width: 46%; }
  .six-month-table thead th:nth-child(4) { width: 14%; text-align: center; }
  .six-month-table .date-row td { padding: var(--row-pad, 0.9mm) 1mm; line-height: 1.24; vertical-align: middle; }
  /* The table is the growing block, so a month with few auspicious dates has
     tall rows: centring the copy keeps those rows looking set, not empty. */
  .six-month-table .date-row > td > * { align-items: center; }
  .six-month-table .month-band-row td, .six-month-table .row-empty-month td { vertical-align: middle; }
  .six-month-table .date-row td, .six-month-table .primary-star { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .six-month-table .date-cell { display: flex; align-items: baseline; gap: 1.4mm; white-space: nowrap; overflow: hidden; }
  .six-month-table .date-num { min-width: 15px; font-size: calc(var(--row-font, 7.8px) * 1.42); line-height: 1; }
  .six-month-table .day-badge { font-size: calc(var(--row-font, 7.8px) * 0.9); margin-top: 0; letter-spacing: 0; overflow: hidden; text-overflow: ellipsis; }
  .six-month-table .primary-star { font-size: var(--row-font, 7.8px); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
  .six-month-table .time-block { border: none; background: transparent; box-shadow: none; padding: 0; gap: 1mm; min-width: 0; max-width: 100%; }
  .six-month-table .col-time-wrap { overflow: hidden; min-width: 0; max-width: 100%; }
  .six-month-table .time-clock { font-size: calc(var(--row-font, 7.8px) * 1.05); flex-shrink: 0; }
  .six-month-table .time-text { font-size: var(--row-font, 7.8px); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .six-month-table .grade-pill { padding: 0.4mm 0.7mm; border-width: 1px; border-radius: 3px; font-size: calc(var(--row-font, 7.8px) * 0.8); letter-spacing: 0; max-width: 100%; overflow: hidden; }
  .six-month-table .col-grade-wrap { text-align: center; overflow: hidden; }
  .six-month-table .month-band-row td {
    background: linear-gradient(90deg, #fdf2f4, #fffaf0); border-top: 1px solid var(--gold-border);
    border-bottom: 1px solid var(--gold-border); padding: calc(var(--row-pad, 0.9mm) * 0.85) 1.4mm;
  }
  .six-month-table .month-band-row .band-name { color: var(--maroon); font-size: var(--band-font, 7.4px); font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; }
  .six-month-table .month-band-row .band-counts { float: right; color: var(--green); font-size: calc(var(--band-font, 7.4px) * 0.92); font-weight: 800; }
  .six-month-table .row-empty-month td { background: #f8fafc; }
  .six-month-table .month-empty-line { color: var(--ink-muted); font-size: calc(var(--row-font, 7.8px) * 0.9); font-weight: 700; text-align: center; }

  /* Keep the guide in the second half of page 2, without covering dates.
     The upper block may grow for a longer continuation; it never clips rows. */
  .muhurtham-page2-upper {
    min-height: calc(${MUHURTHAM_PAGE2_NOTES_START_MM}mm - 7mm - 1.8mm);
    display: flex; flex-direction: column; gap: 1.8mm;
    /* Grows with the continuation table so page 2 fills the sheet too. */
    flex: 1 1 auto;
  }
  .muhurtham-page2-upper .dates-section { flex: 1 1 auto; min-height: 0; }

  /* Normal-flow selection guide: never absolutely positioned over date rows.
     It owns the lower half of page 2 on its own and is set in real reading
     type - far larger than the date tables above it. */
  .muhurtham-selection-notes {
    flex: 1 0 auto; display: flex; flex-direction: column; justify-content: space-evenly;
    border: 1px solid var(--slate-border); border-left: 3px solid var(--gold);
    border-radius: 6px; background: #fffaf0; padding: 2.4mm 3.4mm;
    color: var(--ink-light); font-size: 14.4px; line-height: 1.36;
  }
  .muhurtham-selection-notes h2 { color: var(--maroon); font-size: 16.5px; font-weight: 800; line-height: 1.28; }
  .muhurtham-selection-notes p { margin-top: 1.6mm; }
  .muhurtham-selection-notes strong { display: block; color: var(--maroon); font-size: 15px; font-weight: 800; }
  .muhurtham-selection-notes .selection-counts { display: block; color: var(--green); font-weight: 700; margin-bottom: 0.8mm; }

  /* Personally favourable dates (Tara Balam + no Chandrashtama) */
  .six-month-table .row-personal td { background: #fff1f2 !important; }
  .six-month-table .row-personal td:first-child { box-shadow: inset 3px 0 0 var(--maroon); }
  .personal-mark { color: #be123c; font-weight: 900; margin-right: 1mm; }
  /* Per-date Chandrashtama / Tara Bala line, under the star it belongs to. */
  .personal-note { margin-top: 0.35mm; color: var(--ink-muted); font-size: calc(var(--row-font, 7.8px) * 0.86); font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* One-line text legend explaining the ♥ mark; no extra panel or feature. */
  .personal-dates-note {
    flex-shrink: 0; background: #fff1f2; border: 1px solid #fecdd3; border-left: 2.5px solid #be123c;
    border-radius: 4px; padding: 1.2mm 2mm; color: var(--maroon); font-size: 8.4px;
    font-weight: 600; line-height: 1.4;
  }
  /* Authorisation block: reference number + issued-on + signatory, compact
     enough to keep the report at two pages. */
  .muhurtham-attestation {
    display: flex; align-items: center; justify-content: space-between; gap: 3mm;
    border: 1px solid var(--gold-border); border-radius: 6px; background: #fffdf5;
    padding: 1.8mm 3mm; flex-shrink: 0;
  }
  .muhurtham-attestation .attest-line { display: flex; flex-direction: column; gap: 0.4mm; min-width: 0; }
  .muhurtham-attestation .attest-label { color: var(--gold); font-size: 7.2px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; }
  .muhurtham-attestation .attest-value { color: var(--maroon); font-size: 9px; font-weight: 800; }
  .muhurtham-attestation .attest-sign { display: flex; align-items: center; gap: 2mm; flex-shrink: 0; }
  .muhurtham-attestation .signature-rule { width: 26mm; border-top: 1px solid var(--ink-muted); }
  .muhurtham-attestation .signature-block { text-align: center; }
  .muhurtham-attestation .signatory-label { color: var(--ink-muted); font-size: 7.2px; font-weight: 700; }
  .muhurtham-attestation .signatory-desk { color: var(--maroon); font-size: 8.4px; font-weight: 800; }
  /* Clean footer - just certification */
  .clean-cert-footer {
    display: flex; align-items: center; justify-content: space-between; gap: 3mm;
    border: 1px dashed var(--gold-border); border-radius: 6px; background: var(--gold-light);
    padding: 2mm 3mm; color: var(--maroon); font-size: 8px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0;
  }

  @media print {
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>
  <!-- PAGE 1 - clean dates -->
  <div class="page muhurtham-dates-page">
    <div class="inner">
      ${buildReportHeaderHtml({
        subtitle: labels.docHeader,
        meta: `${title} • ${labels.summaryCount} • ${labels.pageTag(1)}`
      })}

      <div class="devotee-panel">
        <h2><span>${escapeHtml(singlePersonMode ? labels.clientInfo : labels.coupleInfo)}</span><span style="font-size: 11px; font-weight: 700; color: var(--gold);">★ VEDIC REPORT</span></h2>
        ${singlePersonMode ? `
        <div class="details-grid">
          <div class="detail-card"><span class="detail-label">${escapeHtml(labels.name)}</span><span class="detail-val">${devotee}</span>${personStarLine(persons[0], labels, lang)}</div>
          <div class="detail-card"><span class="detail-label">${escapeHtml(labels.dob)}</span><span class="detail-val">${escapeHtml(persons[0]?.dob ? formatBirthDate(persons[0].dob) : formattedDob)}</span></div>
          <div class="detail-card"><span class="detail-label">${escapeHtml(labels.tob)}</span><span class="detail-val">${escapeHtml(persons[0]?.tob ? formatClock12(persons[0].tob) : formattedTob)}</span></div>
          <div class="detail-card"><span class="detail-label">${escapeHtml(labels.place)}</span><span class="detail-val">${place}</span><span class="detail-note">${escapeHtml(labels.birthPlace)}: ${birthPlace}</span></div>
        </div>
        ${singlePersonNoteHtml}` : `
        <div class="couple-grid">
          ${personCardHtml(bride, labels.brideLabel, labels, lang)}
          ${personCardHtml(groom, labels.groomLabel, labels, lang)}
        </div>
        <div class="couple-place"><span class="detail-label">${escapeHtml(labels.place)}</span><span class="detail-val">${place}</span><span class="detail-note">${escapeHtml(labels.birthPlace)}: ${birthPlace}</span></div>`}
      </div>

      <div class="ceremony-summary-bar">
        <div class="ceremony-info">
          <div class="ceremony-title-large"><span class="ceremony-emoji" aria-hidden="true">✨</span>${escapeHtml(title)}</div>
          <div class="ceremony-window">${escapeHtml(labels.window)}: ${escapeHtml(labels.windowVal)}</div>
        </div>
        <div class="summary-badges">
          <span class="badge-best-summary">★ ${bestCount} ${escapeHtml(labels.bandBest)}</span>
          <span class="badge-good-summary">✓ ${goodCount} ${escapeHtml(labels.bandGood)}</span>
        </div>
      </div>

      <section class="dates-section">
        <div class="dates-section-head">
          <h2>${escapeHtml(labels.datesTableTitle)}</h2>
          <span>${escapeHtml(labels.datesTableNote)}</span>
        </div>
        ${personalDatesNoteHtml}
        <div class="table-panel six-month-panel">
          ${page1DatesHtml}
        </div>
      </section>

      <div class="clean-cert-footer">
        <span>${escapeHtml(systemCertifiedLine)}</span>
        <span>${escapeHtml(labels.reference)}: ${escapeHtml(referenceNo)}</span>
      </div>

      <div class="page-bottom-brand">ASTRO SIVAM • Vedic Astrological Consultancy • astrosivam.com • admin@astrosivam.com</div>
    </div>
  </div>

  <!-- PAGE 2 - continuation above, selection guide in the lower half -->
  <div class="page muhurtham-dates-page muhurtham-continuation-page">
    <div class="inner">
      <div class="muhurtham-page2-upper">
      ${buildReportHeaderHtml({
        subtitle: labels.docHeader,
        meta: `${title} • ${selectedMonthLabel} • ${labels.pageTag(2)}`
      })}

      ${datesContinueOnPage2 ? `
      <section class="dates-section">
        <div class="dates-section-head">
          <h2>${escapeHtml(labels.datesTableTitle)}</h2>
          <span>${escapeHtml(labels.continuedLabel)}</span>
        </div>
        <div class="table-panel six-month-panel">
          ${page2DatesHtml}
        </div>
      </section>` : `
      <section class="dates-section">
        <div class="dates-section-head">
          <h2>${escapeHtml(labels.datesTableTitle)}</h2>
          <span>${escapeHtml(labels.summaryCount)}</span>
        </div>
        <div class="table-panel six-month-panel" style="flex:1; display: flex; align-items: center; justify-content: center; padding: 12mm 4mm; text-align: center; color: var(--ink-muted); font-size: 10px; font-weight: 700;">
          ✓ ${escapeHtml(allDatesNote)}
        </div>
      </section>`}
      </div>

      ${reportNotesHtml}
      ${attestationHtml}
      <div class="page-bottom-brand">ASTRO SIVAM • Vedic Astrological Consultancy • astrosivam.com • admin@astrosivam.com</div>
    </div>
  </div>
</body>
</html>`;
}

export default buildMuhurthamHtml;
