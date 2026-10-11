/**
 * WordArt travel glyphs (F-VOC-002 §3.9, briefs in §3.12). PR W-1b draws the
 * sample `travel-bus`; batch W-6 draws the rest. Keys are written without the
 * `word:` prefix.
 */
import { circle, groundShadow, rect } from '../builders';
import type { WordArtGlyph } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;

export const TRAVEL_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // bus (prototype): a green city bus, side view, door at the front
  'travel-bus': [
    groundShadow(50, 84, 36),
    rect(14, 24, 72, 52, 9, { f: 'vocab.green', ...INK }),
    rect(15.5, 54, 69, 6, 0, { f: 'surface.paper' }),
    rect(21, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(39, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(57, 32, 14, 14, 3, { f: 'vocab.skyBlue', ...DETAIL }),
    rect(75, 32, 8, 30, 2, { f: 'vocab.skyBlue', ...DETAIL }),
    circle(81, 68, 2.5, { f: 'vocab.yellow', ...DETAIL }),
    circle(32, 76, 8, { f: 'text.primary', ...INK }),
    circle(32, 76, 3, { f: 'surface.paper' }),
    circle(66, 76, 8, { f: 'text.primary', ...INK }),
    circle(66, 76, 3, { f: 'surface.paper' }),
  ],
};
