import React, { useContext, useEffect, useId, useRef } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors, radii, shadows, spacing } from '../../tokens';
import { Button } from '../Button';
import { Body, Heading } from '../Heading';
import { useLayoutClass } from '../Layout';
import { Spacer } from '../Spacer';
import {
  CONFIRM_SHEET_DIALOG_MAX,
  CONFIRM_SHEET_ORDER,
  CONFIRM_SHEET_TONE,
  confirmSheetKey,
  confirmSheetLayout,
  type ConfirmSheetAction,
  type ConfirmSheetLayout,
} from './logic';
import type { ConfirmSheetProps } from './types';

/**
 * ConfirmSheet — the app's one confirm (design/components/ConfirmSheet/as-built.md). It replaces the platform
 * dialogs: the browser's `confirm()` showed OK / Cancel in the browser's language and never the app's own
 * words. A bottom sheet over the `surface.overlay` scrim on a phone, a centred dialog from the regular class.
 *
 * Keep comes first: the filled button, focused on open; Escape, the Android back button and a tap on the scrim
 * keep too. Confirm is an outline button under it, never red. On the web Tab and Shift+Tab stay on the two
 * buttons (react-native-web's modal also brings a stray focus back and returns focus to the opener on close).
 * The labels arrive localised; the design system holds no copy.
 */

type KeyListener = (event: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; preventDefault: () => void }) => void;
interface KeyTarget {
  addEventListener: (type: 'keydown', listener: KeyListener) => void;
  removeEventListener: (type: 'keydown', listener: KeyListener) => void;
  activeElement?: unknown;
}
type Focusable = { focus?: () => void };

const webDocument = (): KeyTarget | null => {
  if (Platform.OS !== 'web') return null;
  const doc = (globalThis as { document?: KeyTarget }).document;
  return doc && typeof doc.addEventListener === 'function' ? doc : null;
};

export function ConfirmSheet(props: ConfirmSheetProps): React.ReactElement {
  const layout = confirmSheetLayout(useLayoutClass().width);
  // One answer per opening across every way out: the buttons, the scrim, Escape and the modal's own close (Escape's
  // keydown and then the modal's close, or the Android back button) all go through `once`.
  const settled = useRef(false);
  useEffect(() => {
    if (props.visible) settled.current = false;
  }, [props.visible]);
  const once = (answer: () => void) => (): void => {
    if (settled.current) return;
    settled.current = true;
    answer();
  };
  const onKeep = once(props.onKeep);
  const onConfirm = once(props.onConfirm);
  return (
    <Modal visible={props.visible} transparent animationType={layout === 'dialog' ? 'fade' : 'slide'} onRequestClose={onKeep}>
      {props.visible ? <ConfirmSheetBody {...props} onKeep={onKeep} onConfirm={onConfirm} layout={layout} /> : null}
    </Modal>
  );
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/** The sheet itself, without the modal: what `ConfirmSheet` shows (exported for render tests). */
export function ConfirmSheetBody({
  title,
  message,
  keepLabel,
  confirmLabel,
  onKeep,
  onConfirm,
  testID,
  layout,
}: Omit<ConfirmSheetProps, 'visible'> & { layout: ConfirmSheetLayout }): React.ReactElement {
  const titleId = `confirm-sheet-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const messageId = `${titleId}-message`;
  // The bottom sheet sits above the home indicator of a notched phone or an iOS home-screen app (the nearest
  // provider's insets, as Screen reads them); the centred dialog needs none.
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const nodes = useRef<Record<ConfirmSheetAction, View | null>>({ keep: null, confirm: null });
  // One choice per opening: Escape's keydown and the modal's own keyup (or a double tap) never answer twice.
  const settled = useRef(false);
  const choose = (action: ConfirmSheetAction): void => {
    if (settled.current) return;
    settled.current = true;
    if (action === 'keep') onKeep();
    else onConfirm();
  };
  const keepRef = useRef(choose);
  keepRef.current = choose;

  useEffect(() => {
    const doc = webDocument();
    // Keep has the focus when the sheet opens (the modal mounts its content first, so wait a frame).
    const timer = setTimeout(() => (nodes.current.keep as Focusable | null)?.focus?.(), 0);
    if (!doc) return () => clearTimeout(timer);
    const onKey: KeyListener = (event) => {
      const order = CONFIRM_SHEET_ORDER.map((a) => nodes.current[a] as Focusable | null);
      const result = confirmSheetKey(event, order.indexOf(doc.activeElement as Focusable | null), order.length);
      if (result === null) return;
      event.preventDefault();
      if (result.kind === 'keep') keepRef.current('keep');
      else order[result.index]?.focus?.();
    };
    doc.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      doc.removeEventListener('keydown', onKey);
    };
  }, []);

  const dialog = layout === 'dialog';
  const labels: Readonly<Record<ConfirmSheetAction, string>> = { keep: keepLabel, confirm: confirmLabel };
  return (
    <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay, padding: dialog ? spacing.xl : 0 }}>
      {/* The sheet comes first in the tree, so the modal's focus trap lands on Keep, never on the scrim. */}
      <View
        role="alertdialog"
        aria-modal
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        testID={testID}
        style={{
          zIndex: 1,
          width: '100%',
          maxWidth: dialog ? CONFIRM_SHEET_DIALOG_MAX : undefined,
          backgroundColor: colors.surface.paper,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          borderBottomLeftRadius: dialog ? radii.xl : 0,
          borderBottomRightRadius: dialog ? radii.xl : 0,
          paddingTop: spacing.xl,
          paddingBottom: dialog ? spacing.xl : spacing.xl + insets.bottom,
          paddingHorizontal: spacing.lg,
          ...shadows.modal,
        }}
      >
        <View id={titleId}>
          <Heading level="prompt">{title}</Heading>
        </View>
        {message ? (
          <>
            <Spacer size="xs" />
            <View id={messageId}>
              <Body tone="secondary">{message}</Body>
            </View>
          </>
        ) : null}
        <Spacer size="lg" />
        <View style={{ gap: spacing.sm }}>
          {CONFIRM_SHEET_ORDER.map((action) => (
            <Button
              key={action}
              label={labels[action]}
              tone={CONFIRM_SHEET_TONE[action]}
              size={action === 'keep' ? 'lg' : 'md'}
              fullWidth
              onPress={() => choose(action)}
              pressableRef={(node) => {
                nodes.current[action] = node;
              }}
              testID={testID ? `${testID}-${action}` : undefined}
            />
          ))}
        </View>
      </View>
      {/* The scrim keeps; it is not a control of its own (the Keep button is). */}
      <Pressable
        onPress={() => choose('keep')}
        accessible={false}
        focusable={false}
        importantForAccessibility="no"
        aria-hidden
        testID={testID ? `${testID}-scrim` : undefined}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }}
      />
    </View>
  );
}
