import type { Entitlement, Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../../store';
import { classCap, classIsPro, isEntitlementActive, schoolIsFull, schoolLimits, schoolUsage, tierForLearner } from '../entitlement';

const now = new Date('2026-09-21T12:00:00.000Z');
const ent = (over: Partial<Entitlement>): Entitlement => ({ id: 'ent:x', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_premium', status: 'active', provider: 'stripe', providerRef: null, customerRef: null, seats: null, expiresAt: null, updatedAt: '2026-09-20T00:00:00.000Z', ...over });
const space = (id: string, kind: Space['kind'], owner: string, parentSpaceId: string | null = null): Space => ({ id, kind, name: id, parentSpaceId, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: 't' });

beforeEach(() => store.reset());

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
  it('premium through family, teacher pro or school licence; free otherwise', () => {
    store.spaces.set('space:fam', space('space:fam', 'family', 'mom'));
    store.spaces.set('space:sch', space('space:sch', 'school', 'principal'));
    store.spaces.set('space:cls', space('space:cls', 'class', 'teacher', 'space:sch'));
    store.spaces.set('space:solo', space('space:solo', 'class', 't2'));
    store.addMembership({ spaceId: 'space:fam', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:cls', memberKind: 'learner', memberId: 'profile:b', role: 'student', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:solo', memberKind: 'learner', memberId: 'profile:c', role: 'student', joinedAt: 't' });

    expect(tierForLearner('profile:a', now)).toEqual({ tier: 'free', source: null });
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_premium', status: 'active', provider: 'stripe' }, now);
    expect(tierForLearner('profile:a', now)).toEqual({ tier: 'premium', source: { kind: 'family', spaceId: 'space:fam', name: 'space:fam' } });

    expect(tierForLearner('profile:b', now).tier).toBe('free');
    expect(classCap(store.spaces.get('space:cls') as Space, now)).toBe(20);
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_license', status: 'trial', provider: 'manual' }, now);
    expect(tierForLearner('profile:b', now)).toMatchObject({ tier: 'premium', source: { kind: 'class', spaceId: 'space:cls' } });
    expect(classCap(store.spaces.get('space:cls') as Space, now)).toBe(Number.POSITIVE_INFINITY);

    expect(classIsPro(store.spaces.get('space:solo') as Space, now)).toBe(false);
    store.applyEntitlement({ subjectKind: 'account', subjectId: 't2', planKey: 'teacher_pro', status: 'active', provider: 'stripe' }, now);
    expect(tierForLearner('profile:c', now).tier).toBe('premium');
    expect(classIsPro(store.spaces.get('space:fam') as Space, now)).toBe(false);

    const solo = store.spaces.get('space:solo');
    if (solo) solo.archivedAt = 't';
    expect(tierForLearner('profile:c', now).tier).toBe('free');
    expect(tierForLearner('profile:nobody', now).tier).toBe('free');
  });

  it('applyEntitlement upserts per subject and plan, keeping refs unless replaced', () => {
    const first = store.applyEntitlement({ subjectKind: 'account', subjectId: 't', planKey: 'teacher_pro', status: 'trial', provider: 'stripe', customerRef: 'cus_1', providerRef: 'sub_1' }, now);
    const second = store.applyEntitlement({ subjectKind: 'account', subjectId: 't', planKey: 'teacher_pro', status: 'active', provider: 'stripe', expiresAt: 'e' }, now);
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ status: 'active', customerRef: 'cus_1', providerRef: 'sub_1', expiresAt: 'e' });
    expect(store.entitlementsFor('account', 't')).toHaveLength(1);
    const cleared = store.applyEntitlement({ subjectKind: 'account', subjectId: 't', planKey: 'teacher_pro', status: 'expired', provider: 'stripe', expiresAt: null, seats: null }, now);
    expect(cleared.expiresAt).toBeNull();
  });
});

describe('school limits and usage (F-SCHOOL-001 §3.1)', () => {
  it('derives limits from the licence and counts distinct learners and teachers', () => {
    const school = space('space:sch', 'school', 'principal');
    store.spaces.set(school.id, school);
    expect(schoolLimits(school, now)).toEqual({ licensed: false, students: null, teachers: null, license: null });
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_license', status: 'active', provider: 'manual' }, now);
    expect(schoolLimits(school, now)).toMatchObject({ licensed: true, students: 300, teachers: 10 });
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_license', status: 'expired', provider: 'manual' }, now);
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: null }, now);
    expect(schoolLimits(school, now)).toMatchObject({ licensed: true, students: null, teachers: null });

    const a = space('space:a', 'class', 'ms-park', 'space:sch');
    const b = space('space:b', 'class', 'principal', 'space:sch');
    const gone = { ...space('space:c', 'class', 'mr-lee', 'space:sch'), archivedAt: 't' };
    for (const s of [a, b, gone]) store.spaces.set(s.id, s);
    store.addMembership({ spaceId: 'space:sch', memberKind: 'account', memberId: 'mr-lee', role: 'teacher', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:b', memberKind: 'account', memberId: 'mr-lee', role: 'teacher', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:a', memberKind: 'learner', memberId: 'profile:x', role: 'student', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:b', memberKind: 'learner', memberId: 'profile:x', role: 'student', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:b', memberKind: 'learner', memberId: 'profile:y', role: 'student', joinedAt: 't' });
    store.addMembership({ spaceId: 'space:c', memberKind: 'learner', memberId: 'profile:z', role: 'student', joinedAt: 't' });
    expect(schoolUsage(school)).toEqual({ students: 2, teachers: 2 }); // x once; ms-park + mr-lee; archived class ignored
    expect(schoolIsFull(a, now)).toBe(false); // unlimited seats
    store.applyEntitlement({ subjectKind: 'space', subjectId: 'space:sch', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 2 }, now);
    expect(schoolIsFull(a, now)).toBe(true);
    expect(schoolIsFull(a, now, 'profile:x')).toBe(false); // already counted
    expect(schoolIsFull(space('space:solo', 'class', 't'), now)).toBe(false);
  });
});
