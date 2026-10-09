/**
 * ASTRO SIVAM — payment recovery (provider webhooks + reconciliation).
 *
 * WHY THIS EXISTS: an online checkout is only finished when the *browser* calls
 * /payment/verify-session. If the customer closes the tab, loses network, or the
 * callback is simply dropped, the provider has the money but the payment intent
 * stays CREATED forever: no order, no report, and the customer has to email us.
 *
 * Two independent recovery paths are implemented here:
 *   1. Provider webhooks — the gateway pushes the capture to us even when the
 *      customer's browser never returns.
 *   2. Admin reconciliation — the operator (or a cron sweep) asks the provider
 *      for the live status of a stale intent and captures it if it was paid.
 *
 * SECURITY RULES
 *   - Webhook authenticity is verified (HMAC for Razorpay, signed verification
 *     call for PayPal) BEFORE any state changes.
 *   - Amount and currency are always re-checked against the stored intent; a
 *     webhook can never change what an order costs.
 *   - Delivery is still bound to an order only through the authenticated order
 *     endpoint, so a forged callback can at worst mark an existing intent
 *     captured — never create or fulfil an order.
 */
import crypto from 'node:crypto';
import { db, PaymentIntent } from '../db/store.js';

export type OnlineProvider = 'razorpay' | 'paypal_rest';

export interface ReconciliationOutcome {
  status: 'CAPTURED' | 'ALREADY_CAPTURED' | 'PENDING' | 'FAILED' | 'UNKNOWN' | 'MISMATCH' | 'UNCONFIGURED';
  message: string;
  intentId?: string;
  gatewayPaymentId?: string;
  paymentReference?: string;
}

interface ProviderCredentials {
  razorpay: { keyId: string; keySecret: string; webhookSecret: string; mode: 'online' | 'offline' } | null;
  paypal: { clientId: string; clientSecret: string; webhookId: string; baseUrl: string; mode: 'online' | 'offline' } | null;
}

function isConfiguredSecret(value: unknown): boolean {
  const secret = String(value ?? '').trim();
  if (secret.length < 8) return false;
  if (secret.includes('•') || /^\*{4,}$/.test(secret)) return false;
  return !/^(change[-_ ]?me|replace[-_ ]?me|your[-_ ]?(secret|token|key)|placeholder)/i.test(secret);
}

/** Build provider credentials from settings, allowing env overrides for hosts without an admin UI. */
export function getProviderCredentials(): ProviderCredentials {
  const settings: any = db.getSettings();
  const razorpayKeyId = String(settings?.indiaGpayKeyId || '').trim();
  const razorpayKeySecret = String(settings?.indiaGpayKeySecret || '').trim();
  const razorpayWebhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || settings?.indiaGpayWebhookSecret || '').trim();
  const paypalClientId = String(process.env.PAYPAL_CLIENT_ID || settings?.paypalClientId || '').trim();
  const paypalClientSecret = String(process.env.PAYPAL_CLIENT_SECRET || settings?.paypalSecret || settings?.paypalClientSecret || '').trim();
  const paypalWebhookId = String(process.env.PAYPAL_WEBHOOK_ID || settings?.paypalWebhookId || '').trim();
  const paypalLive = String(settings?.paypalMode || 'sandbox').toLowerCase() === 'live';

  return {
    razorpay: razorpayKeyId && isConfiguredSecret(razorpayKeySecret)
      ? {
          keyId: razorpayKeyId,
          keySecret: razorpayKeySecret,
          webhookSecret: razorpayWebhookSecret,
          mode: settings?.indiaGpayPaymentMode === 'online' ? 'online' : 'offline'
        }
      : null,
    paypal: paypalClientId && isConfiguredSecret(paypalClientSecret)
      ? {
          clientId: paypalClientId,
          clientSecret: paypalClientSecret,
          webhookId: paypalWebhookId,
          baseUrl: paypalLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
          mode: settings?.paypalPaymentMode === 'online' ? 'online' : 'offline'
        }
      : null
  };
}

export function buildOnlinePaymentReference(prefix: 'GPAY' | 'PAYPAL', gatewayPaymentId: string): string {
  const clean = String(gatewayPaymentId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${prefix}-ONL-${clean}`;
}

export function paymentPrefixForIntent(intent: PaymentIntent): 'GPAY' | 'PAYPAL' {
  return String(intent.paymentMethod).toUpperCase() === 'PAYPAL' ? 'PAYPAL' : 'GPAY';
}

/** Razorpay signs the raw request body with the webhook secret. */
export function verifyRazorpayWebhookSignature(rawBody: Buffer | string, signature: string, webhookSecret: string): boolean {
  const secret = String(webhookSecret || '');
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = String(signature).trim().toLowerCase();
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function getPayPalAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error('PayPal authentication failed.');
  const data: any = await res.json();
  const token = String(data?.access_token || '');
  if (!token) throw new Error('PayPal authentication returned no access token.');
  return token;
}

export interface PayPalWebhookHeaders {
  transmissionId?: string;
  transmissionTime?: string;
  transmissionSig?: string;
  certUrl?: string;
  authAlgo?: string;
}

/**
 * Ask PayPal to verify the webhook signature (their documented flow). A locally
 * computed HMAC is not enough: only PayPal holds the certificate that signs the
 * transmission headers, so the verification must be delegated to their API.
 */
export async function verifyPayPalWebhookSignature(
  rawBody: Buffer | string,
  headers: PayPalWebhookHeaders,
  webhookId: string
): Promise<boolean> {
  const creds = getProviderCredentials().paypal;
  if (!creds || !webhookId) return false;
  const { transmissionId, transmissionTime, transmissionSig, certUrl, authAlgo } = headers;
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return false;

  let event: unknown;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return false;
  }

  const token = await getPayPalAccessToken(creds.baseUrl, creds.clientId, creds.clientSecret);
  const res = await fetch(`${creds.baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event
    })
  });
  if (!res.ok) return false;
  const data: any = await res.json();
  return String(data?.verification_status || '').toUpperCase() === 'SUCCESS';
}

/**
 * Capture an intent that the provider confirms was paid by the intent's owner.
 * Shared by the webhook handlers and the admin reconciliation sweep.
 */
export function captureVerifiedIntent(params: {
  intent: PaymentIntent;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  payerAccount?: string;
}): ReconciliationOutcome {
  const { intent, gatewayPaymentId } = params;
  if (intent.status === 'CAPTURED') {
    return {
      status: 'ALREADY_CAPTURED',
      message: 'Payment was already captured.',
      intentId: intent.id,
      gatewayPaymentId: intent.gatewayPaymentId,
      paymentReference: intent.paymentReference
    };
  }
  if (intent.status !== 'CREATED') {
    return { status: 'FAILED', message: `Payment intent is ${intent.status}; nothing was captured.`, intentId: intent.id };
  }

  const prefix = paymentPrefixForIntent(intent);
  const paymentReference = buildOnlinePaymentReference(prefix, gatewayPaymentId);
  const captured = db.capturePaymentIntentFromProvider({
    intentId: intent.id,
    gatewayPaymentId,
    paymentReference,
    gatewaySignature: params.gatewaySignature,
    payerAccount: params.payerAccount
  });
  if (!captured) {
    return { status: 'FAILED', message: 'Payment intent changed while it was being captured. Nothing was recorded.', intentId: intent.id };
  }
  return {
    status: 'CAPTURED',
    message: 'Provider-confirmed payment captured. The customer can now complete the order.',
    intentId: captured.id,
    gatewayPaymentId: captured.gatewayPaymentId,
    paymentReference: captured.paymentReference
  };
}

/** Query the provider for the intent's live state and capture it when paid. */
export async function reconcileIntent(intent: PaymentIntent): Promise<ReconciliationOutcome> {
  const creds = getProviderCredentials();
  try {
    if (intent.provider === 'razorpay') {
      if (!creds.razorpay || !creds.razorpay.keyId) {
        return { status: 'UNCONFIGURED', message: 'Razorpay credentials are not configured on this server.', intentId: intent.id };
      }
      const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(intent.gatewayOrderId || '')}/payments`, {
        headers: { Authorization: `Basic ${Buffer.from(`${creds.razorpay.keyId}:${creds.razorpay.keySecret}`).toString('base64')}` }
      });
      if (!res.ok) {
        return { status: 'UNKNOWN', message: 'Razorpay order status could not be read.', intentId: intent.id };
      }
      const data: any = await res.json();
      const payments: any[] = Array.isArray(data?.items) ? data.items : [];
      const captured = payments.find(p =>
        String(p?.status) === 'captured' &&
        Number(p?.amount) === Math.round(Number(intent.amount) * 100) &&
        String(p?.currency || '').toUpperCase() === String(intent.currency).toUpperCase()
      );
      if (!captured) {
        const failed = payments.some(p => String(p?.status) === 'failed');
        return {
          status: failed ? 'FAILED' : 'PENDING',
          message: failed
            ? 'Razorpay reports no captured payment for this session (a payment attempt failed).'
            : 'Razorpay reports no captured payment yet; the customer may still be checking out.',
          intentId: intent.id
        };
      }
      return captureVerifiedIntent({ intent, gatewayPaymentId: String(captured.id) });
    }

    if (intent.provider === 'paypal_rest') {
      if (!creds.paypal) {
        return { status: 'UNCONFIGURED', message: 'PayPal credentials are not configured on this server.', intentId: intent.id };
      }
      const token = await getPayPalAccessToken(creds.paypal.baseUrl, creds.paypal.clientId, creds.paypal.clientSecret);
      const res = await fetch(`${creds.paypal.baseUrl}/v2/checkout/orders/${encodeURIComponent(intent.gatewayOrderId || '')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        return { status: 'UNKNOWN', message: 'PayPal order status could not be read.', intentId: intent.id };
      }
      let order: any = await res.json();

      // Recovery: the buyer approved the payment but the browser never returned
      // to capture it. Capture server-side now.
      if (String(order?.status || '').toUpperCase() === 'APPROVED') {
        const captureRes = await fetch(
          `${creds.paypal.baseUrl}/v2/checkout/orders/${encodeURIComponent(intent.gatewayOrderId || '')}/capture`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'PayPal-Request-Id': `recovery-${intent.id}`
            },
            body: '{}'
          }
        );
        if (captureRes.ok) {
          order = await captureRes.json();
        } else {
          return {
            status: 'PENDING',
            message: 'PayPal approval exists but the capture could not be completed yet.',
            intentId: intent.id
          };
        }
      }

      const capture = order?.purchase_units?.[0]?.payments?.captures?.[0];
      const amount = Number(capture?.amount?.value ?? order?.purchase_units?.[0]?.amount?.value ?? 0);
      const currency = String(capture?.amount?.currency_code || order?.purchase_units?.[0]?.amount?.currency_code || '').toUpperCase();
      const completed = String(capture?.status || '').toUpperCase() === 'COMPLETED' || String(order?.status || '').toUpperCase() === 'COMPLETED';
      if (!completed) {
        return {
          status: 'PENDING',
          message: `PayPal reports status ${order?.status || 'UNKNOWN'}; no capture to record yet.`,
          intentId: intent.id
        };
      }
      if (Math.abs(amount - Number(intent.amount)) > 0.009 || (currency && currency !== String(intent.currency).toUpperCase())) {
        return {
          status: 'MISMATCH',
          message: `PayPal reported ${currency} ${amount.toFixed(2)} but the intent is ${intent.currency} ${Number(intent.amount).toFixed(2)}. Nothing was captured.`,
          intentId: intent.id
        };
      }
      const paymentId = String(capture?.id || order?.id || '');
      if (!paymentId) {
        return { status: 'UNKNOWN', message: 'PayPal returned no capture id.', intentId: intent.id };
      }
      return captureVerifiedIntent({ intent, gatewayPaymentId: paymentId });
    }

    return { status: 'UNKNOWN', message: `No reconciliation path for provider ${intent.provider}.`, intentId: intent.id };
  } catch (error: any) {
    return { status: 'UNKNOWN', message: error?.message || 'Provider reconciliation failed.', intentId: intent.id };
  }
}

/** Reconcile every stale intent (oldest first) — used by the admin sweep action. */
export async function sweepStalePaymentIntents(minutes = 30, limit = 20): Promise<{
  checked: number;
  captured: number;
  failed: number;
  results: ReconciliationOutcome[];
}> {
  const stale = db.listStalePaymentIntents(minutes, limit);
  const results: ReconciliationOutcome[] = [];
  for (const intent of stale) {
    results.push(await reconcileIntent(intent));
  }
  return {
    checked: results.length,
    captured: results.filter(r => r.status === 'CAPTURED').length,
    failed: results.filter(r => r.status === 'UNKNOWN' || r.status === 'FAILED').length,
    results
  };
}
