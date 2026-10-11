import React from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { colors, spacing } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { PIP_SIZE, cursorMarkerParts, markerBand, pipParts, pipRowBands, pipRowCells, startBand, startMarkerParts } from './geometry';
import { PipParts } from './Pip';
import type { PipRowProps } from './types';

const GAPS = { pip: spacing.xs, group: spacing.md } as const;

/**
 * PipRow (F-ROUTE-001 R-2b; design/components/PipRow/spec.md): one drawn
 * shape per quest, in route order, as a collection, never a bar. No track
 * behind the pips and no fixed count of empty slots; the row shows what
 * exists and wraps onto more lines when it runs out of width. Groups (the
 * earned pips, then the new quests that joined a Complete stage) are split by
 * a wider gap. The cursor marker is drawn above its pip and the start pin
 * below it; their bands are reserved only when a pip uses them.
 *
 * Decorative: the stage row's accessibility label carries the facts, so the
 * whole row is hidden from screen readers (section 3.14), on native through
 * the two native props and on web through `aria-hidden` (react-native-web
 * maps only that one to the DOM).
 */
export function PipRow({ groups, context = 'stage', accent = colors.border.shape, testID }: PipRowProps): React.ReactElement {
  const size = useMediaSize(PIP_SIZE[context]);
  return <PipRowBody groups={groups} size={size} accent={accent} testID={testID} />;
}

/** The row for a resolved pip size, without hooks (tested by calling it). */
export function PipRowBody({
  groups,
  size,
  accent,
  testID,
}: Pick<PipRowProps, 'groups' | 'testID'> & { size: number; accent: string }): React.ReactElement {
  const bands = pipRowBands(groups);
  const top = bands.top ? markerBand(size) : 0;
  const height = top + size + (bands.bottom ? startBand(size) : 0);
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: GAPS.pip, rowGap: spacing.xs }}
    >
      {pipRowCells(groups, GAPS).map((cell) => (
        <View key={cell.key} style={{ marginRight: Math.max(0, cell.trailingGap - GAPS.pip) }}>
          <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
            {cell.isCursor ? <PipParts parts={cursorMarkerParts(size)} accent={accent} /> : null}
            <PipParts parts={pipParts(cell.state, size)} accent={accent} offsetY={top} />
            {cell.isStart ? <PipParts parts={startMarkerParts(size)} accent={accent} offsetY={top + size} /> : null}
          </Svg>
        </View>
      ))}
    </View>
  );
}
