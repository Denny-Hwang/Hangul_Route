/**
 * F-CURR-002 section 11.2 (row CM-70a): the fixed bucket edges of the counts that land in
 * `learning_rollups`. The Worker stores a bucket only when it is one of these codes, so an
 * anonymous caller cannot create new rows by sending bucket codes of its own choosing; a code off
 * the list adds nothing (the event is still accepted and logged). The emitting rows (CM-12 for
 * `memory.daily` and `items.seeded`) build their bucket codes with `rollupBucketCode` and these
 * edges, so device and Worker agree.
 *
 * Each list is the lower edges, ascending, starting at 0. A bucket is `<lo>` when it holds one
 * value, `<lo>-<hi>` when it holds several, and `<lo>+` for the last; every code fits
 * `TelemetryBucketSchema`.
 */

/** A weekly or daily item count: the north star (`durableWeekBucket`), the due volume (`dueVolumeBucket`) and the items newly held (`newHeld`). */
export const ROLLUP_ITEM_COUNT_EDGES = [0, 1, 2, 3, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500] as const;
/** Items placed in review by seeding (`items.seeded` `countBucket`). */
export const ROLLUP_SEEDED_COUNT_EDGES = [0, 1, 10, 20, 50, 100, 200, 300, 500, 1000, 2000] as const;
/**
 * Days over which seeded items fall due (`items.seeded` `spreadDaysBucket`): the lag buckets up to 30
 * days, then 31-45, 46-62 and 63-90, so the shadow check of row CM-12 (runbook K-4) can tell a seeded
 * spread against the CM-13 simulation's gate S-c ("the spread ends by day 62"); 91+ is the open top.
 */
export const ROLLUP_SPREAD_DAYS_EDGES = [0, 1, 2, 4, 8, 15, 31, 46, 63, 91] as const;
/** Study minutes on one local day (`memory.daily` `minutes`, 0 to 1440). */
export const ROLLUP_STUDY_MINUTES_EDGES = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

/**
 * Correct decodes per minute of a Decoding Sprint (row CM-32, `decode.sprint.finished` `rateBucket` and
 * `probeRateBucket`; G9 compares the median of the held-out probe's rate between a learner's first and fourth sprint):
 * two-wide to 15 and three-wide to 30, so a +30% change of a median between about 8 and 25 moves at least one bucket,
 * then 30-34, 35-39, 40-49 and the open top 50+.
 */
export const ROLLUP_DECODE_RATE_EDGES = [0, 1, 3, 5, 7, 9, 11, 13, 15, 18, 21, 24, 27, 30, 35, 40, 50] as const;
/** A learner's sprint count on this device, 1 for the first sprint (`decode.sprint.finished` `sprintIndexBucket`): one bucket each to 4 (G9 reads 1 and 4), then 5-9, 10-19 and 20+. */
export const ROLLUP_SPRINT_INDEX_EDGES = [0, 1, 2, 3, 4, 5, 10, 20] as const;

/** The bucket code of a whole, non-negative `value` on `edges` (lower edges, ascending, from 0). */
export function rollupBucketCode(value: number, edges: readonly number[]): string {
  let i = edges.length - 1;
  while (i > 0 && value < (edges[i] as number)) i -= 1;
  const lo = edges[i] as number;
  const next = edges[i + 1];
  if (next === undefined) return `${lo}+`;
  return next - 1 === lo ? String(lo) : `${lo}-${next - 1}`;
}

/** Every code of `edges`, in order. */
export function rollupBucketCodes(edges: readonly number[]): readonly string[] {
  return edges.map((lo) => rollupBucketCode(lo, edges));
}
