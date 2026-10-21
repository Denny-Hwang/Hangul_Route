import { LEARNER_CLASS_CAP, type LookupSeat, type SeatCapCode, type Space } from '@hangul-route/content-schema';
import type { Db } from '../db';
import { classCap, learnerCapOf, schoolIsFull, schoolUsage } from './entitlement';

/**
 * Class seat checks — F-SPACE-002 §4.3. Extracted from the `/join` route so
 * join and (later) class transfer share one rule. Pure over `Db`.
 */

export type SeatBlock = 'cap_learner' | 'cap_class' | 'cap_school';

/** [SA] Every refusal a learner join can meet (AMENDMENTS-SEATS-ADMINS section 3.4): the class blocks and the family cap. */
export type SeatRefusal = SeatBlock | 'cap_family';

/** Learner members of a space (accounts are not seats). */
export async function studentsIn(db: Db, spaceId: string): Promise<number> {
  return (await db.membersOf(spaceId)).filter((m) => m.memberKind === 'learner').length;
}

/** Live (not archived) classes the learner is in, leaving out `excludeSpaceId` when given. */
export async function activeClassesOf(db: Db, learnerId: string, excludeSpaceId?: string): Promise<number> {
  let n = 0;
  for (const m of await db.membershipsOf('learner', learnerId)) {
    if (m.spaceId === excludeSpaceId) continue;
    const s = await db.getSpace(m.spaceId);
    if (s && s.kind === 'class' && !s.archivedAt) n += 1;
  }
  return n;
}

/**
 * Whether a learner may take a seat in class `cls`, in the `/join` order:
 * the learner's class cap, then the class cap, then the school's seats.
 * `null` when there is room, when the learner is already a member (no new
 * seat), and for spaces that are not classes. For a transfer,
 * `excludeSpaceId` is the source class, so a learner in three classes can
 * swap one for another. It must be a class the learner currently belongs to:
 * it is trusted as given (an unrelated id excludes nothing), so the caller
 * validates the source membership first. A move from a live class of the same
 * school takes no new school seat (`schoolIsFull` counts the learner through
 * live sibling classes); a move from an archived class does, since archived
 * classes hold no school seat.
 */
export async function classSeatCheck(db: Db, cls: Space, learnerId: string, now: Date, opts?: { excludeSpaceId?: string }): Promise<SeatBlock | null> {
  if (cls.kind !== 'class') return null;
  if (await db.membership(cls.id, 'learner', learnerId)) return null;
  if ((await activeClassesOf(db, learnerId, opts?.excludeSpaceId)) >= LEARNER_CLASS_CAP) return 'cap_learner';
  if ((await studentsIn(db, cls.id)) >= (await classCap(db, cls, now))) return 'cap_class';
  if (await schoolIsFull(db, cls, now, learnerId)) return 'cap_school';
  return null;
}

/** [SA] A refused seat and the number that was reached (`details.cap` of the `409`). */
export interface SeatRefusalInfo {
  code: SeatRefusal;
  cap: number;
}

/**
 * [SA] Which cap a learner join into a family or a class meets, read once, in the `/join` order (section 3.3):
 * the learner's own class count, the class cap, the school's distinct students, the family cap. `learnerId` null
 * asks for a new learner (no membership, no class count). Advisory: the atomic `addLearnerWithinCaps` is the gate;
 * this names the reason after it refused, and answers the lookup.
 */
export async function seatRefusal(db: Db, space: Space, learnerId: string | null, now: Date, opts?: { skipLearnerCap?: boolean }): Promise<SeatRefusalInfo | null> {
  if (space.kind === 'school') return null;
  if (learnerId && (await db.membership(space.id, 'learner', learnerId))) return null;
  const caps = await learnerCapOf(db, space, now);
  if (space.kind === 'class') {
    if (learnerId && !opts?.skipLearnerCap && (await activeClassesOf(db, learnerId)) >= LEARNER_CLASS_CAP) return { code: 'cap_learner', cap: LEARNER_CLASS_CAP };
    if (caps.cap !== null && (await studentsIn(db, space.id)) >= caps.cap) return { code: 'cap_class', cap: caps.cap };
    if (caps.schoolId !== null && caps.schoolCap !== null && !(learnerId && (await inLiveClassOf(db, caps.schoolId, learnerId)))) {
      const school = await db.getSpace(caps.schoolId);
      if (school && (await schoolUsage(db, school)).students >= caps.schoolCap) return { code: 'cap_school', cap: caps.schoolCap };
    }
    return null;
  }
  if (caps.cap !== null && (await studentsIn(db, space.id)) >= caps.cap) return { code: 'cap_family', cap: caps.cap };
  return null;
}

/** Whether the learner is in a live class of the school (it already holds a school seat). */
async function inLiveClassOf(db: Db, schoolId: string, learnerId: string): Promise<boolean> {
  for (const s of await db.childSpaces(schoolId)) {
    if (s.kind === 'class' && !s.archivedAt && (await db.membership(s.id, 'learner', learnerId))) return true;
  }
  return false;
}

/**
 * [SA] The lookup's `seat` (section 3.4): `full` when a join would be refused by a family, class or school cap.
 * The learner's own class count is not a seat (`reason` never `cap_learner`): `/join` still answers it.
 */
export async function lookupSeat(db: Db, space: Space, learnerId: string | null, now: Date): Promise<LookupSeat> {
  const refused = await seatRefusal(db, space, learnerId, now, { skipLearnerCap: true });
  if (!refused || refused.code === 'cap_learner') return { full: false, reason: null, cap: null };
  return { full: true, reason: refused.code as SeatCapCode, cap: refused.cap };
}

/** [SA] What `takeLearnerSeat` did: the membership row added, the learner already a member, or the cap that was full. */
export type TakeSeatResult = { kind: 'added' } | { kind: 'already' } | { kind: 'refused'; refusal: SeatRefusalInfo };

/**
 * [SA] A learner join into a family or a class, atomically (section 3.3): `Db.addLearnerWithinCaps` with every cap of
 * `learnerCapOf` (and the learner's class count for a class). Refused: the counts are read once in the `/join` order
 * to name the cap; when none is full (a seat opened between the statement and the read) the statement runs once
 * more, then the answer is the space's own cap rather than a loop.
 */
export async function takeLearnerSeat(db: Db, space: Space, learnerId: string, now: Date): Promise<TakeSeatResult> {
  const caps = await learnerCapOf(db, space, now);
  const input = {
    spaceId: space.id,
    learnerId,
    joinedAt: now.toISOString(),
    spaceCap: caps.cap,
    learnerClassCap: space.kind === 'class' ? LEARNER_CLASS_CAP : null,
    schoolId: caps.schoolId,
    schoolCap: caps.schoolCap,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await db.addLearnerWithinCaps(input);
    if (outcome !== 'refused') return { kind: outcome };
    const refusal = await seatRefusal(db, space, learnerId, now);
    if (refusal) return { kind: 'refused', refusal };
  }
  if (space.kind === 'family') return { kind: 'refused', refusal: { code: 'cap_family', cap: caps.cap ?? 0 } };
  // A class under a covered school has no cap of its own: the school's is the one that can refuse.
  if (caps.cap === null && caps.schoolCap !== null) return { kind: 'refused', refusal: { code: 'cap_school', cap: caps.schoolCap } };
  return { kind: 'refused', refusal: { code: 'cap_class', cap: caps.cap ?? 0 } };
}
