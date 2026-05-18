import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../../tokens';
import type { StarRowProps } from './types';

const starPath =
  'M12 2 L14.94 8.26 L22 9.27 L17 14.14 L18.18 21 L12 17.77 L5.82 21 L7 14.14 L2 9.27 L9.06 8.26 Z';

export function StarRow({ stars, size = 32, testID }: StarRowProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityLabel={`${stars} of 3 stars earned`}
      style={{ flexDirection: 'row', gap: spacing.sm }}
    >
      {([0, 1, 2] as const).map((i) => {
        const filled = i < stars;
        return (
          <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <Path
              d={starPath}
              fill={filled ? colors.feedback.nudge : colors.surface.sunken}
              stroke={filled ? '#B5862A' : colors.border.strong}
              strokeWidth={1.2}
            />
          </Svg>
        );
      })}
    </View>
  );
}
