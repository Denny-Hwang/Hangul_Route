import type { ReactNode } from 'react';

export type HoyaTone = 'idle' | 'cheering' | 'thinking';

export interface HoyaBubbleProps {
  tone?: HoyaTone;
  message: string;
  korean?: string;
  romanization?: string;
  ctaInline?: ReactNode;
  onDismiss?: () => void;
  /** Already-localised dismiss label (`m.a11y.hoyaDismiss`); default "Close Hoya message". */
  dismissLabel?: string;
  autoDismissMs?: number;
  /**
   * Default `true`: a polite live region, so a new line is read. `false` (F-A11Y-001 §3.3): drawn the same but not live,
   * for a game's result bubble when the answer announcer already says the result. Never `assertive`.
   */
  live?: boolean;
  testID?: string;
}
