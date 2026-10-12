/**
 * Colour swatches with an object cue (F-VOC-002 §3.6.1): `word:color-*`.
 * A rounded square in the colour, outlined in ink, with an object drawn as a
 * sticker in the lower right: the object's own glyph at 55 % on a paper halo.
 * The halo is one compound path, so a swatch is the object's shapes plus two
 * (the square and the halo) and always fits the 48-shape limit (C7).
 * Colour is never the only cue (W4): under a colour-vision deficiency the
 * object, not the fill, tells red (apple) from brown (bear).
 *
 * The swatch fills the frame (88 of 100 units), so a registered colour glyph
 * carries the C2 waiver. The swatch tone plus the object's tones may pass the
 * 4-tone limit; a key gets `maxTones` (§3.3) only when its glyph really does
 * (none of the twelve does at W-3). The batch that registers the colours (W-3)
 * builds them with `colorGlyphs(getGlyph)` once every object is drawn.
 */
import { rect } from '../builders';
import { placeGlyph } from '../place';
import type { Placement } from '../place';
import type { WordArtGlyph, WordArtShape, WordArtTone } from '../types';
import { haloPath } from './halo';

/** A content colour: one of the twelve `colors.vocab` tokens. */
export type SwatchTone = Extract<WordArtTone, `vocab.${string}`>;

/** The square: margin 6 on every side, corner radius 14. */
export const SWATCH_RECT = Object.freeze({ x: 6, y: 6, size: 88, radius: 14 });

/** The sticker is the object's glyph at this scale. */
export const STICKER_SCALE = 0.55;

/** Where the object's 100-unit frame lands: its centre at (66, 66), in the lower right of the square. */
const STICKER_CENTRE = 66;
const STICKER: Placement = { scale: STICKER_SCALE, dx: STICKER_CENTRE - 50 * STICKER_SCALE, dy: STICKER_CENTRE - 50 * STICKER_SCALE };

/** A ground shadow (or any faint shape below 0.5) is left out of a sticker: the halo carries it. */
const SHADOW_OPACITY = 0.5;

/** The colour word's tone and the glyph key of the object drawn on it (§3.6.1 table). */
export const COLOR_SWATCHES: Readonly<Record<string, { tone: SwatchTone; object: string }>> = Object.freeze({
  'color-red': { tone: 'vocab.red', object: 'food-apple' },
  'color-orange': { tone: 'vocab.orange', object: 'prop-tangerine' },
  'color-yellow': { tone: 'vocab.yellow', object: 'food-banana' },
  'color-green': { tone: 'vocab.green', object: 'prop-leaf' },
  'color-blue': { tone: 'vocab.blue', object: 'food-water' },
  'color-purple': { tone: 'vocab.purple', object: 'prop-grapes' },
  'color-skyblue': { tone: 'vocab.skyBlue', object: 'nature-cloud' },
  'color-brown': { tone: 'vocab.brown', object: 'animal-bear' },
  'color-gray': { tone: 'vocab.gray', object: 'animal-elephant' },
  'color-white': { tone: 'vocab.white', object: 'food-milk' },
  'color-black': { tone: 'vocab.black', object: 'prop-crow' },
  'color-pink': { tone: 'vocab.pink', object: 'nature-flower' },
});

/** The swatch of `tone` with `object` as its sticker: the square, the halo of every opaque shape, then the object. */
export function swatch(tone: SwatchTone, object: WordArtGlyph): WordArtShape[] {
  const { x, y, size, radius } = SWATCH_RECT;
  const sticker = placeGlyph(
    object.filter((s) => (s.o ?? 1) >= SHADOW_OPACITY),
    STICKER,
  );
  const halo = haloPath(sticker.filter((s) => (s.o ?? 1) >= 1));
  return [rect(x, y, size, size, radius, { f: tone, s: 'text.primary', sw: 3 }), ...(halo ? [halo] : []), ...sticker];
}

/** Every colour glyph by key; throws naming each colour whose object has no glyph yet. */
export function colorGlyphs(lookup: (key: string) => WordArtGlyph | undefined): Record<string, WordArtGlyph> {
  const missing = Object.entries(COLOR_SWATCHES)
    .filter(([, { object }]) => lookup(object) === undefined)
    .map(([key, { object }]) => `${key} needs ${object}`);
  if (missing.length > 0) throw new Error(`Colour swatch objects not drawn yet: ${missing.join(', ')}`);
  return Object.fromEntries(Object.entries(COLOR_SWATCHES).map(([key, { tone, object }]) => [key, swatch(tone, lookup(object)!)]));
}
