import type { JamoStrokePoint } from '../../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../stroke-scoring';
import { createTraceEvaluator, type TraceEvaluator, type TraceScheduler } from '../trace-evaluator';
import { directionNudgeFor, type DirectionNudge } from '../trace-copy';
import type { BlockRect, PlacedLetter } from './block-strokes';

/**
 * Trace a Word evaluation (wireframe minigame/trace-word.md): the shipped `scoreTrace` at the
 * shipped coverage threshold, with the order and direction checks on. This is the relaxed
 * tolerance: order and direction only choose a coaching line, they never fail a block. In
 * block mode the idle timer waits until every letter of the block has ink, so a pause to look
 * at the next letter's ghost never scores a half-drawn block. Pure.
 */

export interface TraceUnitResult {
  passed: boolean;
  coverage: number;
  orderCorrect: boolean | null;
  directionNudge: DirectionNudge;
}

/**
 * Score one unit against its placed letters (a whole block, or one letter in letter mode).
 * Coverage is measured letter by letter and **every** letter must reach the shipped threshold:
 * the block-wide average of `scoreTrace` weighs a letter by its stroke count, so ㅎ alone (three
 * strokes) would carry the block `ho` past 0.65 with ㅗ barely touched (open question 2 of the wireframe).
 * Order and direction are read over the whole unit, in writing order.
 */
export function scoreTraceUnit(letters: JamoStrokePoint[][][], drawn: JamoStrokePoint[][], tolerance?: number): TraceUnitResult {
  const tol = tolerance === undefined ? {} : { tolerance };
  const whole = scoreTrace({ target: letters.flat(), drawn, ...tol, checkOrder: true, checkDirection: true });
  const perLetter = letters.map((target) => scoreTrace({ target, drawn, ...tol }).coverage);
  const coverage = perLetter.length > 0 ? Math.min(...perLetter) : 0;
  return {
    passed: coverage >= DEFAULT_PASS_THRESHOLD,
    coverage,
    orderCorrect: whole.orderCorrect ?? null,
    directionNudge: directionNudgeFor({
      ...whole,
      directionsPerTarget: whole.directionsPerTarget?.map((ok, i) => ok || strokeLength(letters.flat()[i]!) < SHORT_STROKE),
    }),
  };
}

/**
 * A placed stroke shorter than this (viewBox units; ㅎ's top tick at block size is about 12) is
 * a few pixels of finger travel, too short for its direction to be read, so it never earns a
 * direction coaching line.
 */
export const SHORT_STROKE = 20;

function strokeLength(stroke: JamoStrokePoint[]): number {
  let total = 0;
  for (let i = 1; i < stroke.length; i++) total += Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y);
  return total;
}

/** A drawn point this close outside a zone still counts as in it (a finger overshoots). */
export const INK_MARGIN = 12;
/** A stroke inks a letter when more than this share of its points falls in the letter's zones. */
export const INK_SHARE = 0.5;

const inside = (p: JamoStrokePoint, z: BlockRect): boolean =>
  p.x >= z.x - INK_MARGIN && p.x <= z.x + z.width + INK_MARGIN && p.y >= z.y - INK_MARGIN && p.y <= z.y + z.height + INK_MARGIN;

/** Whether one of the strokes was drawn mostly inside the letter's zones. */
export function letterHasInk(letter: Pick<PlacedLetter, 'zones'>, strokes: readonly JamoStrokePoint[][]): boolean {
  return strokes.some((stroke) => {
    if (stroke.length === 0) return false;
    const hits = stroke.filter((p) => letter.zones.some((z) => inside(p, z))).length;
    return hits / stroke.length > INK_SHARE;
  });
}

/** Block mode's idle gate: every letter of the block has ink. */
export function everyLetterInked(letters: readonly Pick<PlacedLetter, 'zones'>[], strokes: readonly JamoStrokePoint[][]): boolean {
  return letters.length > 0 && letters.every((letter) => letterHasInk(letter, strokes));
}

/**
 * The shared Done / idle gate of `trace-evaluator`, with one change: a finger lift starts the
 * idle countdown only when `ready()` (block mode: every letter inked; letter mode: always).
 * Before that, a pause never evaluates; Done still does at any time.
 */
export function createTraceWordGate({
  idleMs,
  onEvaluate,
  ready,
  scheduler,
}: {
  idleMs: number;
  onEvaluate: () => void;
  ready: () => boolean;
  scheduler?: TraceScheduler;
}): TraceEvaluator {
  const gate = createTraceEvaluator({ idleMs, onEvaluate, ...(scheduler ? { scheduler } : {}) });
  return {
    ...gate,
    strokeEnded: () => {
      if (ready()) gate.strokeEnded();
      else gate.clear();
    },
  };
}
