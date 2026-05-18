-- Hangul Route — Cloudflare D1 schema v1
-- Mirrors apps/api/src/store.ts shape. Applied via `wrangler d1 migrations apply`
-- once a D1 binding is configured (see wrangler.toml).
-- See F-INFRA-001-cloudflare-workers-bootstrap.md.

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  parent_pin_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  age_group TEXT NOT NULL CHECK (age_group IN ('5-7', '8-9', '10-11')),
  avatar TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_family ON profiles(family_id);

CREATE TABLE IF NOT EXISTS progress (
  profile_id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS card_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  UNIQUE (profile_id, card_id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_unlocks_profile ON card_unlocks(profile_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  episodes_touched_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_profile_started ON sessions(profile_id, started_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  name TEXT NOT NULL,
  payload_json TEXT,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_profile_at ON events(profile_id, at);
CREATE INDEX IF NOT EXISTS idx_events_name_at ON events(name, at);

CREATE TABLE IF NOT EXISTS homework_assignments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL CHECK (assigned_by IN ('parent', 'teacher', 'system')),
  assigned_at TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_homework_profile_due ON homework_assignments(profile_id, due_at);
