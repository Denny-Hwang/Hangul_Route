import { useContext } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { borderWidth, colors, radii, spacing, typography } from '../../tokens';
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

/** The ring of the dot shown now (`current`), per tone. */
const toneDark = {
  primary: colors.brand.primaryDark,
  secondary: colors.brand.secondaryDark,
  success: colors.feedback.successDark,
} as const;

/** How far the ring of the current dot stands out from the dot: a gap and the ring, each `borderWidth.base`. */
const RING = borderWidth.base * 2;

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
  current,
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
        {Array.from({ length: max }).map((_, i) => {
          const dot = (
            <View
              key={i}
              style={{
                width: height,
                height,
                borderRadius: radii.circle,
                backgroundColor: i < clamped ? toneColor[tone] : colors.surface.sunken,
              }}
            />
          );
          // [QB] The dot shown now, when the meter is ahead of it (a step or page taken back, AMENDMENTS-QUEST-SOUND-BACK
          // QB-1, QB-2): a ring around the same dot. The ring's room is given back as a negative margin, so the row
          // keeps its size and no dot moves.
          return current !== undefined && i === current - 1 ? (
            <View
              key={i}
              testID={testID === undefined ? undefined : `${testID}-current`}
              style={{
                width: height + RING * 2,
                height: height + RING * 2,
                margin: -RING,
                borderRadius: radii.circle,
                borderWidth: borderWidth.base,
                borderColor: toneDark[tone],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {dot}
            </View>
          ) : (
            dot
          );
        })}
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
