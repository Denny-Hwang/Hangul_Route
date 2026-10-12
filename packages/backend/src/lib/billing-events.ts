import { isStripeSubscriptionRef, type BillingEvent, type BillingEventKind, type EntitlementApply } from '@hangul-route/content-schema';
import type { BillingEventInput, Db } from '../db/types';
import { isEntitlementActive } from './entitlement';
import { subjectFrom, type StripeEnv, type StripeEventLike } from './stripe';

/**
 * Payment history from Stripe webhooks — F-BILL-002 §5.4. A pure mapping of
 * each event onto a `billing_events` row (amounts, dates and Stripe ids only:
 * no card, name, email, address or receipt URL), the Db writes, and the two
 * Stripe lookups the 2025 API versions need, made through the injected fetch.
 *
 * It reads both invoice shapes: the subscription metadata under
 * `parent.subscription_details` (2025-03-31.basil and later, including the
 * 2025-09-30.clover a new sandbox defaults to) or `subscription_details`
 * (older), and the payment intent from `invoice.payment_intent` (older) or
 * `GET /v1/invoice_payments` (basil and later, where it is gone and
 * `invoice.payments` is not expanded in webhook payloads). A failed lookup
 * never fails the event: the row is stored without its `payment_ref`.
 *
 * A refund is recorded only. It never changes an entitlement (OD-6 as revised
 * by AMENDMENTS-BILLING-FAMILY-YEARLY BY-D8): Stripe's subscription events
 * decide coverage, and the owner cancels immediately to end a plan at once.
 */

/** A Stripe webhook event with the envelope fields history reads: when it happened and in which mode. */
export interface StripeWebhookEvent extends StripeEventLike {
  created?: unknown;
  livemode?: unknown;
}

type Subject = Pick<EntitlementApply, 'subjectKind' | 'subjectId' | 'planKey'>;

/**
 * What an event did to the history: `ignored` (not a history event, or a subscription checkout,
 * whose first `invoice.paid` is the payment), `unmatched` (a history event with no subject or row to
 * attach to; acknowledged and recorded nowhere), or `recorded` (`fresh` false for a retried delivery,
 * or for a refund an earlier-recorded row already covers). `full` says whether a refund refunded the
 * whole charge; it is false for every other kind.
 */
export type BillingHistoryOutcome =
  | { outcome: 'ignored' }
  | { outcome: 'unmatched' }
  | { outcome: 'recorded'; event: BillingEvent; fresh: boolean; full: boolean };

/** `invoice_payments` exists from 2025-03-31.basil; pinned so the shape does not follow the account's default version. */
export const INVOICE_PAYMENTS_API_VERSION = '2025-09-30.clover';

/** How many of a subject's newest rows a refund looks through for the earlier refunds of its charge (a few rows a year). */
export const REFUND_SCAN_LIMIT = 500;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A Stripe id that may arrive as a string or as an expanded object carrying `id`. */
function idOf(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
}

function unixSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

const isoFrom = (sec: number): string => new Date(sec * 1000).toISOString();

/** A whole, non-negative minor-unit amount, as Stripe sends it. */
function amountOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** ISO 4217, lower-case as stored (Stripe already sends lower case). */
function currencyOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  return /^[a-z]{3}$/.test(lower) ? lower : null;
}

/** `live` only when Stripe says the event is live; anything else reads as test. */
export function stripeModeOf(event: StripeWebhookEvent): 'test' | 'live' {
  return event.livemode === true ? 'live' : 'test';
}

/** The `provider_ref` of a refund row: the charge and the cumulative cents refunded on it so far. */
export function refundProviderRef(chargeId: string, cumulativeCents: number): string {
  return `${chargeId}:refund:${cumulativeCents}`;
}

/** The cumulative cents a refund row's `provider_ref` names, or null when it is not a refund ref of `chargeId`. */
function refundCumulative(providerRef: string, chargeId: string): number | null {
  const prefix = `${chargeId}:refund:`;
  if (!providerRef.startsWith(prefix)) return null;
  const n = Number(providerRef.slice(prefix.length));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * The subject and subscription of an invoice: the metadata our checkout put on the subscription,
 * under `parent.subscription_details` (2025 versions) or `subscription_details` (older), and the
 * subscription id from the same place or the older top-level `subscription`.
 */
export function invoiceSubject(invoice: Record<string, unknown>): { subject: Subject | null; subscriptionId: string | null } {
  const parent = isRecord(invoice.parent) && isRecord(invoice.parent.subscription_details) ? invoice.parent.subscription_details : null;
  const older = isRecord(invoice.subscription_details) ? invoice.subscription_details : null;
  const subject = subjectFrom(parent?.metadata) ?? subjectFrom(older?.metadata);
  const subscriptionId = idOf(parent?.subscription) ?? idOf(invoice.subscription);
  return { subject, subscriptionId };
}

/** `GET /v1/invoice_payments?…` → the list's rows, or null on any failure (no key, an error status, a thrown fetch, bad JSON). */
async function invoicePayments(env: StripeEnv, query: Record<string, string>, fetchImpl: typeof fetch): Promise<Record<string, unknown>[] | null> {
  if (!env.STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetchImpl(`https://api.stripe.com/v1/invoice_payments?${new URLSearchParams(query).toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': INVOICE_PAYMENTS_API_VERSION },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json().catch(() => null);
    return isRecord(body) && Array.isArray(body.data) ? body.data.filter(isRecord) : null;
  } catch {
    return null;
  }
}

const paymentIntentOfPayment = (row: Record<string, unknown>): string | null => (isRecord(row.payment) && row.payment.type === 'payment_intent' ? idOf(row.payment.payment_intent) : null);

/** The payment intent behind an invoice (the paid payment first, else the first one), or null. */
export async function paymentIntentForInvoice(env: StripeEnv, invoiceId: string, fetchImpl: typeof fetch): Promise<string | null> {
  const rows = await invoicePayments(env, { invoice: invoiceId }, fetchImpl);
  if (!rows) return null;
  const paid = rows.find((row) => row.status === 'paid' && paymentIntentOfPayment(row) !== null);
  return paymentIntentOfPayment(paid ?? rows.find((row) => paymentIntentOfPayment(row) !== null) ?? {});
}

/** The invoice a payment intent paid, or null. */
export async function invoiceForPaymentIntent(env: StripeEnv, paymentIntent: string, fetchImpl: typeof fetch): Promise<string | null> {
  const rows = await invoicePayments(env, { 'payment[type]': 'payment_intent', 'payment[payment_intent]': paymentIntent }, fetchImpl);
  for (const row of rows ?? []) {
    const invoice = idOf(row.invoice);
    if (invoice) return invoice;
  }
  return null;
}

/**
 * Whether a checkout completion lands on a subject that another Stripe subscription of the same
 * plan still covers: two checkouts paid in two tabs before either landed (§4.4). Checked before the
 * completion is applied. Best effort: when the second subscription's own `created` event lands
 * first, the row already carries it, and the completion reads as the only one.
 */
export async function isDuplicateCompletion(db: Db, completion: EntitlementApply, now: Date): Promise<boolean> {
  const rows = await db.entitlementsFor(completion.subjectKind, completion.subjectId);
  return rows.some(
    (e) => e.planKey === completion.planKey && e.provider === 'stripe' && isStripeSubscriptionRef(e.providerRef) && e.providerRef !== completion.providerRef && isEntitlementActive(e, now),
  );
}

/** Insert-or-keep, reporting whether this delivery wrote the row. */
async function record(db: Db, input: BillingEventInput, now: Date, full = false): Promise<BillingHistoryOutcome> {
  const existed = (await db.billingEventByRef(input.provider, input.providerRef, input.kind)) !== null;
  return { outcome: 'recorded', event: await db.recordBillingEvent(input, now), fresh: !existed, full };
}

function baseRow(subject: Subject, event: StripeWebhookEvent, occurredAt: string): Pick<BillingEventInput, 'subjectKind' | 'subjectId' | 'planKey' | 'provider' | 'livemode' | 'occurredAt'> {
  return { subjectKind: subject.subjectKind, subjectId: subject.subjectId, planKey: subject.planKey, provider: 'stripe', livemode: event.livemode === true, occurredAt };
}

const eventIso = (event: StripeWebhookEvent, now: Date): string => {
  const sec = unixSeconds(event.created);
  return sec === null ? now.toISOString() : isoFrom(sec);
};

/** A legacy one-time payment (`mode=payment`, no longer created): a purchase on its payment intent, or on the session when a code made it free. */
async function checkoutCompleted(db: Db, event: StripeWebhookEvent, now: Date): Promise<BillingHistoryOutcome> {
  const session = event.data.object;
  if (session.mode !== 'payment') return { outcome: 'ignored' };
  const subject = subjectFrom(session.metadata);
  const providerRef = idOf(session.payment_intent) ?? idOf(session.id);
  const amountCents = amountOf(session.amount_total);
  const currency = currencyOf(session.currency);
  if (!subject || !providerRef || amountCents === null || !currency) return { outcome: 'unmatched' };
  return record(db, { ...baseRow(subject, event, eventIso(event, now)), kind: 'purchase', amountCents, currency, providerRef, paymentRef: null }, now);
}

/** `invoice.paid` (purchase on the first invoice, else renewal) and `invoice.payment_failed`. */
async function invoiceEvent(db: Db, env: StripeEnv, event: StripeWebhookEvent, fetchImpl: typeof fetch, now: Date): Promise<BillingHistoryOutcome> {
  const invoice = event.data.object;
  const invoiceId = idOf(invoice.id);
  const failed = event.type === 'invoice.payment_failed';
  const amountCents = amountOf(failed ? invoice.amount_due : invoice.amount_paid);
  const currency = currencyOf(invoice.currency);
  if (!invoiceId || amountCents === null || !currency) return { outcome: 'unmatched' };
  const found = invoiceSubject(invoice);
  let subject = found.subject;
  if (!subject && found.subscriptionId) {
    const entitlement = await db.entitlementByProviderRef('stripe', found.subscriptionId);
    subject = entitlement ? { subjectKind: entitlement.subjectKind, subjectId: entitlement.subjectId, planKey: entitlement.planKey } : null;
  }
  if (!subject) return { outcome: 'unmatched' };
  const kind: BillingEventKind = failed ? 'failed' : invoice.billing_reason === 'subscription_create' ? 'purchase' : 'renewal';
  const paidAt = !failed && isRecord(invoice.status_transitions) ? unixSeconds(invoice.status_transitions.paid_at) : null;
  const occurredAt = paidAt === null ? eventIso(event, now) : isoFrom(paidAt);
  // Only a payment has a payment intent to match a refund against; a failed attempt does not need one.
  const paymentRef = failed ? null : (idOf(invoice.payment_intent) ?? (await paymentIntentForInvoice(env, invoiceId, fetchImpl)));
  return record(db, { ...baseRow(subject, event, occurredAt), kind, amountCents, currency, providerRef: invoiceId, paymentRef }, now);
}

/** The payment or renewal a refunded charge paid: by payment intent, then by the charge's invoice (older versions), then by `invoice_payments`. */
async function refundedPayment(db: Db, env: StripeEnv, charge: Record<string, unknown>, paymentIntent: string | null, fetchImpl: typeof fetch): Promise<BillingEvent | null> {
  const byInvoice = async (invoiceId: string | null): Promise<BillingEvent | null> =>
    invoiceId === null ? null : ((await db.billingEventByRef('stripe', invoiceId, 'purchase')) ?? (await db.billingEventByRef('stripe', invoiceId, 'renewal')));
  if (paymentIntent) {
    const direct = (await db.billingEventByRef('stripe', paymentIntent, 'purchase')) ?? (await db.billingEventByPaymentRef(paymentIntent));
    if (direct) return direct;
  }
  const own = await byInvoice(idOf(charge.invoice));
  if (own) return own;
  return paymentIntent ? byInvoice(await invoiceForPaymentIntent(env, paymentIntent, fetchImpl)) : null;
}

/** When the newest refund on the charge was made, else when the event was. */
function refundedAt(charge: Record<string, unknown>, event: StripeWebhookEvent, now: Date): string {
  const refunds = isRecord(charge.refunds) && Array.isArray(charge.refunds.data) ? charge.refunds.data : [];
  let latest: number | null = null;
  for (const refund of refunds) {
    const sec = isRecord(refund) ? unixSeconds(refund.created) : null;
    if (sec !== null && (latest === null || sec > latest)) latest = sec;
  }
  return latest === null ? eventIso(event, now) : isoFrom(latest);
}

/**
 * `charge.refunded`: a refund row for the part of `amount_refunded` not yet recorded on this
 * charge. Partial refunds each send the cumulative amount, so the new part is the cumulative
 * minus the largest cumulative already recorded; a retried or older event adds nothing and
 * answers the row that already covers it.
 */
async function chargeRefunded(db: Db, env: StripeEnv, event: StripeWebhookEvent, fetchImpl: typeof fetch, now: Date): Promise<BillingHistoryOutcome> {
  const charge = event.data.object;
  const chargeId = idOf(charge.id);
  const cumulative = amountOf(charge.amount_refunded);
  const currency = currencyOf(charge.currency);
  if (!chargeId || cumulative === null || !currency) return { outcome: 'unmatched' };
  const paymentIntent = idOf(charge.payment_intent);
  const paid = await refundedPayment(db, env, charge, paymentIntent, fetchImpl);
  if (!paid) return { outcome: 'unmatched' };
  const full = charge.refunded === true || (amountOf(charge.amount) !== null && cumulative >= (amountOf(charge.amount) ?? 0));

  let covering: BillingEvent | null = null;
  let recorded = 0;
  for (const row of await db.billingEventsFor(paid.subjectKind, paid.subjectId, REFUND_SCAN_LIMIT)) {
    const n = row.kind === 'refund' ? refundCumulative(row.providerRef, chargeId) : null;
    if (n !== null && n >= recorded) {
      recorded = n;
      covering = row;
    }
  }
  if (cumulative <= recorded) return covering ? { outcome: 'recorded', event: covering, fresh: false, full } : { outcome: 'unmatched' };

  const subject: Subject = { subjectKind: paid.subjectKind, subjectId: paid.subjectId, planKey: paid.planKey };
  return record(
    db,
    { ...baseRow(subject, event, refundedAt(charge, event, now)), kind: 'refund', amountCents: cumulative - recorded, currency, providerRef: refundProviderRef(chargeId, cumulative), paymentRef: paymentIntent ?? paid.paymentRef },
    now,
    full,
  );
}

/**
 * Records what a webhook event adds to the payment history (§5.4 table). Idempotent: a retried
 * delivery finds its row by the unique key and writes nothing new (a missing `payment_ref` is
 * filled when the retry has one). Never touches an entitlement.
 */
export async function recordBillingHistory(db: Db, env: StripeEnv, event: StripeWebhookEvent, fetchImpl: typeof fetch, now: Date): Promise<BillingHistoryOutcome> {
  switch (event.type) {
    case 'checkout.session.completed':
      return checkoutCompleted(db, event, now);
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return invoiceEvent(db, env, event, fetchImpl, now);
    case 'charge.refunded':
      return chargeRefunded(db, env, event, fetchImpl, now);
    default:
      return { outcome: 'ignored' };
  }
}
