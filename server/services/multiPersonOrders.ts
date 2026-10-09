/**
 * Multi-person order helpers for the Node backend.
 *
 * MIRROR of `api/services/multi_person_order.php`: same limits, same validation
 * rules and the same per-item payload shapes, so the Express backend and the
 * PHP backend accept and store exactly the same orders.
 *
 * A `people[]` request is turned into a flat list of reports:
 *
 *   people[ {seq, name, ..., services[]} ]  ->  items[ {person, serviceCode, payload} ]
 *
 * The route then hands that list to `db.createMultiPersonOrder()`, which prices
 * every report server-side and writes ONE order row + N people + M items.
 */

import { AppLanguage } from '../astrology/types.js';
import { ServiceType } from '../db/store.js';
import { hasValidBirthDetails, hasValidCoordinates, isValidBirthDate, isValidBirthTime } from './birthDetails.js';
export { hasValidCoordinates, isValidBirthDate, isValidBirthTime } from './birthDetails.js';

export const MULTI_PERSON_MAX_PEOPLE = 6;
export const MULTI_PERSON_MIN_PEOPLE = 1;
export const MULTI_PERSON_MAX_ITEMS = 24;

export const MULTI_PERSON_SERVICES: ServiceType[] = [
  'BIRTH_JATHAGAM',
  'MARRIAGE_COMPATIBILITY',
  'BABY_NAMING',
  'MUHURTHAM'
];

export interface MultiPersonBirthBlock {
  name: string;
  gender: string;
  dob: string;
  tob: string;
  birthPlace: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetHours: number | null;
  timeZoneId: string;
}

export interface MultiPersonItemInput {
  person: {
    seq: number;
    fullName: string;
    gender: string;
    dob: string;
    tob: string;
    place: string;
    country: string;
    lat: number | null;
    lon: number | null;
    tz: number | null;
  };
  serviceCode: ServiceType;
  language: AppLanguage;
  country: string;
  inputPayload: Record<string, any>;
}

export interface MultiPersonValidation {
  ok: boolean;
  message?: string;
  items: MultiPersonItemInput[];
  peopleCount: number;
}

function asTrimmedString(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGender(value: any): string {
  const gender = asTrimmedString(value).toUpperCase();
  if (gender === 'FEMALE') return 'F';
  if (gender === 'MALE') return 'M';
  if (gender === 'F' || gender === 'M' || gender === 'O') return gender;
  return 'M';
}

/** Normalises one person (or a marriage partner) into the engine's keys. */
export function normalizeBirthBlock(raw: any, fallbackName = ''): MultiPersonBirthBlock {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    name: asTrimmedString(source.name ?? source.fullName ?? source.full_name ?? fallbackName),
    gender: normalizeGender(source.gender ?? 'M'),
    dob: asTrimmedString(source.dob ?? source.dateOfBirth),
    tob: asTrimmedString(source.tob ?? source.timeOfBirth),
    birthPlace: asTrimmedString(source.birthPlace ?? source.place ?? source.birth_place),
    country: asTrimmedString(source.country ?? source.birthCountry),
    latitude: asNumber(source.latitude ?? source.lat),
    longitude: asNumber(source.longitude ?? source.lon ?? source.lng),
    timezoneOffsetHours: asNumber(source.timezoneOffsetHours ?? source.tz),
    timeZoneId: asTrimmedString(source.timeZoneId ?? source.timezoneId)
  };
}

export function birthBlockErrors(block: MultiPersonBirthBlock, label: string): string[] {
  const errors: string[] = [];
  if (!block.name) errors.push(`${label}: full name is required.`);
  if (!isValidBirthDate(block.dob)) errors.push(`${label}: a valid date of birth that is not in the future is required.`);
  if (!isValidBirthTime(block.tob)) errors.push(`${label}: a valid time of birth (with minutes) is required.`);
  if (!block.birthPlace) errors.push(`${label}: birth place is required.`);
  if (!hasValidCoordinates(block.latitude, block.longitude, block.timezoneOffsetHours)) {
    errors.push(`${label}: birth place needs valid coordinates and time zone (select it from search, map or GPS).`);
  }
  if (errors.length === 0 && !hasValidBirthDetails(block)) {
    errors.push(`${label}: the birth date and time must not be in the future.`);
  }
  return errors;
}

function muhurthamBlockErrors(muhurtham: any, label: string): string[] {
  const source = muhurtham && typeof muhurtham === 'object' ? muhurtham : {};
  const errors: string[] = [];
  const place = asTrimmedString(source.muhurthamPlace ?? source.place);
  if (!place) {
    errors.push(`${label}: the Muhurtham (function) place is required.`);
  }
  if (!hasValidCoordinates(
    source.muhurthamLatitude ?? source.latitude,
    source.muhurthamLongitude ?? source.longitude,
    source.muhurthamTimezoneOffsetHours ?? source.timezoneOffsetHours
  )) {
    errors.push(`${label}: the Muhurtham place needs valid coordinates and time zone.`);
  }
  const month = asTrimmedString(source.selectedMonth);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    errors.push(`${label}: choose the report month (YYYY-MM) for the Muhurtham scan.`);
  }
  const scan = source.muhurthamScan ?? source.scan;
  const hasScan = Array.isArray(scan?.months) && scan.months.length > 0;
  if (!hasScan) {
    errors.push(`${label}: the six-month Muhurtham calendar is missing. Re-open the person card and let it calculate.`);
  }
  return errors;
}

/**
 * Builds the exact payload each astrology engine call expects for one report.
 * `person` and `partner` are normalised birth blocks.
 */
export function buildItemPayload(
  person: MultiPersonBirthBlock,
  serviceCode: ServiceType,
  partner: MultiPersonBirthBlock | null = null,
  muhurtham: any = null
): Record<string, any> {
  const base: Record<string, any> = {
    name: person.name,
    devoteeName: person.name,
    dob: person.dob,
    tob: person.tob,
    birthPlace: person.birthPlace,
    country: person.country,
    latitude: person.latitude,
    longitude: person.longitude,
    timezoneOffsetHours: person.timezoneOffsetHours,
    timeZoneId: person.timeZoneId,
    gender: person.gender
  };

  if (serviceCode === 'BABY_NAMING') {
    return { ...base, babyName: person.name, childName: person.name };
  }

  if (serviceCode === 'MARRIAGE_COMPATIBILITY') {
    // The card's person is one side; the partner block is the other chart.
    // Both nested objects and the flat bride*/groom* keys are provided because
    // the engine and the report builder read both spellings.
    const other = partner || person;
    const personIsBride = person.gender === 'F';
    const bride = personIsBride ? person : other;
    const groom = personIsBride ? other : person;
    const side = (block: MultiPersonBirthBlock) => ({
      name: block.name,
      gender: block.gender,
      dob: block.dob,
      tob: block.tob,
      birthPlace: block.birthPlace,
      country: block.country,
      latitude: block.latitude,
      longitude: block.longitude,
      timezoneOffsetHours: block.timezoneOffsetHours,
      timeZoneId: block.timeZoneId
    });
    const brideOut = side(bride);
    const groomOut = side(groom);
    return {
      ...base,
      bride: brideOut,
      groom: groomOut,
      brideName: brideOut.name,
      brideDob: brideOut.dob,
      brideTob: brideOut.tob,
      brideBirthPlace: brideOut.birthPlace,
      brideCountry: brideOut.country,
      brideLatitude: brideOut.latitude,
      brideLongitude: brideOut.longitude,
      brideTimezoneOffsetHours: brideOut.timezoneOffsetHours,
      brideTimeZoneId: brideOut.timeZoneId,
      groomName: groomOut.name,
      groomDob: groomOut.dob,
      groomTob: groomOut.tob,
      groomBirthPlace: groomOut.birthPlace,
      groomCountry: groomOut.country,
      groomLatitude: groomOut.latitude,
      groomLongitude: groomOut.longitude,
      groomTimezoneOffsetHours: groomOut.timezoneOffsetHours,
      groomTimeZoneId: groomOut.timeZoneId
    };
  }

  if (serviceCode === 'MUHURTHAM') {
    const source = muhurtham && typeof muhurtham === 'object' ? muhurtham : {};
    const scan = source.muhurthamScan ?? source.scan ?? null;
    return {
      ...base,
      muhurthamPlace: asTrimmedString(source.muhurthamPlace ?? source.place),
      muhurthamCountry: asTrimmedString(source.muhurthamCountry ?? source.country),
      muhurthamLatitude: asNumber(source.muhurthamLatitude ?? source.latitude),
      muhurthamLongitude: asNumber(source.muhurthamLongitude ?? source.longitude),
      muhurthamTimezoneOffsetHours: asNumber(source.muhurthamTimezoneOffsetHours ?? source.timezoneOffsetHours),
      muhurthamTimeZoneId: asTrimmedString(source.muhurthamTimeZoneId ?? source.timeZoneId),
      eventKey: asTrimmedString(source.eventKey) || 'wedding',
      selectedMonth: asTrimmedString(source.selectedMonth),
      muhurthamScan: scan && typeof scan === 'object' ? scan : null
    };
  }

  return base;
}

/**
 * Validates a `people[]` request and flattens it into per-report items.
 * Returns the first problem in `message` exactly like the PHP endpoint does.
 */
export function validateMultiPersonRequest(people: any[]): MultiPersonValidation {
  const items: MultiPersonItemInput[] = [];

  if (!Array.isArray(people) || people.length < MULTI_PERSON_MIN_PEOPLE) {
    return { ok: false, message: 'At least one person is required in a multi-person order.', items: [], peopleCount: 0 };
  }
  if (people.length > MULTI_PERSON_MAX_PEOPLE) {
    return {
      ok: false,
      message: `A multi-person order can contain at most ${MULTI_PERSON_MAX_PEOPLE} people.`,
      items: [],
      peopleCount: people.length
    };
  }

  for (let index = 0; index < people.length; index++) {
    const raw = people[index] && typeof people[index] === 'object' && !Array.isArray(people[index]) ? people[index] : {};
    const label = `Person ${index + 1}`;
    const person = normalizeBirthBlock(raw, '');
    const personLabel = person.name ? `${label} (${person.name})` : label;

    const personErrors = birthBlockErrors(person, personLabel);
    if (personErrors.length > 0) {
      return { ok: false, message: personErrors[0], items: [], peopleCount: people.length };
    }

    // The card sends `services[]`; a single `serviceType` is accepted too so
    // older clients and one-service payloads keep working.
    let services = Array.isArray(raw.services)
      ? raw.services.filter((service: any) => typeof service === 'string')
      : [];
    if (services.length === 0) {
      const single = asTrimmedString(raw.serviceType ?? raw.service ?? raw.serviceCode);
      if (single) services = [single];
    }
    services = Array.from(new Set(services));
    if (services.length === 0) {
      return { ok: false, message: `${personLabel}: choose at least one report (service) for this person.`, items: [], peopleCount: people.length };
    }
    const unknown = services.find((service: string) => !MULTI_PERSON_SERVICES.includes(service as ServiceType));
    if (unknown) {
      return { ok: false, message: `${personLabel}: "${unknown}" is not a supported service code.`, items: [], peopleCount: people.length };
    }

    const language = (['ta', 'en', 'hi'].includes(raw.language) ? raw.language : 'en') as AppLanguage;
    const country = asTrimmedString(raw.country) || asTrimmedString(raw.birthCountry);
    const personRecord = {
      seq: index + 1,
      fullName: person.name,
      gender: person.gender,
      dob: person.dob,
      tob: person.tob,
      place: person.birthPlace,
      country,
      lat: person.latitude,
      lon: person.longitude,
      tz: person.timezoneOffsetHours
    };

    let partner: MultiPersonBirthBlock | null = null;
    if (services.includes('MARRIAGE_COMPATIBILITY')) {
      partner = normalizeBirthBlock(raw.partner, '');
      if (!raw.partner || typeof raw.partner !== 'object') {
        return {
          ok: false,
          message: `${personLabel}: marriage compatibility needs the partner's birth details too.`,
          items: [],
          peopleCount: people.length
        };
      }
      const partnerErrors = birthBlockErrors(partner, `${personLabel} — partner`);
      if (partnerErrors.length > 0) {
        return { ok: false, message: partnerErrors[0], items: [], peopleCount: people.length };
      }
    }

    if (services.includes('MUHURTHAM')) {
      const muhurthamErrors = muhurthamBlockErrors(raw.muhurtham, personLabel);
      if (muhurthamErrors.length > 0) {
        return { ok: false, message: muhurthamErrors[0], items: [], peopleCount: people.length };
      }
    }

    for (const service of services as ServiceType[]) {
      items.push({
        person: personRecord,
        serviceCode: service,
        language,
        country,
        inputPayload: buildItemPayload(person, service, partner, raw.muhurtham ?? null)
      });
    }
  }

  if (items.length > MULTI_PERSON_MAX_ITEMS) {
    return {
      ok: false,
      message: `A multi-person order can contain at most ${MULTI_PERSON_MAX_ITEMS} reports.`,
      items: [],
      peopleCount: people.length
    };
  }

  return { ok: true, items, peopleCount: people.length };
}
