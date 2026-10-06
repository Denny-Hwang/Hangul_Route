import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { signStripePayload } from '../lib/stripe';
import { setStripeFetchForTests } from '../routes/entitlements';
import { store } from '../store';
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

beforeEach(() => {
  store.reset();
  setStripeFetchForTests(null);
  promoLimiter.reset();
});

const PROMO = { id: 'promo_1', code: 'hoya20', active: true, expires_at: null, max_redemptions: null, times_redeemed: 0, coupon: { id: 'c1', name: 'Launch', percent_off: 20, amount_off: null, currency: null, duration: 'once', valid: true } };
const promoResponse = (rows: unknown[]) => new Response(JSON.stringify({ data: rows }), { status: 200 });

describe('entitlements (F-ENT-001 §3.3)', () => {
  it('lists mine and my spaces’, verifies a family receipt, and rejects other people’s spaces', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const cls = await createSpace('teacher', 'class', 'A');
    expect((await call('GET', '/api/entitlements', json)).status).toBe(401);
    expect(((await call('GET', '/api/entitlements', bearer('mom'))).body.data as { entitlements: unknown[] }).entitlements).toEqual([]);

    const receipt = JSON.stringify({ plan: 'yearly', expiresAt: '2099-01-01T00:00:00.000Z' });
    const verified = await call('POST', '/api/entitlements/verify', bearer('mom'), { spaceId: fam, store: 'apple', receipt });
    expect(verified.status).toBe(200);
    expect(verified.body.data).toMatchObject({ entitlement: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'apple', subjectName: 'Kim family' } });
    expect((await call('POST', '/api/entitlements/verify', bearer('dad'), { spaceId: fam, store: 'apple', receipt })).status).toBe(403);
    expect((await call('POST', '/api/entitlements/verify', bearer('teacher'), { spaceId: cls, store: 'apple', receipt })).status).toBe(422);
    expect((await call('POST', '/api/entitlements/verify', bearer('mom'), { spaceId: fam, store: 'apple', receipt: 'garbage' })).body.error?.code).toBe('receipt_invalid');
    expect((await call('POST', '/api/entitlements/verify', bearer('mom'), { spaceId: 'space:nope', store: 'apple', receipt })).status).toBe(404);
    expect((await call('POST', '/api/entitlements/verify', bearer('mom'), { spaceId: fam, store: 'apple', receipt: JSON.stringify({ plan: 'monthly', expiresAt: '2020-01-01T00:00:00.000Z' }) })).body.data).toMatchObject({ entitlement: { status: 'expired' } });

    const mine = (await call('GET', '/api/entitlements', bearer('mom'))).body.data as { entitlements: Array<{ planKey: string }> };
    expect(mine.entitlements.map((e) => e.planKey)).toEqual(['family_lifetime']);
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
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).body.error?.code).toBe('stripe_not_configured'); // no lifetime price bound

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
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('mom'), { planKey: 'family_lifetime', subjectKind: 'space', subjectId: fam }, { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_LIFETIME: 'price_fl' })).body.data).toEqual({ url: 'https://checkout.stripe.com/c/2' });
    expect(String((once.mock.calls[0]?.[1] as RequestInit).body)).toContain('mode=payment');
    setStripeFetchForTests(vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 500 })));
    expect((await call('POST', '/api/entitlements/stripe/checkout', bearer('principal'), { planKey: 'group_license', subjectKind: 'space', subjectId: sch }, STRIPE_ENV)).body.error?.code).toBe('stripe_error');
  });

  it('checks promotion codes against Stripe and applies them at checkout (F-ENT-002)', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const env = { ...STRIPE_ENV, STRIPE_PRICE_FAMILY_LIFETIME: 'price_fl' };
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
    const event = JSON.stringify({ id: 'evt_p', type: 'checkout.session.completed', data: { object: { id: 'cs_9', payment_intent: 'pi_9', customer: 'cus_9', metadata: { subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', promoCode: 'HOYA20' } } } });
    const applied = await call('POST', '/api/entitlements/stripe/webhook', { ...json, 'stripe-signature': await signStripePayload('whsec_test', event, ts) }, event, env);
    expect(applied.body.data).toMatchObject({ applied: true, entitlement: { planKey: 'family_lifetime', promoCode: 'HOYA20', providerRef: 'pi_9', expiresAt: null } });

    // guessing is rate-limited per client
    setStripeFetchForTests(vi.fn<typeof fetch>().mockImplementation(async () => promoResponse([])));
    for (let i = 0; i < PROMO_LIMIT - 3; i += 1) await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: `GUESS${i}`, planKey: 'family_lifetime' }, env);
    const limited = await call('POST', '/api/entitlements/stripe/promo', bearer('mom'), { code: 'GUESSX', planKey: 'family_lifetime' }, env);
    expect(limited.status).toBe(429);
    expect(limited.body.error?.code).toBe('too_many_attempts');
  });

  it('webhooks verify the signature and drive the tier that learners receive; the portal needs a Stripe customer', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const code = (store.spaces.get(cls) as { joinCode: string }).joinCode;
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
    for (let i = 0; i < 25; i += 1) store.addMembership({ spaceId: cls, memberKind: 'learner', memberId: `profile:s${i}`, role: 'student', joinedAt: 't' });
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
    store.applyEntitlement({ subjectKind: 'space', subjectId: fam, planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_fam', providerRef: 'pi_1' }, new Date());
    expect((await call('POST', '/api/entitlements/stripe/portal', bearer('mom'), { subjectKind: 'space', subjectId: fam }, STRIPE_ENV)).status).toBe(404); // lifetime has nothing to manage
  });
});
