import { FREE_CLASS_STUDENT_CAP, PAST_DUE_GRACE_MS, SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS, type Entitlement, type Space, type Tier, type TierSource } from '@hangul-route/content-schema';
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

export interface SchoolLimits {
  licensed: boolean;
  /** null = unlimited */
  students: number | null;
  teachers: number | null;
  license: Entitlement | null;
}

/** What a school's licence allows — F-SCHOOL-001 §3.1. */
export function schoolLimits(school: Space, now: Date): SchoolLimits {
  const active = store.entitlementsFor('space', school.id).filter((e) => isEntitlementActive(e, now));
  const license = active.find((e) => e.planKey === 'school_license') ?? null;
  if (license) return { licensed: true, students: SCHOOL_LICENSE_STUDENTS, teachers: SCHOOL_LICENSE_TEACHERS, license };
  const seats = active.find((e) => e.planKey === 'school_seat') ?? null;
  if (seats) return { licensed: true, students: seats.seats ?? null, teachers: null, license: seats };
  return { licensed: false, students: null, teachers: null, license: null };
}

export interface SchoolUsage {
  students: number;
  teachers: number;
}

/** Distinct learners and teaching accounts across a school's live classes. */
export function schoolUsage(school: Space): SchoolUsage {
  const classes = store.childSpaces(school.id).filter((s) => s.kind === 'class' && !s.archivedAt);
  const learners = new Set<string>();
  const teachers = new Set<string>();
  for (const m of store.membersOf(school.id)) if (m.memberKind === 'account' && m.role === 'teacher') teachers.add(m.memberId);
  for (const cls of classes) {
    if (cls.ownerAccountId !== school.ownerAccountId) teachers.add(cls.ownerAccountId);
    for (const m of store.membersOf(cls.id)) {
      if (m.memberKind === 'learner') learners.add(m.memberId);
      else if (m.role === 'teacher' && m.memberId !== school.ownerAccountId) teachers.add(m.memberId);
    }
  }
  return { students: learners.size, teachers: teachers.size };
}

/** A licensed school's student limit blocks joins into its classes once reached (§3.1). */
export function schoolIsFull(cls: Space, now: Date, joiningLearnerId?: string): boolean {
  const school = cls.parentSpaceId ? store.spaces.get(cls.parentSpaceId) : undefined;
  if (!school || school.kind !== 'school') return false;
  const limits = schoolLimits(school, now);
  if (!limits.licensed || limits.students === null) return false;
  if (joiningLearnerId && store.childSpaces(school.id).some((s) => !s.archivedAt && store.membership(s.id, 'learner', joiningLearnerId))) return false; // already counted
  return schoolUsage(school).students >= limits.students;
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
