import type { RomanizationMode } from '@hangul-route/content-schema';
import { Hoya, Icon, colors, koreanTextLabel, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { BuildName } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { QUIZ_ANSWER_HOYA, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { QuizOptions } from './QuizParts';
import { SayIt } from './SayIt';
import { SpeakerButton } from './SpeakerButton';

type QuizBody = Extract<Slide, { kind: 'quiz' }>;

/**
 * Quiz slide (design/screens/presenter/slide-quiz.md, README D6; spec sections 3.4, 3.10, TD6): a
 * projected question with the teacher's reveal. Nothing is collected from student devices and
 * nothing is tallied. The question row holds the speaker and "Which letter makes this sound?"
 * (Match Sound; the "Say it:" box instead when the room cannot hear the Korean), "What does this
 * mean?" with the word as a Korean chip, or "Which one is different?". The options sit in a 2 x 2
 * grid with their shape-and-number markers (`QuizOptions`, shared with the story checks). At the answer build the correct option gets a
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
  // Options whose meanings still spill out of their cards at body size (a long gloss on a phone's
  // small stage) take room from the asked word: it drops from display to prompt size.
  const [crowded, setCrowded] = useState(false);
  useEffect(() => setCrowded(false), [unit]);
  const crowd = useCallback(() => setCrowded(true), []);
  return (
    <View testID="presenter-quiz" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER), minHeight: units(unit, QUIZ_ANSWER_HOYA) }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Question slide={slide} sayIt={sayIt} onPlaySound={onPlaySound} crowded={crowded} />
        </View>
        <AnswerLine shown={revealed} />
      </View>
      <QuizOptions options={slide.options} revealed={revealed} romanization={romanization} onCrowded={crowd} />
    </View>
  );
}

function Question({ slide, sayIt, onPlaySound, crowded }: { slide: QuizBody; sayIt: boolean; onPlaySound: () => void; crowded: boolean }): React.ReactElement | null {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter.quiz;
  const promptSize = size(presenter.size.prompt);
  const heading = (text: string): React.ReactElement => (
    <Text {...KOREAN_LINE_BREAK} role="heading" testID="presenter-quiz-question" style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.tight) }}>
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
    const display = size(crowded ? presenter.size.prompt : presenter.size.display);
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
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: promptSize, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{prompt.romanization}</Text>
        </View>
      </View>
    );
  }
  if (prompt.ask === 'odd-one-out') return heading(m.oddOneOut);
  // A story check (StoryCheckSlide draws it on the stage); the LV-S2 questions have slides of their own.
  return prompt.ask === 'check' ? heading(prompt.text) : null;
}

/**
 * "Hoya's answer" under a small cheering Hoya; it joins the question row at the reveal, keeping its
 * space before. Stacked, it fits beside the question on one row at 1280 x 720, so the options keep
 * the height their 140-unit letters need. It stays apart from the story check's row-shaped
 * `AnswerLine` in QuizParts.tsx on purpose: the quiz's question row has no room for a row-shaped line
 * beside 140-unit letters, and the story check's prompt has no room for a stacked one.
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
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.bold, color: colors.text.primary }}>{messages.learner.presenter.quiz.answer}</Text>
    </View>
  );
}
