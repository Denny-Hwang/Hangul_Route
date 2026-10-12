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
import { useMessages } from '../../i18n/use-messages';
import { pictureName, pictureTile, resolvePictureArt, swatchColors, type PictureContext, type PictureTileMetrics } from '../../logic/picture-ref';

/**
 * PictureArt — the one place that turns a `PictureRef` into art for every game
 * (F-QUEST-002 §3.11): `card:<id>` is heritage card art, `word:<key>` a
 * WordArt picture (F-VOC-002 §3.7, W-7), `swatch:<token>` a colour chip. An
 * unresolved or absent ref, or a word picture with a blank gloss, shows the
 * gloss in a plain tile, or the localized "Picture" when the gloss is blank.
 * Never a blank tile.
 * Card art and WordArt sit in the same neutral tile (`surface.paper`,
 * `border.subtle`, same padding), so a style difference between the two never
 * identifies an answer when both appear in one question (F-VOC-002 §3.11).
 * The art inside it is never drawn below 48 dp (F-VOC-002 §3.7): at a smaller
 * requested side the tile grows outward (`pictureTile`).
 * `decorative` hides the picture from assistive technology when the same card
 * already names it in a KoreanText line (F-VOC-002 §3.7).
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

/** Padding and border of the neutral art tile, per side, and the smallest art (the tested minimum). */
const TILE: PictureTileMetrics = { inset: spacing.xs + borderWidth.thin, minArt: spacing.xxxl };

export interface PictureArtProps {
  /** `card:<id>`, `word:<key>` or `swatch:<token>`; absent shows the gloss. */
  pictureRef?: string;
  /** English gloss: the text fallback and the accessible name of the picture. */
  gloss: string;
  /** Side of the square, in dp. */
  size: number;
  /** Hidden from assistive technology: the same card already names the word in a KoreanText line. */
  decorative?: boolean;
  testID?: string;
}

/** Props that hide a view and everything in it on the web (`aria-hidden`), iOS and Android. */
function hiddenProps(decorative: boolean): {
  'aria-hidden'?: true;
  accessibilityElementsHidden?: true;
  importantForAccessibility?: 'no-hide-descendants';
} {
  return decorative ? { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } : {};
}

function ArtTile({ size, decorative, children }: { size: number; decorative: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <View
      {...hiddenProps(decorative)}
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

export function PictureArt({ pictureRef, gloss, size, decorative = false, testID }: PictureArtProps): React.ReactElement {
  const m = useMessages();
  const picture = resolvePictureArt(pictureRef, gloss, PICTURE_CONTEXT);
  const name = pictureName(gloss, m.a11y.minigame.picture);
  const tile = pictureTile(size, TILE);

  if (picture.kind === 'card') {
    return (
      <ArtTile size={tile.tile} decorative={decorative}>
        <HeritageCardArt cardId={picture.cardId} size={tile.art} testID={testID} accessibilityLabel={name} />
      </ArtTile>
    );
  }

  if (picture.kind === 'word') {
    return (
      <ArtTile size={tile.tile} decorative={decorative}>
        {decorative ? (
          <WordArt artKey={picture.key} size={tile.art} testID={testID} decorative />
        ) : (
          <WordArt artKey={picture.key} size={tile.art} testID={testID} accessibilityLabel={name} />
        )}
      </ArtTile>
    );
  }

  if (picture.kind === 'swatch') {
    return (
      <View
        testID={testID}
        accessible={!decorative}
        accessibilityRole={decorative ? undefined : 'image'}
        accessibilityLabel={decorative ? undefined : name}
        {...hiddenProps(decorative)}
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
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : name}
      {...hiddenProps(decorative)}
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
        {name}
      </Body>
    </View>
  );
}
