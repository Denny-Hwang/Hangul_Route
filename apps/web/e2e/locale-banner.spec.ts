import { getMessages } from '@hangul-route/i18n';
import { expect, test } from '@playwright/test';

/**
 * F-I18N-001 PR 11c (§3.3): the "View in <language>" banner on `/`, the footer locale switcher and the
 * `?lang=` hand-off, over the static export. While es and ko are hidden none of it is on the page; a QA build
 * (`NEXT_PUBLIC_SHOW_ALL_LOCALES=1`) shows all three locales.
 */
const QA = process.env.NEXT_PUBLIC_SHOW_ALL_LOCALES === '1';
/** The banner is worded in the locale it suggests (its own dictionary): Spanish since F-I18N-001 PR 15. */
const banner = `aside[aria-label="${getMessages('es').landing.localeBanner.label}"]`;
/** Any banner, whatever language it is worded in (the hidden-locale build must show none). */
const anyBanner = 'aside[lang]';

test.describe('while es and ko are hidden', () => {
  test.skip(QA, 'a QA build shows every locale');
  test.use({ locale: 'es-ES' });

  test('/ shows no banner and no switcher, even to a Spanish browser', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator(anyBanner)).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Language"]')).toHaveCount(0);
    await expect(page.locator('a[href^="https://app.hangulroute.com?lang="]')).toHaveCount(0);
  });
});

test.describe('on a QA build', () => {
  test.skip(!QA, 'needs NEXT_PUBLIC_SHOW_ALL_LOCALES=1');

  test.describe('a Spanish browser', () => {
    test.use({ locale: 'es-ES' });

    test('is offered Spanish on /, never redirected, and the link opens /es', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      const offer = page.locator(banner);
      await expect(offer).toBeVisible();
      await expect(offer).toHaveAttribute('lang', 'es');
      await offer.locator('a[href="/es"]').click();
      await page.waitForURL((url) => url.pathname === '/es');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.locator(banner)).toHaveCount(0);
    });

    test('closing it keeps it closed for the visit', async ({ page }) => {
      await page.goto('/');
      await page.locator(`${banner} button`).click();
      await expect(page.locator(banner)).toHaveCount(0);
      await page.reload();
      await expect(page.locator('footer')).toBeVisible();
      await expect(page.locator(banner)).toHaveCount(0);
    });

    test('the banner fits a 320 px screen with no sideways scroll', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto('/');
      await expect(page.locator(banner)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // Both controls are touch-sized (touchTarget.min, 64): the link as well as the close button.
      for (const control of [`${banner} a`, `${banner} button`]) {
        const box = await page.locator(control).boundingBox();
        expect(box?.height ?? 0, control).toBeGreaterThanOrEqual(64);
      }
    });

    test('choosing English in the footer switcher on /es is not undone by the banner', async ({ page }) => {
      await page.goto('/es');
      await page.locator(`nav[aria-label="${getMessages('es').landing.footer.language}"] a[href="/"]`).click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.locator('footer')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.locator(banner)).toHaveCount(0);
      // Remembered for the visit, not only for this one arrival.
      await page.goto('/about');
      await page.goto('/');
      await expect(page.locator('footer')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.locator(banner)).toHaveCount(0);
    });
  });

  test.describe('an English browser', () => {
    test.use({ locale: 'en-US' });

    test('gets no banner', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('footer')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.locator(anyBanner)).toHaveCount(0);
    });

    test('the footer switcher links every locale and loads it as its own document', async ({ page }) => {
      await page.goto('/ko');
      const nav = page.locator('nav[aria-label="Language"]');
      await expect(nav.locator('a')).toHaveText(['English', 'Español', '한국어']);
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('hreflang', 'ko');
      await nav.locator('a[href="/"]').click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('"Play now" on /ko carries the locale to the app', async ({ page }) => {
      await page.goto('/ko');
      await expect(page.locator('a[href="https://app.hangulroute.com?lang=ko"]')).toHaveCount(3);
    });
  });
});
