import React from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { spacing } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { PIP_SIZE, cursorMarkerParts, markerBand, stageSegmentParts, type StageSegmentState } from './geometry';
import { PipParts } from './Pip';

/** One stage on the overview. */
export interface StageSegmentView {
  /** Stable React key (the stage key). */
  key: string;
  state: StageSegmentState;
  /** The stage the learner is on: the cursor marker is drawn above it. */
  here: boolean;
  /** Fill of a complete segment: the stage colour token (decoration only). */
  accent: string;
}

export interface StageSegmentsProps {
  /** The seven stages, in route order. */
  segments: readonly StageSegmentView[];
  testID?: string;
}

/**
 * StageSegments (F-ROUTE-001 R-4b; design/components/PipRow/spec.md "Stage
 * segments"; wireframes `design/wireframes/journey/learning-route.md` H and
 * `design/wireframes/journey/my-route-overview.md` D): the whole journey in one
 * look, one drawn segment per stage at the stage pip size, the cursor marker
 * over the stage the learner is on. Decorative, like PipRow: the caller's label
 * carries the facts, so the row is hidden from screen readers on native and on
 * web (`aria-hidden`).
 */
export function StageSegments({ segments, testID }: StageSegmentsProps): React.ReactElement {
  const size = useMediaSize(PIP_SIZE.stage);
  const gap = useMediaSize(spacing.xs);
  return <StageSegmentsBody segments={segments} size={size} gap={gap} testID={testID} />;
}

/** The row for a resolved size, without hooks (tested by calling it). */
export function StageSegmentsBody({ segments, size, gap, testID }: StageSegmentsProps & { size: number; gap: number }): React.ReactElement {
  const band = markerBand(size);
  // Whole pixels, so a scaled band (0.45 x 30 = 13.5) never clips the bottom of the shapes.
  const height = Math.ceil(band + size);
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: gap, rowGap: gap }}
    >
      {segments.map((segment) => (
        <View key={segment.key}>
          <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
            {segment.here ? <PipParts parts={cursorMarkerParts(size)} accent={segment.accent} /> : null}
            <PipParts parts={stageSegmentParts(segment.state, size)} accent={segment.accent} offsetY={band} />
          </Svg>
        </View>
      ))}
    </View>
  );
}
