import { expect, test } from './fixtures';
import {
  E2E_PIN,
  onboardChild,
  openGrownUpZone,
  readStored,
  seedRescueCode,
  seedStored,
  typeDigits,
  unlockWithPin,
} from './helpers';

/**
 * F-LEARN-001 §3.5, §3.14: Forgot PIN. The Rescue Code path is covered in
 * onboarding-guardian.spec.ts; here the 24-hour wait (no code stored), the
 * shared attempt throttle, and the PIN screen's titles by audience (§3.4).
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('no stored code: only the 24-hour wait; the old PIN keeps working and clears the request', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await openGrownUpZone(page, 'Mina');
      await page.getByRole('button', { name: 'Forgot PIN?' }).click();

      await expect(page.getByRole('heading', { name: 'Reset the PIN' })).toBeVisible();
      await expect(page.getByText('Wait 24 hours')).toBeVisible();
      await expect(page.getByText('Use a Rescue Code')).toHaveCount(0);
      await expect(page.getByText("I don't have the code")).toHaveCount(0);

      const start = page.getByRole('button', { name: 'Start the wait' });
      await start.scrollIntoViewIfNeeded();
      await start.click();
      await expect(page.getByText(/^You can set a new PIN after /)).toBeVisible();
      const waiting = page.getByRole('button', { name: 'Wait started' });
      await expect(waiting).toBeDisabled();
      const stamp = await readStored<string>(page, 'account:pinResetRequestedAt');
      expect(stamp).not.toBeNull();
      expect(Math.abs(Date.parse(stamp!) - Date.now())).toBeLessThan(60_000);

      // The old PIN keeps working meanwhile, and using it settles the request.
      await page.getByRole('button', { name: 'Go back' }).click();
      await unlockWithPin(page, E2E_PIN);
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
      await expect.poll(() => readStored(page, 'account:pinResetRequestedAt')).toBeNull();
    });

    test('after 24 hours the button reads "Set a new PIN" and the new PIN replaces the old one', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await seedStored(page, 'account:pinResetRequestedAt', new Date(Date.now() - DAY_MS - 60_000).toISOString());
      const oldHash = await readStored<string>(page, 'account:parentPinHash');

      await openGrownUpZone(page, 'Mina');
      await page.getByRole('button', { name: 'Forgot PIN?' }).click();
      await expect(page.getByText('The 24 hours are up.')).toBeVisible();
      await page.getByRole('button', { name: 'Set a new PIN' }).click();

      await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
      for (const round of [0, 1]) {
        await typeDigits(page, '2468');
        await page.getByRole('button', { name: 'Next' }).click();
        if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
      }
      await expect.poll(() => readStored<string>(page, 'account:parentPinHash')).not.toBe(oldHash);
      // Only after the new PIN is stored is the request cleared.
      await expect.poll(() => readStored(page, 'account:pinResetRequestedAt')).toBeNull();
    });

    test('a waiting request is shown again on return, and a stored code sits behind "I don\'t have the code"', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await seedRescueCode(page, 'TIGER-MOON-RIVER-APPLE-482139');
      await openGrownUpZone(page, 'Mina');
      await page.getByRole('button', { name: 'Forgot PIN?' }).click();

      await expect(page.getByText('Use a Rescue Code')).toBeVisible();
      await expect(page.getByText('Wait 24 hours')).toHaveCount(0);
      const disclosure = page.getByRole('button', { name: "I don't have the code" });
      await disclosure.scrollIntoViewIfNeeded();
      await disclosure.click();
      await expect(page.getByText('Wait 24 hours')).toBeVisible();
      const start = page.getByRole('button', { name: 'Start the wait' });
      await start.scrollIntoViewIfNeeded();
      await start.click();
      await expect(page.getByRole('button', { name: 'Wait started' })).toBeDisabled();
    });

    test('wrong Rescue Codes share the PIN throttle: five wrong tries give a calm break', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await seedRescueCode(page, 'TIGER-MOON-RIVER-APPLE-482139');
      await openGrownUpZone(page, 'Mina');
      await page.getByRole('button', { name: 'Forgot PIN?' }).click();

      const code = page.getByTestId('pin-reset-code-input');
      const go = page.getByRole('button', { name: 'Continue' });
      for (let i = 0; i < 5; i += 1) {
        await code.fill('TIGER-MOON-RIVER-APPLE-000000');
        await go.click();
      }
      await expect(page.getByText(/^Let's take a short break\. Try again in \d+s\.$/)).toBeVisible();
      await expect(go).toBeDisabled();
    });

    test('a self-only device with a PIN says "Settings PIN" and "Create a PIN", never "grown-up"', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await page.getByRole('radio', { name: /^Me\./ }).click();
      await page.getByPlaceholder('Type a name').fill('Soo');
      const row = page.getByRole('button', { name: 'Protect settings with a PIN (optional)' });
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await typeDigits(page);
      await typeDigits(page);
      await page.getByRole('checkbox').click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Your first card is waiting.')).toBeVisible();
      await page.getByRole('button', { name: 'Start my journey' }).click();

      await page.goto('/');
      await expect(page.getByText('Hi, Soo!')).toBeVisible();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await page.getByRole('button', { name: /^Account & backup/ }).first().click();
      await expect(page.getByRole('heading', { name: 'Settings PIN' })).toBeVisible();
      await expect(page.getByText(/grown-up/i)).toHaveCount(0);

      await page.getByRole('button', { name: 'Forgot PIN?' }).click();
      await expect(page.getByRole('heading', { name: 'Reset the PIN' })).toBeVisible();
      await expect(page.getByText(/grown-up/i)).toHaveCount(0);
    });
  });
}
