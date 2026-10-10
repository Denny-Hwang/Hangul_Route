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
  testID?: string;
}
