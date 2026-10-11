import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf } from './helpers';

/**
 * F-LEARN-001 §3.7, §3.9, L7: no "Age X" label anywhere, copy that reads the
 * same to a learner and a parent, and a grown-up gate that is skipped on a
 * self-only device that never set a PIN (Profile no longer forces PIN setup).
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

const LEVEL_LABEL = /^(Pictures first|Some reading|Reads easily)$/;

const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

async function openProfile(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open and covers the Home tabs.
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('self-only device without a PIN: neutral copy, a level label and direct access (no forced PIN setup)', async ({ page }) => {
      await onboardSelf(page, { name: 'Rio' });
      await page.goto('/');
      await expect(page.getByText('Hi, Rio!')).toBeVisible();
      await expect(page.getByText('Reviews picked for you')).toBeVisible();
      await openProfile(page, 'Rio');

      // The card shows the name and the level label, never an age.
      await expect(page.getByText('Tap a profile to switch.')).toBeVisible();
      const card = page.getByRole('button', { name: 'Switch to Rio' });
      await expect(card.getByText(LEVEL_LABEL)).toBeVisible();
      const text = await screenText(page);
      expect(text).not.toMatch(/\bAges?\b|Tap a Hoya|grown-up/i);

      // Account section: no "Grown-up zone", no "(PIN required)" while no PIN exists.
      await expect(page.getByRole('button', { name: 'Account & backup', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add a profile', exact: true })).toBeAttached();
      await expect(page.getByRole('button', { name: /PIN required/ })).toHaveCount(0);

      // Restore opens at once: no PIN screen in between.
      const restore = page.getByRole('button', { name: 'Restore from a file', exact: true });
      await restore.scrollIntoViewIfNeeded();
      await restore.click();
      await expect(page.getByRole('heading', { name: 'Bring back progress' })).toBeVisible();
      await expect(page.getByText(/Create a (grown-up )?PIN/)).toHaveCount(0);
      await expect(page.getByText('Got a rescue code, an account, or a saved file?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    });

    test('self-only device without a PIN: Add a profile and a locked stage open directly', async ({ page }) => {
      await onboardSelf(page, { name: 'Rio' });
      await openProfile(page, 'Rio');
      const add = page.getByRole('button', { name: 'Add a profile', exact: true });
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await expect(page.getByRole('heading', { name: 'Who is learning?' })).toBeVisible();
      await expect(page.getByText(/Create a (grown-up )?PIN/)).toHaveCount(0);

      // A locked Journey stage goes straight to the unlock page.
      await page.goto('/');
      await expect(page.getByText('Hi, Rio!')).toBeVisible();
      const guide = page.getByTestId('install-guide');
      await page.waitForTimeout(800);
      if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
      await page.getByText('Journey', { exact: true }).last().click();
      await page.getByRole('button', { name: /: locked\. Opens the unlock page\.$/ }).first().click();
      await expect(page.getByRole('button', { name: 'Open the web console' })).toBeVisible();
      await expect(page.getByText(/Create a (grown-up )?PIN/)).toHaveCount(0);
    });

    test('family device: the gate and its wording are unchanged, still no age', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await openProfile(page, 'Mina');

      await expect(page.getByText('Tap a profile to switch.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Switch to Mina' }).getByText(LEVEL_LABEL)).toBeVisible();
      expect(await screenText(page)).not.toMatch(/\bAges?\b|Tap a Hoya/i);

      await expect(page.getByRole('button', { name: 'Grown-up zone (PIN required)' })).toBeAttached();
      const add = page.getByRole('button', { name: 'Add a profile (PIN required)' });
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    });
  });
}
