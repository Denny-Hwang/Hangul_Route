import { colors, motion } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import type { JamoStrokePoint } from '../../content/jamo-strokes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  /** Ordered target strokes of the current jamo. */
  target: JamoStrokePoint[][];
  /** Pixel dimensions of the trace zone (square). */
  size: number;
  /** 200×200 viewBox the target coordinates are in. */
  viewBox?: number;
  /** Called when the entire animation completes. */
  onComplete?: () => void;
  /** Forces the demo to run when this number changes (e.g. tap counter). */
  playToken: number;
}

/**
 * F-007 — Animated stroke hint.
 *
 * Plays one demonstration of the target jamo: a bright dot walks each
 * stroke from start to end in order, leaving a fading trail. After all
 * strokes complete, the whole trail fades out and `onComplete` fires.
 *
 * Honors prefers-reduced-motion: each stroke flashes at full opacity for
 * 200ms in sequence instead of the dot-walk.
 */
export function StrokeHint({
  target,
  size,
  viewBox = 200,
  onComplete,
  playToken,
}: Props): React.ReactElement | null {
  // One progress shared value per stroke (0 → 1 along the path)
  // For simplicity, we use a single sweep value spanning all strokes.
  const sweep = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (target.length === 0) return;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          // Reduced-motion: flash each stroke 200ms each
          opacity.value = withSequence(
            ...target.flatMap(() => [
              withTiming(0.85, { duration: 200 }),
              withTiming(0, { duration: 200 }),
            ]),
            withTiming(0, { duration: 1 }, () => {
              if (onComplete) runOnJS(onComplete)();
            }),
          );
          return;
        }
        // Standard animation: sweep 0 → target.length (one per stroke),
        // then fade out.
        opacity.value = withTiming(1, { duration: 120 });
        sweep.value = 0;
        sweep.value = withSequence(
          ...target.map((_, i) =>
            withTiming(i + 1, {
              duration: motion.duration.crawl,
              easing: Easing.bezier(0.4, 0, 0.6, 1),
            }),
          ),
          withDelay(
            100,
            withTiming(target.length, { duration: 1 }, () => {
              opacity.value = withTiming(
                0,
                { duration: 400 },
                () => {
                  if (onComplete) runOnJS(onComplete)();
                },
              );
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [target, playToken, sweep, opacity, onComplete]);

  if (target.length === 0) return null;

  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {target.map((stroke, idx) => (
        <StrokeTrail
          key={idx}
          stroke={stroke}
          strokeIndex={idx}
          totalStrokes={target.length}
          sweep={sweep}
          opacity={opacity}
        />
      ))}
    </Svg>
  );
}

interface TrailProps {
  stroke: JamoStrokePoint[];
  strokeIndex: number;
  totalStrokes: number;
  sweep: SharedValue<number>;
  opacity: SharedValue<number>;
}

function StrokeTrail({
  stroke,
  strokeIndex,
  totalStrokes,
  sweep,
  opacity,
}: TrailProps): React.ReactElement {
  const pathD = pointsToPathD(stroke);

  // Trail opacity: 0 before sweep reaches this stroke, growing to ~0.6 once active
  const trailProps = useAnimatedProps(() => {
    const t = sweep.value;
    const local = Math.max(0, Math.min(1, t - strokeIndex));
    // local 0..1 — fraction of this stroke that's been swept
    const opacityValue = local * 0.6 * opacity.value;
    return { opacity: opacityValue } as { opacity: number };
  });

  // Walker dot position: only visible during this stroke's active window
  const dotProps = useAnimatedProps(() => {
    const t = sweep.value;
    const local = t - strokeIndex;
    const active = local > 0 && local <= 1;
    if (!active || stroke.length < 2) {
      return { opacity: 0, cx: stroke[0]?.x ?? 0, cy: stroke[0]?.y ?? 0 } as {
        opacity: number;
        cx: number;
        cy: number;
      };
    }
    // Walk along the polyline at fraction `local`
    const pt = pointAtFraction(stroke, local);
    return { opacity: opacity.value, cx: pt.x, cy: pt.y } as {
      opacity: number;
      cx: number;
      cy: number;
    };
  });

  void totalStrokes; // reserved for future per-stroke pacing tweaks

  return (
    <>
      <AnimatedPath
        d={pathD}
        stroke={colors.feedback.nudge}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        animatedProps={trailProps}
      />
      <AnimatedCircle r={10} fill={colors.feedback.nudge} animatedProps={dotProps} />
    </>
  );
}

function pointsToPathD(points: JamoStrokePoint[]): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]!;
    d += ` L ${pt.x} ${pt.y}`;
  }
  return d;
}

function pointAtFraction(stroke: JamoStrokePoint[], frac: number): JamoStrokePoint {
  'worklet';
  if (stroke.length === 0) return { x: 0, y: 0 };
  if (stroke.length === 1) return stroke[0]!;
  // Total polyline length
  let total = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1]!;
    const b = stroke[i]!;
    total += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }
  const target = total * Math.max(0, Math.min(1, frac));
  let accum = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1]!;
    const b = stroke[i]!;
    const seg = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    if (accum + seg >= target) {
      const local = seg === 0 ? 0 : (target - accum) / seg;
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }
    accum += seg;
  }
  return stroke[stroke.length - 1]!;
}
