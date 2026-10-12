-- Hangul Route — D1 migration 0008 (additive): notes from grown-ups.
-- F-FEEDBACK-001 section 7.4 (PR FB-2). Six new tables and their indexes:
-- one note row per learner (feedback_notes), the reports against notes, the
-- holds on sending accounts, each learner's class-notes setting, a family's
-- "stop notes from this sender" blocks, and the family owner's send grants.
-- Nothing existing is altered or rewritten.
-- Apply this migration before deploying any Worker that reads or writes these
-- tables (server first): the routes come in FB-3a / FB-4a, after this deploy.
-- The Worker of this PR only names the tables in the learner erase and the
-- test reset, each guarded by a table-exists check.
-- Retention (section 8.7): live, hidden and withdrawn notes 180 days; reported
-- notes and their reports 90 days after the report; lifted holds 365 days.
-- Purged in bounded rounds by the Worker (FB-3b), and with the learner.
-- Rollback: an older Worker never reads these tables; leave them in place.
CREATE TABLE IF NOT EXISTS feedback_notes (
  id                  TEXT PRIMARY KEY,                                   -- note:<uuid>
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  space_id            TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,                                      -- accounts.id; never shown to the learner
  sender_role         TEXT NOT NULL CHECK (sender_role IN ('teacher','family')),
  sender_label        TEXT,                                               -- family label id; NULL for teachers
  batch_id            TEXT NOT NULL,
  batch_kind          TEXT NOT NULL CHECK (batch_kind IN ('everyone','learners')),
  preset_id           TEXT NOT NULL,
  body                TEXT,                                               -- checked by checkNoteText; NULL when none
  body_locale         TEXT,
  suggest_kind        TEXT CHECK (suggest_kind IS NULL OR suggest_kind = 'quest'),
  suggest_id          TEXT,
  status              TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','hidden','reported','withdrawn')),
  hidden_via          TEXT CHECK (hidden_via IN ('family','device')),
  acted_by_account_id TEXT,                                               -- the caregiver who hid it from the console; NULL for device actions
  created_at          TEXT NOT NULL,
  read_at             TEXT,
  reaction            TEXT,
  reaction_at         TEXT,
  hidden_at           TEXT,
  withdrawn_at        TEXT,
  CHECK (sender_role = 'family' OR sender_label IS NULL),
  CHECK (status <> 'hidden' OR (hidden_at IS NOT NULL AND hidden_via IS NOT NULL)),
  CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_learner ON feedback_notes(learner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_space   ON feedback_notes(space_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_sender  ON feedback_notes(sender_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_batch   ON feedback_notes(batch_id);
-- the bounded retention purge (section 8.7), which runs on every send and oversight read: oldest notes first,
-- and reported notes alone
CREATE INDEX IF NOT EXISTS idx_feedback_notes_created  ON feedback_notes(created_at, id);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_reported ON feedback_notes(created_at, id) WHERE status = 'reported';

CREATE TABLE IF NOT EXISTS feedback_reports (
  id                  TEXT PRIMARY KEY,                                   -- notereport:<uuid>
  note_id             TEXT NOT NULL REFERENCES feedback_notes(id) ON DELETE CASCADE,
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,
  reason              TEXT NOT NULL CHECK (reason IN ('unkind','unsafe','not_for_me','other')),
  via                 TEXT NOT NULL CHECK (via IN ('family','device')),
  evidence            TEXT NOT NULL,                                      -- reporting account id or device id; never a name
  reporter_key        TEXT NOT NULL,                                      -- the reporting family (section 8.4)
  attest              TEXT CHECK (attest IN ('grown_up_pin','self')),     -- device reports only (a client claim)
  created_at          TEXT NOT NULL,
  reviewed_at         TEXT,
  outcome             TEXT CHECK (outcome IN ('kept_hidden','restored','sender_held'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_sender ON feedback_reports(sender_account_id, created_at);
-- the reports of one note (the ON DELETE CASCADE from a note, the retention filter of every list), the purge of
-- old report rows, and the reports of one learner (the erase and the cascade from learners)
CREATE INDEX IF NOT EXISTS idx_feedback_reports_note    ON feedback_reports(note_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created ON feedback_reports(created_at, id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_learner ON feedback_reports(learner_id);

CREATE TABLE IF NOT EXISTS feedback_sender_holds (
  account_id  TEXT PRIMARY KEY,
  reason      TEXT NOT NULL CHECK (reason IN ('reports','unsafe','owner')),
  created_at  TEXT NOT NULL,
  lifted_at   TEXT
);

CREATE TABLE IF NOT EXISTS learner_note_prefs (
  learner_id          TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  classes             TEXT NOT NULL DEFAULT 'all' CHECK (classes IN ('all','presets','off')),
  acknowledged_at     TEXT,                                               -- the one-time class-notes card was answered
  updated_at          TEXT NOT NULL,
  updated_via         TEXT NOT NULL CHECK (updated_via IN ('family','device')),
  updated_by_account  TEXT                                                -- NULL for device changes
);

CREATE TABLE IF NOT EXISTS feedback_sender_blocks (
  learner_id          TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  sender_account_id   TEXT NOT NULL,
  family_space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_by_account  TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  PRIMARY KEY (learner_id, sender_account_id)
);

CREATE TABLE IF NOT EXISTS feedback_send_grants (
  space_id            TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,  -- a family space
  account_id          TEXT NOT NULL,
  granted_by          TEXT NOT NULL,
  granted_at          TEXT NOT NULL,
  PRIMARY KEY (space_id, account_id)
);
