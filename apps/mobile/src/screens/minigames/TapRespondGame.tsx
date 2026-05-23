import { Body, Button, Caption, Card, Heading, HoyaBubble, Pill, Progress, Screen, Spacer, spacing } from '@hangul-route/design-system';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { speak } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function TapRespondGame({ scope, onFinish }: Props): React.ReactElement {
  const turns = useMemo(() => scope.dialogue ?? [], [scope]);

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [turnIdx, setTurnIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrong, setLockedWrong] = useState<string[]>([]);

  const turn = turns[turnIdx];
  if (!turn) {
    return (
      <Screen>
        <Body>No dialogue.</Body>
      </Screen>
    );
  }

  const handleTap = (ko: string, isCorrect: boolean): void => {
    if (feedback === 'correct') return;
    if (isCorrect) {
      tapLight();
      success();
      recordRound(true);
      setFeedback('correct');
      speak(ko, { language: 'ko-KR' });
      setTimeout(() => {
        if (turnIdx >= turns.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setTurnIdx(turnIdx + 1);
          setFeedback('idle');
          setLockedWrong([]);
        }
      }, 900);
    } else {
      nudge();
      recordRound(false);
      setFeedback('wrong');
      setLockedWrong([...lockedWrong, ko]);
    }
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={turnIdx + 1} max={turns.length} tone="primary" />
        </View>
        <Pill label={`${turnIdx + 1} / ${turns.length}`} tone="neutral" size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Choose your reply</Heading>
      <Spacer size="md" />

      <Card padding="md">
        <Caption tone="muted">Someone says</Caption>
        <Spacer size="xs" />
        <Heading level="title">{turn.npcKo}</Heading>
        {turn.npcRomanization ? <Body tone="muted">{turn.npcRomanization}</Body> : null}
        <Spacer size="xxs" />
        <Body tone="secondary">{turn.npcEn}</Body>
      </Card>

      <Spacer size="lg" />
      <View style={{ gap: spacing.md }}>
        {turn.options.map((opt) => {
          const isWrongLocked = lockedWrong.includes(opt.ko);
          const showCorrect = feedback === 'correct' && opt.isCorrect;
          const tone = showCorrect ? 'success' : isWrongLocked ? 'nudge' : 'secondary';
          return (
            <Button
              key={opt.ko}
              label={`${opt.ko}  ·  ${opt.en}`}
              tone={tone}
              size="lg"
              fullWidth
              disabled={isWrongLocked}
              onPress={() => handleTap(opt.ko, opt.isCorrect)}
            />
          );
        })}
      </View>

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message="Hmm, that doesn't fit. Try another!" />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
