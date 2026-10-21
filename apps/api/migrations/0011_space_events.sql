-- Hangul Route — D1 migration 0011 (additive): the school audit trail.
-- AMENDMENTS-SEATS-ADMINS section 6.2 ([SA], owner request 2026-10-20; PR SA-1).
-- One new table and its index; nothing existing is altered or rewritten.
-- space_events: for schools only, the school renamed, a class of the school renamed (on the
-- school's row, the class in subject_space_id), and (SA-2) the administrator invites and
-- roles. Account and space ids and a time only: never a name, an email or a token.
-- `kind` has no CHECK on purpose: the zod enum SpaceEventKindSchema (content-schema) is the
-- registry every insert goes through, so a later kind stays additive (a CHECK change would
-- need a table rebuild).
-- subject_space_id has no foreign key: the event outlives the class it names.
-- Apply before deploying the Worker that writes it (server first); this PR's Worker writes a
-- row only after a rename it has already committed, and its daily purge skips the table when
-- a run finds it missing.
-- Retention: rows older than 400 days are purged by the daily job, in bounded rounds.
-- Rollback: an older Worker never reads this table; leave it in place.
CREATE TABLE IF NOT EXISTS space_events (
  id                 TEXT PRIMARY KEY,                 -- sev:<uuid>
  space_id           TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,
  actor_account_id   TEXT NOT NULL,
  subject_account_id TEXT,
  subject_space_id   TEXT,
  invite_id          TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_space_events_space ON space_events(space_id, created_at);
