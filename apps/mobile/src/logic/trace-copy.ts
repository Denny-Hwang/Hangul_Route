import type { ScoreTraceResult } from './stroke-scoring';

/**
 * Trace Stroke feedback copy (F-005 / F-006 / F-008). Plain strings, pure
 * functions, so the wording rules are unit-tested.
 *
 * Coverage is the pass criterion; order and direction are auxiliary and only
 * surface as gentle "next time" nudges when the child PASSED.
 */

/**
 * Which direction nudge, if any, a pass earns:
 * - `open`: an open stroke (a line, a tick) ran the wrong way, so "left to right" applies.
 * - `loop`: only closed loops (ㅁ ㅇ ㅎ) went round the other way. A loop has no
 *   left-to-right, so it must never get that hint.
 * - `none`: nothing to say.
 * An open-stroke mismatch wins over a loop one, because it is the more actionable.
 */
export type DirectionNudge = 'none' | 'open' | 'loop';

export function directionNudgeFor(
  result: Pick<ScoreTraceResult, 'directionsPerTarget' | 'closedPerTarget'>,
): DirectionNudge {
  const dirs = result.directionsPerTarget;
  if (!dirs) return 'none';
  const closed = result.closedPerTarget ?? [];
  let loopWrong = false;
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i]) continue;
    if (closed[i]) loopWrong = true;
    else return 'open';
  }
  return loopWrong ? 'loop' : 'none';
}

export function passMessage(orderCorrect: boolean | null, nudge: DirectionNudge): string {
  if (orderCorrect === false) {
    return 'You got it! Next time, try drawing the top line first.';
  }
  if (nudge === 'open') {
    return 'Nice! Try drawing left-to-right next time.';
  }
  if (nudge === 'loop') {
    return 'Nice! Next time, try going around the other way.';
  }
  return 'Beautiful! That looks like the letter.';
}

/**
 * F-008 — fail message branches. When strict mode is on AND order was the
 * only thing wrong (coverage passed), use the order-coaching message.
 * Otherwise use the standard "try again — start at the top!".
 */
export function failMessage(strictMode: boolean, orderCorrect: boolean | null): string {
  if (strictMode && orderCorrect === false) {
    return 'Almost! Try drawing the strokes in the right order. Tap Show me to see.';
  }
  return 'Try again — start at the top!';
}
