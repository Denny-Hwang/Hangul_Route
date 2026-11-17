import { describe, expect, it } from 'vitest';
import { WORD_ART, getWordArt } from '../registry';
import type { WordArtGlyph, WordArtShape } from '../types';
import { shapeBox, subjectBox } from './glyph-checks';

/**
 * AMENDMENTS-FOLLOWUPS-2026-11 row FU-2 (a): the five PX-1 glyphs the review left weakest are made nameable at 54
 * and 64 px. What each one now shows is pinned on its data. None changes WHAT it shows (seeds with one sprouting,
 * the gayageum with a bridge per string, the New Year bow, cut kimbap, the sea's waves), so all five keep the
 * owner's `approved` (FU-1).
 */
const glyph = (key: string): WordArtGlyph => getWordArt(key)!;
const filled = (key: string, tone: string): WordArtShape[] => glyph(key).filter((s) => s.f === tone);
const centre = (s: WordArtShape): [number, number] => {
  const b = shapeBox(s);
  return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
};

describe('batch FU-2: the weakest glyphs, sharpened', () => {
  it.each(['science-seed', 'culture-gayageum', 'culture-seollal', 'food-kimbap', 'nature-sea'])(
    '%s stays approved',
    (key) => {
      expect(WORD_ART[key]?.meta.status).toBe('approved');
    },
  );

  it('the seed is never a nut: four pointed seeds (paths, no round body), the big one sprouting two leaves', () => {
    const seeds = filled('science-seed', 'stage.stage2');
    expect(seeds).toHaveLength(4);
    expect(seeds.every((s) => s.t === 'path')).toBe(true);
    expect(
      glyph('science-seed').some(
        (s) => (s.t === 'circle' || s.t === 'ellipse') && s.f !== undefined && s.f !== 'hoya.furDark',
      ),
    ).toBe(false);
    expect(filled('science-seed', 'vocab.brown')).toHaveLength(0);
    expect(filled('science-seed', 'vocab.green')).toHaveLength(2);
  });

  it('the gayageum has three strings at least 8 units apart, so they stay apart at 54 px', () => {
    const strings = glyph('culture-gayageum').find((s) => s.t === 'path' && s.f === undefined && s.sw === 3);
    expect(strings?.t === 'path' ? strings.d.split('M').length - 1 : 0).toBe(3);
    const bridges = filled('culture-gayageum', 'vocab.white').filter((s) => s.t === 'path');
    expect(bridges).toHaveLength(3);
    for (const b of bridges) expect(shapeBox(b).maxX - shapeBox(b).minX).toBeGreaterThanOrEqual(13);
  });

  it('the New Year bow fills the tile: no pouch above it, and the child at least 70 units wide', () => {
    expect(filled('culture-seollal', 'vocab.red')).toHaveLength(1);
    const b = subjectBox(glyph('culture-seollal'));
    expect(b.maxX - b.minX).toBeGreaterThanOrEqual(70);
  });

  it('kimbap: the roll above two slices that stand apart, so the silhouette is not one block', () => {
    const rings = filled('food-kimbap', 'text.primary').filter((s) => s.t === 'circle');
    const front = rings.filter((s) => centre(s)[1] > 55);
    expect(front).toHaveLength(2);
    const [a, b] = front as [WordArtShape & { r: number }, WordArtShape & { r: number }];
    const gap = Math.hypot(centre(a)[0] - centre(b)[0], centre(a)[1] - centre(b)[1]) - a.r - b.r - 3;
    expect(gap).toBeGreaterThanOrEqual(6);
    // the roll clears the slices too
    const roll = filled('food-kimbap', 'text.primary').find((s) => s.t === 'rect')!;
    expect(Math.min(...front.map((s) => shapeBox(s).minY)) - shapeBox(roll).maxY).toBeGreaterThanOrEqual(6);
  });

  it('the sea is one curling wave over a band of water, with the sun; no boat', () => {
    expect(filled('nature-sea', 'vocab.blue')).toHaveLength(1);
    expect(filled('nature-sea', 'vocab.skyBlue')).toHaveLength(1);
    expect(filled('nature-sea', 'vocab.yellow')).toHaveLength(1);
    // the crest curls back on itself: the wave's outline turns left again after its rightmost point
    const wave = filled('nature-sea', 'vocab.blue')[0]!;
    const xs =
      wave.t === 'path' ? [...wave.d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])) : [];
    const right = xs.indexOf(Math.max(...xs));
    expect(Math.min(...xs.slice(right))).toBeLessThan(Math.max(...xs) - 25);
  });
});
