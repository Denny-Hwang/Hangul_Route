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
import { useMessages } from '../i18n/use-messages';
import {
  pictureName,
  pictureTile,
  resolvePicture,
  resolvePictureArt,
  silhouetteOf,
  swatchColors,
  type PictureContext,
  type PictureTileMetrics,
} from '../logic/picture-ref';

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
 * `mono` draws a word not collected yet (the Words word wall, F-VOC-003
 * §3.4): a WordArt picture in silhouette on the sunken tile, anything else a
 * plain sunken tile (card art has no silhouette; a swatch or a text tile would
 * give the word away). It is always hidden from assistive technology: the
 * wall tile carries the name ("Not collected yet").
 * All art is SVG from the design system (D7); this adds none.
 * Shared (moved here from `screens/minigames/` for the lecture presenter's reading slides,
 * AMENDMENTS-LECTURE-V2 section 5.1, as `StrokeHint` was): `tile` draws the same neutral tile in
 * another scale, the presenter's stage units, so its border and corner read on a projector.
 * Design: design/wireframes/quest/discover.md (S5 picture options, S6 Pic-Word Match),
 * design/components/WordArt/spec.md (the caller's tile), design/screens/presenter/slide-sentence.md.
 */

/** What the art can draw: shared by every screen that asks whether a ref has a picture. */
export const PICTURE_CONTEXT: PictureContext = {
  supportedCardIds,
  swatches: swatchColors(colors),
  wordArtKeys: WORD_ART_KEYS,
};

/** The neutral tile's padding, border and corner radius, each in the caller's scale. */
export interface PictureArtTile {
  padding: number;
  border: number;
  radius: number;
}

/** The learner screens' tile, in dp. */
const LEARNER_TILE: PictureArtTile = { padding: spacing.xs, border: borderWidth.thin, radius: radii.lg };

/** Padding and border of the neutral art tile, per side, and the smallest art (the tested minimum). */
const metricsOf = (tile: PictureArtTile): PictureTileMetrics => ({ inset: tile.padding + tile.border, minArt: spacing.xxxl });

export interface PictureArtProps {
  /** `card:<id>`, `word:<key>` or `swatch:<token>`; absent shows the gloss. */
  pictureRef?: string;
  /** English gloss: the text fallback and the accessible name of the picture. */
  gloss: string;
  /** Side of the square, in dp. */
  size: number;
  /** Hidden from assistive technology: the same card already names the word in a KoreanText line. */
  decorative?: boolean;
  /** A word not collected yet: the silhouette (or a plain tile), hidden from assistive technology. */
  mono?: boolean;
  /** The tile in another scale (the presenter's stage units); the learner screens' dp tile when absent. */
  tile?: PictureArtTile;
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

function ArtTile({
  size,
  tile,
  decorative,
  sunken = false,
  testID,
  children,
}: {
  size: number;
  tile: PictureArtTile;
  decorative: boolean;
  /** The silhouette's tile (`mono`). */
  sunken?: boolean;
  testID?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View
      testID={testID}
      {...hiddenProps(decorative)}
      style={{
        width: size,
        height: size,
        padding: tile.padding,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tile.radius,
        borderWidth: tile.border,
        borderColor: colors.border.subtle,
        backgroundColor: sunken ? colors.surface.sunken : colors.surface.paper,
      }}
    >
      {children}
    </View>
  );
}

export function PictureArt({ pictureRef, gloss, size, decorative = false, mono = false, tile: tileStyle = LEARNER_TILE, testID }: PictureArtProps): React.ReactElement {
  const m = useMessages();
  const picture = resolvePictureArt(pictureRef, gloss, PICTURE_CONTEXT);
  const name = pictureName(gloss, m.a11y.minigame.picture);
  const tile = pictureTile(size, metricsOf(tileStyle));

  if (mono) {
    // Resolved without the gloss: a silhouette never shows or needs the word's meaning.
    const silhouette = silhouetteOf(resolvePicture(pictureRef, PICTURE_CONTEXT));
    return (
      <ArtTile size={tile.tile} tile={tileStyle} decorative sunken testID={testID}>
        {silhouette.kind === 'word' ? <WordArt artKey={silhouette.key} size={tile.art} mono decorative /> : null}
      </ArtTile>
    );
  }

  if (picture.kind === 'card') {
    return (
      <ArtTile size={tile.tile} tile={tileStyle} decorative={decorative}>
        <HeritageCardArt cardId={picture.cardId} size={tile.art} testID={testID} accessibilityLabel={name} />
      </ArtTile>
    );
  }

  if (picture.kind === 'word') {
    return (
      <ArtTile size={tile.tile} tile={tileStyle} decorative={decorative}>
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
          borderRadius: tileStyle.radius,
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
        borderRadius: tileStyle.radius,
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Body align="center" weight="medium">
        {name}
      </Body>
    </View>
  );
}
