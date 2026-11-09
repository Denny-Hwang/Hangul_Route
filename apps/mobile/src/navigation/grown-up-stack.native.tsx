import { Screen } from '@hangul-route/design-system';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ComponentType, type ReactElement } from 'react';
import { nativeSignInConfig, type NativeSignInConfig } from '../config/native-signin';
import type { NativeGateState } from '../logic/account/gate-state';
import type { ClerkHost, ClerkHostProviderProps } from '../platform/clerk-host';
import { applyGateToTokens, ensureInstallSweep } from '../platform/clerk-token-cache.native';
import { ParentDashboardScreen } from '../screens/parent/ParentDashboardScreen';
import { nativeGateState, watchNativeGateState } from '../store/native-gate-state';
import type { RootStackParamList } from './types';

/**
 * F-AUTH-004 sections 6.1, 6.2 and 7.4 (row NS-2; ND-11, CS-N1, CS-N13): the Grown-up area on iOS and Android.
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
 *    nothing), and the token storage follows it (a kept session only on `pin`, ND-9).
 * Until then the dashboard shows without Clerk; a learner screen never mounts it. While the area is open, a change of
 * the gate state that leaves `pin` deletes the kept session (`applyGateToTokens(..., 'change')`).
 *
 * The same-named nested route makes React Navigation print a development-only warning about nested screens sharing
 * a name; it is intended here (section 6.1: "route names unchanged").
 */

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

export type ClerkMount = { state: 'pending' } | { state: 'off' } | { state: 'ready'; Provider: ComponentType<ClerkHostProviderProps>; publishableKey: string };

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

/** Whether Clerk may mount for this visit of the Grown-up area, and with which provider. Never throws. */
export async function prepareClerkMount(deps: ClerkMountDeps = defaultDeps): Promise<ClerkMount> {
  try {
    const key = deps.config.publishableKey;
    if (!deps.config.enabled || key === null) return OFF;
    if (!(await deps.sweep())) return OFF;
    const gate = await deps.gate();
    if (gate.state === 'unknown') return OFF;
    await deps.applyGate(gate, 'mount');
    if (gate.state === 'nopin') return OFF;
    const { clerkHost } = await deps.load();
    return clerkHost.Provider === null ? OFF : { state: 'ready', Provider: clerkHost.Provider, publishableKey: key };
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

/** The nested stack (its routes keep the root's names, so the header registry and the session rules read them as before). */
const Stack = createNativeStackNavigator<RootStackParamList>();

export function GrownUpStack({ route }: Props): ReactElement {
  const [mount, setMount] = useState<ClerkMount>({ state: 'pending' });
  useEffect(() => {
    let settled = false;
    const settle = (next: ClerkMount): void => {
      if (settled) return;
      settled = true;
      setMount(next);
    };
    const timer = setTimeout(() => settle(OFF), CLERK_MOUNT_WAIT_MS);
    void prepareClerkMount().then(settle);
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);
  const ready = mount.state === 'ready';
  useEffect(() => (ready ? watchNativeGateState((gate) => void applyGateToTokens(gate, 'change')) : undefined), [ready]);

  if (mount.state === 'pending') return <Screen tone="canvas">{null}</Screen>;
  const navigator = (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} initialParams={route.params} />
    </Stack.Navigator>
  );
  if (mount.state !== 'ready') return navigator;
  const { Provider, publishableKey } = mount;
  return <Provider publishableKey={publishableKey}>{navigator}</Provider>;
}

/** The root stack's `ParentDashboard` component on iOS and Android (decided once: the build's values never change). */
export const GrownUpArea: ComponentType<Props> = defaultDeps.config.enabled ? GrownUpStack : ParentDashboardScreen;
