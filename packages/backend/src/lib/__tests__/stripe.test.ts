import { describe, expect, it, vi } from 'vitest';
import { checkoutForm, checkoutMode, createCheckoutSession, createPortalSession, entitlementFromStripeEvent, lookupPromotionCode, mapStripeStatus, parseStripeSignature, priceIdFor, promoFromStripe, signStripePayload, verifyStripeSignature } from '../stripe';

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
    const meta = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime' };
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', subscription: 'sub_1', customer: 'cus_1', metadata: meta } } })).toEqual({ ...meta, promoCode: null, status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', expiresAt: null });
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_intent: 'pi_1', customer: 'cus_2', metadata: meta } } })).toMatchObject({ providerRef: 'pi_1', customerRef: 'cus_2', expiresAt: null }); // one-time payment
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_3', metadata: meta } } })).toMatchObject({ providerRef: 'cs_3', customerRef: null });
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_4', metadata: { ...meta, planKey: 'teacher_pro' } } } })).toBeNull(); // retired plan
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_5', metadata: { ...meta, promoCode: 'HOYA20' } } } })).toMatchObject({ promoCode: 'HOYA20' });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_2', status: 'active', metadata: { ...meta, planKey: 'group_license', promoCode: 'TEACHER10' } } } })).toMatchObject({ promoCode: 'TEACHER10' });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_2', status: 'active', metadata: { ...meta, planKey: 'group_license', promoCode: '' } } } })).toMatchObject({ promoCode: null });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'past_due', current_period_end: 1_800_000_000, metadata: meta } } })).toEqual({ ...meta, promoCode: null, status: 'past_due', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', expiresAt: '2027-01-15T08:00:00.000Z' });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', metadata: meta } } })).toMatchObject({ status: 'expired', expiresAt: null });
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.created', data: { object: { id: 'sub_1', status: 'incomplete', metadata: meta } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active' } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', metadata: { ...meta, planKey: 'gold' } } } })).toBeNull();
    expect(entitlementFromStripeEvent({ type: 'invoice.paid', data: { object: { metadata: meta } } })).toBeNull();
  });

  it('builds checkout forms, resolves price ids, and posts sessions', async () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_GROUP_LICENSE_YEARLY: 'price_gl_y' };
    expect(priceIdFor(env, 'group_license')).toBe('price_gl_y');
    expect(priceIdFor(env, 'family_lifetime')).toBeNull();
    expect(priceIdFor({ ...env, STRIPE_PRICE_FAMILY_LIFETIME: 'price_fl' }, 'family_lifetime')).toBe('price_fl');
    expect(checkoutMode('family_lifetime')).toBe('payment');
    expect(checkoutMode('group_license')).toBe('subscription');
    const form = checkoutForm({ priceId: 'price_gl_y', subjectKind: 'space', subjectId: 'space:cls', planKey: 'group_license', successUrl: 's', cancelUrl: 'c', customerEmail: 'kim@example.com' });
    expect(form).toMatchObject({ mode: 'subscription', 'line_items[0][price]': 'price_gl_y', 'metadata[planKey]': 'group_license', 'subscription_data[metadata][subjectId]': 'space:cls', customer_email: 'kim@example.com' });
    expect(form).not.toHaveProperty('customer_creation');
    expect(form.payment_method_collection).toBe('if_required'); // $0 after a 100%-off code → no card
    const once = checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'family_lifetime', successUrl: 's', cancelUrl: 'c' });
    expect(once).toMatchObject({ mode: 'payment', customer_creation: 'always', 'metadata[planKey]': 'family_lifetime' });
    expect(once).not.toHaveProperty('customer_email');
    expect(once).not.toHaveProperty('subscription_data[metadata][planKey]');
    expect(once).not.toHaveProperty('payment_method_collection');
    expect(once.allow_promotion_codes).toBe('true'); // no code → Stripe's own box
    const promo = { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' as const };
    const withPromo = checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'family_lifetime', successUrl: 's', cancelUrl: 'c', promo });
    expect(withPromo).toMatchObject({ 'discounts[0][promotion_code]': 'promo_1', 'metadata[promoCode]': 'HOYA20' });
    expect(withPromo).not.toHaveProperty('allow_promotion_codes');
    expect(checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'group_license', successUrl: 's', cancelUrl: 'c', promo })).toMatchObject({ 'subscription_data[metadata][promoCode]': 'HOYA20' });

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

  it('reads Stripe promotion codes and refuses the ones that cannot be used (F-ENT-002)', async () => {
    const now = 1_800_000_000;
    const live = { id: 'promo_1', code: 'hoya20', active: true, expires_at: null, max_redemptions: 100, times_redeemed: 3, coupon: { id: 'c1', name: 'Launch', percent_off: 20, amount_off: null, currency: null, duration: 'once', valid: true } };
    expect(promoFromStripe(live, now)).toEqual({ id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' });
    expect(promoFromStripe({ ...live, coupon: { ...live.coupon, percent_off: null, amount_off: 500, currency: 'usd', name: null } }, now)).toMatchObject({ amountOffCents: 500, percentOff: null, name: null });
    expect(promoFromStripe({ ...live, coupon: { ...live.coupon, percent_off: null, amount_off: 500, currency: 'eur' } }, now)).toMatchObject({ amountOffCents: null, percentOff: null }); // other currency → no amount
    expect(promoFromStripe({ ...live, active: false }, now)).toBeNull();
    expect(promoFromStripe({ ...live, coupon: { ...live.coupon, valid: false } }, now)).toBeNull();
    expect(promoFromStripe({ ...live, expires_at: now - 1 }, now)).toBeNull();
    expect(promoFromStripe({ ...live, expires_at: now + 1 }, now)).not.toBeNull();
    expect(promoFromStripe({ ...live, max_redemptions: 3 }, now)).toBeNull();
    expect(promoFromStripe({ ...live, coupon: { ...live.coupon, duration: 'weird' } }, now)).toBeNull();
    expect(promoFromStripe({ ...live, coupon: null }, now)).toBeNull();
    // 2025-09-30.clover: the coupon lives under `promotion`
    const { coupon: liveCoupon, ...rest } = live;
    const clover = { ...rest, promotion: { type: 'coupon', coupon: { ...liveCoupon, percent_off: 100, duration: 'forever' } } };
    expect(promoFromStripe(clover, now)).toEqual({ id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 100, amountOffCents: null, duration: 'forever' });
    expect(promoFromStripe({ ...rest, promotion: { type: 'coupon', coupon: 'c1' } }, now)).toBeNull(); // not expanded
    expect(promoFromStripe(null, now)).toBeNull();
    expect(promoFromStripe('x', now)).toBeNull();

    const env = { STRIPE_SECRET_KEY: 'sk_test' };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [live] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValueOnce(new Response('not json', { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    expect(await lookupPromotionCode(env, 'HOYA20', fetchImpl, now)).toMatchObject({ id: 'promo_1' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/promotion_codes?code=HOYA20&active=true&limit=1&expand%5B%5D=data.promotion.coupon');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect((init.headers as Record<string, string>)['Stripe-Version']).toBe('2025-09-30.clover');
    expect(await lookupPromotionCode(env, 'NOPE', fetchImpl, now)).toBeNull();
    expect(await lookupPromotionCode(env, 'HOYA20', fetchImpl, now)).toBeNull();
    expect(await lookupPromotionCode(env, 'HOYA20', fetchImpl, now)).toBeNull();
    expect(await lookupPromotionCode(env, 'HOYA20', fetchImpl, now)).toBeNull();
    expect(typeof (await lookupPromotionCode(env, 'HOYA20', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: [live] }), { status: 200 }))))).toBe('object');
  });
});
