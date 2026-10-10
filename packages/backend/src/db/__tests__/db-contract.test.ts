import type { Entitlement, Plan, Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';

const T = '2026-10-07T00:00:00.000Z';
const space = (id: string, kind: Space['kind'], owner: string, parent: string | null = null): Space => ({ id, kind, name: id, parentSpaceId: parent, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T });

/** One contract, two backends — F-INFRA-003 §3.2. */
function contract(name: string, make: () => Db): void {
  describe(`Db contract · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
    });

    it('accounts upsert and read back; consent round-trips as JSON', async () => {
      expect(await db.getAccount('mom')).toBeNull();
      await db.putAccount({ id: 'mom', email: 'mom@example.com', displayName: 'Mom', consent: null, createdAt: T });
      await db.putAccount({ id: 'mom', email: 'mom@example.com', displayName: 'Mom K', consent: { at: T, scope: 'parent' }, createdAt: T });
      expect(await db.getAccount('mom')).toEqual({ id: 'mom', email: 'mom@example.com', displayName: 'Mom K', consent: { at: T, scope: 'parent' }, createdAt: T });
    });

    it('learners, devices and snapshots; deleteLearner erases everything of theirs', async () => {
      const learner = { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T };
      await db.putLearner(learner);
      const read = await db.getLearner('profile:suni');
      expect(read).toEqual(learner);
      if (read) {
        read.recoveryHash = 'hash-1';
        read.lastActiveAt = '2026-10-08T00:00:00.000Z';
      }
      expect((await db.getLearner('profile:suni'))?.recoveryHash).toBeNull(); // reads are copies: nothing saved without put
      await db.putLearner({ ...learner, recoveryHash: 'hash-1' });
      expect((await db.learnerByRecoveryHash('hash-1'))?.id).toBe('profile:suni');
      expect(await db.learnerByRecoveryHash('nope')).toBeNull();

      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-a', secretHash: 'h', createdAt: T, lastSeenAt: T });
      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-a', secretHash: 'h2', createdAt: T, lastSeenAt: '2026-10-08T00:00:00.000Z' });
      expect(await db.getDevice('profile:suni', 'device-a')).toMatchObject({ secretHash: 'h2', lastSeenAt: '2026-10-08T00:00:00.000Z' });
      expect(await db.getDevice('profile:suni', 'device-b')).toBeNull();
      expect(await db.deviceExists('device-a')).toBe(true);
      expect(await db.deviceExists('device-b')).toBe(false);

      expect(await db.putSnapshot({ learnerId: 'profile:suni', rev: 1, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-a', summary: { stars: 3 }, payload: { profileId: 'profile:suni', cards: ['a'] }, updatedAt: T }, 0)).toBe(true);
      expect(await db.putSnapshot({ learnerId: 'profile:suni', rev: 2, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-a', summary: { stars: 4 }, payload: { profileId: 'profile:suni', cards: ['a', 'b'] }, updatedAt: T }, 1)).toBe(true);
      expect(await db.getSnapshot('profile:suni')).toMatchObject({ rev: 2, summary: { stars: 4 }, payload: { cards: ['a', 'b'] } });
      expect(await db.getSnapshot('profile:nobody')).toBeNull();

      await db.putAccount({ id: 't', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:c', 'class', 't'));
      await db.addMembership({ spaceId: 'space:c', memberKind: 'learner', memberId: 'profile:suni', role: 'student', joinedAt: T });
      await db.putRelink({ id: 'relink:1', spaceId: 'space:c', learnerId: 'profile:suni', deviceId: 'device-b', platform: null, requestedAt: T, expiresAt: T, status: 'pending', decidedAt: null, secret: null });
      expect(await db.deleteLearner('profile:suni')).toBe(true);
      expect(await db.deleteLearner('profile:suni')).toBe(false);
      expect(await db.getLearner('profile:suni')).toBeNull();
      expect(await db.getDevice('profile:suni', 'device-a')).toBeNull();
      expect(await db.getSnapshot('profile:suni')).toBeNull();
      expect(await db.membersOf('space:c')).toEqual([]);
      expect(await db.relinksOf('space:c')).toEqual([]);
    });

    it('putSnapshot is compare-and-set on rev: insert only when absent, update only from the expected rev (SYNC-1)', async () => {
      await db.putLearner({ id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
      const snap = (rev: number, cards: string[], learnerId = 'profile:suni') => ({ learnerId, rev, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-a', summary: { cards: cards.length }, payload: { profileId: learnerId, cards }, updatedAt: T });

      expect(await db.putSnapshot(snap(1, ['a']), 0)).toBe(true); // first write: insert-if-absent
      expect(await db.putSnapshot(snap(1, ['x']), 0)).toBe(false); // another device already created it
      expect(await db.putSnapshot(snap(3, ['c']), 2)).toBe(false); // base rev from the future
      expect(await db.getSnapshot('profile:suni')).toMatchObject({ rev: 1, payload: { cards: ['a'] } });

      expect(await db.putSnapshot(snap(2, ['a', 'b']), 1)).toBe(true);
      expect(await db.putSnapshot(snap(2, ['z']), 1)).toBe(false); // lost the race for rev 2
      expect(await db.getSnapshot('profile:suni')).toMatchObject({ rev: 2, summary: { cards: 2 }, payload: { cards: ['a', 'b'] } });

      // a non-zero base never creates a row
      expect(await db.putSnapshot(snap(5, ['q'], 'profile:other'), 4)).toBe(false);
      expect(await db.getSnapshot('profile:other')).toBeNull();
    });

    it('spaces: upsert, lookup by code, children, owner, archived flag, settings JSON', async () => {
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T });
      await db.putAccount({ id: 'teacher', email: null, displayName: null, consent: null, createdAt: T });
      const school = space('space:sch', 'school', 'principal');
      const cls = { ...space('space:cls', 'class', 'teacher', 'space:sch'), joinCode: 'ABCDEF', joinCodeExpiresAt: '2026-11-01T00:00:00.000Z', settings: { consentMode: 'parent' as const, anonymizeRoster: true } };
      await db.putSpace(school);
      await db.putSpace(cls);
      await db.putSpace(space('space:solo', 'class', 'teacher'));
      expect(await db.getSpace('space:cls')).toEqual(cls);
      expect(await db.getSpace('space:nope')).toBeNull();
      expect((await db.spaceByCode('ABCDEF'))?.id).toBe('space:cls');
      expect(await db.spaceByCode('ZZZZZZ')).toBeNull();
      expect((await db.childSpaces('space:sch')).map((s) => s.id)).toEqual(['space:cls']);
      expect((await db.spacesOwnedBy('teacher')).map((s) => s.id).sort()).toEqual(['space:cls', 'space:solo']);
      await db.putSpace({ ...cls, archivedAt: T, joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'school', anonymizeRoster: false } });
      expect(await db.getSpace('space:cls')).toMatchObject({ archivedAt: T, joinCode: null, settings: { consentMode: 'school', anonymizeRoster: false } });
      expect(await db.spaceByCode('ABCDEF')).toBeNull();
    });

    it('memberships: add is idempotent, remove reports existence, queries by member and by space', async () => {
      await db.putAccount({ id: 'mom', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:f', 'family', 'mom'));
      await db.putSpace(space('space:g', 'family', 'mom'));
      await db.addMembership({ spaceId: 'space:f', memberKind: 'account', memberId: 'mom', role: 'owner', joinedAt: T });
      await db.addMembership({ spaceId: 'space:f', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
      await db.addMembership({ spaceId: 'space:f', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
      await db.addMembership({ spaceId: 'space:g', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
      expect(await db.membership('space:f', 'learner', 'profile:a')).toEqual({ spaceId: 'space:f', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
      expect(await db.membership('space:f', 'learner', 'profile:b')).toBeNull();
      expect((await db.membersOf('space:f')).map((m) => m.memberId).sort()).toEqual(['mom', 'profile:a']);
      expect((await db.membershipsOf('learner', 'profile:a')).map((m) => m.spaceId).sort()).toEqual(['space:f', 'space:g']);
      expect(await db.removeMembership('space:f', 'learner', 'profile:a')).toBe(true);
      expect(await db.removeMembership('space:f', 'learner', 'profile:a')).toBe(false);
      expect((await db.membersOf('space:f')).map((m) => m.memberId)).toEqual(['mom']);
    });

    it('plans: items and targets round-trip as JSON, null targets stay null', async () => {
      await db.putAccount({ id: 't', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:c', 'class', 't'));
      const plan: Plan = { id: 'plan:1', spaceId: 'space:c', authorAccountId: 't', title: 'Week 1', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-10', note: 'warm up' }], targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: T, updatedAt: T };
      await db.putPlan(plan);
      expect(await db.getPlan('plan:1')).toEqual(plan);
      await db.putPlan({ ...plan, targetLearnerIds: ['profile:a'], publishedAt: T, updatedAt: '2026-10-08T00:00:00.000Z' });
      expect(await db.getPlan('plan:1')).toMatchObject({ targetLearnerIds: ['profile:a'], publishedAt: T });
      expect(await db.getPlan('plan:nope')).toBeNull();
      await db.putPlan({ ...plan, id: 'plan:2' });
      expect((await db.plansOf('space:c')).map((p) => p.id).sort()).toEqual(['plan:1', 'plan:2']);
      expect(await db.plansOf('space:other')).toEqual([]);
    });

    it('relink requests: status, decidedAt and the one-time secret are updatable', async () => {
      await db.putAccount({ id: 't', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:c', 'class', 't'));
      await db.putLearner({ id: 'profile:a', displayName: 'A', ageGroup: '8-9', avatar: 'x', recoveryHash: null, createdAt: T, lastActiveAt: T });
      const req = { id: 'relink:1', spaceId: 'space:c', learnerId: 'profile:a', deviceId: 'device-b', platform: 'web', requestedAt: T, expiresAt: '2026-10-07T00:10:00.000Z', status: 'pending' as const, decidedAt: null, secret: null };
      await db.putRelink(req);
      expect(await db.getRelink('relink:1')).toEqual(req);
      await db.putRelink({ ...req, status: 'approved', decidedAt: T, secret: 's3cret' });
      expect(await db.getRelink('relink:1')).toMatchObject({ status: 'approved', decidedAt: T, secret: 's3cret' });
      await db.putRelink({ ...req, status: 'approved', decidedAt: T, secret: null });
      expect((await db.getRelink('relink:1'))?.secret).toBeNull();
      expect((await db.relinksOf('space:c')).map((r) => r.id)).toEqual(['relink:1']);
      expect(await db.getRelink('relink:nope')).toBeNull();
    });

    it('entitlements: one row per subject + plan, refs kept unless replaced, promoCode kept', async () => {
      const now = new Date(T);
      const first = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'active', provider: 'stripe', customerRef: 'cus_1', providerRef: 'pi_1', promoCode: 'HOYA20' }, now);
      expect(first).toMatchObject({ subjectId: 'space:f', planKey: 'family_lifetime', status: 'active', customerRef: 'cus_1', providerRef: 'pi_1', promoCode: 'HOYA20', seats: null, expiresAt: null, updatedAt: T });
      const second = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'expired', provider: 'stripe', expiresAt: '2027-01-01T00:00:00.000Z' }, now);
      expect(second.id).toBe(first.id);
      expect(second).toMatchObject({ status: 'expired', customerRef: 'cus_1', providerRef: 'pi_1', promoCode: 'HOYA20', expiresAt: '2027-01-01T00:00:00.000Z' });
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:f', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 300 }, now);
      const rows: Entitlement[] = await db.entitlementsFor('space', 'space:f');
      expect(rows.map((e) => [e.planKey, e.seats])).toEqual([
        ['family_lifetime', null],
        ['school_seat', 300],
      ]);
      expect(await db.entitlementsFor('account', 'space:f')).toEqual([]);
      const cleared = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:f', planKey: 'school_seat', status: 'active', provider: 'manual', seats: null, expiresAt: null }, now);
      expect(cleared.seats).toBeNull();
    });

    it('reset wipes every table', async () => {
      await db.putAccount({ id: 'mom', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:f', 'family', 'mom'));
      await db.reset();
      expect(await db.getAccount('mom')).toBeNull();
      expect(await db.getSpace('space:f')).toBeNull();
    });
  });
}

contract('memory', () => new MemoryDb());
const sqlite = openSqliteD1();
contract('sqlite (real migrations)', () => new D1Db(sqlite));
