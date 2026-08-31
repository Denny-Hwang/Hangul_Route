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

  it('rejects emoji and Korean/Chinese — the UI is English (§3.2)', () => {
    expect(validateDisplayName('수니')).toBe('non-latin');
    expect(validateDisplayName('Suni 🐯')).toBe('non-latin');
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

  it('removeProfile leaves an untouched active id alone', () => {
    const before = setActiveProfile(seeded(), 'profile:kid1', T0);
    expect(removeProfile(before, 'profile:kid2').activeId).toBe('profile:kid1');
  });

  it('renameProfile validates the new name', () => {
    expect(renameProfile(seeded(), 'profile:kid1', 'Sun').profiles[1]?.displayName).toBe('Sun');
    expect(() => renameProfile(seeded(), 'profile:kid1', '수니')).toThrow(/Invalid display name/);
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
