import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7, ND-9): the native binding of Clerk's token cache. Every SecureStore call
 * uses the `hr.clerk` service, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and no `requireAuthentication`; the install sweep runs
 * once per run (again after a failure); the storage follows the gate state.
 */

const store = vi.hoisted(() => {
  const items = new Map<string, string>();
  return {
    items,
    failDelete: false,
    getItemAsync: vi.fn(async (key: string, _options?: unknown) => items.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string, _options?: unknown) => {
      items.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string, _options?: unknown) => {
      if (store.failDelete) throw new Error('User interaction is not allowed');
      items.delete(key);
    }),
  };
});
vi.mock('expo-secure-store', () => ({ ...store, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5, WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 6 }));

const storage = vi.hoisted(() => ({ values: new Map<string, unknown>(), failRead: false }));
vi.mock('../storage', () => ({
  readJsonExact: vi.fn(async (key: string) => {
    if (storage.failRead) throw new Error('io');
    return storage.values.get(key) ?? null;
  }),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    storage.values.set(key, value);
  }),
}));

type Module = typeof import('../clerk-token-cache.native');
async function load(): Promise<Module> {
  vi.resetModules();
  return import('../clerk-token-cache.native');
}

const JWT = '__clerk_client_jwt';

beforeEach(() => {
  vi.clearAllMocks();
  store.items.clear();
  store.failDelete = false;
  storage.values.clear();
  storage.failRead = false;
});

describe('SecureStore options (CS-N7)', () => {
  it('the hr.clerk service, this device only, never a face prompt', async () => {
    const { clerkTokens } = await load();
    await clerkTokens.useSecure();
    await clerkTokens.cache.saveToken(JWT, 'jwt');
    await clerkTokens.cache.getToken(JWT);
    await clerkTokens.wipe();
    const calls = [...store.getItemAsync.mock.calls, ...store.setItemAsync.mock.calls, ...store.deleteItemAsync.mock.calls];
    expect(calls.length).toBeGreaterThan(4);
    for (const call of calls) {
      const options = call[call.length - 1];
      expect(options).toEqual({ keychainService: 'hr.clerk', keychainAccessible: 5 });
    }
  });
});

describe('ensureInstallSweep (section 6.2)', () => {
  it('a fresh install deletes every Clerk item, then writes hr:grownup:installed', async () => {
    store.items.set(JWT, 'left by an earlier install');
    store.items.set('hr.clerk.index', JSON.stringify(['other']));
    store.items.set('other', 'x');
    const { ensureInstallSweep } = await load();
    expect(await ensureInstallSweep()).toBe(true);
    expect(store.items.size).toBe(0);
    expect(storage.values.get('grownup:installed')).toEqual({ v: 1, at: expect.any(Number) });
  });

  it('runs once per run when it succeeded', async () => {
    const { ensureInstallSweep } = await load();
    await ensureInstallSweep();
    await ensureInstallSweep();
    expect(store.deleteItemAsync.mock.calls.filter(([key]) => key === 'hr.clerk.index')).toHaveLength(1);
  });

  it('an installed device deletes nothing', async () => {
    storage.values.set('grownup:installed', { v: 1, at: 1 });
    store.items.set(JWT, 'kept session');
    const { ensureInstallSweep } = await load();
    expect(await ensureInstallSweep()).toBe(true);
    expect(store.items.get(JWT)).toBe('kept session');
  });

  it('a failed delete is not complete, writes no record, and is tried again at the next call', async () => {
    store.items.set(JWT, 'x');
    store.failDelete = true;
    const { ensureInstallSweep } = await load();
    expect(await ensureInstallSweep()).toBe(false);
    expect(storage.values.has('grownup:installed')).toBe(false);
    store.failDelete = false;
    expect(await ensureInstallSweep()).toBe(true);
    expect(store.items.size).toBe(0);
    expect(storage.values.get('grownup:installed')).toEqual({ v: 1, at: expect.any(Number) });
  });

  it('a record read that fails deletes nothing and is not complete', async () => {
    storage.failRead = true;
    store.items.set(JWT, 'x');
    const { ensureInstallSweep } = await load();
    expect(await ensureInstallSweep()).toBe(false);
    expect(store.items.get(JWT)).toBe('x');
  });
});

describe('applyGateToTokens (ND-9)', () => {
  it('mount on `pin`: reads the kept session; a memory item from a run without a PIN is dropped', async () => {
    store.items.set(JWT, 'kept');
    const { applyGateToTokens, clerkTokens } = await load();
    await clerkTokens.cache.saveToken('memory-only', 'x');
    expect(await applyGateToTokens({ state: 'pin', epoch: 5 }, 'mount')).toBe(true);
    expect(clerkTokens.storage()).toBe('secure');
    expect(await clerkTokens.cache.getToken(JWT)).toBe('kept');
    expect(await clerkTokens.cache.getToken('memory-only')).toBeNull();
    expect(store.items.has('memory-only')).toBe(false);
  });

  it('mount on `open` or `nopin`: deletes every kept item and keeps nothing', async () => {
    for (const state of ['open', 'nopin'] as const) {
      store.items.set(JWT, 'kept');
      const { applyGateToTokens, clerkTokens } = await load();
      expect(await applyGateToTokens({ state }, 'mount')).toBe(true);
      expect(clerkTokens.storage()).toBe('memory');
      expect(store.items.has(JWT)).toBe(false);
    }
  });

  it('a change that leaves `pin` ends the kept session, memory items too', async () => {
    const { applyGateToTokens, clerkTokens } = await load();
    await applyGateToTokens({ state: 'pin', epoch: 5 }, 'mount');
    await clerkTokens.cache.saveToken(JWT, 'kept');
    expect(store.items.get(JWT)).toBe('kept');
    expect(await applyGateToTokens({ state: 'open' }, 'change')).toBe(true);
    expect(store.items.has(JWT)).toBe(false);
    expect(clerkTokens.storage()).toBe('memory');
    expect(await clerkTokens.cache.getToken(JWT)).toBeNull();
  });

  it('a change to `pin`, or to `unknown`, keeps things as they are', async () => {
    const { applyGateToTokens, clerkTokens } = await load();
    await applyGateToTokens({ state: 'open' }, 'mount');
    await clerkTokens.cache.saveToken(JWT, 'memory session');
    expect(await applyGateToTokens({ state: 'pin', epoch: 7 }, 'change')).toBe(true);
    expect(await applyGateToTokens({ state: 'unknown' }, 'change')).toBe(true);
    expect(clerkTokens.storage()).toBe('memory');
    expect(store.setItemAsync).not.toHaveBeenCalled();
    expect(await clerkTokens.cache.getToken(JWT)).toBe('memory session');
  });

  it('a delete that fails is reported', async () => {
    const { applyGateToTokens } = await load();
    await applyGateToTokens({ state: 'pin', epoch: 5 }, 'mount');
    store.failDelete = true;
    expect(await applyGateToTokens({ state: 'nopin' }, 'change')).toBe(false);
  });
});
