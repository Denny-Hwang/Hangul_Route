import { beforeEach, describe, expect, it, vi } from 'vitest';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, CS-16 (row OA-4a): one profile list across tabs. The storage is a
// shared map (the origin's IndexedDB); "another tab" writes it directly, as its own store would.

const stored = new Map<string, unknown>();
/** A storage round trip that takes a macrotask, as IndexedDB and AsyncStorage do (so two same-tick steps can overlap). */
let slowReads = false;
async function readStored(key: string): Promise<unknown> {
  if (slowReads) await new Promise((resolve) => setTimeout(resolve, 0));
  return stored.has(key) ? structuredClone(stored.get(key)) : null;
}
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn((key: string) => readStored(key)),
  readJsonStrict: vi.fn((key: string) => readStored(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => void stored.set(key, structuredClone(value))),
}));
const closeGrownUpSession = vi.fn();
vi.mock('../grown-up-session', () => ({ closeGrownUpSession: () => closeGrownUpSession() }));
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

import { readJsonStrict, writeJson } from '../../platform/storage';
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
    slowReads = false;
    closeGrownUpSession.mockClear();
    vi.mocked(readJsonStrict).mockImplementation(readStored);
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
  it('OA-D13: a learner removed and then restored under the same id (a file, a Rescue Code) stays', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    const saved = useProfileStore.getState().profiles.find((p) => p.id === jin.id)!;
    useProfileStore.getState().remove(jin.id);
    await settle();
    expect(stored.get('profiles:tombstones')).toMatchObject({ ids: [jin.id] });

    useProfileStore.getState().adoptProfile(saved);
    await settle();
    expect(storedIds()).toEqual([mina.id, jin.id]);
    expect(ids()).toEqual([mina.id, jin.id]);
    expect(stored.get('profiles:tombstones')).toEqual({ v: 1, ids: [], at: {} });
    // A refresh (another tab's message) keeps it, and so does the next launch.
    await useProfileStore.getState().refresh();
    expect(ids()).toEqual([mina.id, jin.id]);
    await useProfileStore.getState().hydrate();
    expect(ids()).toEqual([mina.id, jin.id]);
  });

  it('OA-D13: a tab that saw the removal takes the learner back when another tab restores it', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    stored.set('profiles', [...(stored.get('profiles') as unknown[]), other('profile:kai1', 'Kai')]);
    await useProfileStore.getState().refresh();
    expect(ids()).toEqual([mina.id, 'profile:kai1']);
    // Another tab removes Kai, then restores Kai from a file.
    stored.set('profiles', [(stored.get('profiles') as unknown[])[0]]);
    stored.set('profiles:tombstones', { v: 1, ids: ['profile:kai1'], at: { 'profile:kai1': Date.now() } });
    await useProfileStore.getState().refresh();
    expect(ids()).toEqual([mina.id]);
    stored.set('profiles', [...(stored.get('profiles') as unknown[]), other('profile:kai1', 'Kai')]);
    stored.set('profiles:tombstones', { v: 1, ids: [], at: {} });
    await useProfileStore.getState().refresh();
    expect(ids()).toEqual([mina.id, 'profile:kai1']);
    // A write here keeps Kai too.
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await settle();
    expect(storedIds()).toEqual([mina.id, 'profile:kai1']);
  });

  it('a failed read writes nothing over the stored list, and the change is written on the next refresh (CS-16)', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    stored.set('profiles', [...(stored.get('profiles') as unknown[]), other('profile:sora3', 'Sora')]);
    vi.mocked(writeJson).mockClear();
    vi.mocked(readJsonStrict).mockRejectedValueOnce(new Error('storage busy'));
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await vi.waitFor(() => expect(readJsonStrict).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vi.mocked(writeJson).mock.calls.map(([key]) => key)).not.toContain('profiles');
    expect(storedIds()).toEqual([mina.id, 'profile:sora3']);

    await useProfileStore.getState().refresh();
    expect(stored.get('profiles')).toEqual([expect.objectContaining({ id: mina.id, displayName: 'Mimi' }), expect.objectContaining({ id: 'profile:sora3' })]);
    expect(ids()).toEqual([mina.id, 'profile:sora3']);
  });

  it('a failed read of the tombstones never writes over them (an id removed before stays removed)', async () => {
    useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    const tombstones = { v: 1, ids: ['profile:old1'], at: { 'profile:old1': Date.now() } };
    stored.set('profiles:tombstones', tombstones);
    vi.mocked(readJsonStrict).mockImplementation(async (key: string) => {
      if (key === 'profiles:tombstones') throw new Error('storage busy');
      return readStored(key);
    });
    useProfileStore.getState().remove(jin.id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stored.get('profiles:tombstones')).toEqual(tombstones);
    vi.mocked(readJsonStrict).mockImplementation(readStored);
    await useProfileStore.getState().refresh();
    expect(stored.get('profiles:tombstones')).toMatchObject({ ids: ['profile:old1', jin.id] });
  });

  it('without Web Locks, writes in the same tick never overlap: every change lands (native, older Safari)', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    const kai = useProfileStore.getState().createProfile({ ...input, displayName: 'Kai' });
    await settle();
    slowReads = true;
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    useProfileStore.getState().updateProfile(jin.id, { displayName: 'Jinny' });
    useProfileStore.getState().applyServerProfile(kai.id, { displayName: 'Kaia', ageGroup: '8-9', avatar: 'hoya-blue' });
    const names = (list: { displayName: string }[]) => list.map((p) => p.displayName);
    // The queued steps run one after another (the first may write all three; the rest find nothing left to write).
    await vi.waitFor(() => expect(names(stored.get('profiles') as { displayName: string }[])).toEqual(['Mimi', 'Jinny', 'Kaia']));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(names(stored.get('profiles') as { displayName: string }[])).toEqual(['Mimi', 'Jinny', 'Kaia']);
    expect(names(useProfileStore.getState().profiles)).toEqual(['Mimi', 'Jinny', 'Kaia']);
  });

  it('two removals in the same tick keep both tombstones', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    const kai = useProfileStore.getState().createProfile({ ...input, displayName: 'Kai' });
    await settle();
    slowReads = true;
    useProfileStore.getState().remove(jin.id);
    useProfileStore.getState().remove(kai.id);
    await vi.waitFor(() => expect(storedIds()).toEqual([mina.id]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(storedIds()).toEqual([mina.id]);
    expect(stored.get('profiles:tombstones')).toMatchObject({ ids: [jin.id, kai.id] });
  });

  it('OA-D5b (1), CS-15: another tab removing the active learner here closes the grown-up session like a pick', async () => {
    useProfileStore.getState().createProfile(input);
    const jin = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    const before = useProfileStore.getState().activeSince;
    closeGrownUpSession.mockClear();
    vi.mocked(writeJson).mockClear();
    await new Promise((resolve) => setTimeout(resolve, 2));
    stored.set('profiles', [(stored.get('profiles') as unknown[])[0]]);
    stored.set('profiles:tombstones', { v: 1, ids: [jin.id], at: { [jin.id]: Date.now() } });
    await useProfileStore.getState().refresh();
    const after = useProfileStore.getState();
    expect(after.activeId).not.toBe(jin.id);
    expect(after.activeSince).toBeGreaterThan(before);
    expect(closeGrownUpSession).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(writeJson).toHaveBeenCalledWith('profiles:active', after.activeId));
  });

  it('a pick keeps its lastActiveAt over a refresh, and the next list write stores it', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await settle();
    const renders = vi.fn();
    const unsub = useProfileStore.subscribe(renders);
    useProfileStore.getState().setActive(mina.id);
    const stamped = useProfileStore.getState().profiles[0]?.lastActiveAt;
    renders.mockClear();
    await useProfileStore.getState().refresh();
    expect(useProfileStore.getState().profiles[0]?.lastActiveAt).toBe(stamped);
    // Memory and the merge agree, so a refresh with nothing new sets no state.
    expect(renders).not.toHaveBeenCalled();
    unsub();
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await settle();
    expect((stored.get('profiles') as { lastActiveAt?: string }[])[0]?.lastActiveAt).toBe(stamped);
  });
  it('without Web Locks, two quick patches on one learner both land, in memory and on disk (OA-4a review)', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    slowReads = true;
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    useProfileStore.getState().updateProfile(mina.id, { avatar: 'hoya-green' });
    const both = expect.objectContaining({ id: mina.id, displayName: 'Mimi', avatar: 'hoya-green' });
    await vi.waitFor(() => expect(stored.get('profiles')).toEqual([both]));
    // A refresh in between (another tab's message) never moves memory back to the older stored copy.
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mina' });
    const refreshing = useProfileStore.getState().refresh();
    expect(useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
    await refreshing;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(useProfileStore.getState().profiles[0]).toMatchObject({ displayName: 'Mina', avatar: 'hoya-green' });
    expect(stored.get('profiles')).toEqual([expect.objectContaining({ displayName: 'Mina', avatar: 'hoya-green' })]);
  });

  it('a server change applied while an edit is still being written keeps both', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    slowReads = true;
    useProfileStore.getState().updateProfile(mina.id, { avatar: 'hoya-green' });
    useProfileStore.getState().applyServerProfile(mina.id, { displayName: 'Mimi', ageGroup: '8-9', avatar: 'hoya-green' });
    const both = expect.objectContaining({ displayName: 'Mimi', avatar: 'hoya-green' });
    await vi.waitFor(() => expect(stored.get('profiles')).toEqual([both]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(useProfileStore.getState().profiles).toEqual([both]);
  });

  it('a damaged stored item is left out, and never stops the next write', async () => {
    const mina = useProfileStore.getState().createProfile(input);
    await settle();
    stored.set('profiles', [null, 7, { name: 'no id' }, ...(stored.get('profiles') as unknown[]), other('profile:sora4', 'Sora')]);
    useProfileStore.getState().updateProfile(mina.id, { displayName: 'Mimi' });
    await vi.waitFor(() => expect(storedIds()).toEqual([mina.id, 'profile:sora4']));
    expect(ids()).toEqual([mina.id, 'profile:sora4']);
  });

  it('a launch whose active learner was removed in another tab starts on the first learner', async () => {
    stored.set('profiles', [other('profile:a1', 'Ana'), other('profile:b1', 'Bo')]);
    stored.set('profiles:active', 'profile:gone1');
    await useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().activeId).toBe('profile:a1');
    stored.set('profiles:active', null);
    await useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().activeId).toBeNull();
  });
});
