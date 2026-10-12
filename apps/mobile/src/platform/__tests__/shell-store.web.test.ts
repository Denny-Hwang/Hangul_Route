import { SHELL_DB, SHELL_KEYS, SHELL_STORE } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({
  createStore: vi.fn((db: string, store: string) => ({ db, store })),
  get: vi.fn(async (_key: string, _store?: unknown): Promise<unknown> => undefined),
}));
vi.mock('idb-keyval', () => idb);

import * as native from '../shell-store';
import { readLastPersona, type ShellReader } from '../shell-store.web';

/**
 * F-APP-001 sections 3.5 and 3.14: the learner app reads the shell store (IndexedDB `hr-shell`,
 * store `kv`, outside the learner `hr:` namespace) only here, and only `lastPersona`, read-only.
 * Unreadable or missing means "none".
 */
const reader = (value: unknown): ShellReader => ({ get: vi.fn(async () => value) });

describe('readLastPersona (web)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    idb.createStore.mockClear();
    idb.get.mockReset();
  });

  it('reads the persona the console wrote (a record or its JSON)', async () => {
    expect(await readLastPersona(() => reader({ v: 1, persona: 'parent' }))).toBe('parent');
    expect(await readLastPersona(() => reader('{"v":1,"persona":"teacher"}'))).toBe('teacher');
  });

  it('reads only the lastPersona key', async () => {
    const r = reader({ v: 1, persona: 'teacher' });
    await readLastPersona(() => r);
    expect(r.get).toHaveBeenCalledTimes(1);
    expect(r.get).toHaveBeenCalledWith(SHELL_KEYS.lastPersona);
  });

  it('anything else is none: missing, corrupt, another version, the learner persona', async () => {
    for (const value of [undefined, null, '', '{', { v: 2, persona: 'parent' }, { v: 1, persona: 'learner' }, { v: 1 }, 7]) {
      expect(await readLastPersona(() => reader(value)), JSON.stringify(value)).toBeNull();
    }
  });

  it('a read that fails, or a store that cannot open, is none', async () => {
    expect(await readLastPersona(() => ({ get: async () => Promise.reject(new Error('closed')) }))).toBeNull();
    expect(
      await readLastPersona(() => {
        throw new Error('SecurityError');
      }),
    ).toBeNull();
    expect(await readLastPersona(() => null)).toBeNull();
  });

  it('by default reads hr-shell / kv, never the learner store, and nothing without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await readLastPersona()).toBeNull();
    expect(idb.createStore).not.toHaveBeenCalled();

    vi.stubGlobal('indexedDB', {});
    idb.get.mockImplementation(async () => ({ v: 1, persona: 'parent' }));
    expect(await readLastPersona()).toBe('parent');
    expect(idb.createStore).toHaveBeenCalledWith(SHELL_DB, SHELL_STORE);
    expect(idb.get).toHaveBeenCalledWith(SHELL_KEYS.lastPersona, { db: SHELL_DB, store: SHELL_STORE });
  });

  it('a browser that throws on touching IndexedDB is none', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(await readLastPersona()).toBeNull();
    } finally {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });
});

describe('readLastPersona (native stub)', () => {
  it('is always none: native builds have no console (OD-6)', async () => {
    expect(await native.readLastPersona()).toBeNull();
  });
});
