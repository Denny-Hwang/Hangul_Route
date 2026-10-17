import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Owner items 6 and 7: the grown-up pages read and write the learner app's display record
 * (`hr:device:settings`, a JSON string in the default idb-keyval store) and tell every open tab on
 * BroadcastChannel('hr-prefs'). A failed read is retried once on a fresh connection.
 */
const idb = vi.hoisted(() => ({
  get: vi.fn<(key: string, store?: unknown) => Promise<unknown>>(),
  set: vi.fn<(key: string, value: string, store?: unknown) => Promise<void>>(),
  createStore: vi.fn<(db: string, store: string) => unknown>(() => 'fresh-store'),
}));
vi.mock('idb-keyval', () => ({ get: idb.get, set: idb.set, createStore: idb.createStore }));

import {
  DEVICE_SETTINGS_STORAGE_KEY,
  followDeviceSettings,
  parseStoredSettings,
  postDeviceSettings,
  readDeviceSettings,
  writeDeviceSettings,
  type IdbStore,
} from '../device-settings';

afterEach(() => {
  vi.unstubAllGlobals();
  idb.get.mockReset();
  idb.set.mockReset();
});

function store(initial?: string): IdbStore & { data: Map<string, string>; fail: { get: boolean; set: boolean } } {
  const data = new Map<string, string>(initial === undefined ? [] : [[DEVICE_SETTINGS_STORAGE_KEY, initial]]);
  const fail = { get: false, set: false };
  return {
    data,
    fail,
    get: async (key) => {
      if (fail.get) throw new Error('closed');
      return data.get(key);
    },
    set: async (key, value) => {
      if (fail.set) throw new Error('quota');
      data.set(key, value);
    },
  };
}

class FakeChannel {
  posted: unknown[] = [];
  closed = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage(m: unknown): void {
    this.posted.push(m);
  }
  close(): void {
    this.closed = true;
  }
}

describe('parseStoredSettings', () => {
  it('reads the learner app\'s JSON string; missing, empty or damaged is never chosen', () => {
    expect(DEVICE_SETTINGS_STORAGE_KEY).toBe('hr:device:settings');
    expect(parseStoredSettings(JSON.stringify({ uiLocale: 'ko', textSize: 'large' }))).toEqual({ uiLocale: 'ko', textSize: 'large' });
    expect(parseStoredSettings(undefined)).toEqual({});
    expect(parseStoredSettings('')).toEqual({});
    expect(parseStoredSettings('{not json')).toEqual({});
    expect(parseStoredSettings(JSON.stringify({ uiLocale: 'fr' }))).toEqual({});
    expect(parseStoredSettings({ uiLocale: 'ko' })).toEqual({});
  });
});

describe('readDeviceSettings', () => {
  it('reads the record; a failed read is retried once on a fresh connection, then unreadable', async () => {
    const s = store(JSON.stringify({ uiLocale: 'es' }));
    expect(await readDeviceSettings(() => s)).toEqual({ readable: true, value: { uiLocale: 'es' } });
    const broken = store();
    broken.fail.get = true;
    const fresh = store(JSON.stringify({ uiLocale: 'ko' }));
    expect(await readDeviceSettings((f) => (f ? fresh : broken))).toEqual({ readable: true, value: { uiLocale: 'ko' } });
    expect(await readDeviceSettings(() => broken)).toEqual({ readable: false });
    expect(await readDeviceSettings(() => null)).toEqual({ readable: false });
    expect(
      await readDeviceSettings((f) => {
        if (f) throw new Error('no connection');
        return broken;
      }),
    ).toEqual({ readable: false });
  });

  it('uses the learner\'s default store, and a fresh one for the retry', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.get.mockRejectedValueOnce(new Error('closed')).mockResolvedValueOnce(JSON.stringify({ textSize: 'larger' }));
    expect(await readDeviceSettings()).toEqual({ readable: true, value: { textSize: 'larger' } });
    expect(idb.createStore).toHaveBeenCalledWith('keyval-store', 'keyval');
    expect(idb.get).toHaveBeenLastCalledWith(DEVICE_SETTINGS_STORAGE_KEY, 'fresh-store');
  });

  it('no IndexedDB (node, an old browser) reads as unreadable', async () => {
    expect(await readDeviceSettings()).toEqual({ readable: false });
  });
});

describe('writeDeviceSettings', () => {
  it('read-modify-write: keeps the fields stored meanwhile, writes the JSON string, tells the other tabs', async () => {
    const s = store(JSON.stringify({ textSize: 'largest' }));
    const channel = new FakeChannel();
    const written = await writeDeviceSettings((stored) => ({ ...stored, uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' }), { open: () => s, channel: () => channel });
    expect(written).toEqual({ textSize: 'largest', uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(JSON.parse(s.data.get(DEVICE_SETTINGS_STORAGE_KEY)!)).toEqual(written);
    expect(channel.posted).toEqual([{ v: 1, kind: 'device-settings', value: written }]);
    expect(channel.closed).toBe(true);
  });

  it('no store or a refused write writes nothing and reports null', async () => {
    expect(await writeDeviceSettings((s) => s, { open: () => null })).toBeNull();
    const s = store();
    s.fail.set = true;
    expect(await writeDeviceSettings((x) => ({ ...x, textSize: 'large' }), { open: () => s, channel: () => null })).toBeNull();
  });

  it('writes to the learner\'s default store by default', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.get.mockResolvedValueOnce(undefined);
    idb.set.mockResolvedValueOnce(undefined);
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }))).toEqual({ textSize: 'large' });
    expect(idb.set).toHaveBeenCalledWith(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: 'large' }));
  });
});

describe('postDeviceSettings and followDeviceSettings', () => {
  it('post: a missing or throwing channel never throws', () => {
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, () => null)).not.toThrow();
    const broken = new FakeChannel();
    broken.postMessage = () => {
      throw new Error('closed');
    };
    broken.close = () => {
      throw new Error('gone');
    };
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, () => broken)).not.toThrow();
    vi.stubGlobal('BroadcastChannel', function Throwing() {
      throw new Error('blocked');
    });
    expect(() => postDeviceSettings({ uiLocale: 'ko' })).not.toThrow();
  });

  it('follow: a valid record from another tab, a return to the front, and the unsubscribe', () => {
    const channel = new FakeChannel();
    const listeners = new Map<string, () => void>();
    const target = { addEventListener: (t: string, f: () => void) => listeners.set(t, f), removeEventListener: (t: string) => listeners.delete(t) };
    const doc = { ...target, visibilityState: 'visible' };
    const onRecord = vi.fn();
    const onReturn = vi.fn();
    const stop = followDeviceSettings(onRecord, onReturn, { channel: () => channel, win: target, doc });
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'es' } } });
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'xx' } } });
    expect(onRecord.mock.calls).toEqual([[{ uiLocale: 'es' }]]);
    listeners.get('visibilitychange')?.();
    listeners.get('pageshow')?.();
    expect(onReturn).toHaveBeenCalledTimes(2);
    doc.visibilityState = 'hidden';
    listeners.get('visibilitychange')?.();
    expect(onReturn).toHaveBeenCalledTimes(2);
    stop();
    expect(channel.closed).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it('follow: no channel, window or document is fine, and throwing listeners never escape', () => {
    const stop = followDeviceSettings(vi.fn(), vi.fn(), { channel: () => null, win: null, doc: null });
    expect(() => stop()).not.toThrow();
    const throwing = {
      addEventListener: () => {
        throw new Error('no');
      },
      removeEventListener: () => {
        throw new Error('no');
      },
    };
    const stop2 = followDeviceSettings(vi.fn(), vi.fn(), { channel: () => null, win: throwing, doc: throwing });
    expect(() => stop2()).not.toThrow();
  });

  it('follow: reads the browser by default', () => {
    const made: FakeChannel[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class extends FakeChannel {
        constructor() {
          super();
          made.push(this);
        }
      },
    );
    const stop = followDeviceSettings(vi.fn(), vi.fn());
    expect(made).toHaveLength(1);
    stop();
  });
});
