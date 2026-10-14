import { AccessibilityInfo, Platform, findNodeHandle } from 'react-native';

/**
 * Whether a screen reader is on (F-PLC-001 section 3.1 step 3 and section
 * 3.12): it pre-sets *Take my time*, keeps prompts from auto-playing and
 * leaves the visual recognition rung out. This is the native reading
 * (VoiceOver, TalkBack); a call that fails reads as off. The web cannot tell
 * (react-native-web always answers true), so `screen-reader.web.ts` reads it
 * as off and the options screen's *I use a screen reader* says so instead
 * (spec assumption 5).
 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    return false;
  }
}

/** Calls `fn` when the screen reader is turned on or off (the level check follows it); returns the unsubscribe. */
export function subscribeScreenReader(fn: (on: boolean) => void): () => void {
  const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', fn);
  return () => subscription.remove();
}

/**
 * Moves VoiceOver / TalkBack focus to a mounted view (F-PLC-001 section 3.12:
 * focus moves to the prompt on each question). A view's own `focus()` does not
 * move screen-reader focus on native; a view that is not mounted is ignored.
 */
export function focusForScreenReader(node: object | null): void {
  if (node === null) return;
  const tag = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
}

/**
 * Says a short status line that just appeared (a check-in answered, a change that did not save).
 * Android and the web read the line's polite live region; iOS has no live regions, so VoiceOver is
 * told here. Never throws.
 */
export function announceForScreenReader(text: string): void {
  if (Platform.OS !== 'ios') return;
  try {
    AccessibilityInfo.announceForAccessibility(text);
  } catch {
    // Nothing to say it with: the line is still on screen.
  }
}

/** How long to wait for VoiceOver's `announcementFinished` before going on anyway. */
export const ANNOUNCE_TIMEOUT_MS = 3000;

/**
 * Says `text` to a screen reader and resolves when it has been said, so audio that follows
 * never talks over the label (F-CURR-001 D-1 S3b, "announce, then play"). With no screen
 * reader it resolves at once. iOS waits for `announcementFinished` (or `ANNOUNCE_TIMEOUT_MS`);
 * Android reads the polite live region the screen renders, so it waits `gapMs`. Never throws.
 */
export async function announceAndWait(text: string, gapMs: number): Promise<void> {
  if (!(await isScreenReaderEnabled())) return;
  if (Platform.OS !== 'ios') {
    await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
    return;
  }
  await new Promise<void>((resolve) => {
    let done = false;
    let subscription: { remove: () => void } | undefined;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription?.remove();
      resolve();
    };
    const timer = setTimeout(finish, ANNOUNCE_TIMEOUT_MS);
    try {
      subscription = AccessibilityInfo.addEventListener('announcementFinished', finish);
      AccessibilityInfo.announceForAccessibility(text);
    } catch {
      finish();
    }
  });
}
