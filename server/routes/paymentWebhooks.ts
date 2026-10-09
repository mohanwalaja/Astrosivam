/**
 * ASTRO SIVAM — payment provider webhooks.
 *
 * Mounted with a raw body parser (see server.ts) because Razorpay signs the
 * exact bytes it sent: parsing/re-serialising JSON would invalidate the HMAC.
 *
 * Endpoints
 *   GET  /api/payment/webhook/health          readiness probe (no secrets)
 *   POST /api/payment/webhook/razorpay        payment.captured / order.paid
 *   POST /api/payment/webhook/paypal          PAYMENT.CAPTURE.COMPLETED
 *
 * Responses are 2xx whenever we have accepted responsibility for the event —
 * including "ignored" and "already processed" — so the provider stops retrying.
 * A signature that cannot be verified is 4xx (never silently accepted).
 */
import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/store.js';
import { resolveClientIp } from '../security/clientIp.js';
import {
  buildOnlinePaymentReference,
  captureVerifiedIntent,
  getProviderCredentials,
  paymentPrefixForIntent,
  verifyPayPalWebhookSignature,
  verifyRazorpayWebhookSignature
} from '../services/paymentReconciliation.js';

export const paymentWebhookRouter = Router();

function payloadDigest(rawBody: Buffer | string): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
}

function readRawBody(req: Request): Buffer {
  const body: any = req.body;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  // express.raw was not applied (e.g. wrong content-type) — treat as empty so the
  // signature check fails closed instead of trusting parsed JSON.
  return Buffer.alloc(0);
}

function parseJsonBody(rawBody: Buffer): any | null {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
}

// GET /api/payment/webhook/health
paymentWebhookRouter.get('/health', (_req: Request, res: Response) => {
  const creds = getProviderCredentials();
  res.json({
    success: true,
    service: 'ASTRO SIVAM payment webhooks',
    providers: {
      razorpay: { checkout: !!creds.razorpay, webhookVerification: !!creds.razorpay?.webhookSecret },
      paypal: { checkout: !!creds.paypal, webhookVerification: !!creds.paypal?.webhookId }
    }
  });
});

// POST /api/payment/webhook/razorpay
paymentWebhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  const rawBody = readRawBody(req);
  const signature = String(req.headers['x-razorpay-signature'] || '');
  const eventId = String(req.headers['x-razorpay-event-id'] || '');
  const creds = getProviderCredentials().razorpay;

  if (!creds?.webhookSecret) {
    console.warn('[Payment Webhook] Razorpay webhook secret is not configured; event rejected.');
    res.status(503).json({
      success: false,
      message: 'Razorpay webhook verification is not configured on this server.'
    });
    return;
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, creds.webhookSecret)) {
    console.warn('[Payment Webhook] Rejected Razorpay event with an invalid signature.');
    db.recordPaymentWebhookEvent({
      provider: 'razorpay',
      externalEventId: eventId || `invalid-${payloadDigest(rawBody)}`,
      eventType: 'signature.invalid',
      status: 'REJECTED',
      detail: 'Signature verification failed.',
      payloadDigest: payloadDigest(rawBody),
      ip: resolveClientIp(req)
    });
    res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    return;
  }

  const event = parseJsonBody(rawBody);
  if (!event) {
    res.status(400).json({ success: false, message: 'Webhook body was not valid JSON.' });
    return;
  }

  const eventType = String(event?.event || 'unknown');
  const payment = event?.payload?.payment?.entity || {};
  const order = event?.payload?.order?.entity || {};
  const gatewayOrderId = String(payment?.order_id || order?.id || '');
  const gatewayPaymentId = String(payment?.id || '');
  const digest = payloadDigest(rawBody);
  const duplicateKey = eventId || `${eventType}:${gatewayPaymentId || gatewayOrderId || digest}`;

  const finish = (status: 'PROCESSED' | 'IGNORED' | 'MISMATCH' | 'UNKNOWN_INTENT', detail: string) => {
    const { duplicate } = db.recordPaymentWebhookEvent({
      provider: 'razorpay',
      externalEventId: duplicateKey,
      eventType,
      status,
      intentId: undefined,
      gatewayOrderId: gatewayOrderId || undefined,
      gatewayPaymentId: gatewayPaymentId || undefined,
      detail,
      payloadDigest: digest,
      ip: resolveClientIp(req)
    });
    res.json({ success: true, processed: status === 'PROCESSED', duplicate, status, message: detail });
  };

  if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
    finish('IGNORED', `Event ${eventType} does not change payment state.`);
    return;
  }
  if (!gatewayOrderId) {
    finish('IGNORED', 'Event carried no gateway order reference.');
    return;
  }

  const intent = db.getPaymentIntentByGatewayOrderId(gatewayOrderId);
  if (!intent) {
    finish('UNKNOWN_INTENT', `No payment intent matches Razorpay order ${gatewayOrderId}.`);
    return;
  }

  const paidAmount = Number(payment?.amount || 0) / 100;
  const paidCurrency = String(payment?.currency || '').toUpperCase();
  if (String(payment?.status || '').toLowerCase() !== 'captured') {
    finish('IGNORED', `Razorpay payment status is ${payment?.status || 'unknown'}; not captured.`);
    return;
  }
  if (Math.abs(paidAmount - Number(intent.amount)) > 0.009 || (paidCurrency && paidCurrency !== String(intent.currency).toUpperCase())) {
    finish(
      'MISMATCH',
      `Razorpay paid ${paidCurrency} ${paidAmount.toFixed(2)} but intent ${intent.id} is ${intent.currency} ${Number(intent.amount).toFixed(2)}. Nothing was captured.`
    );
    return;
  }

  const outcome = captureVerifiedIntent({ intent, gatewayPaymentId: gatewayPaymentId || gatewayOrderId });
  db.logAudit('system', 'Razorpay Webhook', 'admin', 'PAYMENT_WEBHOOK_CAPTURED',
    `Razorpay webhook ${eventType} → intent ${intent.id} (${outcome.status}). ${outcome.message}`);
  finish(outcome.status === 'CAPTURED' || outcome.status === 'ALREADY_CAPTURED' ? 'PROCESSED' : 'MISMATCH', outcome.message);
});

// POST /api/payment/webhook/paypal
paymentWebhookRouter.post('/paypal', async (req: Request, res: Response) => {
  const rawBody = readRawBody(req);
  const creds = getProviderCredentials().paypal;
  const eventId = String(req.headers['paypal-transmission-id'] || '');

  const reject = (statusCode: number, status: 'REJECTED' | 'UNKNOWN_INTENT' | 'IGNORED', detail: string) => {
    db.recordPaymentWebhookEvent({
      provider: 'paypal_rest',
      externalEventId: eventId || `paypal-${payloadDigest(rawBody)}`,
      eventType: 'signature.invalid',
      status,
      detail,
      payloadDigest: payloadDigest(rawBody),
      ip: resolveClientIp(req)
    });
    res.status(statusCode).json({ success: false, message: detail });
  };

  if (!creds?.webhookId) {
    console.warn('[Payment Webhook] PayPal webhook id is not configured; event rejected so PayPal retries later.');
    reject(503, 'REJECTED', 'PayPal webhook verification is not configured on this server.');
    return;
  }

  let verified = false;
  try {
    verified = await verifyPayPalWebhookSignature(rawBody, {
      transmissionId: eventId,
      transmissionTime: String(req.headers['paypal-transmission-time'] || ''),
      transmissionSig: String(req.headers['paypal-transmission-sig'] || ''),
      certUrl: String(req.headers['paypal-cert-url'] || ''),
      authAlgo: String(req.headers['paypal-auth-algo'] || '')
    }, creds.webhookId);
  } catch (error: any) {
    console.warn(`[Payment Webhook] PayPal signature verification failed: ${error?.message || 'unknown error'}`);
    reject(503, 'REJECTED', 'PayPal signature verification could not be completed.');
    return;
  }

  if (!verified) {
    console.warn('[Payment Webhook] Rejected PayPal event with an invalid signature.');
    reject(400, 'REJECTED', 'Invalid PayPal webhook signature.');
    return;
  }

  const event = parseJsonBody(rawBody);
  if (!event) {
    res.status(400).json({ success: false, message: 'Webhook body was not valid JSON.' });
    return;
  }

  const eventType = String(event?.event_type || 'unknown');
  const resource = event?.resource || {};
  const gatewayOrderId = String(resource?.supplementary_data?.related_ids?.order_id || '');
  const gatewayPaymentId = String(resource?.id || '');
  const digest = payloadDigest(rawBody);

  const finish = (status: 'PROCESSED' | 'IGNORED' | 'MISMATCH' | 'UNKNOWN_INTENT', detail: string) => {
    const { duplicate } = db.recordPaymentWebhookEvent({
      provider: 'paypal_rest',
      externalEventId: eventId || `${eventType}:${gatewayPaymentId || digest}`,
      eventType,
      status,
      gatewayOrderId: gatewayOrderId || undefined,
      gatewayPaymentId: gatewayPaymentId || undefined,
      detail,
      payloadDigest: digest,
      ip: resolveClientIp(req)
    });
    res.json({ success: true, processed: status === 'PROCESSED', duplicate, status, message: detail });
  };

  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    finish('IGNORED', `Event ${eventType} does not change payment state.`);
    return;
  }
  if (!gatewayOrderId) {
    finish('UNKNOWN_INTENT', 'PayPal capture carried no related order id.');
    return;
  }

  const intent = db.getPaymentIntentByGatewayOrderId(gatewayOrderId);
  if (!intent) {
    finish('UNKNOWN_INTENT', `No payment intent matches PayPal order ${gatewayOrderId}.`);
    return;
  }

  const paidAmount = Number(resource?.amount?.value || 0);
  const paidCurrency = String(resource?.amount?.currency_code || '').toUpperCase();
  if (Math.abs(paidAmount - Number(intent.amount)) > 0.009 || (paidCurrency && paidCurrency !== String(intent.currency).toUpperCase())) {
    finish(
      'MISMATCH',
      `PayPal capture ${paidCurrency} ${paidAmount.toFixed(2)} does not match intent ${intent.id} (${intent.currency} ${Number(intent.amount).toFixed(2)}). Nothing was captured.`
    );
    return;
  }

  const prefix = paymentPrefixForIntent(intent);
  const outcome = captureVerifiedIntent({ intent, gatewayPaymentId: gatewayPaymentId || gatewayOrderId });
  db.logAudit('system', 'PayPal Webhook', 'admin', 'PAYMENT_WEBHOOK_CAPTURED',
    `PayPal webhook ${eventType} → intent ${intent.id} (${outcome.status}). Reference ${outcome.paymentReference || buildOnlinePaymentReference(prefix, gatewayPaymentId)}.`);
  finish(outcome.status === 'CAPTURED' || outcome.status === 'ALREADY_CAPTURED' ? 'PROCESSED' : 'MISMATCH', outcome.message);
});
