import type { ReactNode } from 'react';
import type { TextStyle } from 'react-native';

export type HeadingLevel = 'display' | 'title' | 'prompt' | 'body' | 'caption';
export type TextTone = 'primary' | 'secondary' | 'muted' | 'inverse' | 'brand';
export type TextAlign = 'left' | 'center' | 'right';

export interface HeadingProps {
  children: ReactNode;
  level?: HeadingLevel;
  tone?: TextTone;
  align?: TextAlign;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  /** A ceiling on the level's size at the chosen text size (a title whose longest word must fit one line). */
  maxSize?: number;
  style?: TextStyle;
  testID?: string;
}

export interface BodyProps {
  children: ReactNode;
  tone?: TextTone;
  align?: TextAlign;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  size?: 'sm' | 'md' | 'lg';
  style?: TextStyle;
  testID?: string;
}
