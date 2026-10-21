import { SCHOOL_ADMIN_CAP, type Space } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { ADMIN_INVITE_RETENTION_DAYS, runScheduledPurge } from '../../lib/note-retention';
import type { CreateAdminInviteInput } from '../admin-types';
import { D1Db } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS sections 6.1 to 6.4: the guarded invite create and revoke, the space-pinned accept
 * batch with the bound cap and teacher-only promotion, ending an admin role (back to teacher or out), and
 * insert-if-absent memberships. On D1 (the SQLite shim runs the real migrations and the real SQL) and in the memory
 * store.
 */
const T = '2026-10-20T00:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number): Date => new Date(Date.parse(T) + ms);
const SCHOOL = 'space:school';
const OTHER = 'space:other';

const space = (id: string, over: Partial<Space> = {}): Space => ({
  id,
  kind: 'school',
  name: id,
  parentSpaceId: null,
  ownerAccountId: 'principal',
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: true },
  archivedAt: null,
  createdAt: T,
  ...over,
});
let seq = 0;
const invite = (over: Partial<CreateAdminInviteInput['invite']> = {}): CreateAdminInviteInput['invite'] => {
  seq += 1;
  return { id: `invite:${seq}`, spaceId: SCHOOL, tokenHash: `hash-${seq}`, createdBy: 'principal', createdAt: T, expiresAt: at(7 * DAY).toISOString(), ...over };
};
const create = (db: Db, over: Partial<CreateAdminInviteInput['invite']> = {}, cap = SCHOOL_ADMIN_CAP) => {
  const row = invite(over);
  return db.createAdminInvite({ invite: row, cap, eventId: `sev:c-${row.id}` }).then((created) => ({ created, row }));
};
const accept = (db: Db, inviteId: string, accountId: string, over: { spaceId?: string; now?: Date; cap?: number } = {}) =>
  db.acceptAdminInvite({ inviteId, spaceId: over.spaceId ?? SCHOOL, accountId, now: over.now ?? at(DAY), cap: over.cap ?? SCHOOL_ADMIN_CAP, eventId: `sev:a-${inviteId}-${accountId}` });
const account = async (db: Db, id: string) => db.putAccount({ id, email: null, displayName: null, consent: null, createdAt: T });
const roleOf = async (db: Db, spaceId: string, accountId: string) => (await db.membership(spaceId, 'account', accountId))?.role ?? null;
const kinds = async (db: Db, spaceId = SCHOOL) => (await db.spaceEventsOf(spaceId, 50)).map((e) => e.kind).sort();

function adminContract(name: string, make: () => Db): void {
  describe(`school administrators · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      for (const id of ['principal', 'other-owner', 'dean', 'vice', 'kim', 'lee']) await account(db, id);
      await db.putSpace(space(SCHOOL));
      await db.putSpace(space(OTHER, { ownerAccountId: 'other-owner' }));
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'principal', role: 'owner', joinedAt: T });
    });

    it('create counts admins and open invites against the bound cap; expired and revoked invites free their place', async () => {
      expect((await create(db)).created).toBe(true);
      const second = await create(db);
      expect(second.created).toBe(true);
      expect((await create(db)).created).toBe(false); // 0 admins + 2 open = 2
      expect(await db.revokeAdminInvite({ inviteId: second.row.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(1), eventId: 'sev:r1' })).toBe(1);
      expect((await create(db, { createdAt: at(2).toISOString() })).created).toBe(true);
      // An expired invite holds no place: an invite made when the first one has ended passes.
      expect((await create(db, { createdAt: at(8 * DAY).toISOString(), expiresAt: at(15 * DAY).toISOString() })).created).toBe(true);
      expect(await db.openAdminInvites(SCHOOL, at(3))).toHaveLength(3); // the later one, read before it was made
      expect(await db.openAdminInvites(SCHOOL, at(8 * DAY))).toHaveLength(1);
      expect(await kinds(db)).toEqual(['admin_invite_created', 'admin_invite_created', 'admin_invite_created', 'admin_invite_created', 'admin_invite_revoked']);
      // the cap is bound, never a literal
      expect((await create(db, { createdAt: at(8 * DAY).toISOString(), expiresAt: at(15 * DAY).toISOString() }, 3)).created).toBe(true);
    });

    it('two concurrent creates for the last place: exactly one is made', async () => {
      await create(db);
      const both = await Promise.all([create(db), create(db)]);
      expect(both.map((x) => x.created).sort()).toEqual([false, true]);
      expect(await db.openAdminInvites(SCHOOL, at(1))).toHaveLength(2);
      expect((await db.spaceEventsOf(SCHOOL, 10)).filter((e) => e.kind === 'admin_invite_created')).toHaveLength(2);
    });

    it('create refuses an archived school or a space that is not a school, and writes no event', async () => {
      await db.putSpace(space(SCHOOL, { archivedAt: T }));
      expect((await create(db)).created).toBe(false);
      await db.putSpace(space('space:fam', { kind: 'family' }));
      expect((await create(db, { spaceId: 'space:fam' })).created).toBe(false);
      expect(await kinds(db)).toEqual([]);
    });

    it('stores the hash it is given and finds the invite by it', async () => {
      const { row } = await create(db, { tokenHash: 'ab'.repeat(32) });
      expect(await db.adminInviteByHash('ab'.repeat(32))).toEqual({ ...row, acceptedBy: null, acceptedAt: null, revokedAt: null });
      expect(await db.adminInviteByHash('cd'.repeat(32))).toBeNull();
      expect(await db.getAdminInvite(row.id)).toMatchObject({ id: row.id, spaceId: SCHOOL });
    });

    it('two accepts of two invites for the last place at once: one admin is added', async () => {
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'vice', role: 'admin', joinedAt: T });
      const a = (await create(db, {}, 5)).row;
      const b = (await create(db, {}, 5)).row;
      const outcomes = await Promise.all([accept(db, a.id, 'dean'), accept(db, b.id, 'kim')]);
      expect(outcomes.sort()).toEqual([false, true]);
      const admins = (await db.membersOf(SCHOOL)).filter((m) => m.role === 'admin');
      expect(admins).toHaveLength(2);
      expect((await db.spaceEventsOf(SCHOOL, 10)).filter((e) => e.kind === 'admin_joined')).toHaveLength(1);
    });

    it('the batch writes nothing when the gate fails: used, revoked, expired, full, owner, already admin', async () => {
      const used = (await create(db, {}, 9)).row;
      expect(await accept(db, used.id, 'dean')).toBe(true);
      expect(await accept(db, used.id, 'kim')).toBe(false); // single use
      const revoked = (await create(db, {}, 9)).row;
      await db.revokeAdminInvite({ inviteId: revoked.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(1), eventId: 'sev:r' });
      expect(await accept(db, revoked.id, 'kim')).toBe(false);
      const expired = (await create(db, { expiresAt: at(DAY).toISOString() }, 9)).row;
      expect(await accept(db, expired.id, 'kim', { now: at(DAY) })).toBe(false); // expires_at > now, strictly
      const open = (await create(db, {}, 9)).row;
      expect(await accept(db, open.id, 'principal')).toBe(false); // the owner
      expect(await accept(db, open.id, 'dean')).toBe(false); // already an admin
      expect(await accept(db, open.id, 'kim', { cap: 1 })).toBe(false); // full
      expect(await roleOf(db, SCHOOL, 'kim')).toBeNull();
      expect((await db.getAdminInvite(open.id))?.acceptedAt).toBeNull();
      expect((await db.spaceEventsOf(SCHOOL, 20)).filter((e) => e.kind === 'admin_joined').map((e) => e.subjectAccountId)).toEqual(['dean']);
      // and an archived school takes no accept
      await db.putSpace(space(SCHOOL, { archivedAt: T }));
      expect(await accept(db, open.id, 'kim')).toBe(false);
    });

    it('an invite of another school is refused by the space-pinned gate', async () => {
      await db.addMembership({ spaceId: OTHER, memberKind: 'account', memberId: 'other-owner', role: 'owner', joinedAt: T });
      const theirs = (await create(db, { spaceId: OTHER, createdBy: 'other-owner' })).row;
      expect(await accept(db, theirs.id, 'dean', { spaceId: SCHOOL })).toBe(false);
      expect(await roleOf(db, SCHOOL, 'dean')).toBeNull();
      expect(await roleOf(db, OTHER, 'dean')).toBeNull();
      expect((await db.getAdminInvite(theirs.id))?.acceptedAt).toBeNull();
      expect(await accept(db, theirs.id, 'dean', { spaceId: OTHER })).toBe(true);
      expect(await roleOf(db, OTHER, 'dean')).toBe('admin');
    });

    it('an accept by an account whose school row is owner changes nothing', async () => {
      // The row disagrees with spaces.owner_account_id: it is never demoted, and the invite stays open.
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'lee', role: 'owner', joinedAt: T });
      const row = (await create(db)).row;
      expect(await accept(db, row.id, 'lee')).toBe(false);
      expect(await roleOf(db, SCHOOL, 'lee')).toBe('owner');
      expect((await db.getAdminInvite(row.id))?.acceptedAt).toBeNull();
    });

    it('a teacher member is promoted, keeps its join date, and records the admin_joined event with ids only', async () => {
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'kim', role: 'teacher', joinedAt: '2026-09-01T00:00:00.000Z' });
      const row = (await create(db)).row;
      expect(await accept(db, row.id, 'kim')).toBe(true);
      expect(await db.membership(SCHOOL, 'account', 'kim')).toEqual({ spaceId: SCHOOL, memberKind: 'account', memberId: 'kim', role: 'admin', joinedAt: '2026-09-01T00:00:00.000Z' });
      expect(await db.getAdminInvite(row.id)).toMatchObject({ acceptedBy: 'kim', acceptedAt: at(DAY).toISOString(), revokedAt: null });
      expect(await db.latestSpaceEvent(SCHOOL, 'admin_joined', 'kim')).toEqual({ id: `sev:a-${row.id}-kim`, spaceId: SCHOOL, kind: 'admin_joined', actorAccountId: 'kim', subjectAccountId: 'kim', subjectSpaceId: null, inviteId: row.id, createdAt: at(DAY).toISOString() });
      expect(await db.latestSpaceEvent(SCHOOL, 'admin_joined', 'lee')).toBeNull();
    });

    it('a revoke after an accept leaves revoked_at null and changes nothing; a revoke is pinned to its school', async () => {
      const row = (await create(db)).row;
      expect(await accept(db, row.id, 'dean')).toBe(true);
      expect(await db.revokeAdminInvite({ inviteId: row.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(2 * DAY), eventId: 'sev:late' })).toBe(0);
      expect((await db.getAdminInvite(row.id))?.revokedAt).toBeNull();
      const open = (await create(db)).row;
      expect(await db.revokeAdminInvite({ inviteId: open.id, spaceId: OTHER, actorAccountId: 'other-owner', now: at(1), eventId: 'sev:x' })).toBe(0);
      expect(await db.revokeAdminInvite({ inviteId: open.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(1), eventId: 'sev:y' })).toBe(1);
      expect(await db.revokeAdminInvite({ inviteId: open.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(2), eventId: 'sev:z' })).toBe(0);
      expect((await db.getAdminInvite(open.id))?.revokedAt).toBe(at(1).toISOString());
      expect((await db.spaceEventsOf(SCHOOL, 20)).filter((e) => e.kind === 'admin_invite_revoked').map((e) => e.id)).toEqual(['sev:y']);
    });

    it('an accept and a teacher-code join of the same account interleaved: the role stays admin', async () => {
      const row = (await create(db)).row;
      expect(await accept(db, row.id, 'dean')).toBe(true);
      // the join read "no row" before the accept; insert-if-absent then writes nothing
      expect(await db.addMembershipIfAbsent({ spaceId: SCHOOL, memberKind: 'account', memberId: 'dean', role: 'teacher', joinedAt: at(2 * DAY).toISOString() })).toBe(false);
      expect(await roleOf(db, SCHOOL, 'dean')).toBe('admin');
      expect(await db.addMembershipIfAbsent({ spaceId: SCHOOL, memberKind: 'account', memberId: 'lee', role: 'teacher', joinedAt: T })).toBe(true);
      expect(await roleOf(db, SCHOOL, 'lee')).toBe('teacher');
    });

    it('ending the role: a promoted teacher with no class goes back to teacher; an admin with a live class stays a teacher; else out', async () => {
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'kim', role: 'teacher', joinedAt: T });
      for (const who of ['kim', 'dean']) expect(await accept(db, (await create(db, {}, 9)).row.id, who, { cap: 9 })).toBe(true);
      expect(await accept(db, (await create(db, {}, 9)).row.id, 'vice', { cap: 9 })).toBe(true);
      // vice teaches a live class of the school; dean only an archived one
      await db.putSpace(space('space:cls', { kind: 'class', parentSpaceId: SCHOOL, ownerAccountId: 'principal' }));
      await db.addMembership({ spaceId: 'space:cls', memberKind: 'account', memberId: 'vice', role: 'teacher', joinedAt: T });
      await db.putSpace(space('space:old', { kind: 'class', parentSpaceId: SCHOOL, ownerAccountId: 'dean', archivedAt: T }));
      expect([await db.adminStaysTeacher(SCHOOL, 'kim'), await db.adminStaysTeacher(SCHOOL, 'vice'), await db.adminStaysTeacher(SCHOOL, 'dean'), await db.adminStaysTeacher(SCHOOL, 'lee')]).toEqual([true, true, false, false]);
      const end = (accountId: string, kind: 'admin_removed' | 'admin_left') => db.endAdminRole({ spaceId: SCHOOL, accountId, actorAccountId: kind === 'admin_left' ? accountId : 'principal', kind, now: at(3 * DAY), eventId: `sev:end-${accountId}` });
      expect(await end('kim', 'admin_left')).toBe('teacher');
      expect(await end('vice', 'admin_removed')).toBe('teacher');
      expect(await end('dean', 'admin_removed')).toBe('none');
      expect(await end('dean', 'admin_removed')).toBeNull(); // no admin row: nothing written
      expect(await end('principal', 'admin_left')).toBeNull(); // the owner row is never touched
      expect([await roleOf(db, SCHOOL, 'kim'), await roleOf(db, SCHOOL, 'vice'), await roleOf(db, SCHOOL, 'dean'), await roleOf(db, SCHOOL, 'principal')]).toEqual(['teacher', 'teacher', null, 'owner']);
      // promoted_from was cleared: a teacher row that becomes admin again and leaves with no class goes out
      expect(await accept(db, (await create(db, {}, 9)).row.id, 'kim', { cap: 9, now: at(4 * DAY) })).toBe(true);
      expect(await db.adminStaysTeacher(SCHOOL, 'kim')).toBe(true); // promoted again, so back to teacher again
      const ended = (await db.spaceEventsOf(SCHOOL, 50)).filter((e) => e.kind === 'admin_removed' || e.kind === 'admin_left');
      expect(ended.map((e) => [e.kind, e.actorAccountId, e.subjectAccountId]).sort()).toEqual([
        ['admin_left', 'kim', 'kim'],
        ['admin_removed', 'principal', 'dean'],
        ['admin_removed', 'principal', 'vice'],
      ]);
    });

    it('a teacher row removed and added again carries no promoted_from', async () => {
      await db.addMembership({ spaceId: SCHOOL, memberKind: 'account', memberId: 'kim', role: 'teacher', joinedAt: T });
      expect(await accept(db, (await create(db)).row.id, 'kim')).toBe(true);
      expect(await db.removeMembership(SCHOOL, 'account', 'kim')).toBe(true);
      expect(await accept(db, (await create(db)).row.id, 'kim')).toBe(true); // a fresh admin row, never a teacher
      expect(await db.adminStaysTeacher(SCHOOL, 'kim')).toBe(false);
    });

    it(`the daily purge removes invites ${ADMIN_INVITE_RETENTION_DAYS} days after they expired, were accepted or were revoked`, async () => {
      const now = at(60 * DAY);
      const old = (n: number) => at(60 * DAY - n * DAY).toISOString();
      const expired = (await create(db, { createdAt: old(40), expiresAt: old(33) }, 9)).row;
      const accepted = (await create(db, { createdAt: old(31), expiresAt: old(-1) }, 9)).row;
      await accept(db, accepted.id, 'dean', { now: at(60 * DAY - 31 * DAY + 1), cap: 9 });
      const revoked = (await create(db, { createdAt: old(32), expiresAt: old(-1) }, 9)).row;
      await db.revokeAdminInvite({ inviteId: revoked.id, spaceId: SCHOOL, actorAccountId: 'principal', now: at(60 * DAY - 31 * DAY), eventId: 'sev:r' });
      const kept = (await create(db, { createdAt: old(20), expiresAt: old(13) }, 9)).row;
      expect(await runScheduledPurge(db, now)).toMatchObject({ adminInvites: 3 });
      expect([await db.getAdminInvite(expired.id), await db.getAdminInvite(accepted.id), await db.getAdminInvite(revoked.id)]).toEqual([null, null, null]);
      expect(await db.getAdminInvite(kept.id)).not.toBeNull();
      expect(await db.purgeAdminInvites(now, 0)).toBe(0);
    });

    it('reset empties the invites', async () => {
      await create(db);
      await db.reset();
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T });
      await db.putSpace(space(SCHOOL));
      expect(await db.openAdminInvites(SCHOOL, at(1))).toEqual([]);
    });
  });
}

adminContract('memory', () => new MemoryDb());
adminContract('D1 (SQLite)', () => new D1Db(openSqliteD1()));
