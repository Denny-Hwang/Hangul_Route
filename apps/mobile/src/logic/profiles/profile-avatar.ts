import type { HoyaVariant } from '@hangul-route/design-system';
import { isAvatarKind } from './avatar-catalog';

/**
 * View model of the learner's cub (`ProfileAvatar`) — F-LEARN-001 §3.6.
 *
 * Pure, so it is unit-tested; the component only paints what this returns.
 * The avatar NAME is the contract for its colour: `hoya-blue` is the blue cub
 * whatever Pillar theme the catalogue lists for it (L11). The colours
 * themselves come from the design-system `hoyaVariantColors(variant)`; this
 * module has only the type-level import because Metro (the app bundler) does
 * not resolve the package's `/tokens` subpath.
 */

/** Variant of a stored avatar string. Unknown values (junk, a future cub) read as the default orange cub. */
export function avatarVariant(avatar: string): HoyaVariant {
  return isAvatarKind(avatar) ? (avatar.replace('hoya-', '') as HoyaVariant) : 'orange';
}

/** Design-token metrics the component passes in (`borderWidth.thick`, `spacing.xs`). */
export interface ProfileAvatarMetrics {
  ringWidth: number;
  /** Air between the ring and the cub. */
  padding: number;
}

export interface ProfileAvatarModel {
  variant: HoyaVariant;
  /** Outer circle, dp. */
  diameter: number;
  /** 0 when there is no ring. */
  ringWidth: number;
  /** Size of the Hoya drawn inside the circle, dp. */
  hoyaSize: number;
}

export function profileAvatarModel(
  avatar: string,
  size: number,
  ring: boolean,
  metrics: ProfileAvatarMetrics,
): ProfileAvatarModel {
  const diameter = Math.round(size);
  const ringWidth = ring ? metrics.ringWidth : 0;
  // Inside a ring the cub keeps a little air so its ears and paws stay off the stroke.
  const inset = ring ? 2 * (ringWidth + metrics.padding) : 0;
  return {
    variant: avatarVariant(avatar),
    diameter,
    ringWidth,
    hoyaSize: Math.max(0, diameter - inset),
  };
}
