/**
 * F-CURR-002 section 4.8 (row CM-11): one row of `memory_shards` (migration 0016). `states` is the
 * shard's compact JSON map (review item id -> {b, d, c, r, n, f, s, at}), stored and read back as
 * text: the pull hands it on without parsing it, and only the push parses the shards it touches.
 */
export interface StoredMemoryShard {
  shard: string;
  /** Server-assigned, per learner; every write gives the row the learner's highest `seq` + 1. */
  seq: number;
  states: string;
  updatedAt: string;
}

/**
 * One shard to write after a merge. `baseSeq` is the `seq` the merge read (null: the shard had no
 * row), and the write applies only while the row is still at it, so two isolates merging into one
 * shard at once can never drop each other's states: the one that loses re-reads and merges again.
 */
export interface MemoryShardWrite {
  shard: string;
  states: string;
  baseSeq: number | null;
}

/** Which shards a write stored, and which had changed since they were read (none of those is written). */
export interface MemoryShardWriteResult {
  written: string[];
  conflicts: string[];
}
