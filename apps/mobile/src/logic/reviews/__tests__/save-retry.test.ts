import { describe, expect, it, vi } from 'vitest';
import { finishOnce, keepRecording, recordAgain } from '../save-retry';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME section 3.5 (row LR-4): the pure parts of a finish that can be tried again. The
 * recordings are kept by round index; Try again records again only the rounds whose recording rejected; a finish
 * runs once per plan.
 */

describe('keepRecording and recordAgain', () => {
  it('keeps a recording by its round index, and a rejection is handled so it never reports as unhandled', async () => {
    const recorded = new Map<number, Promise<void>>();
    const rejected = keepRecording(recorded, 2, Promise.reject(new Error('store full')));
    expect(recorded.get(2)).toBe(rejected);
    await expect(rejected).rejects.toThrow('store full');
  });

  it('records again only the rounds whose recording rejected and puts the new promise in the same place', async () => {
    const recorded = new Map<number, Promise<void>>();
    keepRecording(recorded, 0, Promise.resolve());
    keepRecording(recorded, 1, Promise.reject(new Error('no')));
    keepRecording(recorded, 2, Promise.resolve());
    keepRecording(recorded, 3, Promise.reject(new Error('no')));
    const record = vi.fn(async (_index: number) => undefined);
    await recordAgain(recorded, record);
    expect(record.mock.calls.map(([i]) => i)).toEqual([1, 3]);
    await expect(Promise.all(recorded.values())).resolves.toHaveLength(4);
  });

  it('a recording that rejects again stays in the map as a rejection, for the next try', async () => {
    const recorded = new Map<number, Promise<void>>();
    keepRecording(recorded, 0, Promise.reject(new Error('no')));
    await recordAgain(recorded, () => Promise.reject(new Error('still no')));
    await expect(recorded.get(0)).rejects.toThrow('still no');
    const record = vi.fn(async (_index: number) => undefined);
    await recordAgain(recorded, record);
    expect(record).toHaveBeenCalledTimes(1);
    await expect(recorded.get(0)).resolves.toBeUndefined();
  });

  it('writes nothing again when every recording worked', async () => {
    const recorded = new Map<number, Promise<void>>([[0, Promise.resolve()]]);
    const record = vi.fn(async (_index: number) => undefined);
    await recordAgain(recorded, record);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('finishOnce', () => {
  it('answers the result it computed for the same plan, and never runs the finish twice', async () => {
    const once = finishOnce<object, { n: number }>();
    const plan = {};
    const run = vi.fn(async () => ({ n: 1 }));
    const first = await once(plan, run);
    const second = await once(plan, run);
    expect(second).toBe(first);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('two calls together share one run', async () => {
    const once = finishOnce<object, number>();
    const plan = {};
    let release: (n: number) => void = () => undefined;
    const run = vi.fn(() => new Promise<number>((resolve) => (release = resolve)));
    const a = once(plan, run);
    const b = once(plan, run);
    release(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a rejected finish is not kept: the next call runs it again', async () => {
    const once = finishOnce<object, number>();
    const plan = {};
    const run = vi.fn().mockRejectedValueOnce(new Error('store full')).mockResolvedValueOnce(5);
    await expect(once(plan, run)).rejects.toThrow('store full');
    expect(await once(plan, run)).toBe(5);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('another plan is another finish; a result the caller does not keep (null) is run again', async () => {
    const once = finishOnce<object, number | null>((v) => v !== null);
    const run = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(3);
    const plan = {};
    expect(await once(plan, run)).toBeNull();
    expect(await once(plan, run)).toBe(3);
    expect(await once({}, run)).toBe(3);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
