-- Hangul Route — D1 migration 0013 (additive): anonymous daily telemetry counters.
-- AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1 ([OA], OA-D18; PR OA-1).
-- One new table; nothing existing is altered or rewritten.
-- telemetry_daily: one row per UTC day, event name and kept payload, holding a count only. `dims` is the
-- payload the Worker's per-name rules kept, as canonical JSON with sorted keys (codes, booleans and bounded
-- counts; '' for none). Never a profile, device or account id, an IP address or a time finer than a day.
-- Apply before deploying the Worker that writes it (server first); the Worker's counter write is best effort,
-- so an isolate that runs before this table exists only skips the count, and its daily purge skips the table.
-- Retention: rows older than 400 days (TELEMETRY_DAILY_KEEP_DAYS) are purged by the daily job, in bounded rounds.
-- Kill switch: the Worker variable TELEMETRY_DAILY (on unless set to another value than "enabled").
-- Rollback: an older Worker never reads this table; leave it in place.
CREATE TABLE IF NOT EXISTS telemetry_daily (
  day   TEXT NOT NULL,              -- UTC date, YYYY-MM-DD
  name  TEXT NOT NULL,              -- a name from section 15, or 'session.start'
  dims  TEXT NOT NULL DEFAULT '',   -- the kept payload as canonical JSON (sorted keys), codes only
  n     INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (day, name, dims)
);
