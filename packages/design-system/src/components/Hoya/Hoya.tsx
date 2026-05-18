import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../../tokens';
import type { HoyaPose, HoyaProps } from './types';

/**
 * Hoya — geometric SVG tiger character, v1 placeholder.
 * 5 poses. Real illustrator output will replace this in a later sprint.
 */

const eyeFor = (pose: HoyaPose): { y: number; rx: number; ry: number } => {
  switch (pose) {
    case 'cheering':
      return { y: 70, rx: 4, ry: 2 }; // squint joy
    case 'thinking':
      return { y: 70, rx: 3, ry: 5 }; // looking up
    case 'reading':
      return { y: 74, rx: 3, ry: 3 };
    default:
      return { y: 72, rx: 3.5, ry: 4 };
  }
};

const mouthFor = (pose: HoyaPose): React.ReactElement => {
  switch (pose) {
    case 'cheering':
      return (
        <Path
          d="M44 92 Q60 108 76 92"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          fill={colors.hoya.cheek}
        />
      );
    case 'thinking':
      return (
        <Path
          d="M52 96 Q60 92 68 96"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'reading':
      return (
        <Path d="M55 95 H65" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" />
      );
    case 'waving':
      return (
        <Path
          d="M48 92 Q60 102 72 92"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
    default:
      return (
        <Path
          d="M50 92 Q60 100 70 92"
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
  }
};

const armFor = (pose: HoyaPose): React.ReactElement | null => {
  if (pose === 'cheering') {
    return (
      <>
        <Path
          d="M22 80 L8 50"
          stroke={colors.hoya.fur}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Path
          d="M98 80 L112 50"
          stroke={colors.hoya.fur}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Circle cx={8} cy={50} r={6} fill={colors.hoya.fur} />
        <Circle cx={112} cy={50} r={6} fill={colors.hoya.fur} />
      </>
    );
  }
  if (pose === 'waving') {
    return (
      <>
        <Path
          d="M98 78 L120 56"
          stroke={colors.hoya.fur}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <Circle cx={120} cy={56} r={7} fill={colors.hoya.fur} />
      </>
    );
  }
  return null;
};

export function Hoya({
  pose = 'idle',
  size = 96,
  testID,
  accessibilityLabel,
}: HoyaProps): React.ReactElement {
  const eye = eyeFor(pose);

  return (
    <Svg
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? `Hoya the tiger, ${pose}`}
      width={size}
      height={size}
      viewBox="0 0 128 128"
    >
      {/* Body */}
      <Ellipse cx={64} cy={104} rx={42} ry={20} fill={colors.hoya.furDark} opacity={0.18} />
      {armFor(pose)}
      {/* Head */}
      <Circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />
      {/* Ears */}
      <Circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
      <Circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
      <Circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} />
      <Circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} />
      {/* Stripes */}
      <Path d="M28 56 Q32 60 28 64" stroke={colors.hoya.stripes} strokeWidth={3} fill="none" />
      <Path d="M100 56 Q96 60 100 64" stroke={colors.hoya.stripes} strokeWidth={3} fill="none" />
      <Path d="M64 24 Q66 30 64 36" stroke={colors.hoya.stripes} strokeWidth={3} fill="none" />
      {/* Belly */}
      <Ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />
      {/* Eyes */}
      <Ellipse cx={50} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <Ellipse cx={78} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      {/* Cheeks */}
      <Circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.7} />
      <Circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.7} />
      {/* Nose */}
      <Path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />
      {/* Mouth */}
      <G>{mouthFor(pose)}</G>
      {/* Thought sparkle for thinking */}
      {pose === 'thinking' ? (
        <G>
          <Circle cx={104} cy={20} r={3} fill={colors.brand.secondary} />
          <Circle cx={114} cy={12} r={4} fill={colors.brand.secondary} />
          <Rect x={108} y={2} width={14} height={10} rx={5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.5} />
        </G>
      ) : null}
      {/* Sparkle for cheering */}
      {pose === 'cheering' ? (
        <>
          <Path
            d="M14 18 L18 24 L24 22 L20 28 L24 34 L16 32 L14 38 L12 32 L4 34 L8 28 L4 22 L10 24 Z"
            fill={colors.feedback.nudge}
            opacity={0.85}
          />
          <Path
            d="M114 18 L118 24 L124 22 L120 28 L124 34 L116 32 L114 38 L112 32 L104 34 L108 28 L104 22 L110 24 Z"
            fill={colors.feedback.nudge}
            opacity={0.85}
          />
        </>
      ) : null}
    </Svg>
  );
}
