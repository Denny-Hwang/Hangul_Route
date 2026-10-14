import { JAMO_SOUND_VALUES } from '@hangul-route/content-schema';

/**
 * The sound value a Hangul keyboard key shows under its letter (F-CURR-001 §3.7;
 * design/screens/minigame-writing/keyboard.md): the teaching value of
 * `JAMO_SOUND_VALUES` ('g/k', 'silent/ng'), including the nine letters only a key
 * shows (ㄲ ㄸ ㅃ ㅆ ㅉ ㅐ ㅔ ㅒ ㅖ). A character with no value shows none.
 */
export function keySound(jamo: string): string {
  return JAMO_SOUND_VALUES[jamo]?.[0] ?? '';
}
