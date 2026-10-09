import React, { useId } from 'react';
import { User } from 'lucide-react';

export interface PersonNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  theme?: 'light' | 'dark';
  size?: 'md' | 'sm';
  id?: string;
  className?: string;
  helpText?: string;
  autoComplete?: string;
  maxLength?: number;
}

/** Consistent, mobile-friendly name input used by account and astrology forms. */
export const PersonNameField: React.FC<PersonNameFieldProps> = ({
  value,
  onChange,
  label = 'Full name',
  placeholder = 'Enter the name for your report',
  required = true,
  theme = 'light',
  size = 'md',
  id,
  className = '',
  helpText,
  autoComplete = 'name',
  maxLength = 120
}) => {
  const generatedId = useId();
  const fieldId = id || `person-name-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const hintId = `${fieldId}-hint`;
  const isDark = theme === 'dark';
  const padding = size === 'sm' ? 'py-2.5 text-base sm:text-sm' : 'py-3.5 text-base sm:text-sm';

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700 dark:text-slate-300'}`}>
        <span>{label}</span>
        {required && <span className="text-rose-500" aria-hidden="true">*</span>}
        {!required && <span className="text-[10px] font-semibold normal-case tracking-normal text-slate-500 dark:text-slate-400">(optional)</span>}
      </label>

      <div className={`group relative flex items-center overflow-hidden rounded-2xl border transition-all duration-200 focus-within:ring-4 ${
        isDark
          ? 'border-slate-700/80 bg-slate-900/90 hover:border-amber-500/50 focus-within:border-amber-400 focus-within:ring-amber-400/15'
          : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/90 hover:border-amber-500/60 focus-within:border-amber-500 focus-within:ring-amber-500/15 dark:focus-within:border-amber-400'
      }`}>
        <span className="flex shrink-0 items-center justify-center pl-3 pr-2" aria-hidden="true">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
            isDark
              ? 'border-amber-500/20 bg-amber-500/15 text-amber-400'
              : 'border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}>
            <User className="h-4 w-4" />
          </span>
        </span>
        <input
          id={fieldId}
          type="text"
          inputMode="text"
          autoComplete={autoComplete}
          autoCapitalize="words"
          maxLength={maxLength}
          required={required}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          aria-describedby={helpText ? hintId : undefined}
          className={`min-w-0 w-full bg-transparent px-2 pr-4 font-semibold outline-none touch-manipulation ${padding} ${
            isDark
              ? 'text-white placeholder:text-slate-500'
              : 'text-slate-900 placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500'
          }`}
        />
      </div>

      {helpText && <p id={hintId} className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{helpText}</p>}
    </div>
  );
};
