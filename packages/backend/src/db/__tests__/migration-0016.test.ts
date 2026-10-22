import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like, type D1PreparedLike, type D1RunResultLike } from '../d1';
import { MemoryDb } from '../memory';
import type { Learner } from '../../store';
import type { Db } from '../types';

/**
 * Migration 0016_memory_shards.sql (F-CURR-002 section 4.8, row CM-11). A merge applies it to production
 * before the Worker code (server first), so it must be additive: one new table and its index, nothing
 * existing altered, rewritten or dropped. The table holds learning state keyed by the opaque learner id.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0016_memory_shards.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-22T12:00:00.000Z';
const learner = (id: string): Learner => ({ id, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: T, lastActiveAt: T, profileUpdatedAt: null });
const states = (n: number) => JSON.stringify({ 'lex:sagwa': { b: n, d: '2026-10-25', c: 2, r: 3, n: 1, f: '2026-10-01', s: n, at: T } });

/** Counts the rows each batch statement reports written, as D1 bills them. */
function countingD1(d1: D1Like): D1Like & { rowsWritten: () => number } {
  let rows = 0;
  return {
    prepare: (sql: string): D1PreparedLike => d1.prepare(sql),
    async batch(stmts: D1PreparedLike[]): Promise<D1RunResultLike[]> {
      const results = await d1.batch(stmts);
      for (const r of results) rows += r.meta?.changes ?? 0;
      return results;
    },
    rowsWritten: () => rows,
  };
}

describe('migration 0016_memory_shards.sql · production safety', () => {
  it('is the only migration with its number (scripts/check-migrations.mjs guards the numbering)', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql'));
    expect(files.filter((f) => f.startsWith('0016_'))).toEqual([FILE]);
  });

  it('is one CREATE TABLE and one CREATE INDEX: no ALTER, DROP, UPDATE, DELETE or INSERT', () => {
    expect(statements).toEqual([
      'CREATE TABLE IF NOT EXISTS memory_shards ( learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE, shard TEXT NOT NULL, seq INTEGER NOT NULL, states TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (learner_id, shard) )',
      'CREATE INDEX IF NOT EXISTS memory_shards_seq ON memory_shards (learner_id, seq)',
    ]);
    expect(statements.join(' ')).not.toMatch(/\bALTER\b|\bDROP\b|\bUPDATE\b|\bDELETE FROM\b|\bINSERT\b|\bREPLACE\b/i);
    // No column for a name, an email, a device or an account.
    expect(statements[0]).not.toMatch(/name|email|device|account/i);
  });

  it('has the five columns of section 4.8 and the seq index', async () => {
    const d1 = openSqliteD1();
    const columns = (await d1.prepare("SELECT name, type, \"notnull\" AS nn, pk FROM pragma_table_info('memory_shards') ORDER BY cid").all()).results;
    expect(columns).toEqual([
      { name: 'learner_id', type: 'TEXT', nn: 1, pk: 1 },
      { name: 'shard', type: 'TEXT', nn: 1, pk: 2 },
      { name: 'seq', type: 'INTEGER', nn: 1, pk: 0 },
      { name: 'states', type: 'TEXT', nn: 1, pk: 0 },
      { name: 'updated_at', type: 'TEXT', nn: 1, pk: 0 },
    ]);
    const index = (await d1.prepare("SELECT name FROM pragma_index_info('memory_shards_seq') ORDER BY seqno").all()).results;
    expect(index).toEqual([{ name: 'learner_id' }, { name: 'seq' }]);
    d1.close();
  });

  it('applies on the database at the previous migration; existing rows read back unchanged; applying twice is harmless', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const before = new D1Db(d1);
    await before.putLearner(learner('profile:suni'));
    await expect(d1.prepare('SELECT * FROM memory_shards').all()).rejects.toThrow(/memory_shards/);
    for (let round = 0; round < 2; round += 1) for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getLearner('profile:suni')).toEqual(learner('profile:suni'));
    expect(await after.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(3), baseSeq: null }], T)).toEqual({ written: ['stage2'], conflicts: [] });
    expect(await after.memoryShardsSince('profile:suni', 0)).toEqual([{ shard: 'stage2', seq: 1, states: states(3), updatedAt: T }]);
    d1.close();
  });

  it('a Worker that runs before the migration fails every memory read and write (the routes answer 503)', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const db = new D1Db(d1);
    await expect(db.memoryShardsSince('profile:suni', 0)).rejects.toThrow(/memory_shards/);
    await expect(db.memoryShardsOf('profile:suni', ['stage2'])).rejects.toThrow(/memory_shards/);
    await expect(db.memoryHighestSeq('profile:suni')).rejects.toThrow(/memory_shards/);
    await expect(db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(1), baseSeq: null }], T)).rejects.toThrow(/memory_shards/);
    await expect(db.memoryShardsOf('profile:suni', [])).resolves.toEqual([]);
    await expect(db.writeMemoryShards('profile:suni', [], T)).resolves.toEqual({ written: [], conflicts: [] });
    // A learner erase on that Worker still works: the table is skipped until it exists.
    await db.putLearner(learner('profile:suni'));
    expect(await db.deleteLearner('profile:suni')).toBe(true);
    d1.close();
  });
});

/** The same contract on D1 (through the SQLite shim) and on the in-memory Db. */
for (const [name, open] of [
  ['D1', () => { const d1 = countingD1(openSqliteD1()); return { db: new D1Db(d1) as Db, rowsWritten: d1.rowsWritten }; }],
  ['memory', () => ({ db: new MemoryDb() as Db, rowsWritten: () => Number.NaN })],
] as const) {
  describe(`memory shards on the ${name} Db`, () => {
    it('every write gets the learner\'s highest seq + 1, per learner, and reads come back in seq order', async () => {
      const { db } = open();
      for (const id of ['profile:suni', 'profile:jun']) await db.putLearner(learner(id));
      await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(1), baseSeq: null }, { shard: 'week', states: states(1), baseSeq: null }], T);
      await db.writeMemoryShards('profile:jun', [{ shard: 'stage2', states: states(1), baseSeq: null }], T);
      await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(2), baseSeq: 1 }], T);
      expect((await db.memoryShardsSince('profile:suni', 0)).map((r) => [r.shard, r.seq])).toEqual([
        ['week', 2],
        ['stage2', 3],
      ]);
      expect((await db.memoryShardsSince('profile:suni', 2)).map((r) => r.shard)).toEqual(['stage2']);
      expect(await db.memoryHighestSeq('profile:suni')).toBe(3);
      expect(await db.memoryHighestSeq('profile:jun')).toBe(1);
      expect(await db.memoryHighestSeq('profile:nobody')).toBe(0);
      expect((await db.memoryShardsOf('profile:suni', ['week', 'stage2', 'stage5'])).map((r) => r.shard)).toEqual(['stage2', 'week']);
    });

    it('a write applies only at the seq the merge read: a stale update or a second insert is a conflict and writes nothing', async () => {
      const { db } = open();
      await db.putLearner(learner('profile:suni'));
      await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(1), baseSeq: null }], T);
      const result = await db.writeMemoryShards(
        'profile:suni',
        [
          { shard: 'stage2', states: states(5), baseSeq: null },
          { shard: 'stage3', states: states(5), baseSeq: 7 },
          { shard: 'week', states: states(5), baseSeq: null },
        ],
        T,
      );
      expect(result).toEqual({ written: ['week'], conflicts: ['stage2', 'stage3'] });
      expect((await db.memoryShardsOf('profile:suni', ['stage2']))[0]?.states).toBe(states(1));
      expect(await db.memoryShardsOf('profile:suni', ['stage3'])).toEqual([]);
    });

    it('a learner erase removes the learner\'s shards and no one else\'s', async () => {
      const { db } = open();
      for (const id of ['profile:suni', 'profile:jun']) await db.putLearner(learner(id));
      for (const id of ['profile:suni', 'profile:jun']) await db.writeMemoryShards(id, [{ shard: 'stage2', states: states(1), baseSeq: null }], T);
      await db.deleteLearner('profile:suni');
      expect(await db.memoryShardsSince('profile:suni', 0)).toEqual([]);
      expect(await db.memoryShardsSince('profile:jun', 0)).toHaveLength(1);
      await db.reset();
      expect(await db.memoryShardsSince('profile:jun', 0)).toEqual([]);
    });

    if (name === 'D1') {
      it('rows written: one per written shard, none for a conflict', async () => {
        const { db, rowsWritten } = open();
        await db.putLearner(learner('profile:suni'));
        await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(1), baseSeq: null }, { shard: 'stage3', states: states(1), baseSeq: null }], T);
        expect(rowsWritten()).toBe(2);
        await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: states(2), baseSeq: 1 }, { shard: 'stage3', states: states(2), baseSeq: 1 }], T);
        expect(rowsWritten()).toBe(3);
      });
    }
  });
}
