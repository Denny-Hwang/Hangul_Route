import { a11yRomanization } from '@hangul-route/content-schema';
import { colors, motion, typography } from '@hangul-route/design-system';
import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
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
import { Svg, Circle, G, Path, Text as SvgText } from 'react-native-svg';
import type { Messages } from '@hangul-route/i18n';
import type { JamoStrokePoint } from '../content/jamo-strokes';
import { useMessages } from '../i18n/use-messages';
import {
  BADGE_RADIUS,
  buildStrokeDiagram,
  describeStrokeOrder,
  pointsToPathD,
  staticHintHoldMs,
} from '../logic/stroke-diagram';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** The hint look: `feedback.nudge` strokes at this opacity (today's value), 14 wide on the 200 viewBox. */
const HINT_OPACITY = 0.6;
const HINT_WIDTH = 14;
/** The demo's fade-out, and its hold after the last stroke (today's values). */
const FADE_OUT_MS = 400;
const HOLD_AFTER_MS = 100;
/** [SO] The reveal's easing: the `motion.easing.standard` token ("cubic-bezier(0.2, 0, 0, 1)") as Reanimated's bezier. */
const STANDARD_BEZIER = (motion.easing.standard.match(/-?[\d.]+/g) ?? []).map(Number) as [number, number, number, number];

/** [SO] The shape is up at least this long, so a one-stroke letter is not gone after 100 ms (SO-0c design). */
export const SHAPE_HOLD_MIN_MS = 1000;

/**
 * [SO] How long the shape reveal holds the whole letter: max(1000, (n - 1) x crawl + 100), so from three strokes the
 * reveal takes as long as today's demo (design/screens/minigame-writing/trace-stroke-shape-guide.md, "Look").
 */
export function shapeHoldMs(strokes: number): number {
  return Math.max(SHAPE_HOLD_MIN_MS, (strokes - 1) * motion.duration.crawl + HOLD_AFTER_MS);
}

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
  /**
   * The stroke-order labels; default the app's catalogue (`useMessages`). The presenter passes
   * its own, in the deck's language (F-TCH-004 section 3.12).
   */
  strokeOrder?: Messages['a11y']['minigame']['strokeOrder'];
  /**
   * The still diagram's stroke order read aloud, in place of the plain list of strokes: Trace a
   * Word reads a block letter by letter. Default `describeStrokeOrder(target)`.
   */
  orderLabel?: string;
  /**
   * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.2: whether this letter's (or unit's) stroke order has been checked by a
   * person (`strokeOrderTaught`). When false Show me shows the shape only: every stroke fades in together, no moving
   * dot, and the still has no numbers and no arrows.
   */
  orderTaught: boolean;
  /** The romanized letter (never a Hangul glyph) for the shape label `strokeOrder.shape`, read through `a11yRomanization`. */
  romanization: string;
  /**
   * Told which look the hint settled on: `animated` (the demo or the shape reveal) or `static` (the still, under
   * reduced motion or when the query fails). The presenter hides its own letter while an untaught reveal plays.
   */
  onShow?: (mode: 'animated' | 'static') => void;
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
 * for `staticHintHoldMs`, then `onComplete` fires. A tap anywhere on the
 * diagram dismisses it early, and its accessibility label reads the stroke
 * order aloud. The same still diagram is the fallback when the
 * reduced-motion query itself fails, so "Show me" can never get stuck.
 *
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.2 (design: trace-stroke-shape-guide.md): for a letter whose stroke order
 * nobody has checked yet (`orderTaught` false) it teaches no order. The demo is a shape reveal: every stroke in one
 * group, faded in together by one shared value, held, faded out; the still shows the letter with no badges and no
 * arrows; both read one label, `strokeOrder.shape(romanization)`. It draws no caption: the game screen's strip does.
 */
export function StrokeHint({
  target,
  size,
  viewBox = 200,
  onComplete,
  playToken,
  strokeOrder: strokeOrderOverride,
  orderLabel,
  orderTaught,
  romanization,
  onShow,
}: Props): ReactElement | null {
  const appStrokeOrder = useMessages().a11y.minigame.strokeOrder;
  const strokeOrder = strokeOrderOverride ?? appStrokeOrder;
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
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  // The still diagram's hold timer, so a tap can end the hold early.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissStill = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    finish();
  }, [finish]);

  useEffect(() => {
    if (target.length === 0) return;
    let cancelled = false;

    const showStill = (): void => {
      setMode('static');
      onShowRef.current?.('static');
      holdTimerRef.current = setTimeout(finish, staticHintHoldMs(target.length));
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          showStill();
          return;
        }
        setMode('animated');
        onShowRef.current?.('animated');
        if (!orderTaught) {
          // [SO] The shape reveal: one shared value fades the whole letter in, holds it, fades it out. The hold is
          // worked out here, on the JS side: the timing callback runs on the UI thread.
          const hold = shapeHoldMs(target.length);
          opacity.value = 0;
          opacity.value = withTiming(
            HINT_OPACITY,
            { duration: motion.duration.crawl, easing: Easing.bezier(...STANDARD_BEZIER) },
            (finished) => {
              if (!finished) return;
              opacity.value = withDelay(
                hold,
                withTiming(0, { duration: FADE_OUT_MS }, () => {
                  runOnJS(finish)();
                }),
              );
            },
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
            HOLD_AFTER_MS,
            withTiming(target.length, { duration: 1 }, () => {
              opacity.value = withTiming(
                0,
                { duration: FADE_OUT_MS },
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
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    };
  }, [target, playToken, sweep, opacity, finish, orderTaught]);

  if (target.length === 0) return null;

  const shapeLabel = strokeOrder.shape(a11yRomanization(romanization));

  if (mode === 'static') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={strokeOrder.close(orderTaught ? (orderLabel ?? describeStrokeOrder(target, strokeOrder)) : shapeLabel)}
        onPress={dismissStill}
        style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
      >
        <StrokeOrderDiagram target={target} size={size} viewBox={viewBox} numbered={orderTaught} />
      </Pressable>
    );
  }

  if (!orderTaught) {
    // One accessible node over the canvas while the shape is up: "o, shape guide." (SO-0c wireframe section 8).
    return (
      <View
        pointerEvents="none"
        accessible
        accessibilityLabel={shapeLabel}
        style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }}
      >
        <ShapeReveal target={target} size={size} viewBox={viewBox} opacity={opacity} />
      </View>
    );
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

/**
 * [SO] The shape reveal: every stroke in the hint look, opaque inside one group whose opacity is the one shared value,
 * so the strokes appear together and crossings (ㅗ's junction, ㅁ's corners) do not darken into dot-like marks.
 */
function ShapeReveal({
  target,
  size,
  viewBox,
  opacity,
}: {
  target: JamoStrokePoint[][];
  size: number;
  viewBox: number;
  opacity: SharedValue<number>;
}): ReactElement {
  const groupProps = useAnimatedProps(() => ({ opacity: opacity.value }) as { opacity: number });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`} style={{ position: 'absolute', top: 0, left: 0 }}>
      <AnimatedG animatedProps={groupProps}>
        {target.map((stroke, idx) => (
          <Path
            key={idx}
            d={pointsToPathD(stroke)}
            stroke={colors.feedback.nudge}
            strokeWidth={HINT_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </AnimatedG>
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
}: TrailProps): ReactElement {
  const pathD = pointsToPathD(stroke);

  // Trail opacity: 0 before sweep reaches this stroke, growing to ~0.6 once active
  const trailProps = useAnimatedProps(() => {
    const t = sweep.value;
    const local = Math.max(0, Math.min(1, t - strokeIndex));
    // local 0..1 — fraction of this stroke that's been swept
    const opacityValue = local * HINT_OPACITY * opacity.value;
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
        strokeWidth={HINT_WIDTH}
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
 * each stroke goes. Nothing moves. [SO] Untaught (`numbered` false): the
 * letter only, in one group at the hint opacity, with no badges and no arrows.
 */
function StrokeOrderDiagram({
  target,
  size,
  viewBox,
  numbered,
}: {
  target: JamoStrokePoint[][];
  size: number;
  viewBox: number;
  numbered: boolean;
}): ReactElement {
  if (!numbered) {
    return (
      <Svg
        pointerEvents="none"
        width={size}
        height={size}
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <G opacity={HINT_OPACITY}>
          {target.map((stroke, idx) => (
            <Path
              key={idx}
              d={pointsToPathD(stroke)}
              stroke={colors.feedback.nudge}
              strokeWidth={HINT_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>
    );
  }
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
          strokeOpacity={HINT_OPACITY}
          strokeWidth={HINT_WIDTH}
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
        <Fragment key={`badge-${item.order}`}>
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
        </Fragment>
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
