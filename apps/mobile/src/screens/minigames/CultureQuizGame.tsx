import {
  Body,
  Button,
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
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { gameArrangement } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildCultureQuizRounds, type CultureQuizRound } from '../../logic/round-builder';
import { playPrompt } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';
import { GameColumns } from './GameColumns';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function CultureQuizGame({ scope, onFinish }: Props): React.ReactElement {
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
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    reset();
  }, [roundIdx, reset]);

  if (!round) {
    return (
      <Screen>
        <Body>{copy.noRounds}</Body>
      </Screen>
    );
  }

  const hear = (): void => {
    void slot.play(() => playPrompt({ text: round.promptKo, kind: 'word', source: 'culture-quiz' }));
  };

  const handleTap = (en: string, isAnswer: boolean): void => {
    if (feedback === 'correct') return;
    if (isAnswer) {
      tapLight();
      success();
      answerRound(roundIdx, true);
      setFeedback('correct');
      setTimeout(() => {
        if (roundIdx >= rounds.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setRoundIdx(roundIdx + 1);
          setFeedback('idle');
          setLockedWrong([]);
        }
      }, 700);
    } else {
      nudge();
      answerRound(roundIdx, false);
      setFeedback('wrong');
      setLockedWrong([...lockedWrong, en]);
    }
  };

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
            <Heading level="prompt">{copy.cultureQuiz.heading}</Heading>
            <Spacer size="md" />
            <View style={{ alignItems: 'center' }}>
              <Heading level="title">{round.promptKo}</Heading>
              {round.promptRomanization ? <Body tone="muted">{round.promptRomanization}</Body> : null}
              <Spacer size="sm" />
              <View style={{ alignSelf: 'center' }}>
                <Button
                  label={m.learner.audio.hearIt.cta}
                  tone="secondary"
                  size="md"
                  leading={<Icon name="speaker" size={20} color={colors.text.onSecondary} />}
                  accessibilityLabel={m.a11y.minigame.hear(round.promptRomanization ?? round.promptKo)}
                  onPress={hear}
                  testID="culture-quiz-hear"
                />
              </View>
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
          <View style={{ gap: spacing.md }}>
            {round.options.map((opt) => {
              const isWrongLocked = lockedWrong.includes(opt.en);
              const showCorrect = feedback === 'correct' && opt.isAnswer;
              const tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary';
              return (
                <Button
                  key={opt.en}
                  label={opt.en}
                  tone={tone}
                  size="lg"
                  fullWidth
                  disabled={isWrongLocked}
                  onPress={() => handleTap(opt.en, opt.isAnswer)}
                />
              );
            })}
          </View>
        }
        feedback={
          feedback === 'wrong' ? (
            <>
              <Spacer size="lg" />
              <HoyaBubble tone="thinking" message={copy.cultureQuiz.tryAnother} />
            </>
          ) : null
        }
      />
      <Spacer size="xl" />
    </Screen>
  );
}
