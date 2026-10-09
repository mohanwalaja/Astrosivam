import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { db } from '../server/db/store.js';
import { paymentWebhookRouter } from '../server/routes/paymentWebhooks.js';
import {
  buildOnlinePaymentReference,
  reconcileIntent,
  sweepStalePaymentIntents,
  verifyRazorpayWebhookSignature
} from '../server/services/paymentReconciliation.js';

const pass = (name: string) => console.log(`  [PASS] ${name}`);

const RAZORPAY_WEBHOOK_SECRET = 'whsec_test_razorpay_webhook_secret';
const PAYPAL_WEBHOOK_ID = 'WH-TEST-WEBHOOK-ID';

async function startWebhookServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use('/api/payment/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentWebhookRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const address: any = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/api/payment/webhook`,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}

function razorpaySignature(rawBody: string, secret = RAZORPAY_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function run() {
  console.log('--- PAYMENT RECOVERY (WEBHOOKS + RECONCILIATION) ---');

  // 1. Signature verification primitives.
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } } });
  assert.equal(verifyRazorpayWebhookSignature(body, razorpaySignature(body), RAZORPAY_WEBHOOK_SECRET), true);
  assert.equal(verifyRazorpayWebhookSignature(body, razorpaySignature(body, 'wrong-secret'), RAZORPAY_WEBHOOK_SECRET), false);
  assert.equal(verifyRazorpayWebhookSignature(body, '', RAZORPAY_WEBHOOK_SECRET), false);
  assert.equal(verifyRazorpayWebhookSignature(body, 'short', RAZORPAY_WEBHOOK_SECRET), false);
  assert.equal(verifyRazorpayWebhookSignature(body, razorpaySignature(body), ''), false);
  pass('Razorpay webhook signatures are verified with a timing-safe HMAC comparison');

  // 2. Store semantics required by the recovery paths.
  const originalSettings = structuredClone(db.getSettings());
  const server = await startWebhookServer();
  const originalFetch = globalThis.fetch;

  try {
    db.updateSettings({
      indiaGpayKeyId: 'rzp_test_webhook_key',
      indiaGpayKeySecret: 'rzp_test_webhook_secret_value',
      indiaGpayWebhookSecret: RAZORPAY_WEBHOOK_SECRET,
      indiaGpayPaymentMode: 'online',
      paypalClientId: 'paypal-test-client-id',
      paypalClientSecret: 'paypal-test-client-secret',
      paypalSecret: 'paypal-test-client-secret',
      paypalWebhookId: PAYPAL_WEBHOOK_ID,
      paypalPaymentMode: 'online',
      paypalMode: 'sandbox'
    }, { id: 'test', name: 'Payment recovery test' });

    const intent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount: 499,
      currency: 'INR',
      gatewayOrderId: 'order_recovery_1',
      expiresInMinutes: 30
    });
    assert.equal(db.getPaymentIntentByGatewayOrderId('order_recovery_1')?.id, intent.id);
    assert.equal(db.getPaymentIntentById(intent.id)?.status, 'CREATED');
    pass('Payment intents can be looked up by gateway order id and by intent id');

    // 3. Signed Razorpay webhook captures the intent the browser never confirmed.
    const capturedEvent = {
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_recovery_1', order_id: 'order_recovery_1', amount: 49900, currency: 'INR', status: 'captured' } }
      }
    };
    const capturedBody = JSON.stringify(capturedEvent);
    const capturedResponse = await fetch(`${server.url}/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': razorpaySignature(capturedBody),
        'x-razorpay-event-id': 'evt_recovery_1'
      },
      body: capturedBody
    });
    const capturedJson: any = await capturedResponse.json();
    assert.equal(capturedResponse.status, 200);
    assert.equal(capturedJson.processed, true);
    const afterWebhook = db.getPaymentIntentById(intent.id)!;
    assert.equal(afterWebhook.status, 'CAPTURED');
    assert.equal(afterWebhook.gatewayPaymentId, 'pay_recovery_1');
    assert.equal(afterWebhook.paymentReference, buildOnlinePaymentReference('GPAY', 'pay_recovery_1'));
    pass('A signed Razorpay capture webhook recovers an intent whose browser callback was lost');

    // 4. Replay is idempotent, and the provider stops retrying.
    const replay: any = await (await fetch(`${server.url}/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': razorpaySignature(capturedBody),
        'x-razorpay-event-id': 'evt_recovery_1'
      },
      body: capturedBody
    })).json();
    assert.equal(replay.duplicate, true);
    assert.equal(db.getPaymentIntentById(intent.id)!.status, 'CAPTURED');
    assert.equal(db.listPaymentWebhookEvents(5).filter(event => event.externalEventId === 'evt_recovery_1').length, 1);
    pass('Replayed provider events are recorded once and do not re-capture the intent');

    // 5. A forged signature changes nothing.
    const forgedIntent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount: 499,
      currency: 'INR',
      gatewayOrderId: 'order_forged_1',
      expiresInMinutes: 30
    });
    const forgedBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_forged', order_id: 'order_forged_1', amount: 49900, currency: 'INR', status: 'captured' } } }
    });
    const forgedResponse = await fetch(`${server.url}/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'deadbeef',
        'x-razorpay-event-id': 'evt_forged_1'
      },
      body: forgedBody
    });
    assert.equal(forgedResponse.status, 400);
    assert.equal(db.getPaymentIntentById(forgedIntent.id)!.status, 'CREATED');
    pass('A webhook with an invalid signature is rejected and cannot capture a payment');

    // 6. Amount tampering is refused.
    const tamperedBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_tampered', order_id: 'order_forged_1', amount: 100, currency: 'INR', status: 'captured' } } }
    });
    const tampered: any = await (await fetch(`${server.url}/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': razorpaySignature(tamperedBody),
        'x-razorpay-event-id': 'evt_tampered_1'
      },
      body: tamperedBody
    })).json();
    assert.equal(tampered.status, 'MISMATCH');
    assert.equal(db.getPaymentIntentById(forgedIntent.id)!.status, 'CREATED');
    pass('A provider event for a different amount never captures the intent');

    // 7. PayPal webhooks: verified through PayPal, then captured.
    const paypalIntent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'PAYPAL',
      provider: 'paypal_rest',
      amount: 18,
      currency: 'USD',
      gatewayOrderId: 'PAYPAL-ORDER-1',
      expiresInMinutes: 30
    });
    const paypalEvent = {
      id: 'WH-PAYPAL-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'PAYPAL-CAPTURE-1',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '18.00' },
        supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } }
      }
    };
    const paypalCalls: string[] = [];
    globalThis.fetch = (async (url: any, init: any) => {
      const target = String(url);
      // Requests to our own webhook listener must keep using the real transport.
      if (target.includes('127.0.0.1')) return originalFetch(url, init);
      paypalCalls.push(target);
      if (target.includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'paypal-test-token' }) } as Response;
      }
      if (target.includes('/v1/notifications/verify-webhook-signature')) {
        const parsed = JSON.parse(String(init?.body || '{}'));
        assert.equal(parsed.webhook_id, PAYPAL_WEBHOOK_ID);
        assert.equal(parsed.webhook_event.event_type, 'PAYMENT.CAPTURE.COMPLETED');
        return { ok: true, status: 200, json: async () => ({ verification_status: 'SUCCESS' }) } as Response;
      }
      throw new Error(`Unexpected PayPal call in test: ${target}`);
    }) as typeof fetch;

    const paypalResponse = await fetch(`${server.url}/paypal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': 'transmission-1',
        'paypal-transmission-time': '2026-10-01T00:00:00Z',
        'paypal-transmission-sig': 'signature',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: JSON.stringify(paypalEvent)
    });
    const paypalJson: any = await paypalResponse.json();
    assert.equal(paypalResponse.status, 200);
    assert.equal(paypalJson.processed, true);
    assert.equal(db.getPaymentIntentById(paypalIntent.id)!.status, 'CAPTURED');
    assert.equal(db.getPaymentIntentById(paypalIntent.id)!.paymentReference, buildOnlinePaymentReference('PAYPAL', 'PAYPAL-CAPTURE-1'));
    assert.ok(paypalCalls.some(call => call.includes('verify-webhook-signature')), 'PayPal verification is delegated to PayPal');
    pass('PayPal captures are verified with PayPal before the intent is captured');

    // A PayPal event PayPal rejects must not capture anything.
    const rejectedIntent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'PAYPAL',
      provider: 'paypal_rest',
      amount: 18,
      currency: 'USD',
      gatewayOrderId: 'PAYPAL-ORDER-2',
      expiresInMinutes: 30
    });
    globalThis.fetch = (async (url: any, init: any) => {
      const target = String(url);
      if (target.includes('127.0.0.1')) return originalFetch(url, init);
      if (target.includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'paypal-test-token' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ verification_status: 'FAILURE' }) } as Response;
    }) as typeof fetch;
    const rejectedResponse = await fetch(`${server.url}/paypal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-id': 'transmission-2',
        'paypal-transmission-time': '2026-10-01T00:00:00Z',
        'paypal-transmission-sig': 'signature',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/cert',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: JSON.stringify({
        ...paypalEvent,
        id: 'WH-PAYPAL-2',
        resource: { ...paypalEvent.resource, id: 'PAYPAL-CAPTURE-2', supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-2' } } }
      })
    });
    assert.equal(rejectedResponse.status, 400);
    assert.equal(db.getPaymentIntentById(rejectedIntent.id)!.status, 'CREATED');
    pass('A PayPal event PayPal does not verify never captures the intent');

    // 8. Reconciliation (no webhook configured yet, or a missed delivery).
    const staleIntent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount: 499,
      currency: 'INR',
      gatewayOrderId: 'order_stale_1',
      expiresInMinutes: 30
    });
    // Backdate it so it counts as stale for the sweep.
    (db.getPaymentIntentById(staleIntent.id) as any).createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
    assert.ok(db.listStalePaymentIntents(30).some(item => item.id === staleIntent.id), 'backdated intent is listed as stale');

    globalThis.fetch = (async (url: any) => {
      const target = String(url);
      if (target.includes('/v1/orders/order_stale_1/payments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: 'pay_stale_1', status: 'captured', amount: 49900, currency: 'INR' }] })
        } as Response;
      }
      throw new Error(`Unexpected reconciliation call: ${target}`);
    }) as typeof fetch;

    const outcome = await reconcileIntent(db.getPaymentIntentById(staleIntent.id)!);
    assert.equal(outcome.status, 'CAPTURED');
    assert.equal(db.getPaymentIntentById(staleIntent.id)!.status, 'CAPTURED');
    assert.equal(db.getPaymentIntentById(staleIntent.id)!.paymentReference, buildOnlinePaymentReference('GPAY', 'pay_stale_1'));
    pass('Admin reconciliation captures a paid-but-unconfirmed checkout from the provider');

    // Reconciling again is a no-op, not a duplicate capture.
    const again = await reconcileIntent(db.getPaymentIntentById(staleIntent.id)!);
    assert.equal(again.status, 'ALREADY_CAPTURED');
    pass('Reconciliation is idempotent');

    // A mismatch reported by the provider is refused.
    const mismatchIntent = db.createPaymentIntent({
      userId: 'usr_recovery_test',
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount: 499,
      currency: 'INR',
      gatewayOrderId: 'order_stale_2',
      expiresInMinutes: 30
    });
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ id: 'pay_stale_2', status: 'captured', amount: 100, currency: 'INR' }] })
    } as Response)) as typeof fetch;
    const mismatch = await reconcileIntent(db.getPaymentIntentById(mismatchIntent.id)!);
    assert.equal(mismatch.status, 'PENDING');
    assert.equal(db.getPaymentIntentById(mismatchIntent.id)!.status, 'CREATED');
    pass('A provider payment for the wrong amount is never captured by reconciliation');

    // The sweep reports what happened.
    (db.getPaymentIntentById(mismatchIntent.id) as any).createdAt = new Date(Date.now() - 90 * 60_000).toISOString();
    globalThis.fetch = (async (url: any) => {
      const target = String(url);
      if (target.includes('/v1/orders/order_stale_2/payments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [{ id: 'pay_stale_2', status: 'captured', amount: 49900, currency: 'INR' }] })
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
    }) as typeof fetch;
    const sweep = await sweepStalePaymentIntents(30, 10);
    assert.ok(sweep.checked >= 1);
    assert.ok(sweep.captured >= 1);
    assert.equal(db.getPaymentIntentById(mismatchIntent.id)!.status, 'CAPTURED');
    pass('The reconciliation sweep recovers every stale session it can');

    // 9. Webhook audit trail is bounded and queryable.
    const events = db.listPaymentWebhookEvents(50);
    assert.ok(events.length >= 3);
    assert.ok(events.every(event => event.payloadDigest && event.receivedAt));
    pass('Provider callbacks are retained as an auditable, queryable event log');
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
    db.updateSettings(originalSettings, { id: 'test', name: 'Payment recovery cleanup' });
  }
}

run().then(() => {
  console.log('\nPayment recovery (webhooks + reconciliation) passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
