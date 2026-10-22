import { episodeById } from '../../content';
import { memoryRecordsFor } from '../../logic/memory/boot';
import { stageNumber, tryAgainOffered, warmupOffered } from '../../logic/reviews/quest-review-gate';
import type { QuestReviewPlan } from '../../logic/reviews/quest-review-session';
import { currFlagOn } from '../../store/remote-config-store';

/**
 * The quest warm-up and Try these again in the start bundle (F-CURR-002 section 4.5, row CM-15): only the two
 * gates, the loader and the hand-over to Results. The sessions and the round view are one chunk of their own
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

/**
 * Starts loading the chunk and what its planner reads (the memory store's chunk and the review items) when either
 * session may show for this learner, so the warm-up's plan is in before its 1.5 s and the reward step's in 0.8 s.
 * Called by the lesson page and the quest player; with both switches off it loads nothing.
 */
export function preloadQuestReviews(profileId: string | null): void {
  if (profileId === null || !memoryRecordsFor(profileId)) return;
  if (!currFlagOn('questWarmup', profileId) && !currFlagOn('missedPractice', profileId)) return;
  questReviewChunk()
    .then((chunk) => chunk.preloadQuestReviews(profileId))
    .catch(() => undefined);
}

/**
 * Try these again, chosen on the reward step, runs on Results after it has written the quest's score and card
 * (section 4.5, row CM-15), so closing the app during it never loses the quest. The player hands the planned session
 * over here; Results takes it once, for the same quest and learner and only within a moment.
 */
export interface TryAgainHandoff {
  questId: string;
  profileId: string;
  chunk: QuestReviewChunk;
  plan: QuestReviewPlan;
}
const HANDOFF_MS = 10_000;
let handoff: (TryAgainHandoff & { at: number }) | null = null;

export function handTryAgainToResults(session: TryAgainHandoff): void {
  handoff = { ...session, at: Date.now() };
}

/** The session handed over for this Results visit, or null. It stays until `clearTryAgainHandoff`. */
export function peekTryAgainHandoff(questId: string, profileId: string | undefined): TryAgainHandoff | null {
  const held = handoff;
  if (!held || held.questId !== questId || held.profileId !== profileId || Date.now() - held.at > HANDOFF_MS) return null;
  return held;
}

export function clearTryAgainHandoff(): void {
  handoff = null;
}

/** Tests only: forget the loaded chunk and any handed-over session. */
export function resetQuestReviewChunkForTests(): void {
  loading = null;
  handoff = null;
}
