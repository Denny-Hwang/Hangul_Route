import { useContext } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../tokens';
import { useTypeScale } from '../TextSize';
import { progressA11y } from '../../labels';
import { ProgressLabelsContext } from './labels-context';
import type { ProgressProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

const toneColor = {
  primary: colors.brand.primary,
  secondary: colors.brand.secondary,
  success: colors.feedback.success,
} as const;

/** A decorative meter: no role, no name, no value; skipped by VoiceOver, TalkBack and the web's accessibility tree. */
const HIDDEN = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

export function Progress({
  value,
  max,
  variant = 'bar',
  tone = 'primary',
  height = 12,
  label,
  accessibilityLabel,
  accessibilityValueText,
  decorative = false,
  testID,
}: ProgressProps): ReactElement {
  const textScale = useTypeScale();
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max <= 0 ? 0 : clamped / max;
  // [AU] AU-17d: every progress bar has an accessible name and a value in words. react-native-web does not read
  // `accessibilityValue`, so the ARIA attributes are spelt out beside the native props.
  const said = progressA11y(useContext(ProgressLabelsContext), clamped, max, { accessibilityLabel, accessibilityValueText, label });
  const a11y = decorative
    ? HIDDEN
    : {
        accessible: true,
        accessibilityRole: 'progressbar' as const,
        accessibilityLabel: said.name,
        accessibilityValue: { now: clamped, min: 0, max, text: said.valueText },
        'aria-label': said.name,
        'aria-valuenow': clamped,
        'aria-valuemin': 0,
        'aria-valuemax': max,
        'aria-valuetext': said.valueText,
      };

  if (variant === 'dots') {
    return (
      <View
        testID={testID}
        {...a11y}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        {Array.from({ length: max }).map((_, i) => (
          <View
            key={i}
            style={{
              width: height,
              height,
              borderRadius: radii.circle,
              backgroundColor: i < clamped ? toneColor[tone] : colors.surface.sunken,
            }}
          />
        ))}
        {label ? (
          <Text {...KOREAN_LINE_BREAK}
            style={{
              marginLeft: spacing.sm,
              color: colors.text.muted,
              fontSize: textScale.size.caption,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View testID={testID} {...a11y}>
      <View
        style={{
          width: '100%',
          height,
          borderRadius: radii.pill,
          backgroundColor: colors.surface.sunken,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            backgroundColor: toneColor[tone],
            borderRadius: radii.pill,
          }}
        />
      </View>
      {label ? (
        <Text {...KOREAN_LINE_BREAK}
          style={{
            marginTop: spacing.xs,
            color: colors.text.muted,
            fontSize: textScale.size.caption,
            textAlign: 'right',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
