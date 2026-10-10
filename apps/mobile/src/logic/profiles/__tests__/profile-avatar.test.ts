import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS } from '../avatar-catalog';
import { avatarVariant, profileAvatarModel } from '../profile-avatar';

/** borderWidth.thick and spacing.xs, as the component passes them. */
const METRICS = { ringWidth: 3, padding: 4 } as const;

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
  });
});

describe('profileAvatarModel', () => {
  it('rings with the token width and gives every catalogue cub its own variant', () => {
    for (const a of AVATAR_PRESETS) {
      const m = profileAvatarModel(a.kind, 52, true, METRICS);
      expect(m.variant).toBe(avatarVariant(a.kind));
      expect(m.ringWidth).toBe(3);
    }
  });

  it('does not follow the Pillar theme when ringed: hoya-blue stays blue', () => {
    expect(profileAvatarModel('hoya-blue', 52, true, METRICS).variant).toBe('blue');
  });

  it('draws no ring and uses the whole box for the cub when ring is off', () => {
    const m = profileAvatarModel('hoya-pink', 72, false, METRICS);
    expect(m).toEqual({ variant: 'pink', diameter: 72, ringWidth: 0, hoyaSize: 72 });
  });

  it('shrinks the cub inside a ring so ring and padding stay within the circle', () => {
    const m = profileAvatarModel('hoya-green', 52, true, METRICS);
    expect(m.diameter).toBe(52);
    expect(m.hoyaSize).toBe(52 - 2 * (3 + 4));
    expect(m.hoyaSize + 2 * m.ringWidth).toBeLessThan(m.diameter);
  });

  it('never returns a negative or fractional cub size for tiny or fractional boxes', () => {
    expect(profileAvatarModel('hoya-blue', 10, true, METRICS).hoyaSize).toBe(0);
    expect(profileAvatarModel('hoya-blue', 40.6, true, METRICS).hoyaSize).toBe(27);
    expect(profileAvatarModel('hoya-blue', 40.6, true, METRICS).diameter).toBe(41);
  });

  it('falls back to the orange cub for an unknown avatar', () => {
    expect(profileAvatarModel('hoya-teal', 40, true, METRICS).variant).toBe('orange');
  });
});
