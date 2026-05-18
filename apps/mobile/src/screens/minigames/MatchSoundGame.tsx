import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  Spacer,
  Tile,
  spacing,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { buildMatchSoundRounds, type MatchSoundRound } from '../../logic/round-builder';
import type { MinigameScope } from '../../logic/minigame-config';
import { playJamoSound, speak } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function MatchSoundGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<MatchSoundRound[]>(
    () =>
      buildMatchSoundRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [lockedWrongIds, setLockedWrongIds] = useState<string[]>([]);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = rounds[roundIdx];

  useEffect(() => {
    if (!round) return;
    setLockedWrongIds([]);
    setFeedback('idle');
    void playJamoSound(round.promptJamo.char);
  }, [roundIdx, round]);

  useEffect(() => {
    return () => {
      if (replayTimer.current) clearTimeout(replayTimer.current);
    };
  }, []);

  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const handleTap = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (jamoId === round.promptJamo.id) {
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
        }
      }, 700);
    } else {
      nudge();
      recordRound(false);
      setFeedback('wrong');
      setLockedWrongIds([...lockedWrongIds, jamoId]);
      if (replayTimer.current) clearTimeout(replayTimer.current);
      replayTimer.current = setTimeout(() => {
        void playJamoSound(round.promptJamo.char);
      }, 800);
    }
  };

  const replay = (): void => {
    void playJamoSound(round.promptJamo.char);
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
      <Heading level="prompt">Tap the letter you hear</Heading>
      <Spacer size="md" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'center' }}>
        <Pressable
          onPress={replay}
          accessibilityRole="button"
          accessibilityLabel="Play sound again"
          hitSlop={spacing.md}
          style={{ padding: spacing.md }}
        >
          <Icon name="speaker" size={48} />
        </Pressable>
        <Caption tone="muted">Tap to replay</Caption>
      </View>

      <Spacer size="xl" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md }}>
        {round.tiles.map((j) => {
          let state: 'idle' | 'correct' | 'wrong' | 'disabled' = 'idle';
          if (lockedWrongIds.includes(j.id)) state = 'wrong';
          if (feedback === 'correct' && j.id === round.promptJamo.id) state = 'correct';
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
          <HoyaBubble
            tone="thinking"
            message="Listen again. This one says"
            korean={round.promptJamo.char}
            romanization={round.promptJamo.romanization}
            ctaInline={<Button label="Hear it" tone="secondary" size="md" onPress={() => speak(round.promptJamo.char, { language: 'ko-KR' })} />}
          />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
