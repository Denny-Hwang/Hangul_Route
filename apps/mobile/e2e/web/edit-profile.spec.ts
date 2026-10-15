import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStored, typeDigits, unlockWithPin, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * F-LEARN-001 §3.11: Edit profile. Name, reading level and cub change from an
 * "Edit" button on each switcher card; the screen opens behind the PIN only
 * when the gate is required; a change of "Who is learning?" asks the same
 * consent the create form would (and a PIN for a child on a device with none).
 * No text on the screen names an age, and it never scrolls sideways.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

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
      await expect(page.getByRole('radio', { name: /^Someone I look after/ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('checkbox')).toHaveCount(0);

      await expect(page.getByText("This doesn't change the lessons.")).toBeVisible();
      await page.getByRole('radio', { name: /^Me\./ }).click();
      const box = page.getByRole('checkbox', { name: "I'm 13 or older and I agree to the Privacy Policy." });
      await expect(box).toBeVisible();
      // The consent sits in its own Privacy block (F-LEARN-001 §3.15.6), with the under-13 hand-back.
      await expect(page.getByText('Privacy', { exact: true })).toBeVisible();
      await expect(page.getByText("Agreeing doesn't change the lessons.")).toBeAttached();
      await expect(page.getByRole('button', { name: "I'm under 13" })).toBeAttached();
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

    test('family device: "I\'m under 13" keeps the profile with a grown-up and "Me" stays closed (§3.15.6)', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await openProfile(page, 'Mina');
      await page.getByRole('button', { name: 'Edit Mina (PIN required)', exact: true }).click();
      await unlockWithPin(page);
      await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();

      const me = page.getByRole('radio', { name: /^Me\./ });
      await me.click();
      await expect(page.getByRole('checkbox', { name: "I'm 13 or older and I agree to the Privacy Policy." })).toBeVisible();
      await page.getByRole('button', { name: "I'm under 13" }).click();
      await expect(page.getByRole('radio', { name: /^Someone I look after/ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByText('This profile stays with a grown-up.')).toBeVisible();
      await expect(page.getByText('Change something to save')).toBeVisible();

      // Latched while the screen is open: "Me" cannot bring the "13 or older" box back.
      await expect(me).toBeDisabled();
      await me.click({ force: true });
      await expect(me).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByText('This profile stays with a grown-up.')).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
    });

    test('self-only device: changing to a child asks for the grown-up consent and a new PIN', async ({ page }) => {
      await onboardSelf(page, { name: 'Leo' });
      await openProfile(page, 'Leo');
      await page.getByRole('button', { name: 'Edit Leo', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();

      await page.getByRole('radio', { name: /^Someone I look after/ }).click();
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

test.describe('edge cases (375x667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('a profile stored before "Who is learning?" existed reads as a child and can become "Me" (§3.10)', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    // The shape a profile had before learnerType: drop the field and reload.
    const profiles = (await readStored<StoredProfile[]>(page, 'profiles'))!;
    await seedStored(
      page,
      'profiles',
      profiles.map(({ learnerType: _drop, ...rest }) => rest),
    );
    expect((await storedProfile(page)).learnerType).toBeUndefined();

    await openProfile(page, 'Mina');
    await page.getByRole('button', { name: 'Edit Mina (PIN required)', exact: true }).click();
    await unlockWithPin(page);
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Someone I look after/ })).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('radio', { name: /^Me\./ }).click();
    await page.getByRole('checkbox', { name: "I'm 13 or older and I agree to the Privacy Policy." }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await expect.poll(async () => (await storedProfile(page)).learnerType).toBe('self');
  });

  test('a learner in a class is told the teacher\'s list updates with the next connection (§3.11)', async ({ page }) => {
    await onboardSelf(page, { name: 'Rio' });
    const { id } = await storedProfile(page);
    await openProfile(page, 'Rio');
    await page.getByRole('button', { name: 'Edit Rio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
    await expect(page.getByText("Your teacher's list updates the next time you're online.")).toHaveCount(0);

    await seedStored(page, `memberships:${id}`, [
      { spaceId: 'space-1', kind: 'class', name: 'Saturday class', role: 'learner', joinedAt: '2026-10-01T00:00:00.000Z' },
    ]);
    await openProfile(page, 'Rio');
    await page.getByRole('button', { name: 'Edit Rio', exact: true }).click();
    await expect(page.getByText("Your teacher's list updates the next time you're online.")).toBeVisible();
    await expect(page.getByText(/join again/i)).toHaveCount(0);
  });

  test('Forgot PIN from Edit comes back to Edit once the new PIN is set', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await seedStored(page, 'account:pinResetRequestedAt', new Date(Date.now() - DAY_MS - 60_000).toISOString());
    await openProfile(page, 'Mina');
    await page.getByRole('button', { name: 'Edit Mina (PIN required)', exact: true }).click();
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();
    await page.getByRole('button', { name: 'Set a new PIN' }).click();
    await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
    for (const round of [0, 1]) {
      await typeDigits(page, '2468');
      await page.getByRole('button', { name: 'Next' }).click();
      if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Mina');
  });

  test('a stored name longer than today\'s rule is kept, and another row still saves', async ({ page }) => {
    await onboardSelf(page, { name: 'Rio' });
    const profiles = (await readStored<StoredProfile[]>(page, 'profiles'))!;
    await seedStored(
      page,
      'profiles',
      profiles.map((p) => ({ ...p, displayName: 'Alexandria Mae' })),
    );
    await openProfile(page, 'Alexandria Mae');
    await page.getByRole('button', { name: 'Edit Alexandria Mae', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Alexandria Mae');
    await expect(page.getByText(/^Names can be up to/)).toHaveCount(0);
    await page.getByRole('radio', { name: 'Home Tiger' }).click();
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await expect
      .poll(async () => {
        const p = await storedProfile(page);
        return [p.displayName, p.avatar];
      })
      .toEqual(['Alexandria Mae', 'hoya-blue']);
  });

  test('a double tap on Save saves once and goes back one screen', async ({ page }) => {
    await onboardSelf(page, { name: 'Leo' });
    await openProfile(page, 'Leo');
    await page.getByRole('button', { name: 'Edit Leo', exact: true }).click();
    await page.getByRole('radio', { name: /^Someone I look after/ }).click();
    await page.getByRole('checkbox').click();
    await typeDigits(page, '2468');
    await typeDigits(page, '2468');
    await expect(page.getByText('PIN set')).toBeVisible();
    // Two presses in the same task, before React can re-render the disabled button.
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await save.evaluate((el) => {
      (el as HTMLElement).click();
      (el as HTMLElement).click();
    });
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
  });
});
