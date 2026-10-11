/**
 * The design-system icon drawn with plain DOM svg, for web pages that do not load
 * react-native-svg (the public site). Imported through the
 * `@hangul-route/design-system/icon-glyphs/dom` subpath, never the package root.
 * Same glyph data and stroke rules as `Icon.tsx` (both go through `iconPartProps`;
 * design/components/Icon/spec.md). Decorative: it always sits next to its words.
 */
import React from 'react';
import { colors } from '../../tokens';
import { iconGlyphs, iconPartProps } from './glyphs';
import type { IconName } from './types';

export interface IconSvgProps {
  name: IconName;
  /** Side of the square in px. */
  size?: number;
  /** A colour token (`colors.*`); defaults to the primary text colour. */
  color?: string;
}

export function IconSvg({ name, size = 24, color = colors.text.primary }: IconSvgProps): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {iconGlyphs[name].map((part, index) => (
        <path key={index} {...iconPartProps(part, color)} />
      ))}
    </svg>
  );
}
