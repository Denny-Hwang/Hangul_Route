import type { HoyaVariant } from '../../tokens';

export type HoyaPose = 'idle' | 'cheering' | 'thinking' | 'reading' | 'waving';

export interface HoyaProps {
  pose?: HoyaPose;
  size?: number;
  /** Fur tint of the learner's cub (F-LEARN-001 §3.6). Defaults to the gold cub. */
  variant?: HoyaVariant;
  testID?: string;
  accessibilityLabel?: string;
}
