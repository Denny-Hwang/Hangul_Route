import { motion } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { mayFlip, type FlipFace } from '../logic/flip';
import { useReducedMotion } from '../platform/motion';

/**
 * A card that turns over (F-VOC-003 section 3.5, F-MOTION-002), extracted from
 * CardDetailView so the heritage card and the vocabulary flashcards share one
 * flip. Design: design/components/FlipCard/spec.md (wireframes
 * library/card-detail.md and vocab/flashcards.md).
 *
 * The caller owns `face`. A tap rotates the card to edge-on over one
 * `motion.duration.base` leg, calls `onFlip` there (the caller swaps the
 * face while nothing is visible), then rotates back over a second leg. Taps
 * are ignored while turning or `disabled`; under reduced motion `onFlip` runs
 * at once with no rotation. `onFlippingChange` reports the turn so a caller
 * can gate actions that must not run mid-flip (Share, F-CARD-003 section 8).
 */
export interface FlipCardProps {
  face: FlipFace;
  onFlip: () => void;
  front: React.ReactNode;
  back: React.ReactNode;
  disabled?: boolean;
  onFlippingChange?: (flipping: boolean) => void;
  accessibilityLabelFront: string;
  accessibilityLabelBack: string;
  testID?: string;
}

const EASE = Easing.bezier(0.2, 0, 0, 1);

export function FlipCard({
  face,
  onFlip,
  front,
  back,
  disabled = false,
  onFlippingChange,
  accessibilityLabelFront,
  accessibilityLabelBack,
  testID,
}: FlipCardProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  // 0 = flat on the current face, 1 = edge-on at 90 degrees (the face swaps here).
  const progress = useSharedValue(0);
  const flippingRef = useRef(false);

  const animatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [0, 90]);
    return { transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }] };
  });

  function setFlipping(value: boolean): void {
    flippingRef.current = value;
    onFlippingChange?.(value);
  }

  const handlePress = (): void => {
    if (!mayFlip({ disabled, flipping: flippingRef.current })) return;
    if (reducedMotion) {
      onFlip();
      return;
    }
    setFlipping(true);
    const legMs = motion.duration.base;
    progress.value = withTiming(1, { duration: legMs, easing: EASE }, () => {
      runOnJS(onFlip)();
      progress.value = withTiming(0, { duration: legMs, easing: EASE }, () => {
        runOnJS(setFlipping)(false);
      });
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={face === 'front' ? accessibilityLabelFront : accessibilityLabelBack}
      testID={testID}
    >
      <Animated.View style={animatedStyle}>{face === 'front' ? front : back}</Animated.View>
    </Pressable>
  );
}
