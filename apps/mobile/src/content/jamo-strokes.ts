/**
 * Jamo stroke skeletons — hand-authored ordered polygonal approximations
 * of each of the 30 Stage 1 jamo. Coordinates are in a 200 × 200 viewBox.
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
  // ㅇ ieung — circle (approximated as 8-point polygon)
  {
    jamoId: 'jamo:ieung',
    strokes: [
      [
        p(100, 40),
        p(140, 56),
        p(160, 95),
        p(140, 134),
        p(100, 150),
        p(60, 134),
        p(40, 95),
        p(60, 56),
        p(100, 40),
      ],
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
  // ㅎ hieut — top tiny + horizontal + circle
  {
    jamoId: 'jamo:hieut',
    strokes: [
      [p(100, 30), p(100, 50)],
      [p(40, 65), p(160, 65)],
      [
        p(100, 85),
        p(140, 100),
        p(160, 125),
        p(140, 145),
        p(100, 155),
        p(60, 145),
        p(40, 125),
        p(60, 100),
        p(100, 85),
      ],
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
      [
        p(100, 40),
        p(140, 56),
        p(160, 95),
        p(140, 134),
        p(100, 150),
        p(60, 134),
        p(40, 95),
        p(60, 56),
        p(100, 40),
      ],
    ],
  },
];

export function strokesForJamo(jamoId: string): JamoStrokePoint[][] | undefined {
  return jamoStrokes.find((s) => s.jamoId === jamoId)?.strokes;
}
