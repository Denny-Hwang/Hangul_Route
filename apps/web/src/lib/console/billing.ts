import { FAMILY_LIFETIME_LEARNERS, PLAN_PRICING, SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS, discountedUsd, promoLabel, type Entitlement, type PlanKey, type Promo } from '@hangul-route/content-schema';
import type { EntitlementView, SpaceListItem } from './api';
import { COPY } from './copy';

/** Billing view models — F-ENT-001 §3.6 (wireframe console/billing). Two products (decision #30): family once, group yearly, contract beyond the caps. */
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PlanRow {
  planKey: PlanKey | 'free';
  title: string;
  includes: string;
  price: string;
  subjectKind: 'space' | null;
  subjectId: string | null;
  subjectName: string | null;
  action: 'choose' | 'contact' | 'current' | 'none';
  recommended: boolean;
}

export const PLAN_TITLES: Record<PlanKey | 'free', string> = {
  free: 'Free',
  family_lifetime: 'Family Lifetime',
  group_license: 'Group License',
  school_seat: 'School Contract',
};

export const PLAN_PRICE: Record<PlanKey | 'free', string> = {
  free: '$0',
  family_lifetime: PLAN_PRICING.family_lifetime.label,
  group_license: PLAN_PRICING.group_license.label,
  school_seat: 'Contact us',
};

const INCLUDES: Record<PlanKey | 'free', string> = {
  free: 'Stage 1, local progress, Rescue Code, file backup; classes up to 20 students',
  family_lifetime: `Every Stage, now and later, for one family: up to ${FAMILY_LIFETIME_LEARNERS} learners, cloud sync, grown-up dashboard and plans`,
  group_license: `A class or school: every student premium while enrolled, no 20-student cap; a school holds up to ${SCHOOL_LICENSE_TEACHERS} teachers / ${SCHOOL_LICENSE_STUDENTS} students`,
  school_seat: `Beyond ${SCHOOL_LICENSE_STUDENTS} students or ${SCHOOL_LICENSE_TEACHERS} teachers — seats by contract`,
};

/** Mirror of the server rule so the page can label cards without a round trip. */
export function isActive(e: Entitlement, now: Date): boolean {
  const t = now.getTime();
  const future = e.expiresAt ? Date.parse(e.expiresAt) > t : null;
  if (e.status === 'trial' || e.status === 'active') return future !== false;
  if (e.status === 'cancelled') return future === true;
  if (e.status === 'past_due') return Date.parse(e.updatedAt) + PAST_DUE_GRACE_MS > t;
  return false;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
function day(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function statusLine(e: Entitlement, now: Date): string {
  const when = e.expiresAt ? day(e.expiresAt) : null;
  switch (e.status) {
    case 'trial':
      return when ? `trial · ends ${when}` : 'trial';
    case 'active':
      if (e.planKey === 'family_lifetime') return 'active · yours for good';
      return when ? `active · renews ${when}` : 'active';
    case 'past_due':
      return isActive(e, now) ? 'payment needs attention · premium kept for a week' : 'payment needs attention · premium paused';
    case 'cancelled':
      return when && isActive(e, now) ? `cancelled · ends ${when}` : 'cancelled';
    default:
      return when ? `ended ${when}` : 'ended';
  }
}

export const PROVIDER_LABEL: Record<Entitlement['provider'], string> = { stripe: 'web (Stripe)', apple: 'App Store', google: 'Google Play', manual: 'contract' };

export interface CurrentPlanCard {
  entitlement: EntitlementView;
  title: string;
  subject: string;
  status: string;
  active: boolean;
  canManage: boolean;
}

export function currentPlanCards(entitlements: readonly EntitlementView[], now: Date): CurrentPlanCard[] {
  return entitlements.map((e) => ({
    entitlement: e,
    title: PLAN_TITLES[e.planKey],
    subject: e.subjectKind === 'account' ? 'your account' : (e.subjectName ?? e.subjectId),
    status: statusLine(e, now),
    active: isActive(e, now),
    canManage: e.provider === 'stripe' && !!e.customerRef && e.planKey !== 'family_lifetime',
  }));
}

/**
 * Rows to offer this adult: Family Lifetime per owned family, Group License per owned
 * stand-alone class (a class inside a school is covered by the school) and per owned
 * school, plus the contract row for each school.
 */
export function planRowsFor(_accountId: string, spaces: readonly SpaceListItem[], entitlements: readonly EntitlementView[], now: Date): PlanRow[] {
  const has = (id: string, plan: PlanKey): boolean => entitlements.some((e) => e.subjectKind === 'space' && e.subjectId === id && e.planKey === plan && isActive(e, now));
  const owned = spaces.filter((s) => s.role === 'owner' && !s.space.archivedAt);
  const row = (planKey: PlanKey, s: SpaceListItem, action: PlanRow['action'], recommended: boolean): PlanRow => ({ planKey, title: PLAN_TITLES[planKey], includes: INCLUDES[planKey], price: PLAN_PRICE[planKey], subjectKind: 'space', subjectId: s.space.id, subjectName: s.space.name, action, recommended });
  const rows: PlanRow[] = [{ planKey: 'free', title: PLAN_TITLES.free, includes: INCLUDES.free, price: PLAN_PRICE.free, subjectKind: null, subjectId: null, subjectName: null, action: entitlements.some((e) => isActive(e, now)) ? 'none' : 'current', recommended: false }];
  for (const s of owned.filter((x) => x.space.kind === 'family')) {
    const current = has(s.space.id, 'family_lifetime');
    rows.push(row('family_lifetime', s, current ? 'current' : 'choose', !current));
  }
  for (const s of owned.filter((x) => x.space.kind === 'class' && !x.space.parentSpaceId)) {
    const current = has(s.space.id, 'group_license');
    rows.push(row('group_license', s, current ? 'current' : 'choose', !current));
  }
  for (const s of owned.filter((x) => x.space.kind === 'school')) {
    const current = has(s.space.id, 'group_license') || has(s.space.id, 'school_seat');
    rows.push(row('group_license', s, current ? 'current' : 'choose', !current));
    rows.push(row('school_seat', s, 'contact', false));
  }
  // Only the first recommendation carries the primary button (wireframe: one [[ CHOOSE ]]).
  let seen = false;
  return rows.map((r) => {
    if (!r.recommended) return r;
    if (seen) return { ...r, recommended: false };
    seen = true;
    return r;
  });
}

/**
 * Price line once a code is applied — "$12.24 with HOYA20 (20% off), was $15.30" (F-ENT-002 §3.3).
 * A yearly licence on a one-charge coupon says so; null when the plan is not purchasable.
 */
export function promoPriceLine(planKey: PlanKey | 'free', promo: Promo | null): string | null {
  if (!promo || (planKey !== 'family_lifetime' && planKey !== 'group_license')) return null;
  const pricing = PLAN_PRICING[planKey];
  const after = discountedUsd(pricing.amountUsd, promo);
  const unit = pricing.per === 'year' ? ' / year' : ' once';
  const scope = pricing.per === 'year' && promo.duration === 'once' ? ', first year' : '';
  return `$${after.toFixed(2)}${unit} with ${promo.code} (${promoLabel(promo)}${scope}), was ${pricing.label}`;
}

/** Message for `?checkout=` on return from Stripe. */
export function checkoutReturnNotice(param: string | null): string | null {
  if (param === 'success') return COPY.billingSuccess;
  if (param === 'cancel') return COPY.billingCancelled;
  return null;
}
