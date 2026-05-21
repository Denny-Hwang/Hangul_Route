import type { JamoStrokePoint } from '../content/jamo-strokes';

/**
 * Trace Stroke scoring.
 *
 * F-004 ships coverage scoring (was v1 — order/direction ignored).
 * F-005 adds optional stroke-order awareness (`checkOrder`).
 * F-006 adds optional stroke-direction awareness (`checkDirection`).
 *
 * Coverage still determines pass/fail at threshold 0.65. Order and
 * direction are auxiliary signals — they ride the result envelope so
 * the UI can surface "you got it! next time try left-to-right" without
 * gating progress.
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
  /** F-006: true iff every directionsPerTarget entry is true. */
  directionsCorrect?: boolean;
  /** F-008: coverage ≥ 0.65 AND orderCorrect. Populated when checkOrder=true. */
  passWithOrder?: boolean;
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
        if (!drawnStroke || drawnStroke.length < 2 || targetStroke.length < 2) {
          return false;
        }
        const dStart = drawnStroke[0]!;
        const dEnd = drawnStroke[drawnStroke.length - 1]!;
        const tStart = targetStroke[0]!;
        const tEnd = targetStroke[targetStroke.length - 1]!;
        const dVec = normalize({ x: dEnd.x - dStart.x, y: dEnd.y - dStart.y });
        const tVec = normalize({ x: tEnd.x - tStart.x, y: tEnd.y - tStart.y });
        return dot(dVec, tVec) > 0.5; // ~60° cone
      });
      result.directionsPerTarget = directionsPerTarget;
      result.directionsCorrect = directionsPerTarget.every((d) => d);
    }
  }

  return result;
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
