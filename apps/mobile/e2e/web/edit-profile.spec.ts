import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, typeDigits, unlockWithPin, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * F-LEARN-001 §3.11: Edit profile. Name, reading level and cub change from an
 * "Edit" button on each switcher card; the screen opens behind the PIN only
 * when the gate is required; a change of "Who is learning?" asks the same
 * consent the create form would (and a PIN for a child on a device with none).
 * No text on the screen names an age, and it never scrolls sideways.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

interface StoredProfile {
  id: string;
  displayName: string;
  ageGroup: string;
  avatar: string;
  learnerType?: string;
}

const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

const noSideScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

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

async function storedProfile(page: Page): Promise<StoredProfile> {
  const profiles = await readStored<StoredProfile[]>(page, 'profiles');
  return profiles![0]!;
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('self-only device: Edit opens directly; name, level and cub are saved and shown on the card', async ({ page }) => {
      await onboardSelf(page, { name: 'Rio' });
      await openProfile(page, 'Rio');
      await shot(page, `edit-profile-switcher-${vp.width}`);

      // No PIN on a self-only device: the button carries no "(PIN required)" and opens the screen at once.
      await page.getByRole('button', { name: 'Edit Rio', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);

      // The four rows start from the stored profile.
      const name = page.getByRole('textbox', { name: 'Name' });
      await expect(name).toHaveValue('Rio');
      await expect(page.getByRole('radio', { name: /^Some reading\./ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio', { name: 'Book Tiger' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio', { name: /^Me\./ })).toHaveAttribute('aria-checked', 'true');
      const save = page.getByRole('button', { name: 'Save' });
      await expect(save).toBeDisabled();
      await expect(page.getByText('Change something to save')).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      const text = await screenText(page);
      expect(text).not.toMatch(/\bAges?\b|How old|for kids/i);
      // Only the "Who is learning?" option mentions a grown-up; no grown-up card while nothing asks for one.
      await expect(page.getByText('For a grown-up')).toHaveCount(0);
      await expect(page.getByText('Create a grown-up PIN')).toHaveCount(0);
      await shot(page, `edit-profile-self-${vp.width}`);

      // An empty name waits calmly; a new name, level and cub save.
      await name.fill('');
      await expect(page.getByText('Type a name', { exact: true })).toBeVisible();
      await expect(save).toBeDisabled();
      await name.fill('Rio Park');
      await page.getByRole('radio', { name: /^Reads easily\./ }).click();
      await page.getByRole('radio', { name: 'Home Tiger' }).click();
      await expect(save).toBeEnabled();
      await save.click();

      // Back on the switcher with the new values; stored on the device.
      await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
      const card = page.getByRole('button', { name: 'Switch to Rio Park' });
      await expect(card.getByText('Reads easily')).toBeVisible();
      await waitForSaved(page, ['profiles']);
      await expect
        .poll(async () => {
          const p = await storedProfile(page);
          return [p.displayName, p.ageGroup, p.avatar, p.learnerType];
        })
        .toEqual(['Rio Park', '10-11', 'hoya-blue', 'self']);
    });

    test('family device: Edit opens behind the PIN; changing to "Me" needs the 13-or-older box', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await openProfile(page, 'Mina');

      await page.getByRole('button', { name: 'Edit Mina (PIN required)', exact: true }).click();
      await unlockWithPin(page);
      await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
      await expect(page.getByRole('radio', { name: /^My child or a student/ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('checkbox')).toHaveCount(0);

      await page.getByRole('radio', { name: /^Me\./ }).click();
      const box = page.getByRole('checkbox', { name: "I'm 13 or older and I agree to the Privacy Policy." });
      await expect(box).toBeVisible();
      await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeAttached();
      const save = page.getByRole('button', { name: 'Save' });
      await expect(save).toBeDisabled();
      await expect(page.getByText('Tick the box to agree')).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `edit-profile-to-self-${vp.width}`);

      await box.click();
      await expect(save).toBeEnabled();
      await save.click();
      await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
      await waitForSaved(page, ['account:selfConsentAcceptedAt']);
      await expect.poll(async () => (await storedProfile(page)).learnerType).toBe('self');
      // The device keeps its PIN, so the grown-up actions stay gated.
      expect(await readStored(page, 'account:parentPinHash')).not.toBeNull();
    });

    test('self-only device: changing to a child asks for the grown-up consent and a new PIN', async ({ page }) => {
      await onboardSelf(page, { name: 'Leo' });
      await openProfile(page, 'Leo');
      await page.getByRole('button', { name: 'Edit Leo', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();

      await page.getByRole('radio', { name: /^My child or a student/ }).click();
      await expect(page.getByText('For a grown-up')).toBeVisible();
      await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
      const save = page.getByRole('button', { name: 'Save' });
      await expect(page.getByText('Tick the box to agree')).toBeVisible();
      await page.getByRole('checkbox').click();
      await expect(page.getByText('Create the PIN')).toBeVisible();
      await expect(save).toBeDisabled();

      const key = page.getByRole('button', { name: 'Digit 5', exact: true });
      await key.scrollIntoViewIfNeeded();
      const keyBox = await key.boundingBox();
      expect(keyBox!.width).toBeGreaterThanOrEqual(64);
      expect(keyBox!.height).toBeGreaterThanOrEqual(64);
      await typeDigits(page, '2468');
      await typeDigits(page, '2468');
      await expect(page.getByText('PIN set')).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `edit-profile-to-child-${vp.width}`);
      await expect(save).toBeEnabled();
      await save.click();

      // Now a family device with a PIN: the Edit button and the zone say so.
      await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit Leo (PIN required)', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Grown-up zone (PIN required)' })).toBeVisible();
      await waitForSaved(page, ['account:parentPinHash', 'account:guardianConsentAcceptedAt']);
      await expect.poll(async () => (await storedProfile(page)).learnerType).toBe('child');
    });
  });
}
