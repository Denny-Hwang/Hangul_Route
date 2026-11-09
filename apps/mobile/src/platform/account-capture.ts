import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { Platform, Settings } from 'react-native';

/**
 * F-AUTH-004 section 7.4 (row NS-4; CS-N12, assumption U7, device check D5): capture protection while an account
 * screen is focused, on iOS and Android. Only native code imports this module (the account screens' `AccountGate`).
 *
 * - Android: `expo-screen-capture` sets `FLAG_SECURE` on the window, which keeps the content out of the recents
 *   thumbnail and blocks screenshots and screen recording.
 * - iOS: `expo-screen-capture` blocks screen recording (and screenshots where the platform allows it); the `NSUserDefaults`
 *   flag `hr.accountCover` turns on the native cover of `plugins/with-account-cover.js`, which hides the window from the
 *   app-switcher snapshot when the app resigns active (every launch clears the flag).
 * - The JavaScript cover on `AppState` changes (`AccountCover`) stays as a second layer.
 *
 * Held by count: several account screens may hold it across a navigation (the next one focuses before the last one
 * blurs), and it is released only when none holds it. Never throws: a platform that refuses keeps the other layers.
 */

/** The `expo-screen-capture` key of the account screens (other screens' keys are kept apart). */
export const ACCOUNT_CAPTURE_KEY = 'hr-account';
/** The `NSUserDefaults` key the iOS cover plugin reads (`plugins/with-account-cover.js`, `ACCOUNT_COVER_KEY`). */
export const ACCOUNT_COVER_SETTING = 'hr.accountCover';

let holders = 0;

function setCoverFlag(on: boolean): void {
  if (Platform.OS !== 'ios') return;
  try {
    Settings.set({ [ACCOUNT_COVER_SETTING]: on });
  } catch {
    // The native cover stays off; FLAG_SECURE (Android) and the JavaScript cover are other layers.
  }
}

function protect(on: boolean): void {
  setCoverFlag(on);
  try {
    const call = on ? preventScreenCaptureAsync(ACCOUNT_CAPTURE_KEY) : allowScreenCaptureAsync(ACCOUNT_CAPTURE_KEY);
    void Promise.resolve(call).catch(() => undefined);
  } catch {
    // A module that is missing (a test, an old build) leaves the other layers.
  }
}

/** Turns the protection on (the first holder), and returns its release (once; the last release turns it off). */
export function holdAccountCapture(): () => void {
  holders += 1;
  if (holders === 1) protect(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) protect(false);
  };
}

/** How many holders there are (tests). */
export function accountCaptureHolders(): number {
  return holders;
}
