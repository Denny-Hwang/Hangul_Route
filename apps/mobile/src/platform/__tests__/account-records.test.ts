import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTrust, removeRecord, writeDeviceUses, writeRetrustNotice, writeTrust } from '../account-records';

/** F-AUTH-004 section 13.1 (row NS-3): the account's records go through the `hr:` storage wrapper, and nothing else. */

const data = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => data.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void data.set(key, value)),
    removeItem: vi.fn(async (key: string) => void data.delete(key)),
  },
}));

beforeEach(() => {
  data.clear();
  vi.clearAllMocks();
});

describe('the account records', () => {
  it('writes the trust, the uses and the notice under hr:grownup:*', async () => {
    await writeTrust({ v: 1, epoch: 7 });
    await writeDeviceUses({ v: 1, uses: ['family'], at: 5 });
    await writeRetrustNotice(9);
    expect(Object.fromEntries(data)).toEqual({
      'hr:grownup:trust': '{"v":1,"epoch":7}',
      'hr:grownup:deviceUses': '{"v":1,"uses":["family"],"at":5}',
      'hr:grownup:retrustNotice': '{"v":1,"at":9}',
    });
  });

  it('reads the trust exactly: none, the record, damaged on a bad value or a failed read (CS-N3)', async () => {
    expect(await readTrust()).toEqual({ kind: 'none' });
    data.set('hr:grownup:trust', '{"v":1,"epoch":7}');
    expect(await readTrust()).toEqual({ kind: 'trust', trust: { v: 1, epoch: 7 } });
    data.set('hr:grownup:trust', '{not json');
    expect(await readTrust()).toEqual({ kind: 'damaged' });
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read'));
    expect(await readTrust()).toEqual({ kind: 'damaged' });
  });

  it('removes a record by its key', async () => {
    data.set('hr:grownup:trust', '{}');
    await removeRecord('grownup:trust');
    expect(data.has('hr:grownup:trust')).toBe(false);
  });
});
