import { Body, Icon, colors, spacing, touchTarget, NO_PRESS_DELAY, usePressGuard } from '@hangul-route/design-system';
import type { ComponentProps, ReactElement } from 'react';
import { Pressable } from 'react-native';

type IconName = ComponentProps<typeof Icon>['name'];

/**
 * A text link with a hit area of at least `touchTarget.min` (F-PLC-001 section 3.12): the visible words are the
 * accessible name, the role is a button, tokens only. Shared by the level check, the Learning Route and the weekly
 * plan screens (moved out of `screens/placement/parts.tsx`, R-7d follow-up).
 */
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
}): ReactElement {
  // AMENDMENTS-TOUCH 6.9 (row KT-9): a link opens once per bounce, waits for the app-level tap lock and sets it, as Button.
  const guard = usePressGuard();
  return (
    <Pressable
      testID={testID}
      onPress={guard(onPress)}
      {...NO_PRESS_DELAY}
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
