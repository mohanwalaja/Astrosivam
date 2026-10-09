/**
 * Multi-person checkout - pure model/validation/pricing helpers.
 *
 * One order contains 1..6 PEOPLE. Each person has birth details and a checklist
 * of one or more services. The customer pays ONE server-computed total.
 *
 * This module is framework-free on purpose: the checkout UI, the servers and the
 * test suite all use the exact same rules, so a person card can never be
 * submitted in a state the API would reject (and vice versa).
 */

import { AppLanguage, CartItem, CurrencyCode, Order, ServiceType, SystemSettings } from '../types';
import { CurrencyPriceMap, getServicePrices } from './pricing';
import {
  findNakshatraFromBirthDetails,
  MUHURTHAM_ALGORITHM_VERSION,
  MuhurthamEventKey,
  PersonInput,
  scanMonthMuhurtham
} from '../lib/muhurtham/scanner';
import { resolveLocationTimezone } from '../lib/timezone';
import {
  isValidBirthTime,
  isValidIsoBirthDate,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizePersonName
} from '../utils/birthDetails';
import rulesData from '../lib/muhurtham/rules.json';

/** A single order can contain at most six people and at least one. */
export const MULTI_PERSON_MAX_PEOPLE = 6;
export const MULTI_PERSON_MIN_PEOPLE = 1;
/** 6 people x 4 services - the same hard ceiling the API enforces. */
export const MULTI_PERSON_MAX_ITEMS = 24;

export const MULTI_PERSON_SERVICES: ServiceType[] = [
  'BIRTH_JATHAGAM',
  'MARRIAGE_COMPATIBILITY',
  'BABY_NAMING',
  'MUHURTHAM'
];

export interface MuhurthamDraft {
  place: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetHours: number | null;
  timeZoneId: string;
  eventKey: string;
  selectedMonth: string;
}

export interface PartnerDraft {
  name: string;
  gender: 'M' | 'F' | 'O';
  dob: string;
  tob: string;
  place: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetHours: number | null;
  timeZoneId: string;
}

export interface PersonDraft {
  /** Stable client-side identity; never sent to the server. */
  key: string;
  name: string;
  gender: 'M' | 'F' | 'O';
  dob: string;
  tob: string;
  place: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetHours: number | null;
  timeZoneId: string;
  services: ServiceType[];
  language: AppLanguage;
  /** Required when MARRIAGE_COMPATIBILITY is checked. */
  partner?: PartnerDraft;
  /** Required when MUHURTHAM is checked. */
  muhurtham?: MuhurthamDraft;
}

/* ------------------------------------------------------------------ *
 *  Labels (Tamil / English / Hindi, like the rest of the site)        *
 * ------------------------------------------------------------------ */

export interface CheckoutLabels {
  peopleTitle: string;
  person: string;
  addPerson: string;
  removePerson: string;
  name: string;
  gender: string;
  male: string;
  female: string;
  other: string;
  dob: string;
  tob: string;
  place: string;
  servicesHeading: string;
  reportLanguage: string;
  subtotal: string;
  grandTotal: string;
  maxPeople: string;
  minPeople: string;
  partnerHeading: string;
  muhurthamHeading: string;
  muhurthamPlace: string;
  muhurthamMonth: string;
  muhurthamEvent: string;
  selectAtLeastOne: string;
}

const LABELS: Record<AppLanguage, CheckoutLabels> = {
  en: {
    peopleTitle: 'People in this order',
    person: 'Person',
    addPerson: 'Add Person',
    removePerson: 'Remove person',
    name: 'Full Name',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    dob: 'Date of Birth',
    tob: 'Time of Birth',
    place: 'Birth Place',
    servicesHeading: 'Services for this person',
    reportLanguage: 'Report language',
    subtotal: 'Person subtotal',
    grandTotal: 'Grand Total (one payment)',
    maxPeople: 'A single order can contain at most 6 people.',
    minPeople: 'At least one person is required.',
    partnerHeading: 'Partner birth details (for Marriage Compatibility)',
    muhurthamHeading: 'Muhurtham (function) details',
    muhurthamPlace: 'Function / residence place',
    muhurthamMonth: 'Report month',
    muhurthamEvent: 'Ceremony',
    selectAtLeastOne: 'Choose at least one service.'
  },
  ta: {
    peopleTitle: 'இந்த ஆர்டரில் உள்ள நபர்கள்',
    person: 'நபர்',
    addPerson: 'நபரைச் சேர்',
    removePerson: 'நபரை நீக்கு',
    name: 'முழுப் பெயர்',
    gender: 'பாலினம்',
    male: 'ஆண்',
    female: 'பெண்',
    other: 'மற்றவை',
    dob: 'பிறந்த தேதி',
    tob: 'பிறந்த நேரம்',
    place: 'பிறந்த இடம்',
    servicesHeading: 'இந்த நபருக்கான சேவைகள்',
    reportLanguage: 'அறிக்கை மொழி',
    subtotal: 'நபர் கூட்டுத்தொகை',
    grandTotal: 'மொத்த தொகை (ஒரே கட்டணம்)',
    maxPeople: 'ஒரு ஆர்டரில் அதிகபட்சம் 6 நபர்கள் மட்டுமே.',
    minPeople: 'குறைந்தது ஒரு நபர் தேவை.',
    partnerHeading: 'துணைவர் பிறப்பு விவரங்கள் (திருமணப் பொருத்தத்திற்கு)',
    muhurthamHeading: 'முகூர்த்த (விழா) விவரங்கள்',
    muhurthamPlace: 'விழா / வசிப்பிட இடம்',
    muhurthamMonth: 'அறிக்கை மாதம்',
    muhurthamEvent: 'விழா',
    selectAtLeastOne: 'குறைந்தது ஒரு சேவையைத் தேர்ந்தெடுக்கவும்.'
  },
  hi: {
    peopleTitle: 'इस ऑर्डर के व्यक्ति',
    person: 'व्यक्ति',
    addPerson: 'व्यक्ति जोड़ें',
    removePerson: 'व्यक्ति हटाएं',
    name: 'पूरा नाम',
    gender: 'लिंग',
    male: 'पुरुष',
    female: 'स्त्री',
    other: 'अन्य',
    dob: 'जन्म तिथि',
    tob: 'जन्म समय',
    place: 'जन्म स्थान',
    servicesHeading: 'इस व्यक्ति की सेवाएं',
    reportLanguage: 'रिपोर्ट भाषा',
    subtotal: 'इस व्यक्ति का योग',
    grandTotal: 'कुल राशि (एक भुगतान)',
    maxPeople: 'एक ऑर्डर में अधिकतम 6 व्यक्ति हो सकते हैं।',
    minPeople: 'कम से कम एक व्यक्ति आवश्यक है।',
    partnerHeading: 'साथी का जन्म विवरण (विवाह मिलान हेतु)',
    muhurthamHeading: 'मुहूर्त (कार्यक्रम) विवरण',
    muhurthamPlace: 'कार्यक्रम / निवास स्थान',
    muhurthamMonth: 'रिपोर्ट माह',
    muhurthamEvent: 'अनुष्ठान',
    selectAtLeastOne: 'कम से कम एक सेवा चुनें।'
  }
};

export function multiPersonLabels(language: AppLanguage): CheckoutLabels {
  return LABELS[language] || LABELS.en;
}

export const SERVICE_LABELS_I18N: Record<ServiceType, { en: string; ta: string; hi: string }> = {
  BIRTH_JATHAGAM: { en: 'Birth Jathagam', ta: 'பிறப்பு ஜாதகம்', hi: 'जन्म कुंडली' },
  MARRIAGE_COMPATIBILITY: { en: 'Marriage Compatibility', ta: 'திருமணப் பொருத்தம்', hi: 'विवाह मिलान' },
  BABY_NAMING: { en: 'Baby Naming', ta: 'குழந்தை பெயரிடல்', hi: 'शिशु नामकरण' },
  MUHURTHAM: { en: 'Subha Muhurtham', ta: 'சுப முகூர்த்தம்', hi: 'शुभ मुहूर्त' }
};

/**
 * Legacy single-chart orders carry their service directly on the header.
 * Multi-person order HEADERS carry `MULTI_PERSON` and are always fulfilled per
 * item, so callers that need one chart's service (preview, PDF, dashboard) get
 * the first item's service instead of the header marker.
 */
export function orderChartServiceType(
  order: Pick<Order, 'serviceType' | 'items' | 'inputPayload'>
): ServiceType {
  if (order.serviceType !== 'MULTI_PERSON') return order.serviceType;
  const itemService = order.items?.find(item => !!item?.serviceCode)?.serviceCode;
  if (itemService) return itemService as ServiceType;
  const payloadService = (order.inputPayload as any)?.serviceType;
  if (typeof payloadService === 'string' && payloadService) return payloadService as ServiceType;
  return 'BIRTH_JATHAGAM';
}

export function serviceLabel(service: ServiceType, language: AppLanguage): string {
  const entry = SERVICE_LABELS_I18N[service];
  return entry ? entry[language] || entry.en : service;
}

/* ------------------------------------------------------------------ *
 *  Drafts                                                             *
 * ------------------------------------------------------------------ */

let draftCounter = 0;
function nextDraftKey(): string {
  draftCounter += 1;
  return `person_${Date.now().toString(36)}_${draftCounter}`;
}

export function createEmptyPersonDraft(language: AppLanguage = 'en'): PersonDraft {
  return {
    key: nextDraftKey(),
    name: '',
    gender: 'M',
    dob: '',
    tob: '',
    place: '',
    country: '',
    latitude: null,
    longitude: null,
    timezoneOffsetHours: null,
    timeZoneId: '',
    services: ['BIRTH_JATHAGAM'],
    language
  };
}

function draftFromPayload(payload: Record<string, any>, language: AppLanguage): PersonDraft {
  const p = payload?.bride || payload?.groom || payload || {};
  const rawName = payload?.name || payload?.devoteeName || payload?.babyName || payload?.bride?.name || payload?.groom?.name || '';
  const rawPlace = p.birthPlace || p.place || p.placeName || payload?.birthPlace || payload?.place || payload?.placeName || '';
  const rawCountry = p.country || payload?.country || '';
  const rawDob = p.dob || payload?.dob || '';
  const rawTob = p.tob || payload?.tob || '';
  const rawGender = p.gender || payload?.gender;

  return {
    key: nextDraftKey(),
    name: String(rawName || ''),
    gender: rawGender === 'F' ? 'F' : rawGender === 'O' ? 'O' : 'M',
    // Tray payloads may use any accepted spelling; the cards use ISO + 24h.
    dob: normalizeBirthDate(String(rawDob || '')) || String(rawDob || ''),
    tob: normalizeBirthTime(String(rawTob || '')) || String(rawTob || ''),
    place: String(rawPlace || ''),
    country: String(rawCountry || ''),
    latitude: typeof p.latitude === 'number' ? p.latitude : (typeof payload?.latitude === 'number' ? payload.latitude : null),
    longitude: typeof p.longitude === 'number' ? p.longitude : (typeof payload?.longitude === 'number' ? payload.longitude : null),
    timezoneOffsetHours: typeof p.timezoneOffsetHours === 'number' ? p.timezoneOffsetHours : (typeof payload?.timezoneOffsetHours === 'number' ? payload.timezoneOffsetHours : null),
    timeZoneId: String(p.timeZoneId || payload?.timeZoneId || ''),
    services: [],
    language
  };
}

/** Stable identity of one person across tray items (name + birth details). */
export function personIdentity(payload: Record<string, any>): string {
  const p = payload?.bride || payload?.groom || payload || {};
  const rawName = payload?.name || payload?.devoteeName || payload?.babyName || payload?.bride?.name || payload?.groom?.name || '';
  const rawPlace = p.birthPlace || p.place || p.placeName || payload?.birthPlace || payload?.place || payload?.placeName || '';
  const rawDob = p.dob || payload?.dob || '';
  const rawTob = p.tob || payload?.tob || '';
  return [
    String(rawName).trim().toLowerCase(),
    String(rawDob).trim(),
    String(rawTob).trim(),
    String(rawPlace).trim().toLowerCase()
  ].join('|');
}

/**
 * Seeds the person cards from the family tray: several tray charts belonging to
 * the same person become ONE card with several services ticked.
 */
export function groupCartItemsIntoPeople(items: CartItem[], language: AppLanguage = 'en'): PersonDraft[] {
  const byPerson = new Map<string, PersonDraft>();

  (items || []).forEach(item => {
    const payload = item.inputPayload || {};
    const identity = personIdentity(payload);
    let draft = byPerson.get(identity);
    if (!draft) {
      draft = draftFromPayload(payload, item.language || language);
      byPerson.set(identity, draft);
    }
    if (!draft.services.includes(item.serviceType)) {
      draft.services.push(item.serviceType);
    }
    // The muhurtham event location travels with its own item.
    if (item.serviceType === 'MUHURTHAM' && !draft.muhurtham) {
      draft.muhurtham = {
        place: String(payload.muhurthamPlace || ''),
        country: String(payload.muhurthamCountry || ''),
        latitude: typeof payload.muhurthamLatitude === 'number' ? payload.muhurthamLatitude : null,
        longitude: typeof payload.muhurthamLongitude === 'number' ? payload.muhurthamLongitude : null,
        timezoneOffsetHours: typeof payload.muhurthamTimezoneOffsetHours === 'number' ? payload.muhurthamTimezoneOffsetHours : null,
        timeZoneId: String(payload.muhurthamTimeZoneId || ''),
        eventKey: String(payload.eventKey || 'wedding'),
        selectedMonth: String(payload.selectedMonth || '')
      };
    }
    if (item.serviceType === 'MARRIAGE_COMPATIBILITY' && !draft.partner) {
      const partner = payload.groom && payload.bride
        ? (draft.gender === 'F' ? payload.groom : payload.bride)
        : payload.partner;
      if (partner) {
        draft.partner = {
          name: String(partner.name || ''),
          gender: draft.gender === 'F' ? 'M' : 'F',
          dob: String(partner.dob || ''),
          tob: String(partner.tob || ''),
          place: String(partner.birthPlace || ''),
          country: String(partner.country || ''),
          latitude: typeof partner.latitude === 'number' ? partner.latitude : null,
          longitude: typeof partner.longitude === 'number' ? partner.longitude : null,
          timezoneOffsetHours: typeof partner.timezoneOffsetHours === 'number' ? partner.timezoneOffsetHours : null,
          timeZoneId: String(partner.timeZoneId || '')
        };
      }
    }
  });

  // A person must always keep at least one service.
  return Array.from(byPerson.values()).map(draft => ({
    ...draft,
    services: draft.services.length > 0 ? draft.services : ['BIRTH_JATHAGAM']
  }));
}

/* ------------------------------------------------------------------ *
 *  Validation                                                         *
 * ------------------------------------------------------------------ */

function hasCoordinates(lat: number | null, lon: number | null, tz: number | null): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
    && typeof tz === 'number' && Number.isFinite(tz) && tz >= -14 && tz <= 14;
}

/** Everything wrong with one person card, in plain language. */
export function validatePersonDraft(
  person: PersonDraft,
  index: number,
  labels: CheckoutLabels = LABELS.en
): string[] {
  const problems: string[] = [];
  const who = `${labels.person} ${index + 1}`;

  if (!normalizePersonName(person.name)) problems.push(`${who}: ${labels.name}.`);
  if (!person.dob || !isValidIsoBirthDate(person.dob)) problems.push(`${who}: ${labels.dob}.`);
  if (!person.tob || !isValidBirthTime(person.tob)) problems.push(`${who}: ${labels.tob}.`);
  if (!person.place.trim()) problems.push(`${who}: ${labels.place}.`);
  if (!hasCoordinates(person.latitude, person.longitude, person.timezoneOffsetHours)) {
    problems.push(`${who}: ${labels.place} — select it from search, map or GPS.`);
  }
  if (!person.services || person.services.length === 0) {
    problems.push(`${who}: ${labels.selectAtLeastOne}`);
  }

  if (person.services.includes('MARRIAGE_COMPATIBILITY')) {
    const partner = person.partner;
    if (!partner || !normalizePersonName(partner.name) || !isValidIsoBirthDate(partner.dob) || !isValidBirthTime(partner.tob)
      || !partner.place.trim() || !hasCoordinates(partner.latitude, partner.longitude, partner.timezoneOffsetHours)) {
      problems.push(`${who}: ${labels.partnerHeading}.`);
    }
  }

  if (person.services.includes('MUHURTHAM')) {
    const m = person.muhurtham;
    if (!m || !m.place.trim() || !hasCoordinates(m.latitude, m.longitude, m.timezoneOffsetHours)
      || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.selectedMonth || '')) {
      problems.push(`${who}: ${labels.muhurthamHeading}.`);
    }
  }

  return problems;
}

/** Whole-order validation: 1..6 people, every card complete. */
export function validatePeople(
  people: PersonDraft[],
  language: AppLanguage = 'en'
): { ok: boolean; errors: string[]; itemCount: number } {
  const labels = multiPersonLabels(language);
  const errors: string[] = [];

  if (!people || people.length < MULTI_PERSON_MIN_PEOPLE) {
    errors.push(labels.minPeople);
    return { ok: false, errors, itemCount: 0 };
  }
  if (people.length > MULTI_PERSON_MAX_PEOPLE) {
    errors.push(labels.maxPeople);
  }

  people.forEach((person, index) => {
    errors.push(...validatePersonDraft(person, index, labels));
  });

  const itemCount = people.reduce((sum, person) => sum + (person.services?.length || 0), 0);
  if (itemCount === 0) errors.push(labels.selectAtLeastOne);
  if (itemCount > MULTI_PERSON_MAX_ITEMS) errors.push(labels.maxPeople);

  return { ok: errors.length === 0, errors, itemCount };
}

/* ------------------------------------------------------------------ *
 *  Pricing (the SERVER recalculates; this is what the customer sees)  *
 * ------------------------------------------------------------------ */

/** Price of one card in the selected currency, honouring admin overrides. */
export function personPrices(person: PersonDraft, settings: SystemSettings | null): CurrencyPriceMap {
  return person.services.reduce<CurrencyPriceMap>(
    (sum, service) => {
      const price = getServicePrices(settings, service);
      return { FJD: sum.FJD + price.FJD, INR: sum.INR + price.INR, USD: sum.USD + price.USD };
    },
    { FJD: 0, INR: 0, USD: 0 }
  );
}

export function personPrice(
  person: PersonDraft,
  settings: SystemSettings | null,
  currency: CurrencyCode,
  /** Free Beta frees the FIRST report of the order only. */
  freeFirstReport = false
): number {
  const prices = personPrices(person, settings);
  let total = prices[currency] || 0;
  if (freeFirstReport && person.services.length > 0) {
    total -= getServicePrices(settings, person.services[0])[currency] || 0;
  }
  return Math.max(0, total);
}

export interface MultiPersonTotals {
  currency: CurrencyCode;
  /** Price of every report in order, in the selected currency. */
  lineTotals: number[];
  total: number;
  itemCount: number;
  freeFirstReport: boolean;
}

/**
 * Running grand total for the whole order - one currency, one number.
 * FREE BETA still frees exactly ONE report (the first report of the order).
 */
export function multiPersonTotals(
  people: PersonDraft[],
  settings: SystemSettings | null,
  currency: CurrencyCode,
  freeFirstReport = false
): MultiPersonTotals {
  const lineTotals: number[] = [];
  let total = 0;
  let reportIndex = 0;

  (people || []).forEach(person => {
    (person.services || []).forEach(service => {
      const isFree = freeFirstReport && reportIndex === 0;
      const price = isFree ? 0 : (getServicePrices(settings, service)[currency] || 0);
      lineTotals.push(price);
      total += price;
      reportIndex += 1;
    });
  });

  return { currency, lineTotals, total, itemCount: lineTotals.length, freeFirstReport };
}

/* ------------------------------------------------------------------ *
 *  Payload for the API                                                *
 * ------------------------------------------------------------------ */

function partnerPayload(person: PersonDraft) {
  const partner = person.partner;
  if (!partner) return undefined;
  return {
    name: normalizePersonName(partner.name),
    gender: partner.gender,
    dob: partner.dob,
    tob: partner.tob,
    birthPlace: partner.place,
    country: partner.country,
    latitude: partner.latitude,
    longitude: partner.longitude,
    timezoneOffsetHours: partner.timezoneOffsetHours,
    timeZoneId: partner.timeZoneId
  };
}

/**
 * Builds the muhurtham block (including the six-month panchangam scan the
 * astrology engine requires) using the EXACT same scanner the Subha Muhurtham
 * page uses, so a Muhurtham report ordered here is identical to one ordered
 * there.
 */
function muhurthamPayload(person: PersonDraft, language: AppLanguage): Record<string, any> | undefined {
  const m = person.muhurtham;
  if (!m) return undefined;

  const [targetYear, targetMonth] = String(m.selectedMonth).split('-').map(Number);
  if (!targetYear || !targetMonth) return undefined;
  const targetDate = new Date(targetYear, targetMonth - 1, 1);

  let months: any[] = [];
  let persons: any[] = [];
  try {
    const birthTimezone = resolveLocationTimezone(
      person.dob,
      person.tob,
      person.latitude || 0,
      person.longitude || 0,
      person.timezoneOffsetHours || 0,
      person.timeZoneId
    );
    const birthStar = findNakshatraFromBirthDetails(
      person.dob,
      person.tob,
      false,
      birthTimezone.timezoneOffsetHours,
      person.latitude || 0,
      person.longitude || 0
    );
    const scanPersons: PersonInput[] = birthStar
      ? [{ role: 'self', nakshatraIndex: birthStar.primary.nakshatraIndex, rasiNumber: birthStar.primary.rasiNumber }]
      : [];
    const scanLocation = {
      placeName: m.place,
      latitude: m.latitude || 0,
      longitude: m.longitude || 0,
      timezoneOffsetHours: m.timezoneOffsetHours || 0,
      timeZoneId: m.timeZoneId
    };
    months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + index - 2, 1);
      return scanMonthMuhurtham(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        scanLocation,
        m.eventKey as MuhurthamEventKey,
        { persons: scanPersons, birthDate: person.dob, skipPastDates: true }
      );
    });
    persons = birthStar
      ? [{
          role: 'You',
          nakshatraIndex: birthStar.primary.nakshatraIndex,
          nakshatraNameEn: birthStar.primary.nakshatraNameEn,
          nakshatraNameTa: birthStar.primary.nakshatraNameTa,
          nakshatraNameHi: birthStar.primary.nakshatraNameHi
        }]
      : [];
  } catch (error) {
    console.warn('Muhurtham scan could not be prepared for this person:', error);
  }

  const events = (rulesData as any).events || {};
  const event = events[m.eventKey] || {};
  return {
    place: m.place,
    country: m.country,
    latitude: m.latitude,
    longitude: m.longitude,
    timezoneOffsetHours: m.timezoneOffsetHours,
    timeZoneId: m.timeZoneId,
    eventKey: m.eventKey,
    eventTitleEn: event.titleEn || m.eventKey,
    eventTitleTa: event.titleTa || '',
    eventTitleHi: event.titleHi || '',
    selectedMonth: m.selectedMonth,
    scan: {
      muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
      selectedMonth: m.selectedMonth,
      eventKey: m.eventKey,
      months,
      persons
    },
    language
  };
}

export interface MultiPersonOrderPayloadPerson {
  name: string;
  gender: string;
  dob: string;
  tob: string;
  place: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezoneOffsetHours: number | null;
  timeZoneId: string;
  services: ServiceType[];
  language: AppLanguage;
  partner?: Record<string, any>;
  muhurtham?: Record<string, any>;
}

/** 1..6 people -> the `people[]` array POSTed to the create-order endpoint. */
export function buildPeoplePayload(people: PersonDraft[]): MultiPersonOrderPayloadPerson[] {
  return (people || []).map(person => ({
    name: normalizePersonName(person.name),
    gender: person.gender,
    dob: person.dob,
    tob: person.tob,
    place: person.place,
    country: person.country,
    latitude: person.latitude,
    longitude: person.longitude,
    timezoneOffsetHours: person.timezoneOffsetHours,
    timeZoneId: person.timeZoneId,
    services: person.services.slice(),
    language: person.language,
    partner: partnerPayload(person),
    muhurtham: person.services.includes('MUHURTHAM') ? muhurthamPayload(person, person.language) : undefined
  }));
}

/** A short human summary used in the order tray and admin lists. */
export function personSummary(person: PersonDraft): string {
  const parts: string[] = [];
  if (person.dob) parts.push(person.dob);
  if (person.tob) parts.push(person.tob);
  if (person.place) parts.push(person.place);
  return parts.join(' • ');
}
