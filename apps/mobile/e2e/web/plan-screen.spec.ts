import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, unlockWithPin } from './helpers';

/**
 * F-BILL-002 B-9 (section 4.7, wireframe billing/plan-status, mock
 * design/screens/billing/plan-status.md): the learner Plan screen replaces the
 * price-bearing paywall. Profile shows Plan details for every tier and opens it
 * without a PIN; the screen shows status only (no price, no offer, no promo,
 * no terms line); on the web, Open billing goes through the grown-up gate and
 * then opens today's console billing page.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

const BILLING_URL = 'https://hangulroute.com/teach/billing';

const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

/** The console page is never reached for real: the hand-off is checked by the URL the new tab asks for. */
async function stubConsole(context: BrowserContext): Promise<void> {
  await context.route('https://hangulroute.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Billing</title><p>Billing</p>' }),
  );
}

async function openPlanDetails(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open, whenever it is ready, and covers the Home tabs.
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
  await expect(page.getByText('Free plan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /unlock/i })).toHaveCount(0);
  const details = page.getByRole('button', { name: 'Plan details', exact: true });
  await details.scrollIntoViewIfNeeded();
  await details.click();
}

async function expectStatusOnly(page: Page): Promise<void> {
  await expect(page.getByText('Stage 1 is always free.')).toBeVisible();
  const text = await screenText(page);
  expect(text).not.toMatch(/\$|\d+\.\d{2}|\/ year|lifetime|premium|unlock|\bbuy\b|promo|terms|web console/i);
  // Status, caption and both buttons fit the width: no sideways scroll at 320 px either.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('self-only device without a PIN: Plan details, status only, Open billing opens the billing page', async ({ page, context }) => {
      await stubConsole(context);
      await onboardSelf(page, { name: 'Rio' });
      await openPlanDetails(page, 'Rio');

      // The summary heading carries the state (a11y.planStatus).
      await expect(page.getByRole('heading', { name: 'Rio: Free plan.' })).toBeVisible();
      await expect(page.getByText("You're on the free plan.")).toBeVisible();
      await expect(page.getByText('Your plan and receipts are on the billing page.')).toBeVisible();
      await expect(page.getByText(/Create a (grown-up )?PIN/)).toHaveCount(0);
      await expectStatusOnly(page);
      await page.screenshot({ path: test.info().outputPath(`plan-screen-self-${vp.width}.png`), fullPage: true });

      // No PIN on this device: the gate opens directly, inside the tap.
      const open = page.getByRole('button', { name: 'Open billing' });
      await expect(open).toHaveAccessibleDescription('Opens the billing page');
      const [tab] = await Promise.all([page.waitForEvent('popup'), open.click()]);
      expect(tab.url()).toBe(BILLING_URL);
      await expect(page.getByText(/in a browser\./)).toHaveCount(0);
    });

    test('family device: Plan details needs no PIN; Open billing asks for the PIN, then opens the billing page', async ({ page, context }) => {
      await stubConsole(context);
      await onboardChild(page, { name: 'Mina' });
      await openPlanDetails(page, 'Mina');

      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Mina: Free plan.' })).toBeVisible();
      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
      await expect(page.getByText('Plans and receipts are on the billing page for grown-ups.')).toBeVisible();
      await expectStatusOnly(page);
      await page.screenshot({ path: test.info().outputPath(`plan-screen-family-${vp.width}.png`), fullPage: true });

      // A cancelled gate opens nothing.
      await page.getByRole('button', { name: 'Open billing' }).click();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
      expect(context.pages()).toHaveLength(1);

      // The right PIN returns to the Plan screen, which opens the billing page for the press that waited.
      await page.getByRole('button', { name: 'Open billing' }).click();
      const popup = page.waitForEvent('popup');
      await unlockWithPin(page);
      const tab = await popup;
      expect(tab.url()).toBe(BILLING_URL);
      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();

      // The grown-up session is open now: the next press opens it straight away.
      await tab.close();
      const [again] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open billing' }).click()]);
      expect(again.url()).toBe(BILLING_URL);
    });
  });
}
