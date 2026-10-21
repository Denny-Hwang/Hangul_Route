import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, openGrownUpZone, readStored, typeDigits } from './helpers';
import { shot } from './shots';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (section 8.3, OA-D7, OA-D19; CS-8, CS-16): the longer pauses,
 * on a fake clock, and one attempt count for every tab of the device.
 */

/** The visible pause line (a screen reader gets the same words once a minute from its own live region). */
const pauseLine = (page: Page) => page.getByTestId('pin-pause-line');

async function miss(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await typeDigits(page, '9999');
    await page.getByRole('button', { name: 'Unlock' }).click();
  }
}

test('10 misses give 30 s, then 60 s; the pad waits out each pause and the steps are stored', async ({ page }) => {
  await page.clock.install();
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');

  await miss(page, 5);
  await expect(pauseLine(page)).toHaveText("Let's take a short break. Try again in 30s.");
  await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toBeDisabled();
  await expect(page.getByTestId('pin-pause-live')).toHaveText("Let's take a short break. Try again in 30s.");
  // No hard lock: Cancel and Forgot PIN? stay usable; the help line waits for the 3rd pause.
  await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toBeEnabled();
  await expect(page.getByText('You can also set a new PIN with Forgot PIN?')).toHaveCount(0);
  await expect.poll(() => readStored<{ strikes: number }>(page, 'account:pinAttempts')).toMatchObject({ strikes: 1 });
  await shot(page, 'oa2-pin-pause-30s-pixel5');

  await page.clock.fastForward(30_000);
  await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toBeEnabled();
  await miss(page, 5);
  // The second pause is 60 s: it reads in seconds, as every pause under a minute does.
  await expect(pauseLine(page)).toHaveText(/^Let's take a short break\. Try again in (60s|1 min)\.$/);
  await expect.poll(() => readStored<{ strikes: number }>(page, 'account:pinAttempts')).toMatchObject({ strikes: 2 });
  await page.clock.fastForward(20_000);
  await expect(pauseLine(page)).toHaveText(/^Let's take a short break\. Try again in (3\d|40)s\.$/);
  // The pause survives a reload.
  await page.reload();
  await openGrownUpZone(page, 'Mina');
  await expect(pauseLine(page)).toHaveText(/^Let's take a short break\. Try again in \d+s\.$/);
});

test('the 3rd pause shows the help line on the Grown-up area', async ({ page }) => {
  await page.clock.install();
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  for (const wait of [30_000, 60_000]) {
    await miss(page, 5);
    await expect(pauseLine(page)).toBeVisible();
    await page.clock.fastForward(wait);
    await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toBeEnabled();
  }
  await miss(page, 5);
  await expect(pauseLine(page)).toHaveText("Let's take a short break. Try again in 5 min.");
  await expect(page.getByText('You can also set a new PIN with Forgot PIN?')).toBeVisible();
  await shot(page, 'oa2-pin-pause-5min-help-pixel5');
  await page.setViewportSize({ width: 320, height: 568 });
  await shot(page, 'oa2-pin-pause-5min-help-320');
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, 'oa2-pin-pause-5min-help-1280');
});

test('5 misses spread over 2 tabs pause both', async ({ page, context }) => {
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  const other = await context.newPage();
  await openGrownUpZone(other, 'Mina');

  await miss(page, 3);
  await expect(page.getByText('Not quite. 2 more tries.')).toBeVisible();
  await miss(other, 2);
  // The 5th miss of the device, in the second tab, starts the pause there.
  await expect(pauseLine(other)).toHaveText("Let's take a short break. Try again in 30s.");
  // The first tab meets it at its next try, and shows it when it comes back to the front.
  await miss(page, 1);
  await expect(pauseLine(page)).toHaveText(/^Let's take a short break\. Try again in \d+s\.$/);
  await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toBeDisabled();
  await other.close();
});
