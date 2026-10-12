import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { entitlementFromStripeEvent, mergeForStripeEvent, signStripePayload, type StripeEventLike } from '../lib/stripe';
import { setStripeFetchForTests } from '../routes/entitlements';
import { clerkTestKeys, type ClerkTestKeys } from './helpers/clerk-token';
import { testDb as db } from './helpers/db';
import { PROMO_LIMIT, promoLimiter } from '../routes/entitlements';
import { store } from '../store';

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env?: Record<string, string>) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}
async function createSpace(user: string, kind: string, name: string) {
  const r = await call('POST', '/api/spaces', bearer(user), { kind, name });
  return (r.body.data as { space: { id: string }; joinCode: string | null }).space.id;
}
const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_GROUP_LICENSE_YEARLY: 'price_gl', CONSOLE_URL: 'https://hangulroute.com/' };

/** Stripe answers nothing by default: subscription re-reads fall back to the event (BY-D5), and no test reaches the network. */
const stripeDown = (): typeof fetch => vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}', { status: 503 }));

beforeEach(async () => {
  await db.reset();
  setStripeFetchForTests(stripeDown());
  promoLimiter.reset();
});

const PROMO = { id: 'promo_1', code: 'hoya20', active: true, expires_at: null, max_redemptions: null, times_redeemed: 0, coupon: { id: 'c1', name: 'Launch', percent_off: 20, amount_off: null, currency: null, duration: 'once', valid: true } };
const promoResponse = (rows: unknown[]) => new Response(JSON.stringify({ data: rows }), { status: 200 });

describe('entitlements (F-ENT-001 §3.3)', () => {
  it('lists mine and my spaces’, and rejects anonymous callers', async () => {
    await createSpace('mom', 'family', 'Kim family');
    expect((await call('GET', '/api/entitlements', json)).status).toBe(401);
    expect(((await call('GET', '/api/entitlements', bearer('mom'))).body.data as { entitlements: unknown[] }).entitlements).toEqual([]);
  });

  it('never grants from a receipt: /verify is 501 until real store verification exists (SEC-1)', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    // The shape the old dev stub accepted as proof of a lifetime purchase.
    const forged = JSON.stringify({ plan: 'yearly', expiresAt: '2099-01-01T00:00:00.000Z' });
    for (const [user, body] of [
      ['mom', { spaceId: fam, store: 'apple', receipt: forged }],
      ['mom', { spaceId: fam, store: 'google', receipt: forged }],
      ['dad', { spaceId: fam, store: 'apple', receipt: forged }],
      ['mom', { spaceId: fam, store: 'apple', receipt: 'garbage' }],
    ] as const) {
      const r = await call('POST', '/api/entitlements/verify', bearer(user), body);
      expect(r.status).toBe(501);
      expect(r.body).toMatchObject({ ok: false, error: { code: 'receipt_verification_not_configured', message: 'receipt verification not configured' } });
    }
    expect((await call('POST', '/api/entitlements/verify', json, { spaceId: fam, store: 'apple', receipt: forged })).status).toBe(501);
    const mine = (await call('GET', '/api/entitlements', bearer('mom'))).body.data as { entitlements: unknown[] };
    expect(mine.entitlements).toEqual([]);
    expect(await db.entitlementsFor('space', fam)).toEqual([]);
  });

  it('checkout enforces who may buy what and needs Stripe configuration', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const sch = await createSpace('principal', 'school', 'School');
    const cls = await createSpace('teacher', 'class', 'A');
    const inSchool = (await call('POST', '/api/spaces', bearer('principal'), { kind: 'class', name: 'B', parentSpaceId: sch })).body.data as { space: { id: string } };
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('teacher'), { planKey: 'group_license', subjectKind: 'account', subjectId: 'teacher' })).status).toBe(422); // plans attach to spaces
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('dad'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam })).status).toBe(403);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'group_license', subjectKind: 'space', subjectId: fam })).status).toBe(422);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('teacher'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: cls })).status).toBe(422);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'school_seat', subjectKind: 'space', subjectId: sch })).status).toBe(422);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('principal'), { planKey: 'group_license', subjectKind: 'space', subjectId: inSchool.space.id })).status).toBe(422); // covered by the school
    const unconfigured = await call('POST', '/api/entitlements/stripe/checkout', bearer('teacher'), { planKey: 'group_license', subjectKind: 'space', subjectId: cls });
    expect(unconfigured.body.error?.code).toBe('stripe_not_configured');
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).body.error?.code).toBe('stripe_not_configured'); // no Family Plan price bound
    // The old one-off price variable is ignored (BY-D3).
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_LIFETIME: 'price_fl' })).body.error?.code).toBe('stripe_not_configured');

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/1' }), { status: 200 }));
    setStripeFetchForTests(fetchImpl);
    const session = await call('POST', '/api/entitlements/stripe/checkout', bearer('teacher'), { planKey: 'group_license', subjectKind: 'space', subjectId: cls }, STRIPE_ENV);
    expect(session.body.data).toEqual({ url: 'https://checkout.stripe.com/c/1' });
    const posted = String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body);
    expect(posted).toContain('line_items%5B0%5D%5Bprice%5D=price_gl');
    expect(posted).toContain('mode=subscription');
    expect(posted).toContain('success_url=https%3A%2F%2Fhangulroute.com%2Fteach%2Fbilling%3Fcheckout%3Dsuccess');
    const once = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/2' }), { status: 200 }));
    setStripeFetchForTests(once);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' })).body.data).toEqual({ url: 'https://checkout.stripe.com/c/2' });
    // The Family Plan renews yearly: a subscription on the yearly price, its subject on the subscription too.
    const familyPosted = String((once.mock.calls[0]?.[1] as RequestInit).body);
    expect(familyPosted).toContain('mode=subscription');
    expect(familyPosted).toContain('line_items%5B0%5D%5Bprice%5D=price_fy');
    expect(familyPosted).toContain(`subscription_data%5Bmetadata%5D%5BsubjectId%5D=${encodeURIComponent(fam)}`);
    expect(familyPosted).toContain('subscription_data%5Bmetadata%5D%5BplanKey%5D=family_lifetime');
    expect(familyPosted).not.toContain('customer_creation');
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 500 })));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('principal'), { planKey: 'group_license', subjectKind: 'space', subjectId: sch }, STRIPE_ENV)).body.error?.code).toBe('stripe_error');
  });

  it('checks promotion codes against Stripe and applies them at checkout (F-ENT-002)', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const env = { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' };
    expect((await call('POST', '/api/entitlements/stripe/promo', json, { code: 'HOYA20', planKey: 'family_lifetime' })).status).toBe(401);
    expect((await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: '!', planKey: 'family_lifetime' })).body.error?.code).toBe('promo_invalid');
    expect((await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'HOYA20', planKey: 'family_lifetime' })).body.error?.code).toBe('stripe_not_configured');

    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([PROMO])).mockResolvedValueOnce(promoResponse([])));
    const checked = await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: ' hoya 20 ', planKey: 'family_lifetime' }, env);
    expect(checked.status).toBe(200);
    expect(checked.body.data).toEqual({ promo: { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' }, price: { planKey: 'family_lifetime', listUsd: 15.3, discountedUsd: 12.24 } });
    expect((await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'NOPE', planKey: 'group_license' }, env)).status).toBe(404);

    // checkout re-validates: a bad code never reaches Stripe, a good one becomes discounts[0]
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([])));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam, promoCode: 'STALE' }, env)).body.error?.code).toBe('promo_invalid');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([PROMO])).mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/9' }), { status: 200 }));
    setStripeFetchForTests(fetchImpl);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam, promoCode: 'hoya20' }, env)).body.data).toEqual({ url: 'https://checkout.stripe.com/c/9' });
    const posted = String((fetchImpl.mock.calls[1]?.[1] as RequestInit).body);
    expect(posted).toContain('discounts%5B0%5D%5Bpromotion_code%5D=promo_1');
    expect(posted).toContain('metadata%5BpromoCode%5D=HOYA20');
    expect(posted).not.toContain('allow_promotion_codes');

    // the webhook keeps the code on the entitlement for attribution
    const ts = Math.floor(Date.now() / 1000);
    const event = JSON.stringify({ id: 'evt_p', type: 'checkout.session.completed', data: { object: { id: 'cs_9', mode: 'subscription', subscription: 'sub_9', customer: 'cus_9', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', promoCode: 'HOYA20' } } } });
    const applied = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', event, ts) }, event, env);
    expect(applied.body.data).toMatchObject({ applied: true, entitlement: { planKey: 'family_lifetime', promoCode: 'HOYA20', providerRef: 'sub_9', expiresAt: null } });

    // guessing is rate-limited per client
    setStripeFetchForTests(vi.fn<typeof fetch>().mockImplementation(async () => promoResponse([])));
    for (let i = 0; i < PROMO_LIMIT - 3; i += 1) await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: `GUESS${i}`, planKey: 'family_lifetime' }, env);
    const limited = await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'GUESSX', planKey: 'family_lifetime' }, env);
    expect(limited.status).toBe(429);
    expect(limited.body.error?.code).toBe('too_many_attempts');
  });

  it('webhooks verify the signature and drive the tier that learners receive; the portal needs a Stripe customer', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const code = ((await db.getSpace(cls)) as { joinCode: string }).joinCode;
    const reg = (await call('POST', '/api/sync/learners', json, { deviceId: 'device-suni0001', learner: { displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
    const auth = { ...json, authorization: `Device device-suni0001:${reg.device.secret}` };
    await call('POST', `/api/spaces/${cls}/join`, auth, { code, learnerId: reg.learner.id });
    const inboxBefore = (await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string; tierSource: unknown; tierValidUntil: string | null };
    expect(inboxBefore).toMatchObject({ tier: 'free', tierSource: null, tierValidUntil: null });

    const event = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.created', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'trialing', current_period_end: 4_102_444_800, metadata: { subjectKind: 'space', subjectId: cls, planKey: 'group_license' } } } });
    expect((await call('POST', '/api/entitlements/stripe/webhook', json, event)).body.error?.code).toBe('stripe_not_configured');
    expect((await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': 't=1,v1=bad' }, event, STRIPE_ENV)).status).toBe(400);
    const ts = Math.floor(Date.now() / 1000);
    const good = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', event, ts) }, event, STRIPE_ENV);
    expect(good.status).toBe(200);
    expect(good.body.data).toMatchObject({ applied: true, entitlement: { subjectId: cls, planKey: 'group_license', status: 'trial', customerRef: 'cus_1', expiresAt: '2100-01-01T00:00:00.000Z' } });

    const inboxAfter = (await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string; tierSource: { name: string }; tierValidUntil: string | null };
    expect(inboxAfter).toMatchObject({ tier: 'premium', tierSource: { kind: 'class', spaceId: cls, name: 'A' } });
    expect(Date.parse(inboxAfter.tierValidUntil ?? '') - Date.now()).toBeGreaterThan(6 * 86_400_000);
    expect((await call('POST', '/api/spaces/lookup', json, { code })).body.data).toMatchObject({ full: false });
    for (let i = 0; i < 25; i += 1) await db.addMembership({ spaceId: cls, memberKind: 'learner', memberId: `profile:s${i}`, role: 'student', joinedAt: 't' });
    expect((await call('POST', '/api/spaces/lookup', json, { code })).body.data).toMatchObject({ full: false }); // pro class: no cap

    const ignored = JSON.stringify({ id: 'evt_2', type: 'invoice.paid', data: { object: { metadata: {} } } });
    expect((await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', ignored, ts) }, ignored, STRIPE_ENV)).body.data).toEqual({ received: true, applied: false });
    const notJson = 'nope';
    expect((await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', notJson, ts) }, notJson, STRIPE_ENV)).status).toBe(400);

    const deleted = JSON.stringify({ id: 'evt_3', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', metadata: { subjectKind: 'space', subjectId: cls, planKey: 'group_license' } } } });
    await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', deleted, ts) }, deleted, STRIPE_ENV);
    expect(((await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string }).tier).toBe('free');

    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/1' }), { status: 200 })));
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('teacher'), { subjectKind: 'space', subjectId: cls }, STRIPE_ENV)).body.data).toEqual({ url: 'https://billing.stripe.com/p/1' }); // customerRef survived the deletion event
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('teacher'), {}, STRIPE_ENV)).status).toBe(404); // nothing on the account itself
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('stranger'), { subjectKind: 'space', subjectId: cls }, STRIPE_ENV)).status).toBe(403);
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('teacher'), { subjectKind: 'account', subjectId: 'other' }, STRIPE_ENV)).status).toBe(403);
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('teacher'), { subjectKind: 'space', subjectId: cls })).body.error?.code).toBe('stripe_not_configured');
    const fam = await createSpace('mom', 'family', 'Kim family');
    await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_fam', providerRef: 'pi_1' }, new Date());
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).status).toBe(404); // a legacy one-time row has nothing to manage (BY-D2)
  });

  it('the Family Plan renews yearly: period end from Stripe, cancel keeps it to the end, deletion ends it; the portal manages it (BY-D5, BY-D6)', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const reg = (await call('POST', '/api/sync/learners', json, { deviceId: 'device-mina0001', learner: { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
    const auth = { ...json, authorization: `Device device-mina0001:${reg.device.secret}` };
    // A family has no join code until the grown-up makes one; the membership is what matters here.
    await db.addMembership({ spaceId: fam, memberKind: 'learner', memberId: reg.learner.id, role: 'student', joinedAt: new Date().toISOString() });
    const tier = async (): Promise<string> => ((await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string }).tier;
    const ts = Math.floor(Date.now() / 1000);
    const send = async (type: string, object: Record<string, unknown>) => {
      const event = JSON.stringify({ id: `evt_${type}`, type, data: { object: { customer: 'cus_fam', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime' }, ...object } } });
      return (await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', event, ts) }, event, STRIPE_ENV)).body.data as { entitlement: Record<string, unknown> };
    };
    expect(await tier()).toBe('free');

    // Stripe may send the subscription before the checkout completion; the completion must not erase the end.
    const yearEnd = ts + 365 * 86_400;
    const created = await send('customer.subscription.created', { id: 'sub_fam', status: 'active', items: { data: [{ current_period_end: yearEnd }] } });
    expect(created.entitlement).toMatchObject({ status: 'active', providerRef: 'sub_fam', expiresAt: new Date(yearEnd * 1000).toISOString() });
    const completed = await send('checkout.session.completed', { id: 'cs_fam', mode: 'subscription', subscription: 'sub_fam' });
    expect(completed.entitlement).toMatchObject({ status: 'active', providerRef: 'sub_fam', expiresAt: new Date(yearEnd * 1000).toISOString() });
    expect(await tier()).toBe('premium');

    // Cancelled in the portal: covered until the end of the paid year.
    const cancelled = await send('customer.subscription.updated', { id: 'sub_fam', status: 'active', cancel_at_period_end: true, items: { data: [{ current_period_end: yearEnd }] } });
    expect(cancelled.entitlement).toMatchObject({ status: 'cancelled', expiresAt: new Date(yearEnd * 1000).toISOString() });
    expect(await tier()).toBe('premium');

    // The family manages it in the portal like a licence.
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/fam' }), { status: 200 })));
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).body.data).toEqual({ url: 'https://billing.stripe.com/p/fam' });

    // A renewal moves the end forward one year.
    const nextEnd = yearEnd + 365 * 86_400;
    const renewed = await send('customer.subscription.updated', { id: 'sub_fam', status: 'active', cancel_at_period_end: false, current_period_end: nextEnd });
    expect(renewed.entitlement).toMatchObject({ status: 'active', expiresAt: new Date(nextEnd * 1000).toISOString() });

    // The year ran out after a cancel: the plan ends, nothing earned is touched here.
    await send('customer.subscription.deleted', { id: 'sub_fam', status: 'canceled', current_period_end: nextEnd });
    expect(await tier()).toBe('free');
  });

  it('a family row from the old one-time sandbox checkout still covers its learners (BY-D2)', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const reg = (await call('POST', '/api/sync/learners', json, { deviceId: 'device-mina0002', learner: { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
    const auth = { ...json, authorization: `Device device-mina0002:${reg.device.secret}` };
    await db.addMembership({ spaceId: fam, memberKind: 'learner', memberId: reg.learner.id, role: 'student', joinedAt: new Date().toISOString() });
    await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_old', providerRef: 'pi_old', expiresAt: null }, new Date());
    expect(((await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string }).tier).toBe('premium');
  });
  describe('the Family Plan subscription under real delivery (BY-D4, BY-D5)', () => {
    const iso = (sec: number): string => new Date(sec * 1000).toISOString();
    const NOW_SEC = Math.floor(Date.now() / 1000);
    const END = NOW_SEC + 365 * 86_400;

    async function familyWithLearner(device: string): Promise<{ fam: string; tier: () => Promise<string> }> {
      const fam = await createSpace('mom', 'family', 'Kim family');
      const reg = (await call('POST', '/api/sync/learners', json, { deviceId: device, learner: { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
      const auth = { ...json, authorization: `Device ${device}:${reg.device.secret}` };
      await db.addMembership({ spaceId: fam, memberKind: 'learner', memberId: reg.learner.id, role: 'student', joinedAt: new Date().toISOString() });
      return { fam, tier: async () => ((await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string }).tier };
    }
    const event = (fam: string, type: string, object: Record<string, unknown>): StripeEventLike => ({ type, data: { object: { customer: 'cus_fam', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime' }, ...object } } });
    async function send(e: StripeEventLike): Promise<Record<string, unknown>> {
      const body = JSON.stringify({ id: `evt_${Math.random()}`, ...e });
      const r = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', body, NOW_SEC) }, body, STRIPE_ENV);
      expect(r.status).toBe(200);
      return (r.body.data as { entitlement: Record<string, unknown> }).entitlement;
    }
    const row = async (fam: string) => (await db.entitlementsFor('space', fam)).find((e) => e.planKey === 'family_lifetime');

    it('concurrent subscription.created and checkout completion keep the period end, in either order', async () => {
      for (const createdFirst of [true, false]) {
        await db.reset();
        const fam = 'space:fam-race';
        const created = event(fam, 'customer.subscription.created', { id: 'sub_fam', status: 'active', items: { data: [{ current_period_end: END }] } });
        const completed = event(fam, 'checkout.session.completed', { id: 'cs_fam', mode: 'subscription', subscription: 'sub_fam' });
        const apply = (e: StripeEventLike) => db.applyEntitlement(entitlementFromStripeEvent(e) as NonNullable<ReturnType<typeof entitlementFromStripeEvent>>, new Date(), mergeForStripeEvent(e));
        // Both writes start before either finishes: each reads "no row yet" (a Worker handling both at once).
        await Promise.all(createdFirst ? [apply(created), apply(completed)] : [apply(completed), apply(created)]);
        expect(await row(fam)).toMatchObject({ status: 'active', providerRef: 'sub_fam', customerRef: 'cus_fam', expiresAt: iso(END) });
      }
    });

    it('a completion delivered after a cancel keeps the cancel and its end', async () => {
      const { fam, tier } = await familyWithLearner('device-race0001');
      await send(event(fam, 'customer.subscription.created', { id: 'sub_fam', status: 'active', current_period_end: END }));
      await send(event(fam, 'customer.subscription.updated', { id: 'sub_fam', status: 'active', cancel_at_period_end: true, current_period_end: END }));
      const late = await send(event(fam, 'checkout.session.completed', { id: 'cs_fam', mode: 'subscription', subscription: 'sub_fam', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', promoCode: 'HOYA20' } }));
      expect(late).toMatchObject({ status: 'cancelled', expiresAt: iso(END), providerRef: 'sub_fam', promoCode: 'HOYA20' });
      expect(await tier()).toBe('premium');
    });

    it('a plan bought again after it lapsed covers at once, then takes the new period end', async () => {
      const { fam, tier } = await familyWithLearner('device-again001');
      await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'expired', provider: 'stripe', providerRef: 'sub_old', customerRef: 'cus_fam', expiresAt: iso(NOW_SEC - 86_400) }, new Date());
      expect(await tier()).toBe('free');
      const completed = await send(event(fam, 'checkout.session.completed', { id: 'cs_new', mode: 'subscription', subscription: 'sub_new' }));
      expect(completed).toMatchObject({ status: 'active', providerRef: 'sub_new', expiresAt: null });
      expect(await tier()).toBe('premium');
      expect(await send(event(fam, 'customer.subscription.created', { id: 'sub_new', status: 'active', current_period_end: END }))).toMatchObject({ status: 'active', providerRef: 'sub_new', expiresAt: iso(END) });
      expect(await tier()).toBe('premium');
    });

    it('an event for another subscription never ends a row that still covers the family', async () => {
      const { fam, tier } = await familyWithLearner('device-dupe0001');
      await send(event(fam, 'customer.subscription.created', { id: 'sub_a', status: 'active', current_period_end: END }));
      // A second subscription (two tabs paid before either landed) takes the row while it covers.
      expect(await send(event(fam, 'customer.subscription.created', { id: 'sub_b', status: 'active', current_period_end: END + 60 }))).toMatchObject({ providerRef: 'sub_b', expiresAt: iso(END + 60) });
      // The owner cancels the duplicate: its deletion leaves the row with the other subscription.
      expect(await send(event(fam, 'customer.subscription.deleted', { id: 'sub_a', status: 'canceled', current_period_end: END }))).toMatchObject({ providerRef: 'sub_b', status: 'active' });
      await send(event(fam, 'customer.subscription.updated', { id: 'sub_c', status: 'unpaid', current_period_end: END }));
      expect(await row(fam)).toMatchObject({ providerRef: 'sub_b', status: 'active', expiresAt: iso(END + 60) });
      expect(await tier()).toBe('premium');
      // The row's own subscription still ends it.
      await send(event(fam, 'customer.subscription.deleted', { id: 'sub_b', status: 'canceled' }));
      expect(await tier()).toBe('free');
      // Once nothing covers, another subscription's events apply again.
      expect(await send(event(fam, 'customer.subscription.updated', { id: 'sub_a', status: 'past_due', current_period_end: END }))).toMatchObject({ providerRef: 'sub_a', status: 'past_due' });
    });

    it('checkout answers 409 already_active while a subscription covers the space, and reuses the customer after it lapsed', async () => {
      const fam = await createSpace('mom', 'family', 'Kim family');
      const env = { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' };
      const body = { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam };
      await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'cancelled', provider: 'stripe', providerRef: 'sub_old', customerRef: 'cus_fam', expiresAt: iso(END) }, new Date());
      const never = vi.fn<typeof fetch>();
      setStripeFetchForTests(never);
      const refused = await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), body, env);
      expect(refused.status).toBe(409);
      expect(refused.body.error?.code).toBe('already_active');
      expect(never).not.toHaveBeenCalled();

      // The year ran out: buying again is allowed, on the same Stripe customer.
      await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'expired', provider: 'stripe', providerRef: 'sub_old', expiresAt: iso(NOW_SEC - 60) }, new Date());
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/again' }), { status: 200 }));
      setStripeFetchForTests(fetchImpl);
      expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), body, env)).body.data).toEqual({ url: 'https://checkout.stripe.com/c/again' });
      const posted = String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body);
      expect(posted).toContain('customer=cus_fam');
      expect(posted).not.toContain('customer_email');
      expect(posted).toContain('payment_method_collection=always');
    });

    it('a legacy one-time row does not block moving to the yearly plan', async () => {
      const fam = await createSpace('mom', 'family', 'Kim family');
      await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'pi_old', customerRef: null, expiresAt: null }, new Date());
      setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/move' }), { status: 200 })));
      expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' })).body.data).toEqual({ url: 'https://checkout.stripe.com/c/move' });
    });

    it('maps the subscription Stripe holds now, not a stale event; a failed read maps the event', async () => {
      const { fam, tier } = await familyWithLearner('device-order001');
      await send(event(fam, 'customer.subscription.created', { id: 'sub_fam', status: 'active', current_period_end: END }));
      // The cancel event arrives late, after the payer already undid it in the portal.
      const staleCancel = event(fam, 'customer.subscription.updated', { id: 'sub_fam', status: 'active', cancel_at_period_end: true, current_period_end: END });
      const now = { id: 'sub_fam', status: 'active', cancel_at_period_end: false, customer: 'cus_fam', current_period_end: END, metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime' } };
      setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(now), { status: 200 })));
      expect(await send(staleCancel)).toMatchObject({ status: 'active', expiresAt: iso(END) });
      // Stripe unreachable: the event's own copy is used.
      setStripeFetchForTests(stripeDown());
      expect(await send(staleCancel)).toMatchObject({ status: 'cancelled', expiresAt: iso(END) });
      expect(await tier()).toBe('premium');
    });
  });
});

describe('webhook history (F-BILL-002 B-3, section 5.4)', () => {
  const NOW_SEC = Math.floor(Date.now() / 1000);
  const END = NOW_SEC + 365 * 86_400;
  const FAMILY = (fam: string) => ({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime' });
  /** Stripe's invoice_payments answers each invoice with its own payment intent, `pi_<invoice id>`. */
  const invoiceStripe = (): typeof fetch =>
    vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const u = new URL(String(url));
      const invoice = u.searchParams.get('invoice');
      return u.pathname === '/v1/invoice_payments' && invoice
        ? new Response(JSON.stringify({ data: [{ status: 'paid', invoice, payment: { type: 'payment_intent', payment_intent: `pi_${invoice}` } }] }), { status: 200 })
        : new Response('{}', { status: 503 });
    });

  async function send(type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<{ status: number; data: Record<string, unknown>; code?: string }> {
    const body = JSON.stringify({ id: `evt_${Math.random()}`, type, created: NOW_SEC, livemode: false, data: { object }, ...extra });
    const r = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', body, NOW_SEC) }, body, STRIPE_ENV);
    return { status: r.status, data: r.body.data ?? {}, ...(r.body.error ? { code: r.body.error.code } : {}) };
  }
  const billingEvents = () => store.events.filter((e) => e.name.startsWith('billing.'));

  async function familyWithLearner(device: string): Promise<{ fam: string; learnerId: string; tier: () => Promise<string> }> {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const reg = (await call('POST', '/api/sync/learners', json, { deviceId: device, learner: { displayName: 'Mina', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
    const auth = { ...json, authorization: `Device ${device}:${reg.device.secret}` };
    await db.addMembership({ spaceId: fam, memberKind: 'learner', memberId: reg.learner.id, role: 'student', joinedAt: new Date().toISOString() });
    return { fam, learnerId: reg.learner.id, tier: async () => ((await call('GET', `/api/sync/learners/${reg.learner.id}/inbox`, auth)).body.data as { tier: string }).tier };
  }

  beforeEach(() => {
    store.reset();
  });

  it('records invoice.paid as the payment, then a renewal; a retried delivery keeps one row', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    setStripeFetchForTests(invoiceStripe());
    const first = { id: 'in_first', billing_reason: 'subscription_create', amount_paid: 1530, currency: 'usd', status_transitions: { paid_at: NOW_SEC }, parent: { subscription_details: { subscription: 'sub_fam', metadata: FAMILY(fam) } } };
    const paid = await send('invoice.paid', first);
    expect(paid).toEqual({ status: 200, data: { received: true, applied: true, recorded: true } });
    expect(await send('invoice.paid', first)).toEqual({ status: 200, data: { received: true, applied: true, recorded: true } });
    await send('invoice.paid', { ...first, id: 'in_second', billing_reason: 'subscription_cycle' });
    const rows = await db.billingEventsFor('space', fam, 10);
    expect(rows.map((e) => [e.kind, e.providerRef, e.paymentRef, e.amountCents, e.livemode]).sort()).toEqual([
      ['purchase', 'in_first', 'pi_in_first', 1530, false],
      ['renewal', 'in_second', 'pi_in_second', 1530, false],
    ]);
    // Nothing a payment records reaches the entitlement table.
    expect(await db.entitlementsFor('space', fam)).toEqual([]);
    expect(billingEvents()).toEqual([]);
  });

  it('acknowledges an event it cannot attach to a space with applied: false and records nowhere', async () => {
    expect((await send('invoice.paid', { id: 'in_x', amount_paid: 1530, currency: 'usd', subscription: 'sub_unknown' })).data).toEqual({ received: true, applied: false });
    setStripeFetchForTests(vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    expect((await send('charge.refunded', { id: 'ch_x', amount: 1530, amount_refunded: 1530, refunded: true, currency: 'usd', payment_intent: 'pi_unknown' })).data).toEqual({ received: true, applied: false });
    expect(billingEvents()).toEqual([]);
  });

  it('answers 503 so Stripe retries a refund whose invoice lookup could not be made', async () => {
    const r = await send('charge.refunded', { id: 'ch_y', amount: 1530, amount_refunded: 1530, refunded: true, currency: 'usd', payment_intent: 'pi_later' });
    expect(r.status).toBe(503);
    expect(r.code).toBe('stripe_unavailable');
    expect(billingEvents()).toEqual([]);
  });

  it('answers 503 so Stripe retries a refund delivered before the invoice.paid it refunds, then records it', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    setStripeFetchForTests(invoiceStripe());
    const refund = { id: 'ch_z', amount: 1530, amount_refunded: 1530, refunded: true, currency: 'usd', payment_intent: null, invoice: 'in_z' };
    const early = await send('charge.refunded', refund);
    expect([early.status, early.code]).toEqual([503, 'payment_not_recorded']);
    await send('invoice.paid', { id: 'in_z', billing_reason: 'subscription_create', amount_paid: 1530, currency: 'usd', parent: { subscription_details: { subscription: 'sub_z', metadata: FAMILY(fam) } } });
    expect((await send('charge.refunded', refund)).data).toEqual({ received: true, applied: true, recorded: true });
    expect(await db.billingEventByRef('stripe', 'ch_z:refund:1530', 'refund')).toMatchObject({ subjectId: fam, amountCents: 1530, paymentRef: 'pi_in_z' });
  });

  it('records a failed payment and sends billing.payment_failed once, with codes only', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const failed = { id: 'in_f', billing_reason: 'subscription_cycle', amount_due: 1530, amount_paid: 0, currency: 'usd', subscription: 'sub_fam', subscription_details: { metadata: FAMILY(fam) } };
    expect((await send('invoice.payment_failed', failed)).data).toEqual({ received: true, applied: true, recorded: true });
    await send('invoice.payment_failed', failed);
    expect(await db.billingEventByRef('stripe', 'in_f', 'failed')).toMatchObject({ amountCents: 1530, kind: 'failed' });
    expect(billingEvents().map((e) => [e.name, e.payload, e.profileId])).toEqual([['billing.payment_failed', { planKey: 'family_lifetime', mode: 'test' }, undefined]]);
  });

  it('a refund is recorded and changes nothing; an immediate cancel then ends the plan and keeps progress (OD-6 revised, BY-D8)', async () => {
    const { fam, learnerId, tier } = await familyWithLearner('device-refund01');
    const progress = { learnerId, rev: 1, schemaVer: 1, contentVer: '2026.10', deviceId: 'device-refund01', summary: { streakDays: 3 }, payload: { quests: [{ questId: 'quest:a', stars: 3 }], cards: ['card:hanbok'] }, updatedAt: new Date().toISOString() };
    expect(await db.putSnapshot(progress, 0)).toBe(true);
    const meta = { customer: 'cus_fam', metadata: FAMILY(fam) };
    await send('customer.subscription.created', { id: 'sub_fam', status: 'active', current_period_end: END, ...meta });
    setStripeFetchForTests(invoiceStripe());
    await send('invoice.paid', { id: 'in_fam', billing_reason: 'subscription_create', amount_paid: 1530, currency: 'usd', status_transitions: { paid_at: NOW_SEC }, parent: { subscription_details: { subscription: 'sub_fam', metadata: FAMILY(fam) } } });
    const before = await db.entitlementsFor('space', fam);
    expect(await tier()).toBe('premium');

    const refund = await send('charge.refunded', { id: 'ch_fam', amount: 1530, amount_refunded: 1530, refunded: true, currency: 'usd', payment_intent: 'pi_in_fam' });
    expect(refund.data).toEqual({ received: true, applied: true, recorded: true });
    expect(await db.billingEventByRef('stripe', 'ch_fam:refund:1530', 'refund')).toMatchObject({ amountCents: 1530, subjectId: fam, planKey: 'family_lifetime' });
    expect(await db.entitlementsFor('space', fam)).toEqual(before);
    expect(await tier()).toBe('premium');
    expect(billingEvents().map((e) => [e.name, e.payload])).toEqual([['billing.refund_recorded', { planKey: 'family_lifetime', full: true, mode: 'test' }]]);

    // The owner cancels the refunded subscription immediately in the Stripe dashboard.
    expect((await send('customer.subscription.deleted', { id: 'sub_fam', status: 'canceled', current_period_end: END, ...meta })).data).toMatchObject({ applied: true, entitlement: { status: 'expired' } });
    expect(await tier()).toBe('free');
    expect(await db.getSnapshot(learnerId)).toEqual(progress);
    // A retried refund delivery records nothing new and sends nothing again.
    await send('charge.refunded', { id: 'ch_fam', amount: 1530, amount_refunded: 1530, refunded: true, currency: 'usd', payment_intent: 'pi_in_fam' });
    expect((await db.billingEventsFor('space', fam, 10)).filter((e) => e.kind === 'refund')).toHaveLength(1);
    expect(billingEvents()).toHaveLength(1);
  });

  it('runbook Step 8, duplicate subscriptions: cancelling the one the row carries ends cover, and resending the other one\'s event restores it', async () => {
    const { fam, tier } = await familyWithLearner('device-dupe0002');
    const meta = { customer: 'cus_fam', metadata: FAMILY(fam) };
    const subA = { id: 'sub_a', status: 'active', current_period_end: END, ...meta };
    await send('customer.subscription.created', subA);
    await send('customer.subscription.created', { id: 'sub_b', status: 'active', current_period_end: END + 60, ...meta });
    // The owner refunds and cancels the newer one immediately; the single row carried it.
    await send('customer.subscription.deleted', { id: 'sub_b', status: 'canceled', current_period_end: END + 60, ...meta });
    expect(await tier()).toBe('free');
    // Resend the remaining subscription's latest event from the Stripe dashboard.
    expect((await send('customer.subscription.created', subA)).data).toMatchObject({ applied: true, entitlement: { providerRef: 'sub_a', status: 'active' } });
    expect(await tier()).toBe('premium');
  });

  it('sends billing.checkout_completed on every applied completion, flagging a second paid subscription as a duplicate', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const completion = (sub: string) => ({ id: `cs_${sub}`, mode: 'subscription', subscription: sub, customer: 'cus_fam', amount_total: 1530, currency: 'usd', metadata: FAMILY(fam) });
    expect((await send('checkout.session.completed', completion('sub_a'))).data).toMatchObject({ received: true, applied: true, entitlement: { providerRef: 'sub_a' } });
    // The subscription checkout's payment is its first invoice.paid, not the completion.
    expect(await db.billingEventsFor('space', fam, 10)).toEqual([]);
    await send('customer.subscription.created', { id: 'sub_a', status: 'active', current_period_end: END, customer: 'cus_fam', metadata: FAMILY(fam) });
    await send('checkout.session.completed', completion('sub_b'), { livemode: true });
    expect(billingEvents().map((e) => [e.name, e.payload, e.profileId])).toEqual([
      ['billing.checkout_completed', { planKey: 'family_lifetime', mode: 'test', duplicate: false }, undefined],
      ['billing.checkout_completed', { planKey: 'family_lifetime', mode: 'live', duplicate: true }, undefined],
    ]);
  });

  it('records a legacy one-time completion as a purchase next to the entitlement it applies', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const r = await send('checkout.session.completed', { id: 'cs_old', mode: 'payment', payment_intent: 'pi_old', customer: 'cus_fam', amount_total: 1530, currency: 'usd', metadata: FAMILY(fam) });
    expect(r.data).toMatchObject({ received: true, applied: true, recorded: true, entitlement: { providerRef: 'pi_old', expiresAt: null } });
    expect(await db.billingEventByRef('stripe', 'pi_old', 'purchase')).toMatchObject({ subjectId: fam, amountCents: 1530 });
  });

  it('refuses an event whose object is null as not a Stripe event', async () => {
    const body = JSON.stringify({ id: 'evt_null', type: 'invoice.paid', data: { object: null } });
    expect((await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', body, NOW_SEC) }, body, STRIPE_ENV)).status).toBe(400);
  });

  it('keeps answering a subscription event as before: no history, no billing telemetry', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const r = await send('customer.subscription.updated', { id: 'sub_fam', status: 'active', current_period_end: END, customer: 'cus_fam', metadata: FAMILY(fam) });
    expect(Object.keys(r.data).sort()).toEqual(['applied', 'entitlement', 'received']);
    expect(await db.billingEventsFor('space', fam, 10)).toEqual([]);
    expect(billingEvents()).toEqual([]);
  });
});

describe('checkout and portal hardening (F-BILL-002 B-5)', () => {
  const FAMILY_ENV = { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' };
  const LIVE_ENV = { ...FAMILY_ENV, STRIPE_SECRET_KEY: 'sk_live_x' };
  const stripeUrl = (url: string) => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ url }), { status: 200 }));
  const billingEvents = () => store.events.filter((e) => e.name.startsWith('billing.')).map((e) => ({ name: e.name, payload: e.payload }));
  const checkoutBody = (fam: string, extra: Record<string, unknown> = {}) => ({ planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam, ...extra });
  async function subscribedFamily(owner = 'mom'): Promise<string> {
    const fam = await createSpace(owner, 'family', 'Kim family');
    await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_fam', providerRef: 'sub_fam', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }, new Date());
    return fam;
  }

  beforeEach(() => {
    store.reset();
  });

  it('returns to the billing page with the plan and the opaque space id, and sends billing.checkout_started', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const fetchImpl = stripeUrl('https://checkout.stripe.com/c/1');
    setStripeFetchForTests(fetchImpl);
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam), FAMILY_ENV)).status).toBe(200);
    const form = new URLSearchParams(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body));
    expect(form.get('success_url')).toBe(`https://hangulroute.com/teach/billing?checkout=success&plan=family_lifetime&id=${encodeURIComponent(fam)}`);
    expect(form.get('cancel_url')).toBe('https://hangulroute.com/teach/billing?checkout=cancel');
    expect(billingEvents()).toEqual([{ name: 'billing.checkout_started', payload: { planKey: 'family_lifetime', mode: 'test', promo: false } }]);

    store.reset();
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([PROMO])).mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/2' }), { status: 200 })));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam, { promoCode: 'HOYA20' }), FAMILY_ENV)).status).toBe(200);
    expect(billingEvents()).toEqual([{ name: 'billing.checkout_started', payload: { planKey: 'family_lifetime', mode: 'test', promo: true } }]);
  });

  it('a failed Stripe call sends no started event', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 500 })));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam), FAMILY_ENV)).body.error?.code).toBe('stripe_error');
    expect(billingEvents()).toEqual([]);
  });

  it('reports a refused checkout: already active (the BY-1 409) and not configured', async () => {
    const fam = await subscribedFamily();
    setStripeFetchForTests(stripeUrl('https://checkout.stripe.com/never'));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam), FAMILY_ENV)).status).toBe(409);
    const other = await createSpace('dad', 'family', 'Lee family');
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('dad'), checkoutBody(other))).body.error?.code).toBe('stripe_not_configured');
    expect(billingEvents()).toEqual([
      { name: 'billing.checkout_refused', payload: { planKey: 'family_lifetime', reason: 'already_active' } },
      { name: 'billing.checkout_refused', payload: { planKey: 'family_lifetime', reason: 'not_configured' } },
    ]);
  });

  it('sends no refused event for a caller who may not buy for the space', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('stranger'), checkoutBody(fam), FAMILY_ENV)).status).toBe(403);
    expect(billingEvents()).toEqual([]);
  });

  describe('live guard (section 4.9): a live key is refused until BILLING_LIVE_ALLOWED is "true"', () => {
    it('refuses checkout with 503 live_not_enabled before any Stripe call, then allows it', async () => {
      const fam = await createSpace('mom', 'family', 'Kim family');
      const fetchImpl = stripeUrl('https://checkout.stripe.com/c/live');
      setStripeFetchForTests(fetchImpl);
      for (const env of [LIVE_ENV, { ...LIVE_ENV, BILLING_LIVE_ALLOWED: 'TRUE' }, { ...LIVE_ENV, STRIPE_SECRET_KEY: 'rk_live_x' }, { ...LIVE_ENV, STRIPE_SECRET_KEY: 'sk_unknown' }]) {
        const refused = await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam, { promoCode: 'HOYA20' }), env);
        expect(refused.status).toBe(503);
        expect(refused.body.error?.code).toBe('live_not_enabled');
      }
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(billingEvents()).toEqual(Array.from({ length: 4 }, () => ({ name: 'billing.checkout_refused', payload: { planKey: 'family_lifetime', reason: 'live_not_enabled' } })));

      store.reset();
      const allowed = await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), checkoutBody(fam), { ...LIVE_ENV, BILLING_LIVE_ALLOWED: 'true' });
      expect(allowed.body.data).toEqual({ url: 'https://checkout.stripe.com/c/live' });
      expect(billingEvents()).toEqual([{ name: 'billing.checkout_started', payload: { planKey: 'family_lifetime', mode: 'live', promo: false } }]);
    });

    it('refuses the portal and promo lookups the same way', async () => {
      const fam = await subscribedFamily();
      const fetchImpl = stripeUrl('https://billing.stripe.com/p/live');
      setStripeFetchForTests(fetchImpl);
      const portal = await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, LIVE_ENV);
      expect([portal.status, portal.body.error?.code]).toEqual([503, 'live_not_enabled']);
      const promo = await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'HOYA20', planKey: 'family_lifetime' }, LIVE_ENV);
      expect([promo.status, promo.body.error?.code]).toEqual([503, 'live_not_enabled']);
      expect(fetchImpl).not.toHaveBeenCalled();

      expect((await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, { ...LIVE_ENV, BILLING_LIVE_ALLOWED: 'true' })).body.data).toEqual({ url: 'https://billing.stripe.com/p/live' });
      setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([PROMO])));
      expect((await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'HOYA20', planKey: 'family_lifetime' }, { ...LIVE_ENV, BILLING_LIVE_ALLOWED: 'true' })).status).toBe(200);
    });

    it('never stops the webhook, so nothing paid is lost', async () => {
      const fam = await createSpace('mom', 'family', 'Kim family');
      const ts = Math.floor(Date.now() / 1000);
      const event = JSON.stringify({ id: 'evt_live', type: 'checkout.session.completed', livemode: true, data: { object: { id: 'cs_live', mode: 'subscription', subscription: 'sub_live', customer: 'cus_live', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime' } } } });
      const r = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', event, ts) }, event, LIVE_ENV);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ applied: true, entitlement: { providerRef: 'sub_live' } });
    });
  });

  it('sends billing.portal_opened with the plan and mode', async () => {
    const fam = await subscribedFamily();
    setStripeFetchForTests(stripeUrl('https://billing.stripe.com/p/1'));
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).status).toBe(200);
    expect(billingEvents()).toEqual([{ name: 'billing.portal_opened', payload: { planKey: 'family_lifetime', mode: 'test' } }]);
  });

  describe('step-up (section 4.4, OD-7) with real Clerk session tokens', () => {
    let keys: ClerkTestKeys;
    beforeAll(async () => {
      keys = await clerkTestKeys();
    });
    /** A deployment with a Clerk key bound (tokens verified) and the in-memory Db of the test environment. */
    const clerkEnv = (extra: Record<string, string> = {}) => ({ ...FAMILY_ENV, ENVIRONMENT: 'test', CLERK_JWT_KEY: keys.jwtKey, ...extra });
    const signedIn = async (sub: string, claims: Record<string, unknown>) => ({ ...json, authorization: `Bearer ${await keys.token(sub, claims)}` });
    async function ownedFamily(sub: string): Promise<string> {
      const r = await call('POST', '/api/spaces', await signedIn(sub, { fva: [0, -1] }), { kind: 'family', name: 'Kim family' }, clerkEnv());
      return (r.body.data as { space: { id: string } }).space.id;
    }

    it('answers checkout with the Clerk hint body when the first factor is older than 10 minutes or fva is absent', async () => {
      const fam = await ownedFamily('user_mom');
      const fetchImpl = stripeUrl('https://checkout.stripe.com/c/s');
      setStripeFetchForTests(fetchImpl);
      for (const claims of [{ fva: [11, -1] }, { fva: [600, 0] }, {}, { fva: 'old' }]) {
        const res = await app.request('/api/entitlements/stripe/checkout', { method: 'POST', headers: await signedIn('user_mom', claims), body: JSON.stringify(checkoutBody(fam)) }, clerkEnv());
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
          ok: false,
          error: { code: 'reverify_required', message: 'Confirm it is you to continue' },
          meta: { serverTime: expect.any(String), version: expect.any(String) },
        });
      }
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(billingEvents()).toEqual(Array.from({ length: 4 }, () => ({ name: 'billing.checkout_refused', payload: { planKey: 'family_lifetime', reason: 'reverify_required' } })));
    });

    it('lets a sign-in at most 10 minutes old through to Stripe', async () => {
      const fam = await ownedFamily('user_mom');
      setStripeFetchForTests(stripeUrl('https://checkout.stripe.com/c/fresh'));
      for (const age of [0, 10]) {
        const r = await call('POST', '/api/entitlements/stripe/checkout', await signedIn('user_mom', { fva: [age, -1] }), checkoutBody(fam), clerkEnv());
        expect(r.body.data).toEqual({ url: 'https://checkout.stripe.com/c/fresh' });
      }
    });

    it('checks who may buy before asking for a fresh sign-in, so a stranger gets 403 forbidden, not the hint', async () => {
      const fam = await ownedFamily('user_mom');
      const r = await call('POST', '/api/entitlements/stripe/checkout', await signedIn('user_stranger', { fva: [30, -1] }), checkoutBody(fam), clerkEnv());
      expect([r.status, r.body.error?.code]).toEqual([403, 'forbidden']);
      expect(billingEvents()).toEqual([]);
    });

    it('asks for a fresh sign-in before the portal too', async () => {
      const fam = await ownedFamily('user_mom');
      await db.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_fam', providerRef: 'sub_fam', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }, new Date());
      const fetchImpl = stripeUrl('https://billing.stripe.com/p/s');
      setStripeFetchForTests(fetchImpl);
      const stale = await call('POST', '/api/entitlements/stripe/portal', await signedIn('user_mom', { fva: [45, -1] }), { subjectKind: 'space', subjectId: fam }, clerkEnv());
      expect([stale.status, stale.body.error?.code]).toEqual([403, 'reverify_required']);
      expect((await call('POST', '/api/entitlements/stripe/portal', await signedIn('user_mom', {}), { subjectKind: 'space', subjectId: fam }, clerkEnv())).status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect((await call('POST', '/api/entitlements/stripe/portal', await signedIn('user_mom', { fva: [3, -1] }), { subjectKind: 'space', subjectId: fam }, clerkEnv())).body.data).toEqual({ url: 'https://billing.stripe.com/p/s' });
    });

    it('does not ask before a promo lookup (no money moves there)', async () => {
      setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(promoResponse([PROMO])));
      const r = await call('POST', '/api/entitlements/stripe/promo', await signedIn('user_mom', { fva: [90, -1] }), { code: 'HOYA20', planKey: 'family_lifetime' }, clerkEnv());
      expect(r.status).toBe(200);
    });
  });
});
