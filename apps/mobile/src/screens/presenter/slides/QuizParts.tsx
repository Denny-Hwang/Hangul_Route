import type { RomanizationMode } from '@hangul-route/content-schema';
import { Hoya, Icon, colors, presenter, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { QuizOption } from '../../../logic/lecture/build-steps';
import { markerFor } from '../../../logic/lecture/slide-view';
import { units } from '../../../logic/lecture/stage-constants';
import { optionContent, optionRomShown } from '../../../logic/lecture/tools';
import { ShapeMarker } from '../ShapeMarker';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

/**
 * The parts of a projected quiz (design/screens/presenter/slide-quiz.md, README D6), shared by the
 * quiz slide (PR 9) and the story check slide (PR 11): the 2 x 2 option grid with its
 * shape-and-number markers and the teacher's reveal, and the story check's "Hoya's answer" line.
 *
 * The options' romanization follows one rule for both slides (`optionRomShown`, D2): visible by
 * default, at the answer build with the teacher's `tap` setting.
 *
 * The reveal (D3, section 3.10): the correct option gets a `spacing.sm`-unit `feedback.success`
 * border, the `feedback.successLight` ground and the check mark; the others drop to
 * `presenter.dimOpacity` with every line in `text.primary`. No red, no cross, nothing tallied.
 * The options never move between builds.
 */

/** The 2 x 2 option grid (2 or 3 options fill it in order). */
export function QuizOptions({
  options,
  revealed,
  romanization,
  onCrowded,
}: {
  options: readonly QuizOption[];
  revealed: boolean;
  romanization: RomanizationMode;
  /** A gloss spills out of its card even at body size: the slide gives the grid more room. */
  onCrowded?: () => void;
}): React.ReactElement {
  const { unit } = usePresenterView();
  const romOn = optionRomShown(romanization, revealed);
  const rows = [options.slice(0, 2), options.slice(2, 4)].filter((row) => row.length > 0);
  // A two-line question (a longer language, or the Say it box beside it) leaves the options less
  // height: the letters then shrink to fit their cards instead of spilling out (never below body).
  const [gridHeight, setGridHeight] = useState(0);
  const rowHeight = gridHeight > 0 ? (gridHeight - units(unit, STAGE_GAP_INNER) * (rows.length - 1)) / rows.length : Infinity;
  // A gloss that does not fit its card at prompt size (a long meaning on a phone's small stage)
  // steps every gloss of the grid down to body size together, so the options stay one size.
  const [glossSmall, setGlossSmall] = useState(false);
  useEffect(() => setGlossSmall(false), [unit]);
  const shrinkGloss = useCallback(() => setGlossSmall(true), []);
  return (
    <View
      role="list"
      testID="presenter-quiz-options"
      onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
      style={{ flex: 1, minHeight: 0, gap: units(unit, STAGE_GAP_INNER) }}
    >
      {rows.map((row, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
          {row.map((option, c) => (
            <OptionCard
              key={c}
              option={option}
              index={r * 2 + c}
              revealed={revealed}
              romOn={romOn}
              rowHeight={rowHeight}
              glossSmall={glossSmall}
              onGlossOverflow={shrinkGloss}
              {...(onCrowded ? { onCrowded } : {})}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * One option card: marker, content (`optionContent`: a letter or word at `presenter.size.display`
 * with its romanization, a gloss at `presenter.size.prompt`, or a story check's word with its gloss
 * under it) and, at the reveal, the check mark.
 */
function OptionCard({
  option,
  index,
  revealed,
  romOn,
  rowHeight,
  glossSmall,
  onGlossOverflow,
  onCrowded,
}: {
  option: QuizOption;
  index: number;
  revealed: boolean;
  romOn: boolean;
  rowHeight: number;
  glossSmall: boolean;
  onGlossOverflow: () => void;
  onCrowded?: () => void;
}): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const correct = revealed && option.correct;
  const line = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm));
  const border = correct ? rule : line;
  const marker = markerFor(index, presenter.marker.shapes);
  const content = optionContent(option);
  const padV = units(unit, spacing.md);
  const bodySize = size(presenter.size.body);
  // A lone letter fills its card up to display size; a word with its gloss under it stays at prompt size.
  const koSize =
    content.ko?.size === 'display' ? Math.max(bodySize, Math.min(size(presenter.size.display), Math.floor(rowHeight - 2 * (padV + line)))) : size(presenter.size.prompt);
  const glossSize = content.gloss?.size === 'body' || glossSmall ? bodySize : size(presenter.size.prompt);
  // The room a gloss has inside its card: the row less the padding and the border, less the Korean above it.
  const [koHeight, setKoHeight] = useState(0);
  const [glossHeight, setGlossHeight] = useState(0);
  const glossRoom = rowHeight - 2 * (padV + line) - (content.ko !== null ? koHeight + units(unit, spacing.xs) : 0);
  // Checked whenever either side changes: the grid's row height arrives after the gloss is laid out.
  const overflows = !glossSmall && glossSize > bodySize && glossHeight > glossRoom;
  const crowded = glossSize === bodySize && glossHeight > glossRoom;
  useEffect(() => {
    if (overflows) onGlossOverflow();
  }, [overflows, onGlossOverflow]);
  useEffect(() => {
    if (crowded) onCrowded?.();
  }, [crowded, onCrowded]);
  return (
    <View
      role="listitem"
      testID={`presenter-quiz-option-${index + 1}`}
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: units(unit, STAGE_GAP_INNER),
        // The thicker border keeps the outer size: the padding gives back what the border takes.
        paddingVertical: padV + line - border,
        paddingHorizontal: units(unit, spacing.xl) + line - border,
        borderWidth: border,
        borderColor: correct ? colors.feedback.success : colors.border.strong,
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: correct ? colors.feedback.successLight : colors.surface.paper,
        opacity: revealed && !option.correct ? presenter.dimOpacity : 1,
      }}
    >
      <ShapeMarker shape={marker.shape} n={marker.n} />
      <View style={{ flex: 1, minWidth: 0, gap: units(unit, spacing.xs) }}>
        {content.ko !== null ? (
          <View
            onLayout={(e) => setKoHeight(e.nativeEvent.layout.height)}
            style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: units(unit, content.ko.size === 'display' ? spacing.lg : spacing.md) }}
          >
            <TaughtKo size={koSize} style={content.ko.size === 'display' ? { lineHeight: koSize } : undefined}>
              {content.ko.text}
            </TaughtKo>
            {content.ko.romanization !== undefined ? (
              <Text {...KOREAN_LINE_BREAK}
                accessibilityElementsHidden={!romOn}
                aria-hidden={!romOn}
                style={{
                  fontSize: bodySize,
                  fontWeight: typography.weight.semibold,
                  // A dimmed or revealed option sets every line in text.primary (presenter.v1.md).
                  color: revealed ? colors.text.primary : colors.text.secondary,
                  opacity: romOn ? 1 : 0,
                }}
              >
                {content.ko.romanization}
              </Text>
            ) : null}
          </View>
        ) : null}
        {content.gloss !== null ? (
          <Text
            {...KOREAN_LINE_BREAK}
            onLayout={(e) => setGlossHeight(e.nativeEvent.layout.height)}
            style={{ fontSize: glossSize, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: Math.round(glossSize * typography.leading.tight) }}
          >
            {content.gloss.text}
          </Text>
        ) : null}
      </View>
      {correct ? (
        <View role="img" accessibilityLabel={messages.a11y.presenter.answerMark} testID="presenter-quiz-mark">
          <Icon name="check-circle" size={units(unit, spacing.jumbo)} color={colors.feedback.success} />
        </View>
      ) : null}
    </View>
  );
}

/** "Hoya's answer" with a cheering Hoya; it joins the story check's question row at the reveal. */
export function AnswerLine({ shown }: { shown: boolean }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  return (
    <View
      testID="presenter-quiz-answer"
      accessibilityElementsHidden={!shown}
      aria-hidden={!shown}
      style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER), flexShrink: 0, maxWidth: '40%', opacity: shown ? 1 : 0 }}
    >
      <Hoya pose="cheering" size={units(unit, touchTarget.hero)} accessibilityLabel={messages.a11y.hoya('cheering')} />
      <Text {...KOREAN_LINE_BREAK} style={{ flexShrink: 1, fontSize: size(presenter.size.body), fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {messages.learner.presenter.quiz.answer}
      </Text>
    </View>
  );
}
