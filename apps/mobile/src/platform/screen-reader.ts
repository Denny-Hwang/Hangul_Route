import { AccessibilityInfo } from 'react-native';

/**
 * Whether a screen reader is on (F-PLC-001 section 3.1 step 3 and section
 * 3.12): it pre-sets *Take my time*, keeps prompts from auto-playing and
 * leaves the visual recognition rung out. react-native-web forwards the call;
 * a platform that cannot tell reads as off (spec assumption 5).
 */
export async function isScreenReaderEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    return false;
  }
}

/** Calls `fn` when the screen reader is turned on or off; returns the unsubscribe. */
export function subscribeScreenReader(fn: (on: boolean) => void): () => void {
  const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', fn);
  return () => subscription.remove();
}
