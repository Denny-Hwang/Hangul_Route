import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, unlockWithPin } from './helpers';

/**
 * F-BILL-002 B-9b (section 4.7; wireframe billing/plan-status, mock design/screens/billing/plan-status.md
 * and design/screens/app-shell/learner-entry.md D18): with F-APP-001's `flags.grownUpHomeEnabled` on,
 * the Plan screen's Open billing hands off to `/account/billing` in the **same tab** through
 * `openGrownUpArea({ via: 'plan' })`, never a new tab. A PIN older than 2 minutes asks on the
 * grown-up area's PIN screen first. (Offline, Open billing is disabled with "Needs the internet":
 * F-APP-001 A-7's state, in grown-up-entries.spec.ts.) The flag is on by default since F-APP-001 A-10; these run in
 * the billing and grown-up home lane (F-BILL-002 B-14), on a build made with it on (as A-7's grown-up-entries.spec.ts):
 *
 *   EXPO_PUBLIC_GROWN_UP_HOME=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_GROWN_UP_HOME=1 pnpm --filter @hangul-route/mobile exec playwright test plan-screen-same-tab
 *
 * The billing page is a stand-in served by the test (no Clerk session here), and the service worker
 * is blocked so the stand-in is what the navigation gets. The default build's B-9 path is
 * plan-screen.spec.ts.
 */
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 667 } });

const ON = process.env.E2E_GROWN_UP_HOME === '1';
const UNLOCK = 'hr:grownup:unlock';

/** Serves a plain page at `/account/billing`, the grown-up billing page the hand-off opens. */
async function standInBilling(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === '/account/billing',
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Billing</title><p>Billing stand-in</p>' }),
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

async function openPlanDetails(page: Page): Promise<void> {
  const details = page.getByRole('button', { name: 'Plan details', exact: true });
  await details.scrollIntoViewIfNeeded();
  await details.click();
  await expect(page.getByRole('button', { name: 'Open billing' })).toBeVisible();
}

const unlockOf = async (page: Page): Promise<unknown> =>
  JSON.parse((await page.evaluate((k) => sessionStorage.getItem(k), UNLOCK)) ?? 'null');

test.describe('flag on (EXPO_PUBLIC_GROWN_UP_HOME=true)', () => {
  test.skip(!ON, 'needs a build with EXPO_PUBLIC_GROWN_UP_HOME=true and E2E_GROWN_UP_HOME=1');

  test('family device: Open billing, then the PIN, opens /account/billing in this tab with a PIN unlock and no new tab', async ({ page, context }) => {
    await standInBilling(page);
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    await openPlanDetails(page);
    const tabs = watchTabs(context);

    await page.getByRole('button', { name: 'Open billing' }).click();
    await unlockWithPin(page);
    // No "Tap Open billing again": no tab opens, so nothing can be blocked.
    await expect(page).toHaveURL(/\/account\/billing\?lang=en$/);
    await expect(page.getByText('Billing stand-in')).toBeVisible();
    expect(tabs.seen()).toBe(0);
    expect(await unlockOf(page)).toMatchObject({ v: 1, src: 'pin' });
  });

  test('self-only device without a PIN: Open billing goes straight to /account/billing with no unlock', async ({ page, context }) => {
    await standInBilling(page);
    await onboardSelf(page, { name: 'Rio' });
    await openProfile(page, 'Rio');
    await openPlanDetails(page);
    const tabs = watchTabs(context);

    await page.getByRole('button', { name: 'Open billing' }).click();
    await expect(page).toHaveURL(/\/account\/billing\?lang=en$/);
    expect(tabs.seen()).toBe(0);
    // Marker `none`: no unlock is needed and none is written.
    expect(await unlockOf(page)).toBeNull();
  });

  test('a PIN older than 2 minutes (the 15-minute session still open) asks on the grown-up PIN screen first', async ({ page }) => {
    await page.clock.install();
    await standInBilling(page);
    await onboardChild(page, { name: 'Mina' });
    await openProfile(page, 'Mina');
    // Open the 15-minute session through another gate (Edit profile), then come back to Profile.
    await page.getByRole('button', { name: /^Edit Mina/ }).click();
    await unlockWithPin(page);
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await page.clock.fastForward('03:00');
    await openPlanDetails(page);

    // The session opens the gate directly, but the PIN is stale: the grown-up area's own PIN screen.
    await page.getByRole('button', { name: 'Open billing' }).click();
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/account\/billing\?lang=en$/);
    expect(await unlockOf(page)).toMatchObject({ v: 1, src: 'pin' });
  });
});
