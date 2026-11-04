import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radii, shadows, spacing } from '../../tokens';
import { NO_PRESS_DELAY } from '../TapBoard/press-delay';
import { usePressGuard } from '../TapBoard/use-press-guard';
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
  accessibilityHint,
  testID,
  style,
}: CardProps): ReactElement {
  // AMENDMENTS-TOUCH 6.9 (row KT-9): a pressable card (a Home card, the route strip) is a learner non-game target. A
  // bounce on it opens once, a press during the app-level tap lock is dropped, and an opening press sets that lock, so
  // the bounce cannot press what the next screen puts under the finger. The hook runs for a static card too (hooks
  // never change order); it is used only when there is a handler.
  const guard = usePressGuard();
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
        onPress={guard(onPress)}
        {...NO_PRESS_DELAY}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
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
    <View accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} testID={testID} style={[baseStyle, style]}>
      {children}
    </View>
  );
}
