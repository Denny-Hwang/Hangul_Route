-- Hangul Route — D1 migration 0010 (additive): when a learner's name, level or picture last changed.
-- PATCH /api/sync/learners/:id writes display_name, age_group and avatar column by column and sets
-- profile_updated_at to the device's edit time; an edit older than the stored value is not applied, so a
-- queued edit that arrives late never undoes a newer one. One nullable column; nothing existing is
-- altered, rewritten or dropped, and existing rows read NULL (never edited since registration).
-- Apply before deploying the Worker that writes it (server first). Rollback: an older Worker selects
-- learners by name and never reads this column; leave it in place.
ALTER TABLE learners ADD COLUMN profile_updated_at TEXT NULL;
