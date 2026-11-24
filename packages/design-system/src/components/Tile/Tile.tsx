import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { borderWidth, colors, radii, shadows, spacing, typography } from '../../tokens';
import { pressInset, pressTransform } from '../../press-look';
import { TapTarget, usePressLook } from '../TapBoard';
import { useTypeScale } from '../TextSize';
import { Icon } from '../Icon';
import { tileMetrics } from './metrics';
import { TILE_MARK, tileStyle } from './style';
import type { TileProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

export function Tile({
  label,
  romanization,
  onPress,
  state = 'idle',
  disabled = false,
  locked = false,
  size = 'md',
  dimension,
  accessibilityLabel,
  testID,
}: TileProps): ReactElement {
  // The glyph is part of the tile's picture, so it grows with the tile (type tokens themselves are unchanged).
  const scale = useTypeScale().size;
  const { dim, glyph } = tileMetrics(size, dimension, scale);
  const press = usePressLook();
  const look = tileStyle(state);

  // [AU] AU-17a, F-A11Y-001 AF-1: a result is not told by colour alone (`check` right, `replay` a miss). On a disc that
  // straddles the top-end corner, out of the flow, so the tile keeps its size and the mark never covers the glyph or the
  // romanization line at any text size (`TILE_MARK`, AnswerFeedback D2). Decorative: the caller's name has the state.
  const mark =
    look.mark === null ? null : (
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: TILE_MARK.offset,
          right: TILE_MARK.offset,
          padding: TILE_MARK.padding,
          borderRadius: radii.circle,
          borderWidth: TILE_MARK.casing,
          borderColor: colors.text.primary,
          backgroundColor: look.mark.disc,
        }}
      >
        <Icon name={look.mark.icon} size={TILE_MARK.size} color={look.mark.color} />
      </View>
    );

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
          color: look.labelColor,
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
            color: look.romanizationColor,
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
          backgroundColor: look.backgroundColor,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: look.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {inner}
        {mark}
      </View>
    );
  }

  // A `disabled` or `locked` tile stays a TapTarget, so a board still claims a touch on it and it keeps its state's look;
  // it never commits (AMENDMENTS-TOUCH R3). A locked one (an answered tile, F-A11Y-001 AF-1) is `inactive`: still a
  // focusable button, never announced as disabled.
  // TapTarget (AMENDMENTS-TOUCH section 4.4): inside a TapBoard the board decides the tap; outside one it is a plain
  // button with the press guard. Its own box is the hit area; the press look (section 4.3: a thick border.shape outline
  // and a 0.97 shrink, none under reduced motion) goes on the drawn box inside it, which fills it.
  return (
    <TapTarget
      testID={testID}
      onCommit={onPress}
      disabled={disabled}
      inactive={locked}
      accessibilityLabel={accessibilityLabel ?? `Korean letter ${label}, tap to select`}
    >
      {({ pressed: touched }) => {
        // A disabled or locked tile never shows the press look (section 4.3): it takes no tap.
        const pressed = touched && !disabled && !locked;
        return (
            <View
              style={{
                flexGrow: 1,
                minWidth: dim,
                minHeight: dim,
                // A thicker press outline grows inward (off the padding), so the tile keeps its size and nothing moves.
                padding: spacing.md - pressInset(pressed ? press : null, borderWidth.base),
                backgroundColor: look.backgroundColor,
                borderRadius: radii.lg,
                borderWidth: pressed ? press.borderWidth : borderWidth.base,
                borderColor: pressed ? press.borderColor : look.borderColor,
                alignItems: 'center',
                justifyContent: 'center',
                transform: pressTransform(pressed ? press : null),
                ...shadows.card,
              }}
            >
              {inner}
              {mark}
            </View>
        );
      }}
    </TapTarget>
  );
}
