import { describe, expect, it } from 'vitest';
import { LOOP_SEGMENTS, strokesForJamo, type JamoStrokePoint } from '../jamo-strokes';
import { scoreTrace, DEFAULT_PASS_THRESHOLD } from '../../logic/stroke-scoring';

/**
 * NB-3: the ㅇ circle (and ㅎ's) was an 8-point polygon, so the guide drew as
 * an octagon. The loops are now sampled from a true circle / ellipse, densely
 * enough that no straight chord strays 1% of the radius from the curve.
 */

interface Loop {
  jamoId: string;
  strokeIdx: number;
}

const LOOPS: readonly Loop[] = [
  { jamoId: 'jamo:ieung', strokeIdx: 0 },
  { jamoId: 'jamo:ieung-batchim', strokeIdx: 0 },
  { jamoId: 'jamo:hieut', strokeIdx: 2 },
];

const loopOf = ({ jamoId, strokeIdx }: Loop): JamoStrokePoint[] => strokesForJamo(jamoId)![strokeIdx]!;

/** Centre and radii from the loop's bounding box. */
function frame(points: readonly JamoStrokePoint[]): { cx: number; cy: number; rx: number; ry: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
}

/**
 * Worst distance between the drawn polyline and the true ellipse, as a share of
 * the smaller radius. Checks every vertex and 20 points along every chord, in
 * the ellipse's unit-circle space (exact for a circle, conservative for ㅎ).
 */
function maxDeviationShare(points: readonly JamoStrokePoint[]): number {
  const { cx, cy, rx, ry } = frame(points);
  const r = Math.min(rx, ry);
  let worst = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      const ux = (a.x + (b.x - a.x) * t - cx) / rx;
      const uy = (a.y + (b.y - a.y) * t - cy) / ry;
      worst = Math.max(worst, Math.abs(Math.hypot(ux, uy) - 1) * (Math.max(rx, ry) / r));
    }
  }
  return worst;
}

/** The 8-point octagons the loops used to be (kept to prove scoring is unchanged). */
const p = (x: number, y: number): JamoStrokePoint => ({ x, y });
const OLD_IEUNG = [p(100, 40), p(60, 56), p(40, 95), p(60, 134), p(100, 150), p(140, 134), p(160, 95), p(140, 56), p(100, 40)];
const OLD_HIEUT_LOOP = [p(100, 85), p(60, 100), p(40, 125), p(60, 145), p(100, 155), p(140, 145), p(160, 125), p(140, 100), p(100, 85)];

/** A hand-drawn-like ring: `turns` of the way round from the top, counter-clockwise, every 3 units. */
function ring(cx: number, cy: number, rx: number, ry: number, turns = 1, wobble = 0): JamoStrokePoint[] {
  const n = Math.max(2, Math.round((2 * Math.PI * Math.max(rx, ry) * turns) / 3));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (2 * Math.PI * turns * i) / n;
    const w = 1 + wobble * Math.sin(5 * t);
    return { x: cx - rx * w * Math.sin(t), y: cy - ry * w * Math.cos(t) };
  });
}

describe('jamo loops are round (NB-3)', () => {
  it.each(LOOPS)('$jamoId loop has at least LOOP_SEGMENTS chords, closed at the top', (loop) => {
    const pts = loopOf(loop);
    expect(LOOP_SEGMENTS).toBeGreaterThanOrEqual(48);
    expect(pts.length).toBe(LOOP_SEGMENTS + 1);
    expect(pts[0]).toEqual(pts[pts.length - 1]);
  });

  it.each(LOOPS)('$jamoId loop never strays 1% of its radius from the true curve', (loop) => {
    expect(maxDeviationShare(loopOf(loop))).toBeLessThan(0.01);
  });

  it('the old octagon failed that bar (the bug this guards)', () => {
    expect(maxDeviationShare(OLD_IEUNG)).toBeGreaterThan(0.01);
  });

  it('ㅇ is a circle, not an oval', () => {
    const { rx, ry } = frame(loopOf(LOOPS[0]!));
    expect(Math.abs(rx - ry) / Math.max(rx, ry)).toBeLessThan(0.01);
  });

  it('the ㅇ batchim loop is the same circle as ㅇ', () => {
    expect(loopOf(LOOPS[1]!)).toEqual(loopOf(LOOPS[0]!));
  });

  it('ㅎ keeps its loop under the bar, in the same box as before', () => {
    const now = frame(loopOf(LOOPS[2]!));
    const before = frame(OLD_HIEUT_LOOP);
    expect(now).toEqual(before);
    expect(now.cy - now.ry).toBeGreaterThan(65); // below the horizontal bar
  });

  it('every coordinate stays inside the drawing margin', () => {
    for (const loop of LOOPS) {
      for (const pt of loopOf(loop)) {
        expect(pt.x).toBeGreaterThanOrEqual(30);
        expect(pt.x).toBeLessThanOrEqual(170);
        expect(pt.y).toBeGreaterThanOrEqual(30);
        expect(pt.y).toBeLessThanOrEqual(170);
      }
    }
  });
});

describe('the stroke checker scores a round loop the same as the octagon did (NB-3)', () => {
  const drawnCases: ReadonlyArray<[string, JamoStrokePoint[][]]> = [
    ['a careful circle', [ring(100, 95, 58, 56)]],
    ['a small circle', [ring(100, 95, 42, 40)]],
    ['a big circle', [ring(100, 95, 74, 72)]],
    ['a wobbly circle', [ring(100, 95, 58, 56, 1, 0.12)]],
    ['three quarters of the way round', [ring(100, 95, 58, 56, 0.75)]],
    ['half way round', [ring(100, 95, 58, 56, 0.5)]],
    ['a circle off to one side', [ring(115, 105, 58, 56)]],
    ['the other way round', [ring(100, 95, 58, 56).map((q) => ({ x: 200 - q.x, y: q.y }))]],
    ['a straight line through the middle', [[p(30, 95), p(170, 95)]]],
    ['the old octagon itself', [OLD_IEUNG]],
  ];

  it.each(drawnCases)('ㅇ: %s', (_name, drawn) => {
    const before = scoreTrace({ target: [OLD_IEUNG], drawn, checkDirection: true });
    const now = scoreTrace({ target: strokesForJamo('jamo:ieung')!, drawn, checkDirection: true });
    expect(now.coverage >= DEFAULT_PASS_THRESHOLD).toBe(before.coverage >= DEFAULT_PASS_THRESHOLD);
    expect(Math.abs(now.coverage - before.coverage)).toBeLessThan(0.08);
    expect(now.directionsCorrect).toBe(before.directionsCorrect);
    expect(now.closedPerTarget).toEqual(before.closedPerTarget);
  });

  it.each([
    ['a careful loop', [ring(100, 120, 60, 35)]],
    ['a rounder loop', [ring(100, 120, 45, 38)]],
    ['a third of the way round', [ring(100, 120, 60, 35, 0.3)]],
    ['three quarters of the way round', [ring(100, 120, 60, 35, 0.75)]],
  ] as const)('ㅎ loop: %s', (_name, drawn) => {
    const before = scoreTrace({ target: [OLD_HIEUT_LOOP], drawn: [...drawn], checkDirection: true });
    const now = scoreTrace({ target: [loopOf(LOOPS[2]!)], drawn: [...drawn], checkDirection: true });
    expect(now.coverage >= DEFAULT_PASS_THRESHOLD).toBe(before.coverage >= DEFAULT_PASS_THRESHOLD);
    expect(Math.abs(now.coverage - before.coverage)).toBeLessThan(0.08);
    expect(now.directionsCorrect).toBe(before.directionsCorrect);
  });

  // Partial loops in 5% steps: the coverage curve is the same within sampling
  // noise. (Pass/fail is only compared away from the 0.65 line above: a loop
  // stopped right on the line can tip either way on how the octagon's corners
  // happened to fall.)
  it.each([
    ['ㅇ', () => [OLD_IEUNG], () => strokesForJamo('jamo:ieung')!, (f: number) => ring(100, 95, 58, 56, f)],
    ['ㅎ loop', () => [OLD_HIEUT_LOOP], () => [loopOf(LOOPS[2]!)], (f: number) => ring(100, 120, 60, 35, f)],
  ] as const)('%s: partial loops score within 0.06 of before', (_name, before, now, drawnAt) => {
    for (let step = 1; step <= 20; step++) {
      const drawn = [drawnAt(step / 20)];
      const was = scoreTrace({ target: before(), drawn }).coverage;
      const is = scoreTrace({ target: now(), drawn }).coverage;
      expect(Math.abs(is - was), `at ${step * 5}%`).toBeLessThan(0.06);
    }
  });
});
