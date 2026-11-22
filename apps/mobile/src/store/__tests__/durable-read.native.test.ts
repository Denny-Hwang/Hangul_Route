import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.1 (row DP-1b; test 1 of section 6), on the native storage wrapper over
 * an AsyncStorage stand-in: the same outcomes as on the web (`durable-read.test.ts`). AsyncStorage holds no
 * connection, so the one retry is the same read again.
 */
const disk = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** The next reads of any key reject with these, in order. */
  readErrors: [] as Error[],
  setFails: false,
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => {
      const error = disk.readErrors.shift();
      if (error) throw error;
      return disk.mem.get(k) ?? null;
    }),
    setItem: vi.fn(async (k: string, v: string) => {
      if (disk.setFails) throw new Error('disk full');
      disk.mem.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => void disk.mem.delete(k)),
    getAllKeys: vi.fn(async () => [...disk.mem.keys()]),
  },
}));

import { durableRead } from '../durable-read';

describe('[DP] durableRead on native storage (AMENDMENTS-DURABLE-PROGRESS section 3.1, test 1)', () => {
  beforeEach(() => {
    disk.mem.clear();
    disk.readErrors.length = 0;
    disk.setFails = false;
  });

  it('missing, value, and a value after one failed read', async () => {
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'missing' });
    disk.mem.set('hr:profiles', '');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'missing' });
    disk.mem.set('hr:profiles', '[1]');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'value', value: [1] });
    disk.readErrors.push(new Error('busy'));
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'value', value: [1] });
  });

  it('two failed reads are failed/read and copy nothing', async () => {
    disk.mem.set('hr:profiles', '{damaged');
    disk.readErrors.push(new Error('busy'), new Error('busy'));
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'read', kept: false });
    expect(disk.mem.has('hr:profiles-corrupt')).toBe(false);
  });

  it('unparsable bytes are failed/parse, kept at the copy key exactly; a copy that cannot be written is not kept', async () => {
    disk.mem.set('hr:profiles', '{damaged');
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: true });
    expect(disk.mem.get('hr:profiles-corrupt')).toBe('{damaged');
    disk.mem.delete('hr:profiles-corrupt');
    disk.setFails = true;
    expect(await durableRead('profiles', 'profiles-corrupt')).toEqual({ kind: 'failed', cause: 'parse', kept: false });
    expect(await durableRead('profiles:tombstones', null)).toEqual({ kind: 'missing' });
  });
});
