import { touchTarget, typography } from '../../tokens';
import type { TileProps } from './types';

type TileSize = NonNullable<TileProps['size']>;

const SIZE_STEP: Record<TileSize, number> = {
  sm: touchTarget.min,
  md: touchTarget.child,
  lg: touchTarget.hero,
};

const GLYPH: Record<TileSize, 'title' | 'display' | 'hero'> = {
  sm: 'title',
  md: 'display',
  lg: 'hero',
};

/** The large type sizes a glyph is drawn from: `typography.size`, or a text size step's `typeScale(f).size`. */
export type TileGlyphScale = Readonly<Record<'title' | 'display' | 'hero', number>>;

export interface TileMetrics {
  /** The tile's side (its min width and height). */
  dim: number;
  /** The glyph's font size. */
  glyph: number;
}

/**
 * Pure sizing behind `Tile` (F-LAYOUT-001 LD4). Without `dimension` the tile is
 * its size step with the step's type size; a scaled `dimension` (from
 * `useMediaSize`) is never below the step, so the touch target never shrinks,
 * and a non-finite one falls back to the step. The glyph is part of the tile's
 * picture, so it grows in proportion; the romanization line is not sized here
 * and keeps its type token. `scale` is the chosen text size's type scale (owner items 6 and 7):
 * the glyph starts from the scaled large type, and the tile's side stays a minimum, so a bigger
 * glyph grows the tile instead of clipping.
 */
export function tileMetrics(size: TileSize, dimension?: number, scale: TileGlyphScale = typography.size): TileMetrics {
  const step = SIZE_STEP[size];
  const dim = dimension !== undefined && Number.isFinite(dimension) ? Math.max(step, dimension) : step;
  return { dim, glyph: Math.round((scale[GLYPH[size]] * dim) / step) };
}
