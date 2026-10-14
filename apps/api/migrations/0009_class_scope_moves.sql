-- Hangul Route — D1 migration 0009 (additive): class-scope acknowledgements and teacher moves.
-- AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.1 ([TV], owner decisions 2026-10-14; PR TV-B).
-- Two new tables and their indexes; nothing existing is altered or rewritten.
-- class_scope_acks: one row per learner, the family's acknowledgement of what a teacher
-- sees (TV-D4); a class or school reads the full scope only for a learner with a row at a
-- full-scope text version.
-- class_moves: a teacher's move of a learner between two classes, direct (TV-D7) or
-- accepted by the receiving class (TV-D8). Ids and times only; names are read live.
-- Both cascade from learners (an older Worker's erase keeps working) and from spaces.
-- Apply before deploying any Worker that reads or writes them (server first); this
-- PR's Worker names them in the learner erase and the test reset only once they exist.
-- Retention: ended and executed moves are purged 90 days after they ended or executed,
-- in bounded rounds by the Worker. Rollback: an older Worker never reads these tables;
-- leave them in place.
CREATE TABLE IF NOT EXISTS class_scope_acks (
  learner_id     TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  text_version   TEXT NOT NULL,
  basis          TEXT NOT NULL CHECK (basis IN ('caregiver','device')),
  evidence       TEXT NOT NULL,                                   -- account id (caregiver) or device id; never a name
  acked_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_moves (
  id                 TEXT PRIMARY KEY,                            -- move:<uuid>
  learner_id         TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  source_space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  dest_space_id      TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('direct','accept')),
  status             TEXT NOT NULL CHECK (status IN ('requested','executed','declined','cancelled','expired')),
  actor_account_id   TEXT NOT NULL,
  actor_via          TEXT NOT NULL CHECK (actor_via IN ('owner','teacher','school_admin')),
  decided_account_id TEXT,
  decided_via        TEXT CHECK (decided_via IN ('owner','teacher','school_admin')),
  end_reason         TEXT CHECK (end_reason IN ('not_now','cancelled','expired','no_room','learner_left','destination_archived')),
  token              TEXT,                                        -- the gate's one-off token, cleared in the same batch
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  expires_at         TEXT NOT NULL,                               -- created_at + 14 days
  executed_at        TEXT,
  ended_at           TEXT,
  family_seen_at     TEXT,                                        -- a guardian pressed OK on the notice
  CHECK (source_space_id <> dest_space_id),
  CHECK (status <> 'executed' OR executed_at IS NOT NULL),
  CHECK (status NOT IN ('declined','cancelled','expired') OR (end_reason IS NOT NULL AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_moves_open_learner ON class_moves(learner_id) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS idx_class_moves_source ON class_moves(source_space_id, status);
CREATE INDEX IF NOT EXISTS idx_class_moves_dest ON class_moves(dest_space_id, status);
CREATE INDEX IF NOT EXISTS idx_class_moves_learner ON class_moves(learner_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_class_moves_ended ON class_moves(status, ended_at);
