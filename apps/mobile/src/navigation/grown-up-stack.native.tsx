import { Screen } from '@hangul-route/design-system';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { nativeSignInConfig, type NativeSignInConfig } from '../config/native-signin';
import type { NativeGateState } from '../logic/account/gate-state';
import { clearAccountQueries, type AccountQueryClient } from '../logic/account/queries';
import type { ClerkHost, ClerkHostProviderProps } from '../platform/clerk-host';
import { applyGateChange, applyGateToTokens, clerkTokens, ensureInstallSweep } from '../platform/clerk-token-cache.native';
import { reportCrash } from '../platform/crash-report';
import { AccountHostContext, ClerkMountContext, OFF_HOST, type AccountHost } from '../screens/account/account-host';
import { SignInScreen } from '../screens/account/SignInScreen.native';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { useAccountVisit } from '../store/account-visit';
import { onGrownUpSessionClosed } from '../store/grown-up-session';
import { nativeGateState, watchNativeGateState } from '../store/native-gate-state';
import type { GrownUpStackParamList, RootStackParamList } from './types';

/**
 * F-AUTH-004 sections 6.1, 6.2 and 7.4 (row NS-2; ND-9, ND-11, CS-N1, CS-N4, CS-N13): the Grown-up area on iOS and
 * Android.
 *
 * With the native account off (`EXPO_PUBLIC_NATIVE_SIGNIN` off, or no key this build accepts) the root stack's
 * `ParentDashboard` route is the dashboard itself, exactly as at the basis: no nested navigator, no Clerk.
 *
 * With it on, the route is `GrownUpStack`: a nested stack whose first screen is the dashboard under the same route
 * name, so every `navigate('ParentDashboard')`, the PIN screen's `next`, the header registry and the session rules
 * (`routeZone`, `leaveGrownUpAreaOnClose`) read it as before, and the account routes of rows NS-3 to NS-6 join it.
 * Clerk's provider wraps this nested navigator, never the root one: mounting a provider around the root navigator
 * later would remount it and reset the learner's navigation. The provider is mounted only while the Grown-up area is
 * on the stack (it is reached through the grown-up gate, and popped when the grown-up session closes, OA-2), and only
 * once:
 * 1. the install sweep is complete in this run (section 6.2, CS-N7);
 * 2. the gate state is known and is `pin` or `open` (section 7.2; `nopin` never opens the account, `unknown` decides
 *    nothing), and the token storage follows it (a kept session only on `pin`, ND-9). On `open`, Clerk's session from
 *    an earlier visit is signed out first: Clerk's Expo SDK keeps one instance for the whole run, so unmounting the
 *    provider is not a sign-out (`ClerkHost.endSession`).
 * Until then the dashboard shows without Clerk (`ClerkMountContext` says which), and a learner screen never mounts it.
 * A Clerk render error falls back to the dashboard without Clerk, so the local tools stay. While the area is open, a
 * change of the gate state that leaves `pin` signs out and deletes the kept session (`applyGateChange`). Every session
 * close, and the area's unmount, clears the account queries (CS-N4).
 *
 * The same-named nested route makes React Navigation print a development-only warning about nested screens sharing
 * a name; it is intended here (section 6.1: "route names unchanged").
 */

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

export type ClerkMount =
  | { state: 'pending' }
  | { state: 'off' }
  | { state: 'ready'; Provider: ComponentType<ClerkHostProviderProps>; publishableKey: string; endSession: () => Promise<boolean> };

/** Whether Clerk's provider is above the Grown-up area's screens (defined beside the account screens, which read it). */
export { ClerkMountContext };

const OFF: ClerkMount = { state: 'off' };

export interface ClerkMountDeps {
  config: NativeSignInConfig;
  sweep: () => Promise<boolean>;
  gate: () => Promise<NativeGateState>;
  applyGate: (gate: NativeGateState, phase: 'mount') => Promise<boolean>;
  load: () => Promise<{ clerkHost: ClerkHost }>;
}

const defaultDeps: ClerkMountDeps = {
  config: nativeSignInConfig(),
  sweep: ensureInstallSweep,
  gate: () => nativeGateState(),
  applyGate: applyGateToTokens,
  // `platform/clerk` resolves to `clerk.native.tsx` here; loaded only now, so no Clerk code runs before.
  load: () => import('../platform/clerk'),
};

/**
 * Whether Clerk may mount for this visit of the Grown-up area, and with which provider. Never throws. `current` says
 * whether this visit still waits for the answer: once it does not (the wait ran out, the area closed), nothing more
 * is done, so a late answer never changes the token storage another visit set.
 */
export async function prepareClerkMount(deps: ClerkMountDeps = defaultDeps, current: () => boolean = () => true): Promise<ClerkMount> {
  try {
    const key = deps.config.publishableKey;
    if (!deps.config.enabled || key === null) return OFF;
    if (!(await deps.sweep()) || !current()) return OFF;
    const gate = await deps.gate();
    if (gate.state === 'unknown' || !current()) return OFF;
    if (gate.state === 'pin') {
      await deps.applyGate(gate, 'mount');
    } else {
      // `open` or `nopin`: no session outlives a visit here (ND-9). Clerk's own session first, while its token can
      // still reach Clerk; then every kept or memory item goes.
      const { clerkHost } = await deps.load();
      if (!current()) return OFF;
      await clerkHost.endSession();
      await deps.applyGate(gate, 'mount');
      if (gate.state === 'nopin') return OFF;
    }
    if (!current()) return OFF;
    const { clerkHost } = await deps.load();
    return clerkHost.Provider === null ? OFF : { state: 'ready', Provider: clerkHost.Provider, publishableKey: key, endSession: clerkHost.endSession };
  } catch {
    return OFF;
  }
}

/**
 * How long the Grown-up area waits for the decision before it shows without Clerk for this visit (a SecureStore or
 * storage read that never answers must not hold the local tools back). A late answer is then ignored: switching the
 * provider in later would remount the nested navigator.
 */
export const CLERK_MOUNT_WAIT_MS = 2000;

/**
 * The query client of the Grown-up area last mounted. Kept at module level so a session close that runs after the
 * area unmounted (the chooser, leaving the stack: the navigation state event comes after the commit) still clears
 * the account queries.
 */
let accountQueries: AccountQueryClient | null = null;

/**
 * Every session close clears the account queries (CS-N4) and ends the visit's memory (the sign-in time and this
 * visit's sign-in, section 13.1); registered once, with the native account on.
 */
export function bindAccountQueryClearing(): () => void {
  return onGrownUpSessionClosed(() => {
    useAccountVisit.getState().endVisit();
    if (accountQueries !== null) void clearAccountQueries(accountQueries);
  });
}

/**
 * The nested stack (its routes keep the root's names, so the header registry and the session rules read them as before),
 * with the account routes of rows NS-3 to NS-6 (`AccountStackParamList`): row NS-3's `SignIn`.
 */
const Stack = createNativeStackNavigator<GrownUpStackParamList>();

/** A Clerk render error: the area goes on without Clerk; the crash report names the class only (CS-N15). */
function reportClerkError(error: unknown): void {
  const scrubbed = new Error('');
  scrubbed.name = error instanceof Error ? error.name : 'Error';
  reportCrash(scrubbed, 'learner', 'ParentDashboard');
}

function WithClerk({ mount, fallback }: { mount: Extract<ClerkMount, { state: 'ready' }>; fallback: ReactNode }): ReactElement {
  const { Provider, publishableKey } = mount;
  return (
    <ErrorBoundary fallback={<ClerkMountContext.Provider value="off">{fallback}</ClerkMountContext.Provider>} onError={reportClerkError}>
      <Provider publishableKey={publishableKey}>{fallback}</Provider>
    </ErrorBoundary>
  );
}

export function GrownUpStack({ route }: Props): ReactElement {
  const [mount, setMount] = useState<ClerkMount>({ state: 'pending' });
  // Bumped by the account card's Try again: the provider is decided again (the navigator below remounts with it).
  const [attempt, setAttempt] = useState(0);
  const queryClient = useQueryClient();
  useEffect(() => {
    accountQueries = queryClient;
    // A new visit: an earlier visit's sign-in no longer counts (ND-9), nor its sign-in time (ND-5).
    useAccountVisit.getState().endVisit();
    return () => {
      void clearAccountQueries(queryClient);
    };
  }, [queryClient]);
  useEffect(() => {
    let settled = false;
    const settle = (next: ClerkMount): void => {
      if (settled) return;
      settled = true;
      setMount(next);
    };
    const timer = setTimeout(() => settle(OFF), CLERK_MOUNT_WAIT_MS);
    void prepareClerkMount(defaultDeps, () => !settled).then(settle);
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [attempt]);
  const endSession = mount.state === 'ready' ? mount.endSession : null;
  useEffect(() => (endSession === null ? undefined : watchNativeGateState((gate) => void applyGateChange(gate, endSession))), [endSession]);
  // The card calls it only while it reads `off` (no provider for this visit, or the provider fell back after an error).
  const retry = useCallback(() => {
    setMount({ state: 'pending' });
    setAttempt((n) => n + 1);
  }, []);
  const host = useMemo<AccountHost>(
    () => ({
      mount: mount.state,
      endSession: endSession ?? OFF_HOST.endSession,
      // Read at the call: the token cache of this run (section 6.2).
      wipeTokens: () => clerkTokens.wipe(),
      retry,
    }),
    [mount.state, endSession, retry],
  );

  if (mount.state === 'pending') return <Screen tone="canvas">{null}</Screen>;
  const navigator = (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} initialParams={route.params} />
      {/* F-AUTH-004 section 6.3 (row NS-3): the grown-up sign-in, reached from the account card (and the rows of NS-4). */}
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
  return (
    <AccountHostContext.Provider value={host}>
      <ClerkMountContext.Provider value={mount.state}>{mount.state === 'ready' ? <WithClerk mount={mount} fallback={navigator} /> : navigator}</ClerkMountContext.Provider>
    </AccountHostContext.Provider>
  );
}

/** The root stack's `ParentDashboard` component on iOS and Android (decided once: the build's values never change). */
export const GrownUpArea: ComponentType<Props> = defaultDeps.config.enabled ? GrownUpStack : ParentDashboardScreen;

if (defaultDeps.config.enabled) bindAccountQueryClearing();
