import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { E2E_PIN, forgetPin, onboardChild, onboardSelf, readStored, typeDigits } from './helpers';
import { shot } from './shots';

/**
 * F-APP-001 A-6 (sections 3.4, 3.9, 3.11): the learner side of the grown-up area on the app host.
 * The device gate marker the console's lock reads, the bounce of a grown-up URL the host has no
 * page for, the lock's PIN path (`/?gate=grown-up&next=`) through the PIN screen for `GrownUpArea`,
 * and the unlock and console-session clearing of a learner boot. Since A-3 the merged build serves
 * the console's `/teach` and `/parent` pages; the grown-up page the PIN path returns to is still a
 * stand-in served by the test, so the hand-off is checked without a Clerk session, and the service
 * worker is blocked so that stand-in is what the navigation gets.
 */
test.use({ serviceWorkers: 'block' });

const UNLOCK = 'hr:grownup:unlock';
const CONSOLE_SESSION = 'hr:console:session';

/** Serves a plain page at `/parent`, the grown-up page a PIN returns to. */
async function standInGrownUpPage(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/parent',
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Grown-up page</title><p>Grown-up page stand-in</p>' }),
  );
}

function sessionValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => sessionStorage.getItem(k), key);
}

test('the device gate marker follows the device: none without a profile, pin with the epoch of the PIN', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'none' });

  await onboardChild(page, { name: 'Mina' });
  const pinSetAt = await readStored<number>(page, 'account:pinSetAt');
  expect(typeof pinSetAt).toBe('number');
  expect(Math.abs((pinSetAt ?? 0) - Date.now())).toBeLessThan(120_000);
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'pin', pinEpoch: pinSetAt });
});

test('a self-only device without a PIN says none, so a grown-up page opens there without a lock', async ({ page }) => {
  await onboardSelf(page, { name: 'Sam' });
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'none' });
});

test('a family device whose PIN is gone says nopin', async ({ page }) => {
  await onboardChild(page, { name: 'Mina' });
  await forgetPin(page);
  await expect.poll(() => readStored(page, 'device:gate')).toEqual({ v: 1, gate: 'nopin' });
});

test('a grown-up URL the host has no page for bounces to its persona entry', async ({ page }) => {
  // `/teach` is a console page of the merged build (A-3): the bounce lands there, not in the learner app,
  // and the /teach router (A-4b) sends a signed-out visitor on to /signin.
  await page.goto('/teach/does-not-exist?id=sp_1');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Grown-ups sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: "Let's start" })).toHaveCount(0);

  // `/signin` is a console page from A-4b: an unknown `/account` path (no billing page until A-5c) lands on it.
  await page.goto('/account/billing?checkout=success');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Grown-ups sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: "Let's start" })).toHaveCount(0);
});

test('a learner boot removes the grown-up unlock and the console session of its tab', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ([u, c]) => {
      sessionStorage.setItem(u, '{"v":1,"at":1,"seen":1,"src":"signin"}');
      sessionStorage.setItem(c, '{"token":"t"}');
      sessionStorage.setItem('hr:browse:pass', '{}');
    },
    [UNLOCK, CONSOLE_SESSION] as const,
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
  expect(await sessionValue(page, UNLOCK)).toBeNull();
  expect(await sessionValue(page, CONSOLE_SESSION)).toBeNull();
  expect(await sessionValue(page, 'hr:browse:pass')).toBe('{}');
});

test.describe('the lock PIN path', () => {
  test('verify only, then back to the grown-up page with a PIN unlock carrying the marker epoch', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await standInGrownUpPage(page);
    const pinSetAt = await readStored<number>(page, 'account:pinSetAt');

    await page.goto('/?gate=grown-up&next=%2Fparent');
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    // The intent leaves the address at once, so a reload or a shared link never repeats it.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toHaveCount(0);
    await shot(page, 'a6-pin-grown-up-area-pixel5');

    await typeDigits(page, E2E_PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Grown-up page stand-in')).toBeVisible();
    await expect(page).toHaveURL(/\/parent$/);
    const unlock = JSON.parse((await sessionValue(page, UNLOCK)) ?? 'null') as Record<string, unknown> | null;
    expect(unlock).toMatchObject({ v: 1, src: 'pin', pinEpoch: pinSetAt });
    expect(Math.abs(Number(unlock?.seen) - Date.now())).toBeLessThan(60_000);
  });

  test('a wrong PIN stays on the PIN screen and writes nothing', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await typeDigits(page, '9999');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText(/^Not quite\./)).toBeVisible();
    expect(await sessionValue(page, UNLOCK)).toBeNull();
  });

  test('the intent clears the tab like any learner boot; Cancel lands on the learner start screen', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await page.evaluate((u) => sessionStorage.setItem(u, '{"v":1,"at":1,"seen":1,"src":"signin"}'), UNLOCK);
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    expect(await sessionValue(page, UNLOCK)).toBeNull();
  });

  test('a next that is not a grown-up page is no intent: the learner app, nothing to unlock', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await page.goto('/?gate=grown-up&next=https%3A%2F%2Fevil.example%2F');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
  });
});

for (const vp of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`no PIN stored, ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('the PIN screen never offers to make a PIN; Continue opens the page without an unlock', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await forgetPin(page);
      await standInGrownUpPage(page);
      await page.goto('/?gate=grown-up&next=%2Fparent');
      await expect(page.getByText('This device has no grown-up PIN. Sign in on the grown-up page instead.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Digit 1', exact: true })).toHaveCount(0);
      await expect(page.getByText('Create a grown-up PIN')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Forgot PIN?' })).toHaveCount(0);
      // The layout bar (A-6 review): no horizontal scroll, and both buttons whole on screen.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeInViewport({ ratio: 1 });
      await shot(page, `a6-no-pin-${vp.width}`);

      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Grown-up page stand-in')).toBeVisible();
      expect(await sessionValue(page, UNLOCK)).toBeNull();
      expect(await readStored(page, 'account:parentPinHash')).toBeNull();
    });
  });
}
