export type IconName =
  | 'play'
  | 'pause'
  | 'speaker'
  | 'replay'
  | 'check'
  | 'close'
  | 'arrow-left'
  | 'arrow-right'
  | 'lock'
  | 'star'
  | 'card'
  | 'home'
  | 'journey'
  | 'library'
  | 'parent'
  | 'settings'
  | 'profile'
  | 'plus'
  | 'sparkle';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  testID?: string;
}
