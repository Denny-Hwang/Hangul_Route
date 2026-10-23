import { Body, Button, Caption, Heading, Hoya, HoyaBubble, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useMessages } from '../../i18n/use-messages';
import { ceremonyMotion, stageCardOpenedEvent } from '../../logic/reviews/stage-check-offer';
import { PRIZE_STAGES, stageNumber } from '../../logic/stage1/stage-complete';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { CeremonySparkles } from '../results/CardUnlockBanner';
import { StageCards } from './StageCards';
import { useStageOffer } from './use-stage-offer';

/**
 * The Stages 2-7 ceremony (F-CURR-002 section 7.3, row CM-22; design/wireframes/reviews/stage-check.md B, mock
 * design/screens/stage-check/). Opened from Results on the run that finished the stage, and again from the Journey
 * stage header (never automatically a second time). Hoya cheering, "Stage N complete!", the stage card when one exists
 * (row CM-23's content; behind `upperCards`), one primary Take the Stage Check (offered, never required, OD-1) and See
 * my cards and Back home. The title and the card drop in with the F-MOTION-003 spring and sparkles; reduced motion
 * shows them at once. Opening the page, or the card, sends `stage.card_opened { stage }`. It writes nothing else: the
 * stage latch, the cards and `stageCeremonyAt` were written with the Results score. No Premium pill, no price.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'StageComplete'>;

export function UpperStageCompleteScreen({ route, navigation }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner;
  const { stageKey } = route.params;
  const profileId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const reducedMotion = useReducedMotion();
  const { complete, offer, cards } = useStageOffer(profileId, stageKey);
  const ready = PRIZE_STAGES[stageKey]?.ceremony === 'stage' && complete && offer.prize;
  const motion = ceremonyMotion(reducedMotion);

  // `stage.card_opened` once per visit of the stage page (goal G5).
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current || profileId === null) return;
    sent.current = true;
    const event = stageCardOpenedEvent(profileId, stageKey);
    if (event) void track(event);
  }, [ready, profileId, stageKey]);

  const drop = useSharedValue(motion.drop ? -spacing.jumbo : 0);
  const shown = useSharedValue(motion.drop ? 0 : 1);
  const sparkle = useSharedValue(0);
  useEffect(() => {
    if (!ready || !motion.drop) {
      drop.value = 0;
      shown.value = 1;
      return;
    }
    drop.value = withDelay(motion.delayMs, withSpring(0, { damping: 12, stiffness: 90 }));
    shown.value = withDelay(motion.delayMs, withTiming(1, { duration: 250 }));
    if (motion.sparkles) sparkle.value = withDelay(motion.delayMs + 500, withSequence(withTiming(0.9, { duration: 200 }), withTiming(0.9, { duration: 200 }), withTiming(0, { duration: 400 })));
  }, [ready, motion.drop, motion.delayMs, motion.sparkles, drop, shown, sparkle]);
  const dropStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: drop.value }] }));
  const sparkleStyle = useAnimatedStyle(() => ({ opacity: sparkle.value }));

  const goHome = (): void => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  const seeCards = (): void => navigation.navigate('Main', { screen: 'Library', params: { section: 'cards' } });

  if (!ready) {
    return (
      <Screen tone="canvas" scrollable>
        <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="upper-stage-complete-not-ready">
          <Hoya pose="thinking" size={120} accessibilityLabel={messages.a11y.hoya('thinking')} />
          <Spacer size="lg" />
          <Body align="center">{m.stageComplete.notFound}</Body>
          <Spacer size="xl" />
          <Button label={m.stageComplete.backHome.cta} tone="primary" size="hero" fullWidth onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const n = stageNumber(stageKey);
  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xxl }} testID="upper-stage-complete">
        <Hoya pose="cheering" size={140} accessibilityLabel={messages.a11y.hoya('cheering')} />
        <Spacer size="lg" />
        <View>
          <Animated.View style={dropStyle} testID="upper-stage-complete-title">
            <Heading level="display" align="center">
              {m.upperStageComplete.title(n)}
            </Heading>
          </Animated.View>
          {motion.sparkles ? (
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -spacing.md, left: -spacing.sm, right: -spacing.sm, bottom: -spacing.md }, sparkleStyle]}>
              <CeremonySparkles />
            </Animated.View>
          ) : null}
        </View>
      </View>
      <Spacer size="lg" />
      <HoyaBubble tone="cheering" message={m.upperStageComplete.cheer} />

      {cards.length > 0 ? (
        <>
          <Spacer size="xl" />
          <Heading level="title">{m.upperStageComplete.cardTitle}</Heading>
          <Spacer size="sm" />
          <Animated.View style={dropStyle}>
            <StageCards
              cards={cards}
              testID="upper-stage-complete-cards"
              onOpen={(card) => {
                const event = profileId === null ? null : stageCardOpenedEvent(profileId, stageKey);
                if (event) void track(event);
                navigation.navigate('CardDetail', { cardId: card.id });
              }}
            />
          </Animated.View>
        </>
      ) : null}

      <Spacer size="xl" />
      <View style={{ gap: spacing.sm }}>
        {offer.check !== null ? (
          <View>
            <Button
              label={m.stageCheck.offer.cta}
              tone="primary"
              size="hero"
              fullWidth
              testID="upper-stage-complete-check"
              onPress={() => navigation.navigate('StageCheck', { stageKey })}
            />
            <Spacer size="xs" />
            <Caption tone="secondary" align="center">
              {m.stageCheck.offer.body}
            </Caption>
          </View>
        ) : null}
        <Button
          label={m.stageComplete.seeCards.cta}
          tone={offer.check !== null ? 'ghost' : 'primary'}
          size={offer.check !== null ? 'md' : 'hero'}
          fullWidth
          testID="upper-stage-complete-cards-cta"
          onPress={seeCards}
        />
        <Button label={m.stageComplete.backHome.cta} tone="ghost" size="md" fullWidth testID="upper-stage-complete-home" onPress={goHome} />
      </View>
      <Spacer size="lg" />
    </Screen>
  );
}
