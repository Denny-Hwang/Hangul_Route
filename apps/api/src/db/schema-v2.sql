-- Hangul Route — Cloudflare D1 schema v2 (additive), F-SYNC-001.
-- Mirrors packages/backend/src/store.ts (v2 section). Applied after schema.sql;
-- v1 tables stay until the client stops using the legacy routes (it never did),
-- then a later migration drops families/profiles/progress/card_unlocks/sessions.
-- See docs/roadmap/multi-persona-sync-platform.md §2 for the full v2 target
-- (spaces, memberships, plans, entitlements arrive in S3–S6).

CREATE TABLE IF NOT EXISTS learners (
  id               TEXT PRIMARY KEY,           -- profile:xxxx (client id kept when free)
  display_name     TEXT NOT NULL,
  age_group        TEXT NOT NULL CHECK (age_group IN ('5-7', '8-9', '10-11')),
  avatar           TEXT NOT NULL,
  recovery_hash    TEXT UNIQUE,                -- Rescue Code hash (F-RESTORE-001)
  created_at       TEXT NOT NULL,
  last_active_at   TEXT NOT NULL
);

-- The principal for learner traffic: a device bound to a learner holds a
-- random secret; only its SHA-256 is stored.
CREATE TABLE IF NOT EXISTS learner_devices (
  learner_id    TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  secret_hash   TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  PRIMARY KEY (learner_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_learner_devices_device ON learner_devices(device_id);

-- One row per learner. Teachers read summary_json only; payload_json is the
-- learner's own device and caregivers (roadmap §3.1).
CREATE TABLE IF NOT EXISTS snapshots (
  learner_id    TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL DEFAULT 0,
  schema_ver    INTEGER NOT NULL,
  content_ver   TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  summary_json  TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
