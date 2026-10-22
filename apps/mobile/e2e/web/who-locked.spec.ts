import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [OA] Locked learner profiles (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-5, section 20; CS-3, CS-19): a locked tile
 * asks the grown-up PIN and opens that learner only; a locked active profile shows the chooser at every launch and
 * after 5 minutes in the background; the Edit profile switch locks a learner. The chooser is on by default since row
 * OA-10, so it runs on the release build in every pull request; a bundle built with the kill switch off
 * (`EXPO_PUBLIC_WHO_CHOOSER=false`) skips it with `E2E_WHO=0`:
 *
 *   pnpm --filter @hangul-route/mobile build:web
 *   pnpm --filter @hangul-route/mobile exec playwright test who-locked
 */
test.skip(process.env.E2E_WHO === '0', 'a build with the kill switch EXPO_PUBLIC_WHO_CHOOSER=false (E2E_WHO=0)');
test.use({ viewport: { width: 360, height: 740 } });

const en = getMessages('en');
const w = en.learner.who;
const title = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const tile = (page: Page, name: string) => page.getByRole('button', { name: en.a11y.who.tile(name), exact: true });
const lockedTile = (page: Page, name: string) => page.getByRole('button', { name: en.a11y.who.lockedTile(name), exact: true });

/** Mina through onboarding (PIN set); `extra` learners added to the stored list. */
async function device(page: Page, extra: { id: string; name: string }[] = []): Promise<string> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  if (extra.length > 0) {
    await seedStored(page, 'profiles', [...profiles, ...extra.map((p) => ({ ...mina, id: p.id, displayName: p.name, createdAt: new Date().toISOString() }))]);
  }
  return mina.id as string;
}

async function hideAndShow(page: Page, awayMs: number): Promise<void> {
  const set = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await set('hidden');
  await page.clock.fastForward(awayMs);
  await set('visible');
}

test.describe('Locked learner profiles', () => {
  test('CS-19: a locked active profile shows the chooser at every launch and after 5 minutes away; the PIN opens it, no grown-up session', async ({ page }) => {
    await page.clock.install();
    const mina = await device(page);
    // A single learner is not shared; its lock alone brings the chooser up at launch.
    await seedStored(page, 'profiles:locks', { v: 1, ids: [mina] });
    await expect(title(page)).toBeVisible();
    await expect(lockedTile(page, 'Mina')).toBeVisible();
    await expect(page.getByText(w.lockedCaption, { exact: true })).toBeVisible();
    await shot(page, 'who-locked-360');
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'who-locked-320');
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'who-locked-1280');
    await page.setViewportSize({ width: 360, height: 740 });

    await lockedTile(page, 'Mina').click();
    // The PIN screen, titled with the learner's name (the chooser under it is hidden).
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await expect(page.getByText('Mina', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await shot(page, 'who-locked-pin-360');
    await unlockWithPin(page);
    await expect(page.getByText('Hi, Mina!')).toBeVisible();

    // Under 5 minutes away: still Home. From 5 minutes: the chooser again.
    await hideAndShow(page, 4 * 60_000);
    await expect(title(page)).toHaveCount(0);
    await hideAndShow(page, 5 * 60_000);
    await expect(title(page)).toBeVisible();
    await expect(lockedTile(page, 'Mina')).toBeVisible();

    // A new launch asks again.
    await page.goto('/');
    await expect(title(page)).toBeVisible();
    await lockedTile(page, 'Mina').click();
    await unlockWithPin(page);
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    // The unlock opened no grown-up session (CS-3): the Grown-up area still asks the PIN.
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByTestId('profile-group-grown-ups-toggle').click();
    await page.getByTestId('profile-grown-up-area').click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  });

  test('a locked tile on a shared device: Cancel returns to the chooser; the PIN opens that learner\'s Home', async ({ page }) => {
    await device(page, [{ id: 'profile:sora0001', name: 'Sora' }]);
    await seedStored(page, 'profiles:locks', { v: 1, ids: ['profile:sora0001'] });
    await expect(title(page)).toBeVisible();
    await expect(tile(page, 'Mina')).toBeVisible();
    await lockedTile(page, 'Sora').click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(title(page)).toBeVisible();
    await lockedTile(page, 'Sora').click();
    await unlockWithPin(page);
    await expect(page.getByText('Hi, Sora!')).toBeVisible();
    await expect.poll(() => readStored(page, 'profiles:active')).toBe('profile:sora0001');
  });

  test('Edit profile: the lock switch locks a learner at once after the PIN; the Profile tile shows the glyph', async ({ page }) => {
    await device(page, [{ id: 'profile:joon0001', name: 'Joon' }]);
    await expect(title(page)).toBeVisible();
    await tile(page, 'Mina').click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await page.getByRole('button', { name: /^Edit Joon/ }).click();
    await unlockWithPin(page);
    const lock = page.getByRole('switch', { name: en.caregiver.people.lock });
    await expect(lock).toBeVisible();
    await expect(page.getByText(en.caregiver.people.lockHint, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 640 });
    await shot(page, 'edit-profile-lock-320');
    await page.setViewportSize({ width: 360, height: 740 });
    // The PIN was entered just now (within 2 minutes): the switch acts at once.
    await lock.click();
    await expect(lock).toBeChecked();
    await expect.poll(() => readStored(page, 'profiles:locks')).toEqual({ v: 1, ids: ['profile:joon0001'] });
    await page.goBack();
    await expect(page.getByRole('button', { name: en.a11y.who.lockedTile('Joon'), exact: true })).toBeVisible();
    await shot(page, 'profile-locked-tile-360');
  });
});
