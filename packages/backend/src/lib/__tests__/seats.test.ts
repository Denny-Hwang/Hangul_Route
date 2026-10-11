import type { Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb as db } from '../../__tests__/helpers/db';
import { activeClassesOf, classSeatCheck, studentsIn } from '../seats';

/** `lib/seats.ts` — F-SPACE-002 §4.3 (PR T-4a): the class cap checks shared by /join and, later, transfer. */

const now = new Date('2026-10-01T12:00:00.000Z');
const space = (id: string, kind: Space['kind'], owner: string, parentSpaceId: string | null = null): Space => ({ id, kind, name: id, parentSpaceId, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' });
const join = (spaceId: string, learnerId: string) => db.addMembership({ spaceId, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: 't' });
async function put(s: Space): Promise<Space> {
  await db.putSpace(s);
  return s;
}
async function fill(spaceId: string, n: number, prefix = spaceId): Promise<void> {
  for (let i = 0; i < n; i += 1) await join(spaceId, `profile:${prefix}-${i}`);
}

beforeEach(async () => {
  await db.reset();
  for (const id of ['t1', 't2', 't3', 't4', 'principal', 'other-principal', 'mom']) await db.putAccount({ id, email: null, displayName: null, consent: null, createdAt: 't' });
});

describe('studentsIn / activeClassesOf', () => {
  it('counts learner members only, and live classes only (excluding one when asked)', async () => {
    const a = await put(space('space:a', 'class', 't1'));
    await put(space('space:b', 'class', 't2'));
    await put({ ...space('space:gone', 'class', 't3'), archivedAt: 't' });
    await put(space('space:fam', 'family', 'mom'));
    await db.addMembership({ spaceId: a.id, memberKind: 'account', memberId: 't4', role: 'teacher', joinedAt: 't' });
    for (const s of ['space:a', 'space:b', 'space:gone', 'space:fam']) await join(s, 'profile:x');
    expect(await studentsIn(db, a.id)).toBe(1);
    expect(await activeClassesOf(db, 'profile:x')).toBe(2);
    expect(await activeClassesOf(db, 'profile:x', 'space:a')).toBe(1);
    expect(await activeClassesOf(db, 'profile:x', 'space:fam')).toBe(2);
    expect(await activeClassesOf(db, 'profile:nobody')).toBe(0);
  });
});

describe('classSeatCheck (F-SPACE-002 §4.3)', () => {
  it('lets a learner into a class with room', async () => {
    const dest = await put(space('space:dest', 'class', 't1'));
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBeNull();
  });

  it('cap_learner at three live classes; excludeSpaceId frees the source; archived classes do not count', async () => {
    const dest = await put(space('space:dest', 'class', 't4'));
    for (const [i, owner] of ['t1', 't2', 't3'].entries()) {
      await put(space(`space:c${i}`, 'class', owner));
      await join(`space:c${i}`, 'profile:x');
    }
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBe('cap_learner');
    expect(await classSeatCheck(db, dest, 'profile:x', now, { excludeSpaceId: 'space:c0' })).toBeNull();
    expect(await classSeatCheck(db, dest, 'profile:x', now, { excludeSpaceId: 'space:unrelated' })).toBe('cap_learner');
    await put({ ...space('space:c1', 'class', 't2'), archivedAt: 't' });
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBeNull();
  });

  it('cap_class at the free cap; a licensed class (own group licence or school licence) has no class cap', async () => {
    const free = await put(space('space:free', 'class', 't1'));
    await fill(free.id, 20);
    expect(await classSeatCheck(db, free, 'profile:x', now)).toBe('cap_class');
    expect(await classSeatCheck(db, free, 'profile:x', now, { excludeSpaceId: 'space:other' })).toBe('cap_class');

    const solo = await put(space('space:solo', 'class', 't2'));
    await fill(solo.id, 20);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: solo.id, planKey: 'group_license', status: 'active', provider: 'manual' }, now);
    expect(await classSeatCheck(db, solo, 'profile:x', now)).toBeNull();

    await put(space('space:sch', 'school', 'principal'));
    const inSchool = await put(space('space:in-school', 'class', 't3', 'space:sch'));
    await fill(inSchool.id, 20);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'group_license', status: 'active', provider: 'manual' }, now);
    expect(await classSeatCheck(db, inSchool, 'profile:x', now)).toBeNull();
  });

  it('cap_school when the destination school has used its seats: same school frees no seat, a different school decides by its own limit', async () => {
    await put(space('space:sch-a', 'school', 'principal'));
    await put(space('space:sch-b', 'school', 'other-principal'));
    const srcA = await put(space('space:src-a', 'class', 't1', 'space:sch-a'));
    const destA = await put(space('space:dest-a', 'class', 't2', 'space:sch-a'));
    const destB = await put(space('space:dest-b', 'class', 't3', 'space:sch-b'));
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch-a', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, now);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch-b', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 1 }, now);
    await join(srcA.id, 'profile:x');
    await join(srcA.id, 'profile:y');
    await join(destB.id, 'profile:z');

    // a stranger to school A: full
    expect(await classSeatCheck(db, destA, 'profile:new', now)).toBe('cap_school');
    // a learner already counted in school A takes no new seat (same-school move)
    expect(await classSeatCheck(db, destA, 'profile:x', now, { excludeSpaceId: srcA.id })).toBeNull();
    expect(await classSeatCheck(db, destA, 'profile:x', now)).toBeNull();
    // cross-school: school B's own limit decides
    expect(await classSeatCheck(db, destB, 'profile:x', now, { excludeSpaceId: srcA.id })).toBe('cap_school');
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch-b', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 5 }, now);
    expect(await classSeatCheck(db, destB, 'profile:x', now, { excludeSpaceId: srcA.id })).toBeNull();
  });

  it('checks in the /join order: the learner cap before the class cap', async () => {
    const dest = await put(space('space:dest', 'class', 't4'));
    await fill(dest.id, 20);
    for (const [i, owner] of ['t1', 't2', 't3'].entries()) {
      await put(space(`space:c${i}`, 'class', owner));
      await join(`space:c${i}`, 'profile:x');
    }
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBe('cap_learner');
    expect(await classSeatCheck(db, dest, 'profile:x', now, { excludeSpaceId: 'space:c0' })).toBe('cap_class');
  });

  it('checks in the /join order: the learner cap before the school cap', async () => {
    await put(space('space:sch', 'school', 'principal'));
    const dest = await put(space('space:dest', 'class', 't4', 'space:sch'));
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, now);
    await fill(dest.id, 2);
    for (const [i, owner] of ['t1', 't2', 't3'].entries()) {
      await put(space(`space:c${i}`, 'class', owner));
      await join(`space:c${i}`, 'profile:x');
    }
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBe('cap_learner');
    expect(await classSeatCheck(db, dest, 'profile:x', now, { excludeSpaceId: 'space:c0' })).toBe('cap_school');
  });

  it('a move from an archived class of the same full school takes a new school seat', async () => {
    await put(space('space:sch', 'school', 'principal'));
    const src = await put({ ...space('space:src', 'class', 't1', 'space:sch'), archivedAt: 't' });
    const dest = await put(space('space:dest', 'class', 't2', 'space:sch'));
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, now);
    await join(src.id, 'profile:x');
    await fill(dest.id, 2);
    expect(await classSeatCheck(db, dest, 'profile:x', now, { excludeSpaceId: src.id })).toBe('cap_school');
  });

  it('is skipped (null) when the learner is already a member of the destination', async () => {
    const dest = await put(space('space:dest', 'class', 't4'));
    await fill(dest.id, 19);
    await join(dest.id, 'profile:x');
    for (const [i, owner] of ['t1', 't2'].entries()) {
      await put(space(`space:c${i}`, 'class', owner));
      await join(`space:c${i}`, 'profile:x');
    }
    expect(await studentsIn(db, dest.id)).toBe(20);
    expect(await classSeatCheck(db, dest, 'profile:x', now)).toBeNull();
  });

  it('applies to classes only', async () => {
    const fam = await put(space('space:fam', 'family', 'mom'));
    await fill(fam.id, 25);
    const sch = await put(space('space:sch', 'school', 'principal'));
    expect(await classSeatCheck(db, fam, 'profile:x', now)).toBeNull();
    expect(await classSeatCheck(db, sch, 'profile:x', now)).toBeNull();
  });
});
