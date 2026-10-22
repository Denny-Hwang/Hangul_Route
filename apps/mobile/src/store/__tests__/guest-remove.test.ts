import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2, OQ-G4 (row GU-5, section 19): **Remove the first quest** deletes the
 * guest record and every per-profile key of its id (the OA-7a sweep through `notifyProfileRemoved`), never a saved
 * or removed learner's keys, decides nothing on a list it cannot read, and sends no event with the id. Storage is an
 * in-memory map.
 */
const disk = vi.hoisted(() => new Map<string, string>());
/** Every storage write and delete, in order; and the keys whose reads (`read`) or writes (`write`) fail. */
const ops = vi.hoisted(() => [] as string[]);
const failing = vi.hoisted(() => ({ read: new Set<string>(), write: new Set<string>(), readAfterWrite: new Set<string>() }));
const parse = (key: string): unknown => (disk.has(key) ? JSON.parse(disk.get(key)!) : null);
const strict = (key: string): unknown => {
  if (failing.read.has(key) || (failing.readAfterWrite.has(key) && ops.includes(`write:${key}`))) throw new Error('read failed');
  return parse(key);
};
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (failing.read.has(key) ? null : parse(key))),
  readJsonStrict: vi.fn(async (key: string) => strict(key)),
  readJsonExact: vi.fn(async (key: string) => strict(key)),
  readJsonExactFresh: vi.fn(async (key: string) => strict(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    // The list write takes a while (an IndexedDB transaction), so a delete that does not wait for it lands first.
    await new Promise((resolve) => setTimeout(resolve, key === 'profiles' ? 5 : 0));
    if (failing.write.has(key)) throw new Error('QuotaExceededError');
    ops.push(`write:${key}`);
    disk.set(key, JSON.stringify(value));
  }),
  updateJson: vi.fn(async (key: string, next: (current: unknown) => unknown) => {
    const value = next(parse(key));
    if (value === undefined) return false;
    disk.set(key, JSON.stringify(value));
    return true;
  }),
  removeKey: vi.fn(async (key: string) => {
    ops.push(`remove:${key}`);
    disk.delete(key);
  }),
  listKeys: vi.fn(async () => [...disk.keys()]),
  setWriteFence: vi.fn(),
  requestPersistence: vi.fn(async () => false),
}));
const sent = vi.hoisted(() => [] as { name: string; payload?: unknown; profileId?: string }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    sent.push(event);
    return true;
  }),
}));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
vi.mock('../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
vi.mock('../../platform/join-handoff', () => ({ takeJoinHandoff: () => null }));

import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { useGuestStore } from '../guest-store';
import { useAccountStore } from '../account-store';
import { gateOpensDirectlyAfterRemove, removeLiveGuest } from '../guest-remove';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';

const STARTED = '2026-10-21T09:00:00.000Z';
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: STARTED, lastAt: STARTED, via: 'chooser', questDone: true };
const MINA: Profile = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' };

/** The keys the guest's quest 1 left under its id, as any learner's would be. */
function seedGuestKeys(id: string = GUEST.id): void {
  disk.set(`progress:${id}`, JSON.stringify({ v: 1, quests: {}, cards: [{ cardId: 'card:book' }] }));
  disk.set(`settings:${id}`, JSON.stringify({ v: 1 }));
  disk.set(`route-ui:${id}`, JSON.stringify({ v: 1 }));
}
const keysOf = (id: string): string[] => [...disk.keys()].filter((k) => k.endsWith(`:${id}`));

beforeEach(() => {
  disk.clear();
  ops.length = 0;
  failing.read.clear();
  failing.write.clear();
  failing.readAfterWrite.clear();
  sent.length = 0;
  disk.set('profiles', JSON.stringify([MINA]));
  useProfileStore.setState({ profiles: [MINA], activeId: MINA.id, hydrated: true });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), catchUp: {}, catchUpFound: {}, openSession: null });
  disk.set('guest', JSON.stringify(GUEST));
  useGuestStore.setState({ record: GUEST, running: false, hydrated: true, memoryOnly: false });
});

describe('[GU] removeLiveGuest (Remove the first quest, 9.2)', () => {
  it('deletes hr:guest and every key of the guest id; the learner and its keys stay', async () => {
    seedGuestKeys();
    seedGuestKeys(MINA.id);
    await useProgressStore.getState().hydrate(GUEST.id);
    expect(await removeLiveGuest()).toBe(true);
    expect(disk.has('guest')).toBe(false);
    expect(keysOf(GUEST.id)).toEqual([]);
    expect(useProgressStore.getState().byProfile[GUEST.id]).toBeUndefined();
    expect(keysOf(MINA.id).sort()).toEqual([`progress:${MINA.id}`, `route-ui:${MINA.id}`, `settings:${MINA.id}`]);
    expect(useGuestStore.getState().record).toBeNull();
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toEqual([MINA.id]);
    // No event names the guest's id (GU-D15), and none is sent for a removal at all.
    expect(sent.filter((e) => e.profileId === GUEST.id)).toEqual([]);
    expect(sent.filter((e) => e.name.startsWith('guest.'))).toEqual([]);
  });

  it('ends a run of it and forgets a record held in memory only (storage blocked)', async () => {
    disk.delete('guest');
    seedGuestKeys();
    useGuestStore.setState({ record: GUEST, running: true, memoryOnly: true });
    expect(await removeLiveGuest()).toBe(true);
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false, memoryOnly: false });
    expect(keysOf(GUEST.id)).toEqual([]);
  });

  it('a record whose id is already a profile (a save cut short) only goes: the learner\'s keys stay', async () => {
    const saved = { ...MINA, id: GUEST.id };
    disk.set('profiles', JSON.stringify([MINA, saved]));
    seedGuestKeys();
    expect(await removeLiveGuest()).toBe(true);
    expect(disk.has('guest')).toBe(false);
    expect(keysOf(GUEST.id).length).toBe(3);
  });

  it('a tombstoned id keeps its keys for the OA-7a launch sweep; the record goes', async () => {
    disk.set('profiles:tombstones', JSON.stringify({ v: 1, ids: [GUEST.id] }));
    seedGuestKeys();
    expect(await removeLiveGuest()).toBe(true);
    expect(disk.has('guest')).toBe(false);
    expect(keysOf(GUEST.id).length).toBe(3);
  });

  it('decides nothing when the profile list or the record cannot be read', async () => {
    seedGuestKeys();
    failing.read.add('profiles');
    expect(await removeLiveGuest()).toBe(false);
    expect(disk.has('guest')).toBe(true);
    expect(keysOf(GUEST.id).length).toBe(3);
    failing.read.clear();
    failing.read.add('guest');
    expect(await removeLiveGuest()).toBe(false);
    expect(disk.has('guest')).toBe(true);
  });

  it('a record that does not parse: the id it names loses its keys, the record goes', async () => {
    disk.set('guest', JSON.stringify({ v: 9, id: GUEST.id }));
    useGuestStore.setState({ record: null });
    seedGuestKeys();
    expect(await removeLiveGuest()).toBe(true);
    expect(disk.has('guest')).toBe(false);
    expect(keysOf(GUEST.id)).toEqual([]);
  });
});

describe('[GU] the gate read again after Remove on the guest-only gate (GU-5 review, 9.2, CS-G10)', () => {
  beforeEach(() => {
    useAccountStore.setState({ parentPinHash: null, pinHashReadFailed: false });
  });

  it('a self-only device with no PIN and the guest gone: the destination opens directly', async () => {
    expect(await removeLiveGuest()).toBe(true);
    expect(await gateOpensDirectlyAfterRemove()).toBe(true);
  });

  it('the guest was saved as a child in another tab between the sheet and its confirm: the gate is required', async () => {
    const savedChild = { ...MINA, id: GUEST.id, displayName: 'Jun', learnerType: 'child' as const };
    disk.set('profiles', JSON.stringify([MINA, savedChild]));
    expect(await removeLiveGuest()).toBe(true);
    // This tab's memory still holds only Mina; the stored list is read again.
    expect(await gateOpensDirectlyAfterRemove()).toBe(false);
    expect(useProfileStore.getState().profiles.map((p) => p.id)).toContain(GUEST.id);
    // The saved learner's keys were never touched.
    expect(disk.has('profiles')).toBe(true);
  });

  it('a PIN another tab set meanwhile (this tab never heard of it): the gate is required, and the PIN is now known here', async () => {
    disk.set('account:parentPinHash', JSON.stringify('h:9999'));
    expect(await removeLiveGuest()).toBe(true);
    expect(await gateOpensDirectlyAfterRemove()).toBe(false);
    expect(useAccountStore.getState().parentPinHash).toBe('h:9999');
  });

  it('a read that fails opens nothing (fail closed)', async () => {
    expect(await removeLiveGuest()).toBe(true);
    failing.read.add('profiles');
    expect(await gateOpensDirectlyAfterRemove()).toBe(false);
  });
});

describe('[GU] a play in another tab never writes a removed record back (GU-5 review)', () => {
  it('Remove in tab A, then tab B (its record still in memory) records a play: hr:guest stays gone and B\'s run ends', async () => {
    useGuestStore.setState({ record: GUEST, running: true, memoryOnly: false });
    // Tab A's Remove, as storage sees it: hr:guest is gone. Tab B's store has not heard yet.
    disk.delete('guest');
    await useGuestStore.getState().recordGuestPlay({ questDone: true });
    expect(disk.has('guest')).toBe(false);
    expect(useGuestStore.getState()).toMatchObject({ record: null, running: false });
  });

  it('the stored record is this run\'s: the play is written as before', async () => {
    useGuestStore.setState({ record: GUEST, running: true, memoryOnly: false });
    await useGuestStore.getState().recordGuestPlay({ questDone: true });
    expect(JSON.parse(disk.get('guest')!)).toMatchObject({ id: GUEST.id, questDone: true });
    expect(useGuestStore.getState().running).toBe(true);
  });
});
