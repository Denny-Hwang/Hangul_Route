import { Icon, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';

/** The lock glyph inside the badge (design/components/WhoTile/spec.md). */
const LOCK_GLYPH = 20;

export interface LockBadgeProps {
  testID?: string;
}

/**
 * [OA] The lock badge of a locked learner (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D9, row OA-5; component spec
 * `design/components/WhoTile/spec.md` "Lock badge"): a `spacing.xxl` paper circle with a `borderWidth.base`
 * `text.primary` ring and the `lock` glyph in `text.primary`. Decoration only: the tile's accessible name says
 * "locked", and the caption beside the name says it in words, so the lock is never colour alone. Placed by the
 * caller (top right of the plate on the chooser and the Profile tiles).
 */
export function LockBadge({ testID }: LockBadgeProps): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        width: spacing.xxl,
        height: spacing.xxl,
        borderRadius: radii.circle,
        borderWidth: borderWidth.base,
        borderColor: colors.text.primary,
        backgroundColor: colors.surface.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="lock" size={LOCK_GLYPH} color={colors.text.primary} />
    </View>
  );
}
