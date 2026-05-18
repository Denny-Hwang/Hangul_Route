import React from 'react';
import { Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../tokens';
import type { PillProps, PillTone } from './types';

const bg: Record<PillTone, string> = {
  neutral: colors.surface.sunken,
  primary: colors.brand.primaryLight,
  secondary: colors.brand.secondaryLight,
  success: colors.feedback.successLight,
  nudge: colors.feedback.nudgeLight,
  info: colors.feedback.infoLight,
};

const fg: Record<PillTone, string> = {
  neutral: colors.text.secondary,
  primary: colors.brand.primaryDark,
  secondary: colors.brand.secondaryDark,
  success: '#2F6A47',
  nudge: '#B5862A',
  info: '#2E5BC7',
};

export function Pill({ label, tone = 'neutral', size = 'md', testID }: PillProps): React.ReactElement {
  const padY = size === 'sm' ? spacing.xxs : spacing.xs;
  const padX = size === 'sm' ? spacing.sm : spacing.md;
  const fontSize = size === 'sm' ? typography.size.caption : typography.size.bodySm;

  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: padX,
        paddingVertical: padY,
        backgroundColor: bg[tone],
        borderRadius: radii.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color: fg[tone],
          fontSize,
          fontWeight: typography.weight.semibold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
