import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-APP-001 sections 3.5 and 3.9: the shell store is its own IndexedDB database (`hr-shell`,
 * store `kv`), outside the learner `hr:` namespace, so learner backups and key listings never
 * see it. It holds the last persona and the trusted PIN epoch. Every access is guarded:
 * unreadable means "none", a refused write reports false.
 */
const idb = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  const store = (): void => undefined;
  return {
    data,
    store,
    createStore: vi.fn((_db: string, _name: string) => store),
    get: vi.fn(async (key: string, _store?: unknown) => data.get(key)),
    set: vi.fn(async (key: string, value: unknown, _store?: unknown) => {
      data.set(key, value);
    }),
    del: vi.fn(async (key: string, _store?: unknown) => {
      data.delete(key);
    }),
  };
});
vi.mock('idb-keyval', () => ({ createStore: idb.createStore, get: idb.get, set: idb.set, del: idb.del }));

import { readLastPersona, readTrustedEpoch, writeLastPersona, writeTrustedEpoch, type ShellStore } from '../shell-store';

function memoryStore(): ShellStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (k) => map.get(k),
    set: async (k, v) => {
      map.set(k, v);
    },
    del: async (k) => {
      map.delete(k);
    },
  };
}

const failing: ShellStore = {
  get: () => Promise.reject(new Error('blocked')),
  set: () => Promise.reject(new Error('quota')),
  del: () => {
    throw new Error('blocked');
  },
};

const EPOCH = 1_790_000_000_000;

describe('last persona (section 3.5)', () => {
  it('round-trips as { v: 1, persona } under the key lastPersona', async () => {
    const s = memoryStore();
    expect(await readLastPersona(s)).toBeNull();
    expect(await writeLastPersona('teacher', s)).toBe(true);
    expect(s.map.get('lastPersona')).toEqual({ v: 1, persona: 'teacher' });
    expect(await readLastPersona(s)).toBe('teacher');
    await writeLastPersona('parent', s);
    expect(await readLastPersona(s)).toBe('parent');
  });

  it('reads a JSON string the same way, and anything invalid as none', async () => {
    const s = memoryStore();
    s.map.set('lastPersona', '{"v":1,"persona":"parent"}');
    expect(await readLastPersona(s)).toBe('parent');
    for (const raw of ['{bad', { v: 1, persona: 'learner' }, { v: 2, persona: 'parent' }, 'teacher', 3]) {
      s.map.set('lastPersona', raw);
      expect(await readLastPersona(s)).toBeNull();
    }
  });

  it('unreadable or refused storage: none, false', async () => {
    expect(await readLastPersona(failing)).toBeNull();
    expect(await writeLastPersona('parent', failing)).toBe(false);
    expect(await readLastPersona(null)).toBeNull();
    expect(await writeLastPersona('parent', null)).toBe(false);
  });
});

describe('trusted PIN epoch (section 3.9)', () => {
  it('round-trips a real epoch under the key pinEpoch', async () => {
    const s = memoryStore();
    expect(await readTrustedEpoch(s)).toBeNull();
    expect(await writeTrustedEpoch(EPOCH, s)).toBe(true);
    expect(s.map.get('pinEpoch')).toBe(EPOCH);
    expect(await readTrustedEpoch(s)).toBe(EPOCH);
  });

  it('never stores epoch 0: writing 0 or null forgets any earlier epoch', async () => {
    const s = memoryStore();
    await writeTrustedEpoch(EPOCH, s);
    expect(await writeTrustedEpoch(0, s)).toBe(true);
    expect(s.map.has('pinEpoch')).toBe(false);
    await writeTrustedEpoch(EPOCH, s);
    expect(await writeTrustedEpoch(null, s)).toBe(true);
    expect(s.map.has('pinEpoch')).toBe(false);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await writeTrustedEpoch(bad, s);
      expect(s.map.has('pinEpoch')).toBe(false);
    }
  });

  it('reads 0, negatives, strings and junk as no trusted epoch', async () => {
    const s = memoryStore();
    for (const raw of [0, -5, '1790000000000', Number.NaN, { pinEpoch: EPOCH }, null]) {
      s.map.set('pinEpoch', raw);
      expect(await readTrustedEpoch(s)).toBeNull();
    }
  });

  it('unreadable or refused storage: none, false', async () => {
    expect(await readTrustedEpoch(failing)).toBeNull();
    expect(await writeTrustedEpoch(EPOCH, failing)).toBe(false);
    expect(await writeTrustedEpoch(null, failing)).toBe(false);
    expect(await readTrustedEpoch(null)).toBeNull();
    expect(await writeTrustedEpoch(EPOCH, null)).toBe(false);
  });
});

describe('default store: hr-shell / kv, never the learner hr: namespace', () => {
  beforeEach(() => {
    idb.data.clear();
    idb.get.mockClear();
    idb.set.mockClear();
    idb.del.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens its own database through createStore(hr-shell, kv) and passes it to every call', async () => {
    vi.stubGlobal('indexedDB', {});
    await writeLastPersona('teacher');
    await writeTrustedEpoch(EPOCH);
    expect(await readLastPersona()).toBe('teacher');
    expect(await readTrustedEpoch()).toBe(EPOCH);
    await writeTrustedEpoch(null);
    expect(idb.createStore).toHaveBeenCalledTimes(1);
    expect(idb.createStore).toHaveBeenCalledWith('hr-shell', 'kv');
    for (const call of [...idb.get.mock.calls, ...idb.set.mock.calls, ...idb.del.mock.calls]) {
      expect(call[0]).not.toMatch(/^hr:/);
      expect(call[call.length - 1]).toBe(idb.store);
    }
    expect(idb.set.mock.calls.map((call) => call[0])).toEqual(['lastPersona', 'pinEpoch']);
    expect(idb.del.mock.calls.map((call) => call[0])).toEqual(['pinEpoch']);
  });

  it('is none without IndexedDB, and touches nothing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await readLastPersona()).toBeNull();
    expect(await writeLastPersona('parent')).toBe(false);
    expect(await readTrustedEpoch()).toBeNull();
    expect(await writeTrustedEpoch(EPOCH)).toBe(false);
    expect(idb.get).not.toHaveBeenCalled();
    expect(idb.set).not.toHaveBeenCalled();
  });

  it('is none when touching indexedDB throws', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(await readLastPersona()).toBeNull();
      expect(await writeTrustedEpoch(EPOCH)).toBe(false);
    } finally {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
  });
});
