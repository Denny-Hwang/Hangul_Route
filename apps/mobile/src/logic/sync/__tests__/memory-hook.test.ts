import type { MemoryBackup } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryForBackup, pullMemoryAfterAdopt, restoreMemory, setMemoryStoreHook, type MemoryStoreHook } from '../memory-hook';

/*
 * F-CURR-002 section 4.8 (row CM-11): the hook the memory store of row CM-12 fills. With no store the
 * backup and the restore behave exactly as before; a failing store never fails a backup, a restore or a claim.
 */

const memory: MemoryBackup = { stage2: { 'lex:sagwa': { b: 3, d: '2026-10-25', c: 2, r: 3, n: 4, f: '2026-10-01', s: 3, at: '2026-10-22T10:00:00.000Z' } } };

function fakeHook(over: Partial<MemoryStoreHook> = {}): MemoryStoreHook {
  return { backup: vi.fn(async () => memory), restore: vi.fn(async () => undefined), pull: vi.fn(async () => undefined), ...over };
}

afterEach(() => setMemoryStoreHook(null));

describe('memory store hook', () => {
  it('with no store registered: no memory key, nothing restored, no pull', async () => {
    expect(await memoryForBackup('profile:a')).toBeUndefined();
    await expect(restoreMemory('profile:a', memory)).resolves.toBeUndefined();
    expect(() => pullMemoryAfterAdopt('profile:a')).not.toThrow();
  });

  it('backup: the store\'s states, or undefined when it holds none or fails', async () => {
    setMemoryStoreHook(fakeHook());
    expect(await memoryForBackup('profile:a')).toEqual(memory);
    setMemoryStoreHook(fakeHook({ backup: vi.fn(async () => ({})) }));
    expect(await memoryForBackup('profile:a')).toBeUndefined();
    setMemoryStoreHook(fakeHook({ backup: vi.fn(async () => undefined) }));
    expect(await memoryForBackup('profile:a')).toBeUndefined();
    setMemoryStoreHook(fakeHook({ backup: vi.fn(async () => Promise.reject(new Error('storage'))) }));
    expect(await memoryForBackup('profile:a')).toBeUndefined();
  });

  it('restore: hands over a file\'s states; skips a file without any; a failing store does not throw', async () => {
    const hook = fakeHook();
    setMemoryStoreHook(hook);
    await restoreMemory('profile:a', memory);
    expect(hook.restore).toHaveBeenCalledWith('profile:a', memory);
    await restoreMemory('profile:a', undefined);
    await restoreMemory('profile:a', {});
    expect(hook.restore).toHaveBeenCalledTimes(1);
    setMemoryStoreHook(fakeHook({ restore: vi.fn(async () => Promise.reject(new Error('storage'))) }));
    await expect(restoreMemory('profile:a', memory)).resolves.toBeUndefined();
  });

  it('pull after adopt: started without waiting; a failing pull is swallowed', async () => {
    const hook = fakeHook();
    setMemoryStoreHook(hook);
    pullMemoryAfterAdopt('profile:a');
    expect(hook.pull).toHaveBeenCalledWith('profile:a');
    const failing = vi.fn(async () => Promise.reject(new Error('network')));
    setMemoryStoreHook(fakeHook({ pull: failing }));
    pullMemoryAfterAdopt('profile:a');
    await Promise.resolve();
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
