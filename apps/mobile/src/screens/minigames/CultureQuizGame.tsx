import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  colors,
  spacing,
  useLayoutClass,
  TapBoard,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { afterMiss, afterRightAnswer, answerItem, answerOptionLabel } from '../../logic/answer-feedback';
import { afterSound } from '../../logic/audio/reply-advance';
import { useMessages } from '../../i18n/use-messages';
import { gameArrangement } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildCultureQuizRounds, type CultureQuizRound } from '../../logic/round-builder';
import { koSpeech } from '../../logic/audio/ko-speech';
import { playPrompt } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { AnswerAnnouncer } from './answer-announcer';
import { GameColumns } from './GameColumns';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function CultureQuizGame({ scope, onFinish }: Props): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const rounds = useMemo<CultureQuizRound[]>(
    () => buildCultureQuizRounds({ cardPairs: scope.cardPairs ?? [], rounds: scope.rounds ?? 4 }),
    [scope],
  );

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrong, setLockedWrong] = useState<string[]>([]);
  // F-LAYOUT-001 §3.6: prompt left, answers right on a wide landscape window.
  const arrangement = gameArrangement(useLayoutClass());

  const round = rounds[roundIdx];
  // The word is printed above its Hear-it button (audit AUD-13 / F16); the panel only says why it is silent (F-AUDIO-004 A-5b).
  const slot = usePromptSlot({ source: 'culture-quiz', textOnScreen: true });
  const { reset } = slot;
  /** The word's play that may still be sounding when the answer comes (QS-4). */
  const sounding = useRef<Promise<unknown> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // F-A11Y-001 AF-2: each result is said once, by the answer announcer; with a screen reader on a right answer shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const next = useRoundNext();
  useEffect(() => {
    reset();
  }, [roundIdx, reset]);
  // A new round empties the announcer and, with a reader on, moves focus to the round's header node (§3.4).
  useEffect(() => {
    clear();
    if (roundIdx > 0) focusPrompt();
  }, [roundIdx, clear, focusPrompt]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const hear = (): void => {
    const word = { ko: round.promptKo, spokenKo: round.promptSpokenKo, audioRef: round.promptAudioRef };
    const spec = koSpeech(word, 'word', 'culture-quiz');
    sounding.current = slot.play(() => playPrompt(spec), spec);
  };

  const last = roundIdx >= rounds.length - 1;
  const advance = (): void => {
    next.hide();
    if (last) {
      markStepComplete();
      onFinish();
    } else {
      setRoundIdx(roundIdx + 1);
      setFeedback('idle');
      setLockedWrong([]);
    }
  };

  const handleTap = (en: string, isAnswer: boolean): void => {
    if (feedback === 'correct') return;
    if (isAnswer) {
      tapLight();
      success();
      answerRound(roundIdx, true);
      setFeedback('correct');
      // "Right answer: sagwa, apple." names the word and its meaning (§3.2); a word with no romanization is named by the meaning.
      const item = round.promptRomanization ? answerItem(m.a11y, round.promptRomanization, en) : en;
      const say = (): Promise<void> => a.announce({ kind: 'right', item });
      // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: nothing is said on an answer here, so the wait is for a word that is still sounding.
      // OD-AF2 (b): at least the result floor. A reader on waits for Next instead (OD-AF9 (b)), the last round included.
      void afterRightAnswer({
        readerOn: a.readerOn,
        gameMinMs: 700,
        announce: a.readerOn ? () => next.afterFocus(say) : say,
        showNext: next.show,
        waitThenAdvance: (minMs) => void afterSound(sounding.current, { minMs }).then(advance),
      });
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('wrong');
      setLockedWrong([...lockedWrong, en]);
      afterMiss({ readerOn: a.readerOn, announce: () => a.announce({ kind: 'miss', item: en }) });
    }
  };

  const optionState = (en: string, isAnswer: boolean): 'idle' | 'correct' | 'wrong' =>
    feedback === 'correct' && isAnswer ? 'correct' : lockedWrong.includes(en) ? 'wrong' : 'idle';
  // The round's header node (§3.4): the heading and the Korean word by romanization, never the raw Hangul; Hear it stays outside it.
  const roundLabel = m.a11y.answer.round(
    roundIdx + 1,
    rounds.length,
    round.promptRomanization ? `${copy.cultureQuiz.heading} ${round.promptRomanization}` : copy.cultureQuiz.heading,
  );

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(roundIdx + 1, rounds.length)} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <GameColumns
        arrangement={arrangement}
        prompt={
          <>
            <View ref={a.promptRef} testID="culture-quiz-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
              <Heading level="prompt">{copy.cultureQuiz.heading}</Heading>
              <Spacer size="md" />
              <View style={{ alignItems: 'center' }}>
                <Heading level="title">{round.promptKo}</Heading>
                {round.promptRomanization ? <Body tone="muted">{round.promptRomanization}</Body> : null}
              </View>
            </View>
            <Spacer size="sm" />
            <View style={{ alignSelf: 'center' }}>
              <Button
                label={m.learner.audio.hearIt.cta}
                tone="secondary"
                size="md"
                leading={<Icon name="speaker" size={20} color={colors.text.onSecondary} />}
                accessibilityLabel={m.a11y.hearItLabel(round.promptRomanization ?? round.promptKo)}
                onPress={hear}
                testID="culture-quiz-hear"
              />
            </View>
            <Spacer size="sm" />
            <PromptPanel
              variant="status"
              view={slot.view}
              onAction={(action) => slot.act(action, hear)}
              onHelp={() => setHelpOpen(true)}
            />
            <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
          </>
        }
        answers={
          <>
            <TapBoard lock="board">
              {/* One board for the answers (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
              <View style={{ gap: spacing.md }}>
                {round.options.map((opt) => {
                  const state = optionState(opt.en, opt.isAnswer);
                  return (
                    <ChoiceCard
                      key={opt.en}
                      state={state}
                      label={opt.en}
                      accessibilityLabel={answerOptionLabel(state, opt.en, m.a11y.minigame.option)}
                      onPress={() => handleTap(opt.en, opt.isAnswer)}
                      testID={`culture-quiz-option-${opt.en}`}
                    />
                  );
                })}
              </View>
            </TapBoard>
            {next.shown ? (
              <>
                <Spacer size="lg" />
                <Button
                  pressableRef={next.nextRef}
                  label={copy.trace.next.cta}
                  tone="primary"
                  size="hero"
                  fullWidth
                  onPress={advance}
                  testID="culture-quiz-next"
                />
              </>
            ) : null}
          </>
        }
        feedback={
          feedback === 'wrong' ? (
            <>
              <Spacer size="lg" />
              {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
              <HoyaBubble tone="thinking" message={copy.cultureQuiz.tryAnother} live={false} />
            </>
          ) : null
        }
      />
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
    </Screen>
  );
}
