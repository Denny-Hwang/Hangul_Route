import React from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { colors } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { PipParts } from '../PipRow/Pip';
import { ROUTE_RING_SIZE, ROUTE_RING_STROKE, routeRingParts, type RouteRingKind } from './geometry';

export interface RouteRingProps {
  kind: RouteRingKind;
  testID?: string;
}

/**
 * The In your plan solid ring or the Not open yet dotted ring around a Journey cell's art
 * (F-ENT-003 section 3.7): 40 / 3 on compact, 48 / 4 regular, 56 / 4 wide. `border.shape` on
 * paper. Decorative: the cell label carries the words.
 */
export function RouteRing({ kind, testID }: RouteRingProps): React.ReactElement {
  const size = useMediaSize(ROUTE_RING_SIZE);
  const stroke = useMediaSize(ROUTE_RING_STROKE);
  return <RouteRingSvg kind={kind} size={size} stroke={stroke} testID={testID} />;
}

/** The ring for a resolved size and stroke, without hooks. */
export function RouteRingSvg({ kind, size, stroke, testID }: RouteRingProps & { size: number; stroke: number }): React.ReactElement {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <PipParts parts={routeRingParts(kind, size, stroke)} accent={colors.border.shape} />
      </Svg>
    </View>
  );
}
