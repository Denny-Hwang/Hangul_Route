import { formatDate } from '@hangul-route/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useLocale } from '../../i18n/use-messages';
import type { DeviceFacts } from '../../logic/transfers/consent-gate';
import { moveEntry, type DateFormat } from '../../logic/transfers/transfer-views';
import { isParentSessionValid } from '../../logic/profiles/session';
import type { RootStackParamList } from '../../navigation/types';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { useMembershipStore, type LearnerTransfers } from '../../store/membership-store';
import { useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';

/**
 * Hooks the class-move surfaces share — F-SPACE-002 section 4.12, T-7b / T-7c. They only read stores
 * and hand the facts to the tested pure views (`logic/transfers`); no rule lives here.
 */

const MINUTE = 60 * 1000;

/**
 * A coarse clock: the time now, read again every minute and whenever the app comes back to the front, so a
 * PIN that turns one day old (d' to c) and a grown-up session that lapses are seen while a surface stays open.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = (): void => setNow(Date.now());
    const timer = setInterval(tick, MINUTE);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}

/** What the device knows for the move rules (`consent-gate.ts` `DeviceFacts`), or null for an unknown profile. */
export function useTransferDevice(profileId: string | undefined): DeviceFacts | null {
  const profiles = useProfileStore((s) => s.profiles);
  const selfConsentAcceptedAt = useAccountStore((s) => s.selfConsentAcceptedAt);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const pinCreatedAt = useAccountStore((s) => s.pinCreatedAt);
  const now = useMinuteClock();
  const profile = profiles.find((p) => p.id === profileId);
  return useMemo(
    () => (profile ? { profile, profiles, selfConsentAcceptedAt, parentPinHash, pinCreatedAt, now } : null),
    [profile, profiles, selfConsentAcceptedAt, parentPinHash, pinCreatedAt, now],
  );
}

/** The learner's transfer fields from the last inbox of this session (in memory only), or null. */
export function useLearnerTransfers(profileId: string | undefined): LearnerTransfers | null {
  return useMembershipStore((s) => (profileId === undefined ? null : (s.transfersByLearner[profileId] ?? null)));
}

/** A short date in the UI locale ("Oct 14"). */
export function useMoveDate(): DateFormat {
  const locale = useLocale();
  return useCallback((iso: string) => formatDate(locale, iso, 'monthDay'), [locale]);
}

/** Whether the grown-up gate is open right now (a PIN entered within the session, F-PROF-001). */
export function useGateOpen(): boolean {
  const openedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  const now = useMinuteClock();
  return opensDirectly(isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, now));
}

/**
 * On a managed device the PIN for a move screen is entered for that screen only (`moveEntry`): the grown-up
 * session ends however the screen is left (Done, Back, a hardware or browser back), as `NoteReportScreen` does,
 * so the learner never inherits it. A self-only device with no PIN has no session to end.
 */
export function useEndsGateOnLeave(navigation: { addListener: (event: 'beforeRemove', fn: () => void) => () => void }): { readonly current: boolean } {
  const { opensDirectly } = useAudience();
  const managed = !opensDirectly(false);
  // Set once the screen is on its way out, so its closed-gate redirect does not reopen the PIN screen.
  const leaving = useRef(false);
  useEffect(() => {
    if (!managed) return undefined;
    return navigation.addListener('beforeRemove', () => {
      leaving.current = true;
      useUiStore.getState().resetParentGate();
    });
  }, [managed, navigation]);
  useEffect(() => (managed ? () => useUiStore.getState().resetParentGate() : undefined), [managed]);
  return leaving;
}

export type MoveTarget =
  | { screen: 'MoveClass'; profileId: string; fromSpaceId: string }
  | { screen: 'ApproveTransfer'; profileId: string; transferId: string };

/**
 * Opens a move screen: directly only on a self-only device with no PIN, otherwise through the PIN screen
 * every time (`moveEntry`: the card and the Home line are learner surfaces, so a lingering grown-up session
 * never carries a move). A managed device with no PIN gets the existing PIN setup first (`initialPinMode`),
 * then the screen (D24).
 */
export function useOpenMove(): (target: MoveTarget) => void {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gateOpen = useGateOpen();
  const { opensDirectly } = useAudience();
  const gated = !opensDirectly(false);
  return useCallback(
    (target: MoveTarget) => {
      const direct = moveEntry({ gateOpen, gated }) === 'direct';
      if (target.screen === 'MoveClass') {
        if (direct) navigation.navigate('MoveClass', { profileId: target.profileId, fromSpaceId: target.fromSpaceId });
        else navigation.navigate('PinEntry', { next: 'MoveClass', profileId: target.profileId, fromSpaceId: target.fromSpaceId });
        return;
      }
      if (direct) navigation.navigate('ApproveTransfer', { profileId: target.profileId, transferId: target.transferId });
      else navigation.navigate('PinEntry', { next: 'ApproveTransfer', profileId: target.profileId, transferId: target.transferId });
    },
    [gateOpen, gated, navigation],
  );
}
