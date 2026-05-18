/**
 * Star calculation (F-001 §3.1):
 *   5/5 → 3 stars · 3-4/5 → 2 stars · 1-2/5 → 1 star · 0/5 → 0 stars
 * Generalized to any round count via accuracy thresholds.
 */
export function starsForAccuracy(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const acc = correct / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.6) return 2;
  if (acc >= 0.2) return 1;
  return 0;
}

export function accuracy(correct: number, total: number): number {
  if (total <= 0) return 0;
  return correct / total;
}
