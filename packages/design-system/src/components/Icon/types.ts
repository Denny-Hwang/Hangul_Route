export type IconName =
  | 'play'
  | 'pause'
  | 'speaker'
  | 'speaker-off'
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
  | 'sparkle'
  | 'pin'
  | 'check-circle'
  | 'book'
  | 'ear'
  | 'pencil'
  | 'dash'
  | 'note'
  | 'heart'
  | 'route'
  | 'flag'
  | 'shift'
  | 'shift-on'
  | 'backspace';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  testID?: string;
}
