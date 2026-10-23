import type { HeritageCard } from '@hangul-route/content-schema';
import { Body, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View, type PressableStateCallbackType } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { CardArtThumb } from '../results/CardArtThumb';

/** react-native-web also reports keyboard focus to the style callback. */
type TileState = PressableStateCallbackType & { focused?: boolean };

/**
 * The stage cards of the ceremony (B) and the summary (G): each a button into its card page, read "Open card: <title>",
 * as the Stage 1 ceremony draws its cards. Nothing when there are none (the stage card content is row CM-23's).
 */
export function StageCards({ cards, onOpen, testID }: { cards: readonly HeritageCard[]; onOpen: (card: HeritageCard) => void; testID: string }): React.ReactElement | null {
  const messages = useMessages();
  if (cards.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} testID={testID}>
      {cards.map((card) => (
        <Pressable
          key={card.id}
          accessibilityRole="button"
          accessibilityLabel={messages.learner.results.extraCards.seeA11y(card.titleEn)}
          onPress={() => onOpen(card)}
          style={({ pressed, focused }: TileState) => ({
            alignItems: 'center',
            gap: spacing.xs,
            padding: spacing.xs,
            borderRadius: radii.lg,
            borderWidth: borderWidth.base,
            borderColor: pressed || focused ? colors.border.focus : colors.border.subtle,
            backgroundColor: colors.surface.paper,
          })}
        >
          <CardArtThumb card={card} />
          <View style={{ maxWidth: touchTarget.hero }} aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Body size="sm" weight="semibold" align="center">
              {card.titleEn}
            </Body>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
