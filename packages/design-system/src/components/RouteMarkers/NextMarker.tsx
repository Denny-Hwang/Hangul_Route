import React from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { colors } from '../../tokens';
import { markerBand } from '../PipRow/geometry';
import { PipParts } from '../PipRow/Pip';
import { NEXT_MARKER_BASE, NEXT_TIP_INSET, nextMarkerParts, nextMarkerTop } from './geometry';

export interface NextMarkerProps {
  /** Where the tip lands from the parent's top edge: `NEXT_TIP_INSET` inside a cell (default), negative above it. */
  tipInset?: number;
  /** The marked box's border width, measured off so the tip is placed from its outer edge; 0 for a borderless box. */
  edge?: number;
  testID?: string;
}

/**
 * The Next mark (F-ENT-003 section 3.7, E3-D D1): the pip row's cursor triangle in `text.primary`,
 * centred over the top edge of the box it marks and pointing down at it. Not the `pin`, which
 * means "You started here" on the same grid. Absolutely placed, so it adds no size and no target;
 * decorative, because the label carries the word.
 */
export function NextMarker({ tipInset = NEXT_TIP_INSET, edge = 0, testID }: NextMarkerProps): React.ReactElement {
  const band = markerBand(NEXT_MARKER_BASE);
  return (
    <View
      testID={testID}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{
        position: 'absolute',
        top: nextMarkerTop(tipInset, edge),
        left: '50%',
        marginLeft: -NEXT_MARKER_BASE / 2,
        width: NEXT_MARKER_BASE,
        height: band,
      }}
    >
      <Svg width={NEXT_MARKER_BASE} height={band} viewBox={`0 0 ${NEXT_MARKER_BASE} ${band}`}>
        <PipParts parts={nextMarkerParts()} accent={colors.text.primary} />
      </Svg>
    </View>
  );
}
