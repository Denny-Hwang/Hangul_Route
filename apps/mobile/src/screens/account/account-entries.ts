import type { GrownUpUse } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nativeSignInConfig } from '../../config/native-signin';
import { accountEntryFor, type AccountEntryUse } from '../../logic/account/account-entry';
import type { NativeAccountRowsInput, WhoMarker } from '../../logic/profiles/who';
import type { RootStackParamList } from '../../navigation/types';
import { readUsesRecord } from '../../platform/account-records';
import { trackGateOpened } from '../../store/gate-telemetry';
import { useAccountOnline } from './account-session.native';

/**
 * F-AUTH-004 sections 7.1, 12 and ND-5, ND-7, ND-9 (row NS-4; design `entries.md`): the native account entries outside
 * the Grown-up area, on iOS and Android only: the chooser's Grown-ups rows and Welcome's **Sign in as a grown-up**.
 * Reached only through an `EXPO_OS` test the web build folds away (`WhoIsUsingScreen`, `WelcomeScreen`), so the web
 * bundle never carries this module. It imports nothing of Clerk's: the chooser and Welcome never read Clerk (ND-11).
 */

/** The navigation an entry needs (the root stack's, or its parent's from Welcome). */
export interface EntryNavigation {
  navigate: <K extends 'PinEntry' | 'ParentDashboard'>(name: K, params: RootStackParamList[K]) => void;
}

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
    navigation.navigate('ParentDashboard', entry.route);
  }
}

/** What the native chooser's rows read (`grownUpRows`'s `native` input) and the network the account rows need. */
export interface NativeAccountEntries extends NativeAccountRowsInput {
  /** `expo-network` (section 12): the account rows are disabled offline; the Grown-up area row is not. */
  online: boolean;
}

/** The part of the navigation object that tells when the screen comes back to the front. */
export interface FocusEvents {
  addListener: (event: 'focus', callback: () => void) => () => void;
}

/**
 * The chooser's native inputs: whether the native account is on (`nativeSignInConfig`, read once), the uses record
 * (read at every opening and every focus: a sign-in in the Grown-up area just wrote it), and the network.
 */
export function useNativeAccountEntries(navigation: FocusEvents, opening: unknown): NativeAccountEntries {
  const nativeAccount = useMemo(() => nativeSignInConfig().enabled, []);
  const online = useAccountOnline();
  const [record, setRecord] = useState<GrownUpUse[] | null>(null);
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
  return { nativeAccount, record, online };
}
