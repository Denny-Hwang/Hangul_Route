import type { ReactNode } from 'react';

export type HoyaTone = 'idle' | 'cheering' | 'thinking';

export interface HoyaBubbleProps {
  tone?: HoyaTone;
  message: string;
  korean?: string;
  romanization?: string;
  ctaInline?: ReactNode;
  onDismiss?: () => void;
  autoDismissMs?: number;
  testID?: string;
}
