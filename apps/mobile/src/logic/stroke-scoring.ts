import type { JamoStrokePoint } from '../content/jamo-strokes';

/**
 * Trace Stroke scoring.
 *
 * F-004 ships coverage scoring (was v1 — order/direction ignored).
 * F-005 adds optional stroke-order awareness (`checkOrder`).
 * F-006 adds optional stroke-direction awareness (`checkDirection`).
 *
 * Coverage still determines pass/fail at threshold 0.65. Order and
 * direction (start→end for open strokes, winding for closed loops) are
 * auxiliary signals — they ride the result envelope so
 * the UI can surface "you got it! next time try left-to-right" without
 * gating progress. Direction is reported per target, with a closed-loop flag,
 * so the UI can word a loop going round the wrong way differently from an
 * open stroke drawn backwards (see logic/trace-copy.ts).
 *
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-2: a letter the stroke table accepts in more than one form
 * (`altStrokes`, OD-SO11) is scored with `scoreTraceForms`: the pass on the form shown, the order and
 * direction on whichever listed form the drawing follows.
 */

const DEFAULT_TOLERANCE = 24; // dp at 200 viewBox scale

function distSq(a: JamoStrokePoint, b: JamoStrokePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function densify(stroke: JamoStrokePoint[], stepPx = 8): JamoStrokePoint[] {
  if (stroke.length < 2) return [...stroke];
  const out: JamoStrokePoint[] = [];
  for (let i = 0; i < stroke.length - 1; i++) {
    const a = stroke[i]!;
    const b = stroke[i + 1]!;
    out.push(a);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.floor(len / stepPx));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + dx * t, y: a.y + dy * t });
    }
  }
  out.push(stroke[stroke.length - 1]!);
  return out;
}

function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Shoelace area of the polyline, closed back to its first point. Positive
 * means clockwise on screen (y grows downward), negative counter-clockwise.
 */
function signedArea(stroke: JamoStrokePoint[]): number {
  let twice = 0;
  for (let i = 0; i < stroke.length; i++) {
    const a = stroke[i]!;
    const b = stroke[(i + 1) % stroke.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

/** A loop (ㅇ, ㅎ's circle) ends where it starts, so its chord is ~zero. */
function isClosedStroke(stroke: JamoStrokePoint[], tolerance: number): boolean {
  return stroke.length >= 3 && distSq(stroke[0]!, stroke[stroke.length - 1]!) <= tolerance * tolerance;
}

/**
 * A drawn stroke needs at least this share of the target loop's area before
 * its winding means anything. One straight side of ㅁ (how Korean writes it:
 * ㅣ first) has none, and must never earn a direction nudge.
 */
const MIN_WINDING_AREA_RATIO = 0.25;

/**
 * F-006 direction check for one target stroke and its best-matching drawn
 * stroke. Open strokes compare start→end vectors (§3.2). Closed loops have
 * a zero start→end vector — comparing it would fail every loop — so they
 * compare winding (clockwise vs counter-clockwise) instead, wherever on the
 * loop the child began.
 */
function directionMatches(
  drawnStroke: JamoStrokePoint[],
  targetStroke: JamoStrokePoint[],
  tolerance: number,
): boolean {
  if (drawnStroke.length < 2 || targetStroke.length < 2) return false;
  if (isClosedStroke(targetStroke, tolerance)) {
    const targetArea = signedArea(targetStroke);
    const drawnArea = signedArea(drawnStroke);
    if (targetArea === 0) return true; // an out-and-back line has no way round
    if (Math.abs(drawnArea) < Math.abs(targetArea) * MIN_WINDING_AREA_RATIO) return true;
    return Math.sign(drawnArea) === Math.sign(targetArea);
  }
  const dStart = drawnStroke[0]!;
  const dEnd = drawnStroke[drawnStroke.length - 1]!;
  const tStart = targetStroke[0]!;
  const tEnd = targetStroke[targetStroke.length - 1]!;
  const dVec = normalize({ x: dEnd.x - dStart.x, y: dEnd.y - dStart.y });
  const tVec = normalize({ x: tEnd.x - tStart.x, y: tEnd.y - tStart.y });
  return dot(dVec, tVec) > 0.5; // ~60° cone
}

export interface ScoreTraceInput {
  target: JamoStrokePoint[][];
  drawn: JamoStrokePoint[][];
  tolerance?: number;
  /** F-005: also evaluate stroke order. */
  checkOrder?: boolean;
  /** F-006: also evaluate stroke direction. */
  checkDirection?: boolean;
}

export interface ScoreTraceResult {
  coverage: number;
  perStrokeCoverage: number[];
  visitedDrawn: boolean;
  /** F-005: monotonic non-decreasing best-matching target indices. */
  orderCorrect?: boolean;
  /** F-006: per-target whether the matching drawn stroke ran the right way. */
  directionsPerTarget?: boolean[];
  /**
   * F-006: per target, whether it is a closed loop (ㅇ, ㅎ's ring). Loops are
   * judged by winding, not left-to-right, so the UI must not give them the
   * left-to-right nudge. Parallel to `directionsPerTarget`.
   */
  closedPerTarget?: boolean[];
  /** F-006: true iff every directionsPerTarget entry is true. */
  directionsCorrect?: boolean;
  /** F-008: coverage ≥ 0.65 AND orderCorrect. Populated when checkOrder=true. */
  passWithOrder?: boolean;
  /**
   * [SO] SO-2, `scoreTraceForms` only: the accepted form order and direction were read from (0: the form shown).
   * `directionsPerTarget` and `closedPerTarget` run parallel to that form's strokes.
   */
  form?: number;
}

export function scoreTrace({
  target,
  drawn,
  tolerance = DEFAULT_TOLERANCE,
  checkOrder = false,
  checkDirection = false,
}: ScoreTraceInput): ScoreTraceResult {
  const visitedDrawn = drawn.some((s) => s.length > 0);
  if (target.length === 0 || !visitedDrawn) {
    const base: ScoreTraceResult = {
      coverage: 0,
      perStrokeCoverage: target.map(() => 0),
      visitedDrawn,
    };
    if (checkOrder) {
      base.orderCorrect = false;
      base.passWithOrder = false;
    }
    if (checkDirection) {
      base.directionsPerTarget = target.map(() => false);
      base.closedPerTarget = target.map((t) => isClosedStroke(t, tolerance));
      base.directionsCorrect = target.length === 0;
    }
    return base;
  }

  const tolSq = tolerance * tolerance;

  // Coverage — flatten all drawn points into a single bag (v1 behaviour)
  const drawnPoints: JamoStrokePoint[] = drawn.flat();
  const perStrokeCoverage = target.map((targetStroke) => {
    const dense = densify(targetStroke);
    let visited = 0;
    for (const tp of dense) {
      const hit = drawnPoints.some((dp) => distSq(dp, tp) <= tolSq);
      if (hit) visited++;
    }
    return dense.length > 0 ? visited / dense.length : 0;
  });
  const coverage =
    perStrokeCoverage.reduce((sum, c) => sum + c, 0) / perStrokeCoverage.length;

  const result: ScoreTraceResult = {
    coverage,
    perStrokeCoverage,
    visitedDrawn,
  };

  if (checkOrder || checkDirection) {
    // For each drawn stroke, find best-matching target by coverage of drawn
    // points onto target densified points. Returns matching target index or -1.
    const targetDense = target.map((t) => densify(t));
    const bestMatchIndices: number[] = drawn
      .filter((s) => s.length > 0)
      .map((dstroke) => bestTargetIndex(dstroke, targetDense, tolSq));

    if (checkOrder) {
      // Order is correct if best-match indices are monotonically non-decreasing
      let ordered = true;
      for (let i = 1; i < bestMatchIndices.length; i++) {
        if (bestMatchIndices[i]! < bestMatchIndices[i - 1]!) {
          ordered = false;
          break;
        }
      }
      result.orderCorrect = ordered;
      // F-008: derived strict-pass field
      result.passWithOrder = coverage >= DEFAULT_PASS_THRESHOLD && ordered;
    }

    if (checkDirection) {
      const directionsPerTarget = target.map((targetStroke, ti) => {
        // Find the drawn stroke whose best-match is this target
        const drawnIdx = bestMatchIndices.findIndex((bi) => bi === ti);
        if (drawnIdx === -1) return false;
        const drawnStroke = drawn.filter((s) => s.length > 0)[drawnIdx];
        if (!drawnStroke) return false;
        return directionMatches(drawnStroke, targetStroke, tolerance);
      });
      result.directionsPerTarget = directionsPerTarget;
      result.closedPerTarget = target.map((t) => isClosedStroke(t, tolerance));
      result.directionsCorrect = directionsPerTarget.every((d) => d);
    }
  }

  return result;
}

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.3 (SO-2; OD-SO4, OD-SO11): of a drawing's results against each accepted
 * form of a letter (the form shown first), the one its order and direction are read from: the form the drawing
 * follows best. In order first, then the fewest target strokes the wrong way; a tie keeps the earlier form, so the
 * form shown (AU-14's) wins it. 0 when there is nothing to choose from.
 */
export function bestFormIndex(results: readonly Pick<ScoreTraceResult, 'orderCorrect' | 'directionsPerTarget'>[]): number {
  const outOfOrder = (r: Pick<ScoreTraceResult, 'orderCorrect'>): number => (r.orderCorrect === false ? 1 : 0);
  const wrongWay = (r: Pick<ScoreTraceResult, 'directionsPerTarget'>): number => (r.directionsPerTarget ?? []).filter((ok) => !ok).length;
  let best = 0;
  results.forEach((r, i) => {
    const b = results[best]!;
    if (outOfOrder(r) < outOfOrder(b) || (outOfOrder(r) === outOfOrder(b) && wrongWay(r) < wrongWay(b))) best = i;
  });
  return best;
}

export interface ScoreTraceFormsInput extends Omit<ScoreTraceInput, 'target'> {
  /** Every accepted form of the letter, the form shown (the ghost) first (`strokeFormsForJamo`). */
  forms: readonly JamoStrokePoint[][][];
}

/**
 * [SO] SO-2: `scoreTrace` for a letter with more than one accepted form, so the order (F-005) and direction (F-006)
 * checks are true when the drawing matches any listed form. The pass does not change: `coverage`,
 * `perStrokeCoverage` and `visitedDrawn` are the form shown's, the ghost the learner traces. Order (`orderCorrect`,
 * and so `passWithOrder`) and direction (`directionsPerTarget`, `closedPerTarget`, `directionsCorrect`) come from the
 * form `bestFormIndex` picks, named by `form`. With one form (or no order or direction check) it is `scoreTrace`.
 */
export function scoreTraceForms({ forms, ...input }: ScoreTraceFormsInput): ScoreTraceResult {
  const shown = scoreTrace({ ...input, target: forms[0] ?? [] });
  if (forms.length < 2 || !(input.checkOrder || input.checkDirection)) return { ...shown, form: 0 };
  const results = [shown, ...forms.slice(1).map((target) => scoreTrace({ ...input, target }))];
  const form = bestFormIndex(results);
  const read = results[form]!;
  return {
    ...shown,
    ...(input.checkOrder
      ? { orderCorrect: read.orderCorrect, passWithOrder: shown.coverage >= DEFAULT_PASS_THRESHOLD && read.orderCorrect === true }
      : {}),
    ...(input.checkDirection
      ? { directionsPerTarget: read.directionsPerTarget, closedPerTarget: read.closedPerTarget, directionsCorrect: read.directionsCorrect }
      : {}),
    form,
  };
}

function bestTargetIndex(
  drawnStroke: JamoStrokePoint[],
  targetDense: JamoStrokePoint[][],
  tolSq: number,
): number {
  let bestIdx = -1;
  let bestScore = -1;
  targetDense.forEach((dense, idx) => {
    let visited = 0;
    for (const dp of drawnStroke) {
      const hit = dense.some((tp) => distSq(dp, tp) <= tolSq);
      if (hit) visited++;
    }
    const ratio = drawnStroke.length > 0 ? visited / drawnStroke.length : 0;
    if (ratio > bestScore) {
      bestScore = ratio;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

export const DEFAULT_PASS_THRESHOLD = 0.65;
