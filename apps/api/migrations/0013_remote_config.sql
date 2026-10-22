-- Hangul Route — D1 migration 0013 (additive): public remote config (F-CURR-002 section 12.2, row CM-2).
-- One new table and nothing else: no existing table is altered, rewritten or dropped, and no row is
-- inserted, so every F-CURR-002 flag keeps its built-in percentage (0) until the owner adds a row.
-- remote_config: one row per flag (`dailyReview`, `pack.<key>`, `game.<kind>`, ...). The owner edits
-- the rows in the D1 console (docs/launch/owner-runbook.md section K) and the guardrail evaluator
-- (row CM-70b) only lowers `pct`. `on` is 1 (on) or 0 (off) and `pct` is 0-100: the CHECK constraints refuse any
-- other value at the console, so a typo during a ramp (250 meant as 25) is rejected instead of releasing a feature to
-- every profile (a value that still reads out of range is served as 0, off). `reason` is the last change's note and
-- is never served.
-- `"on"` is quoted because ON is an SQL keyword; the column is named `on`.
-- No identifier, name or email: the table holds switch values only. GET /api/config serves `on` and
-- `pct` with Cache-Control public, max-age=300.
-- Apply before deploying the Worker that reads it (the Deploy command applies migrations first).
-- Rollback: an older Worker never reads the table; leave it in place.
CREATE TABLE IF NOT EXISTS remote_config (
  flag        TEXT PRIMARY KEY,
  "on"        INTEGER NOT NULL CHECK ("on" IN (0, 1)),
  pct         INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
  updated_at  TEXT NOT NULL,
  reason      TEXT
);
