import { describe, expect, it, vi } from 'vitest';
import { billingLiveAllowed, checkoutForm, checkoutMode, checkoutSuccessSuffix, createCheckoutSession, createPortalSession, entitlementFromStripeEvent, fetchSubscription, freshStripeEvent, lookupPromotionCode, mergeForStripeEvent, mapStripeStatus, parseStripeSignature, priceIdFor, promoFromStripe, signStripePayload, stripeMode, verifyStripeSignature } from '../stripe';

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
    // A subscription completion leaves expiresAt to the subscription events, which may arrive first (BY-D5).
    const subscribed = entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: meta } } });
    expect(subscribed).toStrictEqual({ ...meta, promoCode: null, status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1' });
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_6', subscription: 'sub_6', metadata: meta } } })).not.toHaveProperty('expiresAt'); // no mode field: the subscription id decides
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_7', mode: 'subscription', metadata: meta } } })).not.toHaveProperty('expiresAt');
    expect(entitlementFromStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', mode: 'payment', payment_intent: 'pi_1', customer: 'cus_2', metadata: meta } } })).toMatchObject({ providerRef: 'pi_1', customerRef: 'cus_2', expiresAt: null }); // legacy one-time payment (BY-D2)
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

  it('yearly plans: cancel at period end keeps access to the period end; the period end is read from both API shapes (BY-D5)', () => {
    const meta = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime' };
    const end = 1_800_000_000; // 2027-01-15T08:00:00.000Z
    const iso = (sec: number): string => new Date(sec * 1000).toISOString();
    const sub = (object: Record<string, unknown>, type = 'customer.subscription.updated') => entitlementFromStripeEvent({ type, data: { object: { id: 'sub_f', customer: 'cus_f', metadata: meta, ...object } } });

    // Renewing normally.
    expect(sub({ status: 'active', current_period_end: end, cancel_at_period_end: false, cancel_at: null })).toMatchObject({ status: 'active', expiresAt: iso(end) });
    // Cancelled in the portal: still active at Stripe until the period end, `cancelled` here with that end.
    expect(sub({ status: 'active', current_period_end: end, cancel_at_period_end: true, cancel_at: end })).toMatchObject({ status: 'cancelled', expiresAt: iso(end) });
    expect(sub({ status: 'trialing', current_period_end: end, cancel_at: end })).toMatchObject({ status: 'cancelled', expiresAt: iso(end) });
    // A cancel date before the period end wins.
    expect(sub({ status: 'active', current_period_end: end, cancel_at: end - 86_400 })).toMatchObject({ status: 'cancelled', expiresAt: iso(end - 86_400) });
    expect(sub({ status: 'active', cancel_at: end })).toMatchObject({ status: 'cancelled', expiresAt: iso(end) }); // no period end in the payload
    // Undoing the cancel returns the row to active.
    expect(sub({ status: 'active', current_period_end: end, cancel_at_period_end: false })).toMatchObject({ status: 'active' });
    // Other statuses are not rewritten by the cancel flag.
    expect(sub({ status: 'past_due', current_period_end: end, cancel_at_period_end: true })).toMatchObject({ status: 'past_due', expiresAt: iso(end) });
    expect(sub({ status: 'canceled', current_period_end: end, cancel_at_period_end: true }, 'customer.subscription.deleted')).toMatchObject({ status: 'expired' });

    // 2025-03-31.basil and later: the period end lives on the items; the latest one is the plan's end.
    expect(sub({ status: 'active', items: { data: [{ current_period_end: end - 10 }, { current_period_end: end }, { current_period_end: 'soon' }] } })).toMatchObject({ status: 'active', expiresAt: iso(end) });
    expect(sub({ status: 'active', items: { data: [{ current_period_end: end }] }, cancel_at_period_end: true })).toMatchObject({ status: 'cancelled', expiresAt: iso(end) });
    // The top level wins when both are present (older versions); nothing readable leaves the end unknown.
    expect(sub({ status: 'active', current_period_end: end, items: { data: [{ current_period_end: end + 99 }] } })).toMatchObject({ expiresAt: iso(end) });
    expect(sub({ status: 'active', items: { data: 'nope' } })).toMatchObject({ expiresAt: null });
    expect(sub({ status: 'active', items: { data: [null, 7] } })).toMatchObject({ expiresAt: null });
    expect(sub({ status: 'active', items: null })).toMatchObject({ expiresAt: null });
  });

  it('a subscription completion merges as a checkout; everything else sets (BY-D5)', () => {
    const meta = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime' };
    expect(mergeForStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', metadata: meta } } })).toBe('checkout');
    expect(mergeForStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', subscription: 'sub_1', metadata: meta } } })).toBe('checkout');
    expect(mergeForStripeEvent({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', mode: 'payment', payment_intent: 'pi_1', metadata: meta } } })).toBe('set'); // legacy one-time
    expect(mergeForStripeEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', metadata: meta } } })).toBe('set');
  });

  it('reads a subscription again for created and updated events, falling back to the event on any failure (BY-D5)', async () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test' };
    const meta = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime' };
    const stale = { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', cancel_at_period_end: true, metadata: meta } } };
    const freshSub = { id: 'sub_1', object: 'subscription', status: 'active', cancel_at_period_end: false, metadata: meta };
    const ok = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(freshSub), { status: 200 }));
    expect(await freshStripeEvent(env, stale, ok)).toEqual({ ...stale, data: { object: freshSub } });
    const [url, init] = ok.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    expect(await freshStripeEvent(env, { ...stale, type: 'customer.subscription.created' }, ok)).toMatchObject({ data: { object: freshSub } });

    // Failures and odd answers keep the event's own copy.
    for (const answer of [new Response('{}', { status: 404 }), new Response('not json', { status: 200 }), new Response(JSON.stringify({ ...freshSub, id: 'sub_other' }), { status: 200 }), new Response('[]', { status: 200 })]) {
      expect(await freshStripeEvent(env, stale, vi.fn<typeof fetch>().mockResolvedValue(answer))).toBe(stale);
    }
    expect(await freshStripeEvent(env, stale, vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')))).toBe(stale);
    expect(await freshStripeEvent(env, stale, vi.fn<typeof fetch>().mockResolvedValue(undefined as unknown as Response))).toBe(stale);
    // No read without a key, for deleted (final), for completions, or without a subscription id.
    const never = vi.fn<typeof fetch>();
    expect(await freshStripeEvent({}, stale, never)).toBe(stale);
    const deleted = { ...stale, type: 'customer.subscription.deleted' };
    expect(await freshStripeEvent(env, deleted, never)).toBe(deleted);
    const completed = { type: 'checkout.session.completed', data: { object: { id: 'cs_1', subscription: 'sub_1', metadata: meta } } };
    expect(await freshStripeEvent(env, completed, never)).toBe(completed);
    const noId = { type: 'customer.subscription.updated', data: { object: { id: 'pi_1', metadata: meta } } };
    expect(await freshStripeEvent(env, noId, never)).toBe(noId);
    expect(never).not.toHaveBeenCalled();
    expect(await fetchSubscription(env, 'sub_1', ok)).toEqual(freshSub);
  });

  it('builds checkout forms, resolves price ids, and posts sessions', async () => {
    const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_GROUP_LICENSE_YEARLY: 'price_gl_y' };
    expect(priceIdFor(env, 'group_license')).toBe('price_gl_y');
    expect(priceIdFor(env, 'family_lifetime')).toBeNull();
    expect(priceIdFor({ ...env, STRIPE_PRICE_FAMILY_YEARLY: 'price_fy' }, 'family_lifetime')).toBe('price_fy');
    // The old one-off price variable is ignored: a one-off price cannot run in subscription mode (BY-D3).
    const oldOnly: Record<string, string> = { ...env, STRIPE_PRICE_FAMILY_LIFETIME: 'price_fl' };
    expect(priceIdFor(oldOnly, 'family_lifetime')).toBeNull();
    // Both products renew yearly (owner decision 2026-10-11).
    expect(checkoutMode('family_lifetime')).toBe('subscription');
    expect(checkoutMode('group_license')).toBe('subscription');
    const form = checkoutForm({ priceId: 'price_gl_y', subjectKind: 'space', subjectId: 'space:cls', planKey: 'group_license', successUrl: 's', cancelUrl: 'c', customerEmail: 'kim@example.com' });
    expect(form).toMatchObject({ mode: 'subscription', 'line_items[0][price]': 'price_gl_y', 'metadata[planKey]': 'group_license', 'subscription_data[metadata][subjectId]': 'space:cls', customer_email: 'kim@example.com' });
    expect(form).not.toHaveProperty('customer_creation');
    expect(form.payment_method_collection).toBe('if_required'); // $0 after a 100%-off code → no card
    const family = checkoutForm({ priceId: 'price_fy', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', successUrl: 's', cancelUrl: 'c' });
    expect(family).toMatchObject({
      mode: 'subscription',
      'line_items[0][price]': 'price_fy',
      'metadata[planKey]': 'family_lifetime',
      'subscription_data[metadata][subjectKind]': 'space',
      'subscription_data[metadata][subjectId]': 'space:fam',
      'subscription_data[metadata][planKey]': 'family_lifetime',
      // A family always saves a card, so a free first year still renews and "renews {date}" stays true (BY-D4).
      payment_method_collection: 'always',
    });
    expect(family).not.toHaveProperty('customer_creation'); // Stripe refuses it in subscription mode
    expect(family).not.toHaveProperty('customer_email');
    expect(family.allow_promotion_codes).toBe('true'); // no code → Stripe's own box
    // A subject that already has a Stripe customer buys on it again, so one portal shows every invoice (BY-D4).
    const again = checkoutForm({ priceId: 'price_fy', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', successUrl: 's', cancelUrl: 'c', customerEmail: 'kim@example.com', customer: 'cus_old' });
    expect(again.customer).toBe('cus_old');
    expect(again).not.toHaveProperty('customer_email'); // Stripe refuses both together
    expect(checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'group_license', successUrl: 's', cancelUrl: 'c', customerEmail: 'kim@example.com', customer: null })).toMatchObject({ customer_email: 'kim@example.com' });
    const promo = { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' as const };
    const withPromo = checkoutForm({ priceId: 'p', subjectKind: 'space', subjectId: 's', planKey: 'family_lifetime', successUrl: 's', cancelUrl: 'c', promo });
    expect(withPromo).toMatchObject({ 'discounts[0][promotion_code]': 'promo_1', 'metadata[promoCode]': 'HOYA20' });
    expect(withPromo).not.toHaveProperty('allow_promotion_codes');
    expect(withPromo['subscription_data[metadata][promoCode]']).toBe('HOYA20');
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

describe('test mode, live mode and the return suffix (F-BILL-002 B-5, sections 4.4 and 4.9)', () => {
  it('reads the Stripe mode from the secret key prefix', () => {
    expect(stripeMode({ STRIPE_SECRET_KEY: 'sk_test_abc' })).toBe('test');
    expect(stripeMode({ STRIPE_SECRET_KEY: 'rk_test_abc' })).toBe('test');
    expect(stripeMode({ STRIPE_SECRET_KEY: 'sk_live_abc' })).toBe('live');
    expect(stripeMode({ STRIPE_SECRET_KEY: 'rk_live_abc' })).toBe('live');
    expect(stripeMode({})).toBe('none');
    expect(stripeMode({ STRIPE_SECRET_KEY: '' })).toBe('none');
    expect(stripeMode(undefined)).toBe('none');
  });

  it('reads a key with no known prefix as live, so the guard refuses it (fail closed)', () => {
    expect(stripeMode({ STRIPE_SECRET_KEY: 'sk_test' })).toBe('live');
    expect(stripeMode({ STRIPE_SECRET_KEY: 'pk_test_abc' })).toBe('live');
    expect(stripeMode({ STRIPE_SECRET_KEY: 'whatever' })).toBe('live');
  });

  it('allows live money calls only when BILLING_LIVE_ALLOWED is exactly "true"', () => {
    expect(billingLiveAllowed({ BILLING_LIVE_ALLOWED: 'true' })).toBe(true);
    for (const value of [undefined, '', 'TRUE', 'True', '1', 'yes', ' true']) expect(billingLiveAllowed({ BILLING_LIVE_ALLOWED: value })).toBe(false);
    expect(billingLiveAllowed(undefined)).toBe(false);
  });

  it('builds the success suffix with the plan and the opaque space id, encoded', () => {
    expect(checkoutSuccessSuffix('family_lifetime', 'space:fam-1')).toBe('?checkout=success&plan=family_lifetime&id=space%3Afam-1');
    expect(checkoutSuccessSuffix('group_license', 'space:a&b=c')).toBe('?checkout=success&plan=group_license&id=space%3Aa%26b%3Dc');
  });
});
