/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d): the kept copy of a damaged profile list
 * (`profiles-corrupt`, written once by `keepRawCopy` when the list bytes did not parse). It may hold learners' names,
 * so it does not stay for ever: it goes 30 days after the list reads again or a grown-up recovery replaced it, and
 * with any Remove from this device (`store/profile-store.ts`). The mark (`profiles-corrupt:settled`, `{ v: 1, at }`)
 * says when its damage settled; these rules are pure, the store reads and writes the keys.
 */

/** Section 3.6: how long a settled copy stays. */
export const LIST_COPY_KEEP_MS = 30 * 24 * 60 * 60_000;

/** The stored mark: when the copy's damage settled (epoch ms). */
export interface ListCopySettled {
  v: 1;
  at: number;
}

export function settledMark(at: number): ListCopySettled {
  return { v: 1, at };
}

/** The time a stored mark holds, or `null` when there is none it can trust (no mark, another shape, a bad time). */
export function listCopySettledAt(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { v, at } = raw as { v?: unknown; at?: unknown };
  if (v !== 1 || typeof at !== 'number' || !Number.isFinite(at) || at < 0) return null;
  return at;
}

/**
 * What a launch whose list reads does with a copy that is still kept: `mark` it settled now (no mark yet, or one
 * without a time it can trust, so the 30 days start again: the safe side), `wait`, or `drop` it once 30 days have
 * passed. A mark in the future (a clock that was ahead, or ran back) is marked again now, so the 30 days always end.
 */
export type ListCopyStep = 'mark' | 'wait' | 'drop';

export function listCopyStep(settledAt: number | null, now: number): ListCopyStep {
  if (settledAt === null || settledAt > now) return 'mark';
  return now - settledAt >= LIST_COPY_KEEP_MS ? 'drop' : 'wait';
}
