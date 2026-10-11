import { describe, expect, it } from 'vitest';
import { isWordArtPath } from '../path';
import { WORD_ART, WORD_ART_KEYS } from '../registry';
import { isWordArtTone } from '../tones';
import type { WordArtGlyph, WordArtShape } from '../types';
import { fillTones, glyphExtent, shapeBox, subjectBox } from './glyph-checks';

/**
 * F-VOC-002 §3.5, run on every registry glyph: tones (C4, §3.3), path grammar
 * (§3.1), coordinate range (C1), subject size and centring (C2), stroke widths
 * (C3), shape count (C7), distinct data (C8) and the shape kinds (§3.1).
 */

const KINDS = new Set(['circle', 'ellipse', 'rect', 'path']);
const PAINT_KEYS = new Set(['f', 's', 'sw', 'o']);
const GEOMETRY: Record<string, readonly string[]> = {
  circle: ['t', 'x', 'y', 'r'],
  ellipse: ['t', 'x', 'y', 'rx', 'ry'],
  rect: ['t', 'x', 'y', 'w', 'h', 'r'],
  path: ['t', 'd'],
};

/** Generated families may use 1.5 for dots (C3); hand glyphs use 2 and 3 only. */
const GENERATED = new Set(['color', 'count', 'body']);

/** C2: the subject covers 60-70 % of the width or height, with a 10 % tolerance. */
const BBOX_MIN = 60 * 0.9;
const BBOX_MAX = 70 * 1.1;
/** C2 centring: the subject's centre within this many units of 50 on each axis. */
const CENTRE_TOLERANCE = 8;

function numbersOf(shape: WordArtShape): number[] {
  return Object.entries(shape)
    .filter(([k, v]) => k !== 'sw' && k !== 'o' && typeof v === 'number')
    .map(([, v]) => v as number);
}

const entries = WORD_ART_KEYS.map((key) => [key, WORD_ART[key]!.glyph, WORD_ART[key]!.meta] as const);

describe.each(entries)('%s', (key, glyph, meta) => {
  it('uses only known shape kinds and fields (no text, image, gradient or use)', () => {
    for (const shape of glyph) {
      expect(KINDS.has(shape.t)).toBe(true);
      for (const field of Object.keys(shape)) expect(GEOMETRY[shape.t]!.includes(field) || PAINT_KEYS.has(field), `${key}: ${field}`).toBe(true);
    }
  });

  it('paints every shape, and every fill and stroke is a word-art tone', () => {
    for (const shape of glyph) {
      expect(shape.f !== undefined || shape.s !== undefined).toBe(true);
      if (shape.f !== undefined) expect(isWordArtTone(shape.f), `${key} fill ${shape.f}`).toBe(true);
      if (shape.s !== undefined) expect(isWordArtTone(shape.s), `${key} stroke ${shape.s}`).toBe(true);
    }
  });

  it(`has at most ${meta.maxTones ?? 4} fill tones besides the ink and the ground shadow (C4)`, () => {
    expect(fillTones(glyph).length).toBeLessThanOrEqual(meta.maxTones ?? 4);
  });

  it('writes every path in the grammar (§3.1)', () => {
    for (const shape of glyph) if (shape.t === 'path') expect(isWordArtPath(shape.d), shape.d).toBe(true);
  });

  it('rounds every coordinate to one decimal', () => {
    for (const shape of glyph) for (const n of numbersOf(shape)) expect(Math.abs(n * 10 - Math.round(n * 10)), `${key}: ${n}`).toBeLessThan(1e-9);
  });

  it('keeps every shape inside -6..106 (C1)', () => {
    const box = glyphExtent(glyph);
    expect(box.minX).toBeGreaterThanOrEqual(-6);
    expect(box.minY).toBeGreaterThanOrEqual(-6);
    expect(box.maxX).toBeLessThanOrEqual(106);
    expect(box.maxY).toBeLessThanOrEqual(106);
  });

  it.skipIf(meta.bboxWaived === true)('fills 60-70 % of the frame, centred (C2)', () => {
    const box = subjectBox(glyph);
    const size = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    expect(size, `${key} subject size`).toBeGreaterThanOrEqual(BBOX_MIN);
    expect(size, `${key} subject size`).toBeLessThanOrEqual(BBOX_MAX);
    expect(Math.abs((box.minX + box.maxX) / 2 - 50), `${key} centre x`).toBeLessThanOrEqual(CENTRE_TOLERANCE);
    expect(Math.abs((box.minY + box.maxY) / 2 - 50), `${key} centre y`).toBeLessThanOrEqual(CENTRE_TOLERANCE);
  });

  it('strokes at 3 (outline) or 2 (detail), never thinner (C3)', () => {
    const allowed = GENERATED.has(meta.family) ? [1.5, 2, 3] : [2, 3];
    for (const shape of glyph) {
      if (shape.sw !== undefined) expect(allowed).toContain(shape.sw);
      if (shape.sw !== undefined) expect(shape.s, `${key}: sw without a stroke`).toBeDefined();
    }
  });

  it('keeps opacity in 0.1..1 (shadows and highlights only)', () => {
    for (const shape of glyph) if (shape.o !== undefined) expect(shape.o >= 0.1 && shape.o <= 1).toBe(true);
  });

  it(`has at most ${GENERATED.has(meta.family) ? 48 : 32} shapes (C7)`, () => {
    expect(glyph.length).toBeGreaterThan(0);
    expect(glyph.length).toBeLessThanOrEqual(GENERATED.has(meta.family) ? 48 : 32);
  });

  it('has a non-empty extent for every shape', () => {
    for (const shape of glyph) {
      const b = shapeBox(shape);
      expect(b.maxX - b.minX + (b.maxY - b.minY)).toBeGreaterThan(0);
    }
  });
});

describe('the whole registry', () => {
  it('has at least one glyph', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('no two keys have identical data (C8)', () => {
    const seen = new Map<string, string>();
    for (const [key, glyph] of entries) {
      const json = JSON.stringify(glyph);
      expect(seen.get(json), `${key} duplicates ${seen.get(json)}`).toBeUndefined();
      seen.set(json, key);
    }
  });

  it('glyphs are frozen data', () => {
    for (const [, glyph] of entries) {
      expect(Object.isFrozen(glyph as WordArtGlyph)).toBe(true);
      expect((glyph as WordArtGlyph).every((shape) => Object.isFrozen(shape))).toBe(true);
    }
  });
});
