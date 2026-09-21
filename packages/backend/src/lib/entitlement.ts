import { FREE_CLASS_STUDENT_CAP, PAST_DUE_GRACE_MS, type Entitlement, type Space, type Tier, type TierSource } from '@hangul-route/content-schema';
import { store } from '../store';

/** Entitlement rules — F-ENT-001 §3.2 (roadmap §3.2). */
export function isEntitlementActive(e: Entitlement, now: Date): boolean {
  const t = now.getTime();
  const future = e.expiresAt ? Date.parse(e.expiresAt) > t : null;
  switch (e.status) {
    case 'trial':
    case 'active':
      return future !== false;
    case 'cancelled':
      return future === true;
    case 'past_due':
      return Date.parse(e.updatedAt) + PAST_DUE_GRACE_MS > t;
    default:
      return false;
  }
}

function hasActive(subjectKind: Entitlement['subjectKind'], subjectId: string, planKeys: readonly Entitlement['planKey'][], now: Date): boolean {
  return store.entitlementsFor(subjectKind, subjectId).some((e) => planKeys.includes(e.planKey) && isEntitlementActive(e, now));
}

/** A class is "pro" through its owner's Teacher Pro or its school's licence. */
export function classIsPro(space: Space, now: Date): boolean {
  if (space.kind !== 'class') return false;
  if (hasActive('account', space.ownerAccountId, ['teacher_pro'], now)) return true;
  const parent = space.parentSpaceId ? store.spaces.get(space.parentSpaceId) : undefined;
  return !!parent && parent.kind === 'school' && hasActive('space', parent.id, ['school_license', 'school_seat'], now);
}

/** Students a class may hold: the free cap unless it is pro. */
export function classCap(space: Space, now: Date): number {
  return classIsPro(space, now) ? Number.POSITIVE_INFINITY : FREE_CLASS_STUDENT_CAP;
}

/** Premium when any live space the learner belongs to grants it (roadmap §3.2). */
export function tierForLearner(learnerId: string, now: Date): { tier: Tier; source: TierSource | null } {
  for (const m of store.membershipsOf('learner', learnerId)) {
    const space = store.spaces.get(m.spaceId);
    if (!space || space.archivedAt) continue;
    const covered = (space.kind === 'family' && hasActive('space', space.id, ['family_premium'], now)) || classIsPro(space, now);
    if (covered) return { tier: 'premium', source: { kind: space.kind, spaceId: space.id, name: space.name } };
  }
  return { tier: 'free', source: null };
}
