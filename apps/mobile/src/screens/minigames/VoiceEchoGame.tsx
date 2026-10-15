import { romanizeWord } from '@hangul-route/content-schema';
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
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt } from '../../platform/audio';
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
  const m = useMessages();
  const copy = m.learner.minigame.voiceEcho;
  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const [acknowledged, setAcknowledged] = useState(false);
  // F-LAYOUT-001 §3.6: the speaker grows with the window.
  const speaker = useMediaSize(SPEAKER);
  const speakerIcon = useMediaSize(SPEAKER_ICON);

  const pair = _scope.cardPairs?.[0];
  const target = pair?.ko ?? '안녕';
  // F-CNT-002: the pair's own romanization, else the converter's (the default word has none in content).
  const targetRomanization = pair?.romanization ?? romanizeWord(target) ?? undefined;
  // The word is printed under the speaker; the panel only says why it is silent (F-AUDIO-004 A-5b).
  const slot = usePromptSlot({ source: 'voice-echo', textOnScreen: true });
  const [helpOpen, setHelpOpen] = useState(false);
  const hear = (): void => {
    void slot.play(() => playPrompt({ text: target, kind: 'word', source: 'voice-echo' }));
  };

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
          onPress={hear}
          accessibilityRole="button"
          accessibilityLabel={m.a11y.minigame.hear(targetRomanization ?? target)}
          testID="voice-echo-speaker"
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
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.title, fontWeight: '700', marginTop: spacing.sm }}>{target}</Text>
          {targetRomanization ? <Caption tone="secondary">{targetRomanization}</Caption> : null}
        </Pressable>
      </View>
      <Spacer size="sm" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) => slot.act(action, hear)}
        onHelp={() => setHelpOpen(true)}
      />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

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
