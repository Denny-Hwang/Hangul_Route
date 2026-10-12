import type { EntitlementApply } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb as db } from '../../__tests__/helpers/db';
import {
  INVOICE_PAYMENTS_API_VERSION,
  LOOKUP_UNAVAILABLE,
  invoiceForPaymentIntent,
  invoiceSubject,
  isDuplicateCompletion,
  paymentIntentForInvoice,
  recordBillingHistory,
  refundProviderRef,
  stripeModeOf,
  type StripeWebhookEvent,
} from '../billing-events';

/**
 * F-BILL-002 §5.4: payment history recorded from Stripe webhooks. The mapping reads both the
 * pre-2025 and the 2025 (basil, clover) invoice shapes; Stripe lookups go through the injected
 * fetch, and a failed lookup never fails the event.
 */

const ENV = { STRIPE_SECRET_KEY: 'sk_test_x' };
const NOW = new Date('2026-10-12T09:00:00.000Z');
const SEC = Math.floor(Date.parse('2026-10-11T08:00:00.000Z') / 1000);
const AT = new Date(SEC * 1000).toISOString();
const FAM = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime' } as const;
const CLS = { subjectKind: 'space', subjectId: 'space:cls', planKey: 'group_license' } as const;

/** Stripe answers nothing: every lookup fails, so mapping falls back as documented. */
const stripeDown = (): typeof fetch => vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}', { status: 503 }));
const answer = (body: unknown, status = 200): typeof fetch => vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
const evt = (type: string, object: Record<string, unknown>, extra: Partial<StripeWebhookEvent> = {}): StripeWebhookEvent => ({ type, created: SEC, livemode: false, data: { object }, ...extra });

const invoice = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'in_1',
  object: 'invoice',
  billing_reason: 'subscription_create',
  amount_paid: 1530,
  amount_due: 1530,
  currency: 'usd',
  status_transitions: { paid_at: SEC },
  parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_fam', metadata: { ...FAM } } },
  ...over,
});

beforeEach(async () => {
  await db.reset();
});

describe('pure helpers', () => {
  it('reads the mode from the event: live only when Stripe says so', () => {
    expect(stripeModeOf(evt('invoice.paid', {}, { livemode: true }))).toBe('live');
    expect(stripeModeOf(evt('invoice.paid', {}, { livemode: false }))).toBe('test');
    expect(stripeModeOf({ type: 'invoice.paid', data: { object: {} } })).toBe('test');
  });

  it('names a refund row by its charge and the cumulative refunded cents', () => {
    expect(refundProviderRef('ch_1', 500)).toBe('ch_1:refund:500');
  });

  it('finds an invoice subject in the 2025 parent shape, the older subscription_details shape, or neither', () => {
    expect(invoiceSubject(invoice())).toEqual({ subject: FAM, subscriptionId: 'sub_fam' });
    expect(invoiceSubject({ id: 'in_2', subscription: 'sub_cls', subscription_details: { metadata: { ...CLS } } })).toEqual({ subject: CLS, subscriptionId: 'sub_cls' });
    expect(invoiceSubject({ id: 'in_3', subscription: { id: 'sub_x', object: 'subscription' } })).toEqual({ subject: null, subscriptionId: 'sub_x' });
    expect(invoiceSubject({ id: 'in_4', parent: { subscription_details: { subscription: 'sub_y', metadata: {} } } })).toEqual({ subject: null, subscriptionId: 'sub_y' });
    expect(invoiceSubject({ id: 'in_5', metadata: {} })).toEqual({ subject: null, subscriptionId: null });
    expect(invoiceSubject({ id: 'in_6', parent: 'nope', subscription_details: 7 })).toEqual({ subject: null, subscriptionId: null });
  });
});

describe('invoice_payments lookups (pinned API version, injected fetch)', () => {
  it('reads the payment intent behind an invoice from its paid payment', async () => {
    const fetchImpl = answer({
      object: 'list',
      data: [
        { id: 'inpay_0', invoice: 'in_1', status: 'canceled', payment: { type: 'payment_intent', payment_intent: 'pi_old' } },
        { id: 'inpay_1', invoice: 'in_1', status: 'paid', payment: { type: 'payment_intent', payment_intent: { id: 'pi_1', object: 'payment_intent' } } },
      ],
    });
    expect(await paymentIntentForInvoice(ENV, 'in_1', fetchImpl)).toBe('pi_1');
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/invoice_payments?invoice=in_1');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test_x', 'Stripe-Version': INVOICE_PAYMENTS_API_VERSION });
    // A hung Stripe never holds the webhook past Stripe's own timeout.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('stores no payment intent rather than a guess when no payment is marked paid', async () => {
    const unpaid = answer({ data: [{ status: 'canceled', payment: { type: 'payment_intent', payment_intent: 'pi_old' } }, { status: 'open', payment: { type: 'payment_intent', payment_intent: 'pi_2' } }, { status: 'paid', payment: { type: 'charge', charge: 'ch_1' } }] });
    expect(await paymentIntentForInvoice(ENV, 'in_1', unpaid)).toBeNull();
  });

  it('reads the invoice behind a payment intent', async () => {
    const fetchImpl = answer({ data: [{ invoice: { id: 'in_9', object: 'invoice' }, payment: { type: 'payment_intent', payment_intent: 'pi_9' } }] });
    expect(await invoiceForPaymentIntent(ENV, 'pi_9', fetchImpl)).toBe('in_9');
    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('https://api.stripe.com/v1/invoice_payments?payment%5Btype%5D=payment_intent&payment%5Bpayment_intent%5D=pi_9');
    expect(await invoiceForPaymentIntent(ENV, 'pi_9', answer({ data: [{ invoice: 'in_8' }] }))).toBe('in_8');
  });

  it('tells "Stripe could not answer now" (worth a retry) from "nothing found"', async () => {
    const throwing = vi.fn<typeof fetch>().mockRejectedValue(new Error('network'));
    const badJson = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json', { status: 200 }));
    for (const fetchImpl of [stripeDown(), answer({ error: {} }, 429), throwing, badJson]) {
      expect(await paymentIntentForInvoice(ENV, 'in_1', fetchImpl)).toBeNull();
      expect(await invoiceForPaymentIntent(ENV, 'pi_1', fetchImpl)).toBe(LOOKUP_UNAVAILABLE);
    }
    for (const fetchImpl of [answer({ error: {} }, 404), answer({ data: [] }), answer({ data: 'x' }), answer([1, 2]), answer({ data: [null, { payment: null }, { invoice: 7 }] })]) {
      expect(await paymentIntentForInvoice(ENV, 'in_1', fetchImpl)).toBeNull();
      expect(await invoiceForPaymentIntent(ENV, 'pi_1', fetchImpl)).toBeNull();
    }
    const never = vi.fn<typeof fetch>();
    expect(await paymentIntentForInvoice({}, 'in_1', never)).toBeNull();
    expect(await invoiceForPaymentIntent({}, 'pi_1', never)).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
});

describe('checkout.session.completed', () => {
  it('records a legacy one-time payment as a purchase on its payment intent, from the session metadata', async () => {
    const result = await recordBillingHistory(db, ENV, evt('checkout.session.completed', { id: 'cs_1', mode: 'payment', payment_intent: 'pi_1', amount_total: 1530, currency: 'usd', metadata: { ...FAM } }), stripeDown(), NOW);
    expect(result).toMatchObject({ outcome: 'recorded', fresh: true });
    const rows = await db.billingEventsFor('space', 'space:fam', 10);
    expect(rows).toEqual([
      expect.objectContaining({ ...FAM, kind: 'purchase', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: 'pi_1', paymentRef: null, livemode: false, occurredAt: AT, createdAt: NOW.toISOString() }),
    ]);
  });

  it('records a payment made free by a code on its session id', async () => {
    await recordBillingHistory(db, ENV, evt('checkout.session.completed', { id: 'cs_free', mode: 'payment', payment_intent: null, amount_total: 0, currency: 'usd', metadata: { ...FAM } }), stripeDown(), NOW);
    expect(await db.billingEventByRef('stripe', 'cs_free', 'purchase')).toMatchObject({ amountCents: 0, providerRef: 'cs_free' });
  });

  it('records nothing for a subscription checkout: its first invoice.paid is the payment', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await recordBillingHistory(db, ENV, evt('checkout.session.completed', { id: 'cs_2', mode: 'subscription', subscription: 'sub_fam', amount_total: 1530, currency: 'usd', metadata: { ...FAM } }), fetchImpl, NOW)).toEqual({ outcome: 'ignored' });
    expect(await db.billingEventsFor('space', 'space:fam', 10)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('leaves a payment it cannot attach to a subject unrecorded', async () => {
    expect(await recordBillingHistory(db, ENV, evt('checkout.session.completed', { id: 'cs_3', mode: 'payment', payment_intent: 'pi_3', amount_total: 1530, currency: 'usd', metadata: {} }), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
  });
});

describe('invoice.paid', () => {
  it('records the first invoice as the purchase, with the payment intent from invoice_payments (2025 shape)', async () => {
    const fetchImpl = answer({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] });
    const result = await recordBillingHistory(db, ENV, evt('invoice.paid', invoice()), fetchImpl, NOW);
    expect(result).toMatchObject({ outcome: 'recorded', fresh: true, event: { kind: 'purchase', providerRef: 'in_1', paymentRef: 'pi_1', amountCents: 1530, occurredAt: AT } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('records a later invoice as a renewal, reading the older shape and invoice.payment_intent without a lookup', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const older = { id: 'in_2', billing_reason: 'subscription_cycle', amount_paid: 15300, currency: 'USD', subscription: 'sub_cls', subscription_details: { metadata: { ...CLS } }, payment_intent: 'pi_2', status_transitions: { paid_at: SEC } };
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', older, { livemode: true }), fetchImpl, NOW)).toMatchObject({ outcome: 'recorded', event: { ...CLS, kind: 'renewal', amountCents: 15300, currency: 'usd', paymentRef: 'pi_2', livemode: true } });
    expect(fetchImpl).not.toHaveBeenCalled();
    // An expanded payment intent object reads the same.
    await recordBillingHistory(db, ENV, evt('invoice.paid', { ...older, id: 'in_3', payment_intent: { id: 'pi_3' } }), fetchImpl, NOW);
    expect(await db.billingEventByRef('stripe', 'in_3', 'renewal')).toMatchObject({ paymentRef: 'pi_3' });
  });

  it('stores the row with no payment ref when the lookup fails, and the event still counts', async () => {
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', invoice()), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', event: { providerRef: 'in_1', paymentRef: null } });
  });

  it('finds the subject through the entitlement on the subscription when the invoice has no metadata', async () => {
    await db.applyEntitlement({ ...FAM, status: 'active', provider: 'stripe', providerRef: 'sub_fam', customerRef: 'cus_1', expiresAt: null }, NOW);
    const bare = invoice({ parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_fam', metadata: null } } });
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', bare), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', event: { ...FAM, kind: 'purchase' } });
    const old = { id: 'in_old', billing_reason: 'subscription_cycle', amount_paid: 1530, currency: 'usd', subscription: 'sub_fam' };
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', old), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', event: { ...FAM, kind: 'renewal', providerRef: 'in_old' } });
  });

  it('records nothing when no subject can be found', async () => {
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', { id: 'in_x', amount_paid: 100, currency: 'usd', subscription: 'sub_unknown' }), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', { metadata: {} }), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
  });

  it('is idempotent: a retried delivery keeps one row and reports it as not fresh; a later lookup fills a missing payment ref', async () => {
    await recordBillingHistory(db, ENV, evt('invoice.paid', invoice()), stripeDown(), NOW);
    const again = await recordBillingHistory(db, ENV, evt('invoice.paid', invoice()), answer({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] }), NOW);
    expect(again).toMatchObject({ outcome: 'recorded', fresh: false, event: { providerRef: 'in_1', paymentRef: 'pi_1' } });
    expect(await db.billingEventsFor('space', 'space:fam', 10)).toHaveLength(1);
    // Once the row has its payment ref, a further retry makes no Stripe call.
    const never = vi.fn<typeof fetch>();
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', invoice()), never, NOW)).toMatchObject({ outcome: 'recorded', fresh: false, event: { paymentRef: 'pi_1' } });
    expect(never).not.toHaveBeenCalled();
  });

  it('reports a row another delivery wrote meanwhile as not fresh (two deliveries at once)', async () => {
    const earlier = new Date(NOW.getTime() - 1000);
    await recordBillingHistory(db, ENV, evt('invoice.payment_failed', invoice()), stripeDown(), earlier);
    // This delivery's own read ran before the other one's insert.
    const racing = new Proxy(db, { get: (target, key) => (key === 'billingEventByRef' ? async () => null : Reflect.get(target, key)) });
    expect(await recordBillingHistory(racing, ENV, evt('invoice.payment_failed', invoice()), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', fresh: false });
  });

  it('looks up no payment for an invoice that cost nothing (a year made free by a code)', async () => {
    const never = vi.fn<typeof fetch>();
    expect(await recordBillingHistory(db, ENV, evt('invoice.paid', invoice({ id: 'in_free', amount_paid: 0 })), never, NOW)).toMatchObject({ outcome: 'recorded', event: { amountCents: 0, paymentRef: null } });
    expect(never).not.toHaveBeenCalled();
  });

  it('dates the row by when it was paid, else the event, else now; refuses an unreadable amount or currency', async () => {
    await recordBillingHistory(db, ENV, evt('invoice.paid', invoice({ id: 'in_a', status_transitions: {} })), stripeDown(), NOW);
    expect(await db.billingEventByRef('stripe', 'in_a', 'purchase')).toMatchObject({ occurredAt: AT });
    await recordBillingHistory(db, ENV, { type: 'invoice.paid', data: { object: invoice({ id: 'in_b', status_transitions: null }) } }, stripeDown(), NOW);
    expect(await db.billingEventByRef('stripe', 'in_b', 'purchase')).toMatchObject({ occurredAt: NOW.toISOString(), livemode: false });
    for (const bad of [{ amount_paid: -1 }, { amount_paid: 1.5 }, { amount_paid: '1530' }, { currency: 'us' }, { currency: null }, { id: null }]) {
      expect(await recordBillingHistory(db, ENV, evt('invoice.paid', invoice({ id: 'in_bad', ...bad })), stripeDown(), NOW), JSON.stringify(bad)).toEqual({ outcome: 'unmatched' });
    }
  });
});

describe('invoice.payment_failed', () => {
  it('records a failed row for the amount due, beside the paid row of the same invoice', async () => {
    const failed = invoice({ billing_reason: 'subscription_cycle', amount_paid: 0, amount_due: 1530, status_transitions: { paid_at: null } });
    expect(await recordBillingHistory(db, ENV, evt('invoice.payment_failed', failed), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', fresh: true, event: { kind: 'failed', amountCents: 1530, providerRef: 'in_1', occurredAt: AT } });
    await recordBillingHistory(db, ENV, evt('invoice.paid', invoice({ billing_reason: 'subscription_cycle' })), stripeDown(), NOW);
    const kinds = (await db.billingEventsFor('space', 'space:fam', 10)).map((e) => e.kind).sort();
    expect(kinds).toEqual(['failed', 'renewal']);
  });
});

describe('charge.refunded (OD-6 revised, BY-D8: recorded only)', () => {
  const charge = (over: Record<string, unknown> = {}): Record<string, unknown> => ({ id: 'ch_1', object: 'charge', amount: 1530, amount_refunded: 500, refunded: false, currency: 'usd', payment_intent: 'pi_1', ...over });

  async function paidInvoice(paymentRef: string | null, id = 'in_1', kind: 'purchase' | 'renewal' = 'purchase'): Promise<void> {
    await db.recordBillingEvent({ ...FAM, kind, amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: id, paymentRef, livemode: false, occurredAt: AT }, NOW);
  }

  it('records a partial then a full refund as the new part each time, matched through payment_ref', async () => {
    await paidInvoice('pi_1');
    const first = await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), stripeDown(), NOW);
    expect(first).toMatchObject({ outcome: 'recorded', fresh: true, full: false, event: { ...FAM, kind: 'refund', amountCents: 500, providerRef: 'ch_1:refund:500', paymentRef: 'pi_1' } });
    const second = await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ amount_refunded: 1530, refunded: true })), stripeDown(), NOW);
    expect(second).toMatchObject({ outcome: 'recorded', fresh: true, full: true, event: { kind: 'refund', amountCents: 1030, providerRef: 'ch_1:refund:1530' } });
    const refunds = (await db.billingEventsFor('space', 'space:fam', 10)).filter((e) => e.kind === 'refund');
    expect(refunds.map((e) => e.amountCents).sort((a, b) => a - b)).toEqual([500, 1030]);
  });

  it('matches a legacy one-time payment through its provider_ref (the payment intent)', async () => {
    await db.recordBillingEvent({ ...FAM, kind: 'purchase', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: 'pi_legacy', paymentRef: null, livemode: false, occurredAt: AT }, NOW);
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ payment_intent: { id: 'pi_legacy' }, amount_refunded: 1530, refunded: true })), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', full: true, event: { kind: 'refund', amountCents: 1530, paymentRef: 'pi_legacy' } });
  });

  it('falls back to the invoice: the charge\'s own invoice field (older versions), then invoice_payments (2025 versions)', async () => {
    await paidInvoice(null, 'in_7', 'renewal');
    const never = vi.fn<typeof fetch>();
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ invoice: 'in_7' })), never, NOW)).toMatchObject({ outcome: 'recorded', event: { kind: 'refund', amountCents: 500 } });
    expect(never).not.toHaveBeenCalled();

    await db.reset();
    await paidInvoice(null, 'in_8');
    // A failed attempt on the same invoice is newer, and still not what the refund belongs to.
    await db.recordBillingEvent({ ...FAM, kind: 'failed', amountCents: 1530, currency: 'usd', provider: 'stripe', providerRef: 'in_8', paymentRef: null, livemode: false, occurredAt: NOW.toISOString() }, NOW);
    const fetchImpl = answer({ data: [{ invoice: 'in_8', payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] });
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), fetchImpl, NOW)).toMatchObject({ outcome: 'recorded', event: { ...FAM, kind: 'refund', amountCents: 500, paymentRef: 'pi_1' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a refund it cannot match and records nowhere', async () => {
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), answer({ data: [] }), NOW)).toEqual({ outcome: 'unmatched' });
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), answer({ data: [{ invoice: 'in_not_ours' }] }), NOW)).toEqual({ outcome: 'unmatched' });
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ payment_intent: null })), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ id: 7 })), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
    await paidInvoice('pi_1');
    for (const bad of [{ amount_refunded: -5 }, { amount_refunded: 'x' }, { currency: 'dollars' }]) {
      expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge(bad)), stripeDown(), NOW), JSON.stringify(bad)).toEqual({ outcome: 'unmatched' });
    }
    expect((await db.billingEventsFor('space', 'space:fam', 10)).filter((e) => e.kind === 'refund')).toEqual([]);
  });

  it('asks Stripe to retry when the invoice lookup could not be made, instead of dropping the refund', async () => {
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), stripeDown(), NOW)).toEqual({ outcome: 'retry' });
    // Without a bound key there is nothing to retry with: acknowledged as unmatched.
    expect(await recordBillingHistory(db, {}, evt('charge.refunded', charge()), stripeDown(), NOW)).toEqual({ outcome: 'unmatched' });
    // Once the payment is recorded, the retry matches without the lookup.
    await paidInvoice('pi_1');
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', fresh: true });
  });

  it('a retried or older refund event adds nothing: the refund row already covering it is answered, not fresh', async () => {
    await paidInvoice('pi_1');
    await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ amount_refunded: 1530, refunded: true })), stripeDown(), NOW);
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ amount_refunded: 1530, refunded: true })), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', fresh: false, full: true, event: { providerRef: 'ch_1:refund:1530' } });
    // The partial refund's event arrives after the full one: it is inside what is recorded.
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), stripeDown(), NOW)).toMatchObject({ outcome: 'recorded', fresh: false, event: { providerRef: 'ch_1:refund:1530' } });
    expect((await db.billingEventsFor('space', 'space:fam', 10)).filter((e) => e.kind === 'refund')).toHaveLength(1);
  });

  it('counts each charge apart, and reads a full refund from the amounts when the flag is missing', async () => {
    await paidInvoice('pi_1');
    await paidInvoice('pi_2', 'in_2', 'renewal');
    await recordBillingHistory(db, ENV, evt('charge.refunded', charge()), stripeDown(), NOW);
    const other = await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ id: 'ch_2', payment_intent: 'pi_2', amount_refunded: 1530, refunded: undefined })), stripeDown(), NOW);
    expect(other).toMatchObject({ outcome: 'recorded', fresh: true, full: true, event: { amountCents: 1530, providerRef: 'ch_2:refund:1530' } });
  });

  it('keeps the paid row\'s payment ref on a refund of a charge that names no payment intent', async () => {
    await paidInvoice('pi_9', 'in_9');
    expect(await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ payment_intent: null, invoice: { id: 'in_9' }, amount: null })), stripeDown(), NOW)).toMatchObject({
      outcome: 'recorded',
      full: false,
      event: { kind: 'refund', amountCents: 500, paymentRef: 'pi_9' },
    });
  });

  it('dates a refund by its newest refund object, else the event', async () => {
    await paidInvoice('pi_1');
    const refundSec = SEC + 3600;
    await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ refunds: { data: [{ created: SEC + 60 }, { created: refundSec }, { created: 'x' }] } })), stripeDown(), NOW);
    expect(await db.billingEventByRef('stripe', 'ch_1:refund:500', 'refund')).toMatchObject({ occurredAt: new Date(refundSec * 1000).toISOString() });
  });

  it('changes no entitlement', async () => {
    const row: EntitlementApply = { ...FAM, status: 'active', provider: 'stripe', providerRef: 'sub_fam', customerRef: 'cus_1', expiresAt: '2027-10-11T08:00:00.000Z' };
    await db.applyEntitlement(row, NOW);
    const before = await db.entitlementsFor('space', 'space:fam');
    await paidInvoice('pi_1');
    await recordBillingHistory(db, ENV, evt('charge.refunded', charge({ amount_refunded: 1530, refunded: true })), stripeDown(), NOW);
    expect(await db.entitlementsFor('space', 'space:fam')).toEqual(before);
  });
});

describe('other events', () => {
  it('ignores events that write no history', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const type of ['customer.subscription.updated', 'invoice.created', 'charge.dispute.created', 'payment_intent.succeeded']) {
      expect(await recordBillingHistory(db, ENV, evt(type, invoice()), fetchImpl, NOW)).toEqual({ outcome: 'ignored' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('isDuplicateCompletion (a second paid checkout for a covered space, §4.4)', () => {
  const sub = (providerRef: string, over: Partial<EntitlementApply> = {}): EntitlementApply => ({ ...FAM, status: 'active', provider: 'stripe', providerRef, customerRef: 'cus_1', expiresAt: '2027-10-11T08:00:00.000Z', ...over });

  it('is true only while another Stripe subscription of the same plan covers the subject', async () => {
    const completion = sub('sub_b');
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(false);
    await db.applyEntitlement(sub('sub_b'), NOW);
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(false);
    await db.applyEntitlement(sub('sub_a'), NOW);
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(true);
  });

  it('is false for a legacy one-time row, a lapsed row or another plan', async () => {
    const completion = sub('sub_b');
    await db.applyEntitlement(sub('pi_legacy', { expiresAt: null }), NOW);
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(false);
    await db.applyEntitlement(sub('sub_a', { status: 'expired', expiresAt: '2026-01-01T00:00:00.000Z' }), NOW);
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(false);
    await db.applyEntitlement({ ...CLS, subjectId: 'space:fam', status: 'active', provider: 'stripe', providerRef: 'sub_c', expiresAt: '2027-10-11T08:00:00.000Z' }, NOW);
    expect(await isDuplicateCompletion(db, completion, NOW)).toBe(false);
    expect(await isDuplicateCompletion(db, sub('pi_new'), NOW)).toBe(false);
  });
});
