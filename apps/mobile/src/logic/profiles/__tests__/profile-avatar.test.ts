import { colors, hoyaVariantColors } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS } from '../avatar-catalog';
import { avatarVariant, profileAvatarModel } from '../profile-avatar';

describe('avatarVariant — the avatar NAME decides the colour (F-LEARN-001 L11)', () => {
  it.each([
    ['hoya-orange', 'orange'],
    ['hoya-blue', 'blue'],
    ['hoya-green', 'green'],
    ['hoya-purple', 'purple'],
    ['hoya-pink', 'pink'],
  ] as const)('%s is the %s cub', (kind, variant) => {
    expect(avatarVariant(kind)).toBe(variant);
  });

  it('derives the variant from every catalogue kind (no preset is left out)', () => {
    for (const a of AVATAR_PRESETS) {
      expect(a.kind).toBe(`hoya-${avatarVariant(a.kind)}`);
    }
  });

  it('reads a value this build does not know (a server string, persisted junk) as the orange cub', () => {
    expect(avatarVariant('hoya-teal')).toBe('orange');
    expect(avatarVariant('')).toBe('orange');
    expect(avatarVariant('orange')).toBe('orange');
  });

  it('does not follow the Pillar theme: hoya-blue is blue although its theme tint is gold', () => {
    const blue = AVATAR_PRESETS.find((a) => a.kind === 'hoya-blue');
    expect(blue?.theme).toBe('life');
    expect(avatarVariant('hoya-blue')).toBe('blue');
    expect(profileAvatarModel('hoya-blue', 52, true).ringColor).not.toBe(colors.theme.life);
  });
});

describe('profileAvatarModel', () => {
  it('rings the cub in the shade of its own variant (the shade clears 3:1 on paper and canvas)', () => {
    for (const a of AVATAR_PRESETS) {
      const m = profileAvatarModel(a.kind, 52, true);
      expect(m.ringColor).toBe(hoyaVariantColors(m.variant).furDark);
      expect(m.ringWidth).toBe(3);
    }
  });

  it('draws no ring and uses the whole box for the cub when ring is off', () => {
    const m = profileAvatarModel('hoya-pink', 72, false);
    expect(m).toMatchObject({ diameter: 72, ringWidth: 0, ringColor: null, hoyaSize: 72, variant: 'pink' });
  });

  it('shrinks the cub inside a ring so ring and padding stay within the circle', () => {
    const m = profileAvatarModel('hoya-green', 52, true);
    expect(m.diameter).toBe(52);
    expect(m.hoyaSize).toBe(52 - 2 * (3 + 4));
    expect(m.hoyaSize + 2 * m.ringWidth).toBeLessThan(m.diameter);
  });

  it('never returns a negative or fractional cub size for tiny or fractional boxes', () => {
    expect(profileAvatarModel('hoya-blue', 10, true).hoyaSize).toBe(0);
    expect(profileAvatarModel('hoya-blue', 40.6, true).hoyaSize).toBe(27);
    expect(profileAvatarModel('hoya-blue', 40.6, true).diameter).toBe(41);
  });

  it('falls back to the orange cub for an unknown avatar', () => {
    const m = profileAvatarModel('hoya-teal', 40, true);
    expect(m.variant).toBe('orange');
    expect(m.ringColor).toBe(colors.hoya.furDark);
  });
});
