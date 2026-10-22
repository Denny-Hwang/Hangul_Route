import {
  Body,
  Button,
  ConfirmSheet,
  KOREAN_LINE_BREAK,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useTypeScale,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinkButton } from '../../components/LinkButton';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { needsFreshPin } from '../../logic/profiles/session';
import { useAccountStore } from '../../store/account-store';
import { removeLiveGuest } from '../../store/guest-remove';
import { useUiStore } from '../../store/ui-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2 and OQ-G4 (row GU-5; mock `design/screens/profiles/who-is-using-guest.md`
 * D13 to D15): the grown-up side of an unsaved first quest, a chunk of its own (`guest-keep.tsx` loads it, F-CURR-002
 * section 10), so the start bundle carries none of it. The post-build check fails if a start bundle carries this marker.
 */
export const SCREEN_CHUNK = 'screen-chunk:guest-keep';

/** The cub beside the row's text (People on this device, D17). */
const AVATAR_SIZE = 40;

/** [GU] What the first-quest row needs of the Grown-up area around it. */
export interface GuestRowActions {
  /** **Keep as a learner**: the two save steps inside this grown-up session (`CreateProfile { from: 'guest' }`). */
  onKeep: () => void;
  /** A fresh PIN for **Remove the first quest** (`PinEntry { next: 'FreshPin' }`), only when a PIN is stored. */
  onAskPin: () => void;
  /** Focus coming back to the Grown-up area (a PIN screen left without the PIN drops the Remove it was asked for). */
  subscribeFocus: (listener: () => void) => () => void;
}

/** [GU] The first-quest row and its two actions (section 9.2, D13 and D14). */
export function GuestPeopleRow({ first, actions }: { first: boolean; actions: GuestRowActions }): React.ReactElement {
  const messages = useMessages();
  const people = messages.caregiver.people;
  const pinSet = useAccountStore((s) => s.parentPinHash !== null);
  const lastPinVerifiedAt = useUiStore((s) => s.lastPinVerifiedAt);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Remove was pressed and the fresh PIN it asked for has not come back yet. */
  const pending = useRef(false);
  const { onAskPin, subscribeFocus } = actions;

  const stale = (): boolean => pinSet && needsFreshPin('remove', useUiStore.getState().lastPinVerifiedAt, Date.now());

  const askPin = useCallback((): void => {
    pending.current = true;
    onAskPin();
  }, [onAskPin]);

  // OA-D5b (3): the fresh PIN came back right; the sheet the Remove asked for opens now.
  useEffect(() => {
    if (!pending.current || needsFreshPin('remove', lastPinVerifiedAt, Date.now())) return;
    pending.current = false;
    setAsking(true);
  }, [lastPinVerifiedAt]);

  // A PIN screen left without a right PIN drops the Remove it was asked for.
  useEffect(
    () =>
      subscribeFocus(() => {
        if (pending.current && needsFreshPin('remove', useUiStore.getState().lastPinVerifiedAt, Date.now())) pending.current = false;
      }),
    [subscribeFocus],
  );

  const onRemove = (): void => {
    if (asking || busy) return;
    if (stale()) askPin();
    else setAsking(true);
  };

  const confirm = async (): Promise<void> => {
    if (busy) return;
    // The sheet may have stayed open past 2 minutes: the PIN is asked again, and the sheet opens once it is right.
    if (stale()) {
      setAsking(false);
      askPin();
      return;
    }
    setBusy(true);
    try {
      await removeLiveGuest();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <View
      role="group"
      aria-label={people.guestRow}
      testID="people-guest"
      style={{ borderTopWidth: first ? 0 : borderWidth.thin, borderTopColor: colors.border.subtle, paddingBottom: spacing.xs, gap: spacing.sm }}
    >
      <View style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <ProfileAvatar avatar={DEFAULT_AVATAR} size={AVATAR_SIZE} />
        <Body weight="semibold" style={{ flex: 1 }} testID="people-guest-label">
          {people.guestRow}
        </Body>
      </View>
      {flags.guestLessonEnabled ? <Button label={people.guestKeep} tone="ghost" size="md" fullWidth onPress={actions.onKeep} testID="people-guest-keep" /> : null}
      <PaperButton label={people.guestRemove} onPress={onRemove} testID="people-guest-remove" />
      <ConfirmSheet
        visible={asking}
        title={people.guestRemoveAsk}
        message={people.guestConfirm}
        cancelLabel={messages.common.buttons.cancel}
        confirmLabel={people.guestRemove}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void confirm()}
        testID="people-guest-sheet"
      />
    </View>
  );
}

/** The paper secondary of OA-0b D19 (as Remove from this device), never red: at least 64 high, the label wraps. */
function PaperButton({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }): React.ReactElement {
  const scale = useTypeScale();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        borderWidth: borderWidth.base,
        borderColor: colors.border.strong,
        backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
      })}
    >
      <Text
        {...KOREAN_LINE_BREAK}
        style={{
          fontSize: scale.size.body,
          lineHeight: scale.lineHeight(scale.size.body, 'tight'),
          fontWeight: typography.weight.bold,
          textAlign: 'center',
          color: colors.text.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * [GU] Section 9.2, D15: the guest-only gate. The L8 PIN setup a grown-up destination shows only because an unsaved
 * first quest is kept here (no PIN, no child profile) gains one sunken box: the line, and the quiet text button
 * **Remove the first quest**, which opens its ConfirmSheet (no fresh PIN: there is no PIN yet), then the sweep, then
 * `onRemoved` (the destination opens directly, as before the guest). Plain text in reading order, not a live region.
 */
export function GuestOnlyGateBox({ onRemoved }: { onRemoved: () => void }): React.ReactElement {
  const messages = useMessages();
  const people = messages.caregiver.people;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const done = await removeLiveGuest();
      setAsking(false);
      if (done) onRemoved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID="pin-guest-only" style={{ marginTop: spacing.sm, backgroundColor: colors.surface.sunken, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs }}>
      <Body>{people.guestOnlyGate}</Body>
      <LinkButton label={people.guestRemove} onPress={() => setAsking(true)} testID="pin-guest-remove" />
      <ConfirmSheet
        visible={asking}
        title={people.guestRemoveAsk}
        message={people.guestConfirm}
        cancelLabel={messages.common.buttons.cancel}
        confirmLabel={people.guestRemove}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void confirm()}
        testID="pin-guest-sheet"
      />
    </View>
  );
}
