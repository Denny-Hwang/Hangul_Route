import { describe, expect, it } from 'vitest';
import {
  arc,
  blob,
  circle,
  curve,
  drop,
  ellipse,
  face,
  groundShadow,
  leaf,
  line,
  path,
  poly,
  r1,
  rect,
  star,
} from '../builders';
import { parsePath } from '../path';
import type { WordArtShape } from '../types';

/** F-VOC-002 §3.2: pure builders, one-decimal coordinates, paint last. */

const INK = { s: 'text.primary', sw: 3 } as const;

function pathOf(shape: WordArtShape): string {
  if (shape.t !== 'path') throw new Error(`expected a path, got ${shape.t}`);
  return shape.d;
}

/** Every number written in a path. */
function numbersIn(d: string): number[] {
  return (parsePath(d) ?? []).flatMap((cmd) => cmd.a);
}

/** The end point of every segment (the points a curve passes through). */
function endPoints(d: string): [number, number][] {
  return (parsePath(d) ?? []).filter((cmd) => cmd.c !== 'Z').map((cmd) => [cmd.a[cmd.a.length - 2]!, cmd.a[cmd.a.length - 1]!]);
}

const oneDecimal = (n: number): boolean => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;

describe('r1', () => {
  it('rounds to one decimal and turns -0 into 0', () => {
    expect(r1(1.26)).toBe(1.3);
    expect(r1(1.24)).toBe(1.2);
    expect(Object.is(r1(-0.01), 0)).toBe(true);
  });
});

describe('basic shapes', () => {
  it('circle rounds and keeps the paint', () => {
    expect(circle(10.04, 20.06, 5.55, { f: 'vocab.red', ...INK })).toEqual({ t: 'circle', x: 10, y: 20.1, r: 5.6, f: 'vocab.red', s: 'text.primary', sw: 3 });
  });

  it('circle and ellipse default to no paint', () => {
    expect(circle(1, 2, 3)).toEqual({ t: 'circle', x: 1, y: 2, r: 3 });
    expect(ellipse(1, 2, 3, 4)).toEqual({ t: 'ellipse', x: 1, y: 2, rx: 3, ry: 4 });
  });

  it('ellipse rounds every field', () => {
    expect(ellipse(1.11, 2.22, 3.33, 4.44, { f: 'surface.paper', o: 0.55 })).toEqual({ t: 'ellipse', x: 1.1, y: 2.2, rx: 3.3, ry: 4.4, f: 'surface.paper', o: 0.55 });
  });

  it('rect keeps a corner radius and drops a zero one', () => {
    expect(rect(1, 2, 30, 40, 6.04, { f: 'brand.secondary' })).toEqual({ t: 'rect', x: 1, y: 2, w: 30, h: 40, r: 6, f: 'brand.secondary' });
    expect(rect(1, 2, 30, 40, 0)).toEqual({ t: 'rect', x: 1, y: 2, w: 30, h: 40 });
  });

  it('path keeps a valid d and throws on one outside the grammar', () => {
    expect(path('M 1 2 L 3 4 Z', INK)).toEqual({ t: 'path', d: 'M 1 2 L 3 4 Z', s: 'text.primary', sw: 3 });
    expect(() => path('M 1 2 l 3 4')).toThrow(/grammar/);
  });

  it('line is an open two-point path', () => {
    expect(line(1.04, 2, 3, 4.06, INK)).toEqual({ t: 'path', d: 'M 1 2 L 3 4.1', s: 'text.primary', sw: 3 });
  });
});

describe('poly', () => {
  const tri: [number, number][] = [
    [10, 10],
    [50, 10],
    [30, 40],
  ];

  it('without rounding is a closed straight polygon through the points', () => {
    expect(pathOf(poly(tri, INK))).toBe('M 10 10 L 50 10 L 30 40 Z');
  });

  it('with rounding cuts each corner with a quadratic whose control is the corner', () => {
    const d = pathOf(poly(tri, INK, 4));
    const cmds = parsePath(d)!;
    expect(cmds.filter((c) => c.c === 'Q')).toHaveLength(3);
    const controls = cmds.filter((c) => c.c === 'Q').map((c) => [c.a[0], c.a[1]]);
    expect(controls).toEqual([
      [10, 10],
      [50, 10],
      [30, 40],
    ]);
    expect(cmds.at(-1)!.c).toBe('Z');
    expect(numbersIn(d).every(oneDecimal)).toBe(true);
  });

  it('clamps the rounding to half of the shorter edge', () => {
    const d = pathOf(poly(tri, {}, 1000));
    // with the cut at the edge midpoints, the start is the midpoint of the last edge
    expect(parsePath(d)![0]).toEqual({ c: 'M', a: [20, 25] });
  });

  it('needs at least three points', () => {
    expect(() => poly([[0, 0], [1, 1]], INK)).toThrow(/three/);
  });
});

describe('blob and curve (Catmull-Rom)', () => {
  const pts: [number, number][] = [
    [20, 50],
    [50, 20],
    [80, 50],
    [50, 80],
  ];

  it('blob is a closed cubic curve through every point', () => {
    const d = pathOf(blob(pts, { f: 'vocab.red', ...INK }));
    const cmds = parsePath(d)!;
    expect(cmds[0]).toEqual({ c: 'M', a: [20, 50] });
    expect(cmds.filter((c) => c.c === 'C')).toHaveLength(4);
    expect(cmds.at(-1)!.c).toBe('Z');
    expect(endPoints(d)).toEqual([[20, 50], [50, 20], [80, 50], [50, 80], [20, 50]]);
  });

  it('blob needs at least three points', () => {
    expect(() => blob(pts.slice(0, 2), INK)).toThrow(/three/);
  });

  it('curve is an open cubic curve through every point', () => {
    const d = pathOf(curve(pts.slice(0, 3), INK));
    const cmds = parsePath(d)!;
    expect(cmds.filter((c) => c.c === 'C')).toHaveLength(2);
    expect(cmds.some((c) => c.c === 'Z')).toBe(false);
    expect(endPoints(d)).toEqual([[20, 50], [50, 20], [80, 50]]);
  });

  it('curve needs at least two points', () => {
    expect(() => curve([[1, 1]], INK)).toThrow(/two/);
  });

  it('is deterministic and one-decimal', () => {
    const a = blob([[10.123, 20.987], [40.55, 10.01], [60, 70]], INK);
    const b = blob([[10.123, 20.987], [40.55, 10.01], [60, 70]], INK);
    expect(a).toEqual(b);
    expect(numbersIn(pathOf(a)).every(oneDecimal)).toBe(true);
  });
});

describe('leaf', () => {
  it('is a pointed oval of two quadratics between the tips, half-width at the middle', () => {
    const d = pathOf(leaf(10, 50, 90, 50, 10, { f: 'vocab.green' }));
    expect(d).toBe('M 10 50 Q 50 30 90 50 Q 50 70 10 50 Z');
  });
});

describe('arc', () => {
  it('draws an open circular arc from a0 to a1 (degrees, clockwise on screen)', () => {
    expect(pathOf(arc(50, 50, 10, 0, 90, INK))).toBe('M 60 50 A 10 10 0 0 1 50 60');
  });

  it('sets the large-arc flag above 180 degrees and the sweep by direction', () => {
    expect(pathOf(arc(50, 50, 10, 0, 270, INK))).toBe('M 60 50 A 10 10 0 1 1 50 40');
    expect(pathOf(arc(50, 50, 10, 90, 0, INK))).toBe('M 50 60 A 10 10 0 0 0 60 50');
  });

  it('refuses a full circle (use circle)', () => {
    expect(() => arc(50, 50, 10, 0, 360, INK)).toThrow(/circle/);
  });

  it.each([
    ['no span', 30, 30],
    ['almost a full turn', 0, 359.99],
    ['almost a full turn backwards', 0, -359.99],
  ])('refuses %s: its ends coincide after rounding, so svg would draw nothing', (_name, a0, a1) => {
    expect(() => arc(50, 50, 10, a0, a1, INK)).toThrow(/no length/);
  });
});

describe('drop', () => {
  it('is a closed teardrop with the tip on top and a round bottom', () => {
    const d = pathOf(drop(50, 20, 80, 30, { f: 'vocab.blue', ...INK }));
    const cmds = parsePath(d)!;
    expect(cmds[0]).toEqual({ c: 'M', a: [50, 20] });
    const a = cmds.find((c) => c.c === 'A')!;
    expect(a.a.slice(0, 2)).toEqual([15, 15]);
    // the arc runs right to left through the bottom
    expect(a.a.slice(5)).toEqual([35, 65]);
    expect(cmds.at(-1)!.c).toBe('Z');
  });
});

describe('star', () => {
  it('alternates outer and inner points, first point straight up', () => {
    const d = pathOf(star(50, 50, 20, 10, 5, { f: 'vocab.yellow' }));
    const cmds = parsePath(d)!;
    expect(cmds[0]).toEqual({ c: 'M', a: [50, 30] });
    expect(cmds.filter((c) => c.c === 'L')).toHaveLength(9);
    expect(cmds[1]!.a).toEqual([55.9, 41.9]);
  });

  it('can round its corners', () => {
    const d = pathOf(star(50, 50, 20, 10, 4, {}, 2));
    expect(parsePath(d)!.filter((c) => c.c === 'Q')).toHaveLength(8);
  });

  it('needs at least three points', () => {
    expect(() => star(50, 50, 20, 10, 2, {})).toThrow(/three/);
  });
});

describe('groundShadow', () => {
  it('is a flat hoya.furDark ellipse at opacity 0.18, centred by default', () => {
    expect(groundShadow()).toEqual({ t: 'ellipse', x: 50, y: 88, rx: 30, ry: 4.5, f: 'hoya.furDark', o: 0.18 });
    expect(groundShadow(40, 80, 20)).toEqual({ t: 'ellipse', x: 40, y: 80, rx: 20, ry: 3, f: 'hoya.furDark', o: 0.18 });
  });
});

describe('face', () => {
  it('has two ink eyes and a smile, and cheeks only when asked', () => {
    const plain = face(50, 50, 1);
    expect(plain).toHaveLength(3);
    const withCheeks = face(50, 50, 1, { cheeks: true });
    expect(withCheeks).toHaveLength(5);
    expect(withCheeks.filter((s) => s.f === 'hoya.cheek')).toHaveLength(2);
    const eyes = plain.filter((s) => s.t === 'circle');
    expect(eyes).toHaveLength(2);
    expect(eyes.every((e) => e.f === 'text.primary')).toBe(true);
  });

  it.each([0.4, 0.7, 1, 1.6])('always smiles: the mouth bows downwards between its ends (scale %s)', (scale) => {
    const mouth = face(40, 60, scale, { cheeks: true }).find((s) => s.t === 'path')!;
    const cmds = parsePath(pathOf(mouth))!;
    const [m, a] = cmds as unknown as [{ a: number[] }, { a: number[] }];
    const [x0, y0] = m.a as [number, number];
    const [x1, y1] = a.a.slice(5) as [number, number];
    // a smile: ends level, centre of the circle above them, short (not large) arc swept downwards
    expect(y0).toBe(y1);
    expect(x0).toBeGreaterThan(x1);
    expect(a.a[3]).toBe(0);
    expect(a.a[4]).toBe(1);
    expect(mouth.s).toBe('text.primary');
    expect(mouth.sw).toBe(2);
    expect(mouth.f).toBeUndefined();
  });

  it('keeps the detail stroke at 2 at any scale (C3)', () => {
    for (const s of face(50, 50, 0.3, { cheeks: true })) if (s.sw !== undefined) expect(s.sw).toBe(2);
  });
});
