import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({ data: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => ({
  createStore: () => () => undefined,
  get: async (key: string) => idb.data.get(key),
  set: async (key: string, value: unknown) => {
    idb.data.set(key, value);
  },
  del: async (key: string) => {
    idb.data.delete(key);
  },
}));
vi.mock('@/lib/i18n/locale-context', () => ({ useMessages: () => ({}), useLocale: () => 'en' }));

import { refreshPinOwnerHere } from '../GrownUpLock';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.2 moment 2 (CS-10): the lock's PIN path refreshes the stored owner's
 * epoch for the same account only; another account, or no record, writes nothing.
 */
const EPOCH = 1_790_000_000_000;
const fingerprint = (id: string): string => createHash('sha256').update(id).digest('hex').slice(0, 16);

beforeEach(() => {
  vi.stubGlobal('indexedDB', {});
  idb.data.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshPinOwnerHere', () => {
  it('moves the epoch of the same owner', async () => {
    idb.data.set('pinOwner', { v: 1, owner: fingerprint('user_grown_up'), epoch: EPOCH - 1 });
    await refreshPinOwnerHere('user_grown_up', EPOCH);
    expect(idb.data.get('pinOwner')).toEqual({ v: 1, owner: fingerprint('user_grown_up'), epoch: EPOCH });
  });

  it('never makes another account the owner (a child signed in when a grown-up types the PIN)', async () => {
    idb.data.set('pinOwner', { v: 1, owner: fingerprint('user_grown_up'), epoch: EPOCH - 1 });
    await refreshPinOwnerHere('user_child', EPOCH);
    expect(idb.data.get('pinOwner')).toEqual({ v: 1, owner: fingerprint('user_grown_up'), epoch: EPOCH - 1 });
  });

  it('with no record writes nothing', async () => {
    await refreshPinOwnerHere('user_child', EPOCH);
    expect(idb.data.has('pinOwner')).toBe(false);
  });
});
