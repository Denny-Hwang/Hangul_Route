import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * F-BILL-002 B-8b review round: the step-up dialog in a real browser, on the static export with the API mocked by
 * `page.route` (the unit tests use react-test-renderer, which has no layout and no DOM). It needs an export built
 * with `NEXT_PUBLIC_API_BASE_URL=https://api.billing-e2e.test` and `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`, run with
 * `BILLING_E2E=1`; on the default export (the preview gate's) it is skipped. B-11's `billing.spec.ts` carries the
 * whole billing journey.
 *
 * Dev auth has no Clerk, so Continue reruns the request at once (the Worker skips step-up there, section 4.4); the
 * mocked checkout answers the reverification hint the first time, as B-5 does on a stale sign-in. A stand-in for
 * Clerk's own root (`#clerk-components`) is put under `body` before the dialog opens, as clerk-js leaves it after
 * its first modal: it must never be made inert.
 */
const FULL = process.env.BILLING_E2E === '1';
const API = 'https://api.billing-e2e.test';
const SESSION_KEY = 'hr:console:session';
const STRIPE = 'https://checkout.stripe.com/c/pay/cs_test_e2e';

const HINT = {
  error: { code: 'reverify_required', message: 'mocked' },
  clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
};

const space = (spaceId: string, kind: 'family' | 'class', name: string) => ({
  spaceId,
  kind,
  name,
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 2, learnerCap: kind === 'family' ? 6 : 30, teachers: null, teacherCap: null },
  actions: { buy: kind === 'family' ? 'family_lifetime' : 'group_license', manage: false, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
});

/** Four buyable spaces: a page taller than the viewport, so the step-up opens from far down. */
const SUMMARY = {
  mode: 'test',
  purchasesOpen: true,
  cards: [space('space:fam', 'family', 'Kim family'), space('space:c1', 'class', 'Room 1'), space('space:c2', 'class', 'Room 2'), space('space:c3', 'class', 'Room 3')],
  account: [],
};

const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

const RECEIPT_URL = 'https://invoice.stripe.com/i/acct_e2e/test_e2e';
const RECEIPTS = {
  spaceName: 'Kim family',
  receipts: [{ id: 'bev:e2e1', kind: 'purchase', planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-01T09:00:00.000Z', hasReceipt: true }],
};

async function mockBilling(page: Page): Promise<{ checkouts: number; links: number }> {
  const seen = { checkouts: 0, links: 0 };
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-e2e', accountId: 'acct-e2e', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(request.url());
    if (url.pathname === '/api/billing/summary') return json(route, 200, { data: SUMMARY });
    if (url.pathname === '/api/entitlements/stripe/checkout') {
      seen.checkouts += 1;
      return seen.checkouts === 1 ? json(route, 403, HINT) : json(route, 200, { data: { url: STRIPE } });
    }
    if (url.pathname === '/api/billing/receipts') return json(route, 200, { data: RECEIPTS });
    if (url.pathname === '/api/billing/receipt-link') {
      seen.links += 1;
      return seen.links === 1 ? json(route, 403, HINT) : json(route, 200, { data: { url: RECEIPT_URL } });
    }
    if (url.pathname === '/api/spaces') return json(route, 200, { data: { spaces: [] } });
    return json(route, 200, { data: { plans: [], requests: [], entitlements: [] } });
  });
  await page.context().route('https://invoice.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe receipt</title><p>Receipt</p>' }));
  await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe test</title><p>Stripe test page</p>' }));
  return seen;
}

/** Clerk's components root as clerk-js leaves it under `body` after its first modal. */
async function addClerkRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.createElement('div');
    root.id = 'clerk-components';
    document.body.appendChild(root);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`step-up at ${viewport.width} x ${viewport.height}`, () => {
    test.skip(!FULL, 'needs an export built for the billing e2e (BILLING_E2E=1)');

    test('opened far down the page: the scrim covers the viewport and the dialog sits inside it; the page is inert, Clerk’s root is not', async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockBilling(page);
      await page.goto('/account/billing');
      const last = page.getByRole('button', { name: 'Get Group License' }).last();
      await last.scrollIntoViewIfNeeded();
      await addClerkRoot(page);
      await last.click();
      const dialog = page.getByRole('dialog', { name: "Confirm it's you" });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();

      const geometry = await page.evaluate(() => {
        const scrim = document.querySelector('.hr-bill-scrim') as HTMLElement;
        const box = document.querySelector('[data-testid="step-up"]') as HTMLElement;
        const s = scrim.getBoundingClientRect();
        const d = box.getBoundingClientRect();
        let containerAncestor = false;
        for (let el = scrim.parentElement; el; el = el.parentElement) if (getComputedStyle(el).containerType !== 'normal') containerAncestor = true;
        return {
          scrim: { x: s.x, y: s.y, w: s.width, h: s.height },
          dialog: { top: d.top, bottom: d.bottom, left: d.left, right: d.right },
          vw: window.innerWidth,
          vh: window.innerHeight,
          containerAncestor,
          scrimInBody: scrim.parentElement === document.body,
          clerkInert: document.getElementById('clerk-components')?.closest('[inert]') !== null,
          pageInert: document.querySelector('main')?.closest('[inert]') !== null,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.scrimInBody).toBe(true);
      expect(geometry.containerAncestor).toBe(false);
      expect(geometry.scrim).toEqual({ x: 0, y: 0, w: geometry.vw, h: geometry.vh });
      expect(geometry.dialog.top).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.vh);
      expect(geometry.dialog.left).toBeGreaterThanOrEqual(0);
      expect(geometry.dialog.right).toBeLessThanOrEqual(geometry.vw);
      expect(geometry.pageInert).toBe(true);
      expect(geometry.clerkInert).toBe(false);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.vw);

      // Tab and Shift+Tab stay inside; Escape is Not now and gives focus back to the pressed button.
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Not now' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Not now' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('Nothing was changed.')).toBeVisible();
      await expect(last).toBeFocused();
      expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    });

    test('Continue: the retried checkout goes to Stripe; the refused request went out once', async ({ page }) => {
      await page.setViewportSize(viewport);
      const seen = await mockBilling(page);
      await page.goto('/account/billing');
      await page.getByRole('button', { name: 'Get Family Plan' }).last().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.waitForURL(STRIPE);
      expect(seen.checkouts).toBe(2);
    });
  });
}

test.describe('step-up on the receipts page', () => {
  test.skip(!FULL, 'needs an export built for the billing e2e (BILLING_E2E=1)');

  test('View receipt on a stale sign-in: the blank tab closes before the dialog; after Continue the receipt opens in a new tab', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const seen = await mockBilling(page);
    await page.goto('/account/billing/receipts?id=space%3Afam');
    const blank = context.waitForEvent('page');
    await page.getByRole('button', { name: /View receipt/ }).click();
    const blankTab = await blank;
    await expect(page.getByRole('dialog', { name: "Confirm it's you" })).toBeVisible();
    // The empty tab is gone before the grown-up is asked to confirm in this one.
    await expect.poll(() => blankTab.isClosed()).toBe(true);
    const receipt = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Continue' }).click();
    const receiptTab = await receipt;
    await receiptTab.waitForURL(RECEIPT_URL);
    expect(await receiptTab.evaluate(() => window.opener)).toBeNull();
    expect(seen.links).toBe(2);
    await expect(page.getByText("Can't open this receipt right now.")).toHaveCount(0);
  });
});
