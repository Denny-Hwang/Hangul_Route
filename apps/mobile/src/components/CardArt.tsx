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
} from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { heritageCardsAll } from '../content';
import { storyById } from '../content/stories';
import { cardArtSource, cardCoverCrop, cardPlateLayout, cardWordFontSize, type CardArtDeps } from '../logic/card-art';
import { storyCoverArt } from '../logic/story/scene-view';
import { storyCoverVariant } from '../logic/story/story-tile';

const DEPS: CardArtDeps = {
  drawnCardIds: supportedCardIds,
  storyCover: (storyId) => {
    const story = storyById(storyId);
    return story ? storyCoverArt(story) : null;
  },
  cardsAll: heritageCardsAll,
};

// Speech language for the Korean word; `lang` is forwarded to the DOM on the web.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

function CardWord({ word, size }: { word: string; size: number }): React.ReactElement {
  const fontSize = cardWordFontSize(size, word);
  return (
    <Text
      {...koreanSpeech}
      numberOfLines={1}
      maxFontSizeMultiplier={1}
      style={{
        fontFamily: typography.family.sansKr,
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
 * With `accessibilityLabel` the face is one image; without it, it is hidden
 * from assistive technology (the screen around it names the card).
 * Design: design/components/CardArt/spec.md.
 */
export function CardArt({
  card,
  size,
  accessibilityLabel,
  style,
  testID,
}: {
  card: HeritageCard;
  size: number;
  accessibilityLabel?: string;
  /** Corner radius, borders or margins from the screen; size and background stay the face's own. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const source = useMemo(() => cardArtSource(card, DEPS), [card]);
  const labelled = accessibilityLabel !== undefined;
  const background =
    source.kind === 'heritage' ? colors.surface.paper : source.kind === 'plate' ? colors.surface.sunken : colors.theme[source.theme];
  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? undefined : 'no-hide-descendants'}
      style={[
        {
          width: size,
          height: size,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {source.kind === 'heritage' ? <HeritageCardArt cardId={source.cardId} size={size} accessibilityLabel="" /> : null}
      {source.kind === 'word' ? <CardWord word={source.word} size={size} /> : null}
      {source.kind === 'cover' ? <CoverCrop source={source} size={size} /> : null}
      {source.kind === 'plate' ? <CollectionPlate members={source.members} card={card} size={size} /> : null}
    </View>
  );
}

function CoverCrop({
  source,
  size,
}: {
  source: Extract<ReturnType<typeof cardArtSource>, { kind: 'cover' }>;
  size: number;
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
        fallback={<CardWord word={source.word} size={size} />}
      />
    </View>
  );
}

function CollectionPlate({
  members,
  card,
  size,
}: {
  members: readonly HeritageCard[];
  card: HeritageCard;
  size: number;
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
