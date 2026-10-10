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
  Screen,
  Spacer,
  StarRow,
  borderWidth,
  colors,
  radii,
  spacing,
  supportedCardIds,
  touchTarget,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
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
import { cardById, episodeById, questById } from '../../content';
import { applyQuestResult } from '../../logic/results-award';
import type { CardAward } from '../../logic/reward';
import { resultsCheerMessage, resultsHeadline } from '../../logic/results-copy';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId, stars, correct, total, retries = 0 } = route.params;
  const quest = questById(questId);
  const episode = episodeById(episodeId);
  const profile = useProfileStore(activeProfileSelector);
  const recordQuestComplete = useProgressStore((s) => s.recordQuestComplete);
  const unlockCard = useProgressStore((s) => s.unlockCard);
  const reducedMotion = useReducedMotion();
  // What this run earned, decided once when the score is written.
  const [award, setAward] = useState<CardAward | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!profile || !quest) return;
    // The score is written once per results visit, even if the profile
    // object changes identity underneath (wireframe results/celebrate).
    if (recordedRef.current) return;
    recordedRef.current = true;
    // Score, telemetry and the one-time card award live in logic/results-award.
    const earned = applyQuestResult(
      {
        profileId: profile.id,
        questId,
        episodeId,
        rewardCardId: quest.rewardCardId,
        stars,
        correct,
        total,
        retries,
      },
      {
        ownedCardIds: () =>
          (useProgressStore.getState().byProfile[profile.id]?.cards ?? []).map((c) => c.cardId),
        recordQuestComplete,
        unlockCard,
        track,
      },
    );
    setAward(earned);
  }, [profile, quest, questId, episodeId, stars, correct, total, retries, recordQuestComplete, unlockCard]);

  // Android/web read the live region above (a second announcement would double-read);
  // iOS VoiceOver ignores live regions, so it gets an explicit announcement.
  const newCardId = award?.isNew ? award.cardId : undefined;
  useEffect(() => {
    if (!newCardId || Platform.OS !== 'ios') return;
    const card = cardById(newCardId);
    if (!card) return;
    AccessibilityInfo.announceForAccessibility(`New card for your library! ${card.titleEn}`);
  }, [newCardId]);

  const played = total > 0;
  const cheerMessage = resultsCheerMessage(stars, played);
  const newCard = award?.isNew ? cardById(award.cardId) : undefined;
  const showSparkles = !!newCard && stars >= 3;

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        <Hoya pose={stars >= 2 ? 'cheering' : 'thinking'} size={140} />
        <Spacer size="lg" />
        <Heading level="display">{resultsHeadline(stars, played)}</Heading>
        <Spacer size="sm" />
        <StarRow stars={stars} size={48} />
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone={stars >= 2 ? 'cheering' : 'thinking'} message={cheerMessage} />

      {/* Always mounted so assistive tech is watching it when the card appears. */}
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        {newCard ? (
          <>
            <Spacer size="lg" />
            <CardUnlockBanner
              card={newCard}
              showSparkles={showSparkles}
              reducedMotion={reducedMotion}
              onSeeCard={() => navigation.navigate('CardDetail', { cardId: newCard.id })}
            />
          </>
        ) : null}
      </View>

      <Spacer size="xl" />
      <Button
        label="Back home"
        tone="primary"
        size="hero"
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
          label="Episode page"
          tone="ghost"
          size="md"
          fullWidth
          onPress={() => navigation.navigate('EpisodeDetail', { episodeId: episode.id })}
        />
      ) : null}
      <Spacer size="lg" />
    </Screen>
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
  card,
  showSparkles,
  reducedMotion,
  onSeeCard,
}: {
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
          <Body weight="semibold">New card for your library!</Body>
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
            label="See my card"
            tone="secondary"
            size="md"
            fullWidth
            accessibilityLabel={`See my card: ${card.titleEn}`}
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
        <Heading level="title" tone="inverse">
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
