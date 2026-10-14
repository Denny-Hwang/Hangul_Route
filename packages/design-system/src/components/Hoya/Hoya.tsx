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
import { hoyaFigure, type HoyaPart } from '../../scene-art/hoya';
import { resolveColor } from '../../scene-art/tokens-map';
import type { ColorToken } from '../../scene-art/types';
import { hoyaVariantColors } from '../../tokens';
import type { HoyaProps } from './types';

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

type Fur = { fur: string; furDark: string };

/** A token's colour, with the gold cub's fur pair swapped for the learner's variant. */
function colorOf(token: ColorToken | 'none', fur: Fur): string {
  if (token === 'none') return 'none';
  if (token === 'hoya.fur') return fur.fur;
  if (token === 'hoya.furDark') return fur.furDark;
  return resolveColor(token);
}

/** The svg paint props a part sets, and only those. */
function paintProps(part: HoyaPart, fur: Fur): Record<string, string | number> {
  const props: Record<string, string | number> = {};
  if (part.fill !== undefined) props.fill = colorOf(part.fill, fur);
  if (part.stroke !== undefined) props.stroke = colorOf(part.stroke, fur);
  if (part.strokeWidth !== undefined) props.strokeWidth = part.strokeWidth;
  if (part.strokeLinecap !== undefined) props.strokeLinecap = part.strokeLinecap;
  if (part.strokeLinejoin !== undefined) props.strokeLinejoin = part.strokeLinejoin;
  if (part.opacity !== undefined) props.opacity = part.opacity;
  return props;
}

function renderPart(part: HoyaPart, key: number, fur: Fur): React.ReactElement {
  const paint = paintProps(part, fur);
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
  const parts = hoyaFigure(pose);

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
