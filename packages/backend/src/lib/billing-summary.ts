import {
  FAMILY_LIFETIME_LEARNERS,
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
  type Membership,
  type ReceiptView,
  type Space,
  type SpaceKind,
  type StripeMode,
  type Usage,
} from '@hangul-route/content-schema';
import type { Db } from '../db';
import { newestBillingEvent } from '../db/billing-rules';
import { INVOICE_PAYMENTS_API_VERSION, STRIPE_LOOKUP_TIMEOUT_MS } from './billing-events';
import { adultSpacesOf, classCapFrom, isEntitlementActive, schoolLimitsFrom, schoolUsageFrom, type AdultSpace } from './entitlement';
import { billingLiveAllowed, stripeMode, type StripeEnv } from './stripe';

/**
 * The billing home's data — F-BILL-002 B-4 (sections 4.2, 4.6, 5.2, 5.3).
 * One card per space where the account is a grown-up; the payer (`billing.manage` [SA])
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

/**
 * Whether this deployment's Stripe key can open the row: a test key reads only
 * test rows and a live key only live rows (Stripe answers 404 across modes), so
 * after the switch to live the old sandbox rows carry no View receipt.
 */
export function rowInMode(row: Pick<BillingEvent, 'livemode'>, mode: StripeMode): boolean {
  return mode !== 'none' && row.livemode === (mode === 'live');
}

/** What a payer sees of a row: no Stripe id, no URL. */
export function receiptView(row: BillingEvent, mode: StripeMode): ReceiptView {
  return { id: row.id, kind: row.kind, planKey: row.planKey, amountCents: row.amountCents, currency: row.currency, livemode: row.livemode, occurredAt: row.occurredAt, hasReceipt: hasStripeReceipt(row) && rowInMode(row, mode) };
}

/** The reads of one summary, made set-based up front (one statement per list, whatever the account holds). */
interface SummaryReads {
  rowsOf: (spaceId: string) => readonly Entitlement[];
  membersOf: (spaceId: string) => readonly Membership[];
  childrenOf: (spaceId: string) => readonly Space[];
  eventsOf: (spaceId: string) => readonly BillingEvent[];
}

const groupBy = <T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k !== null) out.set(k, [...(out.get(k) ?? []), row]);
  }
  return out;
};

/** A plan that renews by itself until it is cancelled: a Stripe subscription, or any dated license or Family Plan row (never a legacy one-time row, BY-D2). */
function renews(row: Entitlement): boolean {
  return RENEWING_PLANS.includes(row.planKey) && (isStripeSubscriptionRef(row.providerRef) || row.expiresAt !== null);
}

/** One space's card before its usage and receipts are read, or null when the account does not see it. */
interface CardPlan {
  entry: AdultSpace;
  row: Entitlement | null;
  live: boolean;
  /** `billing.manage` ([SA]: the owner), except that the owner of a class inside a school is a viewer unless the class holds its own plan (the school pays, section 4.2). */
  payer: boolean;
}

function planCard(entry: AdultSpace, reads: Pick<SummaryReads, 'rowsOf'>, now: Date): CardPlan | null {
  const { space, parent } = entry;
  const row = shownPlanRow(reads.rowsOf(space.id), OWN_PLANS[space.kind], now);
  const inSchool = space.kind === 'class' && parent?.kind === 'school';
  const payer = entry.payer && (!inSchool || row !== null);
  // Archived spaces show only to their payers, and only until a renewing plan ends (it would otherwise renew unseen, sections 4.2 and 4.6).
  // `row` is active or past due here, so a past-due subscription Stripe still retries keeps its card and its Manage button.
  if (space.archivedAt && !(payer && row && renews(row))) return null;
  return { entry, row, live: !!row && isEntitlementActive(row, now), payer };
}

const finiteOrNull = (cap: number): number | null => (Number.isFinite(cap) ? cap : null);

/** [SA] Section 3.6: a school card's seat counts are for its owner (the payer) and its admins (no longer payers, SA-D11). */
function seesSchoolCounts(entry: Pick<AdultSpace, 'space' | 'role'>, payer: boolean): boolean {
  return entry.space.kind === 'school' && (payer || entry.role === 'admin');
}

function spaceCard(plan: CardPlan, reads: SummaryReads, mode: StripeMode, now: Date): BillingSpaceCard {
  const { entry, row, live, payer } = plan;
  const { space, parent, role } = entry;
  const inSchool = space.kind === 'class' && parent?.kind === 'school';

  let coverage: Coverage = { state: 'free' };
  if (row && space.kind === 'school' && !payer) {
    // A teacher member sees whose license covers them, not the school's own plan details.
    if (live) coverage = { state: 'school', schoolName: space.name, planKey: row.planKey === 'school_seat' ? 'school_seat' : 'group_license', expiresAt: row.expiresAt };
  } else if (row) {
    coverage = ownCoverage(row);
  } else if (inSchool && parent && !parent.archivedAt) {
    const schoolRow = shownPlanRow(reads.rowsOf(parent.id), OWN_PLANS.school, now);
    if (schoolRow && isEntitlementActive(schoolRow, now)) coverage = { state: 'school', schoolName: parent.name, planKey: schoolRow.planKey === 'school_seat' ? 'school_seat' : 'group_license', expiresAt: schoolRow.expiresAt };
  }
  const covered = coverage.state === 'school' || (coverage.state === 'own' && live);

  let usage: Usage | null;
  if (space.kind === 'school') {
    if (seesSchoolCounts(entry, payer)) {
      const limits = schoolLimitsFrom(reads.rowsOf(space.id), now);
      const counts = schoolUsageFrom(space, reads.childrenOf(space.id), reads.membersOf);
      usage = { learners: counts.students, learnerCap: limits.students, teachers: counts.teachers, teacherCap: limits.teachers };
    } else {
      usage = null; // seat counts are for the owner and the admins only
    }
  } else {
    const learners = reads.membersOf(space.id).filter((m) => m.memberKind === 'learner').length;
    // [SA] AMENDMENTS-SEATS-ADMINS section 3.6: every family holds up to 4 learners, paid or not; a class its
    // `classCapFrom` cap (20 free, 50 with its own licence, none under a covered school, whose card shows the
    // school count). Viewers get the count only (section 5.3).
    const learnerCap = !payer ? null : space.kind === 'family' ? FAMILY_LIFETIME_LEARNERS : finiteOrNull(classCapFrom(reads.rowsOf(space.id), inSchool ? parent : null, inSchool && parent ? reads.rowsOf(parent.id) : [], now));
    usage = { learners, learnerCap, teachers: null, teacherCap: null };
  }

  const events = payer ? reads.eventsOf(space.id) : [];
  return {
    spaceId: space.id,
    kind: space.kind,
    name: space.name,
    role,
    archived: !!space.archivedAt,
    payer,
    // A viewer sees who manages the plan; a class inside a school is managed by its school (section 4.2).
    readOnlyReason: payer ? null : inSchool ? 'school' : space.kind,
    coverage,
    usage,
    actions: {
      buy: payer && !space.archivedAt && !inSchool && coverage.state === 'free' ? BUYABLE[space.kind] : null,
      manage: payer && coverage.state === 'own' && manageable(row),
      contact: payer && space.kind === 'school',
    },
    receipts: events.map((e) => receiptView(e, mode)),
    hasReceipts: events.length > 0,
    legacyNoHistory: payer && events.length === 0 && coverage.state === 'own' && live && row?.provider === 'stripe',
  };
}

/**
 * Legacy account-subject rows (none are issued today): one card per plan while it
 * covers or is past due, each with that plan's own receipts.
 */
async function accountCards(db: Db, accountId: string, mode: StripeMode, now: Date): Promise<BillingAccountCard[]> {
  const rows = (await db.entitlementsFor('account', accountId)).filter((e) => isEntitlementActive(e, now) || e.status === 'past_due').sort(newestFirst);
  if (rows.length === 0) return [];
  // Enough rows for every card's latest few: account rows are rare and few.
  const events = await db.billingEventsFor('account', accountId, RECEIPTS_CARD_LIMIT * rows.length);
  return rows.map((row) => {
    const own = events.filter((e) => e.planKey === row.planKey).slice(0, RECEIPTS_CARD_LIMIT);
    return {
      coverage: ownCoverage(row),
      actions: { manage: manageable(row) },
      receipts: own.map((e) => receiptView(e, mode)),
      legacyNoHistory: own.length === 0 && row.provider === 'stripe' && isEntitlementActive(row, now),
    };
  });
}

/** Whether checkout and portal can run: test mode, or live once the owner opened it (section 4.9). */
export function purchasesOpen(env: StripeEnv): boolean {
  const mode = stripeMode(env);
  return mode === 'test' || (mode === 'live' && billingLiveAllowed(env));
}

/**
 * The billing home's data. The number of D1 statements does not grow with the
 * account's spaces or a school's classes (the Workers Free plan allows 50 per
 * invocation): the spaces, then one read each for their plans, their schools'
 * classes, their memberships and their payers' latest receipts.
 */
export async function billingSummaryFor(db: Db, env: StripeEnv, accountId: string, now: Date): Promise<BillingSummary> {
  const mode = stripeMode(env);
  const adult = await adultSpacesOf(db, accountId, now);
  const countedSchools = adult.entries.filter((e) => seesSchoolCounts(e, e.payer)).map((e) => e.space.id);
  const planIds = [...new Set(adult.entries.flatMap((e) => (e.parent ? [e.space.id, e.parent.id] : [e.space.id])))];
  const [rows, children] = await Promise.all([db.entitlementsForSpaces(planIds), countedSchools.length > 0 ? db.childSpacesOfSpaces(countedSchools) : Promise.resolve([])]);
  const rowsBySpace = groupBy(rows, (e) => e.subjectId);
  const rowsOf = (spaceId: string): readonly Entitlement[] => rowsBySpace.get(spaceId) ?? [];

  const plans = adult.entries.flatMap((entry) => planCard(entry, { rowsOf }, now) ?? []);
  const liveClasses = children.filter((s) => s.kind === 'class' && !s.archivedAt);
  const memberIds = [...new Set([...plans.filter((p) => p.entry.space.kind !== 'school' || seesSchoolCounts(p.entry, p.payer)).map((p) => p.entry.space.id), ...liveClasses.map((s) => s.id)])];
  const payerIds = plans.filter((p) => p.payer).map((p) => p.entry.space.id);
  const [members, events, account] = await Promise.all([
    memberIds.length > 0 ? db.membersOfSpaces(memberIds) : Promise.resolve([]),
    payerIds.length > 0 ? db.billingEventsForSpaces(payerIds, RECEIPTS_CARD_LIMIT) : Promise.resolve([]),
    accountCards(db, accountId, mode, now),
  ]);
  const membersBySpace = groupBy(members, (m) => m.spaceId);
  const childrenBySpace = groupBy(liveClasses, (s) => s.parentSpaceId);
  const eventsBySpace = groupBy(events, (e) => e.subjectId);
  const reads: SummaryReads = {
    rowsOf,
    membersOf: (spaceId) => membersBySpace.get(spaceId) ?? [],
    childrenOf: (spaceId) => childrenBySpace.get(spaceId) ?? [],
    eventsOf: (spaceId) => [...(eventsBySpace.get(spaceId) ?? [])].sort(newestBillingEvent).slice(0, RECEIPTS_CARD_LIMIT),
  };

  const cards = plans.map((plan) => ({ card: spaceCard(plan, reads, mode, now), createdAt: plan.entry.space.createdAt }));
  // Payers first; then family, class, school; then newest first (as GET /api/spaces).
  cards.sort((a, b) => Number(b.card.payer) - Number(a.card.payer) || KIND_ORDER[a.card.kind] - KIND_ORDER[b.card.kind] || b.createdAt.localeCompare(a.createdAt));
  return { mode, purchasesOpen: purchasesOpen(env), cards: cards.map((c) => c.card), account };
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
