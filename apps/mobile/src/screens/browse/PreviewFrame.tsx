import { borderWidth, colors, radii, spacing, touchTarget, typography, useLayoutClass } from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../../i18n/use-messages';
import { BROWSE_TEXT_SCALE_CAP } from '../../logic/browse/layout';

/**
 * The preview strip around a lesson (F-BROWSE-001 sections 4.7 and 7; mock
 * `design/screens/browse/preview-frame.md`, README decision 15): "Preview.
 * Nothing is saved." and, inside a lesson, [ Leave preview ]. It sits above
 * the lesson's own layout and pushes it down, so it never covers the lesson's
 * close control, a game's targets or the "Quick check" dots. It cannot be
 * dismissed. Shown only on lesson screens and the preview end screen (BR-8
 * wraps them); never on home, the outline, the item page or Access.
 *
 * The strip is a status region announced once when its screen gains focus,
 * not on every render: its text joins the region on focus (iOS, which reads
 * no live region, gets one announcement instead). It adds no animation.
 */
export interface PreviewFrameProps {
  children: React.ReactNode;
  /** Inside a lesson: [ Leave preview ] (BR-8 opens the leave confirm). Absent on the end screen. */
  onLeave?: () => void;
}

export function PreviewFrame({ children, onLeave }: PreviewFrameProps): React.ReactElement {
  const m = useMessages().caregiver.browse.preview;
  const { gutter } = useLayoutClass();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(m.strip);
      return () => setFocused(false);
    }, [m.strip]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.canvas }}>
      <View
        testID="preview-strip"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.min,
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.xs,
          paddingLeft: insets.left + gutter,
          paddingRight: insets.right + gutter,
          backgroundColor: colors.surface.sunken,
          borderBottomWidth: borderWidth.thin,
          borderBottomColor: colors.border.strong,
        }}
      >
        <View role="status" aria-live="polite" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
          {/* Joins the live region when the screen gains focus, so it is announced once, then stays. */}
          {focused ? (
            <Text
              testID="preview-strip-text"
              maxFontSizeMultiplier={BROWSE_TEXT_SCALE_CAP}
              style={{
                color: colors.text.primary,
                fontSize: typography.size.body,
                fontWeight: typography.weight.semibold,
                lineHeight: typography.size.body * typography.leading.normal,
              }}
            >
              {m.strip}
            </Text>
          ) : null}
        </View>
        {onLeave ? (
          <Pressable
            testID="preview-leave"
            onPress={onLeave}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexShrink: 1,
              minHeight: touchTarget.min,
              justifyContent: 'center',
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              borderWidth: borderWidth.base,
              borderColor: colors.brand.primary,
              backgroundColor: pressed ? colors.brand.primaryLight : 'transparent',
            })}
          >
            {({ pressed }) => (
              <Text
                maxFontSizeMultiplier={BROWSE_TEXT_SCALE_CAP}
                style={{
                  color: pressed ? colors.brand.primaryDark : colors.brand.primary,
                  fontSize: typography.size.body,
                  fontWeight: typography.weight.semibold,
                  textAlign: 'center',
                }}
              >
                {m.leave.cta}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
