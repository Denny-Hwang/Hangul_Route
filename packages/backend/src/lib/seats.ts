import { LEARNER_CLASS_CAP, type Space } from '@hangul-route/content-schema';
import type { Db } from '../db';
import { classCap, schoolIsFull } from './entitlement';

/**
 * Class seat checks — F-SPACE-002 §4.3. Extracted from the `/join` route so
 * join and (later) class transfer share one rule. Pure over `Db`.
 */

export type SeatBlock = 'cap_learner' | 'cap_class' | 'cap_school';

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
 * swap one for another; a move inside one school takes no new school seat
 * because `schoolIsFull` already counts the learner there.
 */
export async function classSeatCheck(db: Db, cls: Space, learnerId: string, now: Date, opts?: { excludeSpaceId?: string }): Promise<SeatBlock | null> {
  if (cls.kind !== 'class') return null;
  if (await db.membership(cls.id, 'learner', learnerId)) return null;
  if ((await activeClassesOf(db, learnerId, opts?.excludeSpaceId)) >= LEARNER_CLASS_CAP) return 'cap_learner';
  if ((await studentsIn(db, cls.id)) >= (await classCap(db, cls, now))) return 'cap_class';
  if (await schoolIsFull(db, cls, now, learnerId)) return 'cap_school';
  return null;
}
