import type { Messages } from '@hangul-route/i18n';
import type { ScoreTraceResult } from './stroke-scoring';

/**
 * Trace Stroke feedback rules (F-005 / F-006 / F-008). Pure functions over the
 * `learner.minigame.trace` messages (F-I18N-001 PR 7b), so the wording rules are
 * unit-tested per locale.
 *
 * Coverage is the pass criterion; order and direction are auxiliary and only
 * surface as gentle "next time" nudges when the child PASSED.
 */

/**
 * Which direction nudge, if any, a pass earns:
 * - `open`: an open stroke (a line, a tick) ran the wrong way, so "left to right" applies.
 * - `loop`: only closed loops (ㅇ, ㅎ's ring) went round the other way. A loop has no
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

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.2: the direction nudge of a letter whose stroke order nobody has checked yet,
 * read over the circles only. `'loop'` when a closed target (ㅇ, ㅎ's ring) went round the other way; open targets
 * (bars, ticks) are ignored, matched or not, so it never returns `'open'`: a learner taught another stroke count or
 * top-stroke form never hears "left-to-right".
 */
export function loopNudgeFor(
  result: Pick<ScoreTraceResult, 'directionsPerTarget' | 'closedPerTarget'>,
): DirectionNudge {
  const dirs = result.directionsPerTarget;
  if (!dirs) return 'none';
  const closed = result.closedPerTarget ?? [];
  return dirs.some((ok, i) => !ok && closed[i] === true) ? 'loop' : 'none';
}

/** What a scored drawing coaches: the order (null: say nothing) and the direction nudge. */
export interface TraceCoaching {
  orderCorrect: boolean | null;
  directionNudge: DirectionNudge;
}

/**
 * [SO] §3.2: a taught letter coaches its order and directions as before; an untaught one gets no order coaching
 * (`orderCorrect` null) and only the loop nudge.
 */
export function traceCoaching(
  result: Pick<ScoreTraceResult, 'orderCorrect' | 'directionsPerTarget' | 'closedPerTarget'>,
  taught: boolean,
): TraceCoaching {
  return taught
    ? { orderCorrect: result.orderCorrect ?? null, directionNudge: directionNudgeFor(result) }
    : { orderCorrect: null, directionNudge: loopNudgeFor(result) };
}

export type TraceCopy = Messages['learner']['minigame']['trace'];

export function passMessage(orderCorrect: boolean | null, nudge: DirectionNudge, copy: TraceCopy): string {
  if (orderCorrect === false) return copy.pass.order;
  if (nudge === 'open') return copy.pass.open;
  if (nudge === 'loop') return copy.pass.loop;
  return copy.pass.clean;
}

/**
 * F-008 — fail message branches. When strict mode is on AND order was the
 * only thing wrong (coverage passed), use the order-coaching message.
 * Otherwise use the standard "try again — start at the top!".
 */
export function failMessage(strictMode: boolean, orderCorrect: boolean | null, copy: TraceCopy): string {
  return strictMode && orderCorrect === false ? copy.retry.order : copy.retry.start;
}
