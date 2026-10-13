import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';
import { colors, spacing } from '../../tokens';
import { useMediaSize } from '../Layout/LayoutProvider';
import { PIP_SIZE, cursorMarkerParts, markerBand, pipParts, pipRowBands, pipRowCells, pipRowLines, startBand, startMarkerParts } from './geometry';
import { PipParts } from './Pip';
import type { PipCell } from './geometry';
import type { PipRowProps } from './types';

/** Unscaled gaps: `spacing.xs` between pips and lines, `spacing.md` between groups. */
const GAPS = { pip: spacing.xs, group: spacing.md } as const;

export interface PipRowGaps {
  pip: number;
  group: number;
}

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
export function PipRow({ groups, context = 'stage', accent = colors.border.shape, bandsPerLine = false, testID }: PipRowProps): React.ReactElement {
  const size = useMediaSize(PIP_SIZE[context]);
  // The gaps scale with the pips, so the group gap still reads as a gap on wide windows (wireframe C5).
  const gaps = { pip: useMediaSize(GAPS.pip), group: useMediaSize(GAPS.group) };
  if (bandsPerLine) return <PipRowFitted groups={groups} size={size} accent={accent} gaps={gaps} testID={testID} />;
  return <PipRowBody groups={groups} size={size} accent={accent} gaps={gaps} testID={testID} />;
}

type BodyProps = Pick<PipRowProps, 'groups' | 'testID'> & { size: number; accent: string; gaps?: PipRowGaps };

/**
 * The row that measures its width and reserves the marker bands per line
 * (`bandsPerLine`, LR-11). Until the first layout it draws the one wrapping row.
 */
export function PipRowFitted(props: BodyProps): React.ReactElement {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const onLayout = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout.width;
    setWidth((prev) => (prev === next ? prev : next));
  };
  return (
    <View onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
      <PipRowBody {...props} width={width} />
    </View>
  );
}

/** One pip with the bands of its line (or of the whole row); a plain call, so the body stays one element tree. */
function pipCell(cell: PipCell, size: number, accent: string, bands: { top: boolean; bottom: boolean }, trailing: number): React.ReactElement {
  const top = bands.top ? markerBand(size) : 0;
  const height = top + size + (bands.bottom ? startBand(size) : 0);
  return (
    <View key={cell.key} style={{ marginRight: trailing }}>
      <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {cell.isCursor ? <PipParts parts={cursorMarkerParts(size)} accent={accent} /> : null}
        <PipParts parts={pipParts(cell.state, size)} accent={accent} offsetY={top} />
        {cell.isStart ? <PipParts parts={startMarkerParts(size)} accent={accent} offsetY={top + size} /> : null}
      </Svg>
    </View>
  );
}

/**
 * The row for a resolved pip size, without hooks (tested by calling it). With
 * a measured `width`, each line is its own row and reserves only the marker
 * bands its pips use (`pipRowLines`); without one, the row wraps by itself and
 * every line reserves the bands any pip uses.
 */
export function PipRowBody({ groups, size, accent, gaps = GAPS, testID, width }: BodyProps & { width?: number }): React.ReactElement {
  const cells = pipRowCells(groups, gaps);
  const trailing = (cell: PipCell): number => Math.max(0, cell.trailingGap - gaps.pip);
  if (width !== undefined) {
    return (
      <View
        testID={testID}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        aria-hidden
        style={{ flexDirection: 'column', alignItems: 'flex-start', rowGap: gaps.pip }}
      >
        {pipRowLines(cells, width, size, gaps.pip).map((line) => (
          <View key={line.cells[0]?.key} style={{ flexDirection: 'row', alignItems: 'flex-start', columnGap: gaps.pip }}>
            {line.cells.map((cell) => pipCell(cell, size, accent, line.bands, trailing(cell)))}
          </View>
        ))}
      </View>
    );
  }
  const bands = pipRowBands(groups);
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: gaps.pip, rowGap: gaps.pip }}
    >
      {cells.map((cell) => pipCell(cell, size, accent, bands, trailing(cell)))}
    </View>
  );
}
