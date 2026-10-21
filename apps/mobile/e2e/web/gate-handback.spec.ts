import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { headerBack, onboardChild, openForGrownUps, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';

const en = getMessages('en');

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-2 (OA-D5b, CS-15): every hand-back closes the grown-up session.
 * Leaving the Grown-up area for a learner screen, or switching learners with a Profile tile, means the next way
 * into the Grown-up area asks the PIN again (before OA-2 the 15-minute session let it straight in).
 */

test('open the Grown-up area from Profile, go Back, and re-opening asks the PIN', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  await expect(page.getByRole('heading', { name: 'Grown-up area' })).toBeVisible();

  await headerBack(page).click();
  await openForGrownUps(page);
  await page.getByRole('button', { name: 'Grown-up area (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
});

test('open it, switch learners with a Profile tile, and re-opening asks the PIN', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  await seedStored(page, 'profiles', [...profiles, { ...mina, id: 'profile:joon0001', displayName: 'Joon', createdAt: new Date().toISOString() }]);

  // The session opens inside the Grown-up area; the grown-up hands over from Profile with a tile.
  await openGrownUpZone(page, 'Mina');
  await unlockWithPin(page);
  await expect(page.getByRole('heading', { name: 'Grown-up area' })).toBeVisible();
  await headerBack(page).click();
  await page.getByRole('button', { name: /Joon/ }).first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Joon/ }).first().click();
  await expect.poll(() => readStored(page, 'profiles:active')).toBe('profile:joon0001');
  await openForGrownUps(page);
  await page.getByRole('button', { name: 'Grown-up area (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
});

/**
 * [OA] CS-1: an open grown-up session is honoured only inside the Grown-up area stack. A PIN entered for an action
 * on a learner screen serves that action only, and never lets the Grown-up area open without the PIN.
 */
test('CS-1: a PIN for the Licenses link on Profile does not open the Grown-up area', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await openForGrownUps(page);
  await page.getByTestId('profile-licenses-link').click();
  await unlockWithPin(page);
  await expect(page.getByTestId('profile-licenses-link')).toBeVisible();

  await page.getByRole('button', { name: 'Grown-up area (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
});

test('CS-1: Add a learner, the PIN, then back out: the Grown-up area asks the PIN', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await openGrownUpZone(page, 'Mina');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await openForGrownUps(page);
  await page.getByRole('button', { name: en.caregiver.audience.gated(en.learner.profile.addProfileName, true) }).click();
  await unlockWithPin(page);
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();

  await openForGrownUps(page);
  await page.getByRole('button', { name: 'Grown-up area (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
});
