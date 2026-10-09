import { test, expect } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
]) {
  test(`homepage How it works button opens the process page on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route('**/api/**', route => {
      // Vite also serves imported report data from /api/ as script modules.
      // Only mock API calls, not those modules or other static assets.
      const resourceType = route.request().resourceType();
      if (resourceType !== 'fetch' && resourceType !== 'xhr') return route.continue();
      return route.fulfill({ json: { success: true } });
    });
    await page.goto('/');

    const hero = page.locator('#introduction');
    await expect(hero.getByRole('button', { name: /^view services$/i })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'See sample reports', exact: true })).toHaveCount(0);

    const howItWorks = hero.getByRole('button', { name: 'How it works', exact: true });
    await expect(howItWorks).toBeVisible();
    // The home page no longer carries a sample-reports section; samples stay on each service page.
    await expect(page.locator('#sample-reports')).toHaveCount(0);

    await howItWorks.click();
    await expect(page.getByRole('heading', { name: 'How ASTRO SIVAM works', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/[?&]route=how-it-works(?:&|$)/);
  });
}
