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
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildTraceStrokeRounds, type TraceStrokeRound } from '../../logic/round-builder';
import { speak } from '../../platform/audio';
import { success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

/**
 * Trace Stroke — simplified for prototype: child taps the jamo 3 times to
 * "trace" it. A real implementation uses gesture path matching with reanimated
 * + react-native-svg path interpolation (future F-004).
 */
export function TraceStrokeGame({ scope, onFinish }: Props): React.ReactElement {
  const rounds = useMemo<TraceStrokeRound[]>(
    () =>
      buildTraceStrokeRounds({
        scopeJamoIds: scope.jamoIds ?? [],
        rounds: scope.rounds ?? 4,
      }),
    [scope],
  );

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const [roundIdx, setRoundIdx] = useState(0);
  const [taps, setTaps] = useState(0);
  const round = rounds[roundIdx];

  useEffect(() => {
    setTaps(0);
    if (round) speak(round.jamo.char, { language: 'ko-KR' });
  }, [roundIdx, round]);

  if (!round) {
    return (
      <Screen>
        <Body>No rounds.</Body>
      </Screen>
    );
  }

  const required = 3;
  const onTap = (): void => {
    const t = taps + 1;
    setTaps(t);
    if (t >= required) {
      success();
      recordRound(true);
      setTimeout(() => {
        if (roundIdx >= rounds.length - 1) {
          markStepComplete();
          onFinish();
        } else {
          setRoundIdx(roundIdx + 1);
        }
      }, 600);
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
      <Heading level="prompt">Trace the letter {round.jamo.romanization}</Heading>
      <Spacer size="sm" />
      <Caption tone="muted">Tap inside the letter 3 times.</Caption>

      <Spacer size="lg" />
      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel={`Tap to trace ${round.jamo.romanization}`}
          style={{
            width: 240,
            height: 240,
            borderRadius: radii.xxl,
            backgroundColor: taps >= required ? colors.feedback.successLight : colors.brand.primaryLight,
            borderWidth: 3,
            borderColor: taps >= required ? colors.feedback.success : colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 180, fontWeight: '800', color: colors.text.primary }}>{round.jamo.char}</Text>
        </Pressable>
      </View>

      <Spacer size="md" />
      <Body tone="secondary" align="center">
        {taps} / {required} taps
      </Body>

      <Spacer size="lg" />
      <HoyaBubble tone="idle" message="Slowly tap inside the letter. Hear the sound and copy it." />

      <Spacer size="xl" />
      <Button label="Skip" tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
    </Screen>
  );
}
