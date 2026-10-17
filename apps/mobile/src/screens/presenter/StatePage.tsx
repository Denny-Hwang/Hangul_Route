import { Hoya, borderWidth, colors, layout, radii, spacing, touchTarget, typography, useTypeScale, type HoyaPose, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { READABLE_LINE, STATE_HOYA } from './stage-metrics';
import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePresenterView } from './presenter-context';

/**
 * The presenter's state pages (design/screens/presenter/states.md): the invalid link, loading,
 * too small, and the presenter home of this build. Teacher pages in real pixels on paper: Hoya,
 * a title, one line, and at most one action, focused on arrival. A link from a newer presenter
 * (AMENDMENTS-LECTURE-V2 section 4.5) adds a second, quieter one (`secondary`) under Reload.
 */
export function StatePage({
  pose,
  title,
  line,
  cta,
  onCta,
  status,
  testID,
  secondary,
}: {
  pose: HoyaPose;
  title?: string;
  line?: string;
  cta?: string;
  onCta?: () => void;
  /** A status line ("Loading lesson") instead of a title. */
  status?: string;
  testID?: string;
  /** A ghost button under the primary one. */
  secondary?: { label: string; onPress: () => void; testID?: string };
}): React.ReactElement {
  const ts = useTypeScale().size;
  const { messages } = usePresenterView();
  const action = useRef<View>(null);
  useEffect(() => {
    if (cta !== undefined) action.current?.focus?.();
  }, [cta]);
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
        paddingVertical: spacing.xl,
        paddingHorizontal: layout.gutter.compact,
        backgroundColor: colors.surface.paper,
      }}
    >
      <Hoya pose={pose} size={STATE_HOYA} accessibilityLabel={messages.a11y.hoya(pose)} />
      {title !== undefined ? (
        <Text {...KOREAN_LINE_BREAK} role="heading" style={{ fontSize: ts.display, fontWeight: typography.weight.bold, color: colors.text.primary, textAlign: 'center' }}>
          {title}
        </Text>
      ) : null}
      {status !== undefined ? (
        <Text {...KOREAN_LINE_BREAK} role="status" style={{ fontSize: ts.bodyLg, color: colors.text.primary, textAlign: 'center' }}>
          {status}
        </Text>
      ) : null}
      {line !== undefined ? (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: ts.body, color: colors.text.secondary, textAlign: 'center', maxWidth: READABLE_LINE, lineHeight: Math.round(ts.body * typography.leading.normal) }}>
          {line}
        </Text>
      ) : null}
      {cta !== undefined && onCta !== undefined ? <PrimaryButton ref={action} label={cta} onPress={onCta} testID={testID ? `${testID}-cta` : undefined} /> : null}
      {secondary ? <GhostButton label={secondary.label} onPress={secondary.onPress} testID={secondary.testID} /> : null}
    </View>
  );
}

type PressState = { pressed: boolean; focused?: boolean };

/** The presenter's primary pill (real pixels, `touchTarget.hero` tall): `brand.primaryDark` with `text.onPrimary` (7.65:1). */
export const PrimaryButton = React.forwardRef<View, { label: string; onPress: () => void; disabled?: boolean; large?: boolean; testID?: string; minHeight?: number }>(
  function PrimaryButton({ label, onPress, disabled, large, testID, minHeight }, ref) {
    const ts = useTypeScale().size;
    return (
      <Pressable
        ref={ref}
        testID={testID}
        role="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled === true }}
        disabled={disabled}
        onPress={onPress}
        style={(state) => {
          const { focused } = state as PressState;
          return {
            minHeight: minHeight ?? touchTarget.hero,
            paddingHorizontal: large ? spacing.jumbo : spacing.xxl,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            borderRadius: radii.pill,
            backgroundColor: colors.brand.primaryDark,
            borderWidth: borderWidth.thick,
            borderColor: focused ? colors.border.focus : colors.brand.primaryDark,
          };
        }}
      >
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: large ? ts.display : ts.bodyLg, fontWeight: typography.weight.bold, color: colors.text.onPrimary }}>{label}</Text>
      </Pressable>
    );
  },
);

/** A secondary pill (paper with a `border.strong` outline). */
export const GhostButton = React.forwardRef<View, { label: string; onPress: () => void; testID?: string; expanded?: boolean }>(function GhostButton(
  { label, onPress, testID, expanded },
  ref,
) {
  const ts = useTypeScale().size;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={label}
      {...(expanded !== undefined ? { 'aria-expanded': expanded } : {})}
      onPress={onPress}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minHeight: touchTarget.min,
          paddingHorizontal: spacing.xxl,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          backgroundColor: colors.surface.paper,
          borderWidth: focused ? borderWidth.thick : borderWidth.base,
          borderColor: focused ? colors.border.focus : colors.border.strong,
        };
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: ts.bodyLg, fontWeight: typography.weight.bold, color: colors.text.primary }}>{label}</Text>
    </Pressable>
  );
});
