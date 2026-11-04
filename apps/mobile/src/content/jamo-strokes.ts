/**
 * Jamo stroke skeletons — hand-authored ordered polygonal approximations
 * of each of the 30 Stage 1 jamo (loops are sampled from true circles, see
 * `loop`). Coordinates are in a 200 × 200 viewBox.
 *
 * F-004 Trace Stroke uses these to score the child's finger-drawn path
 * against the expected stroke skeleton (coverage scoring with 24-unit
 * tolerance).
 *
 * Each jamo's `strokes` is an array of strokes (each stroke = ordered
 * points). A stroke is a continuous line; lifting the finger means
 * starting a new stroke. Multi-stroke jamo: ㅂ ㅍ etc.
 *
 * Hand-authored for pedagogical clarity — not perfectly anatomical
 * Hangul stroke order. Refinement deferred to F-005 (stroke order).
 */

export interface JamoStrokePoint {
  x: number;
  y: number;
}

export interface JamoStrokes {
  jamoId: string;
  strokes: JamoStrokePoint[][];
}

const p = (x: number, y: number): JamoStrokePoint => ({ x, y });

/**
 * Chords in a loop (ㅇ, ㅎ's circle). The loops are sampled from a true circle
 * or ellipse, never hand-placed corners (NB-3: an 8-point ㅇ drew as an
 * octagon). At 64 the widest chord strays 0.12% of the radius from the curve,
 * invisible at any canvas size, and a multiple of 4 puts a point exactly on
 * the top, left, bottom and right of the loop.
 */
export const LOOP_SEGMENTS = 64;

/** Two decimals keep the SVG path data short; far below a pixel at any size. */
const round2 = (v: number): number => Math.round(v * 100) / 100 + 0;

/**
 * A closed loop round centre (cx, cy) with radii rx, ry: it starts at the top
 * and runs counter-clockwise on screen (top, left, bottom, right), the way ㅇ
 * is written; the last point is the first again.
 */
function loop(cx: number, cy: number, rx: number, ry: number): JamoStrokePoint[] {
  const points: JamoStrokePoint[] = [];
  for (let i = 0; i < LOOP_SEGMENTS; i++) {
    const t = (2 * Math.PI * i) / LOOP_SEGMENTS;
    points.push(p(round2(cx - rx * Math.sin(t)), round2(cy - ry * Math.cos(t))));
  }
  points.push({ ...points[0]! });
  return points;
}

/** ㅇ (and ㅇ as a final): round, centred where the old 120 × 110 ring was. */
const IEUNG_CIRCLE = loop(100, 95, 57.5, 57.5);
/** ㅎ's ring under its bar, in the old ring's box (x 40–160, y 85–155). */
const HIEUT_LOOP = loop(100, 120, 60, 35);

// Padding from viewBox edges: keep strokes between (30, 30) and (170, 170)
// so the child has a comfortable margin to draw within.

export const jamoStrokes: JamoStrokes[] = [
  // ─────────────────────────────────────────
  // CONSONANTS (14)
  // ─────────────────────────────────────────
  // ㄱ giyeok — top horizontal + right vertical (L-shape mirrored)
  { jamoId: 'jamo:giyeok', strokes: [[p(40, 50), p(160, 50), p(160, 150)]] },
  // ㄴ nieun — left vertical + bottom horizontal (L-shape)
  { jamoId: 'jamo:nieun', strokes: [[p(50, 40), p(50, 150), p(160, 150)]] },
  // ㄷ digeut — top horizontal + left vertical + bottom horizontal
  {
    jamoId: 'jamo:digeut',
    strokes: [
      [p(40, 50), p(160, 50)],
      [p(50, 50), p(50, 150), p(160, 150)],
    ],
  },
  // ㄹ rieul — top H + right V + middle H + left V + bottom H
  {
    jamoId: 'jamo:rieul',
    strokes: [
      [p(40, 40), p(160, 40), p(160, 95)],
      [p(40, 95), p(160, 95)],
      [p(40, 95), p(40, 150), p(160, 150)],
    ],
  },
  // ㅁ mieum — 4-sided rectangle
  {
    jamoId: 'jamo:mieum',
    strokes: [
      [p(50, 40), p(150, 40), p(150, 150), p(50, 150), p(50, 40)],
    ],
  },
  // ㅂ bieup — left V + right V + 2 horizontal cross-bars
  {
    jamoId: 'jamo:bieup',
    strokes: [
      [p(50, 30), p(50, 150)],
      [p(150, 60), p(150, 150)],
      [p(50, 100), p(150, 100)],
      [p(50, 150), p(150, 150)],
    ],
  },
  // ㅅ siot — left diagonal + right diagonal (inverted V)
  {
    jamoId: 'jamo:siot',
    strokes: [
      [p(100, 40), p(50, 150)],
      [p(110, 80), p(160, 150)],
    ],
  },
  // ㅇ ieung — a true circle, from the top, counter-clockwise as written
  {
    jamoId: 'jamo:ieung',
    strokes: [
      IEUNG_CIRCLE,
    ],
  },
  // ㅈ jieut — top horizontal + left diagonal + right diagonal
  {
    jamoId: 'jamo:jieut',
    strokes: [
      [p(40, 50), p(160, 50)],
      [p(110, 50), p(50, 150)],
      [p(110, 80), p(160, 150)],
    ],
  },
  // ㅊ chieut — top tiny vertical + horizontal + left diag + right diag
  {
    jamoId: 'jamo:chieut',
    strokes: [
      [p(100, 30), p(100, 55)],
      [p(40, 70), p(160, 70)],
      [p(110, 70), p(50, 150)],
      [p(110, 100), p(160, 150)],
    ],
  },
  // ㅋ kieuk — top H + right V + middle short H
  {
    jamoId: 'jamo:kieuk',
    strokes: [
      [p(40, 40), p(160, 40), p(160, 150)],
      [p(40, 95), p(160, 95)],
    ],
  },
  // ㅌ tieut — top H + middle H + left V + bottom H
  {
    jamoId: 'jamo:tieut',
    strokes: [
      [p(40, 40), p(160, 40)],
      [p(50, 40), p(50, 95)],
      [p(40, 95), p(160, 95)],
      [p(50, 95), p(50, 150), p(160, 150)],
    ],
  },
  // ㅍ pieup — top H + 2 verticals + bottom H
  {
    jamoId: 'jamo:pieup',
    strokes: [
      [p(40, 50), p(160, 50)],
      [p(70, 50), p(70, 150)],
      [p(130, 50), p(130, 150)],
      [p(40, 150), p(160, 150)],
    ],
  },
  // ㅎ hieut — top tiny + horizontal + circle (from the top, counter-clockwise)
  {
    jamoId: 'jamo:hieut',
    strokes: [
      [p(100, 30), p(100, 50)],
      [p(40, 65), p(160, 65)],
      HIEUT_LOOP,
    ],
  },

  // ─────────────────────────────────────────
  // VOWELS (10)
  // ─────────────────────────────────────────
  // ㅏ a — vertical + right horizontal tick
  {
    jamoId: 'jamo:a',
    strokes: [
      [p(80, 30), p(80, 170)],
      [p(80, 100), p(140, 100)],
    ],
  },
  // ㅑ ya — vertical + 2 right ticks
  {
    jamoId: 'jamo:ya',
    strokes: [
      [p(80, 30), p(80, 170)],
      [p(80, 80), p(140, 80)],
      [p(80, 120), p(140, 120)],
    ],
  },
  // ㅓ eo — vertical + left tick
  {
    jamoId: 'jamo:eo',
    strokes: [
      [p(60, 100), p(120, 100)],
      [p(120, 30), p(120, 170)],
    ],
  },
  // ㅕ yeo — vertical + 2 left ticks
  {
    jamoId: 'jamo:yeo',
    strokes: [
      [p(60, 80), p(120, 80)],
      [p(60, 120), p(120, 120)],
      [p(120, 30), p(120, 170)],
    ],
  },
  // ㅗ o — horizontal + downward tick
  {
    jamoId: 'jamo:o',
    strokes: [
      [p(30, 100), p(170, 100)],
      [p(100, 60), p(100, 100)],
    ],
  },
  // ㅛ yo — horizontal + 2 downward ticks
  {
    jamoId: 'jamo:yo',
    strokes: [
      [p(30, 110), p(170, 110)],
      [p(75, 70), p(75, 110)],
      [p(125, 70), p(125, 110)],
    ],
  },
  // ㅜ u — horizontal + upward tick
  {
    jamoId: 'jamo:u',
    strokes: [
      [p(30, 100), p(170, 100)],
      [p(100, 100), p(100, 140)],
    ],
  },
  // ㅠ yu — horizontal + 2 upward ticks
  {
    jamoId: 'jamo:yu',
    strokes: [
      [p(30, 90), p(170, 90)],
      [p(75, 90), p(75, 130)],
      [p(125, 90), p(125, 130)],
    ],
  },
  // ㅡ eu — single horizontal
  { jamoId: 'jamo:eu', strokes: [[p(30, 100), p(170, 100)]] },
  // ㅣ i — single vertical
  { jamoId: 'jamo:i', strokes: [[p(100, 30), p(100, 170)]] },

  // ─────────────────────────────────────────
  // BATCHIM (6) — same shapes as their base consonants
  // ─────────────────────────────────────────
  { jamoId: 'jamo:giyeok-batchim', strokes: [[p(40, 50), p(160, 50), p(160, 150)]] },
  { jamoId: 'jamo:nieun-batchim', strokes: [[p(50, 40), p(50, 150), p(160, 150)]] },
  {
    jamoId: 'jamo:rieul-batchim',
    strokes: [
      [p(40, 40), p(160, 40), p(160, 95)],
      [p(40, 95), p(160, 95)],
      [p(40, 95), p(40, 150), p(160, 150)],
    ],
  },
  {
    jamoId: 'jamo:mieum-batchim',
    strokes: [[p(50, 40), p(150, 40), p(150, 150), p(50, 150), p(50, 40)]],
  },
  {
    jamoId: 'jamo:bieup-batchim',
    strokes: [
      [p(50, 30), p(50, 150)],
      [p(150, 60), p(150, 150)],
      [p(50, 100), p(150, 100)],
      [p(50, 150), p(150, 150)],
    ],
  },
  {
    jamoId: 'jamo:ieung-batchim',
    strokes: [
      IEUNG_CIRCLE,
    ],
  },
];

export function strokesForJamo(jamoId: string): JamoStrokePoint[][] | undefined {
  return jamoStrokes.find((s) => s.jamoId === jamoId)?.strokes;
}

/**
 * Jamo whose stroke skeleton a native speaker has reviewed (F-TCH-004 §3.6).
 * Empty until a native-reviewed content PR adds ids; until then the presenter's
 * stroke guide panel says "Simplified stroke guide".
 */
export const reviewedStrokeIds: readonly string[] = [];
