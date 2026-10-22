import { MEMORY_PUSH_MAX_SHARDS, MEMORY_PUSH_MAX_STATES, countPushedShards, countPushedStates, parseMemoryPush, withoutSeeded, type MemoryItemState } from '@hangul-route/content-schema/memory';
import { describe, expect, it } from 'vitest';
import type { StoredMemoryShard } from '../../db';
import { planShardWrites } from '../memory-shards';

/*
 * F-CURR-002 section 19, assumption 8 (row CM-11): a 500-item merge fits the Workers free-tier CPU limit
 * (10 ms of CPU per request). The benchmark runs the push's whole CPU path, from the body text to the
 * shard texts it writes: parse, the caps, validation (`parseMemoryPush`, the route's check), the seeded filter, and the merge into stored
 * shards at the end-state size (about 2,300 items across the touched shards). A warm merge must use
 * under half the limit, leaving the rest for routing, auth and D1 I/O; if it ever does not, the cap
 * (`MEMORY_PUSH_MAX_STATES`) is lowered. The cold first run (no JIT yet) is reported too.
 */

const FREE_TIER_CPU_MS = 10;
const BUDGET_MS = FREE_TIER_CPU_MS / 2;
const RUNS = 40;
const WARMUP = 5;

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
  const writes = planShardWrites(stored, withoutSeeded(parsed.data.shards));
  if (writes.length !== 3) throw new Error('expected three writes');
}

/** CPU milliseconds per merge over `runs` merges: the process's CPU time, as the Workers limit counts CPU and not wall time. */
function cpuMsPerMerge(runs: number): number {
  const start = process.cpuUsage();
  for (let i = 0; i < runs; i += 1) mergeOnce();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000 / runs;
}

describe('memory push CPU benchmark (assumption 8)', () => {
  it(`a ${MEMORY_PUSH_MAX_STATES}-item merge into end-state shards uses under ${BUDGET_MS} ms of CPU`, () => {
    expect(countPushedStates(JSON.parse(body))).toBe(MEMORY_PUSH_MAX_STATES);
    expect(body.length).toBeLessThan(64 * 1024);
    const cold = cpuMsPerMerge(1);
    cpuMsPerMerge(WARMUP);
    // The best of five rounds: another process on a busy machine only ever adds time.
    const rounds = Array.from({ length: 5 }, () => cpuMsPerMerge(RUNS / 5)).sort((a, b) => a - b);
    const best = rounds[0] as number;
    // Recorded in the PR body: the numbers on the machine that ran the suite.
    process.stdout.write(`memory push benchmark: cold ${cold.toFixed(2)} ms, warm ${best.toFixed(2)} ms CPU a merge (rounds ${rounds.map((r) => r.toFixed(2)).join(', ')}; ${body.length} B body)\n`);
    expect(best).toBeLessThan(BUDGET_MS);
  });
});
