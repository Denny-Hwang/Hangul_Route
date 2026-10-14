/**
 * The web cannot tell whether a screen reader is on: react-native-web's
 * `AccessibilityInfo.isScreenReaderEnabled()` always answers true, which would
 * turn every browser into a screen-reader session (no auto-play, no
 * recognition rung). The web therefore reads as off; the page stays fully
 * labelled for assistive tech either way (F-PLC-001 section 3.12, spec
 * assumption 5). Metro picks this file for the web build; the surface is the
 * same as `screen-reader.ts`.
 */
export function isScreenReaderEnabled(): Promise<boolean> {
  return Promise.resolve(false);
}

/** Nothing to subscribe to on the web; returns a no-op unsubscribe. */
export function subscribeScreenReader(_fn: (on: boolean) => void): () => void {
  return () => undefined;
}

/** On the web the DOM node takes the focus, and assistive tech follows it (F-PLC-001 section 3.12). */
export function focusForScreenReader(node: object | null): void {
  const focusable = node as { focus?: () => void } | null;
  focusable?.focus?.();
}

/** The web reads the line's polite live region (`aria-live`); nothing more to do here. */
export function announceForScreenReader(_text: string): void {
  return undefined;
}

/** The same constant as native; the web never waits on an announcement. */
export const ANNOUNCE_TIMEOUT_MS = 3000;

/** The web cannot tell a screen reader is on (above), so the audio that follows starts at once. */
export function announceAndWait(_text: string, _gapMs: number): Promise<void> {
  return Promise.resolve();
}
