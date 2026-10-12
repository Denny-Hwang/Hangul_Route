import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-APP-001 section 3.9: the console reads the learner app's `hr:device:gate` marker and
 * whether `hr:profiles` holds a non-empty list, from the learner's default idb-keyval store
 * (`apps/mobile/src/platform/storage.web.ts` stores JSON strings under `hr:`). Every failure
 * reads as "unreadable", which the lock treats as open.
 */
const idb = vi.hoisted(() => ({ get: vi.fn<(key: string) => Promise<unknown>>() }));
vi.mock('idb-keyval', () => ({ get: idb.get }));

import { DEVICE_GATE_STORAGE_KEY, PROFILES_STORAGE_KEY, hasProfileList, readDeviceGate, type IdbReader } from '../device-marker';

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
  it('are the learner keys under the hr: prefix', () => {
    expect(DEVICE_GATE_STORAGE_KEY).toBe('hr:device:gate');
    expect(PROFILES_STORAGE_KEY).toBe('hr:profiles');
  });
});

describe('readDeviceGate', () => {
  it('parses each marker the learner app writes', async () => {
    expect(await readDeviceGate(reader({ 'hr:device:gate': PIN }))).toEqual({
      readable: true,
      marker: { v: 1, gate: 'pin', pinEpoch: 1_790_000_000_000 },
      hasProfiles: false,
    });
    expect(await readDeviceGate(reader({ 'hr:device:gate': '{"v":1,"gate":"nopin"}', 'hr:profiles': '[{"id":"p1"}]' }))).toEqual({
      readable: true,
      marker: { v: 1, gate: 'nopin' },
      hasProfiles: true,
    });
    expect(await readDeviceGate(reader({ 'hr:device:gate': '{"v":1,"gate":"none"}' }))).toMatchObject({ marker: { gate: 'none' } });
  });

  it('reads the two keys only', async () => {
    const r = reader({});
    await readDeviceGate(r);
    expect(r.keys.sort()).toEqual(['hr:device:gate', 'hr:profiles']);
  });

  it('treats a missing, corrupt or invalid marker as absent (lenient read)', async () => {
    for (const raw of [undefined, null, '{not json', '{"v":2,"gate":"pin","pinEpoch":1}', '{"v":1,"gate":"pin"}', '{"v":1,"gate":"open"}', 42]) {
      expect(await readDeviceGate(reader({ 'hr:device:gate': raw }))).toEqual({ readable: true, marker: null, hasProfiles: false });
    }
  });

  it('reports unreadable when the store throws or rejects, or there is no store', async () => {
    const rejecting: IdbReader = { get: () => Promise.reject(new Error('blocked')) };
    const throwing: IdbReader = {
      get: () => {
        throw new Error('no IndexedDB');
      },
    };
    expect(await readDeviceGate(rejecting)).toEqual({ readable: false });
    expect(await readDeviceGate(throwing)).toEqual({ readable: false });
    expect(await readDeviceGate(null)).toEqual({ readable: false });
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
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is unreadable without IndexedDB (node, SSR, a browser that blocks it)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await readDeviceGate()).toEqual({ readable: false });
    expect(idb.get).not.toHaveBeenCalled();
  });

  it('reads the learner default store through idb-keyval (no custom store)', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.get.mockImplementation(async (key: string) => (key === 'hr:device:gate' ? PIN : '[{"id":"p1"}]'));
    expect(await readDeviceGate()).toMatchObject({ readable: true, marker: { gate: 'pin' }, hasProfiles: true });
    expect(idb.get.mock.calls.map((call) => call.length)).toEqual([1, 1]);
  });

  it('is unreadable when touching indexedDB throws (a SecurityError on access)', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(await readDeviceGate()).toEqual({ readable: false });
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
