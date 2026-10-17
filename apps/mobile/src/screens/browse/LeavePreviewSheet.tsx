import { Button, Heading, Spacer, colors, radii, shadows, spacing, useLayoutClass } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { onEscape } from '../../platform/browse-env';
import { useHistorySheet } from '../../platform/history-bridge';
import { BROWSE_DIALOG_MAX } from '../../logic/browse/layout';

/**
 * The leave confirm of [ Leave preview ] (F-BROWSE-001 section 4.8; mock
 * `design/screens/browse/preview-player.md` C): "Leave this preview?" with
 * [ Keep going ] and [ Leave ] on one row (they wrap at large text). A bottom
 * sheet over the `surface.overlay` scrim on phones, a centred dialog from the
 * regular class. No warning tone: nothing is lost. Escape, the scrim and the
 * browser back keep going. The header's Close of a previewed lesson asks it too.
 */

const DIALOG_MAX = BROWSE_DIALOG_MAX;

export function LeavePreviewSheet({ visible, onKeep, onLeave }: { visible: boolean; onKeep: () => void; onLeave: () => void }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse.preview.leaveConfirm;
  const dialog = useLayoutClass().width !== 'compact';
  useEffect(() => (visible ? onEscape(onKeep) : undefined), [visible, onKeep]);
  // One history level while it is open: the browser or phone back answers Keep going (AMENDMENTS-DISPLAY-NAV section 7.2).
  useHistorySheet(visible, onKeep);

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onKeep}>
      <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay }}>
        <Pressable onPress={onKeep} accessibilityRole="button" accessibilityLabel={m.keep.cta} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} testID="browse-leave-scrim" />
        <View
          role="alertdialog"
          aria-modal
          aria-labelledby="browse-leave-title"
          testID="browse-leave-sheet"
          style={{
            width: '100%',
            maxWidth: dialog ? DIALOG_MAX : undefined,
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: dialog ? radii.xl : 0,
            borderBottomRightRadius: dialog ? radii.xl : 0,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.lg,
            ...shadows.modal,
          }}
        >
          <View nativeID="browse-leave-title">
            <Heading level="prompt">{m.title}</Heading>
          </View>
          <Spacer size="lg" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={{ flexGrow: 1, flexBasis: 0, minWidth: spacing.jumbo * 2 }}>
              <Button label={m.keep.cta} tone="ghost" size="md" fullWidth onPress={onKeep} testID="browse-leave-keep" />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 0, minWidth: spacing.jumbo * 2 }}>
              <Button label={m.leave.cta} tone="primary" size="md" fullWidth onPress={onLeave} testID="browse-leave-confirm" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
