import { Body, Button, Caption, Spacer, spacing } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { voiceHelpContent } from '../logic/audio/voice-help';
import { currentDeviceFamily } from '../platform/device-family';
import { SheetFrame } from './SheetFrame';

/**
 * "Add a Korean voice" bottom sheet (F-AUDIO-004 §3.7, wireframe
 * design/wireframes/minigame/audio-fallback.md W7, spec
 * design/components/VoiceHelp/spec.md). Plain static text for **this device's** family only
 * (AMENDMENTS-AUDIO-CANT-HEAR section 3.9, review item P2-22; on the web the family comes from the user agent). It is
 * help, never a gate, and returns to its caller. Opened from the Profile Sound card and from the no-voice
 * PromptPanel. Words: `learner.audio.voiceHelp`. The frame (scrim, focus on the title, width cap, scroll cue) is
 * `SheetFrame`, shared with the "Can't hear it?" sheet.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function VoiceHelpSheet({ visible, onClose, testID = 'voice-help-sheet' }: Props): ReactElement {
  const m = useMessages();
  // Read when the sheet is drawn; there is no stored value.
  const help = voiceHelpContent(m.learner.audio.voiceHelp, currentDeviceFamily());
  return (
    <SheetFrame
      visible={visible}
      onClose={onClose}
      title={help.title}
      closeLabel={m.common.buttons.close}
      testID={testID}
      footer={<Button label={m.common.buttons.ok} tone="primary" size="md" fullWidth onPress={onClose} testID={`${testID}-ok`} />}
    >
      <Caption tone="muted">{help.note}</Caption>
      <Spacer size="md" />
      {help.sections.map((section) => (
        <View key={section.id} style={{ marginBottom: spacing.md, gap: spacing.xs }} testID={`${testID}-${section.id}`}>
          <Body weight="semibold">{section.title}</Body>
          {section.steps.map((step, i) => (
            <Body key={step}>{`${i + 1}. ${step}`}</Body>
          ))}
        </View>
      ))}
      <Body tone="secondary">{help.footer}</Body>
    </SheetFrame>
  );
}
