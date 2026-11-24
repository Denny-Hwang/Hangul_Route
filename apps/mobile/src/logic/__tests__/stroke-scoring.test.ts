import { describe, expect, it } from 'vitest';
import { jamoStrokes, strokeFormsForJamo } from '../../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, bestFormIndex, scoreTrace, scoreTraceForms } from '../stroke-scoring';

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

  it('going round the other way is reported at scoring level, flagged as a closed loop', () => {
    // The scorer reports the raw winding mismatch; the closed-loop flag lets the UI
    // word it as a loop hint instead of left-to-right (see trace-copy.test.ts).
    const reversed = [...square].reverse();
    const r = scoreTrace({ target: [square], drawn: [walk(reversed)], checkDirection: true });
    expect(r.coverage).toBeGreaterThan(0.95);
    expect(r.directionsPerTarget).toEqual([false]);
    expect(r.closedPerTarget).toEqual([true]);
  });

  it('flags open strokes as not closed', () => {
    const line: Pt[] = [
      { x: 40, y: 50 },
      { x: 160, y: 50 },
    ];
    const r = scoreTrace({ target: [line], drawn: [walk(line)], checkDirection: true });
    expect(r.closedPerTarget).toEqual([false]);
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

// ─────────────────────────────────────────
// [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-2 (OD-SO4, OD-SO11): a letter the table accepts in
// more than one form. The pass stays the ghost's (coverage of the form shown); order and
// direction are read from the form the drawing follows, so they hold for any listed form.
// ─────────────────────────────────────────

describe('bestFormIndex (SO-2, OD-SO12)', () => {
  const PASS = DEFAULT_PASS_THRESHOLD;
  it('is the first form with nothing to choose from', () => {
    expect(bestFormIndex([])).toBe(0);
    expect(bestFormIndex([{ coverage: 0 }, { coverage: 0 }])).toBe(0);
  });
  it('prefers a form the drawing passes (OD-SO12), however it reads on order and direction', () => {
    expect(bestFormIndex([{ coverage: PASS - 0.01, orderCorrect: true, directionsPerTarget: [true] }, { coverage: PASS, orderCorrect: false, directionsPerTarget: [false] }])).toBe(1);
  });
  it('among forms it passes (or fails) alike: in order, then the fewest strokes the wrong way, then the most coverage', () => {
    expect(bestFormIndex([{ coverage: 1, orderCorrect: false, directionsPerTarget: [true] }, { coverage: 0.7, orderCorrect: true, directionsPerTarget: [false, false] }])).toBe(1);
    expect(bestFormIndex([{ coverage: 1, orderCorrect: true, directionsPerTarget: [false, true] }, { coverage: 0.7, orderCorrect: true, directionsPerTarget: [true, true, true] }])).toBe(1);
    expect(bestFormIndex([{ coverage: 0.2, orderCorrect: false, directionsPerTarget: [false, false] }, { coverage: 0.1, orderCorrect: false, directionsPerTarget: [true, false] }])).toBe(1);
    expect(bestFormIndex([{ coverage: 0.9, orderCorrect: true, directionsPerTarget: [true] }, { coverage: 0.95, orderCorrect: true, directionsPerTarget: [true] }])).toBe(1);
  });
  it('keeps the earlier form on a full tie: the form shown (AU-14) wins', () => {
    expect(bestFormIndex([{ coverage: 1, orderCorrect: true, directionsPerTarget: [true, false] }, { coverage: 1, orderCorrect: true, directionsPerTarget: [false, true] }])).toBe(0);
    expect(bestFormIndex([{ coverage: 1, directionsPerTarget: [false] }, { coverage: 1, directionsPerTarget: [false] }, { coverage: 1, directionsPerTarget: [true] }])).toBe(2);
  });
});

describe('scoreTraceForms (SO-2)', () => {
  const formsOf = (id: string): Pt[][][] => strokeFormsForJamo(id)!;
  const traced = (form: Pt[][]): Pt[][] => form.map(walk);

  it('with one form it is scoreTrace on that form', () => {
    const [bieup] = formsOf('jamo:bieup');
    const drawn = [walk(bieup![1]!), walk(bieup![0]!)];
    const input = { drawn, checkOrder: true, checkDirection: true } as const;
    expect(scoreTraceForms({ forms: [bieup!], ...input })).toEqual({ ...scoreTrace({ target: bieup!, ...input }), form: 0 });
    expect(scoreTraceForms({ forms: [], drawn })).toEqual({ ...scoreTrace({ target: [], drawn }), form: 0 });
  });

  it('without order or direction checks it is the best-fitting form\'s coverage (OD-SO12)', () => {
    const forms = formsOf('jamo:jieut');
    const drawn = traced(forms[1]!);
    expect(scoreTraceForms({ forms, drawn })).toEqual({ ...scoreTrace({ target: forms[1]!, drawn }), form: 1 });
  });

  // OD-SO12: two forms of different shape; the drawing passes only on the second.
  const across: Pt[][] = [[{ x: 30, y: 100 }, { x: 170, y: 100 }]];
  const down: Pt[][] = [[{ x: 100, y: 30 }, { x: 100, y: 170 }]];
  const slash: Pt[][] = [[{ x: 30, y: 30 }, { x: 170, y: 170 }]];

  it('a drawing that fits only another accepted form passes on it: coverage, per-stroke coverage and order are that form\'s', () => {
    const drawn = traced(down);
    expect(scoreTrace({ target: across, drawn }).coverage).toBeLessThan(DEFAULT_PASS_THRESHOLD);
    const r = scoreTraceForms({ forms: [across, down], drawn, checkOrder: true, checkDirection: true });
    expect(r).toEqual({ ...scoreTrace({ target: down, drawn, checkOrder: true, checkDirection: true }), form: 1 });
    expect(r.coverage).toBe(1);
    expect(r.passWithOrder).toBe(true);
  });

  it('a drawing that fits no accepted form still fails', () => {
    const r = scoreTraceForms({ forms: [across, down], drawn: traced(slash), checkOrder: true, checkDirection: true });
    expect(r.coverage).toBeLessThan(DEFAULT_PASS_THRESHOLD);
    expect(r.passWithOrder).toBe(false);
    // ㅈ drawn as its bar alone fits neither of its forms.
    const jieut = formsOf('jamo:jieut');
    expect(scoreTraceForms({ forms: jieut, drawn: [walk(jieut[1]![0]!)] }).coverage).toBeLessThan(DEFAULT_PASS_THRESHOLD);
  });

  it.each(['jamo:jieut', 'jamo:chieut', 'jamo:tieut', 'jamo:hieut'])(
    '%s: every accepted form traced passes on itself, in order, every stroke the right way (OD-SO12)',
    (id) => {
      const forms = formsOf(id);
      expect(forms.length).toBeGreaterThan(1);
      forms.forEach((form, i) => {
        const drawn = traced(form);
        const r = scoreTraceForms({ forms, drawn, checkOrder: true, checkDirection: true });
        expect(r.form, `${id} form ${i}`).toBe(i);
        expect(r.orderCorrect).toBe(true);
        expect(r.directionsCorrect).toBe(true);
        expect(r.directionsPerTarget).toHaveLength(form.length);
        expect(r.perStrokeCoverage).toEqual(scoreTrace({ target: form, drawn }).perStrokeCoverage);
        expect(r.coverage).toBe(1);
        expect(r.passWithOrder).toBe(true);
      });
    },
  );

  it('reads only the check asked for: order alone, or direction alone', () => {
    const forms = formsOf('jamo:chieut');
    const drawn = traced(forms[1]!);
    const orderOnly = scoreTraceForms({ forms, drawn, checkOrder: true });
    expect(orderOnly.orderCorrect).toBe(true);
    expect(orderOnly.passWithOrder).toBe(true);
    expect(orderOnly.directionsPerTarget).toBeUndefined();
    const directionOnly = scoreTraceForms({ forms, drawn, checkDirection: true });
    expect(directionOnly.form).toBe(1);
    expect(directionOnly.directionsCorrect).toBe(true);
    expect(directionOnly.orderCorrect).toBeUndefined();
    expect(directionOnly.passWithOrder).toBeUndefined();
  });

  it('ㅈ, ㅊ and ㅎ traced in their other form read as that form (the form shown has a stroke the wrong way)', () => {
    for (const id of ['jamo:jieut', 'jamo:chieut', 'jamo:hieut']) {
      const forms = formsOf(id);
      expect(scoreTrace({ target: forms[0]!, drawn: traced(forms[1]!), checkDirection: true }).directionsCorrect, id).toBe(false);
      expect(scoreTraceForms({ forms, drawn: traced(forms[1]!), checkOrder: true, checkDirection: true }).form, id).toBe(1);
    }
  });

  it('the form shown, traced, reads as the form shown (no other form wins a tie)', () => {
    for (const { jamoId } of jamoStrokes) {
      const forms = formsOf(jamoId);
      expect(scoreTraceForms({ forms, drawn: traced(forms[0]!), checkOrder: true, checkDirection: true }).form, jamoId).toBe(0);
    }
  });

  it('ㅈ in 3 lifts over the 2-stroke ghost (bar; slant; right leg) reads as the 3-stroke form: no wrong-way stroke', () => {
    const forms = formsOf('jamo:jieut');
    const [barAndSlant, leg] = forms[0]!;
    const [barStart, corner, foot] = barAndSlant!;
    const drawn = [walk([barStart!, corner!]), walk([corner!, foot!]), walk(leg!)];
    expect(scoreTrace({ target: forms[0]!, drawn, checkOrder: true, checkDirection: true }).directionsCorrect).toBe(false);
    const r = scoreTraceForms({ forms, drawn, checkOrder: true, checkDirection: true });
    expect(r.form).toBe(1);
    expect(r.orderCorrect).toBe(true);
    expect(r.directionsCorrect).toBe(true);
  });

  it('ㅎ with the top stroke left to right and the ring clockwise: only the ring is wrong (a loop nudge, never left-to-right)', () => {
    const forms = formsOf('jamo:hieut');
    const [top, bar, ring] = forms[1]!;
    const r = scoreTraceForms({ forms, drawn: [walk(top!), walk(bar!), walk([...ring!].reverse())], checkOrder: true, checkDirection: true });
    expect(r.form).toBe(1);
    expect(r.directionsPerTarget).toEqual([true, true, false]);
    expect(r.closedPerTarget).toEqual([false, false, true]);
  });

  it('ㅌ Variant C (ㄷ first, then the middle bar) is not accepted: still out of order', () => {
    const forms = formsOf('jamo:tieut');
    const [top, middle, nieun] = forms[0]!;
    const r = scoreTraceForms({ forms, drawn: [walk(top!), walk(nieun!), walk(middle!)], checkOrder: true, checkDirection: true });
    expect(r.orderCorrect).toBe(false);
    expect(r.passWithOrder).toBe(false);
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });

  it('an out-of-order drawing is out of order on every form, and never loses the ghost\'s pass', () => {
    const forms = formsOf('jamo:chieut');
    const drawn = traced(forms[1]!).reverse();
    const r = scoreTraceForms({ forms, drawn, checkOrder: true, checkDirection: true });
    expect(r.orderCorrect).toBe(false);
    expect(r.coverage).toBeGreaterThanOrEqual(scoreTrace({ target: forms[0]!, drawn }).coverage);
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });
});
