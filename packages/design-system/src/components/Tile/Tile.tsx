import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { borderWidth, colors, radii, shadows, spacing, typography } from '../../tokens';
import { pressInset, pressTransform } from '../../press-look';
import { TapTarget, usePressLook } from '../TapBoard';
import { useTypeScale } from '../TextSize';
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
  disabled = false,
  size = 'md',
  dimension,
  accessibilityLabel,
  testID,
}: TileProps): ReactElement {
  // The glyph is part of the tile's picture, so it grows with the tile (type tokens themselves are unchanged).
  const scale = useTypeScale().size;
  const { dim, glyph } = tileMetrics(size, dimension, scale);
  const press = usePressLook();

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
            fontSize: scale.bodySm,
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

  // A `disabled` tile (a locked wrong one) stays a TapTarget, so a board still claims a touch on it and it keeps its
  // state's look; the target is disabled, so it never commits (AMENDMENTS-TOUCH R3).
  // TapTarget (AMENDMENTS-TOUCH section 4.4): inside a TapBoard the board decides the tap; outside one it is a plain
  // button with the press guard. Its own box is the hit area; the press look (section 4.3: a thick border.shape outline
  // and a 0.97 shrink, none under reduced motion) goes on the drawn box inside it, which fills it.
  return (
    <TapTarget
      testID={testID}
      onCommit={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? `Korean letter ${label}, tap to select`}
    >
      {({ pressed: touched }) => {
        // A disabled tile never shows the press look (section 4.3): it takes no tap.
        const pressed = touched && !disabled;
        return (
            <View
              style={{
                flexGrow: 1,
                minWidth: dim,
                minHeight: dim,
                // A thicker press outline grows inward (off the padding), so the tile keeps its size and nothing moves.
                padding: spacing.md - pressInset(pressed ? press : null, borderWidth.base),
                backgroundColor: stateBg[state],
                borderRadius: radii.lg,
                borderWidth: pressed ? press.borderWidth : borderWidth.base,
                borderColor: pressed ? press.borderColor : stateBorder[state],
                alignItems: 'center',
                justifyContent: 'center',
                transform: pressTransform(pressed ? press : null),
                ...shadows.card,
              }}
            >
              {inner}
            </View>
        );
      }}
    </TapTarget>
  );
}
