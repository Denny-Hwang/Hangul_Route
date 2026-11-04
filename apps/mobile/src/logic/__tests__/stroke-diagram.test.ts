import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { jamoStrokes, strokesForJamo } from '../../content/jamo-strokes';
import {
  BADGE_RADIUS,
  buildStrokeDiagram,
  inkPathD,
  describeStroke as describeStrokeWith,
  describeStrokeOrder as describeStrokeOrderWith,
  pointAlong,
  pointsToPathD,
  staticHintHoldMs,
} from '../stroke-diagram';

// The words are a11y.minigame.strokeOrder (F-I18N-001 PR 7b).
const STROKE_ORDER = getMessages('en').a11y.minigame.strokeOrder;
const describeStroke = (stroke: Parameters<typeof describeStrokeWith>[0]): string => describeStrokeWith(stroke, STROKE_ORDER);
const describeStrokeOrder = (target: Parameters<typeof describeStrokeOrderWith>[0]): string =>
  describeStrokeOrderWith(target, STROKE_ORDER);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('pointsToPathD', () => {
  it('is empty for no points', () => {
    expect(pointsToPathD([])).toBe('');
  });
  it('moves to the first point and lines to the rest', () => {
    expect(
      pointsToPathD([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ]),
    ).toBe('M 1 2 L 3 4 L 5 6');
  });
});

describe('pointAlong', () => {
  const ell = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];
  it('walks the polyline by arc length, round corners included', () => {
    expect(pointAlong(ell, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(ell, 50)).toEqual({ x: 50, y: 0 });
    expect(pointAlong(ell, 150)).toEqual({ x: 100, y: 50 });
  });
  it('clamps to the ends', () => {
    expect(pointAlong(ell, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(ell, 999)).toEqual({ x: 100, y: 100 });
  });
  it('handles a single point and an empty stroke', () => {
    expect(pointAlong([{ x: 7, y: 8 }], 30)).toEqual({ x: 7, y: 8 });
    expect(pointAlong([], 30)).toEqual({ x: 0, y: 0 });
  });
});

describe('buildStrokeDiagram — reduced-motion "Show me" (F-007 §3.4)', () => {
  it('numbers every stroke in writing order and draws it whole', () => {
    const target = strokesForJamo('jamo:bieup')!;
    const items = buildStrokeDiagram(target);
    expect(items.map((i) => i.order)).toEqual([1, 2, 3, 4]);
    items.forEach((item, idx) => {
      expect(item.d).toBe(pointsToPathD(target[idx]!));
    });
  });

  it('puts the first badge on the stroke start', () => {
    const target = strokesForJamo('jamo:giyeok')!;
    const [first] = buildStrokeDiagram(target);
    expect(first!.badge).toEqual(target[0]![0]);
  });

  it('points the arrow the way the stroke is written', () => {
    const leftToRight = [
      [
        { x: 40, y: 100 },
        { x: 160, y: 100 },
      ],
    ];
    const [item] = buildStrokeDiagram(leftToRight);
    expect(item!.arrow).not.toBeNull();
    expect(item!.arrow!.tip.x).toBeGreaterThan(item!.arrow!.tail.x);
    expect(item!.arrow!.tip.y).toBeCloseTo(100);
    // The arrow starts past the badge so the number stays readable.
    expect(item!.arrow!.tail.x).toBeGreaterThanOrEqual(40 + BADGE_RADIUS);
    expect(item!.arrow!.d.startsWith('M ')).toBe(true);
    expect(item!.arrow!.head.startsWith('M ')).toBe(true);
  });

  it('shows the ㅇ circle starting off counter-clockwise (leftward from the top)', () => {
    const [item] = buildStrokeDiagram(strokesForJamo('jamo:ieung')!);
    expect(item!.arrow!.tip.x).toBeLessThan(item!.arrow!.tail.x);
    expect(item!.arrow!.tip.y).toBeGreaterThan(item!.arrow!.tail.y);
  });

  it('a dot-sized stroke gets a badge but no arrow', () => {
    const [item] = buildStrokeDiagram([[{ x: 100, y: 100 }]]);
    expect(item!.badge).toEqual({ x: 100, y: 100 });
    expect(item!.arrow).toBeNull();
  });

  it('skips empty strokes without breaking the numbering', () => {
    const items = buildStrokeDiagram([
      [],
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.order).toBe(1);
  });

  it('nudges a badge along its stroke when another stroke starts in the same place (ㄹ)', () => {
    const target = strokesForJamo('jamo:rieul')!;
    const items = buildStrokeDiagram(target);
    // ㄹ strokes 2 and 3 both start at (40, 95).
    expect(target[1]![0]).toEqual(target[2]![0]);
    expect(dist(items[1]!.badge, items[2]!.badge)).toBeGreaterThanOrEqual(BADGE_RADIUS * 2);
  });

  it.each(jamoStrokes.map((j) => [j.jamoId, j.strokes] as const))(
    '%s: badges never overlap and arrows stay inside the 200 box',
    (_id, strokes) => {
      const items = buildStrokeDiagram(strokes);
      expect(items).toHaveLength(strokes.length);
      for (let i = 0; i < items.length; i++) {
        for (let j = 0; j < i; j++) {
          expect(dist(items[i]!.badge, items[j]!.badge)).toBeGreaterThanOrEqual(BADGE_RADIUS * 2);
        }
        const a = items[i]!.arrow;
        if (a) {
          for (const p of [a.tail, a.tip]) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(200);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(200);
          }
        }
      }
    },
  );
});

describe('staticHintHoldMs', () => {
  it('holds longer for more strokes, within a readable window', () => {
    expect(staticHintHoldMs(1)).toBeGreaterThanOrEqual(2000);
    expect(staticHintHoldMs(4)).toBeGreaterThan(staticHintHoldMs(1));
    expect(staticHintHoldMs(40)).toBeLessThanOrEqual(5000);
    expect(staticHintHoldMs(0)).toBeGreaterThanOrEqual(2000);
  });
});

describe('describeStrokeOrder — text alternative for the still diagram', () => {
  it('describes a bent stroke leg by leg (ㄱ goes right, then down)', () => {
    expect(describeStroke(strokesForJamo('jamo:giyeok')![0]!)).toBe('right, then down');
  });

  it('describes a ring as a loop (ㅇ)', () => {
    expect(describeStroke(strokesForJamo('jamo:ieung')![0]!)).toBe('a loop');
  });

  it('describes straight strokes by direction', () => {
    expect(describeStroke([{ x: 30, y: 100 }, { x: 170, y: 100 }])).toBe('right');
    expect(describeStroke([{ x: 100, y: 30 }, { x: 100, y: 170 }])).toBe('down');
    expect(describeStroke([{ x: 170, y: 30 }, { x: 30, y: 170 }])).toBe('down and left');
  });

  it('numbers the strokes in writing order', () => {
    const text = describeStrokeOrder(strokesForJamo('jamo:nieun')!);
    expect(text).toBe('Stroke order. One stroke. 1: down, then right.');
    const multi = describeStrokeOrder(strokesForJamo('jamo:digeut')!);
    expect(multi).toMatch(/^Stroke order\. \d strokes\. 1: /);
    expect(multi).toContain('2: ');
  });

  it('gives every shipped letter a non-empty description with one entry per stroke', () => {
    for (const j of jamoStrokes) {
      const text = describeStrokeOrder(j.strokes);
      expect(text.length).toBeGreaterThan(10);
      for (let n = 1; n <= j.strokes.length; n++) expect(text).toContain(`${n}: `);
    }
  });

  it('copes with an empty target', () => {
    expect(describeStrokeOrder([])).toBe('Stroke order guide');
  });

  it('describes a curve that turns too often by where it ends', () => {
    const zigzag = [
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 80 }, { x: 120, y: 80 },
    ];
    expect(describeStroke(zigzag)).toBe('curving down and right');
    expect(describeStroke([{ x: 5, y: 5 }])).toBe('a dot');
  });

  it('takes its words as a parameter (en-XA)', () => {
    const pseudo = pseudoLocalize(getMessages('en')).a11y.minigame.strokeOrder;
    const target = strokesForJamo('jamo:digeut')!;
    expect(describeStrokeOrderWith([], pseudo)).toBe(pseudoText('Stroke order guide'));
    // Composed messages nest: the direction word is pseudo text inside the pseudo legs line.
    expect(describeStrokeWith([{ x: 30, y: 100 }, { x: 170, y: 100 }], pseudo)).toContain(pseudoText('right'));
    expect(describeStrokeWith([{ x: 5, y: 5 }], pseudo)).toBe(pseudoText('a dot'));
    expect(describeStrokeOrderWith(target, pseudo).startsWith('[')).toBe(true);
  });
});

// NB-3: the learner's ink is the finger's samples. Drawn as straight joins, a
// quick circle (few samples) shows corners; the ink is smoothed through the
// midpoints so it turns without a kink, and still starts and ends where the
// finger did.
describe('inkPathD', () => {
  it('draws nothing for no points and a bare move for one', () => {
    expect(inkPathD([])).toBe('');
    expect(inkPathD([{ x: 3, y: 4 }])).toBe('M 3 4');
  });

  it('two points are one straight line', () => {
    expect(inkPathD([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M 0 0 L 10 5');
  });

  it('bends through each sample as a curve to the next midpoint, ending on the last sample', () => {
    const d = inkPathD([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
    ]);
    expect(d).toBe('M 0 0 Q 10 0 10 5 Q 10 10 15 10 L 20 10');
  });

  /** Unit tangents in and out at every joint of the flattened path; returns the sharpest turn in degrees. */
  function sharpestTurn(d: string): number {
    const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const tokens = d.match(/[MLQ]/g) ?? [];
    const segs: Array<{ from: [number, number]; ctl?: [number, number]; to: [number, number] }> = [];
    let k = 0;
    let at: [number, number] = [0, 0];
    for (const t of tokens) {
      if (t === 'M') {
        at = [nums[k]!, nums[k + 1]!];
        k += 2;
      } else if (t === 'L') {
        const to: [number, number] = [nums[k]!, nums[k + 1]!];
        segs.push({ from: at, to });
        at = to;
        k += 2;
      } else {
        const ctl: [number, number] = [nums[k]!, nums[k + 1]!];
        const to: [number, number] = [nums[k + 2]!, nums[k + 3]!];
        segs.push({ from: at, ctl, to });
        at = to;
        k += 4;
      }
    }
    const dir = (a: [number, number], b: [number, number]): number => Math.atan2(b[1] - a[1], b[0] - a[0]);
    let worst = 0;
    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1]!;
      const next = segs[i]!;
      const out = dir(prev.ctl ?? prev.from, prev.to);
      const into = dir(next.from, next.ctl ?? next.to);
      let turn = Math.abs(into - out);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      worst = Math.max(worst, (turn * 180) / Math.PI);
    }
    return worst;
  }

  it('a quick circle (12 samples) has no corner, where straight joins turn 30 degrees', () => {
    const samples = Array.from({ length: 13 }, (_, i) => {
      const t = (2 * Math.PI * i) / 12;
      return { x: 100 - 60 * Math.sin(t), y: 95 - 60 * Math.cos(t) };
    });
    expect(sharpestTurn(pointsToPathD(samples))).toBeCloseTo(30, 0);
    expect(sharpestTurn(inkPathD(samples))).toBeLessThan(0.5);
  });
});
