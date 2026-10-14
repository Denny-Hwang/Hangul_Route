/** The layout a realia is drawn in (F-CURR-001 G-2); `plain` is the fallback sheet for an unknown kind. */
export type RealiaSheetKind = 'menu' | 'ticket' | 'sign' | 'price-card' | 'plain';

/** `found`: the line that held the right answer. `lookHere`: the line to read again after a second miss. */
export type RealiaLineMark = 'none' | 'found' | 'lookHere';

/** A piece of realia text: Hangul and its romanization (an empty romanization draws no line). */
export interface RealiaSheetText {
  ko: string;
  romanization: string;
}

export interface RealiaSheetLine {
  id: string;
  text: RealiaSheetText;
  /** A price, a time or a duration, drawn at the end of the row (or under it when narrow). */
  value?: RealiaSheetText;
  /** On a sign: the side the board sits on and its arrow. */
  dir?: 'left' | 'right';
  /** On a price card: the goods drawn above it. */
  goods?: 'apples' | 'fan' | 'hanji';
  mark: RealiaLineMark;
  /** The UI-language gloss shown under a found line. */
  gloss?: string;
  /** Already-localised name: Korean, romanization, value, direction and the mark. */
  accessibilityLabel: string;
}

export interface RealiaSheetProps {
  kind: RealiaSheetKind;
  title?: RealiaSheetText;
  /** Accessible name of the title (Korean and romanization). */
  titleLabel?: string;
  lines: readonly RealiaSheetLine[];
  /** The group's name, e.g. "Menu, 4 lines". */
  accessibilityLabel: string;
  /** Each line's accessibility hint, e.g. "Tap to hear it". */
  lineHint: string;
  /** A line tap (hear it); never an answer. */
  onPressLine?: (id: string) => void;
  testID?: string;
}
