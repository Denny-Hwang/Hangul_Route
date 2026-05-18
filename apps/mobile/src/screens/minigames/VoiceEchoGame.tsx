import {
  Body,
  Button,
  Caption,
  Heading,
  HoyaBubble,
  Icon,
  Pill,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  typography,
} from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinigameScope } from '../../logic/minigame-config';
import { speak } from '../../platform/audio';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
}

/**
 * VoiceEcho — placeholder. Real STT requires expo-av Recording + a Korean
 * speech-to-text endpoint (see CRITICAL GAP §5). Until then, we ask the child
 * to listen, repeat aloud, and tap "I said it" — honor system.
 */
export function VoiceEchoGame({ scope: _scope, onFinish }: Props): React.ReactElement {
  const recordRound = useQuestRunStore((s) => s.recordRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const [acknowledged, setAcknowledged] = useState(false);

  const target = _scope.cardPairs?.[0]?.ko ?? '안녕';

  const onDone = (): void => {
    recordRound(true);
    markStepComplete();
    onFinish();
  };

  return (
    <Screen tone="canvas">
      <Spacer size="xl" />
      <Heading level="prompt" align="center">
        Say it out loud
      </Heading>
      <Spacer size="md" />

      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => speak(target, { language: 'ko-KR' })}
          style={{
            width: 200,
            height: 200,
            borderRadius: radii.circle,
            backgroundColor: colors.brand.primaryLight,
            borderWidth: 3,
            borderColor: colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="speaker" size={64} />
          <Text style={{ fontSize: typography.size.title, fontWeight: '700', marginTop: spacing.sm }}>{target}</Text>
        </Pressable>
      </View>

      <Spacer size="lg" />
      <HoyaBubble
        tone="idle"
        message="Listen to me, then say it back out loud. Tap 'I said it' when done."
      />

      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => setAcknowledged(!acknowledged)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledged }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          backgroundColor: acknowledged ? colors.feedback.successLight : colors.surface.paper,
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: acknowledged ? colors.feedback.success : colors.border.subtle,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radii.sm,
            borderWidth: 2,
            borderColor: acknowledged ? colors.feedback.success : colors.border.strong,
            backgroundColor: acknowledged ? colors.feedback.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {acknowledged ? <Icon name="check" size={20} color={colors.text.inverse} /> : null}
        </View>
        <Body weight="semibold">I said it!</Body>
      </Pressable>
      <Spacer size="md" />
      <Caption tone="muted" align="center">
        Voice grading is coming soon — for now it&apos;s honor system 🐯
      </Caption>
      <Spacer size="md" />
      <Button label="Continue" tone="primary" size="hero" fullWidth disabled={!acknowledged} onPress={onDone} />
      <Spacer size="lg" />
    </Screen>
  );
}
