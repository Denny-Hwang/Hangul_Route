import { touchTarget, typography } from '../../tokens';
import type { TileProps } from './types';

type TileSize = NonNullable<TileProps['size']>;

const SIZE_STEP: Record<TileSize, number> = {
  sm: touchTarget.min,
  md: touchTarget.child,
  lg: touchTarget.hero,
};

const GLYPH: Record<TileSize, number> = {
  sm: typography.size.title,
  md: typography.size.display,
  lg: typography.size.hero,
};

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
 * and keeps its type token.
 */
export function tileMetrics(size: TileSize, dimension?: number): TileMetrics {
  const step = SIZE_STEP[size];
  const dim = dimension !== undefined && Number.isFinite(dimension) ? Math.max(step, dimension) : step;
  return { dim, glyph: Math.round((GLYPH[size] * dim) / step) };
}
