import { AvatarKindSchema } from '@hangul-route/content-schema';
import { colors, hoyaVariantColors } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { avatarChipModel } from '../avatar-chip';

describe('roster avatar chip (F-LEARN-001 §3.6)', () => {
  it('names each of the five cubs in English and fills with that cub\'s shade (the ring colour)', () => {
    const expected: Record<string, [string, ReturnType<typeof hoyaVariantColors>]> = {
      'hoya-orange': ['Book Tiger', hoyaVariantColors('orange')],
      'hoya-blue': ['Home Tiger', hoyaVariantColors('blue')],
      'hoya-green': ['Feast Tiger', hoyaVariantColors('green')],
      'hoya-purple': ['Mountain Tiger', hoyaVariantColors('purple')],
      'hoya-pink': ['Craft Tiger', hoyaVariantColors('pink')],
    };
    for (const kind of AvatarKindSchema.options) {
      const [label, tint] = expected[kind] as [string, ReturnType<typeof hoyaVariantColors>];
      expect(avatarChipModel(kind)).toEqual({ label, fill: tint.furDark });
    }
  });

  it('the avatar name decides the colour: five distinct fills', () => {
    const fills = AvatarKindSchema.options.map((k) => avatarChipModel(k).fill);
    expect(new Set(fills).size).toBe(5);
  });

  it('draws a neutral circle with no label for an avatar string this build does not know', () => {
    expect(avatarChipModel('hoya-teal')).toEqual({ label: null, fill: colors.surface.sunken });
    expect(avatarChipModel('')).toEqual({ label: null, fill: colors.surface.sunken });
  });
});
