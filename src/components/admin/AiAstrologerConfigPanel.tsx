import React, { useState } from 'react';
import { Activity, AlertCircle, BookOpenCheck, CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { aiAstrologer } from '../../services/aiAstrologerApi';

type CheckResult = Awaited<ReturnType<typeof aiAstrologer.diagnose>>;

/** Admin status panel for the local-only, source-based astrology chat. */
export const AiAstrologerConfigPanel: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const runCheck = async () => {
    setIsChecking(true);
    setCheckError(null);
    try {
      setCheck(await aiAstrologer.diagnose());
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'The local source check could not be run.');
    } finally {
      setIsChecking(false);
    }
  };

  const registry = check?.sourceRegistry;
  const verification = registry?.byVerification;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
            <BookOpenCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">ASTRO SIVAM Source-Based Astrologer</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Replies are assembled on this server from the customer&apos;s chart and report, our curated astrology rules,
              remedies, and verified source references. The chat does not use a third-party AI service and needs no API key.
            </p>
          </div>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span><strong>Local-only mode is always on.</strong> Legacy provider settings or server keys, if any, are ignored; no outbound model request is made.</span>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          <strong>About the 224-source library:</strong> the current registry contains 224 source records, but it is a
          catalogue, not 224 complete books. Only 11 records are marked content-read; many entries contain verified
          bibliographic metadata rather than full text, and linked-not-opened items are not used as authorities. Replies
          use the local curated rule and remedy content and cite eligible sources. To search every book&apos;s actual text,
          the full rights-cleared PDF/EPUB/TXT files must first be added to a local index.
        </div>

        <button
          type="button"
          onClick={runCheck}
          disabled={isChecking}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
        >
          <Activity className={`h-3.5 w-3.5 ${isChecking ? 'animate-pulse' : ''}`} />
          {isChecking ? 'Checking local sources...' : 'Check local knowledge base'}
        </button>
      </section>

      {checkError && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          Could not check the local knowledge base: {checkError}
        </p>
      )}

      {check && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className={`flex items-center gap-2 text-sm font-bold ${check.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {check.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {check.ok
              ? 'Local source-based chat is ready. No API key or outside service is involved.'
              : `Chat setup needs attention: ${check.blocking.join(', ') || 'unknown issue'}`}
          </div>

          {registry && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Catalogue records', registry.total],
                ['Eligible Tamil references', registry.citableTamil],
                ['Text-read records', verification?.['content-read'] ?? 0],
                ['Excluded from catalogue', registry.excluded],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label === 'Catalogue records' ? <Database className="h-3 w-3" /> : null}
                    {label}
                  </div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>
          )}

          <ul className="space-y-1 text-xs font-mono">
            {check.checks.map((item) => (
              <li key={item.id} className={item.ok ? 'text-slate-600 dark:text-slate-400' : 'text-rose-600 dark:text-rose-400'}>
                {item.ok ? '✓' : '✕'} {item.label}: {item.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
