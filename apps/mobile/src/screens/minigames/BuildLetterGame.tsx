import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  Tile,
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { jamoAll } from '../../content/jamo';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildBuildLetterRounds, type BuildLetterRound } from '../../logic/round-builder';
import { speak } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

export function BuildLetterGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<BuildLetterRound[]>(
    () => buildBuildLetterRounds({ syllables: scope.syllables ?? [] }),
    [scope],
  );
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const round = rounds[roundIdx];

  useEffect(() => {
    setSelected([]);
    setFeedback('idle');
  }, [roundIdx]);

  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const isCorrectWhenComplete = (sel: string[]): boolean => {
    if (sel.length !== round.componentJamoIds.length) return false;
    return sel.every((id, i) => id === round.componentJamoIds[i]);
  };

  const handleTile = (jamoId: string): void => {
    if (feedback === 'correct') return;
    if (selected.includes(jamoId)) {
      setSelected(selected.filter((id) => id !== jamoId));
      return;
    }
    const next = [...selected, jamoId];
    if (next.length > round.componentJamoIds.length) return;
    setSelected(next);
    tapLight();

    if (next.length === round.componentJamoIds.length) {
      if (isCorrectWhenComplete(next)) {
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
        }, 900);
      } else {
        nudge();
        recordRound(false);
        setFeedback('wrong');
        setTimeout(() => {
          setSelected([]);
          setFeedback('idle');
        }, 900);
      }
    }
  };

  return (
    <Screen tone="canvas">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={roundIdx + 1} max={rounds.length} tone="primary" />
        </View>
        <Pill label={`${roundIdx + 1} / ${rounds.length}`} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Build this letter</Heading>
      <Spacer size="md" />

      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => speak(round.targetSyllable, { language: 'ko-KR' })}
          accessibilityLabel={`Hear ${round.romanization}`}
          style={{
            width: 160,
            height: 160,
            borderRadius: radii.xl,
            backgroundColor: feedback === 'correct' ? colors.feedback.successLight : colors.surface.paper,
            borderWidth: 3,
            borderColor: feedback === 'correct' ? colors.feedback.success : colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 80, fontWeight: '800', color: colors.text.primary }}>{round.targetSyllable}</Text>
          <Caption tone="secondary">{round.romanization}</Caption>
        </Pressable>
      </View>

      <Spacer size="lg" />
      <Caption tone="muted" align="center">
        Slots:
      </Caption>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
        {round.componentJamoIds.map((_, i) => {
          const filled = selected[i];
          const jamoChar = filled ? jamoAll.find((j) => j.id === filled)?.char ?? '' : '';
          return (
            <View
              key={i}
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.lg,
                borderWidth: 2,
                borderColor: filled ? colors.brand.primary : colors.border.subtle,
                borderStyle: filled ? 'solid' : 'dashed',
                backgroundColor: filled ? colors.brand.primaryLight : colors.surface.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: typography.size.display, fontWeight: '700' }}>{jamoChar}</Text>
            </View>
          );
        })}
      </View>

      <Spacer size="lg" />
      <Caption tone="muted" align="center">
        Tiles
      </Caption>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
        {round.tileJamoIds.map((id) => {
          const j = jamoAll.find((x) => x.id === id);
          if (!j) return null;
          const used = selected.includes(id);
          return (
            <Tile
              key={id}
              label={j.char}
              romanization={j.romanization}
              size="md"
              state={used ? 'disabled' : 'idle'}
              onPress={() => handleTile(id)}
            />
          );
        })}
      </View>

      {feedback === 'wrong' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="thinking" message="Not quite. Try again — letters go left to right." />
        </>
      ) : null}
      <Spacer size="xl" />
      <Button label="Skip" tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
      <Spacer size="lg" />
    </Screen>
  );
}
