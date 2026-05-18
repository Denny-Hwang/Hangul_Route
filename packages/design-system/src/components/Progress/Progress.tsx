import React from 'react';
import { Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../tokens';
import type { ProgressProps } from './types';

const toneColor = {
  primary: colors.brand.primary,
  secondary: colors.brand.secondary,
  success: colors.feedback.success,
} as const;

export function Progress({
  value,
  max,
  variant = 'bar',
  tone = 'primary',
  height = 12,
  label,
  testID,
}: ProgressProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max <= 0 ? 0 : clamped / max;

  if (variant === 'dots') {
    return (
      <View
        testID={testID}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: clamped, min: 0, max }}
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
          <Text
            style={{
              marginLeft: spacing.sm,
              color: colors.text.muted,
              fontSize: typography.size.caption,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View testID={testID} accessibilityRole="progressbar" accessibilityValue={{ now: clamped, min: 0, max }}>
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
        <Text
          style={{
            marginTop: spacing.xs,
            color: colors.text.muted,
            fontSize: typography.size.caption,
            textAlign: 'right',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
