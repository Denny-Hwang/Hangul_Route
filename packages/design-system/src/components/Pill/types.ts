export type PillTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'nudge' | 'info';

export interface PillProps {
  label: string;
  tone?: PillTone;
  size?: 'sm' | 'md';
  testID?: string;
}
