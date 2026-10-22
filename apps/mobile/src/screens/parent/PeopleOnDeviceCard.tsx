import type { Profile } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Card,
  ConfirmSheet,
  Heading,
  Icon,
  KOREAN_LINE_BREAK,
  Spacer,
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
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { isLiveGuest } from '../../logic/guest/guest-model';
import { DEFAULT_AVATAR } from '../../logic/profiles/avatar-catalog';
import { needsFreshPin } from '../../logic/profiles/session';
import { useAccountStore } from '../../store/account-store';
import { useGuestStore } from '../../store/guest-store';
import { removeLiveGuest } from '../../store/guest-sweep';
import { useLocks } from '../../store/profile-locks';
import { useUiStore } from '../../store/ui-store';

/** The cub beside each name (design/screens/profiles/people-on-device.md, D17). */
const AVATAR_SIZE = 40;
/** The lock glyph and the chevron. */
const GLYPH = 20;

/** [GU] Row GU-5: what the first-quest row needs of the Grown-up area around it. */
export interface GuestRowActions {
  /** **Keep as a learner**: the two save steps inside this grown-up session (`CreateProfile { from: 'guest' }`). */
  onKeep: () => void;
  /** A fresh PIN for **Remove the first quest** (`PinEntry { next: 'FreshPin' }`), only when a PIN is stored. */
  onAskPin: () => void;
  /** Focus coming back to the Grown-up area (a PIN screen left without the PIN drops the Remove it was asked for). */
  subscribeFocus: (listener: () => void) => () => void;
}

/**
 * [OA] **People on this device** (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 10.1, 10.4, row OA-7a; wireframe
 * `profiles/people-on-device.md` Panel A, mock boards 1 and 2): the Grown-up area lists **every** learner on the
 * device (F-PAR-001 section 3.5), one row each in creation order: the cub, the name, the lock glyph for a locked
 * profile and a chevron, at least 64 high. A tap opens the person page (lock switch, Edit profile, Remove from this
 * device) without asking the PIN, so a locked row is named "<name>, locked" (`a11y.who.lockedRow`), never "a PIN
 * opens it". The caller draws it only while `EXPO_PUBLIC_WHO_CHOOSER` is on.
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2 (row GU-5; mock `design/screens/profiles/who-is-using-guest.md` D13,
 * D14): after the people, one row for an unsaved first quest whenever a live record is kept here, whatever
 * `EXPO_PUBLIC_GUEST_LESSON` says (so a grown-up always sees and can remove the reason for a gate): the default cub
 * and **First quest, not saved**, not a button and no chevron (there is no person page for a guest), then **Keep as a
 * learner** (only with the switch on) and **Remove the first quest**, which asks a fresh PIN first only when a PIN is
 * stored, then its ConfirmSheet (Cancel first and focused, never the danger tone), then the sweep (`removeLiveGuest`).
 */
export function PeopleOnDeviceCard({
  profiles,
  onOpen,
  guest: actions,
}: {
  profiles: readonly Profile[];
  onOpen: (profileId: string) => void;
  guest: GuestRowActions;
}): React.ReactElement | null {
  const messages = useMessages();
  const learners = profiles.filter((p) => p.role === 'learner');
  const { locked } = useLocks(profiles);
  const record = useGuestStore((s) => s.record);
  const liveGuest = isLiveGuest(record, profiles);
  if (learners.length === 0 && !liveGuest) return null;
  return (
    <Card padding="md" testID="people-on-device">
      <Heading level="prompt">{messages.caregiver.people.title}</Heading>
      <Spacer size="xs" />
      {learners.map((p, i) => {
        const isLocked = locked.has(p.id);
        return (
          <Pressable
            key={p.id}
            onPress={() => onOpen(p.id)}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? messages.a11y.who.lockedRow(p.displayName) : p.displayName}
            testID={`people-row-${p.id}`}
            style={({ pressed }) => ({
              minHeight: touchTarget.min,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderTopWidth: i === 0 ? 0 : borderWidth.thin,
              borderTopColor: colors.border.subtle,
              backgroundColor: pressed ? colors.surface.sunken : 'transparent',
            })}
          >
            <ProfileAvatar avatar={p.avatar} size={AVATAR_SIZE} />
            <Body weight="semibold" style={{ flex: 1 }}>
              {p.displayName}
            </Body>
            {isLocked ? (
              <View testID={`people-row-lock-${p.id}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <Icon name="lock" size={GLYPH} color={colors.text.primary} />
              </View>
            ) : null}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
              <Icon name="arrow-right" size={GLYPH} color={colors.text.muted} />
            </View>
          </Pressable>
        );
      })}
      {liveGuest ? <GuestRow first={learners.length === 0} actions={actions} /> : null}
    </Card>
  );
}

/** [GU] The first-quest row and its two actions (section 9.2, D13 and D14). */
function GuestRow({ first, actions }: { first: boolean; actions: GuestRowActions }): React.ReactElement {
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
