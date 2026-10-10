import { Hoya, borderWidth, colors, hoyaVariantColors, radii, spacing } from '@hangul-route/design-system';
import type { HoyaPose } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { profileAvatarModel } from '../logic/profiles/profile-avatar';

interface ProfileAvatarProps {
  /** The stored `profile.avatar` (e.g. `hoya-blue`); unknown values draw the orange cub. */
  avatar: string;
  /** Outer diameter, dp. */
  size: number;
  pose?: HoyaPose;
  /** Ring the cub in the shade of its own colour (Home Profile entry). */
  ring?: boolean;
  testID?: string;
}

/**
 * The learner's own tinted cub (F-LEARN-001 §3.6, L10) on the profile switcher,
 * the grown-up dashboard, the Home Profile entry and Results. The guide Hoya
 * (greeting, bubbles) stays the gold `<Hoya/>`.
 *
 * Decorative: it has no accessibility label of its own; the control around it
 * (a labelled button, or the name beside it) says who it is (audit UX-33).
 * Design reference: design/components/ProfileAvatar/spec.md.
 */
export function ProfileAvatar({ avatar, size, pose = 'idle', ring = false, testID }: ProfileAvatarProps): React.ReactElement {
  const m = profileAvatarModel(avatar, size, ring, { ringWidth: borderWidth.thick, padding: spacing.xs });
  // The ring is the variant's shade: the gold fur is 1.8:1 on canvas, its shade clears 3:1 (WCAG 1.4.11).
  const ringColor = ring ? hoyaVariantColors(m.variant).furDark : 'transparent';
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        width: m.diameter,
        height: m.diameter,
        borderRadius: radii.circle,
        borderWidth: m.ringWidth,
        borderColor: ringColor,
        backgroundColor: colors.surface.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Hoya pose={pose} size={m.hoyaSize} variant={m.variant} />
    </View>
  );
}
