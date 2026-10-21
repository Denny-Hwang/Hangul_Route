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
import { setWriteFence } from '../storage-fence';
import { listKeys, readJson, readJsonExact, readJsonExactFresh, readJsonStrict, removeKey, updateJson, writeJson } from '../storage';

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

  it('readJsonStrict reads like readJson but throws when the underlying store throws', async () => {
    await writeJson('q', [1, 2]);
    expect(await readJsonStrict('q')).toEqual([1, 2]);
    expect(await readJsonStrict('nope')).toBeNull();
    mem.set('hr:bad', '{not-json');
    expect(await readJsonStrict('bad')).toBeNull();
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await expect(readJsonStrict('q')).rejects.toThrow('disk');
  });

  it('readJsonExact is null only for a missing key: a failed read or an unparsable value throws (F-APP-001 A-6)', async () => {
    await writeJson('q', [1, 2]);
    expect(await readJsonExact('q')).toEqual([1, 2]);
    expect(await readJsonExact('nope')).toBeNull();
    mem.set('hr:bad', '{not json');
    await expect(readJsonExact('bad')).rejects.toThrow();
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await expect(readJsonExact('q')).rejects.toThrow('disk');
  });

  it('updateJson: the stored value in, the new one out; undefined stores nothing; calls queue so none is lost', async () => {
    await writeJson('device:settings', { textSize: 'large' });
    expect(await updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, uiLocale: 'ko' }))).toBe(true);
    expect(await readJson('device:settings')).toEqual({ textSize: 'large', uiLocale: 'ko' });
    expect(await updateJson('device:settings', () => undefined)).toBe(false);
    await Promise.all([
      updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, uiLocale: 'es' })),
      updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, textSize: 'largest' })),
    ]);
    expect(await readJson('device:settings')).toEqual({ uiLocale: 'es', textSize: 'largest' });
  });

  it('updateJson never writes over a value it could not read, and a failure does not stop the next call', async () => {
    await writeJson('q', [1]);
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await expect(updateJson('q', () => [2])).rejects.toThrow('disk');
    expect(await readJson('q')).toEqual([1]);
    expect(await updateJson('q', () => [3])).toBe(true);
    expect(await readJson('q')).toEqual([3]);
    setWriteFence(() => false);
    const next = vi.fn(() => [4]);
    expect(await updateJson('q', next)).toBe(false);
    expect(next).not.toHaveBeenCalled();
    setWriteFence(null);
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
  it('[OA] readJsonExactFresh reads exactly again (AsyncStorage holds no connection)', async () => {
    await writeJson('profiles:locks', { v: 1, ids: [] });
    expect(await readJsonExactFresh('profiles:locks')).toEqual({ v: 1, ids: [] });
    expect(await readJsonExactFresh('nope')).toBeNull();
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    await expect(readJsonExactFresh('profiles:locks')).rejects.toThrow('disk');
  });
});
