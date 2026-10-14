import type { SbRound, SbTile } from './progression';

/**
 * Sentence Builder scoring (F-CURR-001 §3.11; wireframe minigame/sentence-builder.md,
 * "Interaction points"): the F-001 §3.2 "first answer only" rule applied to a whole
 * sentence. A round is right first time when it was built without a miss; its first miss is
 * its answer. Exactly one scored answer per round: the first miss (`false`), or completion
 * when there was none (`true`). Later misses are reported too, as retries under the same round
 * key (the host scores only the first, `logic/first-try.ts`); the look-here ring and the taps
 * that finish a missed round report nothing, so none of them move the Check result, skills or
 * review.
 */

export interface RoundScore {
  /** The round's one answer has been recorded. */
  recorded: boolean;
  /** Misses in this round (shown to no one; never a count on screen). */
  misses: number;
}

export const FRESH_SCORE: RoundScore = { recorded: false, misses: 0 };

/** Whether `tile` belongs in the next open slot: the word it holds there, or the particle that ends the word. */
export function isRightTile(round: SbRound, filled: number, tile: SbTile): boolean {
  if (round.particle) return tile.ko === round.particle.answer;
  const word = round.open[filled];
  return word !== undefined && tile.id.startsWith('w') && tile.ko === round.words[word]?.ko;
}

export interface Scored {
  score: RoundScore;
  /** The answer to record now, or null when the round's answer is already recorded. */
  record: boolean | null;
}

/** A miss: the round's first one is its scored answer (`false`); a later one is a retry (`record` null). */
export function scoreMiss(score: RoundScore): Scored {
  return { score: { recorded: true, misses: score.misses + 1 }, record: score.recorded ? null : false };
}

/** The sentence is built: `true` when nothing was recorded yet (no miss), else nothing. */
export function scoreComplete(score: RoundScore): Scored {
  return { score: { ...score, recorded: true }, record: score.recorded ? null : true };
}
