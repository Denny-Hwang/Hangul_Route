import { describe, expect, it } from 'vitest';
import { groundShadow } from '../builders';
import { CULTURE_GLYPHS } from '../glyphs/culture';
import { SPORT_GLYPHS } from '../glyphs/sport';
import { TRAVEL_GLYPHS } from '../glyphs/travel';
import type { WordArtShape } from '../types';

type Ellipse = Extract<WordArtShape, { t: 'ellipse' }>;

describe('batch D review follow-ups (F-VOC-002 W-6)', () => {
  it('draws the passport emblem as a globe, with no bar under it that could read as the syllable 으 (C10, W6)', () => {
    const passport = TRAVEL_GLYPHS['travel-passport']!;
    // the two rects are the booklet's pages; the emblem has no bar
    expect(passport.filter((sh) => sh.t === 'rect')).toHaveLength(2);
    expect(passport.filter((sh) => sh.t === 'rect').every((sh) => sh.t === 'rect' && sh.w >= 40 && sh.h >= 60)).toBe(true);
    // one disc, crossed by a meridian and the equator in one path
    expect(passport.filter((sh) => sh.t === 'circle')).toHaveLength(1);
    const lines = passport.filter((sh) => sh.t === 'path');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.t === 'path' && lines[0]!.d.includes('A') && lines[0]!.d.includes('H')).toBe(true);
  });

  it('kicks at head height, barefoot (sport-taekwondo)', () => {
    const kick = SPORT_GLYPHS['sport-taekwondo']!;
    const head = kick.find((sh) => sh.t === 'circle' && sh.f === 'surface.paper' && sh.r >= 8);
    expect(head).toBeDefined();
    const feet = kick.filter((sh): sh is Ellipse => sh.t === 'ellipse' && sh.o === undefined);
    expect(feet).toHaveLength(2);
    // both feet bare: paper, never an ink-filled shoe
    for (const foot of feet) expect(foot.f).toBe('surface.paper');
    const kicking = feet.reduce((a, b) => (a.y < b.y ? a : b));
    if (head?.t !== 'circle') throw new Error('no head');
    expect(kicking.y).toBeGreaterThanOrEqual(head.y - head.r);
    expect(kicking.y).toBeLessThanOrEqual(head.y + head.r);
  });

  it('stands the tteokbokki bowl on a ground shadow like the other bowls (C6)', () => {
    expect(CULTURE_GLYPHS['culture-tteokbokki']![0]).toEqual(groundShadow(50, 86, 34));
  });
});
