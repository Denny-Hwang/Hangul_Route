import { Body, Button, Heading, HoyaBubble, Pill, Progress, Screen, Spacer, spacing } from '@hangul-route/design-system';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildCultureQuizRounds, type CultureQuizRound } from '../../logic/round-builder';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function CultureQuizGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<CultureQuizRound[]>(
    () => buildCultureQuizRounds({ cardPairs: scope.cardPairs ?? [], rounds: scope.rounds ?? 4 }),
    [scope],
  );

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrong, setLockedWrong] = useState<string[]>([]);

  const round = rounds[roundIdx];
  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const handleTap = (en: string, isAnswer: boolean): void => {
    if (feedback === 'correct') return;
    if (isAnswer) {
      tapLight();
      success();
      recordRound(true);
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
      recordRound(false);
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
        <Pill label={`${roundIdx + 1} / ${rounds.length}`} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">What does this mean?</Heading>
      <Spacer size="md" />
      <View style={{ alignItems: 'center' }}>
        <Heading level="title">{round.promptKo}</Heading>
        {round.promptRomanization ? <Body tone="muted">{round.promptRomanization}</Body> : null}
      </View>

      <Spacer size="xl" />
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

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message="Not quite — try another!" />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
