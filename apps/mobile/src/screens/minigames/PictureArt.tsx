import {
  Body,
  HeritageCardArt,
  WORD_ART_KEYS,
  WordArt,
  borderWidth,
  colors,
  radii,
  spacing,
  supportedCardIds,
} from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { resolvePictureArt, swatchColors, type PictureContext } from '../../logic/picture-ref';

/**
 * PictureArt — the one place that turns a `PictureRef` into art for every game
 * (F-QUEST-002 §3.11): `card:<id>` is heritage card art, `word:<key>` a
 * WordArt picture (F-VOC-002 §3.7, W-7), `swatch:<token>` a colour chip. An
 * unresolved or absent ref, or a word picture with a blank gloss, shows the
 * gloss in a plain tile. Never a blank tile.
 * Card art and WordArt sit in the same neutral tile (`surface.paper`,
 * `border.subtle`, same padding), so a style difference between the two never
 * identifies an answer when both appear in one question (F-VOC-002 §3.11).
 * All art is SVG from the design system (D7); this adds none.
 * Design: design/wireframes/quest/discover.md (S5 picture options, S6 Pic-Word Match),
 * design/components/WordArt/spec.md (the caller's tile).
 */

/** What the art can draw: shared by every screen that asks whether a ref has a picture. */
export const PICTURE_CONTEXT: PictureContext = {
  supportedCardIds,
  swatches: swatchColors(colors),
  wordArtKeys: WORD_ART_KEYS,
};

/** Padding and border of the neutral art tile, per side. */
const TILE_INSET = spacing.xs + borderWidth.thin;

export interface PictureArtProps {
  /** `card:<id>`, `word:<key>` or `swatch:<token>`; absent shows the gloss. */
  pictureRef?: string;
  /** English gloss: the text fallback and the accessible name of the picture. */
  gloss: string;
  /** Side of the square, in dp. */
  size: number;
  testID?: string;
}

function ArtTile({ size, children }: { size: number; children: React.ReactNode }): React.ReactElement {
  return (
    <View
      style={{
        width: size,
        height: size,
        padding: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.lg,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.paper,
      }}
    >
      {children}
    </View>
  );
}

export function PictureArt({ pictureRef, gloss, size, testID }: PictureArtProps): React.ReactElement {
  const picture = resolvePictureArt(pictureRef, gloss, PICTURE_CONTEXT);
  const artSize = Math.max(size - 2 * TILE_INSET, 0);

  if (picture.kind === 'card') {
    return (
      <ArtTile size={size}>
        <HeritageCardArt cardId={picture.cardId} size={artSize} testID={testID} accessibilityLabel={gloss} />
      </ArtTile>
    );
  }

  if (picture.kind === 'word') {
    return (
      <ArtTile size={size}>
        <WordArt artKey={picture.key} size={artSize} testID={testID} accessibilityLabel={gloss} />
      </ArtTile>
    );
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
