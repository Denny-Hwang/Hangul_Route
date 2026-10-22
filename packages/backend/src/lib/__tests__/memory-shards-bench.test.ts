import { MEMORY_PUSH_MAX_SHARDS, MEMORY_PUSH_MAX_STATES, countPushedShards, countPushedStates, parseMemoryPush, withoutSeeded, type MemoryItemState } from '@hangul-route/content-schema/memory';
import { describe, expect, it } from 'vitest';
import type { StoredMemoryShard } from '../../db';
import { planShardWrites } from '../memory-shards';

/*
 * F-CURR-002 section 19, assumption 8 (row CM-11): a 500-item merge fits the Workers free-tier CPU limit
 * (10 ms of CPU per request). The benchmark runs the push's whole CPU path, from the body text to the
 * shard texts it writes: parse, the caps, validation (`parseMemoryPush`, the route's check), the seeded
 * filter, and the merge into stored shards at the end-state size (2,300 items, a learner's whole store,
 * in the three touched shards). A warm merge must use under half the limit, leaving the rest for
 * routing, auth and D1 I/O, and the cold first run (no JIT yet) must fit the limit itself; if either
 * ever does not, the cap (`MEMORY_PUSH_MAX_STATES`) is lowered or the stored shards are made smaller.
 *
 * Calibrated to the machine (section 4.8 decision record): CI runs this on a shared runner under v8
 * coverage, where every CPU path is several times slower than on a Worker. So each round also runs a
 * fixed reference workload, unrelated to the memory code (native JSON and a plain-JS loop, the two kinds
 * of work the merge does), and the times are divided by how much slower than the development machine
 * that reference ran (never by less than 1, so a fast machine is held to the raw numbers). The split is
 * printed too: the stored shards' own parse and serialize, which no cap changes, and the rest.
 */

const FREE_TIER_CPU_MS = 10;
const BUDGET_MS = FREE_TIER_CPU_MS / 2;
const RUNS = 40;
const NOW = new Date('2026-10-22T12:00:00.000Z');
const WARMUP = 5;
/** The reference workload's best CPU time on the development machine (Apple M4, Node 22), measured 2026-10-22. */
const REFERENCE_DEV_MS = 0.64;

/** The calibration workload: a fixed 2,000-row JSON text parsed, folded into a Map and serialized again. */
const REFERENCE_TEXT = JSON.stringify(
  Array.from({ length: 2000 }, (_, i) => ({ id: `ref-${i}`, a: i % 7, b: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, c: [i % 3, i % 5], t: '2026-01-01T00:00:00.000Z' })),
);
function referenceOnce(): void {
  const rows = JSON.parse(REFERENCE_TEXT) as Array<{ id: string; a: number }>;
  const byId = new Map<string, number>();
  for (const row of rows) byId.set(row.id, (byId.get(row.id) ?? 0) + row.a);
  if (byId.size !== rows.length || JSON.stringify(rows).length !== REFERENCE_TEXT.length) throw new Error('reference workload');
}

const state = (i: number, at: string): MemoryItemState => ({ b: (i % 7) + 1, d: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, c: i % 4, r: i % 8, n: (i % 9) + 1, f: '2026-10-01', s: (i % 7) + 1, at });

/** The stored end-state shards: 2,300 items over three stages. */
const stored: StoredMemoryShard[] = [
  ['stage2', 800],
  ['stage3', 800],
  ['stage4', 700],
].map(([shard, count], k) => ({
  shard: shard as string,
  seq: k + 1,
  states: JSON.stringify(Object.fromEntries(Array.from({ length: count as number }, (_, i) => [`lex:${shard}-w${i}`, state(i, '2026-10-20T10:00:00.000Z')]))),
  updatedAt: '2026-10-20T10:00:00.000Z',
}));

/** 500 changed states: two thirds update stored items (newer at), a third are new items. */
const body = JSON.stringify({
  shards: Object.fromEntries(
    ['stage2', 'stage3', 'stage4'].map((shard, k) => [
      shard,
      Object.fromEntries(
        Array.from({ length: k === 2 ? 166 : 167 }, (_, i) => [i % 3 === 2 ? `lex:${shard}-new${i}` : `lex:${shard}-w${i * 3}`, state(i + 1, '2026-10-22T10:00:00.000Z')]),
      ),
    ]),
  ),
});

function mergeOnce(): void {
  const raw: unknown = JSON.parse(body);
  if (countPushedStates(raw) > MEMORY_PUSH_MAX_STATES || countPushedShards(raw) > MEMORY_PUSH_MAX_SHARDS) throw new Error('over the cap');
  const parsed = parseMemoryPush(raw);
  if (!parsed.success) throw new Error('invalid body');
  const writes = planShardWrites(stored, withoutSeeded(parsed.data.shards), NOW);
  if (writes.length !== 3) throw new Error('expected three writes');
}

/** The stored shards' own parse and serialize: the part of the merge that scales with the store, not with the call. */
function storedRoundTrip(): void {
  for (const row of stored) JSON.stringify(JSON.parse(row.states));
}

/** CPU milliseconds per call of `work` over `runs` calls: the process's CPU time, as the Workers limit counts CPU and not wall time. */
function cpuMsPer(work: () => void, runs: number): number {
  const start = process.cpuUsage();
  for (let i = 0; i < runs; i += 1) work();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000 / runs;
}

/** The best of five interleaved rounds of each workload: another process on a busy machine only ever adds time. */
function bestOf(works: ReadonlyArray<() => void>): number[] {
  const best = works.map(() => Number.POSITIVE_INFINITY);
  for (let round = 0; round < 5; round += 1) {
    works.forEach((work, k) => {
      best[k] = Math.min(best[k] as number, cpuMsPer(work, RUNS / 5));
    });
  }
  return best;
}

describe('memory push CPU benchmark (assumption 8)', () => {
  it(`a ${MEMORY_PUSH_MAX_STATES}-item merge into end-state shards uses under ${BUDGET_MS} ms of CPU warm and ${FREE_TIER_CPU_MS} ms cold`, () => {
    expect(countPushedStates(JSON.parse(body))).toBe(MEMORY_PUSH_MAX_STATES);
    expect(body.length).toBeLessThan(64 * 1024);
    const cold = cpuMsPer(mergeOnce, 1);
    for (let i = 0; i < WARMUP; i += 1) {
      mergeOnce();
      referenceOnce();
      storedRoundTrip();
    }
    const [merge, reference, floor] = bestOf([mergeOnce, referenceOnce, storedRoundTrip]) as [number, number, number];
    const slower = Math.max(1, reference / REFERENCE_DEV_MS);
    // Recorded in the PR body and the section 4.8 decision record: the numbers of the machine that ran the suite.
    process.stdout.write(
      `memory push benchmark: cold ${cold.toFixed(2)} ms, warm ${merge.toFixed(2)} ms CPU a merge, of which ${floor.toFixed(2)} ms is the stored shards' parse and serialize; ` +
        `reference ${reference.toFixed(2)} ms (${slower.toFixed(2)}x the development machine), so ${(cold / slower).toFixed(2)} ms cold and ${(merge / slower).toFixed(2)} ms warm at its speed (${body.length} B body)\n`,
    );
    expect(merge / slower).toBeLessThan(BUDGET_MS);
    expect(cold / slower).toBeLessThan(FREE_TIER_CPU_MS);
  });
});
