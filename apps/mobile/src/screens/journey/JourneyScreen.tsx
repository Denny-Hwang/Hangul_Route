import type { StageKey, ThemeDef } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  Icon,
  Pill,
  Hoya,
  Screen,
  Spacer,
  SplitPane,
  TAB_SCREEN_EDGES,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  typography,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { episodeById, episodeFor, episodesAll, gridEpisodes, stages, themes } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStage, localizeTheme } from '../../logic/content-locale';
import {
  isEpisodeComplete,
  stageAvailability,
  stagePillLabel,
  themeCellInitial,
  themeColumnLabel,
} from '../../logic/journey';
import { initialEpisode, latchedSelection, reconcileSelection, requestedSelection, type PaneLatch } from '../../logic/layout/pane-selection';
import { journeyGridMaxWidth } from '../../logic/layout/pane-sizes';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { EpisodeDetailView } from '../episode/EpisodeDetailView';

/** The grid's episodes: a shelf episode is never a grid cell or a pane selection (F-STORY-004 §3.10). */
const GRID_EPISODES = gridEpisodes(episodesAll);

export function JourneyScreen(): React.ReactElement {
  const m = useMessages().learner.journey;
  const locale = useLocale();
  const localThemes = useMemo(() => themes.map((t) => localizeTheme(t, locale)), [locale]);
  const localStages = useMemo(() => stages.map((s) => localizeStage(s, locale)), [locale]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  // Two panes (wide window, F-LAYOUT-001 §3.7): a tap selects, the right pane shows it. One pane: a tap navigates as always.
  const { panes } = useLayoutClass();
  const paneMode = panes === 2;
  const ownerId = profile?.id ?? null;
  // Back from a quest or from Results on two panes, the episode arrives as a route param: select it
  // (only when the grid has it), then clear the param so the same episode can be asked for
  // again later (F-LAYOUT-001 §3.7).
  const requested = useRoute<RouteProp<MainTabParamList, 'Journey'>>().params?.episodeId;
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Journey'>>();
  const [latch, setLatch] = useState<PaneLatch | null>(() => {
    const known = requestedSelection(requested, GRID_EPISODES);
    return known === null ? null : { ownerId, id: known };
  });
  const selected = latchedSelection(latch, ownerId);
  const setSelected = (id: string): void => setLatch({ ownerId, id });
  useEffect(() => {
    if (requested === undefined) return;
    const known = requestedSelection(requested, GRID_EPISODES);
    if (known !== null) setLatch({ ownerId, id: known });
    tabNavigation.setParams({ episodeId: undefined });
  }, [requested, tabNavigation, ownerId]);
  const selectedId = reconcileSelection(selected, GRID_EPISODES, initialEpisode(GRID_EPISODES, snap));
  // Latch the first selection (the episode of the next quest) so finishing a quest does not move it:
  // back from the quest player returns to the same selection. It survives rotation as screen state.
  // The latch belongs to the profile: switching learner starts from that learner's next quest.
  useEffect(() => {
    if (paneMode && selected === null && selectedId !== null) setLatch({ ownerId, id: selectedId });
  }, [paneMode, selected, selectedId, ownerId]);

  const gridMax = journeyGridMaxWidth(spacing.xs, layout.columns.journeyCellMax);

  const grid = (
    <>
      <Heading level="title">{m.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{m.intro}</Body>

      <Spacer size="lg" />
      {/* Same row geometry as the cells below, so each label sits over its column. */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, width: '100%', maxWidth: gridMax }}>
        {localThemes.map((t) => (
          <View key={t.key} style={{ flex: 1, alignItems: 'center' }}>
            <Caption tone="muted" align="center">
              {themeColumnLabel(t)}
            </Caption>
          </View>
        ))}
      </View>

      {localStages.map((stage) => {
        const availability = stageAvailability(stage.key, GRID_EPISODES);
        const isLocked = availability === 'soon';
        return (
          <View key={stage.key} style={{ marginBottom: spacing.lg }}>
            {/*
              The stage header is a plain row, never a button: no lock, no door to the unlock page on a
              learner screen (F-ROUTE-001 R-J, OD-8; section 3.3). A screen reader reads the title, the
              one-liner and the same availability word the pill shows. Plans live in the grown-up area.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radii.circle,
                  // The stage colour is the ring; the number stays text.primary / text.muted on a light fill.
                  backgroundColor: isLocked ? colors.surface.sunken : colors.surface.paper,
                  borderWidth: borderWidth.thick,
                  borderColor: isLocked ? colors.border.subtle : colors.stage[stage.key],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: isLocked ? colors.text.muted : colors.text.primary, fontWeight: '700' }}>
                  {stage.order}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Body weight="bold" tone={isLocked ? 'secondary' : 'primary'}>
                  {stage.titleEn}
                </Body>
                <Caption tone="muted">{stage.oneLinerEn}</Caption>
              </View>
              <Pill
                tone={availability === 'open' ? 'success' : availability === 'taste' ? 'primary' : 'neutral'}
                label={stagePillLabel(availability, m.availability)}
                size="sm"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs, width: '100%', maxWidth: gridMax }}>
              {localThemes.map((theme) => (
                <GridCell
                  key={`${stage.key}-${theme.key}`}
                  stage={stage.key}
                  theme={theme}
                  paneMode={paneMode}
                  selectedId={selectedId}
                  onOpen={(episodeId) => (paneMode ? setSelected(episodeId) : navigation.navigate('EpisodeDetail', { episodeId }))}
                  progressSnapshot={snap}
                />
              ))}
            </View>

            {availability === 'taste' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <Caption tone="muted">{m.tasteNote}</Caption>
              </View>
            ) : null}
          </View>
        );
      })}

      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.how.title}</Heading>
        <Spacer size="xs" />
        <Body tone="secondary" size="sm">
          {m.how.body}
        </Body>
      </Card>
      <Spacer size="xl" />
    </>
  );

  const selectedEpisode = selectedId ? episodeById(selectedId) : undefined;
  const detail = selectedEpisode ? (
    // A placeholder cell shows the same view: it already renders the coming-soon content (no lock, no paywall).
    <EpisodeDetailView
      key={selectedEpisode.id}
      episodeId={selectedEpisode.id}
      onStartQuest={(questId, episodeId) => navigation.navigate('QuestPlayer', { questId, episodeId })}
      onOpenCard={(cardId) => navigation.navigate('CardDetail', { cardId })}
    />
  ) : (
    <ComingSoonPane />
  );

  return (
    <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width="full" scrollable={!paneMode}>
      <SplitPane master={grid} detail={detail} masterLabel={m.panes.master} detailLabel={m.panes.detail} detailScrolls={false} />
    </Screen>
  );
}

/** Nothing selectable (no episode at all): the coming-soon words, so the pane is never blank. */
function ComingSoonPane(): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.episode.comingSoon;
  return (
    <Screen tone="canvas">
      <View style={{ alignItems: 'center' }}>
        <Hoya pose="reading" size={96} accessibilityLabel={messages.a11y.hoya('reading')} />
        <Spacer size="md" />
        <Body weight="semibold">{m.title}</Body>
        <Caption tone="muted" align="center">
          {m.note}
        </Caption>
      </View>
    </Screen>
  );
}

interface GridCellProps {
  stage: StageKey;
  theme: ThemeDef;
  /** Two panes: a preview cell can be selected too, and the selected cell shows it. */
  paneMode: boolean;
  selectedId: string | null;
  onOpen: (episodeId: string) => void;
  progressSnapshot?: {
    episodes: Array<{ episodeId: string; completedAt?: string }>;
    quests: Array<{ questId: string; episodeId: string; completedAt?: string }>;
  };
}

function GridCell({ stage, theme, paneMode, selectedId, onOpen, progressSnapshot }: GridCellProps): React.ReactElement {
  const a11y = useMessages().a11y;
  const episode = episodeFor(stage, theme.key);
  const isPreview = !episode || episode.status === 'preview';
  // Complete only when every quest of the episode is done (wireframe journey/grid).
  const completed = !!episode && isEpisodeComplete(episode, progressSnapshot?.quests ?? []);
  const tone = colors.stage[stage];
  const isSelected = paneMode && !!episode && episode.id === selectedId;
  // One pane: a preview cell does nothing, as today. Two panes: it is selectable (its page says "coming soon").
  const disabled = !episode || (isPreview && !paneMode);

  return (
    <Pressable
      onPress={() => episode && !disabled && onOpen(episode.id)}
      disabled={disabled}
      accessibilityRole="button"
      aria-selected={paneMode ? isSelected : undefined}
      accessibilityLabel={a11y.gridCell(theme.titleEn, stage, isPreview)}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radii.md,
        backgroundColor: isPreview ? colors.surface.sunken : completed ? colors.feedback.successLight : colors.surface.paper,
        borderWidth: isSelected ? borderWidth.thick : 2,
        borderColor: isSelected
          ? colors.border.focus
          : isPreview
            ? colors.border.subtle
            : completed
              ? colors.feedback.success
              : tone,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xs,
      }}
    >
      {isPreview ? (
        <Icon name="lock" size={20} color={colors.text.muted} />
      ) : (
        <Text style={{ fontSize: typography.size.title, fontWeight: '700', color: colors.text.primary }}>
          {themeCellInitial(theme)}
        </Text>
      )}
    </Pressable>
  );
}
