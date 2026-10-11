-- Hangul Route — D1 migration 0005 (additive): class transfer, F-SPACE-002 PR T-3b
-- (docs/specs/F-SPACE-002-class-transfer.md section 4.1).
-- Creates four new tables and their indexes and touches nothing that exists,
-- so the deployed Worker keeps working when this lands first and the file is
-- safe to re-run. The foreign keys to learners and spaces stay ON DELETE
-- CASCADE: an older Worker's deleteLearner does not know these tables and
-- relies on the cascade. A request stores ids and hashes only, never a name.

-- One row per move request. Every write is a single compare-and-set statement
-- that bumps `rev`; the CHECKs make an illegal state impossible to write.
CREATE TABLE IF NOT EXISTS transfer_requests (
  id                   TEXT PRIMARY KEY,                    -- transfer:<uuid>
  learner_id           TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  source_space_id      TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  dest_space_id        TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  initiator            TEXT NOT NULL CHECK (initiator IN ('learner_side', 'source')),
  initiator_account_id TEXT,                                -- null when started from a device
  status               TEXT NOT NULL CHECK (status IN ('requested','approved','executed','declined','expired','cancelled')),
  end_reason           TEXT,
  end_actor            TEXT CHECK (end_actor IN ('family','device','source','destination','system')),  -- audit only
  block_reason         TEXT,                                -- set while `approved` and waiting for room
  introduce            INTEGER NOT NULL DEFAULT 0,
  rev                  INTEGER NOT NULL DEFAULT 0,          -- +1 on every write
  l_state              TEXT NOT NULL DEFAULT 'pending' CHECK (l_state IN ('pending','consented','declined')),
  l_at                 TEXT,
  l_basis              TEXT CHECK (l_basis IN ('caregiver','device_attested')),
  l_attest             TEXT CHECK (l_attest IN ('grown_up_pin','self')),   -- client claim, device basis only
  l_evidence           TEXT,                                -- account id (caregiver) or device id; never a name
  l_role               TEXT,                                -- owner | caregiver (caregiver basis)
  l_text_version       TEXT,
  l_locale             TEXT,                                -- the language of the consent text that was shown
  l_shown_json         TEXT,                                -- ids of the consent lines shown + conditional flags
  l_dest_name_hash     TEXT,                                -- terms the consent covered (sha-256 hex)
  l_dest_consent_mode  TEXT,
  l_dest_anonymize     INTEGER,
  l_dest_owner_id      TEXT,
  l_source_name_hash   TEXT,
  l_premium_change     TEXT,
  s_state              TEXT NOT NULL DEFAULT 'pending' CHECK (s_state IN ('pending','consented','declined','not_required')),
  s_at                 TEXT,
  s_account_id         TEXT,
  s_via                TEXT,                                -- owner | teacher | school_admin
  d_state              TEXT NOT NULL DEFAULT 'pending' CHECK (d_state IN ('pending','consented','declined')),
  d_at                 TEXT,
  d_account_id         TEXT,
  d_via                TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  expires_at           TEXT NOT NULL,                       -- created_at + 14 days
  approved_at          TEXT,                                -- all slots in
  execute_after        TEXT,                                -- l_at + 48 h
  ended_at             TEXT,                                -- declined | cancelled | expired only
  executed_at          TEXT,
  CHECK (status NOT IN ('approved','executed') OR (l_state = 'consented' AND s_state IN ('consented','not_required') AND d_state = 'consented')),
  CHECK (status <> 'executed' OR executed_at IS NOT NULL),
  CHECK (status NOT IN ('declined','cancelled','expired') OR (end_reason IS NOT NULL AND ended_at IS NOT NULL)),
  CHECK (l_state <> 'consented' OR (l_at IS NOT NULL AND l_basis IS NOT NULL AND l_text_version IS NOT NULL AND l_locale IS NOT NULL AND l_evidence IS NOT NULL))
);
-- One open request per learner: two simultaneous creates cannot both win.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_open_learner ON transfer_requests(learner_id) WHERE status IN ('requested','approved');
CREATE INDEX IF NOT EXISTS idx_transfer_source ON transfer_requests(source_space_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_dest ON transfer_requests(dest_space_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_learner ON transfer_requests(learner_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_transfer_creator ON transfer_requests(initiator_account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_ended ON transfer_requests(status, ended_at);

-- The audit trail of a request: codes and counts only, never a name or free text.
CREATE TABLE IF NOT EXISTS transfer_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id   TEXT NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  at            TEXT NOT NULL,
  actor_kind    TEXT NOT NULL CHECK (actor_kind IN ('account','device','system')),
  actor_ref     TEXT,                                       -- account id or device id; null for system
  event         TEXT NOT NULL,                              -- created | consented | declined | cancelled | expired | blocked | consent_reset | executed | devices_revoked | relinks_closed | old_space_still_has_access
  slot          TEXT,
  detail_json   TEXT                                        -- codes and counts only (reason, count, basis, via); never a name or free text
);
CREATE INDEX IF NOT EXISTS idx_transfer_events_transfer ON transfer_events(transfer_id, id);

-- Per-learner switches. Each route writes only its own column.
CREATE TABLE IF NOT EXISTS learner_transfer_prefs (
  learner_id               TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  self_managed             INTEGER NOT NULL DEFAULT 0,      -- set from the learner's device
  block_teacher_requests   INTEGER NOT NULL DEFAULT 0,      -- set by a guardian in the console
  updated_at               TEXT NOT NULL
);

-- Durable counters for abuse limits (the in-memory limiter is per isolate, lib/rate-limit.ts).
CREATE TABLE IF NOT EXISTS rate_hits (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  key   TEXT NOT NULL,                                      -- tcode:acct:<id> | tcode:learner:<id> | tcreate:learner:<id>
  at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits_key ON rate_hits(key, at);
