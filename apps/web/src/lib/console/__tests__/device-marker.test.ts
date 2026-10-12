import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-APP-001 section 3.9: the console reads the learner app's `hr:device:gate` marker and
 * whether `hr:profiles` holds a non-empty list, from the learner's default idb-keyval store
 * (`apps/mobile/src/platform/storage.web.ts` stores JSON strings under `hr:`). No IndexedDB
 * API reads as `unavailable` (the lock opens: such a browser cannot keep profiles). A read that
 * fails is retried once on a fresh connection, then reads as `failed` (the lock asks for a
 * sign-in: this browser may hold profiles; A-4a review 2026-10-12).
 */
const idb = vi.hoisted(() => ({
  get: vi.fn<(key: string, store?: unknown) => Promise<unknown>>(),
  createStore: vi.fn<(db: string, store: string) => unknown>(),
}));
vi.mock('idb-keyval', () => ({ get: idb.get, createStore: idb.createStore }));

import {
  DEVICE_GATE_STORAGE_KEY,
  LEARNER_DB,
  LEARNER_STORE,
  PROFILES_STORAGE_KEY,
  hasProfileList,
  readDeviceGate,
  type IdbReader,
} from '../device-marker';

const UNAVAILABLE = { readable: false, reason: 'unavailable' };
const FAILED = { readable: false, reason: 'failed' };

/** The same reader for the first read and the retry. */
const always =
  (r: IdbReader | null) =>
  (): IdbReader | null =>
    r;

function reader(values: Record<string, unknown>): IdbReader & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    get: async (key) => {
      keys.push(key);
      return values[key];
    },
  };
}

const PIN = JSON.stringify({ v: 1, gate: 'pin', pinEpoch: 1_790_000_000_000 });

describe('storage keys', () => {
  it('are the learner keys under the hr: prefix, in the default idb-keyval store', () => {
    expect(DEVICE_GATE_STORAGE_KEY).toBe('hr:device:gate');
    expect(PROFILES_STORAGE_KEY).toBe('hr:profiles');
    expect([LEARNER_DB, LEARNER_STORE]).toEqual(['keyval-store', 'keyval']);
  });
});

describe('readDeviceGate', () => {
  it('parses each marker the learner app writes', async () => {
    expect(await readDeviceGate(always(reader({ 'hr:device:gate': PIN })))).toEqual({
      readable: true,
      marker: { v: 1, gate: 'pin', pinEpoch: 1_790_000_000_000 },
      hasProfiles: false,
    });
    expect(await readDeviceGate(always(reader({ 'hr:device:gate': '{"v":1,"gate":"nopin"}', 'hr:profiles': '[{"id":"p1"}]' })))).toEqual({
      readable: true,
      marker: { v: 1, gate: 'nopin' },
      hasProfiles: true,
    });
    expect(await readDeviceGate(always(reader({ 'hr:device:gate': '{"v":1,"gate":"none"}' })))).toMatchObject({ marker: { gate: 'none' } });
  });

  it('reads the two keys only, from the first reader when it works (no second connection)', async () => {
    const r = reader({});
    const opened: boolean[] = [];
    await readDeviceGate((fresh) => {
      opened.push(fresh);
      return r;
    });
    expect(r.keys.sort()).toEqual(['hr:device:gate', 'hr:profiles']);
    expect(opened).toEqual([false]);
  });

  it('treats a missing, corrupt or invalid marker as absent (lenient read)', async () => {
    for (const raw of [undefined, null, '{not json', '{"v":2,"gate":"pin","pinEpoch":1}', '{"v":1,"gate":"pin"}', '{"v":1,"gate":"open"}', 42]) {
      expect(await readDeviceGate(always(reader({ 'hr:device:gate': raw })))).toEqual({ readable: true, marker: null, hasProfiles: false });
    }
  });

  it('is unavailable when there is no store at all (no IndexedDB API)', async () => {
    expect(await readDeviceGate(always(null))).toEqual(UNAVAILABLE);
  });

  it('retries once on a fresh connection when the first read rejects or throws (a lost connection)', async () => {
    const lost: IdbReader = { get: () => Promise.reject(new Error('Connection to Indexed Database server lost')) };
    const closed: IdbReader = {
      get: () => {
        throw new Error('InvalidStateError');
      },
    };
    for (const first of [lost, closed]) {
      const opened: boolean[] = [];
      const result = await readDeviceGate((fresh) => {
        opened.push(fresh);
        return fresh ? reader({ 'hr:device:gate': '{"v":1,"gate":"nopin"}', 'hr:profiles': '[{"id":"p1"}]' }) : first;
      });
      expect(result).toEqual({ readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true });
      expect(opened).toEqual([false, true]);
    }
  });

  it('is failed, never unavailable, when the retry fails too or cannot open: this browser may hold profiles', async () => {
    const rejecting: IdbReader = { get: () => Promise.reject(new Error('UnknownError')) };
    expect(await readDeviceGate(always(rejecting))).toEqual(FAILED);
    // only the profiles read fails: still failed (the lock must not open on half a read)
    const half: IdbReader = { get: (key) => (key === 'hr:profiles' ? Promise.reject(new Error('UnknownError')) : Promise.resolve('{"v":1,"gate":"nopin"}')) };
    expect(await readDeviceGate(always(half))).toEqual(FAILED);
    // the fresh connection cannot be made
    expect(await readDeviceGate((fresh) => (fresh ? null : rejecting))).toEqual(FAILED);
    expect(
      await readDeviceGate((fresh) => {
        if (fresh) throw new Error('SecurityError');
        return rejecting;
      }),
    ).toEqual(FAILED);
  });
});

describe('hasProfileList: presence only, never parsed', () => {
  it('is true only for a stored string longer than []', () => {
    expect(hasProfileList('[{"id":"p1","name":"x"}]')).toBe(true);
    expect(hasProfileList('[]')).toBe(false);
    expect(hasProfileList('')).toBe(false);
    expect(hasProfileList(undefined)).toBe(false);
    expect(hasProfileList(null)).toBe(false);
    expect(hasProfileList(['p1'])).toBe(false);
  });
});

describe('default reader', () => {
  beforeEach(() => {
    idb.get.mockReset();
    idb.createStore.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unavailable without IndexedDB (node, SSR, a browser that offers none)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await readDeviceGate()).toEqual(UNAVAILABLE);
    expect(idb.get).not.toHaveBeenCalled();
  });

  it('reads the learner default store through idb-keyval (no custom store, no new connection)', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.get.mockImplementation(async (key: string) => (key === 'hr:device:gate' ? PIN : '[{"id":"p1"}]'));
    expect(await readDeviceGate()).toMatchObject({ readable: true, marker: { gate: 'pin' }, hasProfiles: true });
    expect(idb.get.mock.calls.map((call) => call.length)).toEqual([1, 1]);
    expect(idb.createStore).not.toHaveBeenCalled();
  });

  it('retries on a fresh connection to the same learner store after a failed read', async () => {
    vi.stubGlobal('indexedDB', {});
    const freshStore = { fresh: true };
    idb.createStore.mockReturnValue(freshStore);
    idb.get.mockImplementation(async (key: string, store?: unknown) => {
      if (store !== freshStore) throw new Error('Connection to Indexed Database server lost');
      return key === 'hr:device:gate' ? PIN : '[{"id":"p1"}]';
    });
    expect(await readDeviceGate()).toMatchObject({ readable: true, marker: { gate: 'pin' }, hasProfiles: true });
    expect(idb.createStore).toHaveBeenCalledWith('keyval-store', 'keyval');
  });

  it('is unavailable when touching indexedDB throws (a SecurityError on access)', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(await readDeviceGate()).toEqual(UNAVAILABLE);
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
