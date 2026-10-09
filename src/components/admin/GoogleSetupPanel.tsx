import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Save,
  ShieldCheck,
  Globe,
  Settings,
  HelpCircle
} from 'lucide-react';
import { GoogleLoginButton } from '../common/GoogleLoginButton';

export const GoogleSetupPanel: React.FC = () => {
  const { settings, refreshSettings } = useAuth();

  const [enabled, setEnabled] = useState<boolean>(settings?.googleLoginEnabled !== false);
  const [clientId, setClientId] = useState<string>(settings?.googleClientId || '');

  useEffect(() => {
    if (settings) {
      if (settings.googleLoginEnabled !== undefined) setEnabled(settings.googleLoginEnabled);
      if (settings.googleClientId !== undefined) setClientId(settings.googleClientId);
    }
  }, [settings]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isConfigured = Boolean(clientId && clientId.trim().length > 10);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess('');
    setSaveError('');
    setIsSaving(true);

    try {
      const res = await api.updateAdminSettings({
        googleLoginEnabled: enabled,
        googleClientId: clientId.trim()
      });

      if (res.success) {
        setSaveSuccess('Google Sign-In settings saved successfully!');
        await refreshSettings();
        setTimeout(() => setSaveSuccess(''), 4000);
      } else {
        setSaveError(res.message || 'Failed to save settings.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error updating Google settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Detect current domain for helper copy
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://astrosivam.com';

  return (
    <div className="space-y-8 select-none">
      
      {/* Panel Header */}
      <div className="bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white p-3 flex items-center justify-center shadow-lg shrink-0">
              <svg className="w-full h-full" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">
                  Google Sign-In Integration
                </h2>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                    isConfigured && enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isConfigured && enabled ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active & Ready</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      <span>Setup Required</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Empower users to log in seamlessly with 1-click using their Google credentials across Fiji, Australia, New Zealand, USA, and worldwide.
              </p>
            </div>
          </div>

          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border border-white/10"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Google Cloud Credentials</span>
          </a>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Grid: Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left 7 Columns: Credentials Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Google OAuth Client Credentials
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure your Google Cloud Web Application Client ID
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enable Google Login
              </span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Google Web Client ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="e.g. 104829103849-ab34cdef...apps.googleusercontent.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Generated in Google Cloud Console &gt; APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client IDs.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Status: {isConfigured ? (
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">Client ID Configured</strong>
                ) : (
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">Awaiting Client ID</strong>
                )}
              </span>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>

          {/* Quick Domain Copy Helper Box */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Globe className="w-4 h-4 text-amber-500" />
              <span>Copy Values for Google Cloud Console</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">
                  1. Authorized JavaScript Origins
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentOrigin}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(currentOrigin, 'origin')}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'origin' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-0.5">
                  2. Production Web Domain
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://astrosivam.com"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy('https://astrosivam.com', 'prod')}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'prod' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Live Button Preview & Testing */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Google Button Preview
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This interactive button dynamically reflects your Google Sign-In state. Click it to test the authentication flow or 1-click test login.
            </p>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <GoogleLoginButton
                mode="signin"
                onSuccess={() => alert('Google Sign-In test succeeded!')}
                onError={err => alert('Google error: ' + err)}
              />
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Supports Google Identity Services (GSI)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Automatic Kundali &amp; Birth Profile Initialization</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Production Ready for Domain Deployment</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Step-by-Step Setup Guide */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            5-Minute Google Cloud Console Setup Guide
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
              1
            </span>
            <h4 className="font-bold text-slate-800 dark:text-slate-200">
              Configure OAuth Consent Screen
            </h4>
            <p className="leading-relaxed text-[11px]">
              Go to Google Cloud Console &gt; APIs &amp; Services &gt; OAuth consent screen. Select "External". Enter App Name (e.g. <strong>ASTRO SIVAM</strong>), User support email (<strong>Mohanwalaja@gmail.com</strong>), and developer email.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
              2
            </span>
            <h4 className="font-bold text-slate-800 dark:text-slate-200">
              Create Web Client ID
            </h4>
            <p className="leading-relaxed text-[11px]">
              Navigate to "Credentials" &gt; "+ Create Credentials" &gt; "OAuth client ID". Choose Application type: <strong>Web application</strong>. Add your domain under "Authorized JavaScript origins".
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
              3
            </span>
            <h4 className="font-bold text-slate-800 dark:text-slate-200">
              Save Client ID in Admin Portal
            </h4>
            <p className="leading-relaxed text-[11px]">
              Copy the resulting Client ID (ends with <code className="font-mono text-amber-600 dark:text-amber-400">.apps.googleusercontent.com</code>) and paste it into the field above, then click <strong>Save Settings</strong>.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
