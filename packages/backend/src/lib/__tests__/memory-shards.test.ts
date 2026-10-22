import { mergeMemoryShard, type MemoryItemState, type MemoryShardStates } from '@hangul-route/content-schema/memory';
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
    const writes = planShardWrites(stored, { week: { 'lex:chuseok': state() }, stage3: { 'pat:n-juseyo': state() }, stage2: { 'lex:bae~pear': state() } }, NOW);
    expect(writes).toEqual([
      { shard: 'stage2', states: JSON.stringify({ 'lex:bae~pear': state(), 'lex:sagwa': state() }), baseSeq: 4 },
      { shard: 'stage3', states: JSON.stringify({ 'pat:n-juseyo': state() }), baseSeq: null },
    ]);
  });
});

describe('planShardWrites, the in-place merge', () => {
  /** A small seeded generator, so the cases are the same on every run. */
  const rng = (seed: number): (() => number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = (next: () => number, max: number): number => Math.floor(next() * max);
  const randomState = (next: () => number): MemoryItemState => ({
    b: pick(next, 8),
    d: pick(next, 4) === 0 ? null : `2026-10-2${pick(next, 9) + 1}`,
    c: pick(next, 4),
    r: pick(next, 8),
    n: pick(next, 5) + 1,
    f: `2026-10-0${pick(next, 9) + 1}`,
    s: pick(next, 8),
    at: `2026-10-22T0${pick(next, 3)}:00:00.000Z`,
  });
  const randomShard = (next: () => number, size: number): MemoryShardStates =>
    Object.fromEntries(Array.from({ length: size }, () => [`lex:w${pick(next, 12)}`, randomState(next)]));

  it('writes exactly the text of mergeMemoryShard of the two copies, and nothing when that equals the stored text', () => {
    const next = rng(822);
    let unchanged = 0;
    for (let k = 0; k < 400; k += 1) {
      // The Worker wrote the stored text, so it is a merged (key-ordered) shard.
      const storedStates = mergeMemoryShard({}, randomShard(next, pick(next, 8)));
      const sent = randomShard(next, pick(next, 4));
      const rows = Object.keys(storedStates).length > 0 ? [{ shard: 'stage2', seq: 3, states: JSON.stringify(storedStates), updatedAt: T }] : [];
      const expected = JSON.stringify(mergeMemoryShard(storedStates, sent));
      const writes = planShardWrites(rows, { stage2: sent }, NOW);
      if (rows.length > 0 && expected === rows[0]?.states) {
        unchanged += 1;
        expect(writes).toEqual([]);
      } else {
        expect(writes).toEqual([{ shard: 'stage2', states: expected, baseSeq: rows.length > 0 ? 3 : null }]);
      }
    }
    expect(unchanged).toBeGreaterThan(0);
  });

  it('a pushed at a little ahead of the Worker clock is read as now; far ahead it keeps the stored schedule and still merges the grow-only fields', () => {
    const storedItem = state({ b: 4, d: '2026-10-26', c: 1, r: 1, n: 5, s: 4, at: '2026-10-22T11:00:00.000Z' });
    const rows = [{ shard: 'stage2', seq: 2, states: JSON.stringify({ 'lex:sagwa': storedItem }), updatedAt: T }];
    const soon = planShardWrites(rows, { stage2: { 'lex:sagwa': state({ b: 2, at: '2026-10-22T12:05:00.000Z' }) } }, NOW);
    expect(JSON.parse(soon[0]?.states ?? '{}')['lex:sagwa']).toMatchObject({ b: 2, at: T });
    const far = planShardWrites(rows, { stage2: { 'lex:sagwa': state({ b: 7, d: '2030-01-01', c: 3, r: 4, n: 9, s: 7, at: '2030-01-01T00:00:00.000Z' }) } }, NOW);
    expect(JSON.parse(far[0]?.states ?? '{}')['lex:sagwa']).toEqual({ ...storedItem, r: 5, n: 9, s: 7 });
    const fresh = planShardWrites([], { stage3: { 'pat:n-juseyo': state({ at: '2030-01-01T00:00:00.000Z' }) } }, NOW);
    expect(JSON.parse(fresh[0]?.states ?? '{}')['pat:n-juseyo'].at).toBe(T);
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
