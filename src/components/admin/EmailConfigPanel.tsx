import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, RefreshCw, Edit3, Save, ShieldCheck, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { AppSettings, EmailTemplate } from '../../types';

interface EmailConfigPanelProps {
  settings: AppSettings | null;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const EmailConfigPanel: React.FC<EmailConfigPanelProps> = ({ settings, onUpdateSettings }) => {
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: settings?.emailSettings?.smtpHost || '',
    smtpPort: settings?.emailSettings?.smtpPort || 587,
    smtpUsername: settings?.emailSettings?.smtpUsername || '',
    smtpPassword: '',
    tlsSecure: settings?.emailSettings?.tlsSecure ?? false,
    senderName: settings?.emailSettings?.senderName || 'ASTRO SIVAM Desk',
    senderEmail: settings?.emailSettings?.senderEmail || 'admin@astrosivam.com',
    replyTo: settings?.emailSettings?.replyTo || 'admin@astrosivam.com'
  });

  const [testRecipient, setTestRecipient] = useState(settings?.emailSettings?.senderEmail || 'admin@astrosivam.com');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>(settings?.emailTemplates || []);

  useEffect(() => {
    if (settings) {
      if (settings.emailSettings) {
        setEmailSettings(prev => ({
          ...prev,
          smtpHost: settings.emailSettings?.smtpHost ?? '',
          smtpPort: settings.emailSettings?.smtpPort ?? 587,
          smtpUsername: settings.emailSettings?.smtpUsername ?? '',
          // Passwords are never sent back by the admin API. Leave this field
          // blank to keep the saved app password, or type a replacement.
          smtpPassword: '',
          tlsSecure: settings.emailSettings?.tlsSecure ?? false,
          senderName: settings.emailSettings?.senderName ?? prev.senderName,
          senderEmail: settings.emailSettings?.senderEmail ?? prev.senderEmail,
          replyTo: settings.emailSettings?.replyTo ?? prev.replyTo
        }));
        if (settings.emailSettings?.senderEmail) {
          setTestRecipient(settings.emailSettings.senderEmail);
        }
      }
      if (settings.emailTemplates && settings.emailTemplates.length > 0) {
        setTemplates(settings.emailTemplates);
      }
    }
  }, [settings]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templates[0]?.key || 'REPORT_READY');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(
    templates[0] || {
      id: '1',
      key: 'REPORT_READY',
      name: 'Report Ready & PDF Delivery',
      subject: 'Your Certified Vedic Astrology Report & Invoice - ASTRO SIVAM [{orderNumber}]',
      bodyText: 'Dear {userName},\n\nYour order for {serviceName} has been approved and completed. Your official Vedic Astrology Report PDF and your Tax Invoice Bill PDF are attached directly to this email.\n\nNote: For your privacy, documents are delivered directly via email attachments and not stored on web servers. No download link is required. Please save the attached PDF files directly to your device.\n\nOrder Number: {orderNumber}\nAmount: {currency} {amount}\nStatus: COMPLETED\n\nWarm regards,\nASTRO SIVAM Team',
      isActive: true,
      lastModified: new Date().toISOString()
    }
  );

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const found = templates.find(t => t.key === key);
    if (found) {
      setSelectedTemplate(found);
    }
  };

  const handleSaveSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSettings({
        emailSettings: {
          ...settings?.emailSettings,
          smtpHost: emailSettings.smtpHost.trim(),
          smtpPort: emailSettings.smtpPort,
          smtpUsername: emailSettings.smtpUsername.trim(),
          ...(emailSettings.smtpPassword.trim() ? { smtpPassword: emailSettings.smtpPassword.trim() } : {}),
          tlsSecure: emailSettings.tlsSecure,
          senderName: emailSettings.senderName.trim(),
          senderEmail: emailSettings.senderEmail.trim(),
          replyTo: emailSettings.replyTo.trim()
        },
        emailTemplates: templates
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsSendingTest(true);
    setTestMessage(null);
    try {
      const res = await api.testEmailConfig(testRecipient);
      setTestMessage({
        success: res.success,
        text: res.message
      });
    } catch (err: any) {
      setTestMessage({
        success: false,
        text: err.message || 'Failed to dispatch test email'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleUpdateCurrentTemplate = (field: 'subject' | 'bodyText', val: string) => {
    const updated = { ...selectedTemplate, [field]: val, lastModified: new Date().toISOString() };
    setSelectedTemplate(updated);
    setTemplates(prev => prev.map(t => (t.key === updated.key ? updated : t)));
  };

  return (
    <div className="space-y-6 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Mail className="w-3.5 h-3.5" />
            <span>Email Delivery System</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            SMTP Configuration & Lifecycle Email Templates
          </h2>
          <p className="text-xs text-slate-500">
            Manage automated notifications, PDF report dispatches, and cancellation/refund email templates.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Email settings and template modifications saved successfully!</span>
        </div>
      )}

      {/* Direct Attachment & Completed Order Policy Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-950 dark:text-blue-200">
        <Mail className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-blue-900 dark:text-blue-100 text-sm">
            Direct Attachment Delivery & Privacy Policy
          </div>
          <p className="leading-relaxed text-slate-700 dark:text-slate-300">
            Upon admin approval, both the <strong>Astrological Report PDF</strong> and the <strong>Tax Invoice Bill PDF</strong> are automatically attached directly to the fulfillment email sent to the user. No server download links are included in the email body, eliminating server hosting storage overhead and protecting personal chart privacy. Once the email with both PDFs is dispatched, the order is marked as <strong>COMPLETED</strong>.
          </p>
        </div>
      </div>

      {/* SMTP Server Configuration */}
      <form onSubmit={handleSaveSMTP} className="space-y-6">
        
        {/* BigRock cPanel Email Deliverability & Anti-Spam Guidance */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100 text-sm">
            <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
            <span>BigRock cPanel Email Deliverability & Spam Prevention Advice</span>
          </div>
          <p className="leading-relaxed">
            If outgoing emails from <strong>admin@astrosivam.com</strong> land in Spam/Junk:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 pl-1">
            <li><strong>Enable SPF & DKIM:</strong> In BigRock cPanel → <em>Email Deliverability</em> → Manage <code>astrosivam.com</code> → Click <em>&quot;Install Suggested Record&quot;</em> for DKIM &amp; SPF.</li>
            <li><strong>Add DMARC TXT Record:</strong> In cPanel <em>Zone Editor</em>, add a TXT record for <code>_dmarc.astrosivam.com</code> with value: <code>v=DMARC1; p=none; rua=mailto:admin@astrosivam.com</code>.</li>
            <li><strong>Advise Customers:</strong> The app now advises customers on their dashboard and order success screens to check their Spam/Junk folder and click <em>&quot;Not Spam&quot;</em> / add <code>admin@astrosivam.com</code> to safe contacts.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" />
              <span>Outgoing SMTP Server (PHP SMTP / BigRock Mail Server)</span>
            </h3>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              settings?.emailSettings?.status === 'TEST_SUCCESSFUL'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : settings?.emailSettings?.status === 'FAILED'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  : settings?.emailSettings?.smtpPasswordConfigured
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
              {settings?.emailSettings?.status === 'TEST_SUCCESSFUL'
                ? 'Test passed'
                : settings?.emailSettings?.status === 'FAILED'
                  ? 'Test failed'
                  : settings?.emailSettings?.smtpPasswordConfigured
                    ? 'Configured — not tested'
                    : 'Not configured'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">SMTP Host</label>
              <input
                type="text"
                value={emailSettings.smtpHost}
                onChange={e => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="smtp.gmail.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">SMTP Port</label>
              <input
                type="number"
                value={emailSettings.smtpPort}
                onChange={e => setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">SMTP Authentication Username</label>
              <input
                type="text"
                autoComplete="username"
                value={emailSettings.smtpUsername}
                onChange={e => setEmailSettings({ ...emailSettings, smtpUsername: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="mailbox login name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sender Display Name</label>
              <input
                type="text"
                value={emailSettings.senderName}
                onChange={e => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sender Email Address</label>
              <input
                type="email"
                value={emailSettings.senderEmail}
                onChange={e => setEmailSettings({ ...emailSettings, senderEmail: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">SMTP App Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={emailSettings.smtpPassword}
                onChange={e => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder={settings?.emailSettings?.smtpPasswordConfigured ? 'Leave blank to keep saved password' : 'Enter SMTP app password'}
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={emailSettings.tlsSecure}
                onChange={e => setEmailSettings({ ...emailSettings, tlsSecure: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Use implicit TLS (usually port 465; port 587 uses STARTTLS)</span>
            </label>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reply-To Address</label>
              <input
                type="email"
                value={emailSettings.replyTo}
                onChange={e => setEmailSettings({ ...emailSettings, replyTo: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Test Email Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                placeholder="Test email address"
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white w-full sm:w-64"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isSendingTest}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>{isSendingTest ? 'Sending...' : 'Send Test Email'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save SMTP Settings'}</span>
            </button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${testMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {testMessage.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{testMessage.text}</span>
            </div>
          )}
        </div>
      </form>

      {/* Email Templates Editor */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Order Lifecycle Email Templates ({templates.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Customise automatic message content and subject lines</span>
          </div>
        </div>

        {/* Template Selector Tabs */}
        <div className="flex flex-wrap gap-2">
          {templates.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelectTemplate(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedTemplateKey === t.key ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Template Content Editor */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Email Subject Line
            </label>
            <input
              type="text"
              value={selectedTemplate.subject}
              onChange={e => handleUpdateCurrentTemplate('subject', e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Email Body Content
            </label>
            <textarea
              rows={8}
              value={selectedTemplate.bodyText}
              onChange={e => handleUpdateCurrentTemplate('bodyText', e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-mono leading-relaxed"
            />
          </div>

          {/* Placeholders Guide */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-300">Available Placeholders:</span>
            <div className="flex flex-wrap gap-2 text-purple-600 dark:text-purple-400 font-mono">
              <span>{`{userName}`}</span>
              <span>{`{orderNumber}`}</span>
              <span>{`{serviceName}`}</span>
              <span>{`{amount}`}</span>
              <span>{`{currency}`}</span>
              <span>{`{paymentMethod}`}</span>
              <span>{`{refundReason}`}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveSMTP}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Template Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
