import { borderWidth, colors, radii, spacing, touchTarget, typography, z } from '@hangul-route/design-system';
import React, { forwardRef, useEffect, useRef } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { radioMove } from '../../../logic/lecture/tools';
import { focusablesIn, rememberFocus, trapFocus } from '../../../platform/presenter';

/**
 * Shared parts of the class-tool overlays (design/screens/presenter/overlays.md): the covering
 * dialog over the stage box, the real-pixel tool buttons (`touchTarget.hero` tall, pill,
 * `typography.size.bodyLg` bold), the chip radiogroup (README D19) and the timer ring.
 */

type PressState = { pressed: boolean; focused?: boolean };

function focusRing(focused: boolean): ViewStyle {
  return focused
    ? ({ outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base } as ViewStyle)
    : {};
}

/** A tool button: `primary` is `brand.primaryDark` with `text.onPrimary`; otherwise paper with a `border.strong` outline. */
export const ToolButton = forwardRef<
  View,
  { label: string; onPress: () => void; primary?: boolean; selected?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string }
>(function ToolButton({ label, onPress, primary, selected, disabled, testID, accessibilityLabel }, ref) {
  const fg = disabled ? colors.text.secondary : primary ? colors.text.onPrimary : colors.text.primary;
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true, ...(selected !== undefined ? { selected } : {}) }}
      {...(selected !== undefined ? { 'aria-pressed': selected } : {})}
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const { focused } = state as PressState;
        return {
          minHeight: touchTarget.hero,
          minWidth: touchTarget.hero,
          paddingHorizontal: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          // A disabled tool reads as quieter (text.secondary on paper, still 7:1), never as faded.
          backgroundColor: primary && !disabled ? colors.brand.primaryDark : colors.surface.paper,
          borderWidth: selected ? borderWidth.thick : borderWidth.base,
          borderColor: disabled ? colors.border.subtle : primary ? colors.brand.primaryDark : selected ? colors.text.primary : colors.border.strong,
          ...focusRing(focused === true),
        };
      }}
    >
      <Text style={{ fontSize: typography.size.bodyLg, fontWeight: typography.weight.bold, color: fg, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
});

/**
 * A covering overlay: a modal dialog over the stage box (the bar stays), on `surface.paper` like
 * the stage (`sunken` for the grid). It takes focus on mount (its `initialFocus`, else the
 * container itself, so Space and Enter still reach the presenter keys), keeps Tab inside (its
 * `focusables`, else every tabbable control in it) and gives focus back to the opener on close.
 */
export function Cover({
  label,
  testID,
  sunken,
  children,
  initialFocus,
  focusables,
  style,
}: {
  label: string;
  testID: string;
  sunken?: boolean;
  children: React.ReactNode;
  initialFocus?: React.RefObject<View | null>;
  /** The controls Tab cycles through, in order (default: the tabbable controls inside the overlay). */
  focusables?: () => readonly unknown[];
  style?: ViewStyle;
}): React.ReactElement {
  const self = useRef<View>(null);
  useEffect(() => {
    const restore = rememberFocus();
    (initialFocus?.current ?? self.current)?.focus?.();
    const release = trapFocus(focusables ?? (() => focusablesIn(self.current)));
    return () => {
      release();
      restore();
    };
    // Focus is taken once, when the overlay opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      ref={self}
      testID={testID}
      role="dialog"
      aria-modal
      aria-label={label}
      {...{ tabIndex: -1 }}
      style={[
        {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: z.modal,
          backgroundColor: sunken ? colors.surface.sunken : colors.surface.paper,
          outlineStyle: 'none',
        } as ViewStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** `lang` of the label (a language endonym). */
  lang?: string;
}

/**
 * A chip radiogroup (README D19): one tab stop on the selected chip; the arrow keys move and select
 * (wrapping), Home and End jump, Space selects the focused chip. The handled keys never reach the
 * presenter keys; P, Esc, H and the clicker keys keep their meaning.
 */
export function ChipRadios<T extends string>({
  label,
  options,
  selected,
  onSelect,
  testID,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID?: string;
}): React.ReactElement {
  const refs = useRef(new Map<T, View | null>());
  const values = options.map((o) => o.value);
  const onKey = (event: { key: string; preventDefault: () => void; stopPropagation?: () => void }): void => {
    const next = radioMove(values, selected, event.key);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation?.();
    onSelect(next);
    refs.current.get(next)?.focus?.();
  };
  return (
    <View role="radiogroup" aria-label={label} testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const on = o.value === selected;
        return (
          <Pressable
            key={o.value}
            ref={(node) => {
              refs.current.set(o.value, node);
            }}
            role="radio"
            aria-checked={on}
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => onSelect(o.value)}
            {...{ tabIndex: on ? 0 : -1, onKeyDown: onKey, ...(o.lang ? { lang: o.lang } : {}) }}
            style={(state) => {
              const { focused } = state as PressState;
              return {
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: on ? colors.surface.sunken : colors.surface.paper,
                borderWidth: on ? borderWidth.thick : borderWidth.base,
                borderColor: on ? colors.text.primary : colors.border.strong,
                ...focusRing(focused === true),
              };
            }}
          >
            <Text style={{ fontSize: typography.size.body, fontWeight: on ? typography.weight.bold : typography.weight.semibold, color: colors.text.primary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The ring's own box and stroke: drawn on 100 x 100 (README Constants "ring stroke"). */
const RING_BOX = 100;
const RING_STROKE = 10;
const RING_R = (RING_BOX - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_R;

/**
 * The timer ring: a `surface.sunken` track and a `brand.primary` fill that starts at 12 o'clock
 * and grows clockwise with elapsed time (it never drops, TD5), with m:ss inside unless hidden.
 */
export function TimerRing({ size, fraction, text, numberSize, showNumbers, label }: { size: number; fraction: number; text: string; numberSize: number; showNumbers: boolean; label: string }): React.ReactElement {
  const filled = Math.min(1, Math.max(0, fraction)) * RING_LENGTH;
  return (
    <View role="timer" accessibilityLabel={label} testID="presenter-timer-ring" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${RING_BOX} ${RING_BOX}`} aria-hidden style={{ position: 'absolute' }}>
        <Circle cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R} fill="none" stroke={colors.surface.sunken} strokeWidth={RING_STROKE} />
        <Circle
          cx={RING_BOX / 2}
          cy={RING_BOX / 2}
          r={RING_R}
          fill="none"
          stroke={colors.brand.primary}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${filled} ${RING_LENGTH}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${RING_BOX / 2} ${RING_BOX / 2})`}
        />
      </Svg>
      {showNumbers ? (
        <Text aria-hidden testID="presenter-timer-text" style={{ fontSize: numberSize, fontWeight: typography.weight.bold, color: colors.text.primary, fontVariant: ['tabular-nums'] }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}
