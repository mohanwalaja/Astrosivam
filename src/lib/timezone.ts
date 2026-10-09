import tzLookup from 'tz-lookup';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface LocalDateTimeResolution {
  /** UTC instant corresponding to the supplied wall-clock date and time. */
  utcDate: Date;
  /** Civil offset in effect at the resolved instant, including historical DST. */
  offsetHours: number;
  /** Repeated local times resolve to their earlier occurrence. */
  ambiguous: boolean;
  /** Nonexistent local times move forward by the size of the clock gap. */
  nonexistent: boolean;
}

/** Resolve the IANA timezone whose geographic polygon contains these coordinates. */
export function getTimeZoneIdForCoordinates(latitude: number, longitude: number): string | null {
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return null;
  }

  try {
    return tzLookup(latitude, longitude);
  } catch {
    // Some coordinates (for example, remote ocean locations) may not map to a zone.
    return null;
  }
}

function getFormatter(timeZoneId: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZoneId);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    formatterCache.set(timeZoneId, formatter);
  }
  return formatter;
}

/** Format an instant as civil date/time components in an IANA timezone. */
export function getZonedDateTimeParts(instant: Date | number, timeZoneId: string): ZonedDateTimeParts | null {
  const instantMs = instant instanceof Date ? instant.getTime() : instant;
  if (!Number.isFinite(instantMs)) return null;

  try {
    const values: Record<string, number> = {};
    for (const part of getFormatter(timeZoneId).formatToParts(new Date(instantMs))) {
      if (part.type !== 'literal') values[part.type] = Number(part.value);
    }
    const result = {
      year: values.year,
      month: values.month,
      day: values.day,
      hour: values.hour,
      minute: values.minute,
      second: values.second
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

/** Get the IANA civil offset at an already-resolved UTC instant. */
export function getTimezoneOffsetAtInstant(timeZoneId: string, instant: Date | number): number | null {
  const instantMs = instant instanceof Date ? instant.getTime() : instant;
  const parts = getZonedDateTimeParts(instantMs, timeZoneId);
  if (!parts) return null;

  // Intl reports local wall-clock fields. Treat those as UTC to recover the
  // zone offset; truncate the instant to the same second-level precision.
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const instantToSecond = Math.floor(instantMs / 1000) * 1000;
  return (wallClockAsUtc - instantToSecond) / 3_600_000;
}

function parseLocalDateTime(date: string, time: string): { wallClockMs: number; fields: ZonedDateTimeParts } | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText, secondText = '0'] = timeMatch;
  const fields = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText)
  };
  if (
    fields.year < 1 || fields.month < 1 || fields.month > 12 ||
    fields.day < 1 || fields.hour > 23 || fields.minute > 59 || fields.second > 59
  ) {
    return null;
  }

  // setUTCFullYear avoids Date.UTC's special interpretation of years 00–99.
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(fields.year, fields.month - 1, fields.day);
  wallClock.setUTCHours(fields.hour, fields.minute, fields.second, 0);
  if (
    wallClock.getUTCFullYear() !== fields.year ||
    wallClock.getUTCMonth() !== fields.month - 1 ||
    wallClock.getUTCDate() !== fields.day
  ) {
    return null;
  }
  return { wallClockMs: wallClock.getTime(), fields };
}

function sameCivilTime(left: ZonedDateTimeParts, right: ZonedDateTimeParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day &&
    left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

/**
 * Convert a local wall-clock birth time into UTC using historical IANA timezone
 * rules. DST overlaps choose the earlier occurrence; clock gaps move forward.
 */
export function resolveLocalDateTimeInTimeZone(
  date: string,
  time: string,
  timeZoneId: string
): LocalDateTimeResolution | null {
  const local = parseLocalDateTime(date, time);
  if (!local) return null;

  try {
    // Collect all offsets near the date. This captures both sides of ordinary
    // DST transitions and political offset changes around the local date.
    const offsets = new Set<number>();
    for (let hour = -48; hour <= 48; hour += 6) {
      const offset = getTimezoneOffsetAtInstant(timeZoneId, local.wallClockMs + hour * 3_600_000);
      if (offset !== null) offsets.add(Math.round(offset * 3_600_000));
    }
    if (offsets.size === 0) return null;

    const exactCandidates: Array<{ utcMs: number; offsetMs: number }> = [];
    const projections: Array<{
      utcMs: number;
      offsetMs: number;
      projectedWallMs: number;
    }> = [];

    for (const offsetMs of offsets) {
      const utcMs = local.wallClockMs - offsetMs;
      const actualOffsetHours = getTimezoneOffsetAtInstant(timeZoneId, utcMs);
      if (actualOffsetHours === null) continue;
      const actualOffsetMs = Math.round(actualOffsetHours * 3_600_000);
      const projectedWallMs = utcMs + actualOffsetMs;
      projections.push({ utcMs, offsetMs: actualOffsetMs, projectedWallMs });

      if (
        actualOffsetMs === offsetMs &&
        sameCivilTime(getZonedDateTimeParts(utcMs, timeZoneId)!, local.fields)
      ) {
        exactCandidates.push({ utcMs, offsetMs });
      }
    }

    if (exactCandidates.length > 0) {
      exactCandidates.sort((a, b) => a.utcMs - b.utcMs);
      const selected = exactCandidates[0];
      return {
        utcDate: new Date(selected.utcMs),
        offsetHours: selected.offsetMs / 3_600_000,
        ambiguous: exactCandidates.length > 1,
        nonexistent: false
      };
    }

    // A clock gap has no exact instant. Temporal's "compatible" behavior is
    // to move the requested wall time forward by the transition gap.
    projections.sort((a, b) => {
      const aForward = a.projectedWallMs >= local.wallClockMs;
      const bForward = b.projectedWallMs >= local.wallClockMs;
      if (aForward !== bForward) return aForward ? -1 : 1;
      return aForward
        ? a.projectedWallMs - b.projectedWallMs
        : b.projectedWallMs - a.projectedWallMs;
    });
    const selected = projections[0];
    if (!selected) return null;

    return {
      utcDate: new Date(selected.utcMs),
      offsetHours: selected.offsetMs / 3_600_000,
      ambiguous: false,
      nonexistent: true
    };
  } catch {
    return null;
  }
}

/**
 * True for an IANA Area/Location identifier (or UTC) that this runtime can
 * evaluate with historical DST rules. Fixed abbreviations such as "EST" or
 * "IST" are rejected: they carry no regional transition history, and the PHP
 * API applies the same rule (AstroEngine::isValidIanaTimeZoneId).
 */
export function isValidIanaTimeZoneId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const id = value.trim();
  if (!id || id.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(id)) return false;
  if (id !== 'UTC' && !id.includes('/')) return false;
  try {
    getFormatter(id);
    return true;
  } catch {
    return false;
  }
}

export type BirthTimeZoneSource = 'coordinates' | 'preferred' | 'offset';

export interface BirthTimeZoneResolution {
  /** IANA zone used for the birth instant (undefined when only a fixed offset is known). */
  timeZoneId?: string;
  /** Where the zone came from: the coordinate polygon, the caller's zone id, or neither. */
  timeZoneSource: BirthTimeZoneSource;
  /** Civil offset actually in force at the birth wall-clock time (historical standard/DST). */
  timezoneOffsetHours: number;
  /** Offset the location record carried before historical rules were applied. */
  fallbackOffsetHours: number;
  /** True when the location's offset differed from the historical offset by ≥ 30 minutes (typically a DST hour). */
  offsetAdjusted: boolean;
  /** True once a complete date and time were evaluated against the zone rules. */
  evaluated: boolean;
  /** Daylight-saving time was in force at the birth instant (null when unknown). */
  daylightSaving: boolean | null;
  /** The wall-clock time occurred twice (autumn clock set-back). */
  ambiguous: boolean;
  /** The wall-clock time never occurred (spring clock jump). */
  nonexistent: boolean;
  /** Human-readable explanation when the time falls inside a DST gap/fold, otherwise null. */
  problem: string | null;
}

function standardOffsetForYear(timeZoneId: string, year: number): number | null {
  const january = getTimezoneOffsetAtInstant(timeZoneId, Date.UTC(year, 0, 1, 12));
  const july = getTimezoneOffsetAtInstant(timeZoneId, Date.UTC(year, 6, 1, 12));
  if (january === null || july === null) return null;
  return Math.min(january, july);
}

/**
 * Resolve the IANA zone and the historically correct offset for a birth.
 *
 * The coordinate polygon wins over a caller-supplied zone id (a saved profile
 * may carry a stale id), and the zone's real transition history wins over the
 * location's generic offset — so a 1999 Fiji summer birth gets UTC+13, not the
 * UTC+12 a "Fiji = +12" table would suggest. When the date/time are incomplete
 * or no zone exists for the coordinates, the fallback offset is returned.
 *
 * DST gaps and folds are reported (not silently guessed) so forms can warn
 * the user; the servers reject such times, mirroring this flag.
 */
export function resolveBirthTimeZone(
  date: string,
  time: string,
  latitude: number,
  longitude: number,
  fallbackOffsetHours: number,
  preferredTimeZoneId?: string | null
): BirthTimeZoneResolution {
  const fromCoordinates = getTimeZoneIdForCoordinates(latitude, longitude);
  const preferred = isValidIanaTimeZoneId(preferredTimeZoneId) ? preferredTimeZoneId.trim() : null;
  const timeZoneId = fromCoordinates ?? preferred ?? undefined;
  const timeZoneSource: BirthTimeZoneSource = fromCoordinates ? 'coordinates' : preferred ? 'preferred' : 'offset';

  const base: BirthTimeZoneResolution = {
    timeZoneId,
    timeZoneSource,
    timezoneOffsetHours: fallbackOffsetHours,
    fallbackOffsetHours,
    offsetAdjusted: false,
    evaluated: false,
    daylightSaving: null,
    ambiguous: false,
    nonexistent: false,
    problem: null
  };
  if (!timeZoneId) return base;

  const resolved = resolveLocalDateTimeInTimeZone(date, time, timeZoneId);
  if (!resolved) return base;

  const local = parseLocalDateTime(date, time);
  const standardOffset = local ? standardOffsetForYear(timeZoneId, local.fields.year) : null;
  const zoneLabel = timeZoneId.replace(/_/g, ' ');
  let problem: string | null = null;
  if (resolved.nonexistent) {
    problem = `${time} did not exist on ${date} in ${zoneLabel}: clocks were moved forward for daylight saving. Please re-check the recorded birth time.`;
  } else if (resolved.ambiguous) {
    problem = `${time} occurred twice on ${date} in ${zoneLabel}: clocks were set back for daylight saving. Please confirm which occurrence the birth record means.`;
  }

  return {
    ...base,
    timezoneOffsetHours: resolved.offsetHours,
    offsetAdjusted: Number.isFinite(fallbackOffsetHours) && Math.abs(resolved.offsetHours - fallbackOffsetHours) >= 0.5,
    evaluated: true,
    daylightSaving: standardOffset === null ? null : resolved.offsetHours > standardOffset,
    ambiguous: resolved.ambiguous,
    nonexistent: resolved.nonexistent,
    problem
  };
}

/** Resolve both the IANA zone and the DOB-specific offset for a location. */
export function resolveLocationTimezone(
  date: string,
  time: string,
  latitude: number,
  longitude: number,
  fallbackOffsetHours: number,
  preferredTimeZoneId?: string | null
): BirthTimeZoneResolution {
  return resolveBirthTimeZone(date, time, latitude, longitude, fallbackOffsetHours, preferredTimeZoneId);
}

/** Current offset of an IANA timezone (or null if the runtime lacks its rules). */
export function getCurrentTimezoneOffset(timeZoneId: string, now: Date = new Date()): number | null {
  return getTimezoneOffsetAtInstant(timeZoneId, now);
}

/** Format a numeric civil offset without losing quarter-hour/half-hour zones. */
export function formatUtcOffset(offsetHours: number): string {
  if (!Number.isFinite(offsetHours)) return 'UTC';
  const roundedMinutes = Math.round(Math.abs(offsetHours) * 60);
  const sign = offsetHours < 0 ? '-' : '+';
  const hours = String(Math.floor(roundedMinutes / 60)).padStart(2, '0');
  const minutes = String(roundedMinutes % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

/** Format a local date key in an IANA timezone. */
export function getLocalDateKey(instant: Date | number, timeZoneId: string): string | null {
  const parts = getZonedDateTimeParts(instant, timeZoneId);
  if (!parts) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Format an instant as a localized clock time in an IANA timezone. */
export function formatTimeInTimeZone(instant: Date | number, timeZoneId: string): string | null {
  const instantMs = instant instanceof Date ? instant.getTime() : instant;
  if (!Number.isFinite(instantMs)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(instantMs));
  } catch {
    return null;
  }
}
