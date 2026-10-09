import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Download, Eye, Languages, Sparkles, AlertCircle, RefreshCw, FileText, CheckCircle2, Mail, Send, RotateCcw } from 'lucide-react';
import { AppLanguage, Order } from '../../types';
import { api } from '../../services/api';
import {
  downloadHtmlPdf,
  downloadPreviewPagesPdf,
  downloadFromServerUrl,
  deliverOrderPdfPayload,
  generateOrderPdfsBase64,
  prepareFamilyFulfilPayload,
  getFamilyGroupId,
  mergeOrderPayloadIntoResult,
  resultNeedsRecalculation,
  canonicalCalculationPayload
} from '../../services/jathagamPdfExporter';
import { buildJathagamHtml } from '../../services/jathagamHtmlBuilder';
import { buildWeddingMatchHtml } from '../../services/weddingHtmlBuilder';
import { buildBabyNamingHtml } from '../../services/babyNamingHtmlBuilder';
import { buildMuhurthamHtml, MuhurthamScanResult } from '../../services/muhurthamHtmlBuilder';
import { buildInvoiceHtml, buildFamilyInvoiceHtml } from '../../services/invoiceHtmlBuilder';
import { describeFamilyRenderQuality } from '../../services/formatUtils';
import { warmReportFonts } from '../../services/reportFonts';
import { applySampleWatermark, SAMPLE_BANNER, sampleDetailsLine, sampleReportFileName, sampleReportTitle, type SampleServiceType } from '../../services/sampleReports';
import { normalizeReportLanguage } from '../../services/reportLanguage';

export interface LivePdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: 'BIRTH_JATHAGAM' | 'MARRIAGE_COMPATIBILITY' | 'BABY_NAMING' | 'MUHURTHAM' | 'INVOICE';
  result?: any;
  order?: Order;
  /** Full family bundle (when this order / invoice belongs to a family package). */
  familyOrders?: Order[];
  initialLang?: AppLanguage;
  title?: string;
  sourceContext?: 'user_testing' | 'admin_testing' | 'order_inspection';
  onOrderUpdated?: (order: Order) => void;
  /**
   * SAMPLE MODE — this preview shows the fixed public sample report (built from
   * the fixed 01 Jan 2000, 2:00 AM, Chennai details), never customer data.
   * Every page is watermarked "SAMPLE" and the modal explains the sample.
   */
  sampleMode?: boolean;
  /** One-line description of the fixed sample details, shown in sample mode. */
  sampleDetails?: string;
}

export const LivePdfPreviewModal: React.FC<LivePdfPreviewModalProps> = ({
  isOpen,
  onClose,
  serviceType,
  result,
  order,
  familyOrders,
  initialLang = 'ta',
  title,
  sourceContext = 'user_testing',
  onOrderUpdated,
  sampleMode = false,
  sampleDetails
}) => {
  const [selectedLang, setSelectedLang] = useState<AppLanguage>(() => normalizeReportLanguage(initialLang));
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(0.9);
  /**
   * The iframe that is SHOWING the report. Its DOM nodes — not a re-parsed copy
   * of the HTML string — are what the download captures, so the saved PDF is
   * literally the preview (same fonts, same line breaks, same pagination).
   */
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [dynamicallyCalculated, setDynamicallyCalculated] = useState<any>(null);
  const [dynamicallyCalculatedOrderKey, setDynamicallyCalculatedOrderKey] = useState<string>('');
  const [calculationStatus, setCalculationStatus] = useState<string>('');
  const [downloadNote, setDownloadNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedLang(normalizeReportLanguage(initialLang));
      setDownloadNote('');
      // Warm the report webfonts while the visitor is reading, so the first
      // download does not race the font download.
      warmReportFonts();
    }
  }, [isOpen, initialLang]);

  useEffect(() => {
    setDynamicallyCalculated(null);
    setCalculationStatus('');
    setPreviewHtml('');
  }, [order?.id, serviceType]);

  const calculationOrderKey = `${order?.id ?? 'preview'}:${serviceType}`;
  const matchingDynamicResult = dynamicallyCalculatedOrderKey === calculationOrderKey
    ? dynamicallyCalculated
    : null;

  // A freshly recalculated result must take precedence. If a persisted result
  // is stale (including a Muhurtham scan for another location/month/version),
  // do not render it while recalculation is pending or if it fails.
  const currentCandidate = matchingDynamicResult || result || order?.calculatedResult;
  const rawResult = order && currentCandidate && resultNeedsRecalculation(order, currentCandidate)
    ? null
    : currentCandidate;

  useEffect(() => {
    if (!isOpen || !order) return;
    if (serviceType === 'INVOICE') {
      setCalculationStatus('');
      return;
    }

    const currentRes = matchingDynamicResult || result || order.calculatedResult;
    if (!resultNeedsRecalculation(order, currentRes)) {
      setCalculationStatus('');
      return;
    }

    if (!order.inputPayload) {
      setDynamicallyCalculated(null);
      setCalculationStatus('This saved result is outdated and saved report inputs are missing. The stale result is not being shown.');
      return;
    }

    let cancelled = false;
    setDynamicallyCalculated(null);
    setCalculationStatus('Refreshing this report from the saved birth particulars…');
    fetch('/api/services/calculate-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType,
        // Saved rows may hold a legacy 12-hour birth time ('6:30 PM'); the
        // engines only accept the canonical 24-hour wall clock.
        payload: canonicalCalculationPayload(order.inputPayload)
      })
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && data.result && !resultNeedsRecalculation(order, data.result)) {
          setDynamicallyCalculatedOrderKey(calculationOrderKey);
          setDynamicallyCalculated(data.result);
          setCalculationStatus('');
          return;
        }
        setDynamicallyCalculated(null);
        setCalculationStatus(data.message || 'This report could not be safely recalculated from its saved inputs. The stale result is not being shown.');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to precalculate live preview for order:', err);
        setDynamicallyCalculated(null);
        setCalculationStatus('This report could not be safely recalculated from its saved inputs. The stale result is not being shown.');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, order, result, serviceType, matchingDynamicResult, calculationOrderKey]);
  const effectiveResult = useMemo(() => {
    if (!rawResult) return null;
    return order ? mergeOrderPayloadIntoResult(order, rawResult) : rawResult;
  }, [rawResult, order]);

  // Build the live HTML preview string based on the user's details and active language
  useEffect(() => {
    if (!isOpen) return;

    try {
      let html = '';
      if (serviceType === 'BIRTH_JATHAGAM' && effectiveResult) {
        html = buildJathagamHtml(effectiveResult, selectedLang);
      } else if (serviceType === 'MARRIAGE_COMPATIBILITY' && effectiveResult) {
        html = buildWeddingMatchHtml(effectiveResult, selectedLang, { orderNumber: order?.orderNumber });
      } else if (serviceType === 'BABY_NAMING' && effectiveResult) {
        html = buildBabyNamingHtml(effectiveResult, selectedLang);
      } else if (serviceType === 'MUHURTHAM' && effectiveResult) {
        html = buildMuhurthamHtml(effectiveResult as MuhurthamScanResult, selectedLang);
      } else if (serviceType === 'INVOICE' && order) {
        // Family bundle → the consolidated family tax invoice rendered in the
        // exact same high-quality design as the single-order tax invoice.
        if (familyOrders && familyOrders.length > 0) {
          html = buildFamilyInvoiceHtml(familyOrders, getFamilyGroupId(familyOrders));
        } else {
          html = buildInvoiceHtml({ ...order, language: 'en' });
        }
      }
      // Public samples carry a light per-page "SAMPLE" watermark so they can
      // never be mistaken for a paid report — inside the preview and inside
      // every downloaded copy, because the watermark lives in the report HTML.
      setPreviewHtml(sampleMode && html ? applySampleWatermark(html) : html);
    } catch (err) {
      console.error('Failed to build PDF preview HTML:', err);
      setPreviewHtml('');
    }
  }, [isOpen, serviceType, effectiveResult, order, familyOrders, selectedLang, sampleMode]);

  if (!isOpen) return null;

  const handleSendToUserEmail = async () => {
    if (!order) return;
    setIsSendingEmail(true);
    setEmailStatusMsg({
      type: 'success',
      text: 'Preparing the preview-exact report & tax invoice for delivery…'
    });
    try {
      // FAMILY BUNDLE: render + deliver the whole group in preview quality
      const familyGroupId = familyOrders && familyOrders.length > 0 ? getFamilyGroupId(familyOrders) : null;
      if (familyGroupId && familyOrders) {
        const memberCount = familyOrders.length;
        setEmailStatusMsg({
          type: 'success',
          text: `Preparing ${memberCount} preview-quality reports + 1 consolidated invoice...`
        });

        const anyPending = familyOrders.some(o => {
          const s = (o.status || '').toUpperCase();
          return s === 'PENDING' || s === 'PENDING_APPROVAL';
        });

        // Render every member report + the consolidated invoice in this browser
        // (preview-exact quality) and upload them one document per request.
        // No preferredLang: every member keeps the language they ordered in.
        const prepared = await prepareFamilyFulfilPayload(familyOrders, familyGroupId, progress => {
          setEmailStatusMsg({ type: 'success', text: progress.message });
        });
        const familyPayload = prepared.payload;
        const res = anyPending
          ? await api.approveFamilyOrder(familyGroupId, familyPayload)
          : await api.resendFamilyEmail(familyGroupId, familyPayload);

        if (res && res.success) {
          setEmailStatusMsg({
            type: 'success',
            text: `${res.message || `Family package (${memberCount} reports + 1 consolidated invoice) emailed to ${order?.userEmail || 'customer'} in ${res.emailPartCount || 1} email(s).`}${describeFamilyRenderQuality(res)}`
          });
          if (onOrderUpdated && order) {
            onOrderUpdated({ ...order, status: 'COMPLETED', emailStatus: 'SENT', emailSentAt: new Date().toISOString() });
          }
        } else {
          setEmailStatusMsg({
            type: 'error',
            text: res?.message || 'Failed to send the family package email'
          });
        }
        return;
      }

      // SINGLE ORDER: render the report + invoice the admin is looking at and
      // hand them to the backend, which attaches them AS-IS. A browser capture
      // or upload failure stops fulfillment; no server-rendered substitute is sent.
      setEmailStatusMsg({
        type: 'success',
        text: `Rendering the preview-exact report & invoice for ${order.userEmail}…`
      });

      const pdfs = await generateOrderPdfsBase64(order, selectedLang, effectiveResult);
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

  /** Filename shown in the visitor's downloads list. */
  const previewFileName = (): string => {
    // Samples always download under a `Sample` name, in the chosen language.
    if (sampleMode && serviceType !== 'INVOICE') {
      return sampleReportFileName(serviceType, selectedLang);
    }
    const who = order ? (order.orderNumber || order.id) : 'Preview';
    if (serviceType === 'INVOICE') {
      return familyOrders && familyOrders.length > 0
        ? `ASTRO_SIVAM_Family_Invoice_${getFamilyGroupId(familyOrders)}.pdf`
        : `ASTRO_SIVAM_Invoice_${who}.pdf`;
    }
    return `ASTRO_SIVAM_${serviceType}_${who}_${selectedLang}.pdf`;
  };

  /**
   * The download must be the preview. Rendering `previewHtml` — the very string
   * the iframe above is showing — with the browser's html2canvas + jsPDF
   * pipeline produces a print-resolution PDF that is pixel-identical to the
   * preview, instead of the separate (and visibly thinner) server-side render.
   *
   * The server renderers are kept purely as a fallback for devices that cannot
   * capture the canvas (very low memory, blocked canvas APIs).
   */
  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadNote('Rendering the report you see above at print resolution — this takes a few seconds…');
    try {
      if (!previewHtml) {
        throw new Error('The preview has no content to render yet.');
      }
      // 1. BEST: photograph the live preview itself. The iframe has already
      //    loaded the webfonts, applied the gradients and laid the pages out —
      //    capturing those exact nodes makes the download identical to what the
      //    visitor sees, by construction.
      const livePages = getLivePreviewPages();
      if (livePages.length > 0) {
        try {
          await downloadPreviewPagesPdf(livePages, previewFileName());
          setDownloadNote('');
          return;
        } catch (liveError: any) {
          console.warn('Live-preview capture failed, retrying from the report HTML:', liveError);
        }
      }
      // 2. Equivalent fallback: the very same HTML string the iframe is showing,
      //    rendered off-screen with the same html2canvas pipeline (now font-safe).
      await downloadHtmlPdf(previewHtml, previewFileName());
      setDownloadNote('');
      return;
    } catch (e: any) {
      console.error('Preview-exact download failed, falling back to the server renderer:', e);
      setDownloadNote(
        'This device could not capture the high-resolution copy, so the server-rendered PDF was downloaded instead.'
      );
      try {
        if (serviceType === 'INVOICE') {
          if (familyOrders && familyOrders.length > 0) {
            downloadFromServerUrl(`/api/admin/family-orders/${getFamilyGroupId(familyOrders)}/invoice-pdf`);
          } else if (order) {
            downloadFromServerUrl(`/api/admin/orders/${order.id}/invoice`);
          }
        } else if (order) {
          downloadFromServerUrl(`/api/admin/orders/${order.id}/pdf?lang=${selectedLang}`);
        } else if (effectiveResult) {
          const res = await fetch('/api/services/export-preview-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceType,
              result: effectiveResult,
              language: selectedLang,
              inputPayload: order?.inputPayload
            })
          });
          if (!res.ok) {
            throw new Error('Failed to generate preview PDF from server');
          }
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = previewFileName();
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        }
      } catch (fallbackError) {
        console.error('Server fallback download failed too:', fallbackError);
        setDownloadNote('The PDF could not be generated. Please try again, or use a desktop browser.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * The A4 pages currently rendered inside the preview iframe, in order.
   * Returns an empty array whenever the iframe is not ready (or the document is
   * not reachable), in which case the caller renders from the HTML string.
   */
  const getLivePreviewPages = (): HTMLElement[] => {
    try {
      const doc = previewFrameRef.current?.contentDocument;
      if (!doc || !doc.body) return [];
      return Array.from(doc.querySelectorAll<HTMLElement>('.page'));
    } catch (frameError) {
      console.warn('Could not read the live preview frame:', frameError);
      return [];
    }
  };

  const getServiceName = () => {
    switch (serviceType) {
      case 'BIRTH_JATHAGAM':
        return 'Birth Jathagam / Vedic Horoscope';
      case 'MARRIAGE_COMPATIBILITY':
        return 'Thirumana Porutham / Marriage Compatibility';
      case 'BABY_NAMING':
        return 'Vedic Baby Naming Certificate';
      case 'MUHURTHAM':
        return 'Subha Muhurtham / 6-Month Auspicious Dates';
      case 'INVOICE':
        return 'Tax Invoice & Payment Receipt';
      default:
        return 'Astrology Report';
    }
  };

  const sampleTitle = sampleMode ? sampleReportTitle(serviceType as SampleServiceType, selectedLang) : title;
  const localizedSampleDetails = sampleMode ? sampleDetailsLine(serviceType as SampleServiceType, selectedLang) : sampleDetails;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col shadow-2xl overflow-hidden text-white">
        
        {/* Header Toolbar */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {sampleTitle || `LIVE PDF PREVIEW — ${getServiceName()}`}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{sampleMode ? 'Public Sample Report' : 'Interactive Test Preview'}</span>
                </span>
                {order && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {order.orderNumber}
                  </span>
                )}
                {familyOrders && familyOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Family Package ({familyOrders.length} Members)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Brand: <strong>astrosivam.com</strong>{' '}
                {order?.userEmail
                  ? `• Customer: ${order.userName} (${order.userEmail})`
                  : sampleMode
                  ? '• Public sample report (no customer data)'
                  : '• admin@astrosivam.com'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* 3-Language Selector Bar (Active for astrological reports; Invoices are strictly in English) */}
            {serviceType === 'INVOICE' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-amber-300 font-semibold">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Format: <strong>English (Official Tax Document)</strong></span>
              </div>
            ) : (
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
            )}

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-xs gap-1">
              <button
                type="button"
                onClick={() => setZoomScale(s => Math.max(0.6, s - 0.1))}
                className="px-1.5 py-0.5 hover:text-amber-400 font-bold"
              >
                -
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale(s => Math.min(1.2, s + 0.1))}
                className="px-1.5 py-0.5 hover:text-amber-400 font-bold"
              >
                +
              </button>
            </div>

            {/* Direct Send to User Button (When inspecting an order: only if pending OR if completed and email delivery failed) */}
            {order && (order.status !== 'COMPLETED' || ((order.emailStatus || '').toUpperCase() === 'FAILED' || (order.emailStatus || '').toUpperCase() === 'ERROR')) && (
              <button
                onClick={handleSendToUserEmail}
                disabled={isSendingEmail}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 border cursor-pointer ${
                  order.status === 'COMPLETED'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
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
                    <span>{order.status === 'COMPLETED' ? 'Resending...' : 'Sending to User...'}</span>
                  </>
                ) : (
                  <>
                    {order.status === 'COMPLETED' ? <RotateCcw className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{order.status === 'COMPLETED' ? 'Resend Email' : 'Send to Customer Email'}</span>
                  </>
                )}
              </button>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || !previewHtml}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Downloads exactly what this preview shows — same fonts, same layout, print resolution"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Rendering print-quality PDF…' : 'Download PDF (exactly this preview)'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sample-report banner — explains the fixed example details */}
        {sampleMode && (
          <div className="flex flex-col gap-1 border-b border-amber-800 bg-amber-950/70 px-5 py-2.5 text-[11px] text-amber-100 shrink-0">
            <div className="flex items-center gap-2 font-bold text-amber-200">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>{SAMPLE_BANNER[selectedLang].title}</span>
            </div>
            {localizedSampleDetails && <p className="font-medium text-amber-300/90">{localizedSampleDetails}</p>}
            <p className="text-amber-200/80">{SAMPLE_BANNER[selectedLang].note}</p>
          </div>
        )}

        {/* Download progress / fallback banner */}
        {downloadNote && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-800 bg-amber-950/70 px-5 py-2 text-[11px] font-semibold text-amber-200">
            <div className="flex items-center gap-2">
              {isDownloading ? (
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>{downloadNote}</span>
            </div>
            <button
              onClick={() => setDownloadNote('')}
              className="ml-2 shrink-0 text-[11px] text-amber-300 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Email Notification Alert Banner if triggered */}
        {emailStatusMsg && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
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

        {/* Preview Frame Body */}
        <div className="flex-1 bg-slate-950/90 overflow-y-auto p-4 sm:p-8 flex justify-center items-start">
          {!previewHtml ? (
            <div className="text-center py-20 text-slate-400 space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-200">
                {sampleMode ? 'Sample Report Unavailable' : 'No Calculation Data Available for Preview'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {calculationStatus || (sampleMode
                  ? 'The sample report could not be prepared right now. Please close this window and try again.'
                  : 'Please enter your birth or matching details in the form to generate the live preview.')}
              </p>
            </div>
          ) : (
            <div
              className="shadow-2xl rounded-sm transition-transform origin-top flex flex-col items-center"
              style={{
                width: '210mm',
                transform: `scale(${zoomScale})`,
              }}
            >
              <iframe
                ref={previewFrameRef}
                title="Live PDF Report Preview"
                sandbox="allow-same-origin"
                srcDoc={previewHtml}
                className="w-[210mm] border-0 rounded-sm bg-white"
                style={{
                  width: '210mm',
                  minHeight: '610mm',
                  height: '610mm',
                  display: 'block'
                }}
              />
            </div>
          )}
        </div>

        {/* Footer Info Bar */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {sampleMode ? (
              <span>{SAMPLE_BANNER[selectedLang].title} — {localizedSampleDetails || 'fixed example details'}</span>
            ) : (
              <span>100% Dynamic calculation as per submitted user details</span>
            )}
            {order && <span className="text-slate-500">| Target recipient: <strong className="text-amber-300">{order.userEmail}</strong></span>}
          </div>
          <div>
            <span>Language: <strong className="text-amber-400 uppercase">{serviceType === 'INVOICE' ? 'EN (Official Tax Document)' : selectedLang}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
};

