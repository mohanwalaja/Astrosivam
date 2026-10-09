/**
 * Multi-person order items - shared Preview/Send helpers.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A multi-person order stores one `order_items` row per report (person +
 * service). The admin must be able to Preview and Send every report on its own,
 * and both must always show the SAME numbers.
 *
 * `getOrCalculateResult()` is that single source of truth: it returns the item's
 * cached result and only asks the server to calculate (and cache) when the item
 * has none. Preview calls it, Send calls it, so they cannot drift apart.
 *
 * The PDF helpers below reuse the existing preview-exact pipeline
 * (`buildOrderReportHtml` + html2canvas/jsPDF) so a sent report is the same
 * document the admin previewed, and the invoice is the ORDER invoice (the
 * customer paid one total), with the same multi-line invoice the family flow
 * already uses.
 */

import { AppLanguage, Order, OrderItem, ServiceType } from '../types';
import { api } from './api';
import {
  EMAIL_RENDER_OPTIONS,
  assertPreviewQualityPdfBase64,
  buildOrderReportHtml,
  generatePdfBase64FromHtml,
  mergeOrderPayloadIntoResult,
  orderReportFileName,
  orderInvoiceFileName,
  yieldToBrowser
} from './jathagamPdfExporter';
import { buildInvoiceHtml, buildFamilyInvoiceHtml } from './invoiceHtmlBuilder';

export interface OrderItemResult {
  result: any;
  item: OrderItem;
  recalculated: boolean;
  message?: string;
}

/**
 * THE cache-read-through for one report.
 *
 * 1. An item that already carries `calculatedResult` (written at order creation
 *    or by an earlier Preview) is used as-is.
 * 2. Otherwise the admin API recalculates from the item's own payload and
 *    CACHES it on `order_items.calculated_result`.
 *
 * Both the Preview modal and the Send buttons call this, which is what keeps
 * "what the admin saw" and "what the customer received" identical.
 */
export async function getOrCalculateResult(orderId: string, item: OrderItem): Promise<OrderItemResult> {
  if (item.calculatedResult) {
    return { result: item.calculatedResult, item, recalculated: false };
  }
  const res = await api.getOrderItemResult(orderId, item.id);
  if (res.success && res.result) {
    return {
      result: res.result,
      item: { ...item, calculatedResult: res.result, reportStatus: res.item?.reportStatus || item.reportStatus },
      recalculated: res.recalculated !== false
    };
  }
  throw new Error(res.message || 'This report could not be calculated.');
}

/** A one-chart order view of an item - used by every existing report builder. */
export function orderItemAsOrder(header: Order, item: OrderItem): Order {
  return {
    ...header,
    serviceType: item.serviceCode as ServiceType,
    language: item.language,
    inputPayload: item.inputPayload || {},
    calculatedResult: item.calculatedResult,
    amount: item.unitPrice
  };
}

/** The order's tax invoice, as HTML: one line per report (one order, one total). */
export function buildOrderInvoiceHtmlForItems(header: Order, items: OrderItem[]): string {
  if (items.length <= 1) {
    // One report -> the official single-service invoice, unchanged.
    return buildInvoiceHtml({ ...header, language: 'en' });
  }
  const pseudoOrders: Order[] = items.map(item =>
    orderItemAsOrder(header, item)
  );
  return buildFamilyInvoiceHtml(pseudoOrders, header.orderNumber || header.id);
}

/**
 * Renders one item's report + the order invoice to base64 PDFs, using the same
 * preview-exact pipeline as the live preview.
 */
export async function prepareOrderItemPdfs(
  header: Order,
  item: OrderItem,
  result: any,
  lang?: AppLanguage
): Promise<{ reportPdfBase64: string; invoicePdfBase64: string; reportFileName: string; invoiceFileName: string }> {
  const chartOrder = orderItemAsOrder(header, item);
  const effectiveLang = (lang || item.language || 'ta') as AppLanguage;
  const reportHtml = buildOrderReportHtml(chartOrder, mergeOrderPayloadIntoResult(chartOrder, result), effectiveLang);
  if (!reportHtml) {
    throw new Error(`No report template exists for ${item.serviceCode}. Nothing was emailed.`);
  }
  // The invoice always describes the WHOLE order (the customer paid one total),
  // even when only this one report is being emailed.
  const invoiceHtml = buildOrderInvoiceHtmlForItems(
    header,
    header.items && header.items.length > 0 ? header.items : [item]
  );

  const reportPdfBase64 = await generatePdfBase64FromHtml(reportHtml, EMAIL_RENDER_OPTIONS);
  assertPreviewQualityPdfBase64(reportPdfBase64, 'Report PDF', 8 * 1024);
  await yieldToBrowser();
  const invoicePdfBase64 = await generatePdfBase64FromHtml(invoiceHtml, EMAIL_RENDER_OPTIONS);
  assertPreviewQualityPdfBase64(invoicePdfBase64, 'Invoice PDF', 8 * 1024);

  return {
    reportPdfBase64,
    invoicePdfBase64,
    reportFileName: orderReportFileName(chartOrder, effectiveLang),
    invoiceFileName: orderInvoiceFileName(header)
  };
}

/**
 * Renders EVERY report of an order (plus the order invoice ONCE) and returns the
 * payload the admin send endpoints expect. One report per item, one invoice per
 * order - exactly the delivery rule for multi-person orders.
 */
export async function prepareOrderItemsSendPayload(
  header: Order,
  items: OrderItem[],
  onProgress?: (message: string, index: number, total: number) => void
): Promise<{
  reportPdfs: Array<{ itemId: number; fileName: string; pdfBase64: string }>;
  invoicePdfBase64: string;
  invoiceFileName: string;
}> {
  const reportPdfs: Array<{ itemId: number; fileName: string; pdfBase64: string }> = [];
  let invoicePdfBase64 = '';
  let invoiceFileName = orderInvoiceFileName(header);
  const total = items.length;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const label = item.personName || `Report ${index + 1}`;
    if (onProgress) onProgress(`Rendering report ${index + 1} of ${total} (${label})…`, index, total);

    const calculated = await getOrCalculateResult(header.id, item);
    const chartOrder = orderItemAsOrder(header, calculated.item);

    const reportHtml = buildOrderReportHtml(
      chartOrder,
      mergeOrderPayloadIntoResult(chartOrder, calculated.result),
      (calculated.item.language || 'ta') as AppLanguage
    );
    if (!reportHtml) {
      throw new Error(`No report template exists for ${calculated.item.serviceCode}. Nothing was emailed.`);
    }
    const pdfBase64 = await generatePdfBase64FromHtml(reportHtml, EMAIL_RENDER_OPTIONS);
    assertPreviewQualityPdfBase64(pdfBase64, 'Report PDF', 8 * 1024);
    reportPdfs.push({
      itemId: calculated.item.id,
      fileName: orderReportFileName(chartOrder, (calculated.item.language || 'ta') as AppLanguage),
      pdfBase64
    });

    // The invoice is the order's document: render it once, from the first item.
    if (index === 0) {
      invoiceFileName = orderInvoiceFileName(header);
      const invoiceHtml = buildOrderInvoiceHtmlForItems(header, items);
      invoicePdfBase64 = await generatePdfBase64FromHtml(invoiceHtml, EMAIL_RENDER_OPTIONS);
      assertPreviewQualityPdfBase64(invoicePdfBase64, 'Invoice PDF', 8 * 1024);
    }
    await yieldToBrowser();
  }

  return { reportPdfs, invoicePdfBase64, invoiceFileName };
}
