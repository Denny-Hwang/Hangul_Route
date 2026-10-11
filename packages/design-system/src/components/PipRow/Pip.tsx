import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { PIP_SIZE, pipInk, pipParts, type PipPart } from './geometry';
import type { PipProps } from './types';

/** Draws geometry parts (`geometry.ts`) as svg; shared by `Pip` and `PipRow`. */
export function PipParts({ parts, accent, offsetY = 0 }: { parts: readonly PipPart[]; accent: string; offsetY?: number }): React.ReactElement {
  return (
    <G transform={`translate(0 ${offsetY})`}>
      {parts.map((part, index) => {
        const stroke = part.stroke === undefined ? undefined : pipInk(part.stroke, accent);
        return part.kind === 'circle' ? (
          <Circle
            key={index}
            cx={part.cx}
            cy={part.cy}
            r={part.r}
            fill={pipInk(part.fill, accent)}
            stroke={stroke}
            strokeWidth={part.strokeWidth}
            strokeDasharray={part.dash === undefined ? undefined : [...part.dash]}
          />
        ) : (
          <Path key={index} d={part.d} fill={pipInk(part.fill, accent)} stroke={stroke} strokeWidth={part.strokeWidth} strokeLinejoin="round" />
        );
      })}
    </G>
  );
}

/**
 * One pip on its own, for the "What the shapes mean" legend (F-ROUTE-001
 * section 3.4): the caller puts the word next to it. Decorative, hidden from
 * screen readers on native and on web (`aria-hidden` on a wrapping View,
 * which react-native-web maps to the DOM; the svg itself may not pass it on).
 */
export function Pip({ state, context = 'stage', accent = colors.border.shape, testID }: PipProps): React.ReactElement {
  const size = useMediaSize(PIP_SIZE[context]);
  return <PipSvg state={state} size={size} accent={accent} testID={testID} />;
}

/** The legend pip for a resolved size, without hooks (tested by calling it). */
export function PipSvg({ state, size, accent, testID }: Pick<PipProps, 'state' | 'testID'> & { size: number; accent: string }): React.ReactElement {
  return (
    <View testID={testID} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <PipParts parts={pipParts(state, size)} accent={accent} />
      </Svg>
    </View>
  );
}
