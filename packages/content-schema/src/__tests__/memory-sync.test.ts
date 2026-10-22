import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MEMORY_PUSH_MAX_BYTES,
  MEMORY_PUSH_MAX_SHARDS,
  MEMORY_PUSH_MAX_STATES,
  MemoryCursorSchema,
  MemoryItemStateSchema,
  MemoryPullSchema,
  MemoryPushResultSchema,
  MemoryPushSchema,
  MemoryShardKeySchema,
  compareSchedule,
  countPushedShards,
  countPushedStates,
  isSeededState,
  mergeMemory,
  mergeMemoryItemState,
  mergeMemoryShard,
  parseMemoryPush,
  pulledMemory,
  withoutSeeded,
  type MemoryItemState,
} from '../memory/memory-sync';
import { BackupFileSchema, MemoryItemStateSchema as BarrelItemState } from '../index';

/*
 * F-CURR-002 section 4.8 (row CM-11): the shared item-state merge that the Worker's shard merge and
 * the app's memory store both run. Section 14 "Merge": commutative and idempotent for the memory
 * item fields with the tie-break, and a produce miss on device A merged with an older state on B.
 */

const RUNS = { numRuns: 400 };
const RECOGNIZE = 1;
const READ = 2;
const PRODUCE = 4;

const state = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({
  b: 3,
  d: '2026-10-25',
  c: 2,
  r: RECOGNIZE | READ,
  n: 4,
  f: '2026-10-01',
  s: 3,
  at: '2026-10-22T10:00:00.000Z',
  ...over,
});

const day = fc.integer({ min: 1, max: 9 }).map((d) => `2026-10-0${d}`);
/** Few distinct instants (two spellings of one of them), so equal clocks and the tie-break come up often. */
const at = fc.constantFrom('2026-10-22T10:00:00.000Z', '2026-10-22T10:00:00Z', '2026-10-22T10:00:01.000Z', '2026-10-21T23:59:59.999Z', '2026-10-22T19:00:00.000+09:00');
const itemState: fc.Arbitrary<MemoryItemState> = fc.record({
  b: fc.integer({ min: 0, max: 7 }),
  d: fc.option(day, { nil: null }),
  c: fc.integer({ min: 0, max: 3 }),
  r: fc.integer({ min: 0, max: 7 }),
  n: fc.integer({ min: 0, max: 5 }),
  f: day,
  s: fc.integer({ min: 0, max: 7 }),
  at,
});
const ids = fc.constantFrom('lex:sagwa', 'lex:bae~pear', 'sym:bieup', 'pat:n-juseyo');
const shardStates = fc.dictionary(ids, itemState, { maxKeys: 4 });

describe('mergeMemoryItemState · the section 4.8 table', () => {
  it('b, d and c follow the later at, together, whichever side is newer', () => {
    const older = state({ b: 5, d: '2026-11-01', c: 3, at: '2026-10-20T10:00:00.000Z' });
    const newer = state({ b: 2, d: '2026-10-23', c: 1, at: '2026-10-22T10:00:00.000Z' });
    for (const merged of [mergeMemoryItemState(older, newer), mergeMemoryItemState(newer, older)]) {
      expect(merged).toMatchObject({ b: 2, d: '2026-10-23', c: 1, at: '2026-10-22T10:00:00.000Z' });
    }
  });

  it('compares instants, not text: an offset form that is later wins over a Z form that sorts after it', () => {
    const z = state({ b: 1, at: '2026-10-22T09:00:00.000Z' });
    const offset = state({ b: 6, at: '2026-10-22T19:00:00.000+09:00' }); // 10:00 Z
    expect(mergeMemoryItemState(z, offset).b).toBe(6);
    expect(mergeMemoryItemState(offset, z).b).toBe(6);
  });

  it('equal at: the higher box, then the later due day, then the higher rung', () => {
    const t = '2026-10-22T10:00:00.000Z';
    expect(mergeMemoryItemState(state({ b: 2, d: '2026-12-01', c: 3, at: t }), state({ b: 4, d: '2026-10-23', c: 0, at: t }))).toMatchObject({ b: 4, d: '2026-10-23', c: 0 });
    expect(mergeMemoryItemState(state({ b: 4, d: '2026-10-23', c: 3, at: t }), state({ b: 4, d: '2026-10-30', c: 0, at: t }))).toMatchObject({ b: 4, d: '2026-10-30', c: 0 });
    expect(mergeMemoryItemState(state({ b: 4, d: '2026-10-30', c: 1, at: t }), state({ b: 4, d: '2026-10-30', c: 2, at: t }))).toMatchObject({ c: 2 });
  });

  it('equal at: a due day beats none (box 0, not met)', () => {
    const t = '2026-10-22T10:00:00.000Z';
    expect(mergeMemoryItemState(state({ b: 0, d: null, at: t }), state({ b: 0, d: '2026-10-23', at: t })).d).toBe('2026-10-23');
    expect(mergeMemoryItemState(state({ b: 0, d: '2026-10-23', at: t }), state({ b: 0, d: null, at: t })).d).toBe('2026-10-23');
  });

  it('the same instant spelled two ways is a tie, settled by the box and last by the text', () => {
    const a = state({ b: 2, at: '2026-10-22T10:00:00Z' });
    const b = state({ b: 2, at: '2026-10-22T10:00:00.000Z' });
    expect(mergeMemoryItemState(a, b).at).toBe(mergeMemoryItemState(b, a).at);
    expect(mergeMemoryItemState(state({ b: 5, at: '2026-10-22T10:00:00Z' }), b).b).toBe(5);
  });

  it('r is OR, n and s are the larger, f is the earlier, whichever schedule wins', () => {
    const a = state({ r: RECOGNIZE | PRODUCE, n: 9, s: 2, f: '2026-10-05', at: '2026-10-22T10:00:00.000Z' });
    const b = state({ r: READ, n: 3, s: 6, f: '2026-10-02', at: '2026-10-21T10:00:00.000Z' });
    expect(mergeMemoryItemState(a, b)).toEqual({ ...a, r: RECOGNIZE | READ | PRODUCE, n: 9, s: 6, f: '2026-10-02' });
  });

  it('a produce miss on device A (c falls, r keeps the produce bit) merged with an older state on device B', () => {
    // Both devices had passed produce once; B last saw it at box 4, asking produce next.
    const deviceB = state({ b: 4, d: '2026-10-22', c: 3, r: RECOGNIZE | READ | PRODUCE, n: 6, s: 4, at: '2026-10-15T10:00:00.000Z' });
    // A: a wrong first try at the produce rung: box down one, due tomorrow, c back to read; the pass stays recorded.
    const deviceA = state({ b: 3, d: '2026-10-23', c: 2, r: RECOGNIZE | READ | PRODUCE, n: 7, s: 4, at: '2026-10-22T10:00:00.000Z' });
    for (const merged of [mergeMemoryItemState(deviceA, deviceB), mergeMemoryItemState(deviceB, deviceA)]) {
      expect(merged).toEqual({ b: 3, d: '2026-10-23', c: 2, r: RECOGNIZE | READ | PRODUCE, n: 7, s: 4, f: '2026-10-01', at: '2026-10-22T10:00:00.000Z' });
    }
    // An older B that never passed produce cannot clear A's produce bit, and A's newer miss still wins the schedule.
    const neverProduced = { ...deviceB, r: RECOGNIZE | READ, c: 2 };
    expect(mergeMemoryItemState(neverProduced, deviceA)).toMatchObject({ c: 2, b: 3, r: RECOGNIZE | READ | PRODUCE });
  });

  it('is commutative, idempotent and associative (property)', () => {
    fc.assert(
      fc.property(itemState, itemState, itemState, (a, b, c) => {
        expect(mergeMemoryItemState(a, b)).toEqual(mergeMemoryItemState(b, a));
        expect(mergeMemoryItemState(a, a)).toEqual(a);
        const ab = mergeMemoryItemState(a, b);
        expect(mergeMemoryItemState(ab, b)).toEqual(ab);
        expect(mergeMemoryItemState(mergeMemoryItemState(a, b), c)).toEqual(mergeMemoryItemState(a, mergeMemoryItemState(b, c)));
      }),
      RUNS,
    );
  });

  it('learner-visible fields only grow: r, n and s never drop and f never moves later (property)', () => {
    fc.assert(
      fc.property(itemState, itemState, (a, b) => {
        const m = mergeMemoryItemState(a, b);
        expect(m.r & a.r).toBe(a.r);
        expect(m.n).toBeGreaterThanOrEqual(a.n);
        expect(m.s).toBeGreaterThanOrEqual(a.s);
        expect(m.f <= a.f).toBe(true);
      }),
      RUNS,
    );
  });

  it('compareSchedule is a total order: antisymmetric, 0 only for the same schedule (property)', () => {
    fc.assert(
      fc.property(itemState, itemState, (a, b) => {
        expect(Math.sign(compareSchedule(a, b)) + Math.sign(compareSchedule(b, a))).toBe(0);
        if (compareSchedule(a, b) === 0) expect([a.b, a.d, a.c, a.at]).toEqual([b.b, b.d, b.c, b.at]);
      }),
      RUNS,
    );
  });

  it('a clock that does not parse orders first (the schema admits none)', () => {
    const bad = { ...state({ b: 7 }), at: 'not a time' };
    expect(mergeMemoryItemState(bad, state({ b: 1 })).b).toBe(1);
    expect(mergeMemoryItemState(state({ b: 1 }), bad).b).toBe(1);
  });
});

describe('mergeMemoryShard and mergeMemory', () => {
  it('unions the items, merges the shared ones and writes keys in code-point order', () => {
    const merged = mergeMemoryShard({ 'lex:sagwa': state({ n: 2 }), 'sym:bieup': state() }, { 'lex:bae~pear': state(), 'lex:sagwa': state({ n: 5 }) });
    expect(Object.keys(merged)).toEqual(['lex:bae~pear', 'lex:sagwa', 'sym:bieup']);
    expect(merged['lex:sagwa']?.n).toBe(5);
  });

  it('is commutative, idempotent and associative, down to the serialized text (property)', () => {
    fc.assert(
      fc.property(shardStates, shardStates, shardStates, (a, b, c) => {
        expect(JSON.stringify(mergeMemoryShard(a, b))).toBe(JSON.stringify(mergeMemoryShard(b, a)));
        const ab = mergeMemoryShard(a, b);
        expect(mergeMemoryShard(ab, ab)).toEqual(ab);
        expect(mergeMemoryShard(ab, b)).toEqual(ab);
        expect(mergeMemoryShard(mergeMemoryShard(a, b), c)).toEqual(mergeMemoryShard(a, mergeMemoryShard(b, c)));
      }),
      RUNS,
    );
  });

  it('mergeMemory merges shard by shard; an absent side gives the other', () => {
    const a = { stage2: { 'lex:sagwa': state({ n: 1 }) }, week: { 'lex:chuseok': state() } };
    const b = { stage2: { 'lex:sagwa': state({ n: 3 }) }, 'pack:numbers-time': { 'rea:price-won': state() } };
    const merged = mergeMemory(a, b);
    expect(Object.keys(merged ?? {})).toEqual(['pack:numbers-time', 'stage2', 'week']);
    expect(merged?.stage2?.['lex:sagwa']?.n).toBe(3);
    expect(mergeMemory(a, undefined)).toBe(a);
    expect(mergeMemory(undefined, b)).toBe(b);
    expect(mergeMemory(undefined, undefined)).toBeUndefined();
  });
});

describe('seeded states', () => {
  it('n = 0 is seeded and never syncs; a shard left empty drops', () => {
    expect(isSeededState(state({ n: 0 }))).toBe(true);
    expect(isSeededState(state({ n: 1 }))).toBe(false);
    expect(withoutSeeded({ stage1: { 'sym:bieup': state({ n: 0 }) }, stage2: { 'lex:sagwa': state({ n: 0 }), 'lex:bae~pear': state({ n: 2 }) } })).toEqual({
      stage2: { 'lex:bae~pear': state({ n: 2 }) },
    });
  });
});

describe('the wire contract', () => {
  it('names the caps of section 4.8', () => {
    expect(MEMORY_PUSH_MAX_STATES).toBe(500);
    expect(MEMORY_PUSH_MAX_BYTES).toBe(65_536);
    // 7 stages, 8 packs and `week` at the end state, with room for new packs.
    expect(MEMORY_PUSH_MAX_SHARDS).toBeGreaterThanOrEqual(16);
    expect(MEMORY_PUSH_MAX_SHARDS).toBe(24);
  });

  it('shard keys: stage1 to stage7, pack:<key> and week only', () => {
    for (const ok of ['stage1', 'stage7', 'pack:numbers-time', 'pack:k', 'week']) expect(MemoryShardKeySchema.safeParse(ok).success).toBe(true);
    for (const bad of ['stage0', 'stage8', 'stage', 'pack:', 'pack:Numbers', 'pack:a--b', 'weeks', 'vocab', '', `pack:${'a'.repeat(64)}`]) {
      expect(MemoryShardKeySchema.safeParse(bad).success).toBe(false);
    }
  });

  it('a push: shard -> review item id -> state, strict, with unknown state fields dropped', () => {
    const parsed = MemoryPushSchema.parse({ shards: { stage2: { 'lex:sagwa': { ...state(), extra: 1 } } } });
    expect(parsed.shards.stage2?.['lex:sagwa']).toEqual(state());
    expect(MemoryPushSchema.safeParse({ shards: { stage2: { 'not an id': state() } } }).success).toBe(false);
    expect(MemoryPushSchema.safeParse({ shards: { stage9: { 'lex:sagwa': state() } } }).success).toBe(false);
    expect(MemoryPushSchema.safeParse({ shards: { stage2: { 'lex:sagwa': state({ b: 8 }) } } }).success).toBe(false);
    expect(MemoryPushSchema.safeParse({ shards: { stage2: { 'lex:sagwa': { ...state(), at: '2026-10-22 10:00' } } } }).success).toBe(false);
    expect(MemoryPushSchema.safeParse({ shards: { stage2: { 'vocab:bae-boat': state() } } }).success).toBe(true);
  });

  it('countPushedStates counts the raw states before validation', () => {
    expect(countPushedStates({ shards: { stage2: { a: 1, b: 2 }, week: { c: 3 }, stage3: [1, 2], stage4: null } })).toBe(3);
    for (const none of [null, 'x', {}, { shards: null }, { shards: [] }, { shards: 'x' }]) {
      expect(countPushedStates(none)).toBe(0);
      expect(countPushedShards(none)).toBe(0);
    }
    expect(countPushedShards({ shards: { stage2: {}, week: 1 } })).toBe(2);
  });

  it('the push result and the cursor', () => {
    expect(MemoryPushResultSchema.parse({ stored: 3, seeded: 1, written: 2 })).toEqual({ stored: 3, seeded: 1, written: 2 });
    expect(MemoryCursorSchema.parse('12')).toBe(12);
    expect(MemoryCursorSchema.parse('0')).toBe(0);
    for (const bad of ['-1', '1.5', 'abc']) expect(MemoryCursorSchema.safeParse(bad).success).toBe(false);
  });

  it('a pull reads leniently: a bad state or shard drops on its own, the cursor stays', () => {
    const pull = MemoryPullSchema.parse({
      cursor: 9,
      shards: [
        { shard: 'stage2', seq: 7, states: { 'lex:sagwa': state(), 'lex:bad': { b: 'x' } } },
        { shard: 'stage9', seq: 8, states: {} },
        { shard: 'week', seq: 9, states: 'unreadable' },
      ],
    });
    expect(pull.cursor).toBe(9);
    expect(pull.shards).toEqual([
      { shard: 'stage2', seq: 7, states: { 'lex:sagwa': state() } },
      { shard: 'week', seq: 9, states: {} },
    ]);
    expect(pulledMemory(pull)).toEqual({ stage2: { 'lex:sagwa': state() }, week: {} });
  });

  it('is the same item state the backup file reads (one definition)', () => {
    expect(MemoryItemStateSchema).toBe(BarrelItemState);
    const file = BackupFileSchema.shape.memory.parse({ stage2: { 'lex:sagwa': state() } });
    expect(file).toEqual({ stage2: { 'lex:sagwa': state() } });
  });
});

describe('parseMemoryPush · the Worker hot path equals MemoryPushSchema', () => {
  const junk = fc.constantFrom<unknown>(null, undefined, '', 'x', -1, 1.5, 8, 4, Number.NaN, Number.POSITIVE_INFINITY, 1e300, true, [], {}, '2026-02-30', '2026-10-22', '2026-10-22T10:00:00Z', '2026-10-22T24:00:00Z', '2026-10-22 10:00', 0);
  const fields = ['b', 'd', 'c', 'r', 'n', 'f', 's', 'at'] as const;
  /** A valid state, with sometimes one field broken, dropped or an extra field added. */
  const rawState: fc.Arbitrary<unknown> = fc.oneof(
    itemState,
    fc.tuple(itemState, fc.constantFrom(...fields), junk).map(([st, key, value]) => ({ ...st, [key]: value })),
    fc.tuple(itemState, fc.constantFrom(...fields)).map(([st, key]) => {
      const { [key]: _dropped, ...rest } = st;
      return rest;
    }),
    itemState.map((st) => ({ ...st, extra: 'kept out' })),
    junk,
  );
  const rawId = fc.constantFrom('lex:sagwa', 'vocab:bae-boat', 'sym:bieup', 'exc:annyeonghaseyo~2', 'LEX:sagwa', 'lex:', 'vocab:Bae', 'word:sagwa', '__proto__', '');
  const rawShard = fc.constantFrom('stage1', 'stage7', 'week', 'pack:numbers-time', 'stage8', 'pack:', 'Week', `pack:${'a'.repeat(60)}`);
  const rawBody: fc.Arbitrary<unknown> = fc.oneof(
    fc.record({ shards: fc.dictionary(rawShard, fc.oneof(fc.dictionary(rawId, rawState, { maxKeys: 3 }), junk), { maxKeys: 3 }) }),
    fc.record({ shards: fc.dictionary(fc.constantFrom('stage2', 'week'), fc.dictionary(fc.constantFrom('lex:sagwa', 'pat:n-juseyo'), itemState, { maxKeys: 2 }), { maxKeys: 2 }), other: junk }),
    junk,
    fc.record({ other: junk }),
  );

  it('agrees with the schema on every body: same verdict, same output (property)', () => {
    fc.assert(
      fc.property(rawBody, (body) => {
        const fast = parseMemoryPush(body);
        const slow = MemoryPushSchema.safeParse(body);
        expect(fast.success).toBe(slow.success);
        if (fast.success && slow.success) expect(JSON.stringify(fast.data)).toBe(JSON.stringify(slow.data));
      }),
      { numRuns: 3000 },
    );
  });

  it('names the path of the first bad entry', () => {
    expect(parseMemoryPush(null)).toEqual({ success: false, issues: [{ path: [], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: [] })).toEqual({ success: false, issues: [{ path: ['shards'], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: { stage9: {} } })).toEqual({ success: false, issues: [{ path: ['shards', 'stage9'], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: { stage2: 1 } })).toEqual({ success: false, issues: [{ path: ['shards', 'stage2'], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: { stage2: { bad: state() } } })).toEqual({ success: false, issues: [{ path: ['shards', 'stage2', 'bad'], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: { stage2: { 'lex:sagwa': 1 } } })).toEqual({ success: false, issues: [{ path: ['shards', 'stage2', 'lex:sagwa'], code: 'invalid' }] });
    expect(parseMemoryPush({ shards: { stage2: { 'lex:sagwa': { ...state(), at: 'x' } } } }).success).toBe(false);
  });

  it('remembers day and instant checks within a call, with the same verdicts', () => {
    const shared = { stage2: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`lex:w${i}`, state()])) };
    expect(parseMemoryPush({ shards: shared })).toEqual({ success: true, data: { shards: shared } });
    const broken = { stage2: { 'lex:a': state(), 'lex:b': { ...state(), f: '2026-02-30' }, 'lex:c': { ...state(), f: '2026-02-30' } } };
    expect(parseMemoryPush({ shards: broken }).success).toBe(false);
    expect(parseMemoryPush({ shards: { stage2: { 'lex:a': state(), 'lex:b': { ...state(), at: '2026-02-30T10:00:00Z' } } } }).success).toBe(false);
  });
});
