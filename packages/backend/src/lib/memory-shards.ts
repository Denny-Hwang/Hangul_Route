import { mergeMemoryShard, withoutSeeded, type MemoryShardStates } from '@hangul-route/content-schema/memory';
import type { Db, MemoryShardWrite, StoredMemoryShard } from '../db';

/**
 * The Worker's memory-store merge (F-CURR-002 section 4.8, row CM-11). A push reads only the shards
 * it touches, merges each item with the shared rule (`mergeMemoryItemState`), and writes the changed
 * shards in one D1 batch. Cost guardrail (section 3.3): a call writes at most one row per shard it
 * touches, and none for a shard whose merge changes nothing.
 */

/** A merge whose shards kept changing under it on every attempt (another device writing the same shards). */
export class MemoryWriteConflict extends Error {
  constructor(readonly shards: readonly string[]) {
    super('memory shards changed during the merge');
    this.name = 'MemoryWriteConflict';
  }
}

/** Attempts per push: a shard another isolate wrote between the read and the write is read and merged again. */
export const MEMORY_WRITE_ATTEMPTS = 3;

/**
 * A stored shard's states. The Worker wrote the text itself, so anything else is a damaged row: it is
 * an error (the call fails), never read as empty, which would let the next write replace the shard.
 */
export function readShardStates(row: Pick<StoredMemoryShard, 'shard' | 'states'>): MemoryShardStates {
  const parsed: unknown = JSON.parse(row.states);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`memory shard ${row.shard} is not a map`);
  return parsed as MemoryShardStates;
}

/**
 * The writes one push needs: each sent shard merged into its stored copy. A shard whose merged text
 * equals the stored text is left out, so a repeated call writes nothing. Pure: no clock, no I/O.
 */
export function planShardWrites(stored: readonly StoredMemoryShard[], sent: Readonly<Record<string, MemoryShardStates>>): MemoryShardWrite[] {
  const byShard = new Map(stored.map((row) => [row.shard, row]));
  const writes: MemoryShardWrite[] = [];
  for (const shard of Object.keys(sent).sort()) {
    const row = byShard.get(shard);
    const states = JSON.stringify(mergeMemoryShard(row ? readShardStates(row) : {}, sent[shard] as MemoryShardStates));
    if (row && states === row.states) continue;
    writes.push({ shard, states, baseSeq: row?.seq ?? null });
  }
  return writes;
}

export interface MemoryPushOutcome {
  /** Answered item states taken in (seeded ones excluded). */
  stored: number;
  /** Seeded states (`n` = 0) left out: never stored (section 4.8). */
  seeded: number;
  /** Shard rows written; never more than the shards the call touches. */
  written: number;
}

/**
 * Merges one call's item states into the learner's shards. Seeded states are dropped first. A shard
 * that another isolate wrote after the read is read, merged and written again (the merge is
 * idempotent, so a shard written twice holds the same states); after `MEMORY_WRITE_ATTEMPTS` the
 * call fails with `MemoryWriteConflict` and the device sends it again later.
 */
export async function pushMemory(db: Db, learnerId: string, shards: Readonly<Record<string, MemoryShardStates>>, now: Date): Promise<MemoryPushOutcome> {
  const answered = withoutSeeded(shards);
  const total = Object.values(shards).reduce((sum, states) => sum + Object.keys(states).length, 0);
  const stored = Object.values(answered).reduce((sum, states) => sum + Object.keys(states).length, 0);
  let pending = Object.keys(answered);
  let written = 0;
  for (let attempt = 0; attempt < MEMORY_WRITE_ATTEMPTS && pending.length > 0; attempt += 1) {
    const sent = Object.fromEntries(pending.map((shard) => [shard, answered[shard] as MemoryShardStates]));
    const result = await db.writeMemoryShards(learnerId, planShardWrites(await db.memoryShardsOf(learnerId, pending), sent), now.toISOString());
    written += result.written.length;
    pending = result.conflicts;
  }
  if (pending.length > 0) throw new MemoryWriteConflict(pending);
  return { stored, seeded: total - stored, written };
}
