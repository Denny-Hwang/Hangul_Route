import { HeritageCardArt, WORD_ART_KEYS, WordArt, colors, presenter, supportedCardIds, typography } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { romShown, shownBuilds, vocabArt } from '../../../logic/lecture/slide-view';
import { ART_LG, units } from '../../../logic/lecture/stage-constants';
import { STAGE_GAP, STAGE_GAP_INNER } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { revealProps } from './reveal';

type VocabBody = Extract<Slide, { kind: 'vocab' }>;

/**
 * Vocabulary flashcard (design/screens/presenter/slide-vocab.md): the word at
 * `presenter.size.display` in the presenter font, its romanization under it, the gloss in the
 * presenter locale under that; on the right the picture at 360 units when the word has one (the
 * heritage card art, or a topic word's WordArt, README D9 and slide-topic.md), else text only. Builds `ko` (with the romanization), `gloss`, `art`; with
 * `romanization: 'tap'` the romanization is its own build after `ko`. The gloss is never hidden by
 * that setting (owner decision D2).
 */
export function VocabSlide({ slide, reveal }: { slide: VocabBody; reveal: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const shown = shownBuilds(slide.builds, reveal);
  const art = vocabArt(slide, supportedCardIds, WORD_ART_KEYS);
  const promptSize = size(presenter.size.prompt);
  const lead = (n: number) => Math.round(n * typography.leading.tight);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
        <View {...revealProps(shown.has('ko'))}>
          <TaughtKo size={size(presenter.size.display)} testID="presenter-word">
            {slide.word.ko}
          </TaughtKo>
        </View>
        <View {...revealProps(romShown(slide.builds, shown, 'ko'))}>
          <Text testID="presenter-word-rom" style={{ fontSize: promptSize, lineHeight: lead(promptSize), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
            {slide.word.romanization}
          </Text>
        </View>
        <View {...revealProps(shown.has('gloss'))}>
          <Text testID="presenter-word-gloss" style={{ fontSize: promptSize, lineHeight: lead(promptSize), color: colors.text.primary }}>
            {slide.word.gloss}
          </Text>
        </View>
      </View>
      {art !== undefined ? (
        <View {...revealProps(shown.has('art'))}>
          {art.kind === 'card' ? (
            <HeritageCardArt cardId={art.cardId} size={units(unit, ART_LG)} accessibilityLabel={slide.word.gloss} />
          ) : (
            <WordArt artKey={art.key} size={units(unit, ART_LG)} accessibilityLabel={slide.word.gloss} testID="presenter-word-art" />
          )}
        </View>
      ) : null}
    </View>
  );
}
