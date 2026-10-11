/**
 * The paper halo of the generated families (F-VOC-002 §3.6): a shape drawn
 * again behind itself with a wide `surface.paper` stroke and no fill, so a
 * sticker or a highlight ring stands off whatever it sits on, even when the
 * two share a colour (a red apple on the red swatch).
 */
import type { WordArtShape, WordArtTone } from '../types';

/** The halo tone. */
export const HALO_TONE: WordArtTone = 'surface.paper';

/** The halo stroke width: 2 units of paper show outside a 3-unit ink outline. */
export const HALO_WIDTH = 7;

/** The geometry of `shape` with the halo paint only (no fill, no opacity). */
export function haloOf(shape: WordArtShape): WordArtShape {
  const { f: _f, s: _s, sw: _sw, o: _o, ...geometry } = shape;
  return { ...geometry, s: HALO_TONE, sw: HALO_WIDTH };
}
