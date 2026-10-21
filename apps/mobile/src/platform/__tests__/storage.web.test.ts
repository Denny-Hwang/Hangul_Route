import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, string>();
const fresh = { closed: 0 };
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => mem.get(k)),
  set: vi.fn(async (k: string, v: string) => {
    mem.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
  keys: vi.fn(async () => [...mem.keys()]),
  // [OA] A second connection to the same store: reads the same map; `closed` counts the connections closed after use.
  createStore: vi.fn(() => {
    const store = (_mode: string, fn: (s: { transaction: { db: { close: () => void } } }) => unknown) =>
      Promise.resolve(fn({ transaction: { db: { close: () => void (fresh.closed += 1) } } }));
    return store;
  }),
  clear: vi.fn(async () => mem.clear()),
  // idb-keyval's update: the read and the write in one transaction; a throw from the callback writes nothing.
  update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
    await Promise.resolve();
    mem.set(k, next(mem.get(k)));
  }),
}));

import { get, update } from 'idb-keyval';
import { setWriteFence } from '../storage-fence';
import { listKeys, readJson, readJsonExact, readJsonExactFresh, readJsonStrict, removeKey, requestPersistence, updateJson, writeJson } from '../storage.web';

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

  it('updateJson reads and writes in one transaction: the stored value in, the new one out', async () => {
    await writeJson('device:settings', { textSize: 'large' });
    expect(await updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, uiLocale: 'ko' }))).toBe(true);
    expect(JSON.parse(mem.get('hr:device:settings')!)).toEqual({ textSize: 'large', uiLocale: 'ko' });
    expect(vi.mocked(update)).toHaveBeenCalledWith('hr:device:settings', expect.any(Function));
    // Missing and damaged values come in as null.
    const seen: unknown[] = [];
    await updateJson('fresh', (current) => (seen.push(current), 1));
    mem.set('hr:bad', '{not json');
    await updateJson('bad', (current) => (seen.push(current), 2));
    expect(seen).toEqual([null, null]);
    expect(mem.get('hr:bad')).toBe('2');
  });

  it('two updates at once both land: neither overwrites the other', async () => {
    await writeJson('device:settings', {});
    await Promise.all([
      updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, uiLocale: 'ko' })),
      updateJson<Record<string, unknown>>('device:settings', (current) => ({ ...current, textSize: 'large' })),
    ]);
    expect(JSON.parse(mem.get('hr:device:settings')!)).toEqual({ uiLocale: 'ko', textSize: 'large' });
  });

  it('updateJson: undefined stores nothing; a failed transaction rejects; a fenced key is never read or written', async () => {
    await writeJson('q', [1]);
    expect(await updateJson('q', () => undefined)).toBe(false);
    expect(mem.get('hr:q')).toBe('[1]');
    vi.mocked(update).mockRejectedValueOnce(new Error('idb'));
    await expect(updateJson('q', () => [2])).rejects.toThrow('idb');
    expect(mem.get('hr:q')).toBe('[1]');
    setWriteFence((key) => key !== 'q');
    const next = vi.fn(() => [3]);
    expect(await updateJson('q', next)).toBe(false);
    expect(next).not.toHaveBeenCalled();
    setWriteFence(null);
    expect(mem.get('hr:q')).toBe('[1]');
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
  it('[OA] readJsonExactFresh reads on a new connection and closes it: null only when missing, a bad value throws', async () => {
    fresh.closed = 0;
    await writeJson('profiles:locks', { v: 1, ids: [] });
    expect(await readJsonExactFresh('profiles:locks')).toEqual({ v: 1, ids: [] });
    expect(await readJsonExactFresh('nope')).toBeNull();
    mem.set('hr:bad', '{not json');
    await expect(readJsonExactFresh('bad')).rejects.toThrow();
    expect(fresh.closed).toBe(3);
  });
});
