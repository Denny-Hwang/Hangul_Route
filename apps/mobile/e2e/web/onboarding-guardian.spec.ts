import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { E2E_PIN, WHO_CHILD, onboardChild, openGrownUpZone, readStored, seedRescueCode, typeDigits, unlockWithPin } from './helpers';

/**
 * F-LEARN-001 §3.3, §3.4, §3.14, §3.15: the "Someone I look after" path. On
 * the Privacy step (step 3) the grown-up card collects the consent, an optional email and a PIN typed twice
 * (a mismatch starts over, calmly); the PIN then guards the grown-up pages from
 * the first tap, and no setup screen is shown. Forgot PIN is PR 6.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

/** `window.open` is how the web build opens a link; record the URL instead of leaving the page. */
async function captureOpenedLinks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('grown-up card: PIN typed twice, a mismatch starts over, the policy link and the box gate Continue', async ({ page }) => {
      await captureOpenedLinks(page);
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await page.getByRole('radio', { name: WHO_CHILD }).click();
      const next = page.getByRole('button', { name: 'Continue' });
      await next.click();

      // Step 2, worded for someone else.
      await expect(page.getByText('Step 2 of 3')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Their profile' })).toBeVisible();
      await expect(page.getByText('Their name', { exact: true })).toBeVisible();
      await expect(page.getByText('How do they like to learn?')).toBeVisible();
      await page.getByPlaceholder('Type a name').fill('수니');
      await next.click();

      // Step 3, Privacy: the box comes first in the caption.
      await expect(page.getByText('Step 3 of 3')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
      await expect(next).toBeDisabled();
      await expect(page.getByText('Tick the box to agree')).toBeVisible();
      await expect(page.getByText("Agreeing doesn't change the lessons.")).toBeAttached();
      // The under-13 hand-over belongs to the "Me" path only.
      await expect(page.getByRole('button', { name: "I'm under 13" })).toHaveCount(0);

      // The grown-up card: heading, the consent sentence, a policy link, and an optional email.
      await expect(page.getByText('For a grown-up')).toBeVisible();
      await expect(page.getByText('A parent, guardian or teacher sets up the account.', { exact: false })).toBeAttached();
      await expect(page.getByText(/^I'm a parent or guardian of this learner/)).toBeAttached();
      const link = page.getByRole('link', { name: 'Privacy Policy' });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.at(-1))).toMatch(/\/privacy$/);
      await page.getByRole('checkbox').click();
      await expect(page.getByText('Create the PIN')).toBeVisible();
      await expect(next).toBeDisabled();

      // The PIN pad inside the card: 64 dp keys, dots only, no digits echoed.
      const key = page.getByRole('button', { name: 'Digit 5', exact: true });
      await key.scrollIntoViewIfNeeded();
      const box = await key.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(64);
      expect(box!.height).toBeGreaterThanOrEqual(64);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Different the second time: both entries clear, a calm line, no profile.
      await typeDigits(page, '1234');
      await expect(page.getByText('Type it again')).toBeVisible();
      await typeDigits(page, '4321');
      await expect(page.getByText("Those didn't match. Let's start again.")).toBeVisible();
      await expect(page.getByText('Type it again')).toHaveCount(0);
      await expect(next).toBeDisabled();

      // Typed the same twice: set, Continue opens.
      await typeDigits(page, '1234');
      await typeDigits(page, '1234');
      await expect(page.getByText('PIN set')).toBeVisible();
      await expect(page.getByText("Those didn't match. Let's start again.")).toHaveCount(0);
      await expect(next).toBeEnabled();

      // "Change" starts the PIN over and Continue waits again.
      await page.getByRole('button', { name: 'Change' }).click();
      await expect(next).toBeDisabled();
      await typeDigits(page, '1234');
      await typeDigits(page, '1234');
      await expect(next).toBeEnabled();
      await next.click();
      await expect(page.getByText('Your first card is waiting.')).toBeVisible();
    });

    test('the PIN made in the form guards the grown-up zone from the first tap, with no setup screen', async ({ page }) => {
      await onboardChild(page, { name: 'Mina', avatar: 'Feast Tiger' });
      await page.goto('/');
      await expect(page.getByText('Hi, Mina!')).toBeVisible();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();

      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      await expect(page.getByText('Create a grown-up PIN')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);

      // A wrong PIN is turned away, calmly; the one from the form opens the dashboard.
      await typeDigits(page, '9999');
      await page.getByRole('button', { name: 'Unlock' }).click();
      await expect(page.getByText(/Not quite\./)).toBeVisible();
      await unlockWithPin(page, E2E_PIN);
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    });

    test('Forgot PIN with a stored Rescue Code sets a new PIN and keeps the learner and progress', async ({ page }) => {
      await onboardChild(page, { name: 'Mina', avatar: 'Feast Tiger' });
      await seedRescueCode(page, 'TIGER-MOON-RIVER-APPLE-482139');
      const profilesBefore = await readStored(page, 'profiles');
      const oldHash = await readStored<string>(page, 'account:parentPinHash');
      expect(oldHash).not.toBeNull();

      await openGrownUpZone(page, 'Mina');
      const forgot = page.getByRole('button', { name: 'Forgot PIN?' });
      await forgot.scrollIntoViewIfNeeded();
      const box = await forgot.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(64);
      await forgot.click();

      await expect(page.getByRole('heading', { name: 'Reset the PIN' })).toBeVisible();
      await expect(page.getByText('Your learners, cards and progress are kept.')).toBeVisible();
      await expect(page.getByText('Use a Rescue Code')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const code = page.getByTestId('pin-reset-code-input');
      const field = await code.boundingBox();
      expect(field!.x).toBeGreaterThanOrEqual(0);
      expect(field!.x + field!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

      // A well-formed but different code is turned away calmly; nothing changes.
      await code.fill('tiger moon river apple 000000');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText("That isn't the code saved on this device. Check it and try again.")).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Reset the PIN' })).toBeVisible();

      // The right code in any case, with spaces: the PIN-setup screen opens.
      await code.fill('tiger moon river apple 482 139');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toHaveCount(0);

      await typeDigits(page, '5678');
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Enter it once more')).toBeVisible();
      await typeDigits(page, '5678');
      await page.getByRole('button', { name: 'Next' }).click();
      // The destination the PIN was asked for opens (the grown-up dashboard).
      await expect(page.getByText('Enter it once more')).toHaveCount(0);
      await expect.poll(() => readStored<string>(page, 'account:parentPinHash')).not.toBe(oldHash);

      // The learner is untouched, the old PIN no longer works and the new one does.
      expect(await readStored(page, 'profiles')).toEqual(profilesBefore);
      await openGrownUpZone(page, 'Mina');
      await typeDigits(page, E2E_PIN);
      await page.getByRole('button', { name: 'Unlock' }).click();
      await expect(page.getByText(/Not quite\./)).toBeVisible();
      await unlockWithPin(page, '5678');
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    });
  });
}
