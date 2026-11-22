import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.1 (row DP-1b; test 1 of section 6): `durableRead` over the web storage
 * wrapper and an IndexedDB stand-in holding raw strings. The cached connection and the fresh one (the one retry,
 * `readJsonExactFresh`) fail apart, so a read that fails once and then works is told from one that fails twice.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** Reads on the cached connection reject with this while set. */
  cachedFails: null as Error | null,
  /** Reads on a fresh connection reject with this while set. */
  freshFails: null as Error | null,
  /** What a fresh connection reads instead of `mem`, while set. */
  freshRaw: undefined as string | undefined,
  /** The copy transaction rejects while set. */
  updateFails: false,
}));
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string, store?: unknown) => {
    if (store === undefined) {
      if (idb.cachedFails) throw idb.cachedFails;
      return idb.mem.get(k);
    }
    if (idb.freshFails) throw idb.freshFails;
    return idb.freshRaw !== undefined ? idb.freshRaw : idb.mem.get(k);
  }),
  set: vi.fn(async (k: string, v: string) => void idb.mem.set(k, v)),
  del: vi.fn(async (k: string) => void idb.mem.delete(k)),
  keys: vi.fn(async () => [...idb.mem.keys()]),
  clear: vi.fn(async () => idb.mem.clear()),
  createStore: vi.fn(() => vi.fn(async () => undefined)),
  update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
    if (idb.updateFails) throw new Error('idb write failed');
    idb.mem.set(k, next(idb.mem.get(k)));
  }),
}));
vi.mock('../../platform/storage', async () => {
  const real = await import('../../platform/storage.web');
  return { ...real, keepRawCopy: vi.fn(real.keepRawCopy) };
});

import { keepRawCopy } from '../../platform/storage';
import { setWriteFence } from '../../platform/storage-fence';
import { durableRead } from '../durable-read';

const keepSpy = vi.mocked(keepRawCopy);

describe('[DP] durableRead (AMENDMENTS-DURABLE-PROGRESS section 3.1, test 1)', () => {
  beforeEach(() => {
    idb.mem.clear();
    idb.cachedFails = null;
    idb.freshFails = null;
    idb.freshRaw = undefined;
    idb.updateFails = false;
    keepSpy.mockClear();
  });
  afterEach(() => setWriteFence(null));

  it('an absent key and an empty string are missing', async () => {
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'missing' });
    idb.mem.set('hr:profiles', '');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'missing' });
    expect(keepSpy).not.toHaveBeenCalled();
  });

  it('bytes that parse are a value', async () => {
    idb.mem.set('hr:profiles', JSON.stringify([{ id: 'profile:a' }]));
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'value', value: [{ id: 'profile:a' }] });
  });

  it('a read that throws once and works on a fresh connection is a value', async () => {
    idb.mem.set('hr:profiles', JSON.stringify([{ id: 'profile:a' }]));
    idb.cachedFails = new Error('connection closed');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'value', value: [{ id: 'profile:a' }] });
  });

  it('a read that throws twice is failed/read, kept false, and nothing is copied', async () => {
    idb.mem.set('hr:profiles', '{damaged');
    idb.cachedFails = new Error('connection closed');
    idb.freshFails = new Error('still closed');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'read', kept: false });
    expect(keepSpy).not.toHaveBeenCalled();
    expect(idb.mem.has('hr:profiles-corrupt')).toBe(false);
  });

  it('bytes that do not parse are failed/parse, kept true, and the copy holds the raw bytes', async () => {
    idb.mem.set('hr:profiles', '[{"id":"profile:a"');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: true });
    expect(idb.mem.get('hr:profiles-corrupt')).toBe('[{"id":"profile:a"');
    // The damaged key itself is never touched.
    expect(idb.mem.get('hr:profiles')).toBe('[{"id":"profile:a"');
  });

  it('the first copy is the one kept', async () => {
    idb.mem.set('hr:profiles-corrupt', 'first damage');
    idb.mem.set('hr:profiles', 'second damage');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: true });
    expect(idb.mem.get('hr:profiles-corrupt')).toBe('first damage');
  });

  it('a first read that throws and a fresh read that does not parse is failed/parse', async () => {
    idb.cachedFails = new Error('connection closed');
    idb.freshRaw = '{damaged';
    idb.mem.set('hr:profiles', '{damaged');
    // The cause is the fresh read's SyntaxError; the copy reads on the cached connection, which still throws: not kept.
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: false });
    expect(keepSpy).toHaveBeenCalledWith('profiles', 'profiles-corrupt', { onlyUnparsable: true });
  });

  it('a fresh read that finds the key absent is missing', async () => {
    idb.cachedFails = new Error('connection closed');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'missing' });
  });

  it('a copy key the write fence rejects is failed/parse, kept false', async () => {
    idb.mem.set('hr:profiles', '{damaged');
    setWriteFence((key) => key !== 'profiles-corrupt');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: false });
    expect(idb.mem.has('hr:profiles-corrupt')).toBe(false);
  });

  it('a copy that rejects is failed/parse, kept false', async () => {
    idb.mem.set('hr:profiles', '{damaged');
    idb.updateFails = true;
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: false });
  });

  it('with no copy key, bytes that do not parse are failed/parse, kept false, and keepRawCopy is not called', async () => {
    idb.mem.set('hr:profiles:tombstones', '{damaged');
    expect(await durableRead('profiles:tombstones', null)).toEqual({ kind: 'failed', cause: 'parse', kept: false });
    expect(keepSpy).not.toHaveBeenCalled();
  });

  it('never rejects, whatever the storage throws', async () => {
    idb.cachedFails = new TypeError('odd');
    idb.freshFails = new RangeError('odder');
    await expect(durableRead('profiles', 'profiles-corrupt')).resolves.toEqual({ kind: 'failed', cause: 'read', kept: false });
    keepSpy.mockImplementationOnce(() => {
      throw new Error('sync throw');
    });
    idb.cachedFails = null;
    idb.freshFails = null;
    idb.mem.set('hr:profiles', '{damaged');
    await expect(durableRead('profiles', 'profiles-corrupt')).resolves.toEqual({ kind: 'failed', cause: 'parse', kept: false });
  });
});
