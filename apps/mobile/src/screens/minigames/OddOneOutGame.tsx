import { Body, Heading, HoyaBubble, Pill, Progress, Screen, Spacer, Tile, spacing } from '@hangul-route/design-system';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildOddOneOutRounds, type OddOneOutRound } from '../../logic/round-builder';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function OddOneOutGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<OddOneOutRound[]>(
    () => buildOddOneOutRounds({ scopeJamoIds: scope.jamoIds ?? [], rounds: scope.rounds ?? 4 }),
    [scope],
  );

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrongIds, setLockedWrongIds] = useState<string[]>([]);

  const round = rounds[roundIdx];
  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const handleTap = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (jamoId === round.oddJamo.id) {
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
          setLockedWrongIds([]);
        }
      }, 700);
    } else {
      nudge();
      recordRound(false);
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
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
      <Heading level="prompt">Tap the one that doesn&apos;t belong</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Three are the same kind. One is different.</Body>

      <Spacer size="xl" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md }}>
        {round.tiles.map((j) => {
          let state: 'idle' | 'correct' | 'wrong' | 'disabled' = 'idle';
          if (lockedWrongIds.includes(j.id)) state = 'wrong';
          if (feedback === 'correct' && j.id === round.oddJamo.id) state = 'correct';
          return (
            <Tile
              key={j.id}
              label={j.char}
              romanization={j.romanization}
              state={state}
              size="lg"
              accessibilityLabel={`Korean letter ${j.romanization}, tap to select`}
              onPress={() => handleTap(j.id)}
            />
          );
        })}
      </View>

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message="Look again — which kind is different?" />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
