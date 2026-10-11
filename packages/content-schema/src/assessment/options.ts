import type { AssessmentOption } from './question';
import { shuffleSeeded } from './rng';

/** How likely the correct option is to be moved off the first slot when it lands there (avoidFirst). */
const MOVE_OFF_FIRST = 0.5;

/**
 * Shuffles `options` and places the correct one.
 *
 * - `avoidFirst` (default true): when the correct option lands first it is moved
 *   to another slot half of the time, so over any 200 seeds it is first in well
 *   under 35 percent of cases (it is not "never first", which a guesser could use).
 * - `recentIndexes` (optional, additive to the spec signature): the slots the
 *   correct option took in the questions before this one in the same run; the
 *   same slot is never used a third time in a row.
 *
 * Pure: the input is not changed. Throws unless exactly one option is correct.
 */
export const placeCorrect = (
  options: readonly AssessmentOption[],
  rng: () => number,
  avoidFirst = true,
  recentIndexes: readonly number[] = [],
): AssessmentOption[] => {
  if (options.filter((o) => o.isCorrect).length !== 1) {
    throw new RangeError('placeCorrect needs exactly one correct option');
  }
  const out = shuffleSeeded(options, rng);
  const at = out.findIndex((o) => o.isCorrect);
  const last = recentIndexes[recentIndexes.length - 1];
  const barred = last !== undefined && last === recentIndexes[recentIndexes.length - 2] ? last : -1;

  let target = at;
  const leaveFirst = avoidFirst && at === 0 && rng() < MOVE_OFF_FIRST;
  if (leaveFirst || at === barred) {
    const allowed: number[] = [];
    for (let i = 0; i < out.length; i += 1) if (i !== at && i !== barred) allowed.push(i);
    const preferred = avoidFirst ? allowed.filter((i) => i !== 0) : allowed;
    const pool = preferred.length > 0 ? preferred : allowed;
    target = pool.length > 0 ? (pool[Math.floor(rng() * pool.length)] as number) : at;
  }
  if (target !== at) {
    const tmp = out[at] as AssessmentOption;
    out[at] = out[target] as AssessmentOption;
    out[target] = tmp;
  }
  return out;
};
