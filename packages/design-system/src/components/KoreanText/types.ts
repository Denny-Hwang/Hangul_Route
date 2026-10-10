import type { KoreanTextSize } from '../../korean-text';

export type { KoreanTextSize };

export interface KoreanTextProps {
  /** The taught Hangul. */
  ko: string;
  /** Revised Romanization. An empty string draws no line. */
  romanization: string;
  /** Meaning in the UI language; stays visible when the romanization is hidden. */
  gloss?: string;
  size?: KoreanTextSize;
  /** `false` hides only the romanization line. Default `true`. */
  romanizationShown?: boolean;
  /** Makes the item a button and shows the speaker affordance. */
  onPress?: () => void;
  /** Already-localised label (`m.a11y.koreanItem`); default is "ko, romanization". */
  accessibilityLabel?: string;
  testID?: string;
}
