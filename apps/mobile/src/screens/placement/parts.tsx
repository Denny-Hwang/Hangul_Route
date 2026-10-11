import {
  Body,
  Caption,
  Icon,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import React, { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

export type IconName = React.ComponentProps<typeof Icon>['name'];

/**
 * Small building blocks shared by the level check's screens (F-PLC-001
 * section 3.12): every control is at least `touchTarget.min`, tokens only,
 * no emoji. Design: design/wireframes/placement/placement.md.
 */

/** The large round speaker: the prompt's play button, and "Tap to hear it" after a resume. */
export function SpeakerButton({
  onPress,
  label,
  size = touchTarget.hero,
  testID,
}: {
  onPress: () => void;
  label: string;
  size?: number;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.circle,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.brand.primaryDark : colors.brand.primary,
      })}
    >
      <Icon name="speaker" size={Math.round(size / 2)} color={colors.text.inverse} />
    </Pressable>
  );
}

/**
 * The footstep trail: one dot per answer, and one open dot for the question
 * now. It only fills, shows no number, and screen readers skip it.
 */
export function FootstepTrail({ answered }: { answered: number }): React.ReactElement {
  const dots = Array.from({ length: answered + 1 }, (_, i) => i < answered);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}
    >
      {dots.map((filled, i) => (
        <View
          key={i}
          style={{
            width: spacing.md,
            height: spacing.md,
            borderRadius: radii.circle,
            borderWidth: borderWidth.base,
            borderColor: colors.brand.primary,
            backgroundColor: filled ? colors.brand.primary : colors.surface.paper,
          }}
        />
      ))}
    </View>
  );
}

/** A text link with a hit area of at least `touchTarget.min` (section 3.12). */
export function LinkButton({
  label,
  onPress,
  icon,
  testID,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
  accessibilityHint?: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={{ minHeight: touchTarget.min, minWidth: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md }}
    >
      {icon ? <Icon name={icon} size={spacing.xl} color={colors.brand.primaryDark} /> : null}
      <Body weight="semibold" tone="brand">
        {label}
      </Body>
    </Pressable>
  );
}

/** The back arrow at the top of a grown-up screen. */
export function BackArrow({ onPress, label }: { onPress: () => void; label: string }): React.ReactElement {
  return (
    <Pressable
      testID="placement-back"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: touchTarget.min, height: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="arrow-left" size={spacing.xl} color={colors.text.primary} />
    </Pressable>
  );
}

/**
 * A radio tile (`accessibilityRole="radio"` with `selected` and `disabled`):
 * the mode tiles and the sound-guide choices. Never "recommended".
 */
export function RadioTile({
  selected,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  children,
  flex,
}: {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
  children: ReactNode;
  flex?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={{
        flex: flex ? 1 : undefined,
        minHeight: touchTarget.child,
        padding: spacing.md,
        gap: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: selected ? borderWidth.thick : borderWidth.base,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        backgroundColor: disabled ? colors.surface.sunken : colors.surface.paper,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: spacing.xl,
            height: spacing.xl,
            borderRadius: radii.circle,
            borderWidth: borderWidth.base,
            borderColor: selected ? colors.brand.primary : colors.border.strong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View style={{ width: spacing.md, height: spacing.md, borderRadius: radii.circle, backgroundColor: colors.brand.primary }} />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </Pressable>
  );
}

/** A quiet line for a grown-up, under a control. */
export function Note({ children, testID }: { children: ReactNode; testID?: string }): React.ReactElement {
  return (
    <Caption tone="secondary" testID={testID}>
      {children}
    </Caption>
  );
}

/**
 * Choice cards in rows of `columns`, every cell the same width (the last row
 * is padded with empty cells), so a 2 x 2 grid stays a grid at any width.
 */
export function ChoiceGrid({ columns, children }: { columns: 1 | 2; children: ReactNode[] }): React.ReactElement {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: spacing.md }}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={{ flex: 1 }}>
              {row[c] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
