import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Screen,
  Spacer,
  SplitPane,
  TAB_SCREEN_EDGES,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { JourneyGrid, type JourneyMastery } from '../../components/JourneyGrid';
import { episodeById, episodesAll, gridEpisodes, questsAll, stages, themes, withVolumes } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStage, localizeTheme } from '../../logic/content-locale';
import { cursorEntitlement } from '../../logic/cursor-context';
import { dayKey } from '../../logic/homework/mission-builder';
import { learnerCellMarks, type JourneyAccessInput } from '../../logic/journey-grid';
import { completeStages } from '../../logic/my-route/latch';
import { HANGUL_PRIZE_STAGE, ownsStagePrize } from '../../logic/stage1/stage-complete';
import { StageHeaderSlot } from '../stage-check/stage-check-entry';
import { initialEpisode, latchedSelection, reconcileSelection, requestedSelection, type PaneLatch } from '../../logic/layout/pane-selection';
import { journeyMarks } from '../../logic/placement/cell-look';
import { appRouteCatalog } from '../../logic/placement/route-skip';
import { planView, routeNext, routeNextInputOf } from '../../logic/route-next';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { ROOT_HEADER } from '../../navigation/screen-header-variants';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useMastery } from '../../store/mastery-entry';
import { useCurrFlag } from '../../store/remote-config-store';
import { StageJumpSlot } from '../cell-check/cell-check-entry';
import { DecodingSprintOffer } from '../minigames/syllable-build-entry';
import { useToday } from '../route/use-today';
import { useProgressStore } from '../../store/progress-store';
import { usePlanStore } from '../../store/plan-store';
import { useAccessTier, useQuestAccess } from '../../store/tier-store';
import { episodeAccessExits } from '../episode/access-exits';
import { EpisodeDetailView } from '../episode/EpisodeDetailView';
import { bundleOs, flags, gatingActive } from '../../config/flags';

/** The grid's episodes: a shelf episode is never a grid cell or a pane selection (F-STORY-004 §3.10). */
const GRID_EPISODES = gridEpisodes(episodesAll);
/** The app's quests in the cursor's order, as the level check's route catalogue (F-PLC-001 section 3.7). */
const ROUTE_CATALOG = appRouteCatalog(questsAll, episodesAll);
const NO_IDS: ReadonlySet<string> = new Set();
/** The bundle's story index (F-STORY-005 §3.6): the map's count marks and stories-only cells. Empty while no story is reviewed. */
const STORY_ENTRIES = defaultStoryIndex();
/** Any heritage story on the map: the explainer then says what the marks mean. */
const MAP_HAS_STORIES = STORY_ENTRIES.some((e) => e.placement === 'shelf');

export function JourneyScreen(): ReactElement {
  const messages = useMessages();
  const m = messages.learner.journey;
  const locale = useLocale();
  const localThemes = useMemo(() => themes.map((t) => localizeTheme(t, locale)), [locale]);
  const localStages = useMemo(() => stages.map((s) => localizeStage(s, locale)), [locale]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // A cell's Volume 2 (F-CURR-002 row CM-40): its dots, its open rule and its page only while `volumes` is on; off, every
  // Volume 2 entry point hides and the grid is the route's. Progress, cards and memory states stay either way.
  const volumesOn = useCurrFlag('volumes');
  const gridList = useMemo(() => gridEpisodes(withVolumes(volumesOn)), [volumesOn]);

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
    const known = requestedSelection(requested, gridList);
    return known === null ? null : { ownerId, id: known };
  });
  const selected = latchedSelection(latch, ownerId);
  const setSelected = (id: string): void => setLatch({ ownerId, id });
  useEffect(() => {
    if (requested === undefined) return;
    const known = requestedSelection(requested, gridList);
    if (known !== null) setLatch({ ownerId, id: known });
    tabNavigation.setParams({ episodeId: undefined });
  }, [requested, tabNavigation, ownerId, gridList]);
  const selectedId = reconcileSelection(selected, gridList, initialEpisode(GRID_EPISODES, snap));
  // Latch the first selection (the episode of the next quest) so finishing a quest does not move it:
  // back from the quest player returns to the same selection. It survives rotation as screen state.
  // The latch belongs to the profile: switching learner starts from that learner's next quest.
  useEffect(() => {
    if (paneMode && selected === null && selectedId !== null) setLatch({ ownerId, id: selectedId });
  }, [paneMode, selected, selectedId, ownerId]);

  // The level check's marks (F-PLC-001 section 3.7, consumer 3): placed-out cells and the start pin.
  // Nothing changes for a learner who never took the check.
  // The pin follows the cursor's stage rule (OD-4), so it re-renders when the inbox changes the tier.
  const tier = useAccessTier(profile?.id ?? '');
  const placements = snap?.placements;
  const marks = useMemo(
    () => journeyMarks(placements, ROUTE_CATALOG, cursorEntitlement(tier)),
    [placements, tier],
  );
  const snapQuests = snap?.quests;
  const completedIds = useMemo(
    () => (snapQuests === undefined ? NO_IDS : new Set(snapQuests.filter((q) => q.completedAt).map((q) => q.questId))),
    [snapQuests],
  );
  // A complete stage's pill reads Complete (F-QUEST-002 §3.8): the stage latch, or every grid episode done.
  const doneStages = useMemo(() => (snap === undefined ? undefined : completeStages(snap, episodesAll)), [snap]);
  // The ceremony stays reachable from the Stage 1 header once its prize cards are held (§3.8).
  const snapCards = snap?.cards;
  const hasPrize = useMemo(() => (snapCards === undefined ? false : ownsStagePrize(snapCards, HANGUL_PRIZE_STAGE)), [snapCards]);
  const marksOf = useMemo(
    () => learnerCellMarks({ quests: snapQuests ?? [], marks, catalog: ROUTE_CATALOG, completedIds }),
    [snapQuests, marks, completedIds],
  );

  // The route marks (F-ENT-003 section 3.7, E3-5): Next on the cell of the one next, the In your plan ring on
  // the leading plan's cells inside the horizon, the dotted ring on a lesson this learner cannot start yet.
  // The same input Home and Results build, so the three agree.
  const questOpen = useQuestAccess();
  const plans = usePlanStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const access = useMemo<JourneyAccessInput | undefined>(() => {
    if (!profile || !snap) return undefined;
    const input = routeNextInputOf({
      snapshot: snap,
      profileId: profile.id,
      today: dayKey(new Date().toISOString()),
      plans,
      quests: questsAll,
      episodes: episodesAll,
      tier,
      gatingActive: gatingActive(flags, bundleOs()),
      isQuestOpen: questOpen,
    });
    const next = routeNext(input);
    return {
      nextEpisodeId: next.kind === 'quest' ? next.episodeId : null,
      inPlanEpisodeIds: planView(input).inPlanEpisodeIds,
      isQuestOpen: questOpen,
    };
  }, [profile, snap, plans, tier, questOpen]);

  // The mastery rings (F-CURR-002 section 4.4, row CM-20): only while `mastery` is on and the learner records. The level
  // is the latched `cellBest`, read from the snapshot at once; Ready to refresh and New volume arrive with the read.
  const masteryView = useMastery(profile?.id ?? null, snap, useToday('local'));
  const cellBest = snap?.cellBest;
  const masteryRead = masteryView?.read ?? null;
  const Ring = masteryView?.ui.MasteryRing;
  const mastery = useMemo<JourneyMastery | undefined>(
    () =>
      Ring === undefined
        ? undefined
        : { Ring, levelOf: (id) => cellBest?.[id] ?? 0, refresh: new Set(masteryRead?.refresh ?? []), newVolume: new Set(masteryRead?.newVolume ?? []) },
    [Ring, cellBest, masteryRead],
  );

  const grid = (
    <>
      <Body tone="secondary">{m.intro}</Body>
      {flags.myRouteEnabled ? (
        // The Journey header link "See Learning Route" (LR-OD-11) opens the Route tab (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.2).
        <>
          <Spacer size="sm" />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              label={messages.learner.myRoute.open.cta}
              tone="secondary"
              size="md"
              onPress={() => navigation.navigate('Main', { screen: 'Route' })}
              testID="journey-my-route"
            />
          </View>
        </>
      ) : null}

      <Spacer size="lg" />
      <JourneyGrid
        stages={localStages}
        themes={localThemes}
        gridEpisodes={gridList}
        paneMode={paneMode}
        selectedId={selectedId}
        onOpen={(episodeId) => (paneMode ? setSelected(episodeId) : navigation.navigate('EpisodeDetail', { episodeId }))}
        marksOf={marksOf}
        storyEntries={STORY_ENTRIES}
        quests={snapQuests}
        completeStages={doneStages}
        onOpenStagePrize={hasPrize ? () => navigation.navigate('StageComplete', { stageKey: HANGUL_PRIZE_STAGE }) : undefined}
        // Stages 2-7 (F-CURR-002 row CM-22): See your prize and the Stage Check by the pill (under the header at large
        // text sizes), and the tested-out caption, from the Stage Check's chunk while their switches are on.
        renderStageExtras={(stage, place, complete) => <StageHeaderSlot place={place} stage={stage} complete={complete} profileId={profile?.id ?? null} />}
        onOpenHangulCheck={() => navigation.navigate('StageReview', { stageKey: 'stage1' })}
        // A stories-only cell opens its cell page on one pane and on two (F-STORY-005 §3.6).
        onOpenStories={(stage, theme) => navigation.navigate('CellStories', { stage, theme, source: 'cell' })}
        access={access}
        mastery={mastery}
        // Row CM-25: Stage Jump Ahead's line, from the Cell Check's chunk while `cellCheck` is on.
        stageFooter={(stage) => (
          <>
            <StageJumpSlot profileId={profile?.id ?? null} stage={stage} />
            {/* Row CM-32: the Block Sprint, the optional bonus after Stage 1, while `decodingSprint` is on. */}
            {stage.key === 'stage1' && doneStages?.has('stage1') === true ? <DecodingSprintOffer testID="journey-decoding-sprint" onOpen={() => navigation.navigate('DecodingSprint')} /> : null}
          </>
        )}
      />

      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.how.title}</Heading>
        <Spacer size="xs" />
        <Body tone="secondary" size="sm">
          {m.how.body}
        </Body>
        {MAP_HAS_STORIES ? (
          <>
            <Spacer size="xs" />
            <Body tone="secondary" size="sm" testID="journey-stories-how">
              {m.how.stories}
            </Body>
          </>
        ) : null}
        {marks !== null ? (
          <>
            <Spacer size="xs" />
            <Body tone="secondary" size="sm" testID="journey-placement-note">
              {m.how.placement}
            </Body>
          </>
        ) : null}
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
      onOpenStory={(t) => (t.route === 'StoryReader' ? navigation.navigate('StoryReader', t.params) : navigation.navigate('QuestPlayer', t.params))}
      onOpenSources={(storyId) => navigation.navigate('StorySources', { storyId, from: 'episode' })}
      onOpenCultureNotes={(storyId) => navigation.push('CultureNotes', { storyId })}
      onOpenCellStories={(stage, theme, source) => navigation.navigate('CellStories', { stage, theme, source })}
      onOpenVolume={setSelected}
      {...episodeAccessExits(navigation, setSelected)}
    />
  ) : (
    <ComingSoonPane />
  );

  return (
    // A tab root: no Back; its name sits in its header row beside the Display (Aa) control (AMENDMENTS-DISPLAY-NAV
    // sections 3.6 and 7.1).
    <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width="full" scrollable={!paneMode} header={{ title: m.title, titleInline: true }}>
      <SplitPane master={grid} detail={detail} masterLabel={m.panes.master} detailLabel={m.panes.detail} detailScrolls={false} />
    </Screen>
  );
}

/** Nothing selectable (no episode at all): the coming-soon words, so the pane is never blank. */
function ComingSoonPane(): ReactElement {
  const messages = useMessages();
  const m = messages.learner.episode.comingSoon;
  return (
    <Screen tone="canvas" header={ROOT_HEADER}>
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
