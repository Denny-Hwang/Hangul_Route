import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import { activeProfileSelector, useProfileStore } from '../profile-store';

const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };

describe('profile-store', () => {
  beforeEach(() => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
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

  it('setParentPin sets the hash on every profile', () => {
    useProfileStore.getState().createProfile(input);
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().setParentPin('hash123');
    for (const p of useProfileStore.getState().profiles) {
      expect(p.parentPinHash).toBe('hash123');
    }
  });
});
