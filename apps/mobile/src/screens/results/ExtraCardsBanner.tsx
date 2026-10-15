import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, Caption, Card, Spacer, borderWidth, colors, radii, spacing, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, type PressableStateCallbackType } from 'react-native';
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
 * static with reduced motion. The thumbnails take no taps until they have
 * faded in. It renders inside the Results live region, so Android and web read
 * it as it appears: a live region reads text, not the thumbnails' labels, so
 * the one sentence of §3.7 (count and every title) sits in a screen-reader-only
 * line, and the visible lines that repeat it are hidden from assistive tech.
 * iOS gets the same sentence as an explicit announcement from the screen.
 */

/** The entrance: the delay before it starts, then the fade. */
const ENTRANCE_DELAY_MS = 400;
const ENTRANCE_FADE_MS = 250;

/** Hidden from assistive tech on iOS, Android and web. */
const a11yHidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

/** Read by assistive tech, drawn nowhere (the 1 x 1 clipped box of the web sr-only pattern). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

/** react-native-web also reports keyboard focus to the style callback. */
type ThumbState = PressableStateCallbackType & { focused?: boolean };
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
  /** The sentence assistive tech reads for the banner (`extraCardsAnnouncement`, every title). */
  announcement: string;
  reducedMotion: boolean;
  onOpenCard: (cardId: string) => void;
}

export function ExtraCardsBanner({
  m,
  cards,
  more,
  total,
  episodeTitle,
  announcement,
  reducedMotion,
  onOpenCard,
}: ExtraCardsBannerProps): React.ReactElement {
  const [settled, setSettled] = useState(reducedMotion);
  const translateY = useSharedValue(reducedMotion ? 0 : -80);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      translateY.value = 0;
      opacity.value = 1;
      setSettled(true);
      return undefined;
    }
    translateY.value = withDelay(ENTRANCE_DELAY_MS, withSpring(0, { damping: 12, stiffness: 90 }));
    opacity.value = withDelay(ENTRANCE_DELAY_MS, withTiming(1, { duration: ENTRANCE_FADE_MS }));
    const timer = setTimeout(() => setSettled(true), ENTRANCE_DELAY_MS + ENTRANCE_FADE_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion, translateY, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View style={style} pointerEvents={settled ? 'auto' : 'none'} testID="extra-cards-banner">
      <Card padding="md" tone="brand">
        <Text {...KOREAN_LINE_BREAK} style={srOnly}>{announcement}</Text>
        <View {...a11yHidden}>
          {episodeTitle ? (
            <>
              <Body weight="bold" size="lg">
                {m.episodeDone(episodeTitle)}
              </Body>
              <Spacer size="xs" />
            </>
          ) : null}
          <Body weight="semibold">{m.title(total)}</Body>
        </View>
        <Spacer size="md" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={m.seeA11y(card.titleEn)}
              onPress={() => onOpenCard(card.id)}
              // The ring shows keyboard focus and a press; at rest it takes the banner's own colour.
              style={({ pressed, focused }: ThumbState) => ({
                borderRadius: radii.lg,
                borderWidth: borderWidth.base,
                borderColor: pressed || focused ? colors.border.focus : colors.brand.primaryLight,
              })}
            >
              <CardArtThumb card={card} />
            </Pressable>
          ))}
        </View>
        {more > 0 ? (
          <View {...a11yHidden}>
            <Spacer size="sm" />
            <Caption tone="secondary">{m.more(more)}</Caption>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}
