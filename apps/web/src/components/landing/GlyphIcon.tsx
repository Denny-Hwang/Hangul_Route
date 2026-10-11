import { iconGlyphs } from '@hangul-route/design-system/icon-glyphs';
import { colors } from '@hangul-route/design-system/tokens';
import type { LandingIconName } from '../../data/minigame-catalog';

/**
 * A design-system icon drawn with plain DOM svg for the public site, which does not load
 * react-native-svg. Same glyph data and stroke rules as `Icon.tsx`
 * (design/components/Icon/spec.md): 24-unit grid, round caps, width 2 unless the glyph says
 * otherwise, tokens only. Decorative: it always sits next to its words.
 */
export function GlyphIcon({ name, size = 24, color = colors.text.primary }: { name: LandingIconName; size?: number; color?: string }): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {iconGlyphs[name].map((part, i) =>
        part.kind === 'fill' ? (
          <path key={i} d={part.d} fill={color} />
        ) : (
          <path key={i} d={part.d} fill="none" stroke={color} strokeWidth={part.width ?? 2} strokeLinecap="round" strokeLinejoin="round" />
        ),
      )}
    </svg>
  );
}
