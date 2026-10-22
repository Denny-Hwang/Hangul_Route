import type { ActivityKind } from './points';

/*
 * What the progress store tells the goals (row CM-17) without importing them: a finished activity it
 * records itself (a word set), and a snapshot handed back by a sync or a restore (the latch check runs
 * after every merge). `store/goals.ts` listens. Dependency-free, so the store and the goals never import
 * each other.
 */

export type GoalEvent = { type: 'activity'; profileId: string; kind: ActivityKind } | { type: 'merged'; profileId: string };

type Listener = (event: GoalEvent) => void;
const listeners = new Set<Listener>();

export function onGoalEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Never throws: a listener's failure must not fail the store's write. */
export function emitGoalEvent(event: GoalEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // The goals are best effort; the write itself already landed.
    }
  }
}
