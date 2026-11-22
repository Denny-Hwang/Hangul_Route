import type { JamoStrokePoint } from '../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, scoreTrace, type ScoreTraceResult } from './stroke-scoring';

/**
 * AMENDMENTS-TRACE-IDLE §3.1: when a trace drawing is finished enough for the idle countdown.
 *
 * Coverage alone is not "finished": coverage is the mean of per-target-stroke recall, so ㅂ's first
 * two strokes already reach the pass threshold. The idle gate also waits until every target stroke
 * has ink at `TRACE_READY_STROKE_MIN`. This is a gate rule, not a pass rule: Done still scores any
 * drawing with `wouldPass`.
 */
export const TRACE_READY_STROKE_MIN = 0.8;

/** The one pass rule (F-008): strict mode needs coverage and order, otherwise coverage alone. */
export function wouldPass(result: Pick<ScoreTraceResult, 'coverage' | 'passWithOrder'>, strictMode: boolean): boolean {
  return strictMode ? result.passWithOrder === true : result.coverage >= DEFAULT_PASS_THRESHOLD;
}

/** The drawing would pass and every target stroke is covered to the floor. */
export function isFinished(
  result: Pick<ScoreTraceResult, 'coverage' | 'passWithOrder' | 'perStrokeCoverage'>,
  strictMode: boolean,
): boolean {
  return wouldPass(result, strictMode) && result.perStrokeCoverage.every((c) => c >= TRACE_READY_STROKE_MIN);
}

/** `isFinished` of a drawing against one letter's strokes. */
export function isLetterFinished(
  target: readonly JamoStrokePoint[][],
  drawn: readonly JamoStrokePoint[][],
  strictMode: boolean,
): boolean {
  return isFinished(scoreTrace({ target: [...target], drawn: [...drawn], checkOrder: strictMode }), strictMode);
}
