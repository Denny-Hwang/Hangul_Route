import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  KoreanText,
  Screen,
  Spacer,
  StarRow,
  borderWidth,
  colors,
  radii,
  spacing,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { cardById, episodeById, episodesAll, questById, questsAll } from '../../content';
import { storyById } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard, localizeEpisode, localizeStory } from '../../logic/content-locale';
import { cursorContext } from '../../logic/cursor-context';
import {
  resultsActions,
  resultsTeaser,
  teaserCtaLabel,
  teaserTappedEvent,
  type ResultsTeaser,
} from '../../logic/quest-flow/results-teaser';
import { episodeReturn } from '../../logic/layout/quest-return';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { resultsCheerMessage, resultsHeadline } from '../../logic/results-copy';
import { extraCardsAnnouncement, extraCardsView } from '../../logic/results-extra-cards';
import { emptyBookmarks } from '../../logic/story/bookmarks';
import { resultsStoryOf, storyResultsActionEvent, storyResultsExtras } from '../../logic/story/results-extras';
import { bookmarkClearedByResults } from '../../logic/story/resume';
import { defaultStoryIndex } from '../../logic/story/story-index';
import { nextStoryAfter, storyLockFor } from '../../logic/story/story-pick';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { useAccessTier, useQuestAccess } from '../../store/tier-store';
import { CardArtThumb } from './CardArtThumb';
import { ExtraCardsBanner } from './ExtraCardsBanner';
import { StoryResultsExtras, type StoryResultsChoice } from './StoryResultsExtras';

type ResultsMessages = Messages['learner']['results'];

/** Learner's cub in the name chip above the guide Hoya. */
const AVATAR_SIZE = 40;

const NO_BOOKMARKS = emptyBookmarks();

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.results;
  const locale = useLocale();
  const { questId, episodeId, stars, correct, total, retries = 0 } = route.params;
  const quest = questById(questId);
  const episode = episodeById(episodeId);
  const profile = useProfileStore(activeProfileSelector);
  const recordQuestComplete = useProgressStore((s) => s.recordQuestComplete);
  const unlockCards = useProgressStore((s) => s.unlockCards);
  const recordCatchUp = useProgressStore((s) => s.recordCatchUp);
  const snapshot = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // The access tier (F-ENT-003 section 3.4): re-renders when the inbox, the spaces or the subscription change it.
  const tier = useAccessTier(profile?.id ?? '');
  // May the active learner start a quest (F-ENT-003 section 3.6): "Next story" never offers a closed book story.
  const questOpen = useQuestAccess();
  const bookmarks = useStoryStore((s) => (profile ? s.byProfile[profile.id] : undefined)) ?? NO_BOOKMARKS;
  const reducedMotion = useReducedMotion();
  const { panes } = useLayoutClass();
  // What this run earned (the quest card and the completion awards), decided
  // once when the score is written (F-STORY-006 §3.3): the quest card banner
  // and, under it, the extra-cards banner (§3.7).
  const [outcome, setOutcome] = useState<QuestResultOutcome | null>(null);
  const award = outcome?.award ?? null;
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!profile || !quest) return;
    // The score is written once per results visit, even if the profile
    // object changes identity underneath (wireframe results/celebrate).
    if (recordedRef.current) return;
    recordedRef.current = true;
    // Score, telemetry and the one-time card awards live in logic/results-award.
    const earned = applyQuestResult(
      {
        profileId: profile.id,
        profileCreatedAt: profile.createdAt,
        questId,
        episodeId,
        rewardCardId: quest.rewardCardId,
        stars,
        correct,
        total,
        retries,
      },
      {
        isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
        snapshot: (id) => useProgressStore.getState().byProfile[id],
        recordQuestComplete,
        unlockCards,
        recordCatchUp,
        track,
      },
    );
    setOutcome(earned);
    // A finished story's bookmark goes with the score write (F-STORY-004 §3.8).
    const stories = useStoryStore.getState();
    const finishedStory = bookmarkClearedByResults(quest, total, (storyId) => stories.getBookmark(profile.id, storyId));
    if (finishedStory) stories.clearBookmark(profile.id, finishedStory);
  }, [profile, quest, questId, episodeId, stars, correct, total, retries, recordQuestComplete, unlockCards, recordCatchUp]);

  const played = total > 0;
  const cheerMessage = resultsCheerMessage(stars, played, m.cheer);
  const newCardSource = award?.isNew ? cardById(award.cardId) : undefined;
  const newCard = newCardSource && localizeCard(newCardSource, locale);
  const showSparkles = !!newCard && stars >= 3;

  // The cards an episode, stage or set completion brought besides the quest card (F-STORY-006 §3.7).
  const extras = useMemo(() => {
    const view = extraCardsView(outcome, (id) => {
      const card = cardById(id);
      return card && localizeCard(card, locale);
    });
    if (!view) return null;
    const finished = view.episodeId ? episodeById(view.episodeId) : undefined;
    return { ...view, episodeTitle: finished && localizeEpisode(finished, locale).titleEn };
  }, [outcome, locale]);

  // Android/web read the live region below (a second announcement would double-read);
  // iOS VoiceOver ignores live regions, so it gets one explicit announcement for both banners.
  const extrasAnnouncement = extras
    ? extraCardsAnnouncement(m.extraCards, extras.cards.map((c) => c.titleEn), extras.episodeTitle)
    : null;
  const announcement = [newCard ? m.newCard.announce(newCard.titleEn) : null, extrasAnnouncement]
    .filter((line): line is string => line !== null)
    .join(' ');
  useEffect(() => {
    if (!announcement || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  // "Next up" (F-QUEST-002 §3.5): the Journey cursor with this quest counted as
  // done, told the same stages and placed-out quests as Home and My route
  // (`cursorContext`, F-ROUTE-001 R-4a), so the three never disagree. Deciding
  // it from route params (not from the snapshot the effect above is still
  // writing) keeps it stable across the write.
  const teaser = useMemo(
    () =>
      resultsTeaser({
        snapshot,
        quests: questsAll,
        episodes: episodesAll,
        questId,
        total,
        locale,
        ...cursorContext({ tier, placements: snapshot?.placements, quests: questsAll, episodes: episodesAll }),
      }),
    [snapshot, questId, total, tier, locale],
  );
  const actions = resultsActions(teaser);

  // The story variant (F-STORY-003 §3.7): a story quest whose story is bundled gets the story card and
  // its own actions (one primary: Next story, else Back home), in place of "Next up" and the two
  // generic buttons. Next story (F-STORY-004 `nextStoryAfter`) walks the same book or shelf category
  // and never offers a locked story; the culture-note link waits for the Culture notes route
  // (F-STORY-004 PR 4.7), so none is supplied yet.
  const storyResults = useMemo(() => {
    const story = resultsStoryOf(quest, (id) => {
      const found = storyById(id);
      return found && localizeStory(found, locale);
    });
    if (!story) return null;
    const next = nextStoryAfter(questId, {
      entries: defaultStoryIndex(),
      snapshot,
      bookmarks,
      isLocked: storyLockFor({ tier, gatingEnabled: gatingActive(flags, bundleOs()), episodes: episodesAll, isQuestOpen: questOpen }),
    });
    const view = storyResultsExtras(
      {
        stars,
        storyId: story.storyId,
        level: story.level,
        title: story.title,
        nextQuestId: next?.questId ?? null,
        hasEpisodePage: episode !== undefined,
        cultureNote: null,
        episodeCompleteLine: null,
      },
      messages.learner.story.results,
    );
    return { story, next, view };
  }, [quest, questId, locale, snapshot, bookmarks, tier, questOpen, stars, episode, messages]);

  const goHome = (): void => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      }),
    );
  };

  const openEpisodePage = (): void => {
    if (!episode) return;
    // Two panes: the episode in the Journey's right pane, selected in the grid (F-LAYOUT-001 §3.7).
    const state = navigation.getState();
    const page = episodeReturn(panes, episode.id, state.routes[state.index - 1]?.name);
    if (page.to === 'journeyPane') navigation.navigate('Main', { screen: 'Journey', params: { episodeId: page.episodeId } });
    else navigation.navigate('EpisodeDetail', { episodeId: page.episodeId });
  };

  const chooseStoryAction = (choice: StoryResultsChoice): void => {
    if (!storyResults) return;
    void track(storyResultsActionEvent(profile?.id, questId, storyResults.story.storyId, choice.action));
    switch (choice.action) {
      case 'next-story':
        if (storyResults.next) {
          navigation.navigate('QuestPlayer', { questId: storyResults.next.questId, episodeId: storyResults.next.episodeId });
        }
        return;
      case 'read-again':
        // An unscored replay: the reader writes nothing (F-STORY-002 §3.1).
        navigation.navigate('StoryReader', choice.target);
        return;
      case 'episode':
        openEpisodePage();
        return;
      case 'home':
        goHome();
        return;
      case 'culture-note':
        // No culture note is supplied until the Culture notes route ships (F-STORY-004 PR 4.7).
        return;
    }
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        {profile ? (
          // The learner's own cub and name (F-LEARN-001 §3.6); the Hoya below is the guide.
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.xs,
              paddingLeft: spacing.xs,
              paddingRight: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.surface.paper,
              borderColor: colors.border.subtle,
              borderWidth: borderWidth.thin,
              borderRadius: radii.pill,
            }}
          >
            <ProfileAvatar avatar={profile.avatar} size={AVATAR_SIZE} />
            <Body weight="semibold">{profile.displayName}</Body>
          </View>
        ) : null}
        <Hoya
          pose={stars >= 2 ? 'cheering' : 'thinking'}
          size={140}
          accessibilityLabel={messages.a11y.hoya(stars >= 2 ? 'cheering' : 'thinking')}
        />
        <Spacer size="lg" />
        <Heading level="display">{resultsHeadline(stars, played, m.headline)}</Heading>
        <Spacer size="sm" />
        <StarRow stars={stars} size={48} accessibilityLabel={messages.a11y.stars(stars)} />
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone={stars >= 2 ? 'cheering' : 'thinking'} message={cheerMessage} />

      {/* Always mounted so assistive tech is watching it when the card appears. */}
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        {newCard ? (
          <>
            <Spacer size="lg" />
            <CardUnlockBanner
              m={m}
              card={newCard}
              showSparkles={showSparkles}
              reducedMotion={reducedMotion}
              onSeeCard={() => navigation.navigate('CardDetail', { cardId: newCard.id })}
            />
          </>
        ) : null}
        {extras ? (
          <>
            <Spacer size="lg" />
            <ExtraCardsBanner
              m={m.extraCards}
              cards={extras.shown}
              more={extras.more}
              total={extras.cards.length}
              episodeTitle={extras.episodeTitle}
              announcement={extrasAnnouncement ?? ''}
              reducedMotion={reducedMotion}
              onOpenCard={(cardId) => navigation.navigate('CardDetail', { cardId })}
            />
          </>
        ) : null}
      </View>

      {storyResults ? (
        <>
          <Spacer size="lg" />
          <StoryResultsExtras extras={storyResults.view} onChoose={chooseStoryAction} />
        </>
      ) : (
        <>
          {teaser ? (
            <>
              <Spacer size="lg" />
              <NextUpCard teaser={teaser} m={m} />
            </>
          ) : null}

          <Spacer size="xl" />
          {teaser ? (
            <>
              <Button
                label={teaserCtaLabel(teaser, m.nextUp)}
                tone="primary"
                size="hero"
                fullWidth
                onPress={() => {
                  if (profile) void track(teaserTappedEvent(profile.id, questId, teaser));
                  navigation.navigate('QuestPlayer', { questId: teaser.questId, episodeId: teaser.episodeId });
                }}
              />
              <Spacer size="sm" />
            </>
          ) : null}
          <Button
            label={m.backHome.cta}
            tone={actions.backHome.tone}
            size={actions.backHome.size}
            fullWidth
            onPress={goHome}
          />
          <Spacer size="sm" />
          {episode ? (
            <Button
              label={m.episodePage.cta}
              tone={actions.episodePage.tone}
              size={actions.episodePage.size}
              fullWidth
              onPress={openEpisodePage}
            />
          ) : null}
        </>
      )}
      <Spacer size="lg" />
    </Screen>
  );
}

/**
 * F-QUEST-002 §3.5 — the "Next up" card (wireframe results/next-quest-teaser).
 * The quest title and one line; letters in the line are taught content, so
 * they go through `KoreanText` with their romanization, never a plain string.
 */
function NextUpCard({ teaser, m }: { teaser: ResultsTeaser; m: ResultsMessages }): React.ReactElement {
  const { line } = teaser;
  return (
    <Card padding="md" tone="paper" testID="next-up-card">
      <Caption tone="muted">{m.nextUp.title}</Caption>
      <Spacer size="xs" />
      <Heading level="prompt">{teaser.titleEn}</Heading>
      {line?.kind === 'text' ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{line.text}</Body>
        </>
      ) : null}
      {line?.kind === 'letters' ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{m.nextUp.newLetters}</Body>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {line.letters.map((letter) => (
              <KoreanText key={letter.ko} ko={letter.ko} romanization={letter.romanization} size="sm" />
            ))}
          </View>
        </>
      ) : null}
    </Card>
  );
}

/**
 * F-MOTION-003 — Card unlock celebration, shown only for a newly earned card.
 *
 * The card itself is revealed — art, English name, Korean, romanization —
 * with "See my card" into the card detail (audit UX-03 / roadmap PR-14).
 * On mount it drops in from -80px translateY with a spring (delayed 400ms
 * after screen mount so stars + Hoya bubble register first). On 3-star
 * results, 5 amber sparkles also fade in around it, then fade out over
 * ~600ms. Reduced motion: static.
 */
function CardUnlockBanner({
  m,
  card,
  showSparkles,
  reducedMotion,
  onSeeCard,
}: {
  m: ResultsMessages;
  card: HeritageCard;
  showSparkles: boolean;
  reducedMotion: boolean;
  onSeeCard: () => void;
}): React.ReactElement {
  const translateY = useSharedValue(reducedMotion ? 0 : -80);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const sparkleOpacity = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      // Static path — no animation
      translateY.value = 0;
      opacity.value = 1;
      return;
    }
    // Delay the drop so the stars / Hoya bubble register first
    translateY.value = withDelay(
      400,
      withSpring(0, { damping: 12, stiffness: 90 }),
    );
    opacity.value = withDelay(400, withTiming(1, { duration: 250 }));

    if (showSparkles) {
      // 100ms after the drop completes (≈ 400ms + spring) → fade in then out
      sparkleOpacity.value = withDelay(
        900,
        withSequence(
          withTiming(0.9, { duration: 200, easing: Easing.bezier(0.2, 0, 0, 1) }),
          withTiming(0.9, { duration: 200 }),
          withTiming(0, { duration: 400, easing: Easing.bezier(0.4, 0, 1, 1) }),
        ),
      );
    }
  }, [reducedMotion, showSparkles, translateY, opacity, sparkleOpacity]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
  }));

  return (
    <View>
      <Animated.View style={bannerStyle}>
        <Card padding="md" tone="brand">
          <Body weight="semibold">{m.newCard.title}</Body>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <CardArtThumb card={card} />
            <View style={{ flex: 1 }}>
              <Body weight="bold" size="lg">
                {card.titleEn}
              </Body>
              {card.subtitleKo ? (
                <Heading level="title" tone="brand">
                  {card.subtitleKo}
                </Heading>
              ) : null}
              {card.romanization ? (
                <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
                  {card.romanization}
                </Caption>
              ) : null}
            </View>
          </View>
          <Spacer size="md" />
          <Button
            label={m.newCard.see.cta}
            tone="secondary"
            size="md"
            fullWidth
            accessibilityLabel={m.newCard.seeA11y(card.titleEn)}
            onPress={onSeeCard}
          />
        </Card>
      </Animated.View>
      {showSparkles && !reducedMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -16,
              left: -8,
              right: -8,
              bottom: -16,
            },
            sparkleStyle,
          ]}
        >
          <Sparkles />
        </Animated.View>
      ) : null}
    </View>
  );
}

function Sparkles(): React.ReactElement {
  // 5 amber 4-point sparkle stars around the card.
  // Positions (top-left, top-right, top-center, bottom-left, bottom-right) as % of container.
  const positions: Array<{ left: string; top: string }> = [
    { left: '4%', top: '0%' },
    { left: '92%', top: '5%' },
    { left: '48%', top: '-8%' },
    { left: '8%', top: '88%' },
    { left: '88%', top: '85%' },
  ];
  return (
    <>
      {positions.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.left as unknown as number,
            top: p.top as unknown as number,
          }}
        >
          <SparkleStar size={16} />
        </View>
      ))}
    </>
  );
}

function SparkleStar({ size }: { size: number }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2 L14 12 L12 22 L10 12 Z" fill={colors.feedback.nudge} opacity={0.95} />
      <Path d="M2 12 L12 10 L22 12 L12 14 Z" fill={colors.feedback.nudge} opacity={0.95} />
    </Svg>
  );
}
