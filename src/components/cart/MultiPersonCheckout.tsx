import React from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Plus, Trash2, User, Users } from 'lucide-react';
import {
  AppLanguage,
  CurrencyCode,
  ServiceType,
  SystemSettings
} from '../../types';
import { BirthDateField, BirthTimeField, BirthTimeZoneNotice, MonthField } from '../common/BirthDateTimeFields';
import { resolveLocationTimezone } from '../../lib/timezone';
import { GooglePlacesPicker, LocationData } from '../common/GooglePlacesPicker';
import { PersonNameField } from '../common/PersonNameField';
import {
  MULTI_PERSON_MAX_PEOPLE,
  PersonDraft,
  createEmptyPersonDraft,
  multiPersonLabels,
  personPrice,
  serviceLabel,
  validatePersonDraft
} from '../../services/multiPersonOrder';
import { formatMoney } from '../../services/pricing';
import rulesData from '../../lib/muhurtham/rules.json';

/**
 * PERSON-CARD CHECKOUT
 * --------------------
 * One card per person: name, gender, date of birth, time of birth, birth place
 * and the service checklist for that person. Add/remove buttons keep the order
 * between 1 and 6 people. The running grand total is the one amount the customer
 * pays - the server recomputes it from its own price list on submit.
 *
 * Labels follow the site's Tamil / English / Hindi pattern.
 */

const EVENT_KEYS = [
  'wedding', 'engagement', 'griha_pravesam', 'house_purchase', 'house_construction', 'land_purchase',
  'shifting_home', 'business_start', 'new_job', 'gold_purchase', 'vehicle_purchase', 'education_start',
  'namakaranam', 'annaprasanam', 'seemantham', 'upanayanam', 'karnavedha', 'mundan'
];

const eventOptions = ((): Array<{ key: string; label: string }> => {
  const events = ((rulesData as any).events || {}) as Record<string, any>;
  return EVENT_KEYS.filter(key => events[key]).map(key => ({
    key,
    label: events[key].titleEn || key
  }));
})();

/** Default report month = the coming month, matching the Muhurtham page. */
export function defaultMuhurthamMonth(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function toLocationData(person: PersonDraft): LocationData | null {
  if (!person.place.trim() || person.latitude === null || person.longitude === null) return null;
  return {
    placeName: person.place,
    country: person.country,
    latitude: person.latitude,
    longitude: person.longitude,
    timezoneOffsetHours: person.timezoneOffsetHours ?? 0,
    timeZoneId: person.timeZoneId
  };
}

export interface MultiPersonCheckoutProps {
  people: PersonDraft[];
  onChange: (people: PersonDraft[]) => void;
  settings: SystemSettings | null;
  currency: CurrencyCode;
  language: AppLanguage;
  /** FREE BETA frees the FIRST report of the order (per IP), never more. */
  freeFirstReport?: boolean;
  isAdminFreeOrder?: boolean;
  disabled?: boolean;
  /** Validation messages produced on submit, shown above the cards. */
  errors?: string[];
}

export const MultiPersonCheckout: React.FC<MultiPersonCheckoutProps> = ({
  people,
  onChange,
  settings,
  currency,
  language,
  freeFirstReport = false,
  isAdminFreeOrder = false,
  disabled = false,
  errors = []
}) => {
  const labels = multiPersonLabels(language);
  const canAdd = people.length < MULTI_PERSON_MAX_PEOPLE;
  const canRemove = people.length > 1;

  const updatePerson = (key: string, patch: Partial<PersonDraft>) => {
    onChange(people.map(person => (person.key === key ? { ...person, ...patch } : person)));
  };

  const toggleService = (key: string, service: ServiceType) => {
    onChange(people.map(person => {
      if (person.key !== key) return person;
      const has = person.services.includes(service);
      const services = has
        ? person.services.filter(s => s !== service)
        : [...person.services, service];
      const patch: Partial<PersonDraft> = { services };
      if (services.includes('MARRIAGE_COMPATIBILITY') && !person.partner) {
        patch.partner = {
          name: '',
          gender: person.gender === 'F' ? 'M' : 'F',
          dob: '',
          tob: '',
          place: '',
          country: '',
          latitude: null,
          longitude: null,
          timezoneOffsetHours: null,
          timeZoneId: ''
        };
      }
      if (services.includes('MUHURTHAM') && !person.muhurtham) {
        patch.muhurtham = {
          place: '',
          country: '',
          latitude: null,
          longitude: null,
          timezoneOffsetHours: null,
          timeZoneId: '',
          eventKey: 'wedding',
          selectedMonth: defaultMuhurthamMonth()
        };
      }
      return { ...person, ...patch };
    }));
  };

  const addPerson = () => {
    if (!canAdd) return;
    onChange([...people, createEmptyPersonDraft(language)]);
  };

  const removePerson = (key: string) => {
    if (!canRemove) return;
    onChange(people.filter(person => person.key !== key));
  };

  const inputClass =
    'w-full rounded-xl bg-slate-950/70 border border-slate-700 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-amber-500/70 disabled:opacity-60';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <span>
            {labels.peopleTitle} ({people.length} / {MULTI_PERSON_MAX_PEOPLE})
          </span>
        </h3>
        <button
          type="button"
          onClick={addPerson}
          disabled={!canAdd || disabled}
          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>{labels.addPerson}</span>
        </button>
      </div>

      {errors.length > 0 && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
          {errors.map((error, index) => (
            <div key={index} className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {people.map((person, index) => {
        const problems = validatePersonDraft(person, index, labels);
        const price = isAdminFreeOrder ? 0 : personPrice(person, settings, currency, freeFirstReport && index === 0);

        return (
          <div
            key={person.key}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {labels.person} {index + 1}
                    {person.name.trim() ? ` — ${person.name.trim()}` : ''}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {person.services.length} {person.services.length === 1 ? 'report' : 'reports'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-amber-400 whitespace-nowrap">
                  {price <= 0 ? (
                    <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {isAdminFreeOrder ? 'FREE (Admin)' : 'FREE (1st report)'}
                    </span>
                  ) : (
                    formatMoney(price, currency)
                  )}
                </span>
                <button
                  type="button"
                  title={labels.removePerson}
                  onClick={() => removePerson(person.key)}
                  disabled={!canRemove || disabled}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <PersonNameField
                  value={person.name}
                  onChange={value => updatePerson(person.key, { name: value })}
                  label={labels.name}
                  theme="dark"
                  size="sm"
                  id={`multi-person-name-${person.key}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{labels.gender}</label>
                <select
                  value={person.gender}
                  onChange={e => updatePerson(person.key, { gender: e.target.value as PersonDraft['gender'] })}
                  className={inputClass}
                  disabled={disabled}
                >
                  <option value="M">{labels.male}</option>
                  <option value="F">{labels.female}</option>
                  <option value="O">{labels.other}</option>
                </select>
              </div>

              <div>
                <BirthDateField
                  value={person.dob}
                  onChange={iso => updatePerson(person.key, { dob: iso })}
                  label={labels.dob}
                  theme="dark"
                  size="sm"
                  id={`multi-person-dob-${person.key}`}
                />
              </div>

              <div>
                <BirthTimeField
                  value={person.tob}
                  onChange={tob => updatePerson(person.key, { tob })}
                  label={labels.tob}
                  theme="dark"
                  size="sm"
                  id={`multi-person-tob-${person.key}`}
                />
              </div>

              <div className="sm:col-span-2">
                <GooglePlacesPicker
                  value={toLocationData(person)}
                  onChange={location => {
                    if (!location) {
                      updatePerson(person.key, { place: '', latitude: null, longitude: null, timezoneOffsetHours: null, timeZoneId: '' });
                      return;
                    }
                    updatePerson(person.key, {
                      place: location.placeName,
                      country: location.country || '',
                      latitude: location.latitude,
                      longitude: location.longitude,
                      timezoneOffsetHours: location.timezoneOffsetHours,
                      timeZoneId: location.timeZoneId || ''
                    });
                  }}
                  label={labels.place}
                  required
                />
                {person.latitude !== null && person.longitude !== null && (
                  <BirthTimeZoneNotice
                    theme="dark"
                    className="mt-1.5"
                    date={person.dob}
                    time={person.tob}
                    resolution={resolveLocationTimezone(
                      person.dob, person.tob, person.latitude, person.longitude,
                      person.timezoneOffsetHours ?? Number.NaN, person.timeZoneId
                    )}
                  />
                )}
              </div>
            </div>

            {/* Service checklist - one person can buy several reports */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {labels.servicesHeading}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'] as ServiceType[]).map(service => {
                  const checked = person.services.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(person.key, service)}
                      disabled={disabled}
                      className={`text-left px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                        checked
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                          : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span className="leading-tight">{serviceLabel(service, language)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Marriage Compatibility needs the partner's birth details */}
            {person.services.includes('MARRIAGE_COMPATIBILITY') && person.partner && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-3">
                <div className="text-[11px] font-bold text-rose-200">{labels.partnerHeading}</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <PersonNameField
                      value={person.partner.name}
                      onChange={value => updatePerson(person.key, { partner: { ...person.partner!, name: value } })}
                      label={labels.name}
                      theme="dark"
                      size="sm"
                      id={`multi-person-partner-name-${person.key}`}
                    />
                  </div>
                  <BirthDateField
                    value={person.partner.dob}
                    onChange={iso => updatePerson(person.key, { partner: { ...person.partner!, dob: iso } })}
                    label={labels.dob}
                    theme="dark"
                    size="sm"
                    id={`multi-person-partner-dob-${person.key}`}
                  />
                  <BirthTimeField
                    value={person.partner.tob}
                    onChange={tob => updatePerson(person.key, { partner: { ...person.partner!, tob } })}
                    label={labels.tob}
                    theme="dark"
                    size="sm"
                    id={`multi-person-partner-tob-${person.key}`}
                  />
                  <div className="sm:col-span-2">
                    <GooglePlacesPicker
                      value={person.partner.place && person.partner.latitude !== null ? {
                        placeName: person.partner.place,
                        country: person.partner.country,
                        latitude: person.partner.latitude,
                        longitude: person.partner.longitude ?? 0,
                        timezoneOffsetHours: person.partner.timezoneOffsetHours ?? 0,
                        timeZoneId: person.partner.timeZoneId
                      } : null}
                      onChange={location => {
                        if (!location) {
                          updatePerson(person.key, { partner: { ...person.partner!, place: '', latitude: null, longitude: null, timezoneOffsetHours: null, timeZoneId: '' } });
                          return;
                        }
                        updatePerson(person.key, {
                          partner: {
                            ...person.partner!,
                            place: location.placeName,
                            country: location.country || '',
                            latitude: location.latitude,
                            longitude: location.longitude,
                            timezoneOffsetHours: location.timezoneOffsetHours,
                            timeZoneId: location.timeZoneId || ''
                          }
                        });
                      }}
                      label={labels.place}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Subha Muhurtham needs the ceremony location + report month */}
            {person.services.includes('MUHURTHAM') && person.muhurtham && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
                <div className="text-[11px] font-bold text-amber-200 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{labels.muhurthamHeading}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">{labels.muhurthamEvent}</label>
                    <select
                      value={person.muhurtham.eventKey}
                      onChange={e => updatePerson(person.key, { muhurtham: { ...person.muhurtham!, eventKey: e.target.value } })}
                      className={inputClass}
                      disabled={disabled}
                    >
                      {eventOptions.map(option => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <MonthField
                    value={person.muhurtham.selectedMonth}
                    onChange={month => updatePerson(person.key, { muhurtham: { ...person.muhurtham!, selectedMonth: month } })}
                    label={labels.muhurthamMonth}
                    theme="dark"
                    size="sm"
                    id={`multi-person-muhurtham-month-${person.key}`}
                  />
                  <div className="sm:col-span-2">
                    <GooglePlacesPicker
                      value={person.muhurtham.place && person.muhurtham.latitude !== null ? {
                        placeName: person.muhurtham.place,
                        country: person.muhurtham.country,
                        latitude: person.muhurtham.latitude,
                        longitude: person.muhurtham.longitude ?? 0,
                        timezoneOffsetHours: person.muhurtham.timezoneOffsetHours ?? 0,
                        timeZoneId: person.muhurtham.timeZoneId
                      } : null}
                      onChange={location => {
                        if (!location) {
                          updatePerson(person.key, { muhurtham: { ...person.muhurtham!, place: '', latitude: null, longitude: null, timezoneOffsetHours: null, timeZoneId: '' } });
                          return;
                        }
                        updatePerson(person.key, {
                          muhurtham: {
                            ...person.muhurtham!,
                            place: location.placeName,
                            country: location.country || '',
                            latitude: location.latitude,
                            longitude: location.longitude,
                            timezoneOffsetHours: location.timezoneOffsetHours,
                            timeZoneId: location.timeZoneId || ''
                          }
                        });
                      }}
                      label={labels.muhurthamPlace}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {problems.length > 0 && (
              <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 space-y-1">
                {problems.map((problem, problemIndex) => (
                  <div key={problemIndex}>• {problem}</div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              <span>{labels.subtotal}</span>
              <span className="font-bold text-slate-200">
                {price <= 0 ? 'FREE' : formatMoney(price, currency)}
              </span>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addPerson}
          disabled={!canAdd || disabled}
          className="w-full py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 border border-dashed border-slate-600 text-xs font-semibold text-slate-300 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>{labels.addPerson} ({people.length}/{MULTI_PERSON_MAX_PEOPLE})</span>
        </button>
      </div>

      {!canAdd && (
        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5">
          {labels.maxPeople}
        </div>
      )}
    </div>
  );
};
