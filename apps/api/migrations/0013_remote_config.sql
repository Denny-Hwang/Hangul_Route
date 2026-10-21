-- Hangul Route — D1 migration 0013 (additive): public remote config (F-CURR-002 section 12.2, row CM-2).
-- One new table and nothing else: no existing table is altered, rewritten or dropped, and no row is
-- inserted, so every F-CURR-002 flag keeps its built-in percentage (0) until the owner adds a row.
-- remote_config: one row per flag (`dailyReview`, `pack.<key>`, `game.<kind>`, ...). The owner edits
-- the rows in the D1 console (docs/launch/owner-runbook.md section K) and the guardrail evaluator
-- (row CM-70b) only lowers `pct`. `on` is 1 (on) or 0 (off; any other value reads as off); `pct` is
-- 0-100 (a value outside reads clamped). `reason` is the last change's note and is never served.
-- `"on"` is quoted because ON is an SQL keyword; the column is named `on`.
-- No identifier, name or email: the table holds switch values only. GET /api/config serves `on` and
-- `pct` with Cache-Control public, max-age=300.
-- Apply before deploying the Worker that reads it (the Deploy command applies migrations first).
-- Rollback: an older Worker never reads the table; leave it in place.
CREATE TABLE IF NOT EXISTS remote_config (
  flag        TEXT PRIMARY KEY,
  "on"        INTEGER NOT NULL,
  pct         INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  reason      TEXT
);
