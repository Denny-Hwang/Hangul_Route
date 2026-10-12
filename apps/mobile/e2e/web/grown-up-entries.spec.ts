import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-APP-001 A-7 (sections 3.6, 3.8, 3.12, 3.16; wireframes onboarding/welcome-personas.md and
 * parent/grown-up-home-card.md; mock design/screens/app-shell/learner-entry.md): the learner
 * app's entries to the grown-up area. They live behind `flags.grownUpHomeEnabled` (off), so a
 * default build checks that Welcome, Profile and the dashboard are today's screens, and a build
 * made with the flag on checks the entries:
 *
 *   EXPO_PUBLIC_GROWN_UP_HOME=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_GROWN_UP_HOME=1 pnpm --filter @hangul-route/mobile exec playwright test grown-up-entries
 *
 * The sign-in page the entries open is a stand-in served by the test (no Clerk session here), and
 * the service worker is blocked so the stand-in is what the navigation gets. The Join prefill
 * needs no flag (section 3.6) and runs in both builds.
 */
test.use({ serviceWorkers: 'block' });

const ON = process.env.E2E_GROWN_UP_HOME === '1';
const UNLOCK = 'hr:grownup:unlock';
const JOIN_HANDOFF = 'hr:shell:joinCode';
const PROFILE_ROW = /^Grown-up home, Your family, classes and billing/;

/** Serves a plain page at `/signin`, the grown-up sign-in router the entries open. */
async function standInSignIn(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/signin',
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sign in</title><p>Sign-in stand-in</p>' }),
  );
}

/** The console's shell store (`hr-shell` / `kv`): the last persona a grown-up home remembered. */
async function seedLastPersona(page: Page, persona: 'parent' | 'teacher'): Promise<void> {
  await page.evaluate(
    (p) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('hr-shell');
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains('kv')) open.result.createObjectStore('kv');
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ v: 1, persona: p }, 'lastPersona');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    persona,
  );
}

async function openProfile(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  // A family device's zone button, or a self-only device's (F-LEARN-001 L7).
  await expect(page.getByRole('button', { name: /^(Grown-up zone|Account & backup)/ })).toBeVisible();
}

function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test.describe('flag off (the default build)', () => {
  test.skip(ON, 'runs on the default build');

  test('Welcome, Profile and the dashboard show no grown-up entry', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await expect(page.getByText('Here to support a learner?')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toHaveCount(0);

    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    await expect(page.getByRole('button', { name: PROFILE_ROW })).toHaveCount(0);
    await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
    await unlockWithPin(page);
    await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
    await expect(page.getByTestId('dashboard-grown-up-home')).toHaveCount(0);
  });
});

test.describe('flag on (EXPO_PUBLIC_GROWN_UP_HOME=true)', () => {
  test.skip(!ON, 'needs a build with EXPO_PUBLIC_GROWN_UP_HOME=true and E2E_GROWN_UP_HOME=1');

  test('Panel A: the row sits under the restore link and Let\'s start stays in the first view at 320 x 568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const start = page.getByRole('button', { name: "Let's start" });
    await expect(start).toBeVisible();
    await expect(page.getByText('Here to support a learner?')).toBeVisible();
    const parent = page.getByRole('button', { name: 'Parent or caregiver' });
    const teacher = page.getByRole('button', { name: 'Teacher', exact: true });
    await expect(parent).toBeEnabled();
    await expect(teacher).toBeEnabled();

    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect((startBox?.y ?? 0) + (startBox?.height ?? 0)).toBeLessThanOrEqual(568);
    const restoreBox = await page.getByRole('button', { name: 'I already have progress' }).boundingBox();
    const parentBox = await parent.boundingBox();
    expect(parentBox?.y ?? 0).toBeGreaterThan((restoreBox?.y ?? 0) + (restoreBox?.height ?? 0));
    for (const box of [parentBox, await teacher.boundingBox()]) expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'a7-welcome-320');

    await page.setViewportSize({ width: 375, height: 812 });
    // Side by side when both fit (D10).
    const [p, t] = [await parent.boundingBox(), await teacher.boundingBox()];
    expect(Math.abs((p?.y ?? 0) - (t?.y ?? 1))).toBeLessThan(2);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, 'a7-welcome-375');
  });

  test('Teacher and Parent or caregiver open sign-in with the persona, in the same tab', async ({ page }) => {
    await standInSignIn(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Teacher', exact: true }).click();
    await expect(page).toHaveURL(/\/signin\?persona=teacher$/);
    await expect(page.getByText('Sign-in stand-in')).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Parent or caregiver' }).click();
    await expect(page).toHaveURL(/\/signin\?persona=parent$/);
  });

  test('Let\'s start still starts the learner in one tap', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await expect(page.getByRole('radio', { name: /^My child or a student/ })).toBeVisible();
  });

  test('Panel B: Continue as teacher opens the plain router; Someone else shows both buttons', async ({ page }) => {
    await standInSignIn(page);
    await page.goto('/');
    await seedLastPersona(page, 'teacher');
    await page.goto('/');
    const cont = page.getByRole('button', { name: 'Continue as teacher' });
    await expect(cont).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toHaveCount(0);
    await shot(page, 'a7-welcome-continue-375');

    await page.getByRole('button', { name: 'Someone else' }).click();
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Teacher', exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Continue as teacher' }).click();
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('Panel C: offline, the buttons keep their labels, disabled, with "Needs the internet"; online again re-enables them', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Teacher', exact: true })).toBeDisabled();
    await expect(page.getByTestId('welcome-grown-ups-offline')).toHaveText('Needs the internet');
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toHaveAccessibleDescription('Needs the internet');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeEnabled();
    await shot(page, 'a7-welcome-offline-375');

    await context.setOffline(false);
    await expect(page.getByRole('button', { name: 'Parent or caregiver' })).toBeEnabled();
    await expect(page.getByTestId('welcome-grown-ups-offline')).toHaveCount(0);
  });

  test('Profile: Grown-up home is the row above the zone button; the PIN opens the grown-up area with a PIN unlock', async ({ page }) => {
    await standInSignIn(page);
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    const row = page.getByRole('button', { name: 'Grown-up home, Your family, classes and billing (PIN required)' });
    await expect(row).toBeVisible();
    const rowBox = await row.boundingBox();
    const zoneBox = await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).boundingBox();
    expect(rowBox?.y ?? 0).toBeLessThan(zoneBox?.y ?? 0);
    expect(rowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await noSidewaysScroll(page)).toBe(true);
    await row.scrollIntoViewIfNeeded();
    await shot(page, 'a7-profile-row-375');

    await row.click();
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/signin$/);
    const unlock = await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK);
    expect(JSON.parse(unlock ?? '{}')).toMatchObject({ v: 1, src: 'pin' });
  });

  test('a self-only device says "Account home" and opens without a PIN', async ({ page }) => {
    await standInSignIn(page);
    await onboardSelf(page, { name: 'Sam' });
    await openProfile(page, 'Sam');
    const row = page.getByRole('button', { name: 'Account home, Your family, classes and billing' });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/signin$/);
    // Marker `none`: no unlock is needed and none is written.
    expect(await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK)).toBeNull();
  });

  test('dashboard: the card on top, and a PIN entered to open the dashboard is not asked again', async ({ page }) => {
    await standInSignIn(page);
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
    await unlockWithPin(page);
    const card = page.getByTestId('dashboard-grown-up-home');
    await expect(card).toBeVisible();
    await expect(card.getByText('Grown-up home')).toBeVisible();
    await expect(card.getByText('Your family, classes and billing.')).toBeVisible();
    await shot(page, 'a7-dashboard-card-375');

    await card.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/signin$/);
    const unlock = await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK);
    expect(JSON.parse(unlock ?? '{}')).toMatchObject({ v: 1, src: 'pin' });
  });

  test('offline: the Profile row and the dashboard Open are disabled with "Needs the internet"', async ({ page, context }) => {
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    await context.setOffline(true);
    const row = page.getByRole('button', { name: 'Grown-up home, Needs the internet (PIN required)' });
    await expect(row).toBeDisabled();
    await expect(page.getByTestId('profile-grown-up-home-line')).toHaveText('Needs the internet');
    await row.scrollIntoViewIfNeeded();
    await shot(page, 'a7-profile-row-offline-375');

    await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
    await unlockWithPin(page);
    const open = page.getByTestId('dashboard-grown-up-home-open');
    await expect(open).toBeDisabled();
    await expect(open).toHaveAccessibleDescription('Needs the internet');
    await expect(page.getByTestId('dashboard-grown-up-home-offline')).toHaveText('Needs the internet');
    await shot(page, 'a7-dashboard-card-offline-375');
    // The local dashboard below still works offline.
    await expect(page.getByText('Read-only — learners on this device.')).toBeVisible();
    await expect(page.getByText('Sessions', { exact: true }).last()).toBeVisible();
    await context.setOffline(false);
    await expect(open).toBeEnabled();
  });
});

test('Join prefill: a family code handed over in this tab fills the Join screen once', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [JOIN_HANDOFF, JSON.stringify({ v: 1, code: 'ABCD23', at: Date.now() })] as const);
  await openProfile(page, 'Mina');
  await page.getByRole('button', { name: 'Join a class' }).click();
  await expect(page.getByLabel('Class code')).toHaveValue('ABCD23');
  expect(await page.evaluate((k) => sessionStorage.getItem(k), JOIN_HANDOFF)).toBeNull();

  await page.getByRole('button', { name: 'Go back' }).last().click();
  await page.getByRole('button', { name: 'Join a class' }).click();
  await expect(page.getByLabel('Class code')).toHaveValue('');
});

test('Join prefill: a code older than 30 minutes is dropped', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await page.evaluate(
    ([k, v]) => sessionStorage.setItem(k, v),
    [JOIN_HANDOFF, JSON.stringify({ v: 1, code: 'ABCD23', at: Date.now() - 31 * 60_000 })] as const,
  );
  await openProfile(page, 'Mina');
  await page.getByRole('button', { name: 'Join a class' }).click();
  await expect(page.getByLabel('Class code')).toHaveValue('');
});
