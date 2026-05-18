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
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { nudge, success } from '../../platform/haptics';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

/**
 * StorySequence — present story steps in shuffled order, child taps
 * them in the correct order.
 */
export function StorySequenceGame({ scope, onFinish }: Props): React.ReactElement {
  const correctOrder = useMemo(() => scope.storySteps ?? [], [scope]);
  const shuffled = useMemo(() => [...correctOrder].sort(() => Math.random() - 0.5), [correctOrder]);
  const [picked, setPicked] = useState<string[]>([]);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);

  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);

  useEffect(() => {
    if (picked.length === correctOrder.length && correctOrder.length > 0) {
      setTimeout(() => {
        markStepComplete();
        onFinish();
      }, 600);
    }
  }, [picked, correctOrder.length, markStepComplete, onFinish]);

  const handleTap = (id: string): void => {
    if (picked.includes(id)) return;
    const expectedId = correctOrder[picked.length]?.id;
    if (id === expectedId) {
      success();
      recordRound(true);
      setPicked([...picked, id]);
    } else {
      nudge();
      recordRound(false);
      setWrongFlash(id);
      setTimeout(() => setWrongFlash(null), 500);
    }
  };

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={picked.length} max={correctOrder.length} tone="primary" />
        </View>
        <Pill label={`${picked.length} / ${correctOrder.length}`} size="sm" />
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">Put the story in order</Heading>
      <Caption tone="muted">Tap each step starting from first.</Caption>

      <Spacer size="lg" />
      <Caption tone="muted">Your order:</Caption>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, minHeight: 56 }}>
        {picked.map((id, i) => {
          const step = correctOrder.find((s) => s.id === id);
          return (
            <View
              key={i}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                backgroundColor: colors.feedback.successLight,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: colors.feedback.success,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <Text style={{ fontWeight: '700' }}>{i + 1}.</Text>
              <Text style={{ fontSize: typography.size.bodySm }}>{step?.labelEn}</Text>
            </View>
          );
        })}
      </View>

      <Spacer size="lg" />
      <Caption tone="muted">Steps:</Caption>
      <Spacer size="sm" />
      <View style={{ gap: spacing.sm }}>
        {shuffled.map((s) => {
          const used = picked.includes(s.id);
          const isWrong = wrongFlash === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => handleTap(s.id)}
              disabled={used}
              accessibilityRole="button"
              accessibilityLabel={s.labelEn}
              style={{
                padding: spacing.md,
                borderRadius: radii.lg,
                backgroundColor: used
                  ? colors.surface.sunken
                  : isWrong
                    ? colors.feedback.nudgeLight
                    : colors.surface.paper,
                borderWidth: 2,
                borderColor: used ? colors.border.subtle : isWrong ? colors.feedback.nudge : colors.border.subtle,
                opacity: used ? 0.5 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Icon name="arrow-right" size={20} color={colors.text.muted} />
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{s.labelEn}</Body>
                {s.labelKo ? <Caption tone="brand">{s.labelKo}</Caption> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone="idle" message="Read the steps, then pick them in the right order." />
      <Spacer size="xl" />
      <Button label="Skip" tone="ghost" size="md" fullWidth onPress={() => { markStepComplete(); onFinish(); }} />
    </Screen>
  );
}
