-- Hangul Route — D1 migration 0012 (additive): school administrator invites.
-- AMENDMENTS-SEATS-ADMINS sections 6.1 to 6.3 ([SA], owner request 2026-10-20; PR SA-2).
-- One nullable column on memberships, one new table and its index; nothing existing is
-- altered, rewritten or dropped, and existing membership rows read NULL.
-- memberships.promoted_from: NULL, or 'teacher' when accepting an invite promoted a teacher
-- row of the school to admin, so ending the admin role later gives the teacher row back
-- instead of taking the account out of the school. No CHECK (later values stay additive).
-- admin_invites: one row per invite link. Only the hex SHA-256 of the token is stored; the
-- token itself is shown once to the school's owner and is never stored. Account and space ids
-- and times only: never a name, an email or a token.
-- Apply before deploying the Worker that writes it (server first). Nothing calls the new
-- routes until the console row SA-4 ships.
-- Retention: rows whose expires_at, accepted_at or revoked_at is more than 30 days old are
-- purged by the daily job, in bounded rounds.
-- Rollback: an older Worker never reads the table or the column; leave them in place.
ALTER TABLE memberships ADD COLUMN promoted_from TEXT;
CREATE TABLE IF NOT EXISTS admin_invites (
  id           TEXT PRIMARY KEY,                       -- invite:<uuid>
  space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,                   -- hex SHA-256 of the token
  created_by   TEXT NOT NULL,                          -- account id of the owner
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  accepted_by  TEXT,
  accepted_at  TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_invites_space ON admin_invites(space_id, created_at);
