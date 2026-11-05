import type { IconName } from '../Icon/types';

export type PillTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'nudge' | 'info';

export interface PillProps {
  label: string;
  tone?: PillTone;
  size?: 'sm' | 'md';
  /** A small decorative glyph in front of the words, in the words' colour; hidden from screen readers. */
  icon?: IconName;
  /** The pill's accessible name when it says more than its words (the pill is then one text element). */
  accessibilityLabel?: string;
  testID?: string;
}
