import type { Messages } from '@hangul-route/i18n';
import { passMessage, type DirectionNudge } from '../trace-copy';
import { TRACE_CANVAS_MIN, traceCanvasSize, type TraceLayoutMode } from '../trace-layout';
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

/**
 * AMENDMENTS-TRACE-IDLE §3.4 (TI-3): a letter or block pass whose line is a coaching tip waits for
 * Next, so the tip can be read; a clean pass and the word-done view move on by themselves.
 */
export function traceWordWaitsForNext(phase: TraceWordPhase, coaching: TraceWordCoaching | null): boolean {
  return (phase === 'letterDone' || phase === 'blockDone') && coaches(coaching);
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

/** A stacked content box shorter than this cannot fit the helpers' own row over Done and Skip (a 320 x 568 phone). */
export const TRACE_WORD_SHORT_HEIGHT = 500;

/**
 * [AU] On a short phone the row of Show me and Clear left the canvas slot shorter than the canvas
 * floor, so the two buttons lay over the canvas's lower edge and took the strokes drawn there
 * (AMENDMENTS-AUDIT-2026-11 AU-14: a letter's own bottom bar is drawn at that edge). There the two
 * helpers stand beside the canvas, in the width the canvas floor leaves. `null` keeps their row.
 */
export function traceWordHelperColumn({ mode, width, height, gap }: { mode: TraceLayoutMode; width: number; height: number; gap: number }): number | null {
  if (mode !== 'compact' || height >= TRACE_WORD_SHORT_HEIGHT) return null;
  return Math.max(0, Math.floor(width - TRACE_CANVAS_MIN - gap));
}
