import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import { readJson, writeJson } from '../../platform/storage';
import { onProfileRemoved } from '../profile-removal';
import { activeProfileSelector, useProfileStore } from '../profile-store';

const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };

describe('profile-store', () => {
  beforeEach(() => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    vi.mocked(writeJson).mockClear();
    vi.mocked(readJson).mockImplementation(async () => null);
  });

  it('createProfile appends and makes it active', () => {
    const p = useProfileStore.getState().createProfile(input);
    const s = useProfileStore.getState();
    expect(s.profiles).toHaveLength(1);
    expect(s.activeId).toBe(p.id);
    expect(p.displayName).toBe('Mina');
    expect(p.id).toMatch(/^profile:/);
  });

  it('activeProfileSelector returns the active profile, null when none', () => {
    expect(activeProfileSelector(useProfileStore.getState())).toBeNull();
    const p = useProfileStore.getState().createProfile(input);
    expect(activeProfileSelector(useProfileStore.getState())?.id).toBe(p.id);
  });

  it('setActive switches the active profile', () => {
    const a = useProfileStore.getState().createProfile(input);
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().setActive(a.id);
    expect(useProfileStore.getState().activeId).toBe(a.id);
  });

  it('remove reassigns active to the first remaining profile', () => {
    const a = useProfileStore.getState().createProfile(input);
    const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    // b is active (last created); removing it falls back to a
    useProfileStore.getState().remove(b.id);
    const s = useProfileStore.getState();
    expect(s.profiles).toHaveLength(1);
    expect(s.activeId).toBe(a.id);
  });

  it('remove of a non-active profile keeps the current active', () => {
    const a = useProfileStore.getState().createProfile(input);
    const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().remove(a.id);
    expect(useProfileStore.getState().activeId).toBe(b.id);
  });

  it('remove announces the removed id to per-profile stores, and unsubscribing stops it', () => {
    const a = useProfileStore.getState().createProfile(input);
    const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    const seen: string[] = [];
    const off = onProfileRemoved((id) => seen.push(id));
    useProfileStore.getState().remove(a.id);
    off();
    useProfileStore.getState().remove(b.id);
    expect(seen).toEqual([a.id]);
  });

  it('setParentPin sets the hash on every profile', () => {
    useProfileStore.getState().createProfile(input);
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().setParentPin('hash123');
    for (const p of useProfileStore.getState().profiles) {
      expect(p.parentPinHash).toBe('hash123');
    }
  });

  describe('learnerType (F-LEARN-001)', () => {
    it('createProfile stores the learnerType it is given', () => {
      const p = useProfileStore.getState().createProfile({ ...input, learnerType: 'self' });
      expect(p.learnerType).toBe('self');
      expect(useProfileStore.getState().profiles[0]?.learnerType).toBe('self');
    });

    it('createProfile without one leaves it undefined', () => {
      const p = useProfileStore.getState().createProfile(input);
      expect(p.learnerType).toBeUndefined();
    });

    it('hydrating a profile saved before this spec leaves learnerType undefined and does not rewrite storage', async () => {
      const legacy = {
        id: 'profile:old1',
        displayName: 'Mina',
        ageGroup: '5-7',
        avatar: 'hoya-orange',
        role: 'learner',
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      vi.mocked(readJson).mockImplementation(async (key: string) => {
        if (key === 'profiles') return [legacy];
        if (key === 'profiles:active') return 'profile:old1';
        return null;
      });
      await useProfileStore.getState().hydrate();
      const s = useProfileStore.getState();
      expect(s.profiles).toEqual([legacy]);
      expect(s.profiles[0]?.learnerType).toBeUndefined();
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('hydrating a profile that has learnerType keeps it', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) =>
        key === 'profiles'
          ? [{ id: 'profile:n1', displayName: 'Ana', ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: 'x', learnerType: 'self' }]
          : null,
      );
      await useProfileStore.getState().hydrate();
      expect(useProfileStore.getState().profiles[0]?.learnerType).toBe('self');
    });
  });

  describe('updateProfile', () => {
    it('applies the patch in memory and persists the profiles', () => {
      const p = useProfileStore.getState().createProfile(input);
      vi.mocked(writeJson).mockClear();
      useProfileStore.getState().updateProfile(p.id, { ageGroup: '10-11', avatar: 'hoya-green', learnerType: 'self' });
      const updated = useProfileStore.getState().profiles[0];
      expect(updated).toMatchObject({ ageGroup: '10-11', avatar: 'hoya-green', learnerType: 'self', displayName: 'Mina' });
      expect(writeJson).toHaveBeenCalledWith('profiles', useProfileStore.getState().profiles);
      expect(writeJson).toHaveBeenCalledWith('profiles:active', p.id);
    });

    it('keeps the active profile and the other profiles', () => {
      const a = useProfileStore.getState().createProfile(input);
      const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
      useProfileStore.getState().updateProfile(a.id, { displayName: 'Mimi' });
      const s = useProfileStore.getState();
      expect(s.activeId).toBe(b.id);
      expect(s.profiles.map((p) => p.displayName)).toEqual(['Mimi', 'Jin']);
    });

    it('rejects an invalid name without changing or persisting anything', () => {
      const p = useProfileStore.getState().createProfile(input);
      vi.mocked(writeJson).mockClear();
      expect(() => useProfileStore.getState().updateProfile(p.id, { displayName: '' })).toThrow(/Invalid display name/);
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('an unknown id changes and persists nothing', () => {
      useProfileStore.getState().createProfile(input);
      vi.mocked(writeJson).mockClear();
      useProfileStore.getState().updateProfile('profile:ghost', { displayName: 'Nobody' });
      expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
      expect(writeJson).not.toHaveBeenCalled();
    });
  });
});
