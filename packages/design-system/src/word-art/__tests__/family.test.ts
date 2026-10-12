import { describe, expect, it } from 'vitest';
import { figure } from '../generated/figure';
import { FAMILY_GLYPHS } from '../glyphs/family';
import type { WordArtShape } from '../types';

const fills = (glyph: readonly WordArtShape[]): string[] => glyph.flatMap((sh) => (sh.f === undefined ? [] : [sh.f]));

describe('family glyphs (F-VOC-002 W-5)', () => {
  it('dresses mom and dad, and the adults of the family row, in tones that carry no gender (C12: hair is the cue)', () => {
    for (const key of ['family-mom', 'family-dad', 'family-family']) {
      const tones = fills(FAMILY_GLYPHS[key]!);
      expect(tones, key).not.toContain('vocab.pink');
    }
    expect(fills(FAMILY_GLYPHS['family-dad']!)).not.toContain('vocab.blue');
    const [mom, dad] = [fills(FAMILY_GLYPHS['family-mom']!), fills(FAMILY_GLYPHS['family-dad']!)];
    expect(mom).toContain('feedback.success');
    expect(dad).toContain('brand.primary');
  });

  it("draws `me` with one shirt and two hands: figure()'s shirt and hands path are replaced, never doubled", () => {
    const me = FAMILY_GLYPHS['family-me']!;
    const stock = figure({ height: 70, hair: 'short', clothes: 'hoya.fur', ground: 86 });
    // shadow + stock figure - stock shirt - stock hands + new shirt + ring + two hands
    expect(me).toHaveLength(1 + stock.length - 2 + 4);
    // exactly one shape in the clothes tone: the redrawn shirt
    expect(me.filter((sh) => sh.f === 'hoya.fur')).toHaveLength(1);
    expect(me.filter((sh) => sh.f === 'hoya.fur')[0]!.t).toBe('path');
    // what is dropped from figure() is exactly its shirt and its hands (one paper path of two sub-paths, without the legs' V)
    const same = (a: WordArtShape, b: WordArtShape): boolean => JSON.stringify(a) === JSON.stringify(b);
    const removed = stock.filter((sh) => !me.some((m) => same(m, sh)));
    expect(removed).toHaveLength(2);
    expect(removed.map((sh) => sh.f).sort()).toEqual(['hoya.fur', 'surface.paper']);
    const hands = removed.find((sh) => sh.f === 'surface.paper')!;
    expect(hands.t === 'path' && (hands.d.match(/M/g) ?? []).length === 2 && !hands.d.includes('V')).toBe(true);
    // the two new hands are paper circles
    expect(me.filter((sh) => sh.t === 'circle' && sh.f === 'surface.paper' && sh.r < 5)).toHaveLength(2);
  });
});
