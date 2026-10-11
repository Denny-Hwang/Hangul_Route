import { Body, Button, Caption, Heading, Icon, Spacer, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { voiceHelpContent } from '../logic/audio/voice-help';

/**
 * "Add a Korean voice" bottom sheet (F-AUDIO-004 §3.7, wireframe
 * design/wireframes/minigame/audio-fallback.md W7, spec
 * design/components/VoiceHelp/spec.md). Plain static text per OS family; it is
 * help, never a gate, and returns to its caller. Opened from the Profile Sound
 * card and from the no-voice PromptPanel. Words: `learner.audio.voiceHelp`.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function VoiceHelpSheet({ visible, onClose, testID = 'voice-help-sheet' }: Props): React.ReactElement {
  const m = useMessages();
  const help = voiceHelpContent(m.learner.audio.voiceHelp);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay }} testID={testID}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={m.common.buttons.close}
          style={{ flex: 1 }}
          testID={`${testID}-scrim`}
        />
        <View
          accessibilityRole="none"
          style={{
            maxHeight: '85%',
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Heading level="prompt">{help.title}</Heading>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={m.common.buttons.close}
              hitSlop={spacing.sm}
              style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={22} color={colors.text.muted} />
            </Pressable>
          </View>
          <Caption tone="muted">{help.note}</Caption>
          <Spacer size="md" />

          <ScrollView style={{ flexShrink: 1 }}>
            {help.sections.map((section) => (
              <View key={section.id} style={{ marginBottom: spacing.md, gap: spacing.xs }} testID={`${testID}-${section.id}`}>
                <Body weight="semibold">{section.title}</Body>
                {section.steps.map((step, i) => (
                  <Body key={step}>{`${i + 1}. ${step}`}</Body>
                ))}
              </View>
            ))}
            <Body tone="secondary">{help.footer}</Body>
          </ScrollView>

          <Spacer size="md" />
          <Button label={m.common.buttons.ok} tone="primary" size="md" fullWidth onPress={onClose} testID={`${testID}-ok`} />
        </View>
      </View>
    </Modal>
  );
}
