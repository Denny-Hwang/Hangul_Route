import type { ReactNode } from 'react';

export type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'success' | 'nudge';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'hero';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}
