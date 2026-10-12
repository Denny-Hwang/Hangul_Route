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

  it('draws two paddles crossed at the handles and the ball, never one lens on a stick (sport-tabletennis)', () => {
    const tt = SPORT_GLYPHS['sport-tabletennis']!;
    const circles = tt.filter((sh): sh is Extract<WordArtShape, { t: 'circle' }> => sh.t === 'circle');
    // two red rubber faces, each set in its own wooden rim
    const faces = circles.filter((c) => c.f === 'vocab.red');
    expect(faces).toHaveLength(2);
    expect(faces.every((c) => c.s === undefined)).toBe(true);
    expect(circles.filter((c) => c.f === 'vocab.brown')).toHaveLength(2);
    const [left, right] = [...faces].sort((a, b) => a.x - b.x);
    expect(right!.x - left!.x).toBeGreaterThan(left!.r + right!.r - 6);
    // the two handles cross: each runs from its blade towards the other side
    const handles = tt.filter((sh) => sh.t === 'path' && sh.f === 'vocab.brown');
    expect(handles).toHaveLength(2);
    // the ball: one paper circle above the blades
    const ball = circles.filter((c) => c.f === 'surface.paper');
    expect(ball).toHaveLength(1);
    expect(ball[0]!.y).toBeLessThan(left!.y);
  });

  it('stands the tteokbokki bowl on a ground shadow like the other bowls (C6)', () => {
    expect(CULTURE_GLYPHS['culture-tteokbokki']![0]).toEqual(groundShadow(50, 86, 34));
  });
});
