import type { HeritageCard } from '@hangul-route/content-schema';
import { borderWidth, colors, radii, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { CardArt } from '../../components/CardArt';

/** The art is decorative (hidden from screen readers), so a target size is just the nearest token: 96. */
export const CARD_THUMB = touchTarget.hero;

/**
 * A card's face (`CardArt`) in its rarity frame. Shared by the quest card
 * banner and the extra-cards banner on Results (F-MOTION-003, F-STORY-006 §3.7, §3.8).
 */
export function CardArtThumb({ card }: { card: HeritageCard }): React.ReactElement {
  return (
    <CardArt
      card={card}
      size={CARD_THUMB}
      style={{ borderRadius: radii.lg, borderWidth: borderWidth.thick, borderColor: colors.rarity[card.rarity] }}
    />
  );
}
