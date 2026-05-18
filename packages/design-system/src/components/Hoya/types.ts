export type HoyaPose = 'idle' | 'cheering' | 'thinking' | 'reading' | 'waving';

export interface HoyaProps {
  pose?: HoyaPose;
  size?: number;
  testID?: string;
  accessibilityLabel?: string;
}
