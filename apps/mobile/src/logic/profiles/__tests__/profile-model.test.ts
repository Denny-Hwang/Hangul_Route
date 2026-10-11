import { describe, expect, it } from 'vitest';
import {
  NAME_MAX,
  activeProfile,
  createProfile,
  isScopedKey,
  keysForProfile,
  learners,
  nextOnboardingStep,
  parentProfile,
  parseScopedKey,
  removeProfile,
  renameProfile,
  scopedKey,
  setActiveProfile,
  updateProfile,
  validateDisplayName,
  type Clock,
  type ProfileSet,
} from '../profile-model';

const T0 = 1_700_000_000_000;
const EMPTY: ProfileSet = { profiles: [], activeId: null };

function clockFrom(seeds: string[], now = T0): Clock {
  let i = 0;
  return { now: () => now, nextId: () => seeds[i++] ?? `extra${i}` };
}

const learnerInput = { displayName: 'Suni', ageGroup: '5-7' as const, avatar: 'hoya-orange' as const };

function seeded(): ProfileSet {
  const clock = clockFrom(['parent1', 'kid1', 'kid2']);
  let set = createProfile(EMPTY, { ...learnerInput, displayName: 'Mom', role: 'parent' }, clock).set;
  set = createProfile(set, learnerInput, clock).set;
  set = createProfile(set, { ...learnerInput, displayName: 'Jin' }, clock).set;
  return set;
}

describe('validateDisplayName', () => {
  it('accepts a plain Latin name', () => {
    expect(validateDisplayName('Suni')).toBeNull();
    expect(validateDisplayName("O'Brien-Lee")).toBeNull();
  });

  it('trims before measuring, rejecting whitespace-only names', () => {
    expect(validateDisplayName('   ')).toBe('too-short');
    expect(validateDisplayName('  Suni  ')).toBeNull();
  });

  it(`rejects names longer than ${NAME_MAX} chars`, () => {
    expect(validateDisplayName('a'.repeat(NAME_MAX + 1))).toBe('too-long');
  });

  it('accepts names in any UI language: accents and Hangul (F-I18N-001 §3.9)', () => {
    for (const name of ['María', 'Zoë', "D'Arcy", 'Jean-Luc', '수니', '김 민준', 'Suni 2', 'O’Neil']) {
      expect(validateDisplayName(name)).toBeNull();
    }
  });

  it('rejects emoji, other scripts and control characters', () => {
    for (const name of ['Suni 🐯', '日本', 'Мария', 'Su\u0000ni', 'a\tb', '<b>', 'Suni!']) {
      expect(validateDisplayName(name)).toBe('unsupported-character');
    }
  });

  // Regression guard: CreateProfileScreen caps its input at NAME_MAX and gates
  // submit on this validator. If a name the form can produce were rejected
  // here, createProfile would throw out of the submit handler and strand first-
  // run onboarding — the bug Codex caught on PR #58.
  it('accepts a name of exactly NAME_MAX Latin chars, so the form can never feed createProfile a throwing name', () => {
    expect(validateDisplayName('a'.repeat(NAME_MAX))).toBeNull();
    expect(() =>
      createProfile(EMPTY, { ...learnerInput, displayName: 'a'.repeat(NAME_MAX) }, clockFrom(['k'])),
    ).not.toThrow();
  });
});

describe('createProfile', () => {
  it('appends, activates, and defaults the role to learner', () => {
    const { set, created } = createProfile(EMPTY, learnerInput, clockFrom(['kid1']));
    expect(set.profiles).toHaveLength(1);
    expect(set.activeId).toBe(created.id);
    expect(created.id).toBe('profile:kid1');
    expect(created.role).toBe('learner');
    expect(created.createdAt).toBe(new Date(T0).toISOString());
  });

  it('stores a parent profile when the role is given', () => {
    const { created } = createProfile(
      EMPTY,
      { ...learnerInput, displayName: 'Mom', role: 'parent' },
      clockFrom(['p1']),
    );
    expect(created.role).toBe('parent');
  });

  it('refuses an invalid name rather than persisting it', () => {
    expect(() => createProfile(EMPTY, { ...learnerInput, displayName: '' }, clockFrom(['x']))).toThrow(
      /Invalid display name/,
    );
  });
});

describe('profile set operations', () => {
  it('setActiveProfile switches and stamps lastActiveAt', () => {
    const set = setActiveProfile(seeded(), 'profile:kid1', T0 + 5_000);
    expect(set.activeId).toBe('profile:kid1');
    expect(activeProfile(set)?.lastActiveAt).toBe(new Date(T0 + 5_000).toISOString());
  });

  it('setActiveProfile ignores an unknown id', () => {
    const before = seeded();
    expect(setActiveProfile(before, 'profile:ghost', T0)).toBe(before);
  });

  it('removeProfile reassigns active to the first remaining profile', () => {
    const before = setActiveProfile(seeded(), 'profile:kid2', T0);
    const after = removeProfile(before, 'profile:kid2');
    expect(after.profiles).toHaveLength(2);
    expect(after.activeId).toBe('profile:parent1');
  });

  it('removeProfile of the last profile leaves no active id', () => {
    const only = createProfile(EMPTY, learnerInput, clockFrom(['solo'])).set;
    expect(removeProfile(only, 'profile:solo')).toEqual({ profiles: [], activeId: null });
  });

  it('removeProfile leaves an untouched active id alone', () => {
    const before = setActiveProfile(seeded(), 'profile:kid1', T0);
    expect(removeProfile(before, 'profile:kid2').activeId).toBe('profile:kid1');
  });

  it('renameProfile validates the new name', () => {
    expect(renameProfile(seeded(), 'profile:kid1', 'Sun').profiles[1]?.displayName).toBe('Sun');
    expect(renameProfile(seeded(), 'profile:kid1', '수니').profiles[1]?.displayName).toBe('수니');
    expect(() => renameProfile(seeded(), 'profile:kid1', 'Sun 🐯')).toThrow(/Invalid display name/);
  });

  it('separates learners from the parent profile', () => {
    const set = seeded();
    expect(learners(set).map((p) => p.displayName)).toEqual(['Suni', 'Jin']);
    expect(parentProfile(set)?.displayName).toBe('Mom');
  });

  it('activeProfile is null when nothing is active', () => {
    expect(activeProfile(EMPTY)).toBeNull();
  });
});

describe('nextOnboardingStep', () => {
  it('forces the parent profile first on an empty install (§3.2)', () => {
    expect(nextOnboardingStep(EMPTY)).toBe('create-parent');
  });

  it('then requires at least one learner', () => {
    const set = createProfile(EMPTY, { ...learnerInput, role: 'parent' }, clockFrom(['p1'])).set;
    expect(nextOnboardingStep(set)).toBe('create-learner');
  });

  it('is done once a parent and a learner exist', () => {
    expect(nextOnboardingStep(seeded())).toBe('done');
  });
});

describe('storage-key namespacing (§3.3)', () => {
  it('scopes a key under its profile id', () => {
    expect(scopedKey('profile:kid1', 'progress')).toBe('p/profile:kid1/progress');
  });

  it('refuses to build a key without a profile id', () => {
    expect(() => scopedKey('', 'progress')).toThrow(/requires a profileId/);
  });

  it('two profiles never collide on the same logical key', () => {
    expect(scopedKey('profile:kid1', 'progress')).not.toBe(scopedKey('profile:kid2', 'progress'));
  });

  it('recognises scoped keys and rejects unscoped ones', () => {
    expect(isScopedKey('p/profile:kid1/progress')).toBe(true);
    expect(isScopedKey('progress')).toBe(false);
    expect(isScopedKey('p/kid1/progress')).toBe(false);
    expect(isScopedKey('p/profile:kid1/')).toBe(false);
  });

  it('round-trips through parseScopedKey', () => {
    expect(parseScopedKey(scopedKey('profile:kid1', 'library/history'))).toEqual({
      profileId: 'profile:kid1',
      key: 'library/history',
    });
    expect(parseScopedKey('progress')).toBeNull();
  });

  it('keysForProfile selects one profile without touching a sibling', () => {
    const all = [
      scopedKey('profile:kid1', 'progress'),
      scopedKey('profile:kid1', 'cards'),
      scopedKey('profile:kid2', 'progress'),
      'account:parentEmail',
    ];
    expect(keysForProfile(all, 'profile:kid1')).toEqual([
      'p/profile:kid1/progress',
      'p/profile:kid1/cards',
    ]);
  });
});

describe('createProfile and learnerType (F-LEARN-001 §3.3)', () => {
  it('stores the learnerType it is given', () => {
    expect(createProfile(EMPTY, { ...learnerInput, learnerType: 'self' }, clockFrom(['a'])).created.learnerType).toBe('self');
    expect(createProfile(EMPTY, { ...learnerInput, learnerType: 'child' }, clockFrom(['a'])).created.learnerType).toBe('child');
  });

  it('leaves the key out entirely when none is given (legacy shape; absent reads as child)', () => {
    const { created } = createProfile(EMPTY, learnerInput, clockFrom(['a']));
    expect('learnerType' in created).toBe(false);
  });

  it('still rejects every name validateDisplayName rejects, for both types', () => {
    for (const learnerType of ['child', 'self'] as const) {
      for (const displayName of ['', '   ', 'a'.repeat(NAME_MAX + 1), 'Suni 🐯', '日本']) {
        expect(() => createProfile(EMPTY, { ...learnerInput, displayName, learnerType }, clockFrom(['x']))).toThrow(
          /Invalid display name/,
        );
      }
    }
  });

  it('accepts accented and Hangul names with a learnerType', () => {
    for (const displayName of ['Andrés', '수니']) {
      expect(() =>
        createProfile(EMPTY, { ...learnerInput, displayName, learnerType: 'self' }, clockFrom(['x'])),
      ).not.toThrow();
    }
  });
});

describe('updateProfile (F-LEARN-001 §3.11)', () => {
  it('changes only the fields in the patch', () => {
    const before = seeded();
    const after = updateProfile(before, 'profile:kid1', { ageGroup: '10-11' });
    const kid = after.profiles[1];
    expect(kid?.ageGroup).toBe('10-11');
    expect(kid?.displayName).toBe('Suni');
    expect(kid?.avatar).toBe('hoya-orange');
    expect(after.activeId).toBe(before.activeId);
  });

  it('leaves every other profile untouched (same objects)', () => {
    const before = seeded();
    const after = updateProfile(before, 'profile:kid1', { avatar: 'hoya-blue' });
    expect(after.profiles[0]).toBe(before.profiles[0]);
    expect(after.profiles[2]).toBe(before.profiles[2]);
  });

  it('does not mutate its input', () => {
    const before = seeded();
    const snapshot = JSON.parse(JSON.stringify(before));
    updateProfile(before, 'profile:kid1', { displayName: 'Sun', ageGroup: '5-7', avatar: 'hoya-pink', learnerType: 'self' });
    expect(before).toEqual(snapshot);
  });

  it('applies several fields at once', () => {
    const after = updateProfile(seeded(), 'profile:kid2', {
      displayName: 'Jinny',
      ageGroup: '10-11',
      avatar: 'hoya-green',
      learnerType: 'self',
    });
    expect(after.profiles[2]).toMatchObject({
      id: 'profile:kid2',
      displayName: 'Jinny',
      ageGroup: '10-11',
      avatar: 'hoya-green',
      learnerType: 'self',
      role: 'learner',
    });
  });

  it('trims the name and applies the same rule as createProfile', () => {
    expect(updateProfile(seeded(), 'profile:kid1', { displayName: '  Sun  ' }).profiles[1]?.displayName).toBe('Sun');
    expect(updateProfile(seeded(), 'profile:kid1', { displayName: '수니' }).profiles[1]?.displayName).toBe('수니');
    for (const displayName of ['', '   ', 'a'.repeat(NAME_MAX + 1), 'Sun 🐯']) {
      expect(() => updateProfile(seeded(), 'profile:kid1', { displayName })).toThrow(/Invalid display name/);
    }
  });

  it('rejects a level, an avatar or a learnerType this build does not know', () => {
    const bad = (patch: object) => () => updateProfile(seeded(), 'profile:kid1', patch as never);
    expect(bad({ ageGroup: '12-14' })).toThrow(/Invalid level/);
    expect(bad({ avatar: 'hoya-red' })).toThrow(/Invalid avatar/);
    expect(bad({ learnerType: 'teacher' })).toThrow(/Invalid learner type/);
  });

  it('a failed patch changes nothing, even for fields that were valid', () => {
    const before = seeded();
    expect(() => updateProfile(before, 'profile:kid1', { avatar: 'hoya-pink', displayName: '' })).toThrow();
    expect(before.profiles[1]?.avatar).toBe('hoya-orange');
  });

  it('returns the same set for an unknown id', () => {
    const before = seeded();
    expect(updateProfile(before, 'profile:ghost', { displayName: 'Nobody' })).toBe(before);
  });

  it('an empty patch changes no field', () => {
    const before = seeded();
    expect(updateProfile(before, 'profile:kid1', {}).profiles).toEqual(before.profiles);
  });

  it('can set learnerType on a legacy profile that has none, and back to child', () => {
    const before = seeded();
    const toSelf = updateProfile(before, 'profile:kid1', { learnerType: 'self' });
    expect(toSelf.profiles[1]?.learnerType).toBe('self');
    expect(updateProfile(toSelf, 'profile:kid1', { learnerType: 'child' }).profiles[1]?.learnerType).toBe('child');
  });

  it('does not touch lastActiveAt, createdAt or the PIN hash', () => {
    const before = setActiveProfile(seeded(), 'profile:kid1', T0 + 9_000);
    const withPin: ProfileSet = {
      ...before,
      profiles: before.profiles.map((p) => ({ ...p, parentPinHash: 'h' })),
    };
    const after = updateProfile(withPin, 'profile:kid1', { displayName: 'Sun', learnerType: 'self' });
    expect(after.profiles[1]).toMatchObject({
      createdAt: new Date(T0).toISOString(),
      lastActiveAt: new Date(T0 + 9_000).toISOString(),
      parentPinHash: 'h',
    });
  });
});
