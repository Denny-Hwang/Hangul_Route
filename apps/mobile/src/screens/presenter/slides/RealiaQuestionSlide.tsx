import type { RomanizationMode } from '@hangul-route/content-schema';
import { colors, koreanTextLabel, presenter, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import type { BuildName } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { sheetUnits } from '../../../logic/lecture/slide-view';
import { REALIA_ASK_MIN, REALIA_GRID_MIN, units } from '../../../logic/lecture/stage-constants';
import { optionLayout, optionRomShown } from '../../../logic/lecture/tools';
import { STAGE_GAP, STAGE_PADDING } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { AnswerLine, OptionRows, QuizOptions } from './QuizParts';
import { useChipStyle, useFitLevel } from './ReadingParts';
import { RealiaSheetStage } from './RealiaSheetStage';
import { revealProps } from './reveal';

type QuizBody = Extract<Slide, { kind: 'quiz' }>;

/** The stage's content width in units (1280 less the padding on both sides). */
const STAGE_CONTENT_W = presenter.stage.width - 2 * STAGE_PADDING;
export type RealiaQuestionBody = QuizBody & { prompt: Extract<QuizBody['prompt'], { ask: 'realia' }> };

/** A realia question (LV-S2): a Realia Read round beside its sheet. */
export function isRealiaQuestion(slide: Slide): slide is RealiaQuestionBody {
  return slide.kind === 'quiz' && slide.prompt.ask === 'realia';
}

/**
 * A slide that fits itself (V8's measured fallback, `nextFitLevel`): level 1 draws compact rows, level 2 the
 * question at body size (a long question in the column beside the sheet), level 3 the rows' romanization at
 * caption size.
 */
const MAX_LEVEL = 3;

/**
 * Realia question (design/screens/presenter/slide-realia.md "Realia question", V7; AMENDMENTS-LECTURE-V2
 * sections 5.1 and 5.2, LV-S2): the sheet stays on the left as on its realia page (`sheetUnits`, wider
 * on a small phone whose text floor draws it bigger), so the room keeps its place. On the right the
 * question in the slide language is the heading; under it the key word chip (Korean and
 * romanization; its meaning would give some answers away) with "Look closely and find the answer."
 * beside it (under it in a narrow column, `REALIA_ASK_MIN`); then the options, one row each (words and figures) or the 2 x 2 grid
 * (pictures; rows of pictures as tall as their markers in a column narrower than `REALIA_GRID_MIN`).
 * Builds `question`, `answer`: at the answer build the correct option is marked as on every quiz
 * (README D6), the answer line on the sheet gets the `found` look, and "Hoya's answer" takes the
 * lead line's place in its slot, which keeps its height (at least `touchTarget.hero` units), so
 * the options never move. With `romanization: 'tap'` the romanization of the options, the key word and
 * the sheet waits for the answer build (D2). Nothing is collected or tallied (TD6).
 */
export function RealiaQuestionSlide({ slide, shown, romanization }: { slide: RealiaQuestionBody; shown: ReadonlySet<BuildName>; romanization: RomanizationMode }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  // The stage scale goes in, so a new scale fits again from level 0; `contentRef` lets a step with no layout event re-measure.
  const fit = useFitLevel(MAX_LEVEL, unit);
  // The sheet fits on its own (one level: `tight`), against the same room: at the answer build the found line's
  // glyph can wrap that line's value onto one more row, and nothing on the right column can make the sheet shorter.
  const sheetFit = useFitLevel(1, unit);
  const onRoom = (e: LayoutChangeEvent): void => {
    fit.onRoom(e);
    sheetFit.onRoom(e);
  };
  const revealed = shown.has('answer');
  const rom = optionRomShown(romanization, revealed);
  const { prompt } = slide;
  // On a small phone the 18 px floor draws the sheet's romanization bigger than its units: the sheet grows with it.
  const textScale = size(presenter.size.caption) / (unit * presenter.size.caption);
  const sheetW = sheetUnits(prompt.sheet, textScale);
  // Pictures keep the 2 x 2 grid unless the column beside the sheet is too narrow for it (`REALIA_GRID_MIN`).
  const rows = optionLayout(slide) === 'rows' || STAGE_CONTENT_W - sheetW - STAGE_GAP < REALIA_GRID_MIN;
  // A picture grid is not measured with the rows: a row of cards shorter than its marker (a key row that wraps above
  // the grid, a wider fallback font for the key word) asks for room, and the question drops to body size as at level 2.
  const [crowded, setCrowded] = useState(false);
  useEffect(() => setCrowded(false), [unit]);
  const crowd = useCallback(() => setCrowded(true), []);
  const promptSize = size(fit.level >= 2 || crowded ? presenter.size.body : presenter.size.prompt);
  return (
    <View testID="presenter-realia-question" onLayout={onRoom} style={{ flex: 1, flexDirection: 'row', alignItems: rows ? 'center' : 'stretch', gap: units(unit, STAGE_GAP), minHeight: 0 }}>
      <View style={{ justifyContent: 'center' }}>
        <View ref={sheetFit.contentRef} onLayout={sheetFit.onContent} testID="presenter-realia-question-sheet" {...{ dataSet: { fit: String(sheetFit.level) } }}>
          <RealiaSheetStage sheet={prompt.sheet} rom={rom} width={units(unit, sheetW)} answer={{ entryId: prompt.answerEntryId, shown: revealed }} tight={sheetFit.level >= 1} />
        </View>
      </View>
      <View
        ref={rows ? fit.contentRef : undefined}
        testID="presenter-realia-question-content"
        onLayout={rows ? fit.onContent : undefined}
        // A picture grid fills the column (its rows share the height left), so only rows measure; the heading measures with them.
        {...{ dataSet: { fit: String(fit.level) } }}
        style={[{ flex: 1, minWidth: 0, gap: units(unit, spacing.md) }, rows ? null : { minHeight: 0 }]}
      >
        <Text
          {...KOREAN_LINE_BREAK}
          role="heading"
          testID="presenter-quiz-question"
          style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}
        >
          {prompt.text}
        </Text>
        {/*
          The key row: the key chip, then the lead line in a slot at least REALIA_ASK_MIN units wide (under the chip
          when the column is narrower). "Hoya's answer" takes the lead line's place in the same slot, over it, so the
          row keeps its height and the options never move at the reveal.
        */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: units(unit, spacing.xl), rowGap: units(unit, spacing.sm) }}>
          {prompt.key !== undefined ? <KeyChip ko={prompt.key.ko} romanization={prompt.key.romanization} rom={rom} /> : null}
          <View style={{ flexGrow: 1, flexBasis: units(unit, REALIA_ASK_MIN), minWidth: 0, minHeight: units(unit, touchTarget.hero), justifyContent: 'center' }}>
            <View testID="presenter-realia-ask" {...revealProps(!revealed)}>
              <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.caption), color: colors.text.primary }}>
                {messages.learner.presenter.slide.realia.ask}
              </Text>
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
              <AnswerLine shown={revealed} compact />
            </View>
          </View>
        </View>
        {rows ? (
          <OptionRows options={slide.options} revealed={revealed} romanization={romanization} compact={fit.level >= 1} small={fit.level >= 3} />
        ) : (
          <QuizOptions options={slide.options} revealed={revealed} romanization={romanization} onCrowded={crowd} />
        )}
      </View>
    </View>
  );
}

/** The word the question is about: its Korean at `presenter.size.prompt` and its romanization, on the chip look of taught Korean. */
function KeyChip({ ko, romanization, rom }: { ko: string; romanization: string; rom: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const chip = useChipStyle();
  return (
    <View
      testID="presenter-realia-key"
      accessibilityLabel={rom ? koreanTextLabel(ko, romanization) : ko}
      style={{ ...chip, flexDirection: 'row', alignItems: 'baseline', columnGap: units(unit, spacing.md), paddingVertical: units(unit, spacing.xs), paddingHorizontal: units(unit, spacing.lg) }}
    >
      <TaughtKo size={size(presenter.size.prompt)}>{ko}</TaughtKo>
      {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
      <Text {...KOREAN_LINE_BREAK} aria-hidden={!rom} style={{ fontSize: size(presenter.size.body), fontWeight: typography.weight.semibold, color: colors.text.primary, opacity: rom ? 1 : 0 }}>
        {romanization}
      </Text>
    </View>
  );
}
