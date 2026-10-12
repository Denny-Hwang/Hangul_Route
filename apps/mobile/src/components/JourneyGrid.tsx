import type { Episode, StageDef, StageKey, ThemeDef } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Icon,
  Pill,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { stagePillLabel, themeCellInitial, themeColumnLabel } from '../logic/journey';
import { journeyGridRows, type JourneyCellView, type JourneyMarksOf } from '../logic/journey-grid';
import { journeyGridMaxWidth } from '../logic/layout/pane-sizes';

/**
 * The Journey grid: theme column labels, then per stage its header row (number ring, title, one-liner,
 * availability pill), its five cells and the taste note. Wireframes `design/wireframes/journey/grid.md`
 * (the learner Journey) and `design/wireframes/browse/home.md` B (All lessons, F-BROWSE-001 BR-5b).
 * It reads no learner store and no navigation: what a learner has done arrives through `marksOf`
 * (none: nothing done), and a tap goes to `onOpen`.
 */

/** The start pin and the placed-out check sit in the cell's corners. */
const MARK_SIZE = spacing.lg;
const STAGE_RING = 32;

export interface JourneyGridProps {
  /** Stage definitions in the UI locale. */
  stages: readonly StageDef[];
  /** Theme definitions in the UI locale. */
  themes: readonly ThemeDef[];
  /** Grid episodes only (`gridEpisodes`). */
  gridEpisodes: readonly Episode[];
  /** Two panes (F-LAYOUT-001 §3.7): a tap selects, the selected cell shows it. */
  paneMode: boolean;
  selectedId: string | null;
  onOpen: (episodeId: string) => void;
  /** One learner's marks (completed, placed out, start); omitted: nothing done. */
  marksOf?: JourneyMarksOf;
  /** Where each stage row sits in the grid, for scrolling to a stage (All lessons); omitted: not measured. */
  onStageLayout?: (stage: StageKey, y: number) => void;
}

export function JourneyGrid({
  stages,
  themes,
  gridEpisodes,
  paneMode,
  selectedId,
  onOpen,
  marksOf,
  onStageLayout,
}: JourneyGridProps): React.ReactElement {
  const m = useMessages().learner.journey;
  const gridMax = journeyGridMaxWidth(spacing.xs, layout.columns.journeyCellMax);
  const rows = journeyGridRows({ stages, themes, gridEpisodes, paneMode, selectedId, marksOf });
  const themeOf = new Map(themes.map((t) => [t.key, t]));

  return (
    <>
      {/* Same row geometry as the cells below, so each label sits over its column. */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, width: '100%', maxWidth: gridMax }}>
        {themes.map((t) => (
          <View key={t.key} style={{ flex: 1, alignItems: 'center' }}>
            <Caption tone="muted" align="center">
              {themeColumnLabel(t)}
            </Caption>
          </View>
        ))}
      </View>

      {rows.map((row) => {
        const stage = stages.find((s) => s.key === row.stage) as StageDef;
        const isLocked = row.availability === 'soon';
        return (
          <View
            key={row.stage}
            testID={`journey-stage-${row.stage}`}
            onLayout={onStageLayout ? (e) => onStageLayout(row.stage, e.nativeEvent.layout.y) : undefined}
            style={{ marginBottom: spacing.lg }}
          >
            {/*
              The stage header is a plain row, never a button: no lock, no door to the unlock page on a
              learner screen (F-ROUTE-001 R-J, OD-8; section 3.3). A screen reader reads the title, the
              one-liner and the same availability word the pill shows. Plans live in the grown-up area.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View
                style={{
                  width: STAGE_RING,
                  height: STAGE_RING,
                  borderRadius: radii.circle,
                  // The stage colour is the ring; the number stays text.primary / text.muted on a light fill.
                  backgroundColor: isLocked ? colors.surface.sunken : colors.surface.paper,
                  borderWidth: borderWidth.thick,
                  borderColor: isLocked ? colors.border.subtle : colors.stage[row.stage],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: isLocked ? colors.text.muted : colors.text.primary, fontWeight: '700' }}>{stage.order}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Body weight="bold" tone={isLocked ? 'secondary' : 'primary'}>
                  {stage.titleEn}
                </Body>
                <Caption tone="muted">{stage.oneLinerEn}</Caption>
              </View>
              <Pill
                tone={row.availability === 'open' ? 'success' : row.availability === 'taste' ? 'primary' : 'neutral'}
                label={stagePillLabel(row.availability, m.availability)}
                size="sm"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs, width: '100%', maxWidth: gridMax }}>
              {row.cells.map((cell) => (
                <GridCell key={cell.key} cell={cell} theme={themeOf.get(cell.theme) as ThemeDef} paneMode={paneMode} onOpen={onOpen} />
              ))}
            </View>

            {row.availability === 'taste' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <Caption tone="muted">{m.tasteNote}</Caption>
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

interface GridCellProps {
  cell: JourneyCellView;
  theme: ThemeDef;
  paneMode: boolean;
  onOpen: (episodeId: string) => void;
}

function GridCell({ cell, theme, paneMode, onOpen }: GridCellProps): React.ReactElement {
  const a11y = useMessages().a11y;
  const { completed, placedOut, isStart } = cell.marks;
  const isLater = cell.state === 'later';
  const stage: StageKey = cell.stage;
  const tone = colors.stage[stage];
  const episodeId = cell.episodeId;

  return (
    <Pressable
      onPress={() => episodeId !== null && !cell.disabled && onOpen(episodeId)}
      disabled={cell.disabled}
      accessibilityRole="button"
      aria-selected={paneMode ? cell.selected : undefined}
      accessibilityLabel={
        isStart || placedOut ? a11y.gridCellMarked(theme.titleEn, stage, isStart, placedOut) : a11y.gridCell(theme.titleEn, stage, isLater)
      }
      testID={isStart ? 'journey-cell-start' : placedOut ? 'journey-cell-placed-out' : undefined}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.md,
        backgroundColor: isLater ? colors.surface.sunken : completed ? colors.feedback.successLight : colors.surface.paper,
        borderStyle: placedOut && !cell.selected ? 'dashed' : 'solid',
        borderWidth: cell.selected ? borderWidth.thick : 2,
        borderColor: cell.selected ? colors.border.focus : isLater ? colors.border.subtle : completed ? colors.feedback.success : tone,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xs,
      }}
    >
      {isLater ? (
        <Icon name="lock" size={20} color={colors.text.muted} />
      ) : (
        <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>{themeCellInitial(theme)}</Text>
      )}
      {isStart ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: spacing.xxs, left: spacing.xxs }}>
          <Icon name="pin" size={MARK_SIZE} color={colors.brand.primary} />
        </View>
      ) : null}
      {placedOut ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: spacing.xxs, right: spacing.xxs }}>
          <Icon name="check-circle" size={MARK_SIZE} color={tone} />
        </View>
      ) : null}
    </Pressable>
  );
}
