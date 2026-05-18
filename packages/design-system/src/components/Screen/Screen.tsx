import React from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../tokens';
import type { ScreenProps } from './types';

const toneBg = {
  canvas: colors.surface.canvas,
  paper: colors.surface.paper,
  sunken: colors.surface.sunken,
} as const;

export function Screen({
  children,
  scrollable = false,
  padded = true,
  tone = 'canvas',
  testID,
}: ScreenProps): React.ReactElement {
  const containerStyle = {
    flex: 1,
    backgroundColor: toneBg[tone],
    padding: padded ? spacing.lg : 0,
  };

  if (scrollable) {
    return (
      <ScrollView
        testID={testID}
        contentContainerStyle={{ padding: padded ? spacing.lg : 0 }}
        style={{ flex: 1, backgroundColor: toneBg[tone] }}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View testID={testID} style={containerStyle}>
      {children}
    </View>
  );
}
