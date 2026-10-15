import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../../tokens';
import { tileMetrics } from './metrics';
import type { TileProps, TileState } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

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

export function Tile({
  label,
  romanization,
  onPress,
  state = 'idle',
  size = 'md',
  dimension,
  accessibilityLabel,
  testID,
}: TileProps): React.ReactElement {
  // The glyph is part of the tile's picture, so it grows with the tile (type tokens themselves are unchanged).
  const { dim, glyph } = tileMetrics(size, dimension);

  const inner = (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
      }}
    >
      <Text {...KOREAN_LINE_BREAK}
        style={{
          fontSize: glyph,
          fontWeight: typography.weight.bold,
          color: stateLabel[state],
          lineHeight: glyph * 1.05,
        }}
      >
        {label}
      </Text>
      {romanization ? (
        <Text {...KOREAN_LINE_BREAK}
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
