/**
 * MULTI-PERSON ORDERS
 * -------------------
 * One order = up to 6 people, each with one or more reports, paid with ONE
 * total. This suite locks in the rules that matter:
 *
 *   * the endpoint accepts `people[]`, rejects 7 people / unknown services and
 *     always recomputes the total server-side (a client total is ignored),
 *   * ONE order row + N people + M items are written, with the free-beta report
 *     on the FIRST report only,
 *   * the legacy `items[]` family tray still works unchanged,
 *   * admin Preview and Send share the SAME cached per-item result, and sending
 *     fails closed when the preview-quality PDFs are missing,
 *   * the PHP mirror keeps the same schema/transaction guarantees.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import { db } from '../server/db/store.js';
import { servicesRouter } from '../server/routes/services.js';
import { adminRouter } from '../server/routes/admin.js';
import { createSignedToken } from '../server/security/tokens.js';
import { buildOnlinePaymentReference } from '../server/services/paymentReconciliation.js';
import { getServicePrices } from '../src/services/pricing.js';
import { validateMultiPersonRequest } from '../server/services/multiPersonOrders.js';
import { MUHURTHAM_ALGORITHM_VERSION } from '../src/lib/muhurtham/scanner.js';
import {
  MULTI_PERSON_MAX_PEOPLE,
  MULTI_PERSON_MAX_ITEMS,
  buildPeoplePayload,
  createEmptyPersonDraft,
  multiPersonTotals,
  validatePeople
} from '../src/services/multiPersonOrder.js';

const pass = (message: string) => console.log(`  [PASS] ${message}`);
const clientIp = '198.51.100.91';

const birth = (name: string, gender: 'M' | 'F' = 'M') => ({
  name,
  gender,
  dob: '1990-08-15',
  tob: '09:30',
  place: 'Chennai, India',
  birthPlace: 'Chennai, India',
  country: 'India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5,
  timeZoneId: 'Asia/Kolkata',
  services: ['BIRTH_JATHAGAM'],
  language: 'en'
});

function person(source: Record<string, any>, services: string[] = ['BIRTH_JATHAGAM']) {
  return { ...source, services };
}

/** Same fixtures the frontend builds (partner block for a marriage chart). */
const partnerBlock = {
  name: 'Arun Kumar',
  gender: 'M',
  dob: '1988-02-11',
  tob: '14:05',
  place: 'Madurai, India',
  country: 'India',
  latitude: 9.9252,
  longitude: 78.1198,
  timezoneOffsetHours: 5.5,
  timeZoneId: 'Asia/Kolkata'
};

const muhurthamBlock = {
  place: 'Chennai, India',
  country: 'India',
  latitude: 13.0827,
  longitude: 80.2707,
  timezoneOffsetHours: 5.5,
  timeZoneId: 'Asia/Kolkata',
  eventKey: 'wedding',
  selectedMonth: '2026-06',
  muhurthamScan: { muhurthamAlgorithmVersion: MUHURTHAM_ALGORITHM_VERSION, selectedMonth: '2026-06', eventKey: 'wedding', months: [{ month: '2026-06' }], persons: [] }
};

async function run() {
  console.log('--- MULTI-PERSON ORDERS (ONE ORDER, UP TO 6 PEOPLE) ---');

  const customer = db.createUser({
    name: 'Multi Person Buyer',
    email: 'multi-person-buyer@example.test',
    mobile: '',
    passwordHash: 'not-used-by-this-test',
    role: 'customer',
    country: 'Fiji'
  });
  const token = createSignedToken(customer);
  const adminUser = db.createUser({
    name: 'Multi Person Admin',
    email: 'multi-person-admin@example.test',
    mobile: '',
    passwordHash: 'not-used-by-this-test',
    role: 'admin',
    country: 'Fiji'
  });
  const adminToken = createSignedToken(adminUser);

  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use('/api/services', servicesRouter);
  app.use('/api/admin', adminRouter);
  const server = createServer(app);
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function post(pathname: string, payload: Record<string, unknown>, authToken = token) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
        Authorization: `Bearer ${authToken}`,
        'X-Forwarded-For': clientIp
      },
      body: JSON.stringify(payload)
    });
    return { status: response.status, body: (await response.json()) as any };
  }

  async function get(pathname: string, authToken = adminToken) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { Connection: 'close', Authorization: `Bearer ${authToken}`, 'X-Forwarded-For': clientIp }
    });
    return { status: response.status, body: (await response.json()) as any };
  }

  try {
    db.updateSettings({ serviceMode: 'FREE_BETA' }, { id: 'test-admin', name: 'Test Admin' });

    // ---------------------------------------------------------------- shape
    const marriagePerson = person(birth('Suresh Sundar', 'M'), ['MARRIAGE_COMPATIBILITY']);
    marriagePerson.partner = partnerBlock;

    const prices = getServicePrices(db.getSettings(), 'BIRTH_JATHAGAM');
    const marriagePrices = getServicePrices(db.getSettings(), 'MARRIAGE_COMPATIBILITY');
    const babyPrices = getServicePrices(db.getSettings(), 'BABY_NAMING');
    // Three reports, first one free: two are chargeable and paid in INR (GPAY).
    const expectedTotal = Number((babyPrices.INR + marriagePrices.INR).toFixed(2));
    const gatewayOrderId = 'gateway_multi_person_1';
    const gatewayPaymentId = 'payment_multi_person_1';
    const paymentReference = buildOnlinePaymentReference('GPAY', gatewayPaymentId);
    const intent = db.createPaymentIntent({
      userId: customer.id,
      paymentMethod: 'GPAY',
      provider: 'razorpay',
      amount: expectedTotal,
      currency: 'INR',
      gatewayOrderId,
      expiresInMinutes: 30
    });
    assert.ok(db.capturePaymentIntent({ id: intent.id, userId: customer.id, gatewayOrderId, gatewayPaymentId, paymentReference }));
    assert.equal(intent.amount, expectedTotal);

    const three = await post('/api/services/multi-order', {
      people: [
        person(birth('Meena Sundar', 'F'), ['BIRTH_JATHAGAM', 'BABY_NAMING']),
        marriagePerson
      ],
      country: 'Fiji',
      billingCountry: 'Fiji',
      paymentMethod: 'GPAY',
      currency: 'INR',
      paymentReference,
      paymentIntentId: intent.id,
      // A client total must never be trusted: the endpoint recomputes it.
      totalAmount: 1
    });
    assert.equal(three.status, 201, JSON.stringify(three.body));
    assert.equal(three.body.order.serviceType, 'MULTI_PERSON');
    assert.equal(three.body.people.length, 2, 'two people rows');
    assert.equal(three.body.items.length, 3, 'three report items');
    assert.equal(three.body.freeCharts, 1, 'the first report of the order is free');
    assert.equal(three.body.currency, 'INR');
    assert.equal(three.body.totalAmount, expectedTotal, 'server-computed total (free first report only)');
    assert.equal(three.body.order.amount, expectedTotal);
    assert.equal(db.getPaymentIntentForUser(intent.id, customer.id)?.status, 'CONSUMED');
    assert.equal(db.getOrders().filter(o => o.id === three.body.order.id).length, 1, 'exactly ONE order row');
    assert.ok(three.body.items[0].unitPrice === 0, 'first item is the free one');
    assert.ok(three.body.items.slice(1).every((item: any) => item.unitPrice > 0));
    assert.ok(three.body.items.every((item: any) => item.calculatedResult), 'every report is pre-calculated');
    assert.equal(three.body.items[0].personId, three.body.people[0].id);
    pass('people[] creates ONE order row + N people + M reports with a server-side total');

    // The free beta report is consumed per IP; a second order is fully paid.
    const paidSecond = await post('/api/services/multi-order', {
      people: [person(birth('Second Buyer', 'M'), ['BIRTH_JATHAGAM'])],
      country: 'Fiji',
      billingCountry: 'Fiji',
      paymentMethod: 'MPAISA',
      currency: 'FJD',
      paymentReference: 'MPAISA-REF-778812'
    });
    assert.equal(paidSecond.status, 201, JSON.stringify(paidSecond.body));
    assert.equal(paidSecond.body.freeCharts, 0);
    assert.equal(paidSecond.body.totalAmount, prices.FJD);
    assert.equal(paidSecond.body.order.status, 'PENDING_PAYMENT_VERIFICATION');
    pass('free beta frees exactly one report per IP; later orders are paid and await verification');

    // -------------------------------------------------------- validation
    const tooMany = await post('/api/services/multi-order', {
      people: Array.from({ length: MULTI_PERSON_MAX_PEOPLE + 1 }, (_, index) => person(birth(`Person ${index + 1}`)))
    });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.body.message, /at most 6 people/);

    const unknownService = await post('/api/services/multi-order', {
      people: [person(birth('Unknown Service'), ['SOMETHING_ELSE'])]
    });
    assert.equal(unknownService.status, 400);
    assert.match(unknownService.body.message, /not a supported service code/);

    const marriageWithoutPartner = await post('/api/services/multi-order', {
      people: [person(birth('No Partner', 'F'), ['MARRIAGE_COMPATIBILITY'])]
    });
    assert.equal(marriageWithoutPartner.status, 400);
    assert.match(marriageWithoutPartner.body.message, /partner/i);

    const muhurthamWithoutScan = await post('/api/services/multi-order', {
      people: [{ ...person(birth('No Scan'), ['MUHURTHAM']), muhurtham: { ...muhurthamBlock, muhurthamScan: null } }]
    });
    assert.equal(muhurthamWithoutScan.status, 400);
    assert.match(muhurthamWithoutScan.body.message, /Muhurtham calendar is missing/i);

    const noBirthPlace = await post('/api/services/multi-order', {
      people: [{ ...person(birth('No Place')), place: '', latitude: null, longitude: null, timezoneOffsetHours: null }]
    });
    assert.equal(noBirthPlace.status, 400);
    pass('7 people, unknown service codes and incomplete cards are rejected before any write');

    // ------------------------------------------------- marriage + muhurtham payloads
    const validPeople = [person(birth('Bride Sample', 'F'), ['MARRIAGE_COMPATIBILITY', 'MUHURTHAM'])];
    validPeople[0].partner = partnerBlock;
    validPeople[0].muhurtham = muhurthamBlock;
    const validation = validateMultiPersonRequest(validPeople);
    assert.equal(validation.ok, true, validation.message);
    assert.equal(validation.items.length, 2);
    const marriagePayload = validation.items.find(item => item.serviceCode === 'MARRIAGE_COMPATIBILITY')!.inputPayload;
    assert.equal(marriagePayload.bride.name, 'Bride Sample');
    assert.equal(marriagePayload.groom.name, 'Arun Kumar');
    assert.equal(marriagePayload.brideName, 'Bride Sample');
    assert.equal(marriagePayload.groomLatitude, partnerBlock.latitude);
    const muhurthamPayload = validation.items.find(item => item.serviceCode === 'MUHURTHAM')!.inputPayload;
    assert.equal(muhurthamPayload.muhurthamPlace, muhurthamBlock.place);
    assert.equal(muhurthamPayload.selectedMonth, '2026-06');
    assert.equal(muhurthamPayload.muhurthamScan.muhurthamAlgorithmVersion, MUHURTHAM_ALGORITHM_VERSION);
    const countrylessValidation = validateMultiPersonRequest([
      person({ ...birth('Country Not Recorded'), country: '', birthCountry: '' })
    ]);
    assert.equal(countrylessValidation.ok, true, countrylessValidation.message);
    assert.equal(countrylessValidation.items[0].country, '', "billing/account country is not copied into the person's birth-country field");
    assert.equal(countrylessValidation.items[0].person.country, '', 'missing birth country remains blank in person storage');
    assert.equal(countrylessValidation.items[0].inputPayload.country, '', 'the astrology payload does not inherit Fiji or the account country');
    pass('marriage/Muhurtham payloads preserve separate locations and missing birth countries stay blank');

    // -------------------------------------------------------- legacy tray
    const legacy = await post('/api/services/multi-order', {
      items: [
        { serviceType: 'BIRTH_JATHAGAM', language: 'en', country: 'Fiji', inputPayload: birth('Legacy One') },
        { serviceType: 'BIRTH_JATHAGAM', language: 'en', country: 'Fiji', inputPayload: birth('Legacy Two') }
      ],
      country: 'Fiji',
      billingCountry: 'Fiji',
      paymentMethod: 'MPAISA',
      currency: 'FJD',
      paymentReference: 'MPAISA-LEGACY-99001'
    });
    assert.equal(legacy.status, 201, JSON.stringify(legacy.body));
    assert.equal(legacy.body.orders.length, 2, 'the legacy tray still writes one row per chart');
    assert.ok(legacy.body.orders.every((order: any) => order.groupId));
    pass('the legacy items[] family tray keeps its one-row-per-chart behaviour');

    // ------------------------------------------------- admin per-item preview
    const orderId = three.body.order.id;
    const items = db.getOrderItems(orderId);
    assert.equal(items.length, 3);
    // items[2] is the marriage report of person #2. Preview must derive its
    // result from the saved service inputs, even when a cached result exists.
    const cached = db.findOrderItem(orderId, items[2].id)!;
    const changedBrideDob = '1991-06-14';
    db.updateOrderItem(items[2].id, {
      inputPayload: {
        ...cached.inputPayload,
        bride: { ...cached.inputPayload.bride, dob: changedBrideDob }
      }
    });
    const preview = await get(`/api/admin/orders/${orderId}/items/${items[2].id}/result`);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.ok(preview.body.result, 'the report result is returned');
    assert.equal(preview.body.recalculated, true);
    assert.equal(preview.body.item.personSeq, 2, 'the item knows which person it belongs to');
    assert.equal(preview.body.result.brideDob, changedBrideDob, 'the changed saved birth input drives the fresh chart');
    assert.equal(db.findOrderItem(orderId, items[2].id)?.calculatedResult?.brideDob, changedBrideDob,
      'Preview refreshes the cached result without rewriting the account/billing fields');
    const second = await get(`/api/admin/orders/${orderId}/items/${items[2].id}/result`);
    assert.equal(second.body.recalculated, true, 'every Preview verifies against the saved service inputs');
    assert.equal(second.body.result.brideDob, changedBrideDob);
    pass('admin Preview rebuilds report items from saved inputs and refreshes their cached results');

    // Sending without the preview-quality documents fails closed.
    const failClosed = await post(`/api/admin/orders/${orderId}/items/send-all`, {}, adminToken);
    assert.equal(failClosed.status, 422);
    assert.match(failClosed.body.message, /Preview-quality PDF/i);
    assert.ok(db.getOrderItems(orderId).every(item => item.reportStatus !== 'SENT'), 'nothing is marked SENT');
    pass('per-report Send refuses to email anything without the preview-quality PDFs');

    // ------------------------------------------------------- frontend model
    const draft = createEmptyPersonDraft('en');
    draft.name = 'Draft Person';
    draft.dob = '1992-04-04';
    draft.tob = '08:15';
    draft.place = 'Suva, Fiji';
    draft.latitude = -18.1416;
    draft.longitude = 178.4419;
    draft.timezoneOffsetHours = 12;
    draft.services = ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY'];
    const missingPartner = validatePeople([draft], 'en');
    assert.equal(missingPartner.ok, false);
    assert.ok(missingPartner.errors.some(error => /partner/i.test(error)));
    draft.partner = {
      name: 'Draft Partner',
      gender: 'M',
      dob: '1990-01-01',
      tob: '10:00',
      place: 'Suva, Fiji',
      country: 'Fiji',
      latitude: -18.1416,
      longitude: 178.4419,
      timezoneOffsetHours: 12,
      timeZoneId: 'Pacific/Fiji'
    };
    assert.equal(validatePeople([draft], 'en').ok, true);

    const settings = db.getSettings() as any;
    const free = multiPersonTotals([draft], settings, 'FJD', true);
    assert.equal(free.itemCount, 2);
    assert.equal(free.lineTotals[0], 0, 'only the FIRST report is free');
    assert.equal(free.total, getServicePrices(settings, 'MARRIAGE_COMPATIBILITY').FJD);
    assert.ok(MULTI_PERSON_MAX_PEOPLE === 6 && MULTI_PERSON_MAX_ITEMS === 24);

    const payloadPeople = buildPeoplePayload([draft]);
    assert.equal(payloadPeople.length, 1);
    assert.deepEqual(payloadPeople[0].services, ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY']);
    assert.equal(payloadPeople[0].partner?.name, 'Draft Partner');
    pass('checkout model validates partner cards and frees only the first report');

    // ------------------------------------------------------------ sources
    const migration = readFileSync(resolve(process.cwd(), 'api/migrations/003_multi_person_orders.sql'), 'utf8');
    assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS `order_persons`'));
    assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS `order_items`'));
    assert.ok((migration.match(/ON DELETE CASCADE/g) || []).length >= 2);
    for (const column of ['order_id', 'seq', 'full_name', 'gender', 'dob', 'tob', 'place', 'country', 'lat', 'lon', 'tz']) {
      assert.ok(migration.includes(`\`${column}\``), `order_persons.${column}`);
    }
    for (const column of ['service_code', 'unit_price', 'report_status']) {
      assert.ok(migration.includes(`\`${column}\``), `order_items.${column}`);
    }
    assert.ok(migration.includes('INSERT INTO `order_persons`'), 'legacy orders are backfilled with one person');
    assert.ok(migration.includes('INSERT INTO `order_items`'), 'legacy orders are backfilled with one item');
    assert.ok(!migration.includes("`country` VARCHAR(100) NOT NULL DEFAULT 'Fiji'"), 'birth countries are never silently defaulted to Fiji');
    const countryMigration = readFileSync(resolve(process.cwd(), 'api/migrations/005_remove_order_person_birth_country_default.sql'), 'utf8');
    assert.ok(countryMigration.includes('MODIFY COLUMN `country` VARCHAR(100) NOT NULL'), 'existing order_persons tables lose the fake birth-country default without rewriting saved values');

    const phpOrders = readFileSync(resolve(process.cwd(), 'api/services/multi_person_order.php'), 'utf8');
    assert.ok(phpOrders.includes('beginTransaction()'), 'the PHP create-order endpoint uses ONE transaction');
    assert.ok(phpOrders.includes('astro_multi_person_unit_price'), 'prices come from the server price list');
    assert.ok(!phpOrders.includes("`country` VARCHAR(100) NOT NULL DEFAULT 'Fiji'"), 'runtime order-person schema does not fabricate Fiji birth countries');
    assert.ok(phpOrders.includes("$b['country'],"), 'the PHP writer persists the person-provided country verbatim, including an empty value');
    assert.ok(phpOrders.includes("define('ASTRO_MULTI_PERSON_MAX_PEOPLE', 6)"), 'the six-people cap is server-side');
    assert.ok(phpOrders.includes('count($peopleInput) > ASTRO_MULTI_PERSON_MAX_PEOPLE'), 'the cap is enforced on the request');
    assert.ok(!/\$clientTotal|\$body\['totalAmount'\]\s*\?\?/.test(phpOrders), 'the client total is never used for pricing');

    const phpAdmin = readFileSync(resolve(process.cwd(), 'api/admin/index.php'), 'utf8');
    assert.ok(phpAdmin.includes('items\\/(\\d+)\\/result'), 'per-item result route');
    assert.ok(phpAdmin.includes('items\\/(\\d+)\\/(send|resend)'), 'per-item send/resend route');
    assert.ok(phpAdmin.includes('items\\/send-all'), 'send-all route');
    assert.ok(phpAdmin.includes('astro_attach_order_items'), 'admin order lists carry people + items');

    const phpItems = readFileSync(resolve(process.cwd(), 'api/admin/order_items.php'), 'utf8');
    assert.ok(phpItems.includes('function astro_get_or_calculate_result('), 'the shared Preview/Send recalculation helper exists');
    assert.ok(phpItems.includes('AstroEngine::rebuildReportResultFromSavedInputs($syntheticOrder)'), 'each report rebuilds from its own saved inputs');
    assert.ok(phpItems.includes('SET calculated_result = ?,') && phpItems.includes('WHERE id = ?'), 'the rebuilt item result is persisted before use');
    assert.ok(phpItems.includes("'reportStatus' =>"), 'items expose their SENT/FAILED state');
    pass('migration, PHP transaction, per-item admin routes and saved-input result rebuilding are all in place');

    console.log('Multi-person orders passed.');
  } finally {
    server.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
