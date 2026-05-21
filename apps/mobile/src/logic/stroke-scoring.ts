import type { JamoStrokePoint } from '../content/jamo-strokes';

/**
 * F-004 Trace Stroke — coverage scoring.
 *
 * Given a target stroke skeleton (ordered points) and a set of drawn
 * strokes (also ordered points), compute how much of the target was
 * "visited" — i.e., for each target point, is there at least one drawn
 * point within `tolerance` distance.
 *
 * Coverage = visited points / total target points (averaged across
 * target strokes).
 *
 * Generous by design — kids 5–7 motor calibration. Pass threshold in
 * the screen is 0.65 (i.e., visit ~65% of the skeleton to pass).
 *
 * v1 ignores stroke order + direction (per spec §4). v2 (F-005) can
 * add per-stroke matching.
 */

const DEFAULT_TOLERANCE = 24; // dp at 200 viewBox scale

function distSq(a: JamoStrokePoint, b: JamoStrokePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function densify(stroke: JamoStrokePoint[], stepPx = 8): JamoStrokePoint[] {
  // Insert intermediate points along each segment so the coverage check
  // doesn't undercount when target strokes are sparse (e.g., just 3 corners
  // for ㄱ).
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

export interface ScoreTraceInput {
  target: JamoStrokePoint[][]; // 1+ ordered strokes per target jamo
  drawn: JamoStrokePoint[][]; // 0+ child-drawn strokes
  tolerance?: number; // default 24
}

export interface ScoreTraceResult {
  coverage: number; // 0..1 averaged across target strokes
  perStrokeCoverage: number[];
  visitedDrawn: boolean; // true if the child drew any points
}

export function scoreTrace({
  target,
  drawn,
  tolerance = DEFAULT_TOLERANCE,
}: ScoreTraceInput): ScoreTraceResult {
  const visitedDrawn = drawn.some((s) => s.length > 0);
  if (target.length === 0 || !visitedDrawn) {
    return {
      coverage: 0,
      perStrokeCoverage: target.map(() => 0),
      visitedDrawn,
    };
  }

  // Flatten all drawn points into a single bag — v1 ignores stroke order
  const drawnPoints: JamoStrokePoint[] = drawn.flat();
  const tolSq = tolerance * tolerance;

  const perStrokeCoverage = target.map((targetStroke) => {
    const dense = densify(targetStroke);
    let visited = 0;
    for (const tp of dense) {
      // Did any drawn point come within tolerance?
      const hit = drawnPoints.some((dp) => distSq(dp, tp) <= tolSq);
      if (hit) visited++;
    }
    return dense.length > 0 ? visited / dense.length : 0;
  });

  const coverage =
    perStrokeCoverage.reduce((sum, c) => sum + c, 0) / perStrokeCoverage.length;

  return { coverage, perStrokeCoverage, visitedDrawn };
}

export const DEFAULT_PASS_THRESHOLD = 0.65;
