import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Sliders,
  Smartphone,
  Globe,
  QrCode,
  KeyRound,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { AppSettings, PaymentGatewayMode, IndiaGpayOnlineProvider } from '../../types';

interface PaymentConfigPanelProps {
  settings: AppSettings | null;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const PaymentConfigPanel: React.FC<PaymentConfigPanelProps> = ({ settings, onUpdateSettings }) => {
  const [formData, setFormData] = useState({
    // 1. India Google Pay (GPay) — Offline & Online
    indiaGpayActive: settings?.indiaGpayActive ?? true,
    indiaGpayPaymentMode: (settings?.indiaGpayPaymentMode || 'offline') as PaymentGatewayMode,
    indiaGpayUpiId: settings?.indiaGpayUpiId || 'astrosivam@okaxis',
    indiaGpayNumber: settings?.indiaGpayNumber || '+91 98410 78901',
    indiaGpayName: settings?.indiaGpayName || 'ASTRO SIVAM',
    indiaGpayQrUrl: settings?.indiaGpayQrUrl || '',
    indiaGpayInstructions:
      settings?.indiaGpayInstructions ||
      'Send payment via Google Pay (GPay) or any UPI app to the UPI ID or mobile number above. Quote your Order Number in the payment note.',
    indiaGpayOnlineProvider: (settings?.indiaGpayOnlineProvider || 'razorpay') as IndiaGpayOnlineProvider,
    indiaGpayMerchantId: settings?.indiaGpayMerchantId || '',
    indiaGpayKeyId: settings?.indiaGpayKeyId || '',
    indiaGpayKeySecret: settings?.indiaGpayKeySecret || '',
    indiaGpayWebhookSecret: settings?.indiaGpayWebhookSecret || '',
    indiaGpayEnvironment: (settings?.indiaGpayEnvironment || 'sandbox') as 'sandbox' | 'live',

    // 2. International PayPal — Offline & Online
    paypalActive: settings?.paypalActive ?? true,
    paypalPaymentMode: (settings?.paypalPaymentMode || 'offline') as PaymentGatewayMode,
    paypalEmail: settings?.paypalEmail || 'payments@astrosivam.com',
    paypalBusinessName: settings?.paypalBusinessName || 'ASTRO SIVAM GLOBAL SERVICES',
    paypalMeLink: settings?.paypalMeLink || '',
    paypalInstructions:
      settings?.paypalInstructions ||
      'Pay securely via PayPal to payments@astrosivam.com or credit/debit card. Include your Order Number in the PayPal note.',
    paypalClientId: settings?.paypalClientId || '',
    paypalClientSecret: settings?.paypalClientSecret || settings?.paypalSecret || '',
    paypalWebhookId: settings?.paypalWebhookId || '',
    paypalMode: (settings?.paypalMode || 'sandbox') as 'sandbox' | 'live',

    // 3. Fiji Vodafone M-PAiSA — Offline & Online
    vodafoneMPaisaActive: settings?.vodafoneMPaisaActive ?? true,
    vodafoneMPaisaPaymentMode: 'offline' as PaymentGatewayMode,
    vodafoneMPaisaNumber: settings?.vodafoneMPaisaNumber || '+679 999 1234',
    vodafoneMPaisaName: settings?.vodafoneMPaisaName || 'ASTRO SIVAM SERVICES',
    vodafoneMPaisaMerchantCode: settings?.vodafoneMPaisaMerchantCode || '',
    vodafoneMPaisaQrUrl: settings?.vodafoneMPaisaQrUrl || '',
    vodafoneMPaisaInstructions:
      settings?.vodafoneMPaisaInstructions ||
      'Send payment via Vodafone M-PAiSA app or USSD *555#. Enter your Order Number in the message description.',
    vodafoneMPaisaMerchantId: settings?.vodafoneMPaisaMerchantId || '',
    vodafoneMPaisaApiSecret: settings?.vodafoneMPaisaApiSecret || '',
    vodafoneMPaisaApiUrl: settings?.vodafoneMPaisaApiUrl || 'https://pay.mpaisa.vodafone.com.fj/API/',
    vodafoneMPaisaEnvironment: (settings?.vodafoneMPaisaEnvironment || 'sandbox') as 'sandbox' | 'live',

    currencyFiji: settings?.currencyFiji || 'FJD',
    currencyIntl: settings?.currencyIntl || 'USD',
    currencyIndia: settings?.currencyIndia || 'INR'
  });

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        indiaGpayActive: settings.indiaGpayActive ?? prev.indiaGpayActive,
        indiaGpayPaymentMode: (settings.indiaGpayPaymentMode || prev.indiaGpayPaymentMode || 'offline') as PaymentGatewayMode,
        indiaGpayUpiId: settings.indiaGpayUpiId ?? prev.indiaGpayUpiId,
        indiaGpayNumber: settings.indiaGpayNumber ?? prev.indiaGpayNumber,
        indiaGpayName: settings.indiaGpayName ?? prev.indiaGpayName,
        indiaGpayQrUrl: settings.indiaGpayQrUrl ?? prev.indiaGpayQrUrl,
        indiaGpayInstructions: settings.indiaGpayInstructions ?? prev.indiaGpayInstructions,
        indiaGpayOnlineProvider: (settings.indiaGpayOnlineProvider || prev.indiaGpayOnlineProvider || 'razorpay') as IndiaGpayOnlineProvider,
        indiaGpayMerchantId: settings.indiaGpayMerchantId ?? prev.indiaGpayMerchantId,
        indiaGpayKeyId: settings.indiaGpayKeyId ?? prev.indiaGpayKeyId,
        indiaGpayKeySecret: settings.indiaGpayKeySecret ?? prev.indiaGpayKeySecret,
        indiaGpayWebhookSecret: settings.indiaGpayWebhookSecret ?? prev.indiaGpayWebhookSecret,
        indiaGpayEnvironment: (settings.indiaGpayEnvironment || prev.indiaGpayEnvironment || 'sandbox') as 'sandbox' | 'live',

        paypalActive: settings.paypalActive ?? prev.paypalActive,
        paypalPaymentMode: (settings.paypalPaymentMode || prev.paypalPaymentMode || 'offline') as PaymentGatewayMode,
        paypalEmail: settings.paypalEmail ?? prev.paypalEmail,
        paypalBusinessName: settings.paypalBusinessName ?? prev.paypalBusinessName,
        paypalMeLink: settings.paypalMeLink ?? prev.paypalMeLink,
        paypalInstructions: settings.paypalInstructions ?? prev.paypalInstructions,
        paypalClientId: settings.paypalClientId ?? prev.paypalClientId,
        paypalClientSecret: settings.paypalClientSecret ?? settings.paypalSecret ?? prev.paypalClientSecret,
        paypalWebhookId: settings.paypalWebhookId ?? prev.paypalWebhookId,
        paypalMode: (settings.paypalMode || prev.paypalMode || 'sandbox') as 'sandbox' | 'live',

        vodafoneMPaisaActive: settings.vodafoneMPaisaActive ?? prev.vodafoneMPaisaActive,
        vodafoneMPaisaPaymentMode: 'offline' as PaymentGatewayMode,
        vodafoneMPaisaNumber: settings.vodafoneMPaisaNumber ?? prev.vodafoneMPaisaNumber,
        vodafoneMPaisaName: settings.vodafoneMPaisaName ?? prev.vodafoneMPaisaName,
        vodafoneMPaisaMerchantCode: settings.vodafoneMPaisaMerchantCode ?? prev.vodafoneMPaisaMerchantCode,
        vodafoneMPaisaQrUrl: settings.vodafoneMPaisaQrUrl ?? prev.vodafoneMPaisaQrUrl,
        vodafoneMPaisaInstructions: settings.vodafoneMPaisaInstructions ?? prev.vodafoneMPaisaInstructions,
        vodafoneMPaisaMerchantId: settings.vodafoneMPaisaMerchantId ?? prev.vodafoneMPaisaMerchantId,
        vodafoneMPaisaApiSecret: settings.vodafoneMPaisaApiSecret ?? prev.vodafoneMPaisaApiSecret,
        vodafoneMPaisaApiUrl: settings.vodafoneMPaisaApiUrl ?? prev.vodafoneMPaisaApiUrl,
        vodafoneMPaisaEnvironment: (settings.vodafoneMPaisaEnvironment || prev.vodafoneMPaisaEnvironment || 'sandbox') as 'sandbox' | 'live',

        currencyFiji: settings.currencyFiji || prev.currencyFiji,
        currencyIntl: settings.currencyIntl || prev.currencyIntl,
        currencyIndia: settings.currencyIndia || prev.currencyIndia
      }));
    }
  }, [settings]);

  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ method: string; message: string; success: boolean } | null>(null);
  const [testingMethod, setTestingMethod] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<'MPAISA' | 'GPAY' | 'PAYPAL' | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSecrets, setShowSecrets] = useState<{ gpay: boolean; paypal: boolean; mpaisa: boolean }>({
    gpay: false,
    paypal: false,
    mpaisa: false
  });

  const persistSettings = async (nextData: typeof formData, customMsg?: string) => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const {
        indiaGpayKeySecret,
        indiaGpayWebhookSecret,
        paypalClientSecret,
        vodafoneMPaisaApiSecret,
        ...nonSecretSettings
      } = nextData;
      await onUpdateSettings({
        ...nonSecretSettings,
        vodafoneMPaisaPaymentMode: 'offline',
        ...(indiaGpayKeySecret.trim() ? { indiaGpayKeySecret } : {}),
        ...(indiaGpayWebhookSecret.trim() ? { indiaGpayWebhookSecret } : {}),
        ...(paypalClientSecret.trim() ? { paypalClientSecret, paypalSecret: paypalClientSecret } : {}),
        ...(vodafoneMPaisaApiSecret.trim() ? { vodafoneMPaisaApiSecret } : {})
      });
      setSaveMessage(
        customMsg ||
          'Payment settings saved. Online captures are server-verified only for configured Razorpay and PayPal; M-PAiSA remains manual.'
      );
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettings(formData);
  };

  const handleSetAllModes = async (mode: PaymentGatewayMode) => {
    const updated = {
      ...formData,
      indiaGpayPaymentMode: mode,
      paypalPaymentMode: mode,
      // M-PAiSA currently has no server-side online payment/capture flow.
      vodafoneMPaisaPaymentMode: mode === 'online' ? 'offline' as const : mode
    };
    setFormData(updated);
    await persistSettings(
      updated,
      mode === 'offline'
        ? 'All gateways are in manual mode. Receipt verification remains an administrator task.'
        : 'Razorpay/PayPal are set to online mode where valid credentials are configured. M-PAiSA remains manual because its online capture integration is not implemented.'
    );
  };

  const handleToggleSingleMode = async (
    gateway: 'GPAY' | 'PAYPAL' | 'MPAISA',
    mode: PaymentGatewayMode
  ) => {
    if (gateway === 'MPAISA' && mode === 'online') {
      setSaveMessage('Automated M-PAiSA checkout is not implemented yet. Keep it in manual mode and verify receipts with your provider.');
      return;
    }
    const updated = {
      ...formData,
      ...(gateway === 'GPAY' ? { indiaGpayPaymentMode: mode } : {}),
      ...(gateway === 'PAYPAL' ? { paypalPaymentMode: mode } : {}),
      ...(gateway === 'MPAISA' ? { vodafoneMPaisaPaymentMode: mode } : {})
    };
    setFormData(updated);
    const label =
      gateway === 'GPAY'
        ? 'India Google Pay (GPay)'
        : gateway === 'PAYPAL'
        ? 'International PayPal'
        : 'Fiji Vodafone M-PAiSA';
    await persistSettings(
      updated,
      `${label} switched to ${mode.toUpperCase()} Mode and saved!`
    );
  };

  const handleTestPayment = async (method: 'MPAISA' | 'GPAY' | 'PAYPAL') => {
    setTestingMethod(method);
    setTestResult(null);
    try {
      const res = await api.testPaymentConfig(method, {
        ...formData,
        paypalSecret: formData.paypalClientSecret
      });
      setTestResult({
        method,
        message: res.message,
        success: res.success
      });
    } catch (err: any) {
      setTestResult({
        method,
        message: err.message || 'Payment test failed',
        success: false
      });
    } finally {
      setTestingMethod(null);
    }
  };

  const allOffline =
    formData.indiaGpayPaymentMode === 'offline' &&
    formData.paypalPaymentMode === 'offline' &&
    formData.vodafoneMPaisaPaymentMode === 'offline';
  const allOnline =
    formData.indiaGpayPaymentMode === 'online' &&
    formData.paypalPaymentMode === 'online' &&
    formData.vodafoneMPaisaPaymentMode === 'online';

  return (
    <div className="space-y-6 select-none">
      {/* Top Banner & Master Offline / Online Decision Center */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Dual-Mode Payment Gateway Control Center</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              India GPay • International PayPal • Fiji Vodafone M-PAiSA
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Both <strong>Offline (Manual Transfer &amp; Receipt)</strong> and <strong>Online (Automated Gateway Checkout)</strong> configurations are kept for all 3 gateways. Decide which mode each gateway runs in below.
            </p>
          </div>

          {/* Bulk Quick Switch Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetAllModes('offline')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                allOffline
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Use Offline for All 3 (Until Setup)</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSetAllModes('online')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                allOnline
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Use Online for All 3 (Full Live)</span>
            </button>
          </div>
        </div>

        {/* 3-Card Quick Mode Switcher Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Card 1: India GPay */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">
                  1
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">India GPay / UPI</div>
                  <div className="text-[10px] text-slate-500">Settlement: ₹ INR</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  formData.indiaGpayPaymentMode === 'online'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}
              >
                {formData.indiaGpayPaymentMode === 'online' ? (
                  <>
                    <Wifi className="w-2.5 h-2.5" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleToggleSingleMode('GPAY', 'offline')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.indiaGpayPaymentMode === 'offline'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Offline Mode
              </button>
              <button
                type="button"
                onClick={() => handleToggleSingleMode('GPAY', 'online')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.indiaGpayPaymentMode === 'online'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Online Mode
              </button>
            </div>
          </div>

          {/* Card 2: International PayPal */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-[11px] flex items-center justify-center">
                  2
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">International PayPal</div>
                  <div className="text-[10px] text-slate-500">Settlement: US$ USD</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  formData.paypalPaymentMode === 'online'
                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}
              >
                {formData.paypalPaymentMode === 'online' ? (
                  <>
                    <Wifi className="w-2.5 h-2.5" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleToggleSingleMode('PAYPAL', 'offline')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.paypalPaymentMode === 'offline'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Offline Mode
              </button>
              <button
                type="button"
                onClick={() => handleToggleSingleMode('PAYPAL', 'online')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.paypalPaymentMode === 'online'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Online Mode
              </button>
            </div>
          </div>

          {/* Card 3: Fiji Vodafone M-PAiSA */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-red-600 text-white font-black text-[11px] flex items-center justify-center">
                  3
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Fiji Vodafone M-PAiSA</div>
                  <div className="text-[10px] text-slate-500">Settlement: FJ$ FJD</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  formData.vodafoneMPaisaPaymentMode === 'online'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}
              >
                {formData.vodafoneMPaisaPaymentMode === 'online' ? (
                  <>
                    <Wifi className="w-2.5 h-2.5" /> Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleToggleSingleMode('MPAISA', 'offline')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.vodafoneMPaisaPaymentMode === 'offline'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Offline Mode
              </button>
              <button
                type="button"
                onClick={() => handleToggleSingleMode('MPAISA', 'online')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  formData.vodafoneMPaisaPaymentMode === 'online'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Online Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="p-1 rounded-full bg-white dark:bg-slate-900 shrink-0">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <CreditCard className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div>
            <div className="font-bold">Gateway Verification: {testResult.method}</div>
            <div className="mt-0.5">{testResult.message}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* =====================================================================
            1. INDIA GOOGLE PAY (GPAY) / UPI — OFFLINE & ONLINE
           ===================================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                1
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. India Google Pay (GPay) &amp; UPI
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    ₹ INR Settlement
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      formData.indiaGpayPaymentMode === 'online'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    Active: {formData.indiaGpayPaymentMode === 'online' ? 'ONLINE GATEWAY' : 'OFFLINE RECEIPT'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Keep both Offline UPI/QR transfer and Online Razorpay/Cashfree/UPI API configured; switch anytime
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveGuide(activeGuide === 'GPAY' ? null : 'GPAY')}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Setup Guide</span>
              </button>
              <button
                type="button"
                onClick={() => handleTestPayment('GPAY')}
                disabled={testingMethod === 'GPAY'}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testingMethod === 'GPAY' ? 'animate-spin' : ''}`} />
                <span>Test GPay ({formData.indiaGpayPaymentMode.toUpperCase()})</span>
              </button>
            </div>
          </div>

          {activeGuide === 'GPAY' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-300">
                India Google Pay (GPay) — Offline vs Online Setup Guide
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    A. Offline Mode (Use Now Until API Setup):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>Enter your Google Pay UPI ID / VPA (e.g. <code>astrosivam@okaxis</code>) and +91 mobile number.</li>
                    <li>Customers see your UPI ID, mobile number, and an automatic scan-to-pay UPI QR code for the exact INR total.</li>
                    <li>After paying in GPay, the customer enters their 12-digit UPI Ref / UTR number for your verification.</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">
                    B. Online Mode (Switch On After Gateway Setup):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>Choose your Indian UPI gateway provider (Razorpay, Cashfree, PhonePe PG, or Direct Google Pay UPI Intent).</li>
                    <li>Enter your Merchant ID and API Key ID / Secret.</li>
                    <li>Switch the mode toggle to <strong>Online Mode</strong> — customers will pay via automated online GPay checkout with instant verification.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Dual Columns: Offline Config + Online Config */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1A. GPAY OFFLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.indiaGpayPaymentMode === 'offline'
                  ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Offline Mode Config (Manual UPI / QR &amp; UTR Receipt)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, indiaGpayPaymentMode: 'offline' })}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    formData.indiaGpayPaymentMode === 'offline'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-500/20'
                  }`}
                >
                  {formData.indiaGpayPaymentMode === 'offline' ? '● Currently Active' : 'Use Offline Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Google Pay UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayUpiId}
                    onChange={e => setFormData({ ...formData, indiaGpayUpiId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="astrosivam@okaxis"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    GPay Registered Mobile (+91)
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayNumber}
                    onChange={e => setFormData({ ...formData, indiaGpayNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="+91 98410 78901"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Payee Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayName}
                    onChange={e => setFormData({ ...formData, indiaGpayName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="ASTRO SIVAM"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Custom QR Image URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayQrUrl}
                    onChange={e => setFormData({ ...formData, indiaGpayQrUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="Leave blank for auto UPI QR generation"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Offline Payment Instructions for Indian Users
                </label>
                <textarea
                  rows={2}
                  value={formData.indiaGpayInstructions}
                  onChange={e => setFormData({ ...formData, indiaGpayInstructions: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 1B. GPAY ONLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.indiaGpayPaymentMode === 'online'
                  ? 'bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Online Mode Config (Automated GPay / UPI Gateway)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, indiaGpayPaymentMode: 'online' })}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    formData.indiaGpayPaymentMode === 'online'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/20'
                  }`}
                >
                  {formData.indiaGpayPaymentMode === 'online' ? '● Currently Active' : 'Switch to Online Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Online UPI / GPay Gateway Provider
                  </label>
                  <select
                    value={formData.indiaGpayOnlineProvider}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        indiaGpayOnlineProvider: e.target.value as IndiaGpayOnlineProvider
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="razorpay">Razorpay (GPay / UPI / Cards)</option>
                    <option value="cashfree">Cashfree Payments (UPI / GPay)</option>
                    <option value="phonepe">PhonePe Payment Gateway</option>
                    <option value="upi_intent">Direct Google Pay Business UPI Intent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Gateway Environment
                  </label>
                  <select
                    value={formData.indiaGpayEnvironment}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        indiaGpayEnvironment: e.target.value as 'sandbox' | 'live'
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="sandbox">Sandbox / Test Mode</option>
                    <option value="live">Live Production Mode</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Gateway API Key ID / App ID
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayKeyId}
                    onChange={e => setFormData({ ...formData, indiaGpayKeyId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="e.g. rzp_live_xxxxxxxxxxxx"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Gateway API Key Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.gpay ? 'text' : 'password'}
                      value={formData.indiaGpayKeySecret}
                      onChange={e => setFormData({ ...formData, indiaGpayKeySecret: e.target.value })}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                      placeholder={settings?.indiaGpayKeySecretConfigured ? 'Stored securely — leave blank to keep it' : 'Enter API Secret Key'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets(s => ({ ...s, gpay: !s.gpay }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.gpay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Merchant ID / Google Pay MCC (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayMerchantId}
                    onChange={e => setFormData({ ...formData, indiaGpayMerchantId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="MERCHANT_ID_INDIA"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Webhook Secret (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.indiaGpayWebhookSecret}
                    onChange={e => setFormData({ ...formData, indiaGpayWebhookSecret: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="whsec_..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            2. INTERNATIONAL PAYPAL & CARDS — OFFLINE & ONLINE
           ===================================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                2
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. International PayPal &amp; Credit/Debit Cards
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                    US$ USD Settlement
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      formData.paypalPaymentMode === 'online'
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    Active: {formData.paypalPaymentMode === 'online' ? 'ONLINE GATEWAY' : 'OFFLINE RECEIPT'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Keep both Offline PayPal Email/PayPal.Me transfer and Online PayPal REST Orders v2 API configured
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveGuide(activeGuide === 'PAYPAL' ? null : 'PAYPAL')}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Setup Guide</span>
              </button>
              <button
                type="button"
                onClick={() => handleTestPayment('PAYPAL')}
                disabled={testingMethod === 'PAYPAL'}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testingMethod === 'PAYPAL' ? 'animate-spin' : ''}`} />
                <span>Test PayPal ({formData.paypalPaymentMode.toUpperCase()})</span>
              </button>
            </div>
          </div>

          {activeGuide === 'PAYPAL' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <h4 className="font-bold text-blue-900 dark:text-blue-300">
                International PayPal — Offline vs Online Setup Guide
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    A. Offline Mode (Use Now Until API Setup):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>Enter your PayPal Receiver Email (e.g. <code>payments@astrosivam.com</code>) and optional <code>PayPal.Me</code> link.</li>
                    <li>International customers send the USD total to your PayPal email and paste their PayPal receipt ID at checkout.</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-blue-700 dark:text-blue-400">
                    B. Online Mode (Switch On After Developer App Setup):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>
                      Log in to{' '}
                      <a
                        href="https://developer.paypal.com"
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-blue-600 font-bold"
                      >
                        developer.paypal.com
                      </a>{' '}
                      and create a REST API App.
                    </li>
                    <li>Paste the <strong>Client ID</strong> and <strong>Secret Key</strong> below and choose Sandbox or Live.</li>
                    <li>Switch PayPal to <strong>Online Mode</strong> for instant online PayPal &amp; Card checkout.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Dual Columns: Offline Config + Online Config */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 2A. PAYPAL OFFLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.paypalPaymentMode === 'offline'
                  ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Offline Mode Config (Manual PayPal Email &amp; Receipt ID)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paypalPaymentMode: 'offline' })}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    formData.paypalPaymentMode === 'offline'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-500/20'
                  }`}
                >
                  {formData.paypalPaymentMode === 'offline' ? '● Currently Active' : 'Use Offline Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    PayPal Receiver Email
                  </label>
                  <input
                    type="email"
                    value={formData.paypalEmail}
                    onChange={e => setFormData({ ...formData, paypalEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="payments@astrosivam.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Business / Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.paypalBusinessName}
                    onChange={e => setFormData({ ...formData, paypalBusinessName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="ASTRO SIVAM GLOBAL SERVICES"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  PayPal.Me Direct Link (Optional Helper for Offline Users)
                </label>
                <input
                  type="text"
                  value={formData.paypalMeLink}
                  onChange={e => setFormData({ ...formData, paypalMeLink: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                  placeholder="https://paypal.me/astrosivam"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Offline Payment Instructions for International Users
                </label>
                <textarea
                  rows={2}
                  value={formData.paypalInstructions}
                  onChange={e => setFormData({ ...formData, paypalInstructions: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 2B. PAYPAL ONLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.paypalPaymentMode === 'online'
                  ? 'bg-blue-500/5 border-blue-500/40 ring-1 ring-blue-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Online Mode Config (Automated PayPal REST API v2)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paypalPaymentMode: 'online' })}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    formData.paypalPaymentMode === 'online'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-500/20'
                  }`}
                >
                  {formData.paypalPaymentMode === 'online' ? '● Currently Active' : 'Switch to Online Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Environment Mode
                  </label>
                  <select
                    value={formData.paypalMode}
                    onChange={e => setFormData({ ...formData, paypalMode: e.target.value as 'sandbox' | 'live' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
                  >
                    <option value="sandbox">Sandbox (Testing / No real charge)</option>
                    <option value="live">Live (Real PayPal Transactions)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    PayPal Webhook ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.paypalWebhookId}
                    onChange={e => setFormData({ ...formData, paypalWebhookId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="WH-..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  PayPal REST API Client ID
                </label>
                <input
                  type="text"
                  value={formData.paypalClientId}
                  onChange={e => setFormData({ ...formData, paypalClientId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                  placeholder="Enter PayPal Client ID"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  PayPal REST API Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.paypal ? 'text' : 'password'}
                    value={formData.paypalClientSecret}
                    onChange={e => setFormData({ ...formData, paypalClientSecret: e.target.value })}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder={settings?.paypalSecretConfigured || settings?.paypalClientSecretConfigured ? 'Stored securely — leave blank to keep it' : 'Enter PayPal Secret Key'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(s => ({ ...s, paypal: !s.paypal }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets.paypal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            3. FIJI VODAFONE M-PAiSA — OFFLINE & ONLINE
           ===================================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                3
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    3. Fiji Vodafone M-PAiSA
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-bold">
                    FJ$ FJD Settlement
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      formData.vodafoneMPaisaPaymentMode === 'online'
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    Active: {formData.vodafoneMPaisaPaymentMode === 'online' ? 'ONLINE GATEWAY' : 'OFFLINE RECEIPT'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Keep both Offline M-PAiSA App/*555# transfer and Online Vodafone Fiji E-Commerce API configured
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveGuide(activeGuide === 'MPAISA' ? null : 'MPAISA')}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Setup Guide</span>
              </button>
              <button
                type="button"
                onClick={() => handleTestPayment('MPAISA')}
                disabled={testingMethod === 'MPAISA'}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testingMethod === 'MPAISA' ? 'animate-spin' : ''}`} />
                <span>Test M-PAiSA ({formData.vodafoneMPaisaPaymentMode.toUpperCase()})</span>
              </button>
            </div>
          </div>

          {activeGuide === 'MPAISA' && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <h4 className="font-bold text-red-900 dark:text-red-300">
                Fiji Vodafone M-PAiSA — Offline vs Online Setup Guide
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <div className="font-bold text-amber-700 dark:text-amber-400">
                    A. Manual Mode (Supported Now):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px]">
                    <li>Enter your Vodafone Fiji M-PAiSA mobile number (+679) and Registered Account Name.</li>
                    <li>Users send FJ$ via the M-PAiSA App or USSD <code>*555#</code> and enter their MP Transaction ID at checkout.</li>
                  </ol>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-red-700 dark:text-red-400">
                    B. Automated Online Mode (Not Yet Available):
                  </div>
                  <p className="text-[11px]">This app does not yet create or capture M-PAiSA payments. Keep the gateway in manual mode; do not rely on the API fields below for live checkout. Verify every receipt directly with your payment provider.</p>
                </div>
              </div>
            </div>
          )}

          {/* Dual Columns: Offline Config + Online Config */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 3A. M-PAiSA OFFLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.vodafoneMPaisaPaymentMode === 'offline'
                  ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Offline Mode Config (Manual M-PAiSA App / *555# &amp; Receipt)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, vodafoneMPaisaPaymentMode: 'offline' })}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                    formData.vodafoneMPaisaPaymentMode === 'offline'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-500/20'
                  }`}
                >
                  {formData.vodafoneMPaisaPaymentMode === 'offline' ? '● Currently Active' : 'Use Offline Mode'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    M-PAiSA Mobile Number (+679)
                  </label>
                  <input
                    type="text"
                    value={formData.vodafoneMPaisaNumber}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="+679 999 1234"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Registered Account Name
                  </label>
                  <input
                    type="text"
                    value={formData.vodafoneMPaisaName}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="ASTRO SIVAM SERVICES"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Business Merchant Shortcode (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.vodafoneMPaisaMerchantCode}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaMerchantCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="e.g. 58291"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    M-PAiSA QR Image URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.vodafoneMPaisaQrUrl}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaQrUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Offline Customer Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={formData.vodafoneMPaisaInstructions}
                  onChange={e => setFormData({ ...formData, vodafoneMPaisaInstructions: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* 3B. M-PAiSA ONLINE SETTINGS */}
            <div
              className={`p-4 rounded-2xl border space-y-3.5 transition-all ${
                formData.vodafoneMPaisaPaymentMode === 'online'
                  ? 'bg-red-500/5 border-red-500/40 ring-1 ring-red-500/20'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Future API Credentials (Not Used for Checkout)
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  title="M-PAiSA online capture is not implemented yet; manual transfers remain available."
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-not-allowed opacity-60 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Automated online checkout unavailable
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Vodafone M-PAiSA Environment
                  </label>
                  <select
                    value={formData.vodafoneMPaisaEnvironment}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        vodafoneMPaisaEnvironment: e.target.value as 'sandbox' | 'live'
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="sandbox">Sandbox / Test Mode</option>
                    <option value="live">Live Production Mode</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    M-PAiSA Online Merchant ID (cID)
                  </label>
                  <input
                    type="text"
                    value={formData.vodafoneMPaisaMerchantId}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaMerchantId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder="e.g. VFJ_MERCHANT_10492"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  M-PAiSA Online API Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.mpaisa ? 'text' : 'password'}
                    value={formData.vodafoneMPaisaApiSecret}
                    onChange={e => setFormData({ ...formData, vodafoneMPaisaApiSecret: e.target.value })}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                    placeholder={settings?.vodafoneMPaisaApiSecretConfigured ? 'Stored securely — leave blank to keep it' : 'Enter Vodafone M-PAiSA API Secret'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(s => ({ ...s, mpaisa: !s.mpaisa }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecrets.mpaisa ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Vodafone M-PAiSA Gateway Endpoint URL
                </label>
                <input
                  type="text"
                  value={formData.vodafoneMPaisaApiUrl}
                  onChange={e => setFormData({ ...formData, vodafoneMPaisaApiUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono"
                  placeholder="https://pay.mpaisa.vodafone.com.fj/API/"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-[11px] text-slate-500">
            Both Offline and Online configurations are saved simultaneously. Only the selected Active Mode is shown to customers at checkout.
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSaving ? 'Saving All 3 Gateways...' : 'Save Payment Configurations'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
