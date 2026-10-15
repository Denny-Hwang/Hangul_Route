import React, { useCallback, useEffect, useId, useRef, type MutableRefObject } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors, radii, spacing, touchTarget, typography } from '../../tokens';
import type { ButtonProps, ButtonSize, ButtonTone } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

const toneBg: Record<ButtonTone, string> = {
  primary: colors.brand.primary,
  secondary: colors.brand.secondary,
  ghost: 'transparent',
  success: colors.feedback.success,
  nudge: colors.feedback.nudge,
};

const toneFg: Record<ButtonTone, string> = {
  primary: colors.text.onPrimary,
  secondary: colors.text.onSecondary,
  ghost: colors.brand.primary,
  success: colors.text.inverse,
  nudge: colors.text.primary,
};

// Ghost text darkens while pressed: brand.primary on the primaryLight press
// fill is 4.10:1, primaryDark on it 5.76:1 (UX-10, contrast.test.ts).
const tonePressedFg: Record<ButtonTone, string> = {
  ...toneFg,
  ghost: colors.brand.primaryDark,
};

const tonePressedBg: Record<ButtonTone, string> = {
  primary: colors.brand.primaryDark,
  secondary: colors.brand.secondaryDark,
  ghost: colors.brand.primaryLight,
  success: colors.feedback.successDark,
  nudge: '#D89B2B',
};

const sizeHeight: Record<ButtonSize, number> = {
  sm: touchTarget.min,
  md: touchTarget.min,
  lg: touchTarget.child,
  hero: touchTarget.hero,
};

const sizeFont: Record<ButtonSize, number> = {
  sm: typography.size.bodySm,
  md: typography.size.body,
  lg: typography.size.bodyLg,
  hero: typography.size.prompt,
};

const sizePaddingX: Record<ButtonSize, number> = {
  sm: spacing.lg,
  md: spacing.xl,
  lg: spacing.xl,
  hero: spacing.xxl,
};

type AriaHost = { setAttribute?: (k: string, v: string) => void; removeAttribute?: (k: string) => void };

/** Writes or clears `aria-disabled` on a react-native-web host node; a host without those methods is left alone. */
function syncAriaDisabled(v: View | null, on: boolean): void {
  const el = v as unknown as AriaHost | null;
  if (on) el?.setAttribute?.('aria-disabled', 'true');
  else el?.removeAttribute?.('aria-disabled');
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  disabled = false,
  softDisabled = false,
  fullWidth = false,
  leading,
  trailing,
  accessibilityLabel,
  accessibilityHint,
  expanded,
  testID,
  pressableRef,
}: ButtonProps): React.ReactElement {
  const hintId = useId();
  // react-native-web drops accessibilityHint: describe the button by a hidden copy of the hint instead.
  const webHint = accessibilityHint !== undefined && Platform.OS === 'web';
  const describedBy: Record<string, string> = webHint ? { 'aria-describedby': hintId } : {};
  // Soft: drawn and announced as disabled, a press does nothing, and it stays in the tab order. Native keeps a
  // disabled view in the screen reader's reach, so it is plainly `disabled` there. On the web a disabled
  // <button> leaves the tab order, so the button stays enabled and only `aria-disabled` is written to its node. That
  // relies on react-native-web handing the ref the DOM element (`setAttribute`); a host without it is left alone.
  const soft = softDisabled && !disabled;
  const looksDisabled = disabled || soft;
  const webSoft = soft && Platform.OS === 'web';
  const node = useRef<View | null>(null);
  // Read by the ref callback, so a host node that is swapped in (a remount, react-native-web replacing the element)
  // while the soft state stays the same gets the attribute too, not only the node the effect last saw.
  const webSoftNow = useRef(webSoft);
  webSoftNow.current = webSoft;
  const setNode = useCallback(
    (v: View | null) => {
      node.current = v;
      if (webSoftNow.current) syncAriaDisabled(v, true);
      if (typeof pressableRef === 'function') pressableRef(v);
      else if (pressableRef) (pressableRef as MutableRefObject<View | null>).current = v;
    },
    [pressableRef],
  );
  useEffect(() => {
    // A hard disabled button clears it too, so going straight from soft to disabled leaves no stale attribute.
    if (Platform.OS !== 'web') return;
    syncAriaDisabled(node.current, webSoft);
  }, [webSoft, disabled]);
  return (
    <Pressable
      {...describedBy}
      ref={setNode}
      onPress={looksDisabled ? undefined : onPress}
      disabled={disabled || (soft && !webSoft)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={expanded === undefined ? { disabled: looksDisabled } : { disabled: looksDisabled, expanded }}
      aria-expanded={expanded}
      testID={testID}
      hitSlop={spacing.sm}
      style={({ pressed }) => ({
        minHeight: sizeHeight[size],
        paddingHorizontal: sizePaddingX[size],
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: looksDisabled
          ? colors.surface.sunken
          : pressed
            ? tonePressedBg[tone]
            : toneBg[tone],
        borderWidth: tone === 'ghost' ? 2 : 0,
        borderColor: tone === 'ghost' ? colors.brand.primary : 'transparent',
        opacity: looksDisabled ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
    >
      {({ pressed }) => (
        <>
          {leading ? <View style={{ marginRight: spacing.sm }}>{leading}</View> : null}
          <Text {...KOREAN_LINE_BREAK}
            style={{
              color: looksDisabled ? colors.text.muted : pressed ? tonePressedFg[tone] : toneFg[tone],
              fontSize: sizeFont[size],
              fontWeight: typography.weight.semibold,
              letterSpacing: typography.tracking.normal,
            }}
          >
            {label}
          </Text>
          {trailing ? <View style={{ marginLeft: spacing.sm }}>{trailing}</View> : null}
          {webHint ? (
            <Text {...KOREAN_LINE_BREAK} id={hintId} style={{ display: 'none' }}>
              {accessibilityHint}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
