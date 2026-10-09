import assert from 'node:assert/strict';
import { normalizePaymentMethod } from '../server/services/paymentMethods.js';

assert.equal(normalizePaymentMethod('CARD'), 'PAYPAL');
assert.equal(normalizePaymentMethod(' card '), 'PAYPAL');
assert.equal(normalizePaymentMethod('PAYPAL'), 'PAYPAL');
assert.equal(normalizePaymentMethod('UPI'), 'UPI');
assert.equal(normalizePaymentMethod(undefined), '');

console.log('  [PASS] Legacy card checkout is canonicalized to PayPal for gateway capture and order binding');
