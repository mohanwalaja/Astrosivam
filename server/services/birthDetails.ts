/** Server-side validation shared by the four paid astrology services. */
import { getTimeZoneIdForCoordinates, resolveLocalDateTimeInTimeZone } from '../../src/lib/timezone.js';

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Real ISO date within the civil-day envelope; the exact instant is checked below. */
export function isValidBirthDate(value: unknown, now: Date = new Date()): boolean {
  const dob = trimmedString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    year < 1900 || year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  // A person east of UTC can already be on the following civil date. Allow
  // that one-day envelope here; hasValidBirthDetails checks the exact local
  // birth instant and rejects a genuinely future date/time.
  const latestCivilDate = new Date(now.getTime() + 14 * 60 * 60 * 1000);
  latestCivilDate.setUTCHours(23, 59, 59, 999);
  return date.getTime() <= latestCivilDate.getTime();
}

/** The engines consume canonical 24-hour HH:MM wall-clock birth times. */
export function isValidBirthTime(value: unknown): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmedString(value));
}

export function hasValidCoordinates(latitude: unknown, longitude: unknown, offset: unknown): boolean {
  if ([latitude, longitude, offset].some(value => value === null || value === undefined || value === '')) return false;
  const lat = Number(latitude);
  const lon = Number(longitude);
  const tz = Number(offset);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180 &&
    Number.isFinite(tz) && tz >= -14 && tz <= 14;
}

/**
 * Minimum birth particulars required before a report can be calculated or
 * accepted as a paid order. Name is intentionally optional (baby naming may
 * not have a chosen name yet); the ephemeris inputs and birth-place label are
 * not.
 */
export function hasValidBirthDetails(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const person = input as Record<string, unknown>;
  if (!isValidBirthDate(person.dob) || !isValidBirthTime(person.tob) ||
      !trimmedString(person.birthPlace) ||
      !hasValidCoordinates(person.latitude, person.longitude, person.timezoneOffsetHours)) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedString(person.dob));
  const time = /^(\d{2}):(\d{2})$/.exec(trimmedString(person.tob));
  if (!match || !time) return false;
  const [, year, month, day] = match.map(Number);
  const [, hour, minute] = time.map(Number);
  const latitude = Number(person.latitude);
  const longitude = Number(person.longitude);
  const offsetHours = Number(person.timezoneOffsetHours);
  const timeZoneId = getTimeZoneIdForCoordinates(latitude, longitude) ??
    (trimmedString(person.timeZoneId) || undefined);
  const resolved = timeZoneId
    ? resolveLocalDateTimeInTimeZone(trimmedString(person.dob), trimmedString(person.tob), timeZoneId)
    : null;
  if (timeZoneId && (!resolved || resolved.nonexistent || resolved.ambiguous)) return false;

  const localWallClockMs = Date.UTC(year, month - 1, day, hour, minute);
  const birthInstantMs = resolved?.utcDate.getTime() ??
    localWallClockMs - Math.round(offsetHours * 60) * 60_000;
  return birthInstantMs <= Date.now();
}
