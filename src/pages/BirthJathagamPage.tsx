import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Globe,
  AlertCircle,
  FileText,
  Eye,
  Check,
  Mail,
  Loader2,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Users,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { GooglePlacesPicker, LocationData } from '../components/common/GooglePlacesPicker';
import { BirthDateField, BirthTimeField, BirthTimeZoneNotice } from '../components/common/BirthDateTimeFields';
import { PersonNameField } from '../components/common/PersonNameField';
import { ServicePageHeader } from '../components/common/ServicePageHeader';
import { AuthModal } from '../components/common/AuthModal';
import { GoogleLoginButton } from '../components/common/GoogleLoginButton';
import { RasiChartSvg } from '../components/common/RasiChartSvg';
import { SampleReportButton } from '../components/common/SampleReportButton';
import { PaymentGatewayCheckoutBox } from '../components/cart/PaymentGatewayCheckoutBox';
import { SingleServiceCheckoutModal } from '../components/cart/SingleServiceCheckoutModal';
import { api } from '../services/api';
import {
  getServicePrices,
  getServicePriceInCurrency,
  getCurrencyForPaymentMethod,
  getCurrencySymbol
} from '../services/pricing';
import { MAX_FAMILY_ORDER_ITEMS, hasFamilyOrderCapacity } from '../services/familyOrderLimits';
import { AppLanguage } from '../types';
import { SEO } from '../components/common/SEO';
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

interface BirthJathagamPageProps {
  onNavigate: (route: string) => void;
}

export const BirthJathagamPage: React.FC<BirthJathagamPageProps> = ({ onNavigate }) => {
  const { user, birthProfile, settings, updateBirthProfile } = useAuth();
  const { language: currentAppLang } = useLanguage();
  const {
    addItem,
    openCart,
    items: cartItems,
    paymentMethod,
    setPaymentMethod
  } = useCart();

  const isBeta = settings?.serviceMode === 'FREE_BETA';
  // FREE BETA RULE — 1 free report per customer (tracked per IP address).
  // The first order from this connection is free; after that every order is
  // a normal paid order (also true for family orders: only member 1 is free).
  const betaFreeChartAvailable = settings?.betaFreeChartAvailable !== false;
  const isAdmin = user?.role === 'admin';
  const orderWillBeFree = isAdmin || (isBeta && betaFreeChartAvailable);
  const fjdPrice = settings?.servicePricing?.BIRTH_JATHAGAM?.fjd ?? settings?.fijiPriceFJD ?? 35;
  const inrPrice = settings?.servicePricing?.BIRTH_JATHAGAM?.inr ?? settings?.indiaPriceINR ?? 499;
  const usdPrice = settings?.servicePricing?.BIRTH_JATHAGAM?.usd ?? settings?.intlPriceUSD ?? 18;

  // The customer's payment choice — never a birth place — decides the currency.
  const chargeCurrency = getCurrencyForPaymentMethod(paymentMethod);
  const chargeSymbol = getCurrencySymbol(chargeCurrency);
  const chargeAmount = getServicePriceInCurrency(settings, 'BIRTH_JATHAGAM', chargeCurrency);

  // Form State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [tob, setTob] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [location, setLocation] = useState<LocationData | null>(null);
  const manuallyEditedFields = useRef({ name: false, dob: false, tob: false, gender: false, location: false });
  const locationTimezone = location
    ? resolveLocationTimezone(
        dob, tob, location.latitude, location.longitude,
        location.timezoneOffsetHours, location.timeZoneId
      )
    : null;

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('en');
  const [saveAsProfile, setSaveAsProfile] = useState(false);

  // Payment state for Paid Mode
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [traySuccessMessage, setTraySuccessMessage] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const validateBirthForm = (): string => {
    if (!normalizePersonName(name)) return 'Please enter the user full name.';
    if (!dob) return 'Please enter the date of birth.';
    if (!isValidIsoBirthDate(dob)) return 'Please enter a valid date of birth that is not in the future.';
    if (!tob) return 'Please enter the time of birth.';
    if (!isValidBirthTime(tob)) return 'Please enter a valid birth time, including minutes and AM/PM.';
    if (!location?.placeName?.trim()) {
      return 'Please find and select your birth place using the location search, interactive map, or GPS auto-detect.';
    }
    if (!isVerifiedBirthLocation(location)) {
      return 'The selected birth place is missing valid coordinates or timezone. Please re-select it from search, map, or GPS.';
    }
    return '';
  };

  const handleAddToFamilyTray = () => {
    if (!hasFamilyOrderCapacity(cartItems.length)) {
      setErrorMessage(`Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports. Remove a report before adding another.`);
      setTraySuccessMessage('');
      return;
    }
    const validationMessage = validateBirthForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }
    const devoteeName = normalizePersonName(name);
    const selectedLocation = location!;

    // Every chart is priced in all three currencies; the tray/checkout later
    // bills the whole family in the ONE currency the customer pays with.
    // (Free Beta: the checkout prices the FIRST chart of the order free.)
    const prices = getServicePrices(settings, 'BIRTH_JATHAGAM');
    const unitPrice = prices[chargeCurrency];

    const addedItemId = addItem({
      serviceType: 'BIRTH_JATHAGAM',
      language: selectedLanguage,
      devoteeName,
      summaryText: `Born: ${dob} at ${tob} • ${selectedLocation.placeName}`,
      country: selectedLocation.country || '',
      inputPayload: {
        name: devoteeName,
        dob,
        tob,
        birthPlace: selectedLocation.placeName,
        country: selectedLocation.country || '',
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        timezoneOffsetHours: locationTimezone?.timezoneOffsetHours ?? selectedLocation.timezoneOffsetHours,
        timeZoneId: locationTimezone?.timeZoneId ?? selectedLocation.timeZoneId,
        gender
      },
      prices,
      unitPrice,
      currency: chargeCurrency,
      saveAsProfile
    });
    if (!addedItemId) {
      setErrorMessage(`Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports. Remove a report before adding another.`);
      setTraySuccessMessage('');
      return;
    }

    const addedDevotee = devoteeName;
    const reachedFamilyLimit = cartItems.length + 1 >= MAX_FAMILY_ORDER_ITEMS;
    setTraySuccessMessage(reachedFamilyLimit
      ? `"${addedDevotee}" added to Cart! Maximum ${MAX_FAMILY_ORDER_ITEMS} orders reached. You can checkout & pay now, and place your next order after payment.`
      : `"${addedDevotee}" added to Cart (${cartItems.length + 1}/${MAX_FAMILY_ORDER_ITEMS} orders)! You can add another person or checkout anytime.`);
    setErrorMessage('');
    
    // Reset form for next person while retaining location convenience
    setName('');
    setDob('');
    setTob('');

    // Automatically open family tray so user sees their bundle
    openCart();
  };

  // Pre-fill saved details without replacing anything the visitor has started entering.
  useEffect(() => {
    if (birthProfile) {
      if (!manuallyEditedFields.current.name) {
        setName(normalizePersonName(birthProfile.name) || normalizePersonName(user?.name || ''));
      }
      if (!manuallyEditedFields.current.dob) setDob(normalizeBirthDate(birthProfile.dob));
      if (!manuallyEditedFields.current.tob) setTob(normalizeBirthTime(birthProfile.tob));
      if (!manuallyEditedFields.current.gender) setGender(birthProfile.gender);
      if (!manuallyEditedFields.current.location) setLocation(locationFromBirthProfile(birthProfile));
    } else if (user && !manuallyEditedFields.current.name) {
      setName(normalizePersonName(user.name));
    }
  }, [birthProfile, user]);

  const executeOrderSubmission = async () => {
    const validationMessage = validateBirthForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (!orderWillBeFree && paymentMethod !== 'NONE' && !paymentRef) {
      setErrorMessage('Please enter the payment transaction reference / receipt number.');
      return;
    }

    const selectedLocation = location!;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        name: normalizePersonName(name),
        dob,
        tob,
        birthPlace: selectedLocation.placeName,
        country: selectedLocation.country || '',
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        timezoneOffsetHours: locationTimezone?.timezoneOffsetHours ?? selectedLocation.timezoneOffsetHours,
        timeZoneId: locationTimezone?.timeZoneId ?? selectedLocation.timeZoneId,
        gender
      };

      const res = await api.placeOrder({
        serviceType: 'BIRTH_JATHAGAM',
        language: selectedLanguage,
        country: user?.country || 'Fiji',
        // FREE BETA: only the FIRST report of this connection is free — a
        // used free chart makes this a normal paid order.
        paymentMethod: orderWillBeFree ? 'NONE' : paymentMethod,
        billingCountry: user?.country || 'Fiji',
        currency: chargeCurrency,
        paymentReference: orderWillBeFree ? undefined : paymentRef,
        paymentIntentId: orderWillBeFree ? undefined : paymentIntentId || undefined,
        inputPayload: payload,
        saveAsProfile
      });

      if (res.success && res.order) {
        setOrderSuccess(res.order);
      } else {
        setErrorMessage(res.message || 'Failed to submit order');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validationMessage = validateBirthForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setShowCheckoutModal(true);
  };

  return (
    <div className="service-page">
      <SEO
        title="Birth Jathagam (Janma Kundali) Online Report | ASTRO SIVAM"
        description="Calculate accurate Birth Jathagam online with 12 Bhavas, Rasi & Navamsa charts, Vimshottari Mahadasa predictions, Kuja dosha analysis in Tamil, English & Hindi."
        canonical="https://astrosivam.com/birth-jathagam"
      />
      
      <ServicePageHeader
        icon={Compass}
        eyebrow="Vedic Horoscope Computation · Thirukanitha Sidereal Jyotish"
        title="Birth Jathagam & Comprehensive Natal Chart"
        description="Detailed natal horoscope calculated with precision sidereal ephemeris using Lahiri Ayanamsa. Includes 12 Bhavas, Navagraha planetary longitudes, Vimshottari Mahadasha timeline, Sade Sati & Dosha analysis, and 8 life aspect predictions."
      />

      {/* Main Grid: Order Form + Real-time Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-7 service-form-card p-5 sm:p-7">
          {orderSuccess ? (
            <div className="space-y-6 py-6 text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Order Successfully Placed!
                </h3>
                <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  Order ID: {orderSuccess.orderNumber}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  {isAdmin
                    ? 'Your free admin Birth Jathagam order is queued. Our India priest team prepares charts daily (9:00 AM – 11:00 AM IST), and your official PDF report and Tax Invoice will be emailed to ' + orderSuccess.userEmail + ' upon approval.'
                    : orderSuccess.serviceMode === 'FREE_BETA'
                    ? 'Your Birth Jathagam order is in the FREE BETA queue. Our priest team prepares charts daily between 9:00 AM – 11:00 AM IST. Once approved by the administrator, your verified PDF report and Tax Invoice will be emailed to ' + orderSuccess.userEmail + '.'
                    : 'Your paid order is received. Our India-based priest team prepares reports daily between 9:00 AM – 11:00 AM IST. Following administrator review and approval, your official PDF report and Tax Invoice will be emailed directly to ' + orderSuccess.userEmail + '.'}
                </p>

                {/* Spam Folder Advisory Box */}
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-left text-xs text-amber-900 dark:text-amber-200 max-w-md mx-auto flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-950 dark:text-amber-100">⚠️ Email Delivery Advisory:</strong> Once the admin approves your order, your official PDF report and Tax Invoice will be sent from <code>admin@astrosivam.com</code>. <strong>Please check your Spam / Junk folder</strong> in addition to your Inbox, and mark the email as &ldquo;Not Spam&rdquo; to ensure timely delivery.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  View in Customer Dashboard
                </button>
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Place Another Order
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitOrder} className="space-y-6">
              
              {/* Guest / Non-logged in quick sign-in banner */}
              {!user && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Sign in for Automatic Chart Saving
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sign in with Google to auto-save your birth profile and track orders.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap cursor-pointer"
                  >
                    Quick Sign In
                  </button>
                </div>
              )}

              {/* Profile auto-fill banner */}
              {birthProfile && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-amber-800 dark:text-amber-300 font-medium">
                    ✓ Saved Birth Profile loaded for <strong>{birthProfile.name}</strong>
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    Auto-filled
                  </span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Personal Details */}
              <div className="service-form-section space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">1</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    User / Client Particulars
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PersonNameField
                    id="birth-jathagam-name"
                    label="User full name"
                    value={name}
                    onChange={value => {
                      manuallyEditedFields.current.name = true;
                      setName(value);
                    }}
                    placeholder="e.g. Ramesh Chand"
                    helpText="Use the name you would like printed on the report."
                  />

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          manuallyEditedFields.current.gender = true;
                          setGender('M');
                        }}
                        className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border ${
                          gender === 'M'
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-500 font-black shadow-md shadow-amber-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-500/50'
                        }`}
                      >
                        <span>👨 Male</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          manuallyEditedFields.current.gender = true;
                          setGender('F');
                        }}
                        className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border ${
                          gender === 'F'
                            ? 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-pink-500 font-black shadow-md shadow-pink-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-pink-500/50'
                        }`}
                      >
                        <span>👩 Female</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <BirthDateField
                    label="Date of Birth"
                    value={dob}
                    onChange={value => {
                      manuallyEditedFields.current.dob = true;
                      setDob(value);
                    }}
                  />

                  <BirthTimeField
                    label="Exact Birth Time"
                    value={tob}
                    onChange={value => {
                      manuallyEditedFields.current.tob = true;
                      setTob(value);
                    }}
                  />
                </div>

                {/* Google Places Location Picker */}
                <GooglePlacesPicker
                  value={location || undefined}
                  onChange={selectedLocation => {
                    manuallyEditedFields.current.location = true;
                    setLocation(selectedLocation);
                  }}
                  label="Birth Place (Google Maps Location)"
                  required
                />
                <BirthTimeZoneNotice resolution={locationTimezone} date={dob} time={tob} />
              </div>

              {/* 2. Language Selection: English, Tamil, Hindi */}
              <div className="service-form-section space-y-3 p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">2</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Select Report Language <span className="text-rose-500">*</span>
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">English · Tamil · Hindi</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('en')}
                    className={`py-3.5 px-2 rounded-2xl border text-center transition-all cursor-pointer shadow-xs ${
                      selectedLanguage === 'en'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 font-black ring-2 ring-amber-500/40 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">English</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('ta')}
                    className={`py-3.5 px-2 rounded-2xl border text-center transition-all cursor-pointer shadow-xs ${
                      selectedLanguage === 'ta'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 font-black ring-2 ring-amber-500/40 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">Tamil (தமிழ்)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('hi')}
                    className={`py-3.5 px-2 rounded-2xl border text-center transition-all cursor-pointer shadow-xs ${
                      selectedLanguage === 'hi'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 font-black ring-2 ring-amber-500/40 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">Hindi (हिन्दी)</span>
                  </button>
                </div>
              </div>

              {/* 3. Streamlined Checkout Action Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                {/* Profile Save checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveProfileCheck"
                    checked={saveAsProfile}
                    onChange={e => setSaveAsProfile(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="saveProfileCheck" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    Save birth details to my profile for 1-click reuse across services.
                  </label>
                </div>

                {/* Tray Success Message Banner */}
                {traySuccessMessage && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{traySuccessMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={openCart}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] rounded-lg shrink-0 transition-all cursor-pointer"
                    >
                      View Cart ({cartItems.length})
                    </button>
                  </div>
                )}

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
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-amber-950/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-950" />
                    <span>Proceed to Checkout</span>
                  </button>
                </div>

                {/* Information Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>Up to {MAX_FAMILY_ORDER_ITEMS} orders in cart • Place next order after payment</span>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Certified Vedic Report</span>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Right Column: Service Inclusions & Authenticity Guarantee */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>What is included in the Birth Jathagam PDF?</span>
            </h3>

            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>12 Vedic Bhavas & Houses:</strong> Detailed positions of Ascendant (Lagna) and all 12 astrological houses.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Navagraha Positions & Degrees:</strong> Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu with exact degrees and retrogradation.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Rasi & Navamsa (D-9) Charts:</strong> Authentic South & North Indian chart layouts based on Chitra Paksha Lahiri Ayanamsa.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Vimshottari Mahadasha Timeline:</strong> Complete major planetary periods from birth up to 120 years with current Bhukti.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Sade Sati (Sani) & Dosha Status:</strong> Sevvay, Rahu-Ketu, Kala Sarpa evaluation with traditional remedies.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>8 Life Aspect Indications:</strong> Health, Wealth, Career, Education, Marriage, Family, Foreign Travel & Current Period Guidance.</span>
              </li>
            </ul>
          </div>

          {/* Public Sample Report — see the exact PDF before ordering */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-amber-300/70 dark:border-amber-700/50 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              <Eye className="w-4 h-4 text-amber-500" />
              <span>See the report before you order</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Open a complete sample Birth Jathagam PDF — every bhava, chart, dasha table and life-aspect page exactly as delivered, with a light SAMPLE watermark. The sample uses fixed example details (01 Jan 2000, 2:00 AM, Chennai) and no customer data is ever used.
            </p>
            <SampleReportButton
              serviceType="BIRTH_JATHAGAM"
              language={selectedLanguage}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60 cursor-pointer"
            />
          </div>

          {/* Priest Team Ephemeris Calculation Guarantee */}
          <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Chitra Paksha Lahiri Drik Ephemeris & Priest Verification</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Every birth horoscope is calculated and carefully verified by our dedicated Vedic priest and astrologer team using authentic Drik Panchanga and Chitra Paksha Lahiri principles. All charts are sanctified before official report generation.
            </p>
          </div>

          {/* Verification Badge Box */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 text-xs">
            <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>ASTRO SIVAM Priest Team Sanctification & Quality Assurance</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Every order is assigned to our experienced Vedic Astrologer & Priest team for thorough planetary review. Your certified Vedic PDF horoscope report and Tax Invoice will be prepared, sanctified, and delivered directly to your registered email (with live order history tracked in your Customer Dashboard).
            </p>
          </div>
        </div>

      </div>

      {/* Instant User Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={() => {
          setShowAuthModal(false);
          setShowCheckoutModal(true);
        }}
        title="Sign In to Place Birth Jathagam Order"
        description="Sign in with Google or your email to generate your certified birth chart PDF, calculate full dasha timeline, and track your order status."
      />

      {/* Dedicated Modern Checkout Modal */}
      <SingleServiceCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        serviceType="BIRTH_JATHAGAM"
        serviceTitle="Birth Jathagam (Natal Horoscope)"
        devoteeSummary={{
          name: normalizePersonName(name),
          dob,
          tob,
          birthPlace: location?.placeName
        }}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        inputPayload={{
          name: normalizePersonName(name),
          dob,
          tob,
          birthPlace: location?.placeName,
          country: location?.country || '',
          latitude: location?.latitude,
          longitude: location?.longitude,
          timezoneOffsetHours: locationTimezone?.timezoneOffsetHours ?? location?.timezoneOffsetHours,
          timeZoneId: locationTimezone?.timeZoneId ?? location?.timeZoneId,
          gender
        }}
        saveAsProfile={saveAsProfile}
        onSuccess={ord => {
          setOrderSuccess(ord);
          setShowCheckoutModal(false);
        }}
        onNavigate={onNavigate}
      />

    </div>
  );
};
