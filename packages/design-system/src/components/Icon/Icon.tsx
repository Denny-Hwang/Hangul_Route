import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../tokens';
import { iconGlyphs, iconPartProps } from './glyphs';
import type { IconProps } from './types';

/**
 * Geometric icon set on a 24×24 grid — glyph data and stroke rules live in
 * `glyphs.ts` (`iconPartProps`), shared with the plain-DOM `dom.tsx`.
 */
export function Icon({ name, size = 24, color, testID }: IconProps): React.ReactElement {
  const tint = color ?? colors.text.primary;
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24">
      {iconGlyphs[name].map((part, index) => (
        <Path key={index} {...iconPartProps(part, tint)} />
      ))}
    </Svg>
  );
}
