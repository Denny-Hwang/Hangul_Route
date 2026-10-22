import type { MemoryBackup, MemorySummary } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEMORY_HOOK_TIMEOUT_MS,
  forgetMemorySummary,
  memoryForBackup,
  memorySummaryFor,
  pullMemoryAfterAdopt,
  refreshMemorySummary,
  restoreMemory,
  setMemoryStoreHook,
  type MemoryStoreHook,
} from '../memory-hook';

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

  it('a store that never answers: the backup goes on without the key and the restore finishes, after the timeout', async () => {
    vi.useFakeTimers();
    try {
      const never = (): Promise<never> => new Promise<never>(() => undefined);
      setMemoryStoreHook(fakeHook({ backup: vi.fn(never), restore: vi.fn(never) }));
      const backup = memoryForBackup('profile:a');
      const restore = restoreMemory('profile:a', memory);
      await vi.advanceTimersByTimeAsync(MEMORY_HOOK_TIMEOUT_MS);
      await expect(backup).resolves.toBeUndefined();
      await expect(restore).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
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

describe('the summary memory block (row CM-16)', () => {
  const block: MemorySummary = { wordsKnown: 12, readyToRefresh: 3, cellBestCounts: [4, 0, 0], stageChecks: 0, weekPoints: 5, topDue: ['lex:sagwa'] };
  afterEach(() => {
    forgetMemorySummary('profile:a');
    vi.useRealTimers();
  });

  it('with no store, or a store without a summary: no block', async () => {
    await refreshMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toBeUndefined();
    setMemoryStoreHook(fakeHook());
    await refreshMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toBeUndefined();
  });

  it('holds the store\'s block per profile; an answer of none removes it; a removed profile forgets it', async () => {
    const summary = vi.fn(async (id: string) => (id === 'profile:a' ? block : undefined));
    setMemoryStoreHook(fakeHook({ summary }));
    await refreshMemorySummary('profile:a');
    await refreshMemorySummary('profile:b');
    expect(memorySummaryFor('profile:a')).toEqual(block);
    expect(memorySummaryFor('profile:b')).toBeUndefined();
    summary.mockResolvedValueOnce(undefined);
    await refreshMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toBeUndefined();
    await refreshMemorySummary('profile:a');
    forgetMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toBeUndefined();
  });

  it('keeps the last block when the store fails or does not answer in time', async () => {
    const summary = vi.fn(async () => block);
    setMemoryStoreHook(fakeHook({ summary }));
    await refreshMemorySummary('profile:a');
    summary.mockRejectedValueOnce(new Error('storage'));
    await refreshMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toEqual(block);
    vi.useFakeTimers();
    summary.mockImplementationOnce(() => new Promise(() => undefined));
    const late = refreshMemorySummary('profile:a');
    await vi.advanceTimersByTimeAsync(MEMORY_HOOK_TIMEOUT_MS);
    await late;
    expect(memorySummaryFor('profile:a')).toEqual(block);
    setMemoryStoreHook(null);
    await refreshMemorySummary('profile:a');
    expect(memorySummaryFor('profile:a')).toBeUndefined();
  });
});
