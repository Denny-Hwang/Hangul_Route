import { describe, expect, it } from 'vitest';
import { jamoStrokes, strokesForJamo } from '../../content/jamo-strokes';
import {
  BADGE_RADIUS,
  buildStrokeDiagram,
  describeStroke,
  describeStrokeOrder,
  pointAlong,
  pointsToPathD,
  staticHintHoldMs,
} from '../stroke-diagram';

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
});
