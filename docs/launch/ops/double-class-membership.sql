-- Double class membership after a move: find, then repair (owner report 2026-10-23).
--
-- OWNER-RUN ONLY, by hand, with wrangler against the production D1. Nothing in the Worker or CI runs this file.
-- Run STEP 1 first and keep its output: the step-1 output is the audit log of the repair (save it before step 2).
-- Step 2 deletes exactly the rows step 1 lists, and nothing else; running it again deletes 0 rows.
--
-- The pattern: a learner was moved out of a class (an executed teacher move in class_moves, or an executed
-- family-started transfer in transfer_requests), is still in the destination, and is in the source again with a
-- source joined_at LATER than the move's executed_at (a join with the source's old code). A later executed move back
-- INTO the source makes the source membership legitimate, so such rows are left alone. Any other double membership
-- (for example a join into the destination while a move was waiting) is not touched here.
--
-- NEVER run this whole file with --file: that runs step 2 straight after step 1. Cut each step out first
-- (docs/launch/owner-runbook.md, section H-6):
--   awk '/^-- STEP 1/{f=1;next} /^-- STEP 2/{f=0} f' docs/launch/ops/double-class-membership.sql > step1.sql
--   awk '/^-- STEP 2/{f=1;next} f' docs/launch/ops/double-class-membership.sql > step2.sql
--   pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote --file "$PWD/step1.sql" --json > double-membership-log.json
--     (keep double-membership-log.json: it is the audit log)
--   pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote --file "$PWD/step2.sql"

-- STEP 1 (read-only): every source membership that came back after a move that still stands.
SELECT x.learner_id, x.source_space_id, s.name AS source_name, x.dest_space_id, d.name AS dest_name, x.move_kind, x.move_id, x.executed_at, ms.joined_at AS source_joined_at
FROM (
  SELECT learner_id, source_space_id, dest_space_id, 'class_move' AS move_kind, id AS move_id, executed_at FROM class_moves WHERE status = 'executed'
  UNION ALL
  SELECT learner_id, source_space_id, dest_space_id, 'transfer' AS move_kind, id AS move_id, executed_at FROM transfer_requests WHERE status = 'executed'
) x
JOIN memberships ms ON ms.space_id = x.source_space_id AND ms.member_kind = 'learner' AND ms.member_id = x.learner_id
JOIN memberships md ON md.space_id = x.dest_space_id AND md.member_kind = 'learner' AND md.member_id = x.learner_id
JOIN spaces s ON s.id = x.source_space_id
JOIN spaces d ON d.id = x.dest_space_id
WHERE x.executed_at IS NOT NULL AND ms.joined_at > x.executed_at
  AND NOT EXISTS (SELECT 1 FROM class_moves b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
  AND NOT EXISTS (SELECT 1 FROM transfer_requests b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
ORDER BY x.learner_id, x.executed_at;

-- STEP 2 (guarded, idempotent): remove the source memberships step 1 listed (the same predicate).
DELETE FROM memberships
WHERE member_kind = 'learner' AND (space_id, member_id) IN (
  SELECT x.source_space_id, x.learner_id
  FROM (
    SELECT learner_id, source_space_id, dest_space_id, executed_at FROM class_moves WHERE status = 'executed'
    UNION ALL
    SELECT learner_id, source_space_id, dest_space_id, executed_at FROM transfer_requests WHERE status = 'executed'
  ) x
  JOIN memberships ms ON ms.space_id = x.source_space_id AND ms.member_kind = 'learner' AND ms.member_id = x.learner_id
  JOIN memberships md ON md.space_id = x.dest_space_id AND md.member_kind = 'learner' AND md.member_id = x.learner_id
  WHERE x.executed_at IS NOT NULL AND ms.joined_at > x.executed_at
    AND NOT EXISTS (SELECT 1 FROM class_moves b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
    AND NOT EXISTS (SELECT 1 FROM transfer_requests b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
);
