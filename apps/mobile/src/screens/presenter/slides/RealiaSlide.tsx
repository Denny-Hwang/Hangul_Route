import { presenter, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { realiaView, sheetUnits } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
import { STAGE_GAP, STAGE_GAP_INNER } from '../stage-metrics';
import { usePresenterView, useStageText } from '../presenter-context';
import { ChipText, WordChip, useFitLevel } from './ReadingParts';
import { RealiaSheetStage } from './RealiaSheetStage';
import { revealProps } from './reveal';

type RealiaBody = Extract<Slide, { kind: 'realia' }>;

/** A long caption beside the sheet (`useFitLevel`): level 1 draws it at `presenter.size.caption`. */
const MAX_LEVEL = 1;

/**
 * Realia slide (design/screens/presenter/slide-realia.md; AMENDMENTS-LECTURE-V2 section 5.2,
 * LV-S1): the drawn sheet on the left (`SHEET_W` units, price cards `SHEET_CARDS_W`, wider on a small
 * phone whose text floor draws it bigger, `sheetUnits`; the same sheet
 * its questions keep beside them in LV-S2, so the room keeps its place); on the right the caption in
 * the slide language (its Korean as chips) and, at the next build, the key words as chips (Korean,
 * romanization, meaning). Builds `sheet`, `words`; with `romanization: 'tap'` the sheet's and the
 * caption's romanization one build after the sheet, the key words' one build after them. A long
 * caption fits itself.
 */
export function RealiaSlide({ slide, reveal }: { slide: RealiaBody; reveal: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const fit = useFitLevel(MAX_LEVEL);
  // On a small phone the 18 px floor draws the sheet's romanization bigger than its units: the sheet grows with it.
  const textScale = size(presenter.size.caption) / (unit * presenter.size.caption);
  const view = realiaView(slide, reveal);
  const words = revealProps(view.words);
  return (
    <View testID="presenter-realia" onLayout={fit.onRoom} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
      <RealiaSheetStage sheet={slide.sheet} rom={view.sheetRom} width={units(unit, sheetUnits(slide.sheet, textScale))} />
      <View onLayout={fit.onContent} {...{ dataSet: { fit: String(fit.level) } }} style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
        {slide.caption !== undefined ? <ChipText pieces={slide.caption} rom={view.sheetRom} small={fit.level >= 1} testID="presenter-realia-caption" /> : null}
        <View aria-hidden={words['aria-hidden']} style={[words.style, { flexDirection: 'row', flexWrap: 'wrap', gap: units(unit, spacing.md) }]}>
          {slide.keyWords.map((word, i) => (
            <WordChip key={i} word={word} rom={view.wordsRom} testID="presenter-realia-word" />
          ))}
        </View>
      </View>
    </View>
  );
}
