import type { BrowserContext, Page, Route } from '@playwright/test';
import { CONSOLE_SESSION_KEY, FAMILY_LIFETIME_LEARNERS, SHELL_DB, SHELL_KEYS, SHELL_STORE, UNLOCK_SESSION_KEY, type BillingSummary } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, unlockWithPin } from './helpers';

/**
 * F-BILL-002 B-11 (section 11, `plan-status.spec.ts`): the learner Plan screen and its hand-off to the real billing
 * page of F-APP-001's merged app-host build (`build:web` copies the console into dist under the grown-up prefixes).
 * Unlike plan-screen-same-tab.spec.ts (B-9b), nothing here is a stand-in: `/account/billing` is the console page
 * itself, the API is mocked by `page.route` and the grown-up is signed in through the console session of this tab
 * (the merged build has no Clerk key in e2e, so the console reads that session). Stripe is never reached.
 *
 * - Always (the release build): Profile, then Plan details, opens without a PIN and shows no price; with the
 *   learner worker active, `/account/billing?checkout=success` is the billing page, not the learner shell.
 * - With F-APP-001's grown-up home flag on: Open billing, then the PIN, opens `/account/billing` in the same tab and
 *   the console shows it without the "Grown-ups only" lock; a PIN older than 2 minutes asks again on the grown-up
 *   area's PIN screen first. Run on a build made with the flag on and an API base (any host: the mock matches every
 *   cross-origin `/api/` call):
 *
 *   EXPO_PUBLIC_GROWN_UP_HOME=true EXPO_PUBLIC_API_BASE_URL=https://api.billing-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   E2E_GROWN_UP_HOME=1 pnpm --filter @hangul-route/mobile exec playwright test plan-status
 */
const ON = process.env.E2E_GROWN_UP_HOME === '1';
const PRICE = /\$\s?\d|\d\s?\/\s?year|per year/i;
const LOCK_TITLE = 'Grown-ups only';
const LEARNER_SHELL_MARK = '__hrApplyUpdate';

const SUMMARY: BillingSummary = {
  mode: 'test',
  purchasesOpen: true,
  cards: [
    {
      spaceId: 'space:fam-b11',
      kind: 'family',
      name: 'Kim family',
      role: 'owner',
      archived: false,
      payer: true,
      readOnlyReason: null,
      coverage: { state: 'free' },
      usage: { learners: 1, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
      actions: { buy: 'family_lifetime', manage: false, contact: false },
      receipts: [],
      hasReceipts: false,
      legacyNoHistory: false,
    },
  ],
  account: [],
};

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

/**
 * The grown-up's console session, written on every grown-up page of this tab before its scripts run (a learner boot
 * removes it, F-APP-001 section 3.14), and every cross-origin API call answered by the mock.
 */
async function signedInGrownUp(page: Page): Promise<void> {
  await page.addInitScript(
    ([key]) => {
      if (window.location.pathname.startsWith('/account/')) {
        window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-b11', accountId: 'acct-b11', displayName: 'Ms Kim' }));
      }
    },
    [CONSOLE_SESSION_KEY],
  );
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.hostname !== 'localhost',
    (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const path = new URL(request.url()).pathname;
      if (path === '/api/billing/summary') return json(route, { data: SUMMARY });
      if (path === '/api/spaces') return json(route, { data: { spaces: [] } });
      return json(route, { data: {} });
    },
  );
}

/**
 * What a grown-up sign-in on this browser leaves (F-APP-001 section 3.9): the PIN epoch it saw, in the console's
 * shell store. Without it the console trusts no PIN on a family device and asks for a sign-in instead.
 */
async function trustPinEpoch(page: Page): Promise<void> {
  const epoch = await readStored<number>(page, 'account:pinSetAt');
  expect(typeof epoch).toBe('number');
  await page.evaluate(
    ({ db, store, key, value }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store);
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(store, 'readwrite');
          tx.objectStore(store).put(value, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: SHELL_DB, store: SHELL_STORE, key: SHELL_KEYS.pinEpoch, value: epoch },
  );
}

/** Counts new tabs from now on: the same-tab hand-off must open none. */
function watchTabs(context: BrowserContext): { seen: () => number } {
  let count = 0;
  context.on('page', () => {
    count += 1;
  });
  return { seen: () => count };
}

const screenText = (page: Page): Promise<string> => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

async function openProfile(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open, whenever it is ready, and covers the Home tabs.
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
}

/** Plan details opens the Plan screen with no PIN, and the screen shows no price. */
async function openPlanDetails(page: Page): Promise<void> {
  const details = page.getByRole('button', { name: 'Plan details', exact: true });
  await details.scrollIntoViewIfNeeded();
  await details.click();
  await expect(page.getByRole('button', { name: 'Open billing' })).toBeVisible();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
  expect(await screenText(page)).not.toMatch(PRICE);
}

/** The console's billing page, in this tab, with the mocked plan and no lock. */
async function expectBillingPage(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/account\/billing$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: /Kim family/ })).toBeVisible();
  await expect(page.getByText(LOCK_TITLE, { exact: true })).toHaveCount(0);
  expect(await page.evaluate((mark) => mark in window, LEARNER_SHELL_MARK)).toBe(false);
}

test.describe('the release build', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Profile, then Plan details, opens without a PIN and shows no price', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    expect(await screenText(page)).not.toMatch(PRICE);
    await openPlanDetails(page);
    await expect(page.getByText('Stage 1 is always free.')).toBeVisible();
  });

  test('with the learner worker active, /account/billing?checkout=success is the billing page, not the learner shell', async ({ page }) => {
    await signedInGrownUp(page);
    await page.goto('/');
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return !!reg?.active && !!navigator.serviceWorker.controller;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);

    const answer = page.waitForResponse((r) => new URL(r.url()).pathname === '/account/billing' && r.request().resourceType() === 'document');
    await page.goto('/account/billing?checkout=success&plan=family_lifetime&id=space%3Afam-b11');
    expect(await (await answer).text()).not.toContain(LEARNER_SHELL_MARK);
    await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
    await expect(page.locator('script[src^="/_next/static/"]').first()).toBeAttached();
    expect(await page.evaluate((mark) => mark in window, LEARNER_SHELL_MARK)).toBe(false);
    // The page read the return once and cleared it from the address bar.
    await expect.poll(() => new URL(page.url()).search).toBe('');
  });
});

test.describe('flag on (EXPO_PUBLIC_GROWN_UP_HOME=true): the same tab opens the real billing page', () => {
  test.skip(!ON, 'needs a build with EXPO_PUBLIC_GROWN_UP_HOME=true and E2E_GROWN_UP_HOME=1');
  // The billing page comes from the network, as on a device whose worker passes grown-up paths through.
  test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 667 } });

  test('family device: Plan details (no PIN), Open billing, then the PIN: /account/billing in this tab without the lock', async ({ page, context }) => {
    await signedInGrownUp(page);
    await onboardChild(page, { name: 'Mina' });
    await trustPinEpoch(page);
    await openProfile(page, 'Mina');
    await openPlanDetails(page);
    const tabs = watchTabs(context);

    await page.getByRole('button', { name: 'Open billing' }).click();
    await unlockWithPin(page);
    await expectBillingPage(page);
    expect(tabs.seen()).toBe(0);
    expect(JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK_SESSION_KEY)) ?? 'null')).toMatchObject({ v: 1, src: 'pin' });
  });

  test('self-only device without a PIN: Open billing goes straight to the billing page, no PIN and no lock', async ({ page, context }) => {
    await signedInGrownUp(page);
    await onboardSelf(page, { name: 'Rio' });
    await openProfile(page, 'Rio');
    await openPlanDetails(page);
    const tabs = watchTabs(context);

    await page.getByRole('button', { name: 'Open billing' }).click();
    await expectBillingPage(page);
    expect(tabs.seen()).toBe(0);
  });

  test('a PIN older than 2 minutes asks again on the grown-up area PIN screen, then the billing page opens without the lock', async ({ page }) => {
    await page.clock.install();
    await signedInGrownUp(page);
    await onboardChild(page, { name: 'Mina' });
    await trustPinEpoch(page);
    await openProfile(page, 'Mina');
    // Open the 15-minute grown-up session through another gate (Edit profile), then come back to Profile.
    await page.getByRole('button', { name: /^Edit Mina/ }).click();
    await unlockWithPin(page);
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await page.clock.fastForward('03:00');
    await openPlanDetails(page);

    await page.getByRole('button', { name: 'Open billing' }).click();
    // The session is open, but the PIN is stale: the grown-up area's own PIN screen asks first.
    await unlockWithPin(page);
    await expectBillingPage(page);
  });
});
