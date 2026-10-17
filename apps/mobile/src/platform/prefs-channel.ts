import type { DeviceSettings } from '@hangul-route/content-schema';

/**
 * Cross-tab display record changes (owner items 6 and 7). Native variant: one app, one window,
 * so there is no other tab to tell and nothing to listen to; Metro picks `prefs-channel.web.ts`
 * for the web build.
 */

/** Tells the other tabs on this origin that the device record changed (no-op on native). */
export function postDeviceSettings(_value: DeviceSettings): void {}

/**
 * Calls `onRecord` with a record another tab posted and `onReturn` when this page comes back to
 * the front (no-op on native: the app re-reads nothing, it is the only writer). Returns the
 * unsubscribe.
 */
export function subscribeDeviceSettings(_onRecord: (value: DeviceSettings) => void, _onReturn: () => void): () => void {
  return () => undefined;
}
