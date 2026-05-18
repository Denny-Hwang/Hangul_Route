export type TileState = 'idle' | 'correct' | 'wrong' | 'disabled';

export interface TileProps {
  label: string;
  romanization?: string;
  onPress?: () => void;
  state?: TileState;
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
  testID?: string;
}
