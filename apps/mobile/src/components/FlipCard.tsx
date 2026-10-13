import { motion } from '@hangul-route/design-system';
import React, { useRef, type Ref } from 'react';
import { Pressable, type View } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cubicBezierPoints, flipAction, swapAtEdge, type FlipFace } from '../logic/flip';
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
  /** The card button's node, for a caller that moves screen-reader focus to it (the flashcards, on each new card). */
  pressableRef?: Ref<View>;
  testID?: string;
}

// The motion.easing.standard token; `Easing.ease` only if the token ever stops being a cubic-bezier.
const STANDARD = cubicBezierPoints(motion.easing.standard);
const EASE = STANDARD ? Easing.bezier(...STANDARD) : Easing.ease;

export function FlipCard({
  face,
  onFlip,
  front,
  back,
  disabled = false,
  onFlippingChange,
  accessibilityLabelFront,
  accessibilityLabelBack,
  pressableRef,
  testID,
}: FlipCardProps): React.ReactElement {
  const reducedMotion = useReducedMotion();
  // 0 = flat on the current face, 1 = edge-on at 90 degrees (the face swaps here).
  const progress = useSharedValue(0);
  const flippingRef = useRef(false);
  // The face showing now, and the face a running turn started on (the midpoint guard).
  const faceRef = useRef(face);
  faceRef.current = face;
  const startFaceRef = useRef<FlipFace>(face);

  const animatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [0, 90]);
    return { transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }] };
  });

  function setFlipping(value: boolean): void {
    flippingRef.current = value;
    onFlippingChange?.(value);
  }

  const turnBack = (): void => {
    progress.value = withTiming(0, { duration: motion.duration.base, easing: EASE }, () => {
      // Runs on finish and on cancel alike, so a cancelled turn never leaves taps locked.
      runOnJS(setFlipping)(false);
    });
  };

  const atEdge = (finished: boolean): void => {
    if (swapAtEdge({ finished, startFace: startFaceRef.current, currentFace: faceRef.current })) onFlip();
    turnBack();
  };

  const handlePress = (): void => {
    const action = flipAction({ disabled, flipping: flippingRef.current, reducedMotion });
    if (action === 'ignore') return;
    if (action === 'instant') {
      onFlip();
      return;
    }
    setFlipping(true);
    startFaceRef.current = face;
    progress.value = withTiming(1, { duration: motion.duration.base, easing: EASE }, (finished) => {
      runOnJS(atEdge)(finished === true);
    });
  };

  return (
    <Pressable
      ref={pressableRef}
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
