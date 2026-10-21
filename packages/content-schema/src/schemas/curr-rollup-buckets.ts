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
/** Days over which seeded items fall due (`items.seeded` `spreadDaysBucket`); the edges follow the lag buckets. */
export const ROLLUP_SPREAD_DAYS_EDGES = [0, 1, 2, 4, 8, 15, 31] as const;
/** Study minutes on one local day (`memory.daily` `minutes`, 0 to 1440). */
export const ROLLUP_STUDY_MINUTES_EDGES = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

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
