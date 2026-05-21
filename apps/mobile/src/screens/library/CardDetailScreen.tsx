import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  HeritageCardArt,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  motion,
  radii,
  spacing,
  supportedCardIds,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cardById } from '../../content';
import { speak } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

type CardFace = 'front' | 'back';

export function CardDetailScreen({ route, navigation }: Props): React.ReactElement {
  const card = cardById(route.params.cardId);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const unlocked = snap?.cards.some((c) => c.cardId === route.params.cardId) ?? false;
  const [face, setFace] = useState<CardFace>('front');
  const reducedMotion = useReducedMotion();

  // F-MOTION-002 rotateY flip animation.
  // `progress` runs 0 (flat showing current face) → 1 (edge-on at 90°, content swaps) → 0 (flat showing new face).
  const progress = useSharedValue(0);
  const flippingRef = useRef(false);

  const swapFace = (next: CardFace): void => {
    setFace(next);
  };

  const flipAnimatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 1], [0, 90]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${deg}deg` }],
    };
  });

  if (!card) {
    return (
      <Screen>
        <Body>Card not found.</Body>
      </Screen>
    );
  }

  const rarityTone =
    card.rarity === 'legendary'
      ? 'nudge'
      : card.rarity === 'rare'
        ? 'info'
        : card.rarity === 'uncommon'
          ? 'success'
          : 'neutral';

  const canFlip = unlocked;
  const toggleFace = (): void => {
    if (!canFlip) return;
    if (flippingRef.current) return; // ignore taps mid-flip (F-MOTION-002 §3.3)
    const next: CardFace = face === 'front' ? 'back' : 'front';
    if (reducedMotion) {
      // Reduced-motion path: instant swap, no rotation (F-MOTION-002 §3.2)
      setFace(next);
      return;
    }
    flippingRef.current = true;
    const legMs = motion.duration.base; // 200ms each leg → ~400ms total
    progress.value = withTiming(
      1,
      { duration: legMs, easing: Easing.bezier(0.2, 0, 0, 1) },
      () => {
        // Midpoint — card is edge-on. Swap content, then rotate back.
        runOnJS(swapFace)(next);
        progress.value = withTiming(
          0,
          { duration: legMs, easing: Easing.bezier(0.2, 0, 0, 1) },
          () => {
            runOnJS(setFlipping)(false);
          },
        );
      },
    );
  };

  function setFlipping(value: boolean): void {
    flippingRef.current = value;
  }

  return (
    <Screen tone="canvas">
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={spacing.md}
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name="close" size={28} />
      </Pressable>
      <Spacer size="lg" />

      <Pressable
        onPress={toggleFace}
        disabled={!canFlip}
        accessibilityRole="button"
        accessibilityLabel={
          canFlip ? `Tap to flip card to ${face === 'front' ? 'back' : 'front'}` : 'Locked card'
        }
      >
        <Animated.View style={flipAnimatedStyle}>
          <Card
            padding="lg"
            tone="paper"
            style={{ borderWidth: 4, borderColor: colors.rarity[card.rarity], borderRadius: radii.xl }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Pill tone={rarityTone} label={card.rarity} />
              {canFlip ? (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xxs,
                    backgroundColor: colors.surface.sunken,
                    borderRadius: radii.pill,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xxs,
                  }}
                >
                  <Icon name="replay" size={14} color={colors.text.muted} />
                  <Caption tone="muted">
                    {face === 'front' ? 'tap to flip' : 'tap to flip back'}
                  </Caption>
                </View>
              ) : null}
            </View>

            <Spacer size="md" />

            {face === 'front' ? (
              <FrontFaceBody card={card} unlocked={unlocked} />
            ) : (
              <BackFaceBody card={card} />
            )}
          </Card>
        </Animated.View>
      </Pressable>

      {/* The blurb + fact card is shown only on the front face (the back face
          already contains this content). Keeps the back face from duplicating. */}
      {face === 'front' && unlocked ? (
        <>
          <Spacer size="lg" />
          <Card padding="md">
            <Body size="lg">{card.blurbEn}</Body>
            {card.factEn ? (
              <>
                <Spacer size="sm" />
                <Body tone="secondary" size="sm">
                  💡 {card.factEn}
                </Body>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {card.subtitleKo && unlocked ? (
        <>
          <Spacer size="lg" />
          <Button
            label="Hear it"
            tone="secondary"
            size="lg"
            onPress={() => speak(card.subtitleKo ?? '', { language: 'ko-KR' })}
          />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}

function FrontFaceBody({
  card,
  unlocked,
}: {
  card: HeritageCard;
  unlocked: boolean;
}): React.ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 200,
          height: 200,
          borderRadius: radii.xxl,
          backgroundColor: unlocked
            ? supportedCardIds.includes(card.id)
              ? colors.surface.paper
              : colors.theme[card.theme]
            : colors.surface.sunken,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: unlocked ? (supportedCardIds.includes(card.id) ? 1 : 0.85) : 0.4,
          overflow: 'hidden',
        }}
      >
        {unlocked ? (
          supportedCardIds.includes(card.id) ? (
            <HeritageCardArt cardId={card.id} size={200} />
          ) : (
            <Text style={{ fontSize: 80, fontWeight: '800', color: colors.text.inverse }}>
              {card.subtitleKo ?? card.titleEn.charAt(0)}
            </Text>
          )
        ) : (
          <Icon name="lock" size={80} color={colors.text.muted} />
        )}
      </View>
      <Spacer size="lg" />
      <Heading level="display" align="center">
        {card.titleEn}
      </Heading>
      {card.subtitleKo ? (
        <>
          <Spacer size="xs" />
          <Heading level="title" tone="brand">
            {card.subtitleKo}
          </Heading>
        </>
      ) : null}
      {card.romanization ? (
        <Caption tone="secondary" style={{ fontStyle: 'italic' }}>
          {card.romanization}
        </Caption>
      ) : null}
    </View>
  );
}

function BackFaceBody({ card }: { card: HeritageCard }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
      {/* Top 40% — Korean prominent + romanization */}
      {card.subtitleKo ? (
        <Heading level="display" tone="brand" align="center" weight="bold">
          {card.subtitleKo}
        </Heading>
      ) : null}
      {card.romanization ? (
        <>
          <Spacer size="xs" />
          <Body tone="muted" size="sm" align="center" style={{ fontStyle: 'italic' }}>
            {card.romanization}
          </Body>
        </>
      ) : null}

      <Spacer size="lg" />

      {/* Middle 30% — English title + blurb */}
      <Heading level="title" align="center">
        {card.titleEn}
      </Heading>
      <Spacer size="sm" />
      <Body size="md" align="center">
        {card.blurbEn}
      </Body>

      {/* Bottom 30% — fun fact with 💡 */}
      {card.factEn ? (
        <>
          <Spacer size="lg" />
          <View
            style={{
              backgroundColor: colors.surface.sunken,
              borderRadius: radii.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              alignSelf: 'stretch',
            }}
          >
            <Body tone="secondary" size="sm" align="center" style={{ fontStyle: 'italic' }}>
              💡 {card.factEn}
            </Body>
          </View>
        </>
      ) : null}
    </View>
  );
}
