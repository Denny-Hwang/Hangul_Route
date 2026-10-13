import { expect, test, type Page, type Route } from '@playwright/test';
import { APP_ROUTES, FAMILY_LIFETIME_LEARNERS, type BillingSpaceCard, type BillingSummary, type ReceiptView } from '@hangul-route/content-schema';

/**
 * F-BILL-002 B-11 (section 11, `web/e2e/billing.spec.ts`): the whole billing journey of a grown-up in a real browser,
 * on F-APP-001's merged app-host build (apps/mobile `build:web` copies the console role of this app into dist under
 * the grown-up prefixes), with the API mocked by `page.route`. Stripe is never reached: checkout and receipt links
 * answer with stand-in pages, and Stripe Live stays off (the mocked summary is in test mode).
 *
 * The merged build always has the dev sign-in form off and, without a Clerk key, signs in from the console session
 * in `sessionStorage` (the dev bridge), so the test seeds that session. Dev auth has no Clerk, so a step-up's
 * Continue reruns the request at once (section 4.4); the mocked Worker answers the reverification hint the first
 * time, as B-5 does on a stale sign-in. A fresh browser holds no learner profile, so the grown-up lock stays open.
 *
 * It needs a build whose API base is set (any host: the mock matches every cross-origin `/api/` call), run with
 * `BILLING_E2E=1`; on the default export (the preview gate's) it is skipped:
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://api.billing-e2e.test pnpm --filter @hangul-route/mobile build:web
 *   BILLING_E2E=1 E2E_OUT=../mobile/dist pnpm --filter @hangul-route/web exec playwright test billing.spec
 *
 * (`E2E_OUT` points `serve-out.mjs` at the merged dist; the console-only export built with
 * `NEXT_PUBLIC_API_BASE_URL` set and `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true` runs it too.)
 */
const FULL = process.env.BILLING_E2E === '1';
const SESSION_KEY = 'hr:console:session';
const STRIPE_CHECKOUT = 'https://checkout.stripe.com/c/pay/cs_test_b11';
const RECEIPT_URL = 'https://invoice.stripe.com/i/acct_b11/test_b11';
const FAMILY = 'space:fam-b11';
/** An amount or a term, as landing-claims.test.tsx bans them on the site: the caregiver card shows neither. */
const PRICE = /\$\s?\d|\d[.,]\d{2}\b|\bper\s+(year|month)\b|\/\s?(yr|year|mo|month)\b/i;

const HINT = {
  error: { code: 'reverify_required', message: 'mocked' },
  clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
};

const YEAR_AHEAD = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

function familyCard(overrides: Partial<BillingSpaceCard>): BillingSpaceCard {
  return {
    spaceId: FAMILY,
    kind: 'family',
    name: 'Kim family',
    role: 'owner',
    archived: false,
    payer: true,
    readOnlyReason: null,
    coverage: { state: 'free' },
    usage: { learners: 0, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
    actions: { buy: 'family_lifetime', manage: false, contact: false },
    receipts: [],
    hasReceipts: false,
    legacyNoHistory: false,
    ...overrides,
  };
}

const ACTIVE = { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: YEAR_AHEAD, statusSince: '2026-10-13T09:00:00.000Z', endsAtPeriodEnd: false } as const;

const RECEIPT: ReceiptView = { id: 'bev:b11-1', kind: 'purchase', planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-13T09:00:00.000Z', hasReceipt: true };

const summaryOf = (cards: BillingSpaceCard[]): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [] });

/** A parent with one free family and no learner yet. */
const FREE_FAMILY = summaryOf([familyCard({})]);
/** The same family once the webhook landed: the plan is active, still no learner. */
const PAID_FAMILY = summaryOf([familyCard({ coverage: ACTIVE, actions: { buy: null, manage: true, contact: false }, receipts: [RECEIPT], hasReceipts: true })]);
/** A co-parent (caregiver) of a covered family: status only. */
const CAREGIVER = summaryOf([
  familyCard({ role: 'caregiver', payer: false, readOnlyReason: 'family', coverage: ACTIVE, usage: { learners: 2, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null }, actions: { buy: null, manage: false, contact: false } }),
]);

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

interface Mock {
  /** What `GET /api/billing/summary` answers next; the journey swaps it once the plan "lands". */
  summary: BillingSummary;
  checkouts: number;
  links: number;
  /** Summary reads with `?poll=1` (the checkout return's polls and the receipts page). */
  polls: number;
}

/** Signs the grown-up in (the dev bridge's session) and mocks the Worker and Stripe. */
/** `appOrigin`: where the Stripe stand-in sends the grown-up back (the served build). */
async function mockBilling(page: Page, summary: BillingSummary, appOrigin = ''): Promise<Mock> {
  const mock: Mock = { summary, checkouts: 0, links: 0, polls: 0 };
  await page.addInitScript(
    ([key]) => window.sessionStorage.setItem(key as string, JSON.stringify({ token: 'acct-b11', accountId: 'acct-b11', displayName: 'Ms Kim' })),
    [SESSION_KEY],
  );
  // Every cross-origin API call (the build's API base, whatever host it names); the page's own origin is localhost.
  await page.route(
    (url) => url.pathname.startsWith('/api/') && url.hostname !== 'localhost',
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const url = new URL(request.url());
      if (url.pathname === '/api/billing/summary') {
        if (url.searchParams.get('poll') === '1') mock.polls += 1;
        return json(route, 200, { data: mock.summary });
      }
      if (url.pathname === '/api/entitlements/stripe/checkout') {
        mock.checkouts += 1;
        return json(route, 200, { data: { url: STRIPE_CHECKOUT } });
      }
      if (url.pathname === '/api/billing/receipts') return json(route, 200, { data: { spaceName: 'Kim family', receipts: [RECEIPT] } });
      if (url.pathname === '/api/billing/receipt-link') {
        mock.links += 1;
        return mock.links === 1 ? json(route, 403, HINT) : json(route, 200, { data: { url: RECEIPT_URL } });
      }
      if (url.pathname === '/api/spaces') return json(route, 200, { data: { spaces: [] } });
      return json(route, 200, { data: { plans: [], requests: [], entitlements: [] } });
    },
  );
  // Stripe Checkout stand-in: paying sends the grown-up back the way B-5's success URL does.
  await page.context().route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><title>Stripe test</title><a id="pay" href="${appOrigin}/account/billing?checkout=success&plan=family_lifetime&id=${encodeURIComponent(FAMILY)}">Pay</a>`,
    }),
  );
  await page.context().route('https://invoice.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe receipt</title><p>Receipt</p>' }));
  return mock;
}

const familyHeading = (page: Page) => page.getByRole('heading', { level: 3, name: /Kim family/ });

async function noSidewaysScroll(page: Page): Promise<void> {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

test.describe('billing on the app host (B-11)', () => {
  test.skip(!FULL, 'needs a build with an API base, run with BILLING_E2E=1');

  test('a parent with one free family: Get Family Plan on the card, Stripe, back to checking, then active and Connect a learner', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const mock = await mockBilling(page, FREE_FAMILY, new URL(baseURL ?? '').origin);
    await page.goto('/account/billing');
    await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
    await expect(page.getByText('Test mode: no real card is charged.')).toBeVisible();
    await expect(page.getByText('Grown-ups only')).toHaveCount(0);
    await expect(familyHeading(page)).toBeVisible();
    // One buyable space: the offer sits inside its card, with no Add a plan block.
    const card = page.getByTestId('bill-card');
    await expect(card).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Add a plan' })).toHaveCount(0);

    await card.getByRole('button', { name: 'Get Family Plan' }).click();
    await page.waitForURL(STRIPE_CHECKOUT);
    expect(mock.checkouts).toBe(1);

    // The webhook is late: the first polls still read the free plan, so the page keeps checking.
    await page.getByRole('link', { name: 'Pay' }).click();
    await page.waitForURL((url) => url.pathname === '/account/billing');
    const notice = page.getByTestId('bill-return');
    await expect(notice).toContainText('Almost there: checking your plan.');
    // The return query is cleared, so a refresh or a copied address does not repeat it.
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expect(card.getByRole('button', { name: 'Get Family Plan' })).toBeDisabled();
    await expect(page.getByText('Thank you. The plan is active.', { exact: false })).toHaveCount(0);

    mock.summary = PAID_FAMILY;
    await expect(notice).toContainText('Thank you. The plan is active. Learners get it the next time they open Hangul Route.', { timeout: 15_000 });
    expect(mock.polls).toBeGreaterThan(0);
    await expect(card).toContainText('Family Plan');
    await expect(card).toContainText('Next: connect a learner to this family.');
    const connect = card.getByRole('link', { name: 'Connect a learner' });
    await expect(connect).toBeVisible();
    // F-APP-001's family page with this family's join code panel (billing-summary.ts `connectLearnerHref`).
    const connectUrl = new URL((await connect.getAttribute('href')) ?? '', baseURL);
    expect(connectUrl.pathname).toBe(`${APP_ROUTES.parentHome}/space`);
    expect(connectUrl.searchParams.get('id')).toBe(FAMILY);
    // Focus lands on the bought family's card heading.
    await expect(familyHeading(page)).toBeFocused();
    await expect(card.getByRole('button', { name: 'Get Family Plan' })).toHaveCount(0);
  });

  test('a caregiver reads the plan only: no buy, no Manage, no receipts, no price', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBilling(page, CAREGIVER);
    await page.goto('/account/billing');
    const card = page.getByTestId('bill-card');
    await expect(card).toContainText('The person who set up this family manages this plan.');
    await expect(card).toContainText('Family Plan');
    await expect(card.getByRole('button')).toHaveCount(0);
    await expect(card.getByRole('link', { name: 'All receipts' })).toHaveCount(0);
    await expect(card.getByText('Receipts', { exact: true })).toHaveCount(0);
    expect(await card.innerText()).not.toMatch(PRICE);
  });

  test('the receipts page from the card; View receipt asks to confirm, then opens Stripe in a new tab with no opener', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const mock = await mockBilling(page, PAID_FAMILY);
    await page.goto('/account/billing');
    await page.getByTestId('bill-card').getByRole('link', { name: 'All receipts' }).click();
    await page.waitForURL((url) => url.pathname === '/account/billing/receipts');
    expect(new URL(page.url()).searchParams.get('id')).toBe(FAMILY);
    await expect(page.getByRole('heading', { level: 1, name: 'Kim family · receipts' })).toBeVisible();
    // The receipt's row carries the test-mode pill.
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: /View receipt/ }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.hr-bill-pill')).toHaveText('test');
    // No Stripe id or URL is on the page before a tap.
    expect(await page.content()).not.toContain('stripe.com');

    const blank = context.waitForEvent('page');
    await page.getByRole('button', { name: /View receipt/ }).click();
    const blankTab = await blank;
    await expect(page.getByRole('dialog', { name: "Confirm it's you" })).toBeVisible();
    await expect.poll(() => blankTab.isClosed()).toBe(true);
    const receipt = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Continue' }).click();
    const receiptTab = await receipt;
    await receiptTab.waitForURL(RECEIPT_URL);
    expect(await receiptTab.evaluate(() => window.opener)).toBeNull();
    expect(mock.links).toBe(2);
    await expect(page).toHaveURL(/\/account\/billing\/receipts\?id=/);

    await page.getByRole('link', { name: 'Back to Billing' }).click();
    await page.waitForURL((url) => url.pathname === '/account/billing');
  });

  test('offline after the cards loaded: the offline line shows and buying waits for the connection', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockBilling(page, FREE_FAMILY);
    await page.goto('/account/billing');
    const buy = page.getByTestId('bill-card').getByRole('button', { name: 'Get Family Plan' });
    await expect(buy).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByText("You're offline. Plans and receipts need a connection.")).toBeVisible();
    await expect(buy).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByText("You're offline. Plans and receipts need a connection.")).toHaveCount(0);
    await expect(buy).toBeEnabled();
  });

  test('an old Stripe cancel return at /teach/billing lands on /account/billing with its query and says nothing was charged', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const seen: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) seen.push(frame.url());
    });
    await mockBilling(page, FREE_FAMILY);
    await page.goto('/teach/billing?checkout=cancel');
    await page.waitForURL((url) => url.pathname === '/account/billing');
    expect(seen.some((u) => new URL(u).pathname === '/account/billing' && new URL(u).searchParams.get('checkout') === 'cancel')).toBe(true);
    await expect(page.getByTestId('bill-return')).toHaveText('Nothing was charged.');
    await expect(familyHeading(page)).toBeVisible();
  });

  for (const summary of [
    { name: 'free family', data: FREE_FAMILY, reaches: 'Get Family Plan' },
    { name: 'paid family', data: PAID_FAMILY, reaches: 'All receipts' },
  ]) {
    test(`320 px, ${summary.name}: no sideways scroll, and the tab order follows the visual order`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await mockBilling(page, summary.data);
      await page.goto('/account/billing');
      await expect(familyHeading(page)).toBeVisible();
      await noSidewaysScroll(page);

      // Tab through the billing body: each stop is below the previous one, or on the same line to its right.
      await page.getByRole('heading', { level: 1, name: 'Billing' }).evaluate((h) => {
        h.setAttribute('tabindex', '-1');
        (h as HTMLElement).focus();
      });
      // Every stop until focus leaves the page or comes back round; stops outside the billing body (the frame's
      // own links) are skipped, not the end, so a control after them is still checked.
      const stops: { top: number; left: number; label: string }[] = [];
      for (let i = 0; i < 60; i += 1) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return 'end' as const;
          if (!el.closest('.hr-bill')) return 'outside' as const;
          if (el.tagName === 'H1') return 'end' as const;
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, left: r.left, label: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim() };
        });
        if (stop === 'end') break;
        if (stop === 'outside') continue;
        if (stops.some((s) => s.top === stop.top && s.left === stop.left && s.label === stop.label)) break;
        stops.push(stop);
      }
      expect(stops.map((s) => s.label)).toContain(summary.reaches);
      for (const [prev, next] of stops.slice(1).map((stop, i) => [stops[i] ?? stop, stop] as const)) {
        const sameLine = Math.abs(next.top - prev.top) < 4;
        expect(sameLine ? next.left > prev.left : next.top > prev.top, `${prev.label} then ${next.label}`).toBe(true);
      }
      await noSidewaysScroll(page);
    });
  }
});
