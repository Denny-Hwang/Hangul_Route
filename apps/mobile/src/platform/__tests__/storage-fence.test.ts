import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 §4.10 (BR-3): the storage write fence. While a fence is set,
 * `writeJson` and `removeKey` for a key it rejects resolve without touching
 * storage (native AsyncStorage or web IndexedDB) and tell the observer;
 * allowed keys and every read work as before; clearing the fence restores
 * writes. Both storage variants share one fence.
 */
const native = vi.hoisted(() => new Map<string, string>());
const web = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => native.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      native.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      native.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...native.keys()]),
  },
}));

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => web.get(k)),
  set: vi.fn(async (k: string, v: string) => {
    web.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    web.delete(k);
  }),
  keys: vi.fn(async () => [...web.keys()]),
  clear: vi.fn(async () => web.clear()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { del, set } from 'idb-keyval';
import * as nativeStorage from '../storage';
import { setWriteFenceObserver } from '../storage-fence';
import * as webStorage from '../storage.web';

const allowBrowse = (key: string): boolean => key.startsWith('browse:') || key === 'device:audio';

const variants = [
  { name: 'native (AsyncStorage)', storage: nativeStorage, mem: native, setItem: () => vi.mocked(AsyncStorage.setItem), removeItem: () => vi.mocked(AsyncStorage.removeItem) },
  { name: 'web (IndexedDB)', storage: webStorage, mem: web, setItem: () => vi.mocked(set), removeItem: () => vi.mocked(del) },
] as const;

describe.each(variants)('storage write fence: $name', ({ storage, mem, setItem, removeItem }) => {
  beforeEach(() => {
    native.clear();
    web.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    storage.setWriteFence(null);
    setWriteFenceObserver(null);
  });

  it('drops a write and a remove of a rejected key without touching storage', async () => {
    mem.set('hr:progress:p1', JSON.stringify({ stars: 3 }));
    storage.setWriteFence(allowBrowse);
    await storage.writeJson('progress:p1', { stars: 0 });
    await storage.writeJson('profiles', []);
    await storage.removeKey('progress:p1');
    expect(setItem()).not.toHaveBeenCalled();
    expect(removeItem()).not.toHaveBeenCalled();
    expect(mem.get('hr:progress:p1')).toBe(JSON.stringify({ stars: 3 }));
    expect(mem.has('hr:profiles')).toBe(false);
  });

  it('lets an allowed key through and leaves reads unfenced', async () => {
    mem.set('hr:progress:p1', JSON.stringify({ stars: 3 }));
    storage.setWriteFence(allowBrowse);
    await storage.writeJson('browse:prefs', { v: 1, romanization: 'tap' });
    await storage.writeJson('device:audio', { muted: true });
    expect(await storage.readJson('browse:prefs')).toEqual({ v: 1, romanization: 'tap' });
    expect(await storage.readJson('device:audio')).toEqual({ muted: true });
    expect(await storage.readJson('progress:p1')).toEqual({ stars: 3 });
    expect(await storage.readJsonStrict('progress:p1')).toEqual({ stars: 3 });
    await storage.removeKey('browse:prefs');
    expect(mem.has('hr:browse:prefs')).toBe(false);
    expect((await storage.listKeys()).sort()).toEqual(['device:audio', 'progress:p1']);
  });

  it('tells the observer about every dropped write and remove, and nothing else', async () => {
    const seen: [string, string][] = [];
    setWriteFenceObserver((key, op) => seen.push([key, op]));
    storage.setWriteFence(allowBrowse);
    await storage.writeJson('telemetry:queue', []);
    await storage.removeKey('account:session');
    await storage.writeJson('browse:pass', { v: 1 });
    expect(seen).toEqual([
      ['telemetry:queue', 'write'],
      ['account:session', 'remove'],
    ]);
  });

  it('an observer that throws never turns a dropped write into an error', async () => {
    setWriteFenceObserver(() => {
      throw new Error('observer');
    });
    storage.setWriteFence(() => false);
    await expect(storage.writeJson('profiles', [])).resolves.toBeUndefined();
    await expect(storage.removeKey('profiles')).resolves.toBeUndefined();
    expect(setItem()).not.toHaveBeenCalled();
  });

  it('clearing the fence restores every write', async () => {
    storage.setWriteFence(() => false);
    await storage.writeJson('profiles', ['dropped']);
    storage.setWriteFence(null);
    await storage.writeJson('profiles', ['kept']);
    expect(await storage.readJson('profiles')).toEqual(['kept']);
    await storage.removeKey('profiles');
    expect(await storage.readJson('profiles')).toBeNull();
  });

  it('a fence that throws counts as a rejection (fail closed)', async () => {
    storage.setWriteFence(() => {
      throw new Error('fence');
    });
    await storage.writeJson('profiles', []);
    await storage.removeKey('profiles');
    expect(setItem()).not.toHaveBeenCalled();
    expect(removeItem()).not.toHaveBeenCalled();
  });
});

describe('one fence for both variants', () => {
  afterEach(() => {
    nativeStorage.setWriteFence(null);
  });

  it('a fence set through one storage module applies to the other', async () => {
    native.clear();
    web.clear();
    nativeStorage.setWriteFence(allowBrowse);
    await webStorage.writeJson('profiles', []);
    expect(web.has('hr:profiles')).toBe(false);
    webStorage.setWriteFence(null);
    await nativeStorage.writeJson('profiles', []);
    expect(native.has('hr:profiles')).toBe(true);
  });
});
