import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HeritageCardArt,
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
  supportedCardIds,
  touchTarget,
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
import { cardById, episodeById, episodesAll, questById, questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard } from '../../logic/content-locale';
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
import { bookmarkClearedByResults } from '../../logic/story/resume';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';

type ResultsMessages = Messages['learner']['results'];

/** Learner's cub in the name chip above the guide Hoya. */
const AVATAR_SIZE = 40;

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
  const cachedTier = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const reducedMotion = useReducedMotion();
  const { panes } = useLayoutClass();
  // What this run earned (the quest card and the completion awards), decided
  // once when the score is written (F-STORY-006 §3.3). The extras get their
  // own banner with PR 6.5a; until then the quest card banner is unchanged.
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

  // Android/web read the live region above (a second announcement would double-read);
  // iOS VoiceOver ignores live regions, so it gets an explicit announcement.
  const newCardId = award?.isNew ? award.cardId : undefined;
  useEffect(() => {
    if (!newCardId || Platform.OS !== 'ios') return;
    const card = cardById(newCardId);
    if (!card) return;
    AccessibilityInfo.announceForAccessibility(m.newCard.announce(localizeCard(card, locale).titleEn));
  }, [newCardId, m, locale]);

  const played = total > 0;
  const cheerMessage = resultsCheerMessage(stars, played, m.cheer);
  const newCardSource = award?.isNew ? cardById(award.cardId) : undefined;
  const newCard = newCardSource && localizeCard(newCardSource, locale);
  const showSparkles = !!newCard && stars >= 3;

  // "Next up" (F-QUEST-002 §3.5): the Journey cursor with this quest counted as
  // done, told the same stages and placed-out quests as Home and My route
  // (`cursorContext`, F-ROUTE-001 R-4a), so the three never disagree. Deciding
  // it from route params (not from the snapshot the effect above is still
  // writing) keeps it stable across the write.
  const tier = effectiveTier(profile?.id ?? '', new Date()).tier;
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
    // `cachedTier` re-renders this screen when the inbox changes the tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, questId, total, tier, cachedTier, locale],
  );
  const actions = resultsActions(teaser);

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
      </View>

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
        onPress={() => {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            }),
          );
        }}
      />
      <Spacer size="sm" />
      {episode ? (
        <Button
          label={m.episodePage.cta}
          tone={actions.episodePage.tone}
          size={actions.episodePage.size}
          fullWidth
          onPress={() => {
            // Two panes: the episode in the Journey's right pane, selected in the grid (F-LAYOUT-001 §3.7).
            const state = navigation.getState();
            const page = episodeReturn(panes, episode.id, state.routes[state.index - 1]?.name);
            if (page.to === 'journeyPane') navigation.navigate('Main', { screen: 'Journey', params: { episodeId: page.episodeId } });
            else navigation.navigate('EpisodeDetail', { episodeId: page.episodeId });
          }}
        />
      ) : null}
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

/** The art is decorative (hidden from screen readers), so a target size is just the nearest token. */
const CARD_THUMB = touchTarget.hero;

/** The card's art, or its Korean word on the theme tint when no art ships yet. */
function CardArtThumb({ card }: { card: HeritageCard }): React.ReactElement {
  const hasArt = supportedCardIds.includes(card.id);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: CARD_THUMB,
        height: CARD_THUMB,
        borderRadius: radii.lg,
        borderWidth: borderWidth.thick,
        borderColor: colors.rarity[card.rarity],
        backgroundColor: hasArt ? colors.surface.paper : colors.theme[card.theme],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {hasArt ? (
        <HeritageCardArt cardId={card.id} size={CARD_THUMB} />
      ) : (
        <Heading level="title">
          {card.subtitleKo ?? card.titleEn.charAt(0)}
        </Heading>
      )}
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
