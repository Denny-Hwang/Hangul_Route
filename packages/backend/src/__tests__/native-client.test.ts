import { BillingSummarySchema, NATIVE_CLIENT_HEADER, NATIVE_CLIENT_VALUE, type BillingSummary } from '@hangul-route/content-schema';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { setReceiptFetchForTests } from '../routes/billing';
import { promoLimiter, setStripeFetchForTests } from '../routes/entitlements';
import { store } from '../store';
import { clerkTestKeys, type ClerkTestKeys } from './helpers/clerk-token';
import { testDb as db } from './helpers/db';

/**
 * F-AUTH-004 section 9.4 and 8.5 (row NS-1, defence in depth, Worker first): the billing status view, the money-route
 * guard (`NATIVE_MONEY_GUARD`), the account switch (`NATIVE_ACCOUNT`) and `no-store`, with real Clerk session tokens
 * verified offline: a browser token names its site (`azp`), a native one (Clerk's Expo SDK) names none.
 */
type Envelope = { ok: boolean; data?: unknown; error?: { code: string } };
const BROWSER = 'https://app.hangulroute.com';
const NATIVE = { [NATIVE_CLIENT_HEADER]: NATIVE_CLIENT_VALUE };
const DAY = 86_400_000;

let keys: ClerkTestKeys;
beforeAll(async () => {
  keys = await clerkTestKeys();
});

/** A deployment with a Clerk key bound (tokens verified), Stripe in test mode, both prices set, in-memory Db. */
const env = (extra: Record<string, string> = {}): Record<string, string> => ({
  ENVIRONMENT: 'test',
  CLERK_JWT_KEY: keys.jwtKey,
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PRICE_FAMILY_YEARLY: 'price_fy',
  STRIPE_PRICE_GROUP_LICENSE_YEARLY: 'price_gl',
  ...extra,
});
/** The console's token: Clerk names the site that minted it. A fresh first factor, so step-up never decides a test. */
const browser = async (sub = 'user_mom', claims: Record<string, unknown> = {}) => ({ 'content-type': 'application/json', authorization: `Bearer ${await keys.token(sub, { azp: BROWSER, fva: [0, -1], ...claims })}` });
/** The native app's token: no `azp`. */
const nativeToken = async (sub = 'user_mom', claims: Record<string, unknown> = {}) => ({ 'content-type': 'application/json', authorization: `Bearer ${await keys.token(sub, { fva: [0, -1], ...claims })}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, e: Record<string, string> = env()) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, e);
  return { status: res.status, cache: res.headers.get('cache-control'), body: (await res.json()) as Envelope };
}

let stripe = vi.fn<typeof fetch>();
const PROMO = { id: 'promo_1', code: 'hoya20', active: true, expires_at: null, max_redemptions: null, times_redeemed: 0, coupon: { id: 'c1', name: 'Launch', percent_off: 20, amount_off: null, currency: null, duration: 'once', valid: true } };
/** One Stripe stand-in for every money route: a checkout or portal link, an invoice page and a promotion code list. */
const stripeUrl = (url: string) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ url, id: 'in_1', hosted_invoice_url: url, data: [PROMO] }), { status: 200 }));
const summaryViews = () => store.events.filter((e) => e.name === 'billing.summary_viewed');

let fam = '';
let receiptId = '';
beforeEach(async () => {
  await db.reset();
  store.reset();
  promoLimiter.reset();
  stripe = stripeUrl('https://checkout.stripe.com/c/1');
  setStripeFetchForTests(stripe);
  setReceiptFetchForTests(stripe);
  const r = await call('POST', '/api/spaces', await browser(), { kind: 'family', name: 'Kim family' });
  fam = (r.body.data as { space: { id: string } }).space.id;
  // A Family Plan with a recorded payment: the full view has a receipt with an amount, and a manage action.
  await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_fam', customerRef: 'cus_fam', expiresAt: new Date(Date.now() + 365 * DAY).toISOString() }, new Date());
  const row = await db.recordBillingEvent(
    { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', kind: 'purchase', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: 'in_1', paymentRef: 'pi_1', livemode: false, occurredAt: new Date(Date.now() - DAY).toISOString() },
    new Date(),
  );
  receiptId = row.id;
  // A legacy account-subject row: the full view shows an account card.
  await db.applyEntitlement({ subjectKind: 'account', subjectId: 'user_mom', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_acct', customerRef: 'cus_acct', expiresAt: new Date(Date.now() + 30 * DAY).toISOString() }, new Date());
  store.reset();
});

function expectStatusView(summary: BillingSummary) {
  expect(summary.mode).toBe('none');
  expect(summary.purchasesOpen).toBe(false);
  expect(summary.account).toEqual([]);
  expect(summary.cards).toHaveLength(1);
  for (const card of summary.cards) {
    expect(card.receipts).toEqual([]);
    expect(card.hasReceipts).toBe(false);
    expect(card.legacyNoHistory).toBe(false);
    expect(card.actions).toEqual({ buy: null, manage: false, contact: false });
  }
  // Who the card is for, its coverage and usage stay (section 8.5's plan block).
  expect(summary.cards[0]).toMatchObject({ spaceId: fam, kind: 'family', name: 'Kim family', role: 'owner', coverage: { state: 'own', planKey: 'family_lifetime', status: 'active' } });
  expect(summary.cards[0]?.usage).not.toBeNull();
  expect(JSON.stringify(summary)).not.toMatch(/1530|amountCents|currency|usd|in_1|pi_1|cus_|sub_/);
}

describe('GET /api/billing/summary: the status view (section 8.5)', () => {
  it('a browser without view=status still gets the full summary, records billing.summary_viewed, and answers no-store', async () => {
    const r = await call('GET', '/api/billing/summary', await browser());
    expect(r.status).toBe(200);
    expect(r.cache).toBe('no-store');
    const full = BillingSummarySchema.parse(r.body.data);
    expect(full.mode).toBe('test');
    expect(full.cards[0]?.receipts).toHaveLength(1);
    expect(full.cards[0]?.actions.manage).toBe(true);
    expect(full.account).toHaveLength(1);
    expect(summaryViews()).toHaveLength(1);
  });

  it.each([
    ['view=status from a browser', '?view=status', async () => browser()],
    ['the native header, whatever the query', '', async () => ({ ...(await browser()), ...NATIVE })],
    ['the native header with a poll', '?poll=1', async () => ({ ...(await browser()), ...NATIVE })],
    ['the native header and view=full', '?view=full', async () => ({ ...(await browser()), ...NATIVE })],
    ['a token with no azp', '', async () => nativeToken()],
  ])('strips receipts, amounts, actions and account cards for %s, records no visit and answers no-store', async (_label, query, headers) => {
    const r = await call('GET', `/api/billing/summary${query}`, await headers());
    expect(r.status).toBe(200);
    expect(r.cache).toBe('no-store');
    expectStatusView(BillingSummarySchema.parse(r.body.data));
    expect(summaryViews()).toEqual([]);
    expect(store.events.filter((e) => e.name.startsWith('billing.'))).toEqual([]);
  });

  it('keeps the status view with NATIVE_MONEY_GUARD off (the switch turns off refusals only)', async () => {
    const r = await call('GET', '/api/billing/summary', { ...(await browser()), ...NATIVE }, undefined, env({ NATIVE_MONEY_GUARD: 'off' }));
    expectStatusView(BillingSummarySchema.parse(r.body.data));
    const token = await call('GET', '/api/billing/summary', await nativeToken(), undefined, env({ NATIVE_MONEY_GUARD: 'false' }));
    expectStatusView(BillingSummarySchema.parse(token.body.data));
  });

  it('answers no-store on a refusal too', async () => {
    const r = await call('GET', '/api/billing/summary', { 'content-type': 'application/json' });
    expect([r.status, r.cache]).toEqual([401, 'no-store']);
  });
});

/** Each money route, called as the owner would from the console's billing page. */
const MONEY: ReadonlyArray<readonly [string, string, string, () => unknown]> = [
  ['checkout', 'POST', '/api/entitlements/stripe/checkout', () => ({ planKey: 'group_license', subjectKind: 'space', subjectId: classId })],
  ['portal', 'POST', '/api/entitlements/stripe/portal', () => ({ subjectKind: 'space', subjectId: fam })],
  ['promo', 'POST', '/api/entitlements/stripe/promo', () => ({ code: 'HOYA20', planKey: 'family_lifetime' })],
  ['receipts', 'GET', '/api/billing/receipts?id=__FAM__', () => undefined],
  ['receipt link', 'POST', '/api/billing/receipt-link', () => ({ id: receiptId })],
];
let classId = '';
const pathOf = (path: string) => path.replace('__FAM__', encodeURIComponent(fam));

describe('the money routes refuse the native app (section 9.4)', () => {
  beforeEach(async () => {
    const r = await call('POST', '/api/spaces', await browser(), { kind: 'class', name: 'Room 1' });
    classId = (r.body.data as { space: { id: string } }).space.id;
    store.reset();
  });

  it.each(MONEY)('%s: 403 not_in_app for the native header, before Stripe and with nothing recorded', async (_label, method, path, body) => {
    const r = await call(method, pathOf(path), { ...(await browser()), ...NATIVE }, body());
    expect([r.status, r.body.error?.code]).toEqual([403, 'not_in_app']);
    expect(stripe).not.toHaveBeenCalled();
    expect(store.events).toEqual([]);
  });

  it.each(MONEY)('%s: 403 not_in_app for a token with no azp, before Stripe', async (_label, method, path, body) => {
    const r = await call(method, pathOf(path), await nativeToken(), body());
    expect([r.status, r.body.error?.code]).toEqual([403, 'not_in_app']);
    expect(stripe).not.toHaveBeenCalled();
    expect(store.events).toEqual([]);
  });

  it.each(MONEY)('%s: refused before step-up and before the live guard', async (_label, method, path, body) => {
    // A stale first factor would get the reverification hint, a live key 503 live_not_enabled: the guard answers first.
    const stale = await call(method, pathOf(path), { ...(await browser('user_mom', { fva: [99, -1] })), ...NATIVE }, body());
    expect([stale.status, stale.body.error?.code]).toEqual([403, 'not_in_app']);
    const live = await call(method, pathOf(path), await nativeToken(), body(), env({ STRIPE_SECRET_KEY: 'sk_live_x' }));
    expect([live.status, live.body.error?.code]).toEqual([403, 'not_in_app']);
    // With no bearer at all, the header alone is refused (no account row is made for it).
    const anonymous = await call(method, pathOf(path), { 'content-type': 'application/json', ...NATIVE }, body());
    expect([anonymous.status, anonymous.body.error?.code]).toEqual([403, 'not_in_app']);
    expect(stripe).not.toHaveBeenCalled();
  });

  it.each(MONEY)('%s: unchanged for a browser token', async (_label, method, path, body) => {
    const r = await call(method, pathOf(path), await browser(), body());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it.each(MONEY)('%s: NATIVE_MONEY_GUARD off lets a native request through to the route', async (_label, method, path, body) => {
    for (const off of ['false', '0', 'off', 'disabled', ' OFF ']) {
      const r = await call(method, pathOf(path), { ...(await browser()), ...NATIVE }, body(), env({ NATIVE_MONEY_GUARD: off }));
      expect(r.status, off).toBe(200);
      const token = await call(method, pathOf(path), await nativeToken(), body(), env({ NATIVE_MONEY_GUARD: off }));
      expect(token.status, off).toBe(200);
    }
  });

  it('any other NATIVE_MONEY_GUARD value keeps the refusals (a typo fails closed)', async () => {
    for (const on of ['', 'on', 'true', 'enabled', 'of', 'no']) {
      const r = await call('POST', '/api/entitlements/stripe/portal', { ...(await browser()), ...NATIVE }, { subjectKind: 'space', subjectId: fam }, env({ NATIVE_MONEY_GUARD: on }));
      expect([r.status, r.body.error?.code], on).toEqual([403, 'not_in_app']);
    }
  });

  it('reads the header in any case and inside a combined value; another value is not native', async () => {
    for (const value of ['native', 'Native', ' NATIVE ', 'web, native']) {
      const r = await call('POST', '/api/billing/receipt-link', { ...(await browser()), 'x-hr-client': value }, { id: receiptId });
      expect([r.status, r.body.error?.code], value).toEqual([403, 'not_in_app']);
    }
    for (const value of ['web', 'nativeapp', '']) {
      const r = await call('POST', '/api/billing/receipt-link', { ...(await browser()), 'x-hr-client': value }, { id: receiptId });
      expect(r.status, value).toBe(200);
    }
  });

  it('never guards the Stripe webhook', async () => {
    const r = await call('POST', '/api/entitlements/stripe/webhook', { ...NATIVE, 'stripe-signature': 't=1,v1=bad' }, { type: 'x' }, env({ STRIPE_WEBHOOK_SECRET: 'whsec_test' }));
    expect([r.status, r.body.error?.code]).toEqual([400, 'bad_signature']);
  });

  it('on the dev fallback (no Clerk key, no token to read) only the header counts', async () => {
    const devEnv = { ENVIRONMENT: 'test', STRIPE_SECRET_KEY: 'sk_test_x' };
    const dev = { 'content-type': 'application/json', authorization: 'Bearer mom' };
    const created = await call('POST', '/api/spaces', dev, { kind: 'family', name: 'Dev family' }, devEnv);
    const devFam = (created.body.data as { space: { id: string } }).space.id;
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(devFam)}`, dev, undefined, devEnv)).status).toBe(200);
    expect((await call('GET', `/api/billing/receipts?id=${encodeURIComponent(devFam)}`, { ...dev, ...NATIVE }, undefined, devEnv)).body.error?.code).toBe('not_in_app');
  });
});

describe('the account switch NATIVE_ACCOUNT (section 9.4)', () => {
  const READS = ['/api/spaces', '/api/spaces/__FAM__/roster', '/api/billing/summary', '/api/billing/summary?view=status', '/api/entitlements', '/api/entitlements/browse'];

  it.each(READS)('off: %s answers 403 native_off to the native header only', async (path) => {
    for (const off of ['disabled', 'off', 'false', '0', 'typo']) {
      const r = await call('GET', pathOf(path), { ...(await browser()), ...NATIVE }, undefined, env({ NATIVE_ACCOUNT: off }));
      expect([r.status, r.body.error?.code], off).toEqual([403, 'native_off']);
      const web = await call('GET', pathOf(path), await browser(), undefined, env({ NATIVE_ACCOUNT: off }));
      expect(web.status, off).toBe(200);
    }
  });

  it('off: writes refuse the native header too, before any route runs', async () => {
    const r = await call('POST', '/api/spaces', { ...(await browser()), ...NATIVE }, { kind: 'family', name: 'Second' }, env({ NATIVE_ACCOUNT: 'disabled' }));
    expect([r.status, r.body.error?.code]).toEqual([403, 'native_off']);
    expect(await db.spacesOwnedBy('user_mom')).toHaveLength(1);
    const code = await call('POST', pathOf('/api/spaces/__FAM__/code'), { ...(await browser()), ...NATIVE }, undefined, env({ NATIVE_ACCOUNT: 'disabled' }));
    expect([code.status, code.body.error?.code]).toEqual([403, 'native_off']);
  });

  it.each(['', 'enabled', 'on', 'true', '1', ' Enabled '])('on (%j): the native header reads the account routes', async (on) => {
    const r = await call('GET', '/api/spaces', { ...(await nativeToken()), ...NATIVE }, undefined, env({ NATIVE_ACCOUNT: on }));
    expect(r.status).toBe(200);
  });

  it('leaves learner routes alone, whatever it says', async () => {
    const r = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json', ...NATIVE }, body: JSON.stringify({ name: 'who.picked', payload: { kind: 'add' } }) }, env({ NATIVE_ACCOUNT: 'disabled' }));
    expect(r.status).toBe(201);
    const content = await app.request('/api/config', { headers: NATIVE }, env({ NATIVE_ACCOUNT: 'disabled' }));
    expect(content.status).not.toBe(403);
  });
});

describe('native tokens on the account routes (sections 9.4 and 11, assumption U2)', () => {
  it('a token with no azp reads GET /api/spaces, which answers no-store', async () => {
    const r = await call('GET', '/api/spaces', await nativeToken());
    expect(r.status).toBe(200);
    expect(r.cache).toBe('no-store');
    expect(JSON.stringify(r.body.data)).toContain(fam);
  });

  it('GET /api/spaces answers no-store for a browser too, as /api/spaces/* always did', async () => {
    const list = await call('GET', '/api/spaces', await browser());
    expect([list.status, list.cache]).toEqual([200, 'no-store']);
    const roster = await call('GET', pathOf('/api/spaces/__FAM__/roster'), { ...(await nativeToken()), ...NATIVE });
    expect([roster.status, roster.cache]).toEqual([200, 'no-store']);
  });

  it('an azp-less token signed by another key is still refused (401)', async () => {
    const other = await clerkTestKeys();
    const r = await call('GET', '/api/spaces', { authorization: `Bearer ${await other.token('user_mom', {})}` });
    expect(r.status).toBe(401);
  });
});
