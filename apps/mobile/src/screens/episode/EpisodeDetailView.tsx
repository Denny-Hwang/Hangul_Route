import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  KoreanText,
  NextMarker,
  Pill,
  Pip,
  RouteTag,
  Screen,
  Spacer,
  StarRow,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import type { StageKey, ThemeKey } from '@hangul-route/content-schema';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PrereqSheet } from '../../components/PrereqSheet';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { cardById, episodeById, episodesAll, questsAll, stageByKey, themeByKey } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { askFor, askGate, helpAskedEvent, isClassOnly, type AskGate } from '../../logic/access-copy';
import {
  backToOpenLessons,
  episodeAccessView,
  previewFromOf,
  previewOpenedEvent,
  startedFromEpisode,
  taughtLetters,
  type BackTarget,
  type PreviewFrom,
} from '../../logic/episode-access';
import { dayKey } from '../../logic/homework/mission-builder';
import { planView, routeNext, routeNextInputOf } from '../../logic/route-next';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { useMembershipStore } from '../../store/membership-store';
import { usePlanStore } from '../../store/plan-store';
import { useAccessTier, useQuestAccess } from '../../store/tier-store';
import { firstFreeTopicKey } from '../vocab/topic-data';
import { localizeCard, localizeEpisode, localizeQuest, localizeStage, localizeTheme } from '../../logic/content-locale';
import { buildsOnLine, prereqSheet, softPrerequisite, type PrereqSheet as PrereqSheetModel } from '../../logic/quest-flow/soft-prereq';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { usePrereqSheetStore } from '../../store/prereq-sheet-store';
import { useProgressStore } from '../../store/progress-store';
import { storyEpisodeEntries } from '../../logic/story/story-episode';
import { defaultStoryIndex } from '../../logic/story/story-index';
import { lessonRowCount, type CellStoriesSource } from '../../logic/story/cell-stories';
import { CellLinkRow } from '../story/CellLinkRow';
import { StoryEpisodeDetail, type StoryTarget } from './StoryEpisodeDetail';

export interface EpisodeDetailViewProps {
  episodeId: string;
  /** Opens a quest full screen. `episodeId` is the quest's own episode (the "Start there?" sheet can point at an earlier one). */
  onStartQuest: (questId: string, episodeId: string) => void;
  onOpenCard: (cardId: string) => void;
  /** Renders the back arrow when given (the stack screen passes it; a split pane does not). */
  onBack?: () => void;
  /** Story episodes (F-STORY-004 §3.6): a story action's route (`QuestPlayer`, optionally resumed, or the replay `StoryReader`). */
  onOpenStory: (target: StoryTarget) => void;
  /** Story episodes: Sources of the page's story (`StorySources { storyId, from: 'episode' }`). */
  onOpenSources: (storyId: string) => void;
  /** Story episodes: the "Culture notes: N found" line (`CultureNotes { storyId }`, pushed). */
  onOpenCultureNotes: (storyId: string) => void;
  /** The cell page (F-STORY-005 §3.6): the lesson page's stories row, or a story page's home-cell pill. */
  onOpenCellStories: (stage: StageKey, theme: ThemeKey, source: Exclude<CellStoriesSource, 'cell'>) => void;
  /**
   * Where the page was opened from, for `access.preview_opened` (F-ENT-003 section 3.12); absent
   * reads `journey`.
   */
  from?: PreviewFrom;
  /** The preview card's ask (section 3.7): the Plan screen, directly or through the PIN screen (`episodeAccessExits`). */
  onAsk: (gate: AskGate) => void;
  /** The preview card's Back to open lessons: the next lesson page, the first free word topic, the Library or the Journey. */
  onBackToOpenLessons: (target: BackTarget) => void;
}

/** The number disc of a quest row (unchanged size, RouteMarkers constants). */
const QUEST_DISC = 44;

/**
 * The lesson page (wireframe design/wireframes/episode/detail.md). F-ENT-003 E3-6 (wireframe
 * design/wireframes/episode/detail-access-preview.md, marks design/components/RouteMarkers/spec.md):
 * the row of the one next carries the Next triangle and chip, a row in the plan the In your plan
 * chip; a free learner's closed row (effective switch on) shows Not open yet in place of Start, and
 * the page ends with the preview card (the ask by audience and Back to open lessons). No lock glyph.
 */
export function EpisodeDetailView({
  episodeId,
  onStartQuest,
  onOpenCard,
  onBack,
  onOpenStory,
  onOpenSources,
  onOpenCultureNotes,
  onOpenCellStories,
  from,
  onAsk: openAsk,
  onBackToOpenLessons,
}: EpisodeDetailViewProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.episode;
  const access = messages.learner.access;
  const locale = useLocale();
  const episode = useMemo(() => {
    const source = episodeById(episodeId);
    return source && localizeEpisode(source, locale);
  }, [episodeId, locale]);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

  // May the learner start each quest, the one next and the plan view (F-ENT-003 sections 3.5, 3.7).
  const tier = useAccessTier(profile?.id ?? '');
  const questOpen = useQuestAccess();
  const plans = usePlanStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const memberships = useMembershipStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const { audience } = useAudience();
  const route = useMemo(() => {
    if (!profile || !snap) return null;
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
    try {
      return { next: routeNext(input), plan: planView(input) };
    } catch {
      // Fail open (wireframe state Error): no tag, every Start live.
      return null;
    }
  }, [profile, snap, plans, tier, questOpen]);

  const asked = usePrereqSheetStore((s) => s.asked);
  const markAsked = usePrereqSheetStore((s) => s.markAsked);
  // The quest whose "Start there?" sheet is open, if any (F-QUEST-002 §3.5).
  const [sheet, setSheet] = useState<{ questId: string; model: PrereqSheetModel } | null>(null);

  // Reward cards are revealed only once earned (F-CARD-002 §3.6 spirit).
  const unlockedCardIds = useMemo(() => new Set((snap?.cards ?? []).map((c) => c.cardId)), [snap]);

  const questProgress = useMemo(() => {
    if (!episode || !snap) return new Map<string, number>();
    return new Map(snap.quests.filter((q) => q.episodeId === episode.id).map((q) => [q.questId, q.stars]));
  }, [episode, snap]);

  // The rows' actions and tags, and whether the page is a preview (F-ENT-003 section 3.7).
  const accessView = useMemo(
    () =>
      episode && episode.status !== 'preview'
        ? episodeAccessView({
            questIds: episode.questIds.filter((id) => questsAll.some((q) => q.id === id)),
            starsOf: (questId) => questProgress.get(questId) ?? 0,
            isQuestOpen: questOpen,
            next: route?.next ?? null,
            plan: route?.plan ?? null,
          })
        : null,
    [episode, questProgress, questOpen, route],
  );
  const preview = accessView?.preview === true;
  // `access.preview_opened` once per open of a lesson page in preview (section 3.12).
  const previewSent = useRef<string | null>(null);
  const profileId = profile?.id;
  useEffect(() => {
    if (!episode || !preview || previewSent.current === episode.id) return;
    previewSent.current = episode.id;
    void track(previewOpenedEvent(profileId, episode.stage, episode.theme, previewFromOf(from)));
  }, [episode, preview, profileId, from]);

  // A story episode that is not a preview, with every story in the index, is the story page; else the quest list.
  const storyEntries = useMemo(() => (episode ? storyEpisodeEntries(episode, defaultStoryIndex()) : null), [episode]);
  // The cell's heritage stories (F-STORY-005 §3.6, wireframe episode/detail-cell-stories-row C): 0 hides the row.
  const cellStoryCount = useMemo(() => (episode ? lessonRowCount(episode, defaultStoryIndex()) : 0), [episode]);

  if (!episode) {
    return (
      <Screen>
        <Body>{m.notFound}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button label={messages.common.buttons.back} tone="secondary" size="md" onPress={onBack} testID="episode-not-found-back" />
            </View>
          </>
        ) : null}
      </Screen>
    );
  }

  // A closed quest (a Stage 5 book on the free plan, switch on) has no Start: the quest list in
  // preview shows Not open yet and the preview card instead (F-ENT-003 section 3.7).
  if (storyEntries && !preview) {
    return (
      <StoryEpisodeDetail
        episode={episode}
        entries={storyEntries}
        onOpenStory={onOpenStory}
        onOpenCard={onOpenCard}
        onOpenSources={onOpenSources}
        onOpenCultureNotes={onOpenCultureNotes}
        onOpenCellStories={(stage, theme) => onOpenCellStories(stage, theme, 'story-pill')}
        cellStoryCount={cellStoryCount}
        onOpenCellStoriesRow={() => onOpenCellStories(episode.stage, episode.theme, 'lesson-row')}
        onBack={onBack}
      />
    );
  }

  const stageDef = stageByKey(episode.stage);
  const themeDef = themeByKey(episode.theme);
  const stage = stageDef && localizeStage(stageDef, locale);
  const theme = themeDef && localizeTheme(themeDef, locale);
  const stageColor = colors.stage[episode.stage];
  const quests = episode.questIds
    .map((id) => questsAll.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => localizeQuest(q, locale));
  const isPreview = episode.status === 'preview';

  const startQuest = (questId: string, questEpisodeId: string): void => {
    // Starting the one next from the lesson page (F-ENT-003 section 3.12).
    const event = startedFromEpisode(profileId, route?.next ?? null, questId);
    if (event) void track(event);
    onStartQuest(questId, questEpisodeId);
  };
  const rowOf = new Map((accessView?.rows ?? []).map((row) => [row.questId, row]));
  const ask = askFor(audience, isClassOnly(memberships ?? []), access);
  const onAsk = (): void => {
    void track(helpAskedEvent(profileId, 'episode', ask.audience));
    openAsk(askGate(gateOpensDirectlyNow(), 'episode'));
  };
  const onBackToOpen = (): void => onBackToOpenLessons(backToOpenLessons(route?.next ?? null, firstFreeTopicKey()));

  // Start on a quest whose predecessor is not done: ask once per session, never block.
  const onStart = (questId: string): void => {
    const model = prereqSheet({
      snapshot: snap,
      quests: questsAll,
      episodes: episodesAll,
      questId,
      shownQuestIds: new Set(asked),
    });
    if (!model) {
      startQuest(questId, episode.id);
      return;
    }
    markAsked(questId);
    setSheet({ questId, model });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen tone="canvas" scrollable>
        {onBack ? (
          <>
            <Pressable
              onPress={onBack}
              hitSlop={spacing.md}
              accessibilityLabel={messages.a11y.goBack}
              style={{ alignSelf: 'flex-start', padding: spacing.xs }}
            >
              <Icon name="arrow-left" size={28} />
            </Pressable>
            <Spacer size="sm" />
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pill tone="primary" label={stage?.titleEn ?? ''} size="sm" />
          <Pill tone="secondary" label={theme?.titleEn ?? ''} size="sm" />
          {isPreview ? <Pill tone="neutral" label={m.comingSoon.pill} size="sm" /> : null}
        </View>

        <Spacer size="md" />
        {/* The stage colour is an accent bar, not the text colour: stage1-4 are below 3:1 as text. */}
        <View
          style={{ width: spacing.xxxl, height: spacing.sm, borderRadius: radii.pill, backgroundColor: stageColor }}
        />
        <Spacer size="sm" />
        <Heading level="display">{episode.titleEn}</Heading>
        {episode.subtitleEn ? (
          <>
            <Spacer size="xs" />
            <Body tone="secondary">{episode.subtitleEn}</Body>
          </>
        ) : null}

        <Spacer size="lg" />
        <HoyaBubble tone="idle" message={episode.hoyaIntroEn} />

        {isPreview ? (
          <>
            <Spacer size="xl" />
            <Card padding="md" tone="sunken">
              <View style={{ alignItems: 'center' }}>
                <Hoya pose="reading" size={96} accessibilityLabel={messages.a11y.hoya('reading')} />
                <Spacer size="md" />
                <Body weight="semibold">{m.comingSoon.title}</Body>
                <Caption tone="muted" align="center">
                  {m.comingSoon.note}
                </Caption>
              </View>
            </Card>
          </>
        ) : (
          <>
            <Spacer size="lg" />
            <Heading level="prompt">{m.quests.heading}</Heading>
            <Spacer size="sm" />
            {quests.map((q, i) => {
              const stars = questProgress.get(q.id) ?? 0;
              const row = rowOf.get(q.id);
              const action = row?.action ?? (stars > 0 ? 'replay' : 'start');
              const buildsOn =
                stars === 0 && action !== 'closed'
                  ? softPrerequisite({ snapshot: snap, quests: questsAll, episodes: episodesAll, questId: q.id })
                  : undefined;
              const letters = action === 'closed' ? taughtLetters(q) : [];
              // The tags as words (section 3.14), after the row's own lines the group would otherwise hide.
              const tagWords = [row?.next ? messages.a11y.access.next : null, row?.inPlan ? messages.a11y.access.inPlan : null].filter(
                (w): w is string => w !== null,
              );
              return (
                <Card key={q.id} padding="md" style={{ marginBottom: spacing.sm }} testID={`episode-quest-${q.id}`}>
                  <View
                    accessible={tagWords.length > 0}
                    accessibilityLabel={
                      tagWords.length > 0
                        ? messages.a11y.access.row(
                            q.titleEn,
                            [q.blurbEn, buildsOn ? buildsOnLine(buildsOn, m) : null, messages.a11y.stars(stars)].filter(
                              (line): line is string => Boolean(line),
                            ),
                            tagWords,
                          )
                        : undefined
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                  >
                    <View
                      style={{
                        width: QUEST_DISC,
                        height: QUEST_DISC,
                        borderRadius: radii.circle,
                        backgroundColor: stars > 0 ? colors.feedback.successLight : colors.surface.sunken,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Body weight="bold">{i + 1}</Body>
                      {/* The Next triangle over the number disc, its tip just above it (RouteMarkers D6). */}
                      {row?.next ? <NextMarker tipInset={-spacing.xxs} testID="episode-next-marker" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body weight="semibold">{q.titleEn}</Body>
                      {q.blurbEn ? <Caption tone="muted">{q.blurbEn}</Caption> : null}
                      {buildsOn ? <Caption tone="muted">{buildsOnLine(buildsOn, m)}</Caption> : null}
                      {row?.next || row?.inPlan ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                          {row.next ? <RouteTag kind="next" label={messages.learner.routeNext.tag.next} testID="episode-tag-next" /> : null}
                          {row.inPlan ? (
                            <RouteTag kind="inPlan" label={messages.learner.routeNext.tag.inPlan} testID="episode-tag-in-plan" />
                          ) : null}
                        </View>
                      ) : null}
                      <Spacer size="xs" />
                      <StarRow stars={stars as 0 | 1 | 2 | 3} size={18} accessibilityLabel={messages.a11y.stars(stars)} />
                    </View>
                  </View>
                  {letters.length > 0 ? (
                    <>
                      <Spacer size="sm" />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {letters.map((letter) => (
                          <KoreanText key={letter.ko} ko={letter.ko} romanization={letter.romanization} size="sm" />
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Spacer size="md" />
                  {action === 'closed' ? (
                    // Text, never a disabled button (RouteMarkers "Closed row"): the stage-row dotted pip and the words.
                    <View
                      testID="episode-quest-not-open"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}
                    >
                      <Pip state="later" context="stage" />
                      <Body weight="semibold" tone="secondary">
                        {access.notOpen}
                      </Body>
                    </View>
                  ) : (
                    <Button
                      label={action === 'replay' ? m.quests.playAgain.cta : m.quests.start.cta}
                      tone={action === 'replay' ? 'secondary' : 'primary'}
                      size="md"
                      fullWidth
                      onPress={() => (action === 'replay' ? startQuest(q.id, episode.id) : onStart(q.id))}
                    />
                  )}
                </Card>
              );
            })}

            {cellStoryCount > 0 ? (
              <>
                <Spacer size="sm" />
                <CellLinkRow
                  label={messages.learner.journey.cellStories.row}
                  accessibilityLabel={messages.learner.journey.cellStories.rowLabel(cellStoryCount)}
                  count={messages.learner.journey.countMark(cellStoryCount, false)}
                  icon="library"
                  onPress={() => onOpenCellStories(episode.stage, episode.theme, 'lesson-row')}
                  testID="episode-cell-stories-row"
                />
              </>
            ) : null}

            <Spacer size="lg" />
            <Heading level="prompt">{m.cards.heading}</Heading>
            <Spacer size="sm" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {episode.rewardCardIds.map((cid) => {
                const source = cardById(cid);
                if (!source) return null;
                const c = localizeCard(source, locale);
                const earned = unlockedCardIds.has(cid);
                return (
                  <Pressable
                    key={cid}
                    disabled={!earned}
                    onPress={() => onOpenCard(cid)}
                    accessibilityRole="button"
                    accessibilityLabel={earned ? messages.a11y.episodeCard(c.titleEn) : messages.a11y.cardWaiting}
                    style={{
                      flexBasis: '47%',
                      padding: spacing.md,
                      backgroundColor: earned ? colors.surface.paper : colors.surface.sunken,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: colors.border.subtle,
                      minHeight: touchTarget.min,
                    }}
                  >
                    {earned ? (
                      <>
                        <Body weight="semibold">{c.titleEn}</Body>
                        {c.subtitleKo ? <Caption tone="brand">{c.subtitleKo}</Caption> : null}
                        <Pill tone="neutral" size="sm" label={messages.learner.library.rarity[c.rarity]} />
                      </>
                    ) : (
                      // No glyph (RouteMarkers D7): the words carry the meaning in every state of the page.
                      <Caption tone="muted">{m.cards.waiting}</Caption>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {preview ? (
              <>
                <Spacer size="xl" />
                <Card padding="md" tone="sunken" testID="episode-preview-card">
                  <View style={{ alignItems: 'center' }}>
                    <Hoya pose="reading" size={96} accessibilityLabel={messages.a11y.hoya('reading')} />
                    <Spacer size="md" />
                    <View accessible accessibilityRole="text" accessibilityLabel={access.preview.line}>
                      <Body weight="semibold" align="center">
                        {access.preview.line}
                      </Body>
                    </View>
                  </View>
                  <Spacer size="lg" />
                  <Button label={ask.label} tone="secondary" size="md" fullWidth onPress={onAsk} testID="episode-preview-ask" />
                  <Spacer size="sm" />
                  <Button label={access.back.cta} tone="ghost" size="md" fullWidth onPress={onBackToOpen} testID="episode-preview-back" />
                </Card>
              </>
            ) : null}
          </>
        )}
        <Spacer size="xxl" />
      </Screen>
      {sheet ? (
        <PrereqSheet
          sheet={sheet.model}
          onStartThere={() => {
            setSheet(null);
            startQuest(sheet.model.previousQuestId, sheet.model.previousEpisodeId);
          }}
          onPlayAnyway={() => {
            setSheet(null);
            startQuest(sheet.questId, episode.id);
          }}
        />
      ) : null}
    </View>
  );
}
