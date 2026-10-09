import React, { useState } from 'react';
import {
  Baby,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Globe,
  AlertCircle,
  FileText,
  Check,
  ChevronRight,
  ShieldCheck,
  Star,
  Mail,
  Loader2,
  ShoppingBag,
  ShoppingCart,
  Users,
  HeartHandshake,
  Compass,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { GooglePlacesPicker, LocationData } from '../components/common/GooglePlacesPicker';
import { BirthDateField, BirthTimeField, BirthTimeZoneNotice } from '../components/common/BirthDateTimeFields';
import { PersonNameField } from '../components/common/PersonNameField';
import { ServicePageHeader } from '../components/common/ServicePageHeader';
import { AuthModal } from '../components/common/AuthModal';
import { PaymentGatewayCheckoutBox } from '../components/cart/PaymentGatewayCheckoutBox';
import { SingleServiceCheckoutModal } from '../components/cart/SingleServiceCheckoutModal';
import { SampleReportButton } from '../components/common/SampleReportButton';
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
  normalizePersonName
} from '../utils/birthDetails';

interface BabyNamingPageProps {
  onNavigate: (route: string) => void;
}

export const BabyNamingPage: React.FC<BabyNamingPageProps> = ({ onNavigate }) => {
  const { user, settings } = useAuth();
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
  const fjdPrice = settings?.servicePricing?.BABY_NAMING?.fjd ?? settings?.fijiPriceFJD ?? 30;
  const inrPrice = settings?.servicePricing?.BABY_NAMING?.inr ?? settings?.indiaPriceINR ?? 399;
  const usdPrice = settings?.servicePricing?.BABY_NAMING?.usd ?? settings?.intlPriceUSD ?? 15;

  // The customer's payment choice — never a birth place — decides the currency.
  const chargeCurrency = getCurrencyForPaymentMethod(paymentMethod);
  const chargeSymbol = getCurrencySymbol(chargeCurrency);
  const chargeAmount = getServicePriceInCurrency(settings, 'BABY_NAMING', chargeCurrency);

  // Baby Details State
  const [babyName, setBabyName] = useState('');
  const [dob, setDob] = useState('');
  const [tob, setTob] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [location, setLocation] = useState<LocationData | null>(null);
  const locationTimezone = location
    ? resolveLocationTimezone(
        dob, tob, location.latitude, location.longitude,
        location.timezoneOffsetHours, location.timeZoneId
      )
    : null;

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('en');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');


  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [traySuccessMessage, setTraySuccessMessage] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const validateBabyBirthDetails = (): string => {
    if (!dob) return 'Please enter the date of birth.';
    if (!isValidIsoBirthDate(dob)) return 'Please enter a valid date of birth that is not in the future.';
    if (!tob) return 'Please enter the time of birth.';
    if (!isValidBirthTime(tob)) return 'Please enter a valid birth time, including minutes and AM/PM.';
    if (!location?.placeName?.trim()) {
      return 'Please find and select the baby\'s birth place using the location search, interactive map, or GPS auto-detect.';
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
    const validationMessage = validateBabyBirthDetails();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }
    const selectedLocation = location!;

    // Every chart is priced in all three currencies; the tray/checkout later
    // bills the whole family in the ONE currency the customer pays with.
    const prices = getServicePrices(settings, 'BABY_NAMING');
    // Free Beta: the checkout prices the FIRST chart of the order free.
    const unitPrice = prices[chargeCurrency];

    const effectiveName = normalizePersonName(babyName) || (gender === 'M' ? 'Newborn Boy' : 'Newborn Girl');

    const addedItemId = addItem({
      serviceType: 'BABY_NAMING',
      language: selectedLanguage,
      devoteeName: effectiveName,
      summaryText: `Born: ${dob} at ${tob} • ${selectedLocation.placeName}`,
      country: user?.country || 'Fiji',
      inputPayload: {
        babyName: effectiveName,
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
      currency: chargeCurrency
    });
    if (!addedItemId) {
      setErrorMessage(`Family Tray is limited to ${MAX_FAMILY_ORDER_ITEMS} reports. Remove a report before adding another.`);
      setTraySuccessMessage('');
      return;
    }

    const reachedFamilyLimit = cartItems.length + 1 >= MAX_FAMILY_ORDER_ITEMS;
    setTraySuccessMessage(reachedFamilyLimit
      ? `"${effectiveName}" added to Cart! Maximum ${MAX_FAMILY_ORDER_ITEMS} orders reached. You can checkout & pay now, and place your next order after payment.`
      : `"${effectiveName}" added to Cart (${cartItems.length + 1}/${MAX_FAMILY_ORDER_ITEMS} orders)! You can add another child or checkout anytime.`);
    setErrorMessage('');
    
    // Reset fields for another baby
    setBabyName('');
    setDob('');
    setTob('');

    openCart();
  };

  const executeOrderSubmission = async () => {
    const validationMessage = validateBabyBirthDetails();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (!orderWillBeFree && paymentMethod !== 'NONE' && !paymentRef) {
      setErrorMessage('Please enter the payment transaction reference / receipt number.');
      return;
    }

    const selectedLocation = location!;
    const effectiveName = normalizePersonName(babyName) || (gender === 'M' ? 'Newborn Boy' : 'Newborn Girl');
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        babyName: effectiveName,
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
        serviceType: 'BABY_NAMING',
        language: selectedLanguage,
        country: user?.country || 'Fiji',
        // FREE BETA: only the FIRST report of this connection is free —
        // a used free chart makes this a normal paid order.
        paymentMethod: orderWillBeFree ? 'NONE' : paymentMethod,
        billingCountry: user?.country || 'Fiji',
        currency: chargeCurrency,
        paymentReference: orderWillBeFree ? undefined : paymentRef,
        paymentIntentId: orderWillBeFree ? undefined : paymentIntentId || undefined,
        inputPayload: payload
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

    const validationMessage = validateBabyBirthDetails();
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
        title="Sacred Baby Naming (Namakaran / Peyar Sooduthal) by Nakshatra | ASTRO SIVAM"
        description="Find auspicious newborn baby naming syllables and astrological coordinates based on Janma Nakshatra Pada with ASTRO SIVAM."
        canonical="https://astrosivam.com/baby-naming"
      />
      
      <ServicePageHeader
        icon={Baby}
        eyebrow="Vedic Namakaran · Sacred Baby Naming"
        title="Vedic Baby Naming & Nakshatra Initial Letters"
        description="Determine the exact astrological initial sound vibrations (Namaksharas) for all 4 padas of the baby&apos;s birth star. Includes ruling deities, animal/nature energies, and Vedic Gunam (innate strengths & virtues) analysis."
      />

      {/* Main Grid: Form + Syllables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-7 service-form-card p-5 sm:p-7">
          {orderSuccess ? (
            <div className="space-y-6 py-6 text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <Baby className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Baby Naming Certificate Requested!
                </h3>
                <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Order ID: {orderSuccess.orderNumber}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  {isAdmin
                    ? 'Your free admin Baby Naming order is queued. Our India priest team prepares certificates daily (9:00 AM – 11:00 AM IST), and your official PDF certificate and Tax Invoice will be emailed to ' + orderSuccess.userEmail + ' upon approval.'
                    : orderSuccess.serviceMode === 'FREE_BETA'
                    ? 'Your Baby Naming certificate order is in the FREE BETA queue. Our priest team prepares certificates daily between 9:00 AM – 11:00 AM IST. Once approved by the administrator, your verified PDF certificate and Tax Invoice will be emailed to ' + orderSuccess.userEmail + '.'
                    : 'Your paid order is received. Our India-based priest team prepares reports daily between 9:00 AM – 11:00 AM IST. Following administrator review and approval, your complete PDF certificate and Tax Invoice will be emailed directly to ' + orderSuccess.userEmail + '.'}
                </p>

                {/* Spam Folder Advisory Box */}
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-left text-xs text-emerald-900 dark:text-emerald-200 max-w-md mx-auto flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-950 dark:text-emerald-100">⚠️ Email Delivery Advisory:</strong> Once the admin approves your report, your official PDF report and Tax Invoice will be sent from <code>admin@astrosivam.com</code>. <strong>Please check your Spam / Junk folder</strong> in addition to your Inbox, and mark the email as &ldquo;Not Spam&rdquo; to ensure timely delivery.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  View in Customer Dashboard
                </button>
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Name Another Baby
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitOrder} className="space-y-6">
              
              {/* Guest / Non-logged in quick sign-in banner */}
              {!user && (
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Sign in for Quick Baby Naming Certificate
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sign in with Google to auto-save your birth profile and track your orders.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap cursor-pointer"
                  >
                    Quick Sign In
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Baby Particulars */}
              <div className="service-form-section space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">1</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Newborn Baby Birth Particulars
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PersonNameField
                    id="baby-name"
                    label="Baby name"
                    value={babyName}
                    onChange={setBabyName}
                    placeholder="e.g. Baby of Ramesh Chand"
                    required={false}
                    helpText="Optional. Leave blank if you would like name suggestions based on the birth star."
                  />

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5 block">
                      Baby Gender <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('M')}
                        className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border ${
                          gender === 'M'
                            ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-500 font-black shadow-md shadow-sky-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-500/50'
                        }`}
                      >
                        <span>👶 Baby Boy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('F')}
                        className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs border ${
                          gender === 'F'
                            ? 'bg-gradient-to-r from-pink-400 to-rose-500 text-white border-pink-500 font-black shadow-md shadow-pink-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-pink-500/50'
                        }`}
                      >
                        <span>👧 Baby Girl</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <BirthDateField
                    label="Date of Birth"
                    value={dob}
                    onChange={setDob}
                  />

                  <BirthTimeField
                    label="Exact Birth Time"
                    value={tob}
                    onChange={setTob}
                  />
                </div>

                <GooglePlacesPicker
                  value={location || undefined}
                  onChange={setLocation}
                  label="Baby Birth Place (Google Maps Location)"
                  required
                />
                <BirthTimeZoneNotice resolution={locationTimezone} date={dob} time={tob} />
              </div>

              {/* 2. Language Selection: English, Tamil, Hindi */}
              <div className="space-y-3 p-5 sm:p-6 bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">2</span>
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
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-black ring-2 ring-emerald-500/40 shadow-md'
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
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-black ring-2 ring-emerald-500/40 shadow-md'
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
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-black ring-2 ring-emerald-500/40 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">Hindi (हिन्दी)</span>
                  </button>
                </div>
              </div>

              {/* 3. Streamlined Checkout Action Section */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
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
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-950/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <Baby className="w-4 h-4 text-slate-950" />
                    <span>Proceed to Checkout</span>
                  </button>
                </div>

                {/* Information Footer */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span>Up to {MAX_FAMILY_ORDER_ITEMS} orders in cart • Place next order after payment</span>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>108 Pada Certified</span>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Right Column: Service Inclusions & Virtues System */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Baby className="w-4 h-4 text-emerald-500" />
              <span>Why Vedic Nakshatra Naming Matters</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              In Vedic Jyotisha, the Moon&apos;s exact position at the moment of birth activates a specific sound frequency (Namakshara). Naming a newborn with this vibrational syllable brings harmony, mental clarity, health, and auspicious planetary protection throughout life.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Exact Janma Pada Syllables:</strong> Auspicious starting letters for all 4 padas of the birth star.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Nakshatra Lord & Astronomical Attributes:</strong> Planetary lord, gana, yoni archetype, and rajju classification.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Curated Vedic Names:</strong> Authentic traditional and contemporary baby names with sacred meanings.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Official ASTRO SIVAM Certificate:</strong> Commemorative naming certificate PDF delivered directly to your inbox.</span>
              </li>
            </ul>
          </div>

          {/* Public Sample Report — see the exact PDF before ordering */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-emerald-300/70 dark:border-emerald-800/50 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              <Eye className="w-4 h-4 text-emerald-500" />
              <span>See the report before you order</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Open a complete sample Vedic Baby Naming certificate PDF — the Janma Nakshatra, pada syllables, curated names and the naming certificate exactly as delivered, with a light SAMPLE watermark. The sample uses fixed example details (01 Jan 2000, 2:00 AM, Chennai) and no customer data is ever used.
            </p>
            <SampleReportButton
              serviceType="BABY_NAMING"
              language={selectedLanguage}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60 cursor-pointer"
            />
          </div>

          {/* Verification Badge Box */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 text-xs">
            <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>ASTRO SIVAM Priest Team Sanctification & Privacy Assurance</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Every newborn naming certificate is carefully calculated and verified by our Vedic Priest & Astrologer team. Syllables and curated sacred names are sanctified and delivered directly to your registered email (with live order history tracked in your Customer Dashboard).
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
        title="Sign In to Place Baby Naming Order"
        description="Sign in with Google or your email to generate your certified baby namakaran certificate PDF and track your order status."
      />

      {/* Dedicated Modern Checkout Modal */}
      <SingleServiceCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        serviceType="BABY_NAMING"
        serviceTitle="Sacred Baby Naming (Namakaran)"
        devoteeSummary={{
          name: normalizePersonName(babyName) || (gender === 'M' ? 'Newborn Boy' : 'Newborn Girl'),
          dob,
          tob,
          birthPlace: location?.placeName
        }}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        inputPayload={{
          babyName: normalizePersonName(babyName) || (gender === 'M' ? 'Newborn Boy' : 'Newborn Girl'),
          dob,
          tob,
          gender,
          birthPlace: location?.placeName,
          country: location?.country || '',
          latitude: location?.latitude,
          longitude: location?.longitude,
          timezoneOffsetHours: locationTimezone?.timezoneOffsetHours ?? location?.timezoneOffsetHours,
          timeZoneId: locationTimezone?.timeZoneId ?? location?.timeZoneId
        }}
        onSuccess={ord => {
          setOrderSuccess(ord);
          setShowCheckoutModal(false);
        }}
        onNavigate={onNavigate}
      />

    </div>
  );
};
