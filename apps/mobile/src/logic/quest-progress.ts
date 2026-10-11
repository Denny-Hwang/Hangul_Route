import type { QuestProgress } from '@hangul-route/content-schema';

/** One finished run of a quest, as Results hands it to the progress store. */
export interface QuestRun {
  questId: string;
  episodeId: string;
  stars: 0 | 1 | 2 | 3;
  accuracy: number;
  attempts: number;
}

/**
 * The stored record after a finished run (F-STORY-003 §3.7, D3: earned stars
 * are never taken away). Higher stars win; on equal stars the higher accuracy
 * wins — the same winner rule as the sync merge (`mergeQuest`). Attempts add
 * up, `startedAt` stays the earliest, and `completedAt` moves to the latest
 * finish because Home's "collected today" flip and the replay window read it.
 */
export function recordBestQuest(previous: QuestProgress | undefined, run: QuestRun, now: string): QuestProgress {
  if (!previous) {
    return { ...run, startedAt: now, completedAt: now };
  }
  const runWins = run.stars !== previous.stars ? run.stars > previous.stars : run.accuracy > previous.accuracy;
  const best = runWins ? run : previous;
  return {
    questId: run.questId,
    episodeId: run.episodeId,
    startedAt: previous.startedAt < now ? previous.startedAt : now,
    completedAt: previous.completedAt && previous.completedAt > now ? previous.completedAt : now,
    stars: best.stars,
    accuracy: best.accuracy,
    attempts: previous.attempts + run.attempts,
  };
}
