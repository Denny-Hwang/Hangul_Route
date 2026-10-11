import React, { useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ALL_SCREEN_EDGES, NO_INSETS, screenFrame } from '../../layout';
import { colors } from '../../tokens';
import { useLayoutClass } from '../Layout';
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
  width = 'reading',
  footer,
  testID,
}: ScreenProps): React.ReactElement {
  // The nearest provider's context (modal screens get their own, navigation/with-own-safe-area),
  // not useSafeAreaInsets, so a missing SafeAreaProvider degrades
  // to plain padding instead of throwing.
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const { width: widthClass } = useLayoutClass();
  const hasFooter = footer !== undefined && footer !== null && footer !== false;
  // All the math (gutter, insets, cap, footer padding) is pure: layout.ts `screenFrame`.
  const frame = screenFrame({ width, widthClass, padded, insets, edges, hasFooter });
  const backgroundColor = toneBg[tone];

  // The cap sits INSIDE the padded container so insets and gutter stay outside it
  // and the background stays full-bleed.
  const capped = { width: '100%', maxWidth: frame.maxWidth, alignSelf: 'center' } as const;
  // Scrolling content grows to at least the screen height (a bottom-pinned CTA stays put).
  // Fixed content must also SHRINK to the space it is given (`flex: 1`), as its children
  // did when they sat directly in the padded container: a measuring child (Trace) sizes itself from it.
  const content = <View style={{ ...capped, ...(scrollable ? { flexGrow: 1 } : { flex: 1 }) }}>{children}</View>;

  const body = scrollable ? (
    <ScrollView
      testID={hasFooter ? undefined : testID}
      style={{ flex: 1, backgroundColor }}
      // flexGrow keeps short content full-height so bottom-pinned CTAs stay put.
      contentContainerStyle={{ flexGrow: 1, ...frame.body }}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  ) : (
    <View testID={hasFooter ? undefined : testID} style={{ flex: 1, backgroundColor, ...frame.body }}>
      {content}
    </View>
  );

  if (!hasFooter) return body;
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor }}>
      {body}
      <View style={frame.footer ?? undefined}>
        <View style={capped}>{footer}</View>
      </View>
    </View>
  );
}
