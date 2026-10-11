import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { borderWidth, colors, radii, spacing } from '../../tokens';
import { SPARK_FILL_MS, sparkLayout } from '../../spark';
import type { SparkMeterProps } from './types';

/** A four-point spark in a 24-unit box. */
const sparkPath = 'M12 1.5 L14.6 9.4 L22.5 12 L14.6 14.6 L12 22.5 L9.4 14.6 L1.5 12 L9.4 9.4 Z';
const SLOT = spacing.lg;
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
export function SparkMeter({ value, slots, maxRows, accessibilityLabel, testID }: SparkMeterProps): React.ReactElement {
  const layout = sparkLayout(value, slots, maxRows);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        alignSelf: 'flex-start',
        gap: spacing.xs,
        padding: spacing.xs,
        borderRadius: layout.rows.length > 1 ? radii.lg : radii.pill,
        backgroundColor: layout.full ? colors.brand.primaryLight : undefined,
      }}
    >
      {layout.rows.map((lit, row) => (
        <View
          key={row}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{ flexDirection: 'row', gap: spacing.xs }}
        >
          {Array.from({ length: layout.slots }, (_, i) => (
            <SparkSlot key={i} lit={i < lit} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SparkSlot({ lit }: { lit: boolean }): React.ReactElement {
  // Slots lit at mount appear as they are: the fade belongs to the moment a spark is earned.
  const progress = useSharedValue(1);
  const wasLit = useRef(lit);

  useEffect(() => {
    if (lit === wasLit.current) return;
    wasLit.current = lit;
    if (!lit) {
      // Never animate downward (the reducer never lowers sparks; this only guards a caller).
      progress.value = 1;
      return;
    }
    let cancelled = false;
    progress.value = 0;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        progress.value = reduced ? 1 : withTiming(1, { duration: SPARK_FILL_MS, easing: Easing.out(Easing.quad) });
      })
      .catch(() => {
        progress.value = 1;
      });
    return () => {
      cancelled = true;
      progress.value = 1;
    };
  }, [lit, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: START_SCALE + (1 - START_SCALE) * progress.value }],
  }));

  if (!lit) {
    return (
      <Svg width={SLOT} height={SLOT} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={7} fill={colors.surface.sunken} stroke={colors.border.strong} strokeWidth={borderWidth.base} />
      </Svg>
    );
  }
  return (
    <Animated.View style={animatedStyle}>
      <Svg width={SLOT} height={SLOT} viewBox="0 0 24 24">
        <Path d={sparkPath} fill={colors.brand.primary} />
      </Svg>
    </Animated.View>
  );
}
