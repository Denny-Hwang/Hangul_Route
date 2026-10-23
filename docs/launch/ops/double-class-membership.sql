-- Double class membership after a move: find, then repair (owner report 2026-10-23).
--
-- OWNER-RUN ONLY, by hand, with wrangler against the production D1. Nothing in the Worker or CI runs this file.
-- Run STEP 1 first and keep its output: the step-1 output is the audit log of the repair (save it before step 2).
-- Step 2 deletes exactly the rows step 1 lists, and nothing else; running it again deletes 0 rows.
--
-- The pattern: a learner was moved out of a class (an executed teacher move in class_moves, or an executed
-- family-started transfer in transfer_requests), is still in the destination by that move (the destination membership
-- dates from the move or before it, and the destination is a live class), and is in the source again with a source
-- joined_at LATER than the move's executed_at (a join with the source's old code). Left alone: a later executed move
-- back INTO the source (the source membership is then legitimate); a destination that was archived (the learner's
-- live class is the source; the Worker also lets that rejoin through); a learner who left the destination and later
-- joined it again with its code (both memberships are their own choice). Any other double membership (for example a
-- join into the destination while a move was waiting, or a move chain A -> B -> C and then A's code) is not touched
-- here: the teacher removes the learner from the roster in the console.
--
-- NEVER run this whole file at once: that runs step 2 straight after step 1. Cut each step out first and run each one
-- with --command, never --file: with --remote, wrangler sends a --file through the D1 import API, which answers only
-- query and row counts (no SELECT rows, no `changes`) and may hold the database while it imports. From the repository
-- root (docs/launch/owner-runbook.md, section H-6):
--   awk '/^-- STEP 1/{f=1;next} /^-- STEP 2/{f=0} f' docs/launch/ops/double-class-membership.sql > step1.sql
--   awk '/^-- STEP 2/{f=1;next} f' docs/launch/ops/double-class-membership.sql > step2.sql
--   pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote --json --command "$(cat step1.sql)" > double-membership-log.json
--     (keep double-membership-log.json: it is the audit log; the rows are under [0].results)
--   pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote --json --command "$(cat step2.sql)" > double-membership-delete.json
--     ([0].meta.changes must equal the number of step-1 rows)

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
WHERE x.executed_at IS NOT NULL AND ms.joined_at > x.executed_at AND md.joined_at <= x.executed_at
  AND d.kind = 'class' AND d.archived_at IS NULL
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
  JOIN spaces d ON d.id = x.dest_space_id
  WHERE x.executed_at IS NOT NULL AND ms.joined_at > x.executed_at AND md.joined_at <= x.executed_at
    AND d.kind = 'class' AND d.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM class_moves b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
    AND NOT EXISTS (SELECT 1 FROM transfer_requests b WHERE b.learner_id = x.learner_id AND b.dest_space_id = x.source_space_id AND b.status = 'executed' AND b.executed_at > x.executed_at)
);
