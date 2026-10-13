import { formatDate } from '@hangul-route/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useLocale } from '../../i18n/use-messages';
import type { DeviceFacts } from '../../logic/transfers/consent-gate';
import type { DateFormat } from '../../logic/transfers/transfer-views';
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

/** What the device knows for the move rules (`consent-gate.ts` `DeviceFacts`), or null for an unknown profile. */
export function useTransferDevice(profileId: string | undefined): DeviceFacts | null {
  const profiles = useProfileStore((s) => s.profiles);
  const selfConsentAcceptedAt = useAccountStore((s) => s.selfConsentAcceptedAt);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const pinCreatedAt = useAccountStore((s) => s.pinCreatedAt);
  const profile = profiles.find((p) => p.id === profileId);
  return useMemo(
    () => (profile ? { profile, profiles, selfConsentAcceptedAt, parentPinHash, pinCreatedAt, now: Date.now() } : null),
    [profile, profiles, selfConsentAcceptedAt, parentPinHash, pinCreatedAt],
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
  return opensDirectly(isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, Date.now()));
}

export type MoveTarget =
  | { screen: 'MoveClass'; profileId: string; fromSpaceId: string }
  | { screen: 'ApproveTransfer'; profileId: string; transferId: string };

/**
 * Opens a move screen: directly when the gate opens directly (a self-only device with no PIN, or an open
 * grown-up session), otherwise through the PIN screen. A managed device with no PIN gets the existing
 * PIN setup first (`initialPinMode`), then the screen (D24).
 */
export function useOpenMove(): (target: MoveTarget) => void {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gateOpen = useGateOpen();
  return useCallback(
    (target: MoveTarget) => {
      if (target.screen === 'MoveClass') {
        if (gateOpen) navigation.navigate('MoveClass', { profileId: target.profileId, fromSpaceId: target.fromSpaceId });
        else navigation.navigate('PinEntry', { next: 'MoveClass', profileId: target.profileId, fromSpaceId: target.fromSpaceId });
        return;
      }
      if (gateOpen) navigation.navigate('ApproveTransfer', { profileId: target.profileId, transferId: target.transferId });
      else navigation.navigate('PinEntry', { next: 'ApproveTransfer', profileId: target.profileId, transferId: target.transferId });
    },
    [gateOpen, navigation],
  );
}
