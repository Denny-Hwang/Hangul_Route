import { Body, Button, Heading, Spacer, colors, layout, radii, spacing } from '@hangul-route/design-system';
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/**
 * The Hide confirm (F-FEEDBACK-001 section 6.10 item 2; mock grown-up-notes.md D): "Hide this note
 * from <learner>?", what it does ("It goes away on every device. The sender sees 'Not shown'."),
 * primary Hide and Cancel. Hide is not a report and counts toward no hold (decision D8).
 */
export function HideConfirmSheet({
  visible,
  learner,
  busy,
  onHide,
  onCancel,
}: {
  visible: boolean;
  learner: string;
  busy: boolean;
  onHide: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const m = useMessages();
  const t = m.caregiver.notes.hide.confirm;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.surface.overlay }} testID="notes-hide-confirm">
        {/* The backdrop closes the sheet on a tap; it is not a second Cancel for a keyboard or a screen reader. */}
        <Pressable onPress={onCancel} accessible={false} focusable={false} importantForAccessibility="no" style={{ flex: 1, alignSelf: 'stretch' }} />
        <View
          accessibilityRole="none"
          style={{
            width: '100%',
            maxWidth: layout.maxWidth.reading,
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <Heading level="prompt">{t.title(learner)}</Heading>
          <Body tone="secondary">{t.body}</Body>
          <Spacer size="sm" />
          <Button label={t.cta} tone="primary" size="lg" fullWidth disabled={busy} onPress={onHide} testID="notes-hide-confirm-hide" />
          <Button label={t.cancel.cta} tone="ghost" size="lg" fullWidth onPress={onCancel} testID="notes-hide-confirm-cancel" />
        </View>
      </View>
    </Modal>
  );
}
