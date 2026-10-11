import { describe, expect, it } from 'vitest';
import { circle, ellipse, path, rect } from '../builders';
import { isWordArtPath } from '../path';
import { placeGlyph, placePath, placeShape } from '../place';
import type { WordArtShape } from '../types';

/**
 * F-VOC-002 §3.1 and §3.6: a pure placement moves and scales any glyph by
 * plain arithmetic on its numbers (the grammar has no relative commands), so a
 * composed glyph (a colour swatch's sticker, a family of figures) reuses the
 * data of another. Stroke widths are kept: an outline stays 3 at any size (C3).
 */

describe('placePath', () => {
  it('scales then translates every point of M L C Q', () => {
    expect(placePath('M 0 0 L 10 20 C 1 2 3 4 5 6 Q 7 8 9 10', { dx: 5, dy: -5, scale: 0.5 })).toBe('M 5 -5 L 10 5 C 5.5 -4 6.5 -3 7.5 -2 Q 8.5 -1 9.5 0');
  });

  it('moves H along x and V along y only', () => {
    expect(placePath('M 10 10 H 30 V 40 Z', { dx: 1, dy: 2, scale: 2 })).toBe('M 21 22 H 61 V 82 Z');
  });

  it('scales arc radii, keeps the rotation and both flags, and moves the end point', () => {
    expect(placePath('M 40 60 A 10 8 15 1 0 60 60', { dx: 10, dy: 0, scale: 0.5 })).toBe('M 30 30 A 5 4 15 1 0 40 30');
  });

  it('rounds to one decimal so the result stays in the grammar', () => {
    const d = placePath('M 33.3 66.7 L 12.4 87.6', { dx: 0, dy: 0, scale: 0.55 });
    expect(d).toBe('M 18.3 36.7 L 6.8 48.2');
    expect(isWordArtPath(d)).toBe(true);
  });

  it('is the identity for scale 1 and no offset', () => {
    const d = 'M 10 10 L 20 20 A 5 5 0 0 1 30 30 Z';
    expect(placePath(d, { dx: 0, dy: 0, scale: 1 })).toBe(d);
  });

  it('refuses a path outside the grammar and a scale that is not positive', () => {
    expect(() => placePath('m 1 1 l 2 2', { dx: 0, dy: 0, scale: 1 })).toThrow(/grammar/);
    expect(() => placePath('M 1 1', { dx: 0, dy: 0, scale: 0 })).toThrow(/scale/);
    expect(() => placePath('M 1 1', { dx: 0, dy: 0, scale: Number.NaN })).toThrow(/scale/);
  });
});

describe('placeShape', () => {
  const at = { dx: 10, dy: 20, scale: 0.5 };

  it('moves a circle and scales its radius, keeping the paint', () => {
    expect(placeShape(circle(40, 40, 10, { f: 'vocab.red', s: 'text.primary', sw: 3 }), at)).toEqual({ t: 'circle', x: 30, y: 40, r: 5, f: 'vocab.red', s: 'text.primary', sw: 3 });
  });

  it('moves an ellipse and scales both radii', () => {
    expect(placeShape(ellipse(20, 40, 10, 4, { f: 'hoya.furDark', o: 0.18 }), at)).toEqual({ t: 'ellipse', x: 20, y: 40, rx: 5, ry: 2, f: 'hoya.furDark', o: 0.18 });
  });

  it('moves a rect, scales its size and corner, and drops a corner that rounds to nothing', () => {
    expect(placeShape(rect(0, 0, 40, 20, 6, { f: 'vocab.blue' }), at)).toEqual({ t: 'rect', x: 10, y: 20, w: 20, h: 10, r: 3, f: 'vocab.blue' });
    expect(placeShape(rect(0, 0, 40, 20, 0.1, { f: 'vocab.blue' }), { ...at, scale: 0.25 })).toEqual({ t: 'rect', x: 10, y: 20, w: 10, h: 5, f: 'vocab.blue' });
    expect(placeShape(rect(0, 0, 40, 20, 0, { f: 'vocab.blue' }), at)).toEqual({ t: 'rect', x: 10, y: 20, w: 20, h: 10, f: 'vocab.blue' });
  });

  it('moves a path through placePath', () => {
    expect(placeShape(path('M 0 0 L 20 20', { s: 'text.primary', sw: 2 }), at)).toEqual({ t: 'path', d: 'M 10 20 L 20 30', s: 'text.primary', sw: 2 });
  });

  it('never changes the stroke width or the opacity', () => {
    const shape: WordArtShape = { t: 'circle', x: 50, y: 50, r: 20, s: 'text.primary', sw: 3, o: 0.55 };
    const placed = placeShape(shape, { dx: 0, dy: 0, scale: 0.25 });
    expect(placed.sw).toBe(3);
    expect(placed.o).toBe(0.55);
  });
});

describe('placeGlyph', () => {
  it('places every shape in order and returns new objects', () => {
    const glyph = [circle(50, 50, 20, { f: 'vocab.red' }), rect(10, 10, 20, 20, 4, { f: 'vocab.green' })];
    const placed = placeGlyph(glyph, { dx: 0, dy: 0, scale: 0.5 });
    expect(placed.map((s) => s.t)).toEqual(['circle', 'rect']);
    expect(placed[0]).toMatchObject({ x: 25, y: 25, r: 10 });
    expect(placed[0]).not.toBe(glyph[0]);
  });

  it('works on frozen registry data without mutating it', () => {
    const frozen = Object.freeze([Object.freeze(circle(50, 50, 20, { f: 'vocab.red' }))]);
    expect(placeGlyph(frozen, { dx: 1, dy: 1, scale: 1 })[0]).toMatchObject({ x: 51, y: 51 });
    expect(frozen[0]).toMatchObject({ x: 50, y: 50 });
  });
});
