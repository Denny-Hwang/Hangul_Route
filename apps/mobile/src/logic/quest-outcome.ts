import { starsForAccuracy } from './score';

/**
 * Turn a quest run's raw counters into the payload the results screen
 * receives. A run where no minigame round was recorded (every game skipped)
 * is an honest 0 / 0 → 0 stars, never a synthetic perfect score.
 */
function cappedStars(stars: 0 | 1 | 2 | 3, cap: 1 | 2 | 3): 0 | 1 | 2 | 3 {
  return stars > cap ? cap : stars;
}

export interface QuestOutcome {
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
  /** false when no round was played — results should not celebrate. */
  played: boolean;
}

/**
 * [AU] `cap` is the most stars the run may earn (AMENDMENTS-AUDIT-2026-11 row AU-9, `quest-flow/skip-cap.ts`): 2 when a
 * game step was skipped, 1 when every game step was. It only lowers the stars; the counts stay what was played.
 */
export function questOutcome(correct: number, total: number, cap: 1 | 2 | 3 = 3): QuestOutcome {
  const safeTotal = Math.max(0, total);
  const safeCorrect = Math.min(Math.max(0, correct), safeTotal);
  if (safeTotal === 0) {
    return { stars: 0, correct: 0, total: 0, played: false };
  }
  return {
    stars: cappedStars(starsForAccuracy(safeCorrect, safeTotal), cap),
    correct: safeCorrect,
    total: safeTotal,
    played: true,
  };
}
