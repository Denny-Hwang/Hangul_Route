import { starsForAccuracy } from './score';

/**
 * Turn a quest run's raw counters into the payload the results screen
 * receives. A run where no minigame round was recorded (every game skipped)
 * is an honest 0 / 0 → 0 stars, never a synthetic perfect score.
 */
export interface QuestOutcome {
  stars: 0 | 1 | 2 | 3;
  correct: number;
  total: number;
  /** false when no round was played — results should not celebrate. */
  played: boolean;
}

export function questOutcome(correct: number, total: number): QuestOutcome {
  const safeTotal = Math.max(0, total);
  const safeCorrect = Math.min(Math.max(0, correct), safeTotal);
  if (safeTotal === 0) {
    return { stars: 0, correct: 0, total: 0, played: false };
  }
  return {
    stars: starsForAccuracy(safeCorrect, safeTotal),
    correct: safeCorrect,
    total: safeTotal,
    played: true,
  };
}
