import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../tokens';
import type { IconName, IconProps } from './types';

// Geometric icons — placeholder set, swap with curated icon family later.
const paths: Record<IconName, React.ReactElement> = {
  play: <Path d="M8 5 L19 12 L8 19 Z" />,
  pause: <Path d="M6 5 H10 V19 H6 Z M14 5 H18 V19 H14 Z" />,
  speaker: <Path d="M4 9 H8 L13 5 V19 L8 15 H4 Z M16 8 Q19 12 16 16 M19 6 Q23 12 19 18" />,
  replay: <Path d="M12 5 V2 L7 6 L12 10 V7 A5 5 0 1 1 7 12 H4 A8 8 0 1 0 12 5 Z" />,
  check: <Path d="M5 12 L10 17 L19 7" strokeWidth={3} fill="none" />,
  close: <Path d="M6 6 L18 18 M18 6 L6 18" strokeWidth={3} fill="none" />,
  'arrow-left': <Path d="M14 6 L8 12 L14 18" strokeWidth={3} fill="none" />,
  'arrow-right': <Path d="M10 6 L16 12 L10 18" strokeWidth={3} fill="none" />,
  lock: <Path d="M7 11 V8 A5 5 0 0 1 17 8 V11 H18 V20 H6 V11 Z" />,
  star: <Path d="M12 2 L14.94 8.26 L22 9.27 L17 14.14 L18.18 21 L12 17.77 L5.82 21 L7 14.14 L2 9.27 L9.06 8.26 Z" />,
  card: <Path d="M3 6 H21 V18 H3 Z M3 10 H21" strokeWidth={2} fill="none" />,
  home: <Path d="M3 12 L12 4 L21 12 V20 H14 V14 H10 V20 H3 Z" />,
  journey: <Path d="M4 6 H20 M4 12 H20 M4 18 H20" strokeWidth={3} fill="none" />,
  library: <Path d="M4 4 H8 V20 H4 Z M10 4 H14 V20 H10 Z M16 6 L20 7 L18 21 L14 20 Z" />,
  parent: <Circle cx={12} cy={8} r={4} />,
  settings: <Circle cx={12} cy={12} r={3} />,
  profile: <Path d="M12 12 A4 4 0 1 1 12 4 A4 4 0 0 1 12 12 Z M4 21 A8 8 0 0 1 20 21 Z" />,
  plus: <Path d="M12 5 V19 M5 12 H19" strokeWidth={3} fill="none" />,
  sparkle: <Path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" />,
};

export function Icon({ name, size = 24, color, testID }: IconProps): React.ReactElement {
  const tint = color ?? colors.text.primary;
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" fill={tint} stroke={tint}>
      {paths[name]}
    </Svg>
  );
}
