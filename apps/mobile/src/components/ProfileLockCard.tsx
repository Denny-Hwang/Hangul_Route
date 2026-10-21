import { Body, Caption, Card, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { needsFreshPin } from '../logic/profiles/session';
import { useAccountStore } from '../store/account-store';
import { setProfileLocked, useLocks } from '../store/profile-locks';
import { useProfileStore } from '../store/profile-store';
import { useUiStore } from '../store/ui-store';

export interface ProfileLockCardProps {
  profileId: string;
  /** Opens the PIN screen for a fresh PIN (`PinEntry { next: 'FreshPin' }`); the change applies once it is right. */
  onAskPin: () => void;
  /** The line shown when the lock could not be written (the caller's own words). */
  failedLine: string;
  /** Prefix of the switch, hint and failure line test ids (`<testID>-switch`, `-hint`, `-failed`). */
  testID: string;
}

/**
 * [OA] **Lock with the grown-up PIN** for one learner (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D9, OA-D5b (3), sections
 * 8.2, 8.4; wireframe `profiles/people-on-device.md` Panel B; rows OA-5 and OA-7a): a switch that acts at once. It
 * needs a PIN entered in the last 2 minutes (`needsFreshPin`), else it asks the PIN again (`onAskPin`) and applies the
 * change when that PIN is right; without a PIN it is disabled with **Set a grown-up PIN first.** Used by Edit profile
 * and the People on this device person page. Nothing here is synced.
 */
export function ProfileLockCard({ profileId, onAskPin, failedLine, testID }: ProfileLockCardProps): React.ReactElement {
  const messages = useMessages();
  const people = messages.caregiver.people;
  const pinSet = useAccountStore((s) => s.parentPinHash !== null);
  const allProfiles = useProfileStore((s) => s.profiles);
  const locks = useLocks(allProfiles);
  const lastPinVerifiedAt = useUiStore((s) => s.lastPinVerifiedAt);
  const isLocked = locks.locked.has(profileId);
  /** The lock change waiting for the fresh PIN it asked for, applied once that PIN is right. */
  const pendingLock = useRef<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const applyLock = async (on: boolean): Promise<void> => {
    setBusy(true);
    const ok = await setProfileLocked(profileId, on, useProfileStore.getState().profiles);
    setFailed(!ok);
    setBusy(false);
  };

  // OA-D5b (3): the fresh PIN came back right; the change it was asked for applies now.
  useEffect(() => {
    const pending = pendingLock.current;
    if (pending === null || needsFreshPin(pending ? 'lock' : 'unlock', lastPinVerifiedAt, Date.now())) return;
    pendingLock.current = null;
    void applyLock(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a PIN was entered
  }, [lastPinVerifiedAt]);

  const toggle = (on: boolean): void => {
    if (!pinSet || busy) return;
    setFailed(false);
    if (needsFreshPin(on ? 'lock' : 'unlock', useUiStore.getState().lastPinVerifiedAt, Date.now())) {
      pendingLock.current = on;
      onAskPin();
      return;
    }
    pendingLock.current = null;
    void applyLock(on);
  };

  const hint = pinSet ? people.lockHint : messages.caregiver.pin.needsPinFirst;
  return (
    <Card padding="md">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        <View style={{ flex: 1 }}>
          <Body weight="semibold">{people.lock}</Body>
          <Caption tone="secondary" testID={`${testID}-hint`}>
            {hint}
          </Caption>
        </View>
        <Switch
          testID={`${testID}-switch`}
          value={pinSet && isLocked}
          onValueChange={toggle}
          disabled={!pinSet || busy}
          accessibilityLabel={people.lock}
          accessibilityHint={hint}
          trackColor={{ true: colors.brand.primary, false: colors.border.strong }}
          thumbColor={colors.surface.paper}
        />
      </View>
      {failed ? (
        <>
          <Spacer size="xs" />
          <Caption tone="secondary" testID={`${testID}-failed`}>
            {failedLine}
          </Caption>
        </>
      ) : null}
    </Card>
  );
}
