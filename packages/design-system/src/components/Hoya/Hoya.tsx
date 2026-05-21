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
import { colors } from '../../tokens';
import type { HoyaPose, HoyaProps } from './types';

/**
 * Hoya — geometric SVG tiger character, v1 placeholder.
 * Refined per design/brief/character/hoya-character-sheet.md.
 *
 * Real illustrator output (5 poses at 480×480 each) lands in
 * design/characters/hoya/v1/ and replaces this component in a later sprint.
 *
 * Critical contract (anti-shame, F-002 §3):
 *   - `thinking` pose looks UP-RIGHT (curious), NEVER down (sad).
 *   - Cheek blush visible ONLY in idle / cheering / waving.
 *   - No sharp teeth, no narrowed angry eyes, no pure black anywhere.
 */

interface EyeSpec {
  leftCx: number;
  rightCx: number;
  y: number;
  rx: number;
  ry: number;
}

function eyeFor(pose: HoyaPose): EyeSpec {
  switch (pose) {
    case 'cheering':
      // Squinted joy — narrow horizontal slits curving upward.
      return { leftCx: 50, rightCx: 78, y: 70, rx: 4, ry: 1.6 };
    case 'thinking':
      // Looking UP-RIGHT — wider eyes shifted toward upper-right.
      return { leftCx: 51, rightCx: 79, y: 68, rx: 3, ry: 4.5 };
    case 'reading':
      // Looking DOWN at the book.
      return { leftCx: 50, rightCx: 78, y: 76, rx: 3, ry: 3.5 };
    case 'waving':
      return { leftCx: 50, rightCx: 78, y: 72, rx: 3.5, ry: 4 };
    default:
      return { leftCx: 50, rightCx: 78, y: 72, rx: 3.5, ry: 4 };
  }
}

function MouthFor({ pose }: { pose: HoyaPose }): React.ReactElement {
  switch (pose) {
    case 'cheering':
      // Wider soft smile — open "U" curve filled with cheek-pink.
      return (
        <Path
          d="M44 92 Q60 110 76 92 Q60 100 44 92 Z"
          fill={colors.hoya.cheek}
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'thinking':
      // Small neutral curve — not sad, not smiling — just thinking.
      return (
        <Path
          d="M53 96 Q60 92 67 96"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'reading':
      // Tiny horizontal line — concentrated.
      return (
        <Line x1={56} y1={95} x2={64} y2={95} stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" />
      );
    case 'waving':
      // Standard warm smile.
      return (
        <Path
          d="M48 92 Q60 104 72 92"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
    default:
      // Idle — small soft "U".
      return (
        <Path
          d="M50 92 Q60 100 70 92"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

function ArmsFor({ pose }: { pose: HoyaPose }): React.ReactElement | null {
  if (pose === 'cheering') {
    // Both arms raised up and out — joyful.
    return (
      <G>
        <Path d="M22 78 Q14 60 8 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Path d="M106 78 Q114 60 120 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Circle cx={8} cy={46} r={7} fill={colors.hoya.fur} />
        <Circle cx={120} cy={46} r={7} fill={colors.hoya.fur} />
      </G>
    );
  }
  if (pose === 'waving') {
    // Right arm raised in a wave.
    return (
      <G>
        <Path d="M104 76 Q116 64 122 54" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
        <Circle cx={122} cy={54} r={7} fill={colors.hoya.fur} />
      </G>
    );
  }
  if (pose === 'reading') {
    // Two small front paws holding the book.
    return (
      <G>
        <Circle cx={42} cy={102} r={6} fill={colors.hoya.fur} />
        <Circle cx={86} cy={102} r={6} fill={colors.hoya.fur} />
      </G>
    );
  }
  return null;
}

function Stripes(): React.ReactElement {
  // 3 tapered stripes on each side of the head + 1 on the forehead.
  // Soft curves following head curvature.
  return (
    <G stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none">
      {/* Left side stripes */}
      <Path d="M26 54 Q30 58 26 62" />
      <Path d="M24 70 Q29 73 25 78" />
      <Path d="M28 84 Q33 86 30 90" />
      {/* Right side stripes (mirrored) */}
      <Path d="M102 54 Q98 58 102 62" />
      <Path d="M104 70 Q99 73 103 78" />
      <Path d="M100 84 Q95 86 98 90" />
      {/* Forehead stripe */}
      <Path d="M64 24 Q66 30 64 36" />
    </G>
  );
}

function ThoughtCloud(): React.ReactElement {
  // Two small bubble dots leading from upper-right of head to the cloud.
  return (
    <G>
      <Circle cx={100} cy={26} r={2.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
      <Circle cx={106} cy={18} r={3.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
      <Rect
        x={108}
        y={2}
        width={18}
        height={12}
        rx={6}
        ry={6}
        fill={colors.surface.paper}
        stroke={colors.brand.secondary}
        strokeWidth={1.5}
      />
    </G>
  );
}

function CheerSparkles(): React.ReactElement {
  // Two 4-point pinwheel sparkles at top corners (per brief).
  // Each sparkle: two thin perpendicular diamonds.
  const Spark = ({ cx, cy }: { cx: number; cy: number }): React.ReactElement => (
    <G fill={colors.feedback.nudge} opacity={0.85}>
      <Path d={`M${cx} ${cy - 6} L${cx + 2} ${cy} L${cx} ${cy + 6} L${cx - 2} ${cy} Z`} />
      <Path d={`M${cx - 6} ${cy} L${cx} ${cy - 2} L${cx + 6} ${cy} L${cx} ${cy + 2} Z`} />
    </G>
  );
  return (
    <G>
      <Spark cx={20} cy={22} />
      <Spark cx={108} cy={22} />
    </G>
  );
}

function Book(): React.ReactElement {
  // Reading pose: cream rectangle with two black calligraphy strokes.
  return (
    <G>
      {/* Book base shadow */}
      <Rect x={36} y={98} width={56} height={20} rx={3} ry={3} fill={colors.hoya.furDark} opacity={0.2} />
      {/* Book body */}
      <Rect
        x={36}
        y={94}
        width={56}
        height={22}
        rx={3}
        ry={3}
        fill={colors.surface.paper}
        stroke={colors.text.secondary}
        strokeWidth={1.5}
      />
      {/* Spine crease in the middle */}
      <Line x1={64} y1={94} x2={64} y2={116} stroke={colors.text.secondary} strokeWidth={1} />
      {/* Two calligraphy strokes — left page and right page */}
      <Path d="M44 102 Q48 100 52 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M46 110 H54" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
      <Path d="M72 102 Q76 100 80 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M74 110 H82" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
    </G>
  );
}

function showCheeks(pose: HoyaPose): boolean {
  return pose === 'idle' || pose === 'cheering' || pose === 'waving';
}

export function Hoya({
  pose = 'idle',
  size = 96,
  testID,
  accessibilityLabel,
}: HoyaProps): React.ReactElement {
  const eye = eyeFor(pose);
  const cheeks = showCheeks(pose);

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
      {/* Soft radial shadow under feet (simple opacity ellipse — gradient skipped to avoid id collisions) */}
      <Ellipse cx={64} cy={116} rx={38} ry={5} fill={colors.hoya.furDark} opacity={0.18} />

      {/* Arms (cheering / waving / reading paws) */}
      <ArmsFor pose={pose} />

      {/* Head */}
      <Circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />

      {/* Ears (rounded, slightly larger inner pink) */}
      <Circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
      <Circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
      <Circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
      <Circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />

      {/* Stripes (3 per side + forehead) */}
      <Stripes />

      {/* Belly oval (cream) */}
      <Ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />

      {/* Eyes */}
      <Ellipse cx={eye.leftCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <Ellipse cx={eye.rightCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />

      {/* Tiny eye glints — only when eyes are open (not cheering squint) */}
      {pose !== 'cheering' ? (
        <G fill={colors.surface.paper}>
          <Circle cx={eye.leftCx + 1.2} cy={eye.y - 1.3} r={0.9} />
          <Circle cx={eye.rightCx + 1.2} cy={eye.y - 1.3} r={0.9} />
        </G>
      ) : null}

      {/* Cheek blush — pose-conditional */}
      {cheeks ? (
        <G>
          <Circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
          <Circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
        </G>
      ) : null}

      {/* Nose */}
      <Path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />

      {/* Mouth */}
      <MouthFor pose={pose} />

      {/* Pose-specific accents */}
      {pose === 'thinking' ? <ThoughtCloud /> : null}
      {pose === 'cheering' ? <CheerSparkles /> : null}
      {pose === 'reading' ? <Book /> : null}
      </Svg>
    </Animated.View>
  );
}
