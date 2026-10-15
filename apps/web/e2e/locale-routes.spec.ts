import { getMessages } from '@hangul-route/i18n';
import { expect, test } from '@playwright/test';

/**
 * F-I18N-001 PR 11b, §3.4: the site's route groups over the static export. English is at `/` with
 * `<html lang="en">`; `/es` and `/ko` are rendered by every build, and both ship (F-I18N-001 rows 15b / 16b), so
 * they are served. A locale that has not shipped is taken out of the export (`scripts/prune-hidden-locales.mjs`).
 */
/** The locale pages, served since es and ko shipped (F-I18N-001 rows 15b / 16b). */
const LOCALE_PAGES = [
  ['/es', 'es'],
  ['/es/about', 'es'],
  ['/es/privacy', 'es'],
  ['/es/terms', 'es'],
  ['/ko', 'ko'],
  ['/ko/about', 'ko'],
  ['/ko/learners', 'ko'],
] as const;

test.describe('locale routes', () => {
  for (const path of ['/', '/about', '/privacy', '/terms', '/learners', '/parents', '/teachers', '/teach']) {
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

  // The 404 body is Next's own component, a full-screen inline box that `.hr-site-404` sizes to its content. If a
  // Next upgrade changes that markup, the two ways on would drop below the fold again; this pins them on screen.
  const notFound = getMessages('en').landing.notFound;
  for (const [width, height] of [[320, 568], [375, 812]] as const) {
    test(`the 404 page shows its two ways on in the first screen at ${width} x ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/no-such-page');
      for (const name of [notFound.home, notFound.start]) {
        const link = page.getByRole('main').getByRole('link', { name, exact: true });
        await expect(link).toBeInViewport({ ratio: 1 });
      }
    });
  }

  for (const [path, lang] of LOCALE_PAGES) {
    test(`${path} is served as a ${lang} document`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
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

    // The site's Sign in (F-SITE-002 §3.2) is a plain <a> to F-APP-001's /signin, on the app host since S-10
    // (a build without CONSOLE_ORIGIN), so it never soft-navigates into the console group of this export.
    await expect(page.locator('header a', { hasText: getMessages('en').landing.nav.signIn }).first()).toHaveAttribute(
      'href',
      'https://app.hangulroute.com/signin',
    );

    // A console page that needs no sign-in (since F-APP-001 A-5b `/parent` is the signed-in family home), still in
    // this export: the Worker forwards it to the app host with `_redirects`, the e2e server serves the file.
    await page.goto('/signin');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.poll(() => announcerConnected(page)).toBe(true);
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
