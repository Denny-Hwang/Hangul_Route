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
  createPrefsHub,
  followDeviceSettings,
  parseStoredObject,
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

function store(initial?: string, profiles?: string): IdbStore & { data: Map<string, string>; fail: { get: boolean; set: boolean } } {
  const data = new Map<string, string>(initial === undefined ? [] : [[DEVICE_SETTINGS_STORAGE_KEY, initial]]);
  if (profiles !== undefined) data.set('hr:profiles', profiles);
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

const message = (settings: Record<string, unknown>) => ({ ns: 'hr-prefs', v: 1, type: 'device-settings', settings });

describe('parseStoredSettings and parseStoredObject', () => {
  it('reads the learner app\'s JSON string; missing, empty or damaged is never chosen; an unknown value reads as absent', () => {
    expect(DEVICE_SETTINGS_STORAGE_KEY).toBe('hr:device:settings');
    expect(parseStoredSettings(JSON.stringify({ uiLocale: 'ko', textSize: 'large' }))).toEqual({ uiLocale: 'ko', textSize: 'large' });
    expect(parseStoredSettings(undefined)).toEqual({});
    expect(parseStoredSettings('')).toEqual({});
    expect(parseStoredSettings('{not json')).toEqual({});
    expect(parseStoredSettings(JSON.stringify({ uiLocale: 'fr', textSize: 'large' }))).toEqual({ textSize: 'large' });
    expect(parseStoredSettings({ uiLocale: 'ko' })).toEqual({});
  });

  it('the stored object keeps every key; anything that is not an object is {}', () => {
    expect(parseStoredObject(JSON.stringify({ uiLocale: 'fr', later: 1 }))).toEqual({ uiLocale: 'fr', later: 1 });
    for (const junk of [undefined, '', '{x', '"ko"', '[1]', 'null', 3]) expect(parseStoredObject(junk)).toEqual({});
  });
});

describe('readDeviceSettings', () => {
  it('reads the record and whether the device holds learner profiles; a failed read is retried once on a fresh connection', async () => {
    const s = store(JSON.stringify({ uiLocale: 'es' }), JSON.stringify([{ id: 'p1' }]));
    expect(await readDeviceSettings(() => s)).toEqual({ readable: true, value: { uiLocale: 'es' }, hasProfiles: true });
    expect(await readDeviceSettings(() => store(undefined, '[]'))).toEqual({ readable: true, value: {}, hasProfiles: false });
    const broken = store();
    broken.fail.get = true;
    const fresh = store(JSON.stringify({ uiLocale: 'ko' }));
    expect(await readDeviceSettings((f) => (f ? fresh : broken))).toEqual({ readable: true, value: { uiLocale: 'ko' }, hasProfiles: false });
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
    idb.get
      .mockRejectedValueOnce(new Error('closed'))
      .mockRejectedValueOnce(new Error('closed'))
      .mockResolvedValueOnce(JSON.stringify({ textSize: 'larger' }))
      .mockResolvedValueOnce(undefined);
    expect(await readDeviceSettings()).toEqual({ readable: true, value: { textSize: 'larger' }, hasProfiles: false });
    expect(idb.createStore).toHaveBeenCalledWith('keyval-store', 'keyval');
    expect(idb.get).toHaveBeenCalledWith(DEVICE_SETTINGS_STORAGE_KEY, 'fresh-store');
    expect(idb.get).toHaveBeenCalledWith('hr:profiles', 'fresh-store');
  });

  it('no IndexedDB (node, an old browser) reads as unreadable', async () => {
    expect(await readDeviceSettings()).toEqual({ readable: false });
  });

  it('never reads a per-profile settings key', async () => {
    const s = store(JSON.stringify({ uiLocale: 'es' }));
    const seen: string[] = [];
    await readDeviceSettings(() => ({ ...s, get: (key) => (seen.push(key), s.get(key)) }));
    expect(seen.sort()).toEqual(['hr:device:settings', 'hr:profiles']);
  });
});

function fakeHub() {
  const posted: unknown[] = [];
  return { posted, hub: { post: (m: unknown) => void posted.push(m), listen: () => () => undefined } };
}

describe('writeDeviceSettings', () => {
  it('read-modify-write: keeps the fields stored meanwhile and a key this version does not know, writes the JSON string, tells the other tabs', async () => {
    const s = store(JSON.stringify({ textSize: 'largest', later: { a: 1 } }));
    const h = fakeHub();
    const written = await writeDeviceSettings(() => ({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' }), { open: () => s, hub: h.hub });
    expect(written).toEqual({ textSize: 'largest', uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(JSON.parse(s.data.get(DEVICE_SETTINGS_STORAGE_KEY)!)).toEqual({ textSize: 'largest', later: { a: 1 }, uiLocale: 'ko', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(h.posted).toEqual([message(written!)]);
  });

  it('a value of a later version survives a write of another field', async () => {
    const s = store(JSON.stringify({ uiLocale: 'fr', textSize: 'huge' }));
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }), { open: () => s, hub: fakeHub().hub })).toEqual({ textSize: 'large' });
    expect(JSON.parse(s.data.get(DEVICE_SETTINGS_STORAGE_KEY)!)).toEqual({ uiLocale: 'fr', textSize: 'large' });
  });

  it('decide sees the stored record; null writes nothing, posts nothing and returns the record as stored', async () => {
    const s = store(JSON.stringify({ uiLocale: 'es', uiLocaleAt: '2026-10-16T12:00:00.000Z' }));
    const h = fakeHub();
    const seen: unknown[] = [];
    const now = await writeDeviceSettings(
      (stored) => {
        seen.push(stored);
        return stored.uiLocale !== undefined ? null : { uiLocale: 'ko' };
      },
      { open: () => s, hub: h.hub },
    );
    expect(seen).toEqual([{ uiLocale: 'es', uiLocaleAt: '2026-10-16T12:00:00.000Z' }]);
    expect(now).toEqual({ uiLocale: 'es', uiLocaleAt: '2026-10-16T12:00:00.000Z' });
    expect(h.posted).toEqual([]);
  });

  it('a failed read or write is retried once on a fresh connection', async () => {
    const broken = store();
    broken.fail.set = true;
    const fresh = store(JSON.stringify({ textSize: 'larger' }));
    const h = fakeHub();
    expect(await writeDeviceSettings(() => ({ uiLocale: 'ko' }), { open: (f) => (f ? fresh : broken), hub: h.hub })).toEqual({ textSize: 'larger', uiLocale: 'ko' });
    expect(JSON.parse(fresh.data.get(DEVICE_SETTINGS_STORAGE_KEY)!)).toEqual({ textSize: 'larger', uiLocale: 'ko' });
    expect(h.posted).toHaveLength(1);
    const brokenGet = store();
    brokenGet.fail.get = true;
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }), { open: (f) => (f ? fresh : brokenGet), hub: h.hub })).toEqual({ textSize: 'large', uiLocale: 'ko' });
  });

  it('no store, or a refused write on both connections, writes nothing and reports null', async () => {
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }), { open: () => null })).toBeNull();
    const s = store();
    s.fail.set = true;
    const h = fakeHub();
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }), { open: () => s, hub: h.hub })).toBeNull();
    expect(
      await writeDeviceSettings(() => ({ textSize: 'large' }), {
        open: (f) => {
          if (f) throw new Error('no connection');
          return s;
        },
        hub: h.hub,
      }),
    ).toBeNull();
    expect(h.posted).toEqual([]);
  });

  it('writes to the learner\'s default store by default', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.get.mockResolvedValueOnce(undefined);
    idb.set.mockResolvedValueOnce(undefined);
    expect(await writeDeviceSettings(() => ({ textSize: 'large' }), { hub: fakeHub().hub })).toEqual({ textSize: 'large' });
    expect(idb.set).toHaveBeenCalledWith(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify({ textSize: 'large' }));
  });
});

describe('the prefs hub: one channel per tab, so a tab never receives its own writes', () => {
  it('posts and listens on one instance, opened once', () => {
    const made: FakeChannel[] = [];
    const hub = createPrefsHub(() => {
      const c = new FakeChannel();
      made.push(c);
      return c;
    });
    const got: unknown[] = [];
    const stop = hub.listen((d) => got.push(d));
    hub.post('a');
    expect(made).toHaveLength(1);
    expect(made[0]!.posted).toEqual(['a']);
    made[0]!.onmessage?.({ data: 'from another tab' });
    expect(got).toEqual(['from another tab']);
    stop();
    made[0]!.onmessage?.({ data: 'late' });
    expect(got).toEqual(['from another tab']);
  });

  it('with real BroadcastChannels: another tab receives the write, the writing tab does not', async () => {
    const Native = (globalThis as unknown as { BroadcastChannel?: new (n: string) => FakeChannel }).BroadcastChannel;
    expect(typeof Native).toBe('function');
    const opened: FakeChannel[] = [];
    const open = () => {
      const c = new Native!('hr-prefs') as unknown as FakeChannel;
      opened.push(c);
      return c;
    };
    const tabA = createPrefsHub(open);
    const tabB = createPrefsHub(open);
    const onA: unknown[] = [];
    const onB: unknown[] = [];
    tabA.listen((d) => onA.push(d));
    tabB.listen((d) => onB.push(d));
    postDeviceSettings({ uiLocale: 'ko' }, tabA);
    await new Promise((r) => setTimeout(r, 30));
    expect(onB).toEqual([message({ uiLocale: 'ko' })]);
    expect(onA).toEqual([]);
    for (const c of opened) c.close();
  });

  it('a missing or throwing channel never throws', () => {
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, createPrefsHub(() => null))).not.toThrow();
    const broken = new FakeChannel();
    broken.postMessage = () => {
      throw new Error('closed');
    };
    expect(() => postDeviceSettings({ uiLocale: 'ko' }, createPrefsHub(() => broken))).not.toThrow();
    expect(() => createPrefsHub(() => null).listen(() => undefined)()).not.toThrow();
  });
});

describe('followDeviceSettings', () => {
  it('a valid record from another tab, a return to the front, and the unsubscribe', () => {
    const channel = new FakeChannel();
    const hub = createPrefsHub(() => channel);
    const listeners = new Map<string, () => void>();
    const target = { addEventListener: (t: string, f: () => void) => listeners.set(t, f), removeEventListener: (t: string) => listeners.delete(t) };
    const doc = { ...target, visibilityState: 'visible' };
    const onRecord = vi.fn();
    const onReturn = vi.fn();
    const stop = followDeviceSettings(onRecord, onReturn, { hub, win: target, doc });
    channel.onmessage?.({ data: message({ uiLocale: 'es' }) });
    channel.onmessage?.({ data: message({ uiLocale: 'xx' }) });
    channel.onmessage?.({ data: { ...message({ uiLocale: 'ko' }), extra: 1 } });
    channel.onmessage?.({ data: { v: 1, kind: 'device-settings', value: { uiLocale: 'ko' } } });
    expect(onRecord.mock.calls).toEqual([[{ uiLocale: 'es' }], [{}]]);
    listeners.get('visibilitychange')?.();
    listeners.get('pageshow')?.();
    expect(onReturn).toHaveBeenCalledTimes(2);
    doc.visibilityState = 'hidden';
    listeners.get('visibilitychange')?.();
    expect(onReturn).toHaveBeenCalledTimes(2);
    stop();
    channel.onmessage?.({ data: message({ uiLocale: 'ko' }) });
    expect(onRecord).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it('no channel, window or document is fine, and throwing listeners never escape', () => {
    const stop = followDeviceSettings(vi.fn(), vi.fn(), { hub: createPrefsHub(() => null), win: null, doc: null });
    expect(() => stop()).not.toThrow();
    const throwing = {
      addEventListener: () => {
        throw new Error('no');
      },
      removeEventListener: () => {
        throw new Error('no');
      },
    };
    const stop2 = followDeviceSettings(vi.fn(), vi.fn(), { hub: createPrefsHub(() => null), win: throwing, doc: throwing });
    expect(() => stop2()).not.toThrow();
  });

  it('reads the browser by default: one channel for the tab', () => {
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
    postDeviceSettings({ textSize: 'large' });
    expect(made.length).toBeLessThanOrEqual(1);
    stop();
  });
});
