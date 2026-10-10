import type { ReactNode } from 'react';

export type ChoiceCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

export interface ChoiceCardProps {
  /** Option text. Wraps, left-aligned, never truncated. */
  label?: string;
  /** Taught Hangul, drawn with `KoreanText`. */
  ko?: string;
  /** Revised Romanization for `ko`; an empty string (the default) draws no line. */
  romanization?: string;
  /** Meaning of `ko` in the UI language. */
  gloss?: string;
  /** Picture slot above the texts. Absent or `null`: the texts alone. */
  art?: ReactNode;
  state: ChoiceCardState;
  /** Fires only in `idle` and `hint`. */
  onPress?: () => void;
  /** Already-localised accessible name; it should also name the outcome. */
  accessibilityLabel: string;
  testID?: string;
}
