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
});
