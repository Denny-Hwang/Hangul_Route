import { episodeById } from '../../content';
import { memoryRecordsFor } from '../../logic/memory/boot';
import { stageNumber, tryAgainOffered, warmupOffered } from '../../logic/reviews/quest-review-gate';
import { currFlagOn } from '../../store/remote-config-store';

/**
 * The quest warm-up and Try these again in the start bundle (F-CURR-002 section 4.5, row CM-15): only the two
 * gates and the loader. The sessions, the review engine and the round view are one chunk of their own
 * (`./quest-review-chunk.tsx`), reached only through the literal `import()` below, so the start bundle does not
 * grow by them, and with `questWarmup` and `missedPractice` off (built-in pct 0 until the ramp) the chunk never
 * loads and the quest plays as it always did.
 */

export type QuestReviewChunk = typeof import('./quest-review-chunk');

let loading: Promise<QuestReviewChunk> | null = null;

/** The chunk, loaded once (and again after a failed load). */
export function questReviewChunk(): Promise<QuestReviewChunk> {
  loading ??= import('./quest-review-chunk').catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Whether this learner's quest may open with a warm-up: `questWarmup` and `memoryRecord` on, a Stage 2+ quest from its first step. */
export function warmupWanted(profileId: string | null, episodeId: string, startStep: number): profileId is string {
  if (profileId === null) return false;
  return warmupOffered({
    flagOn: currFlagOn('questWarmup', profileId),
    records: memoryRecordsFor(profileId),
    stage: stageNumber(episodeById(episodeId)?.stage),
    startStep,
  });
}

/** Whether the reward step may offer Try these again: `missedPractice` and `memoryRecord` on, and a first-try miss in this play. */
export function tryAgainWanted(profileId: string | null, misses: number): profileId is string {
  if (profileId === null) return false;
  return tryAgainOffered({ flagOn: currFlagOn('missedPractice', profileId), records: memoryRecordsFor(profileId), misses });
}

/** Tests only: forget the loaded chunk. */
export function resetQuestReviewChunkForTests(): void {
  loading = null;
}
