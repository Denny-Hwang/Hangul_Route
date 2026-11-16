import { describe, expect, it } from 'vitest';
import { DEFAULT_PASS_THRESHOLD, scoreTrace } from '../../logic/stroke-scoring';
import { jamoStrokes, strokesForJamo, type JamoStrokePoint } from '../jamo-strokes';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-14 (audit EDU-6): the stroke data follows the standard
 * school stroke order and stroke counts. This file pins, for every jamo in the data, how many
 * strokes it has and which way each stroke runs, against the table below, so an edit to
 * `jamo-strokes.ts` cannot change a count, an order or a direction without changing this table.
 *
 * A stroke is written as its legs: `right`, `down`, `downLeft`, `downRight`, joined with `>` at a
 * corner (`right>down` is the ㄱ shape). `loop` is the closed ring of ㅇ and ㅎ, from the top,
 * counter-clockwise.
 */

type Leg = 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft' | 'up' | 'upRight';
const OCTANTS: readonly Leg[] = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];

/** Screen y grows downward, so atan2(dy, dx) = 0 is right and +90 degrees is down. */
function legOf(a: JamoStrokePoint, b: JamoStrokePoint): Leg {
  const octant = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4));
  return OCTANTS[((octant % 8) + 8) % 8]!;
}

const isLoop = (stroke: readonly JamoStrokePoint[]): boolean =>
  stroke.length > 3 && stroke[0]!.x === stroke[stroke.length - 1]!.x && stroke[0]!.y === stroke[stroke.length - 1]!.y;

/** Shoelace area on screen (y down): > 0 clockwise, < 0 counter-clockwise. */
const signedArea = (stroke: readonly JamoStrokePoint[]): number =>
  stroke.reduce((sum, a, i) => {
    const b = stroke[(i + 1) % stroke.length]!;
    return sum + (a.x * b.y - b.x * a.y) / 2;
  }, 0);

function signature(stroke: readonly JamoStrokePoint[]): string {
  if (isLoop(stroke)) return 'loop';
  const legs: Leg[] = [];
  for (let i = 1; i < stroke.length; i++) {
    const leg = legOf(stroke[i - 1]!, stroke[i]!);
    if (legs[legs.length - 1] !== leg) legs.push(leg);
  }
  return legs.join('>');
}

/** ㄱ shape, ㄴ shape. */
const G = 'right>down';
const N = 'down>right';

/** The standard order: one entry per stroke, in writing order. */
const STANDARD: Readonly<Record<string, readonly string[]>> = {
  // Consonants (AU-14 lists each one).
  'jamo:giyeok': [G],
  'jamo:nieun': [N],
  'jamo:digeut': ['right', N],
  'jamo:rieul': [G, 'right', N],
  'jamo:mieum': ['down', G, 'right'],
  'jamo:bieup': ['down', 'down', 'right', 'right'],
  'jamo:siot': ['downLeft', 'downRight'],
  'jamo:ieung': ['loop'],
  'jamo:jieut': ['right>downLeft', 'downRight'],
  'jamo:chieut': ['down', 'right>downLeft', 'downRight'],
  'jamo:kieuk': [G, 'right'],
  'jamo:tieut': ['right', 'right', N],
  'jamo:pieup': ['right', 'down', 'down', 'right'],
  'jamo:hieut': ['down', 'right', 'loop'],
  // Vowels (AU-14 lists the eight with ticks; ㅡ and ㅣ are one stroke).
  'jamo:a': ['down', 'right'],
  'jamo:ya': ['down', 'right', 'right'],
  'jamo:eo': ['right', 'down'],
  'jamo:yeo': ['right', 'right', 'down'],
  'jamo:o': ['down', 'right'],
  'jamo:yo': ['down', 'down', 'right'],
  'jamo:u': ['right', 'down'],
  'jamo:yu': ['right', 'down', 'down'],
  'jamo:eu': ['right'],
  'jamo:i': ['down'],
  // Finals: written exactly like the same consonant.
  'jamo:giyeok-batchim': [G],
  'jamo:nieun-batchim': [N],
  'jamo:rieul-batchim': [G, 'right', N],
  'jamo:mieum-batchim': ['down', G, 'right'],
  'jamo:bieup-batchim': ['down', 'down', 'right', 'right'],
  'jamo:ieung-batchim': ['loop'],
};

/** Each glyph's box [minX, minY, maxX, maxY] before AU-14: the fix changes order, not layout. */
const BOX: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'jamo:giyeok': [40, 50, 160, 150],
  'jamo:nieun': [50, 40, 160, 150],
  'jamo:digeut': [40, 50, 160, 150],
  'jamo:rieul': [40, 40, 160, 150],
  'jamo:mieum': [50, 40, 150, 150],
  'jamo:bieup': [50, 30, 150, 150],
  'jamo:siot': [50, 40, 160, 150],
  'jamo:ieung': [42.5, 37.5, 157.5, 152.5],
  'jamo:jieut': [40, 50, 160, 150],
  'jamo:chieut': [40, 30, 160, 150],
  'jamo:kieuk': [40, 40, 160, 150],
  'jamo:tieut': [40, 40, 160, 150],
  'jamo:pieup': [40, 50, 160, 150],
  'jamo:hieut': [40, 30, 160, 155],
  'jamo:a': [80, 30, 140, 170],
  'jamo:ya': [80, 30, 140, 170],
  'jamo:eo': [60, 30, 120, 170],
  'jamo:yeo': [60, 30, 120, 170],
  'jamo:o': [30, 60, 170, 100],
  'jamo:yo': [30, 70, 170, 110],
  'jamo:u': [30, 100, 170, 140],
  'jamo:yu': [30, 90, 170, 130],
  'jamo:eu': [30, 100, 170, 100],
  'jamo:i': [100, 30, 100, 170],
  'jamo:giyeok-batchim': [40, 50, 160, 150],
  'jamo:nieun-batchim': [50, 40, 160, 150],
  'jamo:rieul-batchim': [40, 40, 160, 150],
  'jamo:mieum-batchim': [50, 40, 150, 150],
  'jamo:bieup-batchim': [50, 30, 150, 150],
  'jamo:ieung-batchim': [42.5, 37.5, 157.5, 152.5],
};

const strokes = (jamoId: string): JamoStrokePoint[][] => {
  const found = strokesForJamo(jamoId);
  expect(found, jamoId).toBeDefined();
  return found!;
};

const IDS = Object.keys(STANDARD);

describe('stroke data follows the standard stroke order (AU-14)', () => {
  it('the table covers every jamo in the data, and nothing else', () => {
    expect(jamoStrokes.map((j) => j.jamoId).sort()).toEqual([...IDS].sort());
    expect(new Set(jamoStrokes.map((j) => j.jamoId)).size).toBe(jamoStrokes.length);
    expect(Object.keys(BOX).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s: stroke count', (jamoId) => {
    expect(strokes(jamoId)).toHaveLength(STANDARD[jamoId]!.length);
  });

  it.each(IDS)('%s: the first stroke runs the standard way', (jamoId) => {
    expect(signature(strokes(jamoId)[0]!)).toBe(STANDARD[jamoId]![0]);
  });

  it.each(IDS)('%s: every stroke, in order, runs the standard way', (jamoId) => {
    expect(strokes(jamoId).map(signature)).toEqual(STANDARD[jamoId]);
  });

  it.each(IDS)('%s: no stroke runs right to left or bottom to top', (jamoId) => {
    for (const stroke of strokes(jamoId)) {
      if (isLoop(stroke)) continue;
      for (let i = 1; i < stroke.length; i++) {
        const [a, b] = [stroke[i - 1]!, stroke[i]!];
        expect(b.y, 'top to bottom').toBeGreaterThanOrEqual(a.y);
        if (b.y === a.y) expect(b.x, 'left to right').toBeGreaterThan(a.x);
      }
    }
  });

  it.each(IDS)('%s: a loop starts at the top and runs counter-clockwise', (jamoId) => {
    for (const stroke of strokes(jamoId).filter(isLoop)) {
      expect(stroke[0]!.y).toBe(Math.min(...stroke.map((q) => q.y)));
      expect(signedArea(stroke)).toBeLessThan(0);
    }
  });

  it.each(IDS)('%s: the glyph keeps its box', (jamoId) => {
    const pts = strokes(jamoId).flat();
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual(BOX[jamoId]);
  });

  it.each([
    ['jamo:giyeok-batchim', 'jamo:giyeok'],
    ['jamo:nieun-batchim', 'jamo:nieun'],
    ['jamo:rieul-batchim', 'jamo:rieul'],
    ['jamo:mieum-batchim', 'jamo:mieum'],
    ['jamo:bieup-batchim', 'jamo:bieup'],
    ['jamo:ieung-batchim', 'jamo:ieung'],
  ] as const)('%s is written exactly like %s', (batchim, base) => {
    expect(strokes(batchim)).toEqual(strokes(base));
  });
});

describe('the audit regressions (EDU-6)', () => {
  it('ㅁ is three strokes: left bar; top and right as one; bottom bar', () => {
    const [left, topRight, bottom] = strokes('jamo:mieum');
    expect(strokes('jamo:mieum')).toHaveLength(3);
    expect(left).toEqual([{ x: 50, y: 40 }, { x: 50, y: 150 }]);
    expect(topRight).toEqual([{ x: 50, y: 40 }, { x: 150, y: 40 }, { x: 150, y: 150 }]);
    expect(bottom).toEqual([{ x: 50, y: 150 }, { x: 150, y: 150 }]);
    // No stroke is a closed loop any more.
    expect(strokes('jamo:mieum').some(isLoop)).toBe(false);
  });

  it('ㅌ is three strokes: top bar, middle bar, then the ㄴ shape', () => {
    const [top, middle, nieun] = strokes('jamo:tieut');
    expect(strokes('jamo:tieut')).toHaveLength(3);
    expect(top![0]!.y).toBe(top![1]!.y);
    expect(middle![0]!.y).toBe(middle![1]!.y);
    expect(top![0]!.y).toBeLessThan(middle![0]!.y);
    expect(signature(nieun!)).toBe(N);
    // The ㄴ shape starts at the top bar and ends at the bottom right.
    expect(nieun![0]!.y).toBe(top![0]!.y);
    expect(nieun![nieun!.length - 1]!.y).toBeGreaterThan(middle![0]!.y);
  });

  it('ㅗ draws the short tick first, then the long bar', () => {
    const [tick, bar] = strokes('jamo:o');
    expect(signature(tick!)).toBe('down');
    expect(signature(bar!)).toBe('right');
    expect(bar![1]!.x - bar![0]!.x).toBeGreaterThan(tick![1]!.y - tick![0]!.y);
    // The tick comes down onto the bar.
    expect(tick![1]!.y).toBe(bar![0]!.y);
  });

  it('ㅛ draws both ticks first, left one first, then the long bar', () => {
    const [first, second, bar] = strokes('jamo:yo');
    expect(strokes('jamo:yo')).toHaveLength(3);
    expect(signature(first!)).toBe('down');
    expect(signature(second!)).toBe('down');
    expect(first![0]!.x).toBeLessThan(second![0]!.x);
    expect(signature(bar!)).toBe('right');
  });

  it('ㅂ: both upright bars start at the same height, then middle bar, then bottom bar', () => {
    for (const jamoId of ['jamo:bieup', 'jamo:bieup-batchim']) {
      const [left, right, middle, bottom] = strokes(jamoId);
      expect(left![0]!.y).toBe(right![0]!.y);
      expect(left![1]!.y).toBe(right![1]!.y);
      expect(left![0]!.x).toBeLessThan(right![0]!.x);
      expect(middle![0]!.y).toBeLessThan(bottom![0]!.y);
    }
  });

  it('ㅈ is two strokes and ㅊ three: the bar runs into the left leg without a lift', () => {
    expect(strokes('jamo:jieut').map(signature)).toEqual(['right>downLeft', 'downRight']);
    expect(strokes('jamo:chieut').map(signature)).toEqual(['down', 'right>downLeft', 'downRight']);
  });

  it('ㅈ and ㅊ: the right leg leaves from the left leg, not from the air', () => {
    for (const [jamoId, legIdx] of [['jamo:jieut', 0], ['jamo:chieut', 1]] as const) {
      const all = strokes(jamoId);
      const [corner, foot] = [all[legIdx]![1]!, all[legIdx]![2]!];
      const start = all[legIdx + 1]![0]!;
      const t = (start.y - corner.y) / (foot.y - corner.y);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
      expect(Math.abs(corner.x + (foot.x - corner.x) * t - start.x)).toBeLessThan(1);
    }
  });

  it('ㅓ and ㅕ draw the ticks before the long bar; ㅏ ㅑ ㅜ ㅠ draw the long bar first', () => {
    const longest = (jamoId: string): number => {
      const lengths = strokes(jamoId).map((s) => Math.hypot(s[1]!.x - s[0]!.x, s[1]!.y - s[0]!.y));
      return lengths.indexOf(Math.max(...lengths));
    };
    expect(longest('jamo:eo')).toBe(1);
    expect(longest('jamo:yeo')).toBe(2);
    expect(longest('jamo:o')).toBe(1);
    expect(longest('jamo:yo')).toBe(2);
    for (const jamoId of ['jamo:a', 'jamo:ya', 'jamo:u', 'jamo:yu']) expect(longest(jamoId)).toBe(0);
  });
});

/**
 * Coverage is the pass gate (F-004); order and direction only choose a coaching line. So a learner
 * who writes a letter the way the data showed it before AU-14 still passes: the fix must not turn
 * a pass into a retry.
 */
describe('a letter written the way the old data showed it still passes (AU-14)', () => {
  const q = (x: number, y: number): JamoStrokePoint => ({ x, y });
  /** A finger sample every 4 units along the polyline. */
  const walk = (points: JamoStrokePoint[]): JamoStrokePoint[] => {
    const out: JamoStrokePoint[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i]!, points[i + 1]!];
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
      for (let s = 0; s < steps; s++) out.push(q(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps));
    }
    out.push(points[points.length - 1]!);
    return out;
  };

  const OLD: ReadonlyArray<[string, string, JamoStrokePoint[][]]> = [
    ['ㅁ as one closed stroke', 'jamo:mieum', [[q(50, 40), q(150, 40), q(150, 150), q(50, 150), q(50, 40)]]],
    ['ㅂ with the short right bar', 'jamo:bieup', [[q(50, 30), q(50, 150)], [q(150, 60), q(150, 150)], [q(50, 100), q(150, 100)], [q(50, 150), q(150, 150)]]],
    ['ㅈ with the left leg from the middle of the bar', 'jamo:jieut', [[q(40, 50), q(160, 50)], [q(110, 50), q(50, 150)], [q(110, 80), q(160, 150)]]],
    ['ㅊ with the left leg from the middle of the bar', 'jamo:chieut', [[q(100, 30), q(100, 55)], [q(40, 70), q(160, 70)], [q(110, 70), q(50, 150)], [q(110, 100), q(160, 150)]]],
    ['ㅌ in four strokes', 'jamo:tieut', [[q(40, 40), q(160, 40)], [q(50, 40), q(50, 95)], [q(40, 95), q(160, 95)], [q(50, 95), q(50, 150), q(160, 150)]]],
    ['ㅗ with the bar first', 'jamo:o', [[q(30, 100), q(170, 100)], [q(100, 60), q(100, 100)]]],
    ['ㅛ with the bar first', 'jamo:yo', [[q(30, 110), q(170, 110)], [q(75, 70), q(75, 110)], [q(125, 70), q(125, 110)]]],
  ];

  it.each(OLD)('%s', (_name, jamoId, old) => {
    const r = scoreTrace({ target: strokes(jamoId), drawn: old.map(walk), checkOrder: true, checkDirection: true });
    expect(r.coverage).toBeGreaterThanOrEqual(DEFAULT_PASS_THRESHOLD);
  });

  it.each(IDS)('%s traced along the data passes, in order, every stroke the right way', (jamoId) => {
    const r = scoreTrace({ target: strokes(jamoId), drawn: strokes(jamoId).map(walk), checkOrder: true, checkDirection: true });
    expect(r.coverage).toBe(1);
    expect(r.orderCorrect).toBe(true);
    expect(r.directionsCorrect).toBe(true);
    expect(r.passWithOrder).toBe(true);
  });

  it('the bar of ㅗ before its tick is now the order miss, and the tick first is clean', () => {
    const [tick, bar] = strokes('jamo:o').map(walk);
    expect(scoreTrace({ target: strokes('jamo:o'), drawn: [bar!, tick!], checkOrder: true }).orderCorrect).toBe(false);
    expect(scoreTrace({ target: strokes('jamo:o'), drawn: [tick!, bar!], checkOrder: true }).orderCorrect).toBe(true);
  });
});
