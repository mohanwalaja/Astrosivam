import React, { useEffect, useState } from 'react';
import { Bot, KeyRound, Save, Activity, CheckCircle2, AlertCircle, Trash2, ShieldCheck, ExternalLink } from 'lucide-react';
import { AppSettings, AiAstrologerConfig } from '../../types';
import { aiAstrologer } from '../../services/aiAstrologerApi';

interface AiAstrologerConfigPanelProps {
  settings: AppSettings | null;
  onUpdateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

/**
 * Any OpenAI-compatible chat/completions endpoint works. These presets only
 * fill in the base URL and a sensible default model; the admin can edit both.
 */
const PROVIDER_PRESETS: { id: string; label: string; baseUrl: string; model: string; keyUrl: string }[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys' },
];

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

type CheckResult = Awaited<ReturnType<typeof aiAstrologer.diagnose>>;

export const AiAstrologerConfigPanel: React.FC<AiAstrologerConfigPanelProps> = ({ settings, onUpdateSettings }) => {
  const stored: AiAstrologerConfig = settings?.aiAstrologerSettings || {};
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(stored.baseUrl || DEFAULT_BASE_URL);
  const [model, setModel] = useState(stored.model || DEFAULT_MODEL);
  const [maxTokens, setMaxTokens] = useState(stored.maxTokens || '900');
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const s = settings?.aiAstrologerSettings || {};
    setBaseUrl(s.baseUrl || DEFAULT_BASE_URL);
    setModel(s.model || DEFAULT_MODEL);
    setMaxTokens(s.maxTokens || '900');
  }, [settings]);

  const activePreset = PROVIDER_PRESETS.find(p => p.baseUrl === baseUrl.trim().replace(/\/+$/, ''));

  const runCheck = async () => {
    setIsChecking(true);
    setCheckError(null);
    try {
      setCheck(await aiAstrologer.diagnose(true));
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'The check could not be run.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const url = baseUrl.trim();
    if (!/^https:\/\//i.test(url)) {
      setFormError('The base URL must start with https:// (the API key is sent with every request).');
      return;
    }
    if (!stored.apiKeyConfigured && apiKey.trim().length < 8) {
      setFormError('Paste an API key to switch to AI-written replies. Without a key the chat already answers from your own sources - nothing to save.');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateSettings({
        aiAstrologerSettings: {
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          baseUrl: url.replace(/\/+$/, ''),
          model: model.trim(),
          maxTokens: String(maxTokens).trim(),
        },
      });
      setApiKey('');
      // Prove it works straight away instead of waiting for a customer to find out.
      await runCheck();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!window.confirm('Remove the stored AI Astrologer API key? The chat will stop answering unless a key is set in the server environment.')) return;
    setIsSaving(true);
    try {
      await onUpdateSettings({ aiAstrologerSettings: { clearApiKey: true } });
      setCheck(null);
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500/40 outline-none';
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">AI Astrologer Chat</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <strong>No API key is needed.</strong> Without one, the chat answers from ASTRO SIVAM&rsquo;s own sources
              only: the customer&rsquo;s report readings, the curated Tamil astrology rules and the remedies registry.
              Adding a key from an OpenAI-compatible provider is optional; it makes replies AI-written, and the chat
              falls back to your own sources if that service fails.
            </p>
          </div>
        </div>

        <div className={`mb-5 p-3 rounded-2xl border text-xs flex items-center gap-2 ${
          'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
        }`}>
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            {stored.apiKeyConfigured
              ? <>An API key is saved (ending <strong className="font-mono">{stored.apiKeyHint}</strong>). Leave the key field blank to keep it.</>
              : <>Knowledge-base mode is active: the chat replies from your own sources. You can leave this as it is &mdash; the key below is optional.</>}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <span className={labelCls}>AI provider (optional)</span>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setBaseUrl(p.baseUrl); setModel(p.model); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    activePreset?.id === p.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {activePreset && (
              <a href={activePreset.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> Get a {activePreset.label} API key
              </a>
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="ai-api-key"><KeyRound className="w-3.5 h-3.5 inline mr-1" />API key (optional)</label>
            <input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={stored.apiKeyConfigured ? 'Stored securely — leave blank to keep it' : 'Paste your API key (e.g. sk-...)'}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="ai-base-url">Base URL</label>
              <input id="ai-base-url" type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ai-model">Model</label>
              <input id="ai-model" type="text" value={model} onChange={e => setModel(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="max-w-[200px]">
            <label className={labelCls} htmlFor="ai-max-tokens">Max reply tokens</label>
            <input id="ai-max-tokens" type="number" min={100} max={4000} value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className={inputCls} />
          </div>

          {formError && <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={isSaving || isChecking} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save & test'}
            </button>
            <button type="button" onClick={runCheck} disabled={isSaving || isChecking} className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center gap-2 disabled:opacity-50">
              <Activity className={`w-3.5 h-3.5 ${isChecking ? 'animate-pulse' : ''}`} />
              {isChecking ? 'Testing...' : 'Test connection'}
            </button>
            {stored.apiKeyConfigured && (
              <button type="button" onClick={handleRemoveKey} disabled={isSaving} className="px-4 py-2.5 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Remove key
              </button>
            )}
          </div>
        </form>
      </div>

      {(check || checkError) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
          {checkError && <p className="text-xs text-rose-600 dark:text-rose-400">The test could not be run: {checkError}</p>}
          {check && (
            <>
              <div className={`flex items-center gap-2 text-sm font-bold ${check.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {check.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {check.ok
                  ? `The AI Astrologer is working. Customers will get replies (${check.mode === 'model' ? 'AI model' : 'knowledge-base mode - your own sources'}).`
                  : `Not working yet — blocked by: ${check.blocking.join(', ') || 'unknown'}`}
              </div>
              <ul className="space-y-1 text-xs font-mono">
                {check.checks.map(c => (
                  <li key={c.id} className={c.ok ? 'text-slate-600 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}>
                    {c.ok ? '✓' : '✕'} {c.label}: {c.detail}
                  </li>
                ))}
                {check.ping.attempted && (
                  <li className={check.ping.ok ? 'text-slate-600 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}>
                    {check.ping.ok ? '✓' : '✕'} Live model call: HTTP {check.ping.httpStatus} in {check.ping.latencyMs}ms{check.ping.error ? ` — ${check.ping.error}` : ''}
                  </li>
                )}
              </ul>
              {!check.ok && check.ping.attempted && (check.ping.httpStatus === 401 || check.ping.httpStatus === 403) && (
                <p className="text-xs text-slate-500">HTTP {check.ping.httpStatus} means the provider rejected the key. Check it was copied completely and belongs to the selected provider.</p>
              )}
              {!check.ok && check.ping.attempted && check.ping.httpStatus === 404 && (
                <p className="text-xs text-slate-500">HTTP 404 usually means the model name is not served by this base URL. Pick the provider again to reset both.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
