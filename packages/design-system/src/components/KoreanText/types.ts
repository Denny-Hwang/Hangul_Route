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
  /**
   * With `romanizationShown: false`, keep the line's room: it is drawn invisible and hidden from assistive
   * tech, so the layout does not move when the line is shown (a quest Check's open question, AU-8). Default `false`.
   */
  romanizationReserved?: boolean;
  /**
   * Keep the gloss line's room: it is drawn invisible and hidden from assistive tech, so the layout does not move when the
   * meaning is shown (a Korean option's meaning in a Check's open question, DC-1c). Default `false`.
   */
  glossReserved?: boolean;
  /** Makes the item a button and shows the speaker affordance. */
  onPress?: () => void;
  /** Already-localised label (`m.a11y.koreanItem`); default is "ko, romanization". */
  accessibilityLabel?: string;
  testID?: string;
}
