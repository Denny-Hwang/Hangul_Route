import { KOREAN_LANGUAGE } from '@hangul-route/design-system';
import { Platform } from 'react-native';
import { focusForScreenReader } from '../../platform/screen-reader';

/*
 * The typing games' screen-reader helpers (Type Hangul, Write Frame, My Story), in a module of their own so that each
 * game's chunk takes them without taking another game (AMENDMENTS-FINISH-2026-11 FN-7: a module two chunks import is
 * folded into the start bundle).
 */

/** Typed Korean is read with the Korean voice; react-native-web forwards `lang` (spread: native Text props lack it). */
export const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** Visually hidden, still read (the field's polite live line). In a neutral module of its own (F-A11Y-001 §3.3). */
export { srOnly } from './sr-only';

/** Focus target for assistive tech when the result panel opens: `focus()` on the web, the native view elsewhere. */
export interface Focusable {
  focus?: () => void;
}

/**
 * Moves assistive-tech focus to the result panel's first line. On the web the element's own
 * `focus()` does it; on iOS and Android it does not move VoiceOver or TalkBack focus, so the
 * screen-reader helper does (platform/screen-reader.ts).
 */
export function focusPanel(node: Focusable | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') node.focus?.();
  else focusForScreenReader(node);
}
