import { colors, motion, typography } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import type { JamoStrokePoint } from '../../content/jamo-strokes';
import {
  BADGE_RADIUS,
  buildStrokeDiagram,
  pointsToPathD,
  staticHintHoldMs,
} from '../../logic/stroke-diagram';

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
 * Honors prefers-reduced-motion with no motion at all: a still stroke-order
 * diagram (every stroke, numbered start badges, direction arrows) stays up
 * for `staticHintHoldMs`, then `onComplete` fires. The same still diagram is
 * the fallback when the reduced-motion query itself fails, so "Show me" can
 * never get stuck.
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
  const [mode, setMode] = useState<'pending' | 'animated' | 'static'>('pending');

  // The parent passes a fresh closure each render; keep the latest in a ref
  // so a re-render mid-demo does not restart it.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finish = useCallback(() => onCompleteRef.current?.(), []);

  useEffect(() => {
    if (target.length === 0) return;
    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;

    const showStill = (): void => {
      setMode('static');
      holdTimer = setTimeout(finish, staticHintHoldMs(target.length));
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          showStill();
          return;
        }
        setMode('animated');
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
                  runOnJS(finish)();
                },
              );
            }),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) showStill();
      });
    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [target, playToken, sweep, opacity, finish]);

  if (target.length === 0) return null;

  if (mode === 'static') {
    return <StrokeOrderDiagram target={target} size={size} viewBox={viewBox} />;
  }

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

/**
 * Reduced-motion "Show me" (F-007 §3.4): the whole letter at once — strokes
 * in the hint colour, a numbered badge at each start, an arrow for which way
 * each stroke goes. Nothing moves.
 */
function StrokeOrderDiagram({
  target,
  size,
  viewBox,
}: {
  target: JamoStrokePoint[][];
  size: number;
  viewBox: number;
}): React.ReactElement {
  const items = buildStrokeDiagram(target);
  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {items.map((item) => (
        <Path
          key={`stroke-${item.order}`}
          d={item.d}
          stroke={colors.feedback.nudge}
          strokeOpacity={0.6}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {items.map((item) =>
        item.arrow ? (
          <Path
            key={`arrow-${item.order}`}
            d={`${item.arrow.d} ${item.arrow.head}`}
            stroke={colors.text.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null,
      )}
      {items.map((item) => (
        <React.Fragment key={`badge-${item.order}`}>
          <Circle
            cx={item.badge.x}
            cy={item.badge.y}
            r={BADGE_RADIUS}
            fill={colors.surface.paper}
            stroke={colors.feedback.nudge}
            strokeWidth={2.5}
          />
          <SvgText
            x={item.badge.x}
            y={item.badge.y}
            dy={typography.size.caption / 3}
            fontSize={typography.size.caption}
            fontWeight={typography.weight.bold}
            fill={colors.text.primary}
            textAnchor="middle"
          >
            {String(item.order)}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
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
