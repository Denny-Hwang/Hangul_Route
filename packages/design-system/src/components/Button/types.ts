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
  /**
   * Drawn and announced as disabled (`aria-disabled`, `accessibilityState.disabled`) while it stays
   * focusable, so a keyboard or screen-reader user reaches it and hears its hint; a press does nothing.
   * For a button that waits on something the user does (e.g. read to the end). `disabled` wins.
   */
  softDisabled?: boolean;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  /**
   * What pressing does, when the label alone does not say it (e.g. "Opens the billing page"). Native
   * reads it as the accessibility hint; react-native-web drops `accessibilityHint`, so on the web the
   * button is described by a hidden copy of the text (`aria-describedby`).
   */
  accessibilityHint?: string;
  /** A disclosure button (it opens and closes something inline): announced as expanded or collapsed. */
  expanded?: boolean;
  testID?: string;
  /**
   * The pressable's node, for a screen that moves focus to this button (a DOM node on the web, a view
   * for `AccessibilityInfo.setAccessibilityFocus` on native). Optional; nothing else changes.
   */
  pressableRef?: Ref<View>;
}
