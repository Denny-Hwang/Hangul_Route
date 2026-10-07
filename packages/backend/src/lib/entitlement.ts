import { FREE_CLASS_STUDENT_CAP, PAST_DUE_GRACE_MS, SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS, type Entitlement, type Space, type Tier, type TierSource } from '@hangul-route/content-schema';
import type { Db } from '../db';

/** Entitlement rules — F-ENT-001 §3.2 (roadmap §3.2). A lifetime plan is `active` with `expiresAt` null, so it never lapses. */
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

async function hasActive(db: Db, subjectKind: Entitlement['subjectKind'], subjectId: string, planKeys: readonly Entitlement['planKey'][], now: Date): Promise<boolean> {
  return (await db.entitlementsFor(subjectKind, subjectId)).some((e) => planKeys.includes(e.planKey) && isEntitlementActive(e, now));
}

/** A class is "pro" through its own group licence or its school's licence / seat contract. */
export async function classIsPro(db: Db, space: Space, now: Date): Promise<boolean> {
  if (space.kind !== 'class') return false;
  if (await hasActive(db, 'space', space.id, ['group_license'], now)) return true;
  const parent = space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null;
  return !!parent && parent.kind === 'school' && (await hasActive(db, 'space', parent.id, ['group_license', 'school_seat'], now));
}

/** Students a class may hold: the free cap unless it is pro. */
export async function classCap(db: Db, space: Space, now: Date): Promise<number> {
  return (await classIsPro(db, space, now)) ? Number.POSITIVE_INFINITY : FREE_CLASS_STUDENT_CAP;
}

export interface SchoolLimits {
  licensed: boolean;
  /** null = unlimited */
  students: number | null;
  teachers: number | null;
  license: Entitlement | null;
}

/** What a school's licence allows — F-SCHOOL-001 §3.1. */
export async function schoolLimits(db: Db, school: Space, now: Date): Promise<SchoolLimits> {
  const active = (await db.entitlementsFor('space', school.id)).filter((e) => isEntitlementActive(e, now));
  const license = active.find((e) => e.planKey === 'group_license') ?? null;
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
export async function schoolUsage(db: Db, school: Space): Promise<SchoolUsage> {
  const classes = (await db.childSpaces(school.id)).filter((s) => s.kind === 'class' && !s.archivedAt);
  const learners = new Set<string>();
  const teachers = new Set<string>();
  for (const m of await db.membersOf(school.id)) if (m.memberKind === 'account' && m.role === 'teacher') teachers.add(m.memberId);
  for (const cls of classes) {
    if (cls.ownerAccountId !== school.ownerAccountId) teachers.add(cls.ownerAccountId);
    for (const m of await db.membersOf(cls.id)) {
      if (m.memberKind === 'learner') learners.add(m.memberId);
      else if (m.role === 'teacher' && m.memberId !== school.ownerAccountId) teachers.add(m.memberId);
    }
  }
  return { students: learners.size, teachers: teachers.size };
}

/** A licensed school's student limit blocks joins into its classes once reached (§3.1). */
export async function schoolIsFull(db: Db, cls: Space, now: Date, joiningLearnerId?: string): Promise<boolean> {
  const school = cls.parentSpaceId ? await db.getSpace(cls.parentSpaceId) : null;
  if (!school || school.kind !== 'school') return false;
  const limits = await schoolLimits(db, school, now);
  if (!limits.licensed || limits.students === null) return false;
  if (joiningLearnerId) {
    for (const s of await db.childSpaces(school.id)) {
      if (!s.archivedAt && (await db.membership(s.id, 'learner', joiningLearnerId))) return false; // already counted
    }
  }
  return (await schoolUsage(db, school)).students >= limits.students;
}

/** Premium when any live space the learner belongs to grants it (roadmap §3.2). */
export async function tierForLearner(db: Db, learnerId: string, now: Date): Promise<{ tier: Tier; source: TierSource | null }> {
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (!space || space.archivedAt) continue;
    const covered = (space.kind === 'family' && (await hasActive(db, 'space', space.id, ['family_lifetime'], now))) || (await classIsPro(db, space, now));
    if (covered) return { tier: 'premium', source: { kind: space.kind, spaceId: space.id, name: space.name } };
  }
  return { tier: 'free', source: null };
}
