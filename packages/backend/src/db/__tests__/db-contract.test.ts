import type { CurriculumMeta, Entitlement, Plan, Space } from '@hangul-route/content-schema';
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

    it('column-targeted learner writes: touch, profile edit (newest wins) and the rescue hash', async () => {
      const learner = { id: 'profile:suni', displayName: 'test', ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T };
      await db.putLearner(learner);
      await db.putLearner({ ...learner, id: 'profile:other', displayName: 'Other' });

      await db.touchLearner('profile:suni', '2026-10-08T00:00:00.000Z');
      expect(await db.getLearner('profile:suni')).toEqual({ ...learner, lastActiveAt: '2026-10-08T00:00:00.000Z', profileUpdatedAt: null });

      expect(await db.updateLearnerProfile('profile:suni', { displayName: 'Sungjoo' }, '2026-10-09T00:00:00.000Z')).toBe(true);
      expect(await db.getLearner('profile:suni')).toMatchObject({ displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', lastActiveAt: '2026-10-08T00:00:00.000Z', profileUpdatedAt: '2026-10-09T00:00:00.000Z' });
      // only the given columns change
      expect(await db.updateLearnerProfile('profile:suni', { ageGroup: '8-9', avatar: 'hoya-blue' }, '2026-10-10T00:00:00.000Z')).toBe(true);
      expect(await db.getLearner('profile:suni')).toMatchObject({ displayName: 'Sungjoo', ageGroup: '8-9', avatar: 'hoya-blue', profileUpdatedAt: '2026-10-10T00:00:00.000Z' });
      // an older edit is refused and changes nothing; an equal time applies
      expect(await db.updateLearnerProfile('profile:suni', { displayName: 'Old' }, '2026-10-09T12:00:00.000Z')).toBe(false);
      expect((await db.getLearner('profile:suni'))?.displayName).toBe('Sungjoo');
      expect(await db.updateLearnerProfile('profile:suni', { displayName: 'Same' }, '2026-10-10T00:00:00.000Z')).toBe(true);
      expect((await db.getLearner('profile:suni'))?.displayName).toBe('Same');
      // nothing to write, or no such learner: not applied
      expect(await db.updateLearnerProfile('profile:suni', {}, '2026-10-11T00:00:00.000Z')).toBe(false);
      expect((await db.getLearner('profile:suni'))?.profileUpdatedAt).toBe('2026-10-10T00:00:00.000Z');
      expect(await db.updateLearnerProfile('profile:nobody', { displayName: 'X' }, '2026-10-11T00:00:00.000Z')).toBe(false);
      expect(await db.getLearner('profile:nobody')).toBeNull();
      // the other learner is untouched
      expect(await db.getLearner('profile:other')).toEqual({ ...learner, id: 'profile:other', displayName: 'Other', profileUpdatedAt: null });

      await db.setRecoveryHash('profile:suni', 'hash-1');
      expect(await db.getLearner('profile:suni')).toMatchObject({ recoveryHash: 'hash-1', displayName: 'Same', ageGroup: '8-9', lastActiveAt: '2026-10-08T00:00:00.000Z' });
      expect((await db.learnerByRecoveryHash('hash-1'))?.id).toBe('profile:suni');
      await expect(db.setRecoveryHash('profile:other', 'hash-1')).rejects.toThrow(/UNIQUE/);
      expect((await db.getLearner('profile:other'))?.recoveryHash).toBeNull();
      // a touch and a hash write never undo the profile edit
      await db.touchLearner('profile:suni', '2026-10-12T00:00:00.000Z');
      expect(await db.getLearner('profile:suni')).toMatchObject({ displayName: 'Same', recoveryHash: 'hash-1', lastActiveAt: '2026-10-12T00:00:00.000Z' });
    });

    it('learners, devices and snapshots; deleteLearner erases everything of theirs', async () => {
      const learner = { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T };
      await db.putLearner(learner);
      const read = await db.getLearner('profile:suni');
      expect(read).toEqual({ ...learner, profileUpdatedAt: null }); // never edited since registration (migration 0010)
      if (read) {
        read.recoveryHash = 'hash-1';
        read.lastActiveAt = '2026-10-08T00:00:00.000Z';
      }
      expect((await db.getLearner('profile:suni'))?.recoveryHash).toBeNull(); // reads are copies: nothing saved without put
      await db.putLearner({ ...learner, recoveryHash: 'hash-1' });
      expect((await db.learnerByRecoveryHash('hash-1'))?.id).toBe('profile:suni');
      expect(await db.learnerByRecoveryHash('nope')).toBeNull();

      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-a', secretHash: 'h', scope: 'full', createdAt: T, lastSeenAt: T });
      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-a', secretHash: 'h2', scope: 'full', createdAt: T, lastSeenAt: '2026-10-08T00:00:00.000Z' });
      expect(await db.getDevice('profile:suni', 'device-a')).toMatchObject({ secretHash: 'h2', scope: 'full', lastSeenAt: '2026-10-08T00:00:00.000Z' });
      // a class-approved binding is limited (SEC-4); a later rescue claim on the same device widens it
      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-c', secretHash: 'h3', scope: 'class', createdAt: T, lastSeenAt: T });
      expect((await db.getDevice('profile:suni', 'device-c'))?.scope).toBe('class');
      await db.putDevice({ learnerId: 'profile:suni', deviceId: 'device-c', secretHash: 'h4', scope: 'full', createdAt: T, lastSeenAt: T });
      expect(await db.getDevice('profile:suni', 'device-c')).toMatchObject({ secretHash: 'h4', scope: 'full' });
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

    it('a recovery hash belongs to one learner at a time (UNIQUE, as in the D1 schema)', async () => {
      const learner = (id: string, recoveryHash: string | null) => ({ id, displayName: id, ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash, createdAt: T, lastActiveAt: T });
      await db.putLearner(learner('profile:a', 'hash-1'));
      await db.putLearner(learner('profile:a', 'hash-1')); // re-saving the holder is fine
      await expect(db.putLearner(learner('profile:b', 'hash-1'))).rejects.toThrow(/UNIQUE/);
      expect(await db.getLearner('profile:b')).toBeNull();
      await db.putLearner(learner('profile:b', null));
      await db.putLearner(learner('profile:c', null)); // any number of learners may have no code
      expect((await db.learnerByRecoveryHash('hash-1'))?.id).toBe('profile:a');
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

    it('summaryOf reads the summary and its time, never the payload (F-REPORT-001 section 3.8)', async () => {
      await db.putLearner({ id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
      expect(await db.summaryOf('profile:suni')).toBeNull();
      const later = '2026-10-08T09:30:00.000Z';
      await db.putSnapshot({ learnerId: 'profile:suni', rev: 1, schemaVer: 1, contentVer: '2026.10', deviceId: 'device-a', summary: { cardsUnlocked: 3, needsPractice: ['ㅂ'] }, payload: { profileId: 'profile:suni', cards: ['secret'] }, updatedAt: later }, 0);
      const read = await db.summaryOf('profile:suni');
      expect(read).toEqual({ learnerId: 'profile:suni', summary: { cardsUnlocked: 3, needsPractice: ['ㅂ'] }, updatedAt: later });
      expect(JSON.stringify(read)).not.toContain('secret');
      // reads are copies: nothing saved without put
      (read?.summary as { cardsUnlocked: number }).cardsUnlocked = 99;
      expect((await db.summaryOf('profile:suni'))?.summary).toEqual({ cardsUnlocked: 3, needsPractice: ['ㅂ'] });
      expect(await db.summaryOf('profile:nobody')).toBeNull();
    });

    it('summariesOf and learnersOf read many learners at once: duplicates once, unknown ids skipped, across chunks of 100 (F-REPORT-001 section 3.8, RP-5b)', async () => {
      expect(await db.summariesOf([])).toEqual([]);
      expect(await db.learnersOf([])).toEqual([]);
      // 250 learners: 3 chunks of up to 100 ids; every 5th has no saved summary.
      const ids = Array.from({ length: 250 }, (_, i) => `profile:l${String(i).padStart(3, '0')}`);
      for (const [i, id] of ids.entries()) {
        await db.putLearner({ id, displayName: `L${i}`, ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
        if (i % 5 !== 0) await db.putSnapshot({ learnerId: id, rev: 1, schemaVer: 1, contentVer: '2026.10', deviceId: `device-${i}`, summary: { cardsUnlocked: i }, payload: { profileId: id, cards: ['secret'] }, updatedAt: T }, 0);
      }
      const asked = [...ids, ids[1] as string, 'profile:nobody', ids[2] as string];
      const summaries = await db.summariesOf(asked);
      expect(summaries).toHaveLength(200);
      expect([...summaries].sort((a, b) => a.learnerId.localeCompare(b.learnerId))[0]).toEqual({ learnerId: 'profile:l001', summary: { cardsUnlocked: 1 }, updatedAt: T });
      expect(new Set(summaries.map((row) => row.learnerId))).toEqual(new Set(ids.filter((_, i) => i % 5 !== 0)));
      expect(JSON.stringify(summaries)).not.toContain('secret');
      // reads are copies
      (summaries[0]?.summary as { cardsUnlocked: number }).cardsUnlocked = -1;
      expect((await db.summariesOf([summaries[0]?.learnerId as string]))[0]?.summary).not.toEqual({ cardsUnlocked: -1 });
      expect([...(await db.learnersOf(asked))].sort()).toEqual(ids);
      expect(await db.learnersOf(['profile:nobody'])).toEqual([]);
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
      const plan: Plan = { id: 'plan:1', spaceId: 'space:c', authorAccountId: 't', title: 'Week 1', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-10', note: 'warm up' }], targetLearnerIds: null, publishedAt: null, archivedAt: null, createdAt: T, updatedAt: T, meta: null };
      await db.putPlan(plan);
      expect(await db.getPlan('plan:1')).toEqual(plan);
      await db.putPlan({ ...plan, targetLearnerIds: ['profile:a'], publishedAt: T, updatedAt: '2026-10-08T00:00:00.000Z' });
      expect(await db.getPlan('plan:1')).toMatchObject({ targetLearnerIds: ['profile:a'], publishedAt: T });
      expect(await db.getPlan('plan:nope')).toBeNull();
      await db.putPlan({ ...plan, id: 'plan:2' });
      expect((await db.plansOf('space:c')).map((p) => p.id).sort()).toEqual(['plan:1', 'plan:2']);
      expect(await db.plansOf('space:other')).toEqual([]);
    });

    it('plans: a curriculum meta round-trips, updates on conflict and can be cleared (F-PLAN-002 section 3.5)', async () => {
      await db.putAccount({ id: 't', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:c', 'class', 't'));
      const meta: CurriculumMeta = {
        kind: 'curriculum',
        generatorVersion: 1,
        catalogVersion: 1,
        params: { audience: 'class', level: { stage: 'stage1', band: 0 }, startDate: '2026-10-18', weeks: 1, sessionsPerWeek: 2, minutesPerSession: 10, daysOff: [], goals: { focus: 'balanced' }, includeComingSoon: true, culturalAnchors: true, unlockedStages: ['stage1'] },
        weeks: [{ index: 1, startDate: '2026-10-18', kind: 'learn', focus: { episodeId: 'episode:stage1-letters', storyIds: [], festival: null }, extras: [] }],
        horizonDays: 7,
        repacedAt: null,
      };
      const plan: Plan = { id: 'plan:r', spaceId: 'space:c', authorAccountId: 't', title: 'Term', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-18', week: 1 }], targetLearnerIds: null, publishedAt: T, archivedAt: null, createdAt: T, updatedAt: T, meta };
      await db.putPlan(plan);
      expect(await db.getPlan('plan:r')).toEqual(plan);
      const repaced = { ...meta, repacedAt: '2026-10-25T00:00:00.000Z' };
      await db.putPlan({ ...plan, meta: repaced });
      expect((await db.getPlan('plan:r'))?.meta).toEqual(repaced);
      expect((await db.plansOf('space:c'))[0]?.meta).toEqual(repaced);
      await db.putPlan({ ...plan, meta: null });
      expect((await db.getPlan('plan:r'))?.meta).toBeNull();
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

    it('entitlementByProviderRef finds the row a Stripe subscription id points at (F-BILL-002 §5.5)', async () => {
      const now = new Date(T);
      expect(await db.entitlementByProviderRef('stripe', 'sub_1')).toBeNull();
      const lic = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:c', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1' }, now);
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:s', planKey: 'school_seat', status: 'active', provider: 'manual', providerRef: 'sub_1' }, now);
      expect(await db.entitlementByProviderRef('stripe', 'sub_1')).toEqual(lic);
      expect((await db.entitlementByProviderRef('manual', 'sub_1'))?.subjectId).toBe('space:s');
      expect(await db.entitlementByProviderRef('stripe', 'sub_2')).toBeNull();
      // Two rows on one subscription (a re-subscribe): the most recently updated wins.
      const later = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:c2', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_1' }, new Date('2026-10-08T00:00:00.000Z'));
      expect(await db.entitlementByProviderRef('stripe', 'sub_1')).toEqual(later);
    });

    it('billing events: insert or keep per (provider, ref, kind), fill a missing paymentRef, read newest first (F-BILL-002 §5.5)', async () => {
      const now = new Date(T);
      const base = { subjectKind: 'space' as const, subjectId: 'space:c', planKey: 'group_license' as const, amountCents: 15300, currency: 'usd', provider: 'stripe' as const, livemode: false };
      const first = await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_1', paymentRef: null, occurredAt: '2026-10-01T00:00:00.000Z' }, now);
      expect(first).toEqual({ ...base, id: first.id, kind: 'purchase', providerRef: 'in_1', paymentRef: null, occurredAt: '2026-10-01T00:00:00.000Z', createdAt: T });
      expect(first.id).toMatch(/^bev:[a-z0-9-]+$/);

      // A webhook retry keeps the stored row (same id, same amount) and only fills the missing paymentRef.
      const retry = await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_1', paymentRef: 'pi_1', amountCents: 1, occurredAt: '2026-10-02T00:00:00.000Z' }, new Date('2026-10-12T00:00:00.000Z'));
      expect(retry).toEqual({ ...first, paymentRef: 'pi_1' });
      // ... and never overwrites one that is already there.
      const again = await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_1', paymentRef: 'pi_other', occurredAt: '2026-10-01T00:00:00.000Z' }, now);
      expect(again).toEqual({ ...first, paymentRef: 'pi_1' });
      expect(await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_1', paymentRef: null, occurredAt: '2026-10-01T00:00:00.000Z' }, now)).toEqual({ ...first, paymentRef: 'pi_1' });

      // The same invoice can hold another kind (a failed attempt before the payment).
      const failed = await db.recordBillingEvent({ ...base, kind: 'failed', providerRef: 'in_1', paymentRef: null, occurredAt: '2026-09-30T00:00:00.000Z' }, now);
      expect(failed.id).not.toBe(first.id);
      const renewal = await db.recordBillingEvent({ ...base, kind: 'renewal', providerRef: 'in_2', paymentRef: 'pi_2', livemode: true, occurredAt: '2027-10-01T00:00:00.000Z' }, now);
      expect(renewal.livemode).toBe(true);
      const refund = await db.recordBillingEvent({ ...base, kind: 'refund', providerRef: 'ch_2:refund:500', paymentRef: null, amountCents: 500, occurredAt: '2027-10-02T00:00:00.000Z' }, now);
      await db.recordBillingEvent({ ...base, subjectId: 'space:other', kind: 'purchase', providerRef: 'in_9', paymentRef: null, occurredAt: '2026-10-05T00:00:00.000Z' }, now);
      await db.recordBillingEvent({ ...base, subjectKind: 'account', kind: 'purchase', providerRef: 'in_8', paymentRef: null, occurredAt: '2026-10-05T00:00:00.000Z' }, now);

      expect((await db.billingEventsFor('space', 'space:c', 50)).map((e) => e.id)).toEqual([refund.id, renewal.id, first.id, failed.id]);
      expect((await db.billingEventsFor('space', 'space:c', 2)).map((e) => e.id)).toEqual([refund.id, renewal.id]);
      expect((await db.billingEventsFor('account', 'space:c', 50)).map((e) => e.providerRef)).toEqual(['in_8']);
      expect(await db.billingEventsFor('space', 'space:none', 50)).toEqual([]);

      expect(await db.billingEventById(renewal.id)).toEqual(renewal);
      expect(await db.billingEventById('bev:missing')).toBeNull();

      expect(await db.billingEventByRef('stripe', 'in_1', 'failed')).toEqual(failed);
      expect(await db.billingEventByRef('stripe', 'in_1', 'purchase')).toEqual({ ...first, paymentRef: 'pi_1' });
      // Without a kind: the newest row on that ref.
      expect((await db.billingEventByRef('stripe', 'in_1'))?.id).toBe(first.id);
      expect(await db.billingEventByRef('stripe', 'in_1', 'refund')).toBeNull();
      expect(await db.billingEventByRef('manual', 'in_1')).toBeNull();

      expect(await db.billingEventByPaymentRef('pi_2')).toEqual(renewal);
      expect((await db.billingEventByPaymentRef('pi_1'))?.id).toBe(first.id);
      expect(await db.billingEventByPaymentRef('pi_none')).toBeNull();

      // Reads are copies.
      const read = await db.billingEventById(first.id);
      if (read) read.amountCents = 0;
      expect((await db.billingEventById(first.id))?.amountCents).toBe(15300);

      await db.reset();
      expect(await db.billingEventsFor('space', 'space:c', 50)).toEqual([]);
    });

    it('billing events: both backends refuse a row the BillingEvent schema refuses, store an empty paymentRef as null, and keep only known fields', async () => {
      const now = new Date(T);
      const ok = { subjectKind: 'space' as const, subjectId: 'space:c', planKey: 'group_license' as const, kind: 'purchase' as const, amountCents: 15300, currency: 'usd', provider: 'stripe' as const, providerRef: 'in_1', paymentRef: null, livemode: false, occurredAt: '2026-10-01T00:00:00.000Z' };
      // An empty paymentRef means "unknown": stored as NULL, so a later event can still fill it, and '' never matches a lookup.
      expect((await db.recordBillingEvent({ ...ok, paymentRef: '' }, now)).paymentRef).toBeNull();
      expect((await db.recordBillingEvent({ ...ok, paymentRef: 'pi_1' }, now)).paymentRef).toBe('pi_1');
      expect(await db.recordBillingEvent({ ...ok, providerRef: 'in_2', paymentRef: '' }, now)).toMatchObject({ providerRef: 'in_2', paymentRef: null });
      expect((await db.recordBillingEvent({ ...ok, providerRef: 'in_2', paymentRef: '' }, now)).paymentRef).toBeNull(); // '' never fills either
      expect(await db.billingEventByPaymentRef('')).toBeNull();

      const refused = [
        { ...ok, providerRef: 'r1', amountCents: -1 }, // a negative refund delta (B-3) is a bug, never a row
        { ...ok, providerRef: 'r2', amountCents: 1.5 },
        { ...ok, providerRef: 'r3', kind: 'chargeback' },
        { ...ok, providerRef: 'r4', planKey: 'teacher_pro' },
        { ...ok, providerRef: 'r5', provider: 'paypal' },
        { ...ok, providerRef: 'r6', subjectKind: 'learner' },
        { ...ok, providerRef: 'r7', currency: 'USD' },
        { ...ok, providerRef: '' },
        { ...ok, providerRef: 'r9', subjectId: '' },
        { ...ok, providerRef: 'r10', occurredAt: '2026-10-01' }, // rows sort by occurred_at as text: canonical ISO only
        { ...ok, providerRef: 'r11', occurredAt: '2026-10-01T00:00:00Z' },
        { ...ok, providerRef: 'r12', occurredAt: 'yesterday' },
      ] as unknown as Parameters<Db['recordBillingEvent']>[0][];
      for (const input of refused) await expect(db.recordBillingEvent(input, now), JSON.stringify(input)).rejects.toThrow(/recordBillingEvent/);
      expect((await db.billingEventsFor('space', 'space:c', 50)).map((e) => e.providerRef).sort()).toEqual(['in_1', 'in_2']);

      // A wider runtime object carries no extra key into either backend.
      const wide = { ...ok, providerRef: 'in_3', receiptUrl: 'https://pay.stripe.com/receipts/x' } as Parameters<Db['recordBillingEvent']>[0];
      const stored = await db.recordBillingEvent(wide, now);
      expect(Object.keys(stored).sort()).toEqual(['amountCents', 'createdAt', 'currency', 'id', 'kind', 'livemode', 'occurredAt', 'paymentRef', 'planKey', 'provider', 'providerRef', 'subjectId', 'subjectKind']);
      expect(Object.keys((await db.billingEventById(stored.id)) ?? {})).not.toContain('receiptUrl');
    });

    it('billing events: the read limit is a non-negative integer on both backends', async () => {
      const now = new Date(T);
      const base = { subjectKind: 'space' as const, subjectId: 'space:c', planKey: 'group_license' as const, kind: 'purchase' as const, amountCents: 100, currency: 'usd', provider: 'stripe' as const, paymentRef: null, livemode: false };
      for (const n of [1, 2, 3]) await db.recordBillingEvent({ ...base, providerRef: `in_${n}`, occurredAt: `2026-10-0${n}T00:00:00.000Z` }, now);
      expect(await db.billingEventsFor('space', 'space:c', 0)).toEqual([]);
      expect((await db.billingEventsFor('space', 'space:c', 3)).map((e) => e.providerRef)).toEqual(['in_3', 'in_2', 'in_1']);
      for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) await expect(db.billingEventsFor('space', 'space:c', bad), String(bad)).rejects.toThrow(/billingEventsFor: limit/);
    });

    it('billing events and entitlements: ties break the same way on both backends (occurredAt, then createdAt, then id)', async () => {
      const base = { subjectKind: 'space' as const, subjectId: 'space:c', planKey: 'group_license' as const, amountCents: 15300, currency: 'usd', provider: 'stripe' as const, livemode: false };
      const second = '2026-10-01T00:00:00.000Z'; // Stripe stamps whole seconds: a failed attempt and the paid invoice can share one
      const failed = await db.recordBillingEvent({ ...base, kind: 'failed', providerRef: 'in_1', paymentRef: 'pi_1', occurredAt: second }, new Date('2026-10-01T00:00:01.000Z'));
      const paid = await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_1', paymentRef: 'pi_1', occurredAt: second }, new Date('2026-10-01T00:00:02.000Z'));
      // Same occurredAt: the later recorded row is newer, whatever the random ids.
      expect((await db.billingEventsFor('space', 'space:c', 50)).map((e) => e.id)).toEqual([paid.id, failed.id]);
      expect((await db.billingEventByRef('stripe', 'in_1'))?.id).toBe(paid.id);
      // Same occurredAt and createdAt: the greater id first, identically on both backends.
      const sameNow = new Date('2026-10-01T00:00:03.000Z');
      const a = await db.recordBillingEvent({ ...base, kind: 'renewal', providerRef: 'in_2', paymentRef: null, occurredAt: '2026-10-02T00:00:00.000Z' }, sameNow);
      const b = await db.recordBillingEvent({ ...base, kind: 'renewal', providerRef: 'in_3', paymentRef: null, occurredAt: '2026-10-02T00:00:00.000Z' }, sameNow);
      const byIdDesc = [a.id, b.id].sort().reverse();
      expect((await db.billingEventsFor('space', 'space:c', 2)).map((e) => e.id)).toEqual(byIdDesc);

      const now = new Date(T);
      const e1 = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:x', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_tie' }, now);
      const e2 = await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:y', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_tie' }, now);
      expect((await db.entitlementByProviderRef('stripe', 'sub_tie'))?.id).toBe([e1.id, e2.id].sort().reverse()[0]);
    });

    it('billingEventByPaymentRef answers the purchase or renewal row a refund belongs to, never a failed or refund row (§5.4)', async () => {
      const now = new Date(T);
      const base = { subjectKind: 'space' as const, subjectId: 'space:c', planKey: 'group_license' as const, amountCents: 15300, currency: 'usd', provider: 'stripe' as const, livemode: false };
      // Stripe reuses an invoice's payment intent across attempts: a newer failed row on the same intent is skipped.
      const paid = await db.recordBillingEvent({ ...base, kind: 'renewal', providerRef: 'in_1', paymentRef: 'pi_1', occurredAt: '2026-10-01T00:00:00.000Z' }, now);
      await db.recordBillingEvent({ ...base, kind: 'failed', providerRef: 'in_1', paymentRef: 'pi_1', occurredAt: '2026-10-05T00:00:00.000Z' }, now);
      await db.recordBillingEvent({ ...base, kind: 'refund', providerRef: 'ch_1:refund:500', paymentRef: 'pi_1', amountCents: 500, occurredAt: '2026-10-06T00:00:00.000Z' }, now);
      expect(await db.billingEventByPaymentRef('pi_1')).toEqual(paid);
      await db.recordBillingEvent({ ...base, kind: 'failed', providerRef: 'in_2', paymentRef: 'pi_2', occurredAt: '2026-10-05T00:00:00.000Z' }, now);
      expect(await db.billingEventByPaymentRef('pi_2')).toBeNull();
      const purchase = await db.recordBillingEvent({ ...base, kind: 'purchase', providerRef: 'in_3', paymentRef: 'pi_3', occurredAt: '2026-10-07T00:00:00.000Z' }, now);
      expect(await db.billingEventByPaymentRef('pi_3')).toEqual(purchase);
    });

    it('set-based reads for the billing summary: many spaces in one call, the same answer as the per-space reads (F-BILL-002 B-4)', async () => {
      const now = new Date(T);
      await db.putAccount({ id: 't', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space('space:s', 'school', 't'));
      await db.putSpace(space('space:c1', 'class', 't', 'space:s'));
      await db.putSpace(space('space:c2', 'class', 't', 'space:s'));
      await db.putSpace(space('space:f', 'family', 't'));
      await db.addMembership({ spaceId: 'space:c1', memberKind: 'learner', memberId: 'profile:a', role: 'student', joinedAt: T });
      await db.addMembership({ spaceId: 'space:c2', memberKind: 'learner', memberId: 'profile:b', role: 'student', joinedAt: T });
      await db.addMembership({ spaceId: 'space:f', memberKind: 'account', memberId: 't', role: 'owner', joinedAt: T });
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:s', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_s' }, now);
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:f', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_f' }, now);
      await db.applyEntitlement({ subjectKind: 'account', subjectId: 'space:f', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_acct' }, now);
      const base = { subjectKind: 'space' as const, planKey: 'group_license' as const, kind: 'renewal' as const, amountCents: 100, currency: 'usd', provider: 'stripe' as const, paymentRef: null, livemode: false };
      for (const n of [1, 2, 3, 4]) await db.recordBillingEvent({ ...base, subjectId: 'space:s', providerRef: `in_s${n}`, occurredAt: `2026-10-0${n}T00:00:00.000Z` }, now);
      await db.recordBillingEvent({ ...base, subjectId: 'space:f', providerRef: 'in_f1', occurredAt: '2026-10-01T00:00:00.000Z' }, now);
      await db.recordBillingEvent({ ...base, subjectKind: 'account', subjectId: 'space:f', providerRef: 'in_acct', occurredAt: '2026-10-09T00:00:00.000Z' }, now);

      const ids = ['space:s', 'space:f', 'space:none'];
      const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((x, y) => x.id.localeCompare(y.id));
      expect(byId(await db.entitlementsForSpaces(ids))).toEqual(byId([...(await db.entitlementsFor('space', 'space:s')), ...(await db.entitlementsFor('space', 'space:f'))]));
      expect(await db.entitlementsForSpaces([])).toEqual([]);
      const members = await db.membersOfSpaces(['space:c1', 'space:c2', 'space:f']);
      expect(members.map((m) => `${m.spaceId}/${m.memberId}`).sort()).toEqual(['space:c1/profile:a', 'space:c2/profile:b', 'space:f/t']);
      expect(await db.membersOfSpaces([])).toEqual([]);
      expect((await db.childSpacesOfSpaces(['space:s', 'space:f'])).map((s) => s.id).sort()).toEqual(['space:c1', 'space:c2']);
      expect(await db.childSpacesOfSpaces([])).toEqual([]);

      const events = await db.billingEventsForSpaces(ids, 3);
      const of = (id: string) => events.filter((e) => e.subjectId === id);
      expect(of('space:s')).toEqual(await db.billingEventsFor('space', 'space:s', 3));
      expect(of('space:f').map((e) => e.providerRef)).toEqual(['in_f1']); // never the account row of the same id
      expect(events).toHaveLength(4);
      expect(await db.billingEventsForSpaces(ids, 0)).toEqual([]);
      expect(await db.billingEventsForSpaces([], 3)).toEqual([]);
      await expect(db.billingEventsForSpaces(ids, -1)).rejects.toThrow(/billingEventsFor: limit/);
    });

    it('waitlist: addWaitlist is idempotent per address, keeps the first row and an unsubscribe, and reset wipes it', async () => {
      expect(await db.waitlistEntries()).toEqual([]);
      await db.addWaitlist({ email: 'a@example.com', createdAt: T, source: 'landing', locale: 'en', consentTextVersion: 'v1' });
      await db.addWaitlist({ email: 'a@example.com', createdAt: '2026-10-09T00:00:00.000Z', source: 'other', locale: 'ko', consentTextVersion: 'v2' });
      await db.addWaitlist({ email: 'b@example.com', createdAt: '2026-10-08T00:00:00.000Z', source: null, locale: null, consentTextVersion: 'v1' });
      expect(await db.waitlistEntries()).toEqual([
        { email: 'a@example.com', createdAt: T, source: 'landing', locale: 'en', consentTextVersion: 'v1', unsubscribedAt: null },
        { email: 'b@example.com', createdAt: '2026-10-08T00:00:00.000Z', source: null, locale: null, consentTextVersion: 'v1', unsubscribedAt: null },
      ]);
      expect(await db.unsubscribeWaitlist('a@example.com', new Date('2026-10-10T00:00:00.000Z'))).toBe(true);
      expect(await db.unsubscribeWaitlist('missing@example.com', new Date(T))).toBe(false);
      await db.addWaitlist({ email: 'a@example.com', createdAt: T, source: null, locale: null, consentTextVersion: 'v3' });
      expect((await db.waitlistEntries())[0]).toMatchObject({ email: 'a@example.com', unsubscribedAt: '2026-10-10T00:00:00.000Z', consentTextVersion: 'v1' });
      await db.reset();
      expect(await db.waitlistEntries()).toEqual([]);
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
