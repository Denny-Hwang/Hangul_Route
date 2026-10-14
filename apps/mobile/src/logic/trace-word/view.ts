import type { Messages } from '@hangul-route/i18n';
import { passMessage, type DirectionNudge } from '../trace-copy';
import { traceCanvasSize } from '../trace-layout';
import type { TraceWordPhase } from './flow';
import type { TraceWordMode } from './rounds';

/**
 * What the Trace a Word screen shows (wireframe minigame/trace-word.md): Hoya's line for each
 * phase, and how many canvases fit. Pure, over the `learner.minigame` messages.
 */

export type TraceWordCopy = Pick<Messages['learner']['minigame'], 'trace' | 'traceWord'>;
export type TraceWordTone = 'idle' | 'cheering' | 'thinking';

export interface TraceWordCoaching {
  orderCorrect: boolean | null;
  directionNudge: DirectionNudge;
}

const coaches = (c: TraceWordCoaching | null): c is TraceWordCoaching =>
  c !== null && (c.orderCorrect === false || c.directionNudge !== 'none');

/**
 * Hoya's line. A pass with an order or direction slip gets Trace Stroke's coaching line (it
 * never fails the block); a clean block pass says the block is done; the last block says the
 * word is whole. A unit that did not pass gets the retry line, never a "wrong".
 */
export function traceWordMessage(phase: TraceWordPhase, mode: TraceWordMode, coaching: TraceWordCoaching | null, copy: TraceWordCopy): string {
  switch (phase) {
    case 'retry':
      return copy.trace.retry.start;
    case 'letterDone':
      return passMessage(coaching?.orderCorrect ?? null, coaching?.directionNudge ?? 'none', copy.trace);
    case 'blockDone':
      return coaches(coaching) ? passMessage(coaching.orderCorrect, coaching.directionNudge, copy.trace) : copy.traceWord.blockDone;
    case 'wordDone':
    case 'finished':
      return copy.traceWord.wordDone;
    default:
      return mode === 'letter' ? copy.traceWord.letterIdle : copy.traceWord.idle;
  }
}

export function traceWordTone(phase: TraceWordPhase): TraceWordTone {
  if (phase === 'retry') return 'thinking';
  return phase === 'drawing' ? 'idle' : 'cheering';
}

/** Two blocks show side by side only when each canvas still gets this much (Trace Stroke's roomy floor). */
export const TRACE_WORD_PAIR_MIN = 240;

/**
 * One canvas, or both blocks of a two-block word side by side (a tablet: each at least
 * `TRACE_WORD_PAIR_MIN`, never in the `side` layout). A phone and a one-block word keep one.
 */
export function traceWordCanvases({
  blocks,
  slotWidth,
  slotHeight,
  max,
  gap,
  side,
}: {
  blocks: number;
  slotWidth: number;
  slotHeight: number;
  max: number;
  gap: number;
  side: boolean;
}): { count: 1 | 2; size: number } {
  if (blocks === 2 && !side) {
    const pair = Math.floor(Math.min(max, (slotWidth - gap) / 2, slotHeight));
    if (pair >= TRACE_WORD_PAIR_MIN) return { count: 2, size: pair };
  }
  return { count: 1, size: traceCanvasSize(slotWidth, slotHeight, max) };
}
