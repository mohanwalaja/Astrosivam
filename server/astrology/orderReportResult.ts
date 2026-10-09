import type { Order } from '../db/store.js';
import { calculatePrecisionHoroscope } from './astronomy.js';
import { calculateWeddingCompatibility } from './matchmaking.js';
import { calculateBabyNamingDetails } from './babynames.js';
import { computeMuhurthamResultFromPayload } from './muhurthamScan.js';
import { hasValidBirthDetails } from '../services/birthDetails.js';

function normalizeWeddingPerson(payload: any, role: 'bride' | 'groom', source?: any): any {
  const p = payload || {};
  const value = source || {};
  const prefix = role;
  const alternate = role === 'bride' ? 'girl' : 'boy';
  const number = role === 'bride' ? 'p1' : 'p2';
  const numbered = (key: string) => source ? undefined : p[`${number}${key}`];
  return {
    ...value,
    name: value.name ?? value.devoteeName ?? p[`${prefix}Name`] ?? p[`${alternate}Name`] ?? numbered('Name') ?? (role === 'bride' ? 'Bride' : 'Groom'),
    dob: value.dob ?? value.birthDetails?.dob ?? p[`${prefix}Dob`] ?? p[`${alternate}Dob`] ?? numbered('Dob'),
    tob: value.tob ?? value.birthDetails?.tob ?? p[`${prefix}Tob`] ?? p[`${alternate}Tob`] ?? numbered('Tob'),
    birthPlace: value.birthPlace ?? value.birthDetails?.birthPlace ?? value.place ??
      p[`${prefix}BirthPlace`] ?? p[`${prefix}Place`] ?? numbered('BirthPlace'),
    // Never substitute order/account country for a person's birth country.
    country: value.country ?? value.birthDetails?.country ?? value.birthCountry ?? p[`${prefix}Country`] ?? p[`${alternate}Country`] ?? numbered('Country') ?? '',
    latitude: value.latitude ?? value.birthDetails?.latitude ?? value.lat ?? p[`${prefix}Latitude`] ?? numbered('Latitude'),
    longitude: value.longitude ?? value.birthDetails?.longitude ?? value.lng ?? p[`${prefix}Longitude`] ?? numbered('Longitude'),
    timezoneOffsetHours: value.timezoneOffsetHours ?? value.birthDetails?.timezoneOffsetHours ?? value.tzOffsetHours ??
      p[`${prefix}TimezoneOffsetHours`] ?? numbered('TimezoneOffsetHours'),
    timeZoneId: value.timeZoneId ?? value.birthDetails?.timeZoneId ?? p[`${prefix}TimeZoneId`] ?? numbered('TimeZoneId') ?? ''
  };
}

function weddingInputs(payload: any): { bride: any; groom: any } {
  const p = payload || {};
  let bride = p.bride || p.girl || p.brideDetails || p.girlDetails;
  let groom = p.groom || p.boy || p.groomDetails || p.boyDetails;
  if (!bride && !groom && p.p1 && p.p2) {
    const p1IsBride = p.p1Role === 'bride' || String(p.p1.gender || '').toUpperCase() === 'F';
    bride = p1IsBride ? p.p1 : p.p2;
    groom = p1IsBride ? p.p2 : p.p1;
  }
  return {
    bride: normalizeWeddingPerson(p, 'bride', bride),
    groom: normalizeWeddingPerson(p, 'groom', groom)
  };
}

/**
 * Rebuilds an official order report from the immutable service input payload.
 * A persisted calculatedResult is only a cache; it is never a fallback when
 * a current calculation cannot be produced.
 */
export function computeOrderReportResult(order: Order): any {
  const p: any = order?.inputPayload || {};

  if (order.serviceType === 'BIRTH_JATHAGAM') {
    if (!hasValidBirthDetails(p)) throw new Error('The saved birth date, time, place, coordinates, or time zone are incomplete. The report was not generated.');
    return calculatePrecisionHoroscope(
      p.name || order.userName || 'User', p.dob, p.tob, p.birthPlace,
      Number(p.latitude), Number(p.longitude), Number(p.timezoneOffsetHours),
      typeof p.country === 'string' ? p.country : '', p.gender || 'M'
    );
  }

  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
    const { bride, groom } = weddingInputs(p);
    if (!hasValidBirthDetails(bride) || !hasValidBirthDetails(groom)) {
      throw new Error('The saved bride and groom birth date, time, place, coordinates, or time zones are incomplete. The report was not generated.');
    }
    return calculateWeddingCompatibility({ bride, groom });
  }

  if (order.serviceType === 'BABY_NAMING') {
    if (!hasValidBirthDetails(p)) throw new Error('The saved birth date, time, place, coordinates, or time zone are incomplete. The report was not generated.');
    return calculateBabyNamingDetails({
      ...p,
      babyName: p.babyName || p.childName || p.name || '',
      gender: p.gender || 'M',
      country: typeof p.country === 'string' ? p.country : ''
    });
  }

  if (order.serviceType === 'MUHURTHAM') {
    if (!hasValidBirthDetails(p)) throw new Error('The saved birth date, time, place, coordinates, or time zone are incomplete. The report was not generated.');
    return computeMuhurthamResultFromPayload({ inputPayload: p, userName: order.userName });
  }

  return null;
}
