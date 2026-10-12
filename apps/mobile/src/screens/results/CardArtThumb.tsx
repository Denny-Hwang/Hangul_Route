import type { HeritageCard } from '@hangul-route/content-schema';
import {
  Heading,
  HeritageCardArt,
  borderWidth,
  colors,
  radii,
  supportedCardIds,
  touchTarget,
} from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';

/** The art is decorative (hidden from screen readers), so a target size is just the nearest token: 96. */
export const CARD_THUMB = touchTarget.hero;

/**
 * A card's art in its rarity frame, or its Korean word on the theme tint when
 * no art ships yet. Shared by the quest card banner and the extra-cards banner
 * on Results (F-MOTION-003, F-STORY-006 §3.7).
 */
export function CardArtThumb({ card }: { card: HeritageCard }): React.ReactElement {
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
        <Heading level="title">{card.subtitleKo ?? card.titleEn.charAt(0)}</Heading>
      )}
    </View>
  );
}
