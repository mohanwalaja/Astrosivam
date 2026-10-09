import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { createServer } from 'node:http';
import { db, type Order, type ServiceType } from '../server/db/store.js';
import { servicesRouter } from '../server/routes/services.js';
import { createSignedToken } from '../server/security/tokens.js';
import { getServicePrices } from '../src/services/pricing.js';

const pass = (message: string) => console.log(`  [PASS] ${message}`);
const birth = {
  name: 'Admin Report Test', dob: '1990-08-15', tob: '09:30', gender: 'M',
  birthPlace: 'Chennai, India', country: 'India',
  latitude: 13.0827, longitude: 80.2707, timezoneOffsetHours: 5.5
};
const payloads: Record<ServiceType, any> = {
  BIRTH_JATHAGAM: birth,
  MARRIAGE_COMPATIBILITY: { bride: { ...birth, name: 'Bride', gender: 'F' }, groom: birth },
  BABY_NAMING: { ...birth, babyName: 'Baby', dob: '2025-08-15' },
  MUHURTHAM: {
    ...birth, selectedMonth: '2027-01', selectedEvent: 'wedding',
    muhurthamPlace: 'Suva, Fiji', muhurthamCountry: 'Fiji',
    muhurthamLatitude: -18.1416, muhurthamLongitude: 178.4419, muhurthamTimezoneOffsetHours: 12,
    muhurthamScan: { months: [{ monthKey: '2027-01', month: 1, year: 2027, days: [] }] }
  }
};
const serviceTypes = Object.keys(payloads) as ServiceType[];
const items = serviceTypes.map(serviceType => ({ serviceType, language: 'en', country: 'India', inputPayload: payloads[serviceType] }));
const singlePayload = (serviceType: ServiceType) => ({ serviceType, language: 'en', country: 'India', inputPayload: payloads[serviceType] });

function assertNoCharge(order: Order) {
  assert.equal(order.amount, 0);
  assert.equal(order.paymentMethod, 'NONE');
  assert.equal(order.paymentStatus, 'NOT_REQUIRED');
  assert.equal(order.paymentReference, undefined);
  assert.equal(order.paymentIntentId, undefined);
  assert.equal(order.status, 'PENDING_APPROVAL', 'Report approval remains required, but payment verification does not.');
  assert.ok(order.calculatedResult, `The ${order.serviceType} report can still be calculated.`);
  const saved = db.getOrderById(order.id)!;
  assert.equal(saved.amount, 0);
  assert.equal(saved.paymentStatus, 'NOT_REQUIRED');
  assert.equal(saved.paymentReference, undefined);
  assert.equal(saved.paymentIntentId, undefined);
}

async function run() {
  console.log('--- ADMIN REPORTS ARE ALWAYS FREE ---');
  const originalSettings = structuredClone(db.getSettings());
  const admin = db.provisionAdminAccount({
    name: 'No-Charge Admin', email: 'no-charge-admin@example.test', password: 'Test-only-admin-password-2026!'
  });
  const customer = db.createUser({
    name: 'Paying Customer', email: 'paying-customer@example.test', mobile: '',
    passwordHash: 'not-used-by-this-test', role: 'customer', country: 'India'
  });
  const adminToken = createSignedToken(admin);
  const customerToken = createSignedToken(customer);
  // Even a signed token with a stale/incorrect admin role must not grant the
  // exemption when the persisted user is a customer.
  const staleAdminToken = createSignedToken({ ...customer, role: 'admin' });
  const actor = { id: admin.id, name: admin.name };

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
  const baseUrl = `http://127.0.0.1:${address.port}/api/services`;
  async function post(route: 'order' | 'multi-order', token: string, body: any, ip: string) {
    const response = await fetch(`${baseUrl}/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Connection: 'close', 'X-Forwarded-For': ip,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() as any };
  }

  try {
    const exhaustedIp = '192.0.2.20';
    db.recordBetaIpOrder({
      ipAddress: exhaustedIp, orderId: 'existing-beta-order', orderNumber: 'BETA-USED',
      userId: customer.id, userEmail: customer.email, serviceType: 'BIRTH_JATHAGAM'
    });
    const intent = db.createPaymentIntent({
      userId: admin.id, paymentMethod: 'GPAY', provider: 'razorpay', amount: 499,
      currency: 'INR', gatewayOrderId: 'order_stale_admin'
    });
    db.capturePaymentIntent({
      id: intent.id, userId: admin.id, gatewayOrderId: intent.gatewayOrderId,
      gatewayPaymentId: 'pay_stale_admin', paymentReference: 'GPAY-ONL-pay_stale_admin'
    });
    const stalePayment = {
      paymentMethod: 'GPAY', paymentReference: 'GPAY-ONL-pay_stale_admin', paymentIntentId: intent.id
    };

    for (const mode of ['PAID', 'FREE_BETA'] as const) {
      db.updateSettings({ serviceMode: mode }, actor);
      for (const serviceType of serviceTypes) {
        // No method, no receipt, no payment intent: even in PAID mode and
        // after this IP's beta allowance has already been consumed.
        const first = await post('order', adminToken, singlePayload(serviceType), exhaustedIp);
        assert.equal(first.status, 201, first.body.message);
        assertNoCharge(first.body.order);

        const repeat = await post('order', adminToken, { ...singlePayload(serviceType), ...stalePayment }, exhaustedIp);
        assert.equal(repeat.status, 201, repeat.body.message);
        assertNoCharge(repeat.body.order);
      }
      pass(`${mode}: every report type and repeat admin order is free without a receipt`);

      for (const payment of [{}, stalePayment]) {
        const family = await post('multi-order', adminToken, { items, ...payment }, exhaustedIp);
        assert.equal(family.status, 201, family.body.message);
        assert.equal(family.body.orders.length, serviceTypes.length);
        assert.equal(family.body.totalAmount, 0);
        assert.equal(family.body.freeCharts, serviceTypes.length);
        assert.equal(family.body.paidCharts, 0);
        family.body.orders.forEach(assertNoCharge);
      }
      assert.equal(db.getBetaIpOrderCount(exhaustedIp), 1, 'Admin reports never consume another beta slot.');
      assert.equal(db.getPaymentIntentForUser(intent.id, admin.id)?.status, 'CAPTURED', 'Stale admin payment data is never consumed.');
      pass(`${mode}: every family chart is free, including repeat bundles and saved payment data`);
    }
    assert.equal(db.countPendingOrdersByIp(exhaustedIp), 0, 'No-charge admin orders do not consume the customer unpaid-checkout limit.');

    // Defense in depth: the trusted internal admin flag also strips payment
    // metadata if a server caller passes it directly to the store.
    const internalData = {
      userId: admin.id, userName: admin.name, userEmail: admin.email, userMobile: admin.mobile,
      ...stalePayment, paymentMethod: 'GPAY' as const, paymentStatus: 'CAPTURED' as const, forceFree: true
    };
    assertNoCharge(db.createOrder({ ...internalData, ...singlePayload('BIRTH_JATHAGAM') }));
    db.createMultiOrder({ ...internalData, items: items as any }).forEach(assertNoCharge);
    pass('Persisted no-charge admin orders cannot retain a payment reference or intent');

    db.updateSettings({ serviceMode: 'PAID' }, actor);
    const spoofedExemption = { role: 'admin', isAdmin: true, forceFree: true, amount: 0, totalAmount: 0, serviceMode: 'FREE_BETA' };
    for (const [index, serviceType] of serviceTypes.entries()) {
      const ip = `198.51.100.${30 + index}`;
      const rejected = await post('order', staleAdminToken, { ...singlePayload(serviceType), ...spoofedExemption }, ip);
      assert.equal(rejected.status, 400, 'Customers cannot opt into the admin payment exemption.');
      assert.equal(rejected.body.success, false);
      const paid = await post('order', customerToken, {
        ...singlePayload(serviceType), ...spoofedExemption,
        paymentMethod: 'GPAY', currency: 'INR', paymentReference: `CUSTOMER-PAID-${index}-2026`
      }, ip);
      assert.equal(paid.status, 201, paid.body.message);
      assert.equal(paid.body.order.amount, getServicePrices(db.getSettings(), serviceType).INR);
      assert.equal(paid.body.order.paymentStatus, 'PENDING_ADMIN');
    }
    const rejectedFamily = await post('multi-order', customerToken, { items, ...spoofedExemption }, '198.51.100.40');
    assert.equal(rejectedFamily.status, 400);
    const paidFamily = await post('multi-order', customerToken, {
      items, ...spoofedExemption, paymentMethod: 'GPAY', currency: 'INR', paymentReference: 'CUSTOMER-FAMILY-PAID-2026'
    }, '198.51.100.40');
    assert.equal(paidFamily.status, 201, paidFamily.body.message);
    assert.equal(paidFamily.body.freeCharts, 0);
    assert.equal(paidFamily.body.paidCharts, items.length);
    assert.ok(paidFamily.body.orders.every((order: Order) => order.amount > 0));
    pass('Customer single and family prices remain paid; client flags and token role cannot bypass payment');

    db.updateSettings({ serviceMode: 'FREE_BETA' }, actor);
    const sharedIp = '198.51.100.50';
    const adminFirst = await post('order', adminToken, singlePayload('BIRTH_JATHAGAM'), sharedIp);
    const adminFamily = await post('multi-order', adminToken, { items }, sharedIp);
    assert.equal(adminFirst.status, 201, adminFirst.body.message);
    assert.equal(adminFamily.status, 201, adminFamily.body.message);
    assert.equal(db.getBetaIpOrderCount(sharedIp), 0, 'Admin orders leave the shared connection beta allowance unused.');
    // Finish admin reports so the independent customer anti-spam cap does not
    // block this customer's beta test on the same connection.
    [adminFirst.body.order, ...adminFamily.body.orders].forEach((order: Order) => db.updateOrder(order.id, { status: 'COMPLETED' }));
    const customerFree = await post('order', customerToken, singlePayload('BIRTH_JATHAGAM'), sharedIp);
    assert.equal(customerFree.status, 201, customerFree.body.message);
    assertNoCharge(customerFree.body.order);
    assert.equal(db.getBetaIpOrderCount(sharedIp), 1);
    const customerRepeat = await post('order', customerToken, singlePayload('BIRTH_JATHAGAM'), sharedIp);
    assert.equal(customerRepeat.status, 400, 'Customers still receive only one free beta report.');
    const betaFamily = await post('multi-order', customerToken, {
      items, paymentMethod: 'GPAY', currency: 'INR', paymentReference: 'CUSTOMER-BETA-FAMILY-2026'
    }, '198.51.100.51');
    assert.equal(betaFamily.status, 201, betaFamily.body.message);
    assert.equal(betaFamily.body.freeCharts, 1);
    assert.equal(betaFamily.body.paidCharts, items.length - 1);
    assert.equal(betaFamily.body.orders[0].amount, 0);
    assert.ok(betaFamily.body.orders.slice(1).every((order: Order) => order.amount > 0));
    pass('Admin reports do not use the beta allowance; customer one-free-report and family pricing are unchanged');

    for (const route of ['order', 'multi-order'] as const) {
      const response = await post(route, '', route === 'order' ? { ...singlePayload('BIRTH_JATHAGAM'), ...spoofedExemption } : { items, ...spoofedExemption }, '198.51.100.60');
      assert.equal(response.status, 401);
    }
    pass('Unauthenticated requests cannot obtain admin free reports');

    // The deployed cPanel router must enforce the same role-based rule as the
    // Node backend. Keep both single and family routes wired to that rule.
    const php = readFileSync('api/services/index.php', 'utf8');
    assert.equal((php.match(/\$user = requireAuth\(\$pdo\);\n    \$isAdmin = strtolower/g) || []).length, 2);
    assert.equal((php.match(/\$isAdmin \? 'NONE' : \(\$body\['paymentMethod'\]/g) || []).length, 2);
    assert.equal((php.match(/\$paymentReference = !\$isAdmin && is_string/g) || []).length, 2);
    assert.equal((php.match(/\$paymentIntentId = !\$isAdmin && is_string/g) || []).length, 2);
    assert.match(php, /if \(\$isAdmin\) \{\s*\$isFreeOrder = true;/);
    assert.match(php, /\$isThisItemFree = \$isAdmin \|\| \(\$freeChartAvailable && \$idx === 0\);/);
    assert.match(php, /'freeCharts' => \$isAdmin \? count\(\$items\)/);
    pass('PHP single and family routes grant the exemption only to authenticated admins and discard payment metadata');
  } finally {
    db.updateSettings(originalSettings, actor);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
