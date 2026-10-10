-- Hangul Route — D1 migration 0003 (additive), SEC-4 / F-TCH-001 §10.1.
-- A device bound through a teacher's re-link approval is limited to the class
-- ('class': inbox only — no snapshot read or write, no Rescue Code), so a
-- class role can never reach a learner's full progress. Every existing
-- binding, and every one made by registration or a Rescue Code claim, is
-- 'full'. A Rescue Code claimed on a 'class' device makes it 'full'.
ALTER TABLE learner_devices ADD COLUMN scope TEXT NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'class'));
