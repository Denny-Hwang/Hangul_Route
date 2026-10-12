import type { Messages } from '@hangul-route/i18n';
import type { RoundStars } from './stars';

/**
 * Hoya's encouraging lines in the Speed Round (F-VOC-004 §3.7, D3). Pure.
 * The words are `learner.vocab.speed` (packages/i18n), passed in by the
 * screen so they follow the UI locale.
 *
 * A right answer cheers (at 3, 5, 8 and 10 sparks with a milestone line), a
 * miss gets Hoya `thinking` and the right word, never a count of misses, a
 * lost spark, a streak, combo or lives, a percentage, an age or a comparison
 * with anyone. Each set is rotated by `sparks + seed`, where `seed` is the
 * number of answers already given: two right answers in a row move the
 * rotation by 2 over a set of 3, two misses in a row by 1 over a set of 2, so
 * the same line never plays twice in a row.
 */

export type VocabSpeedCopy = Messages['learner']['vocab']['speed'];

/** The Hoya poses the round uses (no new pose is added, §8 item 9). */
export type NudgePose = 'idle' | 'cheering' | 'thinking';

export interface Nudge {
  pose: NudgePose;
  line: string;
}

export type NudgeEvent =
  /** `gloss`: the word's meaning in the UI language. */
  | { kind: 'right'; gloss: string }
  | { kind: 'miss'; gloss: string }
  /** 12 s on one question, Relaxed only. */
  | { kind: 'idle' }
  | { kind: 'start' }
  | { kind: 'results'; stars: RoundStars; firstTryCorrect: number };

/** Spark counts that get a milestone line instead of the right-answer line. */
export const SPARK_MILESTONES = [3, 5, 8, 10] as const;

const wholeOr0 = (n: number): number => (Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0);

function milestoneLine(sparks: number, copy: VocabSpeedCopy): string | null {
  const m = copy.nudge.milestone;
  switch (sparks) {
    case 3:
      return m.three;
    case 5:
      return m.five;
    case 8:
      return m.eight;
    case 10:
      return m.ten;
    default:
      return null;
  }
}

function resultsNudge(stars: RoundStars, firstTryCorrect: number, copy: VocabSpeedCopy): Nudge {
  const r = copy.nudge.results;
  if (firstTryCorrect <= 0) return { pose: 'thinking', line: r.firstStar };
  if (stars === 3) return { pose: 'cheering', line: r.three };
  if (stars === 2) return { pose: 'cheering', line: r.two };
  return { pose: 'idle', line: r.one };
}

/** One Hoya line for `event`; `sparks` is the meter after the answer, `seed` the answers already given. */
export function nudgeFor(event: NudgeEvent, sparks: number, seed: number, copy: VocabSpeedCopy): Nudge {
  const turn = wholeOr0(sparks) + wholeOr0(seed);
  const n = copy.nudge;
  switch (event.kind) {
    case 'right': {
      const milestone = milestoneLine(wholeOr0(sparks), copy);
      if (milestone !== null) return { pose: 'cheering', line: milestone };
      const lines = [...n.right.lines, n.right.named(event.gloss)];
      return { pose: 'cheering', line: lines[turn % lines.length]! };
    }
    case 'miss': {
      const lines = [n.miss.first(event.gloss), n.miss.second(event.gloss)];
      return { pose: 'thinking', line: lines[turn % lines.length]! };
    }
    case 'idle':
      return { pose: 'idle', line: n.idle };
    case 'start':
      return { pose: 'idle', line: n.start };
    case 'results':
      return resultsNudge(event.stars, event.firstTryCorrect, copy);
  }
}
