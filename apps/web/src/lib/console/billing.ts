import type { Entitlement, PlanKey } from '@hangul-route/content-schema';
import type { EntitlementView, SpaceListItem } from './api';
import { COPY } from './copy';

/** Billing view models — F-ENT-001 §3.6 (wireframe console/billing). Prices stay placeholders. */
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PlanRow {
  planKey: PlanKey | 'free';
  title: string;
  includes: string;
  price: string;
  subjectKind: 'account' | 'space' | null;
  subjectId: string | null;
  subjectName: string | null;
  action: 'choose' | 'contact' | 'current' | 'none';
  recommended: boolean;
}

export const PLAN_TITLES: Record<PlanKey | 'free', string> = {
  free: 'Free',
  family_premium: 'Family Premium',
  teacher_pro: 'Teacher Pro',
  school_license: 'School License',
  school_seat: 'School Seats',
};

const INCLUDES: Record<PlanKey | 'free', string> = {
  free: 'Stage 1, 4 profiles, local progress, Rescue Code, file backup',
  family_premium: 'Stages 2–7, cloud sync, dashboard, family plans, up to 4 learners',
  teacher_pro: 'Unlimited classes and students, every student premium while enrolled, worksheets, templates',
  school_license: 'Up to 10 teachers / 300 students, all classes Pro, admin view',
  school_seat: 'Per-student seats, 300+, contract',
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
    canManage: e.provider === 'stripe' && !!e.customerRef,
  }));
}

/** Rows to offer this adult: one per owned family / school plus Teacher Pro for the account. */
export function planRowsFor(accountId: string, spaces: readonly SpaceListItem[], entitlements: readonly EntitlementView[], now: Date): PlanRow[] {
  const has = (kind: 'account' | 'space', id: string, plan: PlanKey): boolean => entitlements.some((e) => e.subjectKind === kind && e.subjectId === id && e.planKey === plan && isActive(e, now));
  const owned = spaces.filter((s) => s.role === 'owner' && !s.space.archivedAt);
  const rows: PlanRow[] = [{ planKey: 'free', title: PLAN_TITLES.free, includes: INCLUDES.free, price: '$0', subjectKind: null, subjectId: null, subjectName: null, action: entitlements.some((e) => isActive(e, now)) ? 'none' : 'current', recommended: false }];
  for (const s of owned.filter((x) => x.space.kind === 'family')) {
    const current = has('space', s.space.id, 'family_premium');
    rows.push({ planKey: 'family_premium', title: PLAN_TITLES.family_premium, includes: INCLUDES.family_premium, price: COPY.pricePlaceholder, subjectKind: 'space', subjectId: s.space.id, subjectName: s.space.name, action: current ? 'current' : 'choose', recommended: !current });
  }
  const teaches = owned.some((x) => x.space.kind === 'class');
  const pro = has('account', accountId, 'teacher_pro');
  if (teaches || pro) {
    rows.push({ planKey: 'teacher_pro', title: PLAN_TITLES.teacher_pro, includes: INCLUDES.teacher_pro, price: COPY.pricePlaceholder, subjectKind: 'account', subjectId: accountId, subjectName: null, action: pro ? 'current' : 'choose', recommended: !pro });
  }
  for (const s of owned.filter((x) => x.space.kind === 'school')) {
    const current = has('space', s.space.id, 'school_license') || has('space', s.space.id, 'school_seat');
    rows.push({ planKey: 'school_license', title: PLAN_TITLES.school_license, includes: INCLUDES.school_license, price: COPY.pricePlaceholder, subjectKind: 'space', subjectId: s.space.id, subjectName: s.space.name, action: current ? 'current' : 'choose', recommended: !current });
    rows.push({ planKey: 'school_seat', title: PLAN_TITLES.school_seat, includes: INCLUDES.school_seat, price: COPY.pricePlaceholder, subjectKind: 'space', subjectId: s.space.id, subjectName: s.space.name, action: 'contact', recommended: false });
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

/** Message for `?checkout=` on return from Stripe. */
export function checkoutReturnNotice(param: string | null): string | null {
  if (param === 'success') return COPY.billingSuccess;
  if (param === 'cancel') return COPY.billingCancelled;
  return null;
}
