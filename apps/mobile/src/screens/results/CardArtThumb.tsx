import type { HeritageCard } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { CardArt } from '../../components/CardArt';

/** The art is decorative (hidden from screen readers), so a target size is just the nearest token: 96. */
export const CARD_THUMB = touchTarget.hero;

/**
 * The face inside the rarity frame. The frame is a wrapper of its own, so the
 * face's square (where the cover crop and the collection plate lay out) is
 * never shrunk by the border.
 */
const CARD_THUMB_FACE = CARD_THUMB - 2 * borderWidth.thick;

/**
 * A card's face (`CardArt`) in its rarity frame. Shared by the quest card
 * banner and the extra-cards banner on Results (F-MOTION-003, F-STORY-006 §3.7, §3.8).
 */
export function CardArtThumb({ card }: { card: HeritageCard }): React.ReactElement {
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
        overflow: 'hidden',
      }}
    >
      <CardArt card={card} size={CARD_THUMB_FACE} style={{ borderRadius: radii.lg - borderWidth.thick }} />
    </View>
  );
}
