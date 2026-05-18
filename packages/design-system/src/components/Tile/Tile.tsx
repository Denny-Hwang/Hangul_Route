import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, touchTarget, typography } from '../../tokens';
import type { TileProps, TileState } from './types';

const stateBg: Record<TileState, string> = {
  idle: colors.surface.paper,
  correct: colors.feedback.successLight,
  wrong: colors.feedback.nudgeLight,
  disabled: colors.surface.sunken,
};

const stateBorder: Record<TileState, string> = {
  idle: colors.border.subtle,
  correct: colors.feedback.success,
  wrong: colors.feedback.nudge,
  disabled: colors.border.subtle,
};

const stateLabel: Record<TileState, string> = {
  idle: colors.text.primary,
  correct: colors.feedback.success,
  wrong: '#B5862A',
  disabled: colors.text.muted,
};

const sizeMap = {
  sm: touchTarget.min,
  md: touchTarget.child,
  lg: touchTarget.hero,
} as const;

const fontMap = {
  sm: typography.size.title,
  md: typography.size.display,
  lg: typography.size.hero,
} as const;

export function Tile({
  label,
  romanization,
  onPress,
  state = 'idle',
  size = 'md',
  accessibilityLabel,
  testID,
}: TileProps): React.ReactElement {
  const dim = sizeMap[size];

  const inner = (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
      }}
    >
      <Text
        style={{
          fontSize: fontMap[size],
          fontWeight: typography.weight.bold,
          color: stateLabel[state],
          lineHeight: fontMap[size] * 1.05,
        }}
      >
        {label}
      </Text>
      {romanization ? (
        <Text
          style={{
            marginTop: spacing.xxs,
            fontSize: typography.size.bodySm,
            color: colors.text.muted,
            fontWeight: typography.weight.medium,
          }}
        >
          {romanization}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress || state === 'disabled') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        style={{
          minWidth: dim,
          minHeight: dim,
          padding: spacing.md,
          backgroundColor: stateBg[state],
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: stateBorder[state],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Korean letter ${label}, tap to select`}
      hitSlop={spacing.sm}
      style={({ pressed }) => ({
        minWidth: dim,
        minHeight: dim,
        padding: spacing.md,
        backgroundColor: stateBg[state],
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: stateBorder[state],
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 1.04 : 1 }],
        ...shadows.card,
      })}
    >
      {inner}
    </Pressable>
  );
}
