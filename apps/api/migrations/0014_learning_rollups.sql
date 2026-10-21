-- Hangul Route — D1 migration 0014 (additive): the learning rollup sink.
-- F-CURR-002 section 11.2 (row CM-70a, Phase 0). One new table; nothing existing is altered,
-- rewritten or dropped.
-- learning_rollups: daily counts written at ingest by POST /api/telemetry for the names on the
-- rollup allowlist (packages/backend/src/lib/learning-rollups.ts). Codes and counts only: the
-- UTC day of ingest, a metric name, a dimension (a content id, a game kind, an experiment arm,
-- or ''), a bucket code and the number of events. Never a profile id, an install key, a device
-- id or any free text: every dim and bucket comes from a closed set. A once-a-day name
-- (memory.daily, items.seeded, goal.met, week.goal_met) counts profile-days; every other name
-- counts events. Readers hide any group with fewer than 20 events on a day.
-- Apply before deploying the Worker that writes it (server first). A Worker that runs before
-- this migration still accepts every event: the rollup write fails quietly and the event stays
-- in the in-memory log.
-- WITHOUT ROWID: the primary key is the table, so an upsert writes one row (no separate index).
-- One counter row a day (metric 'rollup.cells', dim '', bucket '') holds the cells reserved by the
-- Worker's global write budget, an input to the D1 guardrail of section 3.3.
-- Writes start as soon as the Worker is deployed, also for names shipped clients already send
-- (session.end, review.complete). Kill switch: the dashboard text variable LEARNING_ROLLUPS set to
-- 'disabled' stops every write at once, without a deploy.
-- Rollback: an older Worker never reads or writes this table; leave it in place.
CREATE TABLE IF NOT EXISTS learning_rollups (
  day     TEXT NOT NULL,     -- UTC day of ingest, YYYY-MM-DD
  metric  TEXT NOT NULL,     -- 'memory.daily.recallLag', 'session.end.questLeft', ...
  dim     TEXT NOT NULL,     -- content id, game kind, experiment arm, or ''
  bucket  TEXT NOT NULL,
  events  INTEGER NOT NULL,
  PRIMARY KEY (day, metric, dim, bucket)
) WITHOUT ROWID;
