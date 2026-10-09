/**
 * Single source of truth for money on ASTRO SIVAM.
 *
 * RULE: The currency of an order is decided by the PAYMENT METHOD the customer
 * picks at checkout — never by the birth place of any family member.
 *
 *   Vodafone M-PAiSA / MyCash  -> FJD (Fiji)
 *   Google Pay / UPI           -> INR (India)
 *   PayPal / Card              -> USD (International)
 *
 * A family tray can therefore hold a husband born in India, a wife born in
 * India and a son born in Nadi (Fiji) and still show ONE total in ONE currency,
 * because every chart is priced in the currency the customer is actually
 * paying with.
 *
 * This module is framework free (no React) so the Node backend and the test
 * suite can import the exact same rules the UI uses.
 */

import type { CurrencyCode, CurrencyPriceMap, PaymentMethod, ServiceType } from '../types';

export type { CurrencyCode, CurrencyPriceMap };

export const ALL_CURRENCIES: CurrencyCode[] = ['FJD', 'INR', 'USD'];

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
  region: string;
}

export const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  FJD: { code: 'FJD', symbol: 'FJ$', label: 'Fijian Dollar', region: 'Fiji' },
  INR: { code: 'INR', symbol: '₹', label: 'Indian Rupee', region: 'India' },
  USD: { code: 'USD', symbol: 'US$', label: 'US Dollar', region: 'International' }
};

/** Currency that each payment method is settled in. `null` = not a real payment. */
export const PAYMENT_METHOD_CURRENCY: Record<PaymentMethod, CurrencyCode | null> = {
  MPAISA: 'FJD',
  MYCASH: 'FJD',
  GPAY: 'INR',
  UPI: 'INR',
  PAYPAL: 'USD',
  CARD: 'USD',
  NONE: null
};

/** Used only when the customer has not chosen anything yet (e.g. empty tray). */
export const DEFAULT_CURRENCY: CurrencyCode = 'FJD';
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'MPAISA';

/** Fallback retail prices, mirroring api/services/index.php + admin defaults. */
export const DEFAULT_SERVICE_PRICES: Record<ServiceType, CurrencyPriceMap> = {
  BIRTH_JATHAGAM: { FJD: 35, INR: 499, USD: 18 },
  MARRIAGE_COMPATIBILITY: { FJD: 45, INR: 699, USD: 22 },
  BABY_NAMING: { FJD: 30, INR: 399, USD: 15 },
  // Subha Muhurtham Finder — six-month auspicious date report for one ceremony.
  MUHURTHAM: { FJD: 40, INR: 599, USD: 20 }
};

/**
 * Loose shape so both backends work with it: the Node store exposes
 * `servicePricing`, the PHP API exposes the same numbers under `pricing`.
 * No index signature, so any real settings object stays assignable.
 */
export interface PricingSettingsSource {
  serviceMode?: string | null;
  freeBetaActive?: boolean | null;
  /**
   * FREE BETA RULE: does THIS customer (per IP address) still have their one
   * free report? `true`/`undefined` = free chart still unused (the first
   * chart of the order is free), `false` = already used (everything paid).
   */
  betaFreeChartAvailable?: boolean | null;
  fijiPriceFJD?: number | null;
  intlPriceUSD?: number | null;
  indiaPriceINR?: number | null;
  servicePricing?: PriceOverrideTable | null;
  pricing?: PriceOverrideTable | null;
}

export type PriceOverride = Partial<Record<'fjd' | 'usd' | 'inr' | 'FJD' | 'USD' | 'INR', number>>;

export type PriceOverrideTable = Partial<Record<ServiceType, PriceOverride>>;

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === 'FJD' || value === 'INR' || value === 'USD';
}

/** Currency a payment method settles in, or `null` when it is not a real payment. */
export function currencyFromPaymentMethodOnly(paymentMethod?: PaymentMethod | string | null): CurrencyCode | null {
  const key = String(paymentMethod ?? '').trim().toUpperCase() as PaymentMethod;
  return PAYMENT_METHOD_CURRENCY[key] ?? null;
}

/** The currency a payment method settles in. Falls back to `fallback` for NONE. */
export function getCurrencyForPaymentMethod(
  paymentMethod?: PaymentMethod | string | null,
  fallback: CurrencyCode = DEFAULT_CURRENCY
): CurrencyCode {
  return currencyFromPaymentMethodOnly(paymentMethod) ?? fallback;
}

export function isRealPaymentMethod(paymentMethod?: PaymentMethod | string | null): boolean {
  const key = String(paymentMethod ?? '').toUpperCase() as PaymentMethod;
  return Boolean(key) && key !== 'NONE' && PAYMENT_METHOD_CURRENCY[key] != null;
}

export function getCurrencySymbol(currency: CurrencyCode | string): string {
  return isCurrencyCode(currency) ? CURRENCY_INFO[currency].symbol : 'FJ$';
}

/** "₹1,498.00" / "FJ$70.00" / "US$36.00" */
export function formatMoney(amount: number, currency: CurrencyCode | string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const decimals = currency === 'INR' || currency === 'FJD' ? 2 : 2;
  const body = safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${getCurrencySymbol(currency)}${body}`;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function pickServicePricing(
  settings: PricingSettingsSource | null | undefined,
  serviceType: ServiceType
): PriceOverride | null {
  if (!settings) return null;
  const fromServicePricing = settings.servicePricing?.[serviceType];
  const fromPricing = settings.pricing?.[serviceType];
  const merged = { ...(fromPricing || {}), ...(fromServicePricing || {}) };
  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * All three prices for a service, honouring admin overrides:
 * per-service pricing first, then the legacy global country prices,
 * then the built-in defaults.
 */
export function getServicePrices(
  settings: PricingSettingsSource | null | undefined,
  serviceType: ServiceType
): CurrencyPriceMap {
  const overrides = pickServicePricing(settings, serviceType);
  const fallbacks = DEFAULT_SERVICE_PRICES[serviceType] ?? DEFAULT_SERVICE_PRICES.BIRTH_JATHAGAM;

  const fjd =
    toNumber(overrides?.fjd) ??
    toNumber(overrides?.FJD) ??
    toNumber(settings?.fijiPriceFJD) ??
    fallbacks.FJD;
  const inr =
    toNumber(overrides?.inr) ??
    toNumber(overrides?.INR) ??
    toNumber(settings?.indiaPriceINR) ??
    fallbacks.INR;
  const usd =
    toNumber(overrides?.usd) ??
    toNumber(overrides?.USD) ??
    toNumber(settings?.intlPriceUSD) ??
    fallbacks.USD;

  return { FJD: fjd, INR: inr, USD: usd };
}

export function getServicePriceInCurrency(
  settings: PricingSettingsSource | null | undefined,
  serviceType: ServiceType,
  currency: CurrencyCode
): number {
  return getServicePrices(settings, serviceType)[currency];
}

export function isFreeBeta(settings: PricingSettingsSource | null | undefined): boolean {
  return settings?.serviceMode === 'FREE_BETA' || settings?.freeBetaActive === true;
}

/**
 * FREE BETA RULE — exactly ONE free report per customer (tracked per IP
 * address). `true` while the site runs in FREE_BETA and this customer's free
 * chart is still unused. Once `betaFreeChartAvailable` turns `false`, every
 * further order (single or family) is fully paid.
 */
export function isBetaFreeChartAvailable(settings: PricingSettingsSource | null | undefined): boolean {
  return isFreeBeta(settings) && settings?.betaFreeChartAvailable !== false;
}

/**
 * Convenience only: which payment method to PRE-SELECT for a customer account.
 * The birth place of a family member must never be passed in here — that is the
 * bug this module exists to remove.
 */
export function defaultPaymentMethodForAccount(accountCountry?: string | null): PaymentMethod {
  const country = String(accountCountry ?? '').trim().toLowerCase();
  if (!country) return DEFAULT_PAYMENT_METHOD;
  if (country.includes('india') || country === 'in') return 'GPAY';
  if (country.includes('fiji') || country === 'fj') return 'MPAISA';
  return 'PAYPAL';
}

/** Country based guess. Only ever a fallback when no payment method was chosen. */
export function currencyForCountry(country?: string | null): CurrencyCode {
  const c = String(country ?? '').trim().toLowerCase();
  if (!c) return DEFAULT_CURRENCY;
  if (c.includes('india') || c === 'in') return 'INR';
  if (c.includes('fiji') || c === 'fj') return 'FJD';
  return 'USD';
}

export function currencyForAccountCountry(accountCountry?: string | null): CurrencyCode {
  return currencyForCountry(accountCountry);
}

/**
 * THE server-side rule, shared by the Node backend and the test suite.
 * 1. A real payment method always wins: GPAY/UPI -> INR, MPAISA/MYCASH -> FJD,
 *    PAYPAL/CARD -> USD.
 * 2. Only when there is no real payment method (FREE_BETA / NONE) do we look at
 *    the BILLING country of the account — and only then, never at a birth place.
 */
export function resolveOrderCurrency(options: {
  paymentMethod?: PaymentMethod | string | null;
  billingCountry?: string | null;
  country?: string | null;
  currency?: CurrencyCode | string | null;
}): CurrencyCode {
  const fromMethod = currencyFromPaymentMethodOnly(options.paymentMethod);
  if (fromMethod) return fromMethod;

  // Free beta / no payment method: honour an explicit valid currency, else the
  // billing country of the account.
  if (isCurrencyCode(options.currency)) return options.currency;
  return currencyForCountry(options.billingCountry || options.country);
}

/** Total for a whole family tray, always in ONE currency. */
export function sumCartTotals(prices: CurrencyPriceMap[]): CurrencyPriceMap {
  return prices.reduce<CurrencyPriceMap>(
    (acc, p) => ({
      FJD: acc.FJD + (p?.FJD || 0),
      INR: acc.INR + (p?.INR || 0),
      USD: acc.USD + (p?.USD || 0)
    }),
    { FJD: 0, INR: 0, USD: 0 }
  );
}

/* ------------------------------------------------------------------ *
 *  Family tray maths                                                  *
 * ------------------------------------------------------------------ */

export interface CartLineLike {
  serviceType: ServiceType;
  /** Prices captured when the chart was added; older carts may not have them. */
  prices?: CurrencyPriceMap | null;
}

/**
 * Price of one chart in all three currencies.
 * Older saved carts (added before per-currency pricing) are rebuilt from the
 * current admin pricing for the service instead of trusting a single
 * birthplace-derived number.
 */
export function cartItemPrices(
  item: CartLineLike | null | undefined,
  settings: PricingSettingsSource | null | undefined
): CurrencyPriceMap {
  if (!item) return { FJD: 0, INR: 0, USD: 0 };
  const stored = item.prices;
  if (stored && ALL_CURRENCIES.every(c => typeof stored[c] === 'number' && Number.isFinite(stored[c]))) {
    return { FJD: stored.FJD, INR: stored.INR, USD: stored.USD };
  }
  return getServicePrices(settings, item.serviceType ?? 'BIRTH_JATHAGAM');
}

export interface CartTotals {
  /** Site is running in FREE_BETA mode. */
  freeBeta: boolean;
  /**
   * FREE BETA RULE: this customer (per IP) still has its ONE free report, so
   * the FIRST chart of the order is priced at $0. When `false` (free chart
   * already used, or not in beta) every chart is charged at full price.
   */
  freeChartAvailable: boolean;
  /** Total per currency — each entry is a single-currency sum, never mixed. */
  totals: CurrencyPriceMap;
  /** Per-chart prices, in the same order as the input. */
  perItem: CurrencyPriceMap[];
}

export function computeCartTotals(
  items: CartLineLike[] | null | undefined,
  settings: PricingSettingsSource | null | undefined
): CartTotals {
  const list = Array.isArray(items) ? items : [];
  const freeBeta = isFreeBeta(settings);
  const freeChartAvailable = isBetaFreeChartAvailable(settings);
  const perItem = list.map((item, index) => {
    const p = cartItemPrices(item, settings);
    // FREE_BETA: exactly ONE free report per customer (per IP address) — the
    // FIRST chart of the order is free; the rest of the family pays normally.
    if (freeChartAvailable && index === 0) {
      return { FJD: 0, INR: 0, USD: 0 };
    }
    return p;
  });
  return { freeBeta, freeChartAvailable, perItem, totals: sumCartTotals(perItem) };
}

export interface CartTotalForPayment extends CartTotals {
  /** Currency the whole family is charged in. */
  currency: CurrencyCode;
  /** Single number the customer pays. */
  total: number;
  /** Per-chart price in that same currency. */
  lineTotals: number[];
}

/**
 * What the customer sees and pays: one payment method in, one currency out,
 * one total for the whole family — regardless of where anybody was born.
 */
export function cartTotalForPaymentMethod(
  items: CartLineLike[] | null | undefined,
  settings: PricingSettingsSource | null | undefined,
  paymentMethod?: PaymentMethod | string | null,
  fallbackCurrency: CurrencyCode = DEFAULT_CURRENCY
): CartTotalForPayment {
  const base = computeCartTotals(items, settings);
  const currency = getCurrencyForPaymentMethod(paymentMethod, fallbackCurrency);
  return {
    ...base,
    currency,
    total: base.totals[currency],
    lineTotals: base.perItem.map(p => p[currency])
  };
}
