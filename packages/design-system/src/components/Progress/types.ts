export interface ProgressProps {
  value: number;
  max: number;
  variant?: 'bar' | 'dots';
  tone?: 'primary' | 'secondary' | 'success';
  height?: number;
  label?: string;
  testID?: string;
}
