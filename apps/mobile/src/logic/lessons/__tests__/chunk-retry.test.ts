import { describe, expect, it, vi } from 'vitest';
import { CHUNK_RETRY_DELAYS_MS, isRetryableChunkError, retryLoad } from '../chunk-retry';

describe('retryLoad', () => {
  it('waits the delays in turn and gives the first success', async () => {
    const waits: number[] = [];
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockResolvedValue('chunk');
    await expect(retryLoad(load, [400, 1500], async (ms) => void waits.push(ms))).resolves.toBe('chunk');
    expect(waits).toEqual([400, 1500]);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once the delays are used up', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockRejectedValue(new Error('c'));
    await expect(retryLoad(load, [1, 1], async () => undefined)).rejects.toThrow('c');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('does not retry what a retry cannot mend, or with no delays', async () => {
    const mismatch = Object.assign(new Error('x'), { name: 'LessonChunkMismatch' });
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(mismatch);
    await expect(retryLoad(load, [1, 1], async () => undefined)).rejects.toBe(mismatch);
    expect(load).toHaveBeenCalledTimes(1);
    const plain = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('x'));
    await expect(retryLoad(plain, [], async () => undefined)).rejects.toThrow('x');
    expect(plain).toHaveBeenCalledTimes(1);
  });

  it('uses the real timer and two short delays by default', async () => {
    expect(CHUNK_RETRY_DELAYS_MS).toEqual([400, 1500]);
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('a')).mockResolvedValue('ok');
    await expect(retryLoad(load, [1])).resolves.toBe('ok');
  });
});

describe('isRetryableChunkError', () => {
  it('retries a network failure and a thrown non-error; never another build or a hung request', () => {
    expect(isRetryableChunkError(new Error('Loading module failed'))).toBe(true);
    expect(isRetryableChunkError('boom')).toBe(true);
    for (const name of ['LessonChunkMismatch', 'LessonChunkTimeout', 'RootChunkTimeout']) expect(isRetryableChunkError(Object.assign(new Error('x'), { name })), name).toBe(false);
    expect(isRetryableChunkError(new Error('Requiring unknown module "12"'))).toBe(false);
  });
});
