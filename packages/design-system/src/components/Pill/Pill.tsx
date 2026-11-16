import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { radii, spacing, typography } from '../../tokens';
import { useTypeScale } from '../TextSize';
import { pillStyle } from './style';
import type { PillProps } from './types';
import { Icon } from '../Icon/Icon';
import { KOREAN_LINE_BREAK } from '../../line-break';

export function Pill({ label, tone = 'neutral', size = 'md', icon, accessibilityLabel, testID }: PillProps): ReactElement {
  const padY = size === 'sm' ? spacing.xxs : spacing.xs;
  const padX = size === 'sm' ? spacing.sm : spacing.md;
  const scale = useTypeScale().size;
  const fontSize = size === 'sm' ? scale.caption : scale.bodySm;
  // The glyph is one line of the pill's text tall (BL-D README: caption x leading.tight, about 16).
  const glyph = Math.round(fontSize * typography.leading.tight);
  // With its own name the pill is one element read by that name (an image of words, as the BL-D mock's pill), so its
  // words and glyph are not read again.
  const named = accessibilityLabel !== undefined;
  const look = pillStyle(tone);

  return (
    <View
      testID={testID}
      {...(named ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel, 'aria-label': accessibilityLabel } : {})}
      style={{
        paddingHorizontal: padX,
        paddingVertical: padY,
        backgroundColor: look.backgroundColor,
        borderRadius: radii.pill,
        alignSelf: 'flex-start',
        // A label at a large text size wraps inside its row instead of running out of it.
        maxWidth: '100%',
        ...(icon === undefined ? {} : { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }),
      }}
    >
      {icon === undefined ? null : (
        <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icon name={icon} size={glyph} color={look.textColor} />
        </View>
      )}
      <Text {...KOREAN_LINE_BREAK}
        style={{
          color: look.textColor,
          fontSize,
          fontWeight: typography.weight.semibold,
          ...(icon === undefined ? {} : { flexShrink: 1 }),
        }}
      >
        {label}
      </Text>
    </View>
  );
}
