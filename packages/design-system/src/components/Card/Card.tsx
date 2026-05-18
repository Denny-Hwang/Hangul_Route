import React from 'react';
import { Pressable, View } from 'react-native';
import { colors, radii, shadows, spacing } from '../../tokens';
import type { CardPadding, CardProps } from './types';

const padMap: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
};

const toneBg: Record<NonNullable<CardProps['tone']>, string> = {
  paper: colors.surface.paper,
  sunken: colors.surface.sunken,
  brand: colors.brand.primaryLight,
  success: colors.feedback.successLight,
  nudge: colors.feedback.nudgeLight,
};

export function Card({
  children,
  elevation = 'card',
  padding = 'md',
  tone = 'paper',
  onPress,
  accessibilityLabel,
  testID,
  style,
}: CardProps): React.ReactElement {
  const elevationStyle = elevation === 'flat' ? {} : shadows[elevation];
  const baseStyle = {
    backgroundColor: toneBg[tone],
    borderRadius: radii.lg,
    padding: padMap[padding],
    ...elevationStyle,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          baseStyle,
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} testID={testID} style={[baseStyle, style]}>
      {children}
    </View>
  );
}
