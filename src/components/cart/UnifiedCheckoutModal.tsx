import React, { useEffect, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { CurrencyCode, Order } from '../../types';
import { PaymentMethodSelector, PAYMENT_METHOD_OPTIONS } from './PaymentMethodSelector';
import { PaymentGatewayCheckoutBox } from './PaymentGatewayCheckoutBox';
import { CURRENCY_INFO } from '../../services/pricing';
import { MultiPersonCheckout } from './MultiPersonCheckout';
import {
  MULTI_PERSON_MAX_PEOPLE,
  PersonDraft,
  buildPeoplePayload,
  groupCartItemsIntoPeople,
  multiPersonLabels,
  multiPersonTotals,
  validatePeople
} from '../../services/multiPersonOrder';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ShoppingBag,
  Loader2,
  FileText,
  Wallet,
  ArrowRight,
  Users,
  Sparkles,
  Heart,
  Baby,
  Calendar,
  Trash2
} from 'lucide-react';

interface UnifiedCheckoutModalProps {
  onNavigate?: (route: string) => void;
}

interface CheckoutSuccessSummary {
  totalAmount: number;
  currency: CurrencyCode;
  currencySymbol: string;
  chartCount: number;
  peopleCount: number;
}

export const UnifiedCheckoutModal: React.FC<UnifiedCheckoutModalProps> = ({ onNavigate }) => {
  const {
    items,
    isCheckoutOpen,
    closeCheckout,
    clearCart,
    removeItem,
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
    settings
  } = useCart();
  const { user } = useAuth();
  const { language } = useLanguage();

  const [paymentRef, setPaymentRef] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutErrors, setCheckoutErrors] = useState<string[]>([]);
  const [successOrders, setSuccessOrders] = useState<Order[] | null>(null);
  const [successGroupId, setSuccessGroupId] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<CheckoutSuccessSummary | null>(null);
  const [successPeople, setSuccessPeople] = useState<any[] | null>(null);
  // ONE CARD PER PERSON: seeded from the family tray (several charts of the same
  // person become one card with several services ticked).
  const [people, setPeople] = useState<PersonDraft[]>([]);
  const [wasOpen, setWasOpen] = useState(false);

  useEffect(() => {
    if (isCheckoutOpen && !wasOpen) {
      setPeople(groupCartItemsIntoPeople(items, language));
      setCheckoutErrors([]);
      setErrorMessage('');
    }
    setWasOpen(isCheckoutOpen);
    // Re-seeding on every item change would fight the admin while they edit the
    // cards, so this deliberately runs only when checkout opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen]);

  if (!isCheckoutOpen) return null;

  const labels = multiPersonLabels(language);
  const checkoutTotals = items.length > 0
    ? {
        currency,
        total: isAdminFreeOrder ? 0 : totals.total,
        itemCount: items.length,
        freeFirstReport: !isAdminFreeOrder && isFreeBeta && betaFreeChartAvailable
      }
    : multiPersonTotals(
        people,
        settings,
        currency,
        !isAdminFreeOrder && isFreeBeta && betaFreeChartAvailable
      );
  const checkoutTotal = isAdminFreeOrder ? 0 : checkoutTotals.total;
  const checkoutItemCount = checkoutTotals.itemCount;

  const isBeta = isFreeBeta;
  const currencyLabel = CURRENCY_INFO[currency]?.label || currency;
  const currencyRegion = CURRENCY_INFO[currency]?.region || '';
  const selectedOption = PAYMENT_METHOD_OPTIONS.find(o => o.method === paymentMethod);

  const mpaisaNumber = settings?.vodafoneMPaisaNumber || '+679 849 5275';
  const mpaisaName = settings?.vodafoneMPaisaName || settings?.vodafoneMPaisaNumber || 'ASTRO SIVAM';
  const upiId = settings?.indiaGpayUpiId || 'astrosivam@okhdfcbank';
  const upiName = settings?.indiaGpayName || 'ASTRO SIVAM';
  const paypalEmail = settings?.paypalEmail || 'payments@astrosivam.com';

  const requiresPayment = checkoutTotal > 0;

  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'BIRTH_JATHAGAM':
        return { label: 'Birth Jathagam', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> };
      case 'MARRIAGE_COMPATIBILITY':
        return { label: 'Marriage Match', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: <Heart className="w-3.5 h-3.5 text-rose-400" /> };
      case 'BABY_NAMING':
        return { label: 'Baby Naming', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <Baby className="w-3.5 h-3.5 text-emerald-400" /> };
      case 'MUHURTHAM':
        return { label: 'Subha Muhurtham', color: 'bg-amber-500/10 text-yellow-400 border-yellow-500/20', icon: <Calendar className="w-3.5 h-3.5 text-yellow-400" /> };
      default:
        return { label: 'Astrology Report', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <FileText className="w-3.5 h-3.5" /> };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1 person minimum, 6 people maximum, every card complete.
    const validation = validatePeople(people, language);
    if (!validation.ok && items.length === 0) {
      setCheckoutErrors(validation.errors);
      setErrorMessage(validation.errors[0] || 'Please complete every person card.');
      return;
    }
    setCheckoutErrors([]);

    if (requiresPayment && paymentMethod !== 'NONE' && !paymentRef.trim()) {
      setErrorMessage('Please enter your payment transaction reference / receipt number.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (items.length > 0) {
        // Direct batch cart placement using validated items already entered by customer
        const res = await api.placeMultiOrder({
          items: items.map(it => ({
            serviceType: it.serviceType,
            language: it.language || language,
            country: it.country || user?.country || 'Fiji',
            inputPayload: it.inputPayload
          })),
          country: user?.country || 'Fiji',
          billingCountry: user?.country || 'Fiji',
          paymentMethod: requiresPayment ? paymentMethod : 'NONE',
          currency,
          totalAmount: checkoutTotal,
          paymentReference: requiresPayment ? paymentRef.trim() : undefined,
          paymentIntentId: requiresPayment ? paymentIntentId || undefined : undefined
        });

        if (res.success && res.orders && res.orders.length > 0) {
          setSuccessSummary({
            totalAmount: Number(res.orders.reduce((sum, o) => sum + Number(o.amount || 0), 0) ?? checkoutTotal),
            currency: (res.orders[0]?.currency as CurrencyCode) || currency,
            currencySymbol,
            chartCount: res.orders.length,
            peopleCount: res.orders.length
          });
          setSuccessOrders(res.orders);
          setSuccessGroupId(res.groupId || res.orders[0]?.orderNumber || null);
          setPaymentRef('');
          setPaymentIntentId('');
          clearCart();
        } else {
          setErrorMessage(res.message || 'Failed to place the order. Please try again.');
        }
      } else {
        const res = await api.placeMultiPersonOrder({
          people: buildPeoplePayload(people),
          // Billing country of the account — NOT a birth place.
          country: user?.country || 'Fiji',
          billingCountry: user?.country || 'Fiji',
          // FREE BETA: only the FIRST report is free. As soon as the order has
          // chargeable reports we submit the real payment method + reference.
          paymentMethod: requiresPayment ? paymentMethod : 'NONE',
          currency,
          totalAmount: checkoutTotal,
          paymentReference: requiresPayment ? paymentRef.trim() : undefined,
          paymentIntentId: requiresPayment ? paymentIntentId || undefined : undefined,
          language
        });

        if (res.success && res.orders && res.orders.length > 0) {
          // Keep the completed checkout's receipt details after clearing the cart.
          // A new checkout must start with a fresh reference and payment intent:
          // captured intents are single-use and manual references cannot be reused.
          setSuccessSummary({
            totalAmount: Number(res.totalAmount ?? checkoutTotal),
            currency: (res.currency as CurrencyCode) || currency,
            currencySymbol,
            chartCount: Array.isArray(res.items) && res.items.length > 0 ? res.items.length : checkoutItemCount,
            peopleCount: Array.isArray(res.people) && res.people.length > 0 ? res.people.length : people.length
          });
          setSuccessOrders(res.orders);
          setSuccessPeople(Array.isArray(res.people) ? res.people : null);
          setSuccessGroupId(res.order?.orderNumber || res.orders[0]?.orderNumber || null);
          setPaymentRef('');
          setPaymentIntentId('');
          clearCart();
        } else {
          setErrorMessage(res.message || 'Failed to place the order. Please try again.');
          if (Array.isArray((res as any).errors)) setCheckoutErrors((res as any).errors);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'A network error occurred while submitting your order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = (targetRoute = 'dashboard') => {
    closeCheckout();
    setSuccessOrders(null);
    setSuccessGroupId(null);
    setSuccessSummary(null);
    setSuccessPeople(null);
    setCheckoutErrors([]);
    setPaymentRef('');
    setPaymentIntentId('');
    setErrorMessage('');
    if (onNavigate) {
      onNavigate(targetRoute);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Family Checkout — Up To {MULTI_PERSON_MAX_PEOPLE} People</h2>
              <p className="text-xs text-slate-400">
                {isAdminFreeOrder ? 'No payment required for' : 'One payment for'} {successSummary?.peopleCount ?? people.length} {(successSummary?.peopleCount ?? people.length) === 1 ? 'person' : 'people'} / {successSummary?.chartCount ?? checkoutItemCount} {(successSummary?.chartCount ?? checkoutItemCount) === 1 ? 'report' : 'reports'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (successOrders) {
                handleFinish();
              } else {
                closeCheckout();
              }
            }}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {successOrders ? (
            /* Success View */
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">
                  {isAdminFreeOrder
                    ? 'Admin Order Placed Successfully!'
                    : successOrders.every(o => o.amount > 0)
                    ? 'Payment Receipt Submitted & Orders Placed!'
                    : 'Family Order Placed Successfully!'}
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  {isAdminFreeOrder
                    ? `All ${successSummary?.chartCount ?? successOrders.length} admin reports for ${successSummary?.peopleCount ?? successOrders.length} people were submitted at no charge and are awaiting verification. You can now place your next order.`
                    : (successSummary?.totalAmount ?? totalAmount) > 0
                    ? `We have received your payment reference of ${(successSummary?.currencySymbol ?? currencySymbol)}${(successSummary?.totalAmount ?? totalAmount).toFixed(2)} ${(successSummary?.currency ?? currency)} for all ${successSummary?.chartCount ?? successOrders.length} report(s). Your cart has been cleared — you can now place your next order.`
                    : `The first report is FREE (Free Beta — 1 free report per customer). The order has been queued and you can now place your next order.`}
                </p>
                {successGroupId && (
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-amber-400">
                    Order Number: {successGroupId}
                  </div>
                )}
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-left space-y-2.5 max-h-56 overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">
                  People &amp; Reports In This Order:
                </div>
                {(successPeople && successPeople.length > 0
                  ? successPeople.map((person: any, i: number) => (
                      <div key={i} className="flex items-start justify-between text-xs py-1 gap-3">
                        <span className="font-semibold text-white">
                          {person.seq}. {person.fullName}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {(person.services || []).join(' • ')}
                          </span>
                        </span>
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                          {successGroupId || successOrders[0]?.orderNumber}
                        </span>
                      </div>
                    ))
                  : successOrders.map((ord, i) => (
                      <div key={ord.id || i} className="flex items-center justify-between text-xs py-1">
                        <span className="font-semibold text-white">
                          {i + 1}. {ord.inputPayload?.name || ord.serviceType}
                        </span>
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {ord.orderNumber}
                        </span>
                      </div>
                    )))}
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleFinish('services')}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Place Another Order"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Place Next Order</span>
                  <span className="sr-only">Place Another Order</span>
                </button>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleFinish('dashboard')}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Go to My Dashboard &amp; View Orders</span>
                  </button>
                  <button
                    onClick={() => handleFinish('home')}
                    className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Checkout Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. ORDERS IN CART OR PEOPLE CARDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>1. Orders in Cart ({items.length > 0 ? items.length : people.length}/{MULTI_PERSON_MAX_PEOPLE})</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                    Showing prices in {currency}
                  </span>
                </div>

                {items.length > 0 ? (
                  /* Display already-entered Cart Items (No re-asking of birth details) */
                  <div className="space-y-2.5">
                    {items.map((item, idx) => {
                      const badge = getServiceBadge(item.serviceType);
                      const price = itemPrice(item, idx);
                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-start justify-between gap-3 hover:border-slate-700 transition-all"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}>
                                {badge.icon}
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-slate-500 uppercase font-mono">
                                Order #{idx + 1}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {item.language === 'ta' ? 'Tamil' : item.language === 'hi' ? 'Hindi' : 'English'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white truncate">{item.devoteeName || 'User'}</h4>
                            <p className="text-xs text-slate-400 line-clamp-1">{item.summaryText}</p>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                            <div className="text-sm font-black text-amber-400">
                              {price <= 0 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-xs font-bold">
                                  FREE {isAdminFreeOrder ? '(Admin)' : isFreeBeta ? '(1st Free)' : ''}
                                </span>
                              ) : (
                                `${currencySymbol}${price.toFixed(2)}`
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors mt-2"
                              title="Remove order"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* If cart is empty, allow custom multi-person cards */
                  <MultiPersonCheckout
                    people={people}
                    onChange={setPeople}
                    settings={settings}
                    currency={currency}
                    language={language}
                    freeFirstReport={!isAdminFreeOrder && isBeta && betaFreeChartAvailable}
                    isAdminFreeOrder={isAdminFreeOrder}
                    disabled={isSubmitting}
                    errors={checkoutErrors}
                  />
                )}

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-sm font-bold text-white">
                  <span>{labels.grandTotal}:</span>
                  <span className="text-base font-black text-amber-400">
                    {checkoutTotal > 0
                      ? `${currencySymbol}${checkoutTotal.toFixed(2)} ${currency}`
                      : isAdminFreeOrder
                      ? 'FREE (Admin Order)'
                      : 'FREE (Free Beta — 1st Report)'}
                  </span>
                </div>
              </div>

              {/* Payment Section — shown when totalAmount > 0 */}
              {requiresPayment ? (
                <div className="space-y-4">
                  {isBeta && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        {betaFreeChartAvailable ? (
                          <>
                            <strong>Free Beta:</strong> the first report is <strong>FREE</strong> (1 free report per customer). You are paying for the remaining {Math.max(0, checkoutItemCount - 1)} {checkoutItemCount - 1 === 1 ? 'report' : 'reports'} of the order.
                          </>
                        ) : (
                          <>
                            <strong>Free Beta:</strong> your 1 free report was already used from this connection, so all {checkoutItemCount} {checkoutItemCount === 1 ? 'report is' : 'reports are'} charged at the standard price.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    2. Choose Your Payment Method
                  </h3>

                  <PaymentMethodSelector
                    variant="full"
                    paymentMethod={paymentMethod}
                    onSelect={setPaymentMethod}
                    totals={totals}
                    settings={settings}
                    disabled={isSubmitting}
                  />

                  {/* Dual-Mode (Offline & Online) Payment Checkout Box */}
                  <PaymentGatewayCheckoutBox
                    paymentMethod={paymentMethod}
                    amount={checkoutTotal}
                    currency={currency}
                    currencySymbol={currencySymbol}
                    settings={settings}
                    paymentRef={paymentRef}
                    onPaymentRefChange={setPaymentRef}
                    onPaymentIntentIdChange={setPaymentIntentId}
                    itemCount={checkoutItemCount}
                    description={`ASTRO SIVAM Family Order (${people.length} ${people.length === 1 ? 'person' : 'people'}, ${checkoutItemCount} ${checkoutItemCount === 1 ? 'report' : 'reports'})`}
                  />
                </div>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isAdminFreeOrder ? 'Admin order — all charts are free' : 'Free Beta — Your First Report Is Free'}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    {isAdminFreeOrder
                      ? 'Admin orders are always free. No payment is required.'
                      : 'This order is your 1 free report (one free report per customer during the Free Beta). No payment is required.'}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting {checkoutItemCount} Report(s)...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>
                        {requiresPayment
                          ? `Complete Payment • ${currencySymbol}${checkoutTotal.toFixed(2)} ${currency}`
                          : 'Confirm Free Order →'}
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 text-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Secure Vedic Astrology Consultation • Guaranteed Confidentiality</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
