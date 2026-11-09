import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRetrustRequired, readRetrustNotice, readRetrustRequired, readTrust, readUsesRecord, removeRecord, writeDeviceUses, writeRetrustNotice, writeRetrustRequired, writeTrust } from '../account-records';

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

  it('keeps the 24-hour wait’s copy until a trusting sign-in clears it; an unreadable copy counts (fail closed)', async () => {
    expect(await readRetrustRequired()).toBe(false);
    await writeRetrustRequired(42);
    expect(data.get('hr:grownup:retrustRequired')).toBe('{"v":1,"at":42}');
    expect(await readRetrustRequired()).toBe(true);
    data.set('hr:grownup:retrustRequired', '{bad');
    expect(await readRetrustRequired()).toBe(true);
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read'));
    expect(await readRetrustRequired()).toBe(true);
    await clearRetrustRequired();
    expect(await readRetrustRequired()).toBe(false);
  });
});

describe('row NS-5: the re-trust notice the home shows once', () => {
  it('waits only as a record that reads; a bad value or a failed read shows nothing', async () => {
    expect(await readRetrustNotice()).toBe(false);
    await writeRetrustNotice(9);
    expect(await readRetrustNotice()).toBe(true);
    data.set('hr:grownup:retrustNotice', '{bad');
    expect(await readRetrustNotice()).toBe(false);
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read'));
    expect(await readRetrustNotice()).toBe(false);
    await removeRecord('grownup:retrustNotice');
    expect(await readRetrustNotice()).toBe(false);
  });
});

describe('row NS-4: the uses record as the native chooser and the account card read it', () => {
  it('none, the uses in order, an empty list for a record with no use; stale, damaged or a failed read is none', async () => {
    expect(await readUsesRecord(1000)).toBeNull();
    data.set('hr:grownup:deviceUses', '{"v":1,"uses":["school","family"],"at":1000}');
    expect(await readUsesRecord(1000)).toEqual(['family', 'school']);
    data.set('hr:grownup:deviceUses', '{"v":1,"uses":[],"at":1000}');
    expect(await readUsesRecord(1000)).toEqual([]);
    expect(await readUsesRecord(1000 + 31 * 24 * 3600 * 1000)).toBeNull();
    data.set('hr:grownup:deviceUses', '{not json');
    expect(await readUsesRecord(1000)).toBeNull();
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read'));
    expect(await readUsesRecord(1000)).toBeNull();
  });
});
