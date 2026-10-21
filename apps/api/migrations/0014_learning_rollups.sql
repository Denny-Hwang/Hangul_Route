-- Hangul Route — D1 migration 0014 (additive): the learning rollup sink.
-- F-CURR-002 section 11.2 (row CM-70a, Phase 0). One new table; nothing existing is altered,
-- rewritten or dropped.
-- learning_rollups: daily counts written at ingest by POST /api/telemetry for the names on the
-- rollup allowlist (packages/backend/src/lib/learning-rollups.ts). Codes and counts only: the
-- UTC day of ingest, a metric name, a dimension (a content id, a game kind, an experiment arm,
-- or ''), a bucket code and the number of events. Never a profile id, an install key, a device
-- id or any free text. A per-profile metric is a once-per-local-day device event, so `events`
-- on one day are profile-days. Readers hide any group with fewer than 20 events on a day.
-- Apply before deploying the Worker that writes it (server first). A Worker that runs before
-- this migration still accepts every event: the rollup write fails quietly and the event stays
-- in the in-memory log.
-- Rollback: an older Worker never reads or writes this table; leave it in place.
CREATE TABLE IF NOT EXISTS learning_rollups (
  day     TEXT NOT NULL,     -- UTC day of ingest, YYYY-MM-DD
  metric  TEXT NOT NULL,     -- 'memory.daily.recallLag', 'session.end.questLeft', ...
  dim     TEXT NOT NULL,     -- content id, game kind, experiment arm, or ''
  bucket  TEXT NOT NULL,
  events  INTEGER NOT NULL,
  PRIMARY KEY (day, metric, dim, bucket)
);
