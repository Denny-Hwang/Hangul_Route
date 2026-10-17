import { borderWidth, colors, radii, spacing, touchTarget, typography, useTypeScale, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { useMessages } from '../i18n/use-messages';

/**
 * The Aa button (AMENDMENTS-DISPLAY-NAV section 3.6): opens the Display sheet (language and text
 * size). A pill of one touch target that draws the dictionary's sign ("Aa"; "가가" in Korean),
 * hidden from assistive tech; its accessible name says what it opens ("Display: language and text
 * size"). Used on Home, All lessons, the presenter home and the start screen.
 */
export function DisplayButton({ onPress, testID = 'display-button' }: { onPress: () => void; testID?: string }): React.ReactElement {
  const d = useMessages().common.display;
  const size = useTypeScale().size.bodyLg;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={d.a11y}
      aria-haspopup="dialog"
      hitSlop={spacing.xs}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => ({
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.pill,
        backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
        borderWidth: focused ? borderWidth.thick : borderWidth.base,
        borderColor: focused ? colors.border.focus : colors.border.strong,
      })}
    >
      <Text
        {...KOREAN_LINE_BREAK}
        aria-hidden
        importantForAccessibility="no"
        style={{ fontSize: size, fontWeight: typography.weight.bold, color: colors.text.primary }}
      >
        {d.button}
      </Text>
    </Pressable>
  );
}
