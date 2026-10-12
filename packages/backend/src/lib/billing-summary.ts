import {
  FAMILY_LIFETIME_LEARNERS,
  FREE_CLASS_STUDENT_CAP,
  RECEIPTS_CARD_LIMIT,
  isStripeSubscriptionRef,
  type BillingAccountCard,
  type BillingEvent,
  type BillingSpaceCard,
  type BillingSummary,
  type Coverage,
  type Entitlement,
  type PlanKey,
  type PurchasablePlanKey,
  type ReadOnlyReason,
  type ReceiptView,
  type SpaceKind,
  type Usage,
} from '@hangul-route/content-schema';
import type { Db } from '../db';
import { INVOICE_PAYMENTS_API_VERSION, STRIPE_LOOKUP_TIMEOUT_MS } from './billing-events';
import { adultSpacesOf, isEntitlementActive, schoolLimits, schoolUsage, type AdultSpace, type AdultSpaces } from './entitlement';
import { billingLiveAllowed, stripeMode, type StripeEnv } from './stripe';

/**
 * The billing home's data — F-BILL-002 B-4 (sections 4.2, 4.6, 5.2, 5.3).
 * One card per space where the account is a grown-up; the payer (`space.manage`)
 * gets usage, actions and receipts, every viewer only coverage and status. Never
 * a learner name, a promo code, a price, a Stripe customer or a join code.
 * Reads only; no Stripe call (receipt links are fetched per click, `receiptUrl`).
 */

/** Which plans a space of each kind holds itself. */
const OWN_PLANS: Readonly<Record<SpaceKind, readonly PlanKey[]>> = { family: ['family_lifetime'], class: ['group_license'], school: ['group_license', 'school_seat'] };
/** What a payer of a free space can buy (a class inside a school cannot: its school pays). */
const BUYABLE: Readonly<Record<SpaceKind, PurchasablePlanKey>> = { family: 'family_lifetime', class: 'group_license', school: 'group_license' };
/** An archived space stays on its payer's page while one of these still renews ([BY]: the Family Plan too). */
const RENEWING_PLANS: readonly PlanKey[] = ['family_lifetime', 'group_license'];
const KIND_ORDER: Readonly<Record<SpaceKind, number>> = { family: 0, class: 1, school: 2 };

const newestFirst = (a: Entitlement, b: Entitlement): number => b.updatedAt.localeCompare(a.updatedAt);

/**
 * The row a card shows for a space's own plan: the newest active row, else the
 * newest past-due row (its grace may be over: the card says "paused" and offers
 * Manage subscription to fix the card, not a second purchase). Ended rows are
 * history, not coverage.
 */
export function shownPlanRow(rows: readonly Entitlement[], planKeys: readonly PlanKey[], now: Date): Entitlement | null {
  const own = rows.filter((e) => planKeys.includes(e.planKey)).sort(newestFirst);
  return own.find((e) => isEntitlementActive(e, now)) ?? own.find((e) => e.status === 'past_due') ?? null;
}

function ownCoverage(row: Entitlement): Coverage {
  return { state: 'own', planKey: row.planKey, status: row.status, expiresAt: row.expiresAt, statusSince: row.updatedAt, endsAtPeriodEnd: row.status === 'cancelled' };
}

/** A renewing Stripe subscription the portal can manage (as `POST /stripe/portal` finds it); a legacy one-time row cannot. */
function manageable(row: Entitlement | null): boolean {
  return !!row && row.provider === 'stripe' && !!row.customerRef && isStripeSubscriptionRef(row.providerRef);
}

/** The charge id inside a refund row's `provider_ref` (`<charge>:refund:<cents>`), or null. */
function refundCharge(providerRef: string): string | null {
  const at = providerRef.indexOf(':refund:');
  return at > 0 ? providerRef.slice(0, at) : null;
}

/**
 * Whether Stripe keeps a receipt page for the row: an invoice (`in_`), a legacy
 * one-time payment intent (`pi_`) or a refunded charge. A free checkout (session
 * id, 100%-off code) and a non-Stripe row have none.
 */
export function hasStripeReceipt(row: Pick<BillingEvent, 'provider' | 'kind' | 'providerRef'>): boolean {
  if (row.provider !== 'stripe') return false;
  if (row.kind === 'refund') return refundCharge(row.providerRef) !== null;
  return row.providerRef.startsWith('in_') || row.providerRef.startsWith('pi_');
}

/** What a payer sees of a row: no Stripe id, no URL. */
export function receiptView(row: BillingEvent): ReceiptView {
  return { id: row.id, kind: row.kind, planKey: row.planKey, amountCents: row.amountCents, currency: row.currency, livemode: row.livemode, occurredAt: row.occurredAt, hasReceipt: hasStripeReceipt(row) };
}

function readOnlyReason(entry: AdultSpace): ReadOnlyReason | null {
  // A class inside a school: the school pays, even for the class owner (section 4.2).
  if (entry.space.kind === 'class' && entry.parent?.kind === 'school') return 'school';
  if (entry.payer) return null;
  return entry.space.kind;
}

async function spaceCard(db: Db, adult: AdultSpaces, entry: AdultSpace, now: Date): Promise<BillingSpaceCard | null> {
  const { space, parent, payer, role } = entry;
  const row = shownPlanRow(await adult.rowsFor(space.id), OWN_PLANS[space.kind], now);
  const live = !!row && isEntitlementActive(row, now);
  // Archived spaces show only to their payers, only while a plan still renews (it would otherwise renew unseen).
  if (space.archivedAt && !(payer && live && row && RENEWING_PLANS.includes(row.planKey))) return null;

  let coverage: Coverage = { state: 'free' };
  if (row && space.kind === 'school' && !payer) {
    // A teacher member sees whose license covers them, not the school's own plan details.
    if (live) coverage = { state: 'school', schoolName: space.name, planKey: row.planKey === 'school_seat' ? 'school_seat' : 'group_license', expiresAt: row.expiresAt };
  } else if (row) {
    coverage = ownCoverage(row);
  } else if (space.kind === 'class' && parent?.kind === 'school' && !parent.archivedAt) {
    const schoolRow = shownPlanRow(await adult.rowsFor(parent.id), OWN_PLANS.school, now);
    if (schoolRow && isEntitlementActive(schoolRow, now)) coverage = { state: 'school', schoolName: parent.name, planKey: schoolRow.planKey === 'school_seat' ? 'school_seat' : 'group_license', expiresAt: schoolRow.expiresAt };
  }
  const covered = coverage.state === 'school' || (coverage.state === 'own' && live);

  let usage: Usage | null;
  if (space.kind === 'school') {
    if (payer) {
      const [limits, counts] = await Promise.all([schoolLimits(db, space, now), schoolUsage(db, space)]);
      usage = { learners: counts.students, learnerCap: limits.students, teachers: counts.teachers, teacherCap: limits.teachers };
    } else {
      usage = null; // seat counts are for payers only
    }
  } else {
    const learners = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner').length;
    // Every family holds up to five learners, paid or not (AS2); a class is capped until it is covered.
    const learnerCap = space.kind === 'family' ? FAMILY_LIFETIME_LEARNERS : covered ? null : FREE_CLASS_STUDENT_CAP;
    usage = { learners, learnerCap, teachers: null, teacherCap: null };
  }

  const inSchool = space.kind === 'class' && parent?.kind === 'school';
  const events = payer ? await db.billingEventsFor('space', space.id, RECEIPTS_CARD_LIMIT) : [];
  return {
    spaceId: space.id,
    kind: space.kind,
    name: space.name,
    role,
    archived: !!space.archivedAt,
    payer,
    readOnlyReason: readOnlyReason(entry),
    coverage,
    usage,
    actions: {
      buy: payer && !space.archivedAt && !inSchool && coverage.state === 'free' ? BUYABLE[space.kind] : null,
      manage: payer && coverage.state === 'own' && manageable(row),
      contact: payer && space.kind === 'school',
    },
    receipts: events.map(receiptView),
    hasReceipts: events.length > 0,
    legacyNoHistory: payer && events.length === 0 && coverage.state === 'own' && live && row?.provider === 'stripe',
  };
}

/** Legacy account-subject rows (none are issued today): one card each while it covers or is past due. */
async function accountCards(db: Db, accountId: string, now: Date): Promise<BillingAccountCard[]> {
  const rows = (await db.entitlementsFor('account', accountId)).filter((e) => isEntitlementActive(e, now) || e.status === 'past_due').sort(newestFirst);
  if (rows.length === 0) return [];
  const events = await db.billingEventsFor('account', accountId, RECEIPTS_CARD_LIMIT);
  return rows.map((row) => ({
    coverage: ownCoverage(row),
    actions: { manage: manageable(row) },
    receipts: events.map(receiptView),
    legacyNoHistory: events.length === 0 && row.provider === 'stripe' && isEntitlementActive(row, now),
  }));
}

/** Whether checkout and portal can run: test mode, or live once the owner opened it (section 4.9). */
export function purchasesOpen(env: StripeEnv): boolean {
  const mode = stripeMode(env);
  return mode === 'test' || (mode === 'live' && billingLiveAllowed(env));
}

export async function billingSummaryFor(db: Db, env: StripeEnv, accountId: string, now: Date): Promise<BillingSummary> {
  const adult = await adultSpacesOf(db, accountId, now);
  const cards: Array<{ card: BillingSpaceCard; createdAt: string }> = [];
  for (const entry of adult.entries) {
    const card = await spaceCard(db, adult, entry, now);
    if (card) cards.push({ card, createdAt: entry.space.createdAt });
  }
  // Payers first; then family, class, school; then newest first (as GET /api/spaces).
  cards.sort((a, b) => Number(b.card.payer) - Number(a.card.payer) || KIND_ORDER[a.card.kind] - KIND_ORDER[b.card.kind] || b.createdAt.localeCompare(a.createdAt));
  return { mode: stripeMode(env), purchasesOpen: purchasesOpen(env), cards: cards.map((c) => c.card), account: await accountCards(db, accountId, now) };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** `GET` one Stripe object, pinned to the same API version as the webhook lookups; null on any trouble. */
async function stripeGet(env: StripeEnv, path: string, fetchImpl: typeof fetch): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY ?? ''}`, 'Stripe-Version': INVOICE_PAYMENTS_API_VERSION },
      signal: AbortSignal.timeout(STRIPE_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

const urlOf = (value: unknown): string | null => (typeof value === 'string' && value.startsWith('https://') ? value : null);

/**
 * A fresh Stripe receipt or invoice page for one row (section 4.10): an invoice
 * → `hosted_invoice_url`; a legacy one-time payment → its latest charge's
 * `receipt_url`; a refund → the refunded charge's `receipt_url` (Stripe shows
 * the refund there). Null when Stripe cannot give one. The URL is never stored
 * or logged: it is a capability link to the payer's name and address.
 */
export async function receiptUrl(env: StripeEnv, row: BillingEvent, fetchImpl: typeof fetch): Promise<string | null> {
  const charge = row.kind === 'refund' ? refundCharge(row.providerRef) : null;
  if (charge) return urlOf((await stripeGet(env, `charges/${encodeURIComponent(charge)}`, fetchImpl))?.receipt_url);
  if (row.providerRef.startsWith('in_')) return urlOf((await stripeGet(env, `invoices/${encodeURIComponent(row.providerRef)}`, fetchImpl))?.hosted_invoice_url);
  const intent = await stripeGet(env, `payment_intents/${encodeURIComponent(row.providerRef)}?${new URLSearchParams({ 'expand[]': 'latest_charge' }).toString()}`, fetchImpl);
  const latest = intent?.latest_charge;
  return isRecord(latest) ? urlOf(latest.receipt_url) : null;
}
