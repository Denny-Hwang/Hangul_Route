import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => mem.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      mem.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      mem.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...mem.keys()]),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { listKeys, readJson, removeKey, writeJson } from '../storage';

describe('platform/storage (AsyncStorage wrapper)', () => {
  beforeEach(() => {
    mem.clear();
    vi.clearAllMocks();
  });

  it('writeJson → readJson round-trips a value under the hr: prefix', async () => {
    await writeJson('profiles', [{ id: 'p1' }]);
    expect(mem.has('hr:profiles')).toBe(true);
    expect(await readJson('profiles')).toEqual([{ id: 'p1' }]);
  });

  it('readJson returns null for a missing key', async () => {
    expect(await readJson('nope')).toBeNull();
  });

  it('readJson returns null on corrupt JSON instead of throwing', async () => {
    mem.set('hr:bad', '{not-json');
    expect(await readJson('bad')).toBeNull();
  });

  it('readJson returns null when the underlying store throws', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    expect(await readJson('profiles')).toBeNull();
  });

  it('removeKey deletes only the prefixed key', async () => {
    await writeJson('a', 1);
    await writeJson('b', 2);
    await removeKey('a');
    expect(await readJson('a')).toBeNull();
    expect(await readJson('b')).toBe(2);
  });

  it('listKeys returns unprefixed app keys and ignores foreign keys', async () => {
    await writeJson('profiles', []);
    await writeJson('profiles:active', 'p1');
    mem.set('other-app:junk', 'x');
    expect((await listKeys()).sort()).toEqual(['profiles', 'profiles:active']);
  });
});
