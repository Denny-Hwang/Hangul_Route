import { Icon, borderWidth, colors, radii, spacing, touchTarget, typography, useTypeScale, KOREAN_LINE_BREAK, type IconName } from '@hangul-route/design-system';
import React, { useRef } from 'react';
import { Pressable, Text, View, type PressableStateCallbackType, type TextStyle, type ViewStyle } from 'react-native';
import { radioAfter } from '../../logic/lecture/home-view';

/**
 * The presenter home's own controls (design `design/screens/presenter/presets.md`, `home.md`; README
 * D19): pill buttons, the one-tab-stop chip radiogroups, the checkbox rows of Customize and the
 * disclosure buttons. A teacher page in real pixels; every size follows the chosen text size
 * (`useTypeScale`), every target is at least `touchTarget.min`, and keyboard focus draws the
 * `border.focus` ring outside the control.
 */

export type Focusable = PressableStateCallbackType & { focused?: boolean };

/** The `border.focus` ring outside the control on keyboard focus (README D19); nothing moves at rest. */
export function ring(focused: boolean | undefined): ViewStyle {
  if (!focused) return {};
  // react-native-web draws CSS outlines; the native style type does not list them.
  const outline = { outlineStyle: 'solid', outlineWidth: borderWidth.thick, outlineColor: colors.border.focus, outlineOffset: borderWidth.base };
  return outline as ViewStyle;
}

export const text = (size: number, weight: keyof typeof typography.weight, color: string): TextStyle => ({
  fontSize: size,
  fontWeight: typography.weight[weight],
  color,
  lineHeight: Math.round(size * typography.leading.normal),
});

export function H({ level, children, style, testID }: { level: 1 | 2 | 3; children: string; style: TextStyle; testID?: string }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK} role="heading" aria-level={level} style={style} testID={testID}>
      {children}
    </Text>
  );
}

/** A plain line of the page (`text.secondary` by default). */
export function Line({ children, testID, primary, bold }: { children: string; testID?: string; primary?: boolean; bold?: boolean }): React.ReactElement {
  const ts = useTypeScale().size;
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={text(ts.body, bold ? 'bold' : 'regular', primary ? colors.text.primary : colors.text.secondary)}>
      {children}
    </Text>
  );
}

/**
 * The page's pill buttons as the mock draws them (`mock/presenter.css` `.btn`): paper with a
 * `border.strong` outline, or `brand.primaryDark` when primary; disabled is `surface.sunken`
 * (shape and fill, not colour of the text alone). `compact` is the 64 px row and header size.
 * `icon` draws a glyph before the label; `expanded` and `controls` make it a disclosure.
 */
export function HomeButton({
  label,
  onPress,
  primary,
  compact,
  disabled,
  icon,
  expanded,
  controls,
  accessibilityLabel,
  minWidth,
  buttonRef,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  compact?: boolean;
  disabled?: boolean;
  icon?: IconName;
  expanded?: boolean;
  controls?: string;
  accessibilityLabel?: string;
  minWidth?: number;
  buttonRef?: React.Ref<View>;
  testID?: string;
}): React.ReactElement {
  const ts = useTypeScale().size;
  const fill = disabled ? colors.surface.sunken : primary ? colors.brand.primaryDark : colors.surface.paper;
  const edge = disabled ? colors.surface.sunken : primary ? colors.brand.primaryDark : colors.border.strong;
  const ink = primary && !disabled ? colors.text.onPrimary : colors.text.primary;
  const disclosure = { ...(expanded !== undefined ? { 'aria-expanded': expanded } : {}), ...(controls !== undefined ? { 'aria-controls': controls } : {}) };
  return (
    <Pressable
      ref={buttonRef}
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true, ...(expanded !== undefined ? { expanded } : {}) }}
      aria-disabled={disabled === true}
      {...disclosure}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ focused }: Focusable) => ({
        minHeight: compact ? touchTarget.min : touchTarget.hero,
        minWidth: minWidth ?? (compact ? touchTarget.min : touchTarget.hero),
        // At 320 px with 200 % text (a 160 px layout) the label wraps inside the page, never past it.
        maxWidth: '100%',
        flexShrink: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: compact ? spacing.xs : spacing.sm,
        paddingHorizontal: compact ? spacing.lg : spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.pill,
        borderWidth: borderWidth.base,
        borderColor: edge,
        backgroundColor: fill,
        ...ring(focused),
      })}
    >
      {icon ? <Icon name={icon} size={spacing.xl} color={ink} /> : null}
      <Text {...KOREAN_LINE_BREAK} style={{ ...text(compact ? ts.body : ts.bodyLg, 'bold', ink), textAlign: 'center', flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A one-tab-stop chip radiogroup (README D19, `radioAfter`): the arrows, Home and End move and
 * select; the chosen chip has the `borderWidth.thick` `text.primary` outline (shape, not colour
 * alone). Used for the length chips, the stage chips and the chooser's stage chips.
 */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
  testID,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  name: (option: T) => string;
  testID?: string;
}): React.ReactElement {
  const ts = useTypeScale().size;
  const refs = useRef(new Map<T, View | null>());
  const onKey = (e: { key: string; preventDefault?: () => void }): void => {
    const next = radioAfter(options, value, e.key);
    if (next === null) return;
    e.preventDefault?.();
    if (next !== value) onChange(next);
    refs.current.get(next)?.focus?.();
  };
  return (
    <View role="radiogroup" aria-label={label} testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={String(option)}
            ref={(el) => {
              refs.current.set(option, el);
            }}
            role="radio"
            aria-checked={on}
            accessibilityState={{ checked: on }}
            tabIndex={on ? 0 : -1}
            onPress={() => {
              if (!on) onChange(option);
            }}
            {...{ onKeyDown: onKey }}
            testID={testID ? `${testID}-${String(option)}` : undefined}
            style={({ focused }: Focusable) => ({
              minHeight: touchTarget.min,
              minWidth: touchTarget.min,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: spacing.lg - (on ? borderWidth.thick - borderWidth.base : 0),
              borderRadius: radii.pill,
              borderWidth: on ? borderWidth.thick : borderWidth.base,
              borderColor: on ? colors.text.primary : colors.border.strong,
              backgroundColor: colors.surface.paper,
              ...ring(focused),
            })}
          >
            <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'bold', colors.text.primary)}>
              {name(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A checkbox row (the v1 `.pick` row): a `spacing.xxl` box with the `check` glyph, or the `dash`
 * glyph while mixed (`aria-checked="mixed"`), the title and a second line. A chosen row gets the
 * `borderWidth.thick` `text.primary` outline. A row that is off stays in the tab order, marked
 * disabled, so the reason in the status line can be found.
 */
export function CheckRow({
  title,
  detail,
  checked,
  disabled,
  onToggle,
  testID,
  rowRef,
  basis = 0,
}: {
  title: string;
  detail: string;
  checked: 'true' | 'mixed' | 'false';
  disabled: boolean;
  onToggle: () => void;
  testID?: string;
  rowRef?: React.Ref<View>;
  /** The width the row asks for before it shares a line (a row beside its disclosure wraps under 2 x this). */
  basis?: number;
}): React.ReactElement {
  const ts = useTypeScale().size;
  const on = checked === 'true';
  const glyph: IconName | null = checked === 'true' ? 'check' : checked === 'mixed' ? 'dash' : null;
  const ariaChecked = checked === 'mixed' ? 'mixed' : on;
  return (
    <Pressable
      ref={rowRef}
      role="checkbox"
      aria-checked={ariaChecked}
      // `disabled` marks it (aria-disabled); the explicit tab index keeps it in the tab order.
      disabled={disabled}
      tabIndex={0}
      accessibilityState={{ checked: checked === 'mixed' ? 'mixed' : on, disabled }}
      onPress={() => {
        if (!disabled) onToggle();
      }}
      testID={testID}
      style={({ focused }: Focusable) => ({
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: basis,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: touchTarget.min,
        paddingVertical: spacing.sm - (on ? borderWidth.thick - borderWidth.thin : 0),
        paddingHorizontal: spacing.md - (on ? borderWidth.thick - borderWidth.thin : 0),
        borderWidth: on ? borderWidth.thick : borderWidth.thin,
        borderColor: on ? colors.text.primary : colors.border.subtle,
        borderRadius: radii.md,
        backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
        ...ring(focused),
      })}
    >
      <View
        style={{
          width: spacing.xxl,
          height: spacing.xxl,
          borderWidth: borderWidth.thick,
          borderColor: colors.text.primary,
          borderRadius: radii.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {glyph ? <Icon name={glyph} size={spacing.xl} color={colors.text.primary} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'bold', colors.text.primary)}>
          {title}
        </Text>
        <Text {...KOREAN_LINE_BREAK} style={text(ts.body, 'regular', colors.text.secondary)}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
