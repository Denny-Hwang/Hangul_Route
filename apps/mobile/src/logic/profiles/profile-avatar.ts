import { borderWidth, hoyaVariantColors, spacing } from '@hangul-route/design-system/tokens';
import type { HoyaVariant } from '@hangul-route/design-system/tokens';
import { isAvatarKind } from './avatar-catalog';

/**
 * View model of the learner's cub (`ProfileAvatar`) — F-LEARN-001 §3.6.
 *
 * Pure, so it is unit-tested; the component only paints what this returns.
 * The avatar NAME is the contract for its colour: `hoya-blue` is the blue cub
 * whatever Pillar theme the catalogue lists for it (L11).
 */

/** Variant of a stored avatar string. Unknown values (junk, a future cub) read as the default orange cub. */
export function avatarVariant(avatar: string): HoyaVariant {
  return isAvatarKind(avatar) ? (avatar.replace('hoya-', '') as HoyaVariant) : 'orange';
}

export interface ProfileAvatarModel {
  variant: HoyaVariant;
  /** Outer circle, dp. */
  diameter: number;
  /** 0 when there is no ring. */
  ringWidth: number;
  /** Shade of the variant's own colour (clears 3:1 on paper and canvas, unlike the gold fur); null with no ring. */
  ringColor: string | null;
  /** Size of the Hoya drawn inside the circle, dp. */
  hoyaSize: number;
}

export function profileAvatarModel(avatar: string, size: number, ring: boolean): ProfileAvatarModel {
  const variant = avatarVariant(avatar);
  const diameter = Math.round(size);
  const ringWidth = ring ? borderWidth.thick : 0;
  // Inside a ring the cub keeps a little air so its ears and paws stay off the stroke.
  const inset = ring ? 2 * (ringWidth + spacing.xs) : 0;
  return {
    variant,
    diameter,
    ringWidth,
    ringColor: ring ? hoyaVariantColors(variant).furDark : null,
    hoyaSize: Math.max(0, diameter - inset),
  };
}
