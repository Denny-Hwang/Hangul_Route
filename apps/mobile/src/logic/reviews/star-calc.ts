/**
 * Review star math (F-RVW-001 §3.1): K of N right on the first try. 80 % or more is 3 stars,
 * 50 % or more is 2, anything else is 1. Never 0 stars, also for 0 of N or an empty attempt.
 * Pure; the learner only ever sees the stars, never K, N or a percent.
 */
export function reviewStars(correct: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const ratio = correct / total;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}
