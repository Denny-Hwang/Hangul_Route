export interface SparkMeterProps {
  /** Sparks earned so far; the Speed Round never lowers it (F-VOC-004 S3). */
  value: number;
  /** Slots per row, default 10. */
  slots?: number;
  /** Rows before the meter is full of sparks, default 3. */
  maxRows?: number;
  /** Already-localised accessible name, e.g. "3 sparks" (the design system has no copy). */
  accessibilityLabel: string;
  testID?: string;
}
