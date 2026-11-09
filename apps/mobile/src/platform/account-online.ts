import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

/**
 * F-AUTH-004 sections 6.3 and 12 (row NS-3): whether the device has a network, for the native account screens only
 * (the sign-in disables the buttons that call Clerk offline; the account card disables Sign in). `platform/online.ts`
 * answers true on native for every other screen (F-APP-001: no native grown-up entry read it), and stays so; this
 * module reads `expo-network` instead. `isInternetReachable` false counts as offline; unknown counts as online, so a
 * platform that cannot tell never locks a grown-up out. Only native code imports it.
 */

export type AccountOnlineListener = (online: boolean) => void;

function onlineOf(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }): boolean {
  if (state.isConnected === false) return false;
  return state.isInternetReachable !== false;
}

/** The network state now (online when it cannot be read). */
export async function readAccountOnline(): Promise<boolean> {
  try {
    return onlineOf(await getNetworkStateAsync());
  } catch {
    return true;
  }
}

/** Calls `listener` on every change of the network state. Returns the unsubscribe. */
export function subscribeAccountOnline(listener: AccountOnlineListener): () => void {
  try {
    const subscription = addNetworkStateListener((state) => listener(onlineOf(state)));
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}
