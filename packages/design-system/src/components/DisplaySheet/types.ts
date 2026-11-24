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
  /**
   * Another language was chosen: the confirm step drawn in place of the radios, written in the language
   * chosen ("Use Español on this device?", Use Español / Back to English; F-I18N-001 §3.3 safety rule).
   * Use writes the choice; Back changes nothing.
   */
  confirm?: DisplaySheetConfirm | null;
}

export interface DisplaySheetConfirm {
  question: string;
  use: string;
  back: string;
  /** The chosen language's `lang`, so a screen reader reads the step in that language. */
  lang: string;
  onUse: () => void;
  onBack: () => void;
}

export interface DisplaySheetTextSize {
  /** The row's label ("Text size"). */
  label: string;
  options: readonly DisplayOption<TextSizeStep>[];
  selected: TextSizeStep;
  onSelect: (step: TextSizeStep) => void;
  /** The live sample line, drawn at the chosen size. */
  sample: string;
  /** The sign each segment draws at its own step ("Aa"), hidden from assistive tech. */
  glyph: string;
}

/**
 * The screen-reader row (F-A11Y-001 OD-AF3 (d); design/components/AnswerFeedback/spec.md D10): the level check's "I use a
 * screen reader", kept for the device. The learner app passes it on the web only, where a screen reader cannot be told.
 */
export interface DisplaySheetScreenReader {
  /** The row's label (the level check's `learner.placement.options.screenReader.label`). */
  label: string;
  /** The help line under it (`common.display.screenReaderHelp`); it also describes the switch. */
  help: string;
  value: boolean;
  onChange: (on: boolean) => void;
}

export interface DisplaySheetProps {
  visible: boolean;
  title: string;
  /** null hides the Language row (only one language is offered). */
  language: DisplaySheetLanguage | null;
  textSize: DisplaySheetTextSize;
  /** The screen-reader row, after Text size and its preview, before the note; absent or null draws nothing. */
  screenReader?: DisplaySheetScreenReader | null;
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
