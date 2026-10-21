import { beforeEach, describe, expect, it, vi } from 'vitest';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16 (row OA-4a): one profile list across tabs. The storage is a
// shared map (the origin's IndexedDB); "another tab" writes it directly, as its own store would.

const stored = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (stored.has(key) ? structuredClone(stored.get(key)) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void stored.set(key, structuredClone(value))),
}));
const posted = vi.fn();
let onChanged: (() => void) | null = null;
vi.mock('../../platform/profiles-channel', () => ({
  postProfilesChanged: () => posted(),
  subscribeProfilesChanged: (cb: () => void) => {
    onChanged = cb;
    return () => {
      onChanged = null;
    };
  },
}));

import { writeJson } from '../../platform/storage';
import { followProfileChanges, useProfileStore } from '../profile-store';

const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
const other = (id: string, displayName: string) => ({ id, displayName, ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' });
const ids = (): string[] => useProfileStore.getState().profiles.map((p) => p.id);
const storedIds = (): string[] => ((stored.get('profiles') as { id: string }[] | undefined) ?? []).map((p) => p.id);
// Ids are unique per test: the store remembers every id this tab has seen (an id seen and gone was removed here).
const settle = async (): Promise<void> => {
  await vi.waitFor(() => expect(posted).toHaveBeenCalled());
  posted.mockClear();
};

describe('profile store across tabs (OA-D19)', () => {
  beforeEach(async () => {
    stored.clear();
    posted.mockClear();
    vi.mocked(writeJson).mockClear();
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    await useProfileStore.getState().hydrate();
  });

  it('a learner added in one tab survives a pick and an edit in another (CS-16)', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    // Another tab adds Sora.
    stored.set('profiles', [...(stored.get('profiles') as unknown[]), other('profile:sora1', 'Sora')]);
    vi.mocked(writeJson).mockClear();

    // A pick here writes only the active key.
    useProfileStore.getState().setActive(mina.id);
    await vi.waitFor(() => expect(writeJson).toHaveBeenCalledWith('profiles:active', mina.id));
    expect(vi.mocked(writeJson).mock.calls.map(([key]) => key)).toEqual(['profiles:active']);
    expect(storedIds()).toEqual([mina.id, jin.id, 'profile:sora1']);

    // An edit here merges: Sora is kept, and appears in this tab too.
    useProfileStore.getState().updateProfile(jin.id, { displayName: 'Jinny' });
    await settle();
    expect(storedIds()).toEqual([mina.id, jin.id, 'profile:sora1']);
    expect(ids()).toEqual([mina.id, jin.id, 'profile:sora1']);
    expect(useProfileStore.getState().activeId).toBe(mina.id);
  });

  it('a patch here survives another tab\'s newer copy of the same learner', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    stored.set('profiles', [{ ...(stored.get('profiles') as Record<string, unknown>[])[0], avatar: 'hoya-green' }]);
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await settle();
    expect(stored.get('profiles')).toEqual([expect.objectContaining({ id: mina.id, displayName: 'Mimi', avatar: 'hoya-green' })]);
  });

  it('a removed learner does not come back from a tab that still holds it (tombstone)', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    useProfileStore.getState().remove(jin.id);
    await settle();
    expect(storedIds()).toEqual([mina.id]);
    expect(stored.get('profiles:tombstones')).toEqual({ v: 1, ids: [jin.id], at: { [jin.id]: expect.any(Number) } });

    // A second tab that never saw the removal still holds Jin in memory, and edits Mina.
    useProfileStore.setState({ profiles: [...useProfileStore.getState().profiles, { ...(useProfileStore.getState().profiles[0]!), id: jin.id, displayName: 'Jin' }] });
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await settle();
    expect(storedIds()).toEqual([mina.id]);
    expect(ids()).toEqual([mina.id]);
  });

  it('hydrate leaves out a tombstoned learner an older bundle wrote back', async () => {
    stored.set('profiles', [other('profile:a1', 'Ana'), other('profile:b1', 'Ben')]);
    stored.set('profiles:tombstones', { v: 1, ids: ['profile:b1'], at: { 'profile:b1': Date.now() } });
    await useProfileStore.getState().hydrate();
    expect(ids()).toEqual(['profile:a1']);
  });

  it('a message from another tab reads the list again; the active learner stays, or moves when removed there', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    const off = followProfileChanges();
    stored.set('profiles', [...(stored.get('profiles') as unknown[]), other('profile:sora2', 'Sora')]);
    onChanged?.();
    await vi.waitFor(() => expect(ids()).toEqual([mina.id, 'profile:sora2']));
    expect(useProfileStore.getState().activeId).toBe(mina.id);

    stored.set('profiles', [other('profile:sora2', 'Sora')]);
    stored.set('profiles:tombstones', { v: 1, ids: [mina.id], at: { [mina.id]: Date.now() } });
    onChanged?.();
    await vi.waitFor(() => expect(ids()).toEqual(['profile:sora2']));
    expect(useProfileStore.getState().activeId).toBe('profile:sora2');
    off();
    expect(onChanged).toBeNull();
  });

  it('a refresh before hydrate, or of a list that is not one, changes nothing', async () => {
    const off = followProfileChanges();
    useProfileStore.setState({ hydrated: false });
    stored.set('profiles', [other('profile:a1', 'Ana')]);
    onChanged?.();
    await Promise.resolve();
    expect(ids()).toEqual([]);
    useProfileStore.setState({ hydrated: true });
    stored.set('profiles', 'junk');
    await useProfileStore.getState().refresh();
    expect(ids()).toEqual([]);
    off();
  });

  it('runs inside the hr:profiles Web Lock where the browser has one', async () => {
    const request = vi.fn(async (_name: string, step: () => Promise<unknown>) => step());
    vi.stubGlobal('navigator', { locks: { request } });
    useProfileStore.getState().createProfile(input);
    await settle();
    expect(request).toHaveBeenCalledWith('hr:profiles', expect.any(Function));
    vi.unstubAllGlobals();
  });
});
