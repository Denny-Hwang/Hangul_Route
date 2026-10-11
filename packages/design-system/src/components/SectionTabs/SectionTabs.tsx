import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../tokens';
import { sectionTabStyle } from './style';
import type { SectionTabsProps } from './types';

/**
 * SectionTabs — a wrapping row of pill tabs that switch sections of one screen
 * (F-STORY-004 §3.3: the Library's Cards / Story Time / Culture). A `tablist`
 * of `tab`s with the selected state; each tab is at least 64 dp tall and
 * wraps onto a new line at 320 dp or 200 % text instead of scrolling
 * sideways. No copy: the caller passes localised labels and the row's name.
 * Pressed feedback is the focus-coloured border, instant (no motion).
 * Spec: design/components/SectionTabs/spec.md.
 */
export function SectionTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SectionTabsProps<T>): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {items.map((item) => {
        const selected = item.id === value;
        const look = sectionTabStyle(selected);
        return (
          <Pressable
            key={item.id}
            testID={testID ? `${testID}-${item.id}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => ({
              minHeight: look.minHeight,
              paddingHorizontal: look.paddingHorizontal,
              paddingVertical: spacing.sm,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: look.backgroundColor,
              borderColor: pressed ? colors.border.focus : look.borderColor,
              borderWidth: look.borderWidth,
              borderRadius: look.borderRadius,
            })}
          >
            <Text
              style={{
                color: look.textColor,
                fontSize: look.fontSize,
                fontWeight: look.fontWeight,
                lineHeight: look.fontSize * typography.leading.normal,
                textAlign: 'center',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
