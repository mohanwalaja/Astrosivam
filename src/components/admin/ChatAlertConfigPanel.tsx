import React, { useState, useEffect } from 'react';
import { MessageCircle, Smartphone, Send, Save, CheckCircle2, AlertCircle, ShieldCheck, KeyRound, FileText, Zap } from 'lucide-react';
import { api } from '../../services/api';
import { AppSettings, ChatAlertConfig, ChatAlertChannelResult } from '../../types';

interface ChatAlertConfigPanelProps {
  settings: AppSettings | null;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_CONFIRMED = `Namaste {customer_name},

Your order {order_number} for {service_name} ({amount}) has been received successfully and is confirmed.

Status: {status}
Payment method: {payment_method}

Our astrologers will now prepare your report. You will get another alert with delivery details once it is complete.

Warm regards,
ASTRO SIVAM Team`;

const DEFAULT_COMPLETED = `Namaste {customer_name},

Great news! Your order {order_number} for {service_name} is now COMPLETE.

Your official Vedic Astrology Report PDF and Tax Invoice PDF have been emailed to {customer_email}. Please save both attachments for your records.

Thank you for choosing ASTRO SIVAM.

Warm regards,
ASTRO SIVAM Team`;

const buildDefaults = (): ChatAlertConfig => ({
  enabled: true,
  notifyOrderConfirmed: true,
  notifyOrderCompleted: true,
  whatsapp: {
    enabled: false,
    provider: 'meta',
    phoneNumberId: '',
    accessToken: '',
    apiVersion: 'v21.0',
    templateName: '',
    templateLanguage: 'en',
    webhookUrl: '',
    messageType: 'text'
  },
  viber: {
    enabled: false,
    provider: 'viber_bot',
    authToken: '',
    senderName: 'ASTRO SIVAM',
    webhookUrl: ''
  },
  orderConfirmedMessage: DEFAULT_CONFIRMED,
  orderCompletedMessage: DEFAULT_COMPLETED
});

const PLACEHOLDER_HINTS = [
  '{customer_name}', '{order_number}', '{service_name}', '{amount}',
  '{status}', '{customer_email}', '{payment_method}'
];

export const ChatAlertConfigPanel: React.FC<ChatAlertConfigPanelProps> = ({ settings, onUpdateSettings }) => {
  const [cfg, setCfg] = useState<ChatAlertConfig>(buildDefaults());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testChannels, setTestChannels] = useState<{ whatsapp: boolean; viber: boolean }>({ whatsapp: true, viber: true });
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (settings?.chatAlertSettings) {
      const s = settings.chatAlertSettings;
      const base = buildDefaults();
      setCfg({
        ...base,
        ...s,
        whatsapp: { ...base.whatsapp, ...(s.whatsapp || {}) },
        viber: { ...base.viber, ...(s.viber || {}) }
      });
    }
  }, [settings]);

  const patch = (partial: Partial<ChatAlertConfig>) => setCfg(prev => ({ ...prev, ...partial }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings({ chatAlertSettings: cfg });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setIsSendingTest(true);
    setTestMessage(null);
    try {
      const channels: Array<'whatsapp' | 'viber'> = [];
      if (testChannels.whatsapp) channels.push('whatsapp');
      if (testChannels.viber) channels.push('viber');
      const res = await api.testChatAlert(testPhone, channels.length ? channels : undefined, cfg);
      setTestMessage({ success: res.success, text: res.message });
    } catch (err: any) {
      setTestMessage({ success: false, text: err.message || 'Failed to dispatch test alert' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/40 outline-none';
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1';

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat Alerts</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            WhatsApp & Viber Order Alerts
          </h2>
          <p className="text-xs text-slate-500">
            Send automatic WhatsApp / Viber notifications to customers when an order is confirmed and when it is completed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${
            saveSuccess ? 'bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60'
          }`}
        >
          {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save Alert Settings'}
        </button>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4" /> WhatsApp & Viber alert settings saved successfully.
        </div>
      )}

      {/* Master switches */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Alert Rules</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'enabled', label: 'Enable Chat Alerts', desc: 'Master switch for all WhatsApp/Viber alerts' },
            { key: 'notifyOrderConfirmed', label: 'Order Confirmed Alert', desc: 'Sent the moment a customer places an order' },
            { key: 'notifyOrderCompleted', label: 'Order Complete Alert', desc: 'Sent when Admin approves and reports are emailed' }
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <input
                type="checkbox"
                checked={(cfg as any)[item.key] === true}
                onChange={e => patch({ [item.key]: e.target.checked } as any)}
                className="mt-1 w-4 h-4 accent-emerald-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{item.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* WhatsApp */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">WhatsApp Channel</h3>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={cfg.whatsapp.enabled}
              onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, enabled: e.target.checked } }))}
              className="w-4 h-4 accent-emerald-600"
            />
            Enable WhatsApp alerts
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Provider</label>
            <select
              value={cfg.whatsapp.provider}
              onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, provider: e.target.value as 'meta' | 'webhook' } }))}
              className={inputCls}
            >
              <option value="meta">Meta WhatsApp Cloud API (direct)</option>
              <option value="webhook">Gateway Webhook (WATI / AiSensy / Interakt / custom)</option>
            </select>
          </div>

          {cfg.whatsapp.provider === 'meta' ? (
            <>
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input
                  type="text"
                  value={cfg.whatsapp.phoneNumberId}
                  onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, phoneNumberId: e.target.value } }))}
                  placeholder="e.g. 1234567890123456"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><KeyRound className="w-3 h-3" /> Permanent Access Token</span>
                </label>
                <input
                  type="password"
                  value={cfg.whatsapp.accessToken}
                  onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, accessToken: e.target.value } }))}
                  placeholder={settings?.chatAlertSettings?.whatsapp?.accessTokenConfigured ? 'Stored securely — leave blank to keep it' : 'EAAG... (Meta Business > System User token)'}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelCls}>API Version</label>
                <input
                  type="text"
                  value={cfg.whatsapp.apiVersion}
                  onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, apiVersion: e.target.value } }))}
                  placeholder="v21.0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Message Type</label>
                <select
                  value={cfg.whatsapp.messageType}
                  onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, messageType: e.target.value as 'template' | 'text' } }))}
                  className={inputCls}
                >
                  <option value="template">Approved Template (recommended for alerts)</option>
                  <option value="text">Free-form Text (only inside 24h session window)</option>
                </select>
              </div>
              {cfg.whatsapp.messageType === 'template' && (
                <>
                  <div>
                    <label className={labelCls}>Template Name</label>
                    <input
                      type="text"
                      value={cfg.whatsapp.templateName}
                      onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, templateName: e.target.value } }))}
                      placeholder="e.g. order_update"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Template Language</label>
                    <input
                      type="text"
                      value={cfg.whatsapp.templateLanguage}
                      onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, templateLanguage: e.target.value } }))}
                      placeholder="en"
                      className={inputCls}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="md:col-span-2">
              <label className={labelCls}>Webhook URL</label>
              <input
                type="url"
                value={cfg.whatsapp.webhookUrl}
                onChange={e => setCfg(prev => ({ ...prev, whatsapp: { ...prev.whatsapp, webhookUrl: e.target.value } }))}
                placeholder={settings?.chatAlertSettings?.whatsapp?.webhookUrlConfigured ? 'Stored securely — leave blank to keep it' : 'https://your-gateway.example.com/send'}
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                The webhook receives a JSON POST: {'{ channel, event, to, message, vars }'}.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>WhatsApp policy note:</strong> proactive alerts must use an approved <em>utility template</em> (Meta Business Manager). Free-form text only works while the customer has messaged you in the last 24 hours. Template body variables are sent in this order: 1) customer name, 2) order number, 3) service name, 4) amount, 5) status.
        </div>
      </div>

      {/* Viber */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-violet-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Viber Channel</h3>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={cfg.viber.enabled}
              onChange={e => setCfg(prev => ({ ...prev, viber: { ...prev.viber, enabled: e.target.checked } }))}
              className="w-4 h-4 accent-violet-600"
            />
            Enable Viber alerts
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Provider</label>
            <select
              value={cfg.viber.provider}
              onChange={e => setCfg(prev => ({ ...prev, viber: { ...prev.viber, provider: e.target.value as 'viber_bot' | 'webhook' } }))}
              className={inputCls}
            >
              <option value="viber_bot">Viber Bot / Official PA (direct)</option>
              <option value="webhook">Business Messages Webhook (Infobip / MessageBird / custom)</option>
            </select>
          </div>

          {cfg.viber.provider === 'viber_bot' ? (
            <>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><KeyRound className="w-3 h-3" /> Auth Token</span>
                </label>
                <input
                  type="password"
                  value={cfg.viber.authToken}
                  onChange={e => setCfg(prev => ({ ...prev, viber: { ...prev.viber, authToken: e.target.value } }))}
                  placeholder={settings?.chatAlertSettings?.viber?.authTokenConfigured ? 'Stored securely — leave blank to keep it' : 'Viber Partner Auth Token'}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelCls}>Sender Name</label>
                <input
                  type="text"
                  value={cfg.viber.senderName}
                  onChange={e => setCfg(prev => ({ ...prev, viber: { ...prev.viber, senderName: e.target.value } }))}
                  placeholder="ASTRO SIVAM"
                  className={inputCls}
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className={labelCls}>Webhook URL</label>
              <input
                type="url"
                value={cfg.viber.webhookUrl}
                onChange={e => setCfg(prev => ({ ...prev, viber: { ...prev.viber, webhookUrl: e.target.value } }))}
                placeholder={settings?.chatAlertSettings?.viber?.webhookUrlConfigured ? 'Stored securely — leave blank to keep it' : 'https://your-gateway.example.com/send'}
                className={inputCls}
              />
            </div>
          )}
        </div>

        <div className="mt-4 p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-xs text-violet-800 dark:text-violet-300 leading-relaxed">
          <strong>Viber note:</strong> the direct Viber Bot API delivers to users who have interacted (subscribed) with your bot. To message any customer by phone number, use a Viber Business Messages partner and select the webhook provider.
        </div>
      </div>

      {/* Message templates */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Alert Message Templates</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Placeholders you can use:{' '}
          {PLACEHOLDER_HINTS.map(p => (
            <code key={p} className="mx-0.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400">{p}</code>
          ))}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Order Confirmed Message</label>
            <textarea
              value={cfg.orderConfirmedMessage}
              onChange={e => patch({ orderConfirmedMessage: e.target.value })}
              rows={9}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
          </div>
          <div>
            <label className={labelCls}>Order Complete Message</label>
            <textarea
              value={cfg.orderCompletedMessage}
              onChange={e => patch({ orderCompletedMessage: e.target.value })}
              rows={9}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
          </div>
        </div>
      </div>

      {/* Test alert */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-emerald-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Send Test Alert</h3>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className={labelCls}>Destination Mobile Number</label>
            <input
              type="tel"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="+679 777 1234"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-4 pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={testChannels.whatsapp}
                onChange={e => setTestChannels(prev => ({ ...prev, whatsapp: e.target.checked }))}
                className="w-4 h-4 accent-emerald-600"
              />
              WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={testChannels.viber}
                onChange={e => setTestChannels(prev => ({ ...prev, viber: e.target.checked }))}
                className="w-4 h-4 accent-violet-600"
              />
              Viber
            </label>
          </div>
          <button
            type="button"
            onClick={handleTestAlert}
            disabled={isSendingTest || !testPhone.trim()}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
          >
            <Send className="w-4 h-4" />
            {isSendingTest ? 'Sending...' : 'Send Test'}
          </button>
        </div>

        {testMessage && (
          <div className={`mt-4 flex items-start gap-2 px-4 py-3 rounded-2xl border text-sm ${
            testMessage.success
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            {testMessage.success ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <span>{testMessage.text}</span>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5" />
          <span>
            Alert credentials are stored in system settings and are never exposed publicly. Alerts are best-effort: if a chat gateway is unreachable, order processing continues unaffected and the failure is recorded in the audit log.
          </span>
        </div>
      </div>
    </div>
  );
};
