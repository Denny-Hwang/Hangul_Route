-- Hangul Route — D1 migration 0006 (additive): curriculum plan meta.
-- F-PLAN-002 section 3.5. One nullable column on plans: NULL is a classic
-- plan (every existing row), a JSON CurriculumMeta is a curriculum route.
-- No backfill and no rewrite of existing rows; a Worker that predates the
-- column never reads it. Apply this migration before deploying the Worker that
-- writes meta_json (server first).
-- Number: erratum E-1 of docs/specs/AMENDMENTS-PLC-PLAN-HANDOFF.md (0005 is
-- held by F-SPACE-002 T-3b; scripts/check-migrations.mjs rejects duplicates).
ALTER TABLE plans ADD COLUMN meta_json TEXT;
