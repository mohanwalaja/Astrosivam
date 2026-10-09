import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { db, type ServiceType } from '../server/db/store.js';
import { servicesRouter } from '../server/routes/services.js';
import { createSignedToken } from '../server/security/tokens.js';
import { buildOnlinePaymentReference } from '../server/services/paymentReconciliation.js';
import { getServicePrices } from '../src/services/pricing.js';

const pass = (message: string) => console.log(`  [PASS] ${message}`);
const clientIp = '198.51.100.74';
const birthPayload = (name: string) => ({
  name,
  dob: '1990-08-15',
  tob: '09:30',
  gender: 'M',
  birthPlace: 'Chennai, India',
  country: 'India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5
});

function familyItems(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    serviceType: 'BIRTH_JATHAGAM' as ServiceType,
    language: 'en' as const,
    country: 'India',
    inputPayload: birthPayload(`Repeat Buyer ${offset + index + 1}`)
  }));
}

async function run() {
  console.log('--- REPEATED PAID FAMILY CHECKOUTS ---');
  const originalSettings = structuredClone(db.getSettings());
  const customer = db.createUser({
    name: 'Repeat Order Customer',
    email: 'repeat-order-customer@example.test',
    mobile: '',
    passwordHash: 'not-used-by-this-test',
    role: 'customer',
    country: 'India'
  });
  const token = createSignedToken(customer);
  const app = express();
  app.use(express.json());
  app.use('/api/services', servicesRouter);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/services/multi-order`;
  let checkoutNumber = 0;

  async function makeCapturedIntent(itemCount: number) {
    checkoutNumber += 1;
    const amount = Number((getServicePrices(db.getSettings(), 'BIRTH_JATHAGAM').INR * itemCount).toFixed(2));
    const gatewayOrderId = `gateway_repeat_${checkoutNumber}`;
    const gatewayPaymentId = `payment_repeat_${checkoutNumber}`;
    const paymentReference = buildOnlinePaymentReference('GPAY', gatewayPaymentId);
    const intent = db.createPaymentIntent({
      userId: customer.id,
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount,
      currency: 'INR',
      gatewayOrderId,
      expiresInMinutes: 30
    });
    const captured = db.capturePaymentIntent({
      id: intent.id,
      userId: customer.id,
      gatewayOrderId,
      gatewayPaymentId,
      paymentReference
    });
    assert.ok(captured, `payment intent ${checkoutNumber} should capture in the test store`);
    return { intent, paymentReference, amount };
  }

  async function postPayload(payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': clientIp
      },
      body: JSON.stringify(payload)
    });
    return { status: response.status, body: await response.json() as any };
  }

  async function submit(items: ReturnType<typeof familyItems>, payment: Awaited<ReturnType<typeof makeCapturedIntent>>) {
    return postPayload({
      items,
      country: 'India',
      billingCountry: 'India',
      paymentMethod: 'GPAY',
      currency: 'INR',
      paymentReference: payment.paymentReference,
      paymentIntentId: payment.intent.id
    });
  }

  try {
    db.updateSettings({ serviceMode: 'PAID' }, { id: 'test-admin', name: 'Test Admin' });

    // The six-report maximum is accepted as one captured family checkout.
    // More than six is rejected before any order or payment is created.
    const excess = await postPayload({
      items: familyItems(7),
      country: 'India',
      billingCountry: 'India',
      paymentMethod: 'GPAY',
      currency: 'INR',
      paymentReference: 'OVER-LIMIT-REFERENCE',
      paymentIntentId: 'not-a-payment-intent'
    });
    assert.equal(excess.status, 400);
    assert.match(excess.body.message, /at most 6 reports/);
    pass('A seventh family report is rejected before order creation or payment validation');

    const firstItems = familyItems(6);
    const firstPayment = await makeCapturedIntent(firstItems.length);
    assert.equal(firstPayment.amount, firstItems.length * getServicePrices(db.getSettings(), 'BIRTH_JATHAGAM').INR);
    const first = await submit(firstItems, firstPayment);
    assert.equal(first.status, 201, first.body.message);
    assert.equal(first.body.orders.length, firstItems.length);
    assert.equal(first.body.totalAmount, firstPayment.amount);
    assert.ok(first.body.orders.every((order: any) => order.paymentStatus === 'CAPTURED'));
    assert.equal(db.getPaymentIntentForUser(firstPayment.intent.id, customer.id)?.status, 'CONSUMED');
    assert.equal(db.countPendingOrdersByIp(clientIp), 0, 'A captured payment should not consume the unpaid-checkout allowance.');
    pass('One total payment creates six report orders in one captured family group');

    // A second, separate order is allowed while the first reports still await
    // admin approval. It must have its own, fresh captured intent.
    const secondItems = familyItems(4, 5);
    const secondPayment = await makeCapturedIntent(secondItems.length);
    const second = await submit(secondItems, secondPayment);
    assert.equal(second.status, 201, second.body.message);
    assert.equal(second.body.orders.length, secondItems.length);
    assert.equal(second.body.totalAmount, secondPayment.amount);
    assert.notEqual(second.body.groupId, first.body.groupId);
    assert.equal(db.getPaymentIntentForUser(secondPayment.intent.id, customer.id)?.status, 'CONSUMED');
    assert.equal(db.countPendingOrdersByIp(clientIp), 0);
    pass('The customer can submit another multi-chart order after paying the first total');

    // A captured intent is intentionally one-use: allowing repeat orders must
    // not allow the customer to attach one payment to a second order group.
    const beforeReuse = db.getUserOrders(customer.id).length;
    const reused = await submit(firstItems, firstPayment);
    assert.equal(reused.status, 400);
    assert.equal(db.getUserOrders(customer.id).length, beforeReuse);
    pass('A second order still requires a separate payment; consumed intents cannot be reused');

    // Manual receipt orders remain rate-limited, but the limit counts one
    // family checkout rather than every chart row in the family.
    const manualGroup = db.createMultiOrder({
      userId: customer.id,
      userName: customer.name,
      userEmail: customer.email,
      userMobile: customer.mobile,
      items: familyItems(5, 9),
      billingCountry: 'India',
      paymentMethod: 'GPAY',
      currency: 'INR',
      paymentReference: 'MANUAL-FAMILY-RECEIPT-2026',
      paymentStatus: 'PENDING_ADMIN',
      ipAddress: clientIp
    });
    assert.equal(manualGroup.length, 5);
    assert.equal(db.countPendingOrdersByIp(clientIp), 1);

    for (const index of [1, 2]) {
      const reference = `MANUAL-CHECKOUT-${index}-2026`;
      const manual = await postPayload({
        items: familyItems(1, 9 + index),
        country: 'India',
        billingCountry: 'India',
        paymentMethod: 'GPAY',
        currency: 'INR',
        paymentReference: reference
      });
      assert.equal(manual.status, 201, manual.body.message);
      assert.equal(db.countPendingOrdersByIp(clientIp), index + 1);
    }

    const blockedManual = await postPayload({
      items: familyItems(1, 20),
      country: 'India',
      billingCountry: 'India',
      paymentMethod: 'GPAY',
      currency: 'INR',
      paymentReference: 'MANUAL-CHECKOUT-FOUR-2026'
    });
    assert.equal(blockedManual.status, 429);
    assert.equal(blockedManual.body.pendingCount, 3);
    pass('The manual-payment safeguard counts a multi-chart family as one checkout and still caps three unverified checkouts');
  } finally {
    db.updateSettings(originalSettings, { id: 'test-admin', name: 'Test Admin' });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
