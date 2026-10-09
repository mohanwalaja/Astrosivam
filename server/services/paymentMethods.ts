/** Canonicalize legacy payment-method names before gateway/order processing. */
export function normalizePaymentMethod(value: unknown): string {
  const method = typeof value === 'string' ? value.trim().toUpperCase() : '';
  // CARD has never had a distinct online processor; international card
  // checkout is handled by the PayPal REST flow.
  return method === 'CARD' ? 'PAYPAL' : method;
}
