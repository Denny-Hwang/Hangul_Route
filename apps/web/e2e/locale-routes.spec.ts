import { expect, test } from '@playwright/test';

/**
 * F-I18N-001 PR 11b, §3.4: the site's route groups over the static export. English is at `/` with
 * `<html lang="en">`; `/es` and `/ko` are rendered by every build but a locale that has not shipped is taken
 * out of the export (`scripts/prune-hidden-locales.mjs`), so the Worker answers with the 404 page.
 */
const HIDDEN = ['/es', '/es/', '/es/about', '/es/privacy', '/es/terms', '/ko', '/ko/about'] as const;

test.describe('locale routes', () => {
  for (const path of ['/', '/about', '/privacy', '/terms', '/teach']) {
    test(`${path} is an English document`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  }

  test('unknown paths get the 404 page in an English document', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });

  for (const path of HIDDEN) {
    test(`${path} is not served while the locale is hidden`, async ({ page }) => {
      test.skip(process.env.NEXT_PUBLIC_SHOW_ALL_LOCALES === '1', 'a QA build exports every locale');
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }

  // Each group renders its own <html>/<body> under one shared top layout, so a soft navigation between groups
  // would replace them in place and delete what React did not render, like Next's route announcer. Links
  // between the site and the console are plain <a>, so each crossing loads a new document.
  const announcerConnected = (page: import('@playwright/test').Page): Promise<boolean> =>
    page.evaluate(() => document.querySelector('next-route-announcer')?.isConnected === true);

  test('crossing from the site to the console and back keeps the route announcer', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => announcerConnected(page)).toBe(true);

    await page.locator('header a[href="/teach"]').first().click();
    // The /teach router (F-APP-001 A-4b) sends a signed-out visitor on to /signin.
    await page.waitForURL('**/signin');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.poll(() => announcerConnected(page)).toBe(true);

    // A console page that needs no sign-in (since F-APP-001 A-5b `/parent` is the signed-in family home).
    await page.goto('/signin');
    await page.locator('a[href="/"]').first().click();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.poll(() => announcerConnected(page)).toBe(true);
    await expect(page.locator('html')).toHaveCount(1);
  });

  test('links inside the site stay client-side and keep the route announcer', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => announcerConnected(page)).toBe(true);
    await page.locator('footer a[href="/about"]').first().click();
    await page.waitForURL('**/about');
    await expect.poll(() => announcerConnected(page)).toBe(true);
  });
});
