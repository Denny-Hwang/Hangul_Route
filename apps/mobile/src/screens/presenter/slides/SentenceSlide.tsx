import { borderWidth, colors, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import { PictureArt } from '../../../components/PictureArt';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { sentenceView } from '../../../logic/lecture/slide-view';
import { PIC_MD, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { KindLabel } from './ReadingParts';
import { revealProps } from './reveal';

type SentenceBody = Extract<Slide, { kind: 'sentence' }>;

/**
 * Sentence slide (design/screens/presenter/slide-sentence.md; AMENDMENTS-LECTURE-V2 section 5.2,
 * LV-S1): the kind label, then the Korean at `presenter.size.title` with its romanization under it,
 * a rule and the meaning in the slide language; on the right the item's picture (`PictureArt` in a
 * 300-unit stage tile) when it has one, else the text takes the width. Builds `ko` (with the
 * romanization), `gloss`, `art`; with `romanization: 'tap'` the romanization is its own build.
 */
export function SentenceSlide({ slide, reveal }: { slide: SentenceBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const view = sentenceView(slide, reveal);
  const gloss = revealProps(view.gloss);
  const bodySize = size(presenter.size.body);
  const promptSize = size(presenter.size.prompt);
  return (
    <View testID="presenter-sentence" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <KindLabel text={messages.learner.presenter.slide.sentence.label} testID="presenter-kind-label" />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
        <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
          <View style={{ gap: units(unit, spacing.sm) }}>
            <TaughtKo size={size(presenter.size.title)} testID="presenter-sentence-ko">
              {slide.sentence.ko}
            </TaughtKo>
            <View {...revealProps(view.rom)}>
              <Text {...KOREAN_LINE_BREAK} testID="presenter-sentence-rom" style={{ fontSize: bodySize, lineHeight: Math.round(bodySize * typography.leading.tight), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
                {slide.sentence.romanization}
              </Text>
            </View>
          </View>
          <View aria-hidden={gloss['aria-hidden']} style={[gloss.style, { gap: units(unit, STAGE_GAP_INNER) }]}>
            <View style={{ borderTopWidth: Math.max(borderWidth.thin, units(unit, borderWidth.thick)), borderColor: colors.border.subtle }} />
            <Text {...KOREAN_LINE_BREAK} testID="presenter-sentence-gloss" style={{ fontSize: promptSize, lineHeight: Math.round(promptSize * typography.leading.tight), color: colors.text.primary }}>
              {slide.sentence.gloss}
            </Text>
          </View>
        </View>
        {slide.picture !== undefined ? (
          <View {...revealProps(view.art)}>
            <PictureArt
              pictureRef={slide.picture}
              gloss={slide.sentence.gloss}
              size={units(unit, PIC_MD)}
              tile={{ padding: units(unit, spacing.md), border: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)), radius: units(unit, STAGE_RADIUS) }}
              testID="presenter-sentence-art"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
