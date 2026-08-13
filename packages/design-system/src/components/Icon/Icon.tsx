import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../tokens';
import { iconGlyphs } from './glyphs';
import type { IconProps } from './types';

/**
 * Geometric icon set on a 24×24 grid — glyph data lives in `glyphs.ts`.
 * Filled and stroked parts are tinted independently so filled silhouettes
 * are not thickened by an extra stroke outline.
 */
export function Icon({ name, size = 24, color, testID }: IconProps): React.ReactElement {
  const tint = color ?? colors.text.primary;
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24">
      {iconGlyphs[name].map((part, index) =>
        part.kind === 'fill' ? (
          <Path key={index} d={part.d} fill={tint} />
        ) : (
          <Path
            key={index}
            d={part.d}
            fill="none"
            stroke={tint}
            strokeWidth={part.width ?? 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
