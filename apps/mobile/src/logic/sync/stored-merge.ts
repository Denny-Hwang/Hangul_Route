import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { rebaseSnapshot, type MergeOptions } from './merge';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-11 (audit FUNC-1): what a tab stores when another tab (or the installed app's
 * window) wrote the same learner's snapshot since this tab last read or wrote it.
 *
 * - `base` is the stored snapshot this tab last saw, the copy both sides started from;
 * - `ours` is the snapshot this tab holds in memory (`base` plus what was earned here since);
 * - `theirs` is the snapshot stored now (`base` plus what the other tab earned).
 *
 * The result is the union the sync merge makes (`rebaseSnapshot`, as when a server answer meets a write made during
 * the request): every quest, card, session and latch of either side is kept, stars never go down, and an attempt both
 * sides already counted in `base` counts once.
 *
 * Homework is the one list a tab takes items out of on purpose (the plan reconcile, F-PLAN-002 section 3.6; a union
 * would bring a dropped item back). An item of `base` that either side no longer holds stays out.
 *
 * With no `base` (nothing was stored when this tab read, and both tabs then wrote their first record), `theirs`
 * stands in for it: still a union of both sides, with each quest's attempts at the higher count rather than their sum.
 */
export function mergeWithStored(base: ProgressSnapshot | null, ours: ProgressSnapshot, theirs: ProgressSnapshot, opts: MergeOptions): ProgressSnapshot {
  if (base === null) return rebaseSnapshot(theirs, ours, theirs, opts);
  const merged = rebaseSnapshot(base, ours, theirs, opts);
  const mine = new Set(ours.homework.map((h) => h.id));
  const stored = new Set(theirs.homework.map((h) => h.id));
  const dropped = new Set(base.homework.filter((h) => !mine.has(h.id) || !stored.has(h.id)).map((h) => h.id));
  return dropped.size === 0 ? merged : { ...merged, homework: merged.homework.filter((h) => !dropped.has(h.id)) };
}
