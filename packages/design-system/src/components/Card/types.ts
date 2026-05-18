import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

export type CardElevation = 'flat' | 'card' | 'raised';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: ReactNode;
  elevation?: CardElevation;
  padding?: CardPadding;
  tone?: 'paper' | 'sunken' | 'brand' | 'success' | 'nudge';
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}
