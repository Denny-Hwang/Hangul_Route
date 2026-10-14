import type { TextStyle } from 'react-native';

/**
 * Web: taught Korean on the presenter (the letter glyph, syllables, words, quiz options) is drawn
 * with the bundled subset `family` (`presenter.font`, F-TCH-004 TD4, section 3.6), falling back per
 * glyph to the system stack. UI text and the teacher's deck title never use it. The family is
 * passed in, so this file needs no design-system runtime import.
 */
export function taughtKoreanStack(family: string): string {
  return `"${family}", system-ui, sans-serif`;
}

export function taughtKoreanFont(family: string): TextStyle {
  return { fontFamily: taughtKoreanStack(family) };
}
