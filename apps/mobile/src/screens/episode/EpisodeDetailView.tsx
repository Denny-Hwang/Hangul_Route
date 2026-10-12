import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  StarRow,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PrereqSheet } from '../../components/PrereqSheet';
import { cardById, episodeById, episodesAll, questsAll, stageByKey, themeByKey } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard, localizeEpisode, localizeQuest, localizeStage, localizeTheme } from '../../logic/content-locale';
import { buildsOnLine, prereqSheet, softPrerequisite, type PrereqSheet as PrereqSheetModel } from '../../logic/quest-flow/soft-prereq';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { usePrereqSheetStore } from '../../store/prereq-sheet-store';
import { useProgressStore } from '../../store/progress-store';
import { storyEpisodeEntries } from '../../logic/story/story-episode';
import { defaultStoryIndex } from '../../logic/story/story-index';
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
}

export function EpisodeDetailView({
  episodeId,
  onStartQuest,
  onOpenCard,
  onBack,
  onOpenStory,
  onOpenSources,
  onOpenCultureNotes,
}: EpisodeDetailViewProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.episode;
  const locale = useLocale();
  const episode = useMemo(() => {
    const source = episodeById(episodeId);
    return source && localizeEpisode(source, locale);
  }, [episodeId, locale]);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));

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

  // A story episode that is not a preview, with every story in the index, is the story page; else the quest list.
  const storyEntries = useMemo(() => (episode ? storyEpisodeEntries(episode, defaultStoryIndex()) : null), [episode]);

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

  if (storyEntries) {
    return (
      <StoryEpisodeDetail
        episode={episode}
        entries={storyEntries}
        onOpenStory={onOpenStory}
        onOpenCard={onOpenCard}
        onOpenSources={onOpenSources}
        onOpenCultureNotes={onOpenCultureNotes}
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

  const startQuest = onStartQuest;

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
              const buildsOn = stars === 0 ? softPrerequisite({ snapshot: snap, quests: questsAll, episodes: episodesAll, questId: q.id }) : undefined;
              return (
                <Card key={q.id} padding="md" style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radii.circle,
                        backgroundColor: stars > 0 ? colors.feedback.successLight : colors.surface.sunken,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Body weight="bold">{i + 1}</Body>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body weight="semibold">{q.titleEn}</Body>
                      {q.blurbEn ? <Caption tone="muted">{q.blurbEn}</Caption> : null}
                      {buildsOn ? <Caption tone="muted">{buildsOnLine(buildsOn, m)}</Caption> : null}
                      <Spacer size="xs" />
                      <StarRow stars={stars as 0 | 1 | 2 | 3} size={18} accessibilityLabel={messages.a11y.stars(stars)} />
                    </View>
                  </View>
                  <Spacer size="md" />
                  <Button
                    label={stars > 0 ? m.quests.playAgain.cta : m.quests.start.cta}
                    tone={stars > 0 ? 'secondary' : 'primary'}
                    size="md"
                    fullWidth
                    onPress={() => (stars > 0 ? startQuest(q.id, episode.id) : onStart(q.id))}
                  />
                </Card>
              );
            })}

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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Icon name="lock" size={20} color={colors.text.muted} />
                        {/* Shrinks so the line wraps inside the tile (native text in a row does not by default). */}
                        <Caption tone="muted" style={{ flexShrink: 1 }}>
                          {m.cards.waiting}
                        </Caption>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
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
