import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  Smartphone,
  CreditCard,
  X,
  AlertCircle
} from 'lucide-react';
import {
  PaymentMethod,
  CurrencyCode,
  SystemSettings,
  OnlinePaymentSession
} from '../../types';
import { CURRENCY_INFO } from '../../services/pricing';
import { PAYMENT_METHOD_OPTIONS, getGatewayModeForMethod } from './PaymentMethodSelector';
import { api } from '../../services/api';

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay checkout could not be loaded.'));
    document.head.appendChild(script);
  });
}

interface PaymentGatewayCheckoutBoxProps {
  paymentMethod: PaymentMethod;
  amount: number;
  currency: CurrencyCode;
  currencySymbol: string;
  settings: SystemSettings | null;
  paymentRef: string;
  onPaymentRefChange: (ref: string) => void;
  onPaymentIntentIdChange?: (intentId: string) => void;
  itemCount?: number;
  description?: string;
}

export const PaymentGatewayCheckoutBox: React.FC<PaymentGatewayCheckoutBoxProps> = ({
  paymentMethod,
  amount,
  currency,
  currencySymbol,
  settings,
  paymentRef,
  onPaymentRefChange,
  onPaymentIntentIdChange,
  itemCount = 1,
  description = 'ASTRO SIVAM Vedic Astrology Consultation'
}) => {
  const gatewayMode = getGatewayModeForMethod(paymentMethod, settings);
  const selectedOption = PAYMENT_METHOD_OPTIONS.find(o => o.method === paymentMethod);
  const currencyLabel = CURRENCY_INFO[currency]?.label || currency;
  const currencyRegion = CURRENCY_INFO[currency]?.region || '';

  // Offline recipient details with defaults
  const mpaisaNumber = settings?.vodafoneMPaisaNumber || '+679 849 5275';
  const mpaisaName = settings?.vodafoneMPaisaName || settings?.vodafoneMPaisaNumber || 'ASTRO SIVAM';
  const mpaisaMerchantCode = settings?.vodafoneMPaisaMerchantCode || '';
  const mpaisaInstructions =
    settings?.vodafoneMPaisaInstructions ||
    'Send payment via Vodafone M-PAiSA app or USSD *555#. Enter your Transaction ID below.';

  const upiId = settings?.indiaGpayUpiId || 'astrosivam@okhdfcbank';
  const upiNumber = settings?.indiaGpayNumber || '+91 98410 78901';
  const upiName = settings?.indiaGpayName || 'ASTRO SIVAM';
  const upiInstructions =
    settings?.indiaGpayInstructions ||
    'Send payment via Google Pay (GPay) or any UPI app to the UPI ID or mobile number above.';

  const paypalEmail = settings?.paypalEmail || 'payments@astrosivam.com';
  const paypalBusinessName = settings?.paypalBusinessName || 'ASTRO SIVAM GLOBAL SERVICES';
  const paypalMeLink = settings?.paypalMeLink || '';
  const paypalInstructions =
    settings?.paypalInstructions ||
    'Pay securely via PayPal or international credit/debit card and enter your receipt ID below.';

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showQrBox, setShowQrBox] = useState(false);

  // Online Gateway Checkout State
  const [manualOverrideInOnlineMode, setManualOverrideInOnlineMode] = useState(false);
  const [isLaunchingOnline, setIsLaunchingOnline] = useState(false);
  const [onlineSession, setOnlineSession] = useState<OnlinePaymentSession | null>(null);
  const [isVerifyingOnline, setIsVerifyingOnline] = useState(false);
  const [onlineVerifiedRef, setOnlineVerifiedRef] = useState<string | null>(null);
  const [onlinePayerInput, setOnlinePayerInput] = useState('');
  const [onlineError, setOnlineError] = useState('');

  // Reset online modal state when payment method changes
  useEffect(() => {
    setOnlineSession(null);
    setOnlineError('');
    onPaymentIntentIdChange?.('');
    setManualOverrideInOnlineMode(false);
    setShowQrBox(false);
    if (onlineVerifiedRef && !onlineVerifiedRef.startsWith(paymentMethod)) {
      setOnlineVerifiedRef(null);
    }
  }, [paymentMethod]);

  const handleCopy = (value: string, key: string) => {
    try {
      navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amount.toFixed(
    2
  )}&cu=INR&tn=${encodeURIComponent(description)}`;

  const finishVerifiedPayment = (res: { success: boolean; paymentIntentId?: string; paymentReference?: string; message?: string }, intentId?: string) => {
    if (res.success && res.paymentReference) {
      setOnlineVerifiedRef(res.paymentReference);
      onPaymentRefChange(res.paymentReference);
      onPaymentIntentIdChange?.(intentId || res.paymentIntentId || onlineSession?.paymentIntentId || onlineSession?.sessionId || '');
      setOnlineSession(null);
      setOnlinePayerInput('');
    } else {
      setOnlineError(res.message || 'Payment capture could not be verified. No payment reference was accepted.');
    }
  };

  const openRazorpayCheckout = async (session: NonNullable<OnlinePaymentSession>) => {
    await loadRazorpayCheckout();
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay || !session.keyId) throw new Error('Razorpay checkout is not configured.');
    const checkout = new Razorpay({
      key: session.keyId,
      amount: Math.round(session.amount * 100),
      currency: session.currency,
      name: session.merchantName || 'ASTRO SIVAM',
      description,
      order_id: session.gatewayOrderId,
      prefill: { name: '', email: '' },
      theme: { color: '#d39b2a' },
      handler: async (response: any) => {
        setIsVerifyingOnline(true);
        setOnlineError('');
        try {
          const verification = await api.verifyPaymentSession({
            sessionId: session.paymentIntentId || session.sessionId,
            paymentIntentId: session.paymentIntentId || session.sessionId,
            paymentMethod: session.paymentMethod,
            gatewayOrderId: response.razorpay_order_id,
            gatewayPaymentId: response.razorpay_payment_id,
            gatewaySignature: response.razorpay_signature
          });
          finishVerifiedPayment(verification, session.paymentIntentId || session.sessionId);
        } catch (err: any) {
          setOnlineError(err.message || 'Razorpay payment capture could not be verified.');
        } finally {
          setIsVerifyingOnline(false);
        }
      },
      modal: { ondismiss: () => setOnlineError('Checkout was cancelled. No payment was marked as verified.') }
    });
    checkout.open();
  };

  const handleStartOnlineCheckout = async () => {
    setIsLaunchingOnline(true);
    setOnlineError('');
    try {
      const res = await api.createPaymentSession({
        paymentMethod,
        amount,
        currency,
        description,
        itemCount
      });
      if (res.success && res.session) {
        setOnlineSession(res.session);
        onPaymentIntentIdChange?.(res.session.paymentIntentId || res.session.sessionId);
        if (res.session.provider === 'razorpay') {
          await openRazorpayCheckout(res.session);
        }
      } else {
        setOnlineError(res.message || 'Could not initialize a verified online gateway. Use manual payment instead.');
      }
    } catch (err: any) {
      setOnlineError(err.message || 'The verified online gateway is unavailable. Use manual payment instead.');
    } finally {
      setIsLaunchingOnline(false);
    }
  };

  const handleConfirmOnlinePayment = async () => {
    if (!onlineSession) return;
    setIsVerifyingOnline(true);
    setOnlineError('');
    try {
      const paymentId = onlinePayerInput.trim() || onlineSession.gatewayOrderId;
      const res = await api.verifyPaymentSession({
        sessionId: onlineSession.paymentIntentId || onlineSession.sessionId,
        paymentIntentId: onlineSession.paymentIntentId || onlineSession.sessionId,
        paymentMethod: onlineSession.paymentMethod,
        gatewayOrderId: onlineSession.gatewayOrderId,
        gatewayPaymentId: paymentId,
        payerAccount: onlinePayerInput.trim() || undefined
      });
      finishVerifiedPayment(res, onlineSession.paymentIntentId || onlineSession.sessionId);
    } catch (err: any) {
      setOnlineError(err.message || 'Payment capture could not be verified.');
    } finally {
      setIsVerifyingOnline(false);
    }
  };

  const showOfflineFlow = gatewayMode === 'offline' || manualOverrideInOnlineMode;

  return (
    <div className="p-4 bg-slate-950/85 border border-slate-800 rounded-xl space-y-3.5 text-white">
      {/* Top Gateway Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <Wallet className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {selectedOption?.title || paymentMethod} — pay {currencySymbol}
            {amount.toFixed(2)} {currency}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
              gatewayMode === 'online'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {gatewayMode === 'online' ? (
              <>
                <Wifi className="w-2.5 h-2.5" /> Online Gateway Mode
              </>
            ) : (
              <>
                <WifiOff className="w-2.5 h-2.5" /> Offline Transfer Mode
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-400 font-semibold">
            {currencyLabel}
            {currencyRegion ? ` • ${currencyRegion}` : ''}
          </span>
        </div>
      </div>

      {/* =====================================================================
          ONLINE GATEWAY CHECKOUT FLOW (When Admin sets gateway to 'online')
         ===================================================================== */}
      {!showOfflineFlow && (
        <div className="space-y-3">
          {onlineVerifiedRef && paymentRef === onlineVerifiedRef ? (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    Online Payment Authorized &amp; Verified!
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                    Verified Ref: <strong className="text-white">{onlineVerifiedRef}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOnlineVerifiedRef(null);
                  onPaymentRefChange('');
                }}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>
                      Instant Online Checkout via{' '}
                      {paymentMethod === 'GPAY'
                        ? 'Google Pay (GPay) / UPI Gateway'
                        : paymentMethod === 'PAYPAL'
                        ? 'PayPal Smart Checkout / Card'
                        : 'Vodafone Fiji M-PAiSA Online API'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Click the button below to complete your{' '}
                    <strong className="text-white">
                      {currencySymbol}
                      {amount.toFixed(2)} {currency}
                    </strong>{' '}
                    payment online. Only the provider's signed capture can be accepted automatically; a bank UTR is never treated as online verification.
                  </p>
                </div>
              </div>

              {onlineError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>{onlineError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  disabled={isLaunchingOnline}
                  onClick={handleStartOnlineCheckout}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'GPAY'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : paymentMethod === 'PAYPAL'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  {isLaunchingOnline ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to Online Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      <span>
                        Pay {currencySymbol}
                        {amount.toFixed(2)} {currency} Online Now
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualOverrideInOnlineMode(true);
                    setOnlineSession(null);
                    onPaymentIntentIdChange?.('');
                    onPaymentRefChange('');
                    setOnlineError('');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Enter Receipt ID Manually
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          OFFLINE / MANUAL TRANSFER FLOW (Default until setup, or manual toggle)
         ===================================================================== */}
      {showOfflineFlow && (
        <div className="space-y-3">
          {gatewayMode === 'online' && manualOverrideInOnlineMode && (
            <div className="flex items-center justify-between text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
              <span>Manual receipt entry enabled</span>
              <button
                type="button"
                onClick={() => setManualOverrideInOnlineMode(false)}
                className="underline font-bold hover:text-white cursor-pointer"
              >
                &larr; Back to Instant Online Checkout
              </button>
            </div>
          )}

          {/* 1. Vodafone M-PAiSA (Fiji) Offline Details */}
          {paymentMethod === 'MPAISA' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">
                Transfer <strong className="text-white">{currencySymbol}{amount.toFixed(2)}</strong> to Vodafone
                M-PAiSA mobile number:{' '}
                <span className="font-mono font-bold text-amber-400">{mpaisaNumber}</span> (Account: {mpaisaName}).
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(mpaisaNumber, 'mpaisa_num')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'mpaisa_num' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied Number!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span>Copy M-PAiSA Number ({mpaisaNumber})</span>
                    </>
                  )}
                </button>

                {mpaisaMerchantCode && (
                  <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 font-mono">
                    Merchant Code: <strong>{mpaisaMerchantCode}</strong>
                  </span>
                )}

                {settings?.vodafoneMPaisaQrUrl && (
                  <button
                    type="button"
                    onClick={() => setShowQrBox(v => !v)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>{showQrBox ? 'Hide M-PAiSA QR' : 'Show M-PAiSA QR'}</span>
                  </button>
                )}
              </div>

              {showQrBox && settings?.vodafoneMPaisaQrUrl && (
                <div className="p-3 bg-white rounded-xl w-fit mx-auto text-center space-y-1">
                  <img
                    src={settings.vodafoneMPaisaQrUrl}
                    alt="Vodafone M-PAiSA QR Code"
                    className="w-36 h-36 object-contain mx-auto"
                  />
                  <div className="text-[10px] font-bold text-slate-800">Scan in Vodafone M-PAiSA App</div>
                </div>
              )}

              <p className="text-[11px] text-slate-400">{mpaisaInstructions}</p>
            </div>
          )}

          {/* 2. India Google Pay (GPay) / UPI Offline Details */}
          {(paymentMethod === 'GPAY' || paymentMethod === 'UPI') && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">
                Send <strong className="text-white">{currencySymbol}{amount.toFixed(2)}</strong> to UPI ID:{' '}
                <span className="font-mono font-bold text-emerald-400">{upiId}</span> (Name: {upiName}
                {upiNumber ? ` • Mobile: ${upiNumber}` : ''}).
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(upiId, 'upi_id')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'upi_id' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied UPI ID!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-emerald-400" />
                      <span>Copy UPI ID ({upiId})</span>
                    </>
                  )}
                </button>

                {upiNumber && (
                  <button
                    type="button"
                    onClick={() => handleCopy(upiNumber, 'upi_num')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedField === 'upi_num' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied Mobile!</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3 h-3 text-emerald-400" />
                        <span>Copy GPay Mobile ({upiNumber})</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={upiDeepLink}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[11px] text-emerald-300 font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open GPay / UPI App</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowQrBox(v => !v)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{showQrBox ? 'Hide UPI QR' : 'Show UPI QR'}</span>
                </button>
              </div>

              {showQrBox && (
                <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                  {settings?.indiaGpayQrUrl ? (
                    <img
                      src={settings.indiaGpayQrUrl}
                      alt="GPay UPI QR"
                      className="w-28 h-28 rounded-lg bg-white p-1.5 object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-emerald-400 shrink-0 p-2 text-center">
                      <QrCode className="w-10 h-10 mb-1" />
                      <span className="text-[9px] font-mono leading-tight">UPI Deep-Link Ready</span>
                    </div>
                  )}
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <div className="font-bold text-white">
                      Pay {currencySymbol}
                      {amount.toFixed(2)} INR to {upiName}
                    </div>
                    <div className="font-mono text-emerald-400">{upiId}</div>
                    <div className="text-[10px] text-slate-400">
                      After paying in Google Pay / PhonePe / Paytm, enter the 12-digit UPI Ref / UTR number below.
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400">{upiInstructions}</p>
            </div>
          )}

          {/* 3. International PayPal Offline Details */}
          {(paymentMethod === 'PAYPAL' || paymentMethod === 'CARD') && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-300">
                Send <strong className="text-white">{currencySymbol}{amount.toFixed(2)}</strong> to PayPal
                email: <span className="font-mono font-bold text-blue-400">{paypalEmail}</span> ({paypalBusinessName})
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(paypalEmail, 'paypal_email')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'paypal_email' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied PayPal Email!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-blue-400" />
                      <span>Copy PayPal Email ({paypalEmail})</span>
                    </>
                  )}
                </button>

                {paypalMeLink && (
                  <a
                    href={paypalMeLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[11px] text-blue-300 font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open PayPal.Me Link</span>
                  </a>
                )}
              </div>

              <p className="text-[11px] text-slate-400">{paypalInstructions}</p>
            </div>
          )}
        </div>
      )}

      {/* Transaction Reference Input (Shown in Offline Mode, or as verified read-only/editable in Online Mode) */}
      <div className="pt-2 border-t border-slate-800">
        <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
          {itemCount > 1
            ? `Enter Transaction ID / Reference Number (Covers All ${itemCount} Charts):`
            : 'Transaction Reference / Receipt Number:'}
        </label>
        <input
          type="text"
          value={paymentRef}
          onChange={e => onPaymentRefChange(e.target.value)}
          placeholder={
            paymentMethod === 'GPAY'
              ? 'e.g. 12-Digit UPI Ref / UTR Number (or pay online above)'
              : paymentMethod === 'PAYPAL'
              ? 'e.g. PayPal Receipt / Transaction ID (or pay online above)'
              : 'e.g. MP-8472910 Vodafone M-PAiSA Receipt ID'
          }
          required
          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
        />
      </div>

      {/* =====================================================================
          INTERACTIVE ONLINE PAYMENT GATEWAY MODAL
         ===================================================================== */}
      {onlineSession && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-white space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    onlineSession.paymentMethod === 'GPAY'
                      ? 'bg-emerald-600 text-white'
                      : onlineSession.paymentMethod === 'PAYPAL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {onlineSession.paymentMethod === 'GPAY'
                      ? 'India Google Pay / UPI Online Gateway'
                      : onlineSession.paymentMethod === 'PAYPAL'
                      ? 'PayPal International Online Checkout'
                      : 'Vodafone Fiji M-PAiSA Online Gateway'}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Order Ref: {onlineSession.gatewayOrderId} • {onlineSession.environment.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnlineSession(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-bold">Total Payable Now</div>
                <div className="text-lg font-black text-amber-400">
                  {currencySymbol}
                  {onlineSession.amount.toFixed(2)} {onlineSession.currency}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-300">
                <div className="font-bold">
                  {onlineSession.merchantName ||
                    onlineSession.businessName ||
                    onlineSession.mpaisaName ||
                    'ASTRO SIVAM'}
                </div>
                <div className="text-[10px] text-emerald-400">256-bit Encrypted Session</div>
              </div>
            </div>

            {/* Method-Specific Online Action */}
            {onlineSession.paymentMethod === 'GPAY' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="font-bold text-emerald-300">
                    Google Pay / UPI Instant Authorization ({onlineSession.upiId})
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Tap below to launch Google Pay / UPI on your device, or authorize this online gateway session directly.
                  </p>
                  {onlineSession.upiUri && (
                    <a
                      href={onlineSession.upiUri}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Launch Google Pay / UPI App</span>
                    </a>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Razorpay will return the signed payment proof automatically. A UTR entered here cannot authorize an online payment:
                  </label>
                  <input
                    type="text"
                    value={onlinePayerInput}
                    onChange={e => setOnlinePayerInput(e.target.value)}
                    placeholder="Use the Razorpay checkout above"
                    disabled
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {onlineSession.paymentMethod === 'PAYPAL' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                  <div className="font-bold text-blue-300">
                    PayPal Express &amp; International Card Gateway
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Merchant Account: <strong className="font-mono">{onlineSession.paypalEmail}</strong>
                  </p>
                  {onlineSession.approvalUrl && (
                    <a
                      href={onlineSession.approvalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open PayPal Checkout Window</span>
                    </a>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    PayPal order ID (leave the generated value unless PayPal gives you a different order ID):
                  </label>
                  <input
                    type="text"
                    value={onlinePayerInput}
                    onChange={e => setOnlinePayerInput(e.target.value)}
                    placeholder={onlineSession.gatewayOrderId}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            {onlineSession.paymentMethod === 'MPAISA' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                  <div className="font-bold text-red-300">
                    Vodafone Fiji M-PAiSA Online E-Commerce Checkout
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Merchant: <strong>{onlineSession.mpaisaName}</strong> ({onlineSession.mpaisaNumber})
                  </p>
                  {onlineSession.checkoutUrl && (
                    <a
                      href={onlineSession.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Vodafone Fiji M-PAiSA Portal</span>
                    </a>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Enter Your +679 M-PAiSA Mobile or MP Receipt ID (Optional):
                  </label>
                  <input
                    type="text"
                    value={onlinePayerInput}
                    onChange={e => setOnlinePayerInput(e.target.value)}
                    placeholder="e.g. +679 999 0000 or MP-849201"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isVerifyingOnline}
                onClick={handleConfirmOnlinePayment}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                {isVerifyingOnline ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize &amp; Verify Online Payment</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setOnlineSession(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
