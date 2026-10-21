import type { Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-5 (OA-D9, sections 6.3, 13.1, 13.2, 15; CS-3, CS-4; section 20):
 * the locks key read and written, the fail-closed read with its one retry on a fresh connection, a lock void without
 * a PIN, the removal in the same write sequence, and `verifyForLockedProfile`. Storage is an in-memory map.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const fail = vi.hoisted(() => ({ exact: 0, fresh: 0, update: false }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonExact: vi.fn(async (key: string) => {
    if (fail.exact > 0) {
      fail.exact -= 1;
      throw new Error('read failed');
    }
    return disk.has(key) ? JSON.parse(disk.get(key)!) : null;
  }),
  readJsonExactFresh: vi.fn(async (key: string) => {
    if (fail.fresh > 0) {
      fail.fresh -= 1;
      throw new Error('read failed');
    }
    return disk.has(key) ? JSON.parse(disk.get(key)!) : null;
  }),
  updateJson: vi.fn(async (key: string, next: (current: unknown) => unknown) => {
    if (fail.update) throw new Error('read failed');
    let current: unknown = null;
    try {
      current = disk.has(key) ? JSON.parse(disk.get(key)!) : null;
    } catch {
      current = null;
    }
    const value = next(current);
    if (value === undefined) return false;
    disk.set(key, JSON.stringify(value));
    return true;
  }),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
}));
const sent = vi.hoisted(() => [] as { name: string; payload: unknown }[]);
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async (event: { name: string; payload: unknown }) => void sent.push(event)) }));
const posted = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../platform/profiles-channel', () => ({
  postProfilesChanged: () => void (posted.n += 1),
  subscribeProfilesChanged: () => () => undefined,
}));

import { INITIAL_ATTEMPT_STATE, type PinHasher } from '../../logic/profiles/pin-hash';
import { useAccountStore } from '../account-store';
import {
  dropProfileLock,
  hydrateProfileLocks,
  lockedIds,
  locksUnread,
  readProfileLocks,
  resetProfileLocks,
  setProfileLocked,
  useProfileLocks,
  verifyForLockedProfile,
} from '../profile-locks';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';

const learner = (id: string): Profile => ({
  id,
  displayName: id.slice(8),
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});
const three = [learner('profile:mina'), learner('profile:jun'), learner('profile:sora')];
const KEY = 'profiles:locks';
const stored = (): unknown => (disk.has(KEY) ? JSON.parse(disk.get(KEY)!) : undefined);
const hasher: PinHasher = { hash: async (pin) => `h:${pin}`, verify: async (pin, hash) => hash === `h:${pin}` };

beforeEach(() => {
  disk.clear();
  fail.exact = 0;
  fail.fresh = 0;
  fail.update = false;
  sent.length = 0;
  posted.n = 0;
  resetProfileLocks();
  useAccountStore.setState({ parentPinHash: 'h:1234', pinAttempts: INITIAL_ATTEMPT_STATE, pinResetRequestedAt: null });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  useProfileStore.setState({ profiles: three, activeId: 'profile:mina', hydrated: true });
});

describe('[OA] the locks key: read and write (13.1)', () => {
  it('a missing key is no locks; a lock is written to hr:profiles:locks, nowhere in a profile, and holds at the next read', async () => {
    expect(await readProfileLocks()).toEqual([]);
    expect(await setProfileLocked('profile:sora', true, three)).toBe(true);
    expect(stored()).toEqual({ v: 1, ids: ['profile:sora'] });
    expect(lockedIds(three)).toEqual(['profile:sora']);
    expect(useProfileStore.getState().profiles.every((p) => !('locked' in p))).toBe(true);
    resetProfileLocks();
    await hydrateProfileLocks();
    expect(lockedIds(three)).toEqual(['profile:sora']);
  });

  it('an unlock takes only that id out; each change tells the other tabs and sends profile.lock_changed with locked only', async () => {
    await setProfileLocked('profile:jun', true, three);
    await setProfileLocked('profile:sora', true, three);
    await setProfileLocked('profile:sora', false, three);
    expect(stored()).toEqual({ v: 1, ids: ['profile:jun'] });
    expect(posted.n).toBe(3);
    expect(sent.map((e) => e.payload)).toEqual([{ locked: true }, { locked: true }, { locked: false }]);
    expect(sent.every((e) => e.name === 'profile.lock_changed' && !JSON.stringify(e).includes('profile:'))).toBe(true);
  });

  it('a write whose read fails writes nothing, changes nothing and sends nothing', async () => {
    fail.update = true;
    expect(await setProfileLocked('profile:sora', true, three)).toBe(false);
    expect(stored()).toBeUndefined();
    expect(lockedIds(three)).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('[OA] the fail-closed read (13.2)', () => {
  it('a failed read is retried once on a fresh connection; a good retry is a good read', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:sora'] }));
    fail.exact = 1;
    await hydrateProfileLocks();
    expect(useProfileLocks.getState().read).toEqual(['profile:sora']);
    expect(locksUnread()).toBe(false);
  });

  it('two failed reads lock every learner while a PIN exists, with the locksUnread line, until a read succeeds', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:sora'] }));
    fail.exact = 1;
    fail.fresh = 1;
    await hydrateProfileLocks();
    expect(lockedIds(three)).toEqual(['profile:mina', 'profile:jun', 'profile:sora']);
    expect(locksUnread()).toBe(true);
    await hydrateProfileLocks();
    expect(lockedIds(three)).toEqual(['profile:sora']);
    expect(locksUnread()).toBe(false);
  });

  it('a stored record that does not parse is a failed read, never "no locks"', async () => {
    disk.set(KEY, JSON.stringify({ v: 7, ids: [] }));
    await hydrateProfileLocks();
    expect(lockedIds(three)).toHaveLength(3);
  });

  it('an unlock over an unreadable record opens only that learner', async () => {
    disk.set(KEY, '{broken');
    await hydrateProfileLocks();
    expect(useProfileLocks.getState().read).toBe('unread');
    await setProfileLocked('profile:mina', false, three);
    expect(stored()).toEqual({ v: 1, ids: ['profile:jun', 'profile:sora'] });
    expect(lockedIds(three)).toEqual(['profile:jun', 'profile:sora']);
  });
});

describe('[OA] a lock without a PIN is void (CS-4)', () => {
  it('no PIN: no learner is locked and no unread line, whatever is stored', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:sora'] }));
    await hydrateProfileLocks();
    useAccountStore.setState({ parentPinHash: null });
    expect(lockedIds(three)).toEqual([]);
    fail.exact = 1;
    fail.fresh = 1;
    await hydrateProfileLocks();
    expect(lockedIds(three)).toEqual([]);
    expect(locksUnread()).toBe(false);
  });

  it('grown-up device roles are never locked; a stray id names no one', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:mom', 'profile:gone'] }));
    await hydrateProfileLocks();
    expect(lockedIds([...three, { ...learner('profile:mom'), role: 'parent' }])).toEqual([]);
  });
});

describe('[OA] removal leaves the locks in the same write sequence (13.2)', () => {
  it('dropProfileLock takes the id out, and leaves a record without it as it is', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:jun', 'profile:sora'] }));
    await dropProfileLock('profile:sora');
    expect(stored()).toEqual({ v: 1, ids: ['profile:jun'] });
    await dropProfileLock('profile:mina');
    expect(stored()).toEqual({ v: 1, ids: ['profile:jun'] });
    fail.update = true;
    await expect(dropProfileLock('profile:jun')).resolves.toBeUndefined();
  });

  it('profile-store.remove writes the list, then drops the lock, before it settles', async () => {
    disk.set(KEY, JSON.stringify({ v: 1, ids: ['profile:sora'] }));
    useProfileStore.getState().remove('profile:sora');
    await vi.waitFor(() => expect(stored()).toEqual({ v: 1, ids: [] }));
    expect(JSON.parse(disk.get('profiles')!).map((p: Profile) => p.id)).toEqual(['profile:mina', 'profile:jun']);
  });
});

describe('[OA] verifyForLockedProfile (section 6.3, CS-3)', () => {
  it('a correct PIN resets the strikes and clears a pending wait, but opens no gate and marks no fresh PIN', async () => {
    useAccountStore.setState({
      pinResetRequestedAt: new Date().toISOString(),
      pinAttempts: { failures: [], lockedUntil: null, strikes: 3, lastMissAt: Date.now() - 1_000 },
    });
    const openParentGate = vi.spyOn(useUiStore.getState(), 'openParentGate');
    const markPinVerified = vi.spyOn(useUiStore.getState(), 'markPinVerified');
    const result = await verifyForLockedProfile('1234', { hasher, schedule: 'steps' });
    expect(result.ok).toBe(true);
    expect(useAccountStore.getState().pinAttempts.strikes).toBe(0);
    expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
    expect(openParentGate).not.toHaveBeenCalled();
    expect(markPinVerified).not.toHaveBeenCalled();
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  });

  it('a wrong PIN counts as a miss and keeps the pending wait', async () => {
    const at = new Date().toISOString();
    useAccountStore.setState({ pinResetRequestedAt: at });
    const result = await verifyForLockedProfile('9999', { hasher, schedule: 'steps' });
    expect(result.ok).toBe(false);
    expect(useAccountStore.getState().pinAttempts.failures).toHaveLength(1);
    expect(useAccountStore.getState().pinResetRequestedAt).toBe(at);
  });
});
