import { expect, test } from '@playwright/test';
import { auditScreen } from './axe-scan';

/**
 * The axe smoke on the site and the console sign-in (AMENDMENTS-A11Y-CI row AC-2, WO-08). The site's home and
 * `/signin` of apps/web's default static export are scanned with axe-core (WCAG 2.0 to 2.2 A and AA plus best practice)
 * and compared with `fixtures/axe-baseline.json`, a node count per screen and rule (section 3.5; `axe-scan.ts` holds
 * the rules of what fails). It runs in `preview-deploy.yml`'s existing `test:e2e` step on the pull requests that
 * workflow covers: a visible check, not a required one (OD-AC4 = (b)).
 *
 * The default export has no Clerk key and the dev sign-in is off, so `/signin` is scanned as the page and its
 * signed-out state. On another export (`E2E_OUT`, such as the merged app-host dist) the home `/` is the learner app,
 * not the site, so `site-home` is skipped there. Run it locally:
 *
 *   pnpm --filter @hangul-route/web build
 *   pnpm --filter @hangul-route/web exec playwright test axe-site.spec
 *
 * `PORT` moves the server if 4191 is taken (playwright.config.ts); a busy port fails loudly.
 */
test.describe('axe smoke on the site and the console sign-in (AMENDMENTS-A11Y-CI AC-2)', () => {
  test('site-home: the site home', async ({ page }) => {
    test.skip(Boolean(process.env.E2E_OUT), 'on the merged dist, / is the learner app, not the site');
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await auditScreen(page, 'site-home');
  });

  test('signin: the console sign-in, signed out', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await auditScreen(page, 'signin');
  });
});
