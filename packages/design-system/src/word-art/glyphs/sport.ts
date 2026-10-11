/**
 * WordArt sport glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `sport-soccer`; batch W-6 draws the rest. Keys are written without
 * the `word:` prefix.
 */
import { circle, groundShadow, line, path, poly } from '../builders';
import { formatNumber as n } from '../path';
import type { WordArtGlyph, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

const at = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** A football: an ink pentagon in the middle, seams out to five ink patches on the rim. */
function football(cx: number, cy: number, r: number): WordArtShape[] {
  const angles = [0, 1, 2, 3, 4].map((k) => -90 + 72 * k);
  const centre = r / 3;
  const patches = angles.map((a) => {
    const [x0, y0] = at(cx, cy, r, a - 14);
    const [x1, y1] = at(cx, cy, r, a + 14);
    const [xi, yi] = at(cx, cy, r * 0.72, a);
    return path(`M ${n(x0)} ${n(y0)} A ${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y1)} L ${n(xi)} ${n(yi)} Z`, { f: 'text.primary', ...DETAIL });
  });
  const seams = angles.map((a) => {
    const [x0, y0] = at(cx, cy, centre, a);
    const [x1, y1] = at(cx, cy, r * 0.72, a);
    return line(x0, y0, x1, y1, DETAIL);
  });
  return [
    circle(cx, cy, r, { f: 'surface.paper', ...INK }),
    ...seams,
    ...patches,
    poly(
      angles.map((a) => at(cx, cy, centre, a)),
      { f: 'text.primary', ...DETAIL },
      1,
    ),
    circle(cx, cy, r, INK),
  ];
}

export const SPORT_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // football (prototype)
  'sport-soccer': [groundShadow(50, 84, 24), ...football(50, 49, 31)],
};
