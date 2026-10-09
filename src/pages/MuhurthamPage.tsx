import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, CheckCircle2, Eye, FileText, Mail, MapPin, ShieldCheck, Users, ShoppingCart, ShoppingBag } from 'lucide-react';
import { SEO } from '../components/common/SEO';
import { PersonNameField } from '../components/common/PersonNameField';
import { ServicePageHeader } from '../components/common/ServicePageHeader';
import { GooglePlacesPicker, LocationData } from '../components/common/GooglePlacesPicker';
import { AuthModal } from '../components/common/AuthModal';
import { PaymentGatewayCheckoutBox } from '../components/cart/PaymentGatewayCheckoutBox';
import { SingleServiceCheckoutModal } from '../components/cart/SingleServiceCheckoutModal';
import { SampleReportButton } from '../components/common/SampleReportButton';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import {
  getCurrencyForPaymentMethod,
  getCurrencySymbol,
  getServicePriceInCurrency,
  getServicePrices
} from '../services/pricing';
import { MAX_FAMILY_ORDER_ITEMS, hasFamilyOrderCapacity } from '../services/familyOrderLimits';
import rulesData from '../lib/muhurtham/rules.json';
import {
  scanMonthMuhurtham,
  describePersonForMuhurtham,
  MUHURTHAM_ALGORITHM_VERSION,
  PersonInput,
  MuhurthamPersonDetails
} from '../lib/muhurtham/scanner';
import { AppLanguage, PaymentMethod } from '../types';
import { BirthDateField, BirthTimeField, BirthTimeZoneNotice, MonthField } from '../components/common/BirthDateTimeFields';
import { isoToDisplayDob, parseFlexibleDob, parseFlexibleTob } from '../utils/dateTimeInput';
import { resolveLocationTimezone } from '../lib/timezone';
import {
  isValidBirthTime,
  isValidIsoBirthDate,
  isVerifiedBirthLocation,
  locationFromBirthProfile,
  normalizeBirthDate,
  normalizeBirthTime,
  normalizePersonName
} from '../utils/birthDetails';

const EVENT_ORDER = [
  'wedding', 'engagement', 'griha_pravesam', 'house_purchase', 'house_construction', 'land_purchase',
  'shifting_home', 'business_start', 'new_job', 'gold_purchase', 'vehicle_purchase', 'education_start',
  'namakaranam', 'annaprasanam', 'seemantham', 'upanayanam', 'karnavedha', 'mundan'
] as const;

type MuhurthamEventKey = typeof EVENT_ORDER[number];
type EventInfo = { titleEn?: string; titleTa?: string; titleHi?: string; descriptionEn?: string };
const EVENTS = rulesData.events as Record<MuhurthamEventKey, EventInfo>;

const eventTitle = (key: MuhurthamEventKey) => EVENTS[key].titleEn || key;

/** "What is included" checklist beside the form. Wording follows the Services page listing. */
const REPORT_INCLUSIONS: { title: string; text: string }[] = [
  {
    title: '6-Month Auspicious Date Matrix',
    text: 'The two months before your selected month, that month and the following three.'
  },
  {
    title: '18 Vedic Ceremonies Covered',
    text: 'Wedding, Griha Pravesam, Bhoomi Pooja, Business Start, Annaprasanam, Seemantham, Upanayanam and more.'
  },
  {
    title: 'Nalla Neram, Rahu Kalam & Yamaganda',
    text: 'Timings worked out for your function location’s local sunrise and timezone.'
  },
  {
    title: 'Tara Balam & Chandrashtama Checks',
    text: 'Dates are checked against your own Janma Nakshatra and Rasi from your birth details.'
  },
  {
    title: 'English, Tamil & Hindi PDF',
    text: 'Choose your report language; the approved PDF is emailed to you.'
  }
];

const monthInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const defaultTargetMonth = () => {
  const now = new Date();
  return monthInputValue(new Date(now.getFullYear(), now.getMonth() + 2, 1));
};

export const MuhurthamPage: React.FC<{ onNavigate?: (route: string) => void }> = ({ onNavigate }) => {
  const { user, birthProfile, settings } = useAuth();
  const { paymentMethod, setPaymentMethod, addItem, openCart, items: cartItems } = useCart();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('en');
  const [selectedMonth, setSelectedMonth] = useState(defaultTargetMonth);
  const [selectedEvent, setSelectedEvent] = useState<MuhurthamEventKey>('wedding');
  const [name, setName] = useState(
    normalizePersonName(birthProfile?.name || '') || normalizePersonName(user?.name || '')
  );
  const [dob, setDob] = useState('');
  const [dobText, setDobText] = useState('');
  const [tob, setTob] = useState('');
  const [tobText, setTobText] = useState('');
  const [tobPeriod, setTobPeriod] = useState<'AM' | 'PM'>('AM');
  const [birthPlace, setBirthPlace] = useState<LocationData | null>(null);
  const [muhurthamPlace, setMuhurthamPlace] = useState<LocationData | null>(null);
  // Wedding orders collect the SECOND person's chart as well (bride when the
  // first person is the groom). Every candidate date is then checked against
  // both horoscopes; leaving this block empty still produces a valid report,
  // which states that only one person's details were used.
  const [partnerName, setPartnerName] = useState('');
  const [partnerDob, setPartnerDob] = useState('');
  const [partnerDobText, setPartnerDobText] = useState('');
  const [partnerTob, setPartnerTob] = useState('');
  const [partnerTobText, setPartnerTobText] = useState('');
  const [partnerTobPeriod, setPartnerTobPeriod] = useState<'AM' | 'PM'>('AM');
  const [partnerBirthPlace, setPartnerBirthPlace] = useState<LocationData | null>(null);
  const manuallyEditedFields = useRef({ name: false, dob: false, tob: false, birthPlace: false });
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState('');
  const [successOrder, setSuccessOrder] = useState<any>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [traySuccessMessage, setTraySuccessMessage] = useState('');

  useEffect(() => {
    if (birthProfile) {
      if (!manuallyEditedFields.current.name) {
        setName(normalizePersonName(birthProfile.name) || normalizePersonName(user?.name || ''));
      }
      const profileDob = normalizeBirthDate(birthProfile.dob);
      if (profileDob && !manuallyEditedFields.current.dob) {
        setDob(profileDob);
        setDobText(isoToDisplayDob(profileDob));
      }
      const profileTob = normalizeBirthTime(birthProfile.tob);
      if (profileTob && !manuallyEditedFields.current.tob) {
        const parsed = parseFlexibleTob(profileTob, 'AM', { allowHourOnly: true });
        setTob(profileTob);
        if (parsed) {
          setTobText(parsed.display12);
          setTobPeriod(parsed.period);
        }
      }
      if (birthProfile.birthPlace && !manuallyEditedFields.current.birthPlace) {
        setBirthPlace(locationFromBirthProfile(birthProfile));
      }
    } else if (user?.name && !manuallyEditedFields.current.name) {
      setName(normalizePersonName(user.name));
    }
  }, [birthProfile, user]);

  const isAdmin = user?.role === 'admin';
  const isFreeBeta = settings?.serviceMode === 'FREE_BETA' && settings?.betaFreeChartAvailable !== false;
  const isFreeOrder = isAdmin || isFreeBeta;
  const currency = getCurrencyForPaymentMethod(paymentMethod);
  const amount = getServicePriceInCurrency(settings, 'MUHURTHAM', currency);
  const currencySymbol = getCurrencySymbol(currency);

  const eventOptions = useMemo(() => EVENT_ORDER.map(key => ({ key, label: eventTitle(key) })), []);
  // The ceremonies that join two people are matched to two horoscopes
  // (bride + groom): a wedding and an engagement. Every other ceremony is a
  // one-person report.
  const checksBothCharts = selectedEvent === 'wedding' || selectedEvent === 'engagement';

  const resolveCurrentDob = (): string => {
    const resolved = dob || parseFlexibleDob(dobText, true);
    if (resolved && resolved !== dob) {
      setDob(resolved);
      setDobText(isoToDisplayDob(resolved));
    }
    return resolved;
  };

  const resolveCurrentTob = (): string => {
    if (tob) return tob;
    const parsed = parseFlexibleTob(tobText, tobPeriod, { allowHourOnly: true });
    if (parsed) {
      setTob(parsed.tob24);
      setTobPeriod(parsed.period);
      setTobText(parsed.display12);
      return parsed.tob24;
    }
    return '';
  };

  const resolvePartnerDob = (): string => {
    const resolved = partnerDob || parseFlexibleDob(partnerDobText, true);
    if (resolved && resolved !== partnerDob) {
      setPartnerDob(resolved);
      setPartnerDobText(isoToDisplayDob(resolved));
    }
    return resolved;
  };

  const resolvePartnerTob = (): string => {
    if (partnerTob) return partnerTob;
    const parsed = parseFlexibleTob(partnerTobText, partnerTobPeriod, { allowHourOnly: true });
    if (parsed) {
      setPartnerTob(parsed.tob24);
      setPartnerTobPeriod(parsed.period);
      setPartnerTobText(parsed.display12);
      return parsed.tob24;
    }
    return '';
  };

  /** True when anything at all was typed in the second-person block. */
  const hasPartnerDetails = () =>
    Boolean(normalizePersonName(partnerName) || partnerDob || partnerDobText.trim() ||
      partnerTob || partnerTobText.trim() || partnerBirthPlace);

  /** The second person is usable only when the complete chart is available. */
  const partnerErrors = (): string => {
    if (!hasPartnerDetails()) return '';
    if (!normalizePersonName(partnerName)) return 'Please enter the second person\'s full name, or clear the second person fields.';
    if (!resolvePartnerDob()) {
      return partnerDobText.trim()
        ? 'Please enter a valid second person\'s date of birth in DD/MM/YYYY format (for example, 15/08/1990).'
        : 'Please enter the second person\'s date of birth, or clear the second person fields.';
    }
    if (!isValidIsoBirthDate(partnerDob)) return 'Please enter a second person\'s date of birth that is not in the future.';
    if (!resolvePartnerTob()) {
      return partnerTobText.trim()
        ? 'Please enter a valid second person\'s birth time in HH:MM format (for example, 09:30).'
        : 'Please enter the second person\'s time of birth, or clear the second person fields.';
    }
    if (!isValidBirthTime(partnerTob)) return 'Please enter a valid second person\'s birth time, including minutes and AM/PM.';
    if (!isVerifiedBirthLocation(partnerBirthPlace)) {
      return 'Please select the second person\'s birth place again so its exact coordinates and timezone are available.';
    }
    return '';
  };

  const validateBirthDetails = () => {
    const currentDob = resolveCurrentDob();
    const currentTob = resolveCurrentTob();
    if (!normalizePersonName(name)) return 'Please enter your full name.';
    if (!currentDob) {
      return dobText.trim()
        ? 'Please enter a valid date of birth in DD/MM/YYYY format (for example, 15/08/1990).'
        : 'Please enter your date of birth.';
    }
    if (!isValidIsoBirthDate(currentDob)) return 'Please enter a valid date of birth that is not in the future.';
    if (!currentTob) {
      return tobText.trim()
        ? 'Please enter a valid birth time in HH:MM format (for example, 09:30).'
        : 'Please enter your time of birth.';
    }
    if (!isValidBirthTime(currentTob)) return 'Please enter a valid birth time, including minutes and AM/PM.';
    if (!isVerifiedBirthLocation(birthPlace)) {
      return 'Please select your birth place again so its exact coordinates and timezone are available.';
    }
    if (!isVerifiedBirthLocation(muhurthamPlace)) {
      return 'Please select the Muhurtham location again so its exact coordinates and timezone are available.';
    }
    if (checksBothCharts) {
      const partnerError = partnerErrors();
      if (partnerError) return partnerError;
    }
    return '';
  };

  const validate = () => {
    const birthDetailsError = validateBirthDetails();
    if (birthDetailsError) return birthDetailsError;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) return 'Please select a valid report month.';
    if (!isFreeOrder && !paymentReference.trim()) return 'Please complete the payment and enter its receipt or transaction reference.';
    return '';
  };

  const buildMuhurthamScan = (effectiveDob: string, effectiveTob: string) => {
    const [targetYear, targetMonth] = selectedMonth.split('-').map(Number);
    const targetDate = new Date(targetYear, targetMonth - 1, 1);
    const birthTimezone = resolveLocationTimezone(
      effectiveDob, effectiveTob, birthPlace!.latitude, birthPlace!.longitude,
      birthPlace!.timezoneOffsetHours, birthPlace!.timeZoneId
    );
    // Janma Nakshatra / Rasi / Lagna always come from the historical birth
    // details. Bride and groom are BOTH checked for a wedding; with a single
    // complete chart the role stays 'self' and the report states that only one
    // person's details were used.
    const partnerComplete = checksBothCharts && !partnerErrors();
    const personDetails: MuhurthamPersonDetails[] = [];
    const primaryPerson = describePersonForMuhurtham(checksBothCharts && partnerComplete ? 'groom' : 'self', normalizePersonName(name), {
      dob: effectiveDob,
      tob: effectiveTob,
      birthPlace: birthPlace!.placeName,
      timezoneOffsetHours: birthTimezone.timezoneOffsetHours,
      latitude: birthPlace!.latitude,
      longitude: birthPlace!.longitude
    });
    if (primaryPerson) personDetails.push(primaryPerson);
    if (partnerComplete) {
      const partnerDobIso = resolvePartnerDob();
      const partnerTob24 = resolvePartnerTob();
      const partnerTimezone = resolveLocationTimezone(
        partnerDobIso, partnerTob24, partnerBirthPlace!.latitude, partnerBirthPlace!.longitude,
        partnerBirthPlace!.timezoneOffsetHours, partnerBirthPlace!.timeZoneId
      );
      const partnerPerson = describePersonForMuhurtham('bride', normalizePersonName(partnerName), {
        dob: partnerDobIso,
        tob: partnerTob24,
        birthPlace: partnerBirthPlace!.placeName,
        timezoneOffsetHours: partnerTimezone.timezoneOffsetHours,
        latitude: partnerBirthPlace!.latitude,
        longitude: partnerBirthPlace!.longitude
      });
      if (partnerPerson) personDetails.push(partnerPerson);
    }
    const scanPersons: PersonInput[] = personDetails.map(person => ({
      role: person.role,
      nakshatraIndex: person.nakshatraIndex,
      rasiNumber: person.rasiNumber
    }));
    // Sunrise, Panchangam and all displayed Muhurtham windows use the selected
    // residence / ceremony location, independently of the birthplace.
    const scanLocation = {
      placeName: muhurthamPlace!.placeName,
      latitude: muhurthamPlace!.latitude,
      longitude: muhurthamPlace!.longitude,
      timezoneOffsetHours: muhurthamPlace!.timezoneOffsetHours,
      timeZoneId: muhurthamPlace!.timeZoneId
    };
    const months = Array.from({ length: 6 }, (_, index) => {
      // Two months before the selected month, then that month and the next three.
      const monthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + index - 2, 1);
      return scanMonthMuhurtham(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        scanLocation,
        selectedEvent,
        { persons: scanPersons, birthDate: effectiveDob, skipPastDates: true }
      );
    });
    return {
      months,
      persons: personDetails,
      inputContext: {
        dob: effectiveDob,
        tob: effectiveTob,
        birthPlace: birthPlace!.placeName,
        country: birthPlace!.country || '',
        latitude: birthPlace!.latitude,
        longitude: birthPlace!.longitude,
        timezoneOffsetHours: birthTimezone.timezoneOffsetHours,
        timeZoneId: birthTimezone.timeZoneId || '',
        // Second person (bride/groom) — part of the scan stamp so a change to
        // either chart invalidates a cached scan.
        partnerName: normalizePersonName(partnerName),
        partnerDob: partnerComplete ? resolvePartnerDob() : '',
        partnerTob: partnerComplete ? resolvePartnerTob() : '',
        partnerBirthPlace: partnerComplete ? partnerBirthPlace!.placeName : '',
        partnerCountry: partnerComplete ? partnerBirthPlace!.country || '' : '',
        partnerLatitude: partnerComplete ? partnerBirthPlace!.latitude : null,
        partnerLongitude: partnerComplete ? partnerBirthPlace!.longitude : null,
        partnerTimezoneOffsetHours: partnerComplete ? partnerBirthPlace!.timezoneOffsetHours : null,
        partnerTimeZoneId: partnerComplete ? partnerBirthPlace!.timeZoneId || '' : '',
        muhurthamPlace: scanLocation.placeName,
        muhurthamCountry: muhurthamPlace!.country || '',
        muhurthamLatitude: scanLocation.latitude,
        muhurthamLongitude: scanLocation.longitude,
        muhurthamTimezoneOffsetHours: scanLocation.timezoneOffsetHours,
        muhurthamTimeZoneId: scanLocation.timeZoneId || '',
        eventKey: selectedEvent,
        selectedMonth
      }
    };
  };

  /**
   * Builds the family-tray line for this Subha Muhurtham report.
   *
   * A Muhurtham chart is a normal member of the family bundle: it is priced in
   * the same currency as every other chart and travels with the same
   * `muhurthamScan` payload the single-order flow submits, so the admin
   * approval renders it with the identical high-quality report builder.
   */
  const handleAddToFamilyTray = () => {
    if (!hasFamilyOrderCapacity(cartItems.length)) {
      setError(`Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports. Remove a report before adding another.`);
      setTraySuccessMessage('');
      return;
    }
    const birthDetailsError = validateBirthDetails();
    if (birthDetailsError) {
      setError(birthDetailsError);
      setTraySuccessMessage('');
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
      setError('Please select a valid report month.');
      setTraySuccessMessage('');
      return;
    }

    const effectiveDob = resolveCurrentDob();
    const effectiveTob = resolveCurrentTob();
    const scan = buildMuhurthamScan(effectiveDob, effectiveTob);
    const { months, persons } = scan;
    const eventConfig = EVENTS[selectedEvent];
    const devotee = normalizePersonName(name);
    const place = birthPlace!;
    const muhurthamLocation = muhurthamPlace!;
    const birthTimezone = resolveLocationTimezone(
      effectiveDob, effectiveTob, place.latitude, place.longitude,
      place.timezoneOffsetHours, place.timeZoneId
    );

    // Every chart is priced in all three currencies; the tray/checkout bills
    // the whole family in the ONE currency the customer pays with.
    const prices = getServicePrices(settings, 'MUHURTHAM');
    const unitPrice = prices[currency];

    const addedItemId = addItem({
      serviceType: 'MUHURTHAM',
      language: selectedLanguage,
      devoteeName: devotee,
      summaryText: `${eventTitle(selectedEvent)} • ${selectedMonth} • Born: ${effectiveDob} at ${effectiveTob} • Birth: ${place.placeName} • Muhurtham at: ${muhurthamLocation.placeName}`,
      country: place.country || '',
      inputPayload: {
        name: devotee,
        devoteeName: devotee,
        dob: effectiveDob,
        tob: effectiveTob,
        birthPlace: place.placeName,
        country: place.country || '',
        latitude: place.latitude,
        longitude: place.longitude,
        timezoneOffsetHours: birthTimezone.timezoneOffsetHours,
        timeZoneId: birthTimezone.timeZoneId,
        muhurthamPlace: muhurthamLocation.placeName,
        muhurthamCountry: muhurthamLocation.country || '',
        muhurthamLatitude: muhurthamLocation.latitude,
        muhurthamLongitude: muhurthamLocation.longitude,
        muhurthamTimezoneOffsetHours: muhurthamLocation.timezoneOffsetHours,
        muhurthamTimeZoneId: muhurthamLocation.timeZoneId,
        eventKey: selectedEvent,
        eventTitleEn: eventConfig.titleEn,
        eventTitleTa: eventConfig.titleTa,
        eventTitleHi: eventConfig.titleHi,
        selectedMonth,
        language: selectedLanguage,
          muhurthamScan: {
            muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
            selectedMonth,
            eventKey: selectedEvent,
            inputContext: scan.inputContext,
            months,
            persons
          }
      },
      prices,
      unitPrice,
      currency
    });
    if (!addedItemId) {
      setError(`Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports. Remove a report before adding another.`);
      setTraySuccessMessage('');
      return;
    }

    const reachedFamilyLimit = cartItems.length + 1 >= MAX_FAMILY_ORDER_ITEMS;
    setTraySuccessMessage(
      reachedFamilyLimit
        ? `"${devotee}" — ${eventTitle(selectedEvent)} added to Cart! Maximum ${MAX_FAMILY_ORDER_ITEMS} orders reached. You can checkout & pay now, and place your next order after payment.`
        : `"${devotee}" — ${eventTitle(selectedEvent)} added to Cart (${cartItems.length + 1}/${MAX_FAMILY_ORDER_ITEMS} orders)! Add another service or checkout to pay once.`
    );
    setError('');
    // Show the bundle straight away, like the other service pages.
    openCart();
  };

  const submitOrder = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    const effectiveDob = resolveCurrentDob();
    const effectiveTob = resolveCurrentTob();
    const birthTimezone = resolveLocationTimezone(
      effectiveDob, effectiveTob, birthPlace!.latitude, birthPlace!.longitude,
      birthPlace!.timezoneOffsetHours, birthPlace!.timeZoneId
    );
    setIsSubmitting(true);
    setError('');
    try {
      const scan = buildMuhurthamScan(effectiveDob, effectiveTob);
      const response = await api.placeOrder({
        serviceType: 'MUHURTHAM',
        language: selectedLanguage,
        country: user?.country || 'Fiji',
        paymentMethod: isFreeOrder ? 'NONE' : paymentMethod,
        billingCountry: user?.country || 'Fiji',
        currency,
        paymentReference: isFreeOrder ? undefined : paymentReference.trim(),
        paymentIntentId: isFreeOrder ? undefined : paymentIntentId || undefined,
        inputPayload: {
          name: normalizePersonName(name),
          devoteeName: normalizePersonName(name),
          dob: effectiveDob,
          tob: effectiveTob,
          birthPlace: birthPlace!.placeName,
          country: birthPlace!.country || '',
          latitude: birthPlace!.latitude,
          longitude: birthPlace!.longitude,
          timezoneOffsetHours: birthTimezone.timezoneOffsetHours,
          timeZoneId: birthTimezone.timeZoneId,
          muhurthamPlace: muhurthamPlace!.placeName,
          muhurthamCountry: muhurthamPlace!.country || '',
          muhurthamLatitude: muhurthamPlace!.latitude,
          muhurthamLongitude: muhurthamPlace!.longitude,
          muhurthamTimezoneOffsetHours: muhurthamPlace!.timezoneOffsetHours,
          muhurthamTimeZoneId: muhurthamPlace!.timeZoneId,
          eventKey: selectedEvent,
          selectedMonth,
          language: selectedLanguage,
          muhurthamScan: {
            muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
            selectedMonth,
            eventKey: selectedEvent,
            inputContext: scan.inputContext,
            months: scan.months,
            persons: scan.persons
          }
        }
      });
      if (response.success && response.order) {
        setSuccessOrder(response.order);
      } else {
        setError(response.message || 'We could not submit your request. Please try again.');
      }
    } catch (submitError: any) {
      setError(submitError.message || 'We could not submit your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowCheckoutModal(true);
  };

  const modalDob = dob || parseFlexibleDob(dobText, true) || '';
  const modalTob = tob || parseFlexibleTob(tobText, tobPeriod, { allowHourOnly: true })?.tob24 || '';
  const modalTimezone = birthPlace
    ? resolveLocationTimezone(
        modalDob, modalTob, birthPlace.latitude, birthPlace.longitude,
        birthPlace.timezoneOffsetHours, birthPlace.timeZoneId
      )
    : null;
  const checkoutScan = showCheckoutModal && birthPlace && muhurthamPlace
    ? buildMuhurthamScan(resolveCurrentDob(), resolveCurrentTob())
    : null;

  return (
    <div className="service-page">
      <SEO
        title="Subha Muhurtham Report | ASTRO SIVAM"
        description="Request your personalized Subha Muhurtham dates. Complete one form, make payment, and receive the approved PDF report by email."
      />
      <ServicePageHeader
        icon={CalendarDays}
        eyebrow="Personalized Vedic Timing · Ceremony Muhurtham"
        title="Subha Muhurtham Report"
        description="Enter the birth details, choose the ceremony, and select where you live or where the function will happen. Birth place is used for your Janma Nakshatra and Rasi; the selected Muhurtham location is used for the report dates and local times."
      />

      {/* Main grid: order form + side panel — the same frame every other service page uses. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* Left column: order form, or the confirmation once the order is placed */}
        <div className="min-w-0 lg:col-span-7">
          {successOrder ? (
            <section className="rounded-3xl border border-emerald-400/30 bg-emerald-950/40 p-6 shadow-2xl shadow-black/20 sm:p-8" role="status">
              <div className="mb-5 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-300" />
                <div>
                  <h2 className="text-xl font-bold text-white">Request received</h2>
                  <p className="text-sm text-emerald-100">Order {successOrder.orderNumber || successOrder.id} is awaiting admin approval.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-200">
                <p className="flex items-start gap-2"><Mail className="mt-1 h-4 w-4 shrink-0 text-amber-300" />Your completed PDF report will be sent to <strong className="break-all text-white">{user?.email}</strong> {successOrder.amount > 0 ? 'after payment verification and approval.' : 'after report approval. No payment is required.'}</p>
                <p className="mt-3 text-slate-400">The final approved report is prepared by our priest team and emailed to you after approval — the same high-resolution report quality shown in the sample PDF.</p>
              </div>
            </section>
          ) : (
            <form onSubmit={handleSubmit} className="service-form-card space-y-6 p-5 sm:p-7">
              <section className="service-form-section space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">1</span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    {checksBothCharts ? 'Groom (First Person) Birth Particulars & Ceremony' : 'User Birth Particulars & Ceremony'}
                  </h2>
                </div>
                <div className="space-y-4">
                  <PersonNameField
                    id="muhurtham-name"
                    label="User full name"
                    value={name}
                    onChange={value => {
                      manuallyEditedFields.current.name = true;
                      setName(value);
                    }}
                    placeholder="Name for the report"
                    theme="dark"
                    size="sm"
                  />

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="muhurtham-event" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Ceremony / Muhurtham Option <span className="text-rose-400">*</span>
                      </label>
                      <select
                        id="muhurtham-event"
                        value={selectedEvent}
                        onChange={e => setSelectedEvent(e.target.value as MuhurthamEventKey)}
                        className="w-full rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3.5 text-base sm:text-sm font-semibold text-white outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15 shadow-xs touch-manipulation cursor-pointer"
                      >
                        {eventOptions.map(option => <option key={option.key} value={option.key} className="bg-slate-900 text-white">{option.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <MonthField
                        id="muhurtham-month"
                        theme="dark"
                        label="Selected Starting Month"
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                        min={monthInputValue(new Date())}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <BirthDateField
                      id="muhurtham-dob"
                      theme="dark"
                      label="Date of Birth"
                      value={dob}
                      onChange={value => {
                        manuallyEditedFields.current.dob = true;
                        setDob(value);
                      }}
                      onTextChange={setDobText}
                      helpText="e.g. 15/08/1990 (DD/MM/YYYY)"
                    />

                    <BirthTimeField
                      id="muhurtham-tob"
                      theme="dark"
                      label="Exact Birth Time"
                      value={tob}
                      onChange={value => {
                        manuallyEditedFields.current.tob = true;
                        setTob(value);
                      }}
                      onTextChange={setTobText}
                      onPeriodChange={setTobPeriod}
                      unknownTimeLabel="Unknown? Use 12:00 PM"
                      helpText="Type digits (e.g. 0930), then select AM/PM"
                    />
                  </div>

                  <div>
                    <GooglePlacesPicker
                      value={birthPlace || undefined}
                      onChange={selectedLocation => {
                        manuallyEditedFields.current.birthPlace = true;
                        setBirthPlace(selectedLocation);
                      }}
                      label="User Birth Place (Google Maps Location)"
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Used with your date &amp; time of birth to compute your Janma Nakshatra and Rasi.</p>
                    <BirthTimeZoneNotice resolution={modalTimezone} date={modalDob} time={modalTob} theme="dark" className="mt-1.5" />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-amber-400" />
                        <span>Muhurtham Function Location <span className="text-rose-400">*</span></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => birthPlace && setMuhurthamPlace({ ...birthPlace })}
                        disabled={!birthPlace}
                        className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition hover:border-amber-400 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        Copy from Birth Place
                      </button>
                    </div>
                    <GooglePlacesPicker
                      value={muhurthamPlace || undefined}
                      onChange={setMuhurthamPlace}
                      label="Where the function will happen (Local timezone)"
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Local sunrise, Nalla Neram, and auspicious windows are calculated for this timezone.</p>
                  </div>
                </div>
              </section>

              {/* Wedding / engagement: the bride's own chart. Both charts are
                  checked for Chandrashtama, Tara Bala and Janma Nakshatra on
                  every candidate date. Optional — leaving it empty keeps a
                  single-person report, which states in the PDF that only one
                  person was checked. */}
              {checksBothCharts && (
                <section className="service-form-section space-y-4 p-5 sm:p-6">
                  <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">2</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                      Bride Birth Particulars <span className="text-slate-400 normal-case tracking-normal font-medium">(recommended — checked together with the groom)</span>
                    </h2>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    The Muhurtham dates are matched to both horoscopes: Chandrashtama, Tara Bala and Janma Nakshatra are checked for
                    the bride and the groom on every candidate date. If this block is left empty, the report will clearly state that
                    only one person's details were used.
                  </p>
                  <div className="space-y-4">
                    <PersonNameField
                      id="muhurtham-bride-name"
                      label="Bride full name"
                      value={partnerName}
                      onChange={setPartnerName}
                      placeholder="Bride's name for the report"
                      theme="dark"
                      size="sm"
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <BirthDateField
                        id="muhurtham-bride-dob"
                        theme="dark"
                        label="Bride Date of Birth"
                        value={partnerDob}
                        onChange={setPartnerDob}
                        onTextChange={setPartnerDobText}
                        helpText="e.g. 15/06/1998 (DD/MM/YYYY)"
                      />

                      <BirthTimeField
                        id="muhurtham-bride-tob"
                        theme="dark"
                        label="Bride Exact Birth Time"
                        value={partnerTob}
                        onChange={setPartnerTob}
                        onTextChange={setPartnerTobText}
                        onPeriodChange={setPartnerTobPeriod}
                        unknownTimeLabel="Unknown? Use 12:00 PM"
                        helpText="Type digits (e.g. 0630), then select AM/PM"
                      />
                    </div>

                    <div>
                      <GooglePlacesPicker
                        value={partnerBirthPlace || undefined}
                        onChange={setPartnerBirthPlace}
                        label="Bride Birth Place (Google Maps Location)"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Used with the bride's date &amp; time of birth to compute her Janma Nakshatra, Rasi and Lagna.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Language Selection: English, Tamil, Hindi */}
              <section className="service-form-section space-y-3 p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">{checksBothCharts ? 3 : 2}</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                      Select Report Language <span className="text-rose-400">*</span>
                    </h2>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">English · Tamil · Hindi</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {([
                    ['en', 'English'],
                    ['ta', 'Tamil (தமிழ்)'],
                    ['hi', 'Hindi (हिन्दी)']
                  ] as [AppLanguage, string][]).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={selectedLanguage === code}
                      onClick={() => setSelectedLanguage(code)}
                      className={`rounded-2xl border py-3.5 px-2 text-center transition cursor-pointer shadow-xs ${
                        selectedLanguage === code
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200 font-bold ring-2 ring-amber-400/50 shadow-md'
                          : 'border-white/10 bg-slate-900/90 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span className="block text-xs font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Streamlined Checkout Action Section */}
              <section className="border-t border-white/10 pt-5 space-y-4">
                {traySuccessMessage && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200" role="status">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{traySuccessMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={openCart}
                      className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition hover:bg-emerald-400 cursor-pointer"
                    >
                      View Cart ({cartItems.length})
                    </button>
                  </div>
                )}

                {error && <div role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error}</div>}

                {/* Primary Action Buttons: Add to Cart & Proceed to Checkout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {hasFamilyOrderCapacity(cartItems.length) ? (
                    <button
                      type="button"
                      onClick={handleAddToFamilyTray}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-amber-950/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4 text-slate-950" />
                      <span>Add to Cart</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openCart}
                      className="w-full py-3.5 px-4 bg-amber-500/10 text-amber-300 font-bold text-xs rounded-2xl border border-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Cart Full — View Cart</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-4 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-xl shadow-amber-950/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-slate-950" />
                    <span>Proceed to Checkout</span>
                  </button>
                </div>

                {/* Information Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Up to {MAX_FAMILY_ORDER_ITEMS} orders in cart • Place next order after payment</span>
                  <div className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>6-Month Muhurtham Matrix</span>
                  </div>
                </div>
              </section>
            </form>
          )}
        </div>

        {/* Right column: what the report contains, the sample PDF, and the review promise.
            The two info cards are desktop-only (they fill the side panel); on narrow screens the
            page keeps its original order: form → sample report. */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="hidden space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 lg:block">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <FileText className="h-4 w-4 text-amber-400" />
              <span>What is included in the Subha Muhurtham PDF?</span>
            </h2>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {REPORT_INCLUSIONS.map(item => (
                <li key={item.title} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span><strong className="font-bold text-white">{item.title}:</strong> {item.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Public Sample Report — sits beside the form on desktop and stacks below it on mobile,
              exactly like every other service page. Fixed example details (01 Jan 2000,
              2:00 AM, Chennai); no customer data is used. */}
          <section className="space-y-3 rounded-2xl border border-amber-400/40 bg-white/5 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <Eye className="h-4 w-4 text-amber-400" />
              <span>See the report before you order</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Open a complete sample Subha Muhurtham PDF — the six-month auspicious date matrix, Panchangam, Nalla Neram windows and local timings exactly as delivered, with a light SAMPLE watermark. The sample uses fixed example details (01 Jan 2000, 2:00 AM, Chennai) and no customer data is ever used.
            </p>
            <SampleReportButton
              serviceType="MUHURTHAM"
              language={selectedLanguage}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/60 bg-amber-400/15 px-4 py-3 text-xs font-bold text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-60 cursor-pointer"
              label="View Sample Report (PDF)"
              helperText="The sample report always uses fixed example details (01 Jan 2000, 2:00 AM, Chennai) and a light SAMPLE watermark — no form filling needed."
            />
          </section>

          <section className="hidden space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs lg:block">
            <h2 className="flex items-center gap-1.5 font-bold text-amber-300">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>ASTRO SIVAM Priest Team Panchangam Review &amp; Quality Assurance</span>
            </h2>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Every Muhurtham report is calculated with the Chitra Paksha Lahiri ephemeris and reviewed by our Vedic priest and astrologer team before approval. Your approved PDF report is emailed to your registered address, with live order history in your Customer Dashboard.
            </p>
          </section>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={() => {
          setShowAuthModal(false);
          setShowCheckoutModal(true);
        }}
        title="Sign in to request your Muhurtham report"
        description="Sign in to place the order. Once approved, your PDF report will be sent to your account email."
      />

      {/* Dedicated Modern Checkout Modal */}
      {showCheckoutModal && (
        <SingleServiceCheckoutModal
          isOpen={showCheckoutModal}
          onClose={() => setShowCheckoutModal(false)}
          serviceType="MUHURTHAM"
          serviceTitle="Subha Muhurtham (Auspicious Dates)"
          devoteeSummary={{
            name: normalizePersonName(name) || 'User',
            dob: resolveCurrentDob(),
            tob: resolveCurrentTob(),
            birthPlace: birthPlace?.placeName,
            muhurthamPlace: muhurthamPlace?.placeName,
            ceremonyName: eventTitle(selectedEvent),
            targetMonth: selectedMonth
          }}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          inputPayload={{
            name: normalizePersonName(name),
            devoteeName: normalizePersonName(name),
            dob: resolveCurrentDob(),
            tob: resolveCurrentTob(),
            birthPlace: birthPlace?.placeName || '',
            country: birthPlace?.country || '',
            latitude: birthPlace?.latitude,
            longitude: birthPlace?.longitude,
            timezoneOffsetHours: modalTimezone?.timezoneOffsetHours ?? birthPlace?.timezoneOffsetHours,
            timeZoneId: modalTimezone?.timeZoneId ?? birthPlace?.timeZoneId,
            muhurthamPlace: muhurthamPlace?.placeName || '',
            muhurthamCountry: muhurthamPlace?.country || '',
            muhurthamLatitude: muhurthamPlace?.latitude,
            muhurthamLongitude: muhurthamPlace?.longitude,
            muhurthamTimezoneOffsetHours: muhurthamPlace?.timezoneOffsetHours,
            muhurthamTimeZoneId: muhurthamPlace?.timeZoneId,
            eventKey: selectedEvent,
            selectedMonth,
            language: selectedLanguage,
            muhurthamScan: {
              muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION,
              selectedMonth,
              eventKey: selectedEvent,
              inputContext: checkoutScan?.inputContext,
              months: checkoutScan?.months || [],
              persons: checkoutScan?.persons || []
            }
          }}
          onSuccess={ord => {
            setSuccessOrder(ord);
            setShowCheckoutModal(false);
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};
