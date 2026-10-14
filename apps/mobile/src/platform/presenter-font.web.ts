import { presenter } from '@hangul-route/design-system/tokens';
import type { TextStyle } from 'react-native';

/**
 * Web: taught Korean on the presenter (the letter glyph, syllables, words, quiz options) is drawn
 * with the bundled `HR Presenter KR` subset (F-TCH-004 TD4, section 3.6), falling back per glyph
 * to the system stack. UI text and the teacher's deck title never use it.
 */
export const TAUGHT_KOREAN_STACK = `"${presenter.font}", system-ui, sans-serif`;

export function taughtKoreanFont(): TextStyle {
  return { fontFamily: TAUGHT_KOREAN_STACK };
}
