/**
 * First-try round scoring — F-001 §3.2, F-003 §3.2 (audit UX-02).
 *
 * A round is scored once, on the learner's first answer: right first time
 * is a correct round, wrong first time is a missed round. Every later
 * answer in that round (the re-tap F-001 §3.2 allows) is a retry. A retry
 * never adds a round and never changes the score, so a child who needs a
 * few taps on one letter loses at most that one round — not the card.
 * Retries are counted on their own for analytics.
 */
export interface RoundTally {
  /** Rounds answered right on the first try. */
  correct: number;
  /** Rounds answered at least once. */
  total: number;
  /** Answers given after a round's first answer. */
  retries: number;
  /** Keys of the rounds already scored, in the order they were first answered. */
  scored: readonly string[];
}

export const EMPTY_TALLY: RoundTally = { correct: 0, total: 0, retries: 0, scored: [] };

export function tallyAnswer(tally: RoundTally, roundKey: string, correct: boolean): RoundTally {
  if (tally.scored.includes(roundKey)) {
    return { ...tally, retries: tally.retries + 1 };
  }
  return {
    correct: tally.correct + (correct ? 1 : 0),
    total: tally.total + 1,
    retries: tally.retries,
    scored: [...tally.scored, roundKey],
  };
}
