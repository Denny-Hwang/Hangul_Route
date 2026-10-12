/**
 * Posed people for the batch W-6 glyphs (F-VOC-002 §3.6.4, C12): a kick, a
 * run, a ski, a dance. `figure()` only stands, so these draw the same neutral
 * person from parts: limbs are rounded capsules between two joints, the head
 * is a paper circle with an ink outline, a hair cap and the smile of `face()`.
 * No skin-tone fill; hair and clothes carry the cues.
 */
import { circle, face, path, poly } from '../builders';
import type { Pt } from '../builders';
import { formatNumber as n } from '../path';
import type { WordArtPaint, WordArtShape, WordArtTone } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;

/** A limb: a capsule of width `w` from joint `a` to joint `b` (a rectangle whose corners are rounded by half its width). */
export function limb(a: Pt, b: Pt, w: number, paint: WordArtPaint): WordArtShape {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [nx, ny] = [(-(b[1] - a[1]) / len) * (w / 2), ((b[0] - a[0]) / len) * (w / 2)];
  return poly(
    [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ],
    paint,
    w / 2,
  );
}

/** A head of radius `r` at (x, y): paper face, a hair cap in `hair`, two eyes and a smile. */
export function head(x: number, y: number, r: number, hair: WordArtTone): WordArtShape[] {
  const k = r / 18;
  const cap = path(
    `M ${n(x - 21 * k)} ${n(y + 1 * k)} A ${n(21 * k)} ${n(21 * k)} 0 0 1 ${n(x + 21 * k)} ${n(y + 1 * k)} Q ${n(x + 11 * k)} ${n(y - 10 * k)} ${n(x)} ${n(y - 8 * k)} Q ${n(x - 11 * k)} ${n(y - 10 * k)} ${n(x - 21 * k)} ${n(y + 1 * k)} Z`,
    { f: hair, ...INK },
  );
  return [circle(x, y, r, { f: 'surface.paper', ...INK }), cap, ...face(x, y + 2 * k, 0.85 * k)];
}

/** A hand: a small paper circle. */
export const hand = ([x, y]: Pt, r = 3.5): WordArtShape => circle(x, y, r, { f: 'surface.paper', ...INK });
