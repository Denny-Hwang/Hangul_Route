import type { NativeAuthTelemetryPayload } from '@hangul-route/content-schema/native-auth-telemetry';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { clearAccountQueries } from '../../logic/account/queries';
import { signOutOfAccount } from '../../logic/account/sign-out';
import { readAccountOnline, subscribeAccountOnline } from '../../platform/account-online';
import { readTrust, removeRecord } from '../../platform/account-records';
import { track } from '../../platform/telemetry';
import { useAccountVisit } from '../../store/account-visit';
import { nativeGateState } from '../../store/native-gate-state';
import { AccountHostContext } from './account-host';

/**
 * F-AUTH-004 sections 6.6, 12 and 15 (rows NS-3, NS-4): what the sign-in screen, the account card and `AccountGate`
 * share on iOS and Android: the network state, the decision moments (mount, focus, return to `active`), Sign out, and
 * the `auth.native.signin`, `.signout` and `.lock` events.
 */

/** The OS an `auth.native.*` event names, or null where none is sent (a render of another platform). */
export function nativeOs(): 'ios' | 'android' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

/** `auth.native.signin` (section 15: once per flow; the payload holds codes and one boolean, never an email). */
export function trackSignIn(payload: NativeAuthTelemetryPayload<'auth.native.signin'>): void {
  void track({ name: 'auth.native.signin', payload: { ...payload } });
}

/** `auth.native.signout { os, via }` (section 15). */
export function trackSignOut(via: 'user' | 'lock'): void {
  const os = nativeOs();
  if (os === null) return;
  const payload: NativeAuthTelemetryPayload<'auth.native.signout'> = { os, via };
  void track({ name: 'auth.native.signout', payload: { ...payload } });
}

/** `auth.native.lock { os, cause }` (section 15, row NS-4: at most once per account screen mount). */
export function trackLock(cause: NativeAuthTelemetryPayload<'auth.native.lock'>['cause']): void {
  const os = nativeOs();
  if (os === null) return;
  const payload: NativeAuthTelemetryPayload<'auth.native.lock'> = { os, cause };
  void track({ name: 'auth.native.lock', payload: { ...payload } });
}

/** `auth.native.home { os, use, spaces }` (section 15, row NS-5: once per home mount, after its first successful load). */
export function trackHome(use: NativeAuthTelemetryPayload<'auth.native.home'>['use'], spaces: NativeAuthTelemetryPayload<'auth.native.home'>['spaces']): void {
  const os = nativeOs();
  if (os === null) return;
  const payload: NativeAuthTelemetryPayload<'auth.native.home'> = { os, use, spaces };
  void track({ name: 'auth.native.home', payload: { ...payload } });
}

/**
 * Whether the device has a network (`expo-network`), kept current; online until the first answer. `active` false
 * (the native account off, row NS-4) subscribes to nothing and answers online.
 */
export function useAccountOnline(active = true): boolean {
  return useAccountNetwork(active).online;
}

/**
 * Row NS-5: the network state with a way to read it again now (a home's Try again while offline asks once more,
 * besides the subscription that reloads it when the network returns).
 */
export function useAccountNetwork(active = true): { online: boolean; recheck: () => void } {
  const [online, setOnline] = useState(true);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    if (!active) return undefined;
    void readAccountOnline().then((value) => {
      if (live.current) setOnline(value);
    });
    const stop = subscribeAccountOnline((value) => {
      if (live.current) setOnline(value);
    });
    return () => {
      live.current = false;
      stop();
    };
  }, [active]);
  const recheck = useCallback(() => {
    if (!active) return;
    void readAccountOnline().then((value) => {
      if (live.current) setOnline(value);
    });
  }, [active]);
  return { online: active ? online : true, recheck };
}

/** The part of the navigation object the decision moments need. */
export interface FocusSource {
  addListener: (event: 'focus', callback: () => void) => () => void;
}

/**
 * Calls `decide` on mount, on every focus of the screen, and on every return of the app to `active` (section 7.2):
 * those moments only, whatever `decide` closes over (the latest one is called), so a new render never decides again.
 */
export function useDecisionMoments(navigation: FocusSource, decide: () => void): void {
  const latest = useRef(decide);
  latest.current = decide;
  useEffect(() => {
    const run = (): void => latest.current();
    run();
    const offFocus = navigation.addListener('focus', run);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      offFocus();
      sub.remove();
    };
  }, [navigation]);
}

/**
 * Section 6.6: Sign out (`user`) and the lock's Sign in again (`lock`), with this area's Clerk session, token cache
 * and query client (`signOutOfAccount` holds the order). Resolves to whether every local delete answered.
 */
export function useAccountSignOut(): (via: 'user' | 'lock') => Promise<boolean> {
  return useSignOutWith(trackSignOut);
}

/**
 * Sections 6.6 and 8.8 (row NS-5): a session Clerk ended elsewhere (an account route answered `401`) reads as signed
 * out: the same steps as Sign out (Clerk's session, every kept item, the uses record, the trust and the notice, the
 * queries, this visit's memory), and no `auth.native.signout`: nobody signed out here.
 */
export function useAccountSessionEnded(): () => Promise<boolean> {
  const signOut = useSignOutWith(() => undefined);
  return useCallback(() => signOut('user'), [signOut]);
}

function useSignOutWith(trackVia: (via: 'user' | 'lock') => void): (via: 'user' | 'lock') => Promise<boolean> {
  const host = useContext(AccountHostContext);
  const queryClient = useQueryClient();
  return useCallback(
    (via) =>
      signOutOfAccount(
        {
          endSession: host.endSession,
          wipeTokens: host.wipeTokens,
          gate: () => nativeGateState(),
          readTrust,
          removeRecord,
          clearQueries: () => clearAccountQueries(queryClient),
          forgetVisit: () => useAccountVisit.getState().forget(),
          track: trackVia,
        },
        via,
      ),
    // `trackVia` is one of this module's two functions, fixed for the hook's caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [host, queryClient],
  );
}
