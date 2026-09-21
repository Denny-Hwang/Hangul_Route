import { describe, expect, it, vi } from 'vitest';
import { checkoutForm, createCheckoutSession, createPortalSession, entitlementFromStripeEvent, mapStripeStatus, parseStripeSignature, priceIdFor, signStripePayload, verifyStripeSignature } from '../stripe';

const secret = 'whsec_test';
const body = '{"id":"evt_1","type":"customer.subscription.updated"}';

describe('stripe helpers (F-ENT-001 §3.3)', () => {
  it('parses and verifies signatures within tolerance, rejecting tampering and stale timestamps', async () => {
    const t = 1_700_000_000;
    const header = await signStripePayload(secret, body, t);
    expect(parseStripeSignature(header)).toMatchObject({ t, v1: [expect.stringMatching(/^[0-9a-f]{64}$/)] });
    expect(parseStripeSignature(undefined)).toBeNull();
    expect(parseStripeSignature('v1=abc')).toBeNull();
    expect(parseStripeSignature('t=1')).toBeNull();
    expect(await verifyStripeSignature(header, body, secret, t * 1000 + 60_000)).toBe(true);
    expect(await verifyStripeSignature(`${header},v1=deadbeef`, body, secret, t * 1000)).toBe(true);
    expect(await verifyStripeSignature(header, `${body} `, secret, t * 1000)).toBe(false);
    expect(await verifyStripeSignature(header, body, 'other', t * 1000)).toBe(false);
    expect(await verifyStripeSignature(header, body, secret, t * 1000 + 10 * 60_000)).toBe(false);
    expect(await verifyStripeSignature(null, body, secret, t * 1000)).toBe(false);
  });

  it('maps subscription statuses and events into apply inputs', () => {
    expect(mapStripeStatus('trialing')).toBe('trial');
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('canceled')).toBe('cancelled');
    expect(mapStripeStatus('unpaid')).toBe('expired');
    expect(mapStripeStatus('incomplete')).toBeNull();
    const meta = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_premium' };
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', subscription: 'sub_1', customer: 'cus_1', metadata: meta } } })).toEqual({ ...meta, status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', expiresAt: null });
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', metadata: meta } } })).toMatchObject({ providerRef: 'cs_2', customerRef: null });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'past_due', current_period_end: 1_800_000_000, metadata: meta } } })).toEqual({ ...meta, status: 'past_due', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', expiresAt: '2027-01-15T08:00:00.000Z' });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', metadata: meta } } })).toMatchObject({ status: 'expired', expiresAt: null });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.created', data: { object: { id: 'sub_1', status: 'incomplete', metadata: meta } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active' } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', metadata: { ...meta, planKey: 'gold' } } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'invoice.paid', data: { object: { metadata: meta } } })).toBeNull();
  });

  it('builds checkout forms, resolves price ids, and posts sessions', async () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_TEACHER_PRO_MONTHLY: 'price_tp_m' };
    expect(priceIdFor(env, 'teacher_pro', 'monthly')).toBe('price_tp_m');
    expect(priceIdFor(env, 'teacher_pro', 'yearly')).toBeNull();
    const form = checkoutForm({ priceId: 'price_tp_m', subjectKind: 'account', subjectId: 'teacher', planKey: 'teacher_pro', successUrl: 's', cancelUrl: 'c', customerEmail: 'kim@example.com' });
    expect(form).toMatchObject({ mode: 'subscription', 'line_items[0][price]': 'price_tp_m', 'metadata[planKey]': 'teacher_pro', 'subscription_data[metadata][subjectId]': 'teacher', customer_email: 'kim@example.com' });
    expect(checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'family_premium', successUrl: 's', cancelUrl: 'c' })).not.toHaveProperty('customer_email');

    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/1' }), { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    expect(await createCheckoutSession(env, form, fetchImpl)).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/1', status: 200 });
    expect(await createCheckoutSession(env, form, fetchImpl)).toEqual({ ok: false, url: null, status: 401 });
    expect(await createPortalSession(env, 'cus_1', 'https://x/teach/billing', fetchImpl)).toEqual({ ok: true, url: 'https://billing.stripe.com/p/1', status: 200 });
    expect(await createPortalSession(env, 'cus_1', 'r', fetchImpl)).toEqual({ ok: false, url: null, status: -1 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect(String(init.body)).toContain('mode=subscription');
  });
});
