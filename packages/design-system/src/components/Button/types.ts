import type { ReactNode, Ref } from 'react';
import type { View } from 'react-native';

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
  /** A disclosure button (it opens and closes something inline): announced as expanded or collapsed. */
  expanded?: boolean;
  testID?: string;
  /**
   * The pressable's node, for a screen that moves focus to this button (a DOM node on the web, a view
   * for `AccessibilityInfo.setAccessibilityFocus` on native). Optional; nothing else changes.
   */
  pressableRef?: Ref<View>;
}
