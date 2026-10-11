import { StageKeySchema, type Episode, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { gridEpisodesOf } from './order';
import { isDerivedComplete } from './stage-rows';

/**
 * The stage latch (F-ROUTE-001 section 3.3, OD-6; section 3.15). When a stage
 * becomes complete by the derived rule (availability `open`, every grid
 * episode complete), `stageDoneAt[stage]` is written once and the stage stays
 * Complete whatever content ships later. `known` (placed out) and `taste`
 * stages are never latched. The store writer calls these after each quest
 * result and once on app start, with `flags.myRouteEnabled` off too.
 */

const hasLatch = (snapshot: Pick<ProgressSnapshot, 'stageDoneAt'>, stage: StageKey): boolean =>
  Object.prototype.hasOwnProperty.call(snapshot.stageDoneAt ?? {}, stage);

/** Stages complete now by the derived rule and not yet in `stageDoneAt`. */
export function stagesToLatch(
  snapshot: Pick<ProgressSnapshot, 'quests' | 'stageDoneAt'>,
  episodes: readonly Episode[],
): StageKey[] {
  const grid = gridEpisodesOf(episodes);
  return StageKeySchema.options.filter((stage) => !hasLatch(snapshot, stage) && isDerivedComplete(stage, grid, snapshot));
}

/**
 * Adds keys only, to the snapshot it is given (the hydrated one), never a fresh
 * record: an existing latch, or a key a newer build wrote, is never moved or
 * removed. Times are `now.toISOString()`. Returns the same snapshot when
 * there is nothing to add.
 */
export function withStageLatches(snapshot: ProgressSnapshot, stages: readonly StageKey[], now: Date): ProgressSnapshot {
  const added = stages.filter((stage) => !hasLatch(snapshot, stage));
  if (added.length === 0) return snapshot;
  const at = now.toISOString();
  const stageDoneAt: Record<string, string> = { ...(snapshot.stageDoneAt ?? {}) };
  for (const stage of added) stageDoneAt[stage] = at;
  return { ...snapshot, stageDoneAt, updatedAt: at };
}

/**
 * The store writer's one call: `withStageLatches(snapshot, stagesToLatch(...))`,
 * best effort. It runs on the cold-start hydrate over stored JSON that is not
 * validated, so any error returns the snapshot unchanged: the latch never
 * blocks a hydrate or a save.
 */
export function latchSnapshot(snapshot: ProgressSnapshot, episodes: readonly Episode[], now: Date): ProgressSnapshot {
  try {
    return withStageLatches(snapshot, stagesToLatch(snapshot, episodes), now);
  } catch {
    return snapshot;
  }
}
