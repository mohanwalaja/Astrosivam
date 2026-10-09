import React, { useCallback, useState } from 'react';
import { AlertCircle, Eye, Loader2 } from 'lucide-react';
import { AppLanguage, ServiceType } from '../../types';
import { LivePdfPreviewModal } from './LivePdfPreviewModal';
import {
  calculateSampleResult,
  SAMPLE_BIRTH_LABEL,
  SampleServiceType
} from '../../services/sampleReports';

export interface SampleReportButtonProps {
  /** Which fixed sample report to open. */
  serviceType: SampleServiceType;
  /** Initial PDF language; the visitor can still switch in the viewer. */
  language?: AppLanguage;
  /** Extra classes for the button (each service page styles it to match). */
  className?: string;
  /** Button text — defaults to "View Sample Report (PDF)". */
  label?: string;
  /** Text shown while the fixed sample is being calculated. */
  loadingLabel?: string;
  /** Optional short helper line rendered under the button. */
  helperText?: string;
}

/**
 * "See the report before you order" button.
 *
 * It calculates the ONE fixed sample report for the service (01 Jan 2000,
 * 2:00 AM, Chennai — no user choice anywhere), then opens the same
 * high-resolution live preview + download modal the real reports use.
 * Every page carries a light "SAMPLE" watermark.
 */
export const SampleReportButton: React.FC<SampleReportButtonProps> = ({
  serviceType,
  language = 'en',
  className,
  label = 'View Sample Report (PDF)',
  loadingLabel = 'Preparing sample…',
  helperText
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const openSample = useCallback(async () => {
    setError('');
    // The fixed sample is cached after the first calculation — reopen instantly.
    if (result) {
      setIsOpen(true);
      return;
    }
    setIsLoading(true);
    try {
      const sample = await calculateSampleResult(serviceType);
      setResult(sample);
      setIsOpen(true);
    } catch (sampleError: any) {
      // Keep the technical reason in the console; show the visitor a calm note.
      console.error('[ASTRO SIVAM] Sample report could not be prepared:', sampleError);
      setError('The sample report is temporarily unavailable. Please try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  }, [result, serviceType]);

  return (
    <>
      <button
        type="button"
        onClick={openSample}
        disabled={isLoading}
        title={`Open a full sample report built from fixed example details (${SAMPLE_BIRTH_LABEL}) — no customer data is used`}
        className={
          className ||
          'inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60 cursor-pointer'
        }
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        <span>{isLoading ? loadingLabel : label}</span>
      </button>

      {helperText && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{helperText}</p>
      )}

      {error && (
        <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <LivePdfPreviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        serviceType={serviceType as ServiceType}
        result={result}
        initialLang={language}
        sourceContext="user_testing"
        sampleMode
      />
    </>
  );
};
