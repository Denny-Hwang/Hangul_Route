import type { RomanizationMode } from '@hangul-route/content-schema';
import { colors, presenter, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { BuildName, SpokenLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { units } from '../../../logic/lecture/stage-constants';
import { optionLayout, optionRomShown } from '../../../logic/lecture/tools';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { AnswerLine, OptionRows, QuizOptions } from './QuizParts';
import { useFitLevel } from './ReadingParts';
import { SayIt } from './SayIt';
import { SpeakerButton } from './SpeakerButton';
import { revealProps } from './reveal';

type QuizBody = Extract<Slide, { kind: 'quiz' }>;
export type ListenBody = QuizBody & { prompt: Extract<QuizBody['prompt'], { ask: 'listen' }> };
export type ReplyBody = QuizBody & { prompt: Extract<QuizBody['prompt'], { ask: 'reply' }> };

/** A listen or reply question (LV-S2); QuizSlide draws the earlier quizzes, RealiaQuestionSlide the realia question. */
export function isListenOrReply(slide: Slide): slide is ListenBody | ReplyBody {
  return slide.kind === 'quiz' && (slide.prompt.ask === 'listen' || slide.prompt.ask === 'reply');
}

/**
 * Rows that fit themselves (V8's measured fallback, `nextFitLevel`): level 1 draws compact rows, level 2 also
 * the prompt or said line's Korean at body size, level 3 every romanization and meaning at caption size.
 */
const MAX_LEVEL = 3;

/**
 * Listen and reply questions (design/screens/presenter/slide-listen-reply.md; AMENDMENTS-LECTURE-V2
 * sections 5.1 and 5.2, LV-S2). Builds `question`, `answer` (README D6): nothing is collected
 * from the room's devices and nothing is tallied; the room answers by pointing ("triangle, 2"), on
 * paper or on its own devices, and is never asked to speak (LV-D9).
 *
 * - **Listen** (`ask: 'listen'`): the stage speaker and "Which one did you hear?" ("Which answer fits?"
 *   when the room picks the reply to what it heard, `reply`, as the Stage 4 Checks); at the answer
 *   build the prompt's Korean, romanization and meaning join under the question, so the room sees
 *   what it heard. With no Korean voice or sound off (section 3.7) the speaker gives way to a
 *   "Say it:" box with the prompt's romanization, which the teacher reads; its Hangul joins the box
 *   at the answer build (showing it first would give the answer away), and so does the options' romanization
 *   (the room would otherwise match the box's letters to a row's).
 * - **Reply** (`ask: 'reply'`): "Which answer fits?" over the other speaker's line in a bordered
 *   box (Korean, romanization, meaning); the Sound button plays it.
 *
 * Words and sentences are option rows whose meanings join at the answer build (V8); letters,
 * syllables and pictures keep the 2 x 2 grid (`optionLayout`). "Hoya's answer" joins the question
 * row at the reveal in a space it keeps from the start, so the options never move.
 */
export function QuestionSlide({
  slide,
  shown,
  romanization,
  sayIt,
  onPlaySound,
}: {
  slide: ListenBody | ReplyBody;
  shown: ReadonlySet<BuildName>;
  romanization: RomanizationMode;
  sayIt: boolean;
  onPlaySound: () => void;
}): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  // The stage scale goes in, so a new scale fits again from level 0; `contentRef` lets a step with no layout event re-measure.
  const fit = useFitLevel(MAX_LEVEL, unit);
  const revealed = shown.has('answer');
  const rows = optionLayout(slide) === 'rows';
  const m = messages.learner.presenter.quiz;
  const prompt = slide.prompt;
  const listen = prompt.ask === 'listen';
  const say = listen && (sayIt || slide.textPrompt);
  // In the text variant the Say it box shows the prompt's romanization: the options' romanization waits for the
  // answer build there (as with `romanization: 'tap'`), so the room cannot answer by matching letters.
  const optionRom: RomanizationMode = say ? 'tap' : romanization;
  const promptSize = size(presenter.size.prompt);
  const gap = units(unit, spacing.md);
  return (
    <View testID="presenter-question" onLayout={rows ? fit.onRoom : undefined} style={{ flex: 1, minHeight: 0 }}>
      <View
        ref={rows ? fit.contentRef : undefined}
        testID="presenter-question-content"
        onLayout={rows ? fit.onContent : undefined}
        {...{ dataSet: { fit: String(fit.level) } }}
        style={[{ gap }, rows ? null : { flex: 1, minHeight: 0 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER), minHeight: units(unit, touchTarget.hero) }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.xl) }}>
            {listen && !say ? <SpeakerButton testID="presenter-quiz-speaker" enabled onPress={onPlaySound} /> : null}
            <Text
              {...KOREAN_LINE_BREAK}
              role="heading"
              testID="presenter-quiz-question"
              style={{ flexShrink: 1, fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}
            >
              {listen && prompt.reply !== true ? m.listen : m.reply}
            </Text>
          </View>
          <AnswerLine shown={revealed} />
        </View>
        {prompt.ask === 'reply' ? (
          <SaidLine line={prompt.line} rom={optionRomShown(romanization, revealed)} level={fit.level} />
        ) : say ? (
          <SayIt spoken={{ text: prompt.line.ko, romanization: prompt.line.romanization }} koShown={revealed} />
        ) : (
          <PromptLine line={prompt.line} shown={revealed} level={fit.level} />
        )}
        {rows ? (
          <OptionRows options={slide.options} revealed={revealed} romanization={optionRom} compact={fit.level >= 1} small={fit.level >= 3} />
        ) : (
          <QuizOptions options={slide.options} revealed={revealed} romanization={optionRom} />
        )}
      </View>
    </View>
  );
}

/**
 * One line of taught Korean on a question: the Korean, its romanization (`text.secondary`; with
 * `romanization: 'tap'` it waits for the answer build, as the options' do, D2) and its meaning, on
 * one wrapping row.
 */
function KoLineRow({ line, rom, level, testID }: { line: SpokenLine; rom: boolean; level: number; testID: string }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bodySize = size(level >= 3 ? presenter.size.caption : presenter.size.body);
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
      <TaughtKo size={size(level >= 2 ? presenter.size.body : presenter.size.prompt)}>{line.ko}</TaughtKo>
      <Text {...KOREAN_LINE_BREAK} aria-hidden={!rom} style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.secondary, opacity: rom ? 1 : 0 }}>
        {line.romanization}
      </Text>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, color: colors.text.primary }}>
        {line.gloss}
      </Text>
    </View>
  );
}

/** What the room heard, joining under the question at the answer build (kept in place, unread, before it). */
function PromptLine({ line, shown, level }: { line: SpokenLine; shown: boolean; level: number }): React.ReactElement {
  return (
    <View {...revealProps(shown)}>
      <KoLineRow line={line} rom level={level} testID="presenter-quiz-prompt-line" />
    </View>
  );
}

/** The other speaker's line in a bordered box (`border.strong`), drawn from the start. */
function SaidLine({ line, rom, level }: { line: SpokenLine; rom: boolean; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  return (
    <View
      testID="presenter-quiz-said"
      style={{
        paddingVertical: units(unit, spacing.sm),
        paddingHorizontal: units(unit, spacing.xl),
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: colors.border.strong,
        borderRadius: units(unit, STAGE_RADIUS),
      }}
    >
      <KoLineRow line={line} rom={rom} level={level} testID="presenter-quiz-said-line" />
    </View>
  );
}
