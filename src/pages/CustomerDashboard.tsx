import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Calendar,
  Clock,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Compass,
  Heart,
  Baby,
  Edit2,
  Save,
  Mail,
  Send,
  X,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { generateOrderPdfsBase64, prepareFamilyFulfilPayload, deliverOrderPdfPayload } from '../services/jathagamPdfExporter';
import { Order, BirthProfile } from '../types';
import { GooglePlacesPicker, LocationData } from '../components/common/GooglePlacesPicker';
import { BirthDateField, BirthTimeField, BirthTimeZoneNotice } from '../components/common/BirthDateTimeFields';
import { PersonNameField } from '../components/common/PersonNameField';
import { resolveDisplayName } from '../utils/displayName';
import AiAstrologerPanel from '../components/ai-astrologer/AiAstrologerPanel';
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

interface CustomerDashboardProps {
  onNavigate: (route: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ onNavigate }) => {
  const { user, birthProfile, updateBirthProfile, refreshProfile } = useAuth();
  // The name saved in the website profile is authoritative — never a stale
  // name or one with a "(Google)" tag attached.
  const displayName = user ? resolveDisplayName(birthProfile?.name, user.name, user.email) : 'User';
  const savedBirthLocation = locationFromBirthProfile(birthProfile);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
  // AI Astrologer entry point. `aiChatOrder` is null for a general chat, or the
  // order whose report the customer wants explained.
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatOrder, setAiChatOrder] = useState<Order | null>(null);

  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [pName, setPName] = useState(
    normalizePersonName(birthProfile?.name || '') || normalizePersonName(user?.name || '')
  );
  const [pDob, setPDob] = useState(normalizeBirthDate(birthProfile?.dob || ''));
  const [pTob, setPTob] = useState(normalizeBirthTime(birthProfile?.tob || ''));
  const [pGender, setPGender] = useState<'M' | 'F'>(birthProfile?.gender || 'M');
  const [pLocation, setPLocation] = useState<LocationData | null>(() => savedBirthLocation);
  const profileTimezone = pLocation
    ? resolveLocationTimezone(
        pDob, pTob, pLocation.latitude, pLocation.longitude,
        pLocation.timezoneOffsetHours, pLocation.timeZoneId
      )
    : null;
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email Resend / Update Modal State
  const [resendOrder, setResendOrder] = useState<Order | null>(null);
  const [resendEmailInput, setResendEmailInput] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await api.getMyOrders();
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (user) refreshProfile();
  }, []);

  useEffect(() => {
    if (isEditingProfile) return;
    setPName(normalizePersonName(birthProfile?.name || '') || normalizePersonName(user?.name || ''));
    setPDob(normalizeBirthDate(birthProfile?.dob || ''));
    setPTob(normalizeBirthTime(birthProfile?.tob || ''));
    setPGender(birthProfile?.gender || 'M');
    setPLocation(locationFromBirthProfile(birthProfile));
  }, [birthProfile, user?.name, isEditingProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizePersonName(pName)) {
      setProfileSaveError('Please enter your full name.');
      return;
    }
    if (!pDob) {
      setProfileSaveError('Please enter your date of birth.');
      return;
    }
    if (!isValidIsoBirthDate(pDob)) {
      setProfileSaveError('Please enter a valid date of birth that is not in the future.');
      return;
    }
    if (!pTob) {
      setProfileSaveError('Please enter your time of birth.');
      return;
    }
    if (!isValidBirthTime(pTob)) {
      setProfileSaveError('Please enter a valid birth time.');
      return;
    }
    if (!isVerifiedBirthLocation(pLocation)) {
      setProfileSaveError('Please search for and select your birth place so its coordinates and timezone can be saved.');
      return;
    }
    setIsSavingProfile(true);
    setProfileSaveError('');
    setProfileSaveSuccess(false);
    try {
      const result = await updateBirthProfile({
        name: normalizePersonName(pName),
        dob: pDob,
        tob: pTob,
        birthPlace: pLocation.placeName,
        country: pLocation.country,
        latitude: Number(pLocation.latitude),
        longitude: Number(pLocation.longitude),
        timezoneOffsetHours: profileTimezone?.timezoneOffsetHours ?? Number(pLocation.timezoneOffsetHours),
        gender: pGender
      });
      if (result.success) {
        setProfileSaveSuccess(true);
        setIsEditingProfile(false);
        setTimeout(() => setProfileSaveSuccess(false), 4000);
      } else {
        setProfileSaveError(result.message || 'Could not save your birth profile. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to save birth profile:', err);
      setProfileSaveError(err?.message || 'Could not save your birth profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenResendModal = (order: Order) => {
    setResendOrder(order);
    setResendEmailInput(order.userEmail || user?.email || '');
    setResendFeedback(null);
  };

  const handleCloseResendModal = () => {
    setResendOrder(null);
    setResendEmailInput('');
    setResendFeedback(null);
  };

  const handleExecuteResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendOrder) return;

    const emailToUse = (resendEmailInput || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      setResendFeedback({
        type: 'error',
        message: 'Please enter a valid email address.'
      });
      return;
    }

    setIsResending(true);
    setResendFeedback(null);

    try {
      let payload: any;
      const isCompleted = (resendOrder.status || '').toUpperCase() === 'COMPLETED';
      if (isCompleted && resendOrder.groupId) {
        const familyOrders = orders.filter(order => order.groupId === resendOrder.groupId);
        if (familyOrders.length === 0) {
          throw new Error('The full family order is not available. Refresh your orders and retry.');
        }
        const prepared = await prepareFamilyFulfilPayload(
          familyOrders,
          resendOrder.groupId,
          progress => setResendFeedback({ type: 'success', message: progress.message }),
          { stagingAudience: 'customer' }
        );
        payload = prepared.payload;
      } else if (isCompleted) {
        const language = resendOrder.language || 'ta';
        const pdfs = await generateOrderPdfsBase64(resendOrder, language);
        payload = await deliverOrderPdfPayload(
          resendOrder,
          { ...pdfs, language },
          { stagingAudience: 'customer' }
        );
      }

      const res = await api.requestCustomerEmailResend(resendOrder.id, emailToUse, payload);
      if (res && res.success) {
        setResendFeedback({
          type: 'success',
          message: res.message || `Preview-quality reports & tax invoice successfully emailed to ${emailToUse}!`
        });
        // Update local order list
        setOrders(prev => prev.map(o => o.id === resendOrder.id || (resendOrder.groupId && o.groupId === resendOrder.groupId)
          ? { ...o, userEmail: emailToUse, ...(isCompleted ? { emailStatus: 'SENT' } : {}) }
          : o));
      } else {
        setResendFeedback({
          type: 'error',
          message: res?.message || 'Failed to dispatch email. Please check your address and try again.'
        });
      }
    } catch (err: any) {
      setResendFeedback({
        type: 'error',
        message: err.message || 'Error communicating with the mail server.'
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6 animate-in fade-in">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-xl shadow-amber-500/10">
          <User className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>User Portal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 dark:text-white">
            User Sign In Required
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Please log in with your email or Google account to view your past orders, delivery statuses, and access your saved birth chart.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <button
            onClick={() => onNavigate('login')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            Log In to Account
          </button>
          <button
            onClick={() => onNavigate('register')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold border border-slate-700 transition-all cursor-pointer"
          >
            Create Free Account
          </button>
        </div>
      </div>
    );
  }

  // Client-side hint only. api/ai_astrologer.php re-checks this on EVERY request
  // (requireAuth + requirePaidOrder), because the browser is not trustworthy.
  const paidOrders = orders.filter(
    (o) => o.status === 'COMPLETED' && o.hasPdf && o.serviceMode !== 'FREE_BETA'
  );
  const aiLanguage = (user?.country === 'India' ? 'hi' : 'ta') as 'ta' | 'hi' | 'en';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <SEO
        title="Customer Order Dashboard | ASTRO SIVAM"
        description="Track your astrology orders, email-delivery status, and saved birth profile."
        noindex={true}
      />

      {aiChatOpen && user?.id && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg">
            <AiAstrologerPanel
              customerId={String(user.id)}
              customerName={displayName || 'User'}
              language={aiLanguage}
              orderId={aiChatOrder?.id}
              orderLabel={aiChatOrder ? `Report #${aiChatOrder.orderNumber}` : undefined}
              onClose={() => setAiChatOpen(false)}
            />
          </div>
        </div>
      )}
      
      {/* Top Welcome Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Customer Dashboard
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Namaste, {displayName || 'User'}
          </h1>
          <p className="text-xs text-slate-400">
            {user?.email} • {user?.mobile || 'Mobile not set'}
          </p>
        </div>

        {/* Quick Service Ordering Buttons */}
        <div className="flex flex-wrap gap-2">
          {paidOrders.length > 0 && (
            <button
              onClick={() => { setAiChatOrder(null); setAiChatOpen(true); }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI Astrologer</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('birth-jathagam')}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Order Jathagam</span>
          </button>
          <button
            onClick={() => onNavigate('marriage-compatibility')}
            className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Order Match</span>
          </button>
          <button
            onClick={() => onNavigate('baby-naming')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Baby className="w-3.5 h-3.5" />
            <span>Order Baby Naming</span>
          </button>
          <button
            onClick={() => onNavigate('muhurtham')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Order Muhurtham</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>My Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Saved Birth Profile</span>
        </button>

        <div className="ml-auto">
          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs flex items-center gap-1 cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Orders View */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          
          {/* Important Email Delivery Notice Banner */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <span>Official Email Delivery Policy</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Direct Attachment
                  </span>
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Once your order is approved by the ASTRO SIVAM Administrator, your certified <strong>Astrological Report PDF</strong> and official <strong>Tax Invoice Bill PDF</strong> are attached directly and emailed from <strong>admin@astrosivam.com</strong>.
                </p>
                <p className="text-slate-400 leading-relaxed text-[11.5px]">
                  Reports are not stored for download in this dashboard. The dashboard shows your order and email-delivery status only. <strong>Check your Spam/Junk folder</strong> if the message is not in your inbox; if delivery failed, update your address and use the <strong>&quot;Resend to Email&quot;</strong> button below.
                </p>
              </div>
            </div>
          </div>

          {isLoadingOrders ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
              <div className="text-xs font-semibold">Loading your order history...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Horoscope Orders Placed Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You haven&apos;t placed any astrology orders yet. Select a service below to request your certified Vedic horoscope report.
              </p>
              <button
                onClick={() => onNavigate('birth-jathagam')}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Place Birth Jathagam Order
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(orders || []).map(order => {
                const isCompleted = order.status === 'COMPLETED' || order.status === 'GENERATED';
                const isFree = order.serviceMode === 'FREE_BETA';

                const getServiceName = () => {
                  if (order.serviceType === 'BIRTH_JATHAGAM') {
                    return {
                      icon: '🪐',
                      title: 'Janma Jathagam',
                      sub: 'Comprehensive Birth Horoscope Report'
                    };
                  }
                  if (order.serviceType === 'MARRIAGE_COMPATIBILITY') {
                    return {
                      icon: '💍',
                      title: 'Marriage Compatibility',
                      sub: '10-Porutham Wedding Synastry'
                    };
                  }
                  if (order.serviceType === 'BABY_NAMING') {
                    return {
                      icon: '👶',
                      title: 'Baby Naming',
                      sub: 'Peyar Sooduthal & Nakshatra Syllables'
                    };
                  }
                  if (order.serviceType === 'MUHURTHAM') {
                    return {
                      icon: '📅',
                      title: 'Subha Muhurtham',
                      sub: '6 Months of Auspicious Dates'
                    };
                  }
                  if (order.serviceType === 'MULTI_PERSON') {
                    // One order, up to 6 people, one report per service bought.
                    const peopleCount = order.persons?.length || 0;
                    const reportCount = order.items?.length || 0;
                    return {
                      icon: '👪',
                      title: 'Multi-Person Order',
                      sub: `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} · ${reportCount} ${reportCount === 1 ? 'report' : 'reports'}`
                    };
                  }
                  return {
                    icon: '📜',
                    title: order.serviceType.replace(/_/g, ' '),
                    sub: 'Vedic Astrology Consultation'
                  };
                };

                const serviceInfo = getServiceName();
                const personName = order.inputPayload?.name || order.userName || displayName || 'User';
                const birthPlace = order.inputPayload?.birthPlace;
                const dob = order.inputPayload?.dob;
                const tob = order.inputPayload?.tob;
                const gender = order.inputPayload?.gender;

                // For Marriage Compatibility
                const boy = order.inputPayload?.groom || order.inputPayload?.boy || (order.inputPayload?.groomName ? {
                  name: order.inputPayload.groomName,
                  dob: order.inputPayload.groomDob,
                  tob: order.inputPayload.groomTob,
                  birthPlace: order.inputPayload.groomBirthPlace || order.inputPayload.groomPlace
                } : null) || (order.calculatedResult as any)?.groom || (order.calculatedResult ? {
                  name: (order.calculatedResult as any).groomName,
                  dob: (order.calculatedResult as any).groomDob,
                  tob: (order.calculatedResult as any).groomTob,
                  birthPlace: (order.calculatedResult as any).groomPlace
                } : null);

                const girl = order.inputPayload?.bride || order.inputPayload?.girl || (order.inputPayload?.brideName ? {
                  name: order.inputPayload.brideName,
                  dob: order.inputPayload.brideDob,
                  tob: order.inputPayload.brideTob,
                  birthPlace: order.inputPayload.brideBirthPlace || order.inputPayload.bridePlace
                } : null) || (order.calculatedResult as any)?.bride || (order.calculatedResult ? {
                  name: (order.calculatedResult as any).brideName,
                  dob: (order.calculatedResult as any).brideDob,
                  tob: (order.calculatedResult as any).brideTob,
                  birthPlace: (order.calculatedResult as any).bridePlace
                } : null);

                const getLangBadge = () => {
                  const l = (order.language || 'ta').toLowerCase();
                  if (l === 'ta' || l === 'tamil') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-950/60 text-amber-300 border border-amber-700/60">
                        <span>🇮🇳</span>
                        <span>Tamil</span>
                      </span>
                    );
                  }
                  if (l === 'hi' || l === 'hindi') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-orange-950/60 text-orange-300 border border-orange-700/60">
                        <span>🕉️</span>
                        <span>Hindi</span>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-950/60 text-blue-300 border border-blue-700/60">
                      <span>🇬🇧</span>
                      <span>English</span>
                    </span>
                  );
                };

                return (
                  <div
                    key={order.id}
                    className="bg-slate-900/95 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-lg transition-all space-y-4"
                  >
                    {/* Top Row: Order Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-amber-950/70 text-amber-300 border border-amber-700/60">
                          #{order.orderNumber || order.id}
                        </span>

                        <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border ${
                          order.serviceType === 'BIRTH_JATHAGAM'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                            : order.serviceType === 'MARRIAGE_COMPATIBILITY'
                            ? 'bg-pink-950/60 text-pink-300 border-pink-700/60'
                            : order.serviceType === 'MULTI_PERSON'
                            ? 'bg-violet-950/60 text-violet-300 border-violet-700/60'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                        }`}>
                          <span className="mr-1">{serviceInfo.icon}</span>
                          <span className="font-extrabold">{serviceInfo.title}</span>
                        </span>

                        {getLangBadge()}
                      </div>

                      {/* Part 4 entry point: ask about THIS report. Shown only for a
                          completed paid order; the server re-checks on every request. */}
                      {order.status === 'COMPLETED' && order.hasPdf && order.serviceMode !== 'FREE_BETA' && (
                        <button
                          onClick={() => { setAiChatOrder(order); setAiChatOpen(true); }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-600/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ask about this report</span>
                        </button>
                      )}
                    </div>

                    {/* Middle: Complete Order & User Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Left Column: User & Astrological Input Details */}
                      <div className="space-y-2 bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/60">
                        <div className="text-[10.5px] uppercase font-bold text-amber-400 tracking-wider">
                          User & Birth Details
                        </div>
                        
                        {order.serviceType === 'MARRIAGE_COMPATIBILITY' && (boy || girl) ? (
                          <div className="space-y-2 text-xs">
                            <div className="text-slate-200">
                              <span className="font-bold text-blue-300">Groom:</span> {boy?.name || 'Groom'}{' '}
                              <span className="text-slate-400">({boy?.dob} • {boy?.tob} • {boy?.birthPlace})</span>
                            </div>
                            <div className="text-slate-200">
                              <span className="font-bold text-pink-300">Bride:</span> {girl?.name || 'Bride'}{' '}
                              <span className="text-slate-400">({girl?.dob} • {girl?.tob} • {girl?.birthPlace})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-xs">
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              <span>{personName}</span>
                              {gender && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                                  {gender === 'M' || gender === 'Male' ? 'Male' : 'Female'}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-300 text-[11.5px] pt-1">
                              {dob && (
                                <div>
                                  <span className="text-slate-400 font-medium">Date of Birth:</span>{' '}
                                  <strong className="text-amber-200 font-semibold">{dob}</strong>
                                </div>
                              )}
                              {tob && (
                                <div>
                                  <span className="text-slate-400 font-medium">Exact Time:</span>{' '}
                                  <strong className="text-amber-200 font-semibold">{tob}</strong>
                                </div>
                              )}
                              {birthPlace && (
                                <div className="sm:col-span-2">
                                  <span className="text-slate-400 font-medium">Birth Place:</span>{' '}
                                  <strong className="text-slate-200 font-semibold">{birthPlace}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Financial & Booking Metadata */}
                      <div className="space-y-2 bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/60 text-xs">
                        <div className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">
                          Order & Payment Information
                        </div>

                        <div className="space-y-1.5 text-[11.5px]">
                          <div className="flex justify-between text-slate-300">
                            <span className="text-slate-400">Ordered On:</span>
                            <strong className="text-slate-200">
                              {order.createdAt
                                ? new Date(order.createdAt).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : 'N/A'}
                            </strong>
                          </div>

                          <div className="flex justify-between text-slate-300">
                            <span className="text-slate-400">Payment Mode:</span>
                            <strong className={isFree ? 'text-amber-400' : 'text-emerald-400'}>
                              {isFree ? '★ Free Beta (Your 1 Free Report)' : `Paid (${order.currency} $${order.amount})`}
                            </strong>
                          </div>

                          {order.paymentReference && (
                            <div className="flex justify-between text-slate-300">
                              <span className="text-slate-400">Payment Ref:</span>
                              <span className="font-mono text-[11px] text-slate-200">{order.paymentReference}</span>
                            </div>
                          )}

                          <div className="flex justify-between text-slate-300">
                            <span className="text-slate-400">Delivery Email:</span>
                            <strong className="text-amber-300">{order.userEmail}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Delivery Status & Conditional Email Retry */}
                    <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-800/80">
                      
                      {/* Delivery Status Message */}
                      <div className="flex-1 text-xs">
                        {order.emailStatus === 'FAILED' ? (
                          <div className="text-rose-200 bg-rose-950/60 border border-rose-700/80 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-bold text-rose-300">
                                Email Delivery Failed / Bounced
                              </div>
                              <div className="text-[11.5px] text-rose-200">
                                We could not deliver your report to <strong>{order.userEmail}</strong>. Please update your email address using the button on the right to receive your Vedic Report.
                              </div>
                            </div>
                          </div>
                        ) : isCompleted ? (
                          <div className="text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-bold text-white">
                                Report Complete & Emailed
                              </div>
                              <div className="text-[11.5px] text-emerald-200">
                                High-resolution Vedic Report PDF & Tax Invoice PDF were successfully emailed to <strong>{order.userEmail}</strong>.
                              </div>
                            </div>
                          </div>
                        ) : order.status === 'CANCELLED' ? (
                          <div className="text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl px-3.5 py-2 flex items-center gap-2 text-[11.5px]">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>This order was cancelled.</span>
                          </div>
                        ) : (
                          <div className="text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-bold text-amber-200">
                                Processing in Vedic Astrology Queue
                              </div>
                              <div className="text-[11.5px] text-amber-300/90">
                                Our India Vedic astrology scholars are reviewing your planetary chart. Your PDF Report and Tax Invoice will be emailed to <strong>{order.userEmail}</strong>.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Request Email Resend / Update Email Button: ONLY ENABLED IF DELIVERY FAILED OR PENDING */}
                      {(order.emailStatus === 'FAILED' || order.status === 'PENDING' || order.status === 'PENDING_APPROVAL') && (
                        <div className="shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenResendModal(order)}
                            className={`w-full sm:w-auto px-4 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 border ${
                              order.emailStatus === 'FAILED'
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-amber-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border-slate-700'
                            }`}
                            title={order.emailStatus === 'FAILED' ? "Update email address and re-dispatch report" : "Update delivery email address"}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{order.emailStatus === 'FAILED' ? "Update Email & Retry Delivery" : "Update Delivery Email"}</span>
                          </button>
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Saved Birth Profile View */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                One-Time Saved Birth Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                These birth coordinates are automatically reused across all your horoscope calculations.
              </p>
            </div>

            {!isEditingProfile && (
              <button
                onClick={() => {
                  setProfileSaveError('');
                  setIsEditingProfile(true);
                }}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            )}
          </div>

          {profileSaveSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Birth Profile successfully updated and saved!</span>
            </div>
          )}

          {profileSaveError && (
            <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileSaveError}</span>
            </div>
          )}

          {!birthProfile && !isEditingProfile && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 text-amber-800 dark:text-amber-200 rounded-xl text-xs leading-relaxed">
              No saved birth profile yet. Add your birth details once and they can be reused for future astrology services.
            </div>
          )}

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonNameField
                  id="profile-user-name"
                  label="User full name"
                  value={pName}
                  onChange={setPName}
                  placeholder="Your full name"
                  size="sm"
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Gender:
                  </label>
                  <select
                    value={pGender}
                    onChange={e => setPGender(e.target.value as 'M' | 'F')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <BirthDateField
                  label="Date of Birth"
                  size="sm"
                  value={pDob}
                  onChange={setPDob}
                />

                <BirthTimeField
                  label="Exact Birth Time"
                  size="sm"
                  value={pTob}
                  onChange={setPTob}
                />
              </div>

              <GooglePlacesPicker
                value={pLocation || undefined}
                onChange={setPLocation}
                label="Birth Place (Google Maps)"
              />
              <BirthTimeZoneNotice resolution={profileTimezone} date={pDob} time={pTob} />

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Birth Details'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">User Name</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{birthProfile?.name || 'Not set'}</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">Date & Time of Birth</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  {birthProfile?.dob || 'Not set'}{birthProfile?.tob ? ` at ${birthProfile.tob}` : ''}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">Birth Location</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  {birthProfile?.birthPlace || 'Not set'}{birthProfile?.country ? `, ${birthProfile.country}` : ''}
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">Coordinates & Timezone</div>
                <div className="font-bold text-slate-900 dark:text-white mt-1">
                  {savedBirthLocation
                    ? `${savedBirthLocation.latitude.toFixed(2)}°, ${savedBirthLocation.longitude.toFixed(2)}° (UTC${savedBirthLocation.timezoneOffsetHours >= 0 ? '+' : ''}${savedBirthLocation.timezoneOffsetHours.toFixed(1)})`
                    : 'Select this saved place again to verify its coordinates and timezone'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Resend Email / Update Delivery Address */}
      {resendOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl text-white space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Mail className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Email Re-Delivery Request</h3>
              </div>
              <button
                onClick={handleCloseResendModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Brief */}
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Order:</span>
                <span className="font-mono font-bold text-amber-300">#{resendOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">User:</span>
                <span className="font-bold text-white">
                  {resendOrder.inputPayload?.name || resendOrder.userName || 'User'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Current Status:</span>
                <span className={resendOrder.status === 'COMPLETED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {resendOrder.status === 'COMPLETED' ? '✓ Completed' : '⏳ In Processing'}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleExecuteResend} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-200 block">
                  Recipient Email Address:
                </label>
                <input
                  type="email"
                  required
                  value={resendEmailInput}
                  onChange={e => setResendEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-white text-xs outline-hidden transition-colors"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If your email address had a typo or you prefer receiving documents on a different email address, enter it above.
                </p>
              </div>

              {resendFeedback && (
                <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                  resendFeedback.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-800 text-rose-300'
                }`}>
                  {resendFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span className="leading-relaxed">{resendFeedback.message}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isResending}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching Email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Resend Documents</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseResendModal}
                  disabled={isResending}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
