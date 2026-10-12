import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => mem.get(k)),
  set: vi.fn(async (k: string, v: string) => {
    mem.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
  keys: vi.fn(async () => [...mem.keys()]),
  clear: vi.fn(async () => mem.clear()),
}));

import { get } from 'idb-keyval';
import { listKeys, readJson, readJsonExact, readJsonStrict, removeKey, requestPersistence, writeJson } from '../storage.web';

describe('platform/storage.web (IndexedDB via idb-keyval)', () => {
  beforeEach(() => mem.clear());

  it('round-trips JSON under the hr: prefix', async () => {
    await writeJson('progress:p1', { stars: 3 });
    expect(mem.has('hr:progress:p1')).toBe(true);
    expect(await readJson<{ stars: number }>('progress:p1')).toEqual({ stars: 3 });
  });

  it('returns null for missing or corrupt values', async () => {
    expect(await readJson('nope')).toBeNull();
    mem.set('hr:bad', '{not json');
    expect(await readJson('bad')).toBeNull();
  });

  it('readJsonStrict reads like readJson but throws when IndexedDB throws', async () => {
    await writeJson('q', [1, 2]);
    expect(await readJsonStrict('q')).toEqual([1, 2]);
    expect(await readJsonStrict('nope')).toBeNull();
    mem.set('hr:bad', '{not json');
    expect(await readJsonStrict('bad')).toBeNull();
    vi.mocked(get).mockRejectedValueOnce(new Error('idb'));
    await expect(readJsonStrict('q')).rejects.toThrow('idb');
  });

  it('readJsonExact is null only for a missing key: a failed read or an unparsable value throws (F-APP-001 A-6)', async () => {
    await writeJson('q', [1, 2]);
    expect(await readJsonExact('q')).toEqual([1, 2]);
    expect(await readJsonExact('nope')).toBeNull();
    mem.set('hr:bad', '{not json');
    await expect(readJsonExact('bad')).rejects.toThrow();
    vi.mocked(get).mockRejectedValueOnce(new Error('idb'));
    await expect(readJsonExact('q')).rejects.toThrow('idb');
  });

  it('listKeys strips the prefix and ignores foreign keys', async () => {
    await writeJson('a', 1);
    await writeJson('b', 2);
    mem.set('other:x', '1');
    expect((await listKeys()).sort()).toEqual(['a', 'b']);
    await removeKey('a');
    expect(await listKeys()).toEqual(['b']);
  });

  it('requestPersistence is a safe no-op without navigator.storage', async () => {
    expect(await requestPersistence()).toBe(false);
    const nav = { storage: { persist: vi.fn(async () => true) } };
    vi.stubGlobal('navigator', nav);
    expect(await requestPersistence()).toBe(true);
    vi.unstubAllGlobals();
  });
});
