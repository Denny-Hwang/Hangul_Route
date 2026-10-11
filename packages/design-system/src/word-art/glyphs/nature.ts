/**
 * WordArt nature glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `nature-cloud` (also the sky-blue swatch object, §3.6.1); batch W-3
 * draws `nature-flower` and W-5 the rest. Keys are written without the
 * `word:` prefix.
 */
import { circle, curve, rect } from '../builders';
import type { WordArtGlyph, WordArtPaint, WordArtShape } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;

/**
 * One outline around overlapping puffs: each puff is drawn outlined, then
 * again 1.5 smaller without a stroke on top, which hides the inner outlines.
 */
function puffs(parts: readonly (readonly [number, number, number])[], base: readonly [number, number, number, number], paint: WordArtPaint): WordArtShape[] {
  const [bx, by, bw, bh] = base;
  const outlined = [rect(bx, by, bw, bh, bh / 2, { ...paint, ...INK }), ...parts.map(([x, y, r]) => circle(x, y, r, { ...paint, ...INK }))];
  const fills = [rect(bx + 1.5, by + 1.5, bw - 3, bh - 3, bh / 2 - 1.5, paint), ...parts.map(([x, y, r]) => circle(x, y, r - 1.5, paint))];
  return [...outlined, ...fills];
}

export const NATURE_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // cloud (prototype)
  'nature-cloud': [
    ...puffs(
      [
        [33, 55, 14],
        [50, 44, 19],
        [68, 52, 15],
      ],
      [18, 52, 66, 20],
      { f: 'surface.paper' },
    ),
    curve(
      [
        [56, 64],
        [63, 66],
        [70, 63],
      ],
      { s: 'brand.secondaryLight', sw: 3 },
    ),
  ],
};
