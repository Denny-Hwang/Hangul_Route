import {
  FAMILY_LIFETIME_LEARNERS,
  FREE_CLASS_STUDENT_CAP,
  GROUP_LICENSE_LEARNERS,
  PAST_DUE_GRACE_MS,
  SCHOOL_LEARNER_CAP,
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

const activeIn = (rows: readonly Entitlement[], planKeys: readonly Entitlement['planKey'][], now: Date): boolean =>
  rows.some((e) => planKeys.includes(e.planKey) && isEntitlementActive(e, now));

/**
 * [SA] The learner cap of a class from rows already read (AMENDMENTS-SEATS-ADMINS section 3.2), checked in this
 * order: a live school with an active licence or School Contract decides (no class cap, the school's cap binds:
 * `Infinity`); otherwise the class's own active Group License (50); otherwise the free cap (20). An archived school
 * covers nothing here: its classes keep their own cap.
 */
export function classCapFrom(ownRows: readonly Entitlement[], school: Space | null, schoolRows: readonly Entitlement[], now: Date): number {
  if (school && school.kind === 'school' && !school.archivedAt && activeIn(schoolRows, ['group_license', 'school_seat'], now)) return Number.POSITIVE_INFINITY;
  if (activeIn(ownRows, ['group_license'], now)) return GROUP_LICENSE_LEARNERS;
  return FREE_CLASS_STUDENT_CAP;
}

/** [SA] Students a class may hold (section 3.2): `Infinity` under a covered school, else 50 with its own licence, else 20. */
export async function classCap(db: Db, space: Space, now: Date): Promise<number> {
  const parent = space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null;
  const school = parent?.kind === 'school' ? parent : null;
  return classCapFrom(await db.entitlementsFor('space', space.id), school, school ? await db.entitlementsFor('space', school.id) : [], now);
}

export interface SchoolLimits {
  licensed: boolean;
  /** null = unlimited (a School Contract without seats) */
  students: number | null;
  teachers: number | null;
  license: Entitlement | null;
}

/** What a school's licence allows — F-SCHOOL-001 §3.1. */
export async function schoolLimits(db: Db, school: Space, now: Date): Promise<SchoolLimits> {
  return schoolLimitsFrom(await db.entitlementsFor('space', school.id), now);
}

/**
 * `schoolLimits` from rows already read (the school's own entitlement rows). [SA] section 3.2: a licence holds 50
 * students and 10 teachers, a contract its `seats` (null = no cap), and a school with nothing active still holds
 * `SCHOOL_LEARNER_CAP` (50) students (`licensed: false`, no teacher cap).
 */
export function schoolLimitsFrom(rows: readonly Entitlement[], now: Date): SchoolLimits {
  const active = rows.filter((e) => isEntitlementActive(e, now));
  const license = active.find((e) => e.planKey === 'group_license') ?? null;
  if (license) return { licensed: true, students: SCHOOL_LICENSE_STUDENTS, teachers: SCHOOL_LICENSE_TEACHERS, license };
  const seats = active.find((e) => e.planKey === 'school_seat') ?? null;
  if (seats) return { licensed: true, students: seats.seats ?? null, teachers: null, license: seats };
  return { licensed: false, students: SCHOOL_LEARNER_CAP, teachers: null, license: null };
}

/** [SA] Every learner cap a join into `space` meets, in one read (section 3.3); `null` = no such cap. */
export interface LearnerCaps {
  /** The space's own cap: a family 4, a class 20 or 50; null for a class under a covered school. */
  cap: number | null;
  /** The live school above a class, whose distinct students are capped too. */
  schoolId: string | null;
  schoolCap: number | null;
}

/** [SA] `LearnerCaps` of a family or a class (a school takes no learner joins: no caps). */
export async function learnerCapOf(db: Db, space: Space, now: Date): Promise<LearnerCaps> {
  if (space.kind === 'family') return { cap: FAMILY_LIFETIME_LEARNERS, schoolId: null, schoolCap: null };
  if (space.kind !== 'class') return { cap: null, schoolId: null, schoolCap: null };
  const parent = space.parentSpaceId ? await db.getSpace(space.parentSpaceId) : null;
  const school = parent?.kind === 'school' ? parent : null;
  const schoolRows = school ? await db.entitlementsFor('space', school.id) : [];
  const cap = classCapFrom(await db.entitlementsFor('space', space.id), school, schoolRows, now);
  const live = school && !school.archivedAt ? school : null;
  return { cap: Number.isFinite(cap) ? cap : null, schoolId: live?.id ?? null, schoolCap: live ? schoolLimitsFrom(schoolRows, now).students : null };
}

export interface SchoolUsage {
  students: number;
  teachers: number;
}

/** Distinct learners and teaching accounts across a school's live classes. */
export async function schoolUsage(db: Db, school: Space): Promise<SchoolUsage> {
  const classes = (await db.childSpaces(school.id)).filter((s) => s.kind === 'class' && !s.archivedAt);
  // [SA] one set-wise read for the school and every live class (a fixed cost, not one read per class)
  const members = new Map<string, Membership[]>();
  for (const m of await db.membersOfSpaces([school.id, ...classes.map((cls) => cls.id)])) {
    const list = members.get(m.spaceId);
    if (list) list.push(m);
    else members.set(m.spaceId, [m]);
  }
  return schoolUsageFrom(school, classes, (spaceId) => members.get(spaceId) ?? []);
}

/** [SA] Whether the learner is in a live class of the school (it already holds a school seat): two reads, any class count. */
export async function inLiveClassOfSchool(db: Db, schoolId: string, learnerId: string): Promise<boolean> {
  const live = new Set((await db.childSpaces(schoolId)).filter((s) => s.kind === 'class' && !s.archivedAt).map((s) => s.id));
  if (live.size === 0) return false;
  return (await db.membershipsOf('learner', learnerId)).some((m) => live.has(m.spaceId));
}

/** `schoolUsage` from reads already made: the school's child spaces and each space's memberships. */
export function schoolUsageFrom(school: Space, children: readonly Space[], membersOf: (spaceId: string) => readonly Membership[]): SchoolUsage {
  const learners = new Set<string>();
  const teachers = new Set<string>();
  for (const m of membersOf(school.id)) if (m.memberKind === 'account' && m.role === 'teacher') teachers.add(m.memberId);
  for (const cls of children) {
    if (cls.kind !== 'class' || cls.archivedAt || cls.parentSpaceId !== school.id) continue;
    if (cls.ownerAccountId !== school.ownerAccountId) teachers.add(cls.ownerAccountId);
    for (const m of membersOf(cls.id)) {
      if (m.memberKind === 'learner') learners.add(m.memberId);
      else if (m.role === 'teacher' && m.memberId !== school.ownerAccountId) teachers.add(m.memberId);
    }
  }
  return { students: learners.size, teachers: teachers.size };
}

/**
 * A school's student limit blocks joins into its classes once reached (§3.1). [SA] section 3.2: every live school
 * has one (50 unless a School Contract says otherwise), licensed or not; an archived school takes none. A learner
 * already in a live class of the school takes no new seat.
 */
export async function schoolIsFull(db: Db, cls: Space, now: Date, joiningLearnerId?: string): Promise<boolean> {
  const school = cls.parentSpaceId ? await db.getSpace(cls.parentSpaceId) : null;
  if (!school || school.kind !== 'school' || school.archivedAt) return false;
  const limits = await schoolLimits(db, school, now);
  if (limits.students === null) return false;
  if (joiningLearnerId && (await inLiveClassOfSchool(db, school.id, joiningLearnerId))) return false; // already counted
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

/** A membership role that makes an account a grown-up of a space; `student` never counts. */
export type AdultRole = Exclude<SpaceRole, 'student'>;
const ADULT_ROLES: ReadonlySet<SpaceRole> = new Set<AdultRole>(['owner', 'caregiver', 'teacher', 'admin']);
const isAdultRole = (role: SpaceRole): role is AdultRole => ADULT_ROLES.has(role);

/**
 * One call's reads (D1 counts queries per invocation): the spaces are loaded
 * in one `getSpaces` call per layer, and each space's entitlement rows are
 * read at most once, however many classes share a school.
 */
interface CoverageReads {
  spaces: Map<string, Space>;
  rowsFor: (spaceId: string) => Promise<Entitlement[]>;
  activeFor: (spaceId: string, planKeys: readonly Entitlement['planKey'][]) => Promise<boolean>;
}

function coverageReads(db: Db, spaces: readonly Space[], now: Date): CoverageReads {
  const rows = new Map<string, Promise<Entitlement[]>>();
  const rowsFor = (spaceId: string): Promise<Entitlement[]> => {
    let pending = rows.get(spaceId);
    if (!pending) {
      pending = db.entitlementsFor('space', spaceId);
      rows.set(spaceId, pending);
    }
    return pending;
  };
  return {
    spaces: new Map(spaces.map((s) => [s.id, s])),
    rowsFor,
    activeFor: async (spaceId, planKeys) => (await rowsFor(spaceId)).some((e) => planKeys.includes(e.planKey) && isEntitlementActive(e, now)),
  };
}

/** One space an account holds a grown-up membership in, with its parent school and whether the account pays for it. */
export interface AdultSpace {
  membership: Membership;
  role: AdultRole;
  space: Space;
  parent: Space | null;
  /** `billing.manage`: the space's owner only ([SA] section 6.5; a school admin no longer pays, F-BILL-002 section 4.2 as amended). */
  payer: boolean;
}

/** The spaces of `adultSpacesOf`, with the reads they were loaded through (rows cached per space). */
export interface AdultSpaces extends Omit<CoverageReads, 'spaces'> {
  memberships: Membership[];
  entries: AdultSpace[];
}

/**
 * Every space in which the account holds an `owner`, `caregiver`, `teacher` or
 * `admin` membership (F-BILL-002 section 5.3's card set; learner memberships
 * never count), archived ones included, in membership order. One
 * `membershipsOf`, one `getSpaces` for the spaces and one for their parent
 * schools; entitlement rows are read lazily, once per space. Shared by the
 * browse rule (`adultCoveredAny`) and the billing summary.
 */
export async function adultSpacesOf(db: Db, accountId: string, now: Date): Promise<AdultSpaces> {
  const memberships = await db.membershipsOf('account', accountId);
  const adult = memberships.filter((m) => m.memberKind === 'account' && m.memberId === accountId && isAdultRole(m.role));
  if (adult.length === 0) {
    const reads = coverageReads(db, [], now);
    return { memberships, entries: [], rowsFor: reads.rowsFor, activeFor: reads.activeFor };
  }
  const spaces = await db.getSpaces(adult.map((m) => m.spaceId));
  const known = new Set(spaces.map((s) => s.id));
  const parentIds = [...new Set(spaces.flatMap((s) => (s.parentSpaceId && !known.has(s.parentSpaceId) ? [s.parentSpaceId] : [])))];
  const parents = parentIds.length > 0 ? await db.getSpaces(parentIds) : [];
  const reads = coverageReads(db, [...spaces, ...parents], now);
  const actor = { kind: 'account' as const, accountId, memberships };
  const entries: AdultSpace[] = [];
  for (const membership of adult) {
    const space = reads.spaces.get(membership.spaceId);
    if (!space || !isAdultRole(membership.role)) continue;
    const parent = space.parentSpaceId ? (reads.spaces.get(space.parentSpaceId) ?? null) : null;
    entries.push({ membership, role: membership.role, space, parent, payer: can(actor, 'billing.manage', { kind: 'space', ctx: { space, parent } }) });
  }
  return { memberships, entries, rowsFor: reads.rowsFor, activeFor: reads.activeFor };
}

/**
 * Whether one space an adult belongs to is covered (F-BILL-002 section 5.3's
 * card set). Live spaces: a family with an active family plan; a class with
 * its own active group licence or under a live school with an active licence
 * or seat contract; a school with an active licence or seat contract. An
 * archived space counts only for its payer (`billing.manage` [SA], F-BILL-002
 * section 4.2) while it still holds an active group licence, as the billing
 * home keeps showing it to them.
 */
async function adultSpaceCovered(reads: Pick<AdultSpaces, 'activeFor'>, { space, parent, payer }: AdultSpace): Promise<boolean> {
  if (space.archivedAt) return payer && (await reads.activeFor(space.id, ['group_license']));
  switch (space.kind) {
    case 'family':
      return reads.activeFor(space.id, ['family_lifetime']);
    case 'school':
      return reads.activeFor(space.id, ['group_license', 'school_seat']);
    case 'class':
      if (await reads.activeFor(space.id, ['group_license'])) return true;
      // Unlike `classIsPro`, a class is not covered through a school that was archived.
      return !!parent && parent.kind === 'school' && !parent.archivedAt && (await reads.activeFor(parent.id, ['group_license', 'school_seat']));
  }
}

/**
 * The browse scope rule (F-BROWSE-001 section 4.2), with F-BILL-002 section
 * 5.3's card set; F-BILL-002 exposes no paying-grown-up flag of its own
 * (its amendment B1), so this is the only such rule. True when any space in
 * which the account holds an `owner`, `caregiver`, `teacher` or `admin`
 * membership is covered, or the account holds an active account-subject row
 * (legacy). Learner memberships never count. Reads only: one `getSpaces` for
 * the spaces, one for their parent schools, and each space's entitlement
 * rows once.
 */
export async function adultCoveredAny(db: Db, accountId: string, now: Date): Promise<boolean> {
  if ((await db.entitlementsFor('account', accountId)).some((e) => isEntitlementActive(e, now))) return true;
  const adult = await adultSpacesOf(db, accountId, now);
  for (const entry of adult.entries) {
    if (await adultSpaceCovered(adult, entry)) return true;
  }
  return false;
}

/** Which lessons a signed-in grown-up may preview (F-BROWSE-001 section 4.2): every one when covered, else the free set. */
export async function accountBrowseScope(db: Db, accountId: string, now: Date): Promise<BrowseScopeResponse['scope']> {
  return (await adultCoveredAny(db, accountId, now)) ? 'full' : 'sampler';
}
