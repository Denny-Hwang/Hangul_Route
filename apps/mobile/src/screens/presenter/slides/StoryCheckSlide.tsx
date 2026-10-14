import { colors, koreanTextLabel, presenter, spacing, typography } from '@hangul-route/design-system';
import type { RomanizationMode } from '@hangul-route/content-schema';
import React from 'react';
import { Text, View } from 'react-native';
import type { BuildName, KoLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { units } from '../../../logic/lecture/stage-constants';
import { checkPromptParts } from '../../../logic/lecture/story-slides';
import { optionRomShown } from '../../../logic/lecture/tools';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { AnswerLine, QuizOptions } from './QuizParts';

type QuizBody = Extract<Slide, { kind: 'quiz' }>;
type CheckPrompt = Extract<QuizBody['prompt'], { ask: 'check' }>;
export type StoryCheckBody = QuizBody & { prompt: CheckPrompt };

/** A quiz slide that is a story check (the only quiz PR 11 draws; PR 9 draws the rest). */
export function isStoryCheck(slide: Slide): slide is StoryCheckBody {
  return slide.kind === 'quiz' && slide.prompt.ask === 'check';
}

/**
 * Story check slide (design/screens/presenter/slide-quiz.md, mock slide-story-check.html): the
 * check's own prompt with its target word as a Korean chip, the options in the 2 x 2 grid with
 * their shape-and-number markers, and at the teacher's reveal (`answer` build) the correct option
 * marked, "Hoya's answer" in the question row and the check's explanation under the options.
 * Nothing is collected or scored (TD6, D3). With `romanization: 'tap'` the options' romanization
 * waits for the reveal (D2); a pick-meaning target's gloss waits too, since it is the answer.
 */
export function StoryCheckSlide({ slide, shown, romanization }: { slide: StoryCheckBody; shown: ReadonlySet<BuildName>; romanization: RomanizationMode }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const revealed = shown.has('answer');
  const promptSize = size(presenter.size.prompt);
  const bodySize = size(presenter.size.body);
  const { target } = slide.prompt;
  const parts = checkPromptParts(slide.prompt.text, target);
  const inline = parts.some((p) => 'target' in p);
  const targetRom = optionRomShown(romanization, revealed);
  const targetGloss = slide.prompt.glossAtAnswer !== true || revealed;
  const chip = (word: KoLine) => (
    <Text
      accessibilityLabel={koreanTextLabel(word.ko, word.romanization)}
      style={{
        borderRadius: units(unit, STAGE_RADIUS),
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: colors.brand.secondary,
        backgroundColor: colors.brand.secondaryLight,
    // web: an inline chip never breaks between its Korean and its romanization.
    ...noWrap,
      }}
    >
      {' '}
      <TaughtKo size={promptSize}>{word.ko}</TaughtKo>
      {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
      <Text style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary, opacity: targetRom ? 1 : 0 }} aria-hidden={!targetRom}>{` ${word.romanization} `}</Text>
    </Text>
  );
  return (
    <View testID="presenter-check" style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER) }}>
        <View style={{ flex: 1, minWidth: 0, gap: units(unit, spacing.xs) }}>
          <Text
            role="heading"
            testID="presenter-check-prompt"
            style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.primary, lineHeight: Math.round(promptSize * typography.leading.normal) }}
          >
            {parts.map((part, i) => ('target' in part ? <React.Fragment key={i}>{chip(part.target)}</React.Fragment> : <React.Fragment key={i}>{part.text}</React.Fragment>))}
          </Text>
          {target !== undefined && !inline ? (
            <Text style={{ fontSize: promptSize, lineHeight: Math.round(promptSize * typography.leading.normal) }}>{chip(target)}</Text>
          ) : null}
          {target !== undefined ? (
            <Text testID="presenter-check-gloss" aria-hidden={!targetGloss} style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.secondary, opacity: targetGloss ? 1 : 0 }}>
              {target.gloss}
            </Text>
          ) : null}
        </View>
        <AnswerLine shown={revealed} />
      </View>
      <QuizOptions options={slide.options} revealed={revealed} romanization={romanization} />
      {slide.explain !== undefined ? (
        <Text
          testID="presenter-check-explain"
          accessibilityElementsHidden={!revealed}
          aria-hidden={!revealed}
          style={{ fontSize: bodySize, color: colors.text.primary, lineHeight: Math.round(bodySize * typography.leading.normal), opacity: revealed ? 1 : 0 }}
        >
          {slide.explain}
        </Text>
      ) : null}
    </View>
  );
}

/** `white-space: nowrap` (web); not in the native text style types. */
const noWrap = { whiteSpace: 'nowrap' } as unknown as Record<string, never>;
