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

  // AMENDMENTS-SITE-NEWUSER SN-2: the Worker serves the nearest 404.html (`404-page`; e2e/serve-out.mjs does the
  // same), so an unknown path under /es or /ko gets that locale's 404 page: its <html lang>, its words, links to its
  // own home and to the learner app in its language, one <title> and `noindex` alone.
  for (const [path, locale] of [['/no-such-page', 'en'], ['/es/nope', 'es'], ['/ko/nope', 'ko']] as const) {
    test(`${path} gets the ${locale} 404 page: lang, one title, noindex alone and two ways on`, async ({ page }) => {
      const t = getMessages(locale).landing.notFound;
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('title')).toHaveCount(1);
      await expect(page).toHaveTitle(t.title);
      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveCount(1);
      await expect(robots).toHaveAttribute('content', 'noindex');
      await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible();
      await expect(page.getByText(t.body)).toBeVisible();
      const main = page.getByRole('main');
      await expect(main.getByRole('link', { name: t.home, exact: true })).toHaveAttribute('href', locale === 'en' ? '/' : `/${locale}`);
      await expect(main.getByRole('link', { name: t.start, exact: true })).toHaveAttribute(
        'href',
        locale === 'en' ? 'https://app.hangulroute.com' : `https://app.hangulroute.com?lang=${locale}`,
      );
      // AMENDMENTS-SITE-NEWUSER §3.7 and §8: the site's 404 body, never Next's default block, and the home text link
      // before Start learning (the mock's order).
      await expect(page.locator('.next-error-h1')).toHaveCount(0);
      await expect(page.getByText('This page could not be found.')).toHaveCount(0);
      const order = await main.getByRole('link').evaluateAll((links) => links.map((a) => a.textContent?.trim()));
      expect(order).toEqual([t.home, t.start]);
      await expect(main.locator('svg[data-pose="waving"]')).toHaveCount(1);
      // §3.2 and §8: the language links of the 404 point at each locale's home (the unknown path would be another 404).
      const languageLinks = page.locator('footer a[hreflang]');
      expect(await languageLinks.count()).toBeGreaterThanOrEqual(2);
      for (const href of await languageLinks.evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
        expect(['/', '/es', '/ko']).toContain(href);
      }
    });
  }

  // The two ways on stay on the first screen of a small phone, under the header (§3.7, §3.11: Start learning ends on the
  // 320 x 568 first screen in every locale).
  for (const [width, height] of [[320, 568], [375, 812]] as const) {
    for (const [path, locale] of [['/no-such-page', 'en'], ['/es/nope', 'es'], ['/ko/nope', 'ko']] as const) {
      test(`${path} shows its two ways on in the first screen at ${width} x ${height}`, async ({ page }) => {
        const notFound = getMessages(locale).landing.notFound;
        await page.setViewportSize({ width, height });
        await page.goto(path);
        for (const name of [notFound.start, notFound.home]) {
          const link = page.getByRole('main').getByRole('link', { name, exact: true });
          await expect(link).toBeInViewport({ ratio: 1 });
        }
      });
    }
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
    // The way to the learner app always carries the console's language (AMENDMENTS-DISPLAY-NAV section 6).
    await page.locator('a[href="/?lang=en"]').first().click();
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
