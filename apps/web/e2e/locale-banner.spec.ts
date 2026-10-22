import { getMessages } from '@hangul-route/i18n';
import { expect, test } from '@playwright/test';

/**
 * F-I18N-001 PR 11c (§3.3): the "View in <language>" banner on `/`, the footer locale switcher and the
 * `?lang=` hand-off, over the static export. es and ko ship (F-I18N-001 rows 15b / 16b), so every export shows
 * all three locales.
 */
/** The banner is worded in the locale it suggests (its own dictionary): Spanish since F-I18N-001 PR 15. */
const banner = `aside[aria-label="${getMessages('es').landing.localeBanner.label}"]`;
/** Any banner, whatever language it is worded in (an English browser must get none). */
const anyBanner = 'aside[lang]';

test.describe('es and ko ship (F-I18N-001 rows 15b / 16b)', () => {
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

    // [SN] AMENDMENTS-SITE-NEWUSER §3.2 (SN-D3): the banner on every English page, offering the same page.
    test('[SN] on /parents is offered /es/parents, and the link opens it', async ({ page }) => {
      await page.goto('/parents');
      const offer = page.locator(banner);
      await expect(offer).toBeVisible();
      await expect(offer.locator('a')).toHaveAttribute('href', '/es/parents');
      await expect(offer.locator('a')).toHaveAttribute('hreflang', 'es');
      await offer.locator('a').click();
      await page.waitForURL((url) => url.pathname === '/es/parents');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    });

    test('[SN] closed on one page, it stays closed on the next for the session', async ({ page }) => {
      await page.goto('/teachers');
      await page.locator(`${banner} button`).click();
      await expect(page.locator(banner)).toHaveCount(0);
      await page.goto('/learners');
      await expect(page.locator('footer')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(page.locator(banner)).toHaveCount(0);
    });

    test('[SN] not on the legal pages', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await page.waitForTimeout(300);
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
      // The switcher is named in the page's language: Korean on /ko since F-I18N-001 PR 16.
      const nav = page.locator(`nav[aria-label="${getMessages('ko').landing.footer.language}"]`);
      await expect(nav.locator('a')).toHaveText(['English', 'Español', '한국어']);
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('hreflang', 'ko');
      await nav.locator('a[href="/"]').click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('Start learning on /ko carries the locale to the app (header, hero, closing band and footer)', async ({ page }) => {
      await page.goto('/ko');
      await expect(page.locator('a[href="https://app.hangulroute.com?lang=ko"]')).toHaveCount(4);
    });
  });
});
