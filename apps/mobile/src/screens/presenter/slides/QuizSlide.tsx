import type { RomanizationMode } from '@hangul-route/content-schema';
import { Hoya, Icon, colors, koreanTextLabel, presenter, spacing, typography } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { BuildName, QuizOption } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { markerFor } from '../../../logic/lecture/slide-view';
import { QUIZ_ANSWER_HOYA, units } from '../../../logic/lecture/stage-constants';
import { optionRomShown } from '../../../logic/lecture/tools';
import { ShapeMarker } from '../ShapeMarker';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { SayIt } from './SayIt';
import { SpeakerButton } from './SpeakerButton';

type QuizBody = Extract<Slide, { kind: 'quiz' }>;

/**
 * Quiz slide (design/screens/presenter/slide-quiz.md, README D6; spec sections 3.4, 3.10, TD6): a
 * projected question with the teacher's reveal. Nothing is collected from student devices and
 * nothing is tallied. The question row holds the speaker and "Which letter makes this sound?"
 * (Match Sound; the "Say it:" box instead when the room cannot hear the Korean), "What does this
 * mean?" with the word as a Korean chip, or "Which one is different?". The options sit in a 2 x 2
 * grid with their shape-and-number markers. At the answer build the correct option gets a
 * `spacing.sm`-unit `feedback.success` border, the `feedback.successLight` ground and the check
 * mark ("Hoya's answer"); the others drop to `presenter.dimOpacity` with every line in
 * `text.primary`; no red, no cross. "Hoya's answer" and a cheering Hoya join the question row, so
 * the options never move. Story checks are PR 11's.
 */
export function QuizSlide({
  slide,
  shown,
  romanization,
  sayIt,
  onPlaySound,
}: {
  slide: QuizBody;
  shown: ReadonlySet<BuildName>;
  /** The deck's romanization mode now (the live Shift+R flip included). */
  romanization: RomanizationMode;
  /** The room cannot hear the Korean: the teacher-says text replaces the speaker (section 3.7). */
  sayIt: boolean;
  onPlaySound: () => void;
}): React.ReactElement {
  const { unit } = usePresenterView();
  const revealed = shown.has('answer');
  const romOn = optionRomShown(romanization, revealed);
  const rows = [slide.options.slice(0, 2), slide.options.slice(2, 4)].filter((row) => row.length > 0);
  // A two-line question (a longer language, or the Say it box beside it) leaves the options less
  // height: the letters then shrink to fit their cards instead of spilling out (never below body).
  const [gridHeight, setGridHeight] = useState(0);
  const rowHeight = gridHeight > 0 ? (gridHeight - units(unit, STAGE_GAP_INNER) * (rows.length - 1)) / rows.length : Infinity;
  return (
    <View testID="presenter-quiz" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER), minHeight: units(unit, QUIZ_ANSWER_HOYA) }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Question slide={slide} sayIt={sayIt} onPlaySound={onPlaySound} />
        </View>
        <AnswerLine shown={revealed} />
      </View>
      <View
        role="list"
        testID="presenter-quiz-options"
        onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
        style={{ flex: 1, minHeight: 0, gap: units(unit, STAGE_GAP_INNER) }}
      >
        {rows.map((row, r) => (
          <View key={r} style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
            {row.map((option, c) => (
              <OptionCard key={c} option={option} index={r * 2 + c} revealed={revealed} romOn={romOn} rowHeight={rowHeight} />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Question({ slide, sayIt, onPlaySound }: { slide: QuizBody; sayIt: boolean; onPlaySound: () => void }): React.ReactElement | null {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.quiz;
  const promptSize = size(presenter.size.prompt);
  const heading = (text: string): React.ReactElement => (
    <Text role="heading" testID="presenter-quiz-question" style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}>
      {text}
    </Text>
  );
  const prompt = slide.prompt;
  if (prompt.ask === 'sound') {
    const say = sayIt || slide.textPrompt;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: say ? 'wrap' : 'nowrap', gap: units(unit, spacing.xl) }}>
        {say ? null : <SpeakerButton testID="presenter-quiz-speaker" enabled onPress={onPlaySound} />}
        <View style={{ flexShrink: 1 }}>{heading(m.sound)}</View>
        {say ? <SayIt spoken={prompt.spoken} /> : null}
      </View>
    );
  }
  if (prompt.ask === 'meaning') {
    const display = size(presenter.size.display);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: units(unit, spacing.xl) }}>
        {heading(messages.learner.minigame.cultureQuiz.heading)}
        <View
          accessibilityLabel={koreanTextLabel(prompt.ko, prompt.romanization)}
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: units(unit, spacing.md),
            paddingVertical: units(unit, spacing.xs),
            paddingHorizontal: units(unit, spacing.lg),
            borderRadius: units(unit, STAGE_RADIUS),
            borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
            borderColor: colors.brand.secondary,
            backgroundColor: colors.brand.secondaryLight,
          }}
        >
          <TaughtKo size={display} testID="presenter-quiz-word">
            {prompt.ko}
          </TaughtKo>
          {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
          <Text style={{ fontSize: promptSize, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{prompt.romanization}</Text>
        </View>
      </View>
    );
  }
  if (prompt.ask === 'odd-one-out') return heading(m.oddOneOut);
  return heading(prompt.text);
}

/** One option card: marker, content (a letter at `presenter.size.display` with its romanization, or a gloss) and, at the reveal, the check mark. */
function OptionCard({ option, index, revealed, romOn, rowHeight }: { option: QuizOption; index: number; revealed: boolean; romOn: boolean; rowHeight: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const correct = revealed && option.correct;
  const line = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm));
  const border = correct ? rule : line;
  const marker = markerFor(index, presenter.marker.shapes);
  const promptSize = size(presenter.size.prompt);
  const hasKo = option.ko !== undefined;
  const padV = units(unit, spacing.md);
  const glyph = Math.max(size(presenter.size.body), Math.min(size(presenter.size.display), Math.floor(rowHeight - 2 * (padV + line))));
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
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: units(unit, spacing.lg) }}>
        {hasKo ? (
          <TaughtKo size={glyph} style={{ lineHeight: glyph }}>
            {option.ko!}
          </TaughtKo>
        ) : null}
        {hasKo && option.romanization !== undefined ? (
          <Text
            style={{
              fontSize: size(presenter.size.body),
              fontWeight: typography.weight.semibold,
              // A dimmed or revealed option sets every line in text.primary (presenter.v1.md).
              color: revealed ? colors.text.primary : colors.text.secondary,
              opacity: romOn ? 1 : 0,
            }}
          >
            {option.romanization}
          </Text>
        ) : null}
        {!hasKo && option.gloss !== undefined ? (
          <Text style={{ fontSize: promptSize, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}>{option.gloss}</Text>
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

/**
 * "Hoya's answer" under a small cheering Hoya; it joins the question row at the reveal, keeping its
 * space before. Stacked, it fits beside the question on one row at 1280 x 720, so the options keep
 * the height their 140-unit letters need.
 */
function AnswerLine({ shown }: { shown: boolean }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  return (
    <View
      testID="presenter-quiz-answer"
      accessibilityElementsHidden={!shown}
      aria-hidden={!shown}
      style={{ alignItems: 'center', flexShrink: 0, opacity: shown ? 1 : 0 }}
    >
      <Hoya pose="cheering" size={units(unit, QUIZ_ANSWER_HOYA)} accessibilityLabel={messages.a11y.hoya('cheering')} />
      <Text style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.bold, color: colors.text.primary }}>{messages.learner.presenter.quiz.answer}</Text>
    </View>
  );
}
