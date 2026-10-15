import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View, findNodeHandle } from 'react-native';
import { colors, spacing, typography } from '../../tokens';
import { sectionTabId, sectionTabStyle } from './style';
import type { SectionTabsProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/**
 * SectionTabs — a wrapping row of pill tabs that switch sections of one screen
 * (F-STORY-004 §3.3: the Library's Cards / Story Time / Culture). A `tablist`
 * of `tab`s with the selected state; each tab is at least 64 dp tall and
 * wraps onto a new line at 320 dp or 200 % text instead of scrolling
 * sideways. No copy: the caller passes localised labels and the row's name.
 * Pressed feedback is the focus-coloured border, instant (no motion).
 * With `panelId` the tabs name the panel they control; with `focusSelected`
 * the selected tab takes focus as the row mounts.
 * Spec: design/components/SectionTabs/spec.md.
 */
export function SectionTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  testID,
  panelId,
  focusSelected = false,
}: SectionTabsProps<T>): React.ReactElement {
  const selectedRef = useRef<View>(null);
  useEffect(() => {
    if (!focusSelected) return undefined;
    const node = selectedRef.current;
    if (node === null) return undefined;
    if (Platform.OS === 'web') {
      // react-native-web renders the tab as a focusable DOM element.
      (node as unknown as { focus?: () => void }).focus?.();
      return undefined;
    }
    // Native: move the screen reader to the tab once it is laid out.
    const timer = setTimeout(() => {
      const tag = findNodeHandle(node);
      if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
    }, 0);
    return () => clearTimeout(timer);
  }, [focusSelected]);

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
        // Web-only ARIA link to the panel; spread so native props need no type for it.
        const controls = panelId !== undefined ? { 'aria-controls': panelId } : {};
        return (
          <Pressable
            key={item.id}
            ref={selected ? selectedRef : undefined}
            id={panelId !== undefined ? sectionTabId(panelId, item.id) : undefined}
            {...controls}
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
            <Text {...KOREAN_LINE_BREAK}
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
