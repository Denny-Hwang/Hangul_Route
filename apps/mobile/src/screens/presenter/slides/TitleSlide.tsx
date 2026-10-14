import { Hoya, colors, presenter, spacing, typography } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { HOYA_STAGE, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { usePresenterView, useStageText } from '../presenter-context';

type TitleBody = Extract<Slide, { kind: 'title' }>;

/**
 * Title slide (design/screens/presenter/slide-title.md): Hoya waving (idle on a topic title) and,
 * beside it, the deck title as a caption on the first slide only (teacher text, README D17), the
 * title, the subtitle and Hoya's line in a bubble. One build; every word is the content's own.
 */
export function TitleSlide({ slide, deckTitle }: { slide: TitleBody; deckTitle?: string }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const pose = slide.source === 'topic' ? 'idle' : 'waving';
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      <Hoya pose={pose} size={units(unit, HOYA_STAGE)} accessibilityLabel={messages.a11y.hoya(pose)} />
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
        {deckTitle !== undefined ? (
          <Text
            accessibilityLabel={`${messages.learner.presenter.slide.deckTitle}: ${deckTitle}`}
            style={{ fontSize: size(presenter.size.caption), color: colors.text.secondary, lineHeight: Math.round(size(presenter.size.caption) * typography.leading.tight) }}
          >
            {deckTitle}
          </Text>
        ) : null}
        <Text
          role="heading"
          style={{
            fontSize: size(presenter.size.title),
            fontWeight: typography.weight.bold,
            color: colors.text.primary,
            lineHeight: Math.round(size(presenter.size.title) * typography.leading.tight),
          }}
        >
          {slide.title}
        </Text>
        {slide.subtitle !== undefined ? (
          <Text style={{ fontSize: size(presenter.size.body), color: colors.text.secondary, lineHeight: Math.round(size(presenter.size.body) * typography.leading.normal) }}>
            {slide.subtitle}
          </Text>
        ) : null}
        {slide.line !== undefined ? (
          <View
            style={{
              borderWidth: Math.max(1, units(unit, STAGE_BORDER)),
              borderColor: colors.border.strong,
              borderRadius: units(unit, STAGE_RADIUS),
              paddingVertical: units(unit, spacing.xl),
              paddingHorizontal: units(unit, spacing.xxl),
            }}
          >
            <Text style={{ fontSize: size(presenter.size.body), color: colors.text.primary, lineHeight: Math.round(size(presenter.size.body) * typography.leading.normal) }}>
              {slide.line}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
