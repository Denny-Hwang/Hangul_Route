import { describe, expect, it, vi } from 'vitest';
import { INSTALLED_KEY, installRecordOf, runInstallSweep, sweepComplete, type InstallSweepDeps } from '../install-sweep';

/**
 * F-AUTH-004 section 6.2 (row NS-2; CS-N7, device check D7): the install sweep. A fresh install (no
 * `hr:grownup:installed`) deletes every Clerk item before anything reads one; the record is written only after every
 * delete answered; a failed delete leaves it unwritten so the next launch sweeps again.
 */

function deps(over: Partial<InstallSweepDeps> = {}) {
  const log: string[] = [];
  const d: InstallSweepDeps = {
    readRecord: vi.fn(async () => null),
    writeRecord: vi.fn(async (record) => {
      log.push(`write ${JSON.stringify(record)}`);
    }),
    wipe: vi.fn(async () => {
      log.push('wipe');
      return true;
    }),
    now: () => 1_762_600_000_000,
    ...over,
  };
  return { d, log };
}

describe('the install record', () => {
  it('is a device key under the storage wrapper, never a profile key', () => {
    expect(INSTALLED_KEY).toBe('grownup:installed');
  });

  it('reads only a version 1 record with a time', () => {
    expect(installRecordOf({ v: 1, at: 5 })).toEqual({ v: 1, at: 5 });
    expect(installRecordOf({ v: 1, at: 5, extra: 'x' })).toEqual({ v: 1, at: 5 });
    for (const raw of [null, 'x', 1, {}, { v: 2, at: 5 }, { v: 1 }, { v: 1, at: -1 }, { v: 1, at: Number.NaN }, { v: 1, at: '5' }]) {
      expect(installRecordOf(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe('runInstallSweep', () => {
  it('a fresh install: deletes first, then writes the record', async () => {
    const { d, log } = deps();
    expect(await runInstallSweep(d)).toBe('swept');
    expect(log).toEqual(['wipe', 'write {"v":1,"at":1762600000000}']);
  });

  it('a device already swept deletes nothing', async () => {
    const { d } = deps({ readRecord: async () => ({ v: 1, at: 1 }) });
    expect(await runInstallSweep(d)).toBe('installed');
    expect(d.wipe).not.toHaveBeenCalled();
    expect(d.writeRecord).not.toHaveBeenCalled();
  });

  it('a record that does not parse is no record: the sweep runs', async () => {
    const { d } = deps({ readRecord: async () => ({ v: 7 }) });
    expect(await runInstallSweep(d)).toBe('swept');
    expect(d.wipe).toHaveBeenCalledTimes(1);
  });

  it('a failed delete leaves the record unwritten (the next launch sweeps again)', async () => {
    const { d } = deps({ wipe: async () => false });
    expect(await runInstallSweep(d)).toBe('failed');
    expect(d.writeRecord).not.toHaveBeenCalled();
    const { d: throwing } = deps({
      wipe: async () => {
        throw new Error('locked since restart');
      },
    });
    expect(await runInstallSweep(throwing)).toBe('failed');
    expect(throwing.writeRecord).not.toHaveBeenCalled();
  });

  it('a record read that fails deletes nothing and is not complete', async () => {
    const { d } = deps({
      readRecord: async () => {
        throw new Error('storage');
      },
    });
    expect(await runInstallSweep(d)).toBe('failed');
    expect(d.wipe).not.toHaveBeenCalled();
  });

  it('the deletes answered but the record write failed: complete for this run', async () => {
    const { d } = deps({
      writeRecord: async () => {
        throw new Error('quota');
      },
    });
    expect(await runInstallSweep(d)).toBe('swept');
  });

  it('sweepComplete: Clerk may mount only after `installed` or `swept`', () => {
    expect(sweepComplete('installed')).toBe(true);
    expect(sweepComplete('swept')).toBe(true);
    expect(sweepComplete('failed')).toBe(false);
  });
});
