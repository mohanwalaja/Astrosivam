import React from 'react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle,
  Heart,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import { ServiceType } from '../../types';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { MAX_FAMILY_ORDER_ITEMS, hasFamilyOrderCapacity } from '../../services/familyOrderLimits';

interface FamilyCartDrawerProps {
  onNavigate?: (route: string) => void;
}

export const FamilyCartDrawer: React.FC<FamilyCartDrawerProps> = ({ onNavigate }) => {
  const {
    items,
    removeItem,
    clearCart,
    isCartOpen,
    closeCart,
    totalAmount,
    totals,
    currency,
    currencySymbol,
    itemPrice,
    paymentMethod,
    setPaymentMethod,
    isFreeBeta,
    betaFreeChartAvailable,
    isAdminFreeOrder,
    openCheckout
  } = useCart();
  const { t } = useLanguage();

  if (!isCartOpen) return null;

  const getServiceBadge = (type: ServiceType) => {
    switch (type) {
      case 'BIRTH_JATHAGAM':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Birth Jathagam',
          color: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
        };
      case 'MARRIAGE_COMPATIBILITY':
        return {
          icon: <Heart className="w-3.5 h-3.5 text-rose-500" />,
          label: 'Marriage Compatibility',
          color: 'bg-rose-500/10 text-rose-500 border-rose-500/30'
        };
      case 'BABY_NAMING':
        return {
          icon: <Baby className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Baby Naming Ceremony',
          color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
        };
      case 'MUHURTHAM':
        return {
          icon: <CalendarDays className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Subha Muhurtham Dates',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Astrology Service',
          color: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
        };
    }
  };

  const handleAddAnother = (route: string) => {
    closeCart();
    if (onNavigate) {
      onNavigate(route);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 text-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Orders Cart</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                    {items.length} / {MAX_FAMILY_ORDER_ITEMS} Orders
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {isAdminFreeOrder
                    ? 'All admin reports are always free — no payment required'
                    : 'Add up to 6 orders to place and pay once. After payment, you can place your next order.'}
                </p>
              </div>
            </div>
            <button
              onClick={closeCart}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body / Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 opacity-40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Your Cart is empty</h3>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Fill details for any service and click "Add to Cart" to place up to 6 orders in a single checkout.
                  </p>
                </div>
                <div className="w-full space-y-2 pt-2">
                  <button
                    onClick={() => handleAddAnother('birth-jathagam')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Add Birth Jathagam Chart</span>
                  </button>
                  <button
                    onClick={() => handleAddAnother('marriage-compatibility')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>+ Add Marriage Matching</span>
                  </button>
                  <button
                    onClick={() => handleAddAnother('baby-naming')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <Baby className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Add Baby Naming Chart</span>
                  </button>
                  <button
                    onClick={() => handleAddAnother('muhurtham')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-amber-300" />
                    <span>+ Add Subha Muhurtham Dates</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                  <span>Reports in your bundle ({items.length} of {MAX_FAMILY_ORDER_ITEMS}):</span>
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear Tray
                  </button>
                </div>

                {items.map((item, idx) => {
                  const badge = getServiceBadge(item.serviceType);
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 relative group hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}>
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                              #{idx + 1}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">{item.devoteeName}</h4>
                          <p className="text-xs text-slate-400">{item.summaryText}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-amber-400">
                            {itemPrice(item, idx) <= 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-xs">
                                FREE {isAdminFreeOrder ? '(Admin Order)' : isFreeBeta ? '(Free Beta)' : ''}
                              </span>
                            ) : (
                              `${currencySymbol}${itemPrice(item, idx).toFixed(2)}`
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors mt-2"
                            title="Remove report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.calculatedResult && (
                        <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-amber-300/90 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">
                            {item.calculatedResult.rasi ? `Rasi: ${item.calculatedResult.rasi} • ` : ''}
                            {item.calculatedResult.nakshatra ? `Nakshatra: ${item.calculatedResult.nakshatra}` : 'Astrological Calculations Computed'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasFamilyOrderCapacity(items.length) ? (
                  <div className="pt-2">
                    <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add Another Service to Cart:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAddAnother('birth-jathagam')}
                        className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-center transition-all group"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold text-slate-300 block leading-tight">Birth Jathagam</span>
                      </button>
                      <button
                        onClick={() => handleAddAnother('marriage-compatibility')}
                        className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-center transition-all group"
                      >
                        <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold text-slate-300 block leading-tight">Marriage Match</span>
                      </button>
                      <button
                        onClick={() => handleAddAnother('baby-naming')}
                        className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-center transition-all group"
                      >
                        <Baby className="w-4 h-4 text-emerald-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold text-slate-300 block leading-tight">Baby Naming</span>
                      </button>
                      <button
                        onClick={() => handleAddAnother('muhurtham')}
                        className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-center transition-all group"
                      >
                        <CalendarDays className="w-4 h-4 text-amber-300 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-semibold text-slate-300 block leading-tight">Subha Muhurtham</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div role="status" className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-xs text-amber-200">
                    Maximum {MAX_FAMILY_ORDER_ITEMS} orders reached for this checkout (no seventh report can be added). Pay once to submit these {MAX_FAMILY_ORDER_ITEMS} orders, then you can place your next order.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with payment choice + Single Checkout CTA */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-slate-950/90 space-y-3">
              {isAdminFreeOrder && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="leading-tight"><strong>Admin order: all charts are FREE.</strong> No payment is required.</span>
                </div>
              )}
              {!isAdminFreeOrder && isFreeBeta && items.length > 1 && betaFreeChartAvailable && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="leading-tight">
                    <strong>Chart 1 is FREE (Free Beta)!</strong> Your 1 free report covers the first family member — the remaining {items.length - 1} {items.length - 1 === 1 ? 'chart is' : 'charts are'} charged at standard price.
                  </span>
                </div>
              )}
              {!isAdminFreeOrder && isFreeBeta && !betaFreeChartAvailable && (
                <div className="p-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="leading-tight">
                    <strong>Free Beta report already used.</strong> The 1 free report for this connection was used by an earlier order, so all charts are charged at standard price.
                  </span>
                </div>
              )}

              {/* The customer decides how to pay -> that decides the currency */}
              {totalAmount > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <PaymentMethodSelector
                    variant="compact"
                    paymentMethod={paymentMethod}
                    onSelect={setPaymentMethod}
                    totals={totals}
                    heading="Pay with"
                  />
                  <p className="text-[10px] text-slate-500 leading-snug flex items-start gap-1.5">
                    <Wallet className="w-3 h-3 mt-0.5 shrink-0 text-amber-400/70" />
                    <span>
                      Charged in <strong className="text-slate-300">{currency}</strong> via{' '}
                      <strong className="text-slate-300">{paymentMethod === 'MPAISA' ? 'Vodafone M-PAiSA' : paymentMethod === 'GPAY' ? 'Google Pay / UPI' : 'PayPal / Card'}</strong>
                      — one payment for all family reports.
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Total Reports:</span>
                  <span className="font-semibold text-slate-200">
                    {items.length} Reports {isAdminFreeOrder ? '(All Free — Admin)' : isFreeBeta && betaFreeChartAvailable ? '(1st Free — Free Beta)' : ''}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800/80 pt-2">
                  <span>Total Amount Once ({currency}):</span>
                  <span className="text-base font-black text-amber-400">
                    {totalAmount > 0 ? `${currencySymbol}${totalAmount.toFixed(2)}` : isAdminFreeOrder ? 'FREE (Admin Order)' : 'FREE (Free Beta — 1st Report)'}
                  </span>
                </div>
              </div>

              <div className={`p-2.5 border rounded-xl text-xs ${items.length > MAX_FAMILY_ORDER_ITEMS ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-200'}`}>
                {items.length > MAX_FAMILY_ORDER_ITEMS
                  ? `This tray exceeds the ${MAX_FAMILY_ORDER_ITEMS}-report limit. Remove ${items.length - MAX_FAMILY_ORDER_ITEMS} report(s) before continuing.`
                  : `Up to ${MAX_FAMILY_ORDER_ITEMS} reports per checkout. After admin approval, every preview-quality report and one consolidated invoice are emailed; size limits may split delivery across labelled emails.`}
              </div>
              <div className="space-y-2 pt-1">
                <button
                  onClick={openCheckout}
                  disabled={items.length > MAX_FAMILY_ORDER_ITEMS}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Proceed to Unified Checkout ({items.length} reports)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isAdminFreeOrder ? 'All family charts are free — no payment receipt needed' : `Single payment receipt covers all ${items.length} family reports`}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
