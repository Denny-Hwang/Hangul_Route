import { Body, HeritageCardArt, borderWidth, colors, radii, spacing, supportedCardIds } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { resolvePicture, swatchColors } from '../../logic/picture-ref';

/**
 * PictureArt — the one place that turns a `PictureRef` into art for every game
 * (F-QUEST-002 §3.11): `card:<id>` is heritage card art, `swatch:<token>` a
 * colour chip, `word:<id>` waits for WordArt (F-VOC) and, like any unresolved
 * or absent ref, shows the gloss in a plain tile. Never a blank tile.
 * All art is SVG from the design system (D7); this adds none.
 * Design: design/wireframes/quest/discover.md (S5 picture options, S6 Pic-Word Match).
 */
const SWATCHES = swatchColors(colors);

export interface PictureArtProps {
  /** `card:<id>`, `word:<id>` or `swatch:<token>`; absent shows the gloss. */
  pictureRef?: string;
  /** English gloss: the text fallback and the accessible name of the picture. */
  gloss: string;
  /** Side of the square, in dp. */
  size: number;
  testID?: string;
}

export function PictureArt({ pictureRef, gloss, size, testID }: PictureArtProps): React.ReactElement {
  const picture = resolvePicture(pictureRef, { supportedCardIds, swatches: SWATCHES });

  if (picture.kind === 'card') {
    return <HeritageCardArt cardId={picture.cardId} size={size} testID={testID} accessibilityLabel={gloss} />;
  }

  if (picture.kind === 'swatch') {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={gloss}
        style={{
          width: size,
          height: size,
          borderRadius: radii.lg,
          borderWidth: borderWidth.base,
          borderColor: colors.surface.sunken,
          backgroundColor: picture.color,
        }}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={gloss}
      style={{
        width: size,
        height: size,
        padding: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.lg,
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Body align="center" weight="medium">
        {gloss}
      </Body>
    </View>
  );
}
