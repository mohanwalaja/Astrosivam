import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CartItem, CurrencyCode, CurrencyPriceMap, PaymentMethod, SystemSettings } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { hasFamilyOrderCapacity } from '../services/familyOrderLimits';
import {
  DEFAULT_CURRENCY,
  DEFAULT_PAYMENT_METHOD,
  cartItemPrices,
  cartTotalForPaymentMethod,
  defaultPaymentMethodForAccount,
  formatMoney,
  getCurrencySymbol
} from '../services/pricing';

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id'>) => string | null;
  removeItem: (id: string) => void;
  clearCart: () => void;
  itemCount: number;

  // ---- Money: ONE currency for the whole family, chosen by the customer ----
  /** How the customer decided to pay. This — and only this — sets the currency. */
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  /** Currency the family will be charged in (derived from paymentMethod). */
  currency: CurrencyCode;
  currencySymbol: string;
  /** Total for the whole tray in the selected currency. */
  totalAmount: number;
  /** Totals in every currency, so the UI can show what the other options cost. */
  totals: CurrencyPriceMap;
  /** Price of a single chart in the selected currency. */
  itemPrice: (item: CartItem, index?: number) => number;
  /** All three prices of a single chart. */
  itemPrices: (item: CartItem, index?: number) => CurrencyPriceMap;
  /** "₹1,498.00" in the selected currency. */
  formatAmount: (amount?: number) => string;
  /** Free Beta mode is active on the site. */
  isFreeBeta: boolean;
  /**
   * FREE BETA RULE — 1 free report per customer (per IP address). While true,
   * the FIRST chart of the order is free and the rest of the family pays.
   */
  betaFreeChartAvailable: boolean;
  /** Admin system settings (pricing overrides + service mode). */
  settings: SystemSettings | null;
  /** Authenticated admins can submit every chart in their tray at no charge. */
  isAdminFreeOrder: boolean;

  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const ZERO_PRICES: CurrencyPriceMap = { FJD: 0, INR: 0, USD: 0 };

const STORAGE_KEY = 'astrosivam_family_cart';
const PAYMENT_METHOD_STORAGE_KEY = 'astrosivam_family_cart_payment_method';

function readStoredPaymentMethod(): PaymentMethod | null {
  try {
    const saved = localStorage.getItem(PAYMENT_METHOD_STORAGE_KEY) as PaymentMethod | null;
    if (!saved) return null;
    const upper = String(saved).toUpperCase() as PaymentMethod;
    if (upper === 'CARD') return 'PAYPAL';
    // MyCash is no longer offered. Move any legacy saved selection to the
    // supported Fiji payment method instead of leaving checkout in a dead state.
    if (upper === 'MYCASH') return 'MPAISA';
    return ['MPAISA', 'PAYPAL', 'GPAY', 'UPI'].includes(upper) ? upper : null;
  } catch {
    return null;
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // Keep synchronous capacity checks correct across rapid consecutive clicks.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod>(
    () => readStoredPaymentMethod() || DEFAULT_PAYMENT_METHOD
  );

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Could not persist cart to localStorage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(PAYMENT_METHOD_STORAGE_KEY, paymentMethod);
    } catch (e) {
      console.warn('Could not persist payment method', e);
    }
  }, [paymentMethod]);

  // Load pricing / service mode once so the tray can price every chart.
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.warn('Failed to load pricing settings for the family tray', err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // No explicit choice yet? Pre-select from the ACCOUNT country (never a birth place).
  useEffect(() => {
    if (readStoredPaymentMethod()) return;
    if (!user?.country) return;
    setPaymentMethodState(defaultPaymentMethodForAccount(user.country));
  }, [user?.country]);

  const setPaymentMethod = (method: PaymentMethod) => setPaymentMethodState(method);

  const addItem = (itemData: Omit<CartItem, 'id'>): string | null => {
    if (!hasFamilyOrderCapacity(itemsRef.current.length)) return null;

    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Capture the price in ALL currencies now, so the currency can be changed
    // later at checkout without ever re-deriving it from a birth place.
    const newItem: CartItem = {
      ...itemData,
      prices: cartItemPrices(itemData, settings),
      id
    };
    const nextItems = [...itemsRef.current, newItem];
    itemsRef.current = nextItems;
    setItems(nextItems);
    return id;
  };

  const removeItem = (id: string) => {
    const nextItems = itemsRef.current.filter(item => item.id !== id);
    itemsRef.current = nextItems;
    setItems(nextItems);
  };

  const clearCart = () => {
    itemsRef.current = [];
    setItems([]);
  };

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen(prev => !prev);

  const openCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
    loadSettings(); // make sure the total is priced with the latest admin pricing
  };
  const closeCheckout = () => setIsCheckoutOpen(false);

  const itemCount = items.length;

  /**
   * One payment method -> one currency -> one total for the whole family.
   * All of it comes from the pure helpers in services/pricing.ts, which are
   * covered by the test suite.
   */
  const isAdminFreeOrder = isAdmin;
  const priced = useMemo(() => {
    const base = cartTotalForPaymentMethod(items, settings, paymentMethod, DEFAULT_CURRENCY);
    if (!isAdminFreeOrder) return base;

    // Keep customer pricing untouched. This override only applies to an
    // authenticated admin session; the API independently enforces the same
    // role-based rule before creating the order.
    const zeroPrices = { FJD: 0, INR: 0, USD: 0 };
    return {
      ...base,
      freeChartAvailable: items.length > 0,
      totals: zeroPrices,
      total: 0,
      lineTotals: items.map(() => 0)
    };
  }, [items, settings, paymentMethod, isAdminFreeOrder]);

  const isFreeBeta = priced.freeBeta;
  const betaFreeChartAvailable = priced.freeChartAvailable;
  const currency: CurrencyCode = priced.currency;
  const totals: CurrencyPriceMap = priced.totals;
  const totalAmount: number = priced.total;

  const itemPrices = useCallback(
    (item: CartItem, index = 0): CurrencyPriceMap => {
      // Admin orders are always free for every chart. This only affects the
      // admin session; customer pricing remains governed by the beta flag.
      if (isAdminFreeOrder) return ZERO_PRICES;
      // FREE_BETA: exactly ONE free report per customer (per IP) — only the
      // FIRST chart of the order is $0; the rest of the family pays normally.
      if (betaFreeChartAvailable && index === 0) {
        return ZERO_PRICES;
      }
      return cartItemPrices(item, settings);
    },
    [betaFreeChartAvailable, settings, isAdminFreeOrder]
  );

  const itemPrice = useCallback(
    (item: CartItem, index = 0): number => {
      // Admin orders are always free for every chart. This only affects the
      // admin session; customer pricing remains governed by the beta flag.
      if (isAdminFreeOrder) return 0;
      // FREE_BETA: exactly ONE free report per customer (per IP) — only the
      // FIRST chart of the order is $0; the rest of the family pays normally.
      if (betaFreeChartAvailable && index === 0) {
        return 0;
      }
      return cartItemPrices(item, settings)[currency] || 0;
    },
    [betaFreeChartAvailable, settings, currency, isAdminFreeOrder]
  );

  const formatAmount = useCallback(
    (amount?: number) => formatMoney(amount ?? totalAmount, currency),
    [currency, totalAmount]
  );

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        itemCount,
        paymentMethod,
        setPaymentMethod,
        currency,
        currencySymbol,
        totalAmount,
        totals,
        itemPrice,
        itemPrices,
        formatAmount,
        isFreeBeta,
        betaFreeChartAvailable,
        settings,
        isAdminFreeOrder,
        isCartOpen,
        openCart,
        closeCart,
        toggleCart,
        isCheckoutOpen,
        openCheckout,
        closeCheckout
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
