import { SHELL_KEYS } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';

vi.mock('idb-keyval', () => ({ createStore: () => () => undefined, get: async () => undefined, set: async () => undefined, del: async () => undefined }));

import { deleteDeviceUses, readPinOwner, readPinPromptSeen, writeDeviceUses, writePinOwner, writePinPromptSeen, type ShellStore } from '../shell-store';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.1, 7.2 and 7.6 (row OA-3): the shell store's `deviceUses`,
 * `pinOwner` and `pinPromptSeen`. Guarded like the rest of the store: unreadable reads as none, a refused or invalid
 * write reports false and writes nothing.
 */
function memoryStore(): ShellStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (k) => map.get(k),
    set: async (k, v) => {
      map.set(k, v);
    },
    del: async (k) => {
      map.delete(k);
    },
  };
}

const broken: ShellStore = {
  get: async () => Promise.reject(new Error('closed')),
  set: async () => Promise.reject(new Error('quota')),
  del: async () => Promise.reject(new Error('closed')),
};

const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;

describe('deviceUses (section 7.1)', () => {
  it('writes the record under deviceUses, with nothing but v, uses and at', async () => {
    const store = memoryStore();
    const extra = { v: 1, uses: ['family'], at: NOW, name: 'Ms Kim', email: 'kim@example.com' } as unknown as Parameters<typeof writeDeviceUses>[0];
    expect(await writeDeviceUses(extra, store)).toBe(true);
    expect(store.map.get(SHELL_KEYS.deviceUses)).toEqual({ v: 1, uses: ['family'], at: NOW });
  });

  it('never writes a record that does not parse', async () => {
    const store = memoryStore();
    expect(await writeDeviceUses({ v: 1, uses: ['family', 'family'], at: NOW }, store)).toBe(false);
    expect(store.map.size).toBe(0);
  });

  it('Sign out deletes it', async () => {
    const store = memoryStore();
    await writeDeviceUses({ v: 1, uses: ['teacher'], at: NOW }, store);
    expect(await deleteDeviceUses(store)).toBe(true);
    expect(store.map.has(SHELL_KEYS.deviceUses)).toBe(false);
  });

  it('no store or a refusing one reports false', async () => {
    expect(await writeDeviceUses({ v: 1, uses: [], at: NOW }, null)).toBe(false);
    expect(await writeDeviceUses({ v: 1, uses: [], at: NOW }, broken)).toBe(false);
    expect(await deleteDeviceUses(null)).toBe(false);
    expect(await deleteDeviceUses(broken)).toBe(false);
  });
});

describe('pinOwner (section 7.2)', () => {
  it('round-trips a valid record', async () => {
    const store = memoryStore();
    expect(await writePinOwner({ v: 1, owner: 'a1b2c3d4e5f60718', epoch: EPOCH }, store)).toBe(true);
    expect(await readPinOwner(store)).toEqual({ v: 1, owner: 'a1b2c3d4e5f60718', epoch: EPOCH });
  });

  it('never writes epoch 0 or a bad fingerprint', async () => {
    const store = memoryStore();
    expect(await writePinOwner({ v: 1, owner: 'a1b2c3d4e5f60718', epoch: 0 }, store)).toBe(false);
    expect(await writePinOwner({ v: 1, owner: 'user_2abc', epoch: EPOCH }, store)).toBe(false);
    expect(store.map.size).toBe(0);
  });

  it('junk, no store and a failing store read as none', async () => {
    const store = memoryStore();
    store.map.set(SHELL_KEYS.pinOwner, { v: 1, owner: 'x', epoch: EPOCH });
    expect(await readPinOwner(store)).toBeNull();
    expect(await readPinOwner(null)).toBeNull();
    expect(await readPinOwner(broken)).toBeNull();
    expect(await writePinOwner({ v: 1, owner: 'a1b2c3d4e5f60718', epoch: EPOCH }, null)).toBe(false);
  });
});

describe('pinPromptSeen (section 7.6)', () => {
  it('reads false until written, then true; it stores true and nothing else', async () => {
    const store = memoryStore();
    expect(await readPinPromptSeen(store)).toBe(false);
    expect(await writePinPromptSeen(store)).toBe(true);
    expect(store.map.get(SHELL_KEYS.pinPromptSeen)).toBe(true);
    expect(await readPinPromptSeen(store)).toBe(true);
  });

  it('an unreadable store reads as null, so the card stays away', async () => {
    expect(await readPinPromptSeen(null)).toBeNull();
    expect(await readPinPromptSeen(broken)).toBeNull();
    expect(await writePinPromptSeen(broken)).toBe(false);
  });
});
