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
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { speak } from '../../platform/audio';
import { useQuestRunStore } from '../../store/quest-run-store';

/** Phone sizes of the speaker button and its icon; a tablet multiplies them by its media scale. */
const SPEAKER = 200;
const SPEAKER_ICON = 64;

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
  const copy = useMessages().learner.minigame.voiceEcho;
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const [acknowledged, setAcknowledged] = useState(false);
  // F-LAYOUT-001 §3.6: the speaker grows with the window.
  const speaker = useMediaSize(SPEAKER);
  const speakerIcon = useMediaSize(SPEAKER_ICON);

  const target = _scope.cardPairs?.[0]?.ko ?? '안녕';

  const onDone = (): void => {
    answerRound(0, true);
    markStepComplete();
    onFinish();
  };

  return (
    <Screen tone="canvas">
      <Spacer size="xl" />
      <Heading level="prompt" align="center">
        {copy.heading}
      </Heading>
      <Spacer size="md" />

      <View style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => speak(target, { language: 'ko-KR' })}
          style={{
            width: speaker,
            height: speaker,
            borderRadius: radii.circle,
            backgroundColor: colors.brand.primaryLight,
            borderWidth: 3,
            borderColor: colors.brand.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="speaker" size={speakerIcon} />
          <Text style={{ fontSize: typography.size.title, fontWeight: '700', marginTop: spacing.sm }}>{target}</Text>
        </Pressable>
      </View>

      <Spacer size="lg" />
      <HoyaBubble tone="idle" message={copy.bubble} />

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
        <Body weight="semibold">{copy.saidIt}</Body>
      </Pressable>
      <Spacer size="md" />
      <Caption tone="muted" align="center">
        {copy.note}
      </Caption>
      <Spacer size="md" />
      <Button label={copy.continue.cta} tone="primary" size="hero" fullWidth disabled={!acknowledged} onPress={onDone} />
      <Spacer size="lg" />
    </Screen>
  );
}
