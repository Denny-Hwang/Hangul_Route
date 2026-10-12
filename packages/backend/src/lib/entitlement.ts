import {
  FREE_CLASS_STUDENT_CAP,
  PAST_DUE_GRACE_MS,
  SCHOOL_LICENSE_STUDENTS,
  SCHOOL_LICENSE_TEACHERS,
  type BrowseScopeResponse,
  type Entitlement,
  type Membership,
  type Space,
  type SpaceRole,
  type Tier,
  type TierSource,
} from '@hangul-route/content-schema';
import type { Db } from '../db';
import { can } from './can';

/**
 * Entitlement rules — F-ENT-001 §3.2 (roadmap §3.2). Yearly plans carry `expiresAt` = the Stripe
 * period end; a cancelled one covers until then. A row with `expiresAt` null (a legacy one-time
 * sandbox purchase, AMENDMENTS-BILLING-FAMILY-YEARLY BY-D2, or a manual contract) does not lapse.
 */
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

/**
 * The tier rule, in one place (F-SPACE-002 T7): premium when any live space in
 * `spaces` grants it — a family with an active Family Plan (`family_lifetime`), or a pro class.
 * The first covering space, in the order given, is the source. Archived
 * spaces are skipped.
 */
export async function tierFromSpaces(db: Db, spaces: readonly Space[], now: Date): Promise<{ tier: Tier; source: TierSource | null }> {
  for (const space of spaces) {
    if (space.archivedAt) continue;
    const covered = (space.kind === 'family' && (await hasActive(db, 'space', space.id, ['family_lifetime'], now))) || (await classIsPro(db, space, now));
    if (covered) return { tier: 'premium', source: { kind: space.kind, spaceId: space.id, name: space.name } };
  }
  return { tier: 'free', source: null };
}

/** Premium when any live space the learner belongs to grants it (roadmap §3.2). */
export async function tierForLearner(db: Db, learnerId: string, now: Date): Promise<{ tier: Tier; source: TierSource | null }> {
  const spaces: Space[] = [];
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (space) spaces.push(space);
  }
  return tierFromSpaces(db, spaces, now);
}

/**
 * The tier the learner would have after a class move (F-SPACE-002 §4.3, T6b):
 * the same rule over the learner's spaces with `fromSpaceId` taken out and
 * `toSpaceId` added. The destination goes last, where the move puts it (its
 * membership is the newest), so the reported source matches what
 * `tierForLearner` says once the move is done. Reads only.
 */
export async function tierAfterMove(db: Db, learnerId: string, fromSpaceId: string, toSpaceId: string, now: Date): Promise<{ tier: Tier; source: TierSource | null }> {
  const spaces: Space[] = [];
  let hasDestination = false;
  for (const m of await db.membershipsOf('learner', learnerId)) {
    if (m.spaceId === fromSpaceId) continue;
    if (m.spaceId === toSpaceId) hasDestination = true;
    const space = await db.getSpace(m.spaceId);
    if (space) spaces.push(space);
  }
  if (!hasDestination) {
    const destination = await db.getSpace(toSpaceId);
    if (destination) spaces.push(destination);
  }
  return tierFromSpaces(db, spaces, now);
}

/** Membership roles that make an account a grown-up of a space; `student` never counts. */
const ADULT_ROLES: ReadonlySet<SpaceRole> = new Set(['owner', 'caregiver', 'teacher', 'admin']);

/**
 * Whether one space an adult belongs to is covered (F-BILL-002 section 5.3's
 * card set). Live spaces: a family with an active family plan; a class with
 * its own active group licence or under a live school with an active licence
 * or seat contract; a school with an active licence or seat contract. An
 * archived space counts only for its payer (`space.manage`, F-BILL-002
 * section 4.2) while it still holds an active group licence, as the billing
 * home keeps showing it to them.
 */
async function adultSpaceCovered(db: Db, accountId: string, memberships: Membership[], space: Space, now: Date): Promise<boolean> {
  if (space.archivedAt) {
    const parent = space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null;
    const payer = can({ kind: 'account', accountId, memberships }, 'space.manage', { kind: 'space', ctx: { space, parent } });
    return payer && (await hasActive(db, 'space', space.id, ['group_license'], now));
  }
  switch (space.kind) {
    case 'family':
      return hasActive(db, 'space', space.id, ['family_lifetime'], now);
    case 'school':
      return hasActive(db, 'space', space.id, ['group_license', 'school_seat'], now);
    case 'class': {
      if (await hasActive(db, 'space', space.id, ['group_license'], now)) return true;
      // Unlike `classIsPro`, a class is not covered through a school that was archived.
      const school = space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null;
      return !!school && school.kind === 'school' && !school.archivedAt && (await hasActive(db, 'space', school.id, ['group_license', 'school_seat'], now));
    }
  }
}

/**
 * The paying-grown-up rule (F-BROWSE-001 section 4.2), the one helper behind
 * the browse scope and F-BILL-002's `adultAccess.coveredAny`: true when any
 * space in which the account holds an `owner`, `caregiver`, `teacher` or
 * `admin` membership is covered, or the account holds an active
 * account-subject row (legacy). Learner memberships never count. Reads only.
 */
export async function adultCoveredAny(db: Db, accountId: string, now: Date): Promise<boolean> {
  if ((await db.entitlementsFor('account', accountId)).some((e) => isEntitlementActive(e, now))) return true;
  const memberships = await db.membershipsOf('account', accountId);
  for (const m of memberships) {
    if (m.memberKind !== 'account' || m.memberId !== accountId || !ADULT_ROLES.has(m.role)) continue;
    const space = await db.getSpace(m.spaceId);
    if (space && (await adultSpaceCovered(db, accountId, memberships, space, now))) return true;
  }
  return false;
}

/** Which lessons a signed-in grown-up may preview (F-BROWSE-001 section 4.2): every one when covered, else the free set. */
export async function accountBrowseScope(db: Db, accountId: string, now: Date): Promise<BrowseScopeResponse['scope']> {
  return (await adultCoveredAny(db, accountId, now)) ? 'full' : 'sampler';
}
