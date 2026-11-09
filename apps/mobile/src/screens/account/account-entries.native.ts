import type { GrownUpUse } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nativeSignInConfig } from '../../config/native-signin';
import { accountEntryFor, type AccountEntryUse } from '../../logic/account/account-entry';
import type { WhoMarker } from '../../logic/profiles/who';
import { readUsesRecord } from '../../platform/account-records';
import { trackGateOpened } from '../../store/gate-telemetry';
import { useUiStore } from '../../store/ui-store';
import type { EntryNavigation, FocusEvents, NativeAccountEntries } from './account-entries';
import { useAccountOnline } from './account-session.native';

/**
 * F-AUTH-004 sections 7.1, 12 and ND-5, ND-7, ND-9 (row NS-4; design `entries.md`): the native account entries outside
 * the Grown-up area, on iOS and Android only: the chooser's Grown-ups rows and Welcome's **Sign in as a grown-up**.
 * Reached only through an `EXPO_OS` test the web build folds away (`WhoIsUsingScreen`, `WelcomeScreen`), so the web
 * bundle never carries this module. It imports nothing of Clerk's: the chooser and Welcome never read Clerk (ND-11).
 */

/**
 * A native account entry pressed (a chooser row, Welcome's button): the typed PIN on a `pin` device (no face or
 * fingerprint, CS-N11), PIN setup on a `nopin` device (ND-7), or the account route at once where no PIN exists (the
 * route's `AccountGate` then decides on the exact gate state; `parent.gate.opened { dest: 'use', via: 'open' }`).
 */
export function openAccountEntry(navigation: EntryNavigation, use: AccountEntryUse, marker: WhoMarker): void {
  const entry = accountEntryFor(use, marker);
  if (entry.kind === 'pin') navigation.navigate('PinEntry', entry.params);
  else if (entry.kind === 'setup') navigation.navigate('PinEntry', { next: 'ParentDashboard' });
  else {
    trackGateOpened('GrownUpUse', 'open');
    // A session for this visit (ND-9): the 15-minute and 5-minute background rules then end it, and with it the
    // visit's sign-in and Clerk's memory session (the close ends them, `bindAccountQueryClearing`).
    useUiStore.getState().openParentGate();
    navigation.navigate('ParentDashboard', entry.route);
  }
}

/**
 * The chooser's native inputs: whether the native account is on (`nativeSignInConfig`, read once), the uses record
 * (read at every opening and every focus: a sign-in in the Grown-up area just wrote it), and the network.
 */
export function useNativeAccountEntries(navigation: FocusEvents, opening: unknown): NativeAccountEntries | undefined {
  const nativeAccount = useMemo(() => nativeSignInConfig().enabled, []);
  // CS-N13: with the native account off nothing is subscribed or read (the chooser is exactly as at the basis).
  const online = useAccountOnline(nativeAccount);
  // `undefined` until the record has been read: no account row is drawn before (a first frame never offers Sign in
  // where the record holds a use).
  const [record, setRecord] = useState<GrownUpUse[] | null | undefined>(undefined);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  const read = useCallback(() => {
    if (!nativeAccount) return;
    void readUsesRecord().then((uses) => {
      if (live.current) setRecord(uses);
    });
  }, [nativeAccount]);
  useEffect(() => {
    read();
  }, [read, opening]);
  useEffect(() => navigation.addListener('focus', read), [navigation, read]);
  return nativeAccount ? { nativeAccount, record, online } : undefined;
}
