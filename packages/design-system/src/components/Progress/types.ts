export interface ProgressProps {
  value: number;
  max: number;
  variant?: 'bar' | 'dots';
  tone?: 'primary' | 'secondary' | 'success';
  height?: number;
  label?: string;
  /** The meter's accessible name; by default the `ProgressLabelsContext` name ("Progress"). */
  accessibilityLabel?: string;
  /** The value as words; by default the drawn `label`, else the `ProgressLabelsContext` value ("2 of 6"). */
  accessibilityValueText?: string;
  /**
   * A fill-only meter on a screen where nothing may read as a score (anti-shame: no count, no percentage): it is
   * drawn and screen readers skip it, as they skip the story reader's dots and the level check's trail. It is then no
   * `progressbar`, so it needs no name.
   */
  decorative?: boolean;
  /**
   * [QB] Dots only: the dot shown now (1-based), ringed. For a meter that only fills while the screen shows an
   * earlier step or page (`value` is the furthest one reached; AMENDMENTS-QUEST-SOUND-BACK QB-1, QB-2). Absent, the
   * dots are drawn as always.
   */
  current?: number;
  testID?: string;
}
