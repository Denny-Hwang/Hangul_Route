import { DEVICE_USES_TTL_MS, SHELL_DB, SHELL_KEYS, SHELL_STORE } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({
  createStore: vi.fn((db: string, store: string) => ({ db, store })),
  get: vi.fn(async (_key: string, _store?: unknown): Promise<unknown> => undefined),
  set: vi.fn(),
  del: vi.fn(),
}));
vi.mock('idb-keyval', () => idb);

import * as native from '../device-uses';
import { readDeviceUses } from '../device-uses.web';
import type { ShellReader } from '../shell-store.web';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.1, row OA-4b: the chooser's use rows come from the console's
 * `deviceUses` record (`hr-shell` / `kv`), read-only. Older than 30 days, unreadable or not parsing reads as no uses.
 */
const NOW = 1_800_000_000_000;
const reader = (value: unknown): ShellReader => ({ get: vi.fn(async () => value) });
const read = (value: unknown, now = NOW) => readDeviceUses(() => reader(value), () => now);

describe('readDeviceUses (web)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    idb.createStore.mockClear();
    idb.get.mockReset();
    idb.set.mockClear();
    idb.del.mockClear();
  });

  it('reads the uses the adult frame wrote (a record or its JSON), in the order stored', async () => {
    expect(await read({ v: 1, uses: ['family', 'teacher'], at: NOW - 1000 })).toEqual(['family', 'teacher']);
    expect(await read(JSON.stringify({ v: 1, uses: ['school'], at: NOW }))).toEqual(['school']);
    expect(await read({ v: 1, uses: [], at: NOW })).toEqual([]);
  });

  it('reads only the deviceUses key and never writes', async () => {
    const r = reader({ v: 1, uses: ['teacher'], at: NOW });
    await readDeviceUses(() => r, () => NOW);
    expect(r.get).toHaveBeenCalledTimes(1);
    expect(r.get).toHaveBeenCalledWith(SHELL_KEYS.deviceUses);
  });

  it('a record older than 30 days is no uses; one at exactly 30 days still counts', async () => {
    expect(await read({ v: 1, uses: ['family'], at: NOW - DEVICE_USES_TTL_MS })).toEqual(['family']);
    expect(await read({ v: 1, uses: ['family'], at: NOW - DEVICE_USES_TTL_MS - 1 })).toEqual([]);
  });

  it('a record dated more than 30 days ahead of this clock (a clock set back) is no uses too', async () => {
    expect(await read({ v: 1, uses: ['family'], at: NOW + 60_000 })).toEqual(['family']);
    expect(await read({ v: 1, uses: ['family'], at: NOW + DEVICE_USES_TTL_MS + 1 })).toEqual([]);
  });

  it('anything that does not parse is no uses: missing, corrupt, another version, an unknown or repeated use', async () => {
    for (const value of [
      undefined,
      null,
      '',
      '{',
      7,
      { v: 2, uses: ['family'], at: NOW },
      { v: 1, uses: ['family'] },
      { v: 1, uses: ['parent'], at: NOW },
      { v: 1, uses: ['area'], at: NOW },
      { v: 1, uses: ['family', 'family'], at: NOW },
      { v: 1, uses: 'family', at: NOW },
    ]) {
      expect(await read(value), JSON.stringify(value)).toEqual([]);
    }
  });

  it('a name or email smuggled into the record is never returned (unknown keys are stripped)', async () => {
    const uses = await read({ v: 1, uses: ['teacher'], at: NOW, name: 'Ms Kim', email: 'kim@example.com' });
    expect(uses).toEqual(['teacher']);
    expect(JSON.stringify(uses)).not.toMatch(/Kim|@/);
  });

  it('a read that fails, or a store that cannot open, is no uses', async () => {
    expect(await readDeviceUses(() => ({ get: async () => Promise.reject(new Error('closed')) }))).toEqual([]);
    expect(
      await readDeviceUses(() => {
        throw new Error('SecurityError');
      }),
    ).toEqual([]);
    expect(await readDeviceUses(() => null)).toEqual([]);
  });

  it('by default reads hr-shell / kv, and nothing without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await readDeviceUses()).toEqual([]);
    expect(idb.createStore).not.toHaveBeenCalled();

    vi.stubGlobal('indexedDB', {});
    idb.get.mockImplementation(async () => ({ v: 1, uses: ['family', 'school'], at: Date.now() }));
    expect(await readDeviceUses()).toEqual(['family', 'school']);
    expect(idb.createStore).toHaveBeenCalledWith(SHELL_DB, SHELL_STORE);
    expect(idb.get).toHaveBeenCalledWith(SHELL_KEYS.deviceUses, { db: SHELL_DB, store: SHELL_STORE });
    expect(idb.set).not.toHaveBeenCalled();
    expect(idb.del).not.toHaveBeenCalled();
  });

  it('the native stub knows no use (the native chooser shows only the Grown-up area)', async () => {
    expect(await native.readDeviceUses()).toEqual([]);
  });
});
