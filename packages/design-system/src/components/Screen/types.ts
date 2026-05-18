import type { ReactNode } from 'react';

export interface ScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  tone?: 'canvas' | 'paper' | 'sunken';
  testID?: string;
}
