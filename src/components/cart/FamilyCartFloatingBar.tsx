import React from 'react';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { MAX_FAMILY_ORDER_ITEMS } from '../../services/familyOrderLimits';

interface FamilyCartFloatingBarProps {
  onNavigate?: (route: string) => void;
}

export const FamilyCartFloatingBar: React.FC<FamilyCartFloatingBarProps> = ({ onNavigate }) => {
  const {
    items,
    openCart,
    openCheckout,
    totalAmount,
    currency,
    currencySymbol,
    paymentMethod,
    isAdminFreeOrder,
    isCartOpen,
    isCheckoutOpen
  } = useCart();

  if (items.length === 0 || isCartOpen || isCheckoutOpen) return null;

  const paymentLabel =
    paymentMethod === 'MPAISA'
      ? 'Vodafone M-PAiSA'
      : paymentMethod === 'GPAY'
      ? 'Google Pay / UPI'
      : 'PayPal / Card';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-auto animate-bounce-subtle">
      <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500/80 rounded-2xl p-2.5 sm:px-4 sm:py-3 text-white shadow-[0_10px_35px_rgba(245,158,11,0.3)] flex items-center justify-between gap-3 sm:gap-6">
        <div
          onClick={openCart}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center border-2 border-slate-900">
              {items.length}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                Orders Cart
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                {items.length} / {MAX_FAMILY_ORDER_ITEMS} Orders
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Total in {currency}:{' '}
              <strong className="text-amber-400 font-bold">
                {totalAmount > 0 ? `${currencySymbol}${totalAmount.toFixed(2)}` : isAdminFreeOrder ? 'FREE (Admin Order)' : 'FREE (Free Beta — 1st Report)'}
              </strong>
              {totalAmount > 0 && <span className="text-slate-500"> • via {paymentLabel}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCart}
            className="hidden sm:inline-flex px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            View Cart
          </button>
          <button
            onClick={openCheckout}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span>{isAdminFreeOrder ? 'Submit Free Order' : 'Pay Once'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
