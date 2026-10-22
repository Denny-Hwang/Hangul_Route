import type { MemoryItemState } from '@hangul-route/content-schema/memory';
import { describe, expect, it } from 'vitest';
import { MemoryDb, type Db, type MemoryShardWrite } from '../../db';
import { MEMORY_WRITE_ATTEMPTS, MemoryWriteConflict, planShardWrites, pushMemory, readShardStates } from '../memory-shards';

/*
 * F-CURR-002 section 4.8 (row CM-11): the Worker's shard merge. It reads only the touched shards, writes
 * at most one row per touched shard and none for a merge that changes nothing, and merges again a
 * shard another isolate wrote between its read and its write, so no device's states are ever dropped.
 */

const T = '2026-10-22T12:00:00.000Z';
const NOW = new Date(T);
const state = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({ b: 3, d: '2026-10-25', c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-10-22T10:00:00.000Z', ...over });

describe('readShardStates', () => {
  it('reads the stored map and refuses a damaged row instead of reading it as empty', () => {
    expect(readShardStates({ shard: 'stage2', states: JSON.stringify({ 'lex:sagwa': state() }) })).toEqual({ 'lex:sagwa': state() });
    for (const bad of ['[]', 'null', '7', '"x"']) expect(() => readShardStates({ shard: 'stage2', states: bad })).toThrow(/stage2/);
    expect(() => readShardStates({ shard: 'stage2', states: '{' })).toThrow();
  });
});

describe('planShardWrites', () => {
  it('a new shard is an insert; a stored one an update at its seq; an unchanged merge is no write', () => {
    const stored = [
      { shard: 'stage2', seq: 4, states: JSON.stringify({ 'lex:sagwa': state() }), updatedAt: T },
      { shard: 'week', seq: 5, states: JSON.stringify({ 'lex:chuseok': state() }), updatedAt: T },
    ];
    const writes = planShardWrites(stored, { week: { 'lex:chuseok': state() }, stage3: { 'pat:n-juseyo': state() }, stage2: { 'lex:bae~pear': state() } });
    expect(writes).toEqual([
      { shard: 'stage2', states: JSON.stringify({ 'lex:bae~pear': state(), 'lex:sagwa': state() }), baseSeq: 4 },
      { shard: 'stage3', states: JSON.stringify({ 'pat:n-juseyo': state() }), baseSeq: null },
    ]);
  });
});

describe('pushMemory', () => {
  it('drops seeded states and counts them; an all-seeded call reads and writes nothing', async () => {
    const db = new MemoryDb();
    const reads: string[][] = [];
    const spy = Object.assign(Object.create(db) as Db, {
      memoryShardsOf: (learnerId: string, shards: readonly string[]) => {
        reads.push([...shards]);
        return db.memoryShardsOf(learnerId, shards);
      },
    });
    expect(await pushMemory(spy, 'profile:suni', { stage1: { 'sym:bieup': state({ n: 0 }) } }, NOW)).toEqual({ stored: 0, seeded: 1, written: 0 });
    expect(reads).toEqual([]);
    expect(await pushMemory(spy, 'profile:suni', { stage1: { 'sym:bieup': state({ n: 0 }) }, stage2: { 'lex:sagwa': state() } }, NOW)).toEqual({ stored: 1, seeded: 1, written: 1 });
    // Only the touched shard is read.
    expect(reads).toEqual([['stage2']]);
  });

  it('a shard another isolate wrote after the read is read and merged again, keeping both devices\' states', async () => {
    const db = new MemoryDb();
    await db.writeMemoryShards('profile:suni', [{ shard: 'stage2', states: JSON.stringify({ 'lex:sagwa': state() }), baseSeq: null }], T);
    let raced = false;
    const racing = Object.assign(Object.create(db) as Db, {
      writeMemoryShards: async (learnerId: string, writes: readonly MemoryShardWrite[], at: string) => {
        if (!raced) {
          raced = true;
          // Another device's call lands between this call's read and its write.
          await db.writeMemoryShards(learnerId, [{ shard: 'stage2', states: JSON.stringify({ 'lex:other': state(), 'lex:sagwa': state() }), baseSeq: 1 }], at);
        }
        return db.writeMemoryShards(learnerId, writes, at);
      },
    });
    expect(await pushMemory(racing, 'profile:suni', { stage2: { 'lex:mine': state() }, week: { 'lex:chuseok': state() } }, NOW)).toEqual({ stored: 2, seeded: 0, written: 2 });
    const [stage2] = await db.memoryShardsOf('profile:suni', ['stage2']);
    expect(Object.keys(readShardStates(stage2 as { shard: string; states: string }))).toEqual(['lex:mine', 'lex:other', 'lex:sagwa']);
    expect(stage2?.seq).toBe(4);
  });

  it(`gives up with MemoryWriteConflict after ${MEMORY_WRITE_ATTEMPTS} attempts, never writing more rows than touched shards`, async () => {
    const db = new MemoryDb();
    let attempts = 0;
    const busy = Object.assign(Object.create(db) as Db, {
      writeMemoryShards: async (learnerId: string, writes: readonly MemoryShardWrite[], at: string) => {
        attempts += 1;
        const result = await db.writeMemoryShards(learnerId, writes.filter((w) => w.shard !== 'stage2'), at);
        return { written: result.written, conflicts: [...result.conflicts, ...writes.filter((w) => w.shard === 'stage2').map((w) => w.shard)] };
      },
    });
    const failure = await pushMemory(busy, 'profile:suni', { stage2: { 'lex:sagwa': state() }, stage3: { 'pat:n-juseyo': state() } }, NOW).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(MemoryWriteConflict);
    expect((failure as MemoryWriteConflict).shards).toEqual(['stage2']);
    expect(attempts).toBe(MEMORY_WRITE_ATTEMPTS);
    expect((await db.memoryShardsSince('profile:suni', 0)).map((r) => r.shard)).toEqual(['stage3']);
  });
});
