import React, { useEffect, useId, useRef } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { KOREAN_LINE_BREAK } from '../../line-break';
import { Body, Heading } from '../Heading';
import { useLayoutClass } from '../Layout';
import { useTypeScale } from '../TextSize';
import { actionStyle, actionTextStyle, actionsStyle, backdropStyle, sheetStyle } from './style';
import type { ConfirmSheetProps } from './types';

type PressState = { pressed: boolean; focused?: boolean };
/** Anything React Native Web can move focus to (a host node on the web; absent on native). */
type Focusable = { focus?: () => void } | null;

/** The part of a key event the sheet reads. */
interface KeyEventLike {
  key?: string;
  repeat?: boolean;
  stopPropagation?: () => void;
}

interface DocumentLike {
  activeElement?: unknown;
  addEventListener?: (type: string, fn: (event: KeyEventLike) => void) => void;
  removeEventListener?: (type: string, fn: (event: KeyEventLike) => void) => void;
}

/** react-native-web's Modal answers Escape on keyup with `onRequestClose`; the sheet answers it once, on keydown. */
const ignore = (): void => undefined;

const webDocument = (): DocumentLike | undefined => (Platform.OS === 'web' ? (globalThis as { document?: DocumentLike }).document : undefined);

/**
 * ConfirmSheet — the one confirm step of the learner web build (design/components/ConfirmSheet/
 * spec.md; AMENDMENTS-DISPLAY-NAV section 8), in place of the browser's `confirm()`: its title,
 * message and buttons are in the UI language, the safe choice comes first and takes focus, and it
 * works in an installed iOS app. `role="alertdialog"`, modal, named by its title and described by
 * its message; a bottom sheet on a phone and a centred dialog from the regular class. Escape and
 * the backdrop cancel; focus goes back to the control that opened it. No copy of its own.
 *
 * On the web one Escape press is one cancel: the sheet answers its keydown (a held key's repeats
 * are ignored) and stops it there, so a page's own Escape (an All lessons card page closing) does
 * not also run under the sheet; react-native-web's Modal would answer the same press again on
 * keyup, so its `onRequestClose` is the system back of native only. The backdrop is hidden from
 * assistive tech: the sheet's own Cancel is the one control with that name.
 */
export function ConfirmSheet({ visible, title, message, cancelLabel, confirmLabel, onCancel, onConfirm, testID = 'confirm-sheet' }: ConfirmSheetProps): React.ReactElement {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const titleId = `${testID}-title-${id}`;
  const messageId = `${testID}-message-${id}`;
  const dialog = useLayoutClass().width !== 'compact';
  const scale = useTypeScale();
  const cancelRef = useRef<Focusable>(null);
  const openerRef = useRef<Focusable>(null);

  // The safe choice takes focus when the sheet opens; the opener gets it back when it closes.
  useEffect(() => {
    const doc = webDocument();
    if (!visible || !doc) return undefined;
    openerRef.current = (doc.activeElement as Focusable) ?? null;
    cancelRef.current?.focus?.();
    const onKey = (event: KeyEventLike): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation?.();
      if (event.repeat !== true) onCancel();
    };
    doc.addEventListener?.('keydown', onKey);
    return () => {
      doc.removeEventListener?.('keydown', onKey);
      openerRef.current?.focus?.();
      openerRef.current = null;
    };
  }, [visible, onCancel]);

  const action = (kind: 'cancel' | 'confirm'): React.ReactElement => (
    <Pressable
      key={kind}
      ref={
        kind === 'cancel'
          ? (node: unknown) => {
              cancelRef.current = node as Focusable;
            }
          : undefined
      }
      testID={`${testID}-${kind}`}
      accessibilityRole="button"
      onPress={kind === 'cancel' ? onCancel : onConfirm}
      style={(state: PressState) => actionStyle(kind, dialog, state)}
    >
      <Text {...KOREAN_LINE_BREAK} style={actionTextStyle(kind, scale)}>
        {kind === 'cancel' ? cancelLabel : confirmLabel}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={Platform.OS === 'web' ? ignore : onCancel}>
      <View style={backdropStyle(dialog)}>
        <Pressable
          onPress={onCancel}
          accessible={false}
          focusable={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          {...{ tabIndex: -1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          testID={`${testID}-backdrop`}
        />
        <View
          role="alertdialog"
          aria-modal
          aria-labelledby={titleId}
          {...(message ? { 'aria-describedby': messageId } : {})}
          testID={testID}
          style={sheetStyle(dialog)}
        >
          <View nativeID={titleId} {...{ id: titleId }}>
            <Heading level="prompt">{title}</Heading>
          </View>
          {message ? (
            <View nativeID={messageId} {...{ id: messageId }}>
              <Body tone="secondary">{message}</Body>
            </View>
          ) : null}
          <View style={actionsStyle(dialog)}>
            {action('cancel')}
            {action('confirm')}
          </View>
        </View>
      </View>
    </Modal>
  );
}
