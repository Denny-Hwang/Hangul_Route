import type { HeritageCard } from '@hangul-route/content-schema';
import {
  HeritageCardArt,
  KOREAN_LANGUAGE,
  StoryScene,
  borderWidth,
  colors,
  radii,
  supportedCardIds,
  typography,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { awardWorld } from '../content/award-world';
import { storyById } from '../content/stories';
import { cardArtSource, cardCoverCrop, cardPlateLayout, cardWordFontSize, type CardArtDeps } from '../logic/card-art';
import { storyCoverArt } from '../logic/story/scene-view';
import { storyCoverVariant } from '../logic/story/story-tile';

/**
 * What a screen may set on the face: corner radius and placement only. A
 * border or padding would shrink the content box that the cover crop and the
 * plate lay out in, so a frame goes on a wrapper around the face
 * (see `CardArtThumb`), never on the face itself.
 */
export type CardArtStyle = Pick<ViewStyle, 'borderRadius' | 'position' | 'top' | 'left'>;

const DEPS: CardArtDeps = {
  drawnCardIds: supportedCardIds,
  storyCover: (storyId) => {
    const story = storyById(storyId);
    return story ? storyCoverArt(story) : null;
  },
  world: awardWorld,
};

// Speech language for the Korean word; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

function CardWord({ word, size, fontFamily }: { word: string; size: number; fontFamily?: string }): React.ReactElement {
  const fontSize = cardWordFontSize(size, word, typography.size.caption);
  return (
    <Text {...KOREAN_LINE_BREAK}
      {...koreanSpeech}
      numberOfLines={1}
      maxFontSizeMultiplier={1}
      // Native only: a long word shrinks to fit rather than being cut (the full word is printed beside the face).
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      style={{
        fontFamily: fontFamily ?? typography.family.sansKr,
        fontSize,
        lineHeight: fontSize * typography.leading.tight,
        fontWeight: typography.weight.bold,
        color: colors.text.primary,
        textAlign: 'center',
      }}
    >
      {word}
    </Text>
  );
}

/**
 * A card's face in a `size` square (F-STORY-006 §3.8 Art, D7): the heritage
 * drawing, a story card's cover scene cropped to a square, a set card's
 * collection plate, or the Korean word on the theme tint. Which one is decided
 * by `logic/card-art.ts`, so screens never test `supportedCardIds` themselves.
 * With `accessibilityLabel` the face is a named image (on the web an `img`
 * with that name); it is never its own focus stop, because every labelled call
 * site sits inside a button that already names the card (the Library tile,
 * the card page's flip button), and a nested focusable view would add a second
 * TalkBack stop. Without a label it is hidden from assistive technology.
 * Design: design/components/CardArt/spec.md.
 */
export function CardArt({
  card,
  size,
  accessibilityLabel,
  style,
  testID,
  wordFontFamily,
}: {
  card: HeritageCard;
  size: number;
  accessibilityLabel?: string;
  /** Corner radius and placement from the screen; size, background and clipping always stay the face's own. */
  style?: CardArtStyle;
  testID?: string;
  /** The Korean word face's font family (the presenter's taught-Korean font); the system Korean stack when absent. */
  wordFontFamily?: string;
}): React.ReactElement {
  const source = useMemo(() => cardArtSource(card, DEPS), [card]);
  const labelled = accessibilityLabel !== undefined;
  const background =
    source.kind === 'heritage' ? colors.surface.paper : source.kind === 'plate' ? colors.surface.sunken : colors.theme[source.theme];
  return (
    <View
      testID={testID}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? undefined : 'no-hide-descendants'}
      style={[
        style,
        {
          width: size,
          height: size,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
      ]}
    >
      {source.kind === 'heritage' ? <HeritageCardArt cardId={source.cardId} size={size} accessibilityLabel="" /> : null}
      {source.kind === 'word' ? <CardWord word={source.word} size={size} fontFamily={wordFontFamily} /> : null}
      {source.kind === 'cover' ? <CoverCrop source={source} size={size} fontFamily={wordFontFamily} /> : null}
      {source.kind === 'plate' ? <CollectionPlate members={source.members} card={card} size={size} fontFamily={wordFontFamily} /> : null}
    </View>
  );
}

function CoverCrop({
  source,
  size,
  fontFamily,
}: {
  source: Extract<ReturnType<typeof cardArtSource>, { kind: 'cover' }>;
  size: number;
  fontFamily?: string;
}): React.ReactElement {
  const { sceneWidth, offsetX } = cardCoverCrop(size);
  return (
    <View style={{ position: 'absolute', top: 0, left: offsetX, width: sceneWidth, height: size }}>
      <StoryScene
        art={source.art}
        theme={source.theme}
        variant={storyCoverVariant(sceneWidth)}
        width={sceneWidth}
        decorative
        fallback={<CardWord word={source.word} size={size} fontFamily={fontFamily} />}
      />
    </View>
  );
}

function CollectionPlate({
  members,
  card,
  size,
  fontFamily,
}: {
  members: readonly HeritageCard[];
  card: HeritageCard;
  size: number;
  fontFamily?: string;
}): React.ReactElement {
  const plate = cardPlateLayout(size);
  const frame = plate.inset / 2;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: frame,
          left: frame,
          right: frame,
          bottom: frame,
          borderRadius: radii.md,
          borderWidth: borderWidth.base,
          borderColor: colors.rarity[card.rarity],
          backgroundColor: colors.surface.paper,
        }}
      />
      {plate.cells.map((cell, i) => {
        const member = members[i];
        return member ? (
          <CardArt
            key={member.id}
            card={member}
            size={plate.cell}
            wordFontFamily={fontFamily}
            style={{ position: 'absolute', top: cell.y, left: cell.x, borderRadius: radii.sm }}
          />
        ) : (
          <View
            key={`empty-${i}`}
            style={{
              position: 'absolute',
              top: cell.y,
              left: cell.x,
              width: plate.cell,
              height: plate.cell,
              borderRadius: radii.sm,
              backgroundColor: colors.surface.sunken,
            }}
          />
        );
      })}
    </>
  );
}
