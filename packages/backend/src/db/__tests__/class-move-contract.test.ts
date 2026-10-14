import type { Space } from '@hangul-route/content-schema';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import type { StoredClassMove } from '../class-move-types';
import { D1Db, type D1Like } from '../d1';
import { MemoryDb } from '../memory';
import type { Db } from '../types';

/**
 * [TV] Class-scope acknowledgements and teacher moves — AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 * sections 4.1 and 4.2. One contract, two backends: every CAS answers the rows it changed and 0 on a
 * lost race; `executeClassMove` writes everything or nothing; the erase removes the learner's rows.
 */
const T = '2026-10-14T00:00:00.000Z';
const LATER = '2026-10-14T01:00:00.000Z';
const NOW = new Date(LATER);
const DAY = 24 * 60 * 60 * 1000;
const SRC = 'space:src';
const DST = 'space:dst';
const SUNI = 'profile:suni';

const space = (id: string, over: Partial<Space> = {}): Space => ({ id, kind: 'class', name: id, parentSpaceId: null, ownerAccountId: 'teacher', joinCode: null, joinCodeExpiresAt: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: T, ...over });
const move = (over: Partial<StoredClassMove> = {}): StoredClassMove => ({
  id: 'move:0001',
  learnerId: SUNI,
  sourceSpaceId: SRC,
  destSpaceId: DST,
  kind: 'accept',
  status: 'requested',
  actorAccountId: 'teacher',
  actorVia: 'owner',
  decidedAccountId: null,
  decidedVia: null,
  endReason: null,
  createdAt: T,
  updatedAt: T,
  expiresAt: new Date(Date.parse(T) + 14 * DAY).toISOString(),
  executedAt: null,
  endedAt: null,
  familySeenAt: null,
  ...over,
});
const execute = (db: Db, over: Partial<Parameters<Db['executeClassMove']>[0]> = {}) =>
  db.executeClassMove({ id: 'move:0001', learnerId: SUNI, sourceSpaceId: SRC, destSpaceId: DST, decider: { accountId: 'teacher-b', via: 'teacher' }, destCap: 20, learnerCap: 3, now: NOW, ...over });

async function world(db: Db): Promise<void> {
  await db.putAccount({ id: 'teacher', email: null, displayName: null, consent: null, createdAt: T });
  await db.putSpace(space(SRC));
  await db.putSpace(space(DST));
  for (const id of [SUNI, 'profile:mina']) await db.putLearner({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T });
  await db.addMembership({ spaceId: SRC, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: T });
}

function classMoveContract(name: string, make: () => Db): void {
  describe(`class move Db contract · ${name}`, () => {
    let db: Db;
    beforeEach(async () => {
      db = make();
      await db.reset();
      await world(db);
    });

    it('acknowledgements upsert by learner and read set-based', async () => {
      expect(await db.getClassScopeAck(SUNI)).toBeNull();
      await db.putClassScopeAck({ learnerId: SUNI, textVersion: 'class-scope-2026-10', basis: 'device', evidence: 'device-1', ackedAt: T });
      await db.putClassScopeAck({ learnerId: SUNI, textVersion: 'class-scope-2026-10', basis: 'caregiver', evidence: 'mom', ackedAt: LATER });
      expect(await db.getClassScopeAck(SUNI)).toEqual({ learnerId: SUNI, textVersion: 'class-scope-2026-10', basis: 'caregiver', evidence: 'mom', ackedAt: LATER });
      expect(await db.classScopeAcksOf([SUNI, 'profile:mina', SUNI])).toHaveLength(1);
      expect(await db.classScopeAcksOf([])).toEqual([]);
    });

    it('creates one open move per learner and refuses a row that is not fresh', async () => {
      expect(await db.createClassMove(move())).toBe('created');
      expect(await db.createClassMove(move({ id: 'move:0002', destSpaceId: 'space:other' }))).toBe('already_open');
      expect(await db.getClassMove('move:0001')).toEqual(move());
      expect(await db.openClassMoveOf(SUNI)).toMatchObject({ id: 'move:0001' });
      await expect(db.createClassMove(move({ id: 'move:0003', status: 'executed' }))).rejects.toThrow();
      await expect(db.createClassMove(move({ id: 'move:0004', createdAt: '2026-10-14T00:00:00Z' }))).rejects.toThrow();
      await expect(db.createClassMove(move({ id: 'Mina' }))).rejects.toThrow();
    });

    it('lists by role newest first', async () => {
      await db.createClassMove(move());
      expect((await db.classMovesOfSpace(SRC, 'source', 10)).map((m) => m.id)).toEqual(['move:0001']);
      expect((await db.classMovesOfSpace(DST, 'destination', 10)).map((m) => m.id)).toEqual(['move:0001']);
      expect(await db.classMovesOfSpace(DST, 'source', 10)).toEqual([]);
    });

    it('ends from requested only; expiry needs the window to be over', async () => {
      await db.createClassMove(move());
      expect(await db.endClassMove('move:0001', 'expired', 'expired', null, NOW)).toBe(0);
      expect(await db.endClassMove('move:0001', 'declined', 'not_now', { accountId: 'teacher-b', via: 'teacher' }, NOW)).toBe(1);
      expect(await db.getClassMove('move:0001')).toMatchObject({ status: 'declined', endReason: 'not_now', endedAt: LATER, decidedAccountId: 'teacher-b', decidedVia: 'teacher' });
      expect(await db.endClassMove('move:0001', 'cancelled', 'cancelled', null, NOW)).toBe(0);
      expect(await db.openClassMoveOf(SUNI)).toBeNull();
      await db.createClassMove(move({ id: 'move:0002' }));
      expect(await db.endClassMove('move:0002', 'expired', 'expired', null, new Date(Date.parse(T) + 15 * DAY))).toBe(1);
    });

    it('executes once: the learner swaps classes, the decider is recorded, a second call changes nothing', async () => {
      await db.createClassMove(move());
      expect(await execute(db)).toEqual({ executed: true, devicesRevoked: 0, relinksClosed: 0 });
      expect(await db.membership(DST, 'learner', SUNI)).toMatchObject({ role: 'student', joinedAt: LATER });
      expect(await db.membership(SRC, 'learner', SUNI)).toBeNull();
      expect(await db.getClassMove('move:0001')).toMatchObject({ status: 'executed', executedAt: LATER, decidedAccountId: 'teacher-b', decidedVia: 'teacher' });
      expect(await execute(db)).toEqual({ executed: false, devicesRevoked: 0, relinksClosed: 0 });
      expect(await db.executedClassMovesOf([SUNI], new Date(T))).toHaveLength(1);
      expect(await db.executedClassMovesOf([SUNI], new Date(Date.parse(T) + DAY))).toEqual([]);
    });

    it('a full destination, a learner at the class cap, an archived destination or an ended row move nobody', async () => {
      await db.createClassMove(move());
      await db.addMembership({ spaceId: DST, memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: T });
      expect((await execute(db, { destCap: 1 })).executed).toBe(false);
      expect((await execute(db, { learnerCap: 0 })).executed).toBe(false);
      await db.putSpace(space(DST, { archivedAt: T }));
      expect((await execute(db)).executed).toBe(false);
      await db.putSpace(space(DST));
      await db.endClassMove('move:0001', 'cancelled', 'cancelled', null, NOW);
      expect((await execute(db)).executed).toBe(false);
      expect(await db.membership(SRC, 'learner', SUNI)).not.toBeNull();
      expect(await db.membership(DST, 'learner', SUNI)).toBeNull();
    });

    it('a learner already in the destination only leaves the source, even when it is full', async () => {
      await db.createClassMove(move());
      await db.addMembership({ spaceId: DST, memberKind: 'learner', memberId: SUNI, role: 'student', joinedAt: T });
      expect((await execute(db, { destCap: 0 })).executed).toBe(true);
      expect(await db.membership(DST, 'learner', SUNI)).toMatchObject({ joinedAt: T });
      expect(await db.membership(SRC, 'learner', SUNI)).toBeNull();
    });

    it("closes the source's pending re-links and revokes the class devices it minted", async () => {
      await db.createClassMove(move());
      await db.putDevice({ learnerId: SUNI, deviceId: 'device-tab', secretHash: 'h', scope: 'class', createdAt: T, lastSeenAt: T });
      await db.putRelink({ id: 'relink:1', spaceId: SRC, learnerId: SUNI, deviceId: 'device-tab', platform: null, status: 'approved', requestedAt: T, decidedAt: T, expiresAt: T, secret: null });
      await db.putRelink({ id: 'relink:2', spaceId: SRC, learnerId: SUNI, deviceId: 'device-new', platform: null, status: 'pending', requestedAt: T, decidedAt: null, expiresAt: LATER, secret: null });
      expect(await execute(db)).toEqual({ executed: true, devicesRevoked: 1, relinksClosed: 1 });
      expect(await db.getDevice(SUNI, 'device-tab')).toBeNull();
    });

    it('marks the family notice seen once', async () => {
      await db.createClassMove(move());
      expect(await db.markClassMoveSeen('move:0001', NOW)).toBe(0);
      await execute(db);
      expect(await db.markClassMoveSeen('move:0001', NOW)).toBe(1);
      expect(await db.markClassMoveSeen('move:0001', NOW)).toBe(0);
      expect((await db.getClassMove('move:0001'))?.familySeenAt).toBe(LATER);
    });

    it('purges old ended and executed rows, bounded', async () => {
      await db.createClassMove(move());
      await db.endClassMove('move:0001', 'cancelled', 'cancelled', null, NOW);
      await db.createClassMove(move({ id: 'move:0002' }));
      await execute(db, { id: 'move:0002' });
      expect(await db.purgeClassMoves(new Date(T), new Date(T), 10)).toBe(0);
      expect(await db.purgeClassMoves(new Date(Date.parse(LATER) + 1), new Date(Date.parse(LATER) + 1), 1)).toBe(1);
      expect(await db.purgeClassMoves(new Date(Date.parse(LATER) + 1), new Date(Date.parse(LATER) + 1), 10)).toBe(1);
      expect(await db.getClassMove('move:0001')).toBeNull();
    });

    it('purges an ask that expired without anyone settling it, 90 days after its expiry', async () => {
      await db.createClassMove(move());
      const expiry = Date.parse(move().expiresAt);
      expect(await db.purgeClassMoves(new Date(expiry), new Date(expiry), 10)).toBe(0);
      expect(await db.purgeClassMoves(new Date(expiry + 1), new Date(expiry + 1), 10)).toBe(1);
      expect(await db.getClassMove('move:0001')).toBeNull();
    });

    it('deleteLearner erases the acknowledgement and the moves', async () => {
      await db.createClassMove(move());
      await db.putClassScopeAck({ learnerId: SUNI, textVersion: 'class-scope-2026-10', basis: 'caregiver', evidence: 'mom', ackedAt: T });
      expect(await db.deleteLearner(SUNI)).toBe(true);
      expect(await db.getClassMove('move:0001')).toBeNull();
      expect(await db.getClassScopeAck(SUNI)).toBeNull();
    });
  });
}

classMoveContract('memory', () => new MemoryDb());
const sqlite = openSqliteD1();
classMoveContract('sqlite (real migrations)', () => new D1Db(sqlite));

// ---------------------------------------------------------------------------

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0009_class_scope_moves.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const count = async (d1: D1Like, table: string): Promise<number> => Number((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n);

describe('migration 0009_class_scope_moves.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0009_'))).toEqual([FILE]);
  });

  it('only creates two tables and their indexes (additive: nothing altered, dropped or rewritten)', () => {
    expect(statements.filter((s) => s.startsWith('CREATE TABLE IF NOT EXISTS ')).map((s) => s.split(' ')[5])).toEqual(['class_scope_acks', 'class_moves']);
    for (const s of statements) expect(s, s).toMatch(/^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /);
  });

  it('the erase and the reset keep working on a database without it', async () => {
    const d1 = openSqliteD1();
    for (const table of ['class_moves', 'class_scope_acks']) await d1.prepare(`DROP TABLE ${table}`).run();
    const db = new D1Db(d1);
    await world(db);
    expect(await db.deleteLearner(SUNI)).toBe(true);
    expect(await count(d1, 'learners')).toBe(1);
    await db.reset();
    expect(await count(d1, 'learners')).toBe(0);
    d1.close();
  });

  it('the database refuses a move into the class it leaves and an ended row without its reason', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await world(db);
    const insert = (id: string, dest: string, status: string, reason: string | null, ended: string | null) =>
      d1
        .prepare('INSERT INTO class_moves (id, learner_id, source_space_id, dest_space_id, kind, status, actor_account_id, actor_via, end_reason, created_at, updated_at, expires_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, SUNI, SRC, dest, 'direct', status, 'teacher', 'owner', reason, T, T, T, ended)
        .run();
    await expect(insert('move:x1', SRC, 'requested', null, null)).rejects.toThrow();
    await expect(insert('move:x2', DST, 'declined', null, null)).rejects.toThrow();
    await insert('move:x3', DST, 'requested', null, null);
    await expect(insert('move:x4', DST, 'requested', null, null)).rejects.toThrow();
    d1.close();
  });
});
