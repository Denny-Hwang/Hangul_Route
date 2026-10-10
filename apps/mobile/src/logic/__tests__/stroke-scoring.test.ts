import { describe, expect, it } from 'vitest';
import { jamoStrokes } from '../../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../stroke-scoring';

describe('scoreTrace', () => {
  const target = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  ];

  it('returns coverage 0 and visitedDrawn=false on empty drawn', () => {
    const r = scoreTrace({ target, drawn: [] });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(false);
  });

  it('returns coverage 0 and visitedDrawn=false when drawn strokes are empty arrays', () => {
    const r = scoreTrace({ target, drawn: [[], []] });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(false);
  });

  it('returns coverage 1.0 when drawn perfectly overlaps the target', () => {
    // Densely sample the same path
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 25 },
        { x: 100, y: 50 },
        { x: 100, y: 75 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBeGreaterThan(0.95);
  });

  it('returns ~0.5 coverage when drawn covers half the target', () => {
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    // Top half horizontal segment covered well; vertical leg untouched
    expect(r.coverage).toBeGreaterThan(0.35);
    expect(r.coverage).toBeLessThan(0.7);
  });

  it('respects the tolerance — drawn far outside fails', () => {
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 500, y: 500 },
        { x: 600, y: 600 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBe(0);
    expect(r.visitedDrawn).toBe(true);
  });

  it('a drawing inside default tolerance passes the threshold', () => {
    // Slightly imperfect L-shape but within 24-unit tolerance throughout
    const drawn: Array<Array<{ x: number; y: number }>> = [
      [
        { x: 2, y: 1 },
        { x: 20, y: 2 },
        { x: 40, y: 3 },
        { x: 60, y: 2 },
        { x: 80, y: 4 },
        { x: 100, y: 5 },
        { x: 101, y: 25 },
        { x: 100, y: 50 },
        { x: 102, y: 75 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({ target, drawn });
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });

  it('returns one coverage value per target stroke', () => {
    const multiTarget = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({
      target: multiTarget,
      drawn: [
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
      ],
    });
    expect(r.perStrokeCoverage).toHaveLength(2);
    // First stroke covered, second not
    expect(r.perStrokeCoverage[0]!).toBeGreaterThan(0.7);
    expect(r.perStrokeCoverage[1]!).toBe(0);
  });

  it('empty target returns coverage 0', () => {
    const r = scoreTrace({ target: [], drawn: [[{ x: 0, y: 0 }]] });
    expect(r.coverage).toBe(0);
    expect(r.perStrokeCoverage).toEqual([]);
  });
});

// ─────────────────────────────────────────
// F-005 stroke order
// ─────────────────────────────────────────

describe('scoreTrace with checkOrder', () => {
  const twoStrokeTarget = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ],
  ];

  it('reports orderCorrect=true when strokes drawn in target order', () => {
    const r = scoreTrace({
      target: twoStrokeTarget,
      drawn: [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [
          { x: 0, y: 100 },
          { x: 100, y: 100 },
        ],
      ],
      checkOrder: true,
    });
    expect(r.orderCorrect).toBe(true);
  });

  it('reports orderCorrect=false when strokes drawn out of order', () => {
    const r = scoreTrace({
      target: twoStrokeTarget,
      drawn: [
        // drew the bottom first (target index 1) then the top (target index 0)
        [
          { x: 0, y: 100 },
          { x: 100, y: 100 },
        ],
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      ],
      checkOrder: true,
    });
    expect(r.orderCorrect).toBe(false);
  });

  it('checkOrder omitted leaves orderCorrect undefined', () => {
    const r = scoreTrace({
      target: twoStrokeTarget,
      drawn: [[{ x: 50, y: 0 }]],
    });
    expect(r.orderCorrect).toBeUndefined();
  });
});

// ─────────────────────────────────────────
// F-006 stroke direction
// ─────────────────────────────────────────

describe('scoreTrace with checkDirection', () => {
  const ltrTarget = [
    [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ],
  ];

  it('reports directionsCorrect=true when drawn matches target direction', () => {
    const r = scoreTrace({
      target: ltrTarget,
      drawn: [
        [
          { x: 5, y: 50 },
          { x: 50, y: 51 },
          { x: 95, y: 49 },
        ],
      ],
      checkDirection: true,
    });
    expect(r.directionsCorrect).toBe(true);
    expect(r.directionsPerTarget).toEqual([true]);
  });

  it('reports directionsCorrect=false when drawn runs the wrong way', () => {
    const r = scoreTrace({
      target: ltrTarget,
      drawn: [
        [
          { x: 95, y: 50 },
          { x: 50, y: 50 },
          { x: 5, y: 50 },
        ],
      ],
      checkDirection: true,
    });
    expect(r.directionsCorrect).toBe(false);
    expect(r.directionsPerTarget).toEqual([false]);
  });

  it('per-stroke direction array length matches target strokes', () => {
    // F-006 multi-stroke check
    const twoStrokes = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({
      target: twoStrokes,
      drawn: [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        [
          { x: 100, y: 100 },
          { x: 100, y: 0 },
        ], // reversed
      ],
      checkDirection: true,
    });
    expect(r.directionsPerTarget).toHaveLength(2);
    expect(r.directionsPerTarget?.[0]).toBe(true);
    expect(r.directionsPerTarget?.[1]).toBe(false);
    expect(r.directionsCorrect).toBe(false);
  });
});

// ─────────────────────────────────────────
// F-008 derived passWithOrder
// ─────────────────────────────────────────

describe('scoreTrace passWithOrder (F-008)', () => {
  const lShape = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  ];

  it('passWithOrder=true when coverage passes AND order correct', () => {
    const densely: Array<{ x: number; y: number }> = [];
    // Walk the L densely so coverage is well above threshold
    for (let x = 0; x <= 100; x += 5) densely.push({ x, y: 0 });
    for (let y = 0; y <= 100; y += 5) densely.push({ x: 100, y });
    const r = scoreTrace({
      target: lShape,
      drawn: [densely],
      checkOrder: true,
    });
    expect(r.coverage).toBeGreaterThan(0.9);
    expect(r.orderCorrect).toBe(true);
    expect(r.passWithOrder).toBe(true);
  });

  it('passWithOrder=false when coverage fails (even if drawn nothing)', () => {
    const r = scoreTrace({
      target: lShape,
      drawn: [],
      checkOrder: true,
    });
    expect(r.passWithOrder).toBe(false);
  });

  it('passWithOrder=false when coverage passes but order wrong', () => {
    // Two strokes drawn in reversed order vs target
    const twoStrokes = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
    ];
    const r = scoreTrace({
      target: twoStrokes,
      drawn: [
        // Bottom drawn first (target idx 1), then top (target idx 0)
        [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
          { x: 100, y: 100 },
        ],
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
        ],
      ],
      checkOrder: true,
    });
    expect(r.orderCorrect).toBe(false);
    expect(r.coverage).toBeGreaterThan(0.65);
    expect(r.passWithOrder).toBe(false);
  });

  it('passWithOrder undefined when checkOrder omitted', () => {
    const r = scoreTrace({
      target: lShape,
      drawn: [[{ x: 50, y: 0 }]],
    });
    expect(r.passWithOrder).toBeUndefined();
  });
});


// ─────────────────────────────────────────
// F-006 closed loops (ㅁ ㅇ ㅎ + batchim): start == end, so the chord is a
// zero vector. Direction must come from the loop's winding instead, or every
// pass on these letters shows "Try drawing left-to-right next time."
// ─────────────────────────────────────────

type Pt = { x: number; y: number };

/** Walk a polyline at ~4-unit steps, like a finger would report it. */
function walk(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s < steps; s++) {
      out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

describe('scoreTrace direction on closed loops', () => {
  // Clockwise on screen (y grows downward): top-left → top-right → bottom-right → bottom-left.
  const square: Pt[] = [
    { x: 50, y: 40 },
    { x: 150, y: 40 },
    { x: 150, y: 150 },
    { x: 50, y: 150 },
    { x: 50, y: 40 },
  ];

  it('tracing the loop exactly reports the direction as correct', () => {
    const r = scoreTrace({ target: [square], drawn: [walk(square)], checkDirection: true });
    expect(r.coverage).toBeGreaterThan(0.95);
    expect(r.directionsPerTarget).toEqual([true]);
    expect(r.directionsCorrect).toBe(true);
  });

  it('the same way round from a different starting corner is still correct', () => {
    const fromBottomRight: Pt[] = [
      { x: 150, y: 150 },
      { x: 50, y: 150 },
      { x: 50, y: 40 },
      { x: 150, y: 40 },
      { x: 150, y: 150 },
    ];
    const r = scoreTrace({ target: [square], drawn: [walk(fromBottomRight)], checkDirection: true });
    expect(r.directionsCorrect).toBe(true);
  });

  it('an open loop that stops short of closing is judged by its winding too', () => {
    const r = scoreTrace({ target: [square], drawn: [walk(square.slice(0, 4))], checkDirection: true });
    expect(r.directionsCorrect).toBe(true);
  });

  it('going round the other way is reported as the wrong direction', () => {
    const reversed = [...square].reverse();
    const r = scoreTrace({ target: [square], drawn: [walk(reversed)], checkDirection: true });
    expect(r.coverage).toBeGreaterThan(0.95);
    expect(r.directionsCorrect).toBe(false);
  });

  it('one straight side matched to the loop carries no winding — never nudge on it', () => {
    // A child writing ㅁ the Korean way starts with the left side (ㅣ): a line has no winding.
    const leftSide: Pt[] = [
      { x: 50, y: 40 },
      { x: 50, y: 150 },
    ];
    const r = scoreTrace({ target: [square], drawn: [walk(leftSide)], checkDirection: true });
    expect(r.directionsCorrect).toBe(true);
  });

  it('open strokes keep the start→end rule (F-006 §3.2)', () => {
    const tick: Pt[] = [
      { x: 40, y: 50 },
      { x: 160, y: 50 },
      { x: 160, y: 150 },
    ];
    expect(scoreTrace({ target: [tick], drawn: [walk(tick)], checkDirection: true }).directionsCorrect).toBe(true);
    expect(
      scoreTrace({ target: [tick], drawn: [walk([...tick].reverse())], checkDirection: true }).directionsCorrect,
    ).toBe(false);
  });

  it('a target loop with no area (out and back) has no direction to get wrong', () => {
    const outAndBack: Pt[] = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
      { x: 50, y: 100 },
    ];
    const r = scoreTrace({ target: [outAndBack], drawn: [walk(outAndBack)], checkDirection: true });
    expect(r.directionsCorrect).toBe(true);
  });
});

describe('scoreTrace on every shipped jamo skeleton', () => {
  it.each(jamoStrokes.map((j) => [j.jamoId, j.strokes] as const))(
    '%s traced exactly passes with the right order and direction',
    (_id, strokes) => {
      const r = scoreTrace({
        target: strokes,
        drawn: strokes.map((s) => walk(s)),
        checkOrder: true,
        checkDirection: true,
      });
      expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
      expect(r.orderCorrect).toBe(true);
      expect(r.directionsCorrect).toBe(true);
    },
  );
});
