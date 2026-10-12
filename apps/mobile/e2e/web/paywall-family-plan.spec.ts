import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardSelf } from './helpers';

/**
 * The family offer renews yearly (owner decision 2026-10-11,
 * docs/specs/AMENDMENTS-BILLING-FAMILY-YEARLY.md BY-1): the paywall's one offer
 * is the Family Plan at "$15.30 / year" and never reads as a one-time
 * lifetime purchase. Wireframe `paywall/upgrade.md`.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

async function openPaywall(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open and covers the Home tabs.
  const guide = page.getByTestId('install-guide');
  // It may appear shortly after Home renders, or not at all.
  if (await guide.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) {
    await guide.getByRole('button', { name: 'Not now' }).click();
  }
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
  const unlock = page.getByRole('button', { name: /Unlock the journey/ });
  await unlock.scrollIntoViewIfNeeded();
  await unlock.click(); // a self-only device without a PIN opens the gate directly
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('the one offer is the Family Plan at $15.30 / year, renewing yearly', async ({ page }) => {
      await onboardSelf(page, { name: 'Rio' });
      await openPaywall(page, 'Rio');

      const offer = page.getByLabel('Family Plan, $15.30 / year');
      await expect(offer).toBeVisible();
      await expect(offer.getByText('Renews every year. Cancel any time.')).toBeVisible();
      await expect(page.getByText('Renews yearly until cancelled. Terms and privacy are on the website.')).toBeVisible();
      await expect(page.getByText('Every Stage, new ones included')).toBeVisible();
      await expect(page.getByText('What the Family Plan unlocks')).toBeVisible();

      const text = await screenText(page);
      expect(text).not.toMatch(/lifetime|\bonce\b|one payment|nothing to cancel|for good/i);
      // The offer and its lines fit the width: no sideways scroll at 320 px either.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await offer.scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`paywall-family-plan-${vp.width}.png`), fullPage: true });
    });
  });
}
