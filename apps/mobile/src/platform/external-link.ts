import { getNetworkStateAsync } from 'expo-network';
import { Linking } from 'react-native';
import { isSafeHttpsUrl } from '../logic/story/safe-url';
import type { OpenLinkOutcome } from '../logic/story/source-link';

/**
 * Native: `Linking.openURL` has no pop-up rules, so a link waiting on the
 * grown-up gate opens by itself on return (`pendingLinkStep`).
 */
export const HAND_OFF_NEEDS_TAP = false;

/**
 * Whether the device says it has no connection. `Linking.openURL` resolves
 * as soon as the system browser takes the link, even offline, so the check
 * comes first. Only a definite "no" counts: an unknown state (null, or the
 * module failing) never blocks the hand-off.
 */
async function knownOffline(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

/**
 * Hands a source link to the system browser (F-STORY-002 §3.8). Native:
 * `Linking.openURL` in a try/catch like the Paywall; a refusal is reported,
 * never thrown. Anything but a plain `https:` link is refused here too, and
 * with no connection nothing is handed off and the caller says one is needed.
 * The web build uses `external-link.web.ts`.
 */
export async function openExternalUrl(url: string): Promise<OpenLinkOutcome> {
  if (!isSafeHttpsUrl(url)) return 'failed';
  if (await knownOffline()) return 'offline';
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
