/** Shared, conservative validation for the personal details used in astrology forms. */
import {
  estimateTimezoneOffset,
  type LocationData
} from '../data/worldwideLocations';
import {
  getCurrentTimezoneOffset,
  getTimeZoneIdForCoordinates
} from '../lib/timezone';
import {
  isValidBirthDate,
  parseFlexibleDob,
  parseFlexibleTob,
  splitIsoDate,
  toIsoDate,
  type TobPeriod
} from './dateTimeInput';

/**
 * Keep names readable without restricting scripts or cultural punctuation.
 * Accents, initials, apostrophes, hyphens, and non-Latin names are preserved.
 */
export const normalizePersonName = (value: string): string =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/gu, ' ')
    .trim();

/** Returns a canonical YYYY-MM-DD value or an empty string for invalid dates. */
export const normalizeBirthDate = (value: string): string => parseFlexibleDob(value, true);

/**
 * Birth profiles created by older versions may contain either 24-hour time or
 * a 12-hour value with AM/PM. Prefer an unambiguous 24-hour value when present.
 */
export const normalizeBirthTime = (value: string, fallbackPeriod: TobPeriod = 'AM'): string => {
  const trimmed = String(value ?? '').trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;
  return parseFlexibleTob(trimmed, fallbackPeriod, { allowHourOnly: true })?.tob24 || '';
};

export const isValidIsoBirthDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidBirthDate(year, month, day) && toIsoDate(year, month, day) === value;
};

export const isValidBirthTime = (value: string): boolean =>
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '');

/** A location must be selected and include finite, in-range coordinates/offset. */
export const isVerifiedBirthLocation = (
  location?: LocationData | null
): location is LocationData => Boolean(
  location &&
  typeof location.placeName === 'string' && location.placeName.trim() &&
  Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
  Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 &&
  Number.isFinite(location.timezoneOffsetHours) && Math.abs(location.timezoneOffsetHours) <= 14
);

export const locationFromBirthProfile = (profile?: {
  birthPlace?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezoneOffsetHours?: number | null;
  timeZoneId?: string | null;
} | null): LocationData | null => {
  if (!profile?.birthPlace?.trim()) return null;
  const lat = profile.latitude == null ? Number.NaN : Number(profile.latitude);
  const lng = profile.longitude == null ? Number.NaN : Number(profile.longitude);
  let tzOffset = profile.timezoneOffsetHours == null ? Number.NaN : Number(profile.timezoneOffsetHours);
  let tzId = profile.timeZoneId || undefined;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    if (!tzId) {
      tzId = getTimeZoneIdForCoordinates(lat, lng) || undefined;
    }
    if (!Number.isFinite(tzOffset)) {
      if (tzId) {
        const cur = getCurrentTimezoneOffset(tzId);
        if (cur !== null && Number.isFinite(cur)) tzOffset = cur;
      }
      if (!Number.isFinite(tzOffset)) {
        tzOffset = estimateTimezoneOffset(lat, lng, profile.country || '');
      }
    }
  }

  const location: LocationData = {
    placeName: profile.birthPlace.trim(),
    country: profile.country || '',
    latitude: lat,
    longitude: lng,
    timezoneOffsetHours: tzOffset,
    timeZoneId: tzId
  };
  return isVerifiedBirthLocation(location) ? location : null;
};

/** Normalize a YYYY-MM-DD profile value without letting malformed input through. */
export const normalizeIsoBirthDate = (value: string): string => {
  const normalized = normalizeBirthDate(value);
  if (!normalized) return '';
  const { year, month, day } = splitIsoDate(normalized);
  return isValidBirthDate(Number(year), Number(month), Number(day)) ? normalized : '';
};
