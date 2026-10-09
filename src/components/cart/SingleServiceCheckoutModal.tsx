import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  FileText,
  Copy,
  Check,
  QrCode,
  Languages,
  Mail,
  Smartphone,
  CreditCard,
  Sparkles,
  ArrowRight,
  Send,
  UserCheck
} from 'lucide-react';
import {
  ServiceType,
  AppLanguage,
  PaymentMethod,
  CurrencyCode,
  Order,
  SystemSettings
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { api } from '../../services/api';
import { CURRENCY_INFO, getServicePrices } from '../../services/pricing';

export interface CheckoutDevoteeSummary {
  name: string;
  dob?: string;
  tob?: string;
  birthPlace?: string;
  muhurthamPlace?: string;
  secondaryName?: string;
  secondaryDob?: string;
  secondaryBirthPlace?: string;
  ceremonyName?: string;
  targetMonth?: string;
}

export interface SingleServiceCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: ServiceType;
  serviceTitle: string;
  devoteeSummary: CheckoutDevoteeSummary;
  selectedLanguage: AppLanguage;
  onLanguageChange?: (lang: AppLanguage) => void;
  inputPayload: any;
  saveAsProfile?: boolean;
  onSuccess?: (order: Order) => void;
  onNavigate?: (route: string) => void;
}

export const SingleServiceCheckoutModal: React.FC<SingleServiceCheckoutModalProps> = ({
  isOpen,
  onClose,
  serviceType,
  serviceTitle,
  devoteeSummary,
  selectedLanguage,
  onLanguageChange,
  inputPayload,
  saveAsProfile = false,
  onSuccess,
  onNavigate
}) => {
  const { user, isAdmin } = useAuth();
  const {
    currency,
    paymentMethod,
    setPaymentMethod,
    isFreeBeta,
    betaFreeChartAvailable,
    settings
  } = useCart();

  const [paymentRef, setPaymentRef] = useState('');
  const [whatsappDelivery, setWhatsappDelivery] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const wasOpen = useRef(false);

  // This modal is kept mounted by most service pages while closed. Reset the
  // previous success and receipt when it opens for another checkout, otherwise
  // the old success view/transaction reference can block the next order.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setSuccessOrder(null);
      setPaymentRef('');
      setErrorMessage('');
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  // Admin access comes from the authenticated role, not the site's beta mode
  // or its one-free-report allowance. Every admin report is always free.
  const orderWillBeFree = isAdmin || (isFreeBeta && betaFreeChartAvailable);

  const prices = getServicePrices(settings, serviceType);
  const priceFjd = prices.FJD;
  const priceUsd = prices.USD;
  const priceInr = prices.INR;

  const activePrice =
    currency === 'FJD' ? priceFjd : currency === 'INR' ? priceInr : priceUsd;
  const activeSymbol = CURRENCY_INFO[currency]?.symbol || '$';

  // Offline Payment Details
  const mpaisaNumber = settings?.vodafoneMPaisaNumber || '+679 849 5275';
  const mpaisaName = settings?.vodafoneMPaisaName || 'ASTRO SIVAM';
  const upiId = settings?.indiaGpayUpiId || 'astrosivam@okhdfcbank';
  const upiName = settings?.indiaGpayName || 'ASTRO SIVAM';
  const paypalEmail = settings?.paypalEmail || 'payments@astrosivam.com';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectMethod = (method: PaymentMethod) => {
    // CartContext derives currency from the selected payment method.
    setPaymentMethod(method);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!orderWillBeFree && paymentMethod !== 'NONE' && !paymentRef.trim()) {
      setErrorMessage(
        'Please enter your payment receipt or transaction reference number.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const finalPayload = {
        ...inputPayload,
        whatsappDelivery: whatsappDelivery ? whatsappNumber.trim() : undefined
      };

      const res = await api.placeOrder({
        serviceType,
        language: selectedLanguage,
        country: user?.country || 'Fiji',
        billingCountry: user?.country || 'Fiji',
        paymentMethod: orderWillBeFree ? 'NONE' : paymentMethod,
        currency,
        paymentReference: orderWillBeFree ? undefined : paymentRef.trim(),
        inputPayload: finalPayload,
        saveAsProfile
      });

      if (res.success && res.order) {
        setSuccessOrder(res.order);
        if (onSuccess) onSuccess(res.order);
      } else {
        setErrorMessage(res.message || 'Failed to place order. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = (targetRoute = 'dashboard') => {
    onClose();
    setSuccessOrder(null);
    setPaymentRef('');
    setErrorMessage('');
    if (onNavigate) {
      onNavigate(targetRoute);
    }
  };

  const getLanguageLabel = (code: AppLanguage) => {
    switch (code) {
      case 'ta':
        return 'Tamil (தமிழ்)';
      case 'hi':
        return 'Hindi (हिन्दी)';
      default:
        return 'English';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-[#0f172a] border border-amber-500/30 text-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-950 via-[#161b33] to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  ASTRO SIVAM CHECKOUT
                </span>
                {orderWillBeFree && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {isAdmin ? '★ ADMIN — ALWAYS FREE' : '★ FREE 1ST REPORT'}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                {serviceTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (successOrder) handleFinish();
              else onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {successOrder ? (
            /* Order Success View */
            <div className="text-center py-6 space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">
                  Order Submitted Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                  {isAdmin
                    ? 'Your admin report was submitted at no charge and is awaiting report approval. No payment verification is needed.'
                    : orderWillBeFree
                    ? 'Your free astrological reading has been queued. Our Vedic scholars will verify the planetary ephemeris and email your certificate.'
                    : `Your payment reference (${paymentRef}) has been received for verification. Once approved, your detailed PDF report will be delivered.`}
                </p>
              </div>

              {/* Order Reference Badge */}
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-slate-400">Order Reference</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {successOrder.orderNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-slate-400">User Name</span>
                  <span className="font-bold text-white">
                    {devoteeSummary.name || 'User'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                  <span className="text-slate-400">Delivery Email</span>
                  <span className="font-bold text-sky-400">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Report Language</span>
                  <span className="font-bold text-amber-300">
                    {getLanguageLabel(selectedLanguage)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-4 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => handleFinish('services')}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Place Next Order</span>
                </button>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => handleFinish('dashboard')}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Go to Customer Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinish('home')}
                    className="py-3 px-5 bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Checkout Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. User & Report Summary Card */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    1. User & Delivery Details
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Email: <strong className="text-white">{user?.email}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">
                      User / Candidate
                    </span>
                    <span className="font-bold text-white text-sm">
                      {devoteeSummary.name || 'User'}
                    </span>
                    {devoteeSummary.secondaryName && (
                      <span className="text-slate-300 text-xs block">
                        Partner: {devoteeSummary.secondaryName}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">
                      Birth Details & Location
                    </span>
                    <span className="text-slate-200 block">
                      {devoteeSummary.dob ? `DOB: ${devoteeSummary.dob}` : ''}
                      {devoteeSummary.tob ? ` • ${devoteeSummary.tob}` : ''}
                    </span>
                    {devoteeSummary.birthPlace && (
                      <span className="text-slate-400 text-[11px] block truncate">
                        Birth place: {devoteeSummary.birthPlace}
                      </span>
                    )}
                    {devoteeSummary.muhurthamPlace && (
                      <span className="text-amber-200 text-[11px] block truncate">
                        Muhurtham dates and times: {devoteeSummary.muhurthamPlace} (local time)
                      </span>
                    )}
                    {!devoteeSummary.birthPlace && !devoteeSummary.muhurthamPlace && devoteeSummary.ceremonyName && (
                      <span className="text-slate-400 text-[11px] block truncate">{devoteeSummary.ceremonyName}</span>
                    )}
                  </div>
                </div>

                {/* Report Language Pill Selector */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Languages className="w-3.5 h-3.5 text-amber-400" />
                    <span>Report Language:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['en', 'ta', 'hi'] as AppLanguage[]).map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => onLanguageChange?.(lang)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedLanguage === lang
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {lang === 'en'
                          ? 'English'
                          : lang === 'ta'
                          ? 'Tamil (தமிழ்)'
                          : 'Hindi (हिन्दी)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Pricing & Payment Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {orderWillBeFree ? '2. Order Confirmation' : '2. Payment & Confirmation'}
                  </h3>
                  {/* No payment or currency selection is needed for free reports. */}
                  {!orderWillBeFree && (
                    <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-white/10">
                      {(['FJD', 'USD', 'INR'] as CurrencyCode[]).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            if (c === 'FJD') setPaymentMethod('MPAISA');
                            else if (c === 'INR') setPaymentMethod('GPAY');
                            else setPaymentMethod('PAYPAL');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            currency === c
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {c === 'FJD' ? 'FJ$' : c === 'INR' ? '₹ INR' : 'US$'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {orderWillBeFree ? (
                  /* Admin or Free Beta Card */
                  <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="font-bold flex items-center gap-2 text-emerald-400 text-sm">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>
                          {isAdmin
                            ? 'Admin — All Reports Are Always Free'
                            : 'Free Beta Testing — 1st Report Is 100% Free!'}
                        </span>
                      </div>
                      <span className="font-black text-emerald-400 font-mono text-sm bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        FREE
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {isAdmin
                        ? 'Every report is free for your admin account, including repeat orders and family charts, in both paid and beta modes. No payment or receipt is required. Report approval is unchanged.'
                        : 'Enjoy your complimentary precision Vedic astrology report. No credit card or payment receipt required for your first report!'}
                    </p>
                  </div>
                ) : (
                  /* Paid Options Card */
                  <div className="space-y-4">
                    {/* Method Selector Tabs */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectMethod('MPAISA')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'MPAISA'
                            ? 'bg-red-950/40 border-red-500 text-white ring-2 ring-red-500/40 shadow-lg'
                            : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-red-400 block uppercase">
                          Fiji Local
                        </span>
                        <span className="text-xs font-bold text-white block mt-0.5">
                          M-PAiSA
                        </span>
                        <span className="text-[11px] font-mono text-slate-300 block">
                          FJ${priceFjd}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectMethod('GPAY')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'GPAY'
                            ? 'bg-sky-950/40 border-sky-500 text-white ring-2 ring-sky-500/40 shadow-lg'
                            : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-sky-400 block uppercase">
                          India UPI
                        </span>
                        <span className="text-xs font-bold text-white block mt-0.5">
                          GPay / PhonePe
                        </span>
                        <span className="text-[11px] font-mono text-slate-300 block">
                          ₹{priceInr}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectMethod('PAYPAL')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'PAYPAL' || paymentMethod === 'CARD'
                            ? 'bg-amber-950/40 border-amber-500 text-white ring-2 ring-amber-500/40 shadow-lg'
                            : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-amber-400 block uppercase">
                          International
                        </span>
                        <span className="text-xs font-bold text-white block mt-0.5">
                          PayPal / Card
                        </span>
                        <span className="text-[11px] font-mono text-slate-300 block">
                          US${priceUsd}
                        </span>
                      </button>
                    </div>

                    {/* Instruction Box for Selected Method */}
                    <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-4 space-y-3">
                      {paymentMethod === 'MPAISA' && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">M-PAiSA Mobile:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white">
                                {mpaisaNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(mpaisaNumber, 'mpaisa_num')
                                }
                                className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                                title="Copy Number"
                              >
                                {copiedKey === 'mpaisa_num' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Account Name:</span>
                            <span className="font-bold text-slate-200">
                              {mpaisaName}
                            </span>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'GPAY' && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">UPI ID:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sky-400">
                                {upiId}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(upiId, 'upi_id')}
                                className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                                title="Copy UPI ID"
                              >
                                {copiedKey === 'upi_id' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Recipient:</span>
                            <span className="font-bold text-slate-200">{upiName}</span>
                          </div>
                        </div>
                      )}

                      {(paymentMethod === 'PAYPAL' || paymentMethod === 'CARD') && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">PayPal Email:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-300">
                                {paypalEmail}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(paypalEmail, 'paypal_email')
                                }
                                className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                                title="Copy PayPal Email"
                              >
                                {copiedKey === 'paypal_email' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Transaction Reference Input */}
                      <div className="pt-2 border-t border-white/10 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Payment Reference / Transaction ID / Receipt ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={paymentRef}
                          onChange={e => setPaymentRef(e.target.value)}
                          placeholder="e.g. TXN1049281 / MP849204 / UPI Ref"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* WhatsApp Delivery Addon */}
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappDelivery}
                      onChange={e => setWhatsappDelivery(e.target.checked)}
                      className="rounded border-white/20 text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-300 font-medium">
                      Also send PDF certificate to my WhatsApp
                    </span>
                  </label>
                  {whatsappDelivery && (
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      placeholder="WhatsApp Mobile Number with country code (+679... / +91...)"
                      className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              {/* Submit Action Button */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-950/40 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                      <span>Submitting Order to Astrologer Team...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 text-slate-950" />
                      <span>
                        {orderWillBeFree
                          ? 'Confirm Free Order →'
                          : `Place Order • ${activeSymbol}${activePrice} ${currency}`}
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 text-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    100% Authentic Lahiri Sidereal Jyotisha • Guaranteed Confidentiality
                  </span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
