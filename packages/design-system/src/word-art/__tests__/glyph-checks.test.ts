import { describe, expect, it } from 'vitest';
import { arcPoints, fillTones, glyphExtent, pathPoints, subjectBox } from './glyph-checks';

/** The test-only measurements are themselves checked, so a glyph test cannot pass by a broken ruler. */

describe('arcPoints', () => {
  it('samples a half circle through its far side', () => {
    const pts = arcPoints(40, 50, [10, 10, 0, 0, 1, 60, 50]);
    // sweep 1 from (40,50) to (60,50) goes over the top on screen (through y = 40)
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(40, 5);
    expect(pts.at(-1)![0]).toBeCloseTo(60, 5);
  });

  it('sweep 0 takes the other side', () => {
    const pts = arcPoints(40, 50, [10, 10, 0, 0, 0, 60, 50]);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(60, 5);
  });

  it('scales radii that are too small to reach the end point', () => {
    const pts = arcPoints(0, 0, [1, 1, 0, 0, 1, 20, 0]);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(-10, 5);
  });

  it('degenerates to the end point for a zero radius or a zero-length arc', () => {
    expect(arcPoints(0, 0, [0, 5, 0, 0, 1, 10, 10])).toEqual([[10, 10]]);
    expect(arcPoints(5, 5, [5, 5, 0, 0, 1, 5, 5])).toEqual([[5, 5]]);
  });

  it('handles a large arc', () => {
    const pts = arcPoints(60, 50, [10, 10, 0, 1, 1, 50, 40]);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(60, 1);
    expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(40, 1);
  });
});

describe('pathPoints', () => {
  it('walks M L H V C Q A Z with the current point', () => {
    const pts = pathPoints('M 10 10 H 20 V 30 L 5 5 Q 1 2 3 4 C 5 6 7 8 9 10 Z M 0 0 L 1 1');
    expect(pts.slice(0, 4)).toEqual([[10, 10], [20, 10], [20, 30], [5, 5]]);
    expect(pts).toContainEqual([1, 2]);
    expect(pts).toContainEqual([7, 8]);
  });

  it('throws on a path outside the grammar', () => {
    expect(() => pathPoints('m 1 2')).toThrow(/grammar/);
  });
});

describe('boxes and tones', () => {
  const glyph = [
    { t: 'ellipse', x: 50, y: 90, rx: 40, ry: 4, f: 'hoya.furDark', o: 0.18 },
    { t: 'circle', x: 50, y: 50, r: 20, f: 'vocab.red', s: 'text.primary', sw: 3 },
    { t: 'rect', x: 40, y: 40, w: 4, h: 4, f: 'text.primary' },
    { t: 'rect', x: 45, y: 35, w: 4, h: 4, f: 'surface.paper', o: 0.55 },
    { t: 'path', d: 'M 30 50 L 70 50', s: 'text.primary', sw: 2 },
  ] as const;

  it('glyphExtent includes the shadow, subjectBox does not', () => {
    expect(glyphExtent(glyph)).toEqual({ minX: 10, minY: 30, maxX: 90, maxY: 94 });
    expect(subjectBox(glyph)).toEqual({ minX: 30, minY: 30, maxX: 70, maxY: 70 });
  });

  it('fillTones skips ink and shadows but counts highlights', () => {
    expect(fillTones(glyph)).toEqual(['vocab.red', 'surface.paper']);
  });
});
