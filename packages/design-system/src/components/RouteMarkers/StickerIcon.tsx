import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../../tokens';
import { iconGlyphs, iconPartProps } from '../Icon/glyphs';
import type { IconName } from '../Icon/types';

/** The 24-unit icon grid. */
const GRID = 24;
/** The paper edge beyond the glyph: `spacing.xxs / 2` (1 dp) at a 16 dp glyph, in grid units (1.5). */
export const STICKER_EDGE_UNITS = ((spacing.xxs / 2) * GRID) / spacing.lg;

export interface StickerIconProps {
  name: IconName;
  size: number;
  color: string;
  testID?: string;
}

/**
 * A corner glyph drawn as a paper sticker (E3-D D3): every part first in `surface.paper`, filled
 * and edged `STICKER_EDGE_UNITS` wider, then the glyph itself, so a route ring passing under the
 * corner reads as going behind it. The glyph is the `Icon` set's own geometry.
 */
export function StickerIcon({ name, size, color, testID }: StickerIconProps): React.ReactElement {
  const parts = iconGlyphs[name];
  return (
    <Svg testID={testID} width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {parts.map((part, index) => (
        <Path
          key={`edge-${index}`}
          d={part.d}
          fill={colors.surface.paper}
          stroke={colors.surface.paper}
          strokeWidth={(part.kind === 'stroke' ? (part.width ?? 2) : 0) + 2 * STICKER_EDGE_UNITS}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {parts.map((part, index) => (
        <Path key={`glyph-${index}`} {...iconPartProps(part, color)} />
      ))}
    </Svg>
  );
}
