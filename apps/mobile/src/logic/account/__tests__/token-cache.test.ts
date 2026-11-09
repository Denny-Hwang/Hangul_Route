import { describe, expect, it, vi } from 'vitest';
import { CLERK_INDEX_KEY, CLERK_KEYCHAIN_SERVICE, CLERK_NAMED_KEYS, createTokenCache, indexKeysOf, isStorableKey, tokenStepFor, type SecureItemPort } from '../token-cache';

/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7, ND-9): the token cache Clerk writes through. The index is written before
 * the item, a key that cannot be indexed is never kept, memory mode keeps nothing, a wipe deletes every indexed and
 * named key and then the index, and an unreadable item reads as signed out.
 */

const JWT = '__clerk_client_jwt';

/** An in-memory SecureStore service with a call log and switchable failures. */
function fakeStore(seed: Record<string, string> = {}) {
  const items = new Map(Object.entries(seed));
  const log: string[] = [];
  const fail = { get: new Set<string>(), set: new Set<string>(), remove: new Set<string>() };
  const port: SecureItemPort = {
    get: vi.fn(async (key: string) => {
      log.push(`get ${key}`);
      if (fail.get.has(key)) throw new Error('decrypt failed');
      return items.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: string) => {
      log.push(`set ${key}`);
      if (fail.set.has(key)) throw new Error('write failed');
      items.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      log.push(`remove ${key}`);
      if (fail.remove.has(key)) throw new Error('interaction not allowed');
      items.delete(key);
    }),
  };
  return { items, log, fail, port };
}

describe('names', () => {
  it('its own service, never the biometric shortcut one', () => {
    expect(CLERK_KEYCHAIN_SERVICE).toBe('hr.clerk');
    expect(CLERK_KEYCHAIN_SERVICE).not.toBe('hr.biometric');
    expect(CLERK_INDEX_KEY).toBe('hr.clerk.index');
  });

  it('records the keys the pinned @clerk/clerk-expo 2.20.2 writes (its client token)', () => {
    expect(CLERK_NAMED_KEYS).toEqual(['__clerk_client_jwt']);
  });

  it('SecureStore keys: letters, digits, `.`, `-`, `_`; never the index itself', () => {
    expect(isStorableKey(JWT)).toBe(true);
    expect(isStorableKey('a.b-c_d')).toBe(true);
    for (const bad of ['', 'a b', 'a/b', 'é', CLERK_INDEX_KEY, 'x'.repeat(201)]) expect(isStorableKey(bad), bad).toBe(false);
  });

  it('indexKeysOf reads a JSON list of storable keys, else damaged', () => {
    expect(indexKeysOf(null)).toEqual([]);
    expect(indexKeysOf('["a","b","a"]')).toEqual(['a', 'b']);
    for (const raw of ['not json', '{}', '[1]', '["a b"]', `["${CLERK_INDEX_KEY}"]`]) expect(indexKeysOf(raw), raw).toBe('damaged');
  });
});

describe('memory mode (the default; a device without a PIN, ND-9)', () => {
  it('keeps nothing in SecureStore: items live for the run only', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    expect(c.storage()).toBe('memory');
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(await c.cache.getToken(JWT)).toBe('jwt-1');
    expect(await c.cache.getToken('other')).toBeNull();
    expect(store.port.set).not.toHaveBeenCalled();
    expect(store.port.get).not.toHaveBeenCalled();
    c.endMemorySession();
    expect(await c.cache.getToken(JWT)).toBeNull();
  });

  it('clearToken forgets a memory item', async () => {
    const c = createTokenCache(fakeStore().port);
    await c.cache.saveToken(JWT, 'jwt-1');
    c.cache.clearToken?.(JWT);
    expect(await c.cache.getToken(JWT)).toBeNull();
  });
});

describe('secure mode (a `pin` device)', () => {
  it('writes the index before the item, and reads the item back', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(store.log).toEqual([`get ${CLERK_INDEX_KEY}`, `set ${CLERK_INDEX_KEY}`, `set ${JWT}`]);
    expect(JSON.parse(store.items.get(CLERK_INDEX_KEY)!)).toEqual([JWT]);
    expect(await c.cache.getToken(JWT)).toBe('jwt-1');
  });

  it('a key already indexed is not indexed twice', async () => {
    const store = fakeStore({ [CLERK_INDEX_KEY]: JSON.stringify([JWT]) });
    const c = createTokenCache(store.port);
    await c.useSecure();
    await c.cache.saveToken(JWT, 'jwt-2');
    expect(store.port.set).toHaveBeenCalledTimes(1);
    expect(store.port.set).toHaveBeenCalledWith(JWT, 'jwt-2');
  });

  it('refuses to write a key it could not index: a failed index write, a failed index read, a bad name', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    store.fail.set.add(CLERK_INDEX_KEY);
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(store.items.has(JWT)).toBe(false);
    store.fail.set.clear();
    store.fail.get.add(CLERK_INDEX_KEY);
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(store.items.has(JWT)).toBe(false);
    store.fail.get.clear();
    await c.cache.saveToken('bad key', 'x');
    expect(store.items.has('bad key')).toBe(false);
    // Not kept, but this run still signs in: the item is held in memory for the run.
    expect(await c.cache.getToken(JWT)).toBe('jwt-1');
    expect(await c.cache.getToken('bad key')).toBe('x');
  });

  it('an item write that fails stays in memory for the run only', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    store.fail.set.add(JWT);
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(store.items.has(JWT)).toBe(false);
    expect(await c.cache.getToken(JWT)).toBe('jwt-1');
  });

  it('a damaged index is deleted and rebuilt with the new key', async () => {
    const store = fakeStore({ [CLERK_INDEX_KEY]: '{not json' });
    const c = createTokenCache(store.port);
    await c.useSecure();
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(JSON.parse(store.items.get(CLERK_INDEX_KEY)!)).toEqual([JWT]);
    expect(store.log).toContain(`remove ${CLERK_INDEX_KEY}`);
  });

  it('a damaged index that cannot be deleted refuses the write', async () => {
    const store = fakeStore({ [CLERK_INDEX_KEY]: '{not json' });
    store.fail.remove.add(CLERK_INDEX_KEY);
    const c = createTokenCache(store.port);
    await c.useSecure();
    await c.cache.saveToken(JWT, 'jwt-1');
    expect(store.items.has(JWT)).toBe(false);
  });

  it('an unreadable item deletes that item and the index, and reads as signed out', async () => {
    const store = fakeStore({ [JWT]: 'old', [CLERK_INDEX_KEY]: JSON.stringify([JWT]) });
    store.fail.get.add(JWT);
    const c = createTokenCache(store.port);
    await c.useSecure();
    expect(await c.cache.getToken(JWT)).toBeNull();
    expect(store.items.has(JWT)).toBe(false);
    expect(store.items.has(CLERK_INDEX_KEY)).toBe(false);
  });

  it('a read of a key SecureStore cannot hold answers null without a call', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    expect(await c.cache.getToken('bad key')).toBeNull();
    expect(store.port.get).not.toHaveBeenCalled();
  });

  it('clearToken deletes the kept item (a failure is swallowed)', async () => {
    const store = fakeStore({ [JWT]: 'jwt', [CLERK_INDEX_KEY]: JSON.stringify([JWT]) });
    const c = createTokenCache(store.port);
    await c.useSecure();
    c.cache.clearToken?.(JWT);
    await c.cache.getToken('x');
    expect(store.items.has(JWT)).toBe(false);
    store.fail.remove.add('y');
    c.cache.clearToken?.('y');
    c.cache.clearToken?.('bad key');
    await c.cache.getToken('x');
  });

  it('saves run one at a time, so two keys both reach the index', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    await Promise.all([c.cache.saveToken('a', '1'), c.cache.saveToken('b', '2')]);
    expect(JSON.parse(store.items.get(CLERK_INDEX_KEY)!)).toEqual(['a', 'b']);
  });

  it('useSecure moves this run’s memory items in, and says whether all of them could be kept', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.cache.saveToken(JWT, 'jwt-1');
    await c.cache.saveToken('bad key', 'x');
    expect(await c.useSecure()).toBe(false);
    expect(store.items.get(JWT)).toBe('jwt-1');
    expect(c.storage()).toBe('secure');
    expect(await c.cache.getToken('bad key')).toBe('x');
    const clean = createTokenCache(fakeStore().port);
    await clean.cache.saveToken(JWT, 'jwt-1');
    expect(await clean.useSecure()).toBe(true);
  });
});

describe('wipe and useMemory (sign-out, the install sweep, a gate state that is not `pin`)', () => {
  it('deletes every indexed key, every named key, then the index, and the memory items', async () => {
    const store = fakeStore({ a: '1', [JWT]: 'jwt', [CLERK_INDEX_KEY]: JSON.stringify(['a']) });
    const c = createTokenCache(store.port);
    await c.cache.saveToken('m', 'memory');
    expect(await c.wipe()).toBe(true);
    expect([...store.items.keys()]).toEqual([]);
    expect(store.log.slice(-3)).toEqual(['remove a', `remove ${JWT}`, `remove ${CLERK_INDEX_KEY}`]);
    expect(await c.cache.getToken('m')).toBeNull();
  });

  it('a delete that fails, or an index that cannot be read, is reported (the sweep runs again)', async () => {
    const failing = fakeStore({ [JWT]: 'jwt' });
    failing.fail.remove.add(JWT);
    expect(await createTokenCache(failing.port).wipe()).toBe(false);
    const locked = fakeStore({ [JWT]: 'jwt' });
    locked.fail.get.add(CLERK_INDEX_KEY);
    expect(await createTokenCache(locked.port).wipe()).toBe(false);
    // The named key is still deleted when the index cannot be read.
    expect(locked.items.has(JWT)).toBe(false);
    const index = fakeStore();
    index.fail.remove.add(CLERK_INDEX_KEY);
    expect(await createTokenCache(index.port).wipe()).toBe(false);
  });

  it('a device that never had an item wipes cleanly (a not-found delete is a success)', async () => {
    expect(await createTokenCache(fakeStore().port).wipe()).toBe(true);
  });

  it('useMemory deletes the kept items and keeps this run’s memory session', async () => {
    const store = fakeStore();
    const c = createTokenCache(store.port);
    await c.useSecure();
    await c.cache.saveToken(JWT, 'kept');
    expect(await c.useMemory()).toBe(true);
    expect(c.storage()).toBe('memory');
    expect(store.items.size).toBe(0);
    await c.cache.saveToken(JWT, 'memory');
    expect(await c.cache.getToken(JWT)).toBe('memory');
  });
});

describe('tokenStepFor: the storage follows the gate state', () => {
  it('at mount: `pin` reads the kept session, `open` and `nopin` keep nothing, `unknown` decides nothing', () => {
    expect(tokenStepFor('pin', 'mount', 'memory')).toBe('use_secure');
    expect(tokenStepFor('open', 'mount', 'secure')).toBe('use_memory');
    expect(tokenStepFor('nopin', 'mount', 'memory')).toBe('use_memory');
    expect(tokenStepFor('unknown', 'mount', 'secure')).toBe('keep');
  });

  it('on a change: leaving `pin` ends a kept session; reaching `pin` keeps nothing more (7.3)', () => {
    expect(tokenStepFor('open', 'change', 'secure')).toBe('wipe');
    expect(tokenStepFor('nopin', 'change', 'secure')).toBe('wipe');
    expect(tokenStepFor('open', 'change', 'memory')).toBe('keep');
    expect(tokenStepFor('pin', 'change', 'memory')).toBe('keep');
    expect(tokenStepFor('unknown', 'change', 'secure')).toBe('keep');
  });
});
