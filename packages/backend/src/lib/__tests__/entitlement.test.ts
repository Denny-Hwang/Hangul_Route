import type { Entitlement, Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb as db } from '../../__tests__/helpers/db';
import { classCap, classIsPro, isEntitlementActive, schoolIsFull, schoolLimits, schoolUsage, tierForLearner } from '../entitlement';

const now = new Date('2026-09-21T12:00:00.000Z');
const ent = (over: Partial<Entitlement>): Entitlement => ({ id: 'ent:x', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: null, customerRef: null, seats: null, expiresAt: null, promoCode: null, updatedAt: '2026-09-20T00:00:00.000Z', ...over });
const space = (id: string, kind: Space['kind'], owner: string, parentSpaceId: string | null = null): Space => ({ id, kind, name: id, parentSpaceId, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' });
const account = async (id: string): Promise<void> => db.putAccount({ id, email: null, displayName: null, consent: null, createdAt: 't' });

beforeEach(async () => {
  await db.reset();
  for (const id of ['mom', 'principal', 'teacher', 't2', 't', 'ms-park', 'mr-lee']) await account(id);
});

describe('isEntitlementActive (F-ENT-001 §3.2)', () => {
  it('follows status and expiry, with a 7-day past-due grace', () => {
    expect(isEntitlementActive(ent({ status: 'active' }), now)).toBe(true);
    expect(isEntitlementActive(ent({ status: 'trial', expiresAt: '2026-09-22T00:00:00.000Z' }), now)).toBe(true);
    expect(isEntitlementActive(ent({ status: 'active', expiresAt: '2026-09-20T00:00:00.000Z' }), now)).toBe(false);
    expect(isEntitlementActive(ent({ status: 'cancelled', expiresAt: '2026-10-01T00:00:00.000Z' }), now)).toBe(true);
    expect(isEntitlementActive(ent({ status: 'cancelled', expiresAt: null }), now)).toBe(false);
    expect(isEntitlementActive(ent({ status: 'past_due', updatedAt: '2026-09-18T00:00:00.000Z' }), now)).toBe(true);
    expect(isEntitlementActive(ent({ status: 'past_due', updatedAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(false);
    expect(isEntitlementActive(ent({ status: 'expired' }), now)).toBe(false);
  });
});

describe('tierForLearner + classCap', () => {
  it('premium through family, a class licence or school licence; free otherwise', async () => {
    await db.putSpace(space('space:fam', 'family', 'mom'));
    await db.putSpace(space('space:sch', 'school', 'principal'));
    await db.putSpace(space('space:cls', 'class', 'teacher', 'space:sch'));
    await db.putSpace(space('space:solo', 'class', 't2'));
    await db.addMembership({ spaceId: 'space:fam', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:cls', memberKind: 'learner', memberId: 'profile:b', role: 'student', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:solo', memberKind: 'learner', memberId: 'profile:c', role: 'student', joinedAt: 't' });
    const cls = (await db.getSpace('space:cls')) as Space;

    expect(await tierForLearner(db, 'profile:a', now)).toEqual({ tier: 'free', source: null });
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', provider: 'stripe' }, now);
    expect(await tierForLearner(db, 'profile:a', now)).toEqual({ tier: 'premium', source: { kind: 'family', spaceId: 'space:fam', name: 'space:fam' } });

    expect((await tierForLearner(db, 'profile:b', now)).tier).toBe('free');
    expect(await classCap(db, cls, now)).toBe(20);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'group_license', status: 'trial', provider: 'manual' }, now);
    expect(await tierForLearner(db, 'profile:b', now)).toMatchObject({ tier: 'premium', source: { kind: 'class', spaceId: 'space:cls' } });
    expect(await classCap(db, cls, now)).toBe(Number.POSITIVE_INFINITY);

    const solo = (await db.getSpace('space:solo')) as Space;
    expect(await classIsPro(db, solo, now)).toBe(false);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:solo', planKey: 'group_license', status: 'active', provider: 'stripe' }, now);
    expect((await tierForLearner(db, 'profile:c', now)).tier).toBe('premium'); // a solo class buys its own group licence
    expect(await classIsPro(db, (await db.getSpace('space:fam')) as Space, now)).toBe(false);

    await db.putSpace({ ...solo, archivedAt: 't' });
    expect((await tierForLearner(db, 'profile:c', now)).tier).toBe('free');
    expect((await tierForLearner(db, 'profile:nobody', now)).tier).toBe('free');
  });
});

describe('school limits and usage (F-SCHOOL-001 §3.1)', () => {
  it('derives limits from the licence and counts distinct learners and teachers', async () => {
    const school = space('space:sch', 'school', 'principal');
    await db.putSpace(school);
    expect(await schoolLimits(db, school, now)).toEqual({ licensed: false, students: null, teachers: null, license: null });
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'group_license', status: 'active', provider: 'manual' }, now);
    expect(await schoolLimits(db, school, now)).toMatchObject({ licensed: true, students: 300, teachers: 10 });
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'group_license', status: 'expired', provider: 'manual' }, now);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: null }, now);
    expect(await schoolLimits(db, school, now)).toMatchObject({ licensed: true, students: null, teachers: null });

    const a = space('space:a', 'class', 'ms-park', 'space:sch');
    const b = space('space:b', 'class', 'principal', 'space:sch');
    const gone = { ...space('space:c', 'class', 'mr-lee', 'space:sch'), archivedAt: 't' };
    for (const s of [a, b, gone]) await db.putSpace(s);
    await db.addMembership({ spaceId: 'space:sch', memberKind: 'account', memberId: 'mr-lee', role: 'teacher', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:b', memberKind: 'account', memberId: 'mr-lee', role: 'teacher', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:a', memberKind: 'learner', memberId: 'profile:x', role: 'student', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:b', memberKind: 'learner', memberId: 'profile:x', role: 'student', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:b', memberKind: 'learner', memberId: 'profile:y', role: 'student', joinedAt: 't' });
    await db.addMembership({ spaceId: 'space:c', memberKind: 'learner', memberId: 'profile:z', role: 'student', joinedAt: 't' });
    expect(await schoolUsage(db, school)).toEqual({ students: 2, teachers: 2 }); // x once; ms-park + mr-lee; archived class ignored
    expect(await schoolIsFull(db, a, now)).toBe(false); // unlimited seats
    await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, now);
    expect(await schoolIsFull(db, a, now)).toBe(true);
    expect(await schoolIsFull(db, a, now, 'profile:x')).toBe(false); // already counted
    expect(await schoolIsFull(db, space('space:solo', 'class', 't'), now)).toBe(false);
  });
});
