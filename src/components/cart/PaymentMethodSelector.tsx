import React from 'react';
import { PaymentMethod, CurrencyPriceMap, SystemSettings, PaymentGatewayMode } from '../../types';
import { PAYMENT_METHOD_CURRENCY, formatMoney } from '../../services/pricing';

/**
 * Resolve whether a given payment method is configured by Admin to run in
 * 'offline' (manual transfer + receipt ID) or 'online' (automated gateway) mode.
 * Defaults to 'offline' until setup is switched to 'online' in Admin Panel.
 */
export function getGatewayModeForMethod(
  method: PaymentMethod,
  settings?: SystemSettings | null
): PaymentGatewayMode {
  const m = String(method || '').toUpperCase();
  if (m === 'GPAY' || m === 'UPI') {
    return settings?.indiaGpayPaymentMode === 'online' && settings?.indiaGpayOnlineConfigured === true ? 'online' : 'offline';
  }
  if (m === 'PAYPAL' || m === 'CARD') {
    return settings?.paypalPaymentMode === 'online' && settings?.paypalOnlineConfigured === true ? 'online' : 'offline';
  }
  // M-PAiSA has no verified provider callback in this application yet.
  if (m === 'MPAISA' || m === 'MYCASH') {
    return 'offline';
  }
  return 'offline';
}

/**
 * "How would you like to pay?" — the ONE decision that sets the currency of the
 * whole family order. Birth places never appear here.
 */

export interface PaymentMethodOption {
  method: PaymentMethod;
  title: string;
  subtitle: string;
  accent: string;
  activeClass: string;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    method: 'MPAISA',
    title: 'Vodafone M-PAiSA',
    subtitle: 'Fiji Islands',
    accent: 'text-red-400',
    activeClass: 'bg-red-500/10 border-red-500 ring-1 ring-red-500 text-white'
  },
  {
    method: 'GPAY',
    title: 'Google Pay / UPI',
    subtitle: 'India',
    accent: 'text-emerald-400',
    activeClass: 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500 text-white'
  },
  {
    method: 'PAYPAL',
    title: 'PayPal / Card',
    subtitle: 'International',
    accent: 'text-blue-400',
    activeClass: 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500 text-white'
  }
];

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  /** Totals in every currency so each option can show what it would cost. */
  totals: CurrencyPriceMap;
  settings?: SystemSettings | null;
  isFreeBeta?: boolean;
  /** compact = family tray footer, full = checkout modal */
  variant?: 'compact' | 'full';
  disabled?: boolean;
  heading?: string;
  helperText?: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  paymentMethod,
  onSelect,
  totals,
  settings,
  isFreeBeta = false,
  variant = 'full',
  disabled = false,
  heading = 'How would you like to pay?',
  helperText = 'Your whole family order is charged in the currency of the payment method you pick — the birth place of each family member does not change the price.'
}) => {
  const compact = variant === 'compact';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-bold uppercase tracking-wider text-slate-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {heading}
        </h3>
        {!isFreeBeta && (
          <span className="text-[10px] text-slate-500">One payment • One receipt</span>
        )}
      </div>

      <div className={`grid gap-2.5 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {PAYMENT_METHOD_OPTIONS.map(option => {
          const optionCurrency = PAYMENT_METHOD_CURRENCY[option.method] || 'FJD';
          const isActive = paymentMethod === option.method;
          const gwMode = settings ? getGatewayModeForMethod(option.method, settings) : null;
          return (
            <button
              key={option.method}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.method)}
              aria-pressed={isActive}
              title={`${option.title} — pay in ${optionCurrency}`}
              className={`${compact ? 'p-2.5' : 'p-3'} rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                isActive ? option.activeClass : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold ${option.accent}`}>
                  {option.title}
                </div>
                {gwMode && !compact && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                      gwMode === 'online'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {gwMode === 'online' ? 'Online' : 'Offline'}
                  </span>
                )}
              </div>
              <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-400`}>
                {option.subtitle} ({optionCurrency})
              </div>
              {totals?.[optionCurrency] !== undefined && (
                <div className={`${compact ? 'text-[11px] mt-1' : 'text-xs mt-1.5'} font-mono font-bold ${isActive ? 'text-white' : 'text-amber-400/90'}`}>
                  {totals[optionCurrency] > 0 ? formatMoney(totals[optionCurrency], optionCurrency) : 'FREE'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!compact && helperText && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{helperText}</p>
      )}
    </div>
  );
};
