import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { entitlementFromStripeEvent, mergeForStripeEvent, signStripePayload, type StripeEventLike } from '../lib/stripe';
import { setStripeFetchForTests } from '../routes/entitlements';
import { testDb as db } from './helpers/db';
import { PROMO_LIMIT, promoLimiter } from '../routes/entitlements';

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
const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_GROUP_LICENSE_YEARLY: 'price_gl', CONSOLE_URL: 'https://hangulroute.com/' };

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
