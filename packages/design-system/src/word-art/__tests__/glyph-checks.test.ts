import { describe, expect, it } from 'vitest';
import { arcPoints, fillTones, glyphExtent, glyphViolations, pathPoints, subjectBox } from './glyph-checks';

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

  it('only the ground shadow is exempt: a faint fill in any other tone still counts (§3.3)', () => {
    const tinted = [...glyph, { t: 'circle', x: 50, y: 50, r: 5, f: 'vocab.blue', o: 0.3 }, { t: 'circle', x: 60, y: 50, r: 5, f: 'hoya.furDark', o: 0.6 }] as const;
    expect(fillTones(tinted)).toEqual(['vocab.red', 'surface.paper', 'vocab.blue', 'hoya.furDark']);
  });

  it('ink used as a fill (eyes, wheels) belongs to the outline ink, not a tone (§3.3)', () => {
    expect(fillTones([{ t: 'circle', x: 32, y: 76, r: 8, f: 'text.primary', s: 'text.primary', sw: 3 }])).toEqual([]);
  });
});

describe('glyphViolations', () => {
  const isTone = (s: string): boolean => s.includes('.') && s !== 'feedback.danger';
  const ok = [{ t: 'circle', x: 50, y: 50, r: 32, f: 'vocab.red', s: 'text.primary', sw: 3 }] as const;

  it('passes a well-formed glyph', () => {
    expect(glyphViolations(ok, {}, isTone)).toEqual([]);
  });

  it('names each broken rule', () => {
    expect(glyphViolations([], {}, isTone)).toEqual(['C7: 0 shapes (1..32)']);
    expect(glyphViolations([{ t: 'circle', x: 50, y: 50, r: 32 }], {}, isTone)).toEqual(['shape 0 is not painted']);
    expect(glyphViolations([{ t: 'circle', x: 50, y: 50, r: 32, f: 'feedback.danger' as 'vocab.red', s: 'red' as 'vocab.red' }], {}, isTone)).toEqual([
      'shape 0 fill feedback.danger is not a word-art tone',
      'shape 0 stroke red is not a word-art tone',
    ]);
    expect(glyphViolations([{ t: 'path', d: 'm 1 1', f: 'vocab.red' }], {}, isTone)).toEqual(['shape 0 path outside the grammar']);
    expect(glyphViolations([{ ...ok[0], o: 0.05 }], {}, isTone)).toEqual(['shape 0 opacity 0.05']);
    expect(glyphViolations([{ ...ok[0], sw: 1.5 }], {}, isTone)).toEqual(['C3: shape 0 stroke width 1.5']);
    expect(glyphViolations([{ t: 'circle', x: 50, y: 50, r: 32, f: 'vocab.red', sw: 2 }], {}, isTone)).toEqual(['shape 0 has a width without a stroke']);
    const tones = (['vocab.red', 'vocab.blue', 'vocab.green', 'vocab.pink', 'vocab.gray'] as const).map((f, i) => ({ t: 'circle' as const, x: 30 + i * 10, y: 50, r: 5, f }));
    expect(glyphViolations(tones, { bboxWaived: true }, isTone)).toEqual(['C4: 5 fill tones']);
    expect(glyphViolations(tones, { bboxWaived: true, maxTones: 5 }, isTone)).toEqual([]);
    expect(glyphViolations([{ ...ok[0], x: 80 }], {}, isTone)).toEqual(['C1: extent {"minX":48,"minY":18,"maxX":112,"maxY":82}', 'C2: centre 80.0, 50.0']);
    expect(glyphViolations([{ ...ok[0], r: 10 }], {}, isTone)).toEqual(['C2: subject size 20.0']);
    expect(glyphViolations([{ ...ok[0], r: 10 }], { bboxWaived: true }, isTone)).toEqual([]);
  });

  it('allows generated dots at 1.5, 48 shapes and the paper halo of the given width', () => {
    expect(glyphViolations([{ ...ok[0], sw: 1.5 }], { generated: true }, isTone)).toEqual([]);
    const halo = { t: 'circle', x: 50, y: 50, r: 32, s: 'surface.paper', sw: 8 } as const;
    expect(glyphViolations([halo, ...ok], { generated: true, haloWidth: 8 }, isTone)).toEqual([]);
    expect(glyphViolations([halo, ...ok], { generated: true }, isTone)).toEqual(['C3: shape 0 stroke width 8']);
    expect(glyphViolations([halo, ...ok], { haloWidth: 8 }, isTone)).toEqual(['C3: shape 0 stroke width 8']);
    expect(glyphViolations([{ ...halo, f: 'vocab.red' }], { generated: true, haloWidth: 8 }, isTone)).toEqual(['C3: shape 0 stroke width 8']);
    const many = Array.from({ length: 40 }, () => ok[0]);
    expect(glyphViolations(many, {}, isTone)).toEqual(['C7: 40 shapes (1..32)']);
    expect(glyphViolations(many, { generated: true }, isTone)).toEqual([]);
  });
});
