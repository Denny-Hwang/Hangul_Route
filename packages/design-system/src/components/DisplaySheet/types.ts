import type React from 'react';
import type { TextSizeStep } from '../../text-size';
import type { DisplayOption } from './model';

export interface DisplaySheetLanguage {
  /** The row's label ("Language on this device"). */
  label: string;
  /** The endonyms; fewer than two hides the row. */
  options: readonly DisplayOption[];
  selected: string;
  onSelect: (value: string) => void;
  /** After a change: a one-tap way back, written in the new language ("Back to English"). */
  undo?: { label: string; onPress: () => void } | null;
}

export interface DisplaySheetTextSize {
  /** The row's label ("Text size"). */
  label: string;
  options: readonly DisplayOption<TextSizeStep>[];
  selected: TextSizeStep;
  onSelect: (step: TextSizeStep) => void;
  /** The live sample line, drawn at the chosen size. */
  sample: string;
}

export interface DisplaySheetProps {
  visible: boolean;
  title: string;
  /** null hides the Language row (only one language is offered). */
  language: DisplaySheetLanguage | null;
  textSize: DisplaySheetTextSize;
  /** A line under the controls ("Every page on this device uses these."). */
  note?: string;
  /** Extra rows above Language (All lessons puts its Romanization row here). */
  children?: React.ReactNode;
  doneLabel: string;
  /** The scrim's accessible name. */
  closeLabel: string;
  onClose: () => void;
  /** Root test id; the controls derive theirs from it. Default `display-sheet`. */
  testID?: string;
}
