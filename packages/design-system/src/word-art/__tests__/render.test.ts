import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors } from '../../tokens';
import { getWordArt } from '../registry';
import { glyphToSvgString, toRenderList } from '../render';
import type { WordArtGlyph } from '../types';

/** F-VOC-002 §3.7: the pure render list and the standalone svg string. */

const SAMPLE: WordArtGlyph = [
  { t: 'ellipse', x: 50, y: 88, rx: 30, ry: 4.5, f: 'hoya.furDark', o: 0.18 },
  { t: 'circle', x: 50, y: 50, r: 30, f: 'vocab.red', s: 'text.primary', sw: 3 },
  { t: 'rect', x: 10, y: 10, w: 20, h: 10, r: 4, f: 'surface.paper', o: 0.55 },
  { t: 'rect', x: 60, y: 10, w: 20, h: 10, f: 'vocab.green', s: 'text.primary' },
  { t: 'path', d: 'M 40 60 A 10 10 0 0 0 60 60', s: 'text.primary', sw: 2 },
];

describe('toRenderList', () => {
  const list = toRenderList(SAMPLE);

  it('keeps the order and maps each kind to its svg tag and geometry', () => {
    expect(list.map((s) => s.tag)).toEqual(['ellipse', 'circle', 'rect', 'rect', 'path']);
    expect(list[0]!.geometry).toEqual({ cx: 50, cy: 88, rx: 30, ry: 4.5 });
    expect(list[1]!.geometry).toEqual({ cx: 50, cy: 50, r: 30 });
    expect(list[2]!.geometry).toEqual({ x: 10, y: 10, width: 20, height: 10, rx: 4 });
    expect(list[3]!.geometry).toEqual({ x: 60, y: 10, width: 20, height: 10 });
    expect(list[4]!.geometry).toEqual({ d: 'M 40 60 A 10 10 0 0 0 60 60' });
  });

  it('resolves tones to token values and leaves a missing fill as none', () => {
    expect(list[1]!.fill).toBe(colors.vocab.red);
    expect(list[1]!.stroke).toBe(colors.text.primary);
    expect(list[4]!.fill).toBe('none');
    expect(list[0]!.stroke).toBeUndefined();
  });

  it('fills the defaults: round caps and joins, outline width 3, opacity 1', () => {
    expect(list[3]!).toMatchObject({ strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 1 });
    expect(list[4]!.strokeWidth).toBe(2);
    expect(list[0]!.opacity).toBe(0.18);
    expect(list[0]!.strokeWidth).toBeUndefined();
  });

  it('mono paints every fill and stroke in one tone and lifts opacity to 0.5 (behaviour 3)', () => {
    const mono = toRenderList(SAMPLE, { mono: 'border.strong' });
    for (const s of mono) {
      if (s.fill !== 'none') expect(s.fill).toBe(colors.border.strong);
      if (s.stroke !== undefined) expect(s.stroke).toBe(colors.border.strong);
      expect(s.opacity).toBeGreaterThanOrEqual(0.5);
    }
    expect(mono[0]!.opacity).toBe(0.5);
    expect(mono[2]!.opacity).toBe(0.55);
    expect(mono[4]!.fill).toBe('none');
  });

  it('throws on a tone outside the vocabulary (caught by the glyph tests, never at runtime)', () => {
    expect(() => toRenderList([{ t: 'circle', x: 1, y: 1, r: 1, f: '#ff0000' as 'vocab.red' }])).toThrow(/tone/);
  });
});

describe('glyphToSvgString', () => {
  it('builds a standalone 0 0 100 100 svg at the requested size', () => {
    const svg = glyphToSvgString(SAMPLE, { size: 48 });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48">')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain(`<circle cx="50" cy="50" r="30" fill="${colors.vocab.red}" stroke="${colors.text.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
    expect(svg).toContain('opacity="0.18"');
    expect(svg).not.toContain('opacity="1"');
  });

  it('mono draws the silhouette', () => {
    const svg = glyphToSvgString(SAMPLE, { size: 64, mono: 'border.strong' });
    expect(svg).not.toContain(colors.vocab.red);
    expect(svg).toContain(colors.border.strong);
  });

  it('writes only numbers, hex and path data into attributes (nothing to escape)', () => {
    const values = [...glyphToSvgString(SAMPLE, { size: 32 }).matchAll(/="([^"]*)"/g)].map((m) => m[1]!);
    for (const v of values) expect(v).toMatch(/^[#0-9A-Za-z .:/-]*$/);
  });
});

describe('golden svg strings (behaviour 4)', () => {
  const GOLDEN = join(__dirname, '__golden__');

  it.each([
    ['food-apple', 48],
    ['animal-cat', 96],
    ['travel-bus', 64],
  ] as const)('%s at %s px matches its golden file', (key, size) => {
    const glyph = getWordArt(key);
    expect(glyph).toBeDefined();
    expect(glyphToSvgString(glyph!, { size })).toBe(readFileSync(join(GOLDEN, `${key}.${size}.svg`), 'utf8').trim());
  });

  it('food-apple at 48 px: viewBox 0 0 100 100 and a 3-unit outline, 1.44 px on screen', () => {
    const svg = glyphToSvgString(getWordArt('food-apple')!, { size: 48 });
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('stroke-width="3"');
    expect((3 * 48) / 100).toBeCloseTo(1.44, 2);
  });
});
