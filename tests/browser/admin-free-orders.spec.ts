import { test, expect, type Page } from '@playwright/test';
import type { ServiceMode, ServiceType, UserRole } from '../../src/types';

const serviceTypes: ServiceType[] = ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'];
const servicePricing = {
  BIRTH_JATHAGAM: { fjd: 35, inr: 499, usd: 18 },
  MARRIAGE_COMPATIBILITY: { fjd: 45, inr: 699, usd: 22 },
  BABY_NAMING: { fjd: 30, inr: 399, usd: 15 },
  MUHURTHAM: { fjd: 40, inr: 599, usd: 20 }
};

async function openCheckout(page: Page, options: {
  role: UserRole;
  mode: ServiceMode;
  serviceType?: ServiceType;
  family?: boolean;
  betaFreeChartAvailable?: boolean;
}) {
  const user = { id: 'checkout-user', name: 'Checkout Test', email: 'checkout@example.test', mobile: '', country: 'India', role: options.role };
  const settings = {
    serviceMode: options.mode, betaFreeChartAvailable: options.betaFreeChartAvailable ?? false, servicePricing
  };
  const submitted: any[] = [];
  const gatewayCalls: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const action = url.searchParams.get('action');
    if (path.includes('/payment/')) gatewayCalls.push(path);
    let response: any = { success: true };
    if (path.endsWith('/settings') || action === 'settings') response.settings = settings;
    else if (path.endsWith('/me') || action === 'me') response.user = user;
    else if (path.endsWith('/order') || path.endsWith('/multi-order')) {
      const payload = route.request().postDataJSON();
      submitted.push(payload);
      const created = (item: any, index = 0) => ({
        ...item, id: `test-order-${index}`, orderNumber: `TEST-${index}`, userId: user.id,
        amount: options.role === 'admin' ? 0 : servicePricing[item.serviceType as ServiceType].inr,
        serviceMode: options.role === 'admin' ? 'FREE_BETA' : options.mode,
        paymentMethod: payload.paymentMethod, paymentStatus: options.role === 'admin' ? 'NOT_REQUIRED' : 'PENDING_ADMIN'
      });
      if (payload.items) response = { success: true, orders: payload.items.map(created), groupId: 'TEST-FAMILY' };
      else response.order = created(payload);
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
  });

  // Mount only checkout, avoiding Google Maps/fonts and unrelated full-page
  // components. Vite's React preamble is needed for the real TSX modules.
  await page.route('http://127.0.0.1:4173/', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><head><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script></head><body></body></html>`
  }));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__vite_plugin_react_preamble_installed__);
  await page.evaluate(async ({ options, serviceTypes }) => {
    // H3: the session now lives in an httpOnly cookie - the mocked GET /me
    // route above restores it. Planted localStorage tokens must no longer
    // authenticate anything (they are purged on load).
    // Simulate an admin returning to an existing cart/payment selection that
    // contains retail prices. Admin pricing must still zero every line.
    localStorage.setItem('astrosivam_family_cart_payment_method', 'GPAY');
    localStorage.setItem('astrosivam_family_cart', JSON.stringify(options.family
      ? serviceTypes.map((serviceType, index) => ({
          id: `chart-${index}`, serviceType, language: 'en', country: 'India',
          devoteeName: `Family Member ${index + 1}`, inputPayload: { name: `Family Member ${index + 1}` },
          prices: { FJD: 999, INR: 999, USD: 999 }, unitPrice: 999
        }))
      : []));
    const modulePath = '/tests/browser/checkout-harness.tsx';
    const { mountCheckout } = await import(modulePath);
    mountCheckout({ serviceType: options.serviceType || 'BIRTH_JATHAGAM', family: !!options.family });
  }, { options, serviceTypes });
  await expect(page.getByText(options.family ? 'Unified Family Order Checkout' : 'ASTRO SIVAM CHECKOUT', { exact: true })).toBeVisible();
  return { submitted, gatewayCalls, errors };
}

for (const mode of ['PAID', 'FREE_BETA'] as const) {
  for (const serviceType of serviceTypes) {
    test(`admin ${serviceType} skips all payment fields in ${mode} mode`, async ({ page }) => {
      const { submitted, gatewayCalls, errors } = await openCheckout(page, { role: 'admin', mode, serviceType });
      await expect(page.getByText('Admin — All Reports Are Always Free', { exact: true })).toBeVisible();
      await expect(page.getByText('★ FREE 1ST REPORT', { exact: true })).toHaveCount(0);
      await expect(page.getByPlaceholder('e.g. TXN1049281 / MP849204 / UPI Ref')).toHaveCount(0);
      await expect(page.getByRole('button', { name: '₹ INR', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Confirm Free Order →' }).click();
      await expect(page.getByText('Order Submitted Successfully!', { exact: true })).toBeVisible();
      expect(submitted).toHaveLength(1);
      expect(submitted[0]).toMatchObject({ serviceType, paymentMethod: 'NONE' });
      expect(submitted[0]).not.toHaveProperty('paymentReference');
      expect(submitted[0]).not.toHaveProperty('paymentIntentId');
      expect(gatewayCalls).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(`all admin family reports are free in ${mode} mode`, async ({ page }) => {
    const { submitted, gatewayCalls, errors } = await openCheckout(page, { role: 'admin', mode, family: true });
    await expect(page.getByText('Admin order — all charts are free', { exact: true })).toBeVisible();
    await expect(page.getByText('FREE (Admin Order)', { exact: true })).toHaveCount(5); // 4 charts + total
    await expect(page.getByText('2. Choose Your Payment Method', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Confirm Free Order →' }).click();
    await expect(page.getByText('Admin Order Placed Successfully!', { exact: true })).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ paymentMethod: 'NONE', totalAmount: 0 });
    expect(submitted[0].items).toHaveLength(4);
    expect(submitted[0]).not.toHaveProperty('paymentReference');
    expect(submitted[0]).not.toHaveProperty('paymentIntentId');
    expect(gatewayCalls).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const mode of ['PAID', 'FREE_BETA'] as const) {
  test(`customer still needs a receipt in ${mode} mode after beta is used`, async ({ page }) => {
    const { submitted, errors } = await openCheckout(page, { role: 'customer', mode });
    const receipt = page.getByPlaceholder('e.g. TXN1049281 / MP849204 / UPI Ref');
    await expect(receipt).toBeVisible();
    await expect(receipt).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'Confirm Free Order →' })).toHaveCount(0);
    // Payment selection must continue to derive currency correctly after the
    // admin UI fix (there is no separate setCurrency method in CartContext).
    await page.getByRole('button', { name: 'US$', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Place Order • US$18 USD' })).toBeVisible();
    await receipt.fill('CUSTOMER-RECEIPT-2026');
    await page.getByRole('button', { name: 'Place Order • US$18 USD' }).click();
    await expect(page.getByText('Order Submitted Successfully!', { exact: true })).toBeVisible();
    expect(submitted[0]).toMatchObject({ paymentMethod: 'PAYPAL', currency: 'USD', paymentReference: 'CUSTOMER-RECEIPT-2026' });
    expect(errors).toEqual([]);
  });
}

test('customer family beta allowance still covers only the first chart', async ({ page }) => {
  const { submitted } = await openCheckout(page, { role: 'customer', mode: 'FREE_BETA', family: true, betaFreeChartAvailable: true });
  await expect(page.getByText('FREE (Free Beta)', { exact: true })).toHaveCount(1);
  await expect(page.getByText('2. Choose Your Payment Method', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Free Order →' })).toHaveCount(0);
  expect(submitted).toEqual([]);
});
