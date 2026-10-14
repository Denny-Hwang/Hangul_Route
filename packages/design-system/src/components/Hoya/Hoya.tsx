import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { hoyaFigure, hoyaPaintProps, type HoyaFur, type HoyaPart } from '../../scene-art/hoya';
import { hoyaVariantColors } from '../../tokens';
import type { HoyaPose, HoyaProps } from './types';

/**
 * Hoya, the geometric SVG tiger, v1 placeholder (design/brief/character/hoya-character-sheet.md).
 * The drawing is data: this component renders `hoyaFigure(pose)` from
 * `scene-art/hoya.ts`, the same figure the scene art places as `hoya:<pose>`
 * (`hoyaNodes`), so the mascot is drawn in one place (F-STORY-002 PR 2.11).
 *
 * Real illustrator output (5 poses at 480x480 each) lands in
 * design/characters/hoya/v1/ and replaces this drawing in a later sprint.
 *
 * Critical contract (anti-shame, F-002 §3), kept by the data:
 *   - `thinking` pose looks UP-RIGHT (curious), NEVER down (sad).
 *   - Cheek blush visible ONLY in idle / cheering / waving.
 *   - No sharp teeth, no narrowed angry eyes, no pure black anywhere.
 */

type Fur = HoyaFur;

/** `hoyaFigure` is pure, so each pose's part tree is built once and reused across renders. */
const figureCache = new Map<HoyaPose, readonly HoyaPart[]>();
function figureOf(pose: HoyaPose): readonly HoyaPart[] {
  let parts = figureCache.get(pose);
  if (parts === undefined) {
    parts = hoyaFigure(pose);
    figureCache.set(pose, parts);
  }
  return parts;
}

function renderPart(part: HoyaPart, key: number, fur: Fur): React.ReactElement {
  const paint = hoyaPaintProps(part, fur);
  switch (part.t) {
    case 'group':
      return (
        <G key={key} {...paint}>
          {part.kids.map((kid, i) => renderPart(kid, i, fur))}
        </G>
      );
    case 'rect':
      return <Rect key={key} x={part.x} y={part.y} width={part.w} height={part.h} {...(part.r === undefined ? {} : { rx: part.r, ry: part.r })} {...paint} />;
    case 'circle':
      return <Circle key={key} cx={part.cx} cy={part.cy} r={part.r} {...paint} />;
    case 'ellipse':
      return <Ellipse key={key} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...paint} />;
    case 'line':
      return <Line key={key} x1={part.x1} y1={part.y1} x2={part.x2} y2={part.y2} {...paint} />;
    case 'path':
      return <Path key={key} d={part.d} {...paint} />;
  }
}

export function Hoya({
  pose = 'idle',
  size = 96,
  variant = 'orange',
  testID,
  accessibilityLabel,
}: HoyaProps): React.ReactElement {
  const fur = hoyaVariantColors(variant);
  const parts = figureOf(pose);

  // F-MOTION-001 pose-transition pulse — scale 1 → 1.06 → 1 over ~300ms
  // when the `pose` prop changes (skipped on initial mount and when OS
  // reports prefers-reduced-motion). Animates the wrapper View; the SVG
  // content swaps instantly underneath.
  const scale = useSharedValue(1);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled || reduced) return;
        scale.value = withSequence(
          withTiming(1.06, { duration: 150, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
          withTiming(1.0, { duration: 150, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pose, scale]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={wrapperStyle}>
      <Svg
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? `Hoya the tiger, ${pose}`}
        width={size}
        height={size}
        viewBox="0 0 128 128"
      >
        {parts.map((part, i) => renderPart(part, i, fur))}
      </Svg>
    </Animated.View>
  );
}
