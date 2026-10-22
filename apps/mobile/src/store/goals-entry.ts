import { useEffect, useState } from 'react';
import { onGoalEvent } from '../logic/goals/goal-events';
import type { ActivityKind } from '../logic/goals/points';
import { setSessionDayGate } from '../platform/goal-clock';
import type { GoalMoment } from './goals';
import { currFlagOn } from './remote-config-store';

/*
 * The start bundle's door to the daily and weekly goals (F-CURR-002 section 7.4 and section 10, row CM-17). The goals'
 * logic and screens are one chunk of their own (`screens/goals/goals-chunk.ts`, a precached web bundle reached through
 * the literal `import()` below; a native build keeps it in its one bundle), so a learner with `goals` off (the
 * built-in pct 0) never loads it and the start bundle does not grow. Everything here first checks `goals`.
 */

export type GoalsChunk = typeof import('../screens/goals/goals-chunk');
export type { GoalMoment };

let loading: Promise<GoalsChunk> | null = null;
let loaded: GoalsChunk | null = null;

/** The goals chunk, loaded once; a failed load (offline before the precache) is tried again on the next call. */
export function loadGoalsChunk(): Promise<GoalsChunk> {
  if (loading === null) {
    loading = import('../screens/goals/goals-chunk').then(
      (chunk) => {
        loaded = chunk;
        return chunk;
      },
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
  }
  return loading;
}

/** The chunk once it is in, for a screen that renders from it; null while `on` is false or it loads. */
export function useGoalsChunk(on: boolean): GoalsChunk | null {
  const [chunk, setChunk] = useState<GoalsChunk | null>(on ? loaded : null);
  useEffect(() => {
    if (!on) {
      setChunk(null);
      return undefined;
    }
    let live = true;
    loadGoalsChunk().then(
      (c) => {
        if (live) setChunk(c);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [on]);
  return on ? chunk : null;
}

/**
 * A finished activity's daily-goal points (`recordActivityPoints` in `store/goals.ts`): resolves with what it reached
 * for the Results banner, or null when `goals` is off, the chunk cannot load or the saved copy is not read yet.
 */
export function recordActivityPointsLater(profileId: string, kind: ActivityKind, deviceNow: Date = new Date()): Promise<GoalMoment | null> {
  if (!currFlagOn('goals', profileId)) return Promise.resolve(null);
  return loadGoalsChunk().then(
    (chunk) => chunk.recordActivityPoints(profileId, kind, deviceNow),
    () => null,
  );
}

/** The moment a word set left for its Results screen (`takeGoalMoment`), or null. */
export function takeGoalMomentLater(profileId: string): Promise<GoalMoment | null> {
  if (!currFlagOn('goals', profileId)) return Promise.resolve(null);
  return loadGoalsChunk().then(
    (chunk) => chunk.takeGoalMoment(profileId),
    () => null,
  );
}

// A session's local day takes the server-clock cap only while `goals` is on (section 13; off is CM-4 as shipped).
setSessionDayGate((profileId) => currFlagOn('goals', profileId));

// A word set the progress store recorded, and every snapshot a sync or restore hands back (the latch runs after it).
onGoalEvent((event) => {
  if (!currFlagOn('goals', event.profileId)) return;
  loadGoalsChunk().then(
    (chunk) => chunk.handleGoalEvent(event),
    () => undefined,
  );
});

/** Tests only. */
export function resetGoalsChunkForTests(): void {
  loading = null;
  loaded = null;
}
