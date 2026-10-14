import { Hoya, Icon, colors, presenter, spacing, touchTarget, typography } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { QuizOption } from '../../../logic/lecture/build-steps';
import { MARKER_LINES, SVG_UI_FONT, units } from '../../../logic/lecture/stage-constants';
import { quizMarker, type QuizMarkerShape } from '../../../logic/lecture/story-slides';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

/**
 * The parts of a projected quiz (design/screens/presenter/slide-quiz.md, README D6): the
 * shape-and-number markers, the 2 x 2 option grid with the teacher's reveal, and the "Hoya's
 * answer" line. PR 11 draws story checks with them; PR 9's quizzes reuse them.
 *
 * The reveal (D3, section 3.10): the correct option gets a `spacing.sm`-unit `feedback.success`
 * border, the `feedback.successLight` ground and the check mark; the others drop to
 * `presenter.dimOpacity` with every line in `text.primary`. No red, no cross, nothing tallied.
 * The options never move between builds.
 */

/** The marker drawing's own box: the shapes are drawn on 100 x 100 and scaled to the marker size. */
const MARKER_BOX = 100;
const MARKER_STROKE = 6;
const MARKER_SHAPES: Record<QuizMarkerShape, { node: React.ReactElement; numeralY: number }> = {
  circle: { node: <Circle cx={50} cy={50} r={44} />, numeralY: 50 },
  triangle: { node: <Path d="M50 6 L94 90 L6 90 Z" strokeLinejoin="round" />, numeralY: 66 },
  square: { node: <Rect x={8} y={8} width={84} height={84} rx={6} />, numeralY: 50 },
  star: { node: <Path d="M50 4 L61 36 L95 37 L68 58 L78 92 L50 72 L22 92 L32 58 L5 37 L39 36 Z" strokeLinejoin="round" />, numeralY: 58 },
};

/** An outlined shape with the option's numeral inside (colour is never the only cue). */
export function QuizMarker({ index }: { index: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const { shape, n } = quizMarker(index);
  const side = units(unit, MARKER_LINES * presenter.size.body);
  const { node, numeralY } = MARKER_SHAPES[shape];
  return (
    <View role="img" accessibilityLabel={messages.a11y.presenter.option(n, messages.a11y.presenter.shape[shape])} style={{ width: side, height: side, flexShrink: 0 }}>
      <Svg width={side} height={side} viewBox={`0 0 ${MARKER_BOX} ${MARKER_BOX}`} aria-hidden>
        {React.cloneElement(node, { fill: colors.surface.paper, stroke: colors.text.primary, strokeWidth: MARKER_STROKE })}
        <SvgText
          x={MARKER_BOX / 2}
          y={numeralY}
          dy={MARKER_BOX / 8}
          fontSize={MARKER_BOX / 3}
          fontFamily={SVG_UI_FONT}
          fontWeight={typography.weight.bold}
          fill={colors.text.primary}
          textAnchor="middle"
        >
          {String(n)}
        </SvgText>
      </Svg>
    </View>
  );
}

/** One option card: marker, content (Korean with romanization, and its gloss) and, at the reveal, the check mark. */
function OptionCard({ option, index, revealed, romShown }: { option: QuizOption; index: number; revealed: boolean; romShown: boolean }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const correct = revealed && option.correct;
  const line = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm));
  const border = correct ? rule : line;
  const glossSize = size(presenter.size.prompt);
  const bodySize = size(presenter.size.body);
  return (
    <View
      testID={`presenter-quiz-option-${index + 1}`}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: units(unit, STAGE_GAP_INNER),
        // The thicker border keeps the outer size: the padding gives back what the border takes.
        paddingVertical: units(unit, spacing.md) + line - border,
        paddingHorizontal: units(unit, spacing.xl) + line - border,
        borderWidth: border,
        borderColor: correct ? colors.feedback.success : colors.border.strong,
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: correct ? colors.feedback.successLight : colors.surface.paper,
        opacity: revealed && !option.correct ? presenter.dimOpacity : 1,
        minWidth: 0,
      }}
    >
      <QuizMarker index={index} />
      <View style={{ flex: 1, minWidth: 0, gap: units(unit, spacing.xs) }}>
        {option.ko !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: units(unit, spacing.md) }}>
            <TaughtKo size={glossSize}>{option.ko}</TaughtKo>
            <Text
              style={{
                fontSize: bodySize,
                fontWeight: typography.weight.semibold,
                // A dimmed or revealed option sets every line in text.primary (presenter.v1.md).
                color: revealed ? colors.text.primary : colors.text.secondary,
                opacity: romShown ? 1 : 0,
              }}
              aria-hidden={!romShown}
            >
              {option.romanization}
            </Text>
          </View>
        ) : null}
        {option.gloss !== undefined ? (
          <Text
            style={{
              fontSize: option.ko !== undefined ? bodySize : glossSize,
              fontWeight: typography.weight.semibold,
              color: colors.text.primary,
              lineHeight: Math.round((option.ko !== undefined ? bodySize : glossSize) * typography.leading.tight),
            }}
          >
            {option.gloss}
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

/** The 2 x 2 option grid (2 or 3 options fill it in order). */
export function QuizOptions({ options, revealed, romShown }: { options: readonly QuizOption[]; revealed: boolean; romShown: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const rows = [options.slice(0, 2), options.slice(2, 4)].filter((row) => row.length > 0);
  return (
    <View testID="presenter-quiz-options" role="list" style={{ flex: 1, minHeight: 0, gap: units(unit, STAGE_GAP_INNER) }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
          {row.map((option, c) => (
            <View key={c} role="listitem" style={{ flex: 1, minWidth: 0 }}>
              <OptionCard option={option} index={r * 2 + c} revealed={revealed} romShown={romShown} />
            </View>
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** "Hoya's answer" with a cheering Hoya; it joins the question row at the reveal. */
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
      <Text style={{ flexShrink: 1, fontSize: size(presenter.size.body), fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {messages.learner.presenter.quiz.answer}
      </Text>
    </View>
  );
}
