import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radii, spacing, touchTarget, typography } from '../../tokens';
import type { ButtonProps, ButtonSize, ButtonTone } from './types';

const toneBg: Record<ButtonTone, string> = {
  primary: colors.brand.primary,
  secondary: colors.brand.secondary,
  ghost: 'transparent',
  success: colors.feedback.success,
  nudge: colors.feedback.nudge,
};

const toneFg: Record<ButtonTone, string> = {
  primary: colors.text.onPrimary,
  secondary: colors.text.onSecondary,
  ghost: colors.brand.primary,
  success: colors.text.inverse,
  nudge: colors.text.primary,
};

const tonePressedBg: Record<ButtonTone, string> = {
  primary: colors.brand.primaryDark,
  secondary: colors.brand.secondaryDark,
  ghost: colors.brand.primaryLight,
  success: '#3F8A5C',
  nudge: '#D89B2B',
};

const sizeHeight: Record<ButtonSize, number> = {
  sm: touchTarget.min,
  md: touchTarget.min,
  lg: touchTarget.child,
  hero: touchTarget.hero,
};

const sizeFont: Record<ButtonSize, number> = {
  sm: typography.size.bodySm,
  md: typography.size.body,
  lg: typography.size.bodyLg,
  hero: typography.size.prompt,
};

const sizePaddingX: Record<ButtonSize, number> = {
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xl,
  hero: spacing.xxl,
};

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  leading,
  trailing,
  accessibilityLabel,
  testID,
}: ButtonProps): React.ReactElement {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={spacing.sm}
      style={({ pressed }) => ({
        minHeight: sizeHeight[size],
        paddingHorizontal: sizePaddingX[size],
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: disabled
          ? colors.surface.sunken
          : pressed
            ? tonePressedBg[tone]
            : toneBg[tone],
        borderWidth: tone === 'ghost' ? 2 : 0,
        borderColor: tone === 'ghost' ? colors.brand.primary : 'transparent',
        opacity: disabled ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
    >
      {leading ? <View style={{ marginRight: spacing.sm }}>{leading}</View> : null}
      <Text
        style={{
          color: disabled ? colors.text.muted : toneFg[tone],
          fontSize: sizeFont[size],
          fontWeight: typography.weight.semibold,
          letterSpacing: typography.tracking.normal,
        }}
      >
        {label}
      </Text>
      {trailing ? <View style={{ marginLeft: spacing.sm }}>{trailing}</View> : null}
    </Pressable>
  );
}
