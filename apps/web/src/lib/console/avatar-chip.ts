import { AvatarKindSchema, type AvatarKind } from '@hangul-route/content-schema';
import { colors, hoyaVariantColors, type HoyaVariant } from '@hangul-route/design-system/tokens';

/**
 * What the roster's `AvatarChip` draws for a learner's stored avatar string
 * (F-LEARN-001 §3.6). The server stores `avatar` as a free string, so an
 * unknown value gets a neutral circle and no label instead of throwing.
 *
 * English labels mirror `AVATAR_PRESETS` in the mobile app (apps/mobile cannot
 * be imported from the web app); F-I18N-001 moves them to the locale catalogue.
 */
const CUBS: Record<AvatarKind, { variant: HoyaVariant; label: string }> = {
  'hoya-orange': { variant: 'orange', label: 'Book Tiger' },
  'hoya-blue': { variant: 'blue', label: 'Home Tiger' },
  'hoya-green': { variant: 'green', label: 'Feast Tiger' },
  'hoya-purple': { variant: 'purple', label: 'Mountain Tiger' },
  'hoya-pink': { variant: 'pink', label: 'Craft Tiger' },
};

export interface AvatarChipModel {
  /** English name of the cub; null when this build does not know the avatar. */
  label: string | null;
  /** Circle fill. The variant's shade (`furDark`, 3:1 on paper and canvas), not the fur: the gold fur is 1.8:1. */
  fill: string;
}

export function avatarChipModel(avatar: string): AvatarChipModel {
  const known = AvatarKindSchema.safeParse(avatar);
  if (!known.success) return { label: null, fill: colors.surface.sunken };
  const cub = CUBS[known.data];
  return { label: cub.label, fill: hoyaVariantColors(cub.variant).furDark };
}
