import { colors } from '../../tokens';
import type { PillTone } from './types';

/**
 * Pure tone colours behind `Pill`, so the contrast contract (`src/__tests__/contrast.test.ts`) reads every pair.
 *
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17b (audit A11Y-1): the nudge label was a literal amber, 2.85:1 on the nudge tint
 * at caption size. It is `text.primary` now; the amber tint alone says "nudge".
 */

export const PILL_TONES = ['neutral', 'primary', 'secondary', 'success', 'nudge', 'info'] as const satisfies readonly PillTone[];

export interface PillStyle {
  backgroundColor: string;
  /** The label and the leading glyph. */
  textColor: string;
}

// The success and info labels keep their literals, moved here unchanged (they pass 4.5:1 and are outside AU-17b).
const LOOKS: Record<PillTone, PillStyle> = {
  neutral: { backgroundColor: colors.surface.sunken, textColor: colors.text.secondary },
  primary: { backgroundColor: colors.brand.primaryLight, textColor: colors.brand.primaryDark },
  secondary: { backgroundColor: colors.brand.secondaryLight, textColor: colors.brand.secondaryDark },
  success: { backgroundColor: colors.feedback.successLight, textColor: '#2F6A47' },
  nudge: { backgroundColor: colors.feedback.nudgeLight, textColor: colors.text.primary },
  info: { backgroundColor: colors.feedback.infoLight, textColor: '#2E5BC7' },
};

/** The colours of one tone. An unknown tone reads as `neutral`. */
export function pillStyle(tone: PillTone): PillStyle {
  return LOOKS[tone] ?? LOOKS.neutral;
}
