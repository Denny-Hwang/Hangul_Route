import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, Button, Caption, Card, Heading, Spacer, colors, spacing } from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { cardKoLine } from '../../logic/card-art';
import { CardArtThumb } from './CardArtThumb';

type ResultsMessages = Messages['learner']['results'];

/**
 * Moved out of `ResultsScreen.tsx` unchanged in row GU-3 (AMENDMENTS-GUEST-FIRST-LESSON section 7.1), so the learner's
 * Results and the guest's Results draw the same card celebration.
 */
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
export function CardUnlockBanner({
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
              {cardKoLine(card) ? (
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
