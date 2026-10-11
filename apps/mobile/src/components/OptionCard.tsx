import { Body, Caption, Icon, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';

interface OptionCardProps {
  label: string;
  /** Second line under the label (caption size); omitted when empty. */
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Defaults to "<label>. <description>". */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * One option of a "pick one" group on the CreateProfile form (who is learning,
 * reading level) — F-LEARN-001 §3.2. A radio, not a button: the group around it
 * carries `accessibilityRole="radiogroup"` and the group's label. At least
 * `touchTarget.child` tall, stacked full width so a description fits at 320 dp.
 * The selected state is a filled check mark as well as a border colour (WCAG 1.4.1).
 * Design reference: design/wireframes/onboarding/all-ages-onboarding.md, sections A to C.
 */
export function OptionCard({
  label,
  description,
  selected,
  onPress,
  accessibilityLabel,
  testID,
}: OptionCardProps): React.ReactElement {
  const hasDescription = description !== undefined && description !== '';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      // RN-web drops `aria-checked` for an unchecked radio; a radio must always say its state.
      aria-checked={selected}
      accessibilityLabel={accessibilityLabel ?? (hasDescription ? `${label}. ${description}` : label)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: touchTarget.child,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: selected ? colors.brand.primaryLight : colors.surface.paper,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        borderWidth: borderWidth.base,
        borderRadius: radii.lg,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: spacing.xl,
          height: spacing.xl,
          borderRadius: radii.circle,
          borderWidth: borderWidth.base,
          borderColor: selected ? colors.brand.primary : colors.border.strong,
          backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Icon name="check" size={spacing.lg} color={colors.text.inverse} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Body weight="semibold">{label}</Body>
        {hasDescription ? <Caption tone="secondary">{description}</Caption> : null}
      </View>
    </Pressable>
  );
}
