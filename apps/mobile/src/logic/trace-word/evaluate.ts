import type { JamoStrokePoint } from '../../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../stroke-scoring';
import { createTraceEvaluator, type TraceEvaluator, type TraceScheduler } from '../trace-evaluator';
import { directionNudgeFor, type DirectionNudge } from '../trace-copy';
import type { BlockRect, PlacedLetter } from './block-strokes';

/**
 * Trace a Word evaluation (wireframe minigame/trace-word.md): the shipped `scoreTrace` at the
 * shipped coverage threshold, at a tolerance scaled to block size and with per-letter stroke,
 * precision and outline checks, plus the order and direction checks. Order and direction
 * only choose a coaching line, they never fail a block. In
 * block mode the idle timer waits until every letter of the block has ink, so a pause to look
 * at the next letter's ghost never scores a half-drawn block. Pure.
 */

export interface TraceUnitResult {
  passed: boolean;
  coverage: number;
  orderCorrect: boolean | null;
  directionNudge: DirectionNudge;
}

/** A letter of the unit to score: its placed strokes, and the letter itself (for the loop check). */
export type UnitLetter = Pick<PlacedLetter, 'strokes'> & Partial<Pick<PlacedLetter, 'char'>>;

/**
 * The coverage tolerance at block size (viewBox units). The shipped 24 was set for one letter
 * on the whole 200 canvas; a letter in a block is drawn about half as large, so 24 let a
 * near-miss letter (가 traced as 기, 야 as 여) cover the target. 12 still passes every Stage 7
 * block traced 6 units off the line, or drawn 10 % larger or smaller than the ghost
 * (F-CURR-001 §9 assumption 3; wireframe open question 2). A round's own `tolerancePx` wins.
 */
export const BLOCK_TOLERANCE = 12;
/** Every target stroke must be at least this covered: a left-out stroke (ㅏ's tick) fails the unit. */
export const STROKE_FLOOR = 0.5;
/**
 * Precision: of the drawn points nearest each letter, at least this share must lie within the
 * tolerance of that letter. Coverage alone only asks whether the target was drawn over, so a
 * stray or extra stroke (ㅂ drawn for ㅁ, ㅌ for ㄷ, ㅇ with a cap for ㅇ) cost nothing.
 */
export const PRECISION_THRESHOLD = 0.9;
/**
 * Precision reads the ink with this much more slack than coverage (12 x 1.25 = 15 units at
 * block size): a careful trace drawn a little off and a little small still holds every point.
 */
export const PRECISION_SLACK = 1.25;
/**
 * Every drawn stroke longer than `STRAY_MIN_LENGTH` must lie mostly on the unit's ghost: at
 * least this share of its points within the precision distance. One extra stroke is a small
 * part of a letter's ink (ㅌ's middle bar drawn for ㄷ), so the letter's precision alone misses it.
 */
export const STROKE_ON_TARGET = 0.6;
/** A drawn stroke shorter than this (a tap, a slip of the finger) is not judged on its own. */
export const STRAY_MIN_LENGTH = 6;
/**
 * ㅁ and ㅇ squashed into a final's zone lie within a few units of each other everywhere, so
 * no tolerance a learner can meet tells them apart. Their outlines can: the convex hull of a
 * square fills its bounding box, a ring about 0.8 of it. A drawn ㅁ or ㅇ must fill its box
 * on the target's side of this line.
 */
export const LOOP_FILL_SPLIT = 0.88;

/**
 * Score one unit against its placed letters (a whole block, or one letter in letter mode).
 * Every check is per letter and every letter must pass it:
 * - coverage: the shipped 0.65 threshold at `BLOCK_TOLERANCE` (the block-wide average of
 *   `scoreTrace` weighs a letter by its stroke count, so ㅎ alone, three strokes, would carry
 *   the block `ho` past 0.65 with ㅗ barely touched);
 * - every target stroke at least `STROKE_FLOOR` covered;
 * - precision: the ink nearest the letter lies on it (`PRECISION_THRESHOLD`), and no drawn
 *   stroke lies mostly off the ghost (`STROKE_ON_TARGET`);
 * - ㅁ against ㅇ: the outline's fill (`LOOP_FILL_SPLIT`).
 * Order and direction are read over the whole unit, in writing order, and only choose a
 * coaching line.
 */
export function scoreTraceUnit(letters: readonly UnitLetter[], drawn: JamoStrokePoint[][], tolerance: number = BLOCK_TOLERANCE): TraceUnitResult {
  const target = letters.flatMap((l) => l.strokes);
  const whole = scoreTrace({ target, drawn, tolerance, checkOrder: true, checkDirection: true });
  const perLetter = letters.map((l) => scoreTrace({ target: l.strokes, drawn, tolerance }));
  const coverage = perLetter.length > 0 ? Math.min(...perLetter.map((r) => r.coverage)) : 0;
  const strokesHeld = perLetter.every((r) => r.perStrokeCoverage.every((c) => c >= STROKE_FLOOR));
  const nearest = inkByLetter(letters, drawn);
  const reach = tolerance * PRECISION_SLACK;
  const precise =
    letters.every((l, i) => precisionOf(nearest[i]!, l.strokes, reach) >= PRECISION_THRESHOLD) &&
    drawn.every((stroke) => strokeLength(stroke) < STRAY_MIN_LENGTH || precisionOf(stroke, target, reach) >= STROKE_ON_TARGET);
  const loopsRight = letters.every((l, i) => loopMatches(l, nearest[i]!));
  return {
    passed: coverage >= DEFAULT_PASS_THRESHOLD && strokesHeld && precise && loopsRight,
    coverage,
    orderCorrect: whole.orderCorrect ?? null,
    directionNudge: directionNudgeFor({
      ...whole,
      directionsPerTarget: whole.directionsPerTarget?.map((ok, i) => ok || strokeLength(target[i]!) < SHORT_STROKE),
    }),
  };
}

/** Distance from a point to the nearest segment of the strokes. */
export function distanceToStrokes(p: JamoStrokePoint, strokes: readonly JamoStrokePoint[][]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const s of strokes) {
    if (s.length === 1) best = Math.min(best, Math.hypot(p.x - s[0]!.x, p.y - s[0]!.y));
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]!;
      const b = s[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
  }
  return best;
}

/** Each drawn point given to the letter whose strokes it lies nearest. */
function inkByLetter(letters: readonly UnitLetter[], drawn: readonly JamoStrokePoint[][]): JamoStrokePoint[][] {
  const out: JamoStrokePoint[][] = letters.map(() => []);
  if (letters.length === 0) return out;
  for (const p of drawn.flat()) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    letters.forEach((l, i) => {
      const d = distanceToStrokes(p, l.strokes);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    out[best]!.push(p);
  }
  return out;
}

/** The share of the points within `tolerance` of the strokes (1 when there are none: coverage fails that letter). */
function precisionOf(points: readonly JamoStrokePoint[], strokes: readonly JamoStrokePoint[][], tolerance: number): number {
  if (points.length === 0) return 1;
  return points.filter((p) => distanceToStrokes(p, strokes) <= tolerance).length / points.length;
}

const LOOP_LETTERS = new Set(['ㅁ', 'ㅇ']);

/** How much of its bounding box the convex hull of the points fills (0 for a line or fewer than 3 points). */
export function hullFill(points: readonly JamoStrokePoint[]): number {
  if (points.length < 3) return 0;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: JamoStrokePoint, a: JamoStrokePoint, b: JamoStrokePoint): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (pts: JamoStrokePoint[]): JamoStrokePoint[] => {
    const h: JamoStrokePoint[] = [];
    for (const p of pts) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  let twice = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  return box > 0 ? Math.abs(twice) / 2 / box : 0;
}

/** For ㅁ and ㅇ, the drawn outline fills its box on the same side of `LOOP_FILL_SPLIT` as the target. */
function loopMatches(letter: UnitLetter, ink: readonly JamoStrokePoint[]): boolean {
  if (letter.char === undefined || !LOOP_LETTERS.has(letter.char) || ink.length < 3) return true;
  const square = hullFill(letter.strokes.flat()) >= LOOP_FILL_SPLIT;
  return hullFill(ink) >= LOOP_FILL_SPLIT === square;
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
