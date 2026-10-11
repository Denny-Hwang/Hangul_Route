export type TileState = 'idle' | 'correct' | 'wrong' | 'disabled';

export interface TileProps {
  label: string;
  romanization?: string;
  onPress?: () => void;
  state?: TileState;
  size?: 'sm' | 'md' | 'lg';
  /**
   * The tile's side when a screen scales it with the window (F-LAYOUT-001 LD4:
   * pass `useMediaSize(<the size step's touch target>)`). The glyph grows in
   * proportion; the romanization line keeps its type size. Never below the
   * size step's own side, so the touch target never shrinks.
   */
  dimension?: number;
  accessibilityLabel?: string;
  testID?: string;
}
