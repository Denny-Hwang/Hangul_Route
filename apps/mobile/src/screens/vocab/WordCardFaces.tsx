import type { RuntimeVocabItem } from '@hangul-route/content-schema';
import { Body, Card, Heading, KoreanText, borderWidth, spacing, touchTarget, useMediaSize } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { PictureArt } from '../minigames/PictureArt';

/**
 * The two faces of a word flashcard (F-VOC-003 §3.5, wireframes D and E;
 * design/screens/vocab/cards.md). Paint only: the card button around them is
 * `FlipCard`, which carries the names, so the picture is decorative and the
 * Korean is not a control of its own here.
 */

interface FaceProps {
  item: RuntimeVocabItem;
  /** The meaning in the UI language. */
  gloss: string;
  /** The topic tint: the card's border accent, never a text colour. */
  tint: string;
  romanizationShown: boolean;
  /** The card's inner width, measured by the screen (null before the first layout). */
  width: number | null;
}

const BACK_PICTURE = touchTarget.hero;

function Face({ tint, children, testID }: { tint: string; children: React.ReactNode; testID: string }): React.ReactElement {
  return (
    <Card tone="paper" padding="lg" elevation="card" style={{ borderWidth: borderWidth.thick, borderColor: tint, minHeight: 2 * touchTarget.child }} testID={testID}>
      {children}
    </Card>
  );
}

export function WordCardFront({ item, gloss, tint, romanizationShown, width, hint }: FaceProps & { hint: string }): React.ReactElement {
  const big = useMediaSize(2 * touchTarget.child);
  const picture = width === null ? big : Math.max(touchTarget.min, Math.min(big, width));
  return (
    <Face tint={tint} testID="vocab-card-front">
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <PictureArt pictureRef={item.visual} gloss={gloss} size={picture} decorative />
        <KoreanText ko={item.ko} romanization={item.romanization} romanizationShown={romanizationShown} size="lg" testID="vocab-card-ko" />
        <Body tone="secondary" align="center">
          {hint}
        </Body>
      </View>
    </Face>
  );
}

export function WordCardBack({ item, gloss, tint, romanizationShown, senseNote }: FaceProps & { senseNote: string | undefined }): React.ReactElement {
  const picture = useMediaSize(BACK_PICTURE);
  return (
    <Face tint={tint} testID="vocab-card-back">
      <View style={{ gap: spacing.md }}>
        <Heading level="title" testID="vocab-card-gloss">
          {gloss}
        </Heading>
        {senseNote !== undefined && senseNote.trim() !== '' ? (
          <Body tone="secondary" testID="vocab-card-note">
            {senseNote}
          </Body>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
          <PictureArt pictureRef={item.visual} gloss={gloss} size={picture} decorative />
          <View style={{ flexShrink: 1, maxWidth: '100%' }}>
            <KoreanText ko={item.ko} romanization={item.romanization} romanizationShown={romanizationShown} size="md" testID="vocab-card-back-ko" />
          </View>
        </View>
      </View>
    </Face>
  );
}
