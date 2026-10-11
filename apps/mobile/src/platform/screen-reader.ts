import { AccessibilityInfo, findNodeHandle } from 'react-native';

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
