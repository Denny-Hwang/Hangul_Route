import { TRANSFER_COOLING_OFF_MS, type Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import type { StoredClassMove } from '../class-move-types';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { AddLearnerWithinCapsInput, Db } from '../types';
import { DEST, HOUR, LEARNER, SOURCE, approvedRequest, at, executeInput, seedWorld } from './transfer-fixtures';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 3.3: one statement takes a learner seat under every cap, on D1 (the SQLite
 * shim runs the real migrations and the real SQL) and in the memory store, and the transfer and class-move gates
 * carry the destination school's distinct-student cap.
 */
const T = '2026-10-20T00:00:00.000Z';
const SCHOOL = 'space:school';

const space = (id: string, over: Partial<Space> = {}): Space => ({
  id,
  kind: 'class',
  name: id,
  parentSpaceId: null,
  ownerAccountId: 'principal',
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T,
  ...over,
});
const seat = (over: Partial<AddLearnerWithinCapsInput> = {}): AddLearnerWithinCapsInput => ({
  spaceId: 'space:a',
  learnerId: 'profile:new',
  joinedAt: T,
  spaceCap: 20,
  learnerClassCap: 3,
  schoolId: null,
  schoolCap: null,
  ...over,
});
async function fill(db: Db, spaceId: string, n: number, prefix = spaceId): Promise<void> {
  for (let i = 0; i < n; i += 1) await db.addMembership({ spaceId, memberKind: 'learner', memberId: `profile:${prefix.slice(6)}-${i}`, role: 'student', joinedAt: T });
}
const learnersIn = async (db: Db, spaceId: string) => (await db.membersOf(spaceId)).filter((m) => m.memberKind === 'learner').length;

function seatContract(name: string, make: () => Db): void {
  describe(`addLearnerWithinCaps · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space(SCHOOL, { kind: 'school' }));
      for (const id of ['space:a', 'space:b', 'space:c']) await db.putSpace(space(id, { parentSpaceId: SCHOOL }));
      await db.putSpace(space('space:solo'));
      await db.putSpace(space('space:fam', { kind: 'family' }));
    });

    it('adds a student row while every cap has room, refuses at the cap, answers already for a member', async () => {
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:fam', spaceCap: 4, learnerClassCap: null }))).toBe('added');
      expect(await db.membership('space:fam', 'learner', 'profile:new')).toEqual({ spaceId: 'space:fam', memberKind: 'learner', memberId: 'profile:new', role: 'student', joinedAt: T });
      // the ON CONFLICT path: a member is never written twice, whatever the caps say
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:fam', spaceCap: 0, learnerClassCap: null, joinedAt: 'later' }))).toBe('already');
      expect((await db.membership('space:fam', 'learner', 'profile:new'))?.joinedAt).toBe(T);
      await fill(db, 'space:fam', 3);
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:fam', learnerId: 'profile:fifth', spaceCap: 4, learnerClassCap: null }))).toBe('refused');
      expect(await learnersIn(db, 'space:fam')).toBe(4);
      // a null cap is none
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:fam', learnerId: 'profile:fifth', spaceCap: null, learnerClassCap: null }))).toBe('added');
    });

    it('two joins for the last seat at once: exactly one is added', async () => {
      await fill(db, 'space:solo', 19);
      const outcomes = await Promise.all([db.addLearnerWithinCaps(seat({ spaceId: 'space:solo', learnerId: 'profile:x' })), db.addLearnerWithinCaps(seat({ spaceId: 'space:solo', learnerId: 'profile:y' }))]);
      expect(outcomes.sort()).toEqual(['added', 'refused']);
      expect(await learnersIn(db, 'space:solo')).toBe(20);
    });

    it("counts the learner's live classes, archived ones left out", async () => {
      for (const id of ['space:a', 'space:b']) await db.addMembership({ spaceId: id, memberKind: 'learner', memberId: 'profile:new', role: 'student', joinedAt: T });
      await db.putSpace(space('space:gone', { archivedAt: T }));
      await db.addMembership({ spaceId: 'space:gone', memberKind: 'learner', memberId: 'profile:new', role: 'student', joinedAt: T });
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:solo', learnerClassCap: 2 }))).toBe('refused');
      expect(await db.addLearnerWithinCaps(seat({ spaceId: 'space:solo', learnerClassCap: 3 }))).toBe('added');
    });

    it("counts a school's distinct learners across its live classes; a learner in a sibling class takes no new seat", async () => {
      await fill(db, 'space:a', 3, 'space:shared');
      await fill(db, 'space:b', 3, 'space:shared'); // the same three learners: 3 distinct
      await fill(db, 'space:b', 2, 'space:b-only');
      await db.putSpace(space('space:old', { parentSpaceId: SCHOOL, archivedAt: T }));
      await fill(db, 'space:old', 10); // archived: holds no school seat
      const inSchool = (over: Partial<AddLearnerWithinCapsInput>) => seat({ spaceId: 'space:c', schoolId: SCHOOL, schoolCap: 5, ...over });
      expect(await db.addLearnerWithinCaps(inSchool({}))).toBe('refused'); // 5 distinct of 5
      expect(await db.addLearnerWithinCaps(inSchool({ learnerId: 'profile:shared-0' }))).toBe('added'); // already counted
      expect(await db.addLearnerWithinCaps(inSchool({ schoolCap: 6 }))).toBe('added');
      expect(await db.addLearnerWithinCaps(inSchool({ learnerId: 'profile:z', schoolCap: null }))).toBe('added'); // a contract with no seats
      expect(await db.addLearnerWithinCaps(inSchool({ learnerId: 'profile:w', schoolId: null, schoolCap: 1 }))).toBe('added'); // no school
    });
  });
}

seatContract('memory', () => new MemoryDb());
seatContract('D1 (SQLite)', () => new D1Db(openSqliteD1()));

const moveRow = (over: Partial<StoredClassMove> = {}): StoredClassMove => ({
  id: 'move:0001',
  learnerId: LEARNER,
  sourceSpaceId: SOURCE,
  destSpaceId: DEST,
  kind: 'direct',
  status: 'requested',
  actorAccountId: 'teacher-a',
  actorVia: 'owner',
  decidedAccountId: null,
  decidedVia: null,
  endReason: null,
  createdAt: at(0).toISOString(),
  updatedAt: at(0).toISOString(),
  expiresAt: at(14 * 24 * HOUR).toISOString(),
  executedAt: null,
  endedAt: null,
  familySeenAt: null,
  ...over,
});

function gateContract(name: string, make: () => Db): void {
  describe(`the school cap in the transfer and move gates · ${name}`, () => {
    let db: Db;
    const due = at(HOUR + TRANSFER_COOLING_OFF_MS);
    beforeEach(async () => {
      db = make();
      await db.reset();
      await seedWorld(db);
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: at(0).toISOString() });
      await db.putSpace(space(SCHOOL, { kind: 'school' }));
      const dest = await db.getSpace(DEST);
      if (dest) await db.putSpace({ ...dest, parentSpaceId: SCHOOL });
      await db.putSpace(space('space:sibling', { parentSpaceId: SCHOOL }));
      await fill(db, 'space:sibling', 4);
    });

    it('a transfer into a full school is refused by the gate; a seat free lets it through', async () => {
      await approvedRequest(db);
      expect((await db.executeTransfer({ ...executeInput(due), destSchoolId: SCHOOL, destSchoolCap: 4 })).executed).toBe(false);
      expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
      expect(await db.membership(DEST, 'learner', LEARNER)).toBeNull();
      expect((await db.executeTransfer({ ...executeInput(due), destSchoolId: SCHOOL, destSchoolCap: 5 })).executed).toBe(true);
      expect(await db.membership(DEST, 'learner', LEARNER)).not.toBeNull();
    });

    it('a move into a full school is refused; a move between two live classes of that school takes no new seat', async () => {
      expect(await db.createClassMove(moveRow())).toBe('created');
      const input = { id: 'move:0001', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, decider: { accountId: 'teacher-b', via: 'teacher' as const }, destCap: 20, learnerCap: 3, now: at(HOUR), destSchoolId: SCHOOL, destSchoolCap: 4 };
      expect((await db.executeClassMove(input)).executed).toBe(false);
      // the source joins the school too: the learner already holds a school seat there, so the full school lets it move
      const source = await db.getSpace(SOURCE);
      if (source) await db.putSpace({ ...source, parentSpaceId: SCHOOL });
      expect((await db.executeClassMove(input)).executed).toBe(true);
      expect(await db.membership(DEST, 'learner', LEARNER)).not.toBeNull();
    });
  });
}

gateContract('memory', () => new MemoryDb());
gateContract('D1 (SQLite)', () => new D1Db(openSqliteD1()));
