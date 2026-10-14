import { colors, koreanTextLabel, presenter, spacing, typography } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import { CardArt } from '../../../components/CardArt';
import { cardById } from '../../../content/heritage-cards';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { cardView } from '../../../logic/lecture/slide-view';
import { taughtKoreanFont } from '../../../platform/presenter-font';
import { ART_LG, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { revealProps } from './reveal';

type CardBody = Extract<Slide, { kind: 'card' }>;

/**
 * Heritage card slide (design/screens/presenter/slide-card.md): the card's `CardArt` face at 360
 * units on the left (the heritage drawing, or for a card it cannot draw the cover, plate or Korean
 * word, the word in the presenter font); on the right "Heritage card", the title, and the Korean name as a chip (Korean and
 * romanization in `text.primary` on `brand.secondaryLight`); then the fact, the content's own text.
 * With `romanization: 'tap'` the chip's romanization is its own build. Presenting awards nothing:
 * no "earned", star or count (section 3.9).
 */
export function CardSlide({ slide, reveal }: { slide: CardBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const view = cardView(slide, reveal);
  // CardArt picks the face (F-STORY-006 D7), so the art build always shows a picture. The deck
  // builder makes a card slide only for a bundled card, so `card` is found in practice.
  const card = cardById(slide.cardId);
  const promptSize = size(presenter.size.prompt);
  const bodySize = size(presenter.size.body);
  const titleSize = size(presenter.size.title);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      {card !== undefined ? (
        <CardArt
          card={card}
          size={units(unit, ART_LG)}
          accessibilityLabel={slide.title}
          testID="presenter-card-art"
          wordFontFamily={taughtKoreanFont(presenter.font).fontFamily}
        />
      ) : null}
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER), alignItems: 'flex-start' }}>
        <Text style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{messages.learner.presenter.slide.card}</Text>
        <Text role="heading" style={{ fontSize: titleSize, lineHeight: Math.round(titleSize * typography.leading.tight), fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {slide.title}
        </Text>
        {slide.ko !== undefined && slide.romanization !== undefined ? (
          <View
            testID="presenter-card-chip"
            accessibilityLabel={view.rom ? koreanTextLabel(slide.ko, slide.romanization) : slide.ko}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: units(unit, spacing.md),
              paddingVertical: units(unit, spacing.xs),
              paddingHorizontal: units(unit, spacing.lg),
              borderRadius: units(unit, STAGE_RADIUS),
              borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
              borderColor: colors.brand.secondary,
              backgroundColor: colors.brand.secondaryLight,
            }}
          >
            <TaughtKo size={promptSize}>{slide.ko}</TaughtKo>
            {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
            <View {...revealProps(view.rom)}>
              <Text testID="presenter-card-chip-rom" style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{slide.romanization}</Text>
            </View>
          </View>
        ) : null}
        {slide.fact !== undefined ? (
          <View {...revealProps(view.fact)}>
            <Text testID="presenter-card-fact" style={{ fontSize: bodySize, lineHeight: Math.round(bodySize * typography.leading.normal), color: colors.text.primary }}>
              {slide.fact}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
