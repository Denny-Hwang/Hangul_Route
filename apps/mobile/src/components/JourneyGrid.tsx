import type { Episode, QuestProgress, StageDef, StageKey, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Icon,
  NextMarker,
  Pill,
  ROUTE_RING_SIZE,
  RouteLegend,
  RouteRing,
  StickerIcon,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  typography,
  useMediaSize,
} from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocale, useMessages } from '../i18n/use-messages';
import { localizeEpisode } from '../logic/content-locale';
import { stagePillLabel, stagePillState, themeGlyph } from '../logic/journey';
import { countMarkSlot, journeyCellLayout, journeyCellMetrics } from '../logic/journey-cell-layout';
import { cellLabel, cellTestId, countMarkOf } from '../logic/journey-cells';
import {
  journeyGridRows,
  journeyLegend,
  labelMarksOf,
  withAccessWords,
  type JourneyAccessInput,
  type JourneyCellView,
  type JourneyMarksOf,
} from '../logic/journey-grid';
import { journeyGridMaxWidth } from '../logic/layout/pane-sizes';
import type { StoryIndexEntry } from '../logic/story/story-index';

/**
 * The Journey grid: theme column labels, then per stage its header row (number ring, title, one-liner,
 * availability pill), its five cells and the taste note. Wireframes `design/wireframes/journey/grid.md`
 * (the learner Journey), `design/wireframes/journey/grid-with-stories.md` A (heritage stories on the
 * map, F-STORY-005 PR 5.5a) and `design/wireframes/browse/home.md` B (All lessons, F-BROWSE-001 BR-5b).
 * The route marks (F-ENT-003 E3-5; `design/wireframes/journey/grid-plan-and-access.md`,
 * `design/components/RouteMarkers/spec.md`): the legend line above the column labels, the Next triangle,
 * the In your plan solid ring and the Not open yet dotted ring, and no lock glyph on any cell.
 * The theme glyphs (`design/components/Icon/theme-glyphs.md`): each lesson cell draws its theme's glyph with
 * the theme word under it (owner request 2026-10-14, "Cell word"), and each column label shows the glyph over
 * the same word; the glyphs and the cell word are decorative (the cell label names the theme). Where each part
 * sits in a cell is `logic/journey-cell-layout.ts`.
 * It reads no learner store and no navigation: what a learner has done arrives through `marksOf`,
 * `quests` and `access` (none: nothing done, no mark), a tap goes to `onOpen`, and a stories-only
 * cell to `onOpenStories`.
 */

/** The stories-note glyph under a stage row. */
const MARK_SIZE = spacing.lg;
/** The column header's theme glyph. A coming-later cell is empty (E3-D D5). */
const CELL_GLYPH = spacing.lg + spacing.xs;
const STAGE_RING = 32;
/** The cell's corner band, glyph, ring, edge and word line from the tokens (logic/journey-cell-layout.ts). */
const CELL = journeyCellMetrics({ spacing, borderWidth, typography });
/** A cell's border (`border.focus` at `borderWidth.thick` when selected in two panes). */
const CELL_EDGE = CELL.edge;

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
  /** The story index (F-STORY-005 §3.6): count marks and stories-only cells; omitted: no cell has stories. */
  storyEntries?: readonly StoryIndexEntry[];
  /** The learner's quest progress, for the cell labels (complete, finished stories); omitted: nothing done. */
  quests?: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[];
  /** A stories-only cell's tap (`CellStories`); omitted: such a cell is drawn but not a button. */
  onOpenStories?: (stage: StageKey, theme: ThemeKey) => void;
  /** One learner's route marks (F-ENT-003 E3-5): Next, In your plan, Not open yet; omitted: no mark, no legend. */
  access?: JourneyAccessInput;
  /** The learner's complete stages (`completeStages`): their pill reads Complete (F-QUEST-002 §3.8); omitted: none. */
  completeStages?: ReadonlySet<StageKey>;
  /**
   * Opens the Stage 1 ceremony again from a complete Stage 1's header (F-QUEST-002 §3.8: never shown
   * automatically a second time, always reachable here). The screen passes it only when the learner
   * holds the prize cards (`ownsStagePrize`); omitted: no button.
   */
  onOpenStagePrize?: () => void;
  /** Opens the Hangul Check from a complete Stage 1's header (F-QUEST-002 §3.9); omitted: no button. */
  onOpenHangulCheck?: () => void;
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
  storyEntries,
  quests,
  onOpenStories,
  access,
  completeStages,
  onOpenStagePrize,
  onOpenHangulCheck,
}: JourneyGridProps): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const m = messages.learner.journey;
  const gridMax = journeyGridMaxWidth(spacing.xs, layout.columns.journeyCellMax);
  const rows = journeyGridRows({ stages, themes, gridEpisodes, paneMode, selectedId, marksOf, storyEntries, quests, access });
  const themeOf = new Map(themes.map((t) => [t.key, t]));
  // Each mark's word, so the words are on the page (section 3.14); the cell labels carry them for screen readers.
  const words = { next: messages.learner.routeNext.tag.next, inPlan: messages.learner.routeNext.tag.inPlan, notOpen: messages.learner.access.notOpen };
  const legend = journeyLegend(rows).map((kind) => ({ kind, label: words[kind] }));
  const episodeTitleOf = (id: string | null): string => {
    const episode = id === null ? undefined : gridEpisodes.find((e) => e.id === id);
    return episode ? localizeEpisode(episode, locale).titleEn : '';
  };

  return (
    <>
      {/* The legend line (E3-D D4): under the intro, above the column labels; nothing when no mark is drawn. */}
      <RouteLegend items={legend} testID="journey-legend" />

      {/* Same row geometry as the cells below, so each label sits over its column. */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, width: '100%', maxWidth: gridMax }}>
        {themes.map((t) => (
          <View key={t.key} testID={`journey-col-${t.key}`} style={{ flex: 1, alignItems: 'center', gap: spacing.xxs }}>
            {/* The same glyph the column's cells draw, so the mapping is plain; the word under it is what is read. */}
            <View
              testID={`journey-col-glyph-${t.key}`}
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Icon name={themeGlyph(t.key)} size={CELL_GLYPH} color={colors.text.muted} testID={`theme-glyph-${themeGlyph(t.key)}`} />
            </View>
            <Caption tone="muted" align="center">
              {m.themeWord[t.key]}
            </Caption>
          </View>
        ))}
      </View>

      {rows.map((row) => {
        const stage = stages.find((s) => s.key === row.stage) as StageDef;
        const isLocked = row.availability === 'soon';
        const pill = stagePillState(row.availability, completeStages?.has(row.stage) ?? false);
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
              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                <Pill
                  tone={pill === 'open' || pill === 'complete' ? 'success' : pill === 'taste' ? 'primary' : 'neutral'}
                  label={stagePillLabel(pill, m.availability)}
                  size="sm"
                  testID={`journey-stage-pill-${row.stage}`}
                />
                {/* The Stage 1 ceremony, reachable again beside a complete Stage 1's pill (F-QUEST-002 §3.8). */}
                {row.stage === 'stage1' && pill === 'complete' && onOpenStagePrize ? (
                  <Button label={m.stagePrize.cta} tone="ghost" size="sm" onPress={onOpenStagePrize} testID="journey-stage-prize" />
                ) : null}
                {/* The Hangul Check, beside a complete Stage 1's pill: never required (F-QUEST-002 §3.9). */}
                {row.stage === 'stage1' && pill === 'complete' && onOpenHangulCheck ? (
                  <Button label={m.hangulCheck.cta} tone="ghost" size="sm" onPress={onOpenHangulCheck} testID="journey-hangul-check" />
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs, width: '100%', maxWidth: gridMax }}>
              {row.cells.map((cell) => (
                <GridCell
                  key={cell.key}
                  cell={cell}
                  stage={stage}
                  theme={themeOf.get(cell.theme) as ThemeDef}
                  paneMode={paneMode}
                  onOpen={onOpen}
                  onOpenStories={onOpenStories}
                  // A closed cell's label names its episode in the UI locale (a11y.access.notOpen).
                  episodeTitle={cell.access.notOpen ? episodeTitleOf(cell.episodeId) : ''}
                />
              ))}
            </View>

            {row.tasteNote ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <Caption tone="muted">{m.tasteNote}</Caption>
              </View>
            ) : null}
            {row.cells.some((c) => c.model.kind === 'stories-only') ? (
              <View
                testID={`journey-stories-note-${row.stage}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}
              >
                <Icon name="library" size={MARK_SIZE} color={colors.text.muted} />
                <View style={{ flex: 1 }}>
                  <Caption tone="muted">{m.storiesNote}</Caption>
                </View>
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
  /** The stage and theme in the UI locale, for the label. */
  stage: StageDef;
  theme: ThemeDef;
  paneMode: boolean;
  onOpen: (episodeId: string) => void;
  onOpenStories?: (stage: StageKey, theme: ThemeKey) => void;
  /** The episode title in the UI locale, for a closed cell's label; empty otherwise. */
  episodeTitle: string;
}

function GridCell({ cell, stage, theme, paneMode, onOpen, onOpenStories, episodeTitle }: GridCellProps): React.ReactElement {
  const messages = useMessages();
  const { completed, placedOut, isStart } = cell.marks;
  const { next, inPlan, notOpen } = cell.access;
  const ring = inPlan ? 'inPlan' : notOpen ? 'notOpen' : null;
  const { model } = cell;
  const storiesOnly = model.kind === 'stories-only';
  const isLater = cell.state === 'later' && !storiesOnly;
  const tone = colors.stage[cell.stage];
  const episodeId = cell.episodeId;
  const disabled = cell.disabled || (storiesOnly && !onOpenStories);
  const count = countMarkOf(model.storyCount);
  const glyphSize = useMediaSize(CELL.glyph);
  const cellLayout = journeyCellLayout(CELL, glyphSize, useMediaSize(ROUTE_RING_SIZE), { placedOut, isStart });
  const countSlot = countMarkSlot(CELL, { placedOut, isStart });

  const press = (): void => {
    if (disabled) return;
    if (storiesOnly) onOpenStories?.(cell.stage, cell.theme);
    else if (episodeId !== null) onOpen(episodeId);
  };

  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      aria-selected={paneMode && !storiesOnly ? cell.selected : undefined}
      accessibilityLabel={withAccessWords(
        cellLabel(model, stage, theme, messages.a11y.journeyCell, labelMarksOf(cell)),
        cell.access,
        episodeTitle,
        messages.a11y.access,
      )}
      testID={cellTestId(model.kind, cell.stage, cell.theme, cell.marks)}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.md,
        backgroundColor: isLater ? colors.surface.sunken : completed ? colors.feedback.successLight : colors.surface.paper,
        borderStyle: placedOut && !cell.selected ? 'dashed' : 'solid',
        borderWidth: cell.selected ? borderWidth.thick : CELL_EDGE,
        borderColor: cell.selected
          ? colors.border.focus
          : isLater || storiesOnly
            ? colors.border.subtle
            : completed
              ? colors.feedback.success
              : tone,
        // The corner band on top, the glyph box (the ring's size) under it, then one line of the theme word
        // (logic/journey-cell-layout.ts): square where that fits, taller than wide at 320 px.
        minHeight: cellLayout.minHeight,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: cellLayout.padTop,
        paddingBottom: cellLayout.padBottom,
        paddingHorizontal: spacing.none,
      }}
    >
      {isLater && ring === null ? null : (
        // A coming-later cell stays sunken and empty (E3-D D5, OD-6): no lock glyph on a learner screen.
        <View style={{ width: cellLayout.glyphBox, height: cellLayout.glyphBox, alignItems: 'center', justifyContent: 'center' }}>
          {storiesOnly ? (
            <Icon name="library" size={glyphSize} color={colors.text.secondary} />
          ) : isLater ? null : (
            // The theme glyph is decorative: the cell's label names the theme in words.
            <View
              testID={`journey-glyph-${cell.stage}-${cell.theme}`}
              aria-hidden
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Icon name={themeGlyph(theme.key)} size={glyphSize} color={colors.text.primary} testID={`theme-glyph-${themeGlyph(theme.key)}`} />
            </View>
          )}
          {ring !== null ? (
            // Around the theme glyph: the solid ring (In your plan) or the dotted ring (Not open yet). Never both.
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
              <RouteRing kind={ring} testID={`journey-ring-${ring}-${cell.stage}-${cell.theme}`} />
            </View>
          ) : null}
        </View>
      )}
      {isLater ? null : (
        // The theme word under the glyph (owner request 2026-10-14), one line at the caption size. Decorative:
        // the cell's label already names the theme, so a screen reader never reads it twice.
        <View
          testID={`journey-word-${cell.stage}-${cell.theme}`}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{ alignSelf: 'stretch' }}
        >
          <Text
            // One line on every platform: a native font that draws wider than the web measurement clips, never wraps
            // into the border (the length budget and the e2e keep every word inside the line).
            numberOfLines={1}
            ellipsizeMode="clip"
            maxFontSizeMultiplier={1}
            style={{
              fontSize: typography.size.caption,
              lineHeight: CELL.wordLine,
              fontWeight: typography.weight.regular,
              letterSpacing: typography.tracking.tight,
              color: colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {messages.learner.journey.themeWord[cell.theme]}
          </Text>
        </View>
      )}
      {/* Corner glyphs sit over a ring as paper stickers (E3-D D3). */}
      {isStart ? (
        <View pointerEvents="none" testID="journey-start-pin" style={{ position: 'absolute', top: CELL.inset, left: CELL.inset }}>
          {ring !== null ? (
            <StickerIcon name="pin" size={CELL.markSize} color={colors.brand.primary} />
          ) : (
            <Icon name="pin" size={CELL.markSize} color={colors.brand.primary} />
          )}
        </View>
      ) : null}
      {placedOut ? (
        <View pointerEvents="none" testID="journey-placed-out-check" style={{ position: 'absolute', top: CELL.inset, right: CELL.inset }}>
          {ring !== null ? (
            <StickerIcon name="check-circle" size={CELL.markSize} color={tone} />
          ) : (
            <Icon name="check-circle" size={CELL.markSize} color={tone} />
          )}
        </View>
      ) : null}
      {count !== null ? (
        // Not a target and not read on its own: the number is in the cell's label (F-STORY-005 §3.6).
        // Top right; top left when the placed-out check owns that corner; under the check when the pin owns the
        // other (logic/journey-cell-layout.ts). Never at the bottom: the theme word is there.
        <View
          pointerEvents="none"
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          testID={`journey-count-${cell.stage}-${cell.theme}`}
          style={{
            position: 'absolute',
            ...countSlot,
            minWidth: CELL.countMark,
            minHeight: CELL.countMark,
            paddingHorizontal: spacing.xxs,
            borderRadius: radii.pill,
            backgroundColor: colors.surface.sunken,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.subtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Decorative (the number is in the label), so it keeps its size at large text and stays in its circle. */}
          <Text maxFontSizeMultiplier={1} style={{ fontSize: typography.size.caption, fontWeight: '700', color: colors.text.primary }}>
            {messages.learner.journey.countMark(count.value, count.more)}
          </Text>
        </View>
      ) : null}
      {/* The Next triangle over the top edge, the top layer (E3-D D1: the pip rows' cursor, not the pin).
          Its tip is placed from the cell's outer edge, so the cell's own border comes off the offset. */}
      {next ? <NextMarker edge={cell.selected ? borderWidth.thick : CELL_EDGE} testID={`journey-next-${cell.stage}-${cell.theme}`} /> : null}
    </Pressable>
  );
}
