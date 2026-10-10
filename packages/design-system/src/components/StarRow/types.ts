export interface StarRowProps {
  stars: 0 | 1 | 2 | 3;
  size?: number;
  /** Already-localised label (`m.a11y.stars(n)`); default "N of 3 stars earned". */
  accessibilityLabel?: string;
  testID?: string;
}
