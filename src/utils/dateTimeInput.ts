/**
 * Shared birth date / birth time parsing + typing helpers.
 *
 * Every service form (Birth Jathagam, Marriage Compatibility, Baby Naming,
 * Subha Muhurtham and the customer birth profile) collects the same two values
 * in the same two formats:
 *
 *   dob → 'YYYY-MM-DD'  (ISO, what the calculation engine expects)
 *   tob → 'HH:MM'       (24-hour, what the calculation engine expects)
 *
 * Mobile visitors cannot rely on `<input type="date">` / `<input type="time">`:
 * on several Android and iOS browsers the native widget either refuses to open,
 * opens a wheel that is impossible to scroll to a 1990 date, or shows an empty
 * field that cannot be typed into at all. These helpers therefore power a
 * plain text field with a numeric keyboard (auto-formatting while typing) plus
 * an in-app calendar / clock sheet and dropdown fallbacks, so a date can always
 * be entered on any device.
 */

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTH_LONG_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type TobPeriod = 'AM' | 'PM';

export interface ParsedTob {
  /** 24-hour 'HH:MM' — the value stored on the order. */
  tob24: string;
  /** 12-hour period the entry belongs to. */
  period: TobPeriod;
  /** 12-hour 'HH:MM' — what the text field displays. */
  display12: string;
}

/* ───────────────────────────── date helpers ───────────────────────────── */

export const isValidYmd = (year: number, month: number, day: number): boolean => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const maxDay = new Date(year, month, 0).getDate();
  return day <= maxDay;
};

/** A real calendar date on or before the visitor's local today. */
export const isValidBirthDate = (
  year: number,
  month: number,
  day: number,
  today = new Date()
): boolean => {
  if (!isValidYmd(year, month, day)) return false;
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  return year < todayYear ||
    (year === todayYear && month < todayMonth) ||
    (year === todayYear && month === todayMonth && day <= todayDay);
};

export const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const todayIsoDate = (today = new Date()): string =>
  toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

export const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate();

/** 'YYYY-MM-DD' → { year, month, day } as zero-padded strings ('' when empty). */
export const splitIsoDate = (iso: string): { year: string; month: string; day: string } => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return { year: '', month: '', day: '' };
  return { year: match[1], month: match[2], day: match[3] };
};

/**
 * Accepts everything a visitor may type or paste:
 *   15/08/1990 · 15-08-1990 · 15.08.1990 · 5/8/1990 · 1990-08-15 · 1990/08/15
 *   15081990 · 19900815 · 15/08/90 (only when `allowTwoDigitYear`)
 * Returns 'YYYY-MM-DD' or '' when the value is not a real calendar date.
 */
export const parseFlexibleDob = (raw: string, allowTwoDigitYear = false): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    return isValidBirthDate(year, month, day) ? toIsoDate(year, month, day) : '';
  }

  // 2. DD/MM/YYYY (with MM/DD/YYYY fallback when the second number cannot be a month)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (isValidBirthDate(year, second, first)) return toIsoDate(year, second, first);
    if (first >= 1 && first <= 12 && second > 12 && isValidBirthDate(year, first, second)) {
      return toIsoDate(year, first, second);
    }
    return '';
  }

  // 3. Optional 2-digit year (applied on blur / submit only)
  if (allowTwoDigitYear) {
    const dmyShortMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
    if (dmyShortMatch) {
      const day = Number(dmyShortMatch[1]);
      const month = Number(dmyShortMatch[2]);
      const yy = Number(dmyShortMatch[3]);
      const currentTwoDigit = new Date().getFullYear() % 100;
      const year = yy > currentTwoDigit ? 1900 + yy : 2000 + yy;
      if (isValidBirthDate(year, month, day)) return toIsoDate(year, month, day);
    }
  }

  // 4. Raw digits: DDMMYYYY or YYYYMMDD
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8) {
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const yyyy = Number(digits.slice(4, 8));
    if (isValidBirthDate(yyyy, mm, dd)) return toIsoDate(yyyy, mm, dd);

    const yyyyFirst = Number(digits.slice(0, 4));
    const mmSecond = Number(digits.slice(4, 6));
    const ddThird = Number(digits.slice(6, 8));
    if (isValidBirthDate(yyyyFirst, mmSecond, ddThird)) return toIsoDate(yyyyFirst, mmSecond, ddThird);
  }

  return '';
};

/**
 * Live formatting for the date text field.
 *
 * Separators typed by the visitor are always respected (so 5/8/1990 stays
 * 5/8/1990). For plain digit entry — the normal case on a mobile numeric
 * keyboard — separators are inserted as each segment completes, and a day or
 * month that can only be a single digit (4-9 for a day, 2-9 for a month)
 * advances immediately, so "581990" becomes "5/8/1990" instead of "58/19/90".
 */
export const formatDobInputWhileTyping = (raw: string): string => {
  const cleaned = (raw || '').replace(/[^\d/.-]/g, '');
  if (!cleaned) return '';

  // Explicit separators / ISO entry typed by the visitor: keep their structure.
  if (cleaned.includes('-') || cleaned.includes('.') || /^\d{4}\//.test(cleaned)) {
    return cleaned.slice(0, 10);
  }

  // Visitor typed slashes or had auto-inserted slashes:
  if (cleaned.includes('/')) {
    const segments = cleaned.split('/');
    const rawDay = (segments[0] || '').replace(/\D/g, '');
    const rawMonth = (segments[1] || '').replace(/\D/g, '');
    const rawYear = (segments.slice(2).join('') || '').replace(/\D/g, '');

    const day = rawDay.slice(0, 2);
    let month = '';
    let year = '';

    if (segments.length === 2) {
      if (rawMonth.length > 2) {
        month = rawMonth.slice(0, 2);
        year = rawMonth.slice(2, 6);
      } else {
        month = rawMonth.slice(0, 2);
      }
    } else if (segments.length >= 3) {
      month = rawMonth.slice(0, 2);
      year = rawYear.slice(0, 4);
    }

    let out = day;
    if (segments.length > 1 || rawMonth.length > 0) {
      out += `/${month}`;
    }
    if (year.length > 0 || (segments.length >= 3 && cleaned.endsWith('/'))) {
      out += `/${year}`;
    }
    return out;
  }

  const digits = cleaned.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  // Year-first (YYYYMMDD) when digits 3-4 cannot be a month of a DDMMYYYY entry.
  if (digits.length >= 5 && /^(19|20)/.test(digits) && Number(digits.slice(2, 4)) > 12) {
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    if (digits.length <= 4) return year;
    if (digits.length <= 6) return `${year}/${month}`;
    return `${year}/${month}/${day}`;
  }

  // Day segment: 4-9 can never start a two-digit day (max 31) → advance at once.
  const firstDayDigit = Number(digits[0]);
  const day = firstDayDigit >= 4 ? digits.slice(0, 1) : digits.slice(0, Math.min(2, digits.length));
  let out = day;
  if (day.length >= digits.length) return out;

  // Month segment: 2-9 can never start a two-digit month (max 12) → advance at once.
  const rest = digits.slice(day.length);
  const firstMonthDigit = Number(rest[0]);
  const month = firstMonthDigit >= 2 ? rest.slice(0, 1) : rest.slice(0, Math.min(2, rest.length));
  out += `/${month}`;
  if (month.length >= rest.length) return out;

  const year = rest.slice(month.length, month.length + 4);
  return `${out}/${year}`;
};

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (what the text field shows). */
export const isoToDisplayDob = (iso: string): string => {
  const match = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso || '';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/** 'YYYY-MM-DD' → '15 Aug 1990' (confirmation line). */
export const formatReadableDob = (iso: string): string => {
  const match = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso || '';
  const monthIdx = Number(match[2]) - 1;
  return `${match[3]} ${MONTH_SHORT_NAMES[monthIdx] || match[2]} ${match[1]}`;
};

/* ───────────────────────────── time helpers ───────────────────────────── */

/** '14:05' (24-hr) → { hour12: '02', minute: '05', period: 'PM' }. */
export const splitTob24 = (tob24: string): { hour12: string; minute: string; period: TobPeriod } => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((tob24 || '').trim());
  if (!match) return { hour12: '12', minute: '00', period: 'AM' };
  const h = Number(match[1]) % 24;
  const period: TobPeriod = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12: String(h12).padStart(2, '0'), minute: match[2], period };
};

/** '14:05' → '02:05 PM' for display. */
export const tob24ToDisplay12 = (tob24: string): string => {
  const { hour12, minute, period } = splitTob24(tob24);
  return `${hour12}:${minute} ${period}`;
};

/**
 * Accepts 09:30 · 9:30 · 0930 · 930 · 9:30 PM · 21:30 (24-hour) and returns the
 * 24-hour value plus the 12-hour display. `period` is the AM/PM toggle state,
 * used for entries that do not carry their own suffix.
 */
export const parseFlexibleTob = (
  raw: string,
  period: TobPeriod = 'AM',
  options?: { allowHourOnly?: boolean; force12HourWithPeriod?: boolean }
): ParsedTob | null => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  let effectivePeriod: TobPeriod = period;
  if (/p\.?m\.?/i.test(trimmed)) effectivePeriod = 'PM';
  else if (/a\.?m\.?/i.test(trimmed)) effectivePeriod = 'AM';

  const numericPart = trimmed.replace(/[aApPmM.\s]/g, '');

  let hNum = NaN;
  let mNum = NaN;

  const colonMatch = numericPart.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    if (colonMatch[2].length === 1 && !options?.allowHourOnly) return null;
    hNum = Number(colonMatch[1]);
    mNum = Number(colonMatch[2].padEnd(2, '0'));
  } else {
    const digits = numericPart.replace(/\D/g, '');
    if (digits.length === 4) {
      hNum = Number(digits.slice(0, 2));
      mNum = Number(digits.slice(2, 4));
    } else if (digits.length === 3) {
      hNum = Number(digits.slice(0, 1));
      mNum = Number(digits.slice(1, 3));
    } else if (options?.allowHourOnly && (digits.length === 1 || digits.length === 2)) {
      hNum = Number(digits);
      mNum = 0;
    } else {
      return null;
    }
  }

  if (!Number.isInteger(hNum) || !Number.isInteger(mNum) || hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) {
    return null;
  }

  let hour24 = hNum;
  let resolvedPeriod: TobPeriod = effectivePeriod;

  if (options?.force12HourWithPeriod) {
    const h12 = hNum % 12 || 12;
    resolvedPeriod = period;
    hour24 = period === 'PM' ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
  } else if (hNum === 0) {
    hour24 = 0;
    resolvedPeriod = 'AM';
  } else if (hNum > 12) {
    hour24 = hNum;
    resolvedPeriod = 'PM';
  } else {
    hour24 = effectivePeriod === 'PM' ? (hNum === 12 ? 12 : hNum + 12) : (hNum === 12 ? 0 : hNum);
    resolvedPeriod = effectivePeriod;
  }

  const displayHour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const mm = String(mNum).padStart(2, '0');

  return {
    tob24: `${String(hour24).padStart(2, '0')}:${mm}`,
    period: resolvedPeriod,
    display12: `${String(displayHour12).padStart(2, '0')}:${mm}`
  };
};

/**
 * Live formatting for the time text field. Hours 2-9 advance immediately
 * (a 12-hour clock has no 2x hour), 0/1 wait for the second digit so 10, 11
 * and 12 stay typeable, and an explicit colon is always respected.
 */
export const formatTobInputWhileTyping = (raw: string): string => {
  const cleaned = (raw || '').replace(/[^\d:]/g, '');
  if (!cleaned) return '';

  if (cleaned.includes(':')) {
    const [hourRaw, minuteRaw = ''] = cleaned.split(':');
    const hour = hourRaw.replace(/\D/g, '').slice(0, 2);
    const minute = minuteRaw.replace(/\D/g, '').slice(0, 2);
    if (cleaned.endsWith(':')) return `${hour}:`;
    return minuteRaw ? `${hour}:${minute}` : hour;
  }

  const digits = cleaned.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';

  const firstDigit = Number(digits[0]);
  const hour = firstDigit >= 2 ? digits.slice(0, 1) : digits.slice(0, Math.min(2, digits.length));
  if (hour.length >= digits.length) return hour;

  const minute = digits.slice(hour.length, hour.length + 2);
  return `${hour}:${minute}`;
};

/**
 * Parse a time field value while the visitor is typing.
 *
 * Always parse the formatted text instead of the raw digit string. A three-digit
 * intermediate value like "123" is ambiguous: the formatter correctly shows
 * it as the incomplete "12:3", but parsing the raw digits would prematurely
 * treat it as "1:23" and replace the user's input before they can finish 12:30.
 * Explicit AM/PM suffixes are parsed from the original text so paste still
 * keeps its intended period.
 */
export const parseTobInputWhileTyping = (raw: string, period: TobPeriod = 'AM'): ParsedTob | null => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  if (/[ap]\.?m\.?$/i.test(trimmed)) {
    const withExplicitPeriod = parseFlexibleTob(trimmed, period, { allowHourOnly: false });
    if (withExplicitPeriod) return withExplicitPeriod;
  }

  return parseFlexibleTob(formatTobInputWhileTyping(trimmed), period, { allowHourOnly: false });
};

/** '09:30' (24-hr) → '09:30 AM (09:30)' style confirmation text. */
export const formatReadableTob = (tob24: string): string => {
  const match = (tob24 || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return tob24 || '';
  const h = Number(match[1]);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${match[2]} ${period}`;
};

/** Human message explaining why a typed value was rejected ('' when it is fine). */
export const describeDobProblem = (text: string): string => {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (parseFlexibleDob(trimmed, true)) return '';

  const parts = trimmed.split(/[-/.]/);
  const digits = trimmed.replace(/\D/g, '');
  const currentYear = new Date().getFullYear();

  if (parts.length === 3) {
    const yearFirst = parts[0].length === 4;
    const year = Number(yearFirst ? parts[0] : parts[2]);
    const month = Number(parts[1]);
    const day = Number(yearFirst ? parts[2] : parts[0]);
    if (!Number.isFinite(month) || month < 1 || month > 12) return 'Month must be between 01 and 12.';
    if (!Number.isFinite(year) || year < 1900 || year > currentYear) return `Year must be between 1900 and ${currentYear}.`;
    if (!Number.isFinite(day) || day < 1 || day > daysInMonth(year, month)) {
      return `${MONTH_SHORT_NAMES[month - 1]} ${year} has only ${daysInMonth(year, month)} days.`;
    }
    if (!isValidBirthDate(year, month, day)) return 'Date of birth cannot be in the future.';
  }

  if (digits.length < 8) return 'Keep typing: DD/MM/YYYY (for example 15/08/1990).';
  return 'Please check the date — for example 15/08/1990.';
};

/** Human message explaining why a typed time was rejected ('' when it is fine). */
export const describeTobProblem = (text: string): string => {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (parseFlexibleTob(trimmed, 'AM', { allowHourOnly: true })) return '';

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const hour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    if (minute > 59) return 'Minutes must be between 00 and 59.';
    if (hour < 1) return 'Hour must be between 1 and 12.';
    if (hour > 23) return 'Hour must be between 1 and 12 with AM/PM.';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 3) return 'Keep typing: HH:MM (for example 09:30).';
  return 'Please check the time — for example 09:30.';
};
