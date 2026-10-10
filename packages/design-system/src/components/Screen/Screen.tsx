import React, { useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ALL_SCREEN_EDGES, NO_INSETS, screenPadding } from '../../layout';
import { colors, spacing } from '../../tokens';
import type { ScreenProps } from './types';

const toneBg = {
  canvas: colors.surface.canvas,
  paper: colors.surface.paper,
  sunken: colors.surface.sunken,
} as const;

export function Screen({
  children,
  scrollable = true,
  padded = true,
  tone = 'canvas',
  edges = ALL_SCREEN_EDGES,
  testID,
}: ScreenProps): React.ReactElement {
  // The nearest provider's context (modal screens get their own, navigation/with-own-safe-area),
  // not useSafeAreaInsets, so a missing SafeAreaProvider degrades
  // to plain padding instead of throwing.
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const padding = screenPadding(padded ? spacing.lg : 0, insets, edges);
  const backgroundColor = toneBg[tone];

  if (!scrollable) {
    return (
      <View testID={testID} style={{ flex: 1, backgroundColor, ...padding }}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor }}
      // flexGrow keeps short content full-height so bottom-pinned CTAs stay put.
      contentContainerStyle={{ flexGrow: 1, ...padding }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
