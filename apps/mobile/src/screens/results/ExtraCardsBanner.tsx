import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, Caption, Card, Spacer, radii, spacing } from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { CardArtThumb } from './CardArtThumb';

/**
 * F-STORY-006 §3.7 — the extra cards a run brought besides the quest card
 * (wireframe `design/wireframes/results/extra-cards.md`, panel D): the episode
 * it finished, "N more cards joined your Library!" and up to six thumbnails,
 * each opening its card. More than six: "and N more in your Library" (a count,
 * never a fraction). No button of its own; the page keeps its one primary.
 *
 * Same entrance as the quest card banner (translateY spring after 400 ms);
 * static with reduced motion. It renders inside the Results live region, so
 * Android and web read it as it appears; iOS gets an explicit announcement
 * from the screen.
 */
export interface ExtraCardsBannerProps {
  m: Messages['learner']['results']['extraCards'];
  /** The thumbnails to draw (already localized), at most six. */
  cards: readonly HeritageCard[];
  /** How many more joined than the row shows. */
  more: number;
  /** Total number of extra cards, shown and not. */
  total: number;
  /** The localized title of the episode this run finished, if it finished one. */
  episodeTitle: string | undefined;
  reducedMotion: boolean;
  onOpenCard: (cardId: string) => void;
}

export function ExtraCardsBanner({
  m,
  cards,
  more,
  total,
  episodeTitle,
  reducedMotion,
  onOpenCard,
}: ExtraCardsBannerProps): React.ReactElement {
  const translateY = useSharedValue(reducedMotion ? 0 : -80);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }
    translateY.value = withDelay(400, withSpring(0, { damping: 12, stiffness: 90 }));
    opacity.value = withDelay(400, withTiming(1, { duration: 250 }));
  }, [reducedMotion, translateY, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={style} testID="extra-cards-banner">
      <Card padding="md" tone="brand">
        {episodeTitle ? (
          <>
            <Body weight="bold" size="lg">
              {m.episodeDone(episodeTitle)}
            </Body>
            <Spacer size="xs" />
          </>
        ) : null}
        <Body weight="semibold">{m.title(total)}</Body>
        <Spacer size="md" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={m.seeA11y(card.titleEn)}
              onPress={() => onOpenCard(card.id)}
              style={{ borderRadius: radii.lg }}
            >
              <CardArtThumb card={card} />
            </Pressable>
          ))}
        </View>
        {more > 0 ? (
          <>
            <Spacer size="sm" />
            <Caption tone="secondary">{m.more(more)}</Caption>
          </>
        ) : null}
      </Card>
    </Animated.View>
  );
}
