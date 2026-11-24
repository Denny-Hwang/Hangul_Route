/**
 * Jamo stroke skeletons — hand-authored ordered polylines for each of the
 * 30 Stage 1 jamo (loops are sampled from true circles, see `loop`).
 * Coordinates are in a 200 × 200 viewBox.
 *
 * F-004 Trace Stroke uses these to score the learner's finger-drawn path
 * against the expected stroke skeleton (coverage scoring with 24-unit
 * tolerance); F-005 / F-006 compare the drawn order and direction with them,
 * and the Show-me demo (F-007) walks them in this order.
 *
 * Each jamo's `strokes` is an array of strokes (each stroke = ordered
 * points). A stroke is a continuous line; lifting the finger means
 * starting a new stroke.
 *
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-14: the data follows the standard school
 * stroke order and stroke counts. Strokes are listed in writing order; a
 * horizontal stroke runs left to right, a vertical stroke top to bottom, and
 * ㅇ is one counter-clockwise stroke from the top. A final consonant is
 * written exactly like the same consonant. Double consonants and compound
 * vowels are not listed here: Trace a Word builds them from these letters,
 * in writing order (`logic/trace-word/block-strokes.ts`).
 * `content/__tests__/jamo-stroke-order.test.ts` pins every count and
 * direction.
 *
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-2 (OD-SO11, 2026-11-23): checked
 * against the sourced rows of `docs/specs/assets/stroke-order-table.md`, which
 * the owner approved for SO-2. Every AU-14 form is one the table accepts, so
 * `strokes` is unchanged. Where the table accepts another form (ㅈ in 3
 * strokes; ㅊ and ㅎ with the top stroke left to right; ㅌ with the ㄴ shape
 * from the middle bar), the jamo lists it in `altStrokes`; the order and
 * direction checks accept any listed form. The same test parses the table,
 * so the data and the table cannot drift. Whether a letter's order is taught
 * at all is `reviewedStrokeIds` (below), a person's call (SO-3).
 */

export interface JamoStrokePoint {
  x: number;
  y: number;
}

export interface JamoStrokes {
  jamoId: string;
  /** The form shown (the ghost, Show me, the presenter): AU-14's. */
  strokes: JamoStrokePoint[][];
  /**
   * [SO] OD-SO4 / OD-SO11: the other forms the table accepts, each a whole stroke list in writing order, in the
   * table's order. Each lies inside the box of `strokes`, so Trace a Word can place it with the same fit. Never shown.
   */
  altStrokes?: JamoStrokePoint[][][];
}

const p = (x: number, y: number): JamoStrokePoint => ({ x, y });

/**
 * Chords in a loop (ㅇ, ㅎ's circle). The loops are sampled from a true circle
 * or ellipse, never hand-placed corners (NB-3: an 8-point ㅇ drew as an
 * octagon). At 64 the widest chord strays 0.12% of the radius from the curve,
 * invisible at any canvas size, and a multiple of 4 puts a point exactly on
 * the top, left, bottom and right of the loop.
 */
const LOOP_SEGMENTS = 64;

/** Two decimals keep the SVG path data short; far below a pixel at any size. */
const round2 = (v: number): number => +v.toFixed(2);

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
  points.push(points[0]!);
  return points;
}

/** ㅇ (and ㅇ as a final): round, centred where the old 120 × 110 ring was. */
const IEUNG_CIRCLE = loop(100, 95, 57.5, 57.5);
/** ㅎ's ring under its bar, in the old ring's box (x 40–160, y 85–155). */
const HIEUT_LOOP = loop(100, 120, 60, 35);

// Padding from viewBox edges: keep strokes between (30, 30) and (170, 170)
// so the learner has a comfortable margin to draw within.

// The six consonants that are also Stage 1 finals: one stroke list each, so a
// final can never drift from the consonant it is. Each entry below gets its
// own copy (`copy`), so no two jamo share an array.

/** ㄱ giyeok — 1 stroke: across, then down. */
const GIYEOK: JamoStrokePoint[][] = [[p(40, 50), p(160, 50), p(160, 150)]];
/** ㄴ nieun — 1 stroke: down, then across. */
const NIEUN: JamoStrokePoint[][] = [[p(50, 40), p(50, 150), p(160, 150)]];
/** ㄹ rieul — 3 strokes: the ㄱ shape, the middle bar, the ㄴ shape. */
const RIEUL: JamoStrokePoint[][] = [
  [p(40, 40), p(160, 40), p(160, 95)],
  [p(40, 95), p(160, 95)],
  [p(40, 95), p(40, 150), p(160, 150)],
];
/** ㅁ mieum — 3 strokes: the left bar; the top and the right side as one stroke; the bottom bar. */
const MIEUM: JamoStrokePoint[][] = [
  [p(50, 40), p(50, 150)],
  [p(50, 40), p(150, 40), p(150, 150)],
  [p(50, 150), p(150, 150)],
];
/** ㅂ bieup — 4 strokes: left bar, right bar (both start at the same height), middle bar, bottom bar. */
const BIEUP: JamoStrokePoint[][] = [
  [p(50, 30), p(50, 150)],
  [p(150, 30), p(150, 150)],
  [p(50, 100), p(150, 100)],
  [p(50, 150), p(150, 150)],
];
/** ㅇ ieung — 1 stroke: a true circle, from the top, counter-clockwise. */
const IEUNG: JamoStrokePoint[][] = [IEUNG_CIRCLE];

const copy = (strokes: JamoStrokePoint[][]): JamoStrokePoint[][] =>
  strokes.map((stroke) => stroke.map((point) => ({ ...point })));

export const jamoStrokes: JamoStrokes[] = [
  // ─────────────────────────────────────────
  // CONSONANTS (14)
  // ─────────────────────────────────────────
  { jamoId: 'jamo:giyeok', strokes: copy(GIYEOK) },
  { jamoId: 'jamo:nieun', strokes: copy(NIEUN) },
  // ㄷ digeut — 2 strokes: the top bar, then the ㄴ shape
  {
    jamoId: 'jamo:digeut',
    strokes: [
      [p(40, 50), p(160, 50)],
      [p(50, 50), p(50, 150), p(160, 150)],
    ],
  },
  { jamoId: 'jamo:rieul', strokes: copy(RIEUL) },
  { jamoId: 'jamo:mieum', strokes: copy(MIEUM) },
  { jamoId: 'jamo:bieup', strokes: copy(BIEUP) },
  // ㅅ siot — 2 strokes: the left leg, then the right leg
  {
    jamoId: 'jamo:siot',
    strokes: [
      [p(100, 40), p(50, 150)],
      [p(110, 80), p(160, 150)],
    ],
  },
  { jamoId: 'jamo:ieung', strokes: copy(IEUNG) },
  // ㅈ jieut — 2 strokes: the bar running into the left leg without a lift,
  // then the right leg, which leaves from the left leg
  {
    jamoId: 'jamo:jieut',
    strokes: [
      [p(40, 50), p(160, 50), p(50, 150)],
      [p(116, 90), p(160, 150)],
    ],
    // Table row 9, Variant B (3 strokes): the bar, then ㅅ from the middle of the bar, its right leg
    // leaving from the left leg (the order of the three is derived, not sourced: the reviewer confirms it)
    altStrokes: [
      [
        [p(40, 50), p(160, 50)],
        [p(100, 50), p(50, 150)],
        [p(80, 90), p(160, 150)],
      ],
    ],
  },
  // ㅊ chieut — 3 strokes: the tick, then ㅈ's two strokes
  {
    jamoId: 'jamo:chieut',
    strokes: [
      [p(100, 30), p(100, 55)],
      [p(40, 70), p(160, 70), p(50, 150)],
      [p(116, 102), p(160, 150)],
    ],
    // Table row 10, Order A: the top stroke left to right, slanting a little down, then ㅈ's two strokes
    altStrokes: [
      [
        [p(88, 40), p(112, 44)],
        [p(40, 70), p(160, 70), p(50, 150)],
        [p(116, 102), p(160, 150)],
      ],
    ],
  },
  // ㅋ kieuk — 2 strokes: the ㄱ shape, then the middle bar
  {
    jamoId: 'jamo:kieuk',
    strokes: [
      [p(40, 40), p(160, 40), p(160, 150)],
      [p(40, 95), p(160, 95)],
    ],
  },
  // ㅌ tieut — 3 strokes: the top bar, the middle bar, then the ㄴ shape
  {
    jamoId: 'jamo:tieut',
    strokes: [
      [p(40, 40), p(160, 40)],
      [p(40, 95), p(160, 95)],
      [p(50, 40), p(50, 150), p(160, 150)],
    ],
    // Table row 12, Variant B (一 + ㄷ): the two bars, then the ㄴ shape from the middle bar, not from the top
    altStrokes: [
      [
        [p(40, 40), p(160, 40)],
        [p(40, 95), p(160, 95)],
        [p(50, 95), p(50, 150), p(160, 150)],
      ],
    ],
  },
  // ㅍ pieup — 4 strokes: the top bar, the left leg, the right leg, the bottom bar
  {
    jamoId: 'jamo:pieup',
    strokes: [
      [p(40, 50), p(160, 50)],
      [p(70, 50), p(70, 150)],
      [p(130, 50), p(130, 150)],
      [p(40, 150), p(160, 150)],
    ],
  },
  // ㅎ hieut — 3 strokes: the tick, the bar, the ring (from the top, counter-clockwise)
  {
    jamoId: 'jamo:hieut',
    strokes: [
      [p(100, 30), p(100, 50)],
      [p(40, 65), p(160, 65)],
      HIEUT_LOOP,
    ],
    // Table row 14, Order A: the top stroke left to right, slanting a little down, then the bar and the ring
    altStrokes: [[[p(88, 38), p(112, 42)], ...copy([[p(40, 65), p(160, 65)], HIEUT_LOOP])]],
  },

  // ─────────────────────────────────────────
  // VOWELS (10)
  // ─────────────────────────────────────────
  // ㅏ a — the long bar, then the tick
  {
    jamoId: 'jamo:a',
    strokes: [
      [p(80, 30), p(80, 170)],
      [p(80, 100), p(140, 100)],
    ],
  },
  // ㅑ ya — the long bar, then the two ticks, upper one first
  {
    jamoId: 'jamo:ya',
    strokes: [
      [p(80, 30), p(80, 170)],
      [p(80, 80), p(140, 80)],
      [p(80, 120), p(140, 120)],
    ],
  },
  // ㅓ eo — the tick, then the long bar
  {
    jamoId: 'jamo:eo',
    strokes: [
      [p(60, 100), p(120, 100)],
      [p(120, 30), p(120, 170)],
    ],
  },
  // ㅕ yeo — the two ticks, upper one first, then the long bar
  {
    jamoId: 'jamo:yeo',
    strokes: [
      [p(60, 80), p(120, 80)],
      [p(60, 120), p(120, 120)],
      [p(120, 30), p(120, 170)],
    ],
  },
  // ㅗ o — the tick, then the long bar
  {
    jamoId: 'jamo:o',
    strokes: [
      [p(100, 60), p(100, 100)],
      [p(30, 100), p(170, 100)],
    ],
  },
  // ㅛ yo — the two ticks, left one first, then the long bar
  {
    jamoId: 'jamo:yo',
    strokes: [
      [p(75, 70), p(75, 110)],
      [p(125, 70), p(125, 110)],
      [p(30, 110), p(170, 110)],
    ],
  },
  // ㅜ u — the long bar, then the tick
  {
    jamoId: 'jamo:u',
    strokes: [
      [p(30, 100), p(170, 100)],
      [p(100, 100), p(100, 140)],
    ],
  },
  // ㅠ yu — the long bar, then the two ticks, left one first
  {
    jamoId: 'jamo:yu',
    strokes: [
      [p(30, 90), p(170, 90)],
      [p(75, 90), p(75, 130)],
      [p(125, 90), p(125, 130)],
    ],
  },
  // ㅡ eu — 1 stroke, left to right
  { jamoId: 'jamo:eu', strokes: [[p(30, 100), p(170, 100)]] },
  // ㅣ i — 1 stroke, top to bottom
  { jamoId: 'jamo:i', strokes: [[p(100, 30), p(100, 170)]] },

  // ─────────────────────────────────────────
  // BATCHIM (6) — written exactly like the same consonant
  // ─────────────────────────────────────────
  { jamoId: 'jamo:giyeok-batchim', strokes: copy(GIYEOK) },
  { jamoId: 'jamo:nieun-batchim', strokes: copy(NIEUN) },
  { jamoId: 'jamo:rieul-batchim', strokes: copy(RIEUL) },
  { jamoId: 'jamo:mieum-batchim', strokes: copy(MIEUM) },
  { jamoId: 'jamo:bieup-batchim', strokes: copy(BIEUP) },
  { jamoId: 'jamo:ieung-batchim', strokes: copy(IEUNG) },
];

export function strokesForJamo(jamoId: string): JamoStrokePoint[][] | undefined {
  return jamoStrokes.find((s) => s.jamoId === jamoId)?.strokes;
}

/** [SO] SO-2: the jamo's other accepted forms (`altStrokes`; none: an empty list), or undefined for a jamo the data does not hold. */
export function altStrokesForJamo(jamoId: string): JamoStrokePoint[][][] | undefined {
  const entry = jamoStrokes.find((s) => s.jamoId === jamoId);
  return entry ? (entry.altStrokes ?? []) : undefined;
}

/** [SO] SO-2: every accepted form of the jamo, the form shown (`strokes`) first, for the order and direction checks. */
export function strokeFormsForJamo(jamoId: string): JamoStrokePoint[][][] | undefined {
  const entry = jamoStrokes.find((s) => s.jamoId === jamoId);
  return entry ? [entry.strokes, ...(entry.altStrokes ?? [])] : undefined;
}

/**
 * Jamo whose stroke skeleton a native speaker has reviewed (F-TCH-004 §3.6).
 * Empty until a native-reviewed content PR adds ids; until then the presenter's
 * stroke panel shows each letter's shape, captioned "Letter shape" (AMENDMENTS-
 * STROKE-ORDER-STANDARD OD-SO8, corrected 2026-11-23; a reviewed letter's panel has no caption).
 */
export const reviewedStrokeIds: readonly string[] = [];
