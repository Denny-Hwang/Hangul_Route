/**
 * WordArt school glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `school-chair`; batch W-5 draws the rest. Keys are written without
 * the `word:` prefix.
 */
import { groundShadow, poly, rect } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

export const SCHOOL_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // chair (prototype): seen from the front and a little above
  'school-chair': [
    groundShadow(50, 87, 32),
    rect(32, 60, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(63, 60, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(34, 36, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(61, 36, 5, 18, 2, { f: 'vocab.gray', ...DETAIL }),
    rect(27, 13, 46, 27, 8, { f: 'brand.secondary', ...INK }),
    rect(33, 18, 20, 4, 2, { f: 'surface.paper', o: 0.55 }),
    poly(
      [
        [25, 50],
        [75, 50],
        [82, 61],
        [18, 61],
      ],
      { f: 'brand.secondary', ...INK },
      3,
    ),
    rect(21, 61, 6, 25, 2, { f: 'vocab.gray', ...INK }),
    rect(73, 61, 6, 25, 2, { f: 'vocab.gray', ...INK }),
  ],
};
