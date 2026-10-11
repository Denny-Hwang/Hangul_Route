import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { borderWidth, colors, radii, spacing } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { SPARK_DEFAULT_MAX_ROWS, SPARK_FILL_MS, isNewlyLit, sparkCount, sparkEntrance, sparkLayout, type SparkLayout } from '../../spark';
import type { SparkMeterProps } from './types';

/** A four-point spark in a 24-unit box. */
const sparkPath = 'M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z';
const VIEWBOX = 24;
/** Unscaled slot size and gap; both scale with the window like PipRow (useMediaSize). */
const SLOT = spacing.lg;
const GAP = spacing.xs;
const START_SCALE = 0.6;

/**
 * SparkMeter — slots that light one by one as words are caught
 * (F-VOC-004 §3.6, §3.9; design/components/SparkMeter/spec.md).
 *
 * Fill-only: a newly lit slot plays one 300 ms scale-and-fade (instant under
 * reduced motion); nothing ever animates downward, blinks or pulses. Past
 * `slots` the sparks start another row, up to `maxRows`, then the meter reads
 * as full of sparks (a soft brand.primaryLight backdrop). No copy: the caller
 * passes the accessible name, and the slots themselves are hidden from
 * assistive technology.
 */
export function SparkMeter({ value, slots, maxRows, reserveRows = false, accessibilityLabel, testID }: SparkMeterProps): React.ReactElement {
  const layout = sparkLayout(value, slots, maxRows);
  const size = useMediaSize(SLOT);
  const gap = useMediaSize(GAP);
  // Synchronous, so the first frame of a newly lit spark is already right (no async round-trip, no blink).
  const reducedMotion = useReducedMotion();
  // The count drawn at the last commit: slots between it and the new count are the ones just earned.
  const previous = useRef(layout.filled);
  const previousFilled = previous.current;
  useEffect(() => {
    previous.current = layout.filled;
  }, [layout.filled]);
  return (
    <SparkMeterBody
      layout={layout}
      previousFilled={previousFilled}
      reducedMotion={reducedMotion}
      size={size}
      gap={gap}
      reservedRows={reserveRows ? sparkCount(maxRows ?? SPARK_DEFAULT_MAX_ROWS) : undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
}

export interface SparkMeterBodyProps {
  layout: SparkLayout;
  /** Sparks drawn at the previous commit (equal to `layout.filled` at mount, so nothing animates then). */
  previousFilled: number;
  reducedMotion: boolean;
  /** Resolved slot size and gap (already scaled). */
  size: number;
  gap: number;
  /** When set, the height of this many rows is held from the start, so content below never moves. */
  reservedRows?: number;
  accessibilityLabel: string;
  testID?: string;
}

/** The meter for a resolved layout and size, without hooks (tested by calling it). */
export function SparkMeterBody({
  layout,
  previousFilled,
  reducedMotion,
  size,
  gap,
  reservedRows,
  accessibilityLabel,
  testID,
}: SparkMeterBodyProps): React.ReactElement {
  const heldRows = Math.max(layout.rows.length, reservedRows ?? 0);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        alignSelf: 'flex-start',
        gap,
        padding: gap,
        minHeight: reservedRows === undefined ? undefined : heldRows * size + (heldRows - 1) * gap + 2 * gap,
        borderRadius: heldRows > 1 ? radii.lg : radii.pill,
        backgroundColor: layout.full ? colors.brand.primaryLight : undefined,
      }}
    >
      {layout.rows.map((lit, row) => (
        <View
          key={row}
          // Hidden on native through the two native props and on web through aria-hidden
          // (react-native-web maps only that one to the DOM).
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          aria-hidden
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
        >
          {Array.from({ length: layout.slots }, (_, i) =>
            i < lit ? (
              <LitSpark
                key={i}
                size={size}
                newlyLit={isNewlyLit(row * layout.slots + i, previousFilled, layout.filled)}
                reducedMotion={reducedMotion}
              />
            ) : (
              <EmptySlot key={i} size={size} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/** An empty slot: a quiet circle whose outline is `borderWidth.thin` on screen at any slot size. */
export function EmptySlot({ size }: { size: number }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      <Circle
        cx={VIEWBOX / 2}
        cy={VIEWBOX / 2}
        r={7}
        fill={colors.surface.sunken}
        stroke={colors.border.strong}
        strokeWidth={(borderWidth.thin * VIEWBOX) / size}
      />
    </Svg>
  );
}

/**
 * A lit spark. It mounts when its slot lights (an empty slot is a different
 * element), so its first progress value is set before the first frame: a
 * newly lit spark starts hidden and fades in once, under reduced motion it is
 * simply there, and a spark lit when the meter appears is drawn as it is.
 */
export function LitSpark({ size, newlyLit, reducedMotion }: { size: number; newlyLit: boolean; reducedMotion: boolean }): React.ReactElement {
  const entrance = sparkEntrance(newlyLit, reducedMotion);
  const progress = useSharedValue<number>(entrance.from);
  useEffect(() => {
    if (entrance.play) progress.value = withTiming(1, { duration: SPARK_FILL_MS, easing: Easing.out(Easing.quad) });
    // Mount-only: the fill belongs to the moment the spark is earned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: START_SCALE + (1 - START_SCALE) * progress.value }],
  }));
  return (
    <Animated.View style={animatedStyle}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Path d={sparkPath} fill={colors.brand.primary} />
      </Svg>
    </Animated.View>
  );
}
