import type { ReactNode } from 'react';

export type ChoiceCardState = 'idle' | 'correct' | 'wrong' | 'hint' | 'disabled';

/** `replay`: "try another" (a retry follows). `dash`: a locked miss that moves on (F-VOC-004 Speed Round). */
export type ChoiceCardWrongMark = 'replay' | 'dash';

/** `row`: texts with the status mark at the end of the row. `tile`: centred art with the mark on the top corner. */
export type ChoiceCardLayout = 'row' | 'tile';

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
  /** The mark of the `wrong` state. Default `replay`. */
  wrongMark?: ChoiceCardWrongMark;
  /**
   * Default `row`. `tile` is for a picture option in a grid: the content is centred and uses the whole
   * width, and the status mark sits on the top corner on a disc of the state's fill, so two 96 dp
   * pictures fit side by side at 320 wide (`choiceCardTileWidth`).
   */
  layout?: ChoiceCardLayout;
  /** Fires only in `idle` and `hint`. */
  onPress?: () => void;
  /** Already-localised accessible name; it should also name the outcome. */
  accessibilityLabel: string;
  testID?: string;
}
