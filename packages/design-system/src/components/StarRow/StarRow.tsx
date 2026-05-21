import React, { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../../tokens';
import type { StarRowProps } from './types';

const starPath =
  'M12 2 L14.94 8.26 L22 9.27 L17 14.14 L18.18 21 L12 17.77 L5.82 21 L7 14.14 L2 9.27 L9.06 8.26 Z';

/**
 * StarRow — 0-3 amber stars in a horizontal row.
 *
 * F-MOTION-004 — each filled star pops in (scale 0 → 1.2 → 1.0) over
 * ~300ms with a 120ms stagger between filled stars. Unfilled stars
 * appear statically. Reduced-motion path: instant, no pop. Animation
 * fires once on mount only.
 */

export function StarRow({ stars, size = 32, testID }: StarRowProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityLabel={`${stars} of 3 stars earned`}
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {([0, 1, 2] as const).map((i) => {
        const filled = i < stars;
        return <StarCell key={i} index={i} filled={filled} size={size} />;
      })}
    </View>
  );
}

function StarCell({
  index,
  filled,
  size,
}: {
  index: number;
  filled: boolean;
  size: number;
}): React.ReactElement {
  const scale = useSharedValue(filled ? 0 : 1);

  useEffect(() => {
    if (!filled) {
      scale.value = 1;
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          scale.value = 1;
          return;
        }
        // Stagger: 120ms × this star's filled-index
        scale.value = withDelay(
          index * 120,
          withSequence(
            withTiming(1.2, {
              duration: 180,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }),
            withTiming(1.0, {
              duration: 120,
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
            }),
          ),
        );
      })
      .catch(() => {
        scale.value = 1;
      });
    return () => {
      cancelled = true;
    };
    // Mount-only: deliberately do not include `filled` in deps so re-renders
    // with a different `stars` count don't re-animate (per spec §3.3).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={starPath}
          fill={filled ? colors.feedback.nudge : colors.surface.sunken}
          stroke={filled ? '#B5862A' : colors.border.strong}
          strokeWidth={1.2}
        />
      </Svg>
    </Animated.View>
  );
}
