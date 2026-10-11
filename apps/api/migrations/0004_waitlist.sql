-- Hangul Route — D1 migration 0004 (additive): launch-invite waitlist.
-- First-party signup behind POST /api/waitlist (docs/launch/waitlist.md). Adds
-- one new table and index and touches nothing that exists, so a Worker without
-- the route keeps working and the migration is safe to re-run.
-- One row per address (stored trimmed and lower-case). `consent_text_version`
-- names the consent line the visitor saw when they signed up. `unsubscribed_at`
-- is set by the owner on request; a later signup for that address does not
-- clear it. No IP address, user agent or other request data is stored.
CREATE TABLE IF NOT EXISTS waitlist (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT NOT NULL UNIQUE,
  created_at            TEXT NOT NULL,
  source                TEXT,
  locale                TEXT,
  consent_text_version  TEXT NOT NULL,
  unsubscribed_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at);
