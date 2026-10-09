import { test, expect, type Page } from '@playwright/test';
import type { ServiceType } from '../../src/types';

const serviceTypes: ServiceType[] = ['BIRTH_JATHAGAM', 'MARRIAGE_COMPATIBILITY', 'BABY_NAMING', 'MUHURTHAM'];
const servicePricing = {
  BIRTH_JATHAGAM: { fjd: 35, inr: 499, usd: 18 },
  MARRIAGE_COMPATIBILITY: { fjd: 45, inr: 699, usd: 22 },
  BABY_NAMING: { fjd: 30, inr: 399, usd: 15 },
  MUHURTHAM: { fjd: 40, inr: 599, usd: 20 }
};

async function mountRepeatCheckout(page: Page) {
  const user = {
    id: 'repeat-checkout-user', name: 'Repeat Checkout Test',
    email: 'repeat-checkout@example.test', mobile: '', country: 'India', role: 'customer'
  };
  const settings = { serviceMode: 'PAID', betaFreeChartAvailable: false, servicePricing };
  const submitted: any[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const action = url.searchParams.get('action');
    let response: any = { success: true };
    if (path.endsWith('/settings') || action === 'settings') response.settings = settings;
    else if (path.endsWith('/me') || action === 'me') response.user = user;
    else if (path.endsWith('/multi-order')) {
      const payload = route.request().postDataJSON();
      submitted.push(payload);
      response = {
        success: true,
        groupId: `TEST-FAMILY-${submitted.length}`,
        orders: payload.items.map((item: any, index: number) => ({
          ...item,
          id: `test-order-${submitted.length}-${index}`,
          orderNumber: `TEST-${submitted.length}-${index}`,
          amount: servicePricing[item.serviceType as ServiceType].inr,
          currency: 'INR',
          serviceMode: 'PAID',
          paymentStatus: 'PENDING_ADMIN'
        }))
      };
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response) });
  });

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
  await page.evaluate(async ({ serviceTypes }) => {
    // H3: the session now lives in an httpOnly cookie - the mocked GET /me
    // route above restores it. Planted localStorage tokens must no longer
    // authenticate anything (they are purged on load).
    localStorage.setItem('astrosivam_family_cart_payment_method', 'GPAY');
    localStorage.setItem('astrosivam_family_cart', JSON.stringify(serviceTypes.map((serviceType, index) => ({
      id: `first-family-chart-${index}`,
      serviceType,
      language: 'en',
      country: 'India',
      devoteeName: `Family Member ${index + 1}`,
      summaryText: `Test chart ${index + 1}`,
      inputPayload: { name: `Family Member ${index + 1}` },
      prices: {
        FJD: serviceType === 'BIRTH_JATHAGAM' ? 35 : serviceType === 'MARRIAGE_COMPATIBILITY' ? 45 : serviceType === 'BABY_NAMING' ? 30 : 40,
        INR: serviceType === 'BIRTH_JATHAGAM' ? 499 : serviceType === 'MARRIAGE_COMPATIBILITY' ? 699 : serviceType === 'BABY_NAMING' ? 399 : 599,
        USD: serviceType === 'BIRTH_JATHAGAM' ? 18 : serviceType === 'MARRIAGE_COMPATIBILITY' ? 22 : serviceType === 'BABY_NAMING' ? 15 : 20
      },
      unitPrice: 499,
      currency: 'INR'
    }))));
    const { mountCheckout } = await import('/tests/browser/checkout-harness.tsx');
    mountCheckout({ serviceType: 'BIRTH_JATHAGAM', family: true });
  }, { serviceTypes });

  await expect(page.getByText('Unified Family Order Checkout', { exact: true })).toBeVisible();
  return { submitted, errors };
}

test('a customer can place another family order with a fresh payment reference after a completed total payment', async ({ page }) => {
  const { submitted, errors } = await mountRepeatCheckout(page);
  const receipt = page.getByPlaceholder('e.g. 12-Digit UPI Ref / UTR Number (or pay online above)');

  await expect(page.getByRole('button', { name: 'Complete Payment • ₹2196.00 INR', exact: true })).toBeVisible();
  await receipt.fill('MANUAL-RECEIPT-ORDER-ONE-2026');
  await page.getByRole('button', { name: 'Complete Payment • ₹2196.00 INR', exact: true }).click();

  await expect(page.getByText('Payment Receipt Submitted!', { exact: true })).toBeVisible();
  await expect(page.getByText(/₹2196\.00 INR/)).toBeVisible();
  await expect(page.getByText('Single payment for all 4 family charts', { exact: true })).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(submitted[0].items).toHaveLength(4);
  expect(submitted[0].paymentReference).toBe('MANUAL-RECEIPT-ORDER-ONE-2026');

  await page.getByRole('button', { name: 'Place Another Order', exact: true }).click();
  await page.getByTestId('add-next-family-checkout').click();

  const followUpReceipt = page.getByPlaceholder('e.g. 12-Digit UPI Ref / UTR Number (or pay online above)');
  await expect(followUpReceipt).toBeVisible();
  await expect(followUpReceipt).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Complete Payment • ₹499.00 INR', exact: true })).toBeVisible();
  await followUpReceipt.fill('MANUAL-RECEIPT-ORDER-TWO-2026');
  await page.getByRole('button', { name: 'Complete Payment • ₹499.00 INR', exact: true }).click();

  await expect(page.getByText('Payment Receipt Submitted!', { exact: true })).toBeVisible();
  expect(submitted).toHaveLength(2);
  expect(submitted[1].items).toHaveLength(1);
  expect(submitted[1].paymentReference).toBe('MANUAL-RECEIPT-ORDER-TWO-2026');
  expect(submitted[1]).not.toHaveProperty('paymentIntentId');
  expect(errors).toEqual([]);
});
