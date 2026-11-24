export type TileState = 'idle' | 'correct' | 'wrong' | 'disabled';

export interface TileProps {
  label: string;
  romanization?: string;
  onPress?: () => void;
  state?: TileState;
  /**
   * Takes no tap while keeping its state's look (AMENDMENTS-TOUCH R3, row KT-3). Inside a `TapBoard` the board still
   * claims a touch on it, so the touch reaches nothing else; it is announced as disabled. Only for a tile that really is
   * out of play (Build a Letter's used tray tiles); a locked answer is `locked`.
   */
  disabled?: boolean;
  /**
   * F-A11Y-001 §3.1 (row AF-1): an answered tile (a locked miss, a right answer) takes no tap but is not disabled. It
   * reaches `TapTarget` as `inactive`: the board claims a touch on it, there is no press look, and it stays a focusable
   * button that is never announced as dimmed or disabled. Its name says the state.
   */
  locked?: boolean;
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
