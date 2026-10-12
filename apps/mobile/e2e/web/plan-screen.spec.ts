import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, unlockWithPin } from './helpers';

/**
 * F-BILL-002 B-9 (section 4.7, wireframe billing/plan-status, mock
 * design/screens/billing/plan-status.md): the learner Plan screen replaces the
 * price-bearing paywall. Profile shows Plan details for every tier and opens it
 * without a PIN; the screen shows status only (no price, no offer, no promo,
 * no terms line); on the web, Open billing goes through the grown-up gate and
 * then opens today's console billing page. Back from a correct PIN the screen
 * asks for one more tap (a browser may block a tab opened outside a tap,
 * HAND_OFF_NEEDS_TAP), so no tab opens until Open billing is pressed again.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

const BILLING_URL = 'https://hangulroute.com/teach/billing';

const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

/** The console page is never reached for real: the hand-off is checked by the URL the new tab asks for. */
async function stubConsole(context: BrowserContext): Promise<void> {
  await context.route('https://hangulroute.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Billing</title><p>Billing</p>' }),
  );
}

/** Watches for any new tab from now on; `seen()` reads how many opened. */
function watchTabs(context: BrowserContext): { seen: () => number } {
  let count = 0;
  context.on('page', () => {
    count += 1;
  });
  return { seen: () => count };
}

/** How long a tab opened by a stray focus effect would take to show up, at most (it opens on focus, with no network wait). */
const SETTLE_MS = 1500;

/**
 * Caches a full-route tier for the active learner, as a sync inbox would (tier-store, `hr:tier:<id>`
 * in IndexedDB through idb-keyval), then reloads so the app hydrates it on boot.
 */
async function seedTier(page: Page, source: { kind: 'class' | 'family'; name: string }): Promise<void> {
  await page.evaluate(
    (src) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = (mode: IDBTransactionMode): IDBObjectStore => db.transaction('keyval', mode).objectStore('keyval');
          const active = store('readonly').get('hr:profiles:active');
          active.onerror = () => reject(active.error);
          active.onsuccess = () => {
            const id = JSON.parse(String(active.result)) as string;
            const tier = { tier: 'premium', source: { ...src, spaceId: `space:${src.kind}` }, validUntil: null, fetchedAt: new Date().toISOString() };
            const put = store('readwrite').put(JSON.stringify(tier), `hr:tier:${id}`);
            put.onerror = () => reject(put.error);
            put.onsuccess = () => {
              db.close();
              resolve();
            };
          };
        };
      }),
    source,
  );
  await page.reload();
}

async function openPlanDetails(page: Page, name: string, card = 'Free plan'): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open, whenever it is ready, and covers the Home tabs.
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
  await expect(page.getByText(card, { exact: true })).toBeVisible();
  if (card === 'Full route') await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /unlock/i })).toHaveCount(0);
  const details = page.getByRole('button', { name: 'Plan details', exact: true });
  await details.scrollIntoViewIfNeeded();
  await details.click();
}

async function expectStatusOnly(page: Page): Promise<void> {
  await expect(page.getByText('Stage 1 is always free.')).toBeVisible();
  // F-ENT-003 E3-8: the release build's switch is off, so the free slot holds only that line.
  await expect(page.getByTestId('plan-free-list')).toHaveCount(0);
  await expect(page.getByText(/^Stage 1 is free:/)).toHaveCount(0);
  const text = await screenText(page);
  expect(text).not.toMatch(/\$|\d+\.\d{2}|\/ year|lifetime|premium|unlock|\bbuy\b|promo|terms|web console/i);
  // Status, caption and both buttons fit the width: no sideways scroll at 320 px either.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('self-only device without a PIN: Plan details, status only, Open billing opens the billing page', async ({ page, context }) => {
      await stubConsole(context);
      await onboardSelf(page, { name: 'Rio' });
      await openPlanDetails(page, 'Rio');

      // The summary heading carries the state (a11y.planStatus).
      await expect(page.getByRole('heading', { name: 'Rio: Free plan.' })).toBeVisible();
      await expect(page.getByText("You're on the free plan.")).toBeVisible();
      await expect(page.getByText('Your plan and receipts are on the billing page.')).toBeVisible();
      await expect(page.getByText(/Create a (grown-up )?PIN/)).toHaveCount(0);
      await expectStatusOnly(page);
      await page.screenshot({ path: test.info().outputPath(`plan-screen-self-${vp.width}.png`), fullPage: true });

      // No PIN on this device: the gate opens directly, inside the tap.
      const open = page.getByRole('button', { name: 'Open billing' });
      await expect(open).toHaveAccessibleDescription('Opens the billing page');
      const [tab] = await Promise.all([page.waitForEvent('popup'), open.click()]);
      expect(tab.url()).toBe(BILLING_URL);
      await expect(page.getByText(/in a browser\./)).toHaveCount(0);
    });

    test('family device: Plan details needs no PIN; Open billing asks for the PIN, then one more tap opens the billing page', async ({ page, context }) => {
      await stubConsole(context);
      await onboardChild(page, { name: 'Mina' });
      await openPlanDetails(page, 'Mina');

      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Mina: Free plan.' })).toBeVisible();
      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
      await expect(page.getByText('Plans and receipts are on the billing page for grown-ups.')).toBeVisible();
      await expectStatusOnly(page);
      await page.screenshot({ path: test.info().outputPath(`plan-screen-family-${vp.width}.png`), fullPage: true });

      const tabs = watchTabs(context);

      // A cancelled gate opens nothing, even after the screen has settled.
      await page.getByRole('button', { name: 'Open billing' }).click();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
      await page.waitForTimeout(SETTLE_MS);
      expect(tabs.seen()).toBe(0);
      await expect(page.getByText('PIN accepted. Tap Open billing again.')).toHaveCount(0);

      // The right PIN returns to the Plan screen, which asks for one more tap and opens no tab by itself.
      const open = page.getByRole('button', { name: 'Open billing' });
      await open.click();
      await unlockWithPin(page);
      await expect(page.getByText('PIN accepted. Tap Open billing again.')).toBeVisible();
      await expect(open).toBeFocused();
      await page.waitForTimeout(SETTLE_MS);
      expect(tabs.seen()).toBe(0);

      // The grown-up session is open now: that tap opens the billing page inside it.
      const [tab] = await Promise.all([page.waitForEvent('popup'), open.click()]);
      expect(tab.url()).toBe(BILLING_URL);
      expect(tabs.seen()).toBe(1);
      await expect(page.getByText('PIN accepted. Tap Open billing again.')).toHaveCount(0);
      await expect(page.getByText(/in a browser\./)).toHaveCount(0);
    });
  });
}

/**
 * The full route (a seeded tier cache, as the sync inbox writes it): Profile reads "Full route" and
 * "Active" with Plan details, and a family device still opens the Plan screen with no PIN.
 */
const FULL_ROUTE = [
  { kind: 'class', name: 'Sunday Class A', title: 'Mina is covered by Sunday Class A.', line: 'Everything is open while they are in it.', summary: 'Mina: Full route.' },
  { kind: 'family', name: 'Kim family', title: 'Mina has the full route.', line: "From your family's Family Plan.", summary: 'Mina: Full route.' },
] as const;

test.describe('full route', () => {
  test.use({ viewport: VIEWPORTS[0] });

  for (const row of FULL_ROUTE) {
    test(`${row.kind} source: Profile shows Full route, Active and Plan details; the Plan screen opens with no PIN`, async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await seedTier(page, { kind: row.kind, name: row.name });
      await openPlanDetails(page, 'Mina', 'Full route');

      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: row.summary })).toBeVisible();
      await expect(page.getByText(row.title)).toBeVisible();
      await expect(page.getByText(row.line)).toBeVisible();
      await expect(page.getByText('Stage 1 is always free.')).toHaveCount(0);
      // F-ENT-003 E3-8 (section 3.9.4, item 10): a family-plan learner with no plan gets the guidance
      // line and, on the web, the grown-up page line (no link), with the switch off too; a class
      // covers the learner, and the covered state has no guidance slot.
      if (row.kind === 'family') {
        await expect(page.getByTestId('plan-guidance')).toBeVisible();
        await expect(page.getByText('Set a plan to guide what comes next.')).toBeVisible();
        await expect(page.getByText('Plans are made in the grown-up area: Plan the term.')).toBeVisible();
        await expect(page.getByTestId('plan-guidance').getByRole('link')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('plan-guidance')).toHaveCount(0);
      }
      await expect(page.getByRole('button', { name: 'Open billing' })).toBeVisible();
      const text = await screenText(page);
      expect(text).not.toMatch(/\$|\d+\.\d{2}|\/ year|lifetime|premium|unlock|\bbuy\b|promo|terms|web console/i);
    });
  }
});

/**
 * Wide layout (B-9 review): at 1280 x 800 the running app, not only the static mock, keeps the Plan
 * screen status only, describes Open billing by its hint and scrolls no sideways.
 */
test.describe('1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('family device: Plan details with no PIN, status only, Open billing described by its hint', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await openPlanDetails(page, 'Mina');

    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Mina: Free plan.' })).toBeVisible();
    await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
    await expectStatusOnly(page);
    await expect(page.getByRole('button', { name: 'Open billing' })).toHaveAccessibleDescription('Opens the billing page');
    await page.screenshot({ path: test.info().outputPath('plan-screen-family-1280.png'), fullPage: true });
  });
});
