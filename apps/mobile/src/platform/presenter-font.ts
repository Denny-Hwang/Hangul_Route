import type { TextStyle } from 'react-native';

/**
 * Native: taught Korean keeps the system stack. The presenter font family exists only through the
 * PWA shell's `@font-face` (F-TCH-004 section 3.6, PR 3 review note 2), so a native build must
 * not name it. The web variant is `presenter-font.web.ts`.
 */
export function taughtKoreanFont(_family: string): TextStyle {
  return {};
}
