import React, { useState, useEffect } from 'react';
import { X, Download, FileText, CheckCircle2, ShieldCheck, Mail, Sparkles, AlertTriangle, Calendar, Star, Compass, Receipt, Languages, Eye, Send, RefreshCw, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { Order, OrderItem, AppLanguage } from '../../types';
import { RasiChartSvg } from './RasiChartSvg';
import { LivePdfPreviewModal } from './LivePdfPreviewModal';
import { getGunam } from '../../services/gunamData';
import { api } from '../../services/api';
import {
  exportInvoiceHtmlToPdf,
  exportFamilyInvoiceHtmlToPdf,
  exportOrderReportPdf,
  generateOrderPdfsBase64,
  prepareFamilyFulfilPayload,
  deliverOrderPdfPayload,
  downloadHtmlPdf,
  orderInvoiceFileName
} from '../../services/jathagamPdfExporter';
import { buildOrderInvoiceHtmlForItems, orderItemAsOrder, prepareOrderItemPdfs } from '../../services/orderItems';
import { describeFamilyRenderQuality } from '../../services/formatUtils';
import { normalizeReportLanguage } from '../../services/reportLanguage';
import { withDerivedNavamsa } from '../../services/navamsa';

const RASI_NAMES_ORDER_MODAL: Record<number, string> = {
  1: 'Mesham', 2: 'Rishabam', 3: 'Mithunam', 4: 'Kadagam',
  5: 'Simham', 6: 'Kanni', 7: 'Thulam', 8: 'Viruchigam',
  9: 'Dhanusu', 10: 'Magaram', 11: 'Kumbam', 12: 'Meenam'
};

const numericValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const validRasiNumber = (value: unknown): boolean => {
  const number = numericValue(value);
  return number !== null && Number.isInteger(number) && number >= 1 && number <= 12;
};

const validHouseNumber = (value: unknown): boolean => {
  const number = numericValue(value);
  return number !== null && Number.isInteger(number) && number >= 1 && number <= 12;
};

const displayRasiName = (value: unknown): string =>
  validRasiNumber(value) ? RASI_NAMES_ORDER_MODAL[Number(value)] : 'N/A';

const displayDegree = (value: unknown): string => {
  const number = numericValue(value);
  return number !== null && number >= 0 && number < 30 ? `${number}°` : 'N/A';
};

const displayPada = (value: unknown): string => {
  const number = numericValue(value);
  return number !== null && Number.isInteger(number) && number >= 1 && number <= 4 ? String(number) : 'N/A';
};

interface OrderReportModalProps {
  order: Order;
  isOpen?: boolean;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
  /** Full family bundle when this order belongs to a family package. */
  familyOrders?: Order[];
  /**
   * MULTI-PERSON ORDERS: this modal is showing ONE report of the order.
   * `order` is that report (a one-chart view), while `header` is the real order
   * row used for the tax invoice and for the delivery call, so Preview and Send
   * both work per item while the customer still gets ONE email per order.
   */
  orderItemSend?: { orderId: string; itemId: number; header: Order };
  /** Called after a successful per-item delivery so the admin list can refresh. */
  onItemSent?: (itemId: number) => void;
}

export const OrderReportModal: React.FC<OrderReportModalProps> = ({ order, onClose, onOrderUpdated, familyOrders, orderItemSend, onItemSent }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'predictions' | 'poruthams' | 'babynames'>('overview');
  const [selectedLang, setSelectedLang] = useState<AppLanguage>(() => normalizeReportLanguage(order.language));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLivePdfModalOpen, setIsLivePdfModalOpen] = useState(false);
  const [dynamicResult, setDynamicResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Family-order members are stored before approval without a calculated
  // result. Compute it on the fly (same calculate-preview engine the live PDF
  // preview uses) so the View modal renders the full high-quality report
  // instead of the "Report Pending Calculation" placeholder.
  useEffect(() => {
    setDynamicResult(order.calculatedResult || null);
    if (order.calculatedResult || !order.inputPayload) return;

    let cancelled = false;
    setIsCalculating(true);
    api
      .calculateService(order.serviceType, order.inputPayload)
      .then(res => {
        if (!cancelled && res.success && res.result) {
          setDynamicResult(res.result);
        }
      })
      .catch(err => console.error('Failed to precalculate order report:', err))
      .finally(() => {
        if (!cancelled) setIsCalculating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [order]);

  const result = dynamicResult || order.calculatedResult;
  const isHoroscope = order.serviceType === 'BIRTH_JATHAGAM';
  const isMatchmaking = order.serviceType === 'MARRIAGE_COMPATIBILITY';
  const isBabyNaming = order.serviceType === 'BABY_NAMING';
  const isMuhurtham = order.serviceType === 'MUHURTHAM';

  const isTa = selectedLang === 'ta';
  const isHi = selectedLang === 'hi';
  const resultAny = (result || {}) as any;
  // Saved results from before the engines emitted D9 get their Navamsa filled from
  // the longitudes they already hold, so the chart's D9 view is not empty.
  const chartNavamsa = withDerivedNavamsa(resultAny) as any;
  const chandraRasiLabel = displayRasiName(resultAny.chandraRasiNumber ?? resultAny.chandraRasi);
  const lagnaRasiLabel = displayRasiName(resultAny.lagnaRasiNumber ?? resultAny.lagnaRasi);
  const firstBirthMahadasha = Array.isArray(resultAny.dashaPeriods) ? resultAny.dashaPeriods[0] : undefined;
  const birthMahadashaName = resultAny.dashaBalanceAtBirth?.lordNameEn || firstBirthMahadasha?.lordNameEn || firstBirthMahadasha?.mahadashaLord || 'N/A';
  const birthMahadashaYears = numericValue(resultAny.dashaBalanceAtBirth?.remainingYears ?? firstBirthMahadasha?.years);
  const birthMahadashaYearsText = birthMahadashaYears !== null && birthMahadashaYears >= 0
    ? `${Number(birthMahadashaYears.toFixed(1))} Years Balance`
    : 'N/A';

  const matchupRows = Array.isArray(resultAny.poruthams) ? resultAny.poruthams : [];
  const allMatchupRowsHaveScores = matchupRows.length === 10 && matchupRows.every((p: any) => {
    const earned = numericValue(p?.pointsEarned ?? p?.points);
    const maximum = numericValue(p?.maxPoints);
    return earned !== null && earned >= 0 && maximum !== null && maximum > 0;
  });
  const derivedMaxScore = allMatchupRowsHaveScores
    ? matchupRows.reduce((sum: number, p: any) => sum + Number(p.maxPoints), 0)
    : undefined;
  const derivedTotalScore = allMatchupRowsHaveScores
    ? matchupRows.reduce((sum: number, p: any) => sum + Number(p.pointsEarned ?? p.points), 0)
    : undefined;
  const scoreValue = numericValue(resultAny.totalScore ?? resultAny.score ?? derivedTotalScore);
  const maxScoreValue = numericValue(resultAny.maxScore ?? resultAny.maxPossiblePoints ?? derivedMaxScore);
  const scoreDisplay = scoreValue !== null && scoreValue >= 0 ? String(Number(scoreValue.toFixed(1))) : 'N/A';
  const maxScoreDisplay = maxScoreValue !== null && maxScoreValue > 0 ? String(Number(maxScoreValue.toFixed(1))) : 'N/A';
  const rawMatchedCount = numericValue(resultAny.totalPoruthamsMatched ?? resultAny.matchedCount);
  const countableRows = matchupRows.length === 10 && matchupRows.every((p: any) =>
    ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'].includes(String(p?.status)) || numericValue(p?.pointsEarned ?? p?.points) !== null
  );
  const matchedCount = rawMatchedCount ?? (countableRows
    ? matchupRows.filter((p: any) => {
      const status = String(p?.status || '');
      return ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'].includes(status)
        ? status === 'UTTHAMAM' || status === 'MADHYAMAM'
        : Number(p.pointsEarned ?? p.points) > 0;
    }).length
    : null);
  const matchedCountDisplay = matchedCount !== null && Number.isInteger(matchedCount) && matchedCount >= 0 && matchedCount <= 10
    ? String(matchedCount)
    : 'N/A';
  const verdictStatus = String(resultAny.verdictStatus || '').toUpperCase();
  const verdictKnown = ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'].includes(verdictStatus);
  const verdictPillClass = verdictStatus === 'UTTHAMAM'
    ? 'bg-emerald-500 text-slate-950'
    : verdictStatus === 'MADHYAMAM'
    ? 'bg-amber-400 text-slate-950'
    : verdictStatus === 'PORUNDHADHU'
    ? 'bg-rose-500 text-white'
    : 'bg-slate-500 text-white';
  const verdictSummaryEn = !verdictKnown
    ? 'N/A'
    : verdictStatus === 'UTTHAMAM'
    ? 'Utthamam — this is a good match.'
    : verdictStatus === 'MADHYAMAM'
    ? 'Madhyamam — acceptable with remedies.'
    : 'Adhamam — not recommended; seek a detailed horoscope review before deciding.';

  const handleSendToUserEmail = async () => {
    setIsSendingEmail(true);
    setEmailStatusMsg({
      type: 'success',
      text: 'Preparing the preview-exact report & tax invoice for delivery…'
    });
    try {
      // FAMILY BUNDLE: prepare every preview-quality report and invoice before
      // calling the fulfillment API. A render/upload failure must stop delivery.
      const isFamilyBundle = !!(order.groupId && familyOrders && familyOrders.length > 0);
      if (isFamilyBundle) {
        const memberCount = familyOrders!.length;
        setEmailStatusMsg({
          type: 'success',
          text: `Preparing ${memberCount} preview-quality reports + 1 consolidated invoice...`
        });

        const anyPending = familyOrders!.some(o => {
          const s = (o.status || '').toUpperCase();
          return s === 'PENDING' || s === 'PENDING_APPROVAL';
        });
        // Render every member report + the consolidated invoice in this browser
        // and upload them one document per request (preview-exact quality).
        // No preferredLang: every member keeps the language they ordered in.
        const prepared = await prepareFamilyFulfilPayload(familyOrders!, order.groupId, progress => {
          setEmailStatusMsg({ type: 'success', text: progress.message });
        });
        const familyPayload = prepared.payload;
        const res = anyPending
          ? await api.approveFamilyOrder(order.groupId!, familyPayload)
          : await api.resendFamilyEmail(order.groupId!, familyPayload);

        if (res && res.success) {
          setEmailStatusMsg({
            type: 'success',
            text: `${res.message || `Family package (${memberCount} reports + 1 consolidated invoice) emailed to ${order.userEmail} in ${res.emailPartCount || 1} email(s).`}${describeFamilyRenderQuality(res)}`
          });
          const completedOrder: Order = {
            ...order,
            status: 'COMPLETED',
            emailStatus: 'SENT',
            emailSentAt: new Date().toISOString()
          };
          if (onOrderUpdated) {
            onOrderUpdated(completedOrder);
          }
        } else {
          setEmailStatusMsg({
            type: 'error',
            text: res?.message || `Failed to send family email to ${order.userEmail}`
          });
        }
        return;
      }

      setEmailStatusMsg({
        type: 'success',
        text: `Rendering the preview-exact report & invoice for ${order.userEmail}…`
      });

      // MULTI-PERSON ORDER ITEM: render THIS report from exactly the result the
      // preview is showing (the item's cached result), attach the ORDER invoice,
      // and deliver through the per-item endpoint - never one email per report.
      if (orderItemSend) {
        const item = orderItemSend.itemId
          ? (orderItemSend.header.items || []).find(candidate => candidate.id === orderItemSend.itemId)
          : undefined;
        const chartOrder = item ? orderItemAsOrder(orderItemSend.header, item) : order;
        const pdfs = await prepareOrderItemPdfs(
          orderItemSend.header,
          item || {
            id: orderItemSend.itemId,
            orderId: orderItemSend.header.id,
            serviceCode: chartOrder.serviceType as any,
            unitPrice: Number(chartOrder.amount) || 0,
            reportStatus: 'CALCULATED',
            language: selectedLang,
            inputPayload: chartOrder.inputPayload || {},
            calculatedResult: result
          },
          result,
          selectedLang
        );
        const res: any = await api.sendOrderItemEmail(orderItemSend.orderId, orderItemSend.itemId, {
          reportPdfBase64: pdfs.reportPdfBase64,
          invoicePdfBase64: pdfs.invoicePdfBase64,
          itemId: orderItemSend.itemId,
          language: selectedLang
        });
        if (res && res.success) {
          setEmailStatusMsg({
            type: 'success',
            text: res.message || `Report emailed to ${orderItemSend.header.userEmail} with the order invoice.`
          });
          if (onItemSent) onItemSent(orderItemSend.itemId);
          const updated: Order = {
            ...orderItemSend.header,
            emailStatus: 'SENT',
            status: (res.orderStatus as any) || orderItemSend.header.status
          };
          if (onOrderUpdated) onOrderUpdated(updated);
        } else {
          setEmailStatusMsg({
            type: 'error',
            text: res?.message || `Failed to send this report to ${orderItemSend.header.userEmail}`
          });
        }
        return;
      }

      // The backend attaches these browser-rendered documents AS-IS. If either
      // render or staging fails, let the outer handler report the error and do
      // not call approve/resend with an empty payload.
      const pdfs = await generateOrderPdfsBase64(order, selectedLang, result);
      const fulfilPayload = await deliverOrderPdfPayload(order, { ...pdfs, language: selectedLang });

      let res;
      if (order.status === 'PENDING' || order.status === 'PENDING_APPROVAL') {
        res = await api.approveOrder(order.id, fulfilPayload);
      } else {
        res = await api.resendEmail(order.id, fulfilPayload);
      }

      if (res && res.success) {
        setEmailStatusMsg({
          type: 'success',
          text: `Preview-quality report & tax invoice successfully emailed to ${order.userEmail}! Order marked as COMPLETED.`
        });
        const completedOrder: Order = res.order || {
          ...order,
          status: 'COMPLETED',
          emailStatus: 'SENT',
          emailSentAt: new Date().toISOString()
        };
        if (onOrderUpdated) {
          onOrderUpdated(completedOrder);
        }
      } else {
        setEmailStatusMsg({
          type: 'error',
          text: res?.message || `Failed to send email to ${order.userEmail}`
        });
      }
    } catch (e: any) {
      console.error('Send email error:', e);
      setEmailStatusMsg({
        type: 'error',
        text: e.message || 'Error communicating with mail server'
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  /**
   * Downloads are rendered in this browser from the same report HTML the live
   * PDF preview shows, so the file the customer saves matches the preview
   * instead of the thinner server-side render. Both helpers fall back to the
   * server PDF themselves if this device cannot capture the canvas.
   */
  const handleDownloadPdf = async (langToUse?: AppLanguage) => {
    const lang = langToUse || selectedLang;
    setIsDownloading(true);
    try {
      await exportOrderReportPdf(order, lang, result);
    } catch (err: any) {
      console.error('PDF export failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    try {
      if (orderItemSend) {
        // One invoice per ORDER - the customer paid one total.
        const header = orderItemSend.header;
        const items = (header.items && header.items.length > 0)
          ? header.items
          : [{
              id: orderItemSend.itemId,
              orderId: header.id,
              serviceCode: order.serviceType as any,
              unitPrice: Number(order.amount) || 0,
              reportStatus: 'CALCULATED' as any,
              language: order.language,
              inputPayload: order.inputPayload || {},
              calculatedResult: result
            }];
        await downloadHtmlPdf(buildOrderInvoiceHtmlForItems(header, items), orderInvoiceFileName(header));
      } else if (order.groupId && familyOrders && familyOrders.length > 0) {
        await exportFamilyInvoiceHtmlToPdf(familyOrders, order.groupId);
      } else {
        await exportInvoiceHtmlToPdf(order);
      }
    } catch (e: any) {
      console.error('Invoice download error:', e);
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-wide">
                  ASTRO SIVAM OFFICIAL REPORT
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {order.serviceType.replace(/_/g, ' ')}
                {orderItemSend ? (() => {
                  const items = orderItemSend.header.items || [];
                  const index = items.findIndex(candidate => candidate.id === orderItemSend.itemId);
                  const person = index >= 0 ? items[index].personName : order.inputPayload?.name;
                  return ` • Report ${index >= 0 ? index + 1 : 1}${items.length > 1 ? ` of ${items.length}` : ''}${person ? ` — ${person}` : ''}`;
                })() : ` • Client: ${order.userName} (${order.country})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* 3-Language Selector Bar */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <Languages className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-1" />
              <button
                type="button"
                onClick={() => setSelectedLang('en')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedLang === 'en'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('ta')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedLang === 'ta'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Tamil (தமிழ்)
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang('hi')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedLang === 'hi'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Hindi (हिन्दी)
              </button>
            </div>

            <button
              onClick={() => setIsLivePdfModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 border border-amber-500/40 shadow-sm transition-all active:scale-95"
              title="Preview official PDF in live high-resolution viewer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview PDF</span>
            </button>

            {/* Direct Send to User Button (Only when pending approval OR if completed and email delivery failed) */}
            {(order.status !== 'COMPLETED' || ((order.emailStatus || '').toUpperCase() === 'FAILED' || (order.emailStatus || '').toUpperCase() === 'ERROR')) && (
              <button
                onClick={handleSendToUserEmail}
                disabled={isSendingEmail}
                className={`px-3 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 border cursor-pointer ${
                  order.status === 'COMPLETED'
                    ? 'bg-rose-600 hover:bg-rose-500 border-rose-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40'
                }`}
                title={
                  order.status === 'COMPLETED'
                    ? `Email delivery failed. Click to retry sending report and invoice to ${order.userEmail}`
                    : `Send this exact report and invoice to ${order.userEmail}`
                }
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{order.status === 'COMPLETED' ? 'Resending...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{order.status === 'COMPLETED' ? 'Resend Email' : 'Approve & Email'}</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => handleDownloadPdf(selectedLang)}
              disabled={isDownloading}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title={`Download PDF Report in ${selectedLang === 'ta' ? 'Tamil' : selectedLang === 'hi' ? 'Hindi' : 'English'}`}
            >
              <Download className="w-3.5 h-3.5" />
              {isDownloading ? 'Preparing PDF...' : `Download ${selectedLang === 'ta' ? 'Tamil' : selectedLang === 'hi' ? 'Hindi' : 'English'} PDF`}
            </button>

            <button
              onClick={handleDownloadInvoice}
              disabled={isDownloadingInvoice}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 border border-slate-700"
              title="Download Official Tax Invoice & Payment Receipt PDF"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              {isDownloadingInvoice ? '...' : 'Invoice'}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Email Notification Alert Banner if triggered */}
        {emailStatusMsg && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            emailStatusMsg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
              : 'bg-red-950/90 text-red-200 border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {emailStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{emailStatusMsg.text}</span>
            </div>
            <button
              onClick={() => setEmailStatusMsg(null)}
              className="text-slate-400 hover:text-white text-xs underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'overview'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Overview & Astro Summary
          </button>

          {isHoroscope && (
            <>
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'chart'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Rasi Kundali & Ephemeris
              </button>
              <button
                onClick={() => setActiveTab('predictions')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'predictions'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Predictions & Remedies
              </button>
            </>
          )}

          {isMatchmaking && (
            <button
              onClick={() => setActiveTab('poruthams')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'poruthams'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              10 Poruthams & Kuja Dosha
            </button>
          )}

          {isBabyNaming && (
            <button
              onClick={() => setActiveTab('babynames')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'babynames'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Syllables & Suggested Names
            </button>
          )}

          {isMuhurtham && (
            <button
              onClick={() => setActiveTab('muhurtham')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'muhurtham'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6-Month Muhurtham Dates
            </button>
          )}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 dark:text-slate-200">
          {!result ? (
            <div className="p-8 text-center">
              {isCalculating ? (
                <>
                  <Loader2 className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-spin" />
                  <h4 className="text-sm font-semibold">Rendering High-Quality Report...</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Running live Vedic ephemeris calculations for this order — the same engine as the Live PDF Preview.
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold">Report Pending Calculation</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    This order is currently in &ldquo;{order.status}&rdquo; status. Use &ldquo;Preview PDF&rdquo; to render the live high-quality report and invoice.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Status & Delivery Pill Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          Astrological Calculation Verified
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Dispatched to {order.userEmail} • Lahiri Sidereal Ephemeris
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Mail className="w-3 h-3 mr-1" /> Email {order.emailStatus}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <ShieldCheck className="w-3 h-3 mr-1" /> ASTRO SIVAM Certified
                      </span>
                    </div>
                  </div>

                  {/* Spam Folder Advisory Box */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-950 dark:text-amber-100">Email Delivery Notice:</strong> An automated dispatch with both your <strong>Report PDF</strong> and <strong>Tax Invoice PDF</strong> was sent to <code>{order.userEmail}</code> from <code>admin@astrosivam.com</code>. If you do not see it in your primary Inbox, <strong>please check your Spam or Junk folder</strong> and mark it as &ldquo;Not Spam&rdquo; / add to your contacts list.
                    </div>
                  </div>

                  {/* Service Specific Highlights */}
                  {isHoroscope && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Janma Nakshatra</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {result.janmaNakshatraEn || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500">Pada {displayPada(result.janmaPada)}</div>
                      </div>

                      <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                        <div className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">Moon Sign (Rasi)</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {chandraRasiLabel}
                        </div>
                        <div className="text-[11px] text-slate-500">Chandra Rasi</div>
                      </div>

                      <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <div className="text-[11px] font-semibold text-purple-800 dark:text-purple-300">Ascendant (Lagna)</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {lagnaRasiLabel}
                        </div>
                        <div className="text-[11px] text-slate-500">{displayDegree(result.lagnaDegrees)}</div>
                      </div>

                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Birth Mahadasha</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                          {birthMahadashaName}
                        </div>
                        <div className="text-[11px] text-slate-500">{birthMahadashaYearsText}</div>
                      </div>
                    </div>
                  )}

                  {isMatchmaking && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                        <div>
                          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                            Vedic Matchmaking Result
                          </div>
                          <div className="text-lg font-bold mt-0.5">
                            {matchedCountDisplay} / 10 Poruthams Matched ({scoreDisplay} / {maxScoreDisplay} Points)
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            {verdictSummaryEn}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${verdictPillClass}`}>
                            {verdictKnown ? verdictStatus : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40">
                          <div className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase">Bride</div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{result.brideName}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {displayRasiName(result.brideRasi)} • {result.brideNakshatraNameEn || 'N/A'} (Pada {displayPada(result.bridePada)})
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40">
                          <div className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase">Groom</div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{result.groomName}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {displayRasiName(result.groomRasi)} • {result.groomNakshatraNameEn || 'N/A'} (Pada {displayPada(result.groomPada)})
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isBabyNaming && (
                    <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        Primary Auspicious Starting Syllable for Baby
                      </div>
                      <div className="text-4xl font-extrabold text-slate-900 dark:text-white my-3">
                        {result.primaryPadaInfo?.letterEn || result.startingSyllables?.[0] || 'A'}
                        <span className="text-2xl text-amber-600 font-normal ml-3">
                          ({result.primaryPadaInfo?.letterTa || result.startingSyllables?.[0] || 'அ'} / {result.primaryPadaInfo?.letterHi || result.startingSyllables?.[0] || 'अ'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                        Baby Born under <strong>{result.nakshatraLetters?.nakshatraNameEn}</strong> (Pada {result.janmaPada}) in <strong>{result.chandraRasiNameEn}</strong> sign.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HOROSCOPE CHART */}
              {isHoroscope && activeTab === 'chart' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fade-in">
                  <div className="flex justify-center">
                    <RasiChartSvg
                      lagnaRasiNumber={result.lagnaRasiNumber ?? result.lagnaRasi}
                      lagnaRasi={result.lagnaRasi}
                      planets={chartNavamsa.planetPositions || []}
                      navamsaPositions={chartNavamsa.navamsaPositions}
                      lagnaNavamsaRasi={chartNavamsa.lagnaNavamsaRasi}
                      language={order.language}
                      size={360}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Planetary Ephemeris (Navagrahas)
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                          <tr>
                            <th className="px-3 py-2">Planet</th>
                            <th className="px-3 py-2">Sign</th>
                            <th className="px-3 py-2">Degree</th>
                            <th className="px-3 py-2">Star</th>
                            <th className="px-3 py-2">House</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {(result.planetPositions || []).map((p: any) => {
                            const key = p.planetKey || p.nameEn || p.graha || 'planet';
                            const rasiNumber = p.rasi ?? p.rasiNumber;
                            const rasiName = displayRasiName(rasiNumber);
                            const houseNumber = p.bhavaNumber ?? p.house;
                            const houseLabel = validHouseNumber(houseNumber) ? `House ${Number(houseNumber)}` : 'House N/A';
                            const degreeLabel = displayDegree(p.degrees);
                            const padaLabel = displayPada(p.pada);
                            const starLabel = p.nakshatramEn || p.nakshatra || 'N/A';
                            return (
                              <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400">
                                  {p.nameEn || p.name || p.graha}
                                  {p.isRetrograde && <span className="ml-1 text-rose-500 font-bold" title="Retrograde (Vakra)">(R)</span>}
                                  {p.isCombust && <span className="ml-1 text-orange-500 font-bold" title="Combust (Astangata)">*</span>}
                                  {p.isVargottama && <span className="ml-1 text-emerald-500 font-bold text-[10px]" title="Vargottama (Same sign in Rasi and Navamsa)">[V]</span>}
                                </td>
                                <td className="px-3 py-2">{rasiName}</td>
                                <td className="px-3 py-2">{degreeLabel}</td>
                                <td className="px-3 py-2">{starLabel} (Pada {padaLabel})</td>
                                <td className="px-3 py-2 font-semibold">{houseLabel}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HOROSCOPE PREDICTIONS */}
              {isHoroscope && activeTab === 'predictions' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Health & Vitality</div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{result.summary?.healthEn || 'Not available for this report.'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Wealth & Finance</div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{result.summary?.wealthEn || 'Not available for this report.'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Career & Status</div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{result.summary?.careerEn || 'Not available for this report.'}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Marriage & Relationship</div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{result.summary?.marriageEn || 'Not available for this report.'}</p>
                    </div>
                  </div>

                  {/* Dosha Assessment Box */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <h4 className="text-xs font-bold uppercase text-amber-900 dark:text-amber-300 mb-2">
                      Astrological Doshas & Remedial Guidance
                    </h4>
                    <div className="space-y-3 text-xs">
                      {(result.doshas || []).map((d: any, idx: number) => (
                        <div key={idx} className="border-b border-amber-200/50 dark:border-amber-800/50 pb-2 last:border-none last:pb-0">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                            <span>{d.nameEn}</span>
                            <span className="font-normal text-amber-700 dark:text-amber-400">{d.severityEn}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">{d.descriptionEn}</p>
                          <p className="text-slate-800 dark:text-slate-200 font-medium mt-1">★ Remedy: {d.traditionalRemedyEn}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: MARRIAGE PORUTHAMS */}
              {isMatchmaking && activeTab === 'poruthams' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="px-3 py-2">Porutham</th>
                          <th className="px-3 py-2">Verdict</th>
                          <th className="px-3 py-2">Significance</th>
                          <th className="px-3 py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {(result.poruthams || []).map((p: any, idx: number) => {
                          const key = p.poruthamKey || p.nameEn || p.name || `porutham-${idx}`;
                          const status = String(p.status || p.statusLabel || '').toUpperCase();
                          const statusKnown = ['UTTHAMAM', 'MADHYAMAM', 'PORUNDHADHU'].includes(status);
                          const earnedPoints = numericValue(p.pointsEarned ?? p.points);
                          const maximumPoints = numericValue(p.maxPoints);
                          const pointsText = earnedPoints !== null && earnedPoints >= 0 && maximumPoints !== null && maximumPoints > 0
                            ? `${Number(earnedPoints.toFixed(1))} / ${Number(maximumPoints.toFixed(1))}`
                            : 'N/A / N/A';
                          return (
                            <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{p.nameEn || p.name}</td>
                              <td className="px-3 py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  !statusKnown
                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                    : status === 'UTTHAMAM'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : status === 'MADHYAMAM'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}>
                                  {statusKnown ? status : 'N/A'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{p.explanationEn || p.description || 'N/A'}</td>
                              <td className="px-3 py-2.5 font-semibold text-center">{pointsText}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Clear Final Match Verdict Banner */}
                  {(() => {
                    const isUtthamam = verdictStatus === 'UTTHAMAM';
                    const isMadhyamam = verdictStatus === 'MADHYAMAM';
                    const verdictText = !verdictKnown
                      ? 'N/A'
                      : isUtthamam
                      ? (isTa ? 'இந்தப் பொருத்தம் நல்லது' : isHi ? 'यह अच्छा मिलान है।' : 'This is a good match.')
                      : isMadhyamam
                      ? (isTa ? 'ஏற்றுக்கொள்ளத்தக்க பொருத்தம்; பரிகாரங்களுடன் பொருந்தும்' : isHi ? 'स्वीकार्य मिलान; उपायों के साथ विचारणीय।' : 'Acceptable match; suitable with remedies.')
                      : (isTa
                        ? 'இந்தப் பொருத்தம் சாதகமற்றது; இது ஜோதிட வழிகாட்டல் மட்டுமே. இறுதி முடிவிற்கு முன் விரிவான ஜாதக ஆய்வு மற்றும் நிபுணர் ஆலோசனை பெறவும்.'
                        : isHi
                        ? 'वर्तमान आकलन के अनुसार यह मिलान अनुकूल नहीं है; यह केवल ज्योतिषीय मार्गदर्शन है। निर्णय से पहले विस्तृत कुंडली समीक्षा और विशेषज्ञ सलाह लें।'
                        : 'This match is not recommended on the current assessment; this is astrological guidance only. Seek a detailed horoscope review before deciding.');
                    const verdictTitle = isTa ? 'இறுதி முடிவு' : isHi ? 'अंतिम निर्णय' : 'FINAL VERDICT';
                    const verdictTone = !verdictKnown
                      ? 'slate'
                      : isUtthamam ? 'emerald' : isMadhyamam ? 'amber' : 'rose';
                    const verdictToneStyles = {
                      slate: 'bg-slate-50/90 dark:bg-slate-900/40 border-slate-300/60 text-slate-700 dark:text-slate-300',
                      emerald: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-900 dark:text-emerald-200',
                      amber: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500/40 text-amber-900 dark:text-amber-200',
                      rose: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500/40 text-rose-900 dark:text-rose-200'
                    };
                    const verdictTextStyles = {
                      slate: 'text-slate-700 dark:text-slate-300',
                      emerald: 'text-emerald-700 dark:text-emerald-300',
                      amber: 'text-amber-700 dark:text-amber-300',
                      rose: 'text-rose-700 dark:text-rose-300'
                    };

                    return (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border text-center space-y-1 shadow-sm transition-all ${verdictToneStyles[verdictTone]}`}
                        role="status"
                        aria-label={verdictTitle}
                      >
                        <div className="text-[11px] font-extrabold uppercase tracking-widest opacity-80">
                          {verdictTitle}
                        </div>
                        <div className={`text-base sm:text-lg font-black ${verdictTextStyles[verdictTone]}`}>
                          {verdictText}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 5: BABY NAMING */}
              {isBabyNaming && activeTab === 'babynames' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(result.nakshatraLetters?.padas || []).map((p: any) => (
                      <div
                        key={p.padaNumber}
                        className={`p-3.5 rounded-xl border ${
                          p.padaNumber === result.janmaPada
                            ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase">
                          Pada {p.padaNumber} {p.padaNumber === result.janmaPada ? '★ (Birth Pada)' : ''}
                        </div>
                        <div className="text-2xl font-bold mt-1">{p.letterEn}</div>
                        <div className="text-xs text-slate-500">{p.letterTa} / {p.letterHi}</div>
                      </div>
                    ))}
                  </div>

                  {/* Vedic Gunam & Innate Virtues */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isTa ? 'வேத குணநலன்கள் & சுப பண்புகள்' : isHi ? 'वैदिक शुभ गुण एवं विशेषताएं' : 'Vedic Gunam & Innate Virtues'}</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getGunam(
                        result.nakshatraLetters?.nakshatraNameEn,
                        result.chandraRasiNameEn || result.rasi,
                        selectedLang
                      ).map((trait: string, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2.5">
                          <span className="text-amber-500 font-bold mt-0.5">✦</span>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">{trait}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: MUHURTHAM — six-month auspicious date calendar */}
              {isMuhurtham && activeTab === 'muhurtham' && (
                <div className="space-y-6 animate-fade-in">
                  {(result.months || []).map((month: any, mIdx: number) => (
                    <div key={month.monthKey || mIdx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {month.monthNameEn || month.monthKey}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">BEST {month.bestCount ?? 0}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">GOOD {month.goodCount ?? 0}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">FAIR {month.fairCount ?? 0}</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">AVOID {month.avoidCount ?? 0}</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-[11px]">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <tr>
                              <th className="px-2.5 py-2 text-left font-bold">Date</th>
                              <th className="px-2.5 py-2 text-left font-bold">Tithi</th>
                              <th className="px-2.5 py-2 text-left font-bold">Nakshatra</th>
                              <th className="px-2.5 py-2 text-left font-bold">Nalla Neram</th>
                              <th className="px-2.5 py-2 text-left font-bold">Rahu Kalam</th>
                              <th className="px-2.5 py-2 text-left font-bold">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(month.days || []).map((day: any, dIdx: number) => (
                              <tr
                                key={day.date || dIdx}
                                className={`border-t border-slate-100 dark:border-slate-800 ${
                                  day.grade === 'AVOID' ? 'text-slate-400' : ''
                                }`}
                              >
                                <td className="px-2.5 py-1.5 font-semibold whitespace-nowrap">{day.date}</td>
                                <td className="px-2.5 py-1.5 whitespace-nowrap">{day.tithiNameEn}</td>
                                <td className="px-2.5 py-1.5 whitespace-nowrap">{day.nakshatraNameEn}</td>
                                <td className="px-2.5 py-1.5 whitespace-nowrap">
                                  {(day.nallaNeram || [])
                                    .map((w: any) => (typeof w === 'string' ? w : `${w?.start || ''}-${w?.end || ''}`))
                                    .filter((v: string) => v && v !== '-')
                                    .join(', ') || '—'}
                                </td>
                                <td className="px-2.5 py-1.5 whitespace-nowrap">
                                  {day.rahuKalam
                                    ? (typeof day.rahuKalam === 'string'
                                      ? day.rahuKalam
                                      : `${day.rahuKalam.start || ''}-${day.rahuKalam.end || ''}`)
                                    : '—'}
                                </td>
                                <td className="px-2.5 py-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      day.grade === 'BEST'
                                        ? 'bg-emerald-600 text-white'
                                        : day.grade === 'GOOD'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : day.grade === 'FAIR'
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    }`}
                                  >
                                    {day.grade}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {(!result.months || result.months.length === 0) && (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No muhurtham calendar is stored for this order yet.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Official ASTRO SIVAM Certification Report • Strict Client Privacy</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* High-Resolution Live PDF Preview Modal */}
      {isLivePdfModalOpen && (
        <LivePdfPreviewModal
          isOpen={isLivePdfModalOpen}
          onClose={() => setIsLivePdfModalOpen(false)}
          serviceType={order.serviceType}
          order={order}
          familyOrders={familyOrders}
          result={result}
          initialLang={selectedLang}
          title={`ORDER #${order.orderNumber} LIVE PDF PREVIEW (${order.userName})`}
          sourceContext="order_inspection"
          onOrderUpdated={onOrderUpdated}
        />
      )}
    </div>
  );
};
