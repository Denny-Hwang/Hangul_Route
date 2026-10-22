-- Hangul Route — D1 migration 0016 (additive): the memory store's server copy.
-- F-CURR-002 section 4.8 (row CM-11, Worker first). One new table and its index; nothing existing is
-- altered, rewritten or dropped.
-- memory_shards: one row per learner per shard. A shard is a stage ('stage1' .. 'stage7'), a Topic Pack
-- ('pack:<key>') or 'week' (This week in Korea), about 16 rows per learner at the end state. `states` is
-- a compact JSON map of review item id -> {b, d, c, r, n, f, s, at}: box, due local day, next rung, rungs
-- passed, reps, first day, best box and the last-writer-wins clock. Learning state only: no name, no
-- email, no device id. `seq` is server-assigned per learner and rises on every write, so
-- GET /api/sync/learners/:id/memory?since=<seq> pages by the server's order, never a device clock.
-- POST /api/sync/learners/:id/memory reads only the shards a call touches and writes them in one batch.
-- A learner erase deletes the learner's rows (and the foreign key cascades).
-- Apply before deploying the Worker that writes it (server first). A Worker that runs before this table
-- exists answers the memory routes with 503 and every other route is unchanged.
-- Rollback: an older Worker never reads or writes this table; leave it in place.
CREATE TABLE IF NOT EXISTS memory_shards (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  shard      TEXT NOT NULL,     -- 'stage2', 'pack:numbers-time', 'week'
  seq        INTEGER NOT NULL,  -- server-assigned; per learner; rises on every write
  states     TEXT NOT NULL,     -- compact JSON map: item_id -> {b, d, c, r, n, f, s, at}
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, shard)
);
CREATE INDEX IF NOT EXISTS memory_shards_seq ON memory_shards (learner_id, seq);
