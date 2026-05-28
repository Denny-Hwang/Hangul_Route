import {
  Body,
  Button,
  Card,
  Heading,
  Hoya,
  HoyaBubble,
  Screen,
  Spacer,
  StarRow,
  colors,
  spacing,
} from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
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
import { episodeById, questById } from '../../content';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export function ResultsScreen({ route, navigation }: Props): React.ReactElement {
  const { questId, episodeId, stars, correct, total } = route.params;
  const quest = questById(questId);
  const episode = episodeById(episodeId);
  const profile = useProfileStore(activeProfileSelector);
  const recordQuestComplete = useProgressStore((s) => s.recordQuestComplete);
  const unlockCard = useProgressStore((s) => s.unlockCard);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!profile || !quest) return;
    recordQuestComplete(profile.id, {
      questId,
      episodeId,
      stars,
      accuracy: total > 0 ? correct / total : 0,
      attempts: 1,
    });
    void track({
      name: 'quest.complete',
      profileId: profile.id,
      payload: { questId, episodeId, stars, correct, total },
    });
    if (quest.rewardCardId) {
      const wasFirstCard =
        (useProgressStore.getState().byProfile[profile.id]?.cards.length ?? 0) === 0;
      unlockCard(profile.id, quest.rewardCardId);
      void track({
        name: 'card.unlocked',
        profileId: profile.id,
        payload: { cardId: quest.rewardCardId, questId },
      });
      if (wasFirstCard) {
        void track({
          name: 'card.first_earned',
          profileId: profile.id,
          payload: { cardId: quest.rewardCardId },
        });
      }
    }
  }, [profile, quest, questId, episodeId, stars, correct, total, recordQuestComplete, unlockCard]);

  const cheerMessage = useMemo(() => {
    if (stars === 3) return 'Perfect! You got every one!';
    if (stars === 2) return 'Nice work! Try one more for three stars.';
    if (stars === 1) return 'Good start. Want to play it again?';
    return 'Brave try! Let&apos;s do it together.';
  }, [stars]);

  const showCardUnlock = !!quest?.rewardCardId && stars >= 2;
  const showSparkles = !!quest?.rewardCardId && stars >= 3;

  return (
    <Screen tone="canvas">
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
        <Hoya pose={stars >= 2 ? 'cheering' : 'thinking'} size={140} />
        <Spacer size="lg" />
        <Heading level="display">{stars === 3 ? 'Wonderful!' : stars >= 2 ? 'Great!' : 'You tried!'}</Heading>
        <Spacer size="sm" />
        <StarRow stars={stars} size={48} />
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone={stars >= 2 ? 'cheering' : 'thinking'} message={cheerMessage} />

      {showCardUnlock ? (
        <>
          <Spacer size="lg" />
          <CardUnlockBanner showSparkles={showSparkles} reducedMotion={reducedMotion} />
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Button
        label="Back to journey"
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
 * F-MOTION-003 — Card unlock celebration.
 *
 * On mount, the banner drops in from -80px translateY with a spring (delayed
 * 400ms after screen mount so stars + Hoya bubble register first). On 3-star
 * results, 5 amber sparkles also fade in around the banner, then fade out
 * over ~600ms.
 */
function CardUnlockBanner({
  showSparkles,
  reducedMotion,
}: {
  showSparkles: boolean;
  reducedMotion: boolean;
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
          <Body weight="semibold">Card added to your library!</Body>
          <Body tone="secondary" size="sm">
            Visit Library to see all your cards.
          </Body>
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
